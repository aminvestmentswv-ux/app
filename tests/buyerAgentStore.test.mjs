import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuyerAgentStore, decodeSavedAgent, encodeSavedAgent } from '../src/buyerAgentStore.ts';
import { createBuyerAgentFileStorage } from '../src/buyerAgentFileStorage.ts';
import { buyerAgentStorage, BUYER_AGENT_STORAGE_KEY } from '../src/buyerAgentStorage.ts';

const first = { name: 'Test agent', phone: '+13045550123' };
const second = { name: 'Other agent', phone: '+13045550124' };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
function memory(initial = null) {
  let value = initial;
  return { read: async () => value, write: async next => { value=next; }, remove: async () => { value=null; }, value: () => value };
}
test('saved contact uses bounded versioned schema and normalizes only intended fields', () => {
  assert.deepEqual(decodeSavedAgent('{"version":1,"name":" Test agent ","phone":"(304) 555-0123","extra":"ignored"}'), first);
  assert.deepEqual(JSON.parse(encodeSavedAgent(first)), {version:1, ...first});
  for (const bad of ['', 'null', '[]', '{}', '{"version":2,"name":"","phone":"3045550123"}', '{"version":1,"name":4,"phone":"3045550123"}', '{"version":1,"name":"","phone":"tel:3045550123"}', ' '.repeat(1025)]) assert.throws(() => decodeSavedAgent(bad));
});
test('save survives a new store and clear survives another restart', async () => {
  const storage = memory(), a=createBuyerAgentStore(storage);
  assert.equal(await a.update(first), false);
  await a.initialize();
  assert.equal(a.getSnapshot().ready, true);
  assert.equal(await a.update(first), true);
  const b=createBuyerAgentStore(storage); await b.initialize();
  assert.deepEqual(b.getSnapshot().agent, first);
  assert.equal(await b.update(null), true);
  const c=createBuyerAgentStore(storage); await c.initialize();
  assert.equal(c.getSnapshot().agent, null);
  assert.equal(storage.value(), null);
});
test('initialize is idempotent and updates cannot race a late read', async () => {
  const read=deferred(); let reads=0, writes=0;
  const store=createBuyerAgentStore({ read:()=>{reads++;return read.promise;}, write:async()=>{writes++;}, remove:async()=>{} });
  const p=store.initialize(); assert.equal(store.initialize(), p);
  assert.equal(await store.update(second), false);
  await Promise.resolve(); assert.equal(reads,1);
  read.resolve(encodeSavedAgent(first)); await p;
  assert.deepEqual(store.getSnapshot().agent,first); assert.equal(writes,0);
});
test('concurrent save, clear and invalid updates cannot overwrite an in-flight save', async () => {
  const write=deferred(), storage=memory(), store=createBuyerAgentStore({...storage,write:()=>write.promise});
  await store.initialize();
  const firstSave=store.update(first);
  assert.equal(store.getSnapshot().saving,true);
  assert.equal(await store.update(second),false);
  assert.equal(await store.update(null),false);
  write.resolve(); assert.equal(await firstSave,true);
  assert.deepEqual(store.getSnapshot().agent,first);
});
test('failed save retains the prior contact and allows retry without exposing exception data', async () => {
  const storage=memory(encodeSavedAgent(first)); let fail=true;
  const store=createBuyerAgentStore({...storage,write:async value=>{if(fail)throw new Error('PRIVATE');await storage.write(value);}});
  await store.initialize(); assert.equal(await store.update(second),false);
  assert.deepEqual(store.getSnapshot().agent,first);
  assert.equal(store.getSnapshot().saving,false); assert.doesNotMatch(store.getSnapshot().feedback,/PRIVATE/);
  fail=false; assert.equal(await store.update(second),true); assert.deepEqual(store.getSnapshot().agent,second);
});
test('failed clear retains visible contact and successful retry removes it', async () => {
  const storage=memory(encodeSavedAgent(first)); let fail=true;
  const store=createBuyerAgentStore({...storage,remove:async()=>{if(fail)throw new Error('PRIVATE');await storage.remove();}});
  await store.initialize(); assert.equal(await store.update(null),false);
  assert.deepEqual(store.getSnapshot().agent,first); assert.match(store.getSnapshot().feedback,/Could not clear/);
  fail=false; assert.equal(await store.update(null),true); assert.equal(store.getSnapshot().agent,null);
});
test('malformed or unreadable saved data is not displayed and can be explicitly replaced or cleared', async () => {
  for (const storage of [memory('corrupt'), { ...memory(), read:async()=>{throw new Error('PRIVATE');} }]) {
    const store=createBuyerAgentStore(storage); await store.initialize();
    assert.equal(store.getSnapshot().ready,true); assert.equal(store.getSnapshot().agent,null);
    assert.match(store.getSnapshot().feedback,/Could not read/);
    assert.doesNotMatch(store.getSnapshot().feedback,/PRIVATE|corrupt/);
    assert.equal(await store.update(first),true);
    assert.equal(await store.update(null),true);
  }
});
test('invalid updates never write or remove saved data', async () => {
  const storage=memory(encodeSavedAgent(first)), store=createBuyerAgentStore(storage);
  await store.initialize();
  assert.equal(await store.update({name:'',phone:'bad'}),false);
  assert.equal(storage.value(),encodeSavedAgent(first)); assert.deepEqual(store.getSnapshot().agent,first);
});
test('subscribers observe operation boundaries and can unsubscribe', async () => {
  const store=createBuyerAgentStore(memory()), states=[];
  const unsubscribe=store.subscribe(()=>states.push(store.getSnapshot()));
  await store.initialize(); await store.update(first);
  assert.deepEqual(states.map(s=>[s.ready,s.saving]),[[true,false],[true,true],[true,false]]);
  assert.notEqual(states[1],states[2]); unsubscribe(); await store.update(null); assert.equal(states.length,3);
});
test('web adapter persists and removes only its own key and propagates storage failures', async () => {
  const previous=globalThis.window, data=new Map([['unrelated','keep']]);
  globalThis.window={ localStorage:{getItem:key=>data.get(key)??null,setItem:(key,v)=>data.set(key,v),removeItem:key=>data.delete(key)} };
  try {
    assert.equal(await buyerAgentStorage.read(),null);
    await buyerAgentStorage.write(encodeSavedAgent(first));
    assert.equal(data.get(BUYER_AGENT_STORAGE_KEY),encodeSavedAgent(first));
    assert.equal(await buyerAgentStorage.read(),encodeSavedAgent(first));
    await buyerAgentStorage.remove(); assert.equal(data.get('unrelated'),'keep');
    globalThis.window={ get localStorage(){throw new Error('blocked');} };
    await assert.rejects(buyerAgentStorage.read()); await assert.rejects(buyerAgentStorage.write('x')); await assert.rejects(buyerAgentStorage.remove());
  } finally { if(previous===undefined)delete globalThis.window;else globalThis.window=previous; }
});
function fakeFiles() {
  const data=new Map(), calls=[], hooks={};
  function file(name) { return {
    get exists(){return data.has(name);},
    get size(){return Buffer.byteLength(data.get(name)??'');},
    text:async()=>{calls.push('read '+name);if(hooks.read)await hooks.read(name);return data.get(name);},
    write:async value=>{calls.push('write '+name);if(hooks.write)return hooks.write(name,value);data.set(name,value);},
    delete:()=>{calls.push('delete '+name);if(hooks.delete)return hooks.delete(name);data.delete(name);}
  }; }
  return {data,calls,hooks,slots:()=>[file('a'),file('b')]};
}
const journal = (revision,value) => JSON.stringify({version:1,revision,value});
test('native slots save, edit to shorter data, restart, clear and repeat without move/rename', async () => {
  const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
  assert.equal(await storage.read(),null);
  await storage.write(encodeSavedAgent(first)); await storage.write(encodeSavedAgent(second));
  await storage.write(encodeSavedAgent({...first,name:''}));
  assert.equal(await createBuyerAgentFileStorage(files).read(),encodeSavedAgent({...first,name:''}));
  assert.equal(files.data.size,2);
  await storage.remove(); assert.equal(files.data.size,0); assert.equal(await storage.read(),null);
  await storage.remove(); await storage.write(encodeSavedAgent(first));
  assert.equal(await storage.read(),encodeSavedAgent(first));
});
test('partial inactive-slot overwrite preserves active contact across restart', async () => {
  const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
  await storage.write(encodeSavedAgent(first)); await storage.write(encodeSavedAgent(second));
  files.hooks.write=async(name,value)=>{files.data.set(name,value.slice(0,17));throw new Error('interrupted');};
  await assert.rejects(storage.write(encodeSavedAgent(first)));
  assert.equal(await createBuyerAgentFileStorage(files).read(),encodeSavedAgent(second));
});
test('write rejection after complete bytes counts as verified completion', async () => {
  const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
  await storage.write(encodeSavedAgent(first));
  files.hooks.write=async(name,value)=>{files.data.set(name,value);throw new Error('uncertain');};
  await storage.write(encodeSavedAgent(second));
  assert.equal(await createBuyerAgentFileStorage(files).read(),encodeSavedAgent(second));
});
test('verification read failure preserves prior slot and does not remove a possibly completed write', async () => {
  const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
  await storage.write(encodeSavedAgent(first));
  files.hooks.write=async(name,value)=>{files.data.set(name,value);files.hooks.read=async target=>{if(target===name)throw new Error('unreadable');};};
  await assert.rejects(storage.write(encodeSavedAgent(second)));
  assert.equal(files.data.get('a'),journal(1,encodeSavedAgent(first)));
  assert.equal(files.data.size,2);
  await assert.rejects(storage.read());
  delete files.hooks.read;
  assert.equal(await storage.read(),encodeSavedAgent(second));
});
test('native write is awaited before verification and completion', async () => {
  const files=fakeFiles(), write=deferred(), storage=createBuyerAgentFileStorage(files); let completed=false;
  files.hooks.write=async(name,value)=>{await write.promise;files.data.set(name,value);};
  const saving=storage.write(encodeSavedAgent(first)).then(()=>{completed=true;});
  await new Promise(resolve=>setImmediate(resolve)); assert.equal(completed,false); assert.equal(files.data.size,0);
  write.resolve(); await saving; assert.equal(completed,true);
});
test('highest valid journal wins; malformed inactive data can be replaced but never treated as a contact', async () => {
  const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
  files.data.set('a',journal(5,encodeSavedAgent(first)));
  files.data.set('b',journal(3,encodeSavedAgent(second)));
  assert.equal(await storage.read(),encodeSavedAgent(first));
  for(const invalid of ['partial',journal(7,'bad'),journal(-1,encodeSavedAgent(second)),journal(1.5,null),JSON.stringify({version:2,revision:8,value:null}),'x'.repeat(4097)]) {
    files.data.set('b',invalid); assert.equal(await storage.read(),encodeSavedAgent(first));
  }
  await storage.write(encodeSavedAgent(second));
  assert.equal(await storage.read(),encodeSavedAgent(second));
});
test('neither malformed contact nor all-corrupt slots silently become an empty successful read', async () => {
  const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
  files.data.set('a',journal(1,'{"version":1,"name":"","phone":"bad"}'));
  await assert.rejects(storage.read());
  await storage.write(encodeSavedAgent(first)); assert.equal(await storage.read(),encodeSavedAgent(first));
  files.data.set('a','bad'); files.data.set('b','bad'); await storage.remove(); assert.equal(files.data.size,0);
});
test('unreadable slot blocks reads, edits and clears even when the other slot is valid', async () => {
  for(const unreadable of ['a','b']) {
    const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
    files.data.set('a',journal(1,encodeSavedAgent(first))); files.data.set('b',journal(2,null));
    const original=[...files.data];
    files.hooks.read=async name=>{if(name===unreadable)throw new Error('unreadable');};
    await assert.rejects(storage.read()); await assert.rejects(storage.write(encodeSavedAgent(second))); await assert.rejects(storage.remove());
    assert.deepEqual([...files.data],original);
  }
});
test('conflicting equal revisions and revision overflow fail before writes; matching duplicates are readable', async () => {
  const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
  files.data.set('a',journal(4,encodeSavedAgent(first))); files.data.set('b',journal(4,encodeSavedAgent(second)));
  await assert.rejects(storage.read()); await assert.rejects(storage.write(encodeSavedAgent(first)));
  files.data.set('b',files.data.get('a')); assert.equal(await storage.read(),encodeSavedAgent(first));
  files.data.clear(); files.data.set('a',journal(Number.MAX_SAFE_INTEGER,encodeSavedAgent(first)));
  await assert.rejects(storage.write(encodeSavedAgent(second))); assert.equal(files.data.size,1);
});
test('failed tombstone write preserves the prior contact, with no deletion', async () => {
  const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
  await storage.write(encodeSavedAgent(first)); files.calls.length=0;
  files.hooks.write=async(name,value)=>{files.data.set(name,value.slice(0,15));throw new Error('interrupted');};
  await assert.rejects(storage.remove());
  assert.equal(await createBuyerAgentFileStorage(files).read(),encodeSavedAgent(first));
  assert.equal(files.calls.some(call=>call.startsWith('delete')),false);
});
test('failed or ineffective old-slot deletion retains tombstone and prevents resurrection', async () => {
  for(const throws of [true,false]) {
    const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
    await storage.write(encodeSavedAgent(first));
    files.hooks.delete=name=>{if(name==='a'){if(throws)throw new Error('blocked');return;}files.data.delete(name);};
    await assert.rejects(storage.remove());
    assert.equal(files.data.size,2); assert.equal(await createBuyerAgentFileStorage(files).read(),null);
    delete files.hooks.delete; await storage.remove(); assert.equal(files.data.size,0);
  }
});
test('interrupted tombstone deletion leaves logical clear in force and reports incomplete cleanup', async () => {
  for(const throws of [true,false]) {
    const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
    await storage.write(encodeSavedAgent(first));
    files.hooks.delete=name=>{if(name==='b'){if(throws)throw new Error('blocked');return;}files.data.delete(name);};
    await assert.rejects(storage.remove()); assert.equal(files.data.has('a'),false);
    assert.equal(await createBuyerAgentFileStorage(files).read(),null);
    delete files.hooks.delete; await storage.remove(); assert.equal(files.data.size,0);
    await storage.write(encodeSavedAgent(second)); assert.equal(await storage.read(),encodeSavedAgent(second));
  }
});
test('corrupt-slot cleanup tries both deletions and detects ineffective deletion', async () => {
  const files=fakeFiles(), storage=createBuyerAgentFileStorage(files);
  files.data.set('a','bad');files.data.set('b','bad');
  files.hooks.delete=name=>{if(name==='a')throw new Error('blocked');files.data.delete(name);};
  await assert.rejects(storage.remove());assert.equal(files.data.has('a'),true);assert.equal(files.data.has('b'),false);
});
