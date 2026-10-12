import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {initializeApp as adminApp,cert} from 'firebase-admin/app';
import {getAuth as adminAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {initializeApp as clientApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from 'firebase/auth';
import handler from '../api/platform/admins.js';
if(!/^127\.0\.0\.1:/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||'')||!/^127\.0\.0\.1:/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw new Error('Run only through local Auth and Firestore emulators');
const project='demo-agrimap';
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const service={project_id:project,client_email:'test-admin@demo-agrimap.iam.gserviceaccount.com',private_key:privateKey};
process.env.FIREBASE_PROJECT_ID=project;process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT=JSON.stringify(service);
const app=adminApp({projectId:project,credential:cert(service)},'integration-fixture');
const auth=adminAuth(app),db=getFirestore(app);
for(const [uid,email]of [['owner','owner@example.test'],['staff','staff@example.test']]){
 await auth.createUser({uid,email,password:'test-only-long-password'});await db.doc(`users/${uid}`).set({id:uid,name:uid,roles:['Guest']});
}
await auth.setCustomUserClaims('owner',{platformOwner:true,admin:true});
await db.doc('platformAccess/owner').set({owner:true,admin:true,disabled:false});
await db.doc('organizations/retained-farm').set({createdBy:'staff',name:'Preserve this farm'});
const clients=[];
async function token(email){const app=clientApp({apiKey:'demo-key',projectId:project},email);clients.push(app);const client=getAuth(app);connectAuthEmulator(client,`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);return(await signInWithEmailAndPassword(client,email,'test-only-long-password')).user.getIdToken();}
async function call(token,body){const result={status:0,body:null};const res={setHeader(){},status(code){result.status=code;return res;},json(body){result.body=body;return res;}};await handler({method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body},res);return result;}
try{
 const owner=await token('owner@example.test');
 const granted=await call(owner,{action:'grant',targetUid:'staff',reason:'Integration approval'});assert.equal(granted.status,200,JSON.stringify(granted.body));
 assert.equal((await auth.getUser('staff')).customClaims.admin,true);assert.equal((await db.doc('platformAccess/staff').get()).data().admin,true);
 const staff=await token('staff@example.test');assert.equal((await call(staff,{action:'grant',targetUid:'owner',reason:'Attempted escalation'})).status,403);
 assert.equal((await call(owner,{action:'revoke',targetUid:'owner',reason:'Attempted owner change'})).status,403);
 assert.equal((await call(owner,{action:'revoke',targetUid:'staff',reason:'Integration revocation'})).status,200);
 assert.notEqual((await auth.getUser('staff')).customClaims.admin,true);assert.equal((await db.doc('platformAccess/staff').get()).data().disabled,true);
 assert.equal((await call(owner,{action:'grant',targetUid:'staff',reason:'Prepare deletion test'})).status,200);
 const deleted=await call(owner,{action:'delete',targetUid:'staff',confirmationUid:'staff',reason:'Integration login deletion'});assert.equal(deleted.status,200,JSON.stringify(deleted.body));
 await assert.rejects(auth.getUser('staff'),error=>error.code==='auth/user-not-found');
 assert.equal((await db.doc('platformAccess/staff').get()).data().accountDisabled,true);
 assert.equal((await db.doc('users/staff').get()).data().status,'deleted');assert((await db.doc('organizations/retained-farm').get()).exists);
 const audits=await db.collection('platformAudit').get();assert.equal(audits.size,4);assert(audits.docs.every(d=>d.data().status==='completed'));
 console.log('PASS: actual Auth/Firestore emulator owner tokens, grant/revoke, non-owner denial, protected owner, login deletion, retained farm records and completed audits.');
}finally{await Promise.all(clients.map(deleteApp));}
