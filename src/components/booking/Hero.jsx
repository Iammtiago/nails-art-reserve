'use client';

import { ArrowDown, CalendarHeart, CheckCircle2, ChevronRight, Clock, MessageCircle, QrCode, Sparkles, Timer, UserRoundCheck } from 'lucide-react';
import { useMemo } from 'react';
import { formatDuration } from '@shared/format.js';
import { whatsappLink } from '@shared/whatsapp.js';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { serviceIcon } from './booking-utils';
import { openStatus, sampleQrCells } from './landing-utils';

const STATUS_TONES = {
  open: 'bg-success-soft text-success',
  break: 'bg-warning-soft text-warning',
  closed: 'bg-primary-soft text-ink-2',
};

const PERKS = [
  { icon: Timer, label: 'Lista en 1 minuto' },
  { icon: QrCode, label: 'Ticket con código QR' },
  { icon: UserRoundCheck, label: 'Sin crear cuenta' },
];

function StatusChip({ status }) {
  if (!status) return null;
  return (
    <p className={`chip w-fit py-1.5 pl-2 pr-3 text-[0.8rem] ${STATUS_TONES[status.tone] || STATUS_TONES.closed}`}>
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        {status.open ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" /> : null}
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
      </span>
      {status.label}
    </p>
  );
}

function SampleQr() {
  const cells = useMemo(() => sampleQrCells(), []);
  return (
    <svg viewBox="0 0 21 21" className="h-20 w-20 rounded-lg bg-white p-1.5" shapeRendering="crispEdges" aria-hidden="true">
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="var(--color-text)" />
      ))}
    </svg>
  );
}

/** Desktop-only composition: a sample ticket behind a quick «pick your service» card. */
function HeroVisual({ settings, onPickService }) {
  const services = settings.services || [];
  const sample = services[0]?.name || 'Manicura';
  return (
    <div className="relative mx-auto hidden w-full max-w-[440px] lg:block">
      <div
        aria-hidden="true"
        className="absolute -inset-10 -z-10 rounded-[4rem] bg-[radial-gradient(circle_at_60%_40%,rgb(var(--color-secondary-rgb)/0.75),transparent_65%)] blur-2xl"
      />

      {/* Sample ticket */}
      <div aria-hidden="true" className="glass glass-strong absolute -right-4 -top-4 w-60 rotate-[5deg] p-4 shadow-lift">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BrandLogo src={settings.logoUrl} name={settings.businessName} size={28} />
            <span className="text-xs font-semibold text-ink-2">Tu ticket</span>
          </div>
          <span className="chip bg-accent-soft text-accent-ink">Ejemplo</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold leading-tight">{sample}</p>
            <p className="text-xs text-ink-2">Sábado · 10:30 a. m.</p>
            <p className="code-text mt-2 font-semibold text-primary-ink">NA84K2</p>
          </div>
          <SampleQr />
        </div>
      </div>

      {/* Quick pick: the featured card, on the deep surface. */}
      <div className="glass-deep relative mr-10 mt-40 -rotate-1 p-5">
        <p className="eyebrow !text-secondary">¿Qué te haces hoy?</p>
        <p className="text-on-deep-2 mt-1 text-sm">Toca un servicio y elige tu hora.</p>
        <ul className="mt-4 space-y-2">
          {services.slice(0, 5).map((service) => {
            const Icon = serviceIcon(service);
            return (
              <li key={service.key}>
                <button
                  type="button"
                  onClick={() => onPickService(service)}
                  className="group flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-3 text-left transition hover:-translate-y-px hover:border-white/25 hover:bg-white/[0.14]"
                >
                  <span className="tile-on-deep h-9 w-9" aria-hidden="true">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{service.name}</span>
                    <span className="text-on-deep-2 flex items-center gap-1 text-xs">
                      <Clock aria-hidden="true" className="h-3 w-3" />
                      {formatDuration(service.durationMinutes)}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-secondary opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">Reservar</span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-white/60 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p aria-hidden="true" className="chip absolute -bottom-5 left-2 rotate-[-3deg] bg-surface py-2 pl-2 pr-3 text-[0.8rem] text-success shadow-lift">
        <CheckCircle2 className="h-4 w-4" />
        Confirmada al instante
      </p>
    </div>
  );
}

/** Phones and tablets: the same «pick your service» shortcut as the desktop card, as a strip. */
function QuickPickStrip({ services, onPickService }) {
  if (!services.length) return null;
  return (
    <div className="glass-deep -mt-4 p-4 lg:hidden">
      <p className="eyebrow !text-secondary">¿Qué te haces hoy?</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {services.slice(0, 6).map((service) => {
          const Icon = serviceIcon(service);
          return (
            <li key={service.key} className="min-w-0">
              <button
                type="button"
                onClick={() => onPickService(service)}
                className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-3 text-left transition active:scale-[0.99] hover:bg-white/[0.14]"
              >
                <span className="tile-on-deep h-9 w-9" aria-hidden="true">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{service.name}</span>
                  <span className="text-on-deep-2 block text-xs">{formatDuration(service.durationMinutes)}</span>
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-white/60" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Hero({ settings, onPickService }) {
  const status = useMemo(() => openStatus(settings), [settings]);
  return (
    <section id="inicio" className="px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-12 lg:pb-20 lg:pt-16" aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div className="enter">
          <StatusChip status={status} />
          <p className="eyebrow mt-6 flex items-center gap-2">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            {settings.businessName} · Manicurista
          </p>
          <h1 id="hero-title" className="relative mt-3 text-balance font-display text-[2.35rem] font-semibold leading-[1.05] sm:text-6xl lg:text-[4.1rem]">
            Arte y color <span className="accent-word">en cada detalle.</span>
            <span aria-hidden="true" className="sparkle sparkle-twinkle absolute -top-3 right-[8%] h-6 w-6 text-accent sm:h-8 sm:w-8" />
            <span aria-hidden="true" className="sparkle sparkle-twinkle absolute -bottom-2 right-[30%] h-3.5 w-3.5 text-secondary [animation-delay:-1.4s] sm:h-4 sm:w-4" />
          </h1>
          <p className="mt-5 font-display text-2xl font-semibold italic leading-snug text-primary-ink sm:text-[1.9rem]">
            Tu momento de consentirte comienza aquí.
          </p>
          <p className="mt-2 max-w-xl text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">
            Elige tu servicio, el día y la hora, y en menos de un minuto tendrás tu cita confirmada con tu ticket QR.
          </p>

          <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row">
            <a href="#reservar" className="btn btn-primary btn-lg">
              <CalendarHeart aria-hidden="true" className="h-5 w-5" />
              Agendar mi cita
              <ArrowDown aria-hidden="true" className="h-4 w-4 opacity-80" />
            </a>
            {settings.phone ? (
              <a href={whatsappLink(settings.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-lg">
                <MessageCircle aria-hidden="true" className="h-5 w-5" />
                Escríbenos
                <span className="sr-only"> por WhatsApp (se abre en otra pestaña)</span>
              </a>
            ) : null}
          </div>

          <ul className="mt-7 grid grid-cols-3 gap-2 text-center text-xs font-medium leading-tight text-ink-2 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2.5 sm:text-left sm:text-sm">
            {PERKS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
                <span className="tile h-8 w-8 rounded-lg sm:h-7 sm:w-7" aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <QuickPickStrip services={settings.services || []} onPickService={onPickService} />
        <HeroVisual settings={settings} onPickService={onPickService} />
      </div>
    </section>
  );
}
