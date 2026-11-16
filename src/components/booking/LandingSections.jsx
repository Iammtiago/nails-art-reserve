'use client';

// Sections under the booking wizard. Every rule and number shown here comes from the
// salon settings (editable in /admin/configuracion); nothing about the business is hard-coded.

import {
  CalendarCheck2,
  CalendarHeart,
  CalendarRange,
  CalendarX2,
  ChevronDown,
  Clock,
  Hand,
  MessageCircle,
  Phone,
  QrCode,
  Quote,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useMemo } from 'react';
import { formatDuration } from '@shared/format.js';
import { formatPhone } from '@shared/phone.js';
import { whatsappLink } from '@shared/whatsapp.js';
import { InstagramGlyph } from './InstagramGlyph';
import { instagramHandle, summarizeWorkingHours } from './booking-utils';
import { openStatus, telLink, todayDow } from './landing-utils';

function SectionHeading({ eyebrow, title, description, id, center = false }) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-balance font-display text-3xl font-semibold leading-tight sm:text-4xl">
        {title}
      </h2>
      {description ? <p className="mt-3 text-pretty text-base text-ink-2">{description}</p> : null}
    </div>
  );
}

// ---------- Así de fácil ----------

const STEPS = [
  { icon: Hand, title: 'Elige tu servicio', text: 'Manicura, pedicura o las dos. Verás solo los días y horas que de verdad están libres.' },
  { icon: UserRound, title: 'Deja tu nombre y teléfono', text: 'Sin cuentas ni contraseñas. Tu teléfono es tu llave para ver o cancelar tu cita.' },
  { icon: QrCode, title: 'Muestra tu ticket al llegar', text: 'Guárdalo en tu galería. En el salón escanean tu código QR o tu clave de 6 caracteres.' },
];

export function HowItWorks() {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="como-funciona">
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="como-funciona" eyebrow="Así de fácil" title="Tu cita en tres toques" center />
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="glass relative flex items-start gap-4 overflow-hidden p-5 md:block md:p-6">
              <span aria-hidden="true" className="absolute -right-2 -top-6 font-display text-[6rem] font-semibold leading-none text-secondary/40 md:text-[7rem]">
                {index + 1}
              </span>
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-on shadow-lift md:h-12 md:w-12" aria-hidden="true">
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <div className="relative min-w-0">
                <h3 className="font-display text-lg font-semibold md:mt-5 md:text-xl">
                  <span className="sr-only">Paso {index + 1}: </span>
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2 md:mt-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------- Lo que debes saber ----------

export function GoodToKnow({ settings, onCancelClick }) {
  const booking = settings.booking || {};
  const items = [
    booking.windowDays
      ? { icon: CalendarRange, title: `Reserva hasta ${booking.windowDays} días antes`, text: 'Planea tu cita con calma: la agenda se abre día a día.' }
      : null,
    booking.minLeadMinutes
      ? {
          icon: Clock,
          title: '¿Para hoy? También se puede',
          text: `Siempre que falten al menos ${formatDuration(booking.minLeadMinutes)} para la hora que elijas.`,
        }
      : null,
    booking.maxActivePerPhone
      ? {
          icon: CalendarCheck2,
          title: `Hasta ${booking.maxActivePerPhone} citas a la vez`,
          text: 'Por cada número de teléfono, para que la agenda alcance para todas.',
        }
      : null,
    { icon: CalendarX2, title: '¿No puedes venir? Avísanos', text: 'Cancela con tu teléfono hasta la hora de tu cita y el espacio queda libre para otra clienta.', action: true },
  ].filter(Boolean);

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="debes-saber">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div>
          <SectionHeading
            id="debes-saber"
            eyebrow="Antes de tu cita"
            title="Lo que debes saber"
            description="Reglas claras para que tu tiempo, y el de las demás, valga oro."
          />
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-primary-soft/70 p-4 text-sm text-ink-2">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-ink" />
            <p>
              <span className="font-semibold text-ink">Nunca dos citas a la misma hora.</span> Cuando reservas, ese horario es solo tuyo.
            </p>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, text, action }) => (
            <li key={title} className="glass flex items-start gap-4 p-4 sm:flex-col sm:gap-0 sm:p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-soft text-primary-ink" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col sm:mt-4">
                <h3 className="font-sans text-base font-semibold tracking-normal">{title}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-2">{text}</p>
                {action ? (
                  <button type="button" onClick={onCancelClick} className="btn btn-soft btn-sm mt-3 w-fit sm:mt-4">
                    <CalendarX2 aria-hidden="true" className="h-4 w-4" />
                    Cancelar una cita
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- Frase ----------

export function QuoteBand() {
  return (
    <section className="px-4 py-6 sm:px-6" aria-label="Frase del salón">
      <figure className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-accent px-6 py-12 text-center text-primary-on shadow-lift sm:px-12 sm:py-16">
        <div aria-hidden="true" className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-secondary/25 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-accent/50 blur-3xl" />
        <Quote aria-hidden="true" className="relative mx-auto h-9 w-9 text-secondary" />
        <blockquote className="relative mx-auto mt-4 max-w-3xl text-balance font-display text-[1.85rem] font-semibold italic leading-tight text-white sm:text-5xl">
          Tus manos hablan por ti antes que tú. Haz que digan algo bonito.
        </blockquote>
        <figcaption className="relative mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-white">Consiéntete, te lo mereces</figcaption>
      </figure>
    </section>
  );
}

// ---------- Horario y contacto ----------

function ContactLink({ href, external = false, icon: Icon, title, detail, tone = 'neutral' }) {
  const whatsapp = tone === 'whatsapp';
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`group flex min-h-[60px] items-center gap-3.5 rounded-2xl px-4 py-2.5 transition ${
        whatsapp ? 'bg-[#1A7F4B] text-white shadow-lift hover:brightness-110' : 'border border-line bg-surface/80 text-ink hover:border-secondary hover:bg-surface'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${whatsapp ? 'bg-white/15' : 'bg-secondary-soft text-primary-ink'}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{title}</span>
        <span className={`block truncate text-sm ${whatsapp ? 'text-white' : 'text-ink-2'}`}>{detail}</span>
      </span>
      {external ? <span className="sr-only"> (se abre en otra pestaña)</span> : null}
    </a>
  );
}

export function VisitInfo({ settings }) {
  const hours = useMemo(() => summarizeWorkingHours(settings.workingHours), [settings.workingHours]);
  const status = useMemo(() => openStatus(settings), [settings]);
  const dow = todayDow(settings);
  const handle = instagramHandle(settings.instagramUrl);
  const tel = telLink(settings.phone);

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="horario">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="glass p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeading id="horario" eyebrow="Horario" title="Cuándo atendemos" />
            {status ? (
              <span className={`chip mt-1 ${status.open ? 'bg-success-soft text-success' : 'bg-primary-soft text-ink-2'}`}>
                <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                {status.open ? 'Abierto ahora' : 'Cerrado ahora'}
              </span>
            ) : null}
          </div>
          <dl className="mt-6 divide-y divide-line/80">
            {hours.map((row) => {
              const isToday = dow !== null && row.key.split('-').map(Number).includes(dow);
              return (
                <div key={row.key} className={`flex items-start justify-between gap-4 py-3 ${isToday ? 'font-semibold' : ''}`}>
                  <dt className="flex shrink-0 items-center gap-2 text-ink">
                    {row.days}
                    {isToday ? <span className="chip bg-secondary-soft py-0.5 text-[0.7rem] text-primary-ink">Hoy</span> : null}
                  </dt>
                  <dd className="text-right text-sm text-ink-2">
                    {row.closed ? (
                      <span className="text-ink-3">Cerrado</span>
                    ) : (
                      row.ranges.map((range, index) => (
                        <span key={range} className="block whitespace-nowrap sm:inline">
                          {index > 0 ? <span className="hidden sm:inline"> · </span> : null}
                          {range}
                        </span>
                      ))
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="glass flex flex-col p-6 sm:p-8">
          <SectionHeading eyebrow="Contacto" title="¿Dudas? Escríbenos" description="Escríbenos por WhatsApp o llámanos en horario de atención." />
          <div className="mt-6 grid gap-3">
            {settings.phone ? (
              <ContactLink href={whatsappLink(settings.phone)} external icon={MessageCircle} title="Escribir por WhatsApp" detail={formatPhone(settings.phone)} tone="whatsapp" />
            ) : null}
            {tel ? <ContactLink href={tel} icon={Phone} title="Llamar al salón" detail={formatPhone(settings.phone)} /> : null}
            {handle ? <ContactLink href={settings.instagramUrl} external icon={InstagramGlyph} title="Mira nuestros diseños" detail={`${handle} en Instagram`} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Preguntas frecuentes ----------

export function Faq({ settings }) {
  const windowDays = settings.booking?.windowDays;
  const questions = [
    { q: '¿Tengo que crear una cuenta?', a: 'No. Solo tu nombre y tu número de teléfono. Con ese mismo número puedes ver y cancelar tus citas.' },
    { q: '¿Cómo cancelo mi cita?', a: 'Toca «Cancelar» arriba, escribe tu teléfono y elige la cita. Puedes hacerlo hasta la hora de inicio; el horario queda libre al instante.' },
    { q: '¿Qué hago con el ticket?', a: 'Guárdalo en tu galería con el botón del ticket y muéstralo al llegar. Si no lo tienes a mano, basta con tu clave de 6 caracteres.' },
    { q: '¿Puedo reservar para otra persona?', a: 'Sí: escribe su nombre y su teléfono, así el ticket y la cancelación quedan a su nombre.' },
    windowDays ? { q: '¿Con cuánta anticipación puedo reservar?', a: `Hasta ${windowDays} días antes. Si no ves tu día, es porque ese día no atendemos o ya no quedan horarios.` } : null,
  ].filter(Boolean);

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="preguntas">
      <div className="mx-auto max-w-3xl">
        <SectionHeading id="preguntas" eyebrow="Preguntas frecuentes" title="Todo claro antes de venir" center />
        <div className="mt-8 space-y-3">
          {questions.map(({ q, a }) => (
            <details key={q} className="glass group p-0 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 rounded-[inherit] px-5 py-3 font-semibold text-ink">
                {q}
                <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-3 transition group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Llamado final ----------

export function FinalCta({ settings }) {
  const tel = telLink(settings.phone);
  return (
    <section className="px-4 pb-6 pt-8 sm:px-6" aria-labelledby="cta-final">
      <div className="glass glass-strong relative mx-auto max-w-6xl overflow-hidden px-6 py-12 text-center sm:px-12 sm:py-16">
        <div aria-hidden="true" className="absolute inset-x-0 -top-24 mx-auto h-48 w-2/3 rounded-full bg-secondary/60 blur-3xl" />
        <Sparkles aria-hidden="true" className="relative mx-auto h-8 w-8 text-accent-ink" />
        <h2 id="cta-final" className="relative mt-3 text-balance font-display text-3xl font-semibold sm:text-5xl">
          ¿Lista para consentirte?
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-ink-2 sm:text-lg">Tu próxima cita está a un minuto. Elige tu hora antes de que alguien más la tome.</p>
        <div className="relative mt-7 flex flex-col justify-center gap-3 min-[420px]:flex-row">
          <a href="#reservar" className="btn btn-primary btn-lg">
            <CalendarHeart aria-hidden="true" className="h-5 w-5" />
            Agendar mi cita
          </a>
          {tel ? (
            <a href={tel} className="btn btn-secondary btn-lg">
              <Phone aria-hidden="true" className="h-5 w-5" />
              Llamar
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
