import { createInterface } from 'node:readline/promises';
import { secret } from './terminal.mjs';
import { openFarm, text } from './farm-store.mjs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = process.env.LOCAL_DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local-data');
const store = openFarm(directory);
try {
  if (store.farm()) throw new Error('Already initialized. Existing data was preserved.');
  const { values } = parseArgs({ options: {
    'farm-name': { type: 'string' }, timezone: { type: 'string' },
    'owner-name': { type: 'string' }, username: { type: 'string' }
  } });
  // Let Node's deferred SQLite warning finish before showing the first prompt.
  await new Promise(resolve => setImmediate(resolve));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  async function required(option, prompt, label, max = 120) {
    if (option !== undefined) return text(option, label, max);
    while (true) {
      const answer = await rl.question(prompt);
      try { return text(answer, label, max); }
      catch { console.log(`${label} is required (1–${max} characters). Please enter it again.`); }
    }
  }
  let name, timezone, ownerName, ownerUsername;
  try {
    name = await required(values['farm-name'], 'Farm name: ', 'Farm name');
    timezone = values.timezone || (await rl.question('IANA timezone [Asia/Tbilisi]: ')).trim() || 'Asia/Tbilisi';
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    ownerName = await required(values['owner-name'], 'Owner name: ', 'Owner name');
    ownerUsername = await required(values.username, 'Owner username: ', 'Owner username', 80);
  } finally { rl.close(); }
  console.log(`Creating farm: ${name} | Owner: ${ownerUsername} | Timezone: ${timezone}`);
  const password = await secret('Password (12+ characters; hidden): '), confirmation = await secret('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match');
  await store.initialize({ name, timezone, ownerName, ownerUsername, password });
  console.log('Farm initialized. Run npm run local:start. No Firebase account is required.');
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { store.close(); }
