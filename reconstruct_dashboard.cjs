const fs = require('fs');

const tail = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

const head = `import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    HarvestEvent, HarvestEntry, Employee, Machinery, 
    InventoryItem, HarvestLog, PlantationFeature, Crop, CropVariety, Role, EmployeeGroup
} from '../../../types';
import HarvestStatsGrid from './HarvestStatsGrid';
import HarvestLocalSyncPanel from './HarvestLocalSyncPanel';
import OperationLogWidget from './OperationLogWidget';
import WeighStationModal from './WeighStationModal';
import HarvestLogModal from './HarvestLogModal';
import OperationLogModal from './OperationLogModal';
import CloseHarvestModal from './CloseHarvestModal';
import DailyHarvestModal from './DailyHarvestModal';
import BoxScannerOverlay from './BoxScannerOverlay';
import HarvestEventHistoryModal from './HarvestEventHistoryModal';
import ShareHarvestEventModal from './ShareHarvestEventModal';
import OnlineUsersModal from './OnlineUsersModal';
import { useLanguage } from '../../../contexts/LanguageContext';
import { toast } from 'sonner';

interface Props {
    event: HarvestEvent;
    onBack: () => void;
    crops?: Crop[];
    cropVarieties?: CropVariety[];
    hardwareDevices?: any[];
    inventoryItems?: InventoryItem[];
    machinery?: Machinery[];
    employees?: Employee[];
    harvestEvents?: HarvestEvent[];
    onSetHarvestEvents?: (events: HarvestEvent[]) => void;
    harvestEntries?: HarvestEntry[];
    onSetHarvestEntries?: (entries: HarvestEntry[]) => void;
    plantationFeatures?: PlantationFeature[];
    roles?: Role[];
    employeeGroups?: EmployeeGroup[];
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    onSetEmployees?: (employees: Employee[]) => void;
    onSetEmployeeGroups?: (groups: EmployeeGroup[]) => void;
    onLogActivity?: (title: string, category: string, type: string, details: string) => void;
    currentUser?: any;
    sectors?: any[];
    allSectors?: any[];
}

const HarvestDashboard: React.FC<Props> = ({ 
    event, onBack, inventoryItems = [], machinery = [], employees = [], 
    harvestEvents = [], onSetHarvestEvents, harvestEntries = [], onSetHarvestEntries,
    onSetInventoryItems, onSetEmployees, onSetEmployeeGroups, onLogActivity,
    currentUser, sectors, allSectors, roles, crops, cropVarieties, employeeGroups,
    ...props 
}) => {
    const { t } = useLanguage();
    const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isOperationLogOpen, setIsOperationLogOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [showDailyHarvestModal, setShowDailyHarvestModal] = useState(false);
    const [isBoxScannerOpen, setIsBoxScannerOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isOnlineUsersModalOpen, setIsOnlineUsersModalOpen] = useState(false);
    
    const [pkgBoxQty, setPkgBoxQty] = useState("");
    const [pkgPunetQty, setPkgPunetQty] = useState("");
    const [pkgPunetsPerBox, setPkgPunetsPerBox] = useState("12");

    const [editingLog, setEditingLog] = useState<any>(null);
    const [drawnGeometry, setDrawnGeometry] = useState<any>(null);

    const filteredEntries = harvestEntries.filter(e => e.harvestEventId === event.id);
    const eventEntries = filteredEntries;
    
    const durationHours = 1; 
    
    const filteredTotals = {
        totalWeight: filteredEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0),
        totalGrossWeight: filteredEntries.reduce((sum, e) => sum + (e.grossWeightKg || 0), 0),
        totalBoxes: filteredEntries.length
    };
    
    const displayTotalBoxes = event.totalBoxes !== undefined ? event.totalBoxes : (filteredTotals?.totalBoxes || 0);
    const calculatedPunetsFromEntries = filteredEntries.reduce((sum, e) => sum + (e.punetCount || 0), 0);
    const displayTotalPunets = event.physicalPunets !== undefined ? event.physicalPunets : (calculatedPunetsFromEntries > 0 ? calculatedPunetsFromEntries : (displayTotalBoxes * (event?.punetsPerBox || 12)));

    const handleAddEntry = () => {};
    const handleDeleteEntry = () => {};
    const handleUpdateEntry = () => {};
    const handleFinishEvent = () => {};
    const handleBoxScan = () => {};
    const onSetHarvestLogs = () => {};
    const handlePushToCloud = () => {};
    const handleSyncToLAN = () => {};
    const toggleSimulationMode = () => {};
    const handleCommitSimulation = () => {};

    const isSimulationMode = false;
    const simulatedEntries = [];

    const modalPickers = employees;
    const modalPackagingItems = inventoryItems;
    const activeVarieties = event.varieties || [];
    const selectedVarieties = activeVarieties;
    const modalAllSectors = allSectors || [];
    const plantationFeatures = props.plantationFeatures || [];
    const activeOnlineUsers = [];
    const memoizedMap = <div className="h-full bg-slate-200 flex items-center justify-center text-slate-400">Map Placeholder</div>;
    const sectorNames = "";

    return (
        <div className="flex h-screen bg-slate-50 relative">
            <div className="w-[450px] bg-white border-r border-slate-200 flex flex-col h-full z-10 shadow-2xl overflow-y-auto">
                <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50 sticky top-0 z-20">
                    <div>
                        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-2">
                           <span className="font-bold text-xs uppercase tracking-widest">← Back</span>
                        </button>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{event.name}</h1>
                    </div>
                </div>
                
                <div className="p-4 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        {(() => {
`;

// Extract the original remaining part that was left over
let remaining = tail;
const marker = `{displayTotalBoxes}/{displayTotalPunets}`;
const idx = tail.indexOf(marker);
if (idx !== -1) {
    remaining = tail.substring(idx);
} else {
    // If not found, just append the whole tail, but remove the broken line at start
    remaining = tail.replace(/^import React,\s*\{displayTotalBoxes\}\/\{displayTotalPunets\}\s*<\/span>\s*<span className="text-xs font-bold text-slate-400 uppercase">Bxs\/Pnts<\/span>\s*<\/div>\s*<\/>\s*\);\s*\}\)\(\)\}/, '');
}

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', head + "                        " + remaining);
