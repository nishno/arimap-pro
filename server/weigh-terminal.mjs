import {moduleAccess} from './module-access.mjs';
import {createHash} from 'node:crypto';
import {FarmError} from './farm-store.mjs';
const id = value => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
export function weighTerminal(store) {
 const db=store.db,grants=moduleAccess(store);
 db.exec(`CREATE TABLE IF NOT EXISTS terminal_operations (
  operation_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, actor_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL,
  received_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS terminal_changes (seq INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS terminal_reviews (id INTEGER PRIMARY KEY, operation_id TEXT NOT NULL, actor_id TEXT NOT NULL, at TEXT NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL, revision INTEGER NOT NULL);`);
 const operator = user => {if(user?.role!=='owner'&&!grants.get(user?.id)?.includes('harvesting'))throw new FarmError(403,'Harvest module access required');};
 const owner = user => {if(user?.role!=='owner')throw new FarmError(403,'Terminal pilot requires farm owner access');};
 const transaction = fn => {db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const documents = col => db.prepare('SELECT path,body FROM documents WHERE path LIKE ?').all(col+'/%').map(r=>({...JSON.parse(r.body),id:r.path.split('/')[1]})).filter(r=>r.organizationId===store.farm().id);
 const record = row => ({...JSON.parse(row.body),actorId:row.actor_id,receivedAt:row.received_at,status:row.status,revision:row.revision,
  reviews:db.prepare('SELECT actor_id AS actorId,at,decision,reason,revision FROM terminal_reviews WHERE operation_id=? ORDER BY id').all(row.operation_id)});
 const changed = operationId => db.prepare('INSERT INTO terminal_changes(operation_id) VALUES(?)').run(operationId);
 return {
  bootstrap(user) {
   operator(user);
   return {canReview:user.role==='owner',schemaVersion:1,mode:'LOCAL',pilot:true,organizationId:store.farm().id,userId:user.id,farmName:store.farm().name,
    events:documents('harvestEvents').filter(e=>!e.isDeleted&&e.status!=='deleted').map(e=>({id:e.id,name:e.name,status:e.status})),
    workers:documents('employees').filter(e=>e.status==='active').map(e=>({id:e.id,name:e.name})),
    preparedAt:new Date().toISOString()};
  },
  submit(user,input) {
   operator(user);
   if(input.schemaVersion!==1||input.organizationId!==store.farm().id||input.actorId!==user.id)throw new FarmError(403,'Wrong farm or unsupported operation version');
   for(const key of ['operationId','eventId','workerId','deviceId'])if(!id(input[key]))throw new FarmError(400,`Invalid ${key}`);
   if(typeof input.boxQrId!=='string'||!input.boxQrId.trim()||input.boxQrId.trim().length>160)throw new FarmError(400,'Invalid box QR');
   if(typeof input.capturedAt!=='string'||!Number.isFinite(Date.parse(input.capturedAt)))throw new FarmError(400,'Invalid capture time');
   if(![input.grossKg,input.tareKg].every(v=>typeof v==='number'&&Number.isFinite(v))||input.grossKg<=0||input.grossKg>10000||input.tareKg<0||input.tareKg>=input.grossKg)throw new FarmError(400,'Invalid weight');
   const payload={schemaVersion:1,actorId:user.id,operationId:input.operationId,organizationId:input.organizationId,eventId:input.eventId,workerId:input.workerId,deviceId:input.deviceId,boxQrId:input.boxQrId.trim(),grossKg:input.grossKg,tareKg:input.tareKg,capturedAt:input.capturedAt};
   const body=JSON.stringify(payload), hash=createHash('sha256').update(body).digest('hex');
   return transaction(()=>{
    const existing=db.prepare('SELECT * FROM terminal_operations WHERE operation_id=?').get(payload.operationId);
    if(existing){if(existing.actor_id!==user.id||existing.payload_hash!==hash)throw new FarmError(409,'Operation ID was already used for different data');return {replayed:true,record:record(existing)};}
    const event=documents('harvestEvents').find(e=>e.id===payload.eventId);
    if(!event)throw new FarmError(409,'Event is unavailable in this farm; local work remains on the device');
    const worker=documents('employees').find(e=>e.id===payload.workerId&&e.status==='active');
    const matches=db.prepare('SELECT * FROM terminal_operations WHERE organization_id=?').all(payload.organizationId).filter(r=>{const b=JSON.parse(r.body);return b.eventId===payload.eventId&&b.boxQrId===payload.boxQrId&&r.status!=='rejected';});
    const status=matches.length?'suspected_duplicate':event.status!=='active'?'late_review':!worker?'reference_review':'pending_review';
    const stored={...payload,netKg:Math.round((payload.grossKg-payload.tareKg)*1000)/1000,weightSource:'manual',tareSource:'manual',eventName:event.name,workerName:worker?.name||payload.workerId,relatedOperationIds:matches.map(r=>r.operation_id)};
    db.prepare('INSERT INTO terminal_operations(operation_id,organization_id,actor_id,payload_hash,body,status,received_at) VALUES(?,?,?,?,?,?,?)').run(payload.operationId,payload.organizationId,user.id,hash,JSON.stringify(stored),status,new Date().toISOString());
    changed(payload.operationId);
    for(const match of matches){const previous=JSON.parse(match.body);previous.relatedOperationIds=[...new Set([...(previous.relatedOperationIds||[]),payload.operationId])];db.prepare("UPDATE terminal_operations SET body=?,status='suspected_duplicate',revision=revision+1 WHERE operation_id=?").run(JSON.stringify(previous),match.operation_id);changed(match.operation_id);}
    db.prepare('INSERT INTO audit(at,user_id,action,record_id) VALUES(?,?,?,?)').run(new Date().toISOString(),user.id,'terminal.received',payload.operationId);
    return {replayed:false,record:record(db.prepare('SELECT * FROM terminal_operations WHERE operation_id=?').get(payload.operationId))};
   });
  },
  changes(user,cursor) {
   operator(user);if(!Number.isSafeInteger(cursor)||cursor<0)throw new FarmError(400,'Invalid cursor');
   const changes=db.prepare('SELECT seq,operation_id FROM terminal_changes WHERE seq>? ORDER BY seq LIMIT 200').all(cursor);
   return {cursor:changes.at(-1)?.seq||cursor,hasMore:changes.length===200,records:[...new Set(changes.map(c=>c.operation_id))].map(key=>record(db.prepare('SELECT * FROM terminal_operations WHERE operation_id=?').get(key)))};
  },
  review(user,input) {
   owner(user);
   if(input.expectedActorId!==user.id)throw new FarmError(403,'Account changed; reopen terminal');
   if(!id(input.operationId)||!Number.isSafeInteger(input.expectedRevision)||!['confirm','reject'].includes(input.decision)||typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>500)throw new FarmError(400,'Review requires decision, current revision and a reason');
   return transaction(()=>{
    const row=db.prepare('SELECT * FROM terminal_operations WHERE operation_id=?').get(input.operationId);
    if(!row)throw new FarmError(404,'Operation not found');
    if(row.revision!==input.expectedRevision)throw new FarmError(409,'Record changed; synchronize and review again');
    const status=input.decision==='reject'?'rejected':'reviewed';
    // Review is staging-only: never creates a payroll, stock, or harvest projection.
    db.prepare('UPDATE terminal_operations SET status=?,revision=revision+1 WHERE operation_id=?').run(status,input.operationId);
    db.prepare('INSERT INTO terminal_reviews(operation_id,actor_id,at,decision,reason,revision) VALUES(?,?,?,?,?,?)').run(input.operationId,user.id,new Date().toISOString(),input.decision,input.reason.trim(),row.revision+1);
    changed(input.operationId);
    db.prepare('INSERT INTO audit(at,user_id,action,record_id) VALUES(?,?,?,?)').run(new Date().toISOString(),user.id,'terminal.reviewed',input.operationId);
    return record(db.prepare('SELECT * FROM terminal_operations WHERE operation_id=?').get(input.operationId));
   });
  }
 };
}
