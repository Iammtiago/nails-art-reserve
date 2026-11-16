'use client';

import { CalendarDays, ClipboardList, LogOut, QrCode, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { ApiError, apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { AdminContext } from './AdminContext';
import { LoginScreen } from './LoginScreen';

export const ADMIN_NAV = [
  { href: '/admin/citas', label: 'Citas', icon: ClipboardList },
  { href: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/admin/escanear', label: 'Escanear', icon: QrCode },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
];

function NavLink({ item, active, compact }) {
  const Icon = item.icon;
  if (compact) {
    return (
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.7rem] font-semibold transition ${
          active ? 'bg-secondary-soft text-primary-ink' : 'text-ink-2 hover:text-ink'
        }`}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
        {item.label}
      </Link>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`group flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
        active ? 'bg-primary text-primary-on shadow-lift' : 'text-ink-2 hover:bg-primary-soft hover:text-ink'
      }`}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      {item.label}
    </Link>
  );
}

export function AdminShell({ children }) {
  const pathname = usePathname();
  const toast = useToast();
  const status = useAsync((signal) => apiGet('/api/auth/status', null, { signal }), []);
  const settingsState = useAsync((signal) => apiGet('/api/settings', null, { signal }).then((r) => r.settings), []);

  const authenticated = Boolean(status.data?.authenticated);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout');
    } finally {
      status.reload();
    }
  }, [status]);

  const handleError = useCallback(
    (error) => {
      if (error instanceof ApiError && error.status === 401) {
        toast.info('Tu sesión terminó. Vuelve a entrar.');
        status.reload({ silent: true });
        return;
      }
      toast.error(errorMessage(error));
    },
    [status, toast],
  );

  const value = useMemo(
    () => ({
      admin: status.data?.admin || null,
      settings: settingsState.data,
      reloadSettings: () => settingsState.reload({ silent: true }),
      handleError,
      logout,
    }),
    [status.data, settingsState, handleError, logout],
  );

  if (status.loading && !status.data) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="aurora" aria-hidden="true">
          <span />
        </div>
        <LoadingState label="Abriendo el panel…" />
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen status={status.data} statusError={status.error} onRetry={() => status.reload()} onSuccess={() => status.reload({ silent: true })} />;
  }

  const businessName = settingsState.data?.businessName || 'Nails Art';
  const logoUrl = settingsState.data?.logoUrl;

  return (
    <AdminContext.Provider value={value}>
      <div className="aurora aurora-animated" aria-hidden="true">
        <span />
      </div>
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px]">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 p-4 lg:block">
          <div className="glass flex h-full flex-col p-4">
            <div className="mb-6 flex items-center gap-3 px-1">
              <BrandLogo src={logoUrl} name={businessName} size={44} />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold leading-tight">{businessName}</p>
                <p className="text-xs font-medium text-ink-3">Panel de administración</p>
              </div>
            </div>
            <nav className="flex flex-1 flex-col gap-1" aria-label="Secciones del panel">
              {ADMIN_NAV.map((item) => (
                <NavLink key={item.href} item={item} active={pathname?.startsWith(item.href)} />
              ))}
            </nav>
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 truncate px-1 text-xs text-ink-3">
                Sesión: <span className="font-semibold text-ink-2">{status.data?.admin?.username}</span>
              </p>
              <button type="button" onClick={logout} className="btn btn-ghost btn-sm w-full justify-start">
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar (mobile/tablet) */}
          <header className="sticky top-0 z-30 px-3 pt-3 lg:hidden">
            <div className="glass flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandLogo src={logoUrl} name={businessName} size={36} />
                <p className="truncate font-display text-base font-semibold">{businessName}</p>
              </div>
              <button type="button" onClick={logout} className="btn btn-ghost btn-sm" aria-label="Cerrar sesión">
                <LogOut aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </header>

          <main id="contenido" className="flex-1 px-3 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
            {children}
          </main>
        </div>
      </div>

      {/* Bottom navigation (mobile/tablet) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        aria-label="Secciones del panel"
      >
        <div className="glass glass-strong flex gap-1 rounded-3xl p-1.5">
          {ADMIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={pathname?.startsWith(item.href)} compact />
          ))}
        </div>
      </nav>
    </AdminContext.Provider>
  );
}
