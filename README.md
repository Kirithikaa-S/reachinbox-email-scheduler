# ReachInbox Full-Stack Email Scheduler

A production-style full-stack email scheduler dashboard: schedule bulk email
campaigns with per-sender rate limiting, persistent BullMQ scheduling, Google
and Slack OAuth, and Elasticsearch-backed search.

## 1. Overview

Users log in with Google, compose an email, upload/paste a list of
recipients, and schedule it to go out starting at a chosen time with a
configurable delay between sends and a configurable hourly send limit per
sender. Sending is handled by a BullMQ worker backed by Redis, persisted in
MySQL, and survives backend restarts. Sent/scheduled emails are indexed in
Elasticsearch for search. Slack notifies the user when a sender's hourly
limit is hit.

## 2. Features

- Google OAuth login (real, via Passport) with HTTP-only cookie JWT sessions
- Compose modal: subject, body, CSV/text upload or pasted recipients, start
  time, delay, hourly limit, client-side validation, toasts
- Scheduled / Sent email tables with loading, empty, and error states
- Elasticsearch-backed search across recipient/subject/body
- Slack OAuth connect/disconnect + automatic rate-limit notifications
- BullMQ delayed jobs (no cron/setInterval) with deterministic job IDs
- MySQL-persisted scheduling that survives backend/worker restarts
- Idempotent sending (never double-sends on retry/restart)
- Redis-backed hourly rate limiting per sender (reschedules, never drops)
- Redis-backed minimum delay between sends, safe across multiple workers
- Bull Board live queue dashboard at `/admin/queues`
- Ethereal SMTP integration with preview URLs
- Multiple senders (Sender model, selectable per campaign)

## 3. Architecture

```
Frontend (React/Vite) --> Backend API (Express) --> MySQL (Prisma)
                                 |                        ^
                                 v                        |
                            BullMQ Queue (Redis) ---> Worker process
                                 |                        |
                                 v                        v
                          Bull Board UI          Ethereal SMTP + Elasticsearch
                                                          |
                                                          v
                                                   Slack notifications
```

The API process and the worker process are separate Node processes that
share the same Redis (BullMQ) and MySQL (Prisma) backends. This is what
makes scheduling survive a backend restart: jobs live in Redis, and their
source of truth (status, retry count, etc.) lives in MySQL.

## 4. Tech Stack

Backend: TypeScript, Express, BullMQ, ioredis, Prisma (MySQL), Nodemailer
(Ethereal), `@elastic/elasticsearch`, Passport (Google OAuth), Slack Web
API, Bull Board, Zod, Helmet.

Frontend: React 18, TypeScript, Vite, Tailwind CSS, React Router.

Infra: MySQL 8, Redis 7, Elasticsearch 8 (via Docker Compose).

## 5. Project Structure

```
reachinbox-email-scheduler/
  backend/
    src/
      config/        env, prisma client, redis connection
      auth/           Google OAuth (passport), JWT cookie auth
      routes/         auth, emails, slack, senders, health
      services/       scheduling service (campaign creation)
      workers/        BullMQ email worker (send flow)
      queues/         BullMQ queue + Bull Board wiring
      ratelimit/      Redis-backed hourly limit + min-delay lock
      smtp/           Ethereal/Nodemailer service
      elasticsearch/  index + search service
      slack/          OAuth + notification service
      middleware/     error handler, basic auth (Bull Board)
      utils/          logger, AppError, email/CSV parser, validation
    prisma/
      schema.prisma
      seed.ts
    tests/            vitest unit tests
  frontend/
    src/
      components/     Button, Input, Modal, EmailTable, Header, etc.
      pages/           LoginPage, DashboardPage
      context/         AuthContext, ToastContext
      services/        api.ts (centralized fetch client)
      types/
  docker-compose.yml
  .env.example
  README.md
```

## 6. Prerequisites

- Node.js 20+ and npm
- Docker (for MySQL/Redis/Elasticsearch) - or your own local instances
- A free Ethereal Email account: https://ethereal.email/create
- A Google Cloud OAuth client (see section 14)
- A Slack app (see section 15) - optional but required for the Slack flow

## 7. Installation

```bash
# 1. Infrastructure
docker compose up -d

# 2. Backend
cd backend
cp ../.env.example .env   # then fill in required values, see section 8
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed               # optional: creates a demo user + sender
npm run dev                # starts the API on :5000

# 3. Worker (separate terminal)
cd backend
npm run worker

# 4. Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                # starts the frontend on :5173
```

> **Note on `npx prisma generate`:** this downloads Prisma's query engine
> binary from `binaries.prisma.sh` the first time it runs. If you're
> building this in a network-restricted CI/sandbox environment (as this
> project was scaffolded in), that domain may be blocked, and `generate`
> will fail with a 403. On a normal developer machine or CI runner with
> unrestricted internet access this works out of the box. If you're stuck
> behind a restrictive proxy, see Prisma's docs on `PRISMA_ENGINES_MIRROR`.

## 8. Environment Variables

See `.env.example` at the project root - copy it to `backend/.env`. Values
you **must** fill in yourself:

| Variable | Why |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login |
| `ETHEREAL_USER` / `ETHEREAL_PASSWORD` | SMTP sending (get free creds at ethereal.email) |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack OAuth + notifications |
| `SESSION_SECRET` / `JWT_SECRET` | Change from the dev defaults for anything beyond local use |

Everything else has a sensible local default (see `.env.example`).

## 9. MySQL Setup

`docker compose up -d` starts MySQL 8 on `localhost:3306` with database
`reachinbox`, user `root`, password `password` (matches the default
`DATABASE_URL`). Prefer a managed/local MySQL instance instead? Just point
`DATABASE_URL` at it.

## 10. Redis Setup

`docker compose up -d` starts Redis 7 on `localhost:6379`. Both the API
process and the worker process connect to the same Redis instance - it is
the backbone of BullMQ scheduling and the rate limiter.

## 11. Elasticsearch Setup

`docker compose up -d` starts a single-node Elasticsearch 8 cluster (with
security disabled for local dev) on `localhost:9200`. The backend creates
the `emails` index automatically on startup if it doesn't exist. If
Elasticsearch is unreachable, scheduling/sending still works - search
requests just return an empty result set and a warning is logged (see
section 14 of the assignment spec / section 28 below).

## 12. Prisma Setup

```bash
cd backend
npx prisma generate       # generates the typed client
npx prisma migrate dev    # creates tables from prisma/schema.prisma
npm run seed               # optional demo user + sender
```

## 13. Ethereal Setup

1. Go to https://ethereal.email/create and generate a free test SMTP
   account.
2. Put the generated username/password into `ETHEREAL_USER` /
   `ETHEREAL_PASSWORD` in `backend/.env`.
3. Sent emails never leave Ethereal's sandbox - each send returns a preview
   URL (also shown in the Sent Emails table) where you can view the
   rendered email.

## 14. Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) →
   APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID, type "Web application".
3. Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
4. Copy the Client ID/Secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Under "OAuth consent screen", add yourself as a test user if the app is
   in testing mode.

## 15. Slack OAuth Setup

1. Go to https://api.slack.com/apps → Create New App → From scratch.
2. Under **OAuth & Permissions**, add the `chat:write` and `channels:read`
   bot scopes, and set the redirect URL to
   `http://localhost:5000/api/slack/callback`.
3. Install the app to your workspace, then copy the **Client ID** and
   **Client Secret** from Basic Information into `SLACK_CLIENT_ID` /
   `SLACK_CLIENT_SECRET`.
4. Invite the bot to the channel you want notifications posted in (default
   channel is `#general` unless an `incoming_webhook.channel_id` is
   returned during OAuth).

## 16. Running Backend

```bash
cd backend
npm run dev         # ts-node/tsx dev server with reload, port 5000
npm run build && npm start   # production build
```

## 17. Running Worker

```bash
cd backend
npm run worker       # dev, with reload
npm run build && npm run start:worker  # production build
```

Run multiple worker processes (or increase `WORKER_CONCURRENCY`) to scale
throughput - the Redis-backed rate limiter and min-delay lock make this
safe.

## 18. Running Frontend

```bash
cd frontend
npm run dev          # http://localhost:5173
npm run build         # production build -> dist/
```

## 19. Bull Board

Visit `http://localhost:5000/admin/queues` while the backend is running.
Protected with HTTP Basic Auth (`BULL_BOARD_USER` / `BULL_BOARD_PASSWORD`,
default `admin`/`admin` for local dev - change these for anything public).

## 20. API Endpoints

**Auth**
- `GET /api/auth/google` - start Google OAuth
- `GET /api/auth/google/callback`
- `GET /api/auth/me` - current user
- `POST /api/auth/logout`

**Emails**
- `POST /api/emails/schedule` - create a campaign + scheduled emails
- `GET /api/emails/scheduled`
- `GET /api/emails/sent`
- `GET /api/emails/search?q=`
- `GET /api/emails/:id`
- `POST /api/emails/parse-upload` - multipart file upload, returns parsed emails

**Slack**
- `GET /api/slack/connect`
- `GET /api/slack/callback`
- `POST /api/slack/disconnect`
- `GET /api/slack/status`

**Senders**
- `GET /api/senders`
- `POST /api/senders`

**Health**
- `GET /api/health`

All authenticated endpoints require the `reachinbox_token` HTTP-only
cookie set at Google OAuth callback time.

## 21. Scheduling Architecture

`POST /api/emails/schedule` (see `src/services/schedulingService.ts`):

1. Validates the request body with Zod.
2. Creates a `Campaign` row.
3. For each recipient, computes `scheduledAt = startTime + index * delayMs`
   (preserving submission order) and creates a `ScheduledEmail` row with
   status `scheduled`.
4. Adds a BullMQ delayed job (`delay = scheduledAt - now`) with a
   **deterministic job ID** (`email-<scheduledEmailId>`), and stores that
   job ID back on the row.
5. Indexes the row into Elasticsearch (best-effort).

Scheduling is **not** cron/`setInterval`-based - every send is a discrete
BullMQ delayed job that Redis wakes the worker up for.

## 22. Restart Persistence

This is the core requirement: schedule an email for the future, kill the
backend/worker, restart them, and the email still sends on time.

**How it works:** BullMQ stores delayed jobs in Redis, not in the Node
process's memory. When you `queue.add(..., { delay })`, BullMQ schedules the
job inside Redis (via a sorted set keyed by "ready at" timestamp) and
survives independently of whether any Node process is currently running. A
new worker process that connects to the same Redis instance immediately
sees existing delayed jobs and will pick them up the moment they become
ready - the job was never "in-memory only".

On the MySQL side, we never rebuild jobs from scratch on startup. Each
`ScheduledEmail.bullJobId` is the source of truth linking a DB row to its
BullMQ job; we don't need a reconciliation pass because the job survives in
Redis independent of the Node process's lifecycle.

## 23. Idempotency

- **Deterministic job IDs** (`email-<scheduledEmailId>`) mean re-adding a
  job for the same scheduled email is a no-op/rejected by BullMQ rather
  than creating a duplicate.
- Before sending, the worker checks `status === 'sent'` and short-circuits.
- The worker performs an atomic `scheduled -> processing` transition via
  `prisma.scheduledEmail.updateMany({ where: { id, status: 'scheduled' } })`
  - if two workers race for the same row, only one gets `count: 1` back.
- After a successful SMTP send we store the Ethereal `messageId` and flip
  status to `sent` in the same update.

**Known limitation:** if the process crashes *between* a successful SMTP
send and the DB write marking it `sent`, BullMQ's retry could cause a
duplicate send - this is an inherent limitation of any at-least-once
delivery system talking to an external side-effecting API without
two-phase commit. We minimize the window by writing to MySQL immediately
after `sendMail` resolves, and Ethereal itself is a sandbox (no real
recipients), so this is safe to demo.

## 24. Worker Concurrency

Set `WORKER_CONCURRENCY` (default 5) - passed straight into
`new Worker(..., { concurrency })`. The worker processes that many jobs
concurrently from the queue.

## 25. Minimum Delay

`MIN_EMAIL_DELAY_MS` (default 2000) is enforced with a Redis `SET key 1 PX
<ms> NX` lock per sender (`src/ratelimit/rateLimiter.ts`). A worker that
fails to acquire the lock re-delays its job by `MIN_EMAIL_DELAY_MS` instead
of sending immediately. This works correctly across multiple worker
processes because the lock lives in Redis, not in any one process's memory.

## 26. Hourly Rate Limiting

Redis key: `email-rate:{senderId}:{YYYY-MM-DD-HH}` (UTC hour bucket),
incremented atomically with `INCR` and expired after 2 hours. If the
increment pushes the counter past the configured limit, we `DECR` it back
(so the counter reflects only real sends) and reschedule the job to the
next hour boundary, updating both `ScheduledEmail.scheduledAt` in MySQL and
the BullMQ job's delay. **Jobs are never dropped or permanently failed**
for hitting the hourly limit. A throttled Slack notification (max once per
sender per hour) is sent when this happens. See
`src/ratelimit/rateLimiter.ts` for the full trade-off discussion.

## 27. Slack Rate Limit Notification

When `checkAndIncrementHourlyLimit` reports the limit was hit, the worker
calls `notifyRateLimitReached(userId, senderEmail, senderId)`, which:
- Skips silently if the user hasn't connected Slack.
- Uses a Redis `SET ... EX 3600 NX` lock per sender to send at most one
  notification per hour, avoiding a burst of messages when many jobs hit
  the limit at once.
- Posts via `chat.postMessage` using the stored OAuth access token.

## 28. Elasticsearch Search

`GET /api/emails/search?q=` runs a `bool` query across `recipient`,
`subject`, and `body` fields, scoped to the authenticated user. Both
scheduling and the send worker index/update the document at each status
transition. All Elasticsearch calls are wrapped in try/catch and logged as
warnings rather than thrown - a search-layer outage never breaks
scheduling or sending.

## 29. 1000+ Job Behavior

1000 jobs becoming "ready" at once are still gated by:
- `WORKER_CONCURRENCY` - only N are pulled off the queue at a time.
- The min-delay lock - each sender only accepts a new send every
  `MIN_EMAIL_DELAY_MS`.
- The hourly limit - once a sender's hour bucket is full, the remaining
  jobs are automatically pushed to the next hour (and the one after, etc.)
  rather than sent in a burst or failed.

## 30. Order Preservation

Each `ScheduledEmail` has a `sequence` field (its index within the
campaign) and an initial `scheduledAt` spaced by `delayMs`, so emails leave
in submission order under normal conditions. When the hourly limit forces a
reschedule, the job moves to the next hour boundary but keeps its relative
position among other rescheduled jobs from the same run (they're all
pushed by the same `msUntilNextHour`), so relative ordering is preserved as
much as is reasonably possible without a distributed priority queue.

## 31. Assumptions

- A user's first campaign auto-creates a "Default Sender" using the shared
  `ETHEREAL_USER`/`ETHEREAL_PASSWORD` env credentials, since dynamically
  provisioning distinct Ethereal accounts per sender is unnecessarily
  complex for this assignment. Additional senders can be created via
  `POST /api/senders` with their own Ethereal credentials.
- The hourly limit window is a fixed UTC clock-hour bucket, not a rolling
  window.
- Bull Board is protected with HTTP Basic Auth rather than reusing the
  Google-OAuth session, to keep it independently accessible for ops/demo
  purposes.

## 32. Trade-offs

- MySQL + Redis + Elasticsearch is more infrastructure than a toy app
  needs, but it's what the assignment specifies; Docker Compose keeps
  local setup to one command.
- The rate limiter uses simple fixed-window counters (`INCR` + `EXPIRE`)
  rather than a sliding-window/token-bucket algorithm, trading perfect
  smoothness for simplicity and auditability.
- No pagination on `/api/emails/scheduled` and `/sent` (capped at 200 rows)
  - fine for an assignment demo, would need cursor pagination at scale.

## 33. Demo Instructions

1. `docker compose up -d`
2. Backend: `cd backend && npm run dev`
3. Worker: `cd backend && npm run worker`
4. Frontend: `cd frontend && npm run dev`
5. Open `http://localhost:5173`, click **Continue with Google**.
6. On the dashboard, click **Connect Slack** (optional).
7. Click **Compose New Email**, fill subject/body, upload a CSV or paste a
   couple of addresses, set start time ~30-60s in the future, delay
   `2000`, hourly limit e.g. `3` (to see rate limiting in action with a
   small list).
8. Click **Schedule** - see the rows appear under **Scheduled Emails**.
9. Wait - rows move to **Sent Emails** with a preview link once sent.
10. Open `http://localhost:5000/admin/queues` (admin/admin) to watch jobs
    live.
11. **Restart demo:** schedule one more email ~2 minutes out, stop the
    backend AND worker, restart both, wait - the email still sends because
    it lives in Redis, not process memory.
12. **Rate limit demo:** with hourly limit set low (e.g. 3) and 5+
    recipients, watch the extra jobs get pushed to "next hour" in Bull
    Board's delayed tab, and (if Slack is connected) a notification
    arrive.

## Troubleshooting

- **`prisma generate` fails with a 403 to `binaries.prisma.sh`**: your
  network/proxy is blocking Prisma's engine CDN. See section 7's note.
- **Google login redirects to `/login?error=oauth_failed`**: double-check
  the redirect URI in Google Cloud Console matches `GOOGLE_CALLBACK_URL`
  exactly.
- **Emails never leave "processing"**: check the worker process is
  actually running (`npm run worker`) - the API process alone does not
  send email.
- **Elasticsearch search returns nothing**: confirm
  `curl http://localhost:9200` responds; the app degrades gracefully but
  obviously can't search if ES is down.
