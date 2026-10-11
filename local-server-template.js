/** Local backup receiver. Run behind an authenticated TLS reverse proxy.
 * Required: AGRIMAP_SYNC_TOKEN (server-only secret), AGRIMAP_BACKUP_DIR.
 * Binds loopback on port 3100; never accepts client-selected filesystem paths.
 */
import http from 'node:http';
import path from 'node:path';
import { mkdir, writeFile, unlink, rename } from 'node:fs/promises';
import { timingSafeEqual, randomUUID } from 'node:crypto';
const token=process.env.AGRIMAP_SYNC_TOKEN;
const directory=process.env.AGRIMAP_BACKUP_DIR;
if (!token || token.length<32 || !directory || !path.isAbsolute(directory)) throw new Error('Set a server-only AGRIMAP_SYNC_TOKEN of at least 32 characters and an absolute AGRIMAP_BACKUP_DIR.');
const port=Number(process.env.AGRIMAP_SYNC_PORT||3100);
if (!Number.isInteger(port)||port<1024||port>65535) throw new Error('Invalid local sync port');
await mkdir(directory,{recursive:true,mode:0o700});
const server=http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const provided=Buffer.from(req.headers.authorization||'');const expected=Buffer.from(`Bearer ${token}`);
 if(provided.length!==expected.length||!timingSafeEqual(provided,expected)) return send(401,{error:'Unauthorized'});
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/api/sync/test') return send(200,{status:'ok'});
 if(req.method!=='POST'||url.pathname!=='/api/sync') return send(404,{error:'Not found'});
 if(!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'JSON required'});
 const chunks=[];let bytes=0;
 try{
  for await(const chunk of req){bytes+=chunk.length;if(bytes>1024*1024){send(413,{error:'Payload too large'});req.resume();return;}chunks.push(chunk);}
  const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(typeof payload.path!=='string'||!/^([A-Za-z0-9_-]+\/?)+$/.test(payload.path)||payload.path.length>200||!['set','update','delete'].includes(payload.type)) return send(400,{error:'Invalid sync path or operation'});
  // Encode the complete logical ID to avoid collisions between a/b and a_b.
  const name=Buffer.from(payload.path).toString('base64url')+'.json';
  const file=path.join(directory,name);
  if(payload.type==='delete') await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});
  else {
    const temporary=file+'.'+randomUUID()+'.tmp';
    try {await writeFile(temporary,JSON.stringify({syncedAt:new Date().toISOString(),path:payload.path,data:payload.data}),{mode:0o600,flag:'wx'});await rename(temporary,file);}
    finally {await unlink(temporary).catch(()=>{});}
  }
  send(200,{status:'ok'});
 }catch(e){send(e instanceof SyntaxError?400:500,{error:e instanceof SyntaxError?'Invalid JSON':'Sync failed'});}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log(`Local backup receiver listening on loopback port ${port}`));
