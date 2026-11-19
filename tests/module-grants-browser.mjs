import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {createLocalServer} from '../server/local-server.mjs';
const directory=mkdtempSync('/tmp/agrimap-grant-browser-'),origin='http://127.0.0.1:3192';
const {server,store}=createLocalServer({directory,origin});
await store.initialize({name:'Grant test farm',timezone:'Asia/Tbilisi',ownerName:'Owner',ownerUsername:'owner',password:'test-owner-password'});
await new Promise(r=>server.listen(3192,'127.0.0.1',r));let browser,page;const errors=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const owner=await browser.newContext();await owner.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'owner',password:'test-owner-password'}});
 const creation=await owner.request.post(origin+'/api/local/users',{headers:{Origin:origin},data:{name:'Worker',username:'worker',password:'test-worker-password'}});assert.equal(creation.status(),201);const worker=await creation.json();
 const workerId=worker.id;
 async function grant(allowedModules){const r=await owner.request.post(origin+'/api/local/module-access',{headers:{Origin:origin},data:{userId:workerId,allowedModules}});assert.equal(r.status(),200);}
 await grant(['stock']);
 const user=await browser.newContext({viewport:{width:1440,height:1000}});await user.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await user.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'worker',password:'test-worker-password'}});
 page=await user.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
 await page.goto(origin+'/modern/worker/dashboard');await page.getByRole('heading',{name:'Planned work & harvest notifications',exact:true}).waitFor();
 for(const name of ['Stock','Harvest','Accounts','Market','Tasks and Works'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0,name);
 await page.reload();await page.getByRole('heading',{name:'Planned work & harvest notifications',exact:true}).waitFor();
 await page.goto(origin+'/modern/farms/'+store.farm().id+'/stock');await page.getByRole('heading',{name:'Planned work & harvest notifications',exact:true}).waitFor();await page.waitForURL(/\/dashboard$/);
 await grant(['harvesting','stock','tasks']);await page.reload();await page.getByRole('heading',{name:'Planned work & harvest notifications',exact:true}).waitFor();
 for(const name of ['Stock','Harvest','Tasks and Works'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0,name);
 assert.equal((await user.request.post(origin+'/api/local/documents/read',{headers:{Origin:origin},data:{path:'inventoryItems'}})).status(),403);
 await grant([]);
 assert.deepEqual(errors,[]);console.log('PASS: historical grants cannot bypass personal-only navigation, reload, route fallback or API denial.');
}catch(e){console.error(e);if(page)console.error((await page.locator('body').innerText()).slice(0,6000));throw e;}
finally{await browser?.close();await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});}
