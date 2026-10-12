import test from 'node:test';
import assert from 'node:assert/strict';
import {managePlatformAdmin} from '../server/platform-management.mjs';
function fixture(actorClaims={platformOwner:true},targetClaims={admin:true,feature:'preserved'}){
 const calls=[];
 const services={verifyToken:async token=>{if(token!=='valid')throw new Error('bad token');return{uid:'actor'};},getUser:async uid=>({uid,customClaims:uid==='actor'?actorClaims:targetClaims}),disableProfile:async uid=>calls.push(['disable-profile',uid]),disableAccount:async uid=>calls.push(['disable-auth',uid]),deleteAccount:async uid=>calls.push(['delete-auth',uid]),profileExists:async()=>true,setClaims:async(uid,claims)=>calls.push(['claims',uid,claims]),revokeTokens:async uid=>calls.push(['revoke',uid]),updateProfile:async(uid,grant)=>calls.push(['profile',uid,grant]),startAudit:async data=>{calls.push(['audit-start',data]);return'audit';},completeAudit:async(id,status)=>calls.push(['audit-end',status])};
 return{services,calls};
}
const request={token:'valid',action:'grant',targetUid:'target',reason:'Verified identity'};
test('only a verified platform owner can manage super-admins',async()=>{
 const f=fixture({admin:true});await assert.rejects(managePlatformAdmin(f.services,request),e=>e.status===403);assert.equal(f.calls.length,0);
 await assert.rejects(managePlatformAdmin(f.services,{...request,token:'invalid'}),e=>e.status===401);
 await assert.rejects(managePlatformAdmin(f.services,{...request,token:''}),e=>e.status===401);
});
test('grant preserves unrelated claims and audits; owner accounts are protected',async()=>{
 const f=fixture();assert.equal((await managePlatformAdmin(f.services,request)).ok,true);
 assert.deepEqual(f.calls.find(c=>c[0]==='claims')[2],{admin:true,feature:'preserved'});
 assert.equal(f.calls.at(-1)[1],'completed');
 const owner=fixture(undefined,{platformOwner:true});await assert.rejects(managePlatformAdmin(owner.services,request),e=>e.status===403);assert.equal(owner.calls.length,0);
 await assert.rejects(managePlatformAdmin(f.services,{...request,targetUid:'actor'}),e=>e.status===403);
});
test('revocation disables Firestore authority before changing Auth claims',async()=>{
 const f=fixture();await managePlatformAdmin(f.services,{...request,action:'revoke'});
 const profile=f.calls.findIndex(c=>c[0]==='profile'),claims=f.calls.findIndex(c=>c[0]==='claims');assert(profile<claims);assert.equal(f.calls[profile][2],false);assert.deepEqual(f.calls[claims][2],{feature:'preserved'});
});
test('invalid actions and partial cloud failures do not report success',async()=>{
 const f=fixture();await assert.rejects(managePlatformAdmin(f.services,{...request,action:'owner'}),e=>e.status===400);assert.equal(f.calls.length,0);
 f.services.setClaims=async()=>{throw new Error('service unavailable');};await assert.rejects(managePlatformAdmin(f.services,request),e=>e.status===503);assert.equal(f.calls.at(-1)[1],'needs-reconciliation');
});

test('login deletion needs an exact confirmation and disables access before Auth deletion',async()=>{
 const f=fixture();await assert.rejects(managePlatformAdmin(f.services,{...request,action:'delete',confirmationUid:'wrong'}),e=>e.status===400);assert.equal(f.calls.length,0);
 await managePlatformAdmin(f.services,{...request,action:'delete',confirmationUid:'target'});
 assert(f.calls.findIndex(c=>c[0]==='disable-profile')<f.calls.findIndex(c=>c[0]==='delete-auth'));
 const ordinary=fixture(undefined,{});await assert.rejects(managePlatformAdmin(ordinary.services,{...request,action:'delete',confirmationUid:'target'}),e=>e.status===400);
});
