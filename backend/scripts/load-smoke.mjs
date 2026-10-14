// Bounded local smoke test. Does not assert production scalability.
// Max 450 requests and 12 concurrent clients to avoid overwhelming Free databases.
import { performance } from 'node:perf_hooks';
const base='http://127.0.0.1:8188';
const samples=[];
const statuses=new Map();
async function batch(path,count,concurrency) {
  let next=0;
  const start=performance.now();
  async function worker(){
    while(next<count){
      next++;
      const began=performance.now();
      try{
        const r=await fetch(base+path,{signal:AbortSignal.timeout(8000)});
        statuses.set(r.status,(statuses.get(r.status)||0)+1);
        await r.arrayBuffer();
      }catch(e){
        statuses.set('NETWORK_ERROR',(statuses.get('NETWORK_ERROR')||0)+1);
      }
      samples.push(performance.now()-began);
    }
  }
  await Promise.all(Array.from({length:concurrency},()=>worker()));
  return (count*1000/(performance.now()-start)).toFixed(1);
}
const liveRps=await batch('/api/v1/health/live',400,12);
const catalogRps=await batch('/api/v1/public/plans',50,6);
const sorted=samples.slice().sort((a,b)=>a-b);
const percentile=n=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*n)-1)].toFixed(1);
console.log('REQUESTS='+samples.length);
console.log('HTTP_STATUS_COUNTS='+JSON.stringify(Object.fromEntries(statuses)));
console.log('HEALTH_RPS_LOCAL='+liveRps);
console.log('CATALOG_RPS_LOCAL='+catalogRps);
console.log('COMBINED_P50_MS='+percentile(.5));
console.log('COMBINED_P95_MS='+percentile(.95));
console.log('COMBINED_P99_MS='+percentile(.99));
console.log('SCOPE=LOCAL_SMOKE_ONLY_NOT_PRODUCTION_LOAD_CERTIFICATION');
if((statuses.get('NETWORK_ERROR')||0)>0||(statuses.get(500)||0)>0||(statuses.get(502)||0)>0)
  process.exitCode=1;
