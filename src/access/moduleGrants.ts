// Canonical module IDs only. Historical employee labels are migrated at write time.
export const GRANTABLE_MODULES = ['dashboard','my-work','ai','community','marketplace','design','agronomy','harvesting','stock','accounting','tasks','tools','system','labs','logs','founders'] as const;
const aliases:Record<string,string>={Planning:'tasks',Harvest:'harvesting',Store:'stock',Admin:'system'};
export function normalizeModuleGrants(value:unknown):string[] {
 if(!Array.isArray(value))return [];
 return [...new Set(value.filter(v=>typeof v==='string').map(v=>aliases[v]||v).filter(v=>(GRANTABLE_MODULES as readonly string[]).includes(v)))];
}
