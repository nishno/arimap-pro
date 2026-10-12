import { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase';
export function usePlatformAdmin(profileId?: string) {
 const [verifiedUid,setVerifiedUid]=useState<{uid:string;owner:boolean}|null>(null);
 useEffect(()=>{let generation=0,active=true;
  const unsubscribe=onIdTokenChanged(auth,async user=>{const current=++generation;setVerifiedUid(null);if(!user)return;
   try{const token=await user.getIdTokenResult();if(active&&current===generation&&(token.claims.admin===true||token.claims.platformOwner===true))setVerifiedUid({uid:user.uid,owner:token.claims.platformOwner===true});}catch{if(active&&current===generation)setVerifiedUid(null);}
  });return()=>{active=false;generation++;unsubscribe();};
 },[]);
 const valid=Boolean(profileId&&verifiedUid?.uid===profileId&&auth.currentUser?.uid===profileId);
 return {isAdmin:valid,isOwner:valid&&verifiedUid?.owner===true};
}
