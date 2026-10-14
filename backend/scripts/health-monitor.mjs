// One-shot readiness probe for scheduled supervision. No credentials or PII.
// Supports localhost HTTP for development and HTTPS for a future deployment.
// A non-zero exit code lets an external scheduler/monitor send alerts.
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';

export function validateMonitorBase(raw='http://127.0.0.1:8188'){
  const url=new URL(raw);
  if(url.username||url.password||url.search||url.hash) throw new Error('Monitor URL must not contain credentials or query parameters');
  if(url.pathname!=='/' && url.pathname!=='') throw new Error('Monitor URL must be an origin, not an endpoint');
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(!(url.protocol==='https:' || (url.protocol==='http:'&&local)))
    throw new Error('Remote monitoring requires HTTPS');
  return url.origin;
}

export async function probeBarberOS({
  base='http://127.0.0.1:8188',
  fetchImpl=fetch,
  timeoutMs=7000
}={}){
  const origin=validateMonitorBase(base);
  const checks=[];
  for(const [name,path,healthy] of [
    ['readiness','/api/v1/health/ready',body=>body?.status==='ready'],
    ['catalog','/api/v1/public/plans',body=>Array.isArray(body)&&body.length>=1],
    ['payment_capabilities','/api/v1/public/payment-capabilities',
      body=>body?.onlinePayments?.enabled===false &&
      body?.platformBilling?.providerSelected==='wompi' &&
      body?.platformBilling?.enabled===false]
  ]){
    const start=performance.now();
    try{
      const response=await fetchImpl(origin+path,{signal:AbortSignal.timeout(timeoutMs)});
      const body=await response.json().catch(()=>null);
      const ok=response.status===200&&Boolean(healthy(body));
      checks.push({name,ok,httpStatus:response.status,
        latencyMs:Math.round((performance.now()-start)*10)/10});
    }catch(e){
      checks.push({name,ok:false,httpStatus:null,errorType:e.name||'NetworkError',
        latencyMs:Math.round((performance.now()-start)*10)/10});
    }
  }
  return {service:'barberos-backend',healthy:checks.every(c=>c.ok),
    checkedAt:new Date().toISOString(),checks};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await probeBarberOS({base:process.env.HEALTH_BASE_URL||'http://127.0.0.1:8188'});
  console.log(JSON.stringify(result));
  if(!result.healthy)process.exitCode=1;
}
