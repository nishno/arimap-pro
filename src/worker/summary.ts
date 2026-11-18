export function summarizeWorker(employeeId:string, entries:any[], transactions:any[], tasks:any[], companyCurrency?:string,activities:any[]=[]){
 const live=(row:any)=>!row.isDeleted&&!row.isVoided&&row.status!=='voided'&&row.status!=='deleted';
 const harvest=entries.filter(e=>e.employeeId===employeeId&&live(e));
 const quantities=new Map<string,number>();
 for(const entry of harvest){const key=entry.harvestEventId||'entry:'+entry.id;quantities.set(key,(quantities.get(key)||0)+(typeof entry.netWeightKg==='number'&&Number.isFinite(entry.netWeightKg)?entry.netWeightKg:0));}
 for(const activity of activities)if(activity.employeeId===employeeId&&activity.kind==='harvest'&&typeof activity.recordedQuantityKg==='number'&&Number.isFinite(activity.recordedQuantityKg)&&activity.recordedQuantityKg>=0)quantities.set(activity.sourceId,activity.recordedQuantityKg);
 const payroll=transactions.filter(t=>t.employeeId===employeeId&&live(t)&&(t.creditAccountId==='acc-payroll'||t.debitAccountId==='acc-payroll'));
 const finite=(n:any)=>typeof n==='number'&&Number.isFinite(n)?n:0;
 const balances:Record<string,{accrued:number;paid:number;balance:number}>={};
 for(const transaction of payroll){
  const currency=transaction.currency||companyCurrency||'unspecified';
  const total=balances[currency]||(balances[currency]={accrued:0,paid:0,balance:0});
  if(transaction.creditAccountId==='acc-payroll')total.accrued+=finite(transaction.amount);
  if(transaction.debitAccountId==='acc-payroll')total.paid+=finite(transaction.amount);
  total.balance=total.accrued-total.paid;
 }
 const work=tasks.filter(live).flatMap(task=>(task.employeeHours||[]).filter((log:any)=>log.employeeId===employeeId).map((log:any)=>({taskId:task.id,date:task.date,name:task.workName,hours:typeof log.hours==='number'&&Number.isFinite(log.hours)?log.hours:null,recordedPay:typeof log.totalPay==='number'?log.totalPay:null})));
 return {harvest,payroll,work,balances,pickedKg:[...quantities.values()].reduce((sum,value)=>sum+value,0),hoursAvailable:work.some(log=>log.hours!==null),hours:work.reduce((sum,log)=>sum+(log.hours??0),0)};
}
