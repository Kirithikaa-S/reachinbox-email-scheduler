import IORedis, { RedisOptions } from 'ioredis';
import { env } from './env';

// BullMQ requires maxRetriesPerRequest: null on the connection it manages.
const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
};

export const redisConnection = env.REDIS_URL
  ? new IORedis(env.REDIS_URL, redisOptions)
  : new IORedis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      tls: env.REDIS_TLS ? {} : undefined,
      ...redisOptions,
    });

redisConnection.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[redis] connection error:', err.message);
});
