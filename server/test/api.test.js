import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';

import { BOOKING_CODE_REGEX } from '../../shared/constants.js';
import { CSRF, SATURDAY, TODAY, booking, resetData, startTestApp, stopTestApp } from './helpers.js';

let app;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await stopTestApp();
});

const book = (body) => request(app).post('/api/appointments').set(CSRF).send(body);

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
      ['08:30', '09:30', '10:30', '11:30', '14:00', '15:00', '16:00', '17:00', '18:00'],
    );
    const two = await request(app).get(`/api/appointments/availability?date=${SATURDAY}&service=manicura-pedicura`);
    assert.deepEqual(
      two.body.slots.map((s) => s.time),
      ['08:30', '09:30', '10:30', '14:00', '15:00', '16:00', '17:00'],
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
    assert.deepEqual(taken, ['10:30', '11:30']);
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
    assert.equal(lookup.body.canMarkAttended, true);
    assert.ok(lookup.body.warnings.includes('Esta cita es para otro día.'));

    const attend = await agent.post('/api/appointments/verify').set(CSRF).send({ code: created.bookingCode, markAttended: true });
    assert.equal(attend.status, 200);
    assert.equal(attend.body.appointment.status, 'completed');

    const twice = await agent.post('/api/appointments/verify').set(CSRF).send({ code: created.bookingCode, markAttended: true });
    assert.equal(twice.status, 409);

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
    assert.equal((await agent.patch(`/api/admin/appointments/${b.id}/complete`).set(CSRF)).status, 200);
    assert.equal((await agent.patch(`/api/admin/appointments/${a.id}/complete`).set(CSRF)).status, 409);

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
