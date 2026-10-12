import type { SubscriptionPlan } from '../types';
// Proposed launch pricing, not an activated checkout or entitlement source.
export const PROPOSED_PLANS: SubscriptionPlan[] = [
 { id:'trial', name:'14-day trial', price:0, billingCycle:'monthly', freeDays:14, features:['One farm workspace','Evaluate Pro workflows','No payment collected during evaluation'] },
 { id:'starter', name:'Starter', price:19, billingCycle:'monthly', features:['One farm workspace · 3 users','Mapping, planning and harvest records','Basic reports and community access'] },
 { id:'pro', name:'Pro', price:49, billingCycle:'monthly', features:['One farm workspace · 10 users','Advanced reports and agronomy workflows','Weather, alerts and camera integration when connected','Metered AI allowance to be set before launch'] },
 { id:'enterprise', name:'Enterprise', price:0, billingCycle:'monthly', contactRequired:true, features:['Multiple farms and negotiated user limits','Custom integrations and support','Cloud or local installation by agreement'] }
];
