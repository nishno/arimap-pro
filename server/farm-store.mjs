import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';

const scrypt = promisify(scryptCallback);
export class FarmError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function text(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new FarmError(400, `Invalid ${label}`);
  return value.trim();
}
const username = value => text(value, 'username', 80).toLowerCase();
async function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200 || /[\x00-\x1f\x7f]/.test(password)) throw new FarmError(400, 'Use a password of 12–200 characters without control characters');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${Buffer.from(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function matches(password, stored) {
  if (typeof password !== 'string' || password.length > 200) return false;
  const [salt, expected] = stored.split(':');
  const actual = Buffer.from(await scrypt(password, salt, 64));
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
const digest = token => createHash('sha256').update(token).digest('hex');

export function openFarm(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'farm.sqlite');
  const db = new DatabaseSync(file);
  chmodSync(file, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS farm (id TEXT PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','worker')), password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS fields (id TEXT PRIMARY KEY, name TEXT NOT NULL, crop TEXT NOT NULL, area_ha REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS harvests (id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, field_id TEXT NOT NULL REFERENCES fields(id), kg REAL NOT NULL, recorded_at TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, record_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
    INSERT OR IGNORE INTO schema_version VALUES(1);`);
  if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'active')) {
    db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)); INSERT OR IGNORE INTO schema_version VALUES(2);');
  }
  const audit = (user, action, id) => db.prepare('INSERT INTO audit(at,user_id,action,record_id) VALUES(?,?,?,?)').run(new Date().toISOString(), user, action, id);
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const farm = () => db.prepare('SELECT * FROM farm').get();
  const publicUser = user => ({ id: user.id, username: user.username, name: user.name, role: user.role });
  const requireOwner = user => { if (user.role !== 'owner') throw new FarmError(403, 'Owner access required'); };
  return {
    db, farm, close: () => db.close(),
    async initialize({ name, timezone, ownerName, ownerUsername, password }) {
      name = text(name, 'farm name'); timezone = text(timezone, 'timezone');
      try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new FarmError(400, 'Use a valid IANA timezone'); }
      const login = username(ownerUsername), displayName = text(ownerName, 'owner name');
      const hash = await passwordHash(password);
      return transaction(() => {
        if (farm()) throw new FarmError(409, 'Farm already initialized');
        const farmId = randomUUID(), userId = randomUUID();
        db.prepare('INSERT INTO farm VALUES(?,?,?)').run(farmId, name, timezone);
        db.prepare('INSERT INTO users(id,username,name,role,password_hash) VALUES(?,?,?,?,?)').run(userId, login, displayName, 'owner', hash);
        audit(userId, 'farm.created', farmId); return farm();
      });
    },
    async login(login, password) {
      const user = db.prepare('SELECT * FROM users WHERE username=?').get(username(login));
      // A dummy hash makes unknown usernames take the same password work.
      const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
      const valid = await matches(password, user?.password_hash || dummy);
      if (!user || !valid || !user.active) throw new FarmError(401, 'Incorrect username or password');
      const current = db.prepare('SELECT password_hash,active FROM users WHERE id=?').get(user.id);
      if (!current?.active || current.password_hash !== user.password_hash) throw new FarmError(401, 'Incorrect username or password');
      const token = randomBytes(32).toString('hex'), expires = Date.now() + 12 * 60 * 60 * 1000;
      db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), user.id, expires);
      audit(user.id, 'session.created', user.id);
      return { token, user: publicUser(user) };
    },
    authenticate(token) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new FarmError(401, 'Sign in to your farm server');
      const user = db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>? AND u.active=1').get(digest(token), Date.now());
      if (!user) throw new FarmError(401, 'Session expired. Sign in again');
      return publicUser(user);
    },
    logout(token) { if (token) db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token)); },
    revokeAllSessions() { db.prepare('DELETE FROM sessions').run(); },
    async recoverOwner(login, password) {
      // Console-only recovery for an OS administrator with database access.
      // There is intentionally no HTTP route exposing this operation.
      const target = db.prepare("SELECT id FROM users WHERE username=? AND role='owner'").get(username(login));
      if (!target) throw new FarmError(404, 'Owner account not found');
      const hash = await passwordHash(password);
      transaction(() => {
        db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, target.id);
        db.prepare('DELETE FROM sessions').run();
        audit(target.id, 'owner.console_recovery', target.id);
      });
    },
    users(user) { requireOwner(user); return db.prepare('SELECT id,username,name,role,active FROM users ORDER BY name').all(); },
    async createWorker(user, input) {
      requireOwner(user);
      const login = username(input.username), name = text(input.name, 'name'), hash = await passwordHash(input.password);
      return transaction(() => {
        if (db.prepare('SELECT id FROM users WHERE username=?').get(login)) throw new FarmError(409, 'Username already exists');
        const id = randomUUID();
        db.prepare('INSERT INTO users(id,username,name,role,password_hash) VALUES(?,?,?,?,?)').run(id, login, name, 'worker', hash);
        audit(user.id, 'worker.created', id); return { id, username: login, name, role: 'worker' };
      });
    },
    async changePassword(user, input) {
      const existing = db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);
      if (!existing || !(await matches(input.current_password, existing.password_hash))) throw new FarmError(403, 'Current password is incorrect');
      const hash = await passwordHash(input.new_password);
      transaction(() => {
        if (db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id)?.password_hash !== existing.password_hash) throw new FarmError(409, 'Password changed during this request. Sign in again');
        db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        audit(user.id, 'password.changed', user.id);
      });
    },
    async manageWorker(user, input) {
      requireOwner(user); const id = text(input.id, 'worker ID', 80);
      const target = db.prepare('SELECT role FROM users WHERE id=?').get(id);
      if (!target || target.role !== 'worker') throw new FarmError(400, 'Select a worker account');
      if (typeof input.active !== 'boolean' && input.new_password === undefined) throw new FarmError(400, 'Specify active status or a new password');
      const hash = input.new_password === undefined ? null : await passwordHash(input.new_password);
      transaction(() => {
        if (typeof input.active === 'boolean') db.prepare('UPDATE users SET active=? WHERE id=?').run(input.active ? 1 : 0, id);
        if (hash) db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
        audit(user.id, hash ? 'worker.password_reset' : 'worker.access_changed', id);
      });
    },
    fields() { return db.prepare('SELECT * FROM fields ORDER BY name').all(); },
    createField(user, input) {
      requireOwner(user);
      const name = text(input.name, 'field name'), crop = text(input.crop, 'crop');
      if (typeof input.area_ha !== 'number' || !Number.isFinite(input.area_ha) || input.area_ha <= 0 || input.area_ha > 100000) throw new FarmError(400, 'Invalid area in hectares');
      return transaction(() => {
        const id = randomUUID(); db.prepare('INSERT INTO fields VALUES(?,?,?,?)').run(id, name, crop, input.area_ha);
        audit(user.id, 'field.created', id); return { id, name, crop, area_ha: input.area_ha };
      });
    },
    harvests() { return db.prepare('SELECT h.*, f.name AS field_name, u.name AS recorded_by FROM harvests h JOIN fields f ON f.id=h.field_id JOIN users u ON u.id=h.user_id ORDER BY h.recorded_at DESC').all(); },
    recordHarvest(user, input) {
      const requestId = text(input.request_id, 'request ID', 80), fieldId = text(input.field_id, 'field ID', 80);
      if (typeof input.kg !== 'number' || !Number.isFinite(input.kg) || input.kg <= 0 || input.kg > 1000000) throw new FarmError(400, 'Invalid harvest weight');
      return transaction(() => {
        const previous = db.prepare('SELECT * FROM harvests WHERE request_id=?').get(requestId);
        if (previous) {
          if (previous.user_id !== user.id || previous.field_id !== fieldId || previous.kg !== input.kg) throw new FarmError(409, 'Request ID belongs to another entry');
          return previous;
        }
        if (!db.prepare('SELECT id FROM fields WHERE id=?').get(fieldId)) throw new FarmError(404, 'Field not found');
        const id = randomUUID(), recordedAt = new Date().toISOString();
        db.prepare('INSERT INTO harvests VALUES(?,?,?,?,?,?)').run(id, requestId, fieldId, input.kg, recordedAt, user.id);
        audit(user.id, 'harvest.recorded', id);
        return db.prepare('SELECT * FROM harvests WHERE id=?').get(id);
      });
    },
    exportData(user) {
      requireOwner(user);
      // Recovery export deliberately excludes authentication secrets and sessions.
      return transaction(() => ({ format: 'agrimap-farm-data', version: 1, exported_at: new Date().toISOString(), farm: farm(), users: db.prepare('SELECT id,username,name,role,active FROM users').all(), fields: db.prepare('SELECT * FROM fields').all(), harvests: db.prepare('SELECT * FROM harvests').all(), audit: db.prepare('SELECT * FROM audit').all() }));
    }
  };
}
