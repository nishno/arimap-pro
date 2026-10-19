import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,writeBatch} from 'firebase/firestore';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';
import {saveCloudRegistration} from '../src/cloud/registration.ts';
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw Error('Local Firebase emulators required');
const env=await initializeTestEnvironment({projectId:'demo-agrimap',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
const app=initializeApp({projectId:'demo-agrimap',apiKey:'demo-key',authDomain:'localhost'},'registration-regression');
const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
try{
 const {user}=await createUserWithEmailAndPassword(auth,`signup-${Date.now()}@example.test`,'test-only-long-password');
 const input={id:user.uid,name:'Guria Grower',firstName:'Guria',lastName:'Grower',email:user.email,roles:['ROOT_SUPER_ADMIN'],password:'not-for-storage',tier:'Enterprise',isPaid:true,subscriptionType:'Individual Subscription',status:'active'};
 const saved=await saveCloudRegistration(db,input);assert.deepEqual(saved.roles,['Guest']);assert.equal(saved.subscriptionType,'Free');assert.equal(saved.isPaid,false);assert.equal((await getDoc(doc(db,'users',user.uid))).data().password,undefined);
 const retry=await saveCloudRegistration(db,{...input,name:'Updated Grower'});assert.equal(retry.name,'Updated Grower');assert.deepEqual(retry.roles,['Guest']);
 const orgId='signup-farm-'+user.uid,batch=writeBatch(db);
 batch.set(doc(db,'organizations',orgId),{id:orgId,name:'Guria Farm',type:'LTD',createdBy:user.uid,tier:'Free',isPaid:false,subscriptionStatus:'Unpaid'});
 batch.set(doc(db,'memberships',user.uid+'_'+orgId),{id:user.uid+'_'+orgId,userId:user.uid,organizationId:orgId,role:'Founder',status:'active'});
 batch.set(doc(db,'layers','layer-'+orgId),{id:'layer-'+orgId,name:'Guria Farm',organizationId:orgId});
 batch.set(doc(db,'users',user.uid),{currentOrgId:orgId,isGuest:false},{merge:true});
 await batch.commit();assert.equal((await getDoc(doc(db,'organizations',orgId))).data().createdBy,user.uid);assert.deepEqual((await getDoc(doc(db,'users',user.uid))).data().roles,['Guest']);
 await signOut(auth);
 const other=await createUserWithEmailAndPassword(auth,`existing-${Date.now()}@example.test`,'test-only-long-password');
 await setDoc(doc(db,'users',other.user.uid),{id:other.user.uid,email:other.user.email,roles:['Guest'],status:'active',verificationStatus:'unverified'});
 const raced=await saveCloudRegistration(db,{...input,id:other.user.uid,email:other.user.email,name:'Completed profile'});assert.equal(raced.name,'Completed profile');assert.equal(raced.subscriptionType,undefined);assert.deepEqual(raced.roles,['Guest']);
 console.log('PASS: real Firebase Auth signup + profile transaction, retry/auth-listener race, protected billing/roles, atomic company/Founder/layer creation under repository rules.');
}finally{await deleteApp(app);await env.cleanup();}
