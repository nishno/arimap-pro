import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {openFarm} from '../server/farm-store.mjs';
import {documentStore} from '../server/documents.mjs';
import {moduleAccess,MODULES} from '../server/module-access.mjs';
import {GRANTABLE_MODULES,normalizeModuleGrants} from '../src/access/moduleGrants.ts';
test('LAN explicit module grants persist, revoke, and enforce collection writes without privilege escalation',async()=>{
 assert.deepEqual(MODULES,[...GRANTABLE_MODULES]);assert.deepEqual(normalizeModuleGrants(['Harvest','Store','Admin','Planning','admin','Store']),['harvesting','stock','system','tasks']);
 const directory=mkdtempSync('/tmp/agrimap-module-grants-');let store=openFarm(directory);
 try{
  await store.initialize({name:'Granted farm',timezone:'Asia/Tbilisi',ownerName:'Owner',ownerUsername:'owner',password:'test-owner-password'});
  const owner=(await store.login('owner','test-owner-password')).user;
  const worker=await store.createWorker(owner,{name:'Worker',username:'worker',password:'test-worker-password'});
  let docs=documentStore(store),access=moduleAccess(store);
  assert.throws(()=>access.set(worker,{userId:worker.id,allowedModules:['stock']}),e=>e.status===403);
  assert.throws(()=>access.set(owner,{userId:worker.id,allowedModules:['admin']}),e=>e.status===400);
  access.set(owner,{userId:worker.id,allowedModules:['stock']});
  assert.deepEqual(docs.read(worker,{path:'memberships'}).documents[0].allowedModules,['stock']);
  docs.write(worker,{operations:[{type:'set',path:'inventoryItems/item1',data:{organizationId:store.farm().id,name:'Crates',currentStock:20}}]});
  assert.equal(docs.read(worker,{path:'inventoryItems'}).documents.length,1);
  for(const path of ['transactions','harvestEntries','employees'])assert.throws(()=>docs.read(worker,{path}),e=>e.status===403);
  assert.throws(()=>docs.write(worker,{operations:[{type:'set',path:'memberships/forged',data:{role:'Founder'}}]}),e=>e.status===403);
  store.close();store=openFarm(directory);docs=documentStore(store);access=moduleAccess(store);
  assert.deepEqual(access.get(worker.id),['stock']);
  access.set(owner,{userId:worker.id,allowedModules:[]});
  assert.throws(()=>docs.read(worker,{path:'inventoryItems'}),e=>e.status===403);
  assert.deepEqual(docs.read(worker,{path:'memberships'}).documents[0].allowedModules,[]);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('delegated harvest operator can stage work but cannot review, and revocation is enforced immediately',async()=>{
 const {weighTerminal}=await import('../server/weigh-terminal.mjs');
 const directory=mkdtempSync('/tmp/agrimap-operator-grants-');const store=openFarm(directory);
 try{
  await store.initialize({name:'Operator farm',timezone:'Asia/Tbilisi',ownerName:'Owner',ownerUsername:'owner',password:'test-owner-password'});
  const owner=(await store.login('owner','test-owner-password')).user;
  const worker=await store.createWorker(owner,{name:'Worker',username:'worker',password:'test-worker-password'});
  const docs=documentStore(store),access=moduleAccess(store),terminal=weighTerminal(store);
  docs.write(owner,{operations:[{type:'set',path:'harvestEvents/event1',data:{organizationId:store.farm().id,name:'Harvest',status:'active'}},{type:'set',path:'employees/employee1',data:{organizationId:store.farm().id,name:'Picker',status:'active'}}]});
  assert.throws(()=>terminal.bootstrap(worker),e=>e.status===403);
  access.set(owner,{userId:worker.id,allowedModules:['harvesting']});
  assert.equal(terminal.bootstrap(worker).canReview,false);
  const result=terminal.submit(worker,{schemaVersion:1,actorId:worker.id,operationId:'operator-operation',organizationId:store.farm().id,eventId:'event1',workerId:'employee1',deviceId:'tablet',boxQrId:'crate1',grossKg:5,tareKg:.3,capturedAt:new Date().toISOString()});
  assert.equal(result.record.actorId,worker.id);
  assert.throws(()=>terminal.review(worker,{operationId:'operator-operation',expectedActorId:worker.id,expectedRevision:1,decision:'confirm',reason:'Checked physical crate'}),e=>e.status===403);
  access.set(owner,{userId:worker.id,allowedModules:[]});
  assert.throws(()=>terminal.changes(worker,0),e=>e.status===403);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
