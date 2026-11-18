import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {createLocalServer} from '../server/local-server.mjs';
const directory=mkdtempSync('/tmp/agrimap-role-ui-'), origin='http://127.0.0.1:3194';
const {server,store}=createLocalServer({directory,origin});
await store.initialize({name:'Role test farm',timezone:'Asia/Tbilisi',ownerName:'Owner',ownerUsername:'owner',password:'test-owner-password'});
await new Promise(resolve=>server.listen(3194,'127.0.0.1',resolve));
let browser,debugPage;
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[];
 async function login(username,password,viewport={width:1440,height:1000}) {
  const context=await browser.newContext({viewport});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  context.setDefaultTimeout(60000);
  const response=await context.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username,password}});
  assert.equal(response.status(),200);
  const page=await context.newPage();debugPage=page;page.on('pageerror',error=>errors.push(error.message));
  return {context,page};
 }
 const owner=await login('owner','test-owner-password');
 let response=await owner.context.request.post(origin+'/api/local/users',{headers:{Origin:origin},data:{name:'Worker',username:'worker',password:'test-worker-password'}});
 assert.equal(response.status(),201);
 console.log('Owner navigation');
 await owner.page.goto(origin+'/modern');
 await owner.page.getByRole('button',{name:'Stock',exact:true}).waitFor();
 await owner.page.getByRole('button',{name:'Stock',exact:true}).click();
 await owner.page.waitForURL(/\/modern\/farms\/[^/]+\/stock$/);
 await owner.page.reload();
 await owner.page.getByRole('button',{name:'+ Add Item',exact:true}).waitFor();
 assert.equal(await owner.page.getByTitle('Google Meet Video Call',{exact:true}).count(),1);
 assert.equal(await owner.page.getByTitle('Agronomy PM Intelligence Console',{exact:true}).count(),1);
 await owner.page.getByRole('button',{name:'Communicator',exact:true}).click();
 await owner.page.getByRole('button',{name:'Google Chat',exact:true}).waitFor();
 // The weather tool can be collapsed without losing typed coordinates.
 console.log('Weather panel');
 await owner.page.getByRole('button',{name:'Labs',exact:true}).click();
 const hardware=owner.page.getByRole('button',{name:/Hardware.*Devices/i});
 if(await hardware.count()) await hardware.first().click();
 await owner.page.getByRole('button',{name:'Weather Station & AI',exact:true}).click();
 await owner.page.getByLabel('Latitude',{exact:true}).fill('41.9');
 await owner.page.getByRole('button',{name:'Hide weather tools',exact:true}).click();
 assert.equal(await owner.page.getByLabel('Latitude',{exact:true}).isVisible(),false);
 await owner.page.getByRole('button',{name:'Show weather tools',exact:true}).click();
 assert.equal(await owner.page.getByLabel('Latitude',{exact:true}).inputValue(),'41.9');
 // A same-ID membership downgrade must update menus and close privileged entry points.
 store.db.prepare("UPDATE users SET role='worker' WHERE username='owner'").run();
 await owner.page.getByTitle('Google Meet Video Call',{exact:true}).waitFor({state:'detached'});
 await owner.page.getByRole('button',{name:'Labs',exact:true}).waitFor({state:'detached'});
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  console.log('Worker',viewport.width);
  const worker=await login('worker','test-worker-password',viewport);
  await worker.page.goto(origin+'/modern/worker/my-work');
  await worker.page.getByRole('heading',{name:'My work & earnings',exact:true}).waitFor();
  for(const name of ['Stock','Accounts','Map Planner','Labs','Admin']) assert.equal(await worker.page.getByRole('button',{name,exact:true}).count(),0,name);
  for(const title of ['Google Meet Video Call','Google Chat Workspace Hub','Agronomy PM Intelligence Console']) assert.equal(await worker.page.getByTitle(title,{exact:true}).count(),0,title);
  await worker.page.goto(origin+'/modern/farms/'+store.farm().id+'/accounting');
  await worker.page.getByRole('heading',{name:'My dashboard',exact:true}).waitFor();
  await worker.page.waitForURL(/\/modern\/worker\/dashboard$/);
  await worker.page.getByRole('button',{name:'Communicator',exact:true}).click();
  assert.equal(await worker.page.getByRole('button',{name:'Forum & Hub',exact:true}).count(),0);
  await worker.page.getByRole('button',{name:'Partners Find',exact:true}).waitFor();
  assert.equal(await worker.page.getByRole('button',{name:'Google Chat',exact:true}).count(),0);
  await worker.page.evaluate(()=>window.dispatchEvent(new CustomEvent('agrimap_open_meet')));
  assert.equal(await worker.page.getByRole('button',{name:'Launch Instant Video Meeting',exact:true}).count(),0);
  // Server still rejects a direct request, independently of menu visibility.
  response=await worker.context.request.post(origin+'/api/local/documents/read',{headers:{Origin:origin},data:{path:'transactions'}});
  assert.equal(response.status(),403);
  await worker.context.close();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: owner navigation and reload, contextual tool visibility, weather collapse preserves input, worker desktop/mobile menus, direct-route rejection, event guard, server finance denial.');
} catch(error) {
 console.error('Browser failure:',error);
 if(debugPage) { console.error('URL:',debugPage.url()); console.error((await debugPage.locator('body').innerText()).slice(0,10000)); console.error('Page errors:',await debugPage.evaluate(()=>window.__roleErrors||[])); }
 throw error;
} finally {
 await browser?.close();await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true});
}
