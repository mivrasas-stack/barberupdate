/**
 * Authenticated event-stream client. Native EventSource cannot attach the
 * Authorization header, so read the minimal SSE stream with fetch instead.
 * The events contain no customer information: each triggers a regular
 * permission-checked REST refresh. Timed sync remains a safety net.
 */
export function followLiveUpdates(
  url:string,
  getAccessToken:()=>Promise<string>,
  onInvalidate:()=>void,
  signal:AbortSignal,
  fetcher:typeof fetch=fetch
):void{
  const pause=(duration:number)=>new Promise<void>(resolve=>{
    if(signal.aborted){resolve();return;}
    const timer=setTimeout(()=>{signal.removeEventListener('abort',done);resolve();},duration);
    function done(){clearTimeout(timer);resolve();}
    signal.addEventListener('abort',done,{once:true});
  });
  const listen=async()=>{
    while(!signal.aborted){
      try{
        const jwt=await getAccessToken();
        if(signal.aborted)return;
        const response=await fetcher(url,{
          method:'GET',headers:{Authorization:'Bearer '+jwt,Accept:'text/event-stream'},
          signal,cache:'no-store'
        });
        if(!response.ok||!response.body)throw Error('Realtime stream is temporarily unavailable');
        const reader=response.body.getReader();
        const decoder=new TextDecoder();
        let buffered='';
        while(!signal.aborted){
          const {done,value}=await reader.read();
          if(done)break;
          buffered+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
          let index;
          while((index=buffered.indexOf('\n\n'))!==-1){
            const event=buffered.slice(0,index);
            buffered=buffered.slice(index+2);
            if(event.split('\n').some(row=>row.trim()==='event: changed'))onInvalidate();
          }
          // Prevent unbounded growth if a malformed proxy never sends separators.
          if(buffered.length>8192)buffered='';
        }
        try{await reader.cancel();}catch{}
      }catch{
        if(signal.aborted)return;
      }
      await pause(2500);
    }
  };
  void listen();
}