// Prefilled WhatsApp links (wa.me). Sending is always manual.

import { formatDateLong, formatTime } from './format.js';

export function whatsappLink(phoneDigits, text = '') {
  const phone = String(phoneDigits || '').replace(/\D/g, '');
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${phone}${query}`;
}

/** Message the client sends to the salon after booking. */
export function bookingConfirmationText({ businessName, clientName, serviceName, date, time, code }) {
  return [
    `¡Hola ${businessName}! Acabo de agendar mi cita.`,
    `👤 Nombre: ${clientName}`,
    `💅 Servicio: ${serviceName}`,
    `📅 Fecha: ${formatDateLong(date)}`,
    `⏰ Hora: ${formatTime(time)}`,
    `🔑 Código: ${code}`,
  ].join('\n');
}

/** Message the salon sends to a client from the admin panel. */
export function clientContactText({ businessName, clientName, serviceName, date, time }) {
  const firstName = String(clientName || '').trim().split(/\s+/)[0] || '';
  return `Hola ${firstName}, te escribimos de ${businessName} sobre tu cita de ${serviceName} del ${formatDateLong(date).toLowerCase()} a las ${formatTime(time).replace(/\.$/, '')}.`;
}
