import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(process.env.LOCAL_DATA_DIR || path.join(project, '.local-data'), 'farm.sqlite');
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination) || existsSync(destination) || !existsSync(source)) {
  console.error('Use npm run local:backup -- /absolute/path/to/new-backup.sqlite. Source must exist and destination must be new.'); process.exitCode = 1;
} else {
  mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(source, { readOnly: true });
  try { await backup(db, destination); chmodSync(destination, 0o600); console.log('Consistent SQLite backup completed. Keep it on a separate device and protect it as private farm data.'); }
  finally { db.close(); }
}
