import {FarmError} from './farm-store.mjs';
export const MODULES=['dashboard','my-work','ai','community','marketplace','design','agronomy','harvesting','stock','accounting','tasks','tools','system','labs','logs','founders'];
export function moduleAccess(store){
 const db=store.db;
 db.exec('CREATE TABLE IF NOT EXISTS local_module_grants(user_id TEXT PRIMARY KEY REFERENCES users(id), modules TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)');
 return {
  get(userId){const row=db.prepare('SELECT modules FROM local_module_grants WHERE user_id=?').get(userId);return row?JSON.parse(row.modules):undefined;},
  set(actor,input){
   if(actor.role!=='owner')throw new FarmError(403,'Owner access required');
   const user=db.prepare("SELECT id FROM users WHERE id=? AND role='worker'").get(input.userId);
   if(!user||!Array.isArray(input.allowedModules)||input.allowedModules.some(m=>!MODULES.includes(m)))throw new FarmError(400,'Select a worker and valid modules');
   const modules=[...new Set(input.allowedModules)];
   db.exec('BEGIN IMMEDIATE');try{
    db.prepare('INSERT INTO local_module_grants VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET modules=excluded.modules,updated_at=excluded.updated_at,updated_by=excluded.updated_by').run(user.id,JSON.stringify(modules),new Date().toISOString(),actor.id);
    db.prepare('INSERT INTO audit(at,user_id,action,record_id) VALUES(?,?,?,?)').run(new Date().toISOString(),actor.id,'worker.modules_changed',user.id);db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   return {userId:user.id,allowedModules:modules};
  }
 };
}
export const COLLECTION_MODULES={plantationFeatures:['design','harvesting','agronomy'],layers:['design','harvesting'],harvestEvents:['harvesting'],workAssignments:['tasks'],harvestEntries:['harvesting'],harvestLogs:['harvesting'],crops:['agronomy','harvesting','marketplace'],cropVarieties:['agronomy','harvesting'],inventoryItems:['stock'],inventoryTransactions:['stock'],stockTransactions:['stock'],harvestedProduce:['stock'],purchaseOrders:['stock'],suppliers:['stock'],accounts:['accounting'],transactions:['accounting'],nutritionPlans:['agronomy'],planExecutions:['agronomy'],employees:['system','tools'],employeeGroups:['system','tools'],dailyLogs:['system','tools'],machinery:['system','tools'],notes:['tasks'],checkpoints:['tasks'],alerts:['community'],forumPosts:['community'],conversations:['community'],messages:['community'],listings:['marketplace'],bids:['marketplace'],reviews:['marketplace'],systemLogs:['logs']};
