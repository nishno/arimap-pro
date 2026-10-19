import http from 'node:http';
import https from 'node:https';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// A separate origin isolates Firebase browser state from the local farm's caches.
export function createCloudServer({origin='http://localhost:3101',tls,dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist')}={}){
 const expected=new URL(origin);
 if(expected.origin!==origin||!['http:','https:'].includes(expected.protocol))throw Error('Cloud origin must be an exact HTTP(S) origin');
 if(expected.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(expected.hostname))throw Error('Cloud LAN access requires HTTPS');
 const handler=(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  const fail=(status,message)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(message);};
  try{
   if(req.headers.host!==expected.host)return fail(403,'Unexpected server address');
   if(!['GET','HEAD'].includes(req.method))return fail(405,'Method not allowed');
   const route=new URL(req.url,origin).pathname;
   if(route.startsWith('/api/'))return fail(404,'Local farm APIs are not available on the cloud application origin');
   if(['/local','/start'].includes(route)){res.writeHead(302,{Location:new URL('/?register=1',origin).href});return res.end();}
   const target=path.resolve(dist,decodeURIComponent(route).replace(/^\/+/,''));
   if(target!==path.resolve(dist)&&!target.startsWith(path.resolve(dist)+path.sep))return fail(404,'Not found');
   const file=existsSync(target)&&statSync(target).isFile()?target:path.join(dist,'index.html');
   if(!existsSync(file))return fail(503,'Build the application with npm run build first');
   const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2'};
   res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});
   const content=readFileSync(file);
   res.end(req.method==='HEAD'?undefined:ext==='.html'?content.toString().replace('<head>','<head><script>window.__AGRIMAP_LOCAL__=false;</script>'):content);
  }catch{if(res.headersSent)return res.end();return fail(400,'Invalid request');}
 };
 return tls?https.createServer(tls,handler):http.createServer(handler);
}
