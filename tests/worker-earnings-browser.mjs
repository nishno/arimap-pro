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
 ['partnerProfiles/service-provider',{userId:'service-provider',name:'Pruning specialist',isDiscoverable:true,servicesOffered:['Pruning'],cv:{skills:['Pruning']}}],
 ['workAssignments/upcoming',{workName:'Planned pruning',date:'2026-11-21',status:'Planned',assignedEmployeeIds:['hr-linked']}],
 ['workAssignments/task1',{workName:'Pruning',date:'2026-11-18',status:'Completed',assignedEmployeeIds:['hr-linked','hr-other'],employeeHours:[{employeeId:'hr-linked',hours:5.5},{employeeId:'hr-other',hours:99}]}]
].map(([path,data])=>({type:'set',path,data:{...data,organizationId:org}}))});
await new Promise(r=>server.listen(3191,'127.0.0.1',r));let browser,page;const errors=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await context.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'worker',password:'test-worker-password'}});
 const admin=await browser.newContext();await admin.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await admin.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'owner',password:'test-owner-password'}});const adminPage=await admin.newPage();await adminPage.goto(origin+'/modern');
 for(let attempt=0;attempt<100&&!docs.read(owner,{path:'workerActivities'}).documents.length;attempt++)await new Promise(r=>setTimeout(r,100));
 assert.equal(docs.read(owner,{path:'workerActivities'}).documents.length,3,'manager publishes own assignment projections');await admin.close();
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/modern/worker/my-work');
 await page.getByRole('heading',{name:'My work & earnings',exact:true}).waitFor();
 for(const name of ['Harvest','Planner and Remainder','Tasks and Works','Market']) assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
 await page.getByText('20.00 kg',{exact:true}).waitFor();await page.getByText('5.50',{exact:true}).waitFor();
 await page.getByText('120.00',{exact:true}).waitFor();await page.getByText('40.00',{exact:true}).waitFor();await page.getByText('80.00',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Accounts',exact:true}).count(),0);
 assert(!(await page.locator('body').innerText()).includes('9999'));
 await page.reload();await page.getByText('80.00',{exact:true}).waitFor();
 // Historical employer role flags must not elevate an ordinary account.
 docs.write(owner,{operations:[{type:'set',path:'roles/'+org+'__weigher-special',data:{organizationId:org,name:'Weigher special',legacyId:'weigher-special',permissions:['access_harvesting','edit_work','access_system']}},{type:'update',path:'employees/hr-linked',data:{roleId:'weigher-special',visibleModules:[]}}]});
 await page.reload();
 for(const name of ['Tasks and Works','Harvest','Market'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
 await page.getByText('80.00',{exact:true}).waitFor();
 assert.equal((await context.request.post(origin+'/api/local/documents/read',{headers:{Origin:origin},data:{path:'transactions'}})).status(),403);
 await page.goto(origin+'/modern/worker/dashboard');await page.getByRole('heading',{name:'My dashboard',exact:true}).waitFor();await page.getByRole('heading',{name:'Planned pruning',exact:true}).waitFor();
 await page.getByRole('button',{name:'My CV, services & reviews',exact:true}).click();await page.getByRole('heading',{name:'My CV & services',exact:true}).waitFor();
 await page.getByRole('button',{name:'Add recorded experience to my CV',exact:true}).click();await page.getByLabel('Skills',{exact:true}).fill('Pruning');await page.getByLabel('Services offered',{exact:true}).fill('Pruning service');await page.getByLabel('Partners can discover my profile',{exact:false}).check();await page.getByRole('button',{name:'Save CV & services',exact:true}).click();await page.getByText('Profile saved',{exact:true}).waitFor({timeout:8000});
 await page.getByLabel('Review comment',{exact:true}).fill('Good working conditions');await page.getByRole('button',{name:'Submit review',exact:true}).click();await page.getByText('Review saved',{exact:true}).waitFor();
 const directory=docs.read(owner,{path:'partnerProfiles/'+worker.id}).document;assert.equal(directory.cv.experience.length,1);assert(!JSON.stringify(directory).includes('recordedPay'));
 await page.reload();await page.getByRole('heading',{name:'My CV & services',exact:true}).waitFor();assert.equal(await page.getByLabel('Services offered',{exact:true}).inputValue(),'Pruning service');
 await page.getByRole('button',{name:'Communicator',exact:true}).click();await page.getByRole('button',{name:'Partners Find',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Forum & Hub',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Google Chat',exact:true}).count(),0);await page.getByRole('heading',{name:'Pruning specialist',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Market Intelligence',exact:true}).count(),0);
 await page.getByRole('heading',{name:'Pruning specialist',exact:true}).locator('xpath=../../..').getByRole('button',{name:'Message',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Send as Ticket',exact:true}).count(),0);await page.getByPlaceholder('Start your professional dialogue...').fill('I can offer pruning services');await page.getByRole('button',{name:'Dispatch Message',exact:true}).click();await page.getByText('I can offer pruning services',{exact:true}).waitFor();
 const message=docs.read(worker,{path:'forumPosts'}).documents.find(row=>row.authorId===worker.id);assert.equal(message.recipientId,'service-provider');assert.equal(message.isDirectMessage,true);
 assert.deepEqual(errors,[]);console.log('PASS: personal-only navigation despite legacy grants, real picked kg, own task hours, payroll accrual/payment/balance, reload, and no company-accounting access.');
}catch(e){console.error(e);if(page)console.error((await page.locator('body').innerText()).slice(0,6500));throw e;}
finally{await browser?.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
