import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBillingCurrency,planPrice,formatPlanPrice} from '../src/billing/locale.ts';
test('Georgia and Georgian default to GEL; global/English default to USD',()=>{
 for(const country of ['Georgia',' GE ','საქართველო'])assert.equal(defaultBillingCurrency(country,'ka'),'GEL');
 assert.equal(defaultBillingCurrency('Georgia','en'),'USD');assert.equal(defaultBillingCurrency('Global','ka'),'USD');
});
test('regional tariffs use different amounts, not relabeled dollars',()=>{
 const starter={id:'starter',price:19};assert.equal(planPrice(starter,'USD'),19);assert.equal(planPrice(starter,'GEL'),49);
 assert.match(formatPlanPrice(starter,'GEL','ka'),/49/);assert.match(formatPlanPrice(starter,'USD','en'),/19/);
 assert.throws(()=>planPrice({id:'unknown',price:19},'GEL'),/No GEL tariff/);
});
