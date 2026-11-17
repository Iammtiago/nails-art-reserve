import { MongoMemoryServer } from 'mongodb-memory-server-core';
import mongoose from 'mongoose';

export const CSRF = { 'X-Requested-With': 'nails-art' };
// Monday 2026-11-16, 10:00 in America/Caracas (UTC-4).
export const NOW_ISO = '2026-11-16T14:00:00.000Z';
export const TODAY = '2026-11-16';
export const SATURDAY = '2026-11-21';

let memory;

/** Starts an isolated MongoDB and returns a fresh Express app wired to it. */
export async function startTestApp() {
  memory = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = memory.getUri('nails-art-test');
  process.env.APP_URL = 'https://nails-art.test';
  delete process.env.ADMIN_SESSION_SECRET;

  const { setFixedInstant } = await import('../lib/clock.js');
  setFixedInstant(NOW_ISO);
  const { createApp } = await import('../app.js');
  const { connectDB } = await import('../lib/db.js');
  await connectDB();
  return createApp();
}

export async function stopTestApp() {
  const { disconnectDB } = await import('../lib/db.js');
  await disconnectDB();
  if (memory) await memory.stop();
}

export async function resetData() {
  const { Appointment, Client, PurgeLog, RateLimit } = await import('../models/index.js');
  await Promise.all([Appointment.deleteMany({}), Client.deleteMany({}), PurgeLog.deleteMany({}), RateLimit.deleteMany({})]);
  await mongoose.connection.collection('settings').deleteMany({});
}

export function booking(overrides = {}) {
  return {
    serviceKey: 'manicura',
    date: SATURDAY,
    timeSlot: '10:30',
    clientName: 'Ana Ruiz',
    clientPhone: '0414 123 4567',
    ...overrides,
  };
}
