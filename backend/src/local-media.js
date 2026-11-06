import {createReadStream} from 'node:fs';
import {mkdir,stat,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {createHmac,timingSafeEqual} from 'node:crypto';

const pathRegex=/^(?:avatars\/[0-9a-f-]{36}|[0-9a-f-]{36}\/(?:shop|barber|products|logo|cover|portfolio|service|product))\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;
const mimeByExt={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
const sizeLimit=4_000_000;
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});

export function validateLocalMediaPath(path){
 if(typeof path!=='string'||!pathRegex.test(path)||path.includes('..')||path.includes('\\')||path.startsWith('/'))
   throw fail(400,'Ruta de imagen inválida');
 return path;
}
export function createLocalMedia({root,origin,signingKey}){
 if(!root||!origin||!signingKey)throw Error('MEDIA_ROOT, MEDIA_PUBLIC_ORIGIN and MEDIA_SIGNING_KEY are required');
 const secret=Buffer.from(signingKey,'base64');
 if(secret.length!==32)throw Error('MEDIA_SIGNING_KEY must be 32 random base64 bytes');
 const base=resolve(root);
 const urlOrigin=new URL(origin);
 if(urlOrigin.protocol!=='https:')throw Error('Image URL must use HTTPS');
 const safeFile=path=>join(base,validateLocalMediaPath(path));
 const publicUrl=(bucket,path)=>urlOrigin.origin+'/api/v1/media/'+encodeURIComponent(bucket)+'/'+path;
 async function upload(path,bytes,{contentType}={}){
  validateLocalMediaPath(path);
  if(!Buffer.isBuffer(bytes)||bytes.length<12||bytes.length>sizeLimit)
   throw fail(400,'Imagen de tamaño inválido');
  const extension=path.slice(path.lastIndexOf('.')+1);
  const expected=mimeByExt[extension];
  if(contentType&&contentType!==expected)throw fail(400,'Tipo de imagen incorrecto');
  const valid=expected==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255 ||
    expected==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
    expected==='image/webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid)throw fail(400,'El contenido no corresponde a la extensión de imagen');
  const full=safeFile(path);
  await mkdir(dirname(full),{recursive:true,mode:0o750});
  await writeFile(full,bytes,{flag:'wx',mode:0o640});
  return {path};
 }
 async function read(path){
  const full=safeFile(path);
  const info=await stat(full);
  if(!info.isFile()||info.size>sizeLimit)throw fail(404,'Imagen no disponible');
  return {stream:createReadStream(full),mime:mimeByExt[path.slice(path.lastIndexOf('.')+1)],size:info.size};
 }
 const signature=(bucket,path,expires)=>createHmac('sha256',secret)
   .update(bucket+'\n'+path+'\n'+expires).digest('hex');
 function signedUpload(bucket,path){
  validateLocalMediaPath(path);
  const expires=Date.now()+5*60*1000;
  const sig=signature(bucket,path,expires);
  return {signedUrl:urlOrigin.origin+'/api/v1/media/upload/'+encodeURIComponent(bucket)+'/'+path+'?expires='+expires+'&sig='+sig,token:sig};
 }
 function checkSigned(bucket,path,expires,sig){
  validateLocalMediaPath(path);
  const expiry=Number(expires);
  if(!Number.isSafeInteger(expiry)||expiry<Date.now()||expiry>Date.now()+5*60*1000)
   throw fail(403,'Firma caducada');
  if(typeof sig!=='string'||!(/^[a-f0-9]{64}$/.test(sig)))
   throw fail(403,'Firma inválida');
  if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(bucket,path,expiry),'hex')))
   throw fail(403,'Firma inválida');
 }
 function from(bucket){
  if(bucket!=='barberos-images')throw fail(400,'Bucket no permitido');
  return {
   upload:async(path,bytes,opts)=>{
    try{return {data:await upload(path,bytes,opts),error:null};}
    catch(error){return {data:null,error};}
   },
   getPublicUrl:path=>({data:{publicUrl:publicUrl(bucket,validateLocalMediaPath(path))}}),
   createSignedUploadUrl:async(path)=>{
    try{return {data:signedUpload(bucket,path),error:null};}
    catch(error){return {data:null,error};}
   },
  };
 }
 return {storage:{from},read,upload,checkSigned,publicUrl};
}

export async function registerLocalMediaRoutes(app,{media,config}){
 if(!media)return;
 app.get('/api/v1/media/:bucket/*',async(req,reply)=>{
  const bucket=String(req.params.bucket||''),path=String(req.params['*']||'');
  if(bucket!==config.mediaBucket)throw fail(404,'Imagen no disponible');
  try{
   const asset=await media.read(path);
   return reply.header('Cache-Control','public,max-age=31536000,immutable')
    .header('X-Content-Type-Options','nosniff')
    .header('Content-Length',asset.size)
    .type(asset.mime).send(asset.stream);
  }catch(e){if(e.code==='ENOENT')throw fail(404,'Imagen no disponible');throw e;}
 });
 app.addContentTypeParser(/^image\/(?:jpeg|png|webp)$/, {parseAs:'buffer',bodyLimit:4_000_000},(_req,body,done)=>done(null,body));
 app.put('/api/v1/media/upload/:bucket/*',{bodyLimit:4_000_000},async(req,reply)=>{
  const bucket=String(req.params.bucket||''),path=String(req.params['*']||'');
  if(bucket!==config.mediaBucket)throw fail(404,'Imagen no disponible');
  media.checkSigned(bucket,path,req.query.expires,req.query.sig);
  const result=await media.upload(path,req.body,{contentType:req.headers['content-type']});
  return reply.code(201).send(result);
 });
}

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]