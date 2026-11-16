// Ticket PNG drawn on a <canvas> (no html2canvas): colors and fonts are read from the
// live CSS variables, so the image follows the palette set in Configuración.

import { formatDateLong, formatTimeRange } from '@shared/format.js';

const WIDTH = 1080;
const HEIGHT = 1620;
const IMAGE_TIMEOUT_MS = 8000;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

function cssVar(styles, name, fallback) {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

function readTheme() {
  const styles = getComputedStyle(document.documentElement);
  const display = cssVar(styles, '--font-display', '');
  const sans = cssVar(styles, '--font-sans', '');
  return {
    bg: cssVar(styles, '--color-bg', '#F8F2FE'),
    secondary: cssVar(styles, '--color-secondary', '#D3B0F4'),
    primary: cssVar(styles, '--color-primary', '#4B1C71'),
    accent: cssVar(styles, '--color-accent', '#8E3FC7'),
    text: cssVar(styles, '--color-text', '#2A0F40'),
    text2: cssVar(styles, '--color-text-2', '#5B4670'),
    onPrimary: cssVar(styles, '--color-on-primary', '#FFFFFF'),
    onSecondary: cssVar(styles, '--color-on-secondary', cssVar(styles, '--color-text', '#2A0F40')),
    display: display ? `${display}, Georgia, serif` : 'Georgia, serif',
    sans: sans ? `${sans}, system-ui, sans-serif` : 'system-ui, sans-serif',
  };
}

/** '#RRGGBB' | '#RGB' | 'rgb(r g b)' | 'rgb(r, g, b)' -> 'rgba(r, g, b, a)'. */
function withAlpha(color, alpha) {
  const value = String(color).trim();
  let rgb = null;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    const n = parseInt(h, 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const fn = /^rgba?\(([^)]+)\)$/i.exec(value);
    if (fn) rgb = fn[1].split(/[\s,/]+/).slice(0, 3).map(Number);
  }
  if (!rgb || rgb.some((v) => Number.isNaN(v))) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('missing image'));
      return;
    }
    const img = new Image();
    // Remote logos must allow CORS, or the canvas would be tainted (they are skipped instead).
    if (/^https?:\/\//i.test(src)) img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error('image timeout')), IMAGE_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('image failed'));
    };
    img.src = src;
  });
}

async function waitForFonts(theme) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = [`600 64px ${theme.display}`, `400 30px ${theme.sans}`, `600 36px ${theme.sans}`];
  await Promise.allSettled(specs.map((spec) => document.fonts.load(spec)));
  await document.fonts.ready;
}

function setFont(ctx, weight, size, family) {
  ctx.font = `${weight} ${size}px ${family}`;
}

/** Shrinks the font down to `minSize`; past that, ellipsizes. Leaves ctx.font set. */
function fitText(ctx, text, { maxWidth, size, minSize, weight, family }) {
  let current = size;
  setFont(ctx, weight, current, family);
  while (ctx.measureText(text).width > maxWidth && current > minSize) {
    current -= 2;
    setFont(ctx, weight, current, family);
  }
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Text with manual letter spacing (ctx.letterSpacing is not available everywhere). */
function spacedWidth(ctx, text, spacing) {
  const chars = [...text];
  return chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + spacing * Math.max(chars.length - 1, 0);
}

function drawSpacedCentered(ctx, text, centerX, y, spacing) {
  const chars = [...text];
  let x = centerX - spacedWidth(ctx, text, spacing) / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = align;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Rounded card with two semicircular notches cut into the sides at `notchY`. */
function ticketPath(ctx, x, y, w, h, r, notchY, notchR) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, notchY - notchR);
  ctx.arc(x + w, notchY, notchR, -Math.PI / 2, Math.PI / 2, true);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, notchY + notchR);
  ctx.arc(x, notchY, notchR, Math.PI / 2, -Math.PI / 2, true);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawLogo(ctx, img, cx, cy, radius, theme) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(theme.secondary, 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  const scale = Math.max((radius * 2) / img.naturalWidth, (radius * 2) / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.'))), 'image/png');
  });
}

/**
 * Draws the ticket and returns a PNG Blob (1080 × 1620).
 * @param {{ appointment: object, businessName: string, logoUrl?: string, instagramUrl?: string }} p
 */
export async function createTicketBlob({ appointment, businessName, logoUrl, instagramUrl }) {
  const theme = readTheme();
  const [, logo, qr] = await Promise.allSettled([waitForFonts(theme), loadImage(logoUrl || '/logo.png'), loadImage(appointment.qrDataUrl)]);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible.');
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  const cx = WIDTH / 2;

  // Background: soft vertical gradient.
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, theme.bg);
  bg.addColorStop(1, theme.secondary);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Card with notches and a soft shadow.
  const card = { x: 80, y: 70, w: 920, h: 1480, r: 56 };
  const notchY = 1090;
  ctx.save();
  ctx.shadowColor = withAlpha(theme.primary, 0.2);
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ticketPath(ctx, card.x, card.y, card.w, card.h, card.r, notchY, 34);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  const inner = card.w - 160;

  // Logo.
  if (logo.status === 'fulfilled') drawLogo(ctx, logo.value, cx, 190, 80, theme);

  // Business name and subtitle.
  ctx.fillStyle = theme.text;
  const name = fitText(ctx, businessName || 'Nails Art', { maxWidth: inner, size: 64, minSize: 40, weight: 600, family: theme.display });
  ctx.fillText(name, cx, 352);

  ctx.fillStyle = theme.accent;
  setFont(ctx, 600, 26, theme.sans);
  drawSpacedCentered(ctx, 'COMPROBANTE DE CITA', cx, 400, 6);

  // QR code on a soft frame.
  const qrSize = 400;
  const qrX = cx - qrSize / 2;
  const qrY = 440;
  roundedRect(ctx, qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 32);
  ctx.fillStyle = withAlpha(theme.secondary, 0.22);
  ctx.fill();
  if (qr.status === 'fulfilled') {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    roundedRect(ctx, qrX, qrY, qrSize, qrSize, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.drawImage(qr.value, qrX, qrY, qrSize, qrSize);
    ctx.restore();
  }

  // Booking code on a secondary block.
  const codeBox = { x: 180, y: 892, w: 720, h: 156 };
  roundedRect(ctx, codeBox.x, codeBox.y, codeBox.w, codeBox.h, 32);
  ctx.fillStyle = theme.secondary;
  ctx.fill();
  const code = String(appointment.bookingCode || '').toUpperCase();
  let codeSize = 104;
  setFont(ctx, 700, codeSize, MONO);
  while (spacedWidth(ctx, code, codeSize * 0.28) > codeBox.w - 80 && codeSize > 56) {
    codeSize -= 4;
    setFont(ctx, 700, codeSize, MONO);
  }
  ctx.fillStyle = theme.onSecondary;
  drawSpacedCentered(ctx, code, cx, codeBox.y + codeBox.h / 2 + codeSize * 0.36, codeSize * 0.28);

  // Perforation between the notches.
  ctx.save();
  ctx.strokeStyle = withAlpha(theme.secondary, 0.9);
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(card.x + 56, notchY);
  ctx.lineTo(card.x + card.w - 56, notchY);
  ctx.stroke();
  ctx.restore();

  // Detail rows.
  const rows = [
    ['Nombre', appointment.clientName],
    ['Servicio', appointment.serviceName],
    ['Fecha', formatDateLong(appointment.date, { withYear: true })],
    ['Hora', formatTimeRange(appointment.timeSlot, appointment.endTime)],
  ];
  const left = card.x + 80;
  const right = card.x + card.w - 80;
  let rowY = 1166;
  rows.forEach(([label, value], index) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.text2;
    setFont(ctx, 400, 30, theme.sans);
    ctx.fillText(label, left, rowY);
    const labelWidth = ctx.measureText(label).width;

    ctx.textAlign = 'right';
    ctx.fillStyle = theme.text;
    const fitted = fitText(ctx, String(value || ''), { maxWidth: right - left - labelWidth - 40, size: 36, minSize: 26, weight: 600, family: theme.sans });
    ctx.fillText(fitted, right, rowY);

    if (index < rows.length - 1) {
      ctx.fillStyle = withAlpha(theme.secondary, 0.45);
      ctx.fillRect(left, rowY + 26, right - left, 2);
    }
    rowY += 74;
  });

  // Footer.
  ctx.textAlign = 'center';
  ctx.fillStyle = theme.text2;
  const note = fitText(ctx, 'Muestra este código al llegar', { maxWidth: inner, size: 32, minSize: 24, weight: 500, family: theme.sans });
  ctx.fillText(note, cx, 1462);

  const match = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(String(instagramUrl || ''));
  if (match) {
    ctx.fillStyle = theme.primary;
    const handle = fitText(ctx, `@${match[1]}`, { maxWidth: inner, size: 30, minSize: 22, weight: 600, family: theme.sans });
    ctx.fillText(handle, cx, 1508);
  }

  return canvasToBlob(canvas);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers start the download asynchronously: revoke a bit later.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Touch devices get the share sheet ("Guardar imagen" → Fotos); desktops download. */
function prefersShareSheet() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * Saves the ticket image. Call it straight from the click handler (iOS needs the user gesture).
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function saveTicketImage(blob, code) {
  const fileName = `nails-art-cita-${String(code || 'ticket').toUpperCase()}.png`;
  let file = null;
  try {
    file = new File([blob], fileName, { type: 'image/png' });
  } catch {
    file = null;
  }

  if (file && prefersShareSheet() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Mi cita' });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      // Share refused (e.g. lost user activation): fall back to a plain download.
    }
  }

  downloadBlob(blob, fileName);
  return 'downloaded';
}
