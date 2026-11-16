'use client';

import { KeyRound, LifeBuoy, PartyPopper, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DEFAULT_TIMEZONE, LIMITS } from '@shared/constants.js';
import { apiDelete, apiGet } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/Controls';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAdmin } from '../AdminContext';
import { AccountFormModal } from './AccountFormModal';
import { PasswordModal } from './PasswordModal';

const instantFormat = new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short', timeZone: DEFAULT_TIMEZONE });
const dayFormat = new Intl.DateTimeFormat('es-VE', { dateStyle: 'long', timeZone: DEFAULT_TIMEZONE });

const formatInstant = (value) => (value ? instantFormat.format(new Date(value)) : '');
const formatDay = (value) => (value ? dayFormat.format(new Date(value)) : '');

function Avatar({ name, self }) {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-xl font-semibold shadow-glass ${
        self ? 'bg-primary text-primary-on' : 'bg-secondary-soft text-primary-ink'
      }`}
    >
      {initial}
    </div>
  );
}

function AccountCard({ account, onPassword, onDelete, index }) {
  return (
    <li className="glass enter flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5" style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Avatar name={account.username} self={account.isSelf} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-ink">{account.username}</p>
            {account.isSelf ? <Badge tone="brand">Tú</Badge> : null}
            <Badge tone="accent">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Acceso completo
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-2">
            {account.lastLoginAt ? `Último acceso: ${formatInstant(account.lastLoginAt)}` : 'Todavía no ha entrado al panel'}
          </p>
          <p className="text-xs text-ink-3">Creada el {formatDay(account.createdAt)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button variant="secondary" size="sm" icon={KeyRound} onClick={() => onPassword(account)}>
          {account.isSelf ? 'Cambiar mi contraseña' : 'Nueva contraseña'}
        </Button>
        {!account.isSelf ? (
          <Button variant="ghost" size="sm" icon={Trash2} className="!text-danger hover:!bg-danger-soft" onClick={() => onDelete(account)}>
            Borrar
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function AccountsManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const welcome = searchParams.get('bienvenida') === '1';
  const { handleError } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const state = useAsync((signal) => apiGet('/api/admin/accounts', null, { signal }), []);
  const [creating, setCreating] = useState(false);
  const [passwordFor, setPasswordFor] = useState(null);

  const items = state.data?.items || [];
  const max = state.data?.max || LIMITS.accountsMax;
  const full = items.length >= max;
  const onlyMe = items.length === 1;

  function dismissWelcome() {
    router.replace('/admin/cuentas');
  }

  function created(account) {
    setCreating(false);
    toast.success(`Listo: ${account.username} ya puede entrar al panel.`);
    if (welcome) dismissWelcome();
    state.reload({ silent: true });
  }

  function passwordSaved() {
    const self = passwordFor?.isSelf;
    toast.success(self ? 'Tu contraseña quedó cambiada.' : `Nueva contraseña guardada para ${passwordFor?.username}.`);
    setPasswordFor(null);
    state.reload({ silent: true });
  }

  async function remove(account) {
    const ok = await confirm({
      title: `¿Borrar la cuenta de ${account.username}?`,
      message: 'No podrá volver a entrar al panel. Las citas y clientas no se tocan. Esto no se puede deshacer.',
      confirmLabel: 'Borrar cuenta',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/admin/accounts/${account.id}`);
      toast.success(`Cuenta de ${account.username} borrada.`);
      state.reload({ silent: true });
    } catch (error) {
      handleError(error);
    }
  }

  return (
    <>
      <div className="enter">
        <PageHeader
          eyebrow="Acceso al panel"
          title="Cuentas"
          description="Quién puede entrar al panel. Todas las cuentas tienen acceso completo."
          actions={
            <Button icon={UserPlus} onClick={() => setCreating(true)} disabled={full || state.loading}>
              Nueva cuenta
            </Button>
          }
        />
      </div>

      {welcome ? (
        <div className="glass enter mb-5 flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-on shadow-lift">
            <PartyPopper aria-hidden="true" className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold">¡Tu cuenta está lista!</p>
            <p className="text-sm text-ink-2">Ahora crea la cuenta de la manicurista.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={UserPlus} onClick={() => setCreating(true)}>
              Crear la de la manicurista
            </Button>
            <Button variant="ghost" onClick={dismissWelcome}>
              Después
            </Button>
          </div>
        </div>
      ) : null}

      {state.error ? (
        <div className="glass">
          <ErrorState error={state.error} onRetry={() => state.reload()} />
        </div>
      ) : state.loading && !state.data ? (
        <div className="space-y-3" role="status" aria-label="Cargando cuentas">
          <Skeleton className="h-[92px]" />
          <Skeleton className="h-[92px]" />
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((account, index) => (
            <AccountCard key={account.id} account={account} index={index} onPassword={setPasswordFor} onDelete={remove} />
          ))}
        </ul>
      )}

      {state.data && onlyMe && !welcome ? (
        <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line bg-surface/50 p-5 sm:flex-row sm:items-center">
          <Users aria-hidden="true" className="h-6 w-6 shrink-0 text-accent-ink" />
          <p className="flex-1 text-sm text-ink-2">Solo hay una cuenta. Crea la de la manicurista para que pueda ver y atender sus citas.</p>
          <Button variant="soft" size="sm" icon={UserPlus} onClick={() => setCreating(true)}>
            Crear cuenta
          </Button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl bg-primary-soft/60 p-4 text-sm text-ink-2">
          <LifeBuoy aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-ink" />
          <p>
            <span className="font-semibold text-ink">¿Alguien olvidó su contraseña?</span> Desde la otra cuenta, toca «Nueva contraseña» y dásela en persona.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl bg-primary-soft/60 p-4 text-sm text-ink-2">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-ink" />
          <p>
            <span className="font-semibold text-ink">Tu cuenta está protegida.</span> Nadie puede borrar su propia cuenta, así el panel nunca se queda sin acceso.
          </p>
        </div>
      </div>

      {full ? <p className="mt-3 text-xs text-ink-3">Llegaste al máximo de {max} cuentas. Borra una que no uses para crear otra.</p> : null}

      <AccountFormModal open={creating} onClose={() => setCreating(false)} onCreated={created} />
      <PasswordModal account={passwordFor} onClose={() => setPasswordFor(null)} onDone={passwordSaved} />
    </>
  );
}
