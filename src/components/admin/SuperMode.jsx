'use client';

// Hidden superadmin mode. Four quick taps on any section title (PageHeader) open the key
// prompt; the server checks the key and elevates this session for 15 minutes. While it is on,
// «Eliminar» buttons appear on clients and appointments. Nothing here is trusted by the server:
// every deletion is checked and audited there.

import { KeyRound, ShieldAlert, Trash2 } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { formatDateLong, formatTime, pluralize } from '@shared/format.js';
import { ApiError, apiDelete, apiGet, apiPost } from '@/lib/api';
import { Button, IconButton } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useToast } from '@/components/ui/Toast';

const SuperModeContext = createContext(null);

const TAPS_TO_OPEN = 4;
const TAP_GAP_MS = 700;

export function useSuperMode() {
  return useContext(SuperModeContext);
}

/** onClick for a section title: the fourth quick tap opens the key prompt. No-op outside the panel. */
export function useSuperTaps() {
  const ctx = useContext(SuperModeContext);
  const taps = useRef({ count: 0, last: 0 });
  return useCallback(() => {
    if (!ctx) return;
    const now = Date.now();
    const t = taps.current;
    t.count = now - t.last <= TAP_GAP_MS ? t.count + 1 : 1;
    t.last = now;
    if (t.count >= TAPS_TO_OPEN) {
      t.count = 0;
      ctx.openPrompt();
    }
  }, [ctx]);
}

function minutesLeft(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60_000));
}

function KeyPrompt({ open, onClose, onUnlocked }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setKey('');
      setError('');
    }
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    if (!key.trim()) {
      setError('Escribe la clave.');
      return;
    }
    setBusy(true);
    try {
      onUnlocked(await apiPost('/api/admin/super/unlock', { key: key.trim() }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos comprobar la clave. Intenta de nuevo.');
      setKey('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Modo superadmin" description="Escribe la clave para poder eliminar datos del panel." size="sm" placement="top" initialFocusRef={inputRef}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Clave" error={error || undefined}>
          {(p) => (
            <PasswordInput
              {...p}
              ref={inputRef}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError('');
              }}
              inputMode="numeric"
              autoComplete="off"
              maxLength={32}
            />
          )}
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icon={KeyRound} loading={busy}>
            Entrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SuperModeProvider({ handleError, children }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [state, setState] = useState({ active: false, expiresAt: null });
  const [promptOpen, setPromptOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiGet('/api/admin/super', null, { signal: controller.signal })
      .then(setState)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Refresh the remaining minutes and switch off when the elevation expires.
  useEffect(() => {
    if (!state.active) return undefined;
    const timer = setInterval(() => {
      if (minutesLeft(state.expiresAt) === 0) setState({ active: false, expiresAt: null });
      else setTick((n) => n + 1);
    }, 20_000);
    return () => clearInterval(timer);
  }, [state]);

  const lock = useCallback(async () => {
    setState({ active: false, expiresAt: null });
    try {
      await apiPost('/api/admin/super/lock');
    } catch {
      // The cookie expires on its own in a few minutes.
    }
  }, []);

  const purge = useCallback(
    async (entity, item) => {
      const isClient = entity === 'client';
      let title;
      let message;
      if (isClient) {
        title = `¿Eliminar a ${item.name} para siempre?`;
        message = `Se borran la clienta y todas sus citas (${pluralize(item.totalAppointments, 'reserva registrada', 'reservas registradas')}), también las próximas. No se puede deshacer.`;
      } else if (item.kind === 'block') {
        title = '¿Eliminar este horario ocupado?';
        message = `${formatDateLong(item.date)}, ${formatTime(item.timeSlot)}: desaparece del calendario. No se puede deshacer.`;
      } else {
        title = '¿Eliminar esta cita para siempre?';
        message = `${item.clientName} · ${item.serviceName} · ${formatDateLong(item.date)}, ${formatTime(item.timeSlot)}: desaparece del historial y de los contadores. No se puede deshacer.`;
      }
      const ok = await confirm({ title, message, confirmLabel: 'Eliminar', cancelLabel: 'Volver', tone: 'danger' });
      if (!ok) return false;
      try {
        await apiDelete(`/api/admin/super/${isClient ? 'clients' : 'appointments'}/${item.id}`);
        toast.success(isClient ? `${item.name} y sus citas fueron eliminadas.` : 'Eliminada para siempre.');
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          setState({ active: false, expiresAt: null });
          toast.info('El modo superadmin terminó. Vuelve a activarlo.');
          return false;
        }
        handleError(error);
        return error instanceof ApiError && error.status === 404;
      }
    },
    [confirm, toast, handleError],
  );

  const value = useMemo(
    () => ({ ...state, openPrompt: () => setPromptOpen(true), lock, purge }),
    [state, lock, purge],
  );

  return (
    <SuperModeContext.Provider value={value}>
      {children}
      <KeyPrompt
        open={promptOpen}
        onClose={() => setPromptOpen(false)}
        onUnlocked={(next) => {
          setState(next);
          setPromptOpen(false);
          toast.success('Modo superadmin activo por 15 minutos.');
        }}
      />
    </SuperModeContext.Provider>
  );
}

/** Band shown on top of every section while the mode is on. */
export function SuperBanner() {
  const ctx = useSuperMode();
  if (!ctx?.active) return null;
  const left = minutesLeft(ctx.expiresAt);
  return (
    <div role="status" className="enter mb-4 flex items-center gap-3 rounded-2xl bg-danger px-4 py-2.5 text-white shadow-lift">
      <ShieldAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm font-semibold">
        Modo superadmin <span className="font-normal opacity-90">· puedes eliminar datos · {pluralize(left, 'minuto', 'minutos')}</span>
      </p>
      <button type="button" onClick={ctx.lock} className="min-h-[44px] shrink-0 rounded-xl bg-white/15 px-3 text-sm font-semibold transition hover:bg-white/25">
        Salir
      </button>
    </div>
  );
}

/** «Eliminar» button, only rendered while the mode is on. onDeleted runs after a deletion. */
export function SuperDeleteButton({ entity, item, onDeleted, compact = false, className = '' }) {
  const ctx = useSuperMode();
  const [busy, setBusy] = useState(false);
  if (!ctx?.active) return null;
  const label = entity === 'client' ? `Eliminar a ${item.name}` : `Eliminar la cita de ${item.clientName}`;
  const run = async () => {
    setBusy(true);
    const done = await ctx.purge(entity, item);
    setBusy(false);
    if (done) onDeleted?.(item);
  };
  if (compact) {
    return <IconButton icon={Trash2} label={label} variant="danger" onClick={run} disabled={busy} className={className} />;
  }
  return (
    <Button variant="danger" size="sm" icon={Trash2} loading={busy} onClick={run} aria-label={label} className={`min-h-[44px] ${className}`}>
      Eliminar
    </Button>
  );
}
