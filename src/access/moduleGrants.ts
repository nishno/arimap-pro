// Canonical module IDs only. Historical employee labels are migrated at write time.
export const GRANTABLE_MODULES = ['dashboard','my-work','ai','community','marketplace','design','agronomy','harvesting','stock','accounting','tasks','tools','system','labs','logs','founders'] as const;
const aliases:Record<string,string>={Planning:'tasks',Harvest:'harvesting',Store:'stock',Admin:'system'};
export function normalizeModuleGrants(value:unknown):string[] {
 if(!Array.isArray(value))return [];
 return [...new Set(value.filter(v=>typeof v==='string').map(v=>aliases[v]||v).filter(v=>(GRANTABLE_MODULES as readonly string[]).includes(v)))];
}

export function legacyEmployeeModules(employee:any,role:any):string[]{
 const visible=normalizeModuleGrants(employee?.visibleModules);
 if(visible.length)return visible;
 const mapping:Record<string,string[]>={access_harvesting:['harvesting'],use_weigh_station:['harvesting'],edit_work:['tasks'],access_stock:['stock'],access_accounting:['accounting'],view_accounting:['accounting'],access_system:['system'],edit_employees:['system'],edit_machinery:['system']};
 return [...new Set((role?.permissions||[]).flatMap((permission:string)=>mapping[permission]||[]))] as string[];
}

export function membershipRoleForEmployee(name:string):string{
 return ['Founder','Co-Founder','Admin','Manager','Field Manager','Employee','worker','Agronomist','Accountant','Guest'].includes(name)?name:'Employee';
}
