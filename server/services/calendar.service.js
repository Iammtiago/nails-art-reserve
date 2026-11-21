import { APPOINTMENT_STATUS } from '../../shared/constants.js';
import { dayCapacityMinutes, daySegments, getDayConfig } from '../../shared/schedule.js';
import { addDays, dayOfWeek } from '../../shared/time.js';
import { unprocessable } from '../lib/errors.js';
import { Appointment } from '../models/index.js';
import { blockDate, businessNow, getSettingsDoc, unblockDate } from './settings.service.js';

/** Occupancy per day plus the appointments of the range, for the admin calendar. */
export async function getCalendar({ from, to }) {
  const settings = await getSettingsDoc();
  const now = businessNow(settings);
  const appointments = await Appointment.find(
    { date: { $gte: from, $lte: to }, status: { $ne: APPOINTMENT_STATUS.CANCELLED } },
    { kind: 1, source: 1, clientName: 1, clientPhone: 1, serviceName: 1, durationMinutes: 1, date: 1, timeSlot: 1, endTime: 1, status: 1, bookingCode: 1, rescheduledAt: 1, rescheduledBy: 1, previousDate: 1, previousTimeSlot: 1 },
  )
    .sort({ date: 1, timeSlot: 1 })
    .lean();

  const byDate = new Map();
  for (const a of appointments) {
    if (!byDate.has(a.date)) byDate.set(a.date, []);
    byDate.get(a.date).push(a);
  }
  const blocked = new Map((settings.blockedDates || []).map((b) => [b.date, b.reason]));

  const days = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const day = getDayConfig(settings.workingHours, date);
    const list = byDate.get(date) || [];
    const capacityMinutes = dayCapacityMinutes(day);
    const bookedMinutes = list.reduce((sum, a) => sum + a.durationMinutes, 0);
    const bookings = list.filter((a) => a.kind !== 'block');
    days.push({
      date,
      dayOfWeek: dayOfWeek(date),
      isOpen: daySegments(day).length > 0,
      blocked: blocked.has(date),
      blockReason: blocked.get(date) || '',
      isPast: date < now.date,
      isToday: date === now.date,
      capacityMinutes,
      bookedMinutes,
      // Time blocks count as occupied minutes, not as appointments.
      appointmentsCount: bookings.length,
      pendingCount: bookings.filter((a) => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      blockedMinutes: list.filter((a) => a.kind === 'block').reduce((sum, a) => sum + a.durationMinutes, 0),
      occupancy: capacityMinutes ? Math.min(1, Math.round((bookedMinutes / capacityMinutes) * 100) / 100) : 0,
    });
  }

  return {
    from,
    to,
    now,
    workingHours: settings.workingHours,
    days,
    appointments: appointments.map((a) => ({
      id: String(a._id),
      kind: a.kind || 'booking',
      source: a.source || 'online',
      clientName: a.clientName,
      clientPhone: a.clientPhone,
      serviceName: a.serviceName,
      durationMinutes: a.durationMinutes,
      date: a.date,
      timeSlot: a.timeSlot,
      endTime: a.endTime,
      status: a.status,
      bookingCode: a.bookingCode,
      rescheduledAt: a.rescheduledAt || null,
      rescheduledBy: a.rescheduledBy || null,
      previousDate: a.previousDate || null,
      previousTimeSlot: a.previousTimeSlot || null,
    })),
  };
}

export async function addBlockedDate({ date, reason }) {
  const settings = await getSettingsDoc();
  const now = businessNow(settings);
  if (date < now.date) throw unprocessable('No se puede bloquear un día que ya pasó.', 'PAST_DATE');
  const updated = await blockDate({ date, reason });
  const affected = await Appointment.countDocuments({ date, status: APPOINTMENT_STATUS.CONFIRMED, kind: { $ne: 'block' } });
  return { blockedDates: updated.blockedDates, affectedAppointments: affected };
}

export async function removeBlockedDate(date) {
  const updated = await unblockDate(date);
  return { blockedDates: updated.blockedDates };
}
