'use client';

import { CalendarDays, ClipboardList, ExternalLink, LogOut, QrCode, Settings, UserCog, Users } from 'lucide-react';
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
import { SuperBanner, SuperModeProvider } from './SuperMode';

export const ADMIN_NAV = [
  { href: '/admin/citas', label: 'Citas', icon: ClipboardList },
  { href: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/admin/escanear', label: 'Escanear', icon: QrCode },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
];

// Outside the bottom bar (five items already fill a 360 px screen): sidebar on desktop, top bar on mobile.
const ACCOUNTS_NAV = { href: '/admin/cuentas', label: 'Cuentas', icon: UserCog };

function greeting(hour) {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function NavLink({ item, active, compact }) {
  const Icon = item.icon;
  if (compact) {
    return (
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.7rem] font-semibold transition ${
          active ? 'bg-brand-grad text-white shadow-lift ring-1 ring-white/20' : 'text-white/75 hover:bg-white/10 hover:text-white'
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
      className={`group relative flex min-h-[44px] shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
        active ? 'bg-brand-grad text-white shadow-lift ring-1 ring-white/20' : 'text-white/75 hover:bg-white/10 hover:text-white'
      }`}
    >
      {active ? <span aria-hidden="true" className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-secondary" /> : null}
      <Icon aria-hidden="true" className={`h-5 w-5 ${active ? '' : 'text-secondary'}`} />
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
    return <LoginScreen statusError={status.error} onRetry={() => status.reload()} onSuccess={() => status.reload({ silent: true })} />;
  }

  const businessName = settingsState.data?.businessName || 'Nails Art';
  const logoUrl = settingsState.data?.logoUrl;
  const username = status.data?.admin?.username || '';
  const nowMinutes = settingsState.data?.now?.minutes;
  const hello = typeof nowMinutes === 'number' ? greeting(Math.floor(nowMinutes / 60)) : 'Hola';
  const accountsActive = pathname?.startsWith(ACCOUNTS_NAV.href);

  return (
    <AdminContext.Provider value={value}>
      <SuperModeProvider handleError={handleError}>
      <div className="aurora aurora-animated" aria-hidden="true">
        <span />
      </div>
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px]">
        {/* Sidebar (desktop) */}
        {/* Fixed to the viewport; the nav scrolls on its own if the window is very short. */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 p-4 lg:block">
          <div className="glass-deep flex h-full flex-col overflow-hidden p-3">
            <div className="flex items-center gap-3 px-2 pb-4 pt-1">
              <BrandLogo src={logoUrl} name={businessName} size={42} />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold leading-tight text-white">{businessName}</p>
                <p className="text-on-deep-2 truncate text-xs font-medium">Panel de administración</p>
              </div>
            </div>
            <div aria-hidden="true" className="mx-2 mb-3 h-px bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
            <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1 [scrollbar-width:thin]" aria-label="Secciones del panel">
              {[...ADMIN_NAV, ACCOUNTS_NAV].map((item) => (
                <NavLink key={item.href} item={item} active={pathname?.startsWith(item.href)} />
              ))}
              <a href="/" target="_blank" rel="noopener noreferrer" className="mt-auto flex min-h-[44px] shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
                <ExternalLink aria-hidden="true" className="h-5 w-5 shrink-0 text-secondary" />
                Ver reservas
                <span className="sr-only"> (página pública, se abre en otra pestaña)</span>
              </a>
            </nav>
            <div className="mt-3 flex shrink-0 items-center gap-2.5 rounded-2xl bg-white/[0.08] p-2 ring-1 ring-white/10">
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary font-display text-base font-semibold text-[var(--color-text)]">
                {username.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-on-deep-2 truncate text-xs">{hello},</p>
                <p className="truncate text-sm font-semibold text-white">{username}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/75 transition hover:bg-white/15 hover:text-white"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut aria-hidden="true" className="h-5 w-5" />
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
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold leading-tight">{businessName}</p>
                  <p className="truncate text-xs text-ink-3">
                    {hello}, <span className="font-semibold text-ink-2">{username}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={ACCOUNTS_NAV.href}
                  aria-current={accountsActive ? 'page' : undefined}
                  className={`btn btn-sm h-11 w-11 !px-0 ${accountsActive ? 'bg-secondary-soft text-primary-ink' : 'btn-ghost'}`}
                  aria-label="Cuentas"
                  title="Cuentas"
                >
                  <UserCog aria-hidden="true" className="h-5 w-5" />
                </Link>
                <button type="button" onClick={logout} className="btn btn-ghost btn-sm h-11 w-11 !px-0" aria-label="Cerrar sesión" title="Cerrar sesión">
                  <LogOut aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          <main id="contenido" className="flex-1 px-3 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
            <SuperBanner />
            {children}
          </main>
        </div>
      </div>

      {/* Bottom navigation (mobile/tablet) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        aria-label="Secciones del panel"
      >
        <div className="glass-deep flex gap-1 rounded-3xl p-1.5">
          {ADMIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={pathname?.startsWith(item.href)} compact />
          ))}
        </div>
      </nav>
      </SuperModeProvider>
    </AdminContext.Provider>
  );
}
