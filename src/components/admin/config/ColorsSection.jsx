'use client';

import { Palette, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { DEFAULT_THEME } from '@shared/constants.js';
import { buildThemeTokens, isHex, paletteReport } from '@shared/color.js';
import { Badge } from '@/components/ui/Badge';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { ConfigCard } from './ConfigCard';
import { DEFAULT_LOGO, THEME_FIELDS, sameTheme } from './configModel';

const ratioFormat = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Typed hex -> '#RRGGBB' style text (the leading # is optional while typing). */
function cleanHexInput(raw) {
  const value = raw.trim().toUpperCase().replace(/[^#0-9A-F]/g, '');
  if (!value) return '';
  return `#${value.replace(/#/g, '')}`.slice(0, 7);
}

function ColorControl({ label, hint, value, fallback, error, onChange }) {
  const swatch = (isHex(value) ? value : fallback).toLowerCase();
  return (
    <Field label={label} hint={hint} error={error}>
      {(p) => (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={swatch}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            aria-label={`Elegir color ${label.toLowerCase()}`}
            className="h-12 w-14 shrink-0 cursor-pointer rounded-xl border border-line bg-surface p-1 [&::-moz-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0"
          />
          <Input
            {...p}
            value={value}
            onChange={(event) => onChange(cleanHexInput(event.target.value))}
            maxLength={7}
            spellCheck={false}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="#4B1C71"
            className="font-mono uppercase tabular-nums"
          />
        </div>
      )}
    </Field>
  );
}

function ThemePreview({ colors, logoUrl, businessName }) {
  const tokens = useMemo(() => buildThemeTokens(colors), [colors]);
  return (
    <div
      role="img"
      aria-label="Vista previa de la página de reservas con los colores elegidos"
      style={tokens}
      className="overflow-hidden rounded-2xl border border-line bg-bg text-ink shadow-glass"
    >
      <div className="bg-[radial-gradient(circle_at_top_right,rgb(var(--color-secondary-rgb)/0.55),transparent_60%)]">
        <div className="flex items-center gap-3 border-b border-line bg-surface/80 px-4 py-3">
          <BrandLogo src={logoUrl || DEFAULT_LOGO} name={businessName || 'Nails Art'} size={36} />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold leading-tight text-ink">{businessName || 'Nails Art'}</p>
            <p className="text-xs text-ink-3">Reserva tu cita</p>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <p className="eyebrow">Paso 1 de 4</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink">Elige tu servicio</p>
            <p className="mt-1 text-sm text-ink-2">Manicura · 1 h. Te esperamos con todo listo.</p>
            <p className="mt-0.5 text-xs text-ink-3">Texto secundario para avisos y detalles.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="btn btn-primary btn-sm pointer-events-none">Reservar cita</span>
            <span className="chip bg-secondary-soft text-primary-ink">Confirmada</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary-soft p-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Tu código</p>
              <p className="text-sm text-ink-2">Muéstralo al llegar</p>
            </div>
            <span className="rounded-xl bg-secondary px-3 py-1.5 font-mono text-base font-bold tracking-[0.2em] text-secondary-on">NA84K2</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContrastReport({ colors }) {
  const report = useMemo(() => paletteReport(colors), [colors]);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">Contraste</p>
      <ul className="space-y-2">
        {report.map((pair) => (
          <li key={pair.label} className="flex items-center gap-3 rounded-xl bg-surface/70 px-3 py-2">
            <span
              aria-hidden="true"
              className="grid h-9 w-11 shrink-0 place-items-center rounded-lg text-sm font-bold ring-1 ring-line"
              style={{ backgroundColor: pair.bg, color: pair.fg }}
            >
              Aa
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-ink">{pair.label}</span>
            <span className="font-mono text-sm tabular-nums text-ink-2">{ratioFormat.format(pair.ratio)}:1</span>
            <Badge tone={pair.passes ? 'success' : 'danger'}>{pair.passes ? 'AA' : 'Bajo'}</Badge>
          </li>
        ))}
      </ul>
      <p className="field-hint">El texto siempre se ajusta para ser legible, pero procura que todo marque AA.</p>
    </div>
  );
}

export function ColorsSection({ colors, previewColors, logoUrl, businessName, errors, onChange, delay, className = '' }) {
  const isDefault = sameTheme(colors, DEFAULT_THEME);
  const setColor = (key, value) => onChange((current) => ({ ...current, [key]: value }));

  return (
    <ConfigCard
      id="colores"
      icon={Palette}
      title="Colores de la marca"
      description="Se aplican a la página de reservas, al ticket y a este panel."
      delay={delay}
      className={className}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            {THEME_FIELDS.map((field) => (
              <ColorControl
                key={field.key}
                label={field.label}
                hint={field.hint}
                value={colors[field.key]}
                fallback={previewColors[field.key]}
                error={errors[`themeColors.${field.key}`]}
                onChange={(value) => setColor(field.key, value)}
              />
            ))}
          </div>
          <Button variant="secondary" icon={RotateCcw} className="mt-5 w-full sm:w-auto" disabled={isDefault} onClick={() => onChange({ ...DEFAULT_THEME })}>
            Restaurar colores del logo
          </Button>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Vista previa</p>
            <ThemePreview colors={previewColors} logoUrl={logoUrl} businessName={businessName} />
          </div>
          <ContrastReport colors={previewColors} />
        </div>
      </div>
    </ConfigCard>
  );
}
