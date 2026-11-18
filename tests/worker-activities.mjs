import test from 'node:test';
import assert from 'node:assert/strict';
import {projectActivities,personalTasks,completedActivity} from '../src/worker/activities.ts';
test('personal projections are stable, tenant scoped, sanitized, updated and withdrawn without losing history',async()=>{
 const sources=[{id:'t1',organizationId:'farm-a',workName:'Pruning',date:'2026-11-18',status:'Completed',assignedEmployeeIds:['worker-a','worker-b'],employeeHours:[{employeeId:'worker-a',hours:5,totalPay:60},{employeeId:'worker-b',hours:8,totalPay:999}],privateNotes:'company secret'}, {id:'foreign',organizationId:'farm-b',assignedEmployeeIds:['worker-a']}];
 const first=await projectActivities('farm-a','Farm','task',sources);
 assert.equal(first.length,2);const own=first.find(row=>row.employeeId==='worker-a');
 assert.equal(own.hours,5);assert.equal(own.recordedPay,60);assert(completedActivity(own));
 assert(!JSON.stringify(own).includes('company secret'));assert(!JSON.stringify(own).includes('worker-b'));assert(!JSON.stringify(own).includes('999'));
 assert.deepEqual(await projectActivities('farm-a','Farm','task',sources),first);
 const next=await projectActivities('farm-a','Farm','task',[{...sources[0],assignedEmployeeIds:['worker-a'],employeeHours:[{employeeId:'worker-a',hours:6,totalPay:72}]}],first);
 const changed=next.find(row=>row.employeeId==='worker-a'),withdrawn=next.find(row=>row.employeeId==='worker-b');
 assert.equal(changed.id,own.id);assert.notEqual(changed.contentHash,own.contentHash);assert.equal(withdrawn.status,'withdrawn');assert.equal(withdrawn.recordedPay,999);
 assert.equal(personalTasks('worker-a',[],next).length,1);
 assert.equal(personalTasks('worker-a',[{id:'t1',employeeHours:[]}],next).length,1);
 const harvest=await projectActivities('farm-a','Farm','harvest',[{id:'h1',organizationId:'farm-a',name:'Blueberries',assignedPickers:[{employeeId:'worker-a',manualNetWeight:20,rate:2,paymentModel:'kg'}]}]);
 assert.equal(harvest[0].recordedQuantityKg,20);assert.equal(harvest[0].agreedRate,2);
});
