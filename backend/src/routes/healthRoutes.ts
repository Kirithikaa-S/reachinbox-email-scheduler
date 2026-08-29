import { Router } from 'express';
import { prisma } from '../config/prisma';
import { redisConnection } from '../config/redis';
import { esClient } from '../elasticsearch/emailIndex';

const router = Router();

router.get('/', async (_req, res) => {
  const status = { api: 'ok', mysql: 'ok', redis: 'ok', elasticsearch: 'ok' };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    status.mysql = 'error';
  }

  try {
    await redisConnection.ping();
  } catch {
    status.redis = 'error';
  }

  try {
    await esClient.ping();
  } catch {
    status.elasticsearch = 'error';
  }

  const overallOk = Object.values(status).every((v) => v === 'ok');
  res.status(overallOk ? 200 : 503).json({ success: overallOk, data: status });
});

export default router;
