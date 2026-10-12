export class PlatformError extends Error{constructor(status,message){super(message);this.status=status;}}
export async function managePlatformAdmin(services,{token,action,targetUid,reason,confirmationUid}){
 if(!token)throw new PlatformError(401,'Sign in with your platform-owner account');
 let verified;try{verified=await services.verifyToken(token);}catch{throw new PlatformError(401,'Invalid or revoked session');}
 const actor=await services.getUser(verified.uid);
 if(actor.disabled||actor.customClaims?.platformOwner!==true)throw new PlatformError(403,'Platform-owner access required');
 if(!['grant','revoke','delete'].includes(action)||typeof targetUid!=='string'||!targetUid||targetUid.length>128||targetUid.includes('/')||typeof reason!=='string'||reason.trim().length<5||reason.length>500)throw new PlatformError(400,'Choose an action, existing user UID and review reason');
 const target=await services.getUser(targetUid);
 if(target.uid===actor.uid||target.customClaims?.platformOwner===true)throw new PlatformError(403,'Platform-owner accounts cannot be changed here');
 if(target.disabled&&action!=='delete')throw new PlatformError(400,'Target account is disabled');
 if(action==='grant'&&!(await services.profileExists(target.uid)))throw new PlatformError(400,'Target must register in the application first');
 if(action==='delete'&&(confirmationUid!==target.uid||target.customClaims?.admin!==true))throw new PlatformError(400,'Deleting a super-admin account requires its exact UID confirmation');
 const claims={...target.customClaims};if(action==='grant')claims.admin=true;else delete claims.admin;
 // Audit intent first: a cloud Auth operation and Firestore cannot be one transaction.
 const audit=await services.startAudit({actorId:actor.uid,targetUid:target.uid,action,reason:reason.trim(),status:'started'});
 try{
  if(action==='delete'){
   await services.disableProfile(target.uid);await services.disableAccount(target.uid);await services.revokeTokens(target.uid);await services.deleteAccount(target.uid);
  }else{
  if(action==='revoke')await services.updateProfile(target.uid,false);
  await services.setClaims(target.uid,claims);await services.revokeTokens(target.uid);
  if(action==='grant')await services.updateProfile(target.uid,true);
  }
  await services.completeAudit(audit,'completed');
 }catch(error){await services.completeAudit(audit,'needs-reconciliation').catch(()=>{});throw new PlatformError(503,'Operation needs review; check the audit record before retrying');}
 return {ok:true,targetUid:target.uid,action};
}
