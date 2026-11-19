import React,{useState} from 'react';
import {useLanguage} from '../contexts/LanguageContext';
import {completedActivity} from './activities';
export function PersonalDashboard({user,data,organization,onNavigate,noticesOnly=false}:{noticesOnly?:boolean;user:any;data:any;organization:any;onNavigate:(mode:any)=>void}){
 const {language}=useLanguage(),ka=language==='ka',t=(ge:string,en:string)=>ka?ge:en;
 const scope=`personal-notices:${user.id}:${organization?.id||'personal'}`;
 const [read,setRead]=useState<Record<string,string>>(()=>{try{return JSON.parse(localStorage.getItem(scope)||'{}');}catch{return {};}});
 const items=(data.activities||[]).filter((a:any)=>!['withdrawn','cancelled','deleted'].includes(a.status.toLowerCase())&&!completedActivity(a)).sort((a:any,b:any)=>a.scheduledAt.localeCompare(b.scheduledAt));
 function mark(item:any){const next={...read,[item.id]:item.contentHash};setRead(next);try{localStorage.setItem(scope,JSON.stringify(next));}catch{}}
 return <section className="p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">{!noticesOnly&&<h1 className="text-2xl font-semibold">{t('ჩემი მართვის პანელი','My dashboard')}</h1>}
 <h2 className="text-xl font-semibold">{t('დაგეგმილი სამუშაოებისა და კრეფის შეტყობინებები','Planned work & harvest notifications')}</h2>
 {!data.employee&&<p>{t('დამსაქმებელმა თქვენი ანგარიში თანამშრომლის ჩანაწერს უნდა დაუკავშიროს.','Your employer needs to link your account to your employee record.')}</p>}
 {data.errors.activities&&<p role="alert">{t('დავალებები ჯერ ვერ ჩაიტვირთა. მიმართეთ მენეჯერს.','Assignments could not be loaded. Please contact your manager.')}</p>}
 {!items.length&&data.employee&&<p>{t('გამოქვეყნებული მომავალი დავალებები ჯერ არ არის.','No upcoming assignments have been published yet.')}</p>}
 {items.map((a:any)=><article key={a.id} className="border rounded-xl p-5 bg-white text-slate-800"><div className="flex gap-3 items-center"><h3 className="font-semibold">{a.title}</h3>{read[a.id]!==a.contentHash&&<span className="text-sm text-emerald-700">{t('ახალი / განახლებული','New / updated')}</span>}</div><p>{a.companyName} · {a.scheduledAt||t('თარიღი დასაზუსტებელია','Date to be confirmed')} · {a.kind==='harvest'?t('კრეფა','Harvest'):t('სამუშაო','Work')}</p><details onToggle={e=>{if(e.currentTarget.open)mark(a);}}><summary className="cursor-pointer py-3">{t('დავალების დეტალები','Assignment details')}</summary><p>{t('მდგომარეობა','Status')}: {a.status}</p>{a.sectorIds?.length>0&&<p>{t('სექტორები','Sectors')}: {a.sectorIds.join(', ')}</p>}{a.agreedRate!==null&&<p>{t('ჩაწერილი ტარიფი','Recorded rate')}: {a.agreedRate} · {a.paymentModel}</p>}<p>{t('ცვლილებისთვის დაუკავშირდით მენეჯერს.','Contact your manager for changes.')}</p></details></article>)}
 </section>;
}
