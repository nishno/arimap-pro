export const DEMO_STORAGE_KEY = 'agrimap:demo:v1';
export type DemoState = { version: 1; harvest: { field: string; kg: number }[]; completed: string[] };
export const initialState = (): DemoState => ({ version: 1, harvest: [], completed: [] });
export function readDemoState(storage: Pick<Storage, 'getItem'>): DemoState {
  try {
    const data = JSON.parse(storage.getItem(DEMO_STORAGE_KEY) || 'null');
    if (data?.version !== 1 || !Array.isArray(data.harvest) || !Array.isArray(data.completed)) return initialState();
    if (!data.harvest.every((h: any) => typeof h.field === 'string' && Number.isFinite(h.kg) && h.kg > 0 && h.kg <= 100000)) return initialState();
    return { version: 1, harvest: data.harvest.slice(-200), completed: data.completed.filter((s: unknown) => typeof s === 'string') };
  } catch { return initialState(); }
}
export const fields = [
  { id: 'north', name: 'North orchard', crop: 'Blueberries', hectares: 4.2, temp: 2.4, humidity: 88, moisture: 32, rain: 1.2, status: 'Watch for frost', color: '#dceaca' },
  { id: 'east', name: 'East vineyard', crop: 'Grapes', hectares: 6.8, temp: 6.1, humidity: 73, moisture: 41, rain: 0.8, status: 'Conditions stable', color: '#bdd7a7' },
  { id: 'south', name: 'South field', crop: 'Hazelnuts', hectares: 5.4, temp: 5.3, humidity: 79, moisture: 38, rain: 1.5, status: 'Check leaf wetness', color: '#e6d9ad' },
];
export function frostRisk(temperature: number, humidity: number) {
  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) throw new Error('Invalid reading');
  if (temperature <= 0) return { level: 'High', message: 'Freezing air temperature. Check crop-specific protection procedures.' };
  if (temperature <= 3) return { level: 'Watch', message: 'Near-freezing conditions. Monitor canopy temperature and the hourly forecast.' };
  return { level: 'Low', message: 'No near-freezing air temperature in this sample. Forecast changes can still increase risk.' };
}
