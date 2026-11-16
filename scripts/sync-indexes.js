// Creates every index declared in the Mongoose schemas (idempotent).
// The API also does this on its first connection; this script is for checking a database.
//   npm run db:indexes

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../server/lib/db.js';
import { ALL_MODELS } from '../server/models/index.js';

try {
  await connectDB();
  for (const model of ALL_MODELS) {
    const indexes = await model.collection.indexes();
    console.info(`${model.collection.collectionName}: ${indexes.map((i) => i.name).join(', ')}`);
  }
  console.info(`Índices al día en la base "${mongoose.connection.name}".`);
} catch (error) {
  console.error('No se pudieron crear los índices:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
