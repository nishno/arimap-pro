import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReading, readingStatus, summarizeReadings, forecastURL } from '../src/services/weatherData.ts';
const now=Date.parse('2026-10-11T12:00:00Z');
const reading={stationId:'north',organizationId:'farm-a',measuredAt:'2026-10-11T11:55:00Z',receivedAt:'2026-10-11T11:56:00Z',temperatureC:0,humidityPct:100,rainfallIncrementMm:0};
test('zero temperatures/rain remain valid; invalid humidity and timestamps rejected',()=>{
 assert.equal(validateReading(reading,now),true);
 assert.equal(validateReading({...reading,humidityPct:101},now),false);
 assert.equal(validateReading({...reading,measuredAt:'bad'},now),false);
 assert.equal(validateReading({...reading,measuredAt:'2026-10-11T13:00:00Z'},now),false);
});
test('stale sensor data must not imply current safety',()=>{
 assert.equal(readingStatus(reading,now),'fresh');
 assert.equal(readingStatus({...reading,measuredAt:'2026-10-11T10:00:00Z'},now),'stale');
});
test('reports isolate stations/tenants, deduplicate messages, preserve missing values',()=>{
 const others=[reading,reading,{...reading,organizationId:'farm-b',temperatureC:50,rainfallIncrementMm:50},{...reading,stationId:'south',temperatureC:40}];
 const summary=summarizeReadings(others,'north','farm-a','2026-10-11T00:00:00Z','2026-10-12T00:00:00Z',now);
 assert.equal(summary.samples,1);assert.equal(summary.minTemperatureC,0);assert.equal(summary.rainfallTotalMm,0);
 const empty=summarizeReadings([],'north','farm-a','2026-10-11T00:00:00Z','2026-10-12T00:00:00Z',now);
 assert.equal(empty.minTemperatureC,null);assert.equal(empty.rainfallTotalMm,null);
});
test('forecast URL validates coordinates and separates forecast data from observations',()=>{
 assert.throws(()=>forecastURL(NaN,44));assert.throws(()=>forecastURL(91,44));
 assert.equal(new URL(forecastURL(42,44)).searchParams.get('timezone'),'UTC');
});
