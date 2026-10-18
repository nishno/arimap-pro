import http from 'node:http';
import https from 'node:https';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentStore } from './documents.mjs';
import { openFarm, FarmError } from './farm-store.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function createLocalServer({ directory, origin = 'http://localhost:3100', tls, dist = path.join(project, 'dist') }) {
  const expected = new URL(origin);
  if (!['https:', 'http:'].includes(expected.protocol) || expected.origin !== origin) throw new Error('LOCAL_ORIGIN must be an exact HTTP(S) origin');
  if (expected.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(expected.hostname)) throw new Error('LAN access requires HTTPS. Configure TLS or a trusted HTTPS reverse proxy.');
  const store = openFarm(directory), documents = documentStore(store), attempts = new Map();
  const cookie = (token, expired = false) => `agrimap_local_session=${token}; Path=/api/local; HttpOnly; SameSite=Strict; ${expected.protocol === 'https:' ? 'Secure; ' : ''}Max-Age=${expired ? 0 : 43200}`;
  const json = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
  const body = async req => {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new FarmError(415, 'Send application/json');
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > (req.url.startsWith('/api/local/documents/')?8 * 1024 * 1024:16384)) throw new FarmError(413, 'Request too large'); chunks.push(chunk); }
    try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; } catch { throw new FarmError(400, 'Invalid JSON object'); }
  };
  const handler = async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
    try {
      if (req.headers.host !== expected.host) throw new FarmError(403, 'Unexpected server address');
      const url = new URL(req.url, origin), route = url.pathname;
      if (!route.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method)) throw new FarmError(405, 'Method not allowed');
        if (route === '/' && url.searchParams.get('register') !== '1') { res.writeHead(302, { Location: '/modern' }); return res.end(); }
        const relative = decodeURIComponent(route).replace(/^\/+/, '');
        const target = path.resolve(dist, relative || 'index.html');
        if (!target.startsWith(path.resolve(dist) + path.sep)) throw new FarmError(404, 'Not found');
        const file = existsSync(target) && statSync(target).isFile() ? target : path.join(dist, 'index.html');
        if (!existsSync(file)) throw new FarmError(503, 'Build the application with npm run build first');
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        const contents=readFileSync(file);
        return res.end(req.method === 'HEAD' ? undefined : path.extname(file)==='.html'?contents.toString().replace('<head>','<head><script>window.__AGRIMAP_LOCAL__=true;</script>'):contents);
      }
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new FarmError(403, 'Cross-site request denied');
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) throw new FarmError(403, 'Same-origin request required');
      if (route === '/api/local/status' && req.method === 'GET') return json(res, 200, { initialized: !!store.farm(), mode: 'local', cloud: 'not-connected' });
      if (route === '/api/local/login' && req.method === 'POST') {
        if (!store.farm()) throw new FarmError(409, 'Initialize the farm on the server computer first');
        const key = req.socket.remoteAddress, now = Date.now();
        for (const [address, value] of attempts) if (value.until <= now) attempts.delete(address);
        const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
        if (attempt.count >= 10) throw new FarmError(429, 'Too many attempts. Try again in 15 minutes');
        attempt.count++; attempts.set(key, attempt);
        const input = await body(req), result = await store.login(input.username, input.password);
        attempts.delete(key); return json(res, 200, { user: result.user, farm: store.farm() }, { 'Set-Cookie': cookie(result.token) });
      }
      const token = /(?:^|;\s*)agrimap_local_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      if (route === '/api/local/logout' && req.method === 'POST') { store.logout(token); return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', true) }); }
      const user = store.authenticate(token);
      if(route === '/api/local/documents/read' && req.method==='POST')return json(res,200,documents.read(user,await body(req)));
      if(route === '/api/local/documents/commit' && req.method==='POST')return json(res,200,documents.write(user,await body(req)));
      if(route === '/api/local/profile' && req.method==='GET')return json(res,200,documents.profile(user));
      if (route === '/api/local/me' && req.method === 'GET') return json(res, 200, { user, farm: store.farm() });
      if (route === '/api/local/users' && req.method === 'GET') return json(res, 200, store.users(user));
      if (route === '/api/local/users' && req.method === 'POST') return json(res, 201, await store.createWorker(user, await body(req)));
      if (route === '/api/local/worker-access' && req.method === 'POST') { await store.manageWorker(user, await body(req)); return json(res, 200, { ok: true }); }
      if (route === '/api/local/password' && req.method === 'POST') { await store.changePassword(user, await body(req)); return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', true) }); }
      if (route === '/api/local/fields' && req.method === 'GET') return json(res, 200, store.fields());
      if (route === '/api/local/fields' && req.method === 'POST') return json(res, 201, store.createField(user, await body(req)));
      if (route === '/api/local/harvests' && req.method === 'GET') return json(res, 200, store.harvests());
      if (route === '/api/local/harvests' && req.method === 'POST') return json(res, 201, store.recordHarvest(user, await body(req)));
      if (route === '/api/local/export' && req.method === 'GET') return json(res, 200, store.exportData(user), { 'Content-Disposition': 'attachment; filename="agrimap-farm-data.json"' });
      throw new FarmError(404, 'Endpoint not found');
    } catch (error) { if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Farm server error' }); else res.end(); }
  };
  const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  server.on('close', () => store.close());
  return { server, store };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const origin = process.env.LOCAL_ORIGIN || 'http://localhost:3100';
  const tls = process.env.LOCAL_TLS_CERT && process.env.LOCAL_TLS_KEY ? { cert: readFileSync(process.env.LOCAL_TLS_CERT), key: readFileSync(process.env.LOCAL_TLS_KEY) } : undefined;
  const { server } = createLocalServer({ directory: process.env.LOCAL_DATA_DIR || path.join(project, '.local-data'), origin, tls });
  server.listen(Number(process.env.LOCAL_PORT || 3100), process.env.LOCAL_HOST || '127.0.0.1', () => console.log('Local farm server started. Cloud synchronization is not enabled.'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
