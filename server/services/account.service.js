// Panel accounts (section «Cuentas»). Every account is a superadmin: the salon uses two,
// Tiago and the manicurist, and both can do everything (decision of Tiago, 2026-11-16).
// Guard rails: nobody deletes their own account, so the panel can never end up without one.

import { LIMITS } from '../../shared/constants.js';
import { AppError, conflict, isDuplicateKey, notFound } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { AdminUser } from '../models/index.js';

function toAccount(doc, selfId) {
  return {
    id: String(doc._id),
    username: doc.username,
    role: doc.role,
    createdAt: doc.createdAt,
    lastLoginAt: doc.lastLoginAt || null,
    isSelf: String(doc._id) === selfId,
  };
}

export async function listAccounts(self) {
  const docs = await AdminUser.find({}, { username: 1, role: 1, createdAt: 1, lastLoginAt: 1 }).sort({ createdAt: 1 }).lean();
  return { items: docs.map((doc) => toAccount(doc, self.id)), max: LIMITS.accountsMax };
}

export async function createAccount({ username, password }, self) {
  if ((await AdminUser.countDocuments({})) >= LIMITS.accountsMax) {
    throw conflict(`El panel admite hasta ${LIMITS.accountsMax} cuentas. Borra una que no uses.`, 'ACCOUNTS_FULL');
  }
  const passwordHash = await hashPassword(password);
  try {
    const doc = await AdminUser.create({ username, passwordHash, role: 'superadmin' });
    return toAccount(doc.toObject(), self.id);
  } catch (error) {
    if (isDuplicateKey(error, 'username')) {
      throw new AppError(409, 'Ese usuario ya existe. Elige otro.', {
        code: 'USERNAME_TAKEN',
        details: [{ path: 'username', message: 'Ese usuario ya existe. Elige otro.' }],
      });
    }
    throw error;
  }
}

/**
 * Sets a new password. For your own account the current password is required; for the
 * other account it is not (that is how a forgotten password gets reset).
 * Returns the updated document so the route can renew the caller's session.
 */
export async function changePassword(id, { currentPassword, password }, self) {
  const target = await AdminUser.findById(id).lean();
  if (!target) throw notFound('Esa cuenta ya no existe.', 'ACCOUNT_NOT_FOUND');
  const isSelf = String(target._id) === self.id;

  if (isSelf) {
    const valid = currentPassword ? await verifyPassword(currentPassword, target.passwordHash) : false;
    if (!valid) {
      throw new AppError(422, 'Tu contraseña actual no es correcta.', {
        code: 'CURRENT_PASSWORD_INVALID',
        details: [{ path: 'currentPassword', message: 'Tu contraseña actual no es correcta.' }],
      });
    }
  }

  const passwordHash = await hashPassword(password);
  const updated = await AdminUser.findByIdAndUpdate(id, { $set: { passwordHash } }, { returnDocument: 'after', lean: true });
  return { account: toAccount(updated, self.id), doc: updated, isSelf };
}

export async function deleteAccount(id, self) {
  if (id === self.id) throw conflict('No puedes borrar tu propia cuenta.', 'ACCOUNT_SELF');
  const removed = await AdminUser.findByIdAndDelete(id).lean();
  if (!removed) throw notFound('Esa cuenta ya no existe.', 'ACCOUNT_NOT_FOUND');
  return { ok: true };
}
