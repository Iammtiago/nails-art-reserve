// Color math for the editable brand palette: WCAG contrast and the derived CSS tokens.

import { DEFAULT_THEME } from './constants.js';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHex(value) {
  return typeof value === 'string' && HEX_RE.test(value);
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Linear mix in sRGB: weight 1 -> a, weight 0 -> b. */
export function mix(a, b, weight) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v * weight + cb[i] * (1 - weight)));
}

/** Best readable foreground for a fill: white or the brand text color. */
export function readableOn(fill, dark = DEFAULT_THEME.text) {
  return contrastRatio('#FFFFFF', fill) >= contrastRatio(dark, fill) ? '#FFFFFF' : dark;
}

/** Darkens/lightens `color` towards `target` until it reaches `ratio` against `bg`. */
export function ensureContrast(color, bg, ratio = 4.5) {
  if (contrastRatio(color, bg) >= ratio) return color;
  const target = luminance(bg) > 0.4 ? '#000000' : '#FFFFFF';
  for (let w = 0.95; w >= 0; w -= 0.05) {
    const candidate = mix(color, target, w);
    if (contrastRatio(candidate, bg) >= ratio) return candidate;
  }
  return target;
}

function rgbVar(hex) {
  return hexToRgb(hex).join(' ');
}

/**
 * Full token set derived from the five editable colors. Every text token is forced to
 * AA (4.5:1) against the background, so a bad pick in the admin cannot make text unreadable.
 */
export function buildThemeTokens(colors = DEFAULT_THEME) {
  const c = { ...DEFAULT_THEME, ...colors };
  const bg = c.background;
  const text = ensureContrast(c.text, bg);
  const text2 = ensureContrast(mix(text, bg, 0.78), bg);
  const text3 = ensureContrast(mix(text, bg, 0.64), bg);
  const primaryText = ensureContrast(c.primary, bg);
  const accentText = ensureContrast(c.accent, bg);
  const surface = mix('#FFFFFF', bg, 0.72);

  const tokens = {
    '--color-primary': c.primary,
    '--color-secondary': c.secondary,
    '--color-accent': c.accent,
    '--color-bg': bg,
    '--color-text': text,
    '--color-primary-rgb': rgbVar(c.primary),
    '--color-secondary-rgb': rgbVar(c.secondary),
    '--color-accent-rgb': rgbVar(c.accent),
    '--color-bg-rgb': rgbVar(bg),
    '--color-text-rgb': rgbVar(text),
    '--color-text-2': text2,
    '--color-text-3': text3,
    '--color-primary-ink': primaryText,
    '--color-accent-ink': accentText,
    '--color-on-primary': readableOn(c.primary, text),
    '--color-on-secondary': readableOn(c.secondary, text),
    '--color-on-accent': readableOn(c.accent, text),
    '--color-surface': surface,
    '--color-surface-rgb': rgbVar(surface),
    '--color-line': mix(c.secondary, bg, 0.45),
    '--color-primary-soft': mix(c.primary, bg, 0.1),
    '--color-secondary-soft': mix(c.secondary, bg, 0.4),
    '--color-accent-soft': mix(c.accent, bg, 0.12),
  };
  return tokens;
}

export function themeTokensToCss(tokens, selector = ':root') {
  const body = Object.entries(tokens)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  return `${selector}{${body}}`;
}

/** Pairs checked in the admin palette editor. */
export function paletteReport(colors) {
  const c = { ...DEFAULT_THEME, ...colors };
  const pairs = [
    { label: 'Texto sobre fondo', fg: c.text, bg: c.background },
    { label: 'Botón principal', fg: readableOn(c.primary, c.text), bg: c.primary },
    { label: 'Código del ticket', fg: readableOn(c.secondary, c.text), bg: c.secondary },
    { label: 'Acento sobre fondo', fg: c.accent, bg: c.background },
  ];
  return pairs.map((p) => {
    const ratio = contrastRatio(p.fg, p.bg);
    return { ...p, ratio: Math.round(ratio * 100) / 100, passes: ratio >= 4.5 };
  });
}
