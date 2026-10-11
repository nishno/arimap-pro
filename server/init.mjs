import { createInterface } from 'node:readline/promises';
import { secret } from './terminal.mjs';
import { openFarm } from './farm-store.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = process.env.LOCAL_DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local-data');
const store = openFarm(directory);
try {
  if (store.farm()) throw new Error('Already initialized. Existing data was preserved.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const name = await rl.question('Farm name: '), timezone = (await rl.question('IANA timezone [Asia/Tbilisi]: ')) || 'Asia/Tbilisi';
  const ownerName = await rl.question('Owner name: '), ownerUsername = await rl.question('Owner username: '); rl.close();
  const password = await secret('Password (12+ characters; hidden): '), confirmation = await secret('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match');
  await store.initialize({ name, timezone, ownerName, ownerUsername, password });
  console.log('Farm initialized. Run npm run local:start. No Firebase account is required.');
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { store.close(); }
