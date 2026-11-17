'use client';

/* eslint-disable @next/next/no-img-element */
// Ticket image for the panel: the same PNG the client gets in the portal, so the salon can
// send it to her. Used right after a manual booking and in the appointment detail.

import { Download, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { createTicketBlob, saveTicketImage } from '@/lib/ticket-image';
import { useAdmin } from '@/components/admin/AdminContext';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

/**
 * Pre-generates the ticket PNG for `ticket` (needs qrDataUrl) so the click can share it right
 * away: iOS only opens the share sheet inside the user gesture.
 */
export function useTicketImage(ticket) {
  const { settings } = useAdmin();
  const toast = useToast();
  const [image, setImage] = useState({ status: 'preparing', blob: null });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const businessName = settings?.businessName || 'Nails Art';
  const logoUrl = settings?.logoUrl;
  const instagramUrl = settings?.instagramUrl;

  useEffect(() => {
    if (!ticket) return undefined;
    let alive = true;
    setImage({ status: 'preparing', blob: null });
    createTicketBlob({ appointment: ticket, businessName, logoUrl, instagramUrl })
      .then((blob) => alive && setImage({ status: 'ready', blob }))
      .catch(() => alive && setImage({ status: 'error', blob: null }));
    return () => {
      alive = false;
    };
  }, [ticket, businessName, logoUrl, instagramUrl, attempt]);

  function download() {
    if (image.status === 'error') {
      setAttempt((n) => n + 1);
      return;
    }
    if (image.status !== 'ready' || saving) return;
    setSaving(true);
    saveTicketImage(image.blob, ticket.bookingCode)
      .then((result) => {
        if (result === 'downloaded') toast.success('Ticket descargado. Envíaselo a la clienta.');
      })
      .catch(() => toast.error('No se pudo guardar la imagen. Intenta de nuevo.'))
      .finally(() => setSaving(false));
  }

  return { status: image.status, saving, download };
}

export function TicketDownloadButton({ ticket, className = '' }) {
  const { status, saving, download } = useTicketImage(ticket);
  const label = status === 'error' ? 'Reintentar imagen' : status === 'preparing' ? 'Preparando ticket…' : 'Descargar ticket';
  return (
    <Button icon={status === 'error' ? RotateCw : Download} onClick={download} loading={saving} disabled={!ticket || status === 'preparing'} className={className}>
      {label}
    </Button>
  );
}

export function TicketQr({ ticket, size = 200 }) {
  return (
    <img
      src={ticket.qrDataUrl}
      alt={`Código QR de la cita ${ticket.bookingCode}`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-2xl bg-white p-2 shadow-glass"
      decoding="async"
    />
  );
}

/** QR + download for an existing appointment (detail modal). Loads the ticket from the API. */
export function AppointmentTicket({ appointmentId }) {
  const [state, setState] = useState({ ticket: null, error: false });

  useEffect(() => {
    const controller = new AbortController();
    setState({ ticket: null, error: false });
    apiGet(`/api/admin/appointments/${appointmentId}/ticket`, null, { signal: controller.signal })
      .then(({ ticket }) => setState({ ticket, error: false }))
      .catch((error) => {
        if (error?.name !== 'AbortError') setState({ ticket: null, error: true });
      });
    return () => controller.abort();
  }, [appointmentId]);

  if (state.error) return <p className="mt-3 rounded-xl bg-primary-soft/60 px-3 py-2.5 text-center text-sm text-ink-2">No pudimos cargar el código QR de esta cita.</p>;
  if (!state.ticket) {
    return (
      <div className="mt-3 grid h-[200px] place-items-center" aria-live="polite">
        <Spinner />
        <span className="sr-only">Cargando código QR…</span>
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-col items-center gap-3">
      <TicketQr ticket={state.ticket} size={180} />
      <TicketDownloadButton ticket={state.ticket} className="w-full sm:w-auto" />
    </div>
  );
}
