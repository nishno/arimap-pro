import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
const env = await initializeTestEnvironment({projectId:'demo-agrimap',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
try {
 await env.withSecurityRulesDisabled(async context => {
  const db=context.firestore();
  await setDoc(doc(db,'organizations','farm-a'),{createdBy:'owner-a'});
  await setDoc(doc(db,'organizations','farm-b'),{createdBy:'owner-b'});
  await setDoc(doc(db,'memberships','member-a_farm-a'),{userId:'member-a',organizationId:'farm-a',role:'Employee'});
  await setDoc(doc(db,'users','member-a'),{id:'member-a',roles:['Guest'],email:'member@example.com',status:'active'});
  await setDoc(doc(db,'harvestEntries','entry-a'),{organizationId:'farm-a',kg:240});
  await setDoc(doc(db,'harvestEntries','entry-b'),{organizationId:'farm-b',kg:400});
 });
 const attacker=env.authenticatedContext('attacker').firestore();
 await assertFails(setDoc(doc(attacker,'users','attacker'),{id:'attacker',roles:['Guest','ROOT_SUPER_ADMIN']}));
 await assertFails(setDoc(doc(attacker,'users','attacker'),{id:'attacker',roles:['Guest'],password:'fake-test-value'}));
 await assertSucceeds(setDoc(doc(attacker,'users','attacker'),{id:'attacker',roles:['Guest']}));
 await assertFails(updateDoc(doc(attacker,'users','attacker'),{roles:['Admin']}));
 await assertFails(updateDoc(doc(attacker,'users','attacker'),{tier:'Pro'}));
 await assertFails(setDoc(doc(env.authenticatedContext('new-premium').firestore(),'users','new-premium'),{id:'new-premium',roles:['Guest'],tier:'Pro'}));
 await assertFails(setDoc(doc(attacker,'memberships','attacker_farm-a'),{userId:'attacker',organizationId:'farm-a',role:'Founder'}));
 await assertFails(setDoc(doc(attacker,'users','attacker'),{roles:['Admin'],organizationId:'farm-a'}));
 await assertFails(getDoc(doc(attacker,'harvestEntries','entry-a')));
 await assertFails(setDoc(doc(attacker,'x','y','plantationFeatures','z'),{organizationId:'farm-a'}));
 const member=env.authenticatedContext('member-a').firestore();
 await assertSucceeds(getDoc(doc(member,'harvestEntries','entry-a')));
 await assertFails(getDoc(doc(member,'harvestEntries','entry-b')));
 await assertFails(getDocs(collection(member,'harvestEntries')));
 await assertSucceeds(getDocs(query(collection(member,'harvestEntries'),where('organizationId','==','farm-a'))));
 await assertFails(updateDoc(doc(member,'harvestEntries','entry-a'),{organizationId:'farm-b'}));
 await assertSucceeds(setDoc(doc(member,'harvestEntries','new'),{organizationId:'farm-a',kg:50}));
 const owner=env.authenticatedContext('owner-a').firestore();
 await assertSucceeds(setDoc(doc(owner,'memberships','invited_farm-a'),{userId:'invited',organizationId:'farm-a',role:'Employee'}));
 await assertFails(updateDoc(doc(owner,'memberships','invited_farm-a'),{organizationId:'farm-b'}));
 const admin=env.authenticatedContext('trusted-admin',{admin:true}).firestore();
 await assertSucceeds(updateDoc(doc(admin,'users','attacker'),{roles:['Admin']}));
 const guest=env.unauthenticatedContext().firestore();
 await assertFails(getDoc(doc(guest,'harvestEntries','entry-a')));
 await assertFails(setDoc(doc(guest,'harvestEntries','new-guest'),{organizationId:'farm-a'}));

 await assertFails(updateDoc(doc(owner,'organizations','farm-a'),{tier:'Pro',isPaid:true}));
 await assertFails(updateDoc(doc(owner,'organizations','farm-a'),{trialExpiry:'2099-01-01'}));
 await assertSucceeds(updateDoc(doc(owner,'organizations','farm-a'),{name:'Renamed farm'}));
 const request={id:'owner-a_farm-a_pro',userId:'owner-a',organizationId:'farm-a',planId:'pro',status:'pending',requestedAt:new Date().toISOString()};
 await assertSucceeds(setDoc(doc(owner,'subscriptionRequests',request.id),request));
 await assertFails(updateDoc(doc(owner,'subscriptionRequests',request.id),{status:'approved'}));
 await assertFails(setDoc(doc(attacker,'subscriptionRequests','attacker_farm-a_pro'),{...request,id:'attacker_farm-a_pro',userId:'attacker'}));
 await assertFails(getDoc(doc(attacker,'subscriptionRequests',request.id)));
 await assertSucceeds(updateDoc(doc(admin,'subscriptionRequests',request.id),{status:'approved',reviewedBy:'trusted-admin',reviewedAt:new Date().toISOString(),reason:'Manual test grant'}));
 await assertSucceeds(setDoc(doc(admin,'billingAudit','test-audit'),{actorId:'trusted-admin',action:'test'}));
 await assertFails(updateDoc(doc(admin,'billingAudit','test-audit'),{action:'changed'}));
 await assertFails(setDoc(doc(attacker,'organizations','paid-new'),{createdBy:'attacker',tier:'Pro',isPaid:true}));
 const platformOwner=env.authenticatedContext('platform-owner',{platformOwner:true}).firestore();
 await env.withSecurityRulesDisabled(async context=>{
  await setDoc(doc(context.firestore(),'users','protected-owner'),{id:'protected-owner',roles:['ROOT_SUPER_ADMIN'],status:'active'});
  await setDoc(doc(context.firestore(),'platformAccess','protected-owner'),{owner:true,admin:true,disabled:false});
 });
 await assertFails(updateDoc(doc(admin,'users','protected-owner'),{status:'blocked'}));
 await assertFails(deleteDoc(doc(admin,'users','protected-owner')));
 await assertSucceeds(updateDoc(doc(platformOwner,'users','protected-owner'),{name:'Owner display name'}));
 await assertFails(deleteDoc(doc(platformOwner,'users','protected-owner')));

 await assertSucceeds(getDocs(collection(platformOwner,'users')));
 await assertFails(setDoc(doc(attacker,'platformAccess','attacker'),{disabled:false}));
 await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'platformAccess','trusted-admin'),{disabled:true}));
 await assertFails(getDocs(collection(admin,'users')));
 await assertSucceeds(getDocs(collection(platformOwner,'users')));
 await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'platformAccess','member-a'),{accountDisabled:true}));
 await assertFails(getDoc(doc(member,'harvestEntries','entry-a')));

 console.log('PASS: existing authorization scenarios plus owner billing escalation denial, request ownership, admin review and immutable billing audit.');

} finally { await env.cleanup(); }
