import IORedis, { RedisOptions } from 'ioredis';
import { env } from './env';

export function getRedisOptions(): RedisOptions {
  const isTls = env.REDIS_TLS || (env.REDIS_URL ? env.REDIS_URL.startsWith('rediss://') : false);

  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 10000,
    connectTimeout: 10000,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
  };

  if (isTls) {
    options.tls = {
      rejectUnauthorized: false,
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

  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[redis] connection error:', err.message);
  });

  return client;
}

// BullMQ requires maxRetriesPerRequest: null on the connection it manages.
export const redisConnection = createRedisClient();

