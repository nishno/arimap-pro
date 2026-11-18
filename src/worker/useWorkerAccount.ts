import {useEffect,useState} from 'react';
import {db,collection,doc,onSnapshot,query,where} from '../firebase';
import type {Membership,User} from '../types';
import {activeMembershipsFor,canUseManagementTools} from '../types';
export function useWorkerAccount(user:User|null,organizationId:string|null,memberships:Membership[]){
 const member=activeMembershipsFor(user,memberships,organizationId||undefined).find(m=>m.organizationId===organizationId);
 const [employee,setEmployee]=useState<any>(null),[entries,setEntries]=useState<any[]>([]),[payments,setPayments]=useState<any[]>([]);
 const [errors,setErrors]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState<Record<string,boolean>>({});
 const scope=`${user?.id||''}|${organizationId||''}|${member?.employeeId||''}|${member?.status||''}`;
 const [resolvedScope,setResolvedScope]=useState('');
 const [activities,setActivities]=useState<any[]>([]),[messages,setMessages]=useState<any[]>([]),[partners,setPartners]=useState<any[]>([]),[reviews,setReviews]=useState<any[]>([]);
 const [role,setRole]=useState<any>(null);
 useEffect(()=>{
  setEmployee(null);setEntries([]);setPayments([]);setErrors({});setLoading(true);setResolvedScope('');
  if(!user||user.isGuest||!organizationId||!member){setLoading(false);return;}
  let active=true;const matches=new Map<string,any>();let pending=0,denied=0,readSucceeded=false;
  function publish(){if(!active)return;const all=[...matches.values()];setEmployee(all.length===1?all[0]:null);setResolvedScope(scope);setLoading(pending>0);setErrors(e=>{const next={...e};if(all.length>1)next.identity='Multiple employee links need employer review.';else if(!all.length&&pending===0&&denied>0&&!readSucceeded)next.identity='Employee link could not be read. Ask your company administrator to check access and deployment.';else delete next.identity;return next;});}
  const callbacks:any[]=[];
  // An explicitly linked employee wins; otherwise support existing deterministic links and employer-issued userId.
  const ids=member.employeeId?[member.employeeId]:[user.id,`emp-${user.id}-${organizationId}`];
  for(const id of ids){pending++;let first=true;callbacks.push(onSnapshot(doc(db,'employees',id),snap=>{if(!active)return;readSucceeded=true;if(first){pending--;first=false;}const value=snap.exists()?snap.data():null;if(value?.organizationId===organizationId&&(!value.userId||value.userId===user.id))matches.set(id,{...value,id});else matches.delete(id);publish();},()=>{denied++;if(first){pending--;first=false;}publish();}));}
  if(!member.employeeId){pending++;let first=true;callbacks.push(onSnapshot(query(collection(db,'employees'),where('organizationId','==',organizationId),where('userId','==',user.id)),snapshot=>{if(!active)return;readSucceeded=true;if(first){pending--;first=false;}for(const [id,value]of matches)if(value.userId===user.id)matches.delete(id);snapshot.docs.forEach(d=>matches.set(d.id,{...d.data(),id:d.id}));publish();},()=>{denied++;if(first){pending--;first=false;}publish();}));}
  return()=>{active=false;callbacks.forEach(stop=>stop());};
 },[scope]);
 useEffect(()=>{
  setMessages([]);setPartners([]);if(!user||user.isGuest)return;let active=true;const parts=new Map<string,any[]>();
  const feeds=[{field:'authorId',value:user.id},{field:'recipientId',value:user.id},...(organizationId&&canUseManagementTools(user,organizationId,memberships)?[{field:'recipientId',value:organizationId}]:[])];
  const stops=feeds.map(({field,value},index)=>onSnapshot(query(collection(db,'forumPosts'),where('isDirectMessage','==',true),where(field,'==',value)),snapshot=>{if(!active)return;parts.set(String(index),snapshot.docs.map(d=>({...d.data(),id:d.id})));setMessages([...new Map([...parts.values()].flat().map(row=>[row.id,row])).values()].sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp))));},()=>{}));
  stops.push(onSnapshot(query(collection(db,'partnerProfiles'),where('isDiscoverable','==',true)),snapshot=>{if(active)setPartners(snapshot.docs.map(d=>({...d.data(),id:d.id,email:'',isProfileDiscoverable:true,roles:['worker']})));},()=>{}));
  return()=>{active=false;stops.forEach(stop=>stop());};
 },[user?.id,user?.isGuest,organizationId,member?.role,member?.status]);
 const employeeId=resolvedScope===scope?employee?.id:undefined;
 useEffect(()=>{
  setReviews([]);if(!user||user.isGuest)return;let active=true;const parts=new Map<string,any[]>();
  const feeds=[['targetId',user.id],['authorId',user.id],...(employeeId?[['targetId',employeeId]]:[])];
  const stops=feeds.map(([field,value],index)=>onSnapshot(query(collection(db,'reviews'),where(field,'==',value)),snapshot=>{if(!active)return;parts.set(String(index),snapshot.docs.map(d=>({...d.data(),id:d.id})));setReviews([...new Map([...parts.values()].flat().map(row=>[row.id,row])).values()]);},()=>{}));return()=>{active=false;stops.forEach(stop=>stop());};
 },[user?.id,user?.isGuest,employeeId]);
 useEffect(()=>{
  setRole(null);if(!employeeId||!organizationId||!employee?.roleId)return;
  const rawId=employee.roleId,canonical=rawId.startsWith(organizationId+'__')?rawId:organizationId+'__'+rawId;
  let active=true;const candidates=new Map<string,any>();
  const stops=[...new Set([canonical,rawId])].map(id=>onSnapshot(doc(db,'roles',id),snap=>{
   if(!active)return;const value=snap.exists()?snap.data():null;
   if(value?.organizationId===organizationId)candidates.set(id,{...value,id});else candidates.delete(id);
   setRole(candidates.get(canonical)||candidates.get(rawId)||null);
  },()=>{}));return()=>{active=false;stops.forEach(stop=>stop());};
 },[employeeId,employee?.roleId,organizationId]);

 useEffect(()=>{
  setEntries([]);setPayments([]);setActivities([]);setLoaded({});if(!user||!organizationId||!employeeId)return;
  let active=true;const paymentParts=new Map<string,any[]>();
  const feeds=[{key:'harvestEntries',collection:'harvestEntries'},{key:'activities',collection:'workerActivities'},{key:'paymentCredits',collection:'transactions',field:'creditAccountId'},{key:'paymentDebits',collection:'transactions',field:'debitAccountId'}];
  const stops=feeds.map(feed=>{
   const filters=[where('organizationId','==',organizationId),where('employeeId','==',employeeId)];
   if(feed.field)filters.push(where(feed.field,'==','acc-payroll'));
   return onSnapshot(query(collection(db,feed.collection),...filters),snapshot=>{
    if(!active)return;setLoaded(previous=>({...previous,[feed.key]:true}));const records=snapshot.docs.map(d=>({...d.data(),id:d.id}));
    if(feed.collection==='harvestEntries')setEntries(records);else if(feed.collection==='workerActivities')setActivities(records);else{paymentParts.set(feed.key,records);setPayments([...new Map([...paymentParts.values()].flat().map(row=>[row.id,row])).values()]);}
    setErrors(e=>{const copy={...e};delete copy[feed.key];return copy;});
   },()=>{if(active){setLoaded(previous=>({...previous,[feed.key]:true}));setErrors(e=>({...e,[feed.key]:feed.collection==='transactions'?'Payment records could not be read. Company access rules may need updating.':feed.collection==='workerActivities'?'Personal assignments could not be read. Ask your manager to publish them.':'Harvest records could not be read.'}));}});
  });
  return()=>{active=false;stops.forEach(stop=>stop());};
 },[user?.id,organizationId,employeeId]);
 const linkedRole=resolvedScope===scope&&employeeId&&role&&(role.id===employee?.roleId||role.legacyId===employee?.roleId||role.id===organizationId+'__'+employee?.roleId)?role:null;
 return {employee:resolvedScope===scope?employee:null,role:linkedRole,activities,messages,partners,reviews,entries,payments,loaded,errors:{...errors,...(errors.paymentCredits||errors.paymentDebits?{transactions:'Payment records could not be read. Company access rules may need updating.'}:{})},loading};
}
