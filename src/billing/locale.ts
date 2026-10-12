export type BillingCurrency='USD'|'GEL';
export function defaultBillingCurrency(country:string,language:string):BillingCurrency {
 const georgia=['ge','georgia','საქართველო'].includes(country.trim().toLowerCase());
 return georgia&&language==='ka'?'GEL':'USD';
}
// Independent proposed Georgian tariffs, not an asserted live FX conversion.
export function planPrice(plan:{id:string;price:number},currency:BillingCurrency):number {
 if(currency==='USD')return plan.price;
 const gel:Record<string,number>={trial:0,starter:49,pro:129,enterprise:0};
 if(!(plan.id in gel))throw new Error('No GEL tariff configured for this plan');
 return gel[plan.id];
}
export function formatPlanPrice(plan:{id:string;price:number},currency:BillingCurrency,language:string):string {
 return new Intl.NumberFormat(language==='ka'?'ka-GE':'en-US',{style:'currency',currency}).format(planPrice(plan,currency));
}
