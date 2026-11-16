// DEMO DATA — DELETES every appointment and client in the target database, then creates
// fictitious ones (names and phones are invented). Never run it against real data.
//   ALLOW_DEMO_SEED=true npm run seed:demo
// Refuses to run unless ALLOW_DEMO_SEED is exactly "true" and NODE_ENV is not "production".
// Stop `npm run dev` first when using the local in-memory database (.data/), or both
// processes will fight over the same files.

import { APPOINTMENT_STATUS } from '../shared/constants.js';
import { candidateStarts, getDayConfig, ticksFor } from '../shared/schedule.js';
import { addDays, toTime } from '../shared/time.js';
import { generateBookingCode } from '../server/lib/booking-code.js';
import { connectDB, disconnectDB } from '../server/lib/db.js';
import { generateQrDataUrl, verificationUrl } from '../server/lib/qr.js';
import { Appointment, Client } from '../server/models/index.js';
import { businessNow, getSettingsDoc } from '../server/services/settings.service.js';

const FAKE_CLIENTS = [
  ['Valentina Rojas', '584141110001'],
  ['Camila Duarte', '584241110002'],
  ['Daniela Contreras', '584121110003'],
  ['Andrea Molina', '584161110004'],
  ['Gabriela Pernía', '584261110005'],
  ['Mariana Chacón', '584141110006'],
  ['Sofía Ramírez', '584241110007'],
  ['Isabella Guerrero', '584121110008'],
];

if (process.env.ALLOW_DEMO_SEED !== 'true' || process.env.NODE_ENV === 'production') {
  console.error('Bloqueado: este script BORRA citas y clientas. Ejecuta con ALLOW_DEMO_SEED=true y solo en una base de prueba.');
  process.exit(1);
}

try {
  await connectDB();
  const settings = await getSettingsDoc();
  const now = businessNow(settings);
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  await Appointment.deleteMany({});
  await Client.deleteMany({});

  let created = 0;
  let clientIndex = 0;
  for (let offset = -6; offset <= 10; offset += 1) {
    const date = addDays(now.date, offset);
    const day = getDayConfig(settings.workingHours, date);
    const services = settings.services.filter((s) => s.isActive);
    if (!day?.isOpen || services.length === 0) continue;

    const taken = new Set();
    const perDay = offset % 3 === 0 ? 4 : 2;
    for (let n = 0; n < perDay; n += 1) {
      const service = services[(offset + n + services.length * 10) % services.length];
      const start = candidateStarts(day, service.durationMinutes).find(
        (s) => ticksFor(s, service.durationMinutes).every((t) => !taken.has(t)) && (offset > 0 || s < now.minutes),
      );
      if (start === undefined) continue;
      const ticks = ticksFor(start, service.durationMinutes);
      ticks.forEach((t) => taken.add(t));

      const [name, phone] = FAKE_CLIENTS[clientIndex % FAKE_CLIENTS.length];
      clientIndex += 1;
      const past = offset < 0 || (offset === 0 && start < now.minutes);
      const status = past ? (n % 4 === 3 ? APPOINTMENT_STATUS.CANCELLED : APPOINTMENT_STATUS.COMPLETED) : APPOINTMENT_STATUS.CONFIRMED;
      const bookingCode = generateBookingCode();

      await Appointment.create({
        clientName: name,
        clientPhone: phone,
        serviceKey: service.key,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        date,
        timeSlot: toTime(start),
        endTime: toTime(start + service.durationMinutes),
        occupiedTicks: ticks,
        holdsSlot: status !== APPOINTMENT_STATUS.CANCELLED,
        bookingCode,
        qrDataUrl: await generateQrDataUrl(verificationUrl(baseUrl, bookingCode)),
        status,
        completedAt: status === APPOINTMENT_STATUS.COMPLETED ? new Date() : undefined,
        cancelledAt: status === APPOINTMENT_STATUS.CANCELLED ? new Date() : undefined,
        cancelledBy: status === APPOINTMENT_STATUS.CANCELLED ? 'client' : undefined,
      });

      await Client.findOneAndUpdate(
        { phone },
        {
          $set: { name },
          $inc: { totalAppointments: 1, completedAppointments: status === APPOINTMENT_STATUS.COMPLETED ? 1 : 0 },
          $max: { lastAppointmentDate: date, ...(status === APPOINTMENT_STATUS.COMPLETED ? { lastVisitDate: date } : {}) },
        },
        { upsert: true, setDefaultsOnInsert: false },
      );
      created += 1;
    }
  }
  console.info(`Listo: ${created} citas de demostración (ficticias) para ${Math.min(clientIndex, FAKE_CLIENTS.length)} clientas.`);
} catch (error) {
  console.error('Falló la siembra de demostración:', error);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
