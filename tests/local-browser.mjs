import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalServer } from '../server/local-server.mjs';
const dir = mkdtempSync(path.join(os.tmpdir(), 'agrimap-browser-'));
const origin = 'http://127.0.0.1:3199';
const { server, store } = createLocalServer({ directory: dir, origin });
await store.initialize({ name: 'Guria test farm', timezone: 'Asia/Tbilisi', ownerName: 'Farm Owner', ownerUsername: 'owner', password: 'test-owner-long-password' });
await new Promise(resolve => server.listen(3199, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'], headless: true });
  const ownerContext = await browser.newContext(), workerContext = await browser.newContext();
  const requests = [], errors = [];
  for (const context of [ownerContext, workerContext]) {
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    context.on('page', page => { page.on('request', req => requests.push(req.url())); page.on('pageerror', e => errors.push(e.message)); });
  }
  const owner = await ownerContext.newPage(); await owner.goto(origin);
  await owner.getByLabel('Username', { exact: true }).fill('owner'); await owner.getByLabel('Password', { exact: true }).fill('test-owner-long-password'); await owner.getByRole('button', { name: 'Sign in locally' }).click();
  await owner.getByRole('heading', { name: 'Guria test farm', exact: true }).waitFor();
  await owner.getByLabel('Field name', { exact: true }).fill('North blueberry'); await owner.getByLabel('Crop or variety').fill('Blueberry'); await owner.getByLabel('Area (ha)').fill('2.5'); await owner.getByRole('button', { name: 'Save field', exact: true }).click();
  await owner.getByRole('status').filter({ hasText: 'Field saved' }).waitFor();
  await owner.getByLabel('Worker name', { exact: true }).fill('Farm Worker'); await owner.getByLabel('Worker username').fill('worker'); await owner.getByLabel('Initial password').fill('test-worker-long-password'); await owner.getByRole('button', { name: 'Create worker' }).click();
  await owner.getByRole('status').filter({ hasText: 'Worker created' }).waitFor();
  const worker = await workerContext.newPage(); await worker.goto(origin + '/local');
  await worker.getByLabel('Username', { exact: true }).fill('worker'); await worker.getByLabel('Password', { exact: true }).fill('test-worker-long-password'); await worker.getByRole('button', { name: 'Sign in locally' }).click();
  await worker.getByRole('heading', { name: 'Guria test farm', exact: true }).waitFor(); assert.equal(await worker.getByRole('button', { name: 'Save field', exact: true }).count(), 0);
  await worker.getByLabel('Field', { exact: true }).selectOption({ label: 'North blueberry' }); await worker.getByLabel('Harvest weight (kg)').fill('80'); await worker.getByRole('button', { name: 'Save harvest', exact: true }).click();
  await worker.getByRole('status').filter({ hasText: 'Harvest saved' }).waitFor();
  await owner.getByRole('button', { name: 'Refresh records' }).click(); await owner.getByText('Total recorded: 80 kg', { exact: true }).waitFor();
  await owner.reload(); await owner.getByText('Total recorded: 80 kg', { exact: true }).waitFor();
  await owner.getByRole('button', { name: 'Disable Farm Worker', exact: true }).click(); await owner.getByRole('status').filter({ hasText: 'Worker access updated' }).waitFor();
  await worker.getByRole('button', { name: 'Refresh records' }).click(); await worker.getByRole('alert').filter({ hasText: 'Session expired' }).waitFor();
  await owner.setViewportSize({ width: 390, height: 844 }); assert(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Local mobile layout overflows');
  await owner.goto(origin + '/demo'); await owner.getByRole('link', { name: 'Create your workspace' }).click(); await owner.getByRole('heading', { name: 'Choose a home for your farm' }).waitFor();
  assert(!requests.some(url => /firebase|firestore|identitytoolkit|generativelanguage/.test(url)), 'Local/start imported cloud services'); assert.deepEqual(errors, []);
  console.log('PASS: separate owner/worker browsers, shared harvest, reload persistence, worker revocation, mobile layout, demo installation choice and no cloud traffic.');
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); }
