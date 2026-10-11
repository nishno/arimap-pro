import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { openFarm } from '../server/farm-store.mjs';
import { createLocalServer } from '../server/local-server.mjs';

test('local farm: identities, roles, duplicate retries, backup and restart persistence', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agrimap-local-'));
  let store = openFarm(dir);
  try {
    const farm = await store.initialize({ name: 'Test Guria Farm', timezone: 'Asia/Tbilisi', ownerName: 'Owner', ownerUsername: 'owner', password: 'test-only-long-password' });
    await assert.rejects(store.initialize({ name: 'Other', timezone: 'UTC', ownerName: 'Other', ownerUsername: 'other', password: 'test-only-long-password' }), /already initialized/);
    await assert.rejects(store.login('owner', 'incorrect'), /Incorrect/);
    const ownerLogin = await store.login('OWNER', 'test-only-long-password');
    const owner = store.authenticate(ownerLogin.token);
    assert.equal(owner.role, 'owner'); assert(!('password_hash' in owner));
    const field = store.createField(owner, { name: 'North', crop: 'Blueberry', area_ha: 2.5 });
    await store.createWorker(owner, { name: 'Worker', username: 'worker', password: 'test-worker-long-password', role: 'owner' });
    const workerLogin = await store.login('worker', 'test-worker-long-password');
    const worker = store.authenticate(workerLogin.token); assert.equal(worker.role, 'worker');
    await assert.rejects(store.createWorker(worker, { name: 'Bad', username: 'bad', password: 'test-worker-long-password' }), /Owner access/);
    assert.throws(() => store.createField(worker, { name: 'Bad', crop: 'Bad', area_ha: 1 }), /Owner access/);
    assert.throws(() => store.exportData(worker), /Owner access/);
    const input = { field_id: field.id, kg: 125, request_id: 'retry-1' };
    const first = store.recordHarvest(worker, input);
    assert.equal(store.recordHarvest(worker, input).id, first.id);
    assert.equal(store.harvests().length, 1);
    assert.throws(() => store.recordHarvest(worker, { ...input, kg: 200 }), /another entry/);
    assert.throws(() => store.recordHarvest(owner, input), /another entry/);
    assert.throws(() => store.recordHarvest(worker, { ...input, request_id: 'new', kg: -1 }), /Invalid/);
    const exported = store.exportData(owner);
    assert.equal(exported.farm.id, farm.id); assert(!JSON.stringify(exported).includes('password_hash')); assert(!JSON.stringify(exported).includes(workerLogin.token));
    const backupFile = path.join(dir, 'recovery.sqlite'); await backup(store.db, backupFile);
    const recovered = new DatabaseSync(backupFile, { readOnly: true });
    assert.equal(recovered.prepare('SELECT kg FROM harvests').get().kg, 125);
    assert.equal(recovered.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); recovered.close();
    store.close(); store = openFarm(dir);
    assert.equal(store.farm().id, farm.id); assert.equal(store.authenticate(workerLogin.token).id, worker.id); assert.equal(store.harvests().length, 1);
    store.logout(workerLogin.token); assert.throws(() => store.authenticate(workerLogin.token), /expired/);
    const newWorkerSession = await store.login('worker', 'test-worker-long-password');
    await assert.rejects(store.manageWorker(worker, { id: worker.id, active: true }), /Owner access/);
    await store.manageWorker(owner, { id: worker.id, active: false });
    assert.throws(() => store.authenticate(newWorkerSession.token), /expired/);
    await assert.rejects(store.login('worker', 'test-worker-long-password'), /Incorrect/);
    await store.manageWorker(owner, { id: worker.id, active: true, new_password: 'new-worker-long-password' });
    await assert.rejects(store.login('worker', 'test-worker-long-password'), /Incorrect/);
    const changedWorker = await store.login('worker', 'new-worker-long-password');
    await assert.rejects(store.changePassword(worker, { current_password: 'wrong', new_password: 'even-newer-long-password' }), /incorrect/);
    await store.changePassword(worker, { current_password: 'new-worker-long-password', new_password: 'even-newer-long-password' });
    assert.throws(() => store.authenticate(changedWorker.token), /expired/);
    assert.equal((await store.login('worker', 'even-newer-long-password')).user.id, worker.id);
    await assert.rejects(store.recoverOwner('worker', 'new-owner-long-password'), /Owner account not found/);
    await store.recoverOwner('owner', 'new-owner-long-password');
    assert.throws(() => store.authenticate(ownerLogin.token), /expired/);
    assert.equal((await store.login('owner', 'new-owner-long-password')).user.id, owner.id);
    assert.equal(store.farm().id, farm.id);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('HTTP boundary: login, cookies, origin checks, roles, export and logout', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agrimap-http-'));
  const origin = 'http://127.0.0.1:3198';
  const { server, store } = createLocalServer({ directory: dir, origin });
  await store.initialize({ name: 'Farm', timezone: 'UTC', ownerName: 'Owner', ownerUsername: 'owner', password: 'test-only-long-password' });
  await new Promise(resolve => server.listen(3198, '127.0.0.1', resolve));
  const call = (route, input, cookie, originHeader = origin) => fetch('http://127.0.0.1:3198/api/local/' + route, { headers: {  ...(input ? { 'content-type': 'application/json', origin: originHeader } : {}), ...(cookie ? { cookie } : {}) }, ...(input ? { method: 'POST', body: JSON.stringify(input) } : {}) });
  try {
    assert.equal((await call('fields')).status, 401);
    assert.equal((await call('login', { username: 'owner', password: 'test-only-long-password' }, null, 'https://evil.example')).status, 403);
    assert.equal((await fetch('http://127.0.0.1:3198/api/local/status', { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    const login = await call('login', { username: 'owner', password: 'test-only-long-password' }); assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie'); assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Strict/);
    const cookie = setCookie.split(';')[0];
    assert.equal((await call('fields', { name: 'Field', crop: 'Tea', area_ha: 3 }, cookie)).status, 201);
    assert.equal((await call('users', { name: 'Worker', username: 'worker', password: 'test-worker-long-password' }, cookie)).status, 201);
    const workerLogin = await call('login', { username: 'worker', password: 'test-worker-long-password' }); const workerCookie = workerLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await call('export', undefined, workerCookie)).status, 403);
    assert.equal((await call('fields', { name: 'Bad', crop: 'Tea', area_ha: 3 }, workerCookie)).status, 403);
    const exported = await call('export', undefined, cookie); assert.equal(exported.status, 200); assert.equal(exported.headers.get('cache-control'), 'no-store');
    assert.equal((await call('logout', {}, cookie)).status, 200); assert.equal((await call('me', undefined, cookie)).status, 401);
    assert.equal((await call('logout', {}, cookie)).status, 200, 'Expired sessions can still clear their browser cookie');
    const oversize = await call('login', { username: 'owner', password: 'x'.repeat(20000) }); assert.equal(oversize.status, 413);
  } finally { await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); }
});

test('insecure public/LAN origins are rejected', () => {
  assert.throws(() => createLocalServer({ directory: '/tmp/not-created', origin: 'http://192.168.1.10:3100' }), /requires HTTPS/);
});
