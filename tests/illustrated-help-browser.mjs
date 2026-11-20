import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {createLocalServer} from '../server/local-server.mjs';
const directory=mkdtempSync('/tmp/agrimap-help-test-'),origin='http://127.0.0.1:3192';
const {server,store}=createLocalServer({directory,origin});
await store.initialize({name:'Help Training Farm',timezone:'Asia/Tbilisi',ownerName:'Owner',ownerUsername:'owner',password:'test-owner-password'});
const owner=(await store.login('owner','test-owner-password')).user;
await store.createWorker(owner,{name:'Worker',username:'worker',password:'test-worker-password'});
await new Promise(r=>server.listen(3192,'127.0.0.1',r));let browser,page;const errors=[];
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await context.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'owner',password:'test-owner-password'}});
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(30000);
 const help=origin+'/modern/farms/'+store.farm().id+'/guide';
 await page.goto(help);await page.getByRole('heading',{name:'Help, guides & SOPs',exact:true}).waitFor();
 await page.goto(help+'?helpTopic=stock');await page.getByRole('heading',{name:'Stock: receive, issue & transfer',exact:true}).waitFor();
 await page.locator('.help-library nav button').filter({hasText:'Stock: receive, issue & transfer'}).click();
 await page.getByRole('button',{name:'Open this option',exact:true}).click();
 await page.getByRole('heading',{name:'Add Stock Item',exact:true}).waitFor();
 await page.goto(help);await page.getByRole('heading',{name:'Help, guides & SOPs',exact:true}).waitFor();
 await page.locator('.help-library nav button').filter({hasText:'Start harvest session'}).click();
 await page.getByRole('button',{name:'Open this option',exact:true}).click();
 await page.getByRole('heading',{name:"Manager's Choice Hub",exact:true}).waitFor();
 for(const [topic,heading] of [['ledger','Financial Audit Trail'],['ai',"Agronomist's Conclusion & Prescription"],['iot','Weather & field conditions']]){
 await page.goto(help+'?helpTopic='+topic);await page.getByRole('heading',{name:'Help, guides & SOPs',exact:true}).waitFor();await page.getByRole('button',{name:'Open this option',exact:true}).click();await page.getByRole('heading',{name:heading,exact:true}).waitFor();
 }
 await page.goto(help);await page.getByRole('heading',{name:'Help, guides & SOPs',exact:true}).waitFor();
 await page.locator('.help-library nav button').filter({hasText:'My Work & Earnings'}).click();
 await page.getByRole('tab',{name:'SOP & checklist',exact:true}).click();
 await page.locator('.help-checklist input').first().check();assert.equal(await page.locator('.help-checklist input:checked').count(),1);
 await page.reload();await page.getByRole('heading',{name:'Help, guides & SOPs',exact:true}).waitFor();
 await page.locator('.help-library nav button').filter({hasText:'My Work & Earnings'}).click();await page.getByRole('tab',{name:'SOP & checklist',exact:true}).click();assert.equal(await page.locator('.help-checklist input:checked').count(),1);
 await page.getByRole('button',{name:'Reset practice checklist',exact:true}).click();assert.equal(await page.locator('.help-checklist input:checked').count(),0);
 await page.getByRole('tab',{name:'Illustrated guide',exact:true}).click();await page.getByRole('button',{name:'Enlarge screenshot 36-earnings',exact:true}).click();await page.getByRole('dialog',{name:'Training screenshot',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByPlaceholder('Harvest, stock, company…').fill('zzzz');assert.equal(await page.locator('.help-library nav button').count(),0);await page.getByPlaceholder('Harvest, stock, company…').fill('');
 await page.locator('.help-library nav button').filter({hasText:'Agronomy: plan to execution'}).click();await page.screenshot({path:'/tmp/help-owner-desktop.png'});
 const data=await context.request.get(origin+'/help-guide/manual.json');assert.equal(data.status(),200);assert.equal((await data.json()).articles.length,23);const pdf=await context.request.get(origin+'/help-guide/manual-en.pdf');assert.equal(pdf.status(),200);
 await page.setViewportSize({width:390,height:844});await page.getByLabel('Choose guide',{exact:true}).selectOption('stock');await page.getByRole('heading',{name:'Stock: receive, issue & transfer',exact:true}).waitFor();await page.screenshot({path:'/tmp/help-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const wc=await browser.newContext({viewport:{width:1440,height:1000}});await wc.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await wc.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'worker',password:'test-worker-password'}});
 const worker=await wc.newPage();worker.on('pageerror',error=>errors.push(error.message));await worker.goto(origin+'/modern/worker/guide?helpTopic=harvest');await worker.getByRole('heading',{name:'Help, guides & SOPs',exact:true}).waitFor();
 assert.equal(await worker.locator('.help-library nav button').filter({hasText:'Start harvest session'}).count(),0);assert.equal(await worker.locator('.help-library nav button').filter({hasText:'Stock: receive'}).count(),0);assert.equal(await worker.getByRole('button',{name:'Advanced help & AI tools',exact:true}).count(),0);
 await worker.locator('.help-library nav button').filter({hasText:'My Work & Earnings'}).click();await worker.getByRole('tab',{name:'SOP & checklist',exact:true}).click();assert.equal(await worker.locator('.help-checklist input:checked').count(),0);
 await worker.getByRole('button',{name:'Open module',exact:true}).click();await worker.getByRole('heading',{name:'My work & earnings',exact:true}).waitFor();
 await worker.addInitScript(()=>localStorage.setItem('agri-app-lang','ka'));await worker.goto(origin+'/modern/worker/guide');await worker.getByRole('heading',{name:'დახმარება, გზამკვლევები და პროცედურები',exact:true}).waitFor();assert.equal(await worker.getByRole('tab',{name:'პროცედურა და საკონტროლო სია',exact:true}).count(),1);await worker.screenshot({path:'/tmp/help-worker-georgian.png'});
 assert.deepEqual(errors,[]);console.log('PASS: owner option links, worker filtering, practice persistence/reset and user isolation, screenshots/keyboard dialog, search, manual/PDF, mobile layout and Georgian help.');
}catch(error){if(page)console.error((await page.locator('body').innerText()).slice(-4500));throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});}
