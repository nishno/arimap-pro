import React,{useState} from 'react';
import type {User,Organization} from '../types';
import {db,auth,doc,setDoc} from '../firebase';
import {PROPOSED_PLANS} from '../billing/catalog';
import {useLanguage} from '../contexts/LanguageContext';
import {formatPlanPrice} from '../billing/locale';
import {toast} from 'sonner';
interface Props {isOpen:boolean;onClose:()=>void;currentUser:User;activeOrg?:Organization;onUpdateOrg?:(org:Organization)=>void;isSystemAdmin?:boolean}
export default function SubscriptionModal({isOpen,onClose,currentUser,activeOrg}:Props){
 const {language,currency}=useLanguage();
 const [busy,setBusy]=useState(false);if(!isOpen)return null;
 async function request(planId:string){
  if(!auth.currentUser||currentUser.isGuest||auth.currentUser.uid!==currentUser.id){toast.info('Register or sign in before requesting a farm plan.');return;}
  if(!activeOrg){toast.info('Select your farm workspace first.');return;}
  setBusy(true);try{const id=`${auth.currentUser.uid}_${activeOrg.id}_${planId}`;
   await setDoc(doc(db,'subscriptionRequests',id),{id,userId:auth.currentUser.uid,organizationId:activeOrg.id,planId,status:'pending',requestedCurrency:currency,requestedAt:new Date().toISOString()});
   toast.success('Request saved for administrator review. Your subscription has not changed.');onClose();
  }catch{toast.error('Request could not be saved. It may already exist or your farm role may not permit requests.');}finally{setBusy(false);}
 }
 return <div className="fixed inset-0 bg-black/70 z-[8000] flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="plan-heading" className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-auto p-8"><div className="flex justify-between"><h2 id="plan-heading" className="text-2xl font-bold">Plans for your farm</h2><button onClick={onClose} aria-label="Close plans">✕</button></div><p className="my-4">Proposed regional prices per farm workspace. Checkout is not enabled. Plan allowances and integrations are proposals, not activated services. A request does not grant access or confirm payment.</p><div className="grid md:grid-cols-2 gap-4">{PROPOSED_PLANS.map(plan=><article key={plan.id} className="border rounded-2xl p-6"><h3 className="font-bold text-xl">{plan.name}</h3><p>{plan.contactRequired?'By agreement':plan.freeDays?'Evaluation request':`${formatPlanPrice(plan,currency,language)}/${language==='ka'?'თვე':'month'} · ${currency}`}</p><ul className="my-4 list-disc pl-5">{plan.features.map(feature=><li key={feature}>{feature}</li>)}</ul><button className="bg-green-700 text-white rounded-lg px-4 py-2" disabled={busy} onClick={()=>request(plan.id)}>{plan.contactRequired?'Request a consultation':'Request this plan'}</button></article>)}</div><p className="mt-6">Trials and manual grants require authorized administrator approval. Automatic billing, usage quotas and full entitlement enforcement must be configured before paid launch.</p></section></div>;
}
