import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {createLocalServer} from '../server/local-server.mjs';
import {documentStore} from '../server/documents.mjs';
const directory=mkdtempSync('/tmp/agrimap-terminal-browser-'),origin='http://127.0.0.1:3193';
const {server,store}=createLocalServer({directory,origin});
await store.initialize({name:'Terminal pilot farm',timezone:'Asia/Tbilisi',ownerName:'Owner',ownerUsername:'owner',password:'test-owner-password'});
const owner=(await store.login('owner','test-owner-password')).user;
const workers=await store.createWorker(owner,{name:'Worker',username:'worker',password:'test-worker-password'});
documentStore(store).write(owner,{operations:[{type:'set',path:'harvestEvents/event1',data:{name:'Harvest one',status:'active',organizationId:store.farm().id}},{type:'set',path:'employees/worker1',data:{name:'Field worker',status:'active',organizationId:store.farm().id}}]});
await new Promise(resolve=>server.listen(3193,'127.0.0.1',resolve));
let browser,page;const errors=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await context.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'owner',password:'test-owner-password'}});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const resources=[];page.on('request',r=>resources.push(r.url()));
 await page.goto(origin+'/terminal/index.html');
 await page.getByRole('heading',{name:'Terminal pilot farm'}).waitFor();
 await page.getByRole('button',{name:'English',exact:true}).click();
 // No Core, maps, Firebase or 3D runtime should be loaded by the terminal entry.
 assert(!resources.some(url=>/ProductionApp|vendor-maps|vendor-three|vendor-firebase/.test(url)));
 await context.setOffline(true);
 async function capture(code,kg){await page.getByLabel('Box QR',{exact:true}).fill(code);await page.getByLabel('Gross kg',{exact:true}).fill(kg);await page.getByRole('button',{name:'Save on device',exact:true}).click();}
 await capture('BOX-001','5.75');await page.locator('article').first().waitFor();
 await capture('BOX-001','5.85');await page.locator('article.suspect').waitFor();
 assert.equal(await page.locator('article').count(),2);
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM terminal_operations').get().n,0);
 await context.setOffline(false);
 await page.reload();await page.getByRole('heading',{name:'Terminal pilot farm'}).waitFor();await page.getByRole('button',{name:'English',exact:true}).click();
 assert.equal(await page.locator('article').count(),2,'queued work survives reload');
 await page.getByRole('button',{name:'Synchronize',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('article.suspect').length===2&&Array.from(document.querySelectorAll('article')).every(el=>el.textContent.includes('Received by server')));
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM terminal_operations').get().n,2);
 await page.getByRole('button',{name:'Synchronize',exact:true}).click();
 await page.getByRole('button',{name:'Synchronize',exact:true}).waitFor({state:'visible'});
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM terminal_operations').get().n,2);
 await page.getByLabel('Review reason').fill('Checked physical crate');
 await page.getByRole('button',{name:'Reject',exact:true}).first().click();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('article')).some(el=>el.textContent.includes('rejected')));
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM terminal_reviews').get().n,1);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Main app's owner-only launcher opens the independent entry in an iframe.
 await page.goto(origin+'/modern');await page.getByRole('button',{name:'Weigh terminal · Pilot',exact:true}).click();await page.getByRole('dialog',{name:'Weigh terminal pilot'}).waitFor();
 await page.frameLocator('iframe[title="Weigh terminal pilot"]').getByRole('heading',{name:'Terminal pilot farm'}).waitFor();
 // No implicit transfer into legacy harvest, payroll or inventory collections.
 assert.equal(documentStore(store).read(owner,{path:'harvestEntries'}).documents.length,0);
 const workerContext=await browser.newContext();await workerContext.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'worker',password:'test-worker-password'}});
 assert.equal((await workerContext.request.get(origin+'/api/local/terminal/bootstrap')).status(),403);
 const stranger=await browser.newContext();assert.equal((await stranger.request.get(origin+'/api/local/terminal/bootstrap')).status(),401);
 assert.deepEqual(errors,[]);console.log('PASS: independent light entry, offline capture, duplicate flag, IndexedDB reload, idempotent sync, review audit, mobile layout, Core modal, owner boundary and legacy isolation.');
}catch(e){console.error(e);if(page)console.error((await page.locator('body').innerText()).slice(0,6000));throw e;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true});}
