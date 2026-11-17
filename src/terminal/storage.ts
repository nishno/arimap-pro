export type Context = {schemaVersion:number;organizationId:string;userId:string;farmName:string;preparedAt:string;events:{id:string;name:string;status:string}[];workers:{id:string;name:string}[]};
export type Operation = {schemaVersion:1;actorId:string;operationId:string;organizationId:string;deviceId:string;eventId:string;workerId:string;boxQrId:string;grossKg:number;tareKg:number;capturedAt:string};
export type Row = {key:string;scope:string;actorId:string;operation:Operation;delivery:'pending'|'received';server?:any;localDuplicate:boolean;error?:string};
const database = () => new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open('agrimap-terminal-pilot-v1',1);
 request.onupgradeneeded=()=>{request.result.createObjectStore('rows',{keyPath:'key'});request.result.createObjectStore('meta');};
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
async function access<T>(store:string,mode:IDBTransactionMode,action:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let value:T;const request=action(tx.objectStore(store));request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error('Local storage failed'));};});
}
export const scopeOf=(c:Context)=>`${location.origin}|${c.organizationId}|${c.userId}`;
export const rows=async(scope:string)=>(await access<Row[]>('rows','readonly',s=>s.getAll())).filter(r=>r.scope===scope);
export const saveRow=(row:Row)=>access('rows','readwrite',s=>s.put(row));
export const getMeta=<T>(key:string)=>access<T>('meta','readonly',s=>s.get(key));
export const setMeta=(key:string,value:any)=>access('meta','readwrite',s=>s.put(value,key));
export async function deviceId(){let id=await getMeta<string>('deviceId');if(!id){id=crypto.randomUUID();await setMeta('deviceId',id);}return id;}
export async function enqueue(context:Context,input:Omit<Operation,'schemaVersion'|'actorId'|'operationId'|'organizationId'|'deviceId'|'capturedAt'>){
 const scope=scopeOf(context), previous=await rows(scope);
 const operation:Operation={...input,schemaVersion:1,actorId:context.userId,operationId:crypto.randomUUID(),organizationId:context.organizationId,deviceId:await deviceId(),capturedAt:new Date().toISOString()};
 const row:Row={key:scope+'|'+operation.operationId,scope,actorId:context.userId,operation,delivery:'pending',localDuplicate:previous.some(r=>r.operation.eventId===input.eventId&&r.operation.boxQrId===input.boxQrId&&r.server?.status!=='rejected')};
 await saveRow(row);return row;
}
export async function request(path:string,input?:unknown){
 const response=await fetch('/api/local/terminal/'+path,{credentials:'same-origin',cache:'no-store',...(input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{})});
 const value=await response.json();if(!response.ok)throw new Error(value.error||`Server error ${response.status}`);return value;
}
export async function synchronize(context:Context){
 // Never submit the previous account's queue under a new session.
 const fresh:Context=await request('bootstrap');
 if(fresh.organizationId!==context.organizationId||fresh.userId!==context.userId)throw new Error('Account changed. Reopen terminal; pending work remains isolated.');
 const scope=scopeOf(context);
 for(const row of await rows(scope)){
  if(row.delivery!=='pending')continue;
  try{const result=await request('operations',row.operation);await saveRow({...row,delivery:'received',server:result.record,error:undefined});}
  catch(error){await saveRow({...row,error:String((error as Error).message)});throw error;}
 }
 let cursor=await getMeta<number>(scope+'|cursor')||0;
 for(let page=0;page<20;page++){
  const result=await request('changes?cursor='+cursor);
  for(const record of result.records){
   const current=(await rows(scope)).find(r=>r.operation.operationId===record.operationId);
   await saveRow({key:scope+'|'+record.operationId,scope,actorId:record.actorId,operation:current?.operation||record,delivery:'received',server:record,localDuplicate:current?.localDuplicate||false});
  }
  cursor=result.cursor;await setMeta(scope+'|cursor',cursor);
  if(!result.hasMore)break;
 }
 return fresh;
}
