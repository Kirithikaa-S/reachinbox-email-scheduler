import IORedis, { RedisOptions } from 'ioredis';
import { env } from './env';

export function getRedisOptions(): RedisOptions {
  let servername: string | undefined;
  if (env.REDIS_URL) {
    try {
      const u = new URL(env.REDIS_URL);
      servername = u.hostname;
    } catch {
      // ignore
    }
  } else {
    servername = env.REDIS_HOST;
  }

  const isTls = env.REDIS_TLS || (env.REDIS_URL ? env.REDIS_URL.startsWith('rediss://') : false);

  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: 4,
    keepAlive: 5000,
    connectTimeout: 10000,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'];
      return targetErrors.some((target) => err.message.includes(target));
    },
  };

  if (isTls) {
    options.tls = {
      rejectUnauthorized: false,
      servername,
    };
  }

  return options;
}

export function createRedisClient(): IORedis {
  const options = getRedisOptions();
  let client: IORedis;

  if (env.REDIS_URL) {
    client = new IORedis(env.REDIS_URL, options);
  } else {
    client = new IORedis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      ...options,
    });
  }

  client.on('error', (err: Error) => {
    // Transient socket resets from serverless idle pruning are handled automatically by ioredis
    if (
      err.message.includes('ECONNRESET') ||
      err.message.includes('EPIPE') ||
      err.message.includes('ETIMEDOUT')
    ) {
      // eslint-disable-next-line no-console
      console.warn('[redis] transient idle socket reset (reconnecting automatically)...');
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[redis] connection error:', err.message);
  });

  return client;
}

let heartbeatTimer: NodeJS.Timeout | null = null;

export function startRedisHeartbeat(client: IORedis): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    if (client.status === 'ready') {
      client.ping().catch(() => {});
    }
  }, 15000);

  if (heartbeatTimer.unref) {
    heartbeatTimer.unref();
  }
}

// BullMQ requires maxRetriesPerRequest: null on the connection it manages.
export const redisConnection = createRedisClient();
startRedisHeartbeat(redisConnection);

