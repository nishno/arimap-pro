import React, { useState, useMemo } from 'react';
import type { InventoryItem, RefrigeratorLot, Account } from '../types';
import { 
    Snowflake, Package, Calendar, Clock, DollarSign, Layers, Plus, Search, Tag, Truck, User, 
    ArrowRight, FileText, CheckCircle, RotateCcw, Thermometer, Activity, Wifi, Sliders, 
    AlertTriangle, ShieldCheck, MapPin, Gauge, Cpu, Zap, RefreshCw
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import RefrigeratorSellModal from './RefrigeratorSellModal';
import { toast } from 'sonner';

interface RefrigeratorViewProps {
    inventoryItems: InventoryItem[];
    onSetInventoryItems: (items: InventoryItem[]) => void;
    accounts?: Account[];
    onSetAccounts?: (accounts: Account[]) => void;
    transactions?: any[];
    onSetTransactions?: (transactions: any[]) => void;
}

interface TemperatureLogger {
    id: string;
    serialNo: string;
    name: string;
    zone: 'North Wall' | 'South Wall' | 'East Wall' | 'West Wall' | 'Center Isle';
    currentTempC: number;
    targetTempC: number;
    humidityPercent: number;
    co2Ppm: number;
    batteryPercent: number;
    status: 'ONLINE' | 'WARNING' | 'OFFLINE';
    lastPing: string;
}

export const RefrigeratorView: React.FC<RefrigeratorViewProps> = (props) => {
    const { inventoryItems, onSetInventoryItems, accounts = [] } = props;
    const { formatCurrency, currency } = useLanguage();

    const [activeTab, setActiveTab] = useState<'lots' | 'matrix' | 'iot'>('lots');
    const [searchQuery, setSearchQuery] = useState('');
    const [durationFilter, setDurationFilter] = useState<'ALL' | 'FRESH' | 'MID' | 'LONG'>('ALL');
    const [selectedLotForSell, setSelectedLotForSell] = useState<RefrigeratorLot | null>(null);
    const [historyModalLot, setHistoryModalLot] = useState<RefrigeratorLot | null>(null);
    
    // Cooler Capacity Configuration
    const [coolerCapacityKg, setCoolerCapacityKg] = useState<number>(50000);
    const [isEditingCapacity, setIsEditingCapacity] = useState<boolean>(false);

    // IoT Thermometers & Loggers State
    const [targetSetPointC, setTargetSetPointC] = useState<number>(2.0);
    const [loggers, setLoggers] = useState<TemperatureLogger[]>([
        {
            id: 'log-1',
            serialNo: 'LOG-N-102',
            name: 'North Wall Probe #1',
            zone: 'North Wall',
            currentTempC: 1.8,
            targetTempC: 2.0,
            humidityPercent: 92,
            co2Ppm: 450,
            batteryPercent: 98,
            status: 'ONLINE',
            lastPing: '2 mins ago'
        },
        {
            id: 'log-2',
            serialNo: 'LOG-S-104',
            name: 'South Wall Probe #2',
            zone: 'South Wall',
            currentTempC: 2.2,
            targetTempC: 2.0,
            humidityPercent: 91,
            co2Ppm: 465,
            batteryPercent: 94,
            status: 'ONLINE',
            lastPing: '1 min ago'
        },
        {
            id: 'log-3',
            serialNo: 'LOG-E-201',
            name: 'East Wall Air Logger',
            zone: 'East Wall',
            currentTempC: 1.9,
            targetTempC: 2.0,
            humidityPercent: 93,
            co2Ppm: 440,
            batteryPercent: 88,
            status: 'ONLINE',
            lastPing: 'Just now'
        },
        {
            id: 'log-4',
            serialNo: 'LOG-W-202',
            name: 'West Wall Sensor',
            zone: 'West Wall',
            currentTempC: 2.0,
            targetTempC: 2.0,
            humidityPercent: 90,
            co2Ppm: 480,
            batteryPercent: 79,
            status: 'ONLINE',
            lastPing: '5 mins ago'
        },
        {
            id: 'log-5',
            serialNo: 'LOG-C-305',
            name: 'Center Isle Core Probe',
            zone: 'Center Isle',
            currentTempC: 2.1,
            targetTempC: 2.0,
            humidityPercent: 94,
            co2Ppm: 430,
            batteryPercent: 92,
            status: 'ONLINE',
            lastPing: 'Just now'
        }
    ]);

    const [isAddLoggerOpen, setIsAddLoggerOpen] = useState(false);
    const [newLoggerName, setNewLoggerName] = useState('');
    const [newLoggerSerial, setNewLoggerSerial] = useState('');
    const [newLoggerZone, setNewLoggerZone] = useState<'North Wall' | 'South Wall' | 'East Wall' | 'West Wall' | 'Center Isle'>('North Wall');

    // Extract all items with Refrigerator Storage data
    const refrigeratorItems = useMemo(() => {
        return inventoryItems.filter(item => 
            item.status === 'IN_REFRIGERATOR' || 
            item.status === 'PARTIALLY_SOLD' || 
            item.refrigeratorLot !== undefined || 
            (item.coldStorageKg && item.coldStorageKg > 0)
        );
    }, [inventoryItems]);

    // Build consolidated list of Refrigerator Lots
    const lots: { item: InventoryItem; lot: RefrigeratorLot; daysInStorage: number }[] = useMemo(() => {
        const now = new Date().getTime();
        return refrigeratorItems.map(item => {
            let lot = item.refrigeratorLot;
            if (!lot) {
                // Auto construct lot object from item fields
                lot = {
                    id: item.id,
                    lotNumber: `REF-LOT-${item.id.slice(-4)}`,
                    harvestEventName: item.name,
                    harvestDate: item.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                    arrivalDateTime: item.date || new Date().toISOString(),
                    arrivalDayPricePerKg: item.coldStoragePrice || item.unitCost || 10,
                    totalNetKg: item.coldStorageKg || item.currentStock || 0,
                    remainingNetKg: item.coldStorageKg || item.currentStock || 0,
                    palletsType: 'Euro',
                    palletsCount: Math.ceil((item.coldStorageKg || item.currentStock || 0) / 250),
                    boxesCount: item.physicalBoxes || Math.ceil((item.coldStorageKg || item.currentStock || 0) / 5),
                    punnetsCount: item.physicalPunnets || Math.ceil((item.coldStorageKg || item.currentStock || 0) / 5) * 8,
                    roomPlacementNotes: item.coldStorageLocation || 'Cold Room #1 - North Wall',
                    status: (item.status as any) || 'IN_REFRIGERATOR',
                    salesHistory: []
                };
            }

            const arrivalTime = new Date(lot.arrivalDateTime || lot.harvestDate).getTime();
            const daysInStorage = Math.max(0, Math.floor((now - arrivalTime) / (1000 * 60 * 60 * 24)));

            return { item, lot, daysInStorage };
        });
    }, [refrigeratorItems]);

    // Filtered Lots
    const filteredLots = useMemo(() => {
        return lots.filter(({ lot, daysInStorage }) => {
            const matchesSearch = 
                lot.lotNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (lot.harvestEventName && lot.harvestEventName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (lot.roomPlacementNotes && lot.roomPlacementNotes.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (durationFilter === 'FRESH') return daysInStorage <= 3;
            if (durationFilter === 'MID') return daysInStorage > 3 && daysInStorage <= 7;
            if (durationFilter === 'LONG') return daysInStorage > 7;

            return true;
        });
    }, [lots, searchQuery, durationFilter]);

    // Summary KPIs
    const totalNetKgInStorage = useMemo(() => lots.reduce((acc, l) => acc + l.lot.remainingNetKg, 0), [lots]);
    const totalPalletsInStorage = useMemo(() => lots.reduce((acc, l) => acc + (l.lot.palletsCount || 0), 0), [lots]);
    
    const euroPalletsCount = useMemo(() => {
        return lots.filter(l => !l.lot.palletsType || l.lot.palletsType === 'Euro').reduce((acc, l) => acc + (l.lot.palletsCount || 0), 0);
    }, [lots]);

    const standardPalletsCount = useMemo(() => {
        return lots.filter(l => l.lot.palletsType === 'Standard' || l.lot.palletsType === 'Ordinary').reduce((acc, l) => acc + (l.lot.palletsCount || 0), 0);
    }, [lots]);

    const remainingCapacityKg = Math.max(0, coolerCapacityKg - totalNetKgInStorage);
    const capacityOccupiedPercent = Math.min(100, (totalNetKgInStorage / coolerCapacityKg) * 100);

    const avgDaysInStorage = useMemo(() => {
        if (lots.length === 0) return 0;
        return (lots.reduce((acc, l) => acc + l.daysInStorage, 0) / lots.length).toFixed(1);
    }, [lots]);

    const totalValuation = useMemo(() => {
        return lots.reduce((acc, l) => acc + (l.lot.remainingNetKg * l.lot.arrivalDayPricePerKg), 0);
    }, [lots]);

    // Room side zone grouping for Matrix
    const roomZoneMatrix = useMemo(() => {
        const zones: Record<string, { lots: typeof lots; totalKg: number; pallets: number }> = {
            'North Wall': { lots: [], totalKg: 0, pallets: 0 },
            'South Wall': { lots: [], totalKg: 0, pallets: 0 },
            'East Wall': { lots: [], totalKg: 0, pallets: 0 },
            'West Wall': { lots: [], totalKg: 0, pallets: 0 },
            'Center Isle': { lots: [], totalKg: 0, pallets: 0 },
        };

        lots.forEach(itemWithLot => {
            const notes = itemWithLot.lot.roomPlacementNotes || '';
            let assignedZone = 'North Wall';
            if (notes.includes('South')) assignedZone = 'South Wall';
            else if (notes.includes('East')) assignedZone = 'East Wall';
            else if (notes.includes('West')) assignedZone = 'West Wall';
            else if (notes.includes('Center')) assignedZone = 'Center Isle';

            if (!zones[assignedZone]) {
                zones[assignedZone] = { lots: [], totalKg: 0, pallets: 0 };
            }
            zones[assignedZone].lots.push(itemWithLot);
            zones[assignedZone].totalKg += itemWithLot.lot.remainingNetKg;
            zones[assignedZone].pallets += (itemWithLot.lot.palletsCount || 0);
        });

        return zones;
    }, [lots]);

    // Restore Lot back to Produce Ledger
    const handleRestoreToLedger = (itemId: string, lotNumber: string) => {
        const updated = inventoryItems.map(item => {
            if (item.id === itemId || (item.refrigeratorLot && item.refrigeratorLot.id === itemId)) {
                return {
                    ...item,
                    status: 'IN_STORAGE',
                    fulfillmentType: undefined,
                    coldStorageKg: 0,
                    refrigeratorLot: undefined
                };
            }
            return item;
        });
        onSetInventoryItems(updated);
        toast.success(`Restored Lot #${lotNumber} back to active Produce Ledger!`);
    };

    // Handle Sale Confirmation from Refrigerator
    const handleConfirmSellFromLot = (lotId: string, saleRecord: any, paymentTx?: any) => {
        const updatedItems = inventoryItems.map(item => {
            const lot = item.refrigeratorLot;
            if (item.id === lotId || (lot && lot.id === lotId)) {
                const currentRemaining = lot ? lot.remainingNetKg : (item.coldStorageKg || item.currentStock);
                const newRemaining = Math.max(0, currentRemaining - saleRecord.soldNetKg);
                const isFullySold = newRemaining === 0;

                const updatedSalesHistory = lot ? [...(lot.salesHistory || []), saleRecord] : [saleRecord];

                const updatedLot: RefrigeratorLot = lot ? {
                    ...lot,
                    remainingNetKg: newRemaining,
                    status: isFullySold ? 'FULLY_SOLD' : 'PARTIALLY_SOLD',
                    salesHistory: updatedSalesHistory
                } : {
                    id: item.id,
                    lotNumber: `REF-LOT-${item.id.slice(-4)}`,
                    harvestEventName: item.name,
                    harvestDate: item.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                    arrivalDateTime: item.date || new Date().toISOString(),
                    arrivalDayPricePerKg: item.unitCost || 10,
                    totalNetKg: item.coldStorageKg || item.currentStock,
                    remainingNetKg: newRemaining,
                    status: isFullySold ? 'FULLY_SOLD' : 'PARTIALLY_SOLD',
                    salesHistory: updatedSalesHistory
                };

                return {
                    ...item,
                    currentStock: newRemaining,
                    coldStorageKg: newRemaining,
                    soldKg: (item.soldKg || 0) + saleRecord.soldNetKg,
                    status: isFullySold ? 'SOLD' : 'PARTIALLY_SOLD',
                    refrigeratorLot: updatedLot
                };
            }
            return item;
        });

        onSetInventoryItems(updatedItems);

        // Record Transaction & Account Balance
        if (paymentTx && paymentTx.amount > 0 && props.onSetTransactions && props.transactions) {
            const newTx: any = {
                id: `TX-${Date.now()}`,
                organizationId: 'org-1',
                transactionType: 'Incoming Payment',
                amount: paymentTx.amount,
                date: new Date().toISOString(),
                description: paymentTx.description || `Sale of ${saleRecord.soldNetKg} KG to ${saleRecord.buyerName}`,
                category: 'Sales',
                debitAccountId: paymentTx.accountId || 'cash-1',
                creditAccountId: 'revenue-account',
                paymentMode: paymentTx.type === 'CASH' ? 'Cash' : 'Bank Transfer',
                referenceId: lotId
            };
            props.onSetTransactions([...props.transactions, newTx]);

            if (props.onSetAccounts && props.accounts) {
                const updatedAccounts = props.accounts.map(acc => {
                    if (acc.id === newTx.debitAccountId) {
                        return { ...acc, balance: acc.balance + paymentTx.amount };
                    }
                    return acc;
                });
                props.onSetAccounts(updatedAccounts);
            }
        }
        toast.success(`Successfully processed sale of ${saleRecord.soldNetKg} KG from Refrigerator!`);
    };

    // Handle adding IoT logger
    const handleAddLogger = () => {
        if (!newLoggerName || !newLoggerSerial) {
            toast.error('Please enter probe name and serial number.');
            return;
        }

        const created: TemperatureLogger = {
            id: `log-${Date.now()}`,
            serialNo: newLoggerSerial,
            name: newLoggerName,
            zone: newLoggerZone,
            currentTempC: targetSetPointC,
            targetTempC: targetSetPointC,
            humidityPercent: 92,
            co2Ppm: 450,
            batteryPercent: 100,
            status: 'ONLINE',
            lastPing: 'Just connected'
        };

        setLoggers([...loggers, created]);
        setIsAddLoggerOpen(false);
        setNewLoggerName('');
        setNewLoggerSerial('');
        toast.success(`IoT Sensor Probe "${created.name}" registered successfully!`);
    };

    return (
        <div className="space-y-6 animate-fade-in p-1">
            
            {/* Header Banner & Stats */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-cyan-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-cyan-500/20 text-cyan-300 rounded-xl border border-cyan-500/30">
                                <Snowflake className="w-5 h-5 text-cyan-400 animate-spin-slow" />
                            </span>
                            <span className="text-xs font-mono uppercase font-black tracking-widest text-cyan-300">
                                Cold Storage Facilities
                            </span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-black mt-1 text-slate-100">
                            Refrigerator & Cold Storage Management (მაცივარი)
                        </h1>
                    </div>

                    {/* Target Temperature Setpoint Dial */}
                    <div className="flex items-center gap-3 bg-slate-800/90 p-2.5 rounded-2xl border border-slate-700/80 text-xs">
                        <div className="flex items-center gap-1.5 text-cyan-400 font-extrabold">
                            <Thermometer className="w-4 h-4" /> Target Temp:
                        </div>
                        <span className="text-lg font-black text-white">{targetSetPointC.toFixed(1)}°C</span>
                        <div className="flex gap-1">
                            <button 
                                onClick={() => {
                                    const next = Number((targetSetPointC - 0.5).toFixed(1));
                                    setTargetSetPointC(next);
                                    toast.info(`Cooler setpoint updated to ${next}°C`);
                                }}
                                className="w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-black text-xs flex items-center justify-center cursor-pointer"
                            >
                                -
                            </button>
                            <button 
                                onClick={() => {
                                    const next = Number((targetSetPointC + 0.5).toFixed(1));
                                    setTargetSetPointC(next);
                                    toast.info(`Cooler setpoint updated to ${next}°C`);
                                }}
                                className="w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-black text-xs flex items-center justify-center cursor-pointer"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stat Cards & Capacity Progress */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
                    {/* Capacity KPI */}
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 relative overflow-hidden">
                        <div className="flex justify-between items-center">
                            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Total Yield Stored</span>
                            <button 
                                onClick={() => setIsEditingCapacity(!isEditingCapacity)}
                                className="text-[9px] text-cyan-400 hover:underline font-bold"
                            >
                                {isEditingCapacity ? 'Save' : 'Max Cap'}
                            </button>
                        </div>
                        
                        <span className="text-xl md:text-2xl font-black text-white mt-1 block">
                            {totalNetKgInStorage.toFixed(1)} <span className="text-xs text-cyan-400 font-bold">KG</span>
                        </span>

                        {isEditingCapacity ? (
                            <div className="mt-2 flex items-center gap-1">
                                <span className="text-[9px] text-slate-400">Cap:</span>
                                <input 
                                    type="number"
                                    value={coolerCapacityKg}
                                    onChange={e => setCoolerCapacityKg(Number(e.target.value))}
                                    className="w-20 p-1 bg-slate-900 border border-slate-700 rounded text-xs font-black text-cyan-300"
                                />
                            </div>
                        ) : (
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                    <span>{capacityOccupiedPercent.toFixed(1)}% Full</span>
                                    <span>Left: {remainingCapacityKg.toFixed(0)} KG</span>
                                </div>
                                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-500 ${capacityOccupiedPercent > 90 ? 'bg-red-500' : capacityOccupiedPercent > 70 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                                        style={{ width: `${capacityOccupiedPercent}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pallets Breakdown */}
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Pallets Stored</span>
                        <span className="text-xl md:text-2xl font-black text-slate-100 mt-1 block">
                            {totalPalletsInStorage} <span className="text-xs text-slate-400 font-bold">Pallets</span>
                        </span>
                        <span className="text-[10px] font-bold text-cyan-300 block mt-1">
                            Euro: {euroPalletsCount} • Standard: {standardPalletsCount}
                        </span>
                    </div>

                    {/* Active Lots */}
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Active Storage Lots</span>
                        <span className="text-xl md:text-2xl font-black text-cyan-300 mt-1 block">
                            {lots.length} <span className="text-xs text-slate-400 font-bold">Lots</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 block mt-1">
                            Avg Aging: {avgDaysInStorage} Days
                        </span>
                    </div>

                    {/* Portfolio Valuation */}
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Storage Valuation</span>
                        <span className="text-xl md:text-2xl font-black text-emerald-400 mt-1 block">
                            {formatCurrency(totalValuation)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 block mt-1">
                            Based on Arrival Day Price
                        </span>
                    </div>
                </div>

                {/* View Tabs */}
                <div className="flex gap-2 pt-4 border-t border-slate-800/80 mt-4">
                    <button
                        onClick={() => setActiveTab('lots')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'lots' ? 'bg-cyan-500 text-slate-950 font-black shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <Package className="w-4 h-4" /> Storage Lots Ledger
                    </button>
                    <button
                        onClick={() => setActiveTab('matrix')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'matrix' ? 'bg-cyan-500 text-slate-950 font-black shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <MapPin className="w-4 h-4" /> Room Sides & Zones Matrix
                    </button>
                    <button
                        onClick={() => setActiveTab('iot')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'iot' ? 'bg-cyan-500 text-slate-950 font-black shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <Wifi className="w-4 h-4" /> Thermometers & IoT Loggers ({loggers.length})
                    </button>
                </div>
            </div>

            {/* TAB 1: LOTS STORAGE LEDGER */}
            {activeTab === 'lots' && (
                <div className="space-y-5">
                    {/* Filter Bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <input
                                type="text"
                                placeholder="Search lot tag, harvest name, or room placement..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setDurationFilter('ALL')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${durationFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                ALL Lots
                            </button>
                            <button
                                onClick={() => setDurationFilter('FRESH')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${durationFilter === 'FRESH' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Fresh (&le; 3 Days)
                            </button>
                            <button
                                onClick={() => setDurationFilter('MID')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${durationFilter === 'MID' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Mid (4-7 Days)
                            </button>
                            <button
                                onClick={() => setDurationFilter('LONG')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${durationFilter === 'LONG' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Long (&gt; 7 Days)
                            </button>
                        </div>
                    </div>

                    {/* Lots Grid */}
                    {filteredLots.length === 0 ? (
                        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 space-y-3">
                            <Snowflake className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
                            <h3 className="font-extrabold text-slate-700 text-base">No Refrigerator Storage Lots Found</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                Harvest yield transferred to refrigerator storage or marked for delayed sale will appear here automatically.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredLots.map(({ item, lot, daysInStorage }) => {
                                const durationColor = 
                                    daysInStorage <= 3 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    daysInStorage <= 7 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-purple-50 text-purple-700 border-purple-200';

                                return (
                                    <div 
                                        key={lot.id} 
                                        className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                                    >
                                        <div className="space-y-3">
                                            {/* Top Row */}
                                            <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-3">
                                                <div>
                                                    <span className="px-2.5 py-1 bg-cyan-50 text-cyan-700 font-mono text-[10px] uppercase font-black tracking-widest rounded-lg border border-cyan-200 inline-block mb-1">
                                                        #{lot.lotNumber}
                                                    </span>
                                                    <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
                                                        {lot.harvestEventName || item.name}
                                                    </h3>
                                                </div>

                                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-xl border flex items-center gap-1 ${durationColor}`}>
                                                    <Clock className="w-3 h-3" />
                                                    {daysInStorage} Days Stored
                                                </span>
                                            </div>

                                            {/* Metrics Grid */}
                                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase text-slate-400">Remaining Stock</span>
                                                    <span className="text-base font-black text-slate-900">
                                                        {lot.remainingNetKg.toFixed(1)} <span className="text-xs text-slate-500 font-bold">KG</span>
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase text-slate-400">Arrival Price</span>
                                                    <span className="text-base font-black text-emerald-600">
                                                        {formatCurrency(lot.arrivalDayPricePerKg)}/KG
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Details List */}
                                            <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400 text-[10px] font-bold uppercase">Placement Side:</span>
                                                    <span className="font-extrabold text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100">
                                                        {lot.roomPlacementNotes || 'Cold Room #1'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400 text-[10px] font-bold uppercase">Pallets & Boxes:</span>
                                                    <span className="font-bold text-slate-700">
                                                        {lot.palletsCount || 0} {lot.palletsType || 'Euro'} Pallets • {lot.boxesCount || 0} Crates
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400 text-[10px] font-bold uppercase">Arrival Date:</span>
                                                    <span className="font-bold text-slate-700">{lot.arrivalDateTime?.slice(0, 10)}</span>
                                                </div>
                                                {lot.loaderNames && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400 text-[10px] font-bold uppercase">Loaders:</span>
                                                        <span className="font-bold text-slate-700 truncate max-w-[140px]">{lot.loaderNames}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer Actions */}
                                        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                            <button
                                                onClick={() => handleRestoreToLedger(item.id, lot.lotNumber)}
                                                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-bold text-[10px] uppercase transition-colors flex items-center gap-1 cursor-pointer"
                                                title="Restore lot back to active Produce Ledger"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                                Restore
                                            </button>

                                            <button
                                                onClick={() => setSelectedLotForSell(lot)}
                                                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <DollarSign className="w-3.5 h-3.5" />
                                                Sell Lot
                                            </button>

                                            {(lot.salesHistory && lot.salesHistory.length > 0) && (
                                                <button
                                                    onClick={() => setHistoryModalLot(lot)}
                                                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-[10px] uppercase transition-colors flex items-center gap-1 cursor-pointer"
                                                    title="View Sales History"
                                                >
                                                    <FileText className="w-3.5 h-3.5" />
                                                    Log ({lot.salesHistory.length})
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: ROOM SIDES & ZONES MATRIX */}
            {activeTab === 'matrix' && (
                <div className="space-y-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-cyan-600" /> Cold Storage Room Side & Spatial Layout Matrix
                        </h3>
                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                            Real-time distribution of harvest events, pallet counts, and yields across cooler walls and aisles
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Object.entries(roomZoneMatrix).map(([zoneName, zoneData]) => (
                            <div key={zoneName} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                    <span className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                        🧱 {zoneName}
                                    </span>
                                    <span className="text-[10px] font-black bg-cyan-100 text-cyan-900 px-2 py-0.5 rounded-full">
                                        {zoneData.lots.length} Lot(s)
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                                        <span className="block text-[8px] font-black uppercase text-slate-400">Total Yield</span>
                                        <span className="font-black text-slate-900">{zoneData.totalKg.toFixed(1)} KG</span>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                                        <span className="block text-[8px] font-black uppercase text-slate-400">Pallets</span>
                                        <span className="font-black text-slate-900">{zoneData.pallets} Pallets</span>
                                    </div>
                                </div>

                                {/* Items in zone */}
                                <div className="space-y-2 pt-1">
                                    {zoneData.lots.map(({ lot, daysInStorage }) => (
                                        <div key={lot.id} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="font-extrabold text-xs text-slate-800">{lot.harvestEventName}</span>
                                                <span className="font-mono text-[9px] font-black text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">
                                                    #{lot.lotNumber}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                                <span>{lot.remainingNetKg.toFixed(1)} KG ({lot.palletsCount || 0} {lot.palletsType || 'Euro'} Pallets)</span>
                                                <span>🕒 {daysInStorage}d</span>
                                            </div>
                                        </div>
                                    ))}
                                    {zoneData.lots.length === 0 && (
                                        <p className="text-center text-[10px] font-bold text-slate-400 py-4">
                                            No lots placed on {zoneName}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: THERMOMETERS & IOT LOGGERS CONTROL */}
            {activeTab === 'iot' && (
                <div className="space-y-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Wifi className="w-5 h-5 text-cyan-600 animate-pulse" /> Wireless Thermometers & Environmental Data Loggers
                            </h3>
                            <p className="text-xs text-slate-400 font-bold mt-0.5">
                                Automated cooler temperature, humidity, CO2 telemetry probes and control panel
                            </p>
                        </div>

                        <button 
                            onClick={() => setIsAddLoggerOpen(true)}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                            <Plus className="w-4 h-4" /> Register New IoT Logger
                        </button>
                    </div>

                    {/* Sensor Probe Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {loggers.map(logger => {
                            const isTempOk = Math.abs(logger.currentTempC - targetSetPointC) <= 0.8;

                            return (
                                <div key={logger.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 relative">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[9px] font-black uppercase text-cyan-700 bg-cyan-100/80 px-2 py-0.5 rounded">
                                                {logger.zone}
                                            </span>
                                            <h4 className="font-black text-sm text-slate-900 mt-1">{logger.name}</h4>
                                            <span className="text-[10px] font-mono font-bold text-slate-400">ID: {logger.serialNo}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full border ${
                                            logger.status === 'ONLINE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}>
                                            ● {logger.status}
                                        </span>
                                    </div>

                                    {/* Telemetry Gauge Grid */}
                                    <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Live Temperature</span>
                                            <span className={`text-xl font-black ${isTempOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {logger.currentTempC.toFixed(1)}°C
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Humidity</span>
                                            <span className="text-xl font-black text-cyan-600">
                                                {logger.humidityPercent}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 pt-1">
                                        <span>🔋 Battery: {logger.batteryPercent}%</span>
                                        <span>CO2: {logger.co2Ppm} ppm</span>
                                        <span>Ping: {logger.lastPing}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Register New Logger Modal */}
            {isAddLoggerOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2025] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <h3 className="font-black text-base text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Wifi className="w-5 h-5 text-cyan-600" /> Register New Wireless Thermometer Logger
                        </h3>

                        <div className="space-y-3 text-xs font-bold text-slate-700">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Probe / Logger Name</label>
                                <input 
                                    type="text"
                                    value={newLoggerName}
                                    onChange={e => setNewLoggerName(e.target.value)}
                                    placeholder="e.g. Rack A Sensor Probe"
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Serial Number / Hardware ID</label>
                                <input 
                                    type="text"
                                    value={newLoggerSerial}
                                    onChange={e => setNewLoggerSerial(e.target.value)}
                                    placeholder="e.g. SENS-88902-BLE"
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Zone Assignment</label>
                                <select
                                    value={newLoggerZone}
                                    onChange={e => setNewLoggerZone(e.target.value as any)}
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                                >
                                    <option value="North Wall">North Wall</option>
                                    <option value="South Wall">South Wall</option>
                                    <option value="East Wall">East Wall</option>
                                    <option value="West Wall">West Wall</option>
                                    <option value="Center Isle">Center Isle</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-3">
                            <button 
                                onClick={() => setIsAddLoggerOpen(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs uppercase rounded-xl flex-1 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleAddLogger}
                                className="px-4 py-2 bg-cyan-600 text-white font-black text-xs uppercase rounded-xl flex-1 cursor-pointer"
                            >
                                Register Sensor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Refrigerator Delayed Sale Modal */}
            {selectedLotForSell && (
                <RefrigeratorSellModal
                    isOpen={!!selectedLotForSell}
                    onClose={() => setSelectedLotForSell(null)}
                    lot={selectedLotForSell}
                    accounts={accounts}
                    onConfirmSell={handleConfirmSellFromLot}
                />
            )}

            {/* Sales History Modal */}
            {historyModalLot && (
                <div className="fixed inset-0 bg-black/50 z-[2020] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl border border-slate-100">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <FileText className="w-4 h-4 text-cyan-600" /> Refrigerator Sales History: {historyModalLot.lotNumber}
                            </h3>
                            <button onClick={() => setHistoryModalLot(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
                        </div>

                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs">
                            {historyModalLot.salesHistory?.map(s => (
                                <div key={s.saleId} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                                    <div className="flex justify-between font-black text-slate-900">
                                        <span>Client: {s.buyerName}</span>
                                        <span className="text-emerald-600">{formatCurrency(s.totalRevenue)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-500 font-bold text-[11px]">
                                        <span>{s.soldNetKg} KG @ {formatCurrency(s.pricePerKg)}/KG</span>
                                        <span>Date: {s.saleDate}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-3">
                            <button onClick={() => setHistoryModalLot(null)} className="px-5 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase cursor-pointer">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default RefrigeratorView;
