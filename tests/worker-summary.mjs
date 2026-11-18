import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeWorker} from '../src/worker/summary.ts';
test('personal work uses employee identity and payroll ledger, excludes other workers and voided data, and separates currencies',()=>{
 const summary=summarizeWorker('employee-a',[
  {id:'h1',employeeId:'employee-a',netWeightKg:12.5}, {id:'h2',employeeId:'employee-a',netWeightKg:7.5},
  {id:'void',employeeId:'employee-a',netWeightKg:100,isDeleted:true},{id:'foreign',employeeId:'employee-b',netWeightKg:1000}
 ],[
  {id:'accrual',employeeId:'employee-a',creditAccountId:'acc-payroll',debitAccountId:'labor',amount:120,currency:'GEL'},
  {id:'payment',employeeId:'employee-a',debitAccountId:'acc-payroll',creditAccountId:'bank',amount:40,currency:'GEL'},
  {id:'other',employeeId:'employee-b',debitAccountId:'acc-payroll',amount:9999,currency:'GEL'},
  {id:'void',employeeId:'employee-a',debitAccountId:'acc-payroll',amount:50,isVoided:true,currency:'GEL'},
  {id:'usd',employeeId:'employee-a',creditAccountId:'acc-payroll',amount:10,currency:'USD'},
  {id:'expense',employeeId:'employee-a',creditAccountId:'bank',debitAccountId:'fuel',amount:500}
 ],[{id:'task1',workName:'Pruning',employeeHours:[{employeeId:'employee-a',hours:5.5},{employeeId:'employee-b',hours:99}]}]);
 assert.equal(summary.pickedKg,20);assert.equal(summary.hours,5.5);assert.deepEqual(summary.balances.GEL,{accrued:120,paid:40,balance:80});assert.deepEqual(summary.balances.USD,{accrued:10,paid:0,balance:10});assert.equal(summary.payroll.length,3);
});

test('legacy employer roles restore only their explicit operational permissions, never platform admin',async()=>{
 const {legacyEmployeeModules,membershipRoleForEmployee}=await import('../src/access/moduleGrants.ts');
 assert.deepEqual(legacyEmployeeModules({visibleModules:[]},{permissions:['access_harvesting','edit_work','access_system','admin_access','edit_roles']}),['harvesting','tasks','system']);
 assert.deepEqual(legacyEmployeeModules({visibleModules:['Harvest']},{permissions:['access_accounting']}),['harvesting']);
 assert.equal(membershipRoleForEmployee('Weigher'),'Employee');
});
