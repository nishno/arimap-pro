import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {once} from 'node:events';
const directory=mkdtempSync('/tmp/agrimap-paired-start-');
const child=spawn(process.execPath,['server/local-server.mjs'],{env:{...process.env,LOCAL_DATA_DIR:directory,LOCAL_ORIGIN:'http://127.0.0.1:3190',LOCAL_PORT:'3190',CLOUD_PORT:'3191',LOCAL_HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
const ended=once(child,'exit');let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
try{
 let status;for(let n=0;n<50;n++){try{const response=await fetch('http://127.0.0.1:3190/api/local/status');status=await response.json();break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert(status,output);assert.equal(status.initialized,false);assert.equal(status.cloudUrl,'http://127.0.0.1:3191');
 const response=await fetch('http://127.0.0.1:3191/?register=1');assert.equal(response.status,200);assert((await response.text()).includes('__AGRIMAP_LOCAL__=false'));
 assert(output.includes('Local farm application:'));assert(output.includes('Firebase application:'));
 console.log('PASS: one startup command launches both isolated entries without initializing or replacing a farm.');
}finally{child.kill('SIGTERM');await ended;rmSync(directory,{recursive:true,force:true});}
