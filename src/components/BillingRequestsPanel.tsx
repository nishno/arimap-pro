import React,{useEffect,useState} from 'react';
import {collection,onSnapshot,doc,runTransaction} from 'firebase/firestore';
import {db,auth} from '../firebase';
import {PROPOSED_PLANS} from '../billing/catalog';
import type {Organization} from '../types';
type Request={id:string;userId:string;organizationId:string;planId:string;status:string;requestedCurrency?:'USD'|'GEL';requestedAt:string};
export default function BillingRequestsPanel({organizations}:{organizations:Organization[]}){
 const [requests,setRequests]=useState<Request[]>([]),[error,setError]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>onSnapshot(collection(db,'subscriptionRequests'),snapshot=>setRequests(snapshot.docs.map(d=>({...d.data(),id:d.id} as Request))),()=>setError('Requests could not be loaded. Trusted admin claims and deployed rules are required.')),[]);
 async function review(request:Request,approve:boolean){
  if(reason.trim().length<5){setError('Enter a review reason of at least five characters.');return;}setBusy(true);setError('');
  try{const user=auth.currentUser;if(!user||!((await user.getIdTokenResult()).claims.admin===true||(await user.getIdTokenResult()).claims.platformOwner===true))throw new Error('Trusted administrator access required');
   const plan=PROPOSED_PLANS.find(p=>p.id===request.planId);if(!plan||(approve&&plan.contactRequired))throw new Error('Custom agreements need a reviewed contract. Reject or leave pending.');
   const now=new Date(),expires=new Date(now.getTime()+(plan.freeDays||30)*86400000).toISOString();
   await runTransaction(db,async transaction=>{const requestRef=doc(db,'subscriptionRequests',request.id),orgRef=doc(db,'organizations',request.organizationId);
    const current=await transaction.get(requestRef),org=await transaction.get(orgRef);
    if(!current.exists()||current.data().status!=='pending'||current.data().planId!==request.planId||current.data().organizationId!==request.organizationId)throw new Error('Request changed or has already been reviewed.');
    if(!org.exists())throw new Error('Farm workspace no longer exists.');
    if(approve&&plan.freeDays&&(org.data().trialStartedAt || org.data().trial_start_date))throw new Error('This farm has already used a trial.');
    if(approve)transaction.update(orgRef,{tier:plan.id==='starter'?'Free':'Pro',subscriptionPlan:plan.id,subscriptionStatus:plan.freeDays?'Trial':'Manual',subscriptionExpiry:expires,isPaid:false,grantSource:'manual',grantedBy:user.uid,grantedAt:now.toISOString(),...(plan.freeDays?{trialStartedAt:now.toISOString(),trial_start_date:now.toISOString(),trialExpiry:expires}:{})});
    transaction.update(requestRef,{status:approve?'approved':'rejected',reviewedBy:user.uid,reviewedAt:now.toISOString(),reason:reason.trim()});
    transaction.set(doc(collection(db,'billingAudit')),{requestId:request.id,organizationId:request.organizationId,actorId:user.uid,action:approve?'manual-grant':'request-rejected',at:now.toISOString(),reason:reason.trim()});
   });setReason('');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="bg-white border rounded-2xl p-6 mb-6"><h2 className="font-bold text-xl">Plan requests and manual grants</h2><p>Manual grants do not mark a payment as received. Prices are proposed; automatic charging is not connected.</p><p>Offline local farms appear only after their owners connect them to the platform.</p><label>Review reason<input className="border p-2 block w-full my-3" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>{error&&<p role="alert">{error}</p>}<div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>Farm ID</th><th>User ID</th><th>Plan</th><th>Currency</th><th>Status</th><th>Review</th></tr></thead><tbody>{requests.map(request=><tr key={request.id}><td className="p-2">{request.organizationId}</td><td>{request.userId}</td><td>{request.planId}</td><td>{request.requestedCurrency||'USD'}</td><td>{request.status}</td><td>{request.status==='pending'&&<><button disabled={busy} onClick={()=>review(request,true)}>Grant manually</button> · <button disabled={busy} onClick={()=>review(request,false)}>Reject</button></>}</td></tr>)}</tbody></table></div>{!requests.length&&!error&&<p>No plan requests.</p>}<h3 className="font-bold mt-6">Cloud workspace subscriptions</h3><div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>Workspace</th><th>Plan</th><th>Currency</th><th>Status</th><th>Expiry</th></tr></thead><tbody>{organizations.map(org=><tr key={org.id}><td>{org.name}</td><td>{org.subscriptionPlan||org.tier}</td><td>{org.subscriptionStatus}</td><td>{org.subscriptionExpiry||org.trialExpiry||'Not set'}</td></tr>)}</tbody></table></div></section>;
}
