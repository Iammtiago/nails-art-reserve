// Standalone Express server for local development and API testing:
//   npm run api  ->  http://localhost:4000/api/health

import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectDB } from './lib/db.js';

const { apiPort } = env();
const app = createApp();

const server = app.listen(apiPort, () => {
  console.info(`[api] Nails Art API escuchando en http://localhost:${apiPort}/api`);
});

async function shutdown() {
  server.close();
  await disconnectDB().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
