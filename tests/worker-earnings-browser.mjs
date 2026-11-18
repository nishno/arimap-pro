import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';
import {createLocalServer} from '../server/local-server.mjs';import {documentStore} from '../server/documents.mjs';
const dir=mkdtempSync('/tmp/worker-earnings-browser-'),origin='http://127.0.0.1:3191';const {server,store}=createLocalServer({directory:dir,origin});
await store.initialize({name:'Worker records farm',timezone:'Asia/Tbilisi',ownerName:'Owner',ownerUsername:'owner',password:'test-owner-password'});
const owner=(await store.login('owner','test-owner-password')).user,worker=await store.createWorker(owner,{name:'Linked worker',username:'worker',password:'test-worker-password'}),org=store.farm().id,docs=documentStore(store);
docs.write(owner,{operations:[
 ['employees/hr-linked',{userId:worker.id,name:'Linked worker',status:'active',visibleModules:['Harvest','Planning']}],
 ['employees/hr-other',{userId:'other-user',name:'Other worker',status:'active'}],
 ['harvestEntries/h1',{employeeId:'hr-linked',netWeightKg:12.5,harvestEventId:'event1',scannedAt:'2026-11-18T10:00:00Z'}],
 ['harvestEntries/h2',{employeeId:'hr-linked',netWeightKg:7.5,harvestEventId:'event1',scannedAt:'2026-11-18T11:00:00Z'}],
 ['harvestEntries/h-other',{employeeId:'hr-other',netWeightKg:9999}],
 ['transactions/accrual',{employeeId:'hr-linked',creditAccountId:'acc-payroll',debitAccountId:'labor',amount:120,date:'2026-11-18',description:'Harvest accrued',currency:'GEL'}],
 ['transactions/paid',{employeeId:'hr-linked',debitAccountId:'acc-payroll',creditAccountId:'bank',amount:40,date:'2026-11-18',description:'Harvest payment',currency:'GEL'}],
 ['transactions/other-paid',{employeeId:'hr-other',debitAccountId:'acc-payroll',amount:9999,date:'2026-11-18'}],
 ['workAssignments/task1',{workName:'Pruning',date:'2026-11-18',status:'Completed',assignedEmployeeIds:['hr-linked','hr-other'],employeeHours:[{employeeId:'hr-linked',hours:5.5},{employeeId:'hr-other',hours:99}]}]
].map(([path,data])=>({type:'set',path,data:{...data,organizationId:org}}))});
await new Promise(r=>server.listen(3191,'127.0.0.1',r));let browser,page;const errors=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await context.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'worker',password:'test-worker-password'}});
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/modern/worker/my-work');
 await page.getByRole('heading',{name:'My work & earnings',exact:true}).waitFor();
 await page.getByRole('button',{name:'Harvest',exact:true}).waitFor();await page.getByRole('button',{name:'Planner and Remainder',exact:true}).waitFor();
 await page.getByText('20.00 kg',{exact:true}).waitFor();await page.getByText('5.50',{exact:true}).waitFor();
 await page.getByText('120.00',{exact:true}).waitFor();await page.getByText('40.00',{exact:true}).waitFor();await page.getByText('80.00',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Accounts',exact:true}).count(),0);
 assert(!(await page.locator('body').innerText()).includes('9999'));
 await page.reload();await page.getByRole('button',{name:'Harvest',exact:true}).waitFor();await page.getByText('80.00',{exact:true}).waitFor();
 // The same employer account can use a custom server role instead of legacy checkboxes.
 docs.write(owner,{operations:[{type:'set',path:'roles/'+org+'__weigher-special',data:{organizationId:org,name:'Weigher special',legacyId:'weigher-special',permissions:['access_harvesting','edit_work','access_system']}},{type:'update',path:'employees/hr-linked',data:{roleId:'weigher-special',visibleModules:[]}}]});
 await page.getByRole('button',{name:'Tasks and Works',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Tasks and Works',exact:true}).waitFor();
 await page.getByRole('button',{name:'Harvest',exact:true}).waitFor();
 await page.getByText('80.00',{exact:true}).waitFor();
 assert.equal((await context.request.post(origin+'/api/local/documents/read',{headers:{Origin:origin},data:{path:'transactions'}})).status(),403);
 assert.deepEqual(errors,[]);console.log('PASS: employer-linked legacy Harvest/Tasks grants, real picked kg, own task hours, payroll accrual/payment/balance, reload, and no company-accounting access.');
}catch(e){console.error(e);if(page)console.error((await page.locator('body').innerText()).slice(0,6500));throw e;}
finally{await browser?.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
