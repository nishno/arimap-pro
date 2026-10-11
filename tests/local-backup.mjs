import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
test('local backup requires auth, rejects arbitrary paths, persists Unicode and deletes only its own logical key',async()=>{
 const directory=await mkdtemp(tmpdir()+'/agrimap-sync-test-');
 const reserved=net.createServer();await new Promise(r=>reserved.listen(0,'127.0.0.1',r));const port=reserved.address().port;await new Promise(r=>reserved.close(r));
 const token=randomBytes(32).toString('hex');
 const child=spawn(process.execPath,['local-server-template.js'],{env:{...process.env,AGRIMAP_SYNC_TOKEN:token,AGRIMAP_BACKUP_DIR:directory,AGRIMAP_SYNC_PORT:String(port)},stdio:['ignore','pipe','pipe']});
 try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Backup helper did not start')),5000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Backup helper exited '+code));});});
 const root=`http://127.0.0.1:${port}`;
 assert.equal((await fetch(root+'/api/sync/test')).status,401);
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 assert.equal((await fetch(root+'/api/sync/test',{headers})).status,200);
 const post=data=>fetch(root+'/api/sync',{method:'POST',headers,body:JSON.stringify(data)});
 assert.equal((await post({path:'../../outside',type:'set',data:{}})).status,400);
 assert.equal((await post({path:'harvest/one',type:'set',data:{name:'ქართული'},dataFolder:'/not-allowed'})).status,200);
 const files=await readdir(directory);assert.equal(files.length,1);
 assert.equal(JSON.parse(await readFile(directory+'/'+files[0],'utf8')).data.name,'ქართული');
 assert.equal((await post({path:'harvest/one',type:'delete'})).status,200);
 assert.deepEqual(await readdir(directory),[]);
 } finally {const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;await rm(directory,{recursive:true,force:true});}
});
