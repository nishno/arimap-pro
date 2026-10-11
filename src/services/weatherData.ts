export type WeatherReading = { stationId: string; organizationId: string; measuredAt: string; receivedAt: string; temperatureC?: number; humidityPct?: number; rainfallIncrementMm?: number; batteryV?: number };
const finiteRange = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export function validateReading(reading: WeatherReading, now = Date.now()): boolean {
  if (!reading || !reading.stationId || !reading.organizationId) return false;
  const measured=Date.parse(reading.measuredAt), received=Date.parse(reading.receivedAt);
  if (!Number.isFinite(measured)||!Number.isFinite(received)||measured>now+300000||received>now+300000||measured>received+300000) return false;
  const checks = [
    reading.temperatureC===undefined || finiteRange(reading.temperatureC,-60,70),
    reading.humidityPct===undefined || finiteRange(reading.humidityPct,0,100),
    reading.rainfallIncrementMm===undefined || finiteRange(reading.rainfallIncrementMm,0,500),
    reading.batteryV===undefined || finiteRange(reading.batteryV,0,30)
  ];
  return checks.every(Boolean) && [reading.temperatureC,reading.humidityPct,reading.rainfallIncrementMm].some(v=>v!==undefined);
}
export function readingStatus(reading: WeatherReading, now=Date.now(), staleAfterMinutes=30) {
  if (!validateReading(reading,now)) return 'invalid';
  return now-Date.parse(reading.measuredAt)>staleAfterMinutes*60000 ? 'stale' : 'fresh';
}
export function summarizeReadings(readings: WeatherReading[], stationId: string, organizationId: string, from: string, to: string, now=Date.now()) {
 const start=Date.parse(from),end=Date.parse(to);
 if (!Number.isFinite(start)||!Number.isFinite(end)||start>=end) throw new Error('Invalid reporting interval');
 // Caller must enforce authorization. Never mix tenants/stations in statistics.
 const selected=readings.filter(r=>r.stationId===stationId&&r.organizationId===organizationId&&validateReading(r,now)&&Date.parse(r.measuredAt)>=start&&Date.parse(r.measuredAt)<end);
 const unique=[...new Map(selected.map(r=>[r.measuredAt,r])).values()];
 const temperatures=unique.flatMap(r=>r.temperatureC===undefined?[]:[r.temperatureC]);
 const humidities=unique.flatMap(r=>r.humidityPct===undefined?[]:[r.humidityPct]);
 const rain=unique.flatMap(r=>r.rainfallIncrementMm===undefined?[]:[r.rainfallIncrementMm]);
 return { samples:unique.length, temperatureSamples:temperatures.length, rainfallSamples:rain.length,
   minTemperatureC:temperatures.length?Math.min(...temperatures):null,
   maxTemperatureC:temperatures.length?Math.max(...temperatures):null,
   sampleMeanTemperatureC:temperatures.length?temperatures.reduce((a,b)=>a+b,0)/temperatures.length:null,
   sampleMeanHumidityPct:humidities.length?humidities.reduce((a,b)=>a+b,0)/humidities.length:null,
   rainfallTotalMm:rain.length?rain.reduce((a,b)=>a+b,0):null,
   // Sample means are not time-weighted means. Gaps must be displayed in reports.
 };
}
export function forecastURL(latitude: number, longitude: number): string {
 if (!finiteRange(latitude,-90,90)||!finiteRange(longitude,-180,180)) throw new Error('Invalid forecast location');
 const url=new URL('https://api.open-meteo.com/v1/forecast');
 url.search=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),hourly:'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',daily:'temperature_2m_min,temperature_2m_max,precipitation_sum',timezone:'UTC',forecast_days:'7'}).toString();
 return url.toString();
}
