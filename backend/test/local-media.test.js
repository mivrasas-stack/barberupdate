import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {mkdtemp,rm} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import Fastify from 'fastify';
import {createLocalMedia,registerLocalMediaRoutes,validateLocalMediaPath} from '../src/local-media.js';

test('self-hosted media upload and public download preserve image bytes on owned disk',async()=>{
 const root=await mkdtemp(join(tmpdir(),'barbernow-media-'));
 const media=createLocalMedia({root,origin:'https://barbernow.example',signingKey:randomBytes(32).toString('base64')});
 const app=Fastify();
 try{
  await registerLocalMediaRoutes(app,{media,config:{mediaBucket:'barberos-images'}});
  const path=randomUUID()+'/portfolio/'+randomUUID()+'.jpg';
  const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70,0,1,7,9]);
  const bucket=media.storage.from('barberos-images');
  const upload=await bucket.upload(path,jpeg,{contentType:'image/jpeg'});
  assert.equal(upload.error,null);
  assert.equal(bucket.getPublicUrl(path).data.publicUrl,'https://barbernow.example/api/v1/media/barberos-images/'+path);
  const fetched=await app.inject({method:'GET',url:'/api/v1/media/barberos-images/'+path});
  assert.equal(fetched.statusCode,200,fetched.body);
  assert.equal(fetched.headers['content-type'],'image/jpeg');
  assert.deepEqual(fetched.rawPayload,jpeg);
  assert.match(fetched.headers['cache-control'],/immutable/);
  const duplicate=await bucket.upload(path,jpeg,{contentType:'image/jpeg'});
  assert.ok(duplicate.error,'Existing files are immutable');
  const unauthorized=await app.inject({method:'GET',url:'/api/v1/media/other/'+path});
  assert.equal(unauthorized.statusCode,404);
 }finally{await app.close();await rm(root,{recursive:true,force:true});}
});
test('signed media uploads reject tampered paths and signatures',async()=>{
 const root=await mkdtemp(join(tmpdir(),'barbernow-media-'));
 const media=createLocalMedia({root,origin:'https://barbernow.example',signingKey:randomBytes(32).toString('base64')});
 const app=Fastify();
 try{
  await registerLocalMediaRoutes(app,{media,config:{mediaBucket:'barberos-images'}});
  const path=randomUUID()+'/logo/'+randomUUID()+'.png';
  const image=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0]);
  const {data}=await media.storage.from('barberos-images').createSignedUploadUrl(path);
  const url=new URL(data.signedUrl);
  const upload=await app.inject({method:'PUT',url:url.pathname+url.search,
    headers:{'content-type':'image/png'},payload:image});
  assert.equal(upload.statusCode,201,upload.body);
  const copy=new URL(data.signedUrl);
  copy.searchParams.set('sig','0'.repeat(64));
  const bad=await app.inject({method:'PUT',url:copy.pathname+copy.search,
    headers:{'content-type':'image/png'},payload:image});
  assert.equal(bad.statusCode,403);
  assert.throws(()=>validateLocalMediaPath('../bad.png'));
  assert.throws(()=>validateLocalMediaPath('/absolute.jpg'));
  assert.throws(()=>validateLocalMediaPath(randomUUID()+'/logo/../../file.jpg'));
 }finally{await app.close();await rm(root,{recursive:true,force:true});}
});