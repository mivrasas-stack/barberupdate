import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { configFromEnv } from './config.js';
import { createDb } from './db.js';
import { createSecurity } from './security.js';
import { registerRoutes } from './routes.js';
import { registerBusinessRoutes } from './business.js';
import { registerSchedulingRoutes } from './scheduling.js';
import { registerNotificationRoutes } from './notifications.js';
import { registerReportRoutes } from './reports.js';
import { registerPaymentsRoutes } from './payments.js';
import { registerClosureRoutes } from './closures.js';
import { registerCustomerLinkRoutes } from './customer-links.js';
import { registerBarberInviteRoutes } from './barber-invites.js';
import { registerMediaProfileRoutes } from './media-profile.js';
import {registerWhatsAppRoutes} from './whatsapp-routes.js';

export async function buildApp(env = process.env) {
  const config = configFromEnv(env);
  const app = Fastify({ logger: { level: env.LOG_LEVEL || 'info', redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] }, bodyLimit: 1024 * 1024, trustProxy: (_address, hop) => hop === 0 });
  const db = createDb(config);
  const security = createSecurity(config);
  if (security.redis) {
    try { await security.redis.connect(); }
    catch (error) { app.log.warn({ message: error.message }, 'redis is not ready'); }
  }
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || config.origins.includes(origin)),
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : (err.code === '23P01' || err.code === '23505' || err.code === '23514' ? 409 : err.code === '23503' ? 400 : 500);
    if (status >= 500) req.log.error({ err }, 'request failed');
    const message = status >= 500 ? 'Error interno o dependencia no disponible' : status === 409 ? 'Conflicto: horario o recurso no disponible' : err.message;
    reply.code(status).send({ error: message, requestId: req.id });
  });
  app.get('/api/v1/health/live', async () => ({ status: 'ok', version: '0.1.0' }));
  app.get('/api/v1/health/ready', async (_req, reply) => {
    if (!db || !security.supabase || !security.redis) return reply.code(503).send({ status: 'not_configured' });
    try {
      await Promise.all([db.query('SELECT 1'), security.redis.ping()]);
      return { status: 'ready' };
    } catch { return reply.code(503).send({ status: 'unavailable' }); }
  });
  await registerRoutes(app, { config, db, security });
  await registerBusinessRoutes(app, { config, db, security });
  await registerSchedulingRoutes(app, { config, db, security });
  await registerNotificationRoutes(app, { config, db, security });
  await registerReportRoutes(app, { config, db, security });
  await registerPaymentsRoutes(app, { config, db, security });
  await registerClosureRoutes(app, { config, db, security });
  await registerCustomerLinkRoutes(app, { config, db, security });
  await registerBarberInviteRoutes(app, { config, db, security });
  await registerMediaProfileRoutes(app, { config, db, security });
  await registerWhatsAppRoutes(app,{config,db,security});
  app.addHook('onClose', async () => {
    await db?.close();
    security.redis?.disconnect();
  });
  return app;
}
