import {parseArgs} from 'node:util';
// Server/console only: never import this file into a browser bundle.
const {values}=parseArgs({options:{uid:{type:'string'},project:{type:'string'},confirm:{type:'boolean'},help:{type:'boolean'},role:{type:'string',default:'admin'}}});
if(values.help){console.log('Usage: npm run platform:grant-admin -- --project FIREBASE_PROJECT_ID --uid FIREBASE_USER_UID --role admin|owner --confirm\nRequires trusted Application Default Credentials on this server. Never put service-account keys in the repository.');}
else{
 if(!values.uid||!values.project||!values.confirm)throw new Error('Provide the exact Firebase project/user UID and --confirm. Run with --help for instructions.');
 if(!['admin','owner'].includes(values.role))throw new Error('Role must be admin or owner');
 if(values.uid.length>128||values.uid.includes('/'))throw new Error('Invalid Firebase UID');
 const {initializeApp,applicationDefault}=await import('firebase-admin/app');
 const {getAuth}=await import('firebase-admin/auth');
 const {getFirestore,FieldValue}=await import('firebase-admin/firestore');
 const app=initializeApp({credential:applicationDefault(),projectId:values.project});
 const auth=getAuth(app),user=await auth.getUser(values.uid);
 if(user.disabled)throw new Error('Target Auth account is disabled. Resolve its status explicitly before assigning platform access.');
 const db=getFirestore(app),ref=db.doc(`users/${user.uid}`),profile=await ref.get();
 if(!profile.exists)throw new Error('This Firebase user has no application profile. Register in the application first.');
 await auth.setCustomUserClaims(user.uid,{...user.customClaims,admin:true,...(values.role==='owner'?{platformOwner:true}:{})});
 await ref.update({roles:FieldValue.arrayUnion('ROOT_SUPER_ADMIN'),isGuest:false});
 await db.doc(`platformAccess/${user.uid}`).set({disabled:false,admin:true,owner:values.role==='owner'||user.customClaims?.platformOwner===true,updatedAt:FieldValue.serverTimestamp()});
 await db.collection('platformAudit').add({targetUid:user.uid,action:values.role==='owner'?'grant-platform-owner':'grant-admin',source:'trusted-console',at:FieldValue.serverTimestamp()});
 console.log('Requested platform role granted to the specified user. Sign out and sign in again to refresh the ID token. No password was changed.');
}
