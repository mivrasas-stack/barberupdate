import { z } from 'zod';
import {failure,parseOrThrow} from './security.js';

const id=z.uuid();
export async function registerNotificationRoutes(app,{db,security}){
  const {authenticated,limited}=security;
  app.register(async routes=>{
    routes.addHook('preHandler',async req=>{
      await authenticated(req);
      await limited(req);
      if(!db) failure(503,'Base de datos no configurada');
    });
    routes.get('/api/v1/me/notifications',async req=>{
      const q=parseOrThrow(z.object({
        limit:z.coerce.number().int().min(1).max(100).default(30)
      }).strict(),req.query);
      const [items,count]=await Promise.all([
        db.query('SELECT id,tenant_id,category,reference_id,event_status,title,body,read_at,created_at FROM public.notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2',[req.actor.id,q.limit]),
        db.query('SELECT count(*)::int AS unread FROM public.notifications WHERE user_id=$1 AND read_at IS NULL',[req.actor.id])
      ]);
      return {unread:count.rows[0].unread,items:items.rows};
    });
    // Durable polling/catch-up when a Realtime socket reconnects or fails.
    // Opaque keyset cursor prevents missing messages that share a timestamp.
    routes.get('/api/v1/me/notifications/sync',async req=>{
      const q=parseOrThrow(z.object({
        cursor:z.string().min(1).max(200).optional(),
        limit:z.coerce.number().int().min(1).max(100).default(50)
      }).strict(),req.query);
      let afterTime=null,afterId=null;
      if(q.cursor){
        try{
          const raw=Buffer.from(q.cursor,'base64url').toString('utf8');
          if(Buffer.from(raw).toString('base64url')!==q.cursor)throw Error('Bad cursor encoding');
          const parsed=JSON.parse(raw);
          if(!Array.isArray(parsed)||parsed.length!==2||
            !z.iso.datetime({offset:true}).safeParse(parsed[0]).success||
            !id.safeParse(parsed[1]).success)throw Error('Invalid cursor data');
          afterTime=parsed[0];afterId=parsed[1];
        }catch{failure(400,'Cursor invalido');}
      }
      const rows=await db.query(
        "SELECT id,tenant_id,category,reference_id,event_status,title,body,read_at,created_at,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cursor_time FROM public.notifications WHERE user_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)>($2::timestamptz,$3::uuid)) ORDER BY created_at,id LIMIT $4",
        [req.actor.id,afterTime,afterId,q.limit]);
      const last=rows.rows.at(-1);
      const nextCursor=last?
        Buffer.from(JSON.stringify([last.cursor_time||new Date(last.created_at).toISOString(),last.id])).toString('base64url')
        :q.cursor||null;
      return {items:rows.rows.map(({cursor_time,...item})=>item),nextCursor,hasMore:rows.rows.length===q.limit};
    });
    routes.patch('/api/v1/me/notifications/:notificationId/read',async req=>{
      const notification=parseOrThrow(id,req.params.notificationId);
      const result=await db.query('UPDATE public.notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id,read_at',
        [notification,req.actor.id]);
      if(!result.rowCount) failure(404,'Notificacion no encontrada');
      return result.rows[0];
    });
    routes.patch('/api/v1/me/bookings/:appointmentId/cancel',async req=>{
      const appointment=parseOrThrow(id,req.params.appointmentId);
      return db.transaction(async tx=>{
        const {rows}=await tx.query('SELECT id,tenant_id,starts_at,status FROM public.appointments WHERE id=$1 AND customer_user_id=$2 FOR UPDATE',
          [appointment,req.actor.id]);
        if(!rows.length) failure(404,'Reserva no encontrada');
        if(!['pending','confirmed'].includes(rows[0].status)) failure(409,'Esta reserva ya no se puede cancelar');
        if(new Date(rows[0].starts_at).getTime()<Date.now()+2*3600000)
          failure(409,'Cancelaciones disponibles hasta 2 horas antes del servicio');
        return (await tx.query("UPDATE public.appointments SET status='cancelled',updated_at=now() WHERE id=$1 AND customer_user_id=$2 RETURNING id,tenant_id,status,starts_at",
          [appointment,req.actor.id])).rows[0];
      });
    });
  });
  app.get('/api/v1/public/tenants/:tenantId/barbers/:barberId/rating',async req=>{
    await limited(req);
    if(!db) failure(503,'Base de datos no configurada');
    const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId);
    const a=await db.query(
      "SELECT b.id,coalesce(round(avg(r.rating),2),0)::numeric AS average,count(r.id)::int AS reviews FROM public.barbers b JOIN public.tenants t ON t.id=b.tenant_id LEFT JOIN public.reviews r ON r.tenant_id=b.tenant_id AND r.barber_id=b.id WHERE b.tenant_id=$1 AND b.id=$2 AND b.status='active' AND t.status='active' GROUP BY b.id",
      [tenant,barber]);
    if(!a.rowCount) failure(404,'Barbero no disponible');
    return a.rows[0];
  });
}
