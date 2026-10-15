import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerRoutes } from '../src/routes.js';
import { registerBarberInviteRoutes } from '../src/barber-invites.js';
import { registerSchedulingRoutes } from '../src/scheduling.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const barberId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const actorId = '44444444-4444-4444-8444-444444444444';

function buildMockDb() {
  const executedQueries = [];
  const intervals = [];
  const barbers = [{ id: barberId, tenant_id: tenantId, status: 'active', name: 'Barber QA' }];

  const db = {
    executedQueries,
    intervals,
    barbers,
    query: async (sql, args = []) => {
      executedQueries.push({ sql, args });

      if (sql.includes('SELECT 1 FROM public.tenant_members WHERE user_id=$1')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('SELECT 1 FROM public.tenant_members')) {
        return { rowCount: 1, rows: [{ role: 'owner' }] };
      }
      if (sql.includes('INSERT INTO public.barbers')) {
        return {
          rowCount: 1,
          rows: [{ id: barberId, tenant_id: tenantId, name: args[1] || 'QA', slug: 'qa-barber' }]
        };
      }
      if (sql.includes('INSERT INTO public.barber_work_intervals')) {
        for (let i = 0; i < 7; i++) {
          intervals.push({ tenant_id: args[0], barber_id: args[1], weekday: i, start_minute: 540, end_minute: 1140 });
        }
        return { rowCount: 7, rows: intervals };
      }
      if (sql.includes('SELECT 1 FROM public.barber_work_intervals')) {
        const found = intervals.filter(i => i.tenant_id === args[0] && i.barber_id === args[1]);
        return { rowCount: found.length, rows: found };
      }
      if (sql.includes('SELECT 1 FROM public.barbers')) {
        const match = barbers.find(b => b.tenant_id === args[0] && b.id === args[1] && b.status === 'active');
        return { rowCount: match ? 1 : 0, rows: match ? [match] : [] };
      }
      if (sql.includes('SELECT g.starts_at,g.ends_at FROM public.tenants')) {
        return { rowCount: 2, rows: [{ starts_at: '2026-10-15T14:00:00Z', ends_at: '2026-10-15T14:30:00Z' }] };
      }
      if (sql.includes('SELECT t.id FROM public.barber_invites') || sql.includes('SELECT t.id, i.id')) {
        return { rowCount: 1, rows: [{ id: tenantId }] };
      }
      if (sql.includes('SELECT * FROM public.barber_join_requests')) {
        return { rowCount: 1, rows: [{ id: args[0], tenant_id: tenantId, user_id: actorId, full_name: 'Barbero QA', status: 'pending' }] };
      }
      if (sql.includes('UPDATE public.barber_join_requests')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
    transaction: async fn => fn(db)
  };
  return db;
}

const mockSecurity = {
  authenticated: async req => { req.actor = { id: actorId, email: 'actor@example.com' }; },
  limited: async () => {},
  requireTenant: async () => 'owner',
  service: {}
};

test('POST /api/v1/tenants/:tenantId/barbers inserts default work intervals', async () => {
  const db = buildMockDb();
  const app = Fastify({ logger: false });
  await registerRoutes(app, { config: {}, db, security: mockSecurity });
  await app.ready();

  try {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/barbers`,
      payload: { name: 'New Barber', slug: 'new-barber' }
    });

    assert.equal(res.statusCode, 201);
    const intervalsQuery = db.executedQueries.find(q => q.sql.includes('INSERT INTO public.barber_work_intervals'));
    assert.ok(intervalsQuery, 'Should have executed INSERT INTO public.barber_work_intervals');
    assert.equal(db.intervals.length, 7, 'Should have inserted 7 weekdays of intervals');
  } finally {
    await app.close();
  }
});

test('GET /api/v1/public/tenants/:tenantId/availability lazily inserts default work intervals when empty', async () => {
  const db = buildMockDb();
  const app = Fastify({ logger: false });
  await registerSchedulingRoutes(app, { db, security: mockSecurity });
  await app.ready();

  try {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/public/tenants/${tenantId}/availability?barberId=${barberId}&serviceId=${serviceId}&date=2026-10-15`
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.slots.length, 1);
    const lazyInsert = db.executedQueries.find(q => q.sql.includes('INSERT INTO public.barber_work_intervals'));
    assert.ok(lazyInsert, 'Should have lazily inserted work intervals before querying slots');
    assert.equal(db.intervals.length, 7);
  } finally {
    await app.close();
  }
});

test('POST /api/v1/invites/:token/accept registers barber and default work intervals', async () => {
  const db = buildMockDb();
  const app = Fastify({ logger: false });
  await registerBarberInviteRoutes(app, { db, security: mockSecurity });
  await app.ready();

  try {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/invites/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef/accept',
      payload: {}
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.status, 'accepted');
    const intervalInsert = db.executedQueries.find(q => q.sql.includes('INSERT INTO public.barber_work_intervals'));
    assert.ok(intervalInsert, 'Should have inserted work intervals on invite accept');
  } finally {
    await app.close();
  }
});

test('POST /api/v1/tenants/:tenantId/barber-requests/:requestId/decision approves barber and creates default intervals', async () => {
  const db = buildMockDb();
  const app = Fastify({ logger: false });
  await registerBarberInviteRoutes(app, { db, security: mockSecurity });
  await app.ready();

  try {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/barber-requests/55555555-5555-4555-8555-555555555555/decision`,
      payload: { approve: true }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'approved');
    const intervalInsert = db.executedQueries.find(q => q.sql.includes('INSERT INTO public.barber_work_intervals'));
    assert.ok(intervalInsert, 'Should have inserted work intervals on request approval');
  } finally {
    await app.close();
  }
});
