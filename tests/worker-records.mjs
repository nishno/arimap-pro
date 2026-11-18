import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';
import {openFarm} from '../server/farm-store.mjs';import {documentStore} from '../server/documents.mjs';import {moduleAccess} from '../server/module-access.mjs';
test('personal LAN queries expose only trusted linked employee harvest and payroll even without accounting access',async()=>{
 const dir=mkdtempSync('/tmp/worker-records-'),store=openFarm(dir);
 try{
  await store.initialize({name:'Farm',timezone:'Asia/Tbilisi',ownerName:'Owner',ownerUsername:'owner',password:'test-owner-password'});
  const owner=(await store.login('owner','test-owner-password')).user,worker=await store.createWorker(owner,{name:'Worker',username:'worker',password:'test-worker-password'}),docs=documentStore(store),org=store.farm().id;
  moduleAccess(store).set(owner,{userId:worker.id,allowedModules:[]});
  docs.write(owner,{operations:[['employees/own',{userId:worker.id}],['employees/other',{userId:'someone'}],['transactions/paid',{employeeId:'own',debitAccountId:'acc-payroll',creditAccountId:'bank',amount:40}],['transactions/other-paid',{employeeId:'other',debitAccountId:'acc-payroll',amount:999}],['harvestEntries/picked',{employeeId:'own',netWeightKg:20}]].map(([path,data])=>({type:'set',path,data:{...data,organizationId:org}}))});
  const where=(field,value)=>({type:'where',field,op:'==',value});
  const constraints=[where('organizationId',org),where('employeeId','own'),where('debitAccountId','acc-payroll')];
  assert.equal(docs.read(worker,{path:'transactions',constraints}).documents[0].amount,40);
  assert.throws(()=>docs.read(worker,{path:'transactions'}),e=>e.status===403);
  assert.throws(()=>docs.read(worker,{path:'transactions',constraints:[where('organizationId',org),where('employeeId','other'),where('debitAccountId','acc-payroll')]}),e=>e.status===403);
  assert.equal(docs.read(worker,{path:'employees',constraints:[where('organizationId',org),where('userId',worker.id)]}).documents[0].id,'own');
  assert.equal(docs.read(worker,{path:'harvestEntries',constraints:constraints.slice(0,2)}).documents.length,1);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
