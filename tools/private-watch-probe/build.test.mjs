import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {bundleOptions} from './bundle-options.mjs';import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
test('production bundler resolves Cloudflare constructor without accessing network or secrets',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'am-watch-construct-'));
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{
 Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Cloudflare-Workers'},configurable:true});
 const source="import pg from 'pg'; export const make=()=>new pg.Client({password:'FAKE-NONSECRET',ssl:{rejectUnauthorized:true}});";
 const result=await build({...bundleOptions,stdin:{contents:source,resolveDir:process.cwd()},write:false});
 const code=result.outputFiles[0].text;assert(!code.includes('pg-cloudflare/dist/empty.js'));assert(code.includes('cloudflare:sockets'));
 const file=join(dir,'client.mjs');await writeFile(file,code);
 const m=await import(pathToFileURL(file));const client=m.make();
 assert.equal(client.connection.stream.constructor.name,'CloudflareSocket');
 // No connect(), query() or end() is called: construction is fully offline.
 assert.equal(client._connecting,false);
 }finally{
 if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;
 await rm(dir,{recursive:true,force:true});
 }
});
test('actual production build uses shared reviewed runtime conditions',async()=>{
 const source=await readFile('build.mjs','utf8');assert(source.includes("import {bundleOptions} from './bundle-options.mjs'"));assert(source.includes('build({...bundleOptions,'));
 assert.deepEqual(bundleOptions.conditions,['workerd']);
 assert(bundleOptions.external.includes('cloudflare:sockets'));
});
