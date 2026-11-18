import {changeWatch, WatchError, type Store} from './service.ts';
const ORIGIN='https://app.aminvestmentswv.com';
export const WATCH_API_ENABLED=false;
/** Candidate transport boundary only. No deployed endpoint or credential adapter. */
export async function handleWatch(request: Request, store: Store, enabled=WATCH_API_ENABLED): Promise<Response> {
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin'};
  const reply=(status:number, value:unknown)=>new Response(JSON.stringify(value),{status,headers});
  if(request.headers.get('Origin')!==ORIGIN)return reply(403,{error:'Origin not allowed'});
  if(!enabled)return reply(503,{error:'Property watch is not available yet'});
  if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
  if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')return reply(415,{error:'JSON required'});
  const match=/^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(request.headers.get('Authorization')||'');
  if(!match)return reply(401,{error:'Unauthorized'});
  let reader: ReadableStreamDefaultReader<Uint8Array>|undefined;
  try {
    reader=request.body?.getReader(); if(!reader)return reply(400,{error:'Invalid request'});
    const chunks:Uint8Array[]=[];let length=0;
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;
      if(length>4096){await reader.cancel();return reply(413,{error:'Request too large'});}chunks.push(value);}
    const body=new Uint8Array(length);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
    let input:unknown;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{return reply(400,{error:'Invalid JSON'});}
    return reply(200,await changeWatch(store,match[1],input,Date.now()));
  }catch(error){
    return reply(error instanceof WatchError ? error.status:503,{error:error instanceof WatchError?error.message:'Temporarily unavailable'});
  }finally{reader?.releaseLock();}
}
