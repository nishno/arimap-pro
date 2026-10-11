const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const screenshotDir = process.env.DEMO_SCREENSHOT_DIR || path.join(process.cwd(), 'tmp', 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });
(async () => {
 const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox'] });
 try {
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 const baseURL=process.env.DEMO_BASE_URL || 'http://127.0.0.1:3001';
 const requests=[], errors=[];
 await context.route('**/*', route => {const url=new URL(route.request().url()); if(url.hostname!=='127.0.0.1') return route.abort(); return route.continue();});
 await context.addInitScript(() => {localStorage.setItem('agri-planter-session','production-sentinel');localStorage.setItem('mock_organizations','production-sentinel');});
 const page=await context.newPage();page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseURL+'/demo');
 await page.getByRole('heading',{name:'A good day starts with a clear view.'}).waitFor();
 await page.getByRole('button',{name:'Record sample harvest',exact:true}).click();
 await page.getByLabel('Harvest weight (kg)').fill('240');
 await page.getByRole('button',{name:'Add sample harvest',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Added 240'}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'A good day starts with a clear view.'}).waitFor();
 assert.match(await page.locator('.demo-metric').nth(1).innerText(),/240/);
 await page.getByRole('button',{name:'Weather & alerts',exact:false}).first().click();
 await page.getByLabel('Sample temperature').fill('-2');
 await page.getByText('High frost risk',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('agri-planter-session')),'production-sentinel');
 assert.equal(await page.evaluate(()=>localStorage.getItem('mock_organizations')),'production-sentinel');
 assert(!requests.some(u=>/firebase|firestore|identitytoolkit|generativelanguage|\/api\/ai/.test(u)), 'Demo requested production services');
 assert(!requests.some(u=>/\/src\/(App|firebase|ProductionApp|services\/geminiService)/.test(u)), 'Demo imported production modules');
 // Reset and malformed-storage recovery.
 await page.getByRole('button',{name:'Reset demo',exact:true}).click();
 assert.match(await page.locator('.demo-metric').nth(1).innerText(),/0 kg/);
 await page.evaluate(()=>localStorage.setItem('agrimap:demo:v1','invalid json'));await page.reload();await page.getByRole('heading',{name:'A good day starts with a clear view.'}).waitFor();
 assert.equal(await page.locator('a[href="/start"]').first().getAttribute('href'),'/start');
 await page.screenshot({path:path.join(screenshotDir, 'demo-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile page overflows');
 await page.screenshot({path:path.join(screenshotDir, 'demo-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: harvest persistence, frost scenario, reset, corrupt-storage recovery, signup handoff, mobile layout, production-storage preservation, and no production imports/service requests.');
 await context.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
