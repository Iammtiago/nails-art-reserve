import { Client } from '../models/index.js';

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Creates or refreshes the client record when a booking is made. */
export async function recordBooking({ phone, name, date }) {
  await Client.findOneAndUpdate(
    { phone },
    {
      $set: { name },
      $inc: { totalAppointments: 1 },
      $max: { lastAppointmentDate: date },
      $setOnInsert: { completedAppointments: 0, lastVisitDate: '' },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: false },
  );
}

/** Counts a visit when an appointment is marked as attended. */
export async function recordVisit({ phone, name, date }) {
  await Client.findOneAndUpdate(
    { phone },
    {
      $inc: { completedAppointments: 1 },
      $max: { lastVisitDate: date, lastAppointmentDate: date },
      $setOnInsert: { name, totalAppointments: 1 },
    },
    { upsert: true, setDefaultsOnInsert: false },
  );
}

export function serializeClient(c) {
  return {
    id: String(c._id),
    name: c.name,
    phone: c.phone,
    totalAppointments: c.totalAppointments,
    completedAppointments: c.completedAppointments,
    lastAppointmentDate: c.lastAppointmentDate,
    lastVisitDate: c.lastVisitDate,
    createdAt: c.createdAt,
  };
}

export async function listClients({ q, page, limit }) {
  const filter = {};
  const query = (q || '').trim();
  if (query) {
    const digits = query.replace(/\D/g, '');
    const or = [{ name: { $regex: escapeRegex(query), $options: 'i' } }];
    if (digits.length >= 3) or.push({ phone: { $regex: escapeRegex(digits.replace(/^0+/, '')) } });
    filter.$or = or;
  }
  const [items, total, all, recurring] = await Promise.all([
    Client.find(filter)
      .sort({ lastAppointmentDate: -1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Client.countDocuments(filter),
    Client.estimatedDocumentCount(),
    Client.countDocuments({ completedAppointments: { $gte: 2 } }),
  ]);
  return {
    items: items.map(serializeClient),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary: { total: all, recurring },
  };
}
