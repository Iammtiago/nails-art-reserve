// Creates a panel account from the terminal (local setup, or recovery if every password is lost).
// Usage: ADMIN_USERNAME=tiago ADMIN_PASSWORD=... npm run admin:create
// Values come from the environment so they never land in code or shell history files.

import { accountSchema } from '../shared/schemas.js';
import { connectDB, disconnectDB } from '../server/lib/db.js';
import { hashPassword } from '../server/lib/password.js';
import { AdminUser } from '../server/models/index.js';

const input = {
  username: process.env.ADMIN_USERNAME || '',
  password: process.env.ADMIN_PASSWORD || '',
  passwordConfirm: process.env.ADMIN_PASSWORD || '',
};
const parsed = accountSchema.safeParse(input);
if (!parsed.success) {
  console.error('Datos inválidos:', parsed.error.issues.map((i) => i.message).join(' '));
  process.exit(1);
}

await connectDB();
try {
  const passwordHash = await hashPassword(parsed.data.password);
  await AdminUser.create({ username: parsed.data.username, passwordHash, role: 'superadmin' });
  console.info(`Cuenta «${parsed.data.username}» creada.`);
} catch (error) {
  console.error(error?.code === 11000 ? 'Ese usuario ya existe.' : error);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
