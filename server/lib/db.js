// Cached MongoDB connection. Serverless functions reuse it across invocations of the
// same instance; Next dev reuses it across hot reloads through globalThis.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ensureIndexes } from '../models/index.js';
import { unavailable } from './errors.js';

const cache = globalThis.__nailsArtDb || (globalThis.__nailsArtDb = { conn: null, promise: null, memory: null });

async function startLocalMemoryServer() {
  if (!cache.memory) {
    const { MongoMemoryServer } = await import('mongodb-memory-server-core');
    // LOCAL_DB_DIR lets a second local dev server use its own files (one process per folder).
    const dbPath = process.env.LOCAL_DB_DIR ? path.resolve(process.env.LOCAL_DB_DIR) : path.join(process.cwd(), '.data', 'mongo');
    mkdirSync(dbPath, { recursive: true });
    // OneDrive makes the first start slow (over the 10 s default).
    cache.memory = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger', launchTimeout: 60_000 } });
    console.info(`[db] MongoDB local en memoria (datos en ${dbPath}).`);
  }
  return cache.memory.getUri('nails-art');
}

async function resolveUri() {
  const { mongoUri, isProduction } = env();
  if (mongoUri) return mongoUri;
  if (isProduction) throw unavailable('La base de datos no está configurada (MONGODB_URI).', 'DB_NOT_CONFIGURED');
  return startLocalMemoryServer();
}

export async function connectDB() {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise) {
    cache.promise = (async () => {
      const uri = await resolveUri();
      mongoose.set('strictQuery', true);
      const conn = await mongoose.connect(uri, {
        autoIndex: false,
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
      });
      // The unique slot index is what prevents double booking, so make sure it exists.
      await ensureIndexes();
      return conn;
    })().catch((error) => {
      cache.promise = null;
      throw error;
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
  if (cache.memory) {
    await cache.memory.stop();
    cache.memory = null;
  }
}
