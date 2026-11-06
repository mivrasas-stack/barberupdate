import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { failure, parseOrThrow } from './security.js';

const requiredText = max => z.string().trim().min(2).max(max);
const payload = z.object({
  ownerName: requiredText(120),
  phone: z.string().trim().min(8).max(40),
  shopName: requiredText(120),
  city: requiredText(120),
  address: z.string().trim().max(300).default(''),
}).strict();

const makeSlug = value => value.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '').slice(0,58).replace(/-$/g, '') || 'barberia';

/** Every public signup creates an OWNED barbershop, not an independent barber.
 * A barber profile is intentionally NOT created: the owner adds staff separately.
 * Identity is derived from a verified BarberNow session, never request JSON.
 */
export async function registerOwnerOnboardingRoutes(app, {db,security}) {
  app.register(async routes => {
    routes.addHook('preHandler', async request => {
      await security.authenticated(request);
      await security.limited(request);
      if (!db) failure(503,'Base de datos no configurada');
    });
    routes.post('/api/v1/owner-onboarding', async (request,reply) => {
      const x = parseOrThrow(payload,request.body);
      const userId = request.actor.id;
      const result = await db.transaction(async tx => {
        // A per-identity advisory transaction lock makes retries concurrency-safe.
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['owner-onboarding:'+userId]);
        const existing = await tx.query(
          "SELECT * FROM public.tenants WHERE owner_user_id=$1 AND status='active' ORDER BY created_at LIMIT 1",[userId]);
        if(existing.rowCount){
          const tenant=existing.rows[0];
          await tx.query(
            "INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,'owner') "+
            "ON CONFLICT(tenant_id,user_id) DO UPDATE SET role='owner'",[tenant.id,userId]);
          return {tenant,created:false};
        }
        const slug=makeSlug(x.shopName)+'-'+randomUUID().slice(0,12);
        const created=await tx.query(
          "INSERT INTO public.tenants(name,slug,owner_user_id,currency,time_zone,business_kind,city,address,phone,email) "+
          "VALUES($1,$2,$3,'COP','America/Bogota','barbershop',$4,$5,$6,$7) RETURNING *",
          [x.shopName,slug,userId,x.city,x.address,x.phone,request.actor.email||'']);
        const tenant=created.rows[0];
        await tx.query("INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,'owner')",
          [tenant.id,userId]);
        return {tenant,created:true};
      });
      return reply.code(result.created?201:200).send({
        tenantId:result.tenant.id,slug:result.tenant.slug,role:'owner',created:result.created,
      });
    });
  });
}

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]