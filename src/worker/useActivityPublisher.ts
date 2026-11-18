import {useEffect} from 'react';
import {db,collection,query,where,onSnapshot,getDocs,writeBatch,doc} from '../firebase';
import {projectActivities} from './activities';
export function useActivityPublisher(enabled:boolean,organizationId:string|undefined,companyName:string,userId:string|undefined){
 useEffect(()=>{
  if(!enabled||!organizationId||!userId)return;let active=true;
  const stops=(['task','harvest'] as const).map(kind=>{
   let chain=Promise.resolve();
   return onSnapshot(query(collection(db,kind==='task'?'workAssignments':'harvestEvents'),where('organizationId','==',organizationId)),snapshot=>{
    if(snapshot.metadata?.fromCache||snapshot.metadata?.hasPendingWrites)return;
    const sources=snapshot.docs.map(d=>({...d.data(),id:d.id}));
    chain=chain.catch(()=>{}).then(async()=>{
     if(!active)return;
     const old=await getDocs(query(collection(db,'workerActivities'),where('organizationId','==',organizationId),where('kind','==',kind)));
     if(old.metadata?.fromCache||!active)return;
     const previous=old.docs.map(d=>({...d.data(),id:d.id}) as any);
     const next=await projectActivities(organizationId,companyName,kind,sources,previous);
     const changes=next.filter(row=>previous.find(old=>old.id===row.id)?.contentHash!==row.contentHash);
     for(let offset=0;offset<changes.length;offset+=200){
      if(!active)return;const batch=writeBatch(db);
      changes.slice(offset,offset+200).forEach(row=>batch.set(doc(db,'workerActivities',row.id),{...row,publishedBy:userId,updatedAt:new Date().toISOString()}));await batch.commit();
     }
    }).catch(error=>console.error('Personal assignment publication failed',error));
   },error=>console.error('Personal assignment source unavailable',error));
  });return()=>{active=false;stops.forEach(stop=>stop());};
 },[enabled,organizationId,companyName,userId]);
}
