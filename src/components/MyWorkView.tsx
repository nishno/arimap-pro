import React from 'react';
import {useLanguage} from '../contexts/LanguageContext';
import {summarizeWorker} from '../worker/summary';
export default function MyWorkView({data,tasks=[],organization}:{data:any;tasks?:any[];organization?:any}){
 const {language}=useLanguage(),ka=language==='ka';const t=(ge:string,en:string)=>ka?ge:en;
 const summary=summarizeWorker(data.employee?.id||'',data.entries,data.payments,tasks.filter(task=>task.organizationId===organization?.id),organization?.currency);
 const payrollReady=data.loaded.paymentCredits&&data.loaded.paymentDebits&&!data.errors.transactions;
 return <section className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-5">
  <h1 className="text-2xl font-semibold">{t('ჩემი სამუშაო და ანაზღაურება','My work & earnings')}</h1>
  <p>{organization?.name}</p>
  {Object.entries(data.errors).filter(([key])=>!['paymentCredits','paymentDebits'].includes(key)).map(([key,value])=><p role="alert" key={key}>{!ka?String(value):key==='transactions'?'გადახდების ჩანაწერები მიუწვდომელია. ადმინისტრატორმა უნდა შეამოწმოს წვდომის წესები.':key==='harvestEntries'?'კრეფის ჩანაწერები მიუწვდომელია.':String(value).includes('Multiple')?'ანგარიში რამდენიმე თანამშრომელს უკავშირდება. დამსაქმებელმა კავშირი უნდა გადაამოწმოს.':'თანამშრომლის კავშირის წაკითხვა ვერ მოხერხდა. მიმართეთ კომპანიის ადმინისტრატორს.'}</p>)}
  {data.loading?<p role="status">{t('თანამშრომლის ანგარიშის შემოწმება…','Checking your employee link…')}</p>:!data.employee?<p role="status">{t('ამ კომპანიაში თქვენი ანგარიში თანამშრომლის ჩანაწერს ჯერ არ უკავშირდება. სთხოვეთ დამსაქმებელს HR ჩანაწერში აირჩიოს თქვენი ანგარიში და შეინახოს მოდულების უფლებები.','Your login is not linked to an employee record in this company. Ask your employer to select your account in the HR record and save its module access.')}</p>:<>
   <p>{data.employee.name}</p>
   <div className="grid gap-4 sm:grid-cols-2"><article className="border rounded-xl p-5 bg-white text-slate-900"><h2>{t('აღრიცხული მოსავალი','Recorded picked quantity')}</h2><p className="text-2xl font-semibold">{data.errors.harvestEntries||!data.loaded.harvestEntries?'—':summary.pickedKg.toFixed(2)+' kg'}</p></article><article className="border rounded-xl p-5 bg-white text-slate-900"><h2>{t('ნამუშევარი საათები','Recorded work hours')}</h2><p className="text-2xl font-semibold">{summary.hoursAvailable?summary.hours.toFixed(2):'—'}</p><p>{t('დაფუძნებულია ხელმისაწვდომი დავალებების ინდივიდუალურ სამუშაო ჩანაწერებზე.','From individual time logs in your accessible task records.')}</p></article></div>
   <h2 className="text-xl font-semibold">{t('დარიცხვა და გადახდები','Accruals & payments')}</h2>
   {!data.errors.transactions&&data.loaded.paymentCredits&&data.loaded.paymentDebits&&Object.keys(summary.balances).length===0&&<p>{t('თქვენს სახელზე სახელფასო გატარებები ჯერ არ მოიძებნა. ეს არ ნიშნავს, რომ ნამუშევარი არ გაქვთ.','No payroll ledger entries were found for your linked employee record. This does not mean no work was performed.')}</p>}
   {!payrollReady&&!data.errors.transactions&&<p role="status">{t('სახელფასო ჩანაწერების ჩატვირთვა…','Loading payroll records…')}</p>}
   {Object.entries(payrollReady?summary.balances:{}).map(([currency,total])=><article key={currency} className="border rounded-xl p-5 bg-white text-slate-900"><h3>{currency==='unspecified'?t('ვალუტა ჩანაწერში მითითებული არ არის','Currency not recorded'):currency}</h3><dl className="grid gap-4 sm:grid-cols-3"><div><dt>{t('დარიცხული','Accrued')}</dt><dd>{total.accrued.toFixed(2)}</dd></div><div><dt>{t('გადახდილი','Paid')}</dt><dd>{total.paid.toFixed(2)}</dd></div><div><dt>{t('ნაშთი','Balance')}</dt><dd>{total.balance.toFixed(2)}</dd></div></dl></article>)}
   <p>{t('თანხები ნაჩვენებია სახელფასო რეესტრიდან; ენით ან ვალუტის გადამრთველით კონვერტაცია არ ხდება.','Amounts come from payroll ledger entries; changing language or display currency does not convert them.')}</p>
   <h2 className="text-xl font-semibold">{t('კრეფის ისტორია','Harvest history')}</h2><ul className="space-y-2">{summary.harvest.map(e=><li key={e.id} className="border rounded-lg p-3">{e.scannedAt||e.timestamp} · {e.netWeightKg} kg · {e.crateCode||e.boxId||e.harvestEventId}</li>)}</ul>
   <h2 className="text-xl font-semibold">{t('სამუშაოების ისტორია','Work history')}</h2><ul className="space-y-2">{summary.work.map((w,i)=><li key={w.taskId+'-'+i} className="border rounded-lg p-3">{w.date} · {w.name} · {w.hours??'—'} {t('საათი','hours')}</li>)}</ul>
   <h2 className="text-xl font-semibold">{t('სახელფასო გატარებები','Payroll ledger history')}</h2><ul className="space-y-2">{(payrollReady?summary.payroll:[]).map(p=><li key={p.id} className="border rounded-lg p-3">{p.date} · {p.description} · {p.amount} · {p.debitAccountId==='acc-payroll'?t('გადახდა','Payment'):t('დარიცხვა','Accrual')}</li>)}</ul>
  </>}
 </section>;
}
