import {doc,runTransaction,type Firestore} from 'firebase/firestore';
import type {User} from '../types';

// Auth creation and profile creation are separate Firebase operations. The auth
// listener may have already created a minimal profile; preserve its authority.
export async function saveCloudRegistration(db:Firestore,user:User){
 const ref=doc(db,'users',user.id);
 return runTransaction(db,async transaction=>{
  const existing=await transaction.get(ref);
  if(existing.exists()){
   const personal={firstName:user.firstName||'',lastName:user.lastName||'',name:user.name,isGuest:false};
   transaction.set(ref,personal,{merge:true});
   return {...existing.data(),...personal,id:user.id} as User;
  }
  const profile={...user,roles:['Guest'],tier:'Free',isPaid:false,subscriptionType:'Free',subscriptionStatus:'Unpaid',verificationStatus:'unverified',kycStatus:'none',isGuest:false};
  // Never store credentials or client-supplied privilege/subscription grants.
  for(const key of ['password','newPassword','confirmPassword','trialExpiry','trial_start_date','subscriptionExpiry','subscriptionPlan','grantSource','grantedBy','grantedAt'])delete (profile as any)[key];
  transaction.set(ref,JSON.parse(JSON.stringify(profile)));
  return profile as User;
 });
}
