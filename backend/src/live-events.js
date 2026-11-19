/**
 * Authenticated realtime invalidation channel.
 *
 * Events are deliberately data-free. The browser re-reads only the resources
 * its own token can access, so no tenant/customer data is published to Redis.
 * Redis Pub/Sub reaches both API replicas; periodic REST catch-up handles gaps.
 */
const CHANNEL='barbernow:live:invalidate';
const WRITE_METHODS=new Set(['POST','PUT','PATCH','DELETE']);

export async function registerLiveEventRoutes(app,{security}){
  const publisher=security.redis;
  let subscriber=null;
  const clients=new Set();
  let enabled=false;
  if(publisher){
    try{
      subscriber=publisher.duplicate({lazyConnect:true,maxRetriesPerRequest:1});
      subscriber.on('error',()=>{});
      await subscriber.connect();
      subscriber.on('message',(channel,message)=>{
        if(channel!==CHANNEL||message!=='changed')return;
        for(const response of [...clients]){
          try{response.write('event: changed\ndata: {}\n\n');}
          catch{clients.delete(response);}
        }
      });
      await subscriber.subscribe(CHANNEL);
      enabled=true;
    }catch(error){
      app.log.warn({error:error?.message},'realtime channel unavailable; browser will poll');
      try{subscriber?.disconnect();}catch{}
      subscriber=null;
    }
  }
  // Registered before all business routes: broadcasts only successful mutations.
  // Do not send passwords, request bodies, tenant IDs, phone numbers or tokens.
  app.addHook('onResponse',(request,reply,done)=>{
    if(enabled&&WRITE_METHODS.has(request.method)&&reply.statusCode>=200&&reply.statusCode<300&&
       request.url.startsWith('/api/v1/')&&!request.url.includes('/health/')){
      void publisher.publish(CHANNEL,'changed').catch(()=>{});
    }
    done();
  });
  app.get('/api/v1/live/events',async(request,reply)=>{
    await security.authenticated(request);
    await security.limited(request);
    if(!enabled)return reply.code(503).send({error:'Canal de actualizaciones temporalmente no disponible'});
    reply.hijack();
    const res=reply.raw;
    res.writeHead(200,{
      'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-cache, no-transform',
      'Connection':'keep-alive',
      'X-Accel-Buffering':'no',
      'X-Content-Type-Options':'nosniff'
    });
    clients.add(res);
    res.write(': connected\n\n');
    const heartbeat=setInterval(()=>{
      if(!res.writableEnded&&!res.destroyed){
        try{res.write(': heartbeat\n\n');}
        catch{cleanup();}
      }else cleanup();
    },20000);
    heartbeat.unref?.();
    const cleanup=()=>{
      clearInterval(heartbeat);
      clients.delete(res);
    };
    res.once('close',cleanup);
    res.once('error',cleanup);
  });
  app.addHook('onClose',async()=>{
    for(const res of clients){try{res.end();}catch{}}
    clients.clear();
    try{await subscriber?.quit();}catch{subscriber?.disconnect();}
  });
}