export type WorkerActivity={id:string;organizationId:string;companyName:string;employeeId:string;sourceId:string;kind:'task'|'harvest';title:string;status:string;scheduledAt:string;hours:number|null;recordedPay:number|null;recordedQuantityKg:number|null;agreedRate:number|null;paymentModel:string;sectorIds:string[];contentHash:string;updatedAt?:string;publishedBy?:string};
const number=(value:any)=>typeof value==='number'&&Number.isFinite(value)?value:null;
export async function digest(value:any){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function projectActivities(organizationId:string,companyName:string,kind:'task'|'harvest',sources:any[],previous:WorkerActivity[]=[]){
 const result:WorkerActivity[]=[];
 for(const source of sources.filter(s=>s.organizationId===organizationId)){
  const ids=kind==='task'?[...new Set([...(source.assignedEmployeeIds||[]),...(source.employeeHours||[]).map((log:any)=>log.employeeId)])]:[...new Set((source.assignedPickers||[]).map((picker:any)=>picker.employeeId))];
  for(const employeeId of ids as string[]){
   if(typeof employeeId!=='string'||!employeeId)continue;
   const own=kind==='task'?(source.employeeHours||[]).find((log:any)=>log.employeeId===employeeId):(source.assignedPickers||[]).find((picker:any)=>picker.employeeId===employeeId);
   const payload={organizationId,companyName,employeeId,sourceId:source.id,kind,title:String(kind==='task'?source.workName:source.name),status:source.isDeleted?'cancelled':String(source.status||'planned'),scheduledAt:String(kind==='task'?source.date||'':source.plannedStartDate||source.actualStartDate||''),hours:number(kind==='task'?own?.hours:own?.manualHours),recordedPay:number(kind==='task'?own?.totalPay:undefined),recordedQuantityKg:number(kind==='harvest'?own?.manualNetWeight:undefined),agreedRate:number(own?.rate),paymentModel:String(own?.paymentModel||''),sectorIds:(source.sectorIds||[source.sectorId]).filter((s:any)=>typeof s==='string')};
   result.push({...payload,id:await digest([organizationId,kind,source.id,employeeId]),contentHash:await digest(payload)});
  }
 }
 const ids=new Set(result.map(row=>row.id));
 for(const old of previous.filter(row=>row.organizationId===organizationId&&row.kind===kind&&!ids.has(row.id))){
  const payload={...old,status:'withdrawn'};delete payload.updatedAt;delete payload.publishedBy;delete (payload as any).contentHash;
  result.push({...old,status:'withdrawn',contentHash:await digest(payload)});
 }
 return result;
}
export const completedActivity=(activity:WorkerActivity)=>['completed','done','finished','closed'].includes(activity.status.toLowerCase());

export function personalTasks(employeeId:string,direct:any[],activities:WorkerActivity[]){
 const rows=new Map(direct.map(task=>[task.id,task]));
 for(const a of activities.filter(row=>row.kind==='task'&&row.employeeId===employeeId))if(!rows.has(a.sourceId))rows.set(a.sourceId,{id:a.sourceId,organizationId:a.organizationId,workName:a.title,date:a.scheduledAt,status:a.status,employeeHours:[{employeeId,hours:a.hours,totalPay:a.recordedPay}]});
 return [...rows.values()];
}
