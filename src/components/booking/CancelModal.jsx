'use client';

import { CalendarClock, CalendarDays, CalendarX2, Clock, MessageCircle, RotateCw, Search, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateLong, formatTime, formatTimeRange, pluralize } from '@shared/format.js';
import { PHONE_HINT, normalizePhone } from '@shared/phone.js';
import { whatsappLink } from '@shared/whatsapp.js';
import { ApiError, apiGet, apiPatch, errorMessage } from '@/lib/api';
import { loadContact } from '@/lib/saved-contact';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { RescheduleView } from './RescheduleView';

const INVALID_PHONE = 'Revisa el número: por ejemplo 0414 123 4567 o +57 300 123 4567.';
const IDLE = { status: 'idle', items: [], phone: null, cancelled: 0 };

// The API re-normalizes the phone; a leading + keeps numbers from other countries valid.
const apiPhone = (digits) => `+${digits}`;

function AppointmentItem({ item, busy, disabled, onCancel, onReschedule }) {
  return (
    <li className="rounded-2xl border border-line bg-surface/80 p-4">
      <p className="font-semibold text-ink">{item.serviceName}</p>
      <ul className="mt-1.5 space-y-1 text-sm text-ink-2">
        <li className="flex items-center gap-2 font-semibold text-accent-ink">
          <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
          {formatDateLong(item.date)}
        </li>
        <li className="flex items-center gap-2">
          <Clock aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-ink" />
          {formatTimeRange(item.timeSlot, item.endTime)}
        </li>
        <li className="flex items-center gap-2">
          <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-ink" />A nombre de {item.clientFirstName}
        </li>
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {/* Older lookups may lack serviceKey; then only cancelling is offered. */}
        {item.serviceKey ? (
          <Button variant="secondary" size="sm" block icon={CalendarClock} className="min-h-[44px]" disabled={disabled || busy} onClick={() => onReschedule(item)}>
            Reagendar
          </Button>
        ) : null}
        <Button variant="danger" size="sm" block icon={CalendarX2} className={`min-h-[44px] ${item.serviceKey ? '' : 'sm:col-span-2'}`} loading={busy} disabled={disabled} onClick={() => onCancel(item)}>
          Cancelar esta cita
        </Button>
      </div>
    </li>
  );
}

function SearchResults({ search, cancellingId, onCancel, onReschedule, onRetry, helpHref }) {
  if (search.status === 'idle') return null;
  if (search.status === 'loading') return <LoadingState label="Buscando tus citas…" className="py-8" />;
  if (search.status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-danger-soft px-4 py-5 text-center text-sm text-danger">
        <p className="font-medium">No pudimos completar la búsqueda.</p>
        <Button variant="secondary" size="sm" icon={RotateCw} className="min-h-[44px]" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!search.items.length) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={search.cancelled ? 'No te quedan citas activas' : 'No encontramos citas activas con ese número.'}
        description={search.cancelled ? 'Cuando quieras, puedes reservar una nueva.' : 'Si reservaste con otro número, pruébalo. ¿Necesitas ayuda? Escríbenos.'}
        className="py-6"
        action={
          helpHref && !search.cancelled ? (
            <Button variant="whatsapp" icon={MessageCircle} href={helpHref} target="_blank" rel="noopener noreferrer">
              Pedir ayuda por WhatsApp
            </Button>
          ) : null
        }
      />
    );
  }
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink">{pluralize(search.items.length, 'cita activa', 'citas activas')}</p>
      <ul className="space-y-3">
        {search.items.map((item) => (
          <AppointmentItem
            key={item.id}
            item={item}
            busy={cancellingId === item.id}
            disabled={Boolean(cancellingId) && cancellingId !== item.id}
            onCancel={onCancel}
            onReschedule={onReschedule}
          />
        ))}
      </ul>
    </div>
  );
}

export function CancelModal({ open, onClose, settings, initialPhone = '' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [search, setSearch] = useState(IDLE);
  const [cancellingId, setCancellingId] = useState(null);
  // Appointment being rescheduled: the modal swaps the list for the calendar.
  const [moving, setMoving] = useState(null);
  const controllerRef = useRef(null);

  const runSearch = useCallback(
    async (raw) => {
      const normalized = normalizePhone(raw);
      if (!normalized) {
        setPhoneError(INVALID_PHONE);
        setSearch(IDLE);
        return;
      }
      setPhoneError('');
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setSearch({ ...IDLE, status: 'loading', phone: normalized });
      try {
        const data = await apiGet(`/api/appointments/by-phone/${encodeURIComponent(apiPhone(normalized))}`, null, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setSearch({ ...IDLE, status: 'done', items: data?.appointments || [], phone: normalized });
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 422) {
          setPhoneError(error.fieldErrors().phone || error.message);
          setSearch(IDLE);
          return;
        }
        setSearch({ ...IDLE, status: 'error', phone: normalized });
        toast.error(errorMessage(error));
      }
    },
    [toast],
  );

  // Fresh results on every open; with a known phone, search right away.
  useEffect(() => {
    if (!open) {
      controllerRef.current?.abort();
      return undefined;
    }
    setPhoneError('');
    setCancellingId(null);
    setMoving(null);
    if (initialPhone) {
      setPhone(initialPhone);
      runSearch(initialPhone);
    } else {
      // Her phone from a booking on this device, ready to search (not searched on its own).
      setPhone((current) => current || loadContact()?.clientPhone || '');
      setSearch(IDLE);
    }
    return () => controllerRef.current?.abort();
  }, [open, initialPhone, runSearch]);

  async function cancelAppointment(item) {
    // formatTime already ends in «a. m.»/«p. m.»: avoid a double period.
    const when = `${item.serviceName} · ${formatDateLong(item.date)} · ${formatTime(item.timeSlot)}`;
    const ok = await confirm({
      title: '¿Cancelar tu cita?',
      message: `${when}${when.endsWith('.') ? '' : '.'} El horario quedará libre para otra clienta.`,
      confirmLabel: 'Sí, cancelar',
      cancelLabel: 'No, mantenerla',
      tone: 'danger',
    });
    if (!ok) return;
    const remove = () =>
      setSearch((s) => ({ ...s, items: s.items.filter((a) => a.id !== item.id), cancelled: s.cancelled + 1 }));
    setCancellingId(item.id);
    try {
      await apiPatch(`/api/appointments/${item.id}/cancel`, { phone: apiPhone(search.phone) });
      remove();
      toast.success('Tu cita fue cancelada.');
    } catch (error) {
      toast.error(errorMessage(error));
      // It can no longer be cancelled from here: drop it from the list.
      if (error instanceof ApiError && (error.code === 'NOT_ACTIVE' || error.code === 'ALREADY_STARTED')) {
        setSearch((s) => ({ ...s, items: s.items.filter((a) => a.id !== item.id) }));
      }
    } finally {
      setCancellingId(null);
    }
  }

  const helpHref = settings?.phone ? whatsappLink(settings.phone, `Hola ${settings.businessName}, necesito ayuda con mi cita.`) : '';

  if (open && moving) {
    return (
      <Modal open onClose={onClose} title="Reagendar tu cita" description="Elige el nuevo día y la nueva hora." size="md" placement="top">
        <RescheduleView
          item={moving}
          phone={apiPhone(search.phone)}
          onBack={() => setMoving(null)}
          onDone={(updated) => {
            setSearch((s) => ({
              ...s,
              items: s.items.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)).sort((x, y) => `${x.date}${x.timeSlot}`.localeCompare(`${y.date}${y.timeSlot}`)),
            }));
            setMoving(null);
          }}
          onGone={(item) => {
            setSearch((s) => ({ ...s, items: s.items.filter((a) => a.id !== item.id) }));
            setMoving(null);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Mis citas" description="Escribe el teléfono con el que reservaste para reagendar o cancelar tus citas activas." size="md" placement="top">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(phone);
        }}
        noValidate
        className="space-y-3"
      >
        <Field label="Teléfono (WhatsApp)" hint={PHONE_HINT} error={phoneError} required>
          {(p) => (
            <Input
              {...p}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="search"
              maxLength={25}
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setPhoneError('');
              }}
              placeholder="0414 123 4567"
            />
          )}
        </Field>
        <Button type="submit" block icon={Search} loading={search.status === 'loading'}>
          Buscar mis citas
        </Button>
      </form>

      <div className="mt-5" aria-live="polite">
        <SearchResults
          search={search}
          cancellingId={cancellingId}
          onCancel={cancelAppointment}
          onReschedule={setMoving}
          onRetry={() => runSearch(phone)}
          helpHref={helpHref}
        />
      </div>
    </Modal>
  );
}
