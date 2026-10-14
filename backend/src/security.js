import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

export class HttpProblem extends Error {
  constructor(statusCode, message) {
    super(message); this.statusCode = statusCode; this.name = 'HttpProblem';
  }
}
export const failure = (status, message) => { throw new HttpProblem(status, message); };
export function createSecurity(config) {
  const supabase = config.supabaseUrl && config.supabasePublishableKey
    ? createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  const service = config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  const redis = config.redisUrl ? new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 3000 }) : null;
  if (redis) redis.on('error', () => {}); // Health endpoint reports connectivity instead of crashing process.
  async function authenticated(request) {
    if (!supabase) failure(503, 'Supabase Auth no configurado');
    const header = request.headers.authorization || '';
    const token = /^Bearer (.+)$/i.exec(header)?.[1];
    if (!token) failure(401, 'Se requiere Bearer token');
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) failure(401, 'Sesion invalida');
    request.actor = { id: data.user.id, email: data.user.email || '' };
  }
  async function limited(request) {
    if (!redis) failure(503, 'Redis no configurado');
    const identity = request.actor?.id || request.ip;
    const minute = Math.floor(Date.now() / 60000);
    const key = 'barberos:ratelimit:' + identity + ':' + minute;
    let total;
    try {
      // Atomic increment and initial expiration (also works across API replicas).
      total = await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],90) end; return n", 1, key);
    } catch {
      failure(503, 'Rate limiting temporalmente indisponible');
    }
    if (Number(total) > config.rateLimit) failure(429, 'Demasiadas solicitudes');
  }
  async function requireTenant(db, tenantId, userId, roles) {
    if (!db) failure(503, 'Base de datos no configurada');
    const result = await db.query('SELECT m.role FROM public.tenant_members m JOIN public.tenants t ON t.id=m.tenant_id WHERE t.id=$1 AND t.status=$3 AND m.user_id=$2', [tenantId, userId, 'active']);
    if (!result.rowCount) failure(403, 'Sin acceso a esta empresa');
    if (roles && !roles.includes(result.rows[0].role)) failure(403, 'Permisos insuficientes');
    return result.rows[0].role;
  }
  return { supabase, service, redis, authenticated, limited, requireTenant };
}
export function parseOrThrow(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) failure(400, 'Datos invalidos: ' + result.error.issues.map(i => i.path.join('.') + ' ' + i.message).join('; '));
  return result.data;
}
export const uuid = () => randomUUID();
