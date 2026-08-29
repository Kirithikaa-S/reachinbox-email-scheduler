import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { redisConnection } from '../config/redis';
import { esClient, isEsAvailable } from '../elasticsearch/emailIndex';

const router = Router();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

router.get('/', async (_req: Request, res: Response) => {
  const status = { api: 'ok', mysql: 'ok', redis: 'ok', elasticsearch: 'unavailable' };

  const [mysqlResult, redisResult] = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, 2000),
    withTimeout(redisConnection.ping(), 3500),
  ]);

  status.mysql = mysqlResult.status === 'fulfilled' ? 'ok' : 'error';
  status.redis =
    redisResult.status === 'fulfilled' && redisResult.value === 'PONG' ? 'ok' : 'error';

  if (isEsAvailable()) {
    try {
      await withTimeout(esClient.ping({}, { requestTimeout: 1000 }), 1000);
      status.elasticsearch = 'ok';
    } catch {
      status.elasticsearch = 'unavailable';
    }
  }

  const coreHealthy = status.api === 'ok' && status.mysql === 'ok' && status.redis === 'ok';
  res.status(coreHealthy ? 200 : 503).json({ success: coreHealthy, data: status });
});

export default router;
