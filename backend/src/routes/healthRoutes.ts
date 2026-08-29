import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { redisConnection } from '../config/redis';
import { esClient, isEsAvailable } from '../elasticsearch/emailIndex';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const status = { api: 'ok', mysql: 'ok', redis: 'ok', elasticsearch: 'unavailable' };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    status.mysql = 'error';
  }

  try {
    const pingResult = await redisConnection.ping();
    status.redis = pingResult === 'PONG' ? 'ok' : 'error';
  } catch {
    status.redis = 'error';
  }

  if (isEsAvailable()) {
    try {
      await esClient.ping({}, { requestTimeout: 1000 });
      status.elasticsearch = 'ok';
    } catch {
      status.elasticsearch = 'unavailable';
    }
  }

  const coreHealthy = status.api === 'ok' && status.mysql === 'ok' && status.redis === 'ok';
  res.status(coreHealthy ? 200 : 503).json({ success: coreHealthy, data: status });
});

export default router;
