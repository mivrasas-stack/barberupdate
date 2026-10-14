import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyImage} from '../src/media-profile.js';

test('accepts valid JPEG signature',()=>{
 const file=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(20)]);
 assert.deepEqual(verifyImage(file),{ext:'jpg',mime:'image/jpeg'});
});
test('accepts valid PNG signature',()=>{
 const file=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]);
 assert.deepEqual(verifyImage(file),{ext:'png',mime:'image/png'});
});
test('accepts valid WebP signature',()=>{
 const file=Buffer.concat([Buffer.from('RIFF0000WEBP','ascii'),Buffer.alloc(20)]);
 assert.deepEqual(verifyImage(file),{ext:'webp',mime:'image/webp'});
});
test('rejects unsupported signatures and empty files',()=>{
 assert.throws(()=>verifyImage(Buffer.from('not an image format')));
 assert.throws(()=>verifyImage(Buffer.alloc(0)));
});
test('rejects images over 4MB',()=>{
 assert.throws(()=>verifyImage(Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(4_000_001)])));
});
