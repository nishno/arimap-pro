import {useEffect,useState} from 'react';
import type {AppMode} from '../types';
import type {GuideAction} from './catalog';
// Only opening controls are allowed. Never include save/delete/confirm operations here.
const OPEN_ACTIONS:Record<GuideAction,{mode:AppMode;buttons:RegExp[]}>={
 'new-harvest':{mode:'harvesting',buttons:[/^Start New Session$|ახალი სესიის დაწყება/i]},
 'stock-add':{mode:'stock',buttons:[/^\+ Add Item$|ნივთის დამატება/i]},
 purchases:{mode:'stock',buttons:[/^Orders & Logistics$|შეკვეთები და ლოგისტიკა/i]},
 'crop-varieties':{mode:'dashboard',buttons:[/^Map Tools$|რუკის ხელსაწყოები/i,/^Crops Management$|კულტურების მართვა/i]},
 announcements:{mode:'community',buttons:[/^Post Announcement$|განცხადების დამატება/i]},
 clinical:{mode:'ai',buttons:[/^Diagnostics & Clinical Tools$|დიაგნოსტიკა.*კლინიკ/i]},
 ledger:{mode:'accounting',buttons:[/^Audit Ledger$|აუდიტის ჟურნალი/i]},
 weather:{mode:'labs',buttons:[/Hardware & Devices|აპარატურა და მოწყობილობები/i,/^Weather Station & AI$|ამინდის სადგური/i]},
 soil:{mode:'labs',buttons:[/Hardware & Devices|აპარატურა და მოწყობილობები/i,/^Soil pH\/EC & Water$|ნიადაგის/i]},
 hr:{mode:'tools',buttons:[/^Human Resources$|ადამიანური რესურსები/i]},
 teams:{mode:'tools',buttons:[/^Teams & Units$|გუნდები და ერთეულები/i]}
};
export function useGuideNavigation(mode:AppMode,navigate:(mode:AppMode)=>void,canNavigate:(mode:AppMode)=>boolean,scope:string){
 const [pending,setPending]=useState<{action:GuideAction;scope:string;deadline:number}|null>(null);
 const [notice,setNotice]=useState(false);
 function open(action:GuideAction){const target=OPEN_ACTIONS[action];if(!target||!canNavigate(target.mode))return;setNotice(false);setPending({action,scope,deadline:Date.now()+10000});navigate(target.mode);}
 useEffect(()=>{
  if(!pending)return;
  const target=OPEN_ACTIONS[pending.action];
  if(scope!==pending.scope||!canNavigate(target.mode)||mode!==target.mode){setPending(null);return;}
  let index=0,done=false;
  const attempt=()=>{if(done)return;const pattern=target.buttons[index];const button=[...document.querySelectorAll<HTMLButtonElement>('button')].find(button=>!button.disabled&&button.getClientRects().length>0&&pattern.test((button.textContent||'').trim()));if(!button)return;index++;button.click();if(index===target.buttons.length){done=true;setPending(null);} };
  // A fresh render mounts the requested module; wait for its real controls, not a guessed delay.
  const observer=new MutationObserver(attempt);observer.observe(document.body,{subtree:true,childList:true,attributes:true});attempt();
  const timeout=window.setTimeout(()=>{if(!done){done=true;setPending(null);setNotice(true);}},Math.max(0,pending.deadline-Date.now()));
  return()=>{done=true;observer.disconnect();clearTimeout(timeout);};
 },[pending,mode,scope,canNavigate]);
 return {open,notice,dismiss:()=>setNotice(false)};
}
