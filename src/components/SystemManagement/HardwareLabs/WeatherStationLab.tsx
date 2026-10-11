import React, { useEffect, useRef, useState } from 'react';
import { forecastURL } from '../../../services/weatherData';
interface WeatherStationLabProps {mapCenter?:[number,number]}
type Forecast = {location:[number,number];time:string;fetchedAt:string;temperature:number;humidity:number;rain:number;wind:number};
export const WeatherStationLab:React.FC<WeatherStationLabProps>=({mapCenter})=>{
 const [latitude,setLatitude]=useState(mapCenter?String(mapCenter[0]):'');
 const [longitude,setLongitude]=useState(mapCenter?String(mapCenter[1]):'');
 const [forecast,setForecast]=useState<Forecast|null>(null);
 const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function loadForecast(){
  setError('');request.current?.abort();const controller=new AbortController();request.current=controller;
  if(!latitude.trim()||!longitude.trim()){setError('Choose the actual station coordinates first.');return;}
  setLoading(true);
  try{
   const lat=Number(latitude),lon=Number(longitude);const url=new URL(forecastURL(lat,lon));
   url.searchParams.set('current','temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m');
   const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error(`Forecast provider unavailable (${response.status}).`);
   const data=await response.json();const c=data.current;
   if(!c||typeof c.time!=='string'||![c.temperature_2m,c.relative_humidity_2m,c.precipitation,c.wind_speed_10m].every(v=>typeof v==='number'&&Number.isFinite(v)))throw new Error('Forecast provider returned incomplete data.');
   if(controller.signal.aborted)return;
   setForecast({location:[lat,lon],time:c.time,fetchedAt:new Date().toISOString(),temperature:c.temperature_2m,humidity:c.relative_humidity_2m,rain:c.precipitation,wind:c.wind_speed_10m});
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Forecast could not be loaded.');}
  finally{if(!controller.signal.aborted)setLoading(false);}
 }
 return <section className="space-y-6"><header><h2 className="text-2xl font-bold">Weather & field conditions</h2><p className="text-slate-500 mt-2">Forecast models and your physical sensors are separate sources. No station is connected yet.</p></header><div className="grid gap-6 lg:grid-cols-2"><article className="bg-white dark:bg-slate-900 rounded-2xl border p-6"><h3 className="text-lg font-bold mb-4">Online model conditions</h3><p className="text-sm text-slate-500 mb-4">Confirm your farm coordinates. Values are retrieved from Open-Meteo and are not measurements from your plantation.</p><form onSubmit={e=>{e.preventDefault();void loadForecast();}}><div className="grid grid-cols-2 gap-3"><label>Latitude<input type="number" min="-90" max="90" step="any" required value={latitude} onChange={e=>setLatitude(e.target.value)} className="border rounded p-3 block w-full mt-2"/></label><label>Longitude<input type="number" min="-180" max="180" step="any" required value={longitude} onChange={e=>setLongitude(e.target.value)} className="border rounded p-3 block w-full mt-2"/></label></div><button disabled={loading} className="bg-emerald-700 text-white rounded-xl px-4 py-3 mt-4" type="submit">{loading?'Loading forecast…':'Fetch online conditions'}</button></form>{error&&<p role="alert" className="text-amber-700 mt-4">{error} No substitute readings were generated.</p>}{forecast&&<div className="mt-5"><p className="text-xs text-slate-500">Open-Meteo modeled conditions · {forecast.location.join(', ')} · valid {forecast.time} UTC</p><dl className="grid grid-cols-2 gap-4 mt-4">{[['Temperature',`${forecast.temperature}°C`],['Relative humidity',`${forecast.humidity}%`],['Modeled precipitation',`${forecast.rain} mm`],['Wind',`${forecast.wind} km/h`]].map(([name,value])=><div key={name}><dt className="text-sm text-slate-500">{name}</dt><dd className="text-xl font-bold">{value}</dd></div>)}</dl><p className="text-xs text-slate-500 mt-4">Retrieved {forecast.fetchedAt}. Previously fetched values remain visible if a later request fails; check timestamps before acting.</p></div>}</article><article className="bg-white dark:bg-slate-900 rounded-2xl border p-6"><h3 className="text-lg font-bold mb-3">Your plantation sensors</h3><p className="text-amber-700 font-medium">Not connected</p><p className="text-sm text-slate-500 mt-3">For Guria, start with a LoRaWAN gateway using LTE backhaul, shielded air-temperature/humidity nodes, a rain gauge and a soil probe. Devices in other countries need the appropriate regional radio configuration.</p><ul className="list-disc pl-5 text-sm text-slate-600 space-y-2 mt-4"><li>Assign each station to its own organization and field.</li><li>Keep LoRaWAN join keys on the network server.</li><li>Show sensor age, battery status and missing-data warnings.</li><li>Build monthly and annual statistics only from actual observations.</li><li>Use crop-specific thresholds and verified readings for alerts.</li></ul><p className="text-sm text-slate-500 mt-4">AI analysis is available only after the authenticated backend and verified input data are connected. No fixed variety scores, invented historical records or automatic irrigation advice are shown.</p></article></div></section>;
};
