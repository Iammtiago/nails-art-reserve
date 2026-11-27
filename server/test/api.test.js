import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';

import { BOOKING_CODE_REGEX } from '../../shared/constants.js';
import { CSRF, NOW_ISO, SATURDAY, TODAY, booking, resetData, startTestApp, stopTestApp } from './helpers.js';

let app;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await stopTestApp();
});

const book = (body) => request(app).post('/api/appointments').set(CSRF).send(body);

// Saturday 2026-11-21 at noon in America/Caracas: SATURDAY appointments are «today» or past.
const SATURDAY_NOON_ISO = '2026-11-21T16:00:00.000Z';

/** Runs fn with the server clock pinned at iso, then puts it back on the tests' Monday. */
async function atInstant(iso, fn) {
  const { setFixedInstant } = await import('../lib/clock.js');
  setFixedInstant(iso);
  try {
    return await fn();
  } finally {
    setFixedInstant(NOW_ISO);
  }
}

async function loginAgent() {
  const agent = request.agent(app);
  const { AdminUser } = await import('../models/index.js');
  if (!(await AdminUser.exists({ username: 'tiago' }))) {
    const { hashPassword } = await import('../lib/password.js');
    await AdminUser.create({ username: 'tiago', passwordHash: await hashPassword('una-clave-muy-larga'), role: 'superadmin' });
  }
  const res = await agent.post('/api/auth/login').set(CSRF).send({ username: 'tiago', password: 'una-clave-muy-larga' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return agent;
}

describe('public settings and availability', () => {
  beforeEach(resetData);

  it('serves default settings with server time in America/Caracas', async () => {
    const res = await request(app).get('/api/settings');
    assert.equal(res.status, 200);
    assert.equal(res.body.settings.businessName, 'Nails Art');
    assert.equal(res.body.settings.services.length, 3);
    assert.equal(res.body.settings.now.date, TODAY);
    // Shown to clients in «Lo que debes saber» since 2026-11-16 (the booking error already states it).
    assert.equal(res.body.settings.booking.maxActivePerPhone, 3);
    assert.equal(res.body.settings.blockedDates.every((b) => b.reason === undefined), true, 'block reasons stay admin-only');
  });

  it('lists starts that fit each service', async () => {
    const one = await request(app).get(`/api/appointments/availability?date=${SATURDAY}&service=manicura`);
    assert.equal(one.status, 200);
    assert.deepEqual(
      one.body.slots.map((s) => s.time),
      // Starts every 30 minutes (Tiago, 2026-11-19); each one still needs the whole hour free.
      ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'],
    );
    const two = await request(app).get(`/api/appointments/availability?date=${SATURDAY}&service=manicura-pedicura`);
    assert.deepEqual(
      two.body.slots.map((s) => s.time),
      ['08:30', '09:00', '09:30', '10:00', '10:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'],
    );
  });

  it('reports closed Sundays and the window in /days', async () => {
    const res = await request(app).get('/api/appointments/days?service=manicura');
    assert.equal(res.status, 200);
    assert.equal(res.body.days.length, 31);
    const sunday = res.body.days.find((d) => d.date === '2026-11-22');
    assert.equal(sunday.status, 'closed');
    const today = res.body.days.find((d) => d.date === TODAY);
    assert.equal(today.status, 'available'); // 10:00 now, 11:30 still bookable
  });

  it('rejects unknown services and bad dates', async () => {
    assert.equal((await request(app).get(`/api/appointments/availability?date=${SATURDAY}&service=nope`)).status, 422);
    assert.equal((await request(app).get('/api/appointments/availability?date=2026-02-30&service=manicura')).status, 422);
  });
});

describe('booking', () => {
  beforeEach(resetData);

  it('requires the CSRF header', async () => {
    const res = await request(app).post('/api/appointments').send(booking());
    assert.equal(res.status, 403);
  });

  it('creates an appointment with code, QR and client record', async () => {
    const res = await book(booking());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const a = res.body.appointment;
    assert.match(a.bookingCode, BOOKING_CODE_REGEX);
    assert.ok(a.qrDataUrl.startsWith('data:image/png;base64,'));
    assert.equal(a.clientPhone, '584141234567');
    assert.equal(a.endTime, '11:30');
    assert.equal(a.status, 'confirmed');

    const { Client } = await import('../models/index.js');
    const client = await Client.findOne({ phone: '584141234567' }).lean();
    assert.equal(client.totalAppointments, 1);
    assert.equal(client.lastAppointmentDate, SATURDAY);
  });

  it('returns 409 for a taken or overlapping slot', async () => {
    assert.equal((await book(booking())).status, 201);
    const same = await book(booking({ clientPhone: '0414 765 4321', clientName: 'Luisa Pérez' }));
    assert.equal(same.status, 409);
    assert.equal(same.body.code, 'SLOT_TAKEN');
    const overlap = await book(
      booking({ serviceKey: 'manicura-pedicura', timeSlot: '09:30', clientPhone: '0424 111 2233', clientName: 'Rosa Díaz' }),
    );
    assert.equal(overlap.status, 409);
    const adjacent = await book(
      booking({ serviceKey: 'manicura-pedicura', timeSlot: '08:30', clientPhone: '0424 111 2233', clientName: 'Rosa Díaz' }),
    );
    assert.equal(adjacent.status, 201, 'a 2h service ending exactly at 10:30 fits');
  });

  it('never double books under concurrency', async () => {
    const phones = ['04141110001', '04141110002', '04141110003', '04141110004', '04141110005', '04141110006', '04141110007', '04141110008'];
    const results = await Promise.all(
      phones.map((phone, i) => book(booking({ clientPhone: phone, clientName: `Clienta Prueba ${String.fromCharCode(65 + i)}` }))),
    );
    const statuses = results.map((r) => r.status).sort();
    assert.equal(statuses.filter((s) => s === 201).length, 1, `statuses: ${statuses}`);
    assert.equal(statuses.filter((s) => s === 409).length, phones.length - 1);
    const { Appointment } = await import('../models/index.js');
    assert.equal(await Appointment.countDocuments({ date: SATURDAY, holdsSlot: true }), 1);
  });

  it('limits a phone to 3 active appointments', async () => {
    for (const time of ['08:30', '09:30', '10:30']) assert.equal((await book(booking({ timeSlot: time }))).status, 201);
    const fourth = await book(booking({ timeSlot: '11:30' }));
    assert.equal(fourth.status, 422);
    assert.equal(fourth.body.code, 'MAX_ACTIVE_REACHED');
  });

  it('validates time, date, lead time and honeypot', async () => {
    assert.equal((await book(booking({ timeSlot: '08:45' }))).body.code, 'INVALID_TIME');
    assert.equal((await book(booking({ date: '2026-11-22' }))).body.code, 'DATE_UNAVAILABLE');
    assert.equal((await book(booking({ date: '2026-11-15' }))).body.code, 'DATE_UNAVAILABLE');
    assert.equal((await book(booking({ date: TODAY, timeSlot: '10:30' }))).body.code, 'INVALID_TIME'); // inside 60 min lead
    assert.equal((await book(booking({ website: 'http://spam' }))).status, 422);
    assert.equal((await book(booking({ clientPhone: '12345' }))).status, 422);
    assert.equal((await book(booking({ clientName: 'A' }))).status, 422);
  });
});

describe('client cancellation', () => {
  beforeEach(resetData);

  it('lists by phone without exposing the code, and frees the slot on cancel', async () => {
    const created = (await book(booking())).body.appointment;
    const list = await request(app).get('/api/appointments/by-phone/04141234567');
    assert.equal(list.status, 200);
    assert.equal(list.body.appointments.length, 1);
    assert.equal(list.body.appointments[0].bookingCode, undefined);
    assert.equal(list.body.appointments[0].qrDataUrl, undefined);

    const wrong = await request(app).patch(`/api/appointments/${created.id}/cancel`).set(CSRF).send({ phone: '04149999999' });
    assert.equal(wrong.status, 404);

    const ok = await request(app).patch(`/api/appointments/${created.id}/cancel`).set(CSRF).send({ phone: '0414-123-4567' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.appointment.status, 'cancelled');

    const again = await request(app).patch(`/api/appointments/${created.id}/cancel`).set(CSRF).send({ phone: '04141234567' });
    assert.equal(again.status, 409);

    const rebook = await book(booking({ clientPhone: '04247654321', clientName: 'Otra Clienta' }));
    assert.equal(rebook.status, 201, 'slot must be free after cancellation');
  });
});

describe('rescheduling', () => {
  beforeEach(resetData);

  it('lets the client move her appointment, keeping code and QR, and frees the old time', async () => {
    const created = (await book(booking())).body.appointment;

    // Her own time shows as free when she asks with exclude.
    const plain = await request(app).get(`/api/appointments/availability?date=${SATURDAY}&service=manicura`);
    assert.equal(plain.body.slots.find((s) => s.time === '10:00').available, false);
    const mine = await request(app).get(`/api/appointments/availability?date=${SATURDAY}&service=manicura&exclude=${created.id}`);
    assert.equal(mine.body.slots.find((s) => s.time === '10:00').available, true);

    const wrong = await request(app).patch(`/api/appointments/${created.id}/reschedule`).set(CSRF).send({ phone: '04149999999', date: SATURDAY, timeSlot: '14:00' });
    assert.equal(wrong.status, 404);
    const same = await request(app).patch(`/api/appointments/${created.id}/reschedule`).set(CSRF).send({ phone: '04141234567', date: SATURDAY, timeSlot: '10:30' });
    assert.equal(same.status, 422);
    const closed = await request(app).patch(`/api/appointments/${created.id}/reschedule`).set(CSRF).send({ phone: '04141234567', date: '2026-11-22', timeSlot: '10:00' });
    assert.equal(closed.status, 422, 'Sundays are closed for the portal');

    // Overlapping its own old time (10:30-11:30 -> 11:00-12:00) is fine.
    const moved = await request(app).patch(`/api/appointments/${created.id}/reschedule`).set(CSRF).send({ phone: '04141234567', date: SATURDAY, timeSlot: '11:00' });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.appointment.timeSlot, '11:00');
    assert.equal(moved.body.appointment.endTime, '12:00');
    assert.equal(moved.body.appointment.bookingCode, undefined);

    const { Appointment } = await import('../models/index.js');
    const doc = await Appointment.findById(created.id).lean();
    assert.equal(doc.bookingCode, created.bookingCode, 'same code');
    assert.ok(doc.qrDataUrl, 'QR kept');
    assert.equal(doc.previousTimeSlot, '10:30');
    assert.equal(doc.rescheduledBy, 'client');
    assert.equal(await Appointment.countDocuments({}), 1, 'moved in place, nothing deleted or duplicated');

    const freed = await book(booking({ timeSlot: '09:30', clientPhone: '04247654321', clientName: 'Otra Clienta' }));
    assert.equal(freed.status, 201, '09:30-10:30 is free again');
    const clash = await book(booking({ timeSlot: '11:30', clientPhone: '04247654322', clientName: 'Tercera' }));
    assert.equal(clash.status, 409, 'new time is held');
  });

  it('lets the admin move an appointment to any free future time, never over another one', async () => {
    const agent = await loginAgent();
    const a = (await book(booking())).body.appointment;
    await book(booking({ timeSlot: '14:00', clientPhone: '04247654321', clientName: 'Otra Clienta' }));

    assert.equal((await request(app).patch(`/api/admin/appointments/${a.id}/reschedule`).set(CSRF).send({ date: SATURDAY, timeSlot: '19:00' })).status, 401);
    const over = await agent.patch(`/api/admin/appointments/${a.id}/reschedule`).set(CSRF).send({ date: SATURDAY, timeSlot: '13:30' });
    assert.equal(over.status, 409);
    const past = await agent.patch(`/api/admin/appointments/${a.id}/reschedule`).set(CSRF).send({ date: TODAY, timeSlot: '08:00' });
    assert.equal(past.status, 422);
    const late = await agent.patch(`/api/admin/appointments/${a.id}/reschedule`).set(CSRF).send({ date: SATURDAY, timeSlot: '19:00' });
    assert.equal(late.status, 200, JSON.stringify(late.body));
    assert.equal(late.body.appointment.endTime, '20:00');
    assert.equal(late.body.appointment.rescheduledBy, 'admin');
    assert.equal(late.body.appointment.previousTimeSlot, '10:30');

    await agent.patch(`/api/admin/appointments/${a.id}/cancel`).set(CSRF);
    const cancelled = await agent.patch(`/api/admin/appointments/${a.id}/reschedule`).set(CSRF).send({ date: SATURDAY, timeSlot: '09:00' });
    assert.equal(cancelled.status, 409);
  });
});

describe('agenda: search, views, rescheduling and client history (2026-11-27)', () => {
  beforeEach(resetData);

  /** Books on SATURDAY and marks it attended on that day, so from Monday it is a «future» attended one. */
  async function attendedInTheFuture(agent, overrides = {}) {
    const created = (await book(booking(overrides))).body.appointment;
    assert.ok(created, 'booked');
    await atInstant(SATURDAY_NOON_ISO, async () => {
      const res = await agent.patch(`/api/admin/appointments/${created.id}/complete`).set(CSRF);
      assert.equal(res.status, 200, JSON.stringify(res.body));
    });
    return created;
  }

  it('lists every appointment by default and finds names without accents, in any word order', async () => {
    const agent = await loginAgent();
    await book(booking({ clientName: 'Sara Rodríguez' }));
    await book(booking({ timeSlot: '14:00', clientName: 'María José Peña', clientPhone: '04247654321' }));

    const all = await agent.get('/api/admin/appointments');
    assert.equal(all.status, 200);
    assert.equal(all.body.total, 2, 'default view is «Todas»');
    assert.equal(all.body.summary.all, 2);

    for (const q of ['rodriguez', 'RODRÍGUEZ', 'sara rodri', 'rodriguez sara']) {
      const res = await agent.get('/api/admin/appointments').query({ q });
      assert.equal(res.body.total, 1, q);
      assert.equal(res.body.items[0].clientName, 'Sara Rodríguez');
    }
    assert.equal((await agent.get('/api/admin/appointments').query({ q: 'maria pena' })).body.total, 1);
    assert.equal((await agent.get('/api/admin/appointments').query({ q: 'maria sara' })).body.total, 0, 'every word must match');
    assert.equal((await agent.get('/api/admin/appointments').query({ q: '0424 765' })).body.total, 1, 'phone digits');
    assert.equal((await agent.get('/api/admin/appointments').query({ q: '+++' })).body.total, 0, 'only symbols');

    const clients = await agent.get('/api/admin/clients').query({ q: 'pena maria' });
    assert.equal(clients.body.total, 1);
    assert.equal(clients.body.items[0].name, 'María José Peña');
    assert.equal((await agent.get('/api/admin/clients').query({ q: '+++' })).body.total, 0);
  });

  it('finds a past date in «Todas», never in «Próximas»', async () => {
    const agent = await loginAgent();
    await book(booking());
    await atInstant('2026-11-23T14:00:00.000Z', async () => {
      const byDate = await agent.get('/api/admin/appointments').query({ date: SATURDAY });
      assert.equal(byDate.body.total, 1, 'the day still shows its appointment');
      const byName = await agent.get('/api/admin/appointments').query({ q: 'ana' });
      assert.equal(byName.body.total, 1);
      const upcoming = await agent.get('/api/admin/appointments').query({ view: 'upcoming', date: SATURDAY });
      assert.equal(upcoming.body.total, 0);
    });
  });

  it('«Próximas» shows every appointment ahead, also future ones marked attended by mistake', async () => {
    const agent = await loginAgent();
    await attendedInTheFuture(agent);
    await book(booking({ timeSlot: '14:00', clientPhone: '04247654321', clientName: 'Luisa Pérez' }));
    const cancelled = (await book(booking({ timeSlot: '16:00', clientPhone: '04247654322', clientName: 'Rosa Mora' }))).body.appointment;
    await agent.patch(`/api/admin/appointments/${cancelled.id}/cancel`).set(CSRF);

    const upcoming = await agent.get('/api/admin/appointments').query({ view: 'upcoming' });
    assert.equal(upcoming.body.total, 2);
    assert.equal(upcoming.body.summary.upcoming, 2);
    assert.deepEqual(
      upcoming.body.items.map((a) => a.timeSlot),
      ['10:30', '14:00'],
      'soonest first',
    );
  });

  it('reschedules or cancels an appointment marked attended by mistake, fixing the client visits', async () => {
    const agent = await loginAgent();
    const a = await attendedInTheFuture(agent);
    const { Client } = await import('../models/index.js');
    assert.equal((await Client.findOne({ phone: '584141234567' }).lean()).completedAppointments, 1);

    const moved = await agent.patch(`/api/admin/appointments/${a.id}/reschedule`).set(CSRF).send({ date: '2026-12-28', timeSlot: '15:00' });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.appointment.status, 'confirmed', 'back to pending');
    assert.equal(moved.body.appointment.completedAt, null);
    let client = await Client.findOne({ phone: '584141234567' }).lean();
    assert.equal(client.completedAppointments, 0);
    assert.equal(client.lastVisitDate, '');

    const b = await attendedInTheFuture(agent, { timeSlot: '17:00' });
    const cancelled = await agent.patch(`/api/admin/appointments/${b.id}/cancel`).set(CSRF);
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.appointment.status, 'cancelled');
    client = await Client.findOne({ phone: '584141234567' }).lean();
    assert.equal(client.completedAppointments, 0);
    assert.equal((await agent.patch(`/api/admin/appointments/${b.id}/cancel`).set(CSRF)).status, 409, 'already cancelled');
  });

  it('«Quitar asistencia» puts an attended appointment back to pending', async () => {
    const agent = await loginAgent();
    const a = await attendedInTheFuture(agent);
    const reopened = await agent.patch(`/api/admin/appointments/${a.id}/reopen`).set(CSRF);
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.appointment.status, 'confirmed');
    assert.equal((await agent.patch(`/api/admin/appointments/${a.id}/reopen`).set(CSRF)).status, 409);
    assert.equal((await request(app).patch(`/api/admin/appointments/${a.id}/reopen`).set(CSRF)).status, 401);
    const { Client } = await import('../models/index.js');
    assert.equal((await Client.findOne({ phone: '584141234567' }).lean()).completedAppointments, 0);
    const clash = await book(booking({ timeSlot: '10:30', clientPhone: '04247654321', clientName: 'Otra Clienta' }));
    assert.equal(clash.status, 409, 'its time is still held');
  });

  it('never moves or cancels a real visit (attended today or before): «Quitar asistencia» first', async () => {
    const agent = await loginAgent();
    const a = await attendedInTheFuture(agent);
    await atInstant('2026-11-23T14:00:00.000Z', async () => {
      const move = await agent.patch(`/api/admin/appointments/${a.id}/reschedule`).set(CSRF).send({ date: '2026-12-01', timeSlot: '10:00' });
      assert.equal(move.status, 409);
      assert.equal(move.body.code, 'ATTENDED');
      const cancel = await agent.patch(`/api/admin/appointments/${a.id}/cancel`).set(CSRF);
      assert.equal(cancel.status, 409);
      const { Appointment, Client } = await import('../models/index.js');
      const doc = await Appointment.findById(a.id).lean();
      assert.equal(doc.status, 'completed', 'the visit is untouched');
      assert.ok(doc.completedAt);
      assert.equal((await Client.findOne({ phone: '584141234567' }).lean()).completedAppointments, 1);

      assert.equal((await agent.patch(`/api/admin/appointments/${a.id}/reopen`).set(CSRF)).status, 200);
      assert.equal((await agent.patch(`/api/admin/appointments/${a.id}/complete`).set(CSRF)).status, 200, 'and it can be redone');
    });
  });

  it('opens «Todas» on today and what comes next, then the past; «Hoy» matches its counter', async () => {
    const agent = await loginAgent();
    const past = (await book(booking({ date: TODAY, timeSlot: '14:00' }))).body.appointment;
    const later = (await book(booking({ date: '2026-11-25', timeSlot: '15:00', clientPhone: '04247654321', clientName: 'Luisa Pérez' }))).body.appointment;
    const sat = (await book(booking({ clientPhone: '04247654322', clientName: 'Rosa Mora' }))).body.appointment;
    const cancelled = (await book(booking({ date: '2026-11-25', timeSlot: '17:00', clientPhone: '04247654323', clientName: 'Eva Gil' }))).body.appointment;
    await agent.patch(`/api/admin/appointments/${cancelled.id}/cancel`).set(CSRF);

    await atInstant('2026-11-25T13:00:00.000Z', async () => {
      // Wednesday 9:00: today's two first (soonest first), then Saturday, then the past.
      const all = await agent.get('/api/admin/appointments');
      assert.deepEqual(
        all.body.items.map((x) => x.id),
        [later.id, cancelled.id, sat.id, past.id],
      );
      const page2 = await agent.get('/api/admin/appointments').query({ page: 2, limit: 3 });
      assert.deepEqual(page2.body.items.map((x) => x.id), [past.id], 'pages continue into the past');
      const today = await agent.get('/api/admin/appointments').query({ view: 'today' });
      assert.equal(today.body.total, 1, 'cancelled ones are not in «Hoy»');
      assert.equal(today.body.summary.today, 1);
    });
  });

  it('moves an appointment from any day: a missed past one, two months ahead', async () => {
    const agent = await loginAgent();
    const a = (await book(booking())).body.appointment;
    await atInstant('2026-11-24T14:00:00.000Z', async () => {
      const far = await agent.patch(`/api/admin/appointments/${a.id}/reschedule`).set(CSRF).send({ date: '2027-01-25', timeSlot: '09:00' });
      assert.equal(far.status, 200, JSON.stringify(far.body));
      assert.equal(far.body.appointment.date, '2027-01-25');
    });
  });

  it('shows a client with her history and her next appointment', async () => {
    const agent = await loginAgent();
    const first = (await book(booking())).body.appointment;
    await agent.patch(`/api/admin/appointments/${first.id}/reschedule`).set(CSRF).send({ date: '2026-11-28', timeSlot: '10:00' });
    const sooner = (await book(booking({ date: '2026-11-25', timeSlot: '15:00' }))).body.appointment;
    const other = (await book(booking({ timeSlot: '14:00', clientPhone: '04247654321', clientName: 'Luisa Pérez' }))).body.appointment;

    const list = await agent.get('/api/admin/clients');
    const ana = list.body.items.find((c) => c.phone === '584141234567');
    assert.equal(ana.nextAppointment.id, sooner.id, 'the soonest pending one');
    assert.equal(list.body.items.find((c) => c.phone === '584247654321').nextAppointment.id, other.id);

    const detail = await agent.get(`/api/admin/clients/${ana.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.client.name, 'Ana Ruiz');
    assert.equal(detail.body.appointments.length, 2, 'only her appointments');
    assert.deepEqual(
      detail.body.appointments.map((x) => x.date),
      ['2026-11-28', '2026-11-25'],
      'newest first',
    );
    assert.equal(detail.body.nextAppointment.id, sooner.id);
    assert.equal(detail.body.appointments[0].qrDataUrl, undefined);
    assert.equal(detail.body.now.date, TODAY);
    assert.equal((await agent.get('/api/admin/clients/aaaaaaaaaaaaaaaaaaaaaaaa')).status, 404);

    // A future one marked attended by mistake still counts as her next appointment.
    const luisa = list.body.items.find((c) => c.phone === '584247654321');
    await atInstant(SATURDAY_NOON_ISO, () => agent.patch(`/api/admin/appointments/${other.id}/complete`).set(CSRF));
    const mistaken = await agent.get(`/api/admin/clients/${luisa.id}`);
    assert.equal(mistaken.body.nextAppointment.id, other.id);
    assert.equal(mistaken.body.nextAppointment.status, 'completed');
    assert.equal((await request(app).get(`/api/admin/clients/${ana.id}`)).status, 401);
  });
});

describe('admin', () => {
  before(async () => {
    const { AdminUser } = await import('../models/index.js');
    await AdminUser.deleteMany({});
  });
  beforeEach(resetData);

  it('protects admin routes', async () => {
    assert.equal((await request(app).get('/api/admin/appointments')).status, 401);
    assert.equal((await request(app).put('/api/settings').set(CSRF).send({ businessName: 'X' })).status, 401);
    assert.equal((await request(app).post('/api/appointments/verify').set(CSRF).send({ code: 'NA84K2' })).status, 401);
  });

  it('no longer exposes the one-time setup (removed 2026-11-16)', async () => {
    const setup = await request(app)
      .post('/api/auth/setup')
      .set(CSRF)
      .send({ username: 'intruso', password: 'clave-larga', passwordConfirm: 'clave-larga' });
    assert.equal(setup.status, 404);
    const agent = await loginAgent();
    const session = await agent.get('/api/auth/session');
    assert.equal(session.status, 200);
    assert.equal(session.body.admin.username, 'tiago');
  });

  it('books manually from the panel, outside opening hours, but never overlapping', async () => {
    const agent = await loginAgent();
    assert.equal((await request(app).post('/api/admin/appointments').set(CSRF).send({})).status, 401);

    // 19:30 is after closing time: allowed from the panel.
    const late = await agent
      .post('/api/admin/appointments')
      .set(CSRF)
      .send({ serviceKey: 'manicura', date: SATURDAY, timeSlot: '19:30', clientName: 'Rosa Díaz', clientPhone: '0412 555 1234' });
    assert.equal(late.status, 201, JSON.stringify(late.body));
    assert.equal(late.body.appointment.endTime, '20:30');
    assert.ok(late.body.appointment.qrDataUrl.startsWith('data:image/png'));
    assert.ok(late.body.appointment.qrText.endsWith(`codigo=${late.body.appointment.bookingCode}`));

    const overlap = await agent
      .post('/api/admin/appointments')
      .set(CSRF)
      .send({ serviceKey: 'pedicura', date: SATURDAY, timeSlot: '20:00', clientName: 'Otra Clienta', clientPhone: '0412 555 9999' });
    assert.equal(overlap.status, 409);

    const past = await agent
      .post('/api/admin/appointments')
      .set(CSRF)
      .send({ serviceKey: 'manicura', date: TODAY, timeSlot: '08:30', clientName: 'Tarde Ya', clientPhone: '0412 555 0000' });
    assert.equal(past.status, 422);

    const list = await agent.get('/api/admin/appointments?view=upcoming');
    assert.equal(list.body.items[0].source, 'admin');
  });

  it('reserves a time range that clients can no longer book, and releases it', async () => {
    const agent = await loginAgent();
    const block = await agent.post('/api/admin/time-blocks').set(CSRF).send({ date: SATURDAY, start: '10:30', end: '12:30', reason: 'Diligencia' });
    assert.equal(block.status, 201, JSON.stringify(block.body));
    assert.equal(block.body.block.kind, 'block');

    const avail = await request(app).get(`/api/appointments/availability?date=${SATURDAY}&service=manicura`);
    const taken = avail.body.slots.filter((s) => !s.available).map((s) => s.time);
    assert.deepEqual(taken, ['10:00', '10:30', '11:00', '11:30'], '10:00 + 1 h would run into the block');
    assert.equal((await book(booking({ timeSlot: '10:30' }))).status, 409);

    const clash = await agent.post('/api/admin/time-blocks').set(CSRF).send({ date: SATURDAY, start: '11:00', end: '11:30' });
    assert.equal(clash.status, 409);
    assert.equal((await agent.post('/api/admin/time-blocks').set(CSRF).send({ date: SATURDAY, start: '12:00', end: '11:00' })).status, 422);

    // Blocks stay out of the Citas list and counters, but show in the calendar.
    const list = await agent.get('/api/admin/appointments?view=upcoming');
    assert.equal(list.body.total, 0);
    const cal = await agent.get(`/api/admin/calendar?from=${SATURDAY}&to=${SATURDAY}`);
    assert.equal(cal.body.days[0].appointmentsCount, 0);
    assert.equal(cal.body.days[0].blockedMinutes, 120);
    assert.equal(cal.body.appointments[0].kind, 'block');

    assert.equal((await agent.patch(`/api/admin/appointments/${block.body.block.id}/cancel`).set(CSRF)).status, 200);
    assert.equal((await book(booking({ timeSlot: '10:30' }))).status, 201);
  });

  it('accepts 6-character passwords for new accounts', async () => {
    const agent = await loginAgent();
    const short = await agent.post('/api/admin/accounts').set(CSRF).send({ username: 'corta', password: '12345', passwordConfirm: '12345' });
    assert.equal(short.status, 422);
    const ok = await agent.post('/api/admin/accounts').set(CSRF).send({ username: 'seis', password: 'abc123', passwordConfirm: 'abc123' });
    assert.equal(ok.status, 201);
    await agent.delete(`/api/admin/accounts/${ok.body.account.id}`).set(CSRF);
  });

  it('manages panel accounts: create, list, reset, own password and delete', async () => {
    const tiago = await loginAgent();
    const pass = 'clave-de-la-manicurista';

    assert.equal((await request(app).get('/api/admin/accounts')).status, 401);

    const created = await tiago.post('/api/admin/accounts').set(CSRF).send({ username: 'Maria', password: pass, passwordConfirm: pass });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.account.username, 'maria');
    assert.equal(created.body.account.role, 'superadmin');
    assert.equal(created.body.account.passwordHash, undefined);

    const dup = await tiago.post('/api/admin/accounts').set(CSRF).send({ username: 'maria', password: pass, passwordConfirm: pass });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.details[0].path, 'username');

    const list = await tiago.get('/api/admin/accounts');
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.items.map((a) => [a.username, a.isSelf]), [['tiago', true], ['maria', false]]);

    // The manicurist is a full superadmin: she can open every admin route, Cuentas included.
    const maria = request.agent(app);
    assert.equal((await maria.post('/api/auth/login').set(CSRF).send({ username: 'maria', password: pass })).status, 200);
    assert.equal((await maria.get('/api/admin/accounts')).status, 200);
    assert.equal((await maria.get('/api/admin/settings')).status, 200);

    // Resetting someone else's password needs no current password and ends their session.
    const mariaId = created.body.account.id;
    const reset = await tiago.patch(`/api/admin/accounts/${mariaId}/password`).set(CSRF).send({ password: 'nueva-clave-maria', passwordConfirm: 'nueva-clave-maria' });
    assert.equal(reset.status, 200);
    assert.equal((await maria.get('/api/auth/session')).status, 401);

    // Your own password needs the current one, and you stay signed in afterwards.
    const tiagoId = list.body.items[0].id;
    const wrong = await tiago.patch(`/api/admin/accounts/${tiagoId}/password`).set(CSRF).send({ currentPassword: 'mala', password: 'otra-clave-tiago', passwordConfirm: 'otra-clave-tiago' });
    assert.equal(wrong.status, 422);
    assert.equal(wrong.body.details[0].path, 'currentPassword');
    const own = await tiago
      .patch(`/api/admin/accounts/${tiagoId}/password`)
      .set(CSRF)
      .send({ currentPassword: 'una-clave-muy-larga', password: 'otra-clave-tiago', passwordConfirm: 'otra-clave-tiago' });
    assert.equal(own.status, 200);
    assert.equal((await tiago.get('/api/auth/session')).status, 200);
    assert.equal((await request(app).post('/api/auth/login').set(CSRF).send({ username: 'tiago', password: 'una-clave-muy-larga' })).status, 401);

    assert.equal((await tiago.delete(`/api/admin/accounts/${tiagoId}`).set(CSRF)).status, 409);
    assert.equal((await tiago.delete(`/api/admin/accounts/${mariaId}`).set(CSRF)).status, 200);
    assert.equal((await tiago.delete(`/api/admin/accounts/${mariaId}`).set(CSRF)).status, 404);
    assert.equal((await tiago.get('/api/admin/accounts')).body.items.length, 1);

    // Put the original password back for the tests that follow.
    await tiago
      .patch(`/api/admin/accounts/${tiagoId}/password`)
      .set(CSRF)
      .send({ currentPassword: 'otra-clave-tiago', password: 'una-clave-muy-larga', passwordConfirm: 'una-clave-muy-larga' });
  });

  it('returns the ticket with its QR so the panel can download it again', async () => {
    const agent = await loginAgent();
    const { appointment } = (await book(booking())).body;
    assert.equal((await request(app).get(`/api/admin/appointments/${appointment.id}/ticket`)).status, 401);
    const res = await agent.get(`/api/admin/appointments/${appointment.id}/ticket`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ticket.bookingCode, appointment.bookingCode);
    assert.ok(res.body.ticket.qrDataUrl.startsWith('data:image/png;base64,'));
    assert.equal(res.body.ticket.qrText, `https://nails-art.test/admin/escanear?codigo=${appointment.bookingCode}`);
    const block = await agent.post('/api/admin/time-blocks').set(CSRF).send({ date: SATURDAY, start: '15:00', end: '16:00', reason: '' });
    assert.equal((await agent.get(`/api/admin/appointments/${block.body.block.id}/ticket`)).status, 404);
  });

  it('hidden superadmin mode: 403 without it, bad key rejected, right key deletes and audits', async () => {
    const agent = await loginAgent();
    const created = await book(booking());
    assert.equal(created.status, 201);
    await book(booking({ timeSlot: '14:00' }));
    const { Appointment, Client, PurgeLog } = await import('../models/index.js');
    const client = await Client.findOne({ phone: '584141234567' }).lean();
    assert.equal(client.totalAppointments, 2);

    // Without elevation: forbidden, nothing deleted.
    assert.equal((await agent.delete(`/api/admin/super/appointments/${created.body.appointment.id}`).set(CSRF)).status, 403);
    assert.equal((await agent.delete(`/api/admin/super/clients/${client._id}`).set(CSRF)).status, 403);
    assert.equal((await request(app).post('/api/admin/super/unlock').set(CSRF).send({ key: '1111' })).status, 401);
    assert.equal((await agent.get('/api/admin/super')).body.active, false);

    // Wrong key.
    const bad = await agent.post('/api/admin/super/unlock').set(CSRF).send({ key: '1234' });
    assert.equal(bad.status, 401);
    assert.equal(bad.body.code, 'BAD_SUPER_KEY');

    // Right key: elevated for 15 minutes.
    const ok = await agent.post('/api/admin/super/unlock').set(CSRF).send({ key: '1111' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.active, true);
    assert.equal((await agent.get('/api/admin/super')).body.active, true);

    // One appointment: gone, counters updated, slot free again, audited.
    const one = await agent.delete(`/api/admin/super/appointments/${created.body.appointment.id}`).set(CSRF);
    assert.equal(one.status, 200, JSON.stringify(one.body));
    assert.equal(await Appointment.countDocuments({ _id: created.body.appointment.id }), 0);
    assert.equal((await Client.findById(client._id).lean()).totalAppointments, 1);
    assert.equal((await book(booking({ clientPhone: '0414 999 8888' }))).status, 201);

    // The client and every appointment with her phone.
    const all = await agent.delete(`/api/admin/super/clients/${client._id}`).set(CSRF);
    assert.equal(all.status, 200);
    assert.deepEqual(all.body.deleted, { clients: 1, appointments: 1 });
    assert.equal(await Client.countDocuments({ phone: '584141234567' }), 0);
    assert.equal(await Appointment.countDocuments({ clientPhone: '584141234567' }), 0);
    assert.equal(await Appointment.countDocuments({ clientPhone: '584149998888' }), 1);

    const logs = await PurgeLog.find().sort({ createdAt: 1 }).lean();
    assert.equal(logs.length, 2);
    assert.deepEqual(logs.map((l) => l.entity), ['appointment', 'client']);
    assert.equal(logs[0].username, 'tiago');
    assert.equal(logs[1].snapshot.appointments.length, 1);

    // Leaving the mode locks deletion again.
    assert.equal((await agent.post('/api/admin/super/lock').set(CSRF)).body.active, false);
    const other = await Client.findOne({ phone: '584149998888' }).lean();
    assert.equal((await agent.delete(`/api/admin/super/clients/${other._id}`).set(CSRF)).status, 403);
  });

  it('limits superadmin key attempts', async () => {
    process.env.ENFORCE_RATE_LIMIT = '1';
    try {
      const agent = await loginAgent();
      for (let i = 0; i < 5; i += 1) {
        assert.equal((await agent.post('/api/admin/super/unlock').set(CSRF).send({ key: '0000' })).status, 401);
      }
      assert.equal((await agent.post('/api/admin/super/unlock').set(CSRF).send({ key: '1111' })).status, 429);
    } finally {
      delete process.env.ENFORCE_RATE_LIMIT;
    }
  });

  it('rejects wrong passwords with a generic message', async () => {
    await loginAgent();
    const res = await request(app).post('/api/auth/login').set(CSRF).send({ username: 'tiago', password: 'mala' });
    assert.equal(res.status, 401);
    const ghost = await request(app).post('/api/auth/login').set(CSRF).send({ username: 'nadie', password: 'mala' });
    assert.equal(ghost.status, 401);
    assert.equal(res.body.error, ghost.body.error);
  });

  it('verifies a code, marks attendance once and updates the client', async () => {
    const agent = await loginAgent();
    const created = (await book(booking())).body.appointment;

    const lookup = await agent.post('/api/appointments/verify').set(CSRF).send({ code: created.bookingCode.toLowerCase() });
    assert.equal(lookup.status, 200);
    assert.equal(lookup.body.canMarkAttended, false, 'a future appointment cannot be attended yet');
    assert.ok(lookup.body.warnings.some((w) => w.startsWith('Esta cita es para otro día.')));
    const early = await agent.post('/api/appointments/verify').set(CSRF).send({ code: created.bookingCode, markAttended: true });
    assert.equal(early.status, 422);
    assert.equal(early.body.code, 'FUTURE_DATE');

    await atInstant(SATURDAY_NOON_ISO, async () => {
      const onTheDay = await agent.post('/api/appointments/verify').set(CSRF).send({ code: created.bookingCode });
      assert.equal(onTheDay.body.canMarkAttended, true);
      const attend = await agent.post('/api/appointments/verify').set(CSRF).send({ code: created.bookingCode, markAttended: true });
      assert.equal(attend.status, 200);
      assert.equal(attend.body.appointment.status, 'completed');

      const twice = await agent.post('/api/appointments/verify').set(CSRF).send({ code: created.bookingCode, markAttended: true });
      assert.equal(twice.status, 409);
    });

    const clients = await agent.get('/api/admin/clients?q=ana');
    assert.equal(clients.status, 200);
    assert.equal(clients.body.items[0].completedAppointments, 1);
    assert.equal(clients.body.items[0].lastVisitDate, SATURDAY);

    const notFound = await agent.post('/api/appointments/verify').set(CSRF).send({ code: 'ZZZZZZ' });
    assert.equal(notFound.status, 404);
  });

  it('lists, filters, cancels and completes appointments', async () => {
    const agent = await loginAgent();
    const a = (await book(booking())).body.appointment;
    const b = (await book(booking({ timeSlot: '14:00', clientPhone: '04247654321', clientName: 'Luisa Pérez' }))).body.appointment;

    const upcoming = await agent.get('/api/admin/appointments?view=upcoming');
    assert.equal(upcoming.status, 200);
    assert.equal(upcoming.body.total, 2);
    assert.equal(upcoming.body.items[0].qrDataUrl, undefined);
    assert.equal(upcoming.body.summary.upcoming, 2);

    assert.equal((await agent.patch(`/api/admin/appointments/${a.id}/cancel`).set(CSRF)).status, 200);
    assert.equal((await agent.patch(`/api/admin/appointments/${b.id}/complete`).set(CSRF)).status, 422, 'not on a future day');
    await atInstant(SATURDAY_NOON_ISO, async () => {
      assert.equal((await agent.patch(`/api/admin/appointments/${b.id}/complete`).set(CSRF)).status, 200);
      assert.equal((await agent.patch(`/api/admin/appointments/${a.id}/complete`).set(CSRF)).status, 409);
    });

    const cancelled = await agent.get('/api/admin/appointments?view=cancelled');
    assert.equal(cancelled.body.total, 1);
    const search = await agent.get('/api/admin/appointments?view=all&q=luisa');
    assert.equal(search.body.total, 1);
  });

  it('updates settings with validation', async () => {
    const agent = await loginAgent();
    const bad = await agent.put('/api/settings').set(CSRF).send({ themeColors: { primary: 'red' } });
    assert.equal(bad.status, 422);

    const full = await agent.get('/api/admin/settings');
    const services = full.body.settings.services.map((s) => (s.key === 'pedicura' ? { ...s, isActive: false } : s));
    const ok = await agent.put('/api/settings').set(CSRF).send({ services, businessName: 'Nails Art SC', booking: { windowDays: 15, minLeadMinutes: 30, maxActivePerPhone: 2 } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const pub = await request(app).get('/api/settings');
    assert.equal(pub.body.settings.businessName, 'Nails Art SC');
    assert.equal(pub.body.settings.services.some((s) => s.key === 'pedicura'), false);
    assert.equal(pub.body.settings.booking.windowDays, 15);
  });

  it('blocks and unblocks days', async () => {
    const agent = await loginAgent();
    await book(booking());
    const blocked = await agent.post('/api/admin/blocked-dates').set(CSRF).send({ date: SATURDAY, reason: 'Feriado' });
    assert.equal(blocked.status, 201);
    assert.equal(blocked.body.affectedAppointments, 1);
    const avail = await request(app).get(`/api/appointments/availability?date=${SATURDAY}&service=manicura`);
    assert.equal(avail.body.reason, 'blocked');

    const cal = await agent.get(`/api/admin/calendar?from=${TODAY}&to=2026-11-22`);
    assert.equal(cal.status, 200);
    const sat = cal.body.days.find((d) => d.date === SATURDAY);
    assert.equal(sat.blocked, true);
    assert.equal(sat.appointmentsCount, 1);

    assert.equal((await agent.delete(`/api/admin/blocked-dates/${SATURDAY}`).set(CSRF)).status, 200);
    const again = await request(app).get(`/api/appointments/availability?date=${SATURDAY}&service=manicura`);
    assert.equal(again.body.reason, null);

    assert.equal((await agent.post('/api/admin/blocked-dates').set(CSRF).send({ date: '2026-11-10' })).status, 422);
  });

  it('locks login after 5 failures from the same IP', async () => {
    await loginAgent();
    process.env.ENFORCE_RATE_LIMIT = '1';
    try {
      for (let i = 0; i < 5; i += 1) {
        const r = await request(app).post('/api/auth/login').set(CSRF).send({ username: 'tiago', password: `mala-${i}` });
        assert.equal(r.status, 401);
      }
      const locked = await request(app).post('/api/auth/login').set(CSRF).send({ username: 'tiago', password: 'una-clave-muy-larga' });
      assert.equal(locked.status, 429);
    } finally {
      delete process.env.ENFORCE_RATE_LIMIT;
    }
  });
});

describe('errors', () => {
  it('returns JSON 404 for unknown API routes and 400 for bad JSON', async () => {
    assert.equal((await request(app).get('/api/nope')).status, 404);
    const bad = await request(app).post('/api/appointments').set(CSRF).set('Content-Type', 'application/json').send('{bad');
    assert.equal(bad.status, 400);
  });
});
