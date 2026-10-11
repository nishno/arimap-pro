import React, { useState, useEffect } from 'react';
import { 
    Droplets, Activity, Gauge, Play, Pause, Power, CheckCircle, 
    AlertTriangle, RefreshCw, Layers, Plus, Trash2, Settings, Sliders, 
    ShieldCheck, Sparkles, Filter 
} from 'lucide-react';
import { toast } from 'sonner';
import { safeStorage } from '../../../services/storageService';

export interface SoilStation {
    id: string;
    name: string;
    locationName: string;
    protocol: 'RS485_MODBUS_RTU' | 'SDI_12' | 'LORAWAN';
    slaveId: number;
    depthCm: number;
    soilPh: number;
    soilEcDsm: number;
    moisturePct: number;
    soilTempC: number;
    nitrogenMgKg: number;
    phosphorusMgKg: number;
    potassiumMgKg: number;
    status: 'ONLINE' | 'CALIBRATION_REQUIRED' | 'OFFLINE';
    lastReadingTime: string;
}

export interface IrrigationValve {
    id: string;
    name: string;
    blockName: string;
    valveState: 'OPEN' | 'CLOSED';
    flowRateLmin: number;
    linePressureBar: number;
    autoTriggerEnabled: boolean;
    moistureCutoffPct: number;
    durationMinutes: number;
}

interface SoilSensorsLabProps {
    mapCenter?: [number, number];
}

export const SoilSensorsLab: React.FC<SoilSensorsLabProps> = ({
    mapCenter = [41.9023, -72.3774]
}) => {
    const [activeTab, setActiveTab] = useState<'soil_probes' | 'water_valves' | 'calibration' | 'rules'>('soil_probes');

    // Soil Stations
    const [stations, setStations] = useState<SoilStation[]>(() => {
        const saved = safeStorage.getItem('agrimap_soil_stations');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [
            {
                id: 'soil-01',
                name: 'Block A Blueberry Root Zone Probe #1',
                locationName: 'North Plantation Row 8',
                protocol: 'RS485_MODBUS_RTU',
                slaveId: 1,
                depthCm: 15,
                soilPh: 5.1,
                soilEcDsm: 1.42,
                moisturePct: 34.2,
                soilTempC: 16.8,
                nitrogenMgKg: 42,
                phosphorusMgKg: 28,
                potassiumMgKg: 110,
                status: 'ONLINE',
                lastReadingTime: 'Just now'
            },
            {
                id: 'soil-02',
                name: 'Block A Sub-Root Soil Bank #2',
                locationName: 'North Plantation Row 8',
                protocol: 'RS485_MODBUS_RTU',
                slaveId: 2,
                depthCm: 35,
                soilPh: 5.3,
                soilEcDsm: 1.15,
                moisturePct: 38.5,
                soilTempC: 15.4,
                nitrogenMgKg: 35,
                phosphorusMgKg: 22,
                potassiumMgKg: 95,
                status: 'ONLINE',
                lastReadingTime: 'Just now'
            },
            {
                id: 'soil-03',
                name: 'Block B Orchard Soil Probe #3',
                locationName: 'Hazelnut & Fruit Block',
                protocol: 'LORAWAN',
                slaveId: 3,
                depthCm: 20,
                soilPh: 6.2,
                soilEcDsm: 1.05,
                moisturePct: 27.8,
                soilTempC: 17.1,
                nitrogenMgKg: 55,
                phosphorusMgKg: 34,
                potassiumMgKg: 140,
                status: 'ONLINE',
                lastReadingTime: '3m ago'
            }
        ];
    });

    // Irrigation & Water Valves
    const [valves, setValves] = useState<IrrigationValve[]>(() => {
        const saved = safeStorage.getItem('agrimap_irrigation_valves');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [
            {
                id: 'valve-01',
                name: 'Solenoid Valve 1: Block A Drip Line',
                blockName: 'Blueberry Block A',
                valveState: 'CLOSED',
                flowRateLmin: 44.0,
                linePressureBar: 3.2,
                autoTriggerEnabled: true,
                moistureCutoffPct: 26,
                durationMinutes: 45
            },
            {
                id: 'valve-02',
                name: 'Solenoid Valve 2: Block B Micro-Sprinklers',
                blockName: 'Hazelnut Block B',
                valveState: 'CLOSED',
                flowRateLmin: 82.0,
                linePressureBar: 3.5,
                autoTriggerEnabled: true,
                moistureCutoffPct: 24,
                durationMinutes: 60
            },
            {
                id: 'valve-03',
                name: 'Fertigation Venturi Injection Doser',
                blockName: 'Pump Station Master Fertigation',
                valveState: 'CLOSED',
                flowRateLmin: 3.2,
                linePressureBar: 4.1,
                autoTriggerEnabled: false,
                moistureCutoffPct: 20,
                durationMinutes: 30
            }
        ];
    });

    const [mainPumpActive, setMainPumpActive] = useState(false);

    // Save states
    useEffect(() => {
        safeStorage.setItem('agrimap_soil_stations', JSON.stringify(stations));
    }, [stations]);

    useEffect(() => {
        safeStorage.setItem('agrimap_irrigation_valves', JSON.stringify(valves));
    }, [valves]);

    // Toggle Valve State
    const handleToggleValve = (valveId: string) => {
        setValves(prev => prev.map(v => {
            if (v.id === valveId) {
                const newState = v.valveState === 'OPEN' ? 'CLOSED' : 'OPEN';
                toast.success(`${v.name} is now ${newState}`);
                return { ...v, valveState: newState };
            }
            return v;
        }));
    };

    // Toggle Main Booster Pump
    const handleToggleMainPump = () => {
        const next = !mainPumpActive;
        setMainPumpActive(next);
        toast.info(`Main Deep Well Booster Pump: ${next ? 'ACTIVATED (3.5 bar)' : 'STOPPED'}`);
    };

    // Sensor Calibration Assistant
    const [calibPoint, setCalibPoint] = useState<'4.01' | '7.00' | '10.01' | 'EC_1413'>('7.00');
    const [isCalibrating, setIsCalibrating] = useState(false);

    const handleRunCalibrationStep = () => {
        setIsCalibrating(true);
        setTimeout(() => {
            setIsCalibrating(false);
            toast.success(`Standard ${calibPoint} calibration point verified. Sensor slope accuracy: 98.6% (Ideal)`);
        }, 1500);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                        <Droplets className="text-blue-600" size={24} />
                        Soil pH &amp; EC Sensor Integration &amp; Water Automation
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                        RS485/SDI-12 7-in-1 soil probes, pH/EC calibration, and automated irrigation solenoid valve controls
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToggleMainPump}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 ${
                            mainPumpActive 
                                ? 'bg-emerald-600 text-white animate-pulse' 
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <Power size={15} />
                        {mainPumpActive ? 'MAIN PUMP ACTIVE' : 'MAIN PUMP STANDBY'}
                    </button>
                </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab('soil_probes')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'soil_probes' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    Soil pH &amp; EC Probes
                </button>
                <button
                    onClick={() => setActiveTab('water_valves')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'water_valves' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    Irrigation &amp; Water Valves
                </button>
                <button
                    onClick={() => setActiveTab('calibration')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'calibration' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    Sensor Calibration
                </button>
                <button
                    onClick={() => setActiveTab('rules')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'rules' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    Smart Automation Rules
                </button>
            </div>

            {/* TAB 1: SOIL PH & EC PROBES */}
            {activeTab === 'soil_probes' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {stations.map(st => (
                            <div
                                key={st.id}
                                className="p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 block">
                                            Depth: {st.depthCm} cm • {st.protocol.replace(/_/g, ' ')}
                                        </span>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mt-0.5">
                                            {st.name}
                                        </h4>
                                        <p className="text-[10px] text-slate-500">{st.locationName}</p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-md text-[8px] font-black uppercase">
                                        Online
                                    </span>
                                </div>

                                {/* pH & EC Hero Gauges */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40 text-center">
                                        <span className="text-[8px] font-black uppercase text-purple-600 dark:text-purple-400 block">Soil pH</span>
                                        <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-0.5">
                                            {st.soilPh.toFixed(1)}
                                        </p>
                                        <span className="text-[8px] font-bold text-slate-400">
                                            {st.soilPh <= 5.5 ? 'Acidic (Optimal Blueberry)' : 'Neutral'}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-center">
                                        <span className="text-[8px] font-black uppercase text-blue-600 dark:text-blue-400 block">Soil EC</span>
                                        <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                                            {st.soilEcDsm.toFixed(2)}
                                        </p>
                                        <span className="text-[8px] font-bold text-slate-400">dS/m (Salinity safe)</span>
                                    </div>
                                </div>

                                {/* Secondary Readings */}
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                        <span className="text-slate-400 block">Moisture</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{st.moisturePct}%</span>
                                    </div>
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                        <span className="text-slate-400 block">Soil Temp</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{st.soilTempC}°C</span>
                                    </div>
                                </div>

                                {/* N-P-K Nutrients Strip */}
                                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex justify-between items-center text-[9px] font-mono">
                                    <span className="text-slate-500">N: {st.nitrogenMgKg} mg/kg</span>
                                    <span className="text-slate-500">P: {st.phosphorusMgKg} mg/kg</span>
                                    <span className="text-slate-500">K: {st.potassiumMgKg} mg/kg</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: IRRIGATION & WATER VALVES */}
            {activeTab === 'water_valves' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {valves.map(valve => {
                            const isOpen = valve.valveState === 'OPEN';
                            return (
                                <div
                                    key={valve.id}
                                    className={`p-6 rounded-[2rem] border transition-all ${
                                        isOpen 
                                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 shadow-md' 
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                                                {valve.blockName}
                                            </span>
                                            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mt-0.5">
                                                {valve.name}
                                            </h4>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                            isOpen ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {valve.valveState}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 my-4 text-xs font-mono">
                                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                            <span className="text-[9px] text-slate-400 uppercase block">Flow Rate</span>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {isOpen ? valve.flowRateLmin : 0.0} L/min
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                            <span className="text-[9px] text-slate-400 uppercase block">Pressure</span>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {valve.linePressureBar} bar
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleToggleValve(valve.id)}
                                        className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                            isOpen 
                                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                    >
                                        {isOpen ? 'Close Valve' : 'Open Valve (Irrigate)'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: SENSOR CALIBRATION */}
            {activeTab === 'calibration' && (
                <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 space-y-4">
                    <h4 className="text-base font-black uppercase text-slate-900 dark:text-white">
                        pH &amp; Electrical Conductivity (EC) Probe Calibration
                    </h4>
                    <p className="text-xs text-slate-500">
                        Immerse soil sensor probe into standard buffer solution, select buffer point below, and execute calibration routine.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                            onClick={() => setCalibPoint('4.01')}
                            className={`p-3 rounded-xl text-xs font-black uppercase transition-all ${
                                calibPoint === '4.01' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700'
                            }`}
                        >
                            pH 4.01 Buffer
                        </button>
                        <button
                            onClick={() => setCalibPoint('7.00')}
                            className={`p-3 rounded-xl text-xs font-black uppercase transition-all ${
                                calibPoint === '7.00' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700'
                            }`}
                        >
                            pH 7.00 Buffer
                        </button>
                        <button
                            onClick={() => setCalibPoint('10.01')}
                            className={`p-3 rounded-xl text-xs font-black uppercase transition-all ${
                                calibPoint === '10.01' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700'
                            }`}
                        >
                            pH 10.01 Buffer
                        </button>
                        <button
                            onClick={() => setCalibPoint('EC_1413')}
                            className={`p-3 rounded-xl text-xs font-black uppercase transition-all ${
                                calibPoint === 'EC_1413' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700'
                            }`}
                        >
                            EC 1413 µS/cm
                        </button>
                    </div>

                    <button
                        onClick={handleRunCalibrationStep}
                        disabled={isCalibrating}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                        {isCalibrating ? 'Calibrating Electrode Slope...' : `Calibrate Standard Point: ${calibPoint}`}
                    </button>
                </div>
            )}

            {/* TAB 4: SMART AUTOMATION RULES */}
            {activeTab === 'rules' && (
                <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 space-y-4">
                    <h4 className="text-base font-black uppercase text-slate-900 dark:text-white">
                        Automated Irrigation &amp; Soil Protection Rules
                    </h4>
                    <div className="space-y-3">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between">
                            <div>
                                <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase">
                                    Drip Auto-Trigger on Low Moisture
                                </h5>
                                <p className="text-[10px] text-slate-500">
                                    If Block A Soil Moisture &lt; 25% for 15 mins -&gt; Open Valve 1 for 45 mins.
                                </p>
                            </div>
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold uppercase">
                                Active
                            </span>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between">
                            <div>
                                <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase">
                                    High Salinity (EC) Flush Lockout
                                </h5>
                                <p className="text-[10px] text-slate-500">
                                    If Soil EC &gt; 2.2 dS/m -&gt; Pause fertigation injection, alert operator, and flush with pure water.
                                </p>
                            </div>
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold uppercase">
                                Active
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
