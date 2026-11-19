// Stress tests with services like the ones the owner set up (long names, 60/90/120 min),
// starts every 30 minutes and many random bookings («Test Orange 7»…). A fixed seed keeps
// every run identical, so a failure can be replayed.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';

import { LIMITS } from '../../shared/constants.js';
import { ticksFor } from '../../shared/schedule.js';
import { toMinutes, toTime } from '../../shared/time.js';
import { CSRF, resetData, startTestApp, stopTestApp } from './helpers.js';

let app;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await stopTestApp();
});

// Mulberry32: small seeded PRNG.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Client names only take letters, so the counter is spelled: 0 -> «A», 27 -> «BB».
const tag = (n) => String.fromCharCode(65 + (n % 26)).repeat(1 + Math.floor(n / 26));

const COLORS = ['Orange', 'Lila', 'Rosa', 'Menta', 'Coral', 'Uva', 'Cielo', 'Arena'];

// Like production on 2026-11-19, with the full names the owner tried to type.
const SERVICES = [
  { key: 'manicura', name: 'Manicura con esmaltado semipermanente', durationMinutes: 60, isActive: true },
  { key: 'pedicura', name: 'Pedicura con esmaltado semipermanente', durationMinutes: 60, isActive: true },
  { key: 'manicura-pedicura', name: 'Manicura + pedicura con esmaltado semipermanente', durationMinutes: 120, isActive: true },
  { key: 'sistema-jelly-tips', name: 'Sistema jelly tips con esmaltado semipermanente', durationMinutes: 60, isActive: true },
  { key: 'unas-en-golygel', name: 'Uñas en golygel', durationMinutes: 90, isActive: true },
  { key: 'tecnicas-en-acrigel', name: 'Técnicas en acrigel', durationMinutes: 90, isActive: true },
];

const day = (dayOfWeek, isOpen = true) => ({
  dayOfWeek,
  isOpen,
  openTime: '07:00',
  closeTime: '21:00',
  breakStart: isOpen ? '12:30' : '',
  breakEnd: isOpen ? '13:00' : '',
  slotDurationMinutes: 30,
});
const HOURS = [day(0, false), day(1), day(2), day(3), day(4), day(5), day(6)];

// Test clock: Monday 2026-11-16 10:00. Saturday plus the next working week.
const DATES = ['2026-11-21', '2026-11-23', '2026-11-24', '2026-11-25'];

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

async function setupLikeProduction(agent) {
  const res = await agent
    .put('/api/settings')
    .set(CSRF)
    .send({ services: SERVICES, workingHours: HOURS, booking: { windowDays: 30, minLeadMinutes: 15, maxActivePerPhone: 3 } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.settings;
}

// The public booking limit (12 per hour per IP) is real; the stress loop resets it.
async function clearRateLimits() {
  const { RateLimit } = await import('../models/index.js');
  await RateLimit.deleteMany({});
}

describe('services like production, starts every 30 minutes', () => {
  beforeEach(resetData);

  it('keeps service names up to the new limit and rejects longer ones', async () => {
    const agent = await loginAgent();
    const settings = await setupLikeProduction(agent);
    assert.deepEqual(
      settings.services.map((s) => s.name),
      SERVICES.map((s) => s.name),
      'names longer than the old 40 characters survive whole',
    );
    const tooLong = { ...SERVICES[0], name: 'x'.repeat(LIMITS.serviceNameMax + 1) };
    const res = await agent.put('/api/settings').set(CSRF).send({ services: [tooLong, ...SERVICES.slice(1)] });
    assert.equal(res.status, 422);
  });

  it('offers every service every 30 minutes, each needing its whole duration free', async () => {
    const agent = await loginAgent();
    await setupLikeProduction(agent);
    const golygel = await request(app).get('/api/appointments/availability?date=2026-11-21&service=unas-en-golygel');
    assert.equal(golygel.status, 200);
    const times = golygel.body.slots.map((s) => s.time);
    // 90 min: 07:00…11:00 before the 12:30 break, 13:00…19:30 after it.
    assert.equal(times[0], '07:00');
    assert.equal(times[1], '07:30');
    assert.ok(times.includes('11:00') && !times.includes('11:30'), '11:30 + 90 min would cross the break');
    assert.equal(times.at(-1), '19:30');
    assert.ok(times.every((t) => toMinutes(t) % 30 === 0));
  });

  it('survives 120 random bookings without a double booking or a server error', async () => {
    const agent = await loginAgent();
    await setupLikeProduction(agent);
    const random = rng(20261119);
    const occupied = new Map(DATES.map((d) => [d, new Set()]));
    let created = 0;
    let rejected = 0;

    for (let i = 0; i < 120; i += 1) {
      if (i % 10 === 0) await clearRateLimits();
      const date = DATES[Math.floor(random() * DATES.length)];
      const service = SERVICES[Math.floor(random() * SERVICES.length)];
      const avail = await request(app).get(`/api/appointments/availability?date=${date}&service=${service.key}`);
      assert.equal(avail.status, 200, JSON.stringify(avail.body));

      // The engine and our own bookkeeping must agree on every start.
      for (const slot of avail.body.slots) {
        const free = ticksFor(toMinutes(slot.time), service.durationMinutes).every((t) => !occupied.get(date).has(t));
        assert.equal(slot.available, free, `${date} ${slot.time} ${service.key}`);
      }
      if (!avail.body.slots.length) continue;

      const slot = avail.body.slots[Math.floor(random() * avail.body.slots.length)];
      const color = COLORS[Math.floor(random() * COLORS.length)];
      const res = await request(app)
        .post('/api/appointments')
        .set(CSRF)
        .send({
          serviceKey: service.key,
          date,
          timeSlot: slot.time,
          clientName: `Test ${color} ${tag(i)}`,
          clientPhone: `0414${String(1000000 + i).slice(-7)}`,
        });
      assert.ok(res.status < 500, `server error: ${JSON.stringify(res.body)}`);
      if (slot.available) {
        assert.equal(res.status, 201, `${date} ${slot.time} ${service.key}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.appointment.serviceName, service.name);
        assert.equal(res.body.appointment.endTime, toTime(toMinutes(slot.time) + service.durationMinutes));
        for (const t of ticksFor(toMinutes(slot.time), service.durationMinutes)) occupied.get(date).add(t);
        created += 1;
      } else {
        assert.equal(res.status, 409, `${date} ${slot.time} should be taken: ${JSON.stringify(res.body)}`);
        rejected += 1;
      }
    }

    assert.ok(created > 20, `only ${created} bookings went through`);
    assert.ok(rejected > 0, 'the loop should also hit taken times');

    // Nothing in the database overlaps.
    const { Appointment } = await import('../models/index.js');
    for (const date of DATES) {
      const items = await Appointment.find({ date, status: 'confirmed' }).lean();
      const seen = new Set();
      for (const a of items) {
        for (const t of ticksFor(toMinutes(a.timeSlot), a.durationMinutes)) {
          assert.ok(!seen.has(t), `overlap on ${date} at ${t}`);
          seen.add(t);
        }
      }
    }
  });

  it('books by hand at random 15-minute times, refusing only real clashes', async () => {
    const agent = await loginAgent();
    await setupLikeProduction(agent);
    const random = rng(7);
    const date = '2026-11-24';
    const occupied = new Set();
    let created = 0;

    for (let i = 0; i < 60; i += 1) {
      const service = SERVICES[Math.floor(random() * SERVICES.length)];
      // 6:00 to 22:45, also outside opening hours, on a 15-minute tick.
      const start = 6 * 60 + Math.floor(random() * 68) * 15;
      const timeSlot = toTime(start);
      const ticks = ticksFor(start, service.durationMinutes);
      const crossesMidnight = start + service.durationMinutes > 24 * 60;
      const res = await agent
        .post('/api/admin/appointments')
        .set(CSRF)
        .send({ serviceKey: service.key, date, timeSlot, clientName: `Test Orange ${tag(i)}`, clientPhone: `0424${String(2000000 + i).slice(-7)}` });
      assert.ok(res.status < 500, `server error: ${JSON.stringify(res.body)}`);
      if (crossesMidnight) {
        assert.equal(res.status, 422);
      } else if (ticks.some((t) => occupied.has(t))) {
        assert.equal(res.status, 409, `${timeSlot} ${service.key} should clash`);
      } else {
        assert.equal(res.status, 201, `${timeSlot} ${service.key}: ${JSON.stringify(res.body)}`);
        for (const t of ticks) occupied.add(t);
        created += 1;
      }
    }
    assert.ok(created > 5);

    // The public side sees the same day as taken where the panel booked.
    const avail = await request(app).get(`/api/appointments/availability?date=${date}&service=manicura`);
    for (const slot of avail.body.slots) {
      const free = ticksFor(toMinutes(slot.time), 60).every((t) => !occupied.has(t));
      assert.equal(slot.available, free, slot.time);
    }
  });

  it('frees exactly the cancelled appointment and nothing else', async () => {
    const agent = await loginAgent();
    await setupLikeProduction(agent);
    const date = '2026-11-21';
    const first = await request(app)
      .post('/api/appointments')
      .set(CSRF)
      .send({ serviceKey: 'tecnicas-en-acrigel', date, timeSlot: '07:30', clientName: 'Test Orange', clientPhone: '0414 555 0101' });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await request(app)
      .post('/api/appointments')
      .set(CSRF)
      .send({ serviceKey: 'manicura', date, timeSlot: '09:00', clientName: 'Test Lila', clientPhone: '0414 555 0202' });
    assert.equal(second.status, 201, JSON.stringify(second.body));

    const before = await request(app).get(`/api/appointments/availability?date=${date}&service=manicura`);
    const taken = before.body.slots.filter((s) => !s.available).map((s) => s.time);
    assert.deepEqual(taken, ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30']);

    const cancel = await request(app).patch(`/api/appointments/${first.body.appointment.id}/cancel`).set(CSRF).send({ phone: '0414 555 0101' });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
    const afterCancel = await request(app).get(`/api/appointments/availability?date=${date}&service=manicura`);
    assert.deepEqual(
      afterCancel.body.slots.filter((s) => !s.available).map((s) => s.time),
      ['08:30', '09:00', '09:30'],
    );
  });
});

describe('one-time move to starts every 30 minutes', () => {
  beforeEach(resetData);

  it('moves 60-minute days to 30 once, then respects what the admin picks', async () => {
    const legacy = HOURS.map((d) => ({ ...d, slotDurationMinutes: 60 }));
    await mongoose.connection.collection('settings').insertOne({ key: 'main', workingHours: legacy, services: SERVICES, booking: { windowDays: 30, minLeadMinutes: 15, maxActivePerPhone: 3 }, blockedDates: [] });

    const first = await request(app).get('/api/settings');
    assert.equal(first.status, 200);
    assert.ok(first.body.settings.workingHours.every((d) => d.slotDurationMinutes === 30));

    const agent = await loginAgent();
    const hours = first.body.settings.workingHours.map((d) => (d.dayOfWeek === 6 ? { ...d, slotDurationMinutes: 60 } : d));
    const put = await agent.put('/api/settings').set(CSRF).send({ workingHours: hours });
    assert.equal(put.status, 200, JSON.stringify(put.body));

    const again = await request(app).get('/api/settings');
    assert.equal(again.body.settings.workingHours.find((d) => d.dayOfWeek === 6).slotDurationMinutes, 60, 'the migration runs only once');
  });
});
