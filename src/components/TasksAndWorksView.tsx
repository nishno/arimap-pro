
import React, { useState, useMemo, useEffect } from 'react';
import type { 
    Employee, 
    WorkAssignment, 
    PlantationFeature, 
    Machinery, 
    Layer, 
    OperationalLog, 
    ActiveDrawingTool, 
    Role, 
    Permission, 
    DailyLogEntry, 
    NutritionPlan, 
    InventoryItem, 
    LinePlantationFeature, 
    SeedlingPlantationFeature,
    User
} from '../types';
import { isValidCoordinate } from '../types';
import SystemManagementPlanner from './SystemManagementPlanner';
import { MapComponent, MapComponentProps } from './MapComponent';
import { getSphericalPolygonArea } from '../services/geospatialService';
import { Popup } from 'react-leaflet';
import L from 'leaflet';
import { BriefcaseIcon, XIcon, CalendarDaysIcon, TractorIcon, XCircleIcon, ChevronRightIcon, PlusIcon, RefreshCwIcon, ClipboardDocumentIcon } from './Icons';
import { SlidersHorizontal, Layers, FileSpreadsheet, MapPin, Tag, Sparkles, Calculator, CheckSquare, Square, DollarSign, Users, Clock, Download, ExternalLink, ScanLine } from 'lucide-react';
import { exportToExcel, exportToGoogleSheetsClipboard, exportToCsv } from '../utils/excelExporter';
import { useAiAssistant } from '../hooks/useAiAssistant';
import { useLanguage } from '../contexts/LanguageContext';
import { safeStorage } from '../services/storageService';
import ModuleAiAssistant from './ModuleAiAssistant';
import QrScannerModal from './QrScannerModal';
import { parseUniversalScan } from '../utils/universalScannerParser';
import { findMatchingEmployee } from '../utils/employeeMatching';
import ResizableDivider from './common/ResizableDivider';
import OperationalAreaLogModal from './OperationalAreaLogModal';
import WorkDetailsModal from './WorkDetailsModal';
import WorkVehiclesModal from './WorkVehiclesModal';
import WorkMaterialsModal from './WorkMaterialsModal';
import { FieldAgronomyIntelligenceModal } from './FieldAgronomyIntelligenceModal';
import { toast } from 'sonner';
import '../lib/leafletSafety';
import { extractSafePoints } from '../lib/leafletSafety';

const parseSafeGeometry = (geom: any): [number, number][] => {
    return extractSafePoints(geom);
};

interface TasksAndWorksViewProps {
  systemProps: {
    employees: Employee[];
    onSetEmployees: (employees: Employee[]) => void;
    workAssignments: WorkAssignment[];
    onSetWorkAssignments: (assignments: WorkAssignment[]) => void;
    machinery: Machinery[];
    onSetMachinery: (machinery: Machinery[]) => void;
    plantationFeatures: PlantationFeature[];
    onSetHighlightedFeatureId: (id: string | null) => void;
    operationalLogs: OperationalLog[];
    onSetOperationalLogs: (logs: OperationalLog[] | ((prev: OperationalLog[]) => OperationalLog[])) => void;
    roles: Role[];
    onSetRoles: (roles: Role[]) => void;
    dailyLogs: DailyLogEntry[];
    onSetDailyLogs: (logs: DailyLogEntry[]) => void;
    currentUserPermissions: Set<Permission>;
    nutritionPlans: NutritionPlan[];
    inventoryItems: InventoryItem[];
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    notes: any[];
    checkpoints: any[];
  };
  mapProps: MapComponentProps;
  onLogOnMapRequest: (type: 'work' | 'harvest', id: string) => void;
  onPushOfflineData?: () => Promise<void>;
  isManualOffline?: boolean;
  onToggleOffline?: (offline: boolean) => void;
  onResetSystem?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: (data: any) => void;
  onOpenDataAuditor?: () => void;
  syncDelay?: number;
  onSetSyncDelay?: (delay: number) => void;
  currentUser?: User | null;
  activeOrgId?: string;
}

const TasksAndWorksView: React.FC<TasksAndWorksViewProps> = (props) => {
    const { 
        systemProps, 
        mapProps, 
        onPushOfflineData, 
        isManualOffline,
        onToggleOffline,
        onResetSystem,
        onExportBackup,
        onImportBackup,
        onOpenDataAuditor,
        syncDelay,
        onSetSyncDelay,
        currentUser,
        activeOrgId
    } = props;
    const [isSyncing, setIsSyncing] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                onImportBackup?.(data);
            } catch (err) {
                toast.error("Invalid backup file format.");
            }
        };
        reader.readAsText(file);
    };

    const { center: mapCenter, zoom, plantationFeatures, layers } = mapProps;
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const { handleSendCommand, isAssistantLoading } = useAiAssistant(isKa ? 'ka' : 'en');
    const [highlightedFeatureId, setHighlightedFeatureId] = useState<string | null>(null);
    const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeDrawingTool, setActiveDrawingTool] = useState<ActiveDrawingTool>({ tool: null, color: '#f97316', activeLayerId: 'log-layer' });
    const [loggingForAssignment, setLoggingForAssignment] = useState<WorkAssignment | null>(null);
    const [opLogPopup, setOpLogPopup] = useState<{ log: OperationalLog; latlng: L.LatLng; trenchCount: number; cropCount: number; } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Resizable Edge Handle state
    const [terminalWidth, setTerminalWidth] = useState<number>(() => {
        const saved = safeStorage.getItem('tasks_terminal_width');
        const parsed = saved ? parseInt(saved, 10) : 450;
        return Number.isFinite(parsed) && parsed >= 280 ? parsed : 450;
    });

    // Map Area Log Modal State
    const [pendingDrawnGeometry, setPendingDrawnGeometry] = useState<[number, number][] | null>(null);
    const [isAreaLogModalOpen, setIsAreaLogModalOpen] = useState(false);

    // Work Details & Payroll Control Modal (Yield control like)
    const [selectedWorkForYieldModal, setSelectedWorkForYieldModal] = useState<WorkAssignment | null>(null);

    // Selected Registries for Aggregated OPEX / Salaries Calculation
    const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
    const [standingWorkId, setStandingWorkId] = useState<string | null>(null);
    const [isFieldAgroModalOpen, setIsFieldAgroModalOpen] = useState(false);
    const [isVehiclesModalOpen, setIsVehiclesModalOpen] = useState(false);
    const [isMaterialsModalOpen, setIsMaterialsModalOpen] = useState(false);

    // Day filter state synchronized with Universal Summary & Mission List
    const [dayFilter, setDayFilter] = useState<'today' | 'past' | 'future' | 'choose' | 'all'>('all');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Assignments filtered by time range
    const dateFilteredAssignments = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const seenIds = new Set<string>();
        return (systemProps.workAssignments || []).filter(w => {
            if (!w || !w.id) return false;
            if (seenIds.has(w.id)) return false;
            seenIds.add(w.id);

            const isRelevant = w.source === 'tasks' || w.source === 'planner' || w.source === 'remainder' || !w.source;
            if (!isRelevant) return false;

            const d = new Date(w.date);
            d.setHours(0, 0, 0, 0);

            if (dayFilter === 'all') return true;
            if (dayFilter === 'today') return d.getTime() === today.getTime();
            if (dayFilter === 'past') return d.getTime() < today.getTime();
            if (dayFilter === 'future') return d.getTime() > today.getTime();
            if (dayFilter === 'choose') {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                return d >= start && d <= end;
            }
            return true;
        });
    }, [systemProps.workAssignments, dayFilter, startDate, endDate]);

    // Compute aggregated financial and operational summary for selected registries
    const targetRegistries = useMemo(() => {
        if (selectedWorkIds.length > 0) {
            return dateFilteredAssignments.filter(w => selectedWorkIds.includes(w.id));
        }
        return dateFilteredAssignments;
    }, [dateFilteredAssignments, selectedWorkIds]);

    // Currently active / standing registry that user is on
    const standingWork = useMemo(() => {
        if (standingWorkId) {
            const found = systemProps.workAssignments.find(w => w.id === standingWorkId);
            if (found) return found;
        }
        if (selectedWorkIds.length > 0) {
            const found = systemProps.workAssignments.find(w => w.id === selectedWorkIds[selectedWorkIds.length - 1]);
            if (found) return found;
        }
        return dateFilteredAssignments[0] || null;
    }, [standingWorkId, selectedWorkIds, systemProps.workAssignments, dateFilteredAssignments]);

    const primarySelectedWork = standingWork;

    const aggregatedRegistryStats = useMemo(() => {
        let totalLabor = 0;
        let totalMaterial = 0;
        let totalVehiclesCost = 0;
        let totalHours = 0;
        const activeWorkerSet = new Set<string>();

        targetRegistries.forEach(w => {
            // 1. Labor & Hours calculation
            let taskLabor = 0;
            let taskHours = 0;

            if (typeof w.totalLaborCost === 'number') {
                // Explicit labor cost exists
                taskLabor = Math.max(0, w.totalLaborCost);
                if (w.employeeHours && w.employeeHours.length > 0) {
                    w.employeeHours.forEach(eh => {
                        const h = eh.hours || 0;
                        taskHours += h;
                        if (h > 0 && eh.employeeId) activeWorkerSet.add(eh.employeeId);
                    });
                } else if (taskLabor > 0 && w.assignedEmployeeIds && w.assignedEmployeeIds.length > 0) {
                    w.assignedEmployeeIds.forEach(id => activeWorkerSet.add(id));
                }
            } else if (w.employeeHours && w.employeeHours.length > 0) {
                // Calculate strictly from recorded employee hours
                w.employeeHours.forEach(eh => {
                    const emp = systemProps.employees.find(e => e.id === eh.employeeId);
                    const rate = emp?.paymentRate || 0;
                    const hours = eh.hours || 0;
                    taskHours += hours;
                    if (hours > 0) {
                        if (emp?.paymentType === 'daily') {
                            taskLabor += (hours / 8) * rate;
                        } else if (emp?.paymentType === 'salary' || emp?.paymentType === 'fixed') {
                            // Fixed monthly salaries do not add to hourly task labor
                        } else {
                            taskLabor += hours * rate;
                        }
                        if (eh.employeeId) activeWorkerSet.add(eh.employeeId);
                    }
                });
            } else {
                // No recorded labor or hours: strictly zero
                taskLabor = 0;
                taskHours = 0;
            }

            // 2. Material calculation
            let taskMaterial = 0;
            if (typeof w.totalMaterialCost === 'number') {
                taskMaterial = Math.max(0, w.totalMaterialCost);
            } else if (w.materialsUsed && w.materialsUsed.length > 0) {
                w.materialsUsed.forEach(m => {
                    const item = (systemProps.inventoryItems || []).find(i => i.id === m.inventoryItemId);
                    const unitCost = (m as any).unitCost || (m as any).cost || item?.unitCost || 0;
                    taskMaterial += (m.quantity || 0) * unitCost;
                });
            } else {
                taskMaterial = 0;
            }

            // 3. Vehicle & Machinery calculation
            let taskVehicles = 0;
            if (w.assignedVehicles && w.assignedVehicles.length > 0) {
                w.assignedVehicles.forEach(v => {
                    if (!v.isOwned) {
                        taskVehicles += (v.usageHours || 0) * (v.hiredCost || 0);
                    }
                });
            }

            // 4. Overall OPEX check for consistency:
            let taskOPEX = taskLabor + taskMaterial + taskVehicles;
            if (taskOPEX === 0 && typeof w.totalCost === 'number' && w.totalCost > 0) {
                taskOPEX = w.totalCost;
                taskLabor = w.totalCost;
            }

            totalLabor += taskLabor;
            totalMaterial += taskMaterial;
            totalHours += taskHours;
            totalVehiclesCost += taskVehicles;
        });

        const totalOPEX = totalLabor + totalMaterial + totalVehiclesCost;

        return {
            count: targetRegistries.length,
            totalAvailable: dateFilteredAssignments.length,
            isSelectedOnly: selectedWorkIds.length > 0,
            totalLabor,
            totalMaterial,
            totalVehiclesCost,
            totalOPEX,
            totalHours,
            activeWorkersCount: activeWorkerSet.size
        };
    }, [targetRegistries, dateFilteredAssignments, systemProps.employees, systemProps.inventoryItems, selectedWorkIds]);

    const handleExportRegistryExcel = () => {
        if (!targetRegistries.length) {
            toast.error(isKa ? "რეესტრის ჩანაწერები ვერ მოიძებნა" : "No registry items found to export");
            return;
        }
        const rows = targetRegistries.map(w => {
            const taskName = typeof w.workName === 'string' ? w.workName : (w.workName as any)?.title || 'Task';
            const workers = (w.assignedEmployeeIds || []).map(id => {
                const emp = systemProps.employees.find(e => e.id === id);
                return emp ? emp.name : id;
            }).join(', ');

            let labor = w.totalLaborCost || 0;
            let hours = 0;
            if (!labor && w.employeeHours?.length) {
                w.employeeHours.forEach(eh => {
                    const emp = systemProps.employees.find(e => e.id === eh.employeeId);
                    const rate = emp?.paymentRate || 10;
                    hours += eh.hours || 0;
                    labor += emp?.paymentType === 'daily' ? ((eh.hours || 0) / 8) * rate : (eh.hours || 0) * rate;
                });
            } else if (!labor && w.assignedEmployeeIds?.length) {
                w.assignedEmployeeIds.forEach(empId => {
                    const emp = systemProps.employees.find(e => e.id === empId);
                    const rate = emp?.paymentRate || 10;
                    const h = w.plannedTime || 8;
                    hours += h;
                    labor += emp?.paymentType === 'daily' ? (h / 8) * rate : h * rate;
                });
            }

            let matCost = w.totalMaterialCost || 0;
            const materials = (w.materialsUsed || []).map(m => {
                const item = (systemProps.inventoryItems || []).find(i => i.id === m.inventoryItemId);
                return `${item?.name || 'Material'} (${m.quantity} ${m.unit || ''})`;
            }).join('; ');

            const opex = labor + matCost;

            return {
                [isKa ? 'დავალების დასახელება' : 'Task / Mission']: taskName,
                [isKa ? 'თარიღი' : 'Date']: new Date(w.date).toLocaleDateString(),
                [isKa ? 'სტატუსი' : 'Status']: (w.status || 'planned').toUpperCase(),
                [isKa ? 'მუშახელი' : 'Workers']: workers || 'None',
                [isKa ? 'სამუშაო საათები' : 'Hours']: Number(hours.toFixed(1)),
                [isKa ? 'ხელფასები (£)' : 'Salaries (£)']: Number(labor.toFixed(2)),
                [isKa ? 'მასალები' : 'Materials Used']: materials || 'None',
                [isKa ? 'მასალების ხარჯი (£)' : 'Material Cost (£)']: Number(matCost.toFixed(2)),
                [isKa ? 'სრული OPEX (£)' : 'Total OPEX (£)']: Number(opex.toFixed(2)),
                [isKa ? 'შენიშვნა' : 'Notes']: w.notes || ''
            };
        });

        exportToExcel(rows, `Registry_Economics_${new Date().toISOString().split('T')[0]}`, 'Registry_Economics');
        toast.success(isKa ? "რეესტრი წარმატებით ექსპორტირდა Excel-ში!" : "Registry economics successfully exported to Excel!");
    };

    const handleExportGoogleSheets = () => {
        if (!targetRegistries.length) {
            toast.error(isKa ? "რეესტრის ჩანაწერები ვერ მოიძებნა" : "No registry items found to export");
            return;
        }
        const rows = targetRegistries.map(w => {
            const taskName = typeof w.workName === 'string' ? w.workName : (w.workName as any)?.title || 'Task';
            const workers = (w.assignedEmployeeIds || []).map(id => {
                const emp = systemProps.employees.find(e => e.id === id);
                return emp ? emp.name : id;
            }).join(', ');

            let labor = w.totalLaborCost || 0;
            let hours = 0;
            if (!labor && w.employeeHours?.length) {
                w.employeeHours.forEach(eh => {
                    const emp = systemProps.employees.find(e => e.id === eh.employeeId);
                    const rate = emp?.paymentRate || 10;
                    hours += eh.hours || 0;
                    labor += emp?.paymentType === 'daily' ? ((eh.hours || 0) / 8) * rate : (eh.hours || 0) * rate;
                });
            } else if (!labor && w.assignedEmployeeIds?.length) {
                w.assignedEmployeeIds.forEach(empId => {
                    const emp = systemProps.employees.find(e => e.id === empId);
                    const rate = emp?.paymentRate || 10;
                    const h = w.plannedTime || 8;
                    hours += h;
                    labor += emp?.paymentType === 'daily' ? (h / 8) * rate : h * rate;
                });
            }

            let matCost = w.totalMaterialCost || 0;
            const opex = labor + matCost;

            return {
                'Task / Mission': taskName,
                'Date': new Date(w.date).toLocaleDateString(),
                'Status': (w.status || 'planned').toUpperCase(),
                'Workers': workers || 'None',
                'Hours': Number(hours.toFixed(1)),
                'Salaries (£)': Number(labor.toFixed(2)),
                'Material Cost (£)': Number(matCost.toFixed(2)),
                'Total OPEX (£)': Number(opex.toFixed(2)),
                'Notes': w.notes || ''
            };
        });

        const copied = exportToGoogleSheetsClipboard(rows);
        if (copied) {
            toast.success(
                isKa 
                ? "მონაცემები დაკოპირდა ბუფერში! იხსნება Google Sheets..." 
                : "Registry copied to clipboard! Opening Google Sheets (Paste with Ctrl+V)...",
                {
                    action: {
                        label: isKa ? "Sheets გახსნა" : "Open Sheets",
                        onClick: () => window.open('https://sheets.new', '_blank')
                    },
                    duration: 6000
                }
            );
            window.open('https://sheets.new', '_blank');
        } else {
            exportToCsv(rows, `Registry_GoogleSheets_${new Date().toISOString().split('T')[0]}`);
            toast.info("Downloaded CSV ready for Google Sheets import");
        }
    };

    const handleExportCsv = () => {
        if (!targetRegistries.length) {
            toast.error(isKa ? "რეესტრის ჩანაწერები ვერ მოიძებნა" : "No registry items found to export");
            return;
        }
        const rows = targetRegistries.map(w => ({
            'Task': typeof w.workName === 'string' ? w.workName : (w.workName as any)?.title || 'Task',
            'Date': new Date(w.date).toLocaleDateString(),
            'Status': (w.status || 'planned').toUpperCase(),
            'Salaries (£)': Number((w.totalLaborCost || 0).toFixed(2)),
            'Material Cost (£)': Number((w.totalMaterialCost || 0).toFixed(2)),
            'Total OPEX (£)': Number(((w.totalLaborCost || 0) + (w.totalMaterialCost || 0)).toFixed(2))
        }));
        exportToCsv(rows, `Registry_Data_${new Date().toISOString().split('T')[0]}`);
        toast.success("CSV file downloaded successfully!");
    };

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleFeatureDrawn = (type: any, geometry: any) => {
        const safeGeom = parseSafeGeometry(geometry);
        if (safeGeom.length >= 3) {
            setPendingDrawnGeometry(safeGeom);
            setIsAreaLogModalOpen(true);
        } else if (safeGeom.length >= 2 && (type === 'line' || type === 'polyline')) {
            setPendingDrawnGeometry(safeGeom);
            setIsAreaLogModalOpen(true);
        } else {
            toast.error(isKa ? "გთხოვთ მონიშნოთ ვალიდური ფართობი (მინიმუმ 3 წერტილი)" : "Please draw a valid area boundary (at least 3 coordinates)");
        }
    };

    const handleSaveAreaLog = (newLog: OperationalLog, linkedWork?: WorkAssignment) => {
        systemProps.onSetOperationalLogs(prev => [...prev, newLog]);
        if (linkedWork) {
            const exists = systemProps.workAssignments.some(w => w.id === linkedWork.id);
            if (exists) {
                systemProps.onSetWorkAssignments(
                    systemProps.workAssignments.map(w => w.id === linkedWork.id ? linkedWork : w)
                );
            } else {
                systemProps.onSetWorkAssignments([...systemProps.workAssignments, linkedWork]);
            }
        }
        setPendingDrawnGeometry(null);
        setIsAreaLogModalOpen(false);
        setLoggingForAssignment(null);
        setActiveDrawingTool({ tool: null });
        toast.success(isKa ? "სამუშაო ფართობი და ლოგი წარმატებით შეინახა რუკაზე!" : "Operational area & log successfully saved to map!");
    };
    
    const handleLogOnMapRequest = (assignment: WorkAssignment) => {
        setLoggingForAssignment(assignment);
        setActiveDrawingTool({ tool: 'area', color: '#3b82f6', activeLayerId: 'operational-logs' });
        toast.info(isKa ? `დახაზეთ სამუშაო ზონა რუკაზე (${assignment.workName})` : `Draw work zone on the map for: ${assignment.workName}`);
    };
    
    const handleOpLogClick = (log: OperationalLog, latlng: L.LatLng) => {
        if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;
        const validLogGeom = parseSafeGeometry(log.geometry);
        if (validLogGeom.length < 3) return;
        try {
            // High-performance Axis-Aligned Bounding Box calculation
            let logMinLat = Infinity, logMaxLat = -Infinity;
            let logMinLng = Infinity, logMaxLng = -Infinity;
            for (const p of validLogGeom) {
                if (p[0] < logMinLat) logMinLat = p[0];
                if (p[0] > logMaxLat) logMaxLat = p[0];
                if (p[1] < logMinLng) logMinLng = p[1];
                if (p[1] > logMaxLng) logMaxLng = p[1];
            }
        
            const trenchesInLog = plantationFeatures.filter(f => {
                if (f.type !== 'line' || (f as LinePlantationFeature).lineType !== 'row') return false;
                const geom = (f as LinePlantationFeature).geometry;
                if (!geom) return false;
                const validTrenchGeom = parseSafeGeometry(geom);
                if (validTrenchGeom.length < 1) return false;
                return validTrenchGeom.some((point: [number, number]) => {
                    const lat = point[0];
                    const lng = point[1];
                    // Check if point is inside Axis-Aligned Bounding Box (identical to logBounds.contains)
                    return lat >= logMinLat && lat <= logMaxLat && lng >= logMinLng && lng <= logMaxLng;
                });
            }) as LinePlantationFeature[];
        
            const trenchIds = new Set(trenchesInLog.map(t => t.id));
            const cropsInLog = plantationFeatures.filter(f => 
                f.type === 'seedling' && f.parentId && trenchIds.has(f.parentId)
            ).length;
        
            setOpLogPopup({ log, latlng, trenchCount: trenchesInLog.length, cropCount: cropsInLog });
        } catch (e) {
            console.error("Failed to compute operational log details on click:", e);
        }
    };


    const workAssignmentForLog = opLogPopup ? systemProps.workAssignments.find(w => w.id === opLogPopup.log.workAssignmentId) : null;

    const handleVoiceAnalysis = async () => {
        const prompt = `Analyze the current field command and work assignments. Here are the assignments: ${JSON.stringify(systemProps.workAssignments)}. 
        Provide a status report on fleet orchestration and personnel allocation. Suggest any improvements for efficiency.`;
        
        await handleSendCommand(prompt, {
            workAssignments: systemProps.workAssignments,
            onAddTask: (suggestion: string) => {
                const newTask: WorkAssignment = {
                    id: `work-${Date.now()}`,
                    workName: suggestion,
                    date: new Date().toISOString(),
                    status: 'planned',
                    assignedEmployeeIds: [],
                    notes: 'AI Suggested Command',
                    source: 'tasks',
                    complexity: 'solo',
                    plannedTime: 1,
                    employeeHours: [],
                    sectorIds: [],
                    taskType: 'Other'
                };
                systemProps.onSetWorkAssignments([...systemProps.workAssignments, systemProps.workAssignments.length > 0 ? newTask : newTask]);
                toast.success("AI added a new command to your field terminal");
            }
        });
    };

    return (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden h-full bg-[#f8fafc] relative">
            {/* Sidebar Toggle (Mobile) */}
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden absolute top-4 right-4 z-[1005] p-3 bg-white border border-slate-200 rounded-2xl shadow-xl text-[#3b36db]"
            >
                {isSidebarOpen ? <XIcon size={20} /> : <BriefcaseIcon size={20} />}
            </button>

            {/* Sidebar */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 md:relative md:inset-auto z-[1004] md:z-[1001] w-full flex-shrink-0 border-r border-slate-200 overflow-hidden flex flex-col bg-white transition-[width] duration-75"
                    style={{
                        width: typeof window !== 'undefined' && window.innerWidth > 768 ? `${terminalWidth}px` : undefined,
                        maxWidth: '85vw'
                    }}
                >
                    {/* Fixed Sticky Header & Universal Economic & OPEX Summary */}
                    <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex-shrink-0 z-20 space-y-3.5 shadow-sm">
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <h1 className="text-xl sm:text-2xl font-black italic text-[#3b36db] tracking-tighter flex items-center gap-2">
                                    FIELD <span className="text-[#3b36db]">COMMAND</span>
                                </h1>
                                <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                    Personnel and Fleet Orchestration Terminal
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        if (standingWork) {
                                            setSelectedWorkForYieldModal(standingWork);
                                        } else {
                                            toast.info(isKa ? "რეესტრი არ არის არჩეული" : "No registry selected");
                                        }
                                    }}
                                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-[9.5px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                    title={isKa ? "არჩეული რეესტრის გახსნა" : "Open Selected Registry Details"}
                                >
                                    <ClipboardDocumentIcon className="w-4 h-4" />
                                    <span>{isKa ? "რეესტრი" : "Registry"}</span>
                                </button>
                            </div>
                        </div>

                        {/* Merged Universal Registry Economic & OPEX Summary */}
                        <div className="bg-[#0f172a] text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
                            {/* Header with Title and Selection Reset/SelectAll */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                                        <Calculator className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-200">
                                            {isKa ? "რეესტრის ეკონომიკა & OPEX შეჯამება" : "Registry Economics & OPEX Summary"}
                                        </h4>
                                        <p className="text-[8.5px] font-medium text-slate-400">
                                            {aggregatedRegistryStats.isSelectedOnly 
                                                ? (isKa ? `არჩეულია: ${aggregatedRegistryStats.count} / ${aggregatedRegistryStats.totalAvailable} რეესტრი` : `Selected: ${aggregatedRegistryStats.count} of ${aggregatedRegistryStats.totalAvailable} Registries`)
                                                : (isKa ? `ყველა რეესტრი (${aggregatedRegistryStats.count} ჩანაწერი)` : `All Active Registries (${aggregatedRegistryStats.count} in view)`)
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {selectedWorkIds.length > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedWorkIds([])}
                                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                            title="Clear Selection"
                                        >
                                            {isKa ? "გასუფთავება" : "Clear"}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedWorkIds(dateFilteredAssignments.map(w => w.id))}
                                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-indigo-300 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                            title="Select All in Current Filter"
                                        >
                                            {isKa ? "ყველას მონიშვნა" : "Select All"}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Day Filter Controls (Merged from Economic Snapshot) */}
                            <div className="mb-3 space-y-2">
                                <div className="flex bg-white/10 p-1 rounded-xl">
                                    <button onClick={() => setDayFilter('all')} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${dayFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}>All</button>
                                    <button onClick={() => setDayFilter('past')} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${dayFilter === 'past' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}>Past</button>
                                    <button onClick={() => setDayFilter('today')} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${dayFilter === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}>Today</button>
                                    <button onClick={() => setDayFilter('future')} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${dayFilter === 'future' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}>Future</button>
                                    <button onClick={() => setDayFilter('choose')} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${dayFilter === 'choose' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}>Custom</button>
                                </div>

                                {dayFilter === 'choose' && (
                                    <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                                        <input 
                                            type="date" 
                                            value={startDate} 
                                            onChange={e => setStartDate(e.target.value)} 
                                            className="bg-transparent text-[9.5px] font-black text-blue-400 outline-none uppercase tracking-widest w-full"
                                        />
                                        <span className="text-slate-500 text-[9px] font-bold uppercase">to</span>
                                        <input 
                                            type="date" 
                                            value={endDate} 
                                            onChange={e => setEndDate(e.target.value)} 
                                            className="bg-transparent text-[9.5px] font-black text-blue-400 outline-none uppercase tracking-widest w-full"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Metrics Bento Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
                                <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
                                    <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                        <BriefcaseIcon className="w-3 h-3 text-indigo-400" />
                                        {isKa ? "მისიები" : "Missions"}
                                    </p>
                                    <p className="text-lg sm:text-xl font-black text-white italic tracking-tight">
                                        {aggregatedRegistryStats.count}
                                    </p>
                                    <span className="text-[7.5px] font-medium text-slate-400">
                                        {aggregatedRegistryStats.totalAvailable} in view
                                    </span>
                                </div>

                                <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
                                    <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                        <DollarSign className="w-3 h-3 text-emerald-400" />
                                        {isKa ? "ხელფასები" : "Salaries"}
                                    </p>
                                    <p className="text-lg sm:text-xl font-black text-emerald-400 italic tracking-tight">
                                        £{aggregatedRegistryStats.totalLabor.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </p>
                                    <span className="text-[7.5px] font-medium text-slate-400">
                                        {aggregatedRegistryStats.activeWorkersCount} {isKa ? "მუშახელი" : "workers"}
                                    </span>
                                </div>

                                <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
                                    <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                        <Layers className="w-3 h-3 text-amber-400" />
                                        {isKa ? "მასალები" : "Materials"}
                                    </p>
                                    <p className="text-lg sm:text-xl font-black text-amber-300 italic tracking-tight">
                                        £{aggregatedRegistryStats.totalMaterial.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </p>
                                    <span className="text-[7.5px] font-medium text-slate-400">
                                        {isKa ? "ინპუტები" : "Agro-inputs"}
                                    </span>
                                </div>

                                <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl col-span-2 sm:col-span-2">
                                    <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-indigo-400" />
                                        {isKa ? "სრული OPEX (Burn)" : "Total OPEX Burn"}
                                    </p>
                                    <p className="text-xl sm:text-2xl font-black text-white italic tracking-tight">
                                        £{aggregatedRegistryStats.totalOPEX.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </p>
                                    <span className="text-[7.5px] font-medium text-slate-400">
                                        {isKa ? "ხელფასი + მასალები" : "Salaries + Materials"}
                                    </span>
                                </div>

                                <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
                                    <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-blue-400" />
                                        {isKa ? "საათები" : "Logged Hours"}
                                    </p>
                                    <p className="text-lg sm:text-xl font-black text-blue-300 italic tracking-tight">
                                        {aggregatedRegistryStats.totalHours.toFixed(1)}h
                                    </p>
                                    <span className="text-[7.5px] font-medium text-slate-400">
                                        {isKa ? "დრო" : "Recorded"}
                                    </span>
                                </div>
                            </div>

                            {/* Export Toolbar */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleExportRegistryExcel}
                                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[8.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                                    title={isKa ? "ექსპორტი Excel-ში (.xls)" : "Export to Excel (.xls)"}
                                >
                                    <FileSpreadsheet className="w-3 h-3" />
                                    <span>Excel (.xls)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportGoogleSheets}
                                    className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[8.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                                    title={isKa ? "Google Sheets-ში გახსნა / კოპირება" : "Copy & Open in Google Sheets"}
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Google Sheets</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportCsv}
                                    className="py-1.5 px-2 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-[8.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                                    title={isKa ? "CSV ჩამოტვირთვა" : "Download CSV"}
                                >
                                    <Download className="w-3 h-3" />
                                    <span>CSV</span>
                                </button>
                            </div>
                        </div>

                        {/* ACTIVE STANDING REGISTRY INSPECTION BAR (Replaces database sync engine setting) */}
                        <div className="bg-gradient-to-r from-indigo-50/95 via-blue-50/80 to-slate-50 border border-indigo-200/90 rounded-2xl p-3 sm:p-3.5 shadow-sm space-y-2.5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-300">
                                        <ClipboardDocumentIcon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                            <p className="text-[8.5px] font-black uppercase tracking-wider text-indigo-900">
                                                {isKa ? "მიმდინარე რეესტრი" : "Active Standing Registry"}
                                            </p>
                                            {standingWork && (
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                                    standingWork.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                                    standingWork.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {standingWork.status}
                                                </span>
                                            )}
                                            {standingWork && (
                                                <span className="text-[8px] font-mono font-bold text-slate-500">
                                                    {new Date(standingWork.date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs sm:text-sm font-black text-slate-900 truncate uppercase tracking-tight">
                                            {standingWork ? (
                                                typeof standingWork.workName === 'string' 
                                                    ? standingWork.workName 
                                                    : (standingWork.workName as any)?.title || 'Registry Entry'
                                            ) : (
                                                isKa ? "მონიშნეთ ან დააწკაპუნეთ რეესტრზე ქვემოთ" : "Select or click a registry entry below"
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setIsScannerOpen(true)}
                                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[9.5px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                        title={isKa ? "QR სკანერი (მუშები / მასალები)" : "QR Scanner (Workers / Materials)"}
                                    >
                                        <ScanLine size={13} className="text-emerald-400" />
                                        <span>{isKa ? "QR სკანერი" : "Scan QR"}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (standingWork) {
                                                setSelectedWorkForYieldModal(standingWork);
                                            } else {
                                                toast.info(isKa ? "რეესტრი არ არის არჩეული" : "No registry selected");
                                            }
                                        }}
                                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-[9.5px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                        title={isKa ? "არჩეული რეესტრის გახსნა" : "Open Registry Details"}
                                    >
                                        <ChevronRightIcon className="h-3.5 w-3.5" />
                                        <span>{isKa ? "რეესტრის გახსნა" : "Registry Details"}</span>
                                    </button>
                                </div>
                            </div>

                            {/* "Add Vehicles" & "Add Materials" Option (matches Harvest Live Monitoring bar) */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100/80">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (standingWork) {
                                            setIsVehiclesModalOpen(true);
                                        } else if (systemProps.workAssignments && systemProps.workAssignments.length > 0) {
                                            const firstWork = systemProps.workAssignments[0];
                                            setStandingWorkId(firstWork.id);
                                            setIsVehiclesModalOpen(true);
                                        } else {
                                            const newWork: WorkAssignment = {
                                                id: `work-reg-${Date.now()}`,
                                                workName: isKa ? 'მიმდინარე საველე ოპერაცია' : 'Active Field Operation',
                                                date: new Date().toISOString().split('T')[0],
                                                status: 'in-progress',
                                                taskType: 'Other',
                                                employeeHours: [],
                                                sectorIds: [],
                                                assignedEmployeeIds: [],
                                                assignedVehicles: [],
                                                materialsUsed: []
                                            };
                                            systemProps.onSetWorkAssignments([newWork]);
                                            setStandingWorkId(newWork.id);
                                            setIsVehiclesModalOpen(true);
                                            toast.success(isKa ? "ახალი რეესტრი შეიქმნა ავტომობილებისთვის" : "Active registry initialized for vehicles");
                                        }
                                    }}
                                    className="bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 py-2.5 px-3 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-2xs group cursor-pointer active:scale-95"
                                    title={isKa ? "ავტომობილების და ტექნიკის დამატება" : "Add Vehicles & Machinery"}
                                >
                                    <span className="text-sm group-hover:scale-110 transition-transform">🚜</span>
                                    <span className="truncate">{isKa ? "ავტომობილების დამატება" : "Add Vehicles"}</span>
                                    {standingWork && (standingWork.assignedVehicles?.length || 0) > 0 && (
                                        <span className="ml-0.5 px-1.5 py-0.5 bg-emerald-200 text-emerald-900 rounded-md text-[9px] font-mono font-bold">
                                            {standingWork.assignedVehicles?.length}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (standingWork) {
                                            setIsMaterialsModalOpen(true);
                                        } else if (systemProps.workAssignments && systemProps.workAssignments.length > 0) {
                                            const firstWork = systemProps.workAssignments[0];
                                            setStandingWorkId(firstWork.id);
                                            setIsMaterialsModalOpen(true);
                                        } else {
                                            const newWork: WorkAssignment = {
                                                id: `work-reg-${Date.now()}`,
                                                workName: isKa ? 'მიმდინარე საველე ოპერაცია' : 'Active Field Operation',
                                                date: new Date().toISOString().split('T')[0],
                                                status: 'in-progress',
                                                taskType: 'Other',
                                                employeeHours: [],
                                                sectorIds: [],
                                                assignedEmployeeIds: [],
                                                assignedVehicles: [],
                                                materialsUsed: []
                                            };
                                            systemProps.onSetWorkAssignments([newWork]);
                                            setStandingWorkId(newWork.id);
                                            setIsMaterialsModalOpen(true);
                                            toast.success(isKa ? "ახალი რეესტრი შეიქმნა მასალებისთვის" : "Active registry initialized for materials");
                                        }
                                    }}
                                    className="bg-amber-50 border border-amber-200 hover:bg-amber-100 active:bg-amber-200 text-amber-800 py-2.5 px-3 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-2xs group cursor-pointer active:scale-95"
                                    title={isKa ? "საწყობიდან მასალების ჩამოწერა / დამატება" : "Add Materials & Stock"}
                                >
                                    <span className="text-sm group-hover:scale-110 transition-transform">📦</span>
                                    <span className="truncate">{isKa ? "მასალების დამატება" : "Add Materials"}</span>
                                    {standingWork && (standingWork.materialsUsed?.length || 0) > 0 && (
                                        <span className="ml-0.5 px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded-md text-[9px] font-mono font-bold">
                                            {standingWork.materialsUsed?.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Missions List */}
                    <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-4 sm:p-5">
                        <SystemManagementPlanner 
                            {...systemProps} 
                            onSetHighlightedFeatureId={setHighlightedFeatureId} 
                            onLogOnMapRequest={handleLogOnMapRequest}
                            selectedWorkIds={selectedWorkIds}
                            onToggleSelectWork={(id) => {
                                setSelectedWorkIds(prev => 
                                    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                );
                            }}
                            standingWorkId={standingWorkId || standingWork?.id || null}
                            onSelectStandingWork={(id) => setStandingWorkId(id)}
                            onOpenRegistryModal={(work) => setSelectedWorkForYieldModal(work)}
                            dayFilter={dayFilter}
                            onSetDayFilter={setDayFilter}
                            startDate={startDate}
                            onSetStartDate={setStartDate}
                            endDate={endDate}
                            onSetEndDate={setEndDate}
                        />
                    </div>
                </div>
            )}
            
            <QrScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                mockEmployees={systemProps.employees}
                inventoryItems={systemProps.inventoryItems}
                initialCategory="auto"
                title={isKa ? "სამუშაო რეესტრის QR სკანერი" : "Work Registry QR Scanner"}
                description={isKa ? "დაასკანერეთ მუშაკის ID ბარათი ან მასალის QR/შტრიხკოდი" : "Scan worker badge or material barcode"}
                onScan={(result, cat, parsedData) => {
                    const code = String(result).trim();
                    const parsed = parsedData || parseUniversalScan(code, systemProps.employees, systemProps.inventoryItems, 'auto');

                    // 1. Worker Identification
                    if (parsed.detectedType === 'worker' || parsed.employee) {
                        const emp = parsed.employee || findMatchingEmployee(systemProps.employees, code) || systemProps.employees.find(e => e.id === code || e.barcode === code || e.idNumber === code);
                        if (emp) {
                            let targetWork = standingWork;
                            if (!targetWork) {
                                targetWork = {
                                    id: `work-reg-${Date.now()}`,
                                    workName: isKa ? 'მიმდინარე საველე ოპერაცია' : 'Active Field Operation',
                                    date: new Date().toISOString().split('T')[0],
                                    status: 'in-progress',
                                    taskType: 'Other',
                                    employeeHours: [{ employeeId: emp.id, hours: 8 }],
                                    sectorIds: [],
                                    assignedEmployeeIds: [emp.id],
                                    assignedVehicles: [],
                                    materialsUsed: []
                                };
                                systemProps.onSetWorkAssignments([targetWork, ...systemProps.workAssignments]);
                                setStandingWorkId(targetWork.id);
                            } else {
                                const alreadyAssigned = (targetWork.assignedEmployeeIds || []).includes(emp.id);
                                if (!alreadyAssigned) {
                                    const updated: WorkAssignment = {
                                        ...targetWork,
                                        assignedEmployeeIds: [...(targetWork.assignedEmployeeIds || []), emp.id],
                                        employeeHours: [...(targetWork.employeeHours || []), { employeeId: emp.id, hours: 8 }]
                                    };
                                    systemProps.onSetWorkAssignments(
                                        systemProps.workAssignments.map(w => w.id === targetWork.id ? updated : w)
                                    );
                                }
                            }
                            toast.success(isKa ? `✓ მუშაკი ${emp.name} დაემატა რეესტრში!` : `✓ Worker ${emp.name} assigned to registry!`);
                            return;
                        }
                    }

                    // 2. Material Identification
                    if (parsed.detectedType === 'material' || parsed.material) {
                        const mat = parsed.material?.item || systemProps.inventoryItems.find(i => 
                            i.id === code || (i as any).sku === code || (i as any).barcode === code
                        );
                        if (mat) {
                            const qty = parsed.material?.quantity || 1;
                            let targetWork = standingWork;
                            if (!targetWork) {
                                targetWork = {
                                    id: `work-reg-${Date.now()}`,
                                    workName: isKa ? 'მიმდინარე საველე ოპერაცია' : 'Active Field Operation',
                                    date: new Date().toISOString().split('T')[0],
                                    status: 'in-progress',
                                    taskType: 'Other',
                                    employeeHours: [],
                                    sectorIds: [],
                                    assignedEmployeeIds: [],
                                    assignedVehicles: [],
                                    materialsUsed: [{ inventoryItemId: mat.id, quantity: qty }]
                                };
                                systemProps.onSetWorkAssignments([targetWork, ...systemProps.workAssignments]);
                                setStandingWorkId(targetWork.id);
                            } else {
                                const existingIdx = (targetWork.materialsUsed || []).findIndex(m => m.inventoryItemId === mat.id);
                                let updatedMaterials = [...(targetWork.materialsUsed || [])];
                                if (existingIdx >= 0) {
                                    updatedMaterials[existingIdx].quantity = (Number(updatedMaterials[existingIdx].quantity) || 0) + qty;
                                } else {
                                    updatedMaterials.push({ inventoryItemId: mat.id, quantity: qty });
                                }
                                const updated: WorkAssignment = { ...targetWork, materialsUsed: updatedMaterials };
                                systemProps.onSetWorkAssignments(
                                    systemProps.workAssignments.map(w => w.id === targetWork.id ? updated : w)
                                );
                            }
                            toast.success(isKa ? `✓ მასალა ${mat.name} (${qty}) დაემატა რეესტრში!` : `✓ Material ${mat.name} (${qty}) added to registry!`);
                            return;
                        }
                    }

                    toast.warning(isKa ? `კოდი ვერ მოიძებნა: ${code}` : `Unrecognized code: ${code}`);
                }}
            />

            {/* Responsive Edge Resizer between Sidebar & Map */}
            {isSidebarOpen && (
                <ResizableDivider 
                    direction="horizontal"
                    currentSize={terminalWidth}
                    onResize={(newWidth) => setTerminalWidth(newWidth)}
                    minSize={280}
                    maxSize={typeof window !== 'undefined' ? Math.max(window.innerWidth - 300, 600) : 850}
                    storageKey="tasks_terminal_width"
                    isKa={isKa}
                    className="hidden md:flex"
                />
            )}

            {/* Map Area */}
            <div className="flex-1 flex flex-col relative w-full overflow-hidden">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept=".json"
                />
                {/* Top Controls */}
                <div className="absolute top-4 md:top-6 left-4 md:left-6 right-4 md:right-6 z-[1000] flex items-center justify-start pointer-events-none">
                    <div className="flex items-center gap-2 md:gap-3 p-1.5 md:p-2 bg-white border border-slate-200 rounded-2xl shadow-xl pointer-events-auto">
                        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-white rounded-xl">
                            <CalendarDaysIcon className="h-4 w-4 md:h-5 md:w-5 text-[#3b36db]" />
                            <input 
                                type="date" 
                                value={logDate} 
                                onChange={e => setLogDate(e.target.value)} 
                                className="font-black text-slate-800 outline-none text-xs md:text-sm bg-transparent"
                            />
                        </div>
                        <button className="p-2 md:p-3 bg-[#10b981] text-white rounded-xl hover:bg-[#059669] transition-colors">
                            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Overlays */}
                <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white shadow-xl flex items-center gap-3 pointer-events-auto">
                        <div className="flex -space-x-2">
                            <div className="h-6 w-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center">
                                <BriefcaseIcon className="h-3 w-3 text-blue-600" />
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Workforce Overlay: Active</span>
                    </div>
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white shadow-xl flex items-center gap-3 pointer-events-auto">
                        <div className="h-6 w-6 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center">
                            <TractorIcon className="h-3 w-3 text-orange-600" />
                        </div>
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Machinery Overlay: Active</span>
                    </div>
                </div>

                <div className="flex-1 relative">
                     <MapComponent 
                        {...mapProps}
                        showSearch={false}
                        onSelectFeature={() => {}}
                        highlightedFeatureIds={highlightedFeatureId ? [highlightedFeatureId] : []}
                        activeDrawingTool={activeDrawingTool}
                        onFeatureDrawn={handleFeatureDrawn}
                        onSetActiveDrawingTool={setActiveDrawingTool}
                        operationalLogs={systemProps.operationalLogs}
                        onOperationalLogClick={handleOpLogClick}
                    >
                        {opLogPopup && (
                            <Popup position={opLogPopup.latlng} eventHandlers={{ remove: () => setOpLogPopup(null) }} className="harvest-log-popup">
                                <div className="p-3">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b">
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><BriefcaseIcon className="h-4 w-4 text-blue-500" /> Work Log Detail</h3>
                                        <button onClick={() => setOpLogPopup(null)} className="p-1 rounded-full hover:bg-slate-100"><XIcon className="h-3 w-3"/></button>
                                    </div>
                                    <div className="text-[11px] space-y-2">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-400 uppercase">Task:</span> 
                                            <span className="font-bold text-slate-800 truncate">
                                                {typeof workAssignmentForLog?.workName === 'string' ? workAssignmentForLog.workName : (workAssignmentForLog?.workName as any)?.title || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Date:</span> <span className="font-bold text-slate-800">{new Date(opLogPopup.log.date).toLocaleDateString()}</span></div>
                                        <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Area:</span> <span className="font-bold text-slate-800">{opLogPopup.log.areaHa?.toFixed(4)} ha</span></div>
                                        <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Trenches:</span> <span className="font-bold text-slate-800">{opLogPopup.trenchCount}</span></div>
                                        <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Crops:</span> <span className="font-bold text-slate-800">{opLogPopup.cropCount}</span></div>
                                        {opLogPopup.log.trenchRange && (
                                            <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">{isKa ? 'თხრილები:' : 'Trench Range:'}</span> <span className="font-bold text-indigo-600">{opLogPopup.log.trenchRange}</span></div>
                                        )}
                                        {opLogPopup.log.sectorName && (
                                            <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">{isKa ? 'სექტორი:' : 'Sector:'}</span> <span className="font-bold text-slate-700">{opLogPopup.log.sectorName}</span></div>
                                        )}
                                        {opLogPopup.log.notes && (
                                            <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-600 italic">
                                                {opLogPopup.log.notes}
                                            </div>
                                        )}
                                        
                                        <div className="flex flex-col gap-2 pt-2">
                                            <button 
                                                onClick={() => {
                                                    const targetTask = workAssignmentForLog || {
                                                        id: opLogPopup.log.workAssignmentId || `work-${Date.now()}`,
                                                        workName: opLogPopup.log.notes || 'Field Operation Log',
                                                        date: opLogPopup.log.date,
                                                        status: 'completed',
                                                        assignedEmployeeIds: [],
                                                        notes: opLogPopup.log.notes || '',
                                                        source: 'tasks',
                                                        complexity: 'solo',
                                                        plannedTime: 8,
                                                        employeeHours: [],
                                                        sectorIds: opLogPopup.log.sectorId ? [opLogPopup.log.sectorId] : [],
                                                        taskType: 'Other',
                                                        trenchRange: opLogPopup.log.trenchRange,
                                                        measuredAreaM2: opLogPopup.log.measuredAreaM2 || Math.round((opLogPopup.log.areaHa || 0) * 10000)
                                                    } as WorkAssignment;
                                                    setSelectedWorkForYieldModal(targetTask);
                                                }}
                                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5"
                                            >
                                                <SlidersHorizontal size={13} />
                                                {isKa ? "დეტალები, აღრიცხვა და ხელფასი" : "Work Details, Payroll & Yield"}
                                            </button>

                                            <button 
                                                id="delete-work-log-btn"
                                                onClick={() => {
                                                    if (window.confirm(isKa ? "დარწმუნებული ხართ რომ გსურთ ამ ოპერაციული ლოგის წაშლა?" : "Are you sure you want to delete this operational log?")) {
                                                        systemProps.onSetOperationalLogs(prev => prev.filter(l => l.id !== opLogPopup.log.id));
                                                        setOpLogPopup(null);
                                                        toast.success(isKa ? "ოპერაციული ლოგი წაიშალა." : "Operational log deleted successfully.");
                                                    }
                                                }}
                                                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5"
                                            >
                                                {isKa ? "ლოგის წაშლა" : "Delete Log"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        )}
                    </MapComponent>
                </div>
            </div>

            {/* Operational Area Log Modal (triggered when user draws boundary on map) */}
            {pendingDrawnGeometry && (
                <OperationalAreaLogModal 
                    isOpen={isAreaLogModalOpen}
                    onClose={() => {
                        setIsAreaLogModalOpen(false);
                        setPendingDrawnGeometry(null);
                        setActiveDrawingTool({ tool: null });
                    }}
                    geometry={pendingDrawnGeometry}
                    workAssignments={systemProps.workAssignments}
                    initialAssignmentId={loggingForAssignment?.id}
                    plantationFeatures={plantationFeatures}
                    activeOrgId={activeOrgId}
                    currentUser={currentUser}
                    onSaveLog={handleSaveAreaLog}
                />
            )}

            {/* Work Details & Payroll Modal (Comprehensive Yield/Payroll Control) */}
            {selectedWorkForYieldModal && (
                <WorkDetailsModal 
                    isOpen={!!selectedWorkForYieldModal}
                    onClose={() => setSelectedWorkForYieldModal(null)}
                    work={selectedWorkForYieldModal}
                    employees={systemProps.employees}
                    inventoryItems={systemProps.inventoryItems || []}
                    machinery={systemProps.machinery || []}
                    currentUser={currentUser}
                    onSaveWork={(updatedWork) => {
                        systemProps.onSetWorkAssignments(
                            systemProps.workAssignments.map(w => w.id === updatedWork.id ? updatedWork : w)
                        );
                        setSelectedWorkForYieldModal(updatedWork);
                    }}
                />
            )}

            {/* Quick Vehicles & Machinery Modal */}
            {isVehiclesModalOpen && standingWork && (
                <WorkVehiclesModal
                    isOpen={isVehiclesModalOpen}
                    onClose={() => setIsVehiclesModalOpen(false)}
                    work={standingWork}
                    machinery={systemProps.machinery || []}
                    onSetMachinery={systemProps.onSetMachinery}
                    employees={systemProps.employees || []}
                    onSaveWork={(updatedWork) => {
                        systemProps.onSetWorkAssignments(
                            systemProps.workAssignments.map(w => w.id === updatedWork.id ? updatedWork : w)
                        );
                        if (selectedWorkForYieldModal?.id === updatedWork.id) {
                            setSelectedWorkForYieldModal(updatedWork);
                        }
                    }}
                />
            )}

            {/* Quick Materials & Stock Supplies Modal */}
            {isMaterialsModalOpen && standingWork && (
                <WorkMaterialsModal
                    isOpen={isMaterialsModalOpen}
                    onClose={() => setIsMaterialsModalOpen(false)}
                    work={standingWork}
                    inventoryItems={systemProps.inventoryItems || []}
                    onSetInventoryItems={systemProps.onSetInventoryItems}
                    onSaveWork={(updatedWork) => {
                        systemProps.onSetWorkAssignments(
                            systemProps.workAssignments.map(w => w.id === updatedWork.id ? updatedWork : w)
                        );
                        if (selectedWorkForYieldModal?.id === updatedWork.id) {
                            setSelectedWorkForYieldModal(updatedWork);
                        }
                    }}
                />
            )}

            {/* AI Field Agronomy & Registry Intelligence Modal (AI Assistant for all registry entries) */}
            {isFieldAgroModalOpen && (
                <FieldAgronomyIntelligenceModal
                    isOpen={isFieldAgroModalOpen}
                    onClose={() => setIsFieldAgroModalOpen(false)}
                    workAssignments={systemProps.workAssignments}
                    employees={systemProps.employees}
                    inventoryItems={systemProps.inventoryItems || []}
                    plantationFeatures={plantationFeatures}
                    operationalLogs={systemProps.operationalLogs}
                    nutritionPlans={systemProps.nutritionPlans || []}
                    activeOrgId={activeOrgId}
                    currentUser={currentUser}
                    onAddSuggestedTask={(newTask) => {
                        const completeTask: WorkAssignment = {
                            id: `task-ai-${Date.now()}`,
                            workName: newTask.workName || 'AI Mission',
                            date: newTask.date || new Date().toISOString(),
                            status: newTask.status || 'planned',
                            assignedEmployeeIds: newTask.assignedEmployeeIds || [],
                            employeeHours: newTask.employeeHours || [],
                            materialsUsed: newTask.materialsUsed || [],
                            notes: newTask.notes || 'Generated by Field Agronomy AI',
                            source: 'tasks',
                            complexity: 'solo',
                            plannedTime: newTask.plannedTime || 4,
                            sectorIds: newTask.sectorIds || [],
                            taskType: (newTask.taskType as any) || 'Other'
                        };
                        systemProps.onSetWorkAssignments([...systemProps.workAssignments, completeTask]);
                        toast.success(isKa ? "AI რეკომენდებული მისია დაემატა ტერმინალში!" : "AI recommended mission added to terminal!");
                    }}
                />
            )}
        </main>
    );
};

export default TasksAndWorksView;
