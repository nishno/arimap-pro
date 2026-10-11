const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const paths=[];let providerFails=false;
  await page.route('**/api/cameras/**',r=>{paths.push(new URL(r.request().url()).pathname);return r.fulfill({status:401,contentType:'application/json',body:'{"error":"Unauthorized"}'});});
  await page.route('https://api.open-meteo.com/**',r=>providerFails?r.fulfill({status:503,body:'Unavailable'}):r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current:{time:'2026-10-11T12:00',temperature_2m:8,relative_humidity_2m:84,precipitation:1.4,wind_speed_10m:12}})}));
  await page.goto((process.env.DEMO_BASE_URL||'http://127.0.0.1:3001')+'/tests/hardware-harness.html');
  await page.getByRole('heading',{name:'Weather & field conditions'}).waitFor();
  assert(!await page.getByText(/live microclimate telemetry|Generated precision/).count());
  await page.getByRole('button',{name:'Fetch online conditions'}).click();
  await page.getByText('8°C',{exact:true}).waitFor();
  assert.match(await page.locator('body').innerText(),/modeled conditions/);
  providerFails=true;await page.getByRole('button',{name:'Fetch online conditions'}).click();
  await page.getByRole('alert').filter({hasText:'No substitute readings were generated'}).waitFor();
  assert(await page.getByText('8°C',{exact:true}).isVisible());
  assert(paths.includes('/api/cameras/test_one/index.m3u8'));assert(paths.includes('/api/cameras/test_two/index.m3u8'));
  const cameraErrors=page.getByRole('alert').filter({hasText:/Camera gateway unavailable|No live picture/});
  await cameraErrors.nth(1).waitFor();assert.equal(await cameraErrors.count(),2);
  assert(!await page.getByRole('status').filter({hasText:'Live'}).count());
  console.log('PASS: forecast provenance, failed-fetch honesty, no synthetic telemetry, independent camera requests, unauthorized-stream status, and no fake live indication.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
