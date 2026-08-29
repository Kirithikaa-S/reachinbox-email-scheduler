import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { ensureEmailIndex } from './elasticsearch/emailIndex';

async function main() {
  await ensureEmailIndex();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`ReachInbox backend listening on port ${env.PORT}`, {
      env: env.NODE_ENV,
      bullBoard: `http://localhost:${env.PORT}/admin/queues`,
    });
  });
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
