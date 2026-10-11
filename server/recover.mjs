import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { openFarm } from './farm-store.mjs';
import { secret } from './terminal.mjs';
const directory = process.env.LOCAL_DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local-data');
if (!existsSync(path.join(directory, 'farm.sqlite'))) throw new Error('No farm database found. Check LOCAL_DATA_DIR.');
const store = openFarm(directory);
try {
  if (process.argv.includes('--revoke-sessions')) {
    store.revokeAllSessions(); console.log('All local sessions revoked. Users must sign in again.');
  } else {
    if (!process.stdin.isTTY) throw new Error('Run recovery in an interactive terminal on the server computer');
    console.log('Owner recovery: use only as the server administrator. Stop the server and back up first. All sessions will be revoked.');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const username = await rl.question('Existing owner username: '); rl.close();
    const password = await secret('New owner password (12+ characters; hidden): '), confirm = await secret('Confirm password: ');
    if (password !== confirm) throw new Error('Passwords do not match');
    await store.recoverOwner(username, password); console.log('Owner password recovered. Farm and user IDs were preserved; all sessions revoked.');
  }
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { store.close(); }
