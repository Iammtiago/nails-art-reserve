'use client';

import { createContext, useContext } from 'react';

/**
 * Shared by every admin section:
 * - admin: { id, username, role }
 * - settings: public settings (businessName, phone, services, workingHours, now…), or null while loading
 * - reloadSettings(): refetch settings (after saving Configuración)
 * - handleError(error): shows a toast, and sends the user back to the login on 401
 * - logout()
 */
export const AdminContext = createContext(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminShell>');
  return ctx;
}
