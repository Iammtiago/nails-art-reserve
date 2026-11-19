'use client';

/* eslint-disable @next/next/no-img-element */
import { CalendarPlus, Check, CheckCircle2, Copy, Download, Info, MessageCircle, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDateLong, formatTimeRange } from '@shared/format.js';
import { bookingConfirmationText, whatsappLink } from '@shared/whatsapp.js';
import { createTicketBlob, saveTicketImage } from '@/lib/ticket-image';
import { Badge } from '@/components/ui/Badge';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button, IconButton } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { firstName } from './booking-utils';

function TicketNotch({ side }) {
  const position = side === 'left' ? '-left-3.5' : '-right-3.5';
  return (
    <span
      className={`absolute top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full bg-bg shadow-[inset_0_2px_6px_rgb(var(--color-primary-rgb)/0.16)] ${position}`}
      aria-hidden="true"
    />
  );
}

function selectNode(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function TicketCard({ appointment, settings, onReset, headingRef }) {
  const toast = useToast();
  const { businessName, logoUrl, instagramUrl, phone } = settings;
  const [image, setImage] = useState({ status: 'preparing', blob: null });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);
  const code = String(appointment.bookingCode || '').toUpperCase();

  // Pre-generate the PNG so the click handler can share it immediately (iOS needs the gesture).
  useEffect(() => {
    let alive = true;
    setImage((s) => (s.status === 'preparing' ? s : { status: 'preparing', blob: null }));
    createTicketBlob({ appointment, businessName, logoUrl, instagramUrl })
      .then((blob) => {
        if (alive) setImage({ status: 'ready', blob });
      })
      .catch(() => {
        if (alive) setImage({ status: 'error', blob: null });
      });
    return () => {
      alive = false;
    };
  }, [appointment, businessName, logoUrl, instagramUrl, attempt]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  function handleSave() {
    if (image.status === 'error') {
      setAttempt((n) => n + 1);
      return;
    }
    if (image.status !== 'ready' || saving) return;
    const pending = saveTicketImage(image.blob, code);
    setSaving(true);
    pending
      .then((result) => {
        if (result === 'downloaded') toast.success('Imagen guardada. Búscala en tus descargas o en Fotos.');
      })
      .catch(() => toast.error('No pudimos guardar la imagen. Haz una captura de pantalla de tu ticket.'))
      .finally(() => setSaving(false));
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Código copiado');
      return;
    } catch {
      // Clipboard API unavailable (http, old browser): select the text instead.
    }
    if (!codeRef.current) return;
    selectNode(codeRef.current);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    if (ok) {
      setCopied(true);
      toast.success('Código copiado');
    } else {
      toast.info('Código seleccionado. Cópialo desde el menú de tu teléfono.');
    }
  }

  const whatsappHref = whatsappLink(
    phone,
    bookingConfirmationText({
      businessName,
      clientName: appointment.clientName,
      serviceName: appointment.serviceName,
      date: appointment.date,
      time: appointment.timeSlot,
      code,
    }),
  );

  const rows = [
    ['Nombre', appointment.clientName],
    ['Servicio', appointment.serviceName],
    ['Fecha', formatDateLong(appointment.date, { withYear: true })],
    ['Hora', formatTimeRange(appointment.timeSlot, appointment.endTime)],
  ];

  const saveLabel = image.status === 'error' ? 'Reintentar imagen' : image.status === 'preparing' ? 'Preparando imagen…' : 'Guardar en galería';
  const name = firstName(appointment.clientName);

  return (
    <div>
      <div className="text-center">
        <h2 ref={headingRef} tabIndex={-1} className="section-title outline-none">
          {name ? `¡Listo, ${name}! Tu cita está confirmada` : '¡Listo! Tu cita está confirmada'}
        </h2>
        <p className="mt-1 text-sm text-ink-2">Guarda tu ticket: lo necesitarás al llegar a tu cita.</p>
      </div>

      <article aria-label="Ticket de tu cita" className="glass glass-strong relative mx-auto mt-5 max-w-md overflow-hidden px-5 pb-6 pt-6 sm:px-7">
        <header className="flex flex-col items-center text-center">
          <BrandLogo src={logoUrl} name={businessName} size={56} />
          <p className="mt-2 font-display text-xl font-semibold leading-tight text-ink">{businessName}</p>
          <Badge tone="success" className="mt-2">
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            Cita confirmada
          </Badge>
        </header>

        <div className="mt-5 flex justify-center">
          <img
            src={appointment.qrDataUrl}
            alt="Código QR de tu cita"
            width={220}
            height={220}
            className="h-[220px] w-[220px] rounded-2xl bg-white p-2 shadow-glass"
            decoding="async"
          />
        </div>

        <div className="mt-5 rounded-2xl bg-secondary-soft px-4 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">Tu código</p>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <p ref={codeRef} className="code-text select-all pl-[0.28em] text-[2rem] font-bold leading-tight text-ink sm:text-5xl">
              {code}
            </p>
            <IconButton icon={copied ? Check : Copy} label={copied ? 'Código copiado' : 'Copiar código'} variant="ghost" onClick={copyCode} />
          </div>
        </div>

        <div className="relative -mx-5 my-6 sm:-mx-7" aria-hidden="true">
          <div className="mx-6 border-t-2 border-dashed border-line" />
          <TicketNotch side="left" />
          <TicketNotch side="right" />
        </div>

        <dl className="divide-y divide-line text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="shrink-0 text-ink-2">{label}</dt>
              <dd className="min-w-0 break-words text-right font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 flex items-start gap-2 text-sm text-ink-2">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
          Muestra este código o el QR al llegar a tu cita.
        </p>
      </article>

      <div className="mx-auto mt-5 grid max-w-md gap-2.5">
        <Button
          size="lg"
          block
          icon={image.status === 'error' ? RotateCw : Download}
          loading={image.status === 'preparing' || saving}
          onClick={handleSave}
        >
          {saveLabel}
        </Button>
        {phone ? (
          <Button variant="whatsapp" size="lg" block icon={MessageCircle} href={whatsappHref} target="_blank" rel="noopener noreferrer">
            Confirmar por WhatsApp
          </Button>
        ) : null}
        <Button variant="ghost" block icon={CalendarPlus} onClick={onReset}>
          Reservar otra cita
        </Button>
      </div>
    </div>
  );
}
