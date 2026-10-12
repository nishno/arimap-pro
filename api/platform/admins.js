import {initializeApp,getApps,applicationDefault,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {managePlatformAdmin} from '../../server/platform-management.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST required'});}
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'JSON required'});
 const token=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'')?.[1];if(!token)return res.status(401).json({error:'Sign in required'});
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Buffer.byteLength(JSON.stringify(req.body))>4096)return res.status(400).json({error:'Invalid request'});
 try{
  if(!process.env.FIREBASE_PROJECT_ID)throw new Error('Server configuration missing');
  const app=getApps().find(app=>app.name==='platform-management')||initializeApp({projectId:process.env.FIREBASE_PROJECT_ID,credential:process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?cert(JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)):applicationDefault()},'platform-management');
  const auth=getAuth(app),db=getFirestore(app);
  const services={verifyToken:token=>auth.verifyIdToken(token,true),getUser:uid=>auth.getUser(uid),disableAccount:uid=>auth.updateUser(uid,{disabled:true}),deleteAccount:uid=>auth.deleteUser(uid),disableProfile:async uid=>{const batch=db.batch();batch.set(db.doc(`platformAccess/${uid}`),{disabled:true,accountDisabled:true,admin:false,owner:false,updatedAt:FieldValue.serverTimestamp()});batch.set(db.doc(`users/${uid}`),{status:'deleted',roles:[],deletedAt:FieldValue.serverTimestamp()},{merge:true});await batch.commit();},profileExists:async uid=>(await db.doc(`users/${uid}`).get()).exists,setClaims:(uid,claims)=>auth.setCustomUserClaims(uid,claims),revokeTokens:uid=>auth.revokeRefreshTokens(uid),updateProfile:async(uid,grant)=>{const batch=db.batch();batch.set(db.doc(`users/${uid}`),{roles:grant?FieldValue.arrayUnion('ROOT_SUPER_ADMIN'):FieldValue.arrayRemove('ROOT_SUPER_ADMIN'),...(grant?{isGuest:false}:{})},{merge:true});batch.set(db.doc(`platformAccess/${uid}`),{disabled:!grant,admin:grant,owner:false,updatedAt:FieldValue.serverTimestamp()});await batch.commit();},startAudit:async data=>(await db.collection('platformAudit').add({...data,at:FieldValue.serverTimestamp()})).id,completeAudit:(id,status)=>db.doc(`platformAudit/${id}`).update({status,completedAt:FieldValue.serverTimestamp()})};
  return res.status(200).json(await managePlatformAdmin(services,{token,action:req.body.action,targetUid:req.body.targetUid,reason:req.body.reason,confirmationUid:req.body.confirmationUid}));
 }catch(error){return res.status(error.status||503).json({error:error.status?error.message:'Platform administration service unavailable. Check server credentials and project configuration.'});}
}
