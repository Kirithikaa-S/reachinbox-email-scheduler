import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';
import { redisConnection } from '../config/redis';

const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

export function buildSlackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'chat:write,channels:read',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });
  return `${SLACK_AUTHORIZE_URL}?${params.toString()}`;
}

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  team?: { id: string; name: string };
  error?: string;
  incoming_webhook?: { channel_id?: string };
}

export async function exchangeSlackCode(code: string): Promise<SlackOAuthResponse> {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_REDIRECT_URI,
  });

  const res = await fetch(SLACK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  return (await res.json()) as SlackOAuthResponse;
}

export async function connectSlackForUser(
  userId: string,
  data: SlackOAuthResponse
): Promise<void> {
  if (!data.ok || !data.access_token || !data.team) {
    throw new Error(data.error ?? 'Slack OAuth exchange failed');
  }

  await prisma.slackConnection.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: data.access_token,
      teamId: data.team.id,
      teamName: data.team.name,
      channelId: data.incoming_webhook?.channel_id ?? null,
    },
    update: {
      accessToken: data.access_token,
      teamId: data.team.id,
      teamName: data.team.name,
      channelId: data.incoming_webhook?.channel_id ?? null,
    },
  });
}

export async function disconnectSlackForUser(userId: string): Promise<void> {
  await prisma.slackConnection.deleteMany({ where: { userId } });
}

export async function getSlackStatus(userId: string) {
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  return {
    connected: !!connection,
    teamName: connection?.teamName ?? null,
    connectedAt: connection?.connectedAt ?? null,
  };
}

/**
 * Sends a Slack notification, throttled to once per sender per hour to
 * avoid spamming the channel when many jobs hit the rate limit at once.
 */
export async function notifyRateLimitReached(
  userId: string,
  senderEmail: string,
  senderId: string
): Promise<void> {
  const throttleKey = `slack-notify-throttle:${senderId}`;
  const acquired = await redisConnection.set(throttleKey, '1', 'EX', 60 * 60, 'NX');
  if (acquired !== 'OK') {
    logger.debug('Slack notification throttled', { senderId });
    return;
  }

  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!connection) {
    logger.debug('Slack not connected - skipping notification', { userId });
    return;
  }

  const channel = connection.channelId ?? '#general';
  const text = `:hourglass_flowing_sand: Email rate limit reached for sender *${senderEmail}*. Remaining jobs have been rescheduled to the next available hour window.`;

  try {
    const res = await fetch(SLACK_POST_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${connection.accessToken}`,
      },
      body: JSON.stringify({ channel, text }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!json.ok) {
      logger.warn('Slack message failed (non-fatal)', { error: json.error });
    }
  } catch (err) {
    logger.warn('Slack notification error (non-fatal)', {
      error: (err as Error).message,
    });
  }
}
