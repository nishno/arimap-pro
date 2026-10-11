
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { HarvestEvent, Employee, HarvestEntry, AssignedPicker, InventoryItem, Machinery, PaymentModel, Role, Crop, EmployeeGroup } from '../types';
import { ArrowDownTrayIcon, SearchIcon, PlusIcon, TrashIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { Share2, History, Users, CheckCheck, QrCode, ShieldCheck } from 'lucide-react';
import ExportExcelModal from './Harvesting/ExportExcelModal';
import HarvestEventHistoryModal from './Harvesting/HarvestEventHistoryModal';
import ShareHarvestEventModal from './Harvesting/ShareHarvestEventModal';
import HarvestBoxQrModal from './Harvesting/HarvestBoxQrModal';
import { ActiveUsersPresenceBar, getStoredActiveUser } from '../utils/userPresence';

export const calculateNetDurationHours = (event: HarvestEvent): number => {
    if (!event.actualStartDate) return 0;
    const startTime = new Date(event.actualStartDate).getTime();
    if (isNaN(startTime)) return 0;

    let effectiveEndTime = new Date().getTime();
    if (event.actualEndDate) {
        const endTime = new Date(event.actualEndDate).getTime();
        if (!isNaN(endTime)) effectiveEndTime = endTime;
    } else if (event.status === 'paused' && event.breaks && event.breaks.length > 0) {
        const lastBreak = event.breaks[event.breaks.length - 1];
        if (lastBreak && !lastBreak.end) {
            const breakStartTime = new Date(lastBreak.start).getTime();
            if (!isNaN(breakStartTime)) effectiveEndTime = breakStartTime;
        }
    }

    const grossDurationMs = effectiveEndTime - startTime;
    if (isNaN(grossDurationMs)) return 0;

    const completedBreakMs = (event.breaks || []).reduce((sum, b) => {
        if (b.start && b.end) {
            const breakStart = new Date(b.start).getTime();
            const breakEnd = new Date(b.end).getTime();
            if (!isNaN(breakStart) && !isNaN(breakEnd)) {
                return sum + (breakEnd - breakStart);
            }
        }
        return sum;
    }, 0);
    
    const netDurationMs = Math.max(0, grossDurationMs - completedBreakMs);
    const hours = netDurationMs / (1000 * 60 * 60);

    return isNaN(hours) ? 0 : hours;
};


export const calculateTotalOpex = (event: HarvestEvent, entries: HarvestEntry[], durationHours: number, machinery: Machinery[]): { laborCost: number, machineCost: number, packagingCost: number, otherCosts: number, totalCost: number } => {
    const laborCost = (event.assignedPickers || []).reduce((acc, picker) => {
        const pickerEntries = (entries || []).filter(e => String(e.employeeId) === String(picker.employeeId));
        const weight = picker.manualNetWeight ?? pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
        const effectiveHours = picker.manualHours ?? durationHours;
        return acc + calculatePickerEarnings(picker, weight, effectiveHours);
    }, 0);

    const machineCost = (event.assignedVehicles || []).reduce((acc, v) => {
        const machineDetails = (machinery || []).find(m => m.id === v.machineryId);
        const rate = v.isOwned ? (machineDetails?.hourlyRate || 0) : (v.rateAmount || v.hiredCost);
        const total = (v.usageHours || 0) > 0 ? (v.usageHours || 0) * rate : v.hiredCost;
        return acc + total;
    }, 0);

    let fullBoxes = 0;
    let halfBoxes = 0;
    let totalPunets = 0;
    (entries || []).forEach(e => {
        if (!e) return;
        const entryPunets = e.punets ?? e.punetCount;
        if (e.isHalfBox) {
            const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
            halfBoxes += count;
            totalPunets += (entryPunets !== undefined ? entryPunets : Math.round(count * ((event.punetsPerBox || 12) / 2)));
        } else {
            const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
            fullBoxes += count;
            totalPunets += (entryPunets !== undefined ? entryPunets : Math.round(count * (event.punetsPerBox || 12)));
        }
    });
    
    let totalBoxesVal = 0;
    if (event.totalBoxes && event.totalBoxes > 0) totalBoxesVal = event.totalBoxes;
    else if (fullBoxes > 0 || halfBoxes > 0) totalBoxesVal = fullBoxes + halfBoxes;
    
    const punetsPerBoxVal = event.punetsPerBox || 12;
    let totalPunetsVal = 0;
    if (totalPunets > 0) {
        totalPunetsVal = totalPunets;
    } else if (event.totalPunets && event.totalPunets >= totalBoxesVal) {
        totalPunetsVal = event.totalPunets;
    } else if (event.physicalPunets && event.physicalPunets >= totalBoxesVal) {
        totalPunetsVal = event.physicalPunets;
    } else {
        totalPunetsVal = totalBoxesVal * punetsPerBoxVal;
    }

    const boxUnitCost = event.boxUnitCost ?? 0.8;
    const punetUnitCost = event.punetUnitCost ?? 0.15;
    const usedBoxesCost = totalBoxesVal * boxUnitCost;
    const usedPunetsCost = totalPunetsVal * punetUnitCost;
    const packagingCost = usedBoxesCost + usedPunetsCost;

    const otherCosts = (event.otherOpexItems || []).reduce((sum, item) => sum + (item.cost || 0), 0);
    const logisticsCost = (event.logisticsRecords || []).reduce((sum: number, r: any) => sum + (r.calculatedTotalCost || 0), 0);
    const baseVehicleCost = (event.manualVehicleCost !== undefined && event.manualVehicleCost > 0) ? event.manualVehicleCost : machineCost;
    const totalVehicleDriverCost = baseVehicleCost + logisticsCost;

    const totalCost = (event.manualOpex !== undefined && event.manualOpex > 0 ? event.manualOpex : laborCost) + totalVehicleDriverCost + packagingCost + otherCosts;
    return { laborCost: (event.manualOpex !== undefined && event.manualOpex > 0 ? event.manualOpex : laborCost), machineCost: totalVehicleDriverCost, packagingCost, otherCosts, totalCost };
};

export const calculatePickerEarnings = (picker: AssignedPicker, totalWeight: number, hours: number): number => {
    let basePay = 0;
    const model = picker?.paymentModel || 'per_weight';
    const isCombined = model === 'combined';
    
    if (isCombined) {
        // First Half / Flat / Daily Phase
        const days = picker.manualDays ?? picker.combinedShiftFraction ?? 0.5;
        const baseDailyRate = picker.combinedBaseRate ?? (picker.rate > 10 ? picker.rate : 50);
        const dailyPay = days * baseDailyRate;

        // Second Half / Piece-Rate Phase (Split Harvest Weight)
        const totalNet = picker.manualNetWeight ?? totalWeight ?? 0;
        let payableWeight = 0;
        if (picker.payableNetWeight !== undefined) {
            payableWeight = picker.payableNetWeight;
        } else if (picker.combinedDailyKg !== undefined) {
            payableWeight = Math.max(0, totalNet - picker.combinedDailyKg);
        } else {
            // Default split if not explicitly overridden: 20 kg assigned to flat daily phase if total >= 20 kg
            const defaultDailyKg = totalNet >= 20 ? 20 : totalNet * 0.5;
            payableWeight = Math.max(0, totalNet - defaultDailyKg);
        }

        const perKgRate = picker.combinedPerKgRate ?? (picker.rate <= 10 ? picker.rate : 1.4);
        const piecePay = (payableWeight || 0) * (perKgRate || 0);

        basePay = dailyPay + piecePay;
    } else {
        switch (model) {
            case 'per_weight':
                basePay = (totalWeight || 0) * (picker.rate || 0);
                break;
            case 'hourly':
                basePay = hours * (picker.rate || 0);
                break;
            case 'daily':
                basePay = (picker.manualDays ?? 1) * (picker.rate || 0);
                break;
            case 'salary':
                basePay = 0; 
                break;
            default:
                basePay = (totalWeight || 0) * (picker.rate || 0);
        }
    }
    return basePay + (picker.bonus || 0);
};

const InputCell: React.FC<{
    value: number | undefined, 
    placeholder: string, 
    onChange: (val: string) => void, 
    isOverridden: boolean, 
    type?: string
}> = ({ value, placeholder, onChange, isOverridden, type='number' }) => {
    const [localValue, setLocalValue] = useState<string>(value !== undefined ? String(value) : '');

    useEffect(() => {
        if (value !== undefined) {
             const parsedLocal = parseFloat(localValue);
             if (isNaN(parsedLocal) || parsedLocal !== value) {
                 setLocalValue(String(value));
             }
        } else {
             setLocalValue('');
        }
    }, [value, localValue]);

    return (
        <div className="relative w-full">
            {isOverridden && <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full" title="Manual Override"></div>}
            <input 
                type={type} 
                step="0.01"
                inputMode="decimal"
                value={localValue}
                placeholder={placeholder}
                title={localValue || placeholder}
                onChange={e => {
                    setLocalValue(e.target.value);
                    onChange(e.target.value);
                }}
                onKeyDown={e => e.stopPropagation()}
                className="bg-slate-100 focus:bg-white text-slate-900 font-extrabold rounded-lg w-full text-center py-1 px-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none border border-transparent focus:border-indigo-300 transition-all shadow-2xs"
            />
        </div>
    );
};

export const HarvestStatsGrid: React.FC<{
    event: HarvestEvent;
    entries: HarvestEntry[];
    durationHours: number;
    employees: Employee[];
    machinery: Machinery[];
    inventoryItems: InventoryItem[];
}> = ({ event, entries, durationHours, employees, machinery, inventoryItems }) => {
    
    const { formatCurrency, currency, t } = useLanguage();

    const laborCost = useMemo(() => {
        if (event.manualOpex !== undefined && event.manualOpex > 0) return event.manualOpex;
        return (event.assignedPickers || []).reduce((acc, picker) => {
            const pickerEntries = (entries || []).filter(e => String(e.employeeId) === String(picker.employeeId));
            const weight = picker.manualNetWeight ?? pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
            const effectiveHours = picker.manualHours ?? durationHours;
            return acc + calculatePickerEarnings(picker, weight, effectiveHours);
        }, 0);
    }, [event.assignedPickers, event.manualOpex, entries, durationHours, employees]);
    
    const machineCost = useMemo(() => {
        const vehicleCost = (event.assignedVehicles || []).reduce((acc, v) => {
            const machineDetails = (machinery || []).find(m => m.id === v.machineryId);
            const rate = v.isOwned ? (machineDetails?.hourlyRate || 0) : (v.rateAmount || v.hiredCost);
            const total = (v.usageHours || 0) > 0 ? (v.usageHours || 0) * rate : v.hiredCost;
            return acc + total;
        }, 0);
        const logisticsCost = (event.logisticsRecords || []).reduce((sum: number, r: any) => sum + (r.calculatedTotalCost || 0), 0);
        const baseVehicles = (event.manualVehicleCost !== undefined && event.manualVehicleCost > 0) ? event.manualVehicleCost : vehicleCost;
        return baseVehicles + logisticsCost;
    }, [event.assignedVehicles, event.manualVehicleCost, event.logisticsRecords, machinery]);

    // ⚖️ Weigh station scale recorded counts computed early for live monitoring stats
    const weighStationCounts = useMemo(() => {
        let fullBoxes = 0;
        let halfBoxes = 0;
        let totalPunets = 0;

        (entries || []).forEach(e => {
            if (!e) return;
            const entryPunets = e.punets ?? e.punetCount;
            if (e.isHalfBox) {
                const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
                halfBoxes += count;
                totalPunets += (entryPunets !== undefined ? entryPunets : Math.round(count * ((event.punetsPerBox || 12) / 2)));
            } else {
                const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
                fullBoxes += count;
                totalPunets += (entryPunets !== undefined ? entryPunets : Math.round(count * (event.punetsPerBox || 12)));
            }
        });

        return { fullBoxes, halfBoxes, totalPunets };
    }, [entries, event.punetsPerBox]);

    const punetsPerBoxVal = event.punetsPerBox || 12;

    const totalBoxesVal = useMemo(() => {
        if (event.totalBoxes && event.totalBoxes > 0) return event.totalBoxes;
        if (weighStationCounts.fullBoxes > 0 || weighStationCounts.halfBoxes > 0) {
            return weighStationCounts.fullBoxes + weighStationCounts.halfBoxes;
        }
        return 0;
    }, [event.totalBoxes, weighStationCounts.fullBoxes, weighStationCounts.halfBoxes]);

    const totalPunetsVal = useMemo(() => {
        if (weighStationCounts.totalPunets > 0) {
            return weighStationCounts.totalPunets;
        }
        if (event.totalPunets && event.totalPunets >= totalBoxesVal) {
            return event.totalPunets;
        }
        if (event.physicalPunets && event.physicalPunets >= totalBoxesVal) {
            return event.physicalPunets;
        }
        return totalBoxesVal * punetsPerBoxVal;
    }, [event.totalPunets, event.physicalPunets, punetsPerBoxVal, totalBoxesVal, weighStationCounts.totalPunets]);

    const boxUnitCost = event.boxUnitCost ?? 0.8;
    const punetUnitCost = event.punetUnitCost ?? 0.15;

    const usedBoxesCost = totalBoxesVal * boxUnitCost;
    const usedPunetsCost = totalPunetsVal * punetUnitCost;

    const packagingCost = useMemo(() => {
        return usedBoxesCost + usedPunetsCost;
    }, [usedBoxesCost, usedPunetsCost]);

    const otherCosts = useMemo(() => {
        return (event.otherOpexItems || []).reduce((sum, item) => sum + (item.cost || 0), 0);
    }, [event.otherOpexItems]);
    
    const totalCost = laborCost + machineCost + packagingCost + otherCosts;

    const variance = useMemo(() => {
        const est = event.totalEstimatedWeightKg || 0;
        const ver = event.totalVerifiedWeightKg || 0;
        if (est === 0 || ver === 0) return 0;
        return ((ver - est) / est) * 100;
    }, [event.totalEstimatedWeightKg, event.totalVerifiedWeightKg]);

    const StatsBox = ({ label, value, colorClass, subValue }: { label: string, value: string, colorClass: string, subValue?: string }) => (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-2 sm:p-3 text-center flex flex-col justify-between h-full min-w-0 overflow-hidden">
            <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-tight truncate" title={label}>{label}</p>
            <p className={`text-xs sm:text-sm md:text-base lg:text-lg font-black tracking-tight truncate ${colorClass}`} title={value}>{value}</p>
            {subValue ? (
                <p className="text-[8px] sm:text-[9px] font-semibold text-slate-400 uppercase tracking-tight mt-1 truncate" title={subValue}>{subValue}</p>
            ) : (
                <div className="h-2"></div>
            )}
        </div>
    );

    const formatCleanVal = (val: number): string => {
        if (typeof val !== 'number' || isNaN(val)) return '0';
        if (val >= 1000) {
            const kVal = val / 1000;
            if (val % 1000 === 0) {
                return kVal.toFixed(0) + 'k';
            } else if (val % 100 === 0) {
                return kVal.toFixed(1) + 'k';
            } else if (val % 10 === 0) {
                return kVal.toFixed(2) + 'k';
            }
            return kVal.toFixed(3) + 'k';
        }
        if (val % 1 === 0) {
            return val.toFixed(0);
        }
        return val.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d+?)0+$/, '$1');
    };

    const formatNiceCurrency = (amount: number): string => {
        const valStr = formatCleanVal(amount);
        if (currency === 'GEL') {
            return `GEL ${valStr}`;
        }
        return `$${valStr}`;
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
                <StatsBox 
                    label={t('harvest.total_weight_stat')} 
                    value={`${formatCleanVal(event.finalNetYieldKg || event.totalNetWeightKg || 0)} kg`} 
                    colorClass="text-gray-800 font-extrabold" 
                    subValue={event.totalVerifiedWeightKg ? `${t('harvest.verified')}: ${formatCleanVal(event.totalVerifiedWeightKg)}kg` : undefined}
                />
                <StatsBox 
                    label={t('harvest.total_boxes_stat')} 
                    value={`${totalBoxesVal}/${totalPunetsVal}`} 
                    colorClass="text-gray-800 font-extrabold" 
                    subValue={t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ყუთი / პუნეტი' : 'Boxes / Punets'}
                />
                <StatsBox label={t('harvest.total_workers_stat')} value={`${(event.assignedPickers || []).length}`} colorClass="text-gray-800" />
                <StatsBox label={t('harvest.picker_pay_labor')} value={formatNiceCurrency(laborCost)} colorClass="text-red-600" />
                <StatsBox label={t('harvest.driver_others')} value={formatNiceCurrency(machineCost)} colorClass="text-red-600" />
                <StatsBox 
                    label={t('harvest.auto_packaging')} 
                    value={formatNiceCurrency(packagingCost)} 
                    colorClass="text-blue-600" 
                    subValue={`${totalBoxesVal}/${totalPunetsVal} (${formatNiceCurrency(usedBoxesCost)} + ${formatNiceCurrency(usedPunetsCost)})`} 
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-white flex justify-between items-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('harvest.gross_weight_stat')}</p>
                    <span className="text-[11px] font-black px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                        {formatCleanVal(event.totalGrossWeightKg || 0)} KG
                    </span>
                </div>
                <div className="bg-red-900 rounded-xl p-3 border border-red-800 text-white flex justify-between items-center">
                    <p className="text-[10px] font-black text-red-200 uppercase tracking-widest">{t('harvest.total_opex_stat')}</p>
                    <span className="text-sm sm:text-base font-black text-red-100 truncate max-w-[120px]" title={formatNiceCurrency(totalCost)}>
                        {formatNiceCurrency(totalCost)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export const DailyPaidHarvestCard: React.FC<{
    event: HarvestEvent;
    entries: HarvestEntry[];
    durationHours: number;
    employees: Employee[];
    onDetailsClick?: () => void;
}> = ({ event, entries, durationHours, employees, onDetailsClick }) => {
    const { formatCurrency, t } = useLanguage();
    const laborCost = useMemo(() => {
        return (event.assignedPickers || []).reduce((acc, picker) => {
            const pickerEntries = (entries || []).filter(e => String(e.employeeId) === String(picker.employeeId));
            const weight = picker.manualNetWeight ?? pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
            const effectiveHours = picker.manualHours ?? durationHours;
            return acc + calculatePickerEarnings(picker, weight, effectiveHours);
        }, 0);
    }, [event.assignedPickers, entries, durationHours, employees]);
    
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-semibold text-gray-700 text-lg">{t('harvest.daily_paid_harvest')}</h3>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{formatCurrency(laborCost)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('harvest.total_pay_workers')}</p>
                </div>
                <button onClick={onDetailsClick} className="text-blue-600 text-sm font-medium hover:underline">{t('harvest.click_detail_adjust')}</button>
            </div>
        </div>
    );
};

export const PickerStats: React.FC<{
    event: HarvestEvent;
    employees: Employee[];
    entries: HarvestEntry[];
    onSetHarvestEvents: (events: HarvestEvent[], syncToCloud?: boolean) => void;
    harvestEvents: HarvestEvent[];
    onLogActivity?: (action: string, module: import('../types').AppMode, status: 'success' | 'failure' | 'alert', report?: string) => Promise<void>;
    inventoryItems?: InventoryItem[];
    onSetInventoryItems?: (items: InventoryItem[], syncToCloud?: boolean) => void;
    onSetEmployees?: (employees: Employee[], syncToCloud?: boolean) => void;
    roles?: Role[];
    crops?: Crop[];
    cropVarieties?: string[];
    employeeGroups?: EmployeeGroup[];
    onSetEmployeeGroups?: (groups: EmployeeGroup[]) => void;
    allHarvestEntries?: HarvestEntry[];
    onSetHarvestEntries?: (entries: HarvestEntry[]) => void;
    machinery?: Machinery[];
    viewMode?: 'payroll' | 'management' | 'statistics' | 'all';
    onSwitchTab?: (tab: 'stats' | 'statistics' | 'logistics' | 'management') => void;
}> = ({ event, employees, entries, onSetHarvestEvents, harvestEvents, onLogActivity, inventoryItems = [], onSetInventoryItems, onSetEmployees, roles, crops = [], cropVarieties = [], employeeGroups = [], onSetEmployeeGroups, allHarvestEntries, onSetHarvestEntries, machinery = [], viewMode = 'all', onSwitchTab }) => {
    
    const { formatCurrency, currency, t } = useLanguage();
    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
    const [localPickers, setLocalPickers] = useState(event?.assignedPickers || []);

    useEffect(() => {
        if (event?.assignedPickers) {
            setLocalPickers(event.assignedPickers);
        }
    }, [event?.id, event?.assignedPickers]);

    // Statistics & Audit Hub state variables
    const [statRoleFilter, setStatRoleFilter] = useState<'all' | 'picker' | 'loader' | 'foreman' | 'driver'>('all');
    const [statSalaryFilter, setStatSalaryFilter] = useState<'all' | 'daily' | 'per_weight' | 'combined'>('all');
    const [statSelectionFilter, setStatSelectionFilter] = useState<'all' | 'marked'>('all');
    const [statTareStripped, setStatTareStripped] = useState<boolean>(false);

    const [auditLogs, setAuditLogs] = useState<Array<{ id: string; timestamp: string; actorName: string; actionType: string; description: string }>>(() => {
        if (!event?.id) return [];
        const stored = localStorage.getItem(`harvest_audit_logs_${event.id}`);
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { }
        }
        return [
            {
                id: 'audit-init-1',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                actorName: 'System / Manager',
                actionType: 'Valuation & Yield Sync',
                description: `Live yield rates and valuation synced across all active windows for ${event?.name || 'Harvest Event'}`
            }
        ];
    });

    const handleRollbackAudit = (logId: string) => {
        setAuditLogs(prev => {
            const updated = prev.filter(l => l.id !== logId);
            if (event?.id) {
                localStorage.setItem(`harvest_audit_logs_${event.id}`, JSON.stringify(updated));
            }
            return updated;
        });
        toast.success(isKa ? 'ცვლილება წარმატებით გაუქმდა' : 'Audit adjustment rolled back successfully.');
    };
    
    // Variety filtering and splitting state variables
    const [selectedVarietiesFilter, setSelectedVarietiesFilter] = useState<string[]>(['all']);
    const [isVarietyDropdownOpen, setIsVarietyDropdownOpen] = useState(false);
    
    // Inline variety split & change states
    const [selectedVarietyRow, setSelectedVarietyRow] = useState<string | null>(null);
    const [inlineTargetVar, setInlineTargetVar] = useState<string>('');
    const [inlineSplitWeight, setInlineSplitWeight] = useState<string>('');

    const handleSplitYield = (sourceVar: string, targetVar: string, splitWeightNum: number) => {
        const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
        if (!onSetHarvestEntries || !allHarvestEntries) {
            toast.error("Set entries callback not available.");
            return;
        }
        if (!sourceVar || !targetVar || splitWeightNum <= 0) {
            toast.error("Please select varieties and enter a valid weight to split.");
            return;
        }
        if (sourceVar.toLowerCase() === targetVar.toLowerCase()) {
            toast.error("Source and Target varieties must be different.");
            return;
        }

        // Get entries for the current event that match the source variety
        const eventSourceEntries = allHarvestEntries.filter(e => 
            e.harvestEventId === event.id && 
            (e.variety || 'Unknown').toLowerCase() === sourceVar.toLowerCase()
        );

        const totalAvailableSourceWeight = eventSourceEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
        if (splitWeightNum > totalAvailableSourceWeight + 0.05) {
            toast.error(`Cannot split ${splitWeightNum} kg. Only ${totalAvailableSourceWeight.toFixed(1)} kg is available for variety ${sourceVar}.`);
            return;
        }

        // If split weight is equal or very close to total available, perform a direct transfer of all matching entries
        const isTransferAll = splitWeightNum >= totalAvailableSourceWeight - 0.05;

        const unaffectedEntries = allHarvestEntries.filter(e => 
            !(e.harvestEventId === event.id && (e.variety || 'Unknown').toLowerCase() === sourceVar.toLowerCase())
        );

        let modifiedEntries: HarvestEntry[] = [];

        if (isTransferAll) {
            // Simply change the variety of all source entries to target variety
            modifiedEntries = eventSourceEntries.map(entry => ({
                ...entry,
                variety: targetVar
            }));
        } else {
            let remainingToTransfer = splitWeightNum;
            for (const entry of eventSourceEntries) {
                if (remainingToTransfer <= 0) {
                    modifiedEntries.push(entry);
                    continue;
                }

                const entryWeight = entry.netWeightKg || 0;
                // If this entry weight is less than or equal to what is remaining to transfer (within margin)
                if (entryWeight <= remainingToTransfer + 0.001) {
                    modifiedEntries.push({
                        ...entry,
                        variety: targetVar
                    });
                    remainingToTransfer -= entryWeight;
                } else {
                    const weight1 = remainingToTransfer; // goes to targetVar
                    const weight2 = entryWeight - remainingToTransfer; // stays with sourceVar

                    const originalBoxes = entry.boxCount || 1;
                    const boxes1 = Math.max(1, Math.round((weight1 / entryWeight) * originalBoxes));
                    const boxes2 = Math.max(1, originalBoxes - boxes1);

                    const entry1: HarvestEntry = {
                        ...entry,
                        id: `${entry.id}-split-1-${Date.now()}`,
                        netWeightKg: weight1,
                        boxCount: boxes1,
                        variety: targetVar,
                        grossWeightKg: entry.grossWeightKg ? (entry.grossWeightKg * (weight1 / entryWeight)) : undefined,
                        tareWeightKg: entry.tareWeightKg ? (entry.tareWeightKg * (weight1 / entryWeight)) : undefined
                    };

                    const entry2: HarvestEntry = {
                        ...entry,
                        id: `${entry.id}-split-2-${Date.now()}`,
                        netWeightKg: weight2,
                        boxCount: boxes2,
                        variety: entry.variety
                    };

                    modifiedEntries.push(entry1, entry2);
                    remainingToTransfer = 0;
                }
            }
        }

        const updatedGlobalEntries = [...unaffectedEntries, ...modifiedEntries];
        onSetHarvestEntries(updatedGlobalEntries);

        // Recalculate event properties reactively!
        const currentEventEntries = updatedGlobalEntries.filter(e => e.harvestEventId === event.id);
        
        // Recalculate variety-wise yields
        const varietyYields: Record<string, { weightKg: number; boxCount: number }> = {};
        let totalNet = 0;
        let totalBoxes = 0;
        
        currentEventEntries.forEach(e => {
            const v = e.variety || 'Unknown';
            if (!varietyYields[v]) {
                varietyYields[v] = { weightKg: 0, boxCount: 0 };
            }
            varietyYields[v].weightKg += e.netWeightKg || 0;
            varietyYields[v].boxCount += e.boxCount || 1;
            totalNet += e.netWeightKg || 0;
            totalBoxes += e.boxCount || 1;
        });
        
        const yieldByVariety = Object.entries(varietyYields).map(([variety, item]) => ({
            variety,
            weightKg: item.weightKg,
            boxCount: item.boxCount
        }));
        
        const uniqueVarieties = Object.keys(varietyYields);
        
        const updatedEvent = {
            ...event,
            totalNetWeightKg: totalNet,
            totalBoxes: totalBoxes,
            yieldByVariety,
            varieties: uniqueVarieties,
            ...(event.status === 'completed' ? {
                finalNetYieldKg: totalNet,
                finalBoxesCount: totalBoxes
            } : {})
        };
        
        onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));

        // Sync inventory items reactively if the event is completed!
        if (event.status === 'completed' && inventoryItems && onSetInventoryItems) {
            const otherInventoryItems = inventoryItems.filter(item => item.relatedHarvestId !== event.id);
            
            const varietyData: Record<string, { net: number; boxes: number }> = {};
            let totalVarietyWeight = 0;
            
            currentEventEntries.forEach(e => {
                const v = e.variety || 'Unknown';
                if (!varietyData[v]) {
                    varietyData[v] = { net: 0, boxes: 0 };
                }
                varietyData[v].net += e.netWeightKg || 0;
                varietyData[v].boxes += e.boxCount || 1;
                totalVarietyWeight += e.netWeightKg || 0;
            });
            
            if (totalVarietyWeight === 0) {
                varietyData['Unknown'] = { net: totalNet, boxes: totalBoxes };
                totalVarietyWeight = totalNet;
            }
            
            const recomputedInventoryItems: any[] = Object.entries(varietyData).map(([variety, vInfo], index) => {
                const proportion = totalVarietyWeight > 0 ? vInfo.net / totalVarietyWeight : 1;
                const varietyYield = vInfo.net;
                const varietyBoxes = vInfo.boxes;
                const varietyCash = (event.saleDetails?.totalValue || 0) * proportion;
                
                return {
                    id: `inv-h-${event.id}-${variety}-${index}`,
                    name: `${updatedEvent.name} - ${updatedEvent.marketIdentifier || 'LOAD'} (${variety})`,
                    category: 'Produce',
                    currentStock: varietyYield,
                    unitOfMeasure: 'kg',
                    status: updatedEvent.postHarvestAction === 'COLD_STORAGE' ? 'Awaiting Transaction' : 'In Stock',
                    tags: updatedEvent.postHarvestAction === 'COLD_STORAGE' ? ['Cold Storage', 'Harvested'] : ['Harvested'],
                    relatedHarvestId: updatedEvent.id,
                    harvestIdentifier: updatedEvent.marketIdentifier,
                    unitCost: updatedEvent.saleDetails?.pricePerUnit || 0,
                    minStockThreshold: 0,
                    batch_id: `batch-${event.id}-${updatedEvent.marketIdentifier || '0'}-${variety}`,
                    date: updatedEvent.actualEndDate?.split('T')[0] || new Date().toISOString().split('T')[0],
                    rate: 1.0,
                    variety: variety,
                    varietyKg: varietyYield,
                    variety2Kg: 0,
                    depositLLC: 0,
                    physicalCash: varietyCash,
                    physicalBoxes: varietyBoxes,
                    depositedDeposit: false
                };
            });
            
            onSetInventoryItems([...otherInventoryItems, ...recomputedInventoryItems]);
        }
        
        const successMsg = isKa 
            ? `ჯიში ${sourceVar}-დან ${targetVar}-ში წარმატებით გადავიდა (${splitWeightNum.toFixed(1)} კგ)!`
            : `Successfully transferred ${splitWeightNum.toFixed(1)} KG from ${sourceVar} to ${targetVar}!`;
        toast.success(successMsg);
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [showZeroHarvestOnly, setShowZeroHarvestOnly] = useState<'all' | 'zero' | 'non-zero'>('all');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
    const [selectedPickers, setSelectedPickers] = useState<Set<string>>(new Set());
    const [newTeamName, setNewTeamName] = useState<string>('');
    const [sortBy, setSortBy] = useState<'alphabet' | 'number' | 'data' | 'role' | 'payment_model' | 'rate' | 'last_modified'>('alphabet');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const durationHours = calculateNetDurationHours(event);

    // Reweigh states
    const [isReweighOpen, setIsReweighOpen] = useState(false);
    const [reweighRecords, setReweighRecords] = useState<{ id: string; boxes: number; weight: number; brutto: number; variety?: string; workerId?: string; salary?: number }[]>(() => {
        return (event.reweighRecords || []).map(r => ({
            ...r,
            brutto: (r as any).brutto !== undefined ? (r as any).brutto : r.weight + (r.boxes * 1.5)
        }));
    });
    const [sellerReportedWeight, setSellerReportedWeight] = useState<number | undefined>(event.sellerReportedWeight);
    const [reweighNotes, setReweighNotes] = useState<string>(event.reweighNotes || '');
    const [newReweighBoxes, setNewReweighBoxes] = useState<string>('');
    const [newReweighWeight, setNewReweighWeight] = useState<string>('');
    const [newReweighBrutto, setNewReweighBrutto] = useState<string>('');
    const [boxTare, setBoxTare] = useState<number>(1.5);
    const [newReweighVariety, setNewReweighVariety] = useState<string>('');
    const [newReweighWorkerId, setNewReweighWorkerId] = useState<string>('');

    const availableVarieties = useMemo(() => {
        const set = new Set<string>();
        
        // 1. From company crops
        if (crops) {
            crops.forEach(c => {
                c.varieties?.forEach(v => {
                    if (v) set.add(v);
                });
            });
        }
        
        // 2. From cropVarieties database collection
        if (cropVarieties) {
            cropVarieties.forEach(v => {
                if (v) set.add(v);
            });
        }

        // 3. From harvest event
        if (event.varieties) {
            event.varieties.forEach(v => { if (v) set.add(v); });
        }
        if (event.yieldByVariety) {
            event.yieldByVariety.forEach(y => { if (y.variety) set.add(y.variety); });
        }
        if (entries) {
            entries.forEach(e => { if (e.variety) set.add(e.variety); });
        }
        if (inventoryItems) {
            inventoryItems.forEach(i => { if (i.variety) set.add(i.variety); });
        }

        // Ensure defaults are available
        set.add("star");
        set.add("Legacy");
        set.add("Chandler");
        set.add("Lara");
        set.add("Howard");

        // Return a case-insensitive unique array
        const uniqueMap = new Map<string, string>();
        set.forEach(v => {
            if (v && v.trim()) {
                const key = v.trim().toLowerCase();
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, v.trim());
                }
            }
        });

        return Array.from(uniqueMap.values());
    }, [event, entries, inventoryItems, crops, cropVarieties]);

    const varietyStats = useMemo(() => {
        const statsMap = new Map<string, { earlyNet: number; earlyBoxes: number; reweighedNet: number; reweighedBoxes: number }>();

        (availableVarieties || []).forEach(v => {
            if (v) statsMap.set(v.toLowerCase(), { earlyNet: 0, earlyBoxes: 0, reweighedNet: 0, reweighedBoxes: 0 });
        });

        (entries || []).forEach(e => {
            const eVar = (e?.variety || "Unspecified").toLowerCase();
            let item = statsMap.get(eVar);
            if (!item) {
                item = { earlyNet: 0, earlyBoxes: 0, reweighedNet: 0, reweighedBoxes: 0 };
                statsMap.set(eVar, item);
            }
            item.earlyNet += e.netWeightKg || 0;
            item.earlyBoxes += e.boxCount || 1;
        });

        (reweighRecords || []).forEach(r => {
            const rVar = (r?.variety || "Unspecified").toLowerCase();
            let item = statsMap.get(rVar);
            if (!item) {
                item = { earlyNet: 0, earlyBoxes: 0, reweighedNet: 0, reweighedBoxes: 0 };
                statsMap.set(rVar, item);
            }
            item.reweighedNet += r.weight || 0;
            item.reweighedBoxes += r.boxes || 0;
        });

        return (availableVarieties || []).map(v => {
            const item = statsMap.get(v.toLowerCase()) || { earlyNet: 0, earlyBoxes: 0, reweighedNet: 0, reweighedBoxes: 0 };
            return {
                variety: v,
                earlyNet: item.earlyNet,
                earlyBoxes: item.earlyBoxes,
                reweighedNet: item.reweighedNet,
                reweighedBoxes: item.reweighedBoxes,
                netDiff: item.earlyNet - item.reweighedNet,
                boxDiff: item.earlyBoxes - item.reweighedBoxes
            };
        });
    }, [availableVarieties, entries, reweighRecords]);

    const filteredVarietyStats = useMemo(() => {
        if (selectedVarietiesFilter.includes('all')) return varietyStats;
        return varietyStats.filter(stat => 
            selectedVarietiesFilter.some(v => v.toLowerCase() === stat.variety.toLowerCase())
        );
    }, [varietyStats, selectedVarietiesFilter]);

    const workerOptions = useMemo(() => {
        return (employees || []).filter(e => e.status !== 'inactive');
    }, [employees]);

    const getWorkerRate = (workerId: string) => {
        const picker = localPickers.find(p => p.employeeId === workerId);
        if (picker) return picker.rate;
        const emp = employees.find(e => e.id === workerId);
        return emp?.paymentRate || 6.2;
    };

    const handleNetChange = (val: string) => {
        setNewReweighWeight(val);
        const netNum = parseFloat(val);
        const boxesNum = parseInt(newReweighBoxes) || 0;
        if (!isNaN(netNum)) {
            const calculatedBrutto = netNum + (boxesNum * boxTare);
            setNewReweighBrutto(calculatedBrutto.toFixed(2));
        } else {
            setNewReweighBrutto('');
        }
    };

    const handleBruttoChange = (val: string) => {
        setNewReweighBrutto(val);
        const bruttoNum = parseFloat(val);
        const boxesNum = parseInt(newReweighBoxes) || 0;
        if (!isNaN(bruttoNum)) {
            const calculatedNet = Math.max(0, bruttoNum - (boxesNum * boxTare));
            setNewReweighWeight(calculatedNet.toFixed(2));
        } else {
            setNewReweighWeight('');
        }
    };

    const handleBoxesChange = (val: string) => {
        setNewReweighBoxes(val);
        const boxesNum = parseInt(val) || 0;
        const netNum = parseFloat(newReweighWeight);
        const bruttoNum = parseFloat(newReweighBrutto);
        if (!isNaN(netNum)) {
            const calculatedBrutto = netNum + (boxesNum * boxTare);
            setNewReweighBrutto(calculatedBrutto.toFixed(2));
        } else if (!isNaN(bruttoNum)) {
            const calculatedNet = Math.max(0, bruttoNum - (boxesNum * boxTare));
            setNewReweighWeight(calculatedNet.toFixed(2));
        }
    };

    const handleTareChange = (val: number) => {
        setBoxTare(val);
        const boxesNum = parseInt(newReweighBoxes) || 0;
        const netNum = parseFloat(newReweighWeight);
        if (!isNaN(netNum)) {
            const calculatedBrutto = netNum + (boxesNum * val);
            setNewReweighBrutto(calculatedBrutto.toFixed(2));
        }
    };

    // Add Worker states
    const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
    const [addMode, setAddMode] = useState<'existing' | 'new'>('existing');
    const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
    const [addWorkerSearchQuery, setAddWorkerSearchQuery] = useState('');
    const [newWorkerName, setNewWorkerName] = useState('');
    const [newWorkerId, setNewWorkerId] = useState('');
    const [chosenModel, setChosenModel] = useState<PaymentModel>('per_weight');
    const [chosenRate, setChosenRate] = useState<number | string>(6.2);

    // Column Resizing States for Yield Control Table (Excel-Style draggable lines)
    const DEFAULT_COL_WIDTHS: Record<string, number> = {
        select: 48,
        worker: 190,
        role: 115,
        context: 95,
        rate: 135,
        days: 85,
        hours: 95,
        boxes: 95,
        gross: 115,
        net: 115,
        bonus: 100,
        final: 140,
    };

    const MIN_COL_WIDTHS: Record<string, number> = {
        select: 38,
        worker: 120,
        role: 80,
        context: 70,
        rate: 110,
        days: 60,
        hours: 70,
        boxes: 70,
        gross: 85,
        net: 85,
        bonus: 80,
        final: 110,
    };

    const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);
    const [resizingCol, setResizingCol] = useState<string | null>(null);

    const handleResizeStart = (colKey: string, startX: number) => {
        setResizingCol(colKey);
        const startWidth = colWidths[colKey] || 100;

        const handleMove = (moveX: number) => {
            const diff = moveX - startX;
            const newWidth = Math.max(MIN_COL_WIDTHS[colKey] || 50, startWidth + diff);
            setColWidths(prev => ({ ...prev, [colKey]: newWidth }));
        };

        const onMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            handleMove(e.clientX);
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                handleMove(e.touches[0].clientX);
            }
        };

        const onEnd = () => {
            setResizingCol(null);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onEnd);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    };

    const expandAllColumns = () => {
        setColWidths({
            select: 52,
            worker: 260,
            context: 120,
            rate: 160,
            days: 105,
            hours: 115,
            boxes: 115,
            gross: 135,
            net: 135,
            bonus: 125,
            final: 165,
        });
        toast.info(isKa ? 'ყველა სვეტი გაფართოვდა!' : 'All columns expanded!');
    };

    const resetColumnWidths = () => {
        setColWidths(DEFAULT_COL_WIDTHS);
        toast.info(isKa ? 'სვეტების ზომები აღდგა!' : 'Column widths reset to default!');
    };

    const autoFitValues = () => {
        setColWidths(prev => ({
            ...prev,
            rate: 150,
            gross: 130,
            net: 130,
            bonus: 120,
            final: 160,
        }));
        toast.success(isKa ? 'ციფრების სვეტები ავტომატურად მორგებულია!' : 'Value columns auto-fitted for clear visibility!');
    };

    const unassignedEmployees = useMemo(() => {
        const assignedIds = new Set(localPickers.map(p => p.employeeId));
        return employees.filter(e => !assignedIds.has(e.id));
    }, [employees, localPickers]);

    const filteredUnassignedEmployees = useMemo(() => {
        if (!addWorkerSearchQuery.trim()) return unassignedEmployees;
        const q = addWorkerSearchQuery.toLowerCase().trim();
        return unassignedEmployees.filter(emp => 
            emp.name.toLowerCase().includes(q) ||
            (emp.idNumber && emp.idNumber.toLowerCase().includes(q)) ||
            (emp.barcode && emp.barcode.toLowerCase().includes(q)) ||
            (emp.employeeCodeOverride && emp.employeeCodeOverride.toLowerCase().includes(q)) ||
            (emp.id && emp.id.toLowerCase().includes(q))
        );
    }, [unassignedEmployees, addWorkerSearchQuery]);

    const handleEmployeeSelectChange = (empId: string) => {
        if (!empId) return;
        setSelectedEmpIds(prev => {
            if (prev.includes(empId)) {
                return prev.filter(id => id !== empId);
            }
            return [...prev, empId];
        });
        const emp = employees.find(e => e.id === empId);
        if (emp && selectedEmpIds.length === 0) { // Set rate only for the first selected
            setChosenModel(emp.paymentType as PaymentModel || 'per_weight');
            setChosenRate(emp.paymentRate || 6.2);
        }
    };

    const handleDeletePicker = (employeeId: string) => {
        const doubleCheck = window.confirm(
            t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'
                ? 'დარწმუნებული ხართ, რომ გსურთ მუშის წაშლა ამ კრეფის ღონისძიებიდან?'
                : 'Are you sure you want to remove this worker from this harvest event?'
        );
        if (!doubleCheck) return;
        const updatedList = localPickers.filter(p => p.employeeId !== employeeId);
        setLocalPickers(updatedList);
        syncPickersToParent(updatedList);
        toast.success(
            t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'
                ? 'მუშა წაიშალა სიიდან.'
                : 'Worker removed.'
        );
    };

    const handleAddWorkerSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
        
        if (addMode === 'existing') {
            if (selectedEmpIds.length === 0) {
                toast.error(isKa ? 'გთხოვთ აირჩიოთ მუშა სიიდან' : 'Please select a worker from the list');
                return;
            }
            
            const newPickers = selectedEmpIds
                .filter(id => !localPickers.some(p => p.employeeId === id))
                .map(id => {
                    const parsedRate = chosenRate === '' ? 6.2 : Number(chosenRate) || 6.2;
                    return {
                        employeeId: id,
                        paymentModel: chosenModel,
                        rate: parsedRate,
                        bonus: 0,
                        isDailyContract: chosenModel === 'combined'
                    };
                });
                
            if (newPickers.length === 0 && selectedEmpIds.length > 0) {
                toast.error(isKa ? 'არჩეული მუშები უკვე დამატებულია!' : 'Selected workers are already assigned!');
                return;
            }
            
            const updatedList = [...localPickers, ...newPickers];
            setLocalPickers(updatedList);
            syncPickersToParent(updatedList);
            toast.success(isKa ? 'მუშა წარმატებით დაემატა!' : 'Worker successfully added!');
            setIsAddWorkerOpen(false);
            setSelectedEmpIds([]);
        } else {
            if (!newWorkerName.trim()) {
                toast.error(isKa ? 'გთხოვთ მიუთითოთ მუშის სახელი' : 'Please enter the worker name');
                return;
            }
            const newEmpId = `emp-${Date.now()}`;
            const targetRoleId = roles?.find(r => r.name.toLowerCase().includes('picker') || r.name.toLowerCase().includes('worker'))?.id || '6';
            const parsedRate = chosenRate === '' ? 6.2 : Number(chosenRate) || 6.2;
            const newEmp: Employee = {
                id: newEmpId,
                name: newWorkerName.trim(),
                idNumber: newWorkerId.trim() || `ID-${Date.now().toString().slice(-6)}`,
                employeeType: 'Seasonal',
                email: '',
                phone: '',
                roleId: targetRoleId,
                paymentType: chosenModel as any,
                paymentRate: parsedRate,
                accountType: 'Cash',
                barcode: `BC-${Date.now()}`,
                status: 'active',
                joinedAt: new Date().toISOString()
            };

            if (onSetEmployees) {
                onSetEmployees([...employees, newEmp]);
            }
            const newPicker: AssignedPicker = {
                employeeId: newEmpId,
                paymentModel: chosenModel,
                rate: parsedRate,
                bonus: 0,
                isDailyContract: chosenModel === 'combined'
            };
            const updatedList = [...localPickers, newPicker];
            setLocalPickers(updatedList);
            syncPickersToParent(updatedList);
            toast.success(isKa ? 'ახალი მუშა შეიქმნა და დაემატა!' : 'New worker created and added!');
            setIsAddWorkerOpen(false);
            setNewWorkerName('');
            setNewWorkerId('');
        }
    };

    const handleMergeWorker = (oldId: string, newId: string) => {
        const oldPicker = localPickers.find(p => p.employeeId === oldId);
        if (!oldPicker) return;

        let updatedPickers = [...localPickers];
        const existingPickerIndex = updatedPickers.findIndex(p => p.employeeId === newId);

        if (existingPickerIndex !== -1) {
            // Merge with existing worker
            const existingPicker = updatedPickers[existingPickerIndex];
            updatedPickers[existingPickerIndex] = {
                ...existingPicker,
                manualNetWeight: (existingPicker.manualNetWeight ?? 0) + (oldPicker.manualNetWeight ?? 0),
                manualBoxes: (existingPicker.manualBoxes ?? 0) + (oldPicker.manualBoxes ?? 0),
                manualHours: Math.max(existingPicker.manualHours ?? 0, oldPicker.manualHours ?? 0)
            };
            updatedPickers = updatedPickers.filter(p => p.employeeId !== oldId);
        } else {
            updatedPickers = updatedPickers.map(p => p.employeeId === oldId ? { ...p, employeeId: newId } : p);
        }

        setLocalPickers(updatedPickers);
        syncPickersToParent(updatedPickers);
        toast.success(
            t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'
                ? 'მუშა წარმატებით გაერთიანდა!'
                : 'Worker successfully linked and merged!'
        );
    };

    // States for Crate & Yield Reconciliation
    const [standardBoxWeight, setStandardBoxWeight] = useState<number>(event.standardBoxWeight || 5.3); // X kg standard per full box
    const [punetsPerBox, setPunetsPerBox] = useState<number>(event.punetsPerBox || 12);

    // ⚖️ Exact weigh station scale recorded counts
    const weighStationCounts = useMemo(() => {
        let fullBoxes = 0;
        let halfBoxes = 0;
        let totalPunets = 0;

        (entries || []).forEach(e => {
            if (!e) return;
            const entryPunets = e.punets ?? e.punetCount;
            if (e.isHalfBox) {
                const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
                halfBoxes += count;
                totalPunets += (entryPunets !== undefined ? entryPunets : Math.round(count * ((punetsPerBox || 12) / 2)));
            } else {
                const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
                fullBoxes += count;
                totalPunets += (entryPunets !== undefined ? entryPunets : Math.round(count * (punetsPerBox || 12)));
            }
        });

        return { fullBoxes, halfBoxes, totalPunets };
    }, [entries, punetsPerBox]);

    const hasWeighStationRecords = weighStationCounts.fullBoxes > 0 || weighStationCounts.halfBoxes > 0;

    const initialBoxes = (hasWeighStationRecords && (!event?.totalBoxes || event?.totalBoxes === 39)) 
        ? weighStationCounts.fullBoxes 
        : (event?.totalBoxes || weighStationCounts.fullBoxes || 0);

    const initialHalfBoxes = (hasWeighStationRecords && (!event?.physicalHalfBoxes && weighStationCounts.halfBoxes > 0)) 
        ? weighStationCounts.halfBoxes 
        : (event?.physicalHalfBoxes ?? weighStationCounts.halfBoxes ?? 0);

    const initialPunets = (hasWeighStationRecords && (!event?.physicalPunets || event?.physicalPunets === 468)) 
        ? weighStationCounts.totalPunets 
        : (event?.physicalPunets || weighStationCounts.totalPunets || ((event?.totalBoxes || 0) * (event?.punetsPerBox || 12)));

    const [physicalBoxes, setPhysicalBoxes] = useState<number>(initialBoxes);
    const [isPhysicalBoxesManuallyEdited, setIsPhysicalBoxesManuallyEdited] = useState<boolean>(event.totalBoxes !== undefined && event.totalBoxes !== weighStationCounts.fullBoxes && event.totalBoxes > 0);
    const [physicalHalfBoxes, setPhysicalHalfBoxes] = useState<number>(initialHalfBoxes);
    const [mergeHalfBoxes, setMergeHalfBoxes] = useState<boolean>(event.mergeHalfBoxes ?? false);
    const [physicalPunets, setPhysicalPunets] = useState<number>(initialPunets);
    const [isPunetsManuallyEdited, setIsPunetsManuallyEdited] = useState<boolean>(event.physicalPunets !== undefined || hasWeighStationRecords);
    const [correctedWeight, setCorrectedWeight] = useState<number | undefined>(event.correctedWeight);
    const [selectedBoxItemId, setSelectedBoxItemId] = useState<string>('');
    const [selectedPunetItemId, setSelectedPunetItemId] = useState<string>('');
    const [leaveReconciliationAsIs, setLeaveReconciliationAsIs] = useState<boolean>(event.leaveReconciliationAsIs ?? false);

    // Sync reconciliation state when event changes or loads
    const reconciliationSyncRef = useRef<string | null>(null);

    const currentEventSyncSig = `${event.id}_${event.totalBoxes}_${event.physicalHalfBoxes}_${event.physicalPunets}_${event.mergeHalfBoxes}_${weighStationCounts.fullBoxes}_${weighStationCounts.halfBoxes}_${weighStationCounts.totalPunets}`;

    useEffect(() => {
        if (reconciliationSyncRef.current !== currentEventSyncSig) {
            reconciliationSyncRef.current = currentEventSyncSig;
            setStandardBoxWeight(event.standardBoxWeight || 5.3);
            setPunetsPerBox(event.punetsPerBox || 12);

            const hasScaleRecs = weighStationCounts.fullBoxes > 0 || weighStationCounts.halfBoxes > 0;
            const targetFull = (hasScaleRecs && (!event.totalBoxes || event.totalBoxes === 39)) ? weighStationCounts.fullBoxes : (event.totalBoxes || weighStationCounts.fullBoxes || 0);
            const targetHalf = (hasScaleRecs && event.physicalHalfBoxes === undefined) ? weighStationCounts.halfBoxes : (event.physicalHalfBoxes ?? weighStationCounts.halfBoxes ?? 0);
            const targetPunets = (hasScaleRecs && (!event.physicalPunets || event.physicalPunets === 468)) ? weighStationCounts.totalPunets : (event.physicalPunets || weighStationCounts.totalPunets || ((event.totalBoxes || 0) * (event.punetsPerBox || 12)));

            setPhysicalBoxes(targetFull);
            setPhysicalHalfBoxes(targetHalf);
            setMergeHalfBoxes(event.mergeHalfBoxes ?? false);
            setPhysicalPunets(targetPunets);
            setIsPunetsManuallyEdited(event.physicalPunets !== undefined || hasScaleRecs);
            setCorrectedWeight(event.correctedWeight);
            setLeaveReconciliationAsIs(event.leaveReconciliationAsIs ?? false);
        }
    }, [currentEventSyncSig, event.id, event.standardBoxWeight, event.punetsPerBox, event.totalBoxes, event.physicalHalfBoxes, event.mergeHalfBoxes, event.physicalPunets, event.correctedWeight, event.leaveReconciliationAsIs, weighStationCounts.fullBoxes, weighStationCounts.halfBoxes, weighStationCounts.totalPunets]);

    const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

    // 🍓 Smart Crate & Punet Quantization Math (12 punets = 1 box, leftover = 1 half box, remaining containers returned to stock)
    const smartQuantization = useMemo(() => {
        const pPerBox = punetsPerBox || 12;
        const totalPnts = physicalPunets || 0;
        
        const fullBoxesPacked = Math.floor(totalPnts / pPerBox);
        const leftoverPunets = totalPnts % pPerBox;
        const halfBoxesPacked = leftoverPunets > 0 ? 1 : 0;
        const totalContainersUsed = fullBoxesPacked + halfBoxesPacked;
        
        const surplusBoxes = Math.max(0, physicalHalfBoxes - totalContainersUsed);
        const canMerge2HalfBoxes = physicalHalfBoxes >= 2;
        
        return {
            fullBoxesPacked,
            leftoverPunets,
            halfBoxesPacked,
            totalContainersUsed,
            surplusBoxes,
            canMerge2HalfBoxes
        };
    }, [physicalPunets, physicalHalfBoxes, punetsPerBox]);

    const eventTareWeightAverage = useMemo(() => {
        let totalTare = 0;
        let totalBoxes = 0;
        (entries || []).forEach(e => {
            const derivedTare = (e.grossWeightKg ?? e.netWeightKg ?? 0) - (e.netWeightKg || 0);
            totalTare += e.tareWeightKg !== undefined ? e.tareWeightKg : Math.max(0, derivedTare);
            totalBoxes += e.boxCount || 1;
        });
        return totalBoxes > 0 ? totalTare / totalBoxes : 0;
    }, [entries]);

    // High-performance indexed maps for O(1) worker lookups
    const pickerDataMap = useMemo(() => {
        const empMap = new Map<string, Employee>();
        (employees || []).forEach(e => {
            if (e && e.id) empMap.set(e.id, e);
        });

        const entriesByWorker = new Map<string, {
            entries: HarvestEntry[];
            scannedWeight: number;
            scannedGross: number;
            scannedBoxes: number;
            lastScannedTime: number;
        }>();

        (entries || []).forEach(e => {
            if (!e || !e.employeeId) return;
            let item = entriesByWorker.get(e.employeeId);
            if (!item) {
                item = { entries: [], scannedWeight: 0, scannedGross: 0, scannedBoxes: 0, lastScannedTime: 0 };
                entriesByWorker.set(e.employeeId, item);
            }
            item.entries.push(e);
            const net = e.netWeightKg || 0;
            const boxes = e.boxCount || 1;
            const gross = e.grossWeightKg ?? (net + boxes * eventTareWeightAverage);
            item.scannedWeight += net;
            item.scannedBoxes += boxes;
            item.scannedGross += gross;

            const time = new Date(e.scannedAt || e.timestamp || 0).getTime();
            if (time > item.lastScannedTime) item.lastScannedTime = time;
        });

        return { empMap, entriesByWorker };
    }, [employees, entries, eventTareWeightAverage]);

    const availableRoleNames = useMemo(() => {
        const defaultRoles = ['Picker', 'Loader', 'Weigher', 'Keeper', 'Driver', 'Supervisor', 'Field Worker'];
        const customRoles = (roles || []).map(r => r?.name).filter(Boolean) as string[];
        return Array.from(new Set([...defaultRoles, ...customRoles]));
    }, [roles]);

    const calculatedTotalNetWeight = useMemo(() => {
        let finalWeight = 0;
        const assignedIds = new Set<string>();

        localPickers.forEach(picker => {
            assignedIds.add(picker.employeeId);
            const stats = pickerDataMap.entriesByWorker.get(picker.employeeId);
            const scannedWeight = stats?.scannedWeight || 0;
            finalWeight += picker.manualNetWeight ?? scannedWeight;
        });

        (entries || []).forEach(e => {
            if (e && e.employeeId && !assignedIds.has(e.employeeId)) {
                finalWeight += e.netWeightKg || 0;
            }
        });
        return finalWeight;
    }, [localPickers, entries, pickerDataMap]);

    // Initialize initial physical boxes once for new un-reconciled harvest events (only if no weigh station records exist)
    useEffect(() => {
        if (!event.totalBoxes && physicalBoxes === 0 && calculatedTotalNetWeight > 0 && weighStationCounts.fullBoxes === 0 && weighStationCounts.halfBoxes === 0) {
            const virtBoxes = Math.ceil(calculatedTotalNetWeight / (standardBoxWeight || 5.3));
            setPhysicalBoxes(virtBoxes);
            if (!isPunetsManuallyEdited && physicalPunets === 0) {
                setPhysicalPunets(virtBoxes * punetsPerBox);
            }
        }
    }, [calculatedTotalNetWeight, event.totalBoxes, weighStationCounts.fullBoxes, weighStationCounts.halfBoxes]);

    // Keep physicalBoxes synced with the entries list total boxes
    useEffect(() => {
        if (!pickerDataMap || !localPickers) return;
        
        let globalTotalBoxes = 0;
        const assignedIds = new Set(localPickers.map(p => p.employeeId));

        localPickers.forEach(picker => {
            const stats = pickerDataMap.entriesByWorker.get(picker.employeeId);
            const scannedBoxes = stats?.scannedBoxes || 0;
            const finalBoxes = picker.manualBoxes ?? scannedBoxes;
            globalTotalBoxes += finalBoxes;
        });

        const unassignedEntries = (entries || []).filter(e => e && !assignedIds.has(e.employeeId) && String(e.harvestEventId) === String(event.id));
        globalTotalBoxes += unassignedEntries.reduce((sum, e) => sum + (e.boxCount || 1), 0);
        
        if (!isPhysicalBoxesManuallyEdited) {
            setPhysicalBoxes(globalTotalBoxes);
        }
        if (!isPunetsManuallyEdited) {
            setPhysicalPunets(globalTotalBoxes * punetsPerBox);
        }
    }, [localPickers, entries, pickerDataMap, event.id, punetsPerBox, isPunetsManuallyEdited, isPhysicalBoxesManuallyEdited]);

    const packagingItems = useMemo(() => {
        return (inventoryItems || []).filter(i => 
            i.category === 'Packaging' || 
            i.name.toLowerCase().includes('box') || 
            i.name.toLowerCase().includes('crate') ||
            i.name.toLowerCase().includes('case')
        );
    }, [inventoryItems]);

    const punetItems = useMemo(() => {
        return (inventoryItems || []).filter(i => 
            i.name.toLowerCase().includes('punet') || 
            i.name.toLowerCase().includes('პუნეტი') ||
            i.category === 'Packaging'
        );
    }, [inventoryItems]);

    useEffect(() => {
        if (packagingItems.length > 0 && !selectedBoxItemId) {
            setSelectedBoxItemId(packagingItems[0].id);
        }
        if (punetItems.length > 0 && !selectedPunetItemId) {
            setSelectedPunetItemId(punetItems[0].id);
        }
    }, [packagingItems, selectedBoxItemId, punetItems, selectedPunetItemId]);

    const calculatedVirtualBoxes = calculatedTotalNetWeight / (standardBoxWeight || 5.3);
    const calculatedVirtualPunets = calculatedVirtualBoxes * punetsPerBox;

    // Effective box calculation considering full boxes and half boxes
    const mergedFullBoxesFromHalf = mergeHalfBoxes ? Math.floor(physicalHalfBoxes / 2) : 0;
    const unmergedHalfBoxes = mergeHalfBoxes ? (physicalHalfBoxes % 2) : physicalHalfBoxes;
    const effectiveFullBoxes = physicalBoxes + mergedFullBoxesFromHalf;
    const totalPhysicalBoxesEffective = effectiveFullBoxes + (unmergedHalfBoxes * 0.5);

    // Physical surplus is returned ONLY if physical boxes/punets exceed standard virtual requirement (physical > virtual)
    const boxDifference = Math.max(0, Math.floor(totalPhysicalBoxesEffective) - Math.floor(calculatedVirtualBoxes));
    const punetDifference = Math.max(0, physicalPunets - Math.floor(calculatedVirtualPunets));

    const handleCrateReconciliation = () => {
        if (!leaveReconciliationAsIs && onSetInventoryItems) {
            let updatedInv = [...inventoryItems];
            let returnedMsgs: string[] = [];

            if (boxDifference > 0 && selectedBoxItemId) {
                const boxItem = updatedInv.find(i => i.id === selectedBoxItemId);
                if (boxItem) {
                    updatedInv = updatedInv.map(i => i.id === selectedBoxItemId ? { ...i, currentStock: i.currentStock + boxDifference } : i);
                    returnedMsgs.push(`${boxDifference} empty boxes ("${boxItem.name}")`);
                }
            }

            if (punetDifference > 0 && selectedPunetItemId) {
                const punetItem = updatedInv.find(i => i.id === selectedPunetItemId);
                if (punetItem) {
                    updatedInv = updatedInv.map(i => i.id === selectedPunetItemId ? { ...i, currentStock: i.currentStock + punetDifference } : i);
                    returnedMsgs.push(`${punetDifference} unused punets ("${punetItem.name}")`);
                }
            }

            if (returnedMsgs.length > 0) {
                onSetInventoryItems(updatedInv);
                const msg = (t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka')
                    ? `წარმატება: ${returnedMsgs.join(' და ')} დაბრუნდა საწყობში!`
                    : `Success: Returned ${returnedMsgs.join(' and ')} back to stock/warehouse!`;
                toast.success(msg);
            }
        }

        const finalWeightToSave = correctedWeight !== undefined ? correctedWeight : calculatedTotalNetWeight;
        const totalBoxesToSave = mergeHalfBoxes 
            ? (physicalBoxes + Math.floor(physicalHalfBoxes / 2) + (physicalHalfBoxes % 2 > 0 ? 1 : 0))
            : (physicalBoxes + physicalHalfBoxes);

        // Save event update with ALL fields preserved
        const updatedEvent: HarvestEvent = {
            ...event,
            assignedPickers: localPickers,
            totalNetWeightKg: finalWeightToSave,
            totalBoxes: totalBoxesToSave,
            physicalHalfBoxes,
            mergeHalfBoxes,
            physicalPunets,
            totalPunets: physicalPunets,
            punetsPerBox,
            standardBoxWeight,
            correctedWeight,
            leaveReconciliationAsIs,
            reweighRecords,
            reweighTotalWeight: reweighRecords.reduce((sum, r) => sum + r.weight, 0),
            reweighTotalBoxes: reweighRecords.reduce((sum, r) => sum + r.boxes, 0),
            reweighTotalGrossWeight: reweighRecords.reduce((sum, r) => sum + (r.brutto || r.weight), 0),
            reweighTotalSalary: reweighRecords.reduce((sum, r) => sum + (r.salary || 0), 0),
            sellerReportedWeight,
            reweighNotes
        };
        onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
        
        if (onLogActivity) {
            onLogActivity(
                'Crate Reconciliation Approved', 
                'harvesting', 
                'success', 
                `Approved crate reconciliation: Virtual Boxes: ${calculatedVirtualBoxes.toFixed(1)} (${Math.round(calculatedVirtualPunets)} Punets), Physical: ${physicalBoxes} full + ${physicalHalfBoxes} half boxes (${physicalPunets} Punets).`
            );
        }

        toast.success((t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? "ყუთების და პუნეტების თანხვედრა დამტკიცებულია!" : "Crate & Punet Reconciliation Approved & Saved!");
    };

    // Show/Hide section options for Yield Control (Shown by default)
    const [showReconciliationCards, setShowReconciliationCards] = useState<boolean>(true);
    const [showVarietyTable, setShowVarietyTable] = useState<boolean>(true);
    const [showReconciliationStatus, setShowReconciliationStatus] = useState<boolean>(true);
    const [isShowMenuOpen, setIsShowMenuOpen] = useState<boolean>(false);

    // Advanced Export, History, Share Modal States
    const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
    const [isBoxQrOpen, setIsBoxQrOpen] = useState<boolean>(false);

    const loadedEventIdRef = useRef<string | null>(null);
    const lastUnassignedHashRef = useRef<string>('');

    useEffect(() => {
        const assigned = event.assignedPickers || [];

        // If switching to a new harvest event ID, perform initial sync to event.assignedPickers
        if (loadedEventIdRef.current !== event.id) {
            loadedEventIdRef.current = event.id;
            const existingIds = new Set(assigned.map(p => p.employeeId));
            const unassignedEntryEmpIds = Array.from(new Set(
                (entries || [])
                    .filter(e => e && String(e.harvestEventId) === String(event.id))
                    .map(e => String(e.employeeId))
            )).filter(empId => empId && !existingIds.has(empId));

            lastUnassignedHashRef.current = unassignedEntryEmpIds.join(',');

            if (unassignedEntryEmpIds.length > 0) {
                const extraPickers: AssignedPicker[] = unassignedEntryEmpIds.map(empId => {
                    const emp = (employees || []).find(e => e && e.id === empId);
                    const empRoleName = emp?.roleId ? ((roles || []).find(r => r && r.id === emp.roleId)?.name || emp.roleId) : 'Picker';
                    const empPaymentType = (emp?.paymentType as PaymentModel) || 'per_weight';
                    return {
                        employeeId: empId,
                        paymentModel: empPaymentType,
                        rate: emp?.paymentRate || (event as any).defaultRatePerKg || 0.4,
                        assignedRole: empRoleName,
                        isDailyContract: empPaymentType === 'combined'
                    };
                });
                setLocalPickers([...assigned, ...extraPickers]);
            } else {
                setLocalPickers(assigned);
            }
        } else {
            // Same event ID: preserve active user edits in localPickers, only appending newly scanned unassigned workers
            setLocalPickers(prev => {
                const currentIds = new Set(prev.map(p => p.employeeId));
                const newUnassignedEmpIds = Array.from(new Set(
                    (entries || [])
                        .filter(e => e && String(e.harvestEventId) === String(event.id))
                        .map(e => String(e.employeeId))
                )).filter(empId => empId && !currentIds.has(empId));

                const hash = newUnassignedEmpIds.join(',');
                if (newUnassignedEmpIds.length === 0 || hash === lastUnassignedHashRef.current) {
                    return prev; // Preserve user's active toggles, models, and custom rates!
                }
                lastUnassignedHashRef.current = hash;

                const extraPickers: AssignedPicker[] = newUnassignedEmpIds.map(empId => {
                    const emp = (employees || []).find(e => e && e.id === empId);
                    const empRoleName = emp?.roleId ? ((roles || []).find(r => r && r.id === emp.roleId)?.name || emp.roleId) : 'Picker';
                    const empPaymentType = (emp?.paymentType as PaymentModel) || 'per_weight';
                    return {
                        employeeId: empId,
                        paymentModel: empPaymentType,
                        rate: emp?.paymentRate || (event as any).defaultRatePerKg || 0.4,
                        assignedRole: empRoleName,
                        isDailyContract: empPaymentType === 'combined'
                    };
                });
                return [...prev, ...extraPickers];
            });
        }
    }, [event.id, event.assignedPickers, entries, employees, roles]);

    const syncPickersToParent = (pickers: AssignedPicker[], overrides?: Partial<HarvestEvent>) => {
        if (!pickers) return;
        const cleanedPickers = pickers.map(p => {
            const model = p.paymentModel || 'per_weight';
            const isComb = model === 'combined';
            return {
                ...p,
                paymentModel: model,
                isDailyContract: isComb,
                rate: (p.rate as any) === '' ? 0 : (isNaN(Number(p.rate)) ? 0 : Number(p.rate)),
                bonus: (p.bonus as any) === '' ? 0 : (isNaN(Number(p.bonus)) ? 0 : Number(p.bonus))
            };
        });

        const activeMerge = overrides?.mergeHalfBoxes ?? mergeHalfBoxes;
        const activeFull = overrides?.totalBoxes ?? physicalBoxes;
        const activeHalf = overrides?.physicalHalfBoxes ?? physicalHalfBoxes;
        const calcTotalBoxes = activeMerge 
            ? (activeFull + Math.floor(activeHalf / 2) + (activeHalf % 2 > 0 ? 1 : 0))
            : (activeFull + activeHalf);

        const currentTotalPayroll = cleanedPickers.reduce((sum, p) => {
            const stats = pickerDataMap?.entriesByWorker?.get(p.employeeId);
            const weight = stats?.scannedWeight || 0;
            const hrs = p.manualHours ?? durationHours;
            return sum + calculatePickerEarnings(p, p.manualNetWeight ?? weight, hrs);
        }, 0);

        if (onSetHarvestEvents && harvestEvents && harvestEvents.length > 0) {
            const updatedEvent: HarvestEvent = {
                ...event,
                ...overrides,
                assignedPickers: cleanedPickers,
                totalBoxes: calcTotalBoxes,
                physicalHalfBoxes: activeHalf,
                mergeHalfBoxes: activeMerge,
                physicalPunets: overrides?.physicalPunets ?? physicalPunets,
                totalPunets: overrides?.physicalPunets ?? physicalPunets,
                punetsPerBox: overrides?.punetsPerBox ?? punetsPerBox,
                standardBoxWeight: overrides?.standardBoxWeight ?? standardBoxWeight,
                correctedWeight: overrides?.correctedWeight ?? correctedWeight,
                leaveReconciliationAsIs: overrides?.leaveReconciliationAsIs ?? leaveReconciliationAsIs,
                totalPickerCost: currentTotalPayroll
            };
            onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));
        }

        if (inventoryItems && onSetInventoryItems) {
            const currentWeight = overrides?.correctedWeight ?? correctedWeight;
            const updatedInv = inventoryItems.map(item => {
                if (item.relatedHarvestId === event.id && item.category === 'Produce') {
                    return {
                        ...item,
                        physicalBoxes: calcTotalBoxes > 0 ? calcTotalBoxes : item.physicalBoxes,
                        currentStock: currentWeight !== undefined ? currentWeight : item.currentStock,
                        varietyKg: currentWeight !== undefined ? currentWeight : item.varietyKg
                    };
                }
                return item;
            });
            onSetInventoryItems(updatedInv);
        }

        if (onSetEmployees && employees && employees.length > 0) {
            let changed = false;
            const updatedEmployees = employees.map(emp => {
                const pickerMatch = cleanedPickers.find(p => p.employeeId === emp.id);
                if (pickerMatch && pickerMatch.paymentModel && pickerMatch.paymentModel !== emp.paymentType) {
                    changed = true;
                    return { ...emp, paymentType: pickerMatch.paymentModel };
                }
                return emp;
            });
            if (changed) {
                onSetEmployees(updatedEmployees);
            }
        }
    };

    const handleRestoreWorkerDefault = (employeeId: string) => {
        const emp = (employees || []).find(e => e.id === employeeId);
        const defaultType = (emp?.paymentType as PaymentModel) || 'per_weight';
        const defaultRate = emp?.paymentRate ?? (event as any).defaultRatePerKg ?? 0.4;
        const updated = localPickers.map(p => {
            if (p.employeeId === employeeId) {
                return {
                    ...p,
                    paymentModel: defaultType,
                    rate: defaultRate,
                    isDailyContract: defaultType === 'combined',
                    manualNetWeight: undefined,
                    manualBoxes: undefined,
                    manualHours: undefined,
                    manualDays: undefined,
                    payableNetWeight: undefined,
                    combinedDailyKg: undefined,
                    combinedSubModel: defaultType === 'combined' ? (p.combinedSubModel || 'daily / per weight') : undefined,
                    combinedBaseRate: undefined,
                    combinedPerKgRate: undefined,
                    combinedShiftFraction: undefined,
                    bonus: 0
                };
            }
            return p;
        });
        setLocalPickers(updated);
        syncPickersToParent(updated);
        toast.success(isKa ? 'აღდგენილია სტანდარტულ ტარიფზე!' : 'Restored worker to standard HR default!');
    };

    const handlePickerChange = (employeeId: string, field: keyof AssignedPicker, value: any) => {
        if (field === 'paymentModel' && value === 'RESTORE') {
            handleRestoreWorkerDefault(employeeId);
            return;
        }

        const newPickers = [...localPickers];
        const pickerIndex = newPickers.findIndex(p => p.employeeId === employeeId);
        if (pickerIndex === -1) return;

        let updatedValue: any;
        
        if (field === 'isDailyContract') {
            const nextState = value as boolean;
            updatedValue = nextState;
            newPickers[pickerIndex].isDailyContract = nextState;
            if (nextState) {
                newPickers[pickerIndex].paymentModel = 'combined';
                if (!newPickers[pickerIndex].combinedSubModel) {
                    newPickers[pickerIndex].combinedSubModel = 'daily / per weight';
                }
            } else {
                newPickers[pickerIndex].paymentModel = 'per_weight';
            }
        } else if (field === 'paymentModel') {
            const newModel = value as PaymentModel;
            updatedValue = newModel;
            if (newModel === 'combined') {
                newPickers[pickerIndex].isDailyContract = true;
                if (!newPickers[pickerIndex].combinedSubModel) {
                    newPickers[pickerIndex].combinedSubModel = 'daily / per weight';
                }
            } else {
                newPickers[pickerIndex].isDailyContract = false;
            }
        } else if (field === 'assignedRole') {
            updatedValue = value as string;
        } else {
            if (typeof value === 'string' && value.trim() === '') {
                updatedValue = (field === 'rate' || field === 'bonus') ? '' : undefined;
            } else {
                const numValue = parseFloat(value);
                updatedValue = isNaN(numValue) ? undefined : numValue;
                if (field === 'rate' || field === 'bonus') {
                    updatedValue = isNaN(numValue) ? '' : numValue;
                }
            }
        }

        (newPickers[pickerIndex] as any)[field] = updatedValue;
        setLocalPickers(newPickers);
        syncPickersToParent(newPickers);
    };

    const handleSave = (syncToCloud = true) => {
        let globalTotalWeight = 0;
        let globalTotalBoxes = 0;
        let globalTotalGrossWeight = 0;

        const cleanedPickers = localPickers.map(p => {
            const model = p.paymentModel || 'per_weight';
            const isComb = model === 'combined';
            return {
                ...p,
                paymentModel: model,
                isDailyContract: isComb,
                rate: (p.rate as any) === '' ? 0 : Number(p.rate) || 0,
                bonus: (p.bonus as any) === '' ? 0 : Number(p.bonus) || 0
            };
        });

        const assignedIds = new Set(cleanedPickers.map(p => p.employeeId));

        cleanedPickers.forEach(picker => {
            const stats = pickerDataMap.entriesByWorker.get(picker.employeeId);
            const scannedWeight = stats?.scannedWeight || 0;
            const scannedGross = stats?.scannedGross || 0;
            const scannedBoxes = stats?.scannedBoxes || 0;
            
            const finalNetWeight = picker.manualNetWeight ?? scannedWeight;
            const finalBoxes = picker.manualBoxes ?? scannedBoxes;
            const finalGrossWeight = (picker.manualNetWeight !== undefined || picker.manualBoxes !== undefined)
                ? finalNetWeight + (finalBoxes * eventTareWeightAverage)
                : scannedGross;
            
            globalTotalWeight += finalNetWeight;
            globalTotalBoxes += finalBoxes;
            globalTotalGrossWeight += finalGrossWeight;
        });

        const unassignedEntries = (entries || []).filter(e => e && !assignedIds.has(e.employeeId));
        globalTotalWeight += unassignedEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
        globalTotalBoxes += unassignedEntries.reduce((sum, e) => sum + (e.boxCount || 1), 0);
        
        // Unassigned gross weight
        unassignedEntries.forEach(e => {
            const boxes = e.boxCount || 1;
            globalTotalGrossWeight += e.grossWeightKg ?? ((e.netWeightKg || 0) + (boxes * eventTareWeightAverage));
        });

        const totalPayrollCalculated = cleanedPickers.reduce((sum, p) => {
            const stats = pickerDataMap.entriesByWorker.get(p.employeeId);
            const weight = stats?.scannedWeight || 0;
            const hrs = p.manualHours ?? durationHours;
            return sum + calculatePickerEarnings(p, p.manualNetWeight ?? weight, hrs);
        }, 0);

        const calculatedTotalBoxes = mergeHalfBoxes ? (physicalBoxes + Math.floor(physicalHalfBoxes / 2)) : (physicalBoxes + physicalHalfBoxes);

        const updatedEvent: HarvestEvent = { 
            ...event, 
            assignedPickers: cleanedPickers,
            totalNetWeightKg: correctedWeight !== undefined ? correctedWeight : globalTotalWeight,
            totalGrossWeightKg: globalTotalGrossWeight,
            totalBoxes: calculatedTotalBoxes > 0 ? calculatedTotalBoxes : globalTotalBoxes,
            physicalHalfBoxes,
            mergeHalfBoxes,
            physicalPunets,
            totalPunets: physicalPunets,
            punetsPerBox,
            standardBoxWeight,
            correctedWeight,
            leaveReconciliationAsIs,
            totalPickerCost: totalPayrollCalculated,
            reweighRecords,
            reweighTotalWeight: reweighRecords.reduce((sum, r) => sum + r.weight, 0),
            reweighTotalBoxes: reweighRecords.reduce((sum, r) => sum + r.boxes, 0),
            reweighTotalGrossWeight: reweighRecords.reduce((sum, r) => sum + (r.brutto || r.weight), 0),
            reweighTotalSalary: reweighRecords.reduce((sum, r) => sum + (r.salary || 0), 0),
            sellerReportedWeight,
            reweighNotes
        };
        onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));

        // Sync Produce stock items for Stock & Sales
        if (inventoryItems && onSetInventoryItems) {
            const updatedInv = inventoryItems.map(item => {
                if (item.relatedHarvestId === event.id && item.category === 'Produce') {
                    return {
                        ...item,
                        physicalBoxes: calculatedTotalBoxes > 0 ? calculatedTotalBoxes : item.physicalBoxes,
                        currentStock: correctedWeight !== undefined ? correctedWeight : item.currentStock,
                        varietyKg: correctedWeight !== undefined ? correctedWeight : item.varietyKg
                    };
                }
                return item;
            });
            onSetInventoryItems(updatedInv, syncToCloud);
        }

        // Sync salary rate, role, and paymentType changes to employees list if handler exists
        if (onSetEmployees && employees && employees.length > 0) {
            let employeeListChanged = false;
            const updatedEmployees = employees.map(emp => {
                const pickerMatch = cleanedPickers.find(p => p.employeeId === emp.id);
                if (pickerMatch) {
                    const currentRoleName = pickerMatch.assignedRole || 'Picker';
                    const matchedRoleObj = (roles || []).find(r => r.name.toLowerCase() === currentRoleName.toLowerCase());
                    const newRoleId = matchedRoleObj ? matchedRoleObj.id : emp.roleId;

                    const pickerEntries = entries.filter(e => e.employeeId === pickerMatch.employeeId);
                    const weight = pickerEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
                    const hrs = pickerMatch.manualHours ?? durationHours;
                    const earnings = calculatePickerEarnings(pickerMatch, pickerMatch.manualNetWeight ?? weight, hrs);

                    const workSummary = isKa 
                        ? `მუშაობდა როგორც ${currentRoleName} - გამომუშავებული: ${earnings.toFixed(2)} GEL`
                        : `Was working as ${currentRoleName} and earned ${currency === 'USD' ? '$' : '₾'}${earnings.toFixed(2)}`;

                    const isRateChanged = pickerMatch.rate !== undefined && pickerMatch.rate !== emp.paymentRate && pickerMatch.rate > 0;
                    const isRoleChanged = newRoleId && newRoleId !== emp.roleId;
                    const isNoteChanged = emp.notes !== workSummary;
                    const isPaymentTypeChanged = pickerMatch.paymentModel && pickerMatch.paymentModel !== emp.paymentType;

                    if (isRateChanged || isRoleChanged || isNoteChanged || isPaymentTypeChanged) {
                        employeeListChanged = true;
                        return { 
                            ...emp, 
                            ...(isRateChanged ? { paymentRate: pickerMatch.rate } : {}),
                            ...(isRoleChanged ? { roleId: newRoleId } : {}),
                            ...(isPaymentTypeChanged ? { paymentType: pickerMatch.paymentModel } : {}),
                            notes: workSummary
                        };
                    }
                }
                return emp;
            });
            if (employeeListChanged) {
                onSetEmployees(updatedEmployees, syncToCloud);
            }
        }

        if (onLogActivity) {
            onLogActivity('Manual Adjustments Updated', 'harvesting', 'success', `Harvest event ${event.name} stats updated. New weight: ${globalTotalWeight.toFixed(1)}kg, Boxes: ${globalTotalBoxes}`);
        }
        toast.success((t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') 
            ? (syncToCloud ? "სინქრონიზაცია წარმატებულია!" : "ლოკალურად შენახულია!") 
            : (syncToCloud ? "Synced to Cloud Successfully!" : "Saved Offline Locally!"));
    };

    const handleTogglePayrollApproval = (approved: boolean) => {
        const nowIso = new Date().toISOString();
        const activeUser = getStoredActiveUser();
        const updatedEvent: HarvestEvent = {
            ...event,
            payrollApproved: approved,
            payrollApprovedAt: approved ? nowIso : undefined,
            payrollApprovedBy: approved ? activeUser.name : undefined
        };
        onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
        handleSave(true);
        if (approved) {
            toast.success(isKa ? "✓ მოსავლის ხელფასი დამტკიცებულია და სინქრონიზებულია HR ბარათებთან!" : "✓ Harvest payroll approved & sealed to HR ID cards!");
        } else {
            toast.info(isKa ? "ხელფასის დამტკიცება მოხსნილია (რედაქტირებადი მონახაზი)" : "Payroll approval unlocked (editable draft preview)");
        }
    };
    
    const availableWorkerRoles = useMemo(() => {
        const set = new Set<string>();
        (localPickers || []).forEach(p => {
            if (p.assignedRole) set.add(p.assignedRole);
        });
        ['Picker', 'Loader', 'Foreman', 'Driver', 'Weigher', 'Supervisor', 'Security'].forEach(r => set.add(r));
        return Array.from(set);
    }, [localPickers]);

    const filteredPickers = useMemo(() => {
        if (!localPickers) return [];
        let result = localPickers;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(picker => {
                const employee = pickerDataMap.empMap.get(picker.employeeId);
                const fullName = (employee?.name || 'Unrecognized Worker').toLowerCase();
                const idNum = (employee?.idNumber || '').toLowerCase();
                const role = (picker.assignedRole || 'Picker').toLowerCase();
                const model = (picker.paymentModel || '').toLowerCase();
                return fullName.includes(query) || 
                       picker.employeeId.toLowerCase().includes(query) || 
                       idNum.includes(query) ||
                       role.includes(query) ||
                       model.includes(query);
            });
        }

        if (roleFilter !== 'all') {
            result = result.filter(picker => {
                const pickerRole = (picker.assignedRole || 'picker').toLowerCase();
                return pickerRole.includes(roleFilter.toLowerCase());
            });
        }

        if (paymentTypeFilter !== 'all') {
            result = result.filter(picker => {
                const pickerModel = (picker.paymentModel || 'per_weight').toLowerCase();
                return pickerModel === paymentTypeFilter.toLowerCase();
            });
        }

        if (showZeroHarvestOnly !== 'all') {
            result = result.filter(picker => {
                const stats = pickerDataMap.entriesByWorker.get(picker.employeeId);
                const net = picker.manualNetWeight ?? (stats?.scannedWeight || 0);
                if (showZeroHarvestOnly === 'zero') {
                    return net <= 0.001;
                } else if (showZeroHarvestOnly === 'non-zero') {
                    return net > 0.001;
                }
                return true;
            });
        }

        return [...result].sort((a, b) => {
            let cmp = 0;
            const empA = pickerDataMap.empMap.get(a.employeeId);
            const empB = pickerDataMap.empMap.get(b.employeeId);

            if (sortBy === 'alphabet') {
                const valA = empA?.name || 'Unrecognized Worker';
                const valB = empB?.name || 'Unrecognized Worker';
                cmp = valA.localeCompare(valB);
            } else if (sortBy === 'number') {
                const statsA = pickerDataMap.entriesByWorker.get(a.employeeId);
                const netA = a.manualNetWeight ?? (statsA?.scannedWeight || 0);
                const statsB = pickerDataMap.entriesByWorker.get(b.employeeId);
                const netB = b.manualNetWeight ?? (statsB?.scannedWeight || 0);
                cmp = netA - netB;
            } else if (sortBy === 'data') {
                const valA = (empA as any)?.registrationDate || (empA as any)?.hireDate || empA?.joinedAt || '';
                const valB = (empB as any)?.registrationDate || (empB as any)?.hireDate || empB?.joinedAt || '';
                cmp = valA.localeCompare(valB);
            } else if (sortBy === 'role') {
                const roleA = a.assignedRole || 'Picker';
                const roleB = b.assignedRole || 'Picker';
                cmp = roleA.localeCompare(roleB);
            } else if (sortBy === 'payment_model') {
                const modelA = a.paymentModel || '';
                const modelB = b.paymentModel || '';
                cmp = modelA.localeCompare(modelB);
            } else if (sortBy === 'rate') {
                const rateA = Number(a.rate) || 0;
                const rateB = Number(b.rate) || 0;
                cmp = rateA - rateB;
            } else if (sortBy === 'last_modified') {
                const statsA = pickerDataMap.entriesByWorker.get(a.employeeId);
                const statsB = pickerDataMap.entriesByWorker.get(b.employeeId);
                const maxA = statsA?.lastScannedTime || 0;
                const maxB = statsB?.lastScannedTime || 0;
                cmp = maxA - maxB;
            }

            return sortOrder === 'asc' ? cmp : -cmp;
        });
    }, [localPickers, searchQuery, showZeroHarvestOnly, roleFilter, paymentTypeFilter, sortBy, sortOrder, pickerDataMap]);

    const arrivedPickersCount = useMemo(() => {
        if (!localPickers) return 0;
        return localPickers.filter(p => !p.assignedRole || p.assignedRole.toLowerCase().includes('picker')).length;
    }, [localPickers]);

    const loadersCountVal = useMemo(() => {
        if (!localPickers) return 1;
        return Math.max(1, localPickers.filter(p => p.assignedRole && p.assignedRole.toLowerCase().includes('loader')).length);
    }, [localPickers]);

    const logisticsVehicleCount = useMemo(() => {
        if (!event?.logisticsRecords || event.logisticsRecords.length === 0) {
            return Math.max(1, Math.ceil((localPickers?.length || 1) / 10));
        }
        return event.logisticsRecords.reduce((sum, r) => sum + (r.vehicleCount || 1), 0);
    }, [event?.logisticsRecords, localPickers]);

    const minibusOvercrowdingRatio = useMemo(() => {
        return arrivedPickersCount / (logisticsVehicleCount || 1);
    }, [arrivedPickersCount, logisticsVehicleCount]);

    const recommendedExtraVehicles = useMemo(() => {
        return Math.max(0, Math.ceil(arrivedPickersCount / 9) - logisticsVehicleCount);
    }, [arrivedPickersCount, logisticsVehicleCount]);

    const loaderRatioVal = useMemo(() => {
        return arrivedPickersCount / loadersCountVal;
    }, [arrivedPickersCount, loadersCountVal]);

    const expectedHeadcountVal = useMemo(() => {
        return (event as any)?.expectedPickersCount || (arrivedPickersCount + 6);
    }, [(event as any)?.expectedPickersCount, arrivedPickersCount]);

    const missingHeadcountVal = useMemo(() => {
        return Math.max(0, expectedHeadcountVal - arrivedPickersCount);
    }, [expectedHeadcountVal, arrivedPickersCount]);

    const brigadeComparisonData = useMemo(() => {
        if (!localPickers || localPickers.length === 0) return [];
        const groupsMap = new Map<string, { foremanName: string; workers: typeof localPickers }>();
        
        localPickers.forEach(p => {
            const foremanKey = (p as any).foremanName || (p as any).foremanId || (isKa ? 'ძირითადი ბრიგადა' : 'General Brigade');
            if (!groupsMap.has(foremanKey)) {
                groupsMap.set(foremanKey, { foremanName: foremanKey, workers: [] });
            }
            groupsMap.get(foremanKey)!.workers.push(p);
        });

        return Array.from(groupsMap.values()).map(b => {
            let totalNetKg = 0;
            let totalBoxes = 0;
            let totalPayout = 0;
            let topHarvesterName = '';
            let maxNetKg = -1;

            b.workers.forEach(w => {
                const data = pickerDataMap[w.employeeId];
                if (data) {
                    totalNetKg += data.netKg || 0;
                    totalBoxes += data.boxes || 0;
                    totalPayout += data.calculatedPay || 0;
                    if ((data.netKg || 0) > maxNetKg) {
                        maxNetKg = data.netKg || 0;
                        topHarvesterName = (w as any).employeeName || w.employeeId;
                    }
                }
            });

            const costPerKg = totalNetKg > 0 ? totalPayout / totalNetKg : 0;
            return {
                foremanName: b.foremanName,
                workerCount: b.workers.length,
                totalNetKg,
                totalBoxes,
                totalPayout,
                costPerKg,
                topHarvester: topHarvesterName
            };
        });
    }, [localPickers, pickerDataMap, isKa]);

    const filteredStatPickers = useMemo(() => {
        if (!localPickers) return [];
        return localPickers.filter(p => {
            if (statRoleFilter !== 'all') {
                const roleStr = (p.assignedRole || 'picker').toLowerCase();
                if (!roleStr.includes(statRoleFilter)) return false;
            }
            if (statSalaryFilter !== 'all') {
                const modelStr = (p.paymentModel || 'per_weight').toLowerCase();
                if (modelStr !== statSalaryFilter) return false;
            }
            if (statSelectionFilter === 'marked' && !selectedPickers.has(p.employeeId)) {
                return false;
            }
            return true;
        });
    }, [localPickers, statRoleFilter, statSalaryFilter, statSelectionFilter, selectedPickers]);

    const handleExport = () => {
        setIsExportModalOpen(true);
    };
    
    if (!event || !localPickers) return null;
    
    const getPaymentModelLabel = (model: string) => {
        switch (model) {
            case 'per_weight': return t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'კგ ტარიფი' : 'Per Weight';
            case 'hourly': return t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'საათობრივი' : 'Hourly';
            case 'daily': return t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'დღიური' : 'Daily';
            case 'salary': return t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ხელფასი' : 'Salary';
            case 'combined': return t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'კომბინირებული' : 'Combined';
            default: return model.replace('_', ' ');
        }
    };

    const renderResizableTh = (colKey: string, label: string, align: 'left' | 'center' | 'right' = 'left') => (
        <th 
            key={colKey}
            style={{ width: `${colWidths[colKey]}px` }}
            className={`relative px-2.5 sm:px-3 py-3 text-${align} text-[10px] sm:text-[11px] text-slate-500 uppercase font-black tracking-wider bg-slate-100 border-b border-slate-200 select-none whitespace-nowrap overflow-hidden text-ellipsis`}
        >
            <span className="truncate">{label}</span>
            <div
                onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(colKey, e.clientX);
                }}
                onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length > 0) {
                        handleResizeStart(colKey, e.touches[0].clientX);
                    }
                }}
                onDoubleClick={() => {
                    setColWidths(prev => ({
                        ...prev,
                        [colKey]: (prev[colKey] || 100) > (DEFAULT_COL_WIDTHS[colKey] + 15) ? DEFAULT_COL_WIDTHS[colKey] : DEFAULT_COL_WIDTHS[colKey] + 45
                    }));
                }}
                className={`absolute right-0 top-0 bottom-0 w-3.5 cursor-col-resize z-20 flex items-center justify-center group touch-none ${
                    resizingCol === colKey ? 'bg-indigo-500/30' : 'hover:bg-indigo-400/20'
                }`}
                title={isKa ? 'გადაათრიეთ სვეტის გასაფართოებლად' : 'Drag line to resize column'}
            >
                <div className={`w-0.5 h-full transition-colors ${resizingCol === colKey ? 'bg-indigo-600' : 'bg-slate-300 group-hover:bg-indigo-500'}`} />
            </div>
        </th>
    );

    const formatCleanVal = (val: number): string => {
        if (typeof val !== 'number' || isNaN(val)) return '0';
        if (val >= 1000) {
            const kVal = val / 1000;
            if (val % 1000 === 0) return kVal.toFixed(0) + 'k';
            if (val % 100 === 0) return kVal.toFixed(1) + 'k';
            if (val % 10 === 0) return kVal.toFixed(2) + 'k';
            return kVal.toFixed(3) + 'k';
        }
        if (val % 1 === 0) return val.toFixed(0);
        return val.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d+?)0+$/, '$1');
    };

    const formatNiceCurrency = (amount: number): string => {
        const valStr = formatCleanVal(amount);
        return `$${valStr}`;
    };

    const opex = calculateTotalOpex(event, entries || [], durationHours || 8, machinery || []);
    const laborCost = opex.laborCost;
    const machineCost = opex.machineCost;
    const packagingCost = opex.packagingCost;
    const otherCosts = opex.otherCosts;
    const totalCost = opex.totalCost;

    const pickersCount = localPickers.filter(p => !p.assignedRole || p.assignedRole.toLowerCase().includes('picker')).length;
    const loadersCount = localPickers.filter(p => p.assignedRole && p.assignedRole.toLowerCase().includes('loader')).length;
    const othersCount = localPickers.filter(p => p.assignedRole && !p.assignedRole.toLowerCase().includes('picker') && !p.assignedRole.toLowerCase().includes('loader')).length;
    
    const vehiclesCarsCount = (event.assignedVehicles || []).length + (event.logisticsRecords || []).reduce((acc: number, r: any) => acc + (r.vehicleCount || 0), 0);
    const foremenCount = (event.logisticsRecords || []).length;

    const summaryNetKg = calculatedTotalNetWeight > 0 ? calculatedTotalNetWeight : (event.totalNetWeightKg || 0);
    const summaryGrossKg = event.totalGrossWeightKg || 0;
    const summaryTotalBoxes = event.totalBoxes ?? physicalBoxes;
    const summaryTotalPunets = event.physicalPunets ?? (summaryTotalBoxes * (event.punetsPerBox || 12));

    return (
        <div className="flex flex-col h-full bg-white min-h-0">
             <style>{`.button-primary { padding: 0.5rem 1rem; background-color: #2563eb; color: white; border-radius: 0.5rem; font-weight: 600; } .button-secondary { padding: 0.5rem 1rem; background-color: #f1f5f9; color: #334155; border-radius: 0.5rem; font-weight: 600; }`}</style>
            
            {/* Yield Control Harvest Event Summary Banner */}
            <div className="bg-slate-900 text-white p-3 sm:p-4 border-b border-slate-800 flex-shrink-0 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🍇</span>
                        <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                            {event.name}
                        </h2>
                        <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest">
                            Yield Control Overview
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-800/60 shadow-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TOTAL EVENT OPEX:</span>
                        <span className="text-sm font-black text-emerald-300">{formatNiceCurrency(totalCost)}</span>
                    </div>
                </div>

                {/* Metric Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[10px]">
                    {/* 1. Harvest NET */}
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 shadow-2xs">
                        <span className="text-slate-400 font-black uppercase block tracking-wider text-[8px]">HARVEST NET</span>
                        <span className="text-xs sm:text-sm font-black text-white truncate block">{formatCleanVal(summaryNetKg)} kg</span>
                    </div>

                    {/* 2. Harvest GROSS */}
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 shadow-2xs">
                        <span className="text-slate-400 font-black uppercase block tracking-wider text-[8px]">HARVEST GROSS</span>
                        <span className="text-xs sm:text-sm font-black text-slate-200 truncate block">{formatCleanVal(summaryGrossKg)} kg</span>
                    </div>

                    {/* 3. Pickers Pay / Labor */}
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 shadow-2xs">
                        <span className="text-indigo-300 font-black uppercase block tracking-wider text-[8px]">PICKERS LABOR</span>
                        <span className="text-xs sm:text-sm font-black text-indigo-200 truncate block">{formatNiceCurrency(laborCost)}</span>
                    </div>

                    {/* 4. Boxes & Containers + Cost */}
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 shadow-2xs">
                        <span className="text-amber-300 font-black uppercase block tracking-wider text-[8px]">BOXES & PUNETS</span>
                        <span className="text-xs sm:text-sm font-black text-amber-200 truncate block">{summaryTotalBoxes} box / {summaryTotalPunets} pnt</span>
                        <span className="text-[8px] font-bold text-amber-400/80 block">{formatNiceCurrency(packagingCost)}</span>
                    </div>

                    {/* 5. Workers Breakdown */}
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 shadow-2xs">
                        <span className="text-slate-400 font-black uppercase block tracking-wider text-[8px]">WORKFORCE</span>
                        <span className="text-xs font-black text-white block">{localPickers.length} workers</span>
                        <span className="text-[8px] text-slate-400 font-bold block">{pickersCount} pick / {loadersCount} load / {othersCount} oth</span>
                    </div>

                    {/* 6. Drivers / Cars / Foremen */}
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 shadow-2xs">
                        <span className="text-cyan-300 font-black uppercase block tracking-wider text-[8px]">CARS & FOREMEN</span>
                        <span className="text-xs font-black text-cyan-200 block">{vehiclesCarsCount} cars / {foremenCount} foremen</span>
                        <span className="text-[8px] font-bold text-cyan-400/80 block">{formatNiceCurrency(machineCost)}</span>
                    </div>

                    {/* 7. Used Materials */}
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 shadow-2xs">
                        <span className="text-purple-300 font-black uppercase block tracking-wider text-[8px]">USED MATERIALS</span>
                        <span className="text-xs sm:text-sm font-black text-purple-200 truncate block">{formatNiceCurrency(otherCosts)}</span>
                    </div>

                    {/* 8. Total OPEX */}
                    <div className="bg-emerald-950/80 p-2 rounded-xl border border-emerald-800/80 shadow-2xs">
                        <span className="text-emerald-400 font-black uppercase block tracking-wider text-[8px]">TOTAL OPEX</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-300 truncate block">{formatNiceCurrency(totalCost)}</span>
                    </div>
                </div>
            </div>

            <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap xl:flex-nowrap items-center justify-between gap-3 flex-shrink-0">
                {/* Left Controls: Search, Sort, Yield Filter */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-grow max-w-3xl">
                    {/* Search Input Box */}
                    <div className="relative flex-1 min-w-[220px] sm:min-w-[260px] max-w-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-500">
                            <SearchIcon className="h-4 w-4" />
                        </div>
                        <input
                            type="text"
                            placeholder={isKa ? 'ძებნა მუშაკის სახელით, ID-ით...' : 'Search workers by name, ID, code or role...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-9 pr-7 py-2 bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-2xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-xs transition-all shadow-2xs"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Sort By Dropdown */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 px-2.5 rounded-2xl border border-slate-200/80">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{isKa ? 'სორტირება:' : 'SORT:'}</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 rounded-xl py-1 px-2 text-slate-800 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="alphabet">{isKa ? 'ანბანით (სახელი)' : 'NAME / ALPHABET'}</option>
                            <option value="data">{isKa ? 'რეგ. თარიღით' : 'REG DATE'}</option>
                            <option value="role">{isKa ? 'როლით' : 'ROLE'}</option>
                            <option value="payment_model">{isKa ? 'ანაზღაურების ტიპით' : 'PAYMENT TYPE'}</option>
                            <option value="rate">{isKa ? 'ტარიფით' : 'RATE'}</option>
                            <option value="number">{isKa ? 'წონით (KG)' : 'NET KG'}</option>
                            <option value="last_modified">{isKa ? 'ბოლო ცვლილებით' : 'LAST MODIFIED'}</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-bold border border-slate-200 shadow-2xs cursor-pointer transition-all"
                            title={sortOrder === 'asc' ? (isKa ? 'ზრდადობით' : 'Ascending') : (isKa ? 'კლებადობით' : 'Descending')}
                        >
                            {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                        </button>
                    </div>

                    {/* Role Filter Dropdown */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 px-2.5 rounded-2xl border border-slate-200/80">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{isKa ? 'როლი:' : 'ROLE:'}</span>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 rounded-xl py-1 px-2 text-slate-800 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="all">{isKa ? 'ყველა როლი' : 'ALL ROLES'}</option>
                            {availableWorkerRoles.map(r => (
                                <option key={r} value={r}>{r.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    {/* Payment Model Filter Dropdown */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 px-2.5 rounded-2xl border border-slate-200/80">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{isKa ? 'ტიპი:' : 'PAYMENT:'}</span>
                        <select
                            value={paymentTypeFilter}
                            onChange={(e) => setPaymentTypeFilter(e.target.value)}
                            className="text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 rounded-xl py-1 px-2 text-slate-800 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="all">{isKa ? 'ყველა ტიპი' : 'ALL TYPES'}</option>
                            <option value="per_weight">{isKa ? 'წონით (PER KG)' : 'PER WEIGHT'}</option>
                            <option value="hourly">{isKa ? 'საათობრივი' : 'HOURLY'}</option>
                            <option value="daily">{isKa ? 'დღიური' : 'DAILY'}</option>
                            <option value="combined">{isKa ? 'კომბინირებული' : 'COMBINED'}</option>
                            <option value="salary">{isKa ? 'ფიქსირებული/ხელფასი' : 'SALARY'}</option>
                        </select>
                    </div>

                    {/* Yield Filter Box */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 px-2.5 rounded-2xl border border-slate-200/80">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{isKa ? 'მოსავალი:' : 'YIELD:'}</span>
                        <select
                            value={showZeroHarvestOnly}
                            onChange={(e) => setShowZeroHarvestOnly(e.target.value as any)}
                            className="text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 rounded-xl py-1 px-3 text-slate-800 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="all">{isKa ? 'ყველა მუშა' : 'ALL WORKERS'}</option>
                            <option value="zero">{isKa ? 'ნულოვანი (0 კგ)' : 'ZERO HARVEST (0 KG)'}</option>
                            <option value="non-zero">{isKa ? 'მოსავლით (> 0 კგ)' : 'WITH HARVEST (> 0 KG)'}</option>
                        </select>
                    </div>
                </div>

                {/* Right Controls: Two Symmetrical Rows of Actions */}
                <div className="flex flex-col gap-2 items-stretch sm:items-end justify-center">
                    {/* Top Row: Add Worker, Export to Excel, Save Adjustments */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                        {selectedPickers.size > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm(isKa ? `ნამდვილად გსურთ არჩეული ${selectedPickers.size} მუშის წაშლა?` : `Are you sure you want to remove ${selectedPickers.size} selected workers?`)) {
                                        const updated = localPickers.filter(p => !selectedPickers.has(p.employeeId));
                                        setLocalPickers(updated);
                                        syncPickersToParent(updated);
                                        setSelectedPickers(new Set());
                                    }
                                }}
                                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-2xl font-black text-xs tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs border border-red-200"
                            >
                                <TrashIcon className="h-4 w-4" /> {isKa ? `წაშლა (${selectedPickers.size})` : `Delete (${selectedPickers.size})`}
                            </button>
                        )}
                        <button 
                            type="button" 
                            onClick={() => {
                                setAddMode('existing');
                                setSelectedEmpIds([]);
                                setNewWorkerName('');
                                setNewWorkerId('');
                                setChosenModel('per_weight');
                                setChosenRate(6.2);
                                setIsAddWorkerOpen(true);
                            }} 
                            className="px-4 py-2 bg-[#00A86B] hover:bg-[#00915c] text-white rounded-2xl font-black text-xs tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                        >
                            <PlusIcon className="h-4 w-4 stroke-[3]"/> {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? '+ მუშის დამატება' : '+ Add Worker'}
                        </button>
                        
                        {viewMode === 'payroll' && (
                            <button 
                                type="button"
                                onClick={() => onSwitchTab?.('management')}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-extrabold text-xs tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                            >
                                ⚙️ {isKa ? 'მენეჯმენტი და სხვა ინსტრუმენტები →' : 'Management & Tools →'}
                            </button>
                        )}

                        <button 
                            onClick={handleExport} 
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4"/> {t('adv.export_excel') || 'Export to Excel'}
                        </button>
                        <button 
                            onClick={() => handleSave(false)} 
                            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl font-extrabold text-xs transition-all shadow-xs cursor-pointer"
                        >
                            {isKa ? 'შენახვა (ლოკალურად)' : 'Save (Offline)'}
                        </button>
                        <button 
                            onClick={() => handleSave(true)} 
                            className="px-4 py-2 bg-[#1D63ED] hover:bg-[#1552cd] text-white rounded-2xl font-extrabold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            {isKa ? 'ატვირთვა (Update All)' : 'Sync to Cloud (Update All)'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTogglePayrollApproval(!event.payrollApproved)}
                            className={`px-4 py-2 rounded-2xl font-black text-xs tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs ${
                                event.payrollApproved 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200' 
                                    : 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white shadow-indigo-200 animate-pulse'
                            }`}
                            title={isKa ? "ხელფასის დამტკიცება და HR ID ბარათებთან სინქრონიზაცია" : "Approve & Seal Harvest Payroll to HR Cards"}
                        >
                            {event.payrollApproved ? (
                                <>
                                    <CheckCheck className="h-4 w-4 text-emerald-200" />
                                    <span>{isKa ? '✓ ხელფასი დამტკიცებულია' : '✓ Payroll Approved'}</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                                    <span>{isKa ? 'ხელფასის დამტკიცება (HR სინქრონი)' : 'Approve Payroll & Sync to HR'}</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsBoxQrOpen(true)}
                            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                            title={isKa ? "მოსავლის ყუთების უნიკალური QR კოდების გენერირება" : "Generate Unique Non-duplicate Box QR codes"}
                        >
                            <QrCode className="h-4 w-4 text-emerald-400" />
                            <span>{isKa ? 'ყუთების QR' : 'Box QRs'}</span>
                        </button>
                    </div>

                    {/* Active Users Collaboration Bar */}
                    {(viewMode === 'management' || viewMode === 'statistics' || viewMode === 'all') && (
                        <div className="w-full mb-1">
                            <ActiveUsersPresenceBar harvestId={event.id} activeViewName="Yield & Payroll Controls" />
                        </div>
                    )}

                    {/* Bottom Row: Reweigh, Share, History, Print Report, SHOW / HIDE FIELDS */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                        {(viewMode === 'payroll' || viewMode === 'management' || viewMode === 'statistics' || viewMode === 'all') && (
                            <>
                                <button 
                                    type="button"
                                    onClick={() => setIsReweighOpen(true)}
                                    className="px-4 py-2 bg-[#5850EC] hover:bg-[#473fdb] text-white rounded-2xl font-extrabold text-xs tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
                                >
                                    ⚖️ {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'აწონვა' : 'Reweigh'}
                                </button>
                                <button 
                                    onClick={() => setIsShareModalOpen(true)} 
                                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                    <Share2 className="h-4 w-4"/> {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'გაზიარება' : 'Share'}
                                </button>
                                <button 
                                    onClick={() => setIsHistoryModalOpen(true)} 
                                    className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                    <History className="h-4 w-4"/> {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ისტორია' : 'History'}
                                </button>
                            </>
                        )}
                        <button 
                            type="button"
                            onClick={() => setIsPrintModalOpen(true)} 
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                            title={isKa ? 'აუდიტის რეპორტის დაბეჭდვა / PDF' : 'Print / Save Audit Report PDF'}
                        >
                            🖨️ {isKa ? 'ბეჭდვა / PDF' : 'Print Report'}
                        </button>
                        
                        {(viewMode === 'management' || viewMode === 'all') && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsShowMenuOpen(!isShowMenuOpen)}
                                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                                >
                                    <span>{isKa ? 'ველების გამოჩენა' : 'SHOW / HIDE FIELDS'}</span>
                                    <span className="text-[8px]">▼</span>
                                </button>
                                {isShowMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsShowMenuOpen(false)} />
                                        <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 text-xs space-y-1">
                                            <div className="text-[9px] font-black uppercase text-slate-400 px-2 py-1 border-b border-slate-100">
                                                {isKa ? 'პანელების გამოჩენა' : 'Visibility Settings'}
                                            </div>
                                            <label className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer">
                                                <span className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                                                    📦 {isKa ? 'ბარათები' : 'Yield Cards'}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={showReconciliationCards}
                                                    onChange={(e) => setShowReconciliationCards(e.target.checked)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer accent-indigo-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer">
                                                <span className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                                                    🍇 {isKa ? 'ჯიშების ცხრილი' : 'Variety Table'}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={showVarietyTable}
                                                    onChange={(e) => setShowVarietyTable(e.target.checked)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer accent-indigo-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer">
                                                <span className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                                                    ⚖️ {isKa ? 'სტატუსის ბარი' : 'Status Bar'}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={showReconciliationStatus}
                                                    onChange={(e) => setShowReconciliationStatus(e.target.checked)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer accent-indigo-600"
                                                />
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex-grow overflow-y-auto">
                {/* 📦 Yield & Empty Crate Reconciliation Control Board */}
                {(viewMode === 'management' || viewMode === 'all') && (
                <div className="p-5 m-4 bg-slate-50 border-2 border-slate-100 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg text-lg">
                                📦
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{t('adv.yield_reconciliation')}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{t('adv.reconciliation_desc')}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowReconciliationCards(prev => !prev)}
                            className="px-2.5 py-1 text-[10px] font-extrabold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                        >
                            {showReconciliationCards ? '👁️ ' + (isKa ? 'დამალვა' : 'Hide') : '👁️‍🗨️ ' + (isKa ? 'გამოჩენა' : 'Show')}
                        </button>
                    </div>

                    {showReconciliationCards && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Column 1: Net Weight */}
                                <div className="md:col-span-3 bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs space-y-2 text-left">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('adv.total_net_weight')}</label>
                                    <div className="text-xl font-extrabold text-slate-800 flex items-baseline gap-1">
                                        {calculatedTotalNetWeight.toLocaleString(undefined, {maximumFractionDigits:1})} <span className="text-[10px] text-slate-400">KG</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black uppercase text-slate-450 block">{t('adv.correct_weight')}</span>
                                        <input 
                                            type="number" 
                                            step="any"
                                            value={correctedWeight !== undefined ? correctedWeight : ''}
                                            onChange={e => {
                                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                setCorrectedWeight(val);
                                                syncPickersToParent(localPickers, { correctedWeight: val });
                                            }}
                                            className="w-full text-xs font-black p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder={t('adv.adjust_weight_placeholder').replace('{weight}', calculatedTotalNetWeight.toFixed(1))}
                                        />
                                    </div>
                                    {/* Reweighed Details Indicator */}
                                    {reweighRecords.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-150 space-y-1 bg-indigo-55/30 p-2 rounded-lg animate-fadeIn">
                                            <div className="flex justify-between items-center text-[10px] font-black text-indigo-750 uppercase">
                                                <span>⚖️ {isKa ? 'გადაწონილი:' : 'Reweighed:'}</span>
                                                <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-black">{reweighRecords.reduce((s, r) => s + r.weight, 0).toFixed(1)} KG</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] text-slate-550 font-black uppercase">
                                                <span>{isKa ? 'ყუთები:' : 'Boxes:'} {reweighRecords.reduce((s, r) => s + r.boxes, 0)}</span>
                                                <span>{isKa ? 'ჩანაწერი:' : 'Records:'} {reweighRecords.length}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] text-slate-550 font-black uppercase">
                                                <span>{isKa ? 'სხვაობა:' : 'Variance:'}</span>
                                                <span className={`font-black ${Math.abs(calculatedTotalNetWeight - reweighRecords.reduce((s, r) => s + r.weight, 0)) < 0.1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {(calculatedTotalNetWeight - reweighRecords.reduce((s, r) => s + r.weight, 0)).toFixed(1)} KG
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Column 2: Virtual Boxes & Punets */}
                                <div className="md:col-span-3 bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs space-y-2 text-left">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('adv.virtual_boxes')}</label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[8px] font-black text-slate-400 uppercase">{t('adv.ratio_kg')}</span>
                                            <input 
                                                type="number" 
                                                step="any"
                                                value={standardBoxWeight}
                                                onChange={e => setStandardBoxWeight(Math.max(0.1, parseFloat(e.target.value) || 5.3))}
                                                className="w-10 text-[10px] font-bold p-1 border border-slate-200 rounded text-center outline-none focus:ring-1 focus:ring-blue-550"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-xl font-extrabold text-blue-600">
                                        {calculatedVirtualBoxes.toFixed(1)} <span className="text-[10px] text-slate-400">{t('adv.standard_boxes')}</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-amber-800 text-[11px] font-black">
                                        <span>🍓 {Math.round(calculatedVirtualPunets).toLocaleString()} {isKa ? 'პუნეტი' : 'Punets'}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                                        {t('adv.auto_formula').replace('{weight}', calculatedTotalNetWeight.toFixed(1)).replace('{ratio}', String(standardBoxWeight))}
                                    </p>
                                </div>

                                {/* Column 3: Physical Box & Punet Counter with Half Boxes */}
                                <div className="md:col-span-6 bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs space-y-2 text-left">
                                    <div className="flex justify-between items-center flex-wrap gap-2">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('adv.physical_box_counter')}</label>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const syncedFull = weighStationCounts.fullBoxes;
                                                    const syncedHalf = weighStationCounts.halfBoxes;
                                                    const syncedPunets = weighStationCounts.totalPunets;

                                                    setPhysicalBoxes(syncedFull);
                                                    setPhysicalHalfBoxes(syncedHalf);
                                                    setPhysicalPunets(syncedPunets);
                                                    setIsPunetsManuallyEdited(true);

                                                    const computedTotal = mergeHalfBoxes ? (syncedFull + Math.floor(syncedHalf / 2)) : (syncedFull + syncedHalf);

                                                    const syncedEv: HarvestEvent = {
                                                        ...event,
                                                        totalBoxes: computedTotal,
                                                        physicalHalfBoxes: syncedHalf,
                                                        physicalPunets: syncedPunets,
                                                        totalPunets: syncedPunets
                                                    };

                                                    onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? syncedEv : e));

                                                    if (inventoryItems && onSetInventoryItems) {
                                                        const updatedInv = inventoryItems.map(item => {
                                                            if (item.relatedHarvestId === event.id && item.category === 'Produce') {
                                                                return {
                                                                    ...item,
                                                                    physicalBoxes: computedTotal
                                                                };
                                                            }
                                                            return item;
                                                        });
                                                        onSetInventoryItems(updatedInv);
                                                    }

                                                    toast.success(isKa ? 'აწონვის სადგურის მონაცემები სინქრონიზებულია და შენახულია!' : 'Synced and saved counts from Weigh Station Scale!');
                                                }}
                                                className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-black text-[8px] uppercase tracking-wider shrink-0 cursor-pointer shadow-2xs flex items-center gap-1"
                                            >
                                                <span>⚡</span>
                                                <span>{isKa ? 'სინქრონიზაცია' : 'Sync Scale'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPhysicalBoxes(smartQuantization.fullBoxesPacked);
                                                    setPhysicalHalfBoxes(smartQuantization.halfBoxesPacked);
                                                    toast.success(
                                                        isKa
                                                            ? `${physicalPunets} პუნეტი: ${smartQuantization.fullBoxesPacked} სრული ყუთი + ${smartQuantization.halfBoxesPacked} ნახევარი. (${smartQuantization.surplusBoxes} სურპლუსი)`
                                                            : `Quantized ${physicalPunets} punets into ${smartQuantization.fullBoxesPacked} full + ${smartQuantization.halfBoxesPacked} half.`
                                                    );
                                                }}
                                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-black text-[8px] uppercase tracking-wider transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1"
                                            >
                                                🍓 {isKa ? 'ქვანტიზაცია' : 'Auto-Quantize'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nextMerge = !mergeHalfBoxes;
                                                    setMergeHalfBoxes(nextMerge);
                                                    syncPickersToParent(localPickers, { mergeHalfBoxes: nextMerge });
                                                }}
                                                className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                                                    mergeHalfBoxes 
                                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                                                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                                }`}
                                            >
                                                <span>{mergeHalfBoxes ? '🔗' : '⛓️'}</span>
                                                <span>{mergeHalfBoxes ? (isKa ? 'გაერთიანებული' : 'Merged') : (isKa ? 'ცალ-ცალკე' : 'Half Boxes')}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-1.5 py-0.5">
                                        <div>
                                            <label className="text-[8px] font-black text-slate-500 uppercase block mb-0.5">📦 {isKa ? 'სრული' : 'Full Boxes'}</label>
                                            <input 
                                                type="number" 
                                                value={physicalBoxes}
                                                onChange={e => {
                                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                                    setIsPhysicalBoxesManuallyEdited(true);
                                                    setPhysicalBoxes(val);
                                                    syncPickersToParent(localPickers, { totalBoxes: val });
                                                }}
                                                className="w-full text-xs font-black text-slate-800 p-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-black text-indigo-700 uppercase block mb-0.5">🍱 {isKa ? 'ნახევარი' : 'Half Boxes'}</label>
                                            <input 
                                                type="number" 
                                                value={physicalHalfBoxes}
                                                onChange={e => {
                                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                                    setPhysicalHalfBoxes(val);
                                                    syncPickersToParent(localPickers, { physicalHalfBoxes: val });
                                                }}
                                                className="w-full text-xs font-black text-indigo-900 p-1.5 bg-indigo-50/60 border border-indigo-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-black text-amber-900 uppercase block mb-0.5">🍓 {isKa ? 'პუნეტები' : 'Punets'}</label>
                                            <input 
                                                type="number" 
                                                value={physicalPunets}
                                                onChange={e => {
                                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                                    setIsPunetsManuallyEdited(true);
                                                    setPhysicalPunets(val);
                                                    syncPickersToParent(localPickers, { physicalPunets: val });
                                                }}
                                                className="w-full text-xs font-black text-amber-900 p-1.5 bg-amber-50/60 border border-amber-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-black text-slate-500 uppercase block mb-0.5">🍓/📦 Formula</label>
                                            <input 
                                                type="number" 
                                                value={punetsPerBox}
                                                onChange={e => {
                                                    const val = Math.max(1, parseInt(e.target.value) || 12);
                                                    setPunetsPerBox(val);
                                                    if (!isPunetsManuallyEdited) {
                                                        const pnts = Math.round((physicalBoxes + (physicalHalfBoxes * 0.5)) * val);
                                                        setPhysicalPunets(pnts);
                                                    }
                                                }}
                                                className="w-full text-xs font-black text-slate-700 p-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 items-center justify-between mt-2 pt-2 border-t border-slate-100">
                                        {/* Merge 2 Half Boxes Action Button */}
                                        {physicalHalfBoxes >= 2 ? (
                                            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-1.5 w-full">
                                                <span className="text-[9px] font-black leading-tight">
                                                    💡 {isKa ? '2 ნახევარი (6/6) = 1 სრული (12)' : '2 Half (6/6) = 1 Full (12)'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newFull = physicalBoxes + 1;
                                                        const newHalf = Math.max(0, physicalHalfBoxes - 2);
                                                        setPhysicalBoxes(newFull);
                                                        setPhysicalHalfBoxes(newHalf);
                                                        syncPickersToParent(localPickers, { totalBoxes: newFull, physicalHalfBoxes: newHalf });
                                                        toast.success(isKa ? '2 ნახევარი ყუთი გაერთიანდა 1 სრულ ყუთად!' : 'Merged 2 half boxes into 1 full box!');
                                                    }}
                                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-black text-[8px] uppercase tracking-wider shrink-0 cursor-pointer shadow-2xs"
                                                >
                                                    {isKa ? '🔗 გაერთიანება' : '🔗 Merge to 1 Box'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex-grow"></div>
                                        )}
                                        
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const pnts = Math.round((physicalBoxes + (physicalHalfBoxes * 0.5)) * punetsPerBox);
                                                setPhysicalPunets(pnts);
                                                setIsPunetsManuallyEdited(false);
                                                syncPickersToParent(localPickers, { physicalPunets: pnts, punetsPerBox });
                                                
                                                if (inventoryItems && onSetInventoryItems) {
                                                    const updatedInv = inventoryItems.map(item => {
                                                        if (item.relatedHarvestId === event.id && item.category === 'Produce') {
                                                            return { ...item, physicalBoxes, physicalPunnets: pnts };
                                                        }
                                                        return item;
                                                    });
                                                    onSetInventoryItems(updatedInv);
                                                }
                                                toast.success(isKa ? 'რაოდენობები განახლდა!' : 'Quantities updated successfully!');
                                            }}
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-[10px] uppercase tracking-wider shadow-sm cursor-pointer whitespace-nowrap"
                                        >
                                            {isKa ? 'განახლება' : 'Update Quantities'}
                                        </button>
                                    </div>
                                    {physicalHalfBoxes > 0 && (
                                        <div className="text-[9px] font-extrabold p-1.5 rounded-lg bg-indigo-50/80 border border-indigo-100 text-indigo-900 flex items-center justify-between">
                                            <span>
                                                {mergeHalfBoxes
                                                    ? (isKa 
                                                        ? `🔗 ${physicalHalfBoxes} ნახევარი = +${mergedFullBoxesFromHalf} სრული ყუთი (${unmergedHalfBoxes > 0 ? unmergedHalfBoxes + ' დარჩა' : 'ზუსტად'})`
                                                        : `🔗 ${physicalHalfBoxes} half = +${mergedFullBoxesFromHalf} full boxes (${unmergedHalfBoxes > 0 ? unmergedHalfBoxes + ' rem.' : 'exact'})`)
                                                    : (isKa 
                                                        ? `🍱 ${physicalHalfBoxes} ნახევარი ყუთი (ცალკე = ${(physicalHalfBoxes * 0.5).toFixed(1)} ყუთი)`
                                                        : `🍱 ${physicalHalfBoxes} half boxes (separate = ${(physicalHalfBoxes * 0.5).toFixed(1)} boxes)`)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setMergeHalfBoxes(!mergeHalfBoxes)}
                                                className="underline hover:text-indigo-600 text-[8px] uppercase cursor-pointer"
                                            >
                                                {mergeHalfBoxes ? (isKa ? 'გამოყოფა' : 'Unmerge') : (isKa ? 'გაერთიანება' : 'Merge')}
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-[9px] text-slate-400 font-medium">{t('adv.physical_box_desc')}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Variety Yields and Discrepancy Statistics Table */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-left space-y-3">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-100 pb-2 gap-2">
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>🍇</span> {isKa ? 'ჯიშების დეტალური შედარება და სხვაობა' : 'Variety Yield Details & Variance'}
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setShowVarietyTable(prev => !prev)}
                                    className="px-2 py-0.5 text-[9px] font-extrabold text-slate-500 hover:text-slate-800 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                >
                                    {showVarietyTable ? '👁️ ' + (isKa ? 'დამალვა' : 'Hide') : '👁️‍🗨️ ' + (isKa ? 'გამოჩენა' : 'Show')}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-black text-slate-400 uppercase">{isKa ? 'ჯიშის ფილტრი:' : 'Filter Variety:'}</span>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsVarietyDropdownOpen(!isVarietyDropdownOpen)}
                                        className="text-[10px] font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-550 cursor-pointer flex items-center gap-1.5 min-w-[120px] justify-between text-slate-700 shadow-sm"
                                    >
                                        <span>
                                            {selectedVarietiesFilter.includes('all') 
                                                ? (isKa ? '🍇 ყველა ჯიში' : '🍇 All Varieties') 
                                                : (isKa ? `🍇 ${selectedVarietiesFilter.length} ჯიში` : `🍇 ${selectedVarietiesFilter.length} Selected`)}
                                        </span>
                                        <span className="text-[8px] text-slate-400">▼</span>
                                    </button>
                                    
                                    {isVarietyDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsVarietyDropdownOpen(false)} />
                                            <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs space-y-1 max-h-60 overflow-y-auto">
                                                <label className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedVarietiesFilter.includes('all')}
                                                        onChange={() => {
                                                            if (selectedVarietiesFilter.includes('all')) {
                                                                setSelectedVarietiesFilter([]);
                                                            } else {
                                                                setSelectedVarietiesFilter(['all']);
                                                            }
                                                        }}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-650"
                                                    />
                                                    <span className="font-extrabold text-slate-800">{isKa ? 'ყველა ჯიში' : 'Select All'}</span>
                                                </label>
                                                <div className="border-t border-slate-100 my-1" />
                                                {availableVarieties.map(v => {
                                                    const isChecked = selectedVarietiesFilter.includes(v) || (selectedVarietiesFilter.includes('all'));
                                                    return (
                                                        <label key={v} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {
                                                                    if (selectedVarietiesFilter.includes('all')) {
                                                                        const otherVars = availableVarieties.filter(x => x !== v);
                                                                        setSelectedVarietiesFilter(otherVars);
                                                                    } else {
                                                                        if (selectedVarietiesFilter.includes(v)) {
                                                                            const next = selectedVarietiesFilter.filter(x => x !== v);
                                                                            setSelectedVarietiesFilter(next.length === 0 ? ['all'] : next);
                                                                        } else {
                                                                            const next = [...selectedVarietiesFilter, v];
                                                                            if (next.length === availableVarieties.length) {
                                                                                setSelectedVarietiesFilter(['all']);
                                                                            } else {
                                                                                setSelectedVarietiesFilter(next);
                                                                            }
                                                                        }
                                                                    }
                                                                }}
                                                                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-650"
                                                            />
                                                            <span className="font-bold text-slate-600">🍇 {v}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 rounded px-2 py-0.5 uppercase">
                                    {isKa ? 'ჯამში:' : 'Total:'} {filteredVarietyStats.length} {isKa ? 'ჯიში' : 'Varieties'}
                                </span>
                            </div>
                        </div>

                        {showVarietyTable && (
                            <>
                                <div className="overflow-x-auto">
                            <table className="w-full text-xs font-bold text-slate-700">
                                <thead>
                                    <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                                        <th className="py-2 px-3 text-left">{isKa ? 'ჯიში' : 'Variety'}</th>
                                        <th className="py-2 px-3 text-right">{isKa ? 'ადრეული წონა' : 'Early Net'}</th>
                                        <th className="py-2 px-3 text-right">{isKa ? 'ადრეული ყუთები' : 'Early Boxes'}</th>
                                        <th className="py-2 px-3 text-right">{isKa ? 'გადაწონილი წონა' : 'Reweighed Net'}</th>
                                        <th className="py-2 px-3 text-right">{isKa ? 'გადაწონილი ყუთები' : 'Reweighed Boxes'}</th>
                                        <th className="py-2 px-3 text-right">{isKa ? 'სხვაობა (კგ)' : 'Delta (KG)'}</th>
                                        <th className="py-2 px-3 text-right">{isKa ? 'სხვაობა (ყუთი)' : 'Delta (Boxes)'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredVarietyStats.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-4 text-center text-slate-400 font-medium italic">
                                                {isKa ? 'მონაცემები არ არის' : 'No variety statistics available.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredVarietyStats.map((stat) => {
                                            const isPerfect = Math.abs(stat.netDiff) < 0.1;
                                            const isSelectedRow = selectedVarietyRow === stat.variety;
                                            
                                            const handleToggleRow = () => {
                                                if (isSelectedRow) {
                                                    setSelectedVarietyRow(null);
                                                } else {
                                                    setSelectedVarietyRow(stat.variety);
                                                    setInlineTargetVar('');
                                                    setInlineSplitWeight(stat.earlyNet.toFixed(1));
                                                }
                                            };

                                            return (
                                                <React.Fragment key={stat.variety}>
                                                    <tr className={`hover:bg-indigo-50/25 transition-colors ${isSelectedRow ? 'bg-indigo-50/40' : ''}`}>
                                                        {/* Variety Column - Clickable */}
                                                        <td 
                                                            className="py-2.5 px-3 text-indigo-700 font-bold cursor-pointer hover:bg-indigo-50/30 select-none group"
                                                            onClick={handleToggleRow}
                                                        >
                                                            <span className="flex items-center justify-between gap-1">
                                                                <span className="flex items-center gap-1">🍇 {stat.variety}</span>
                                                                <span className="text-[9px] text-indigo-600 font-black opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                                                                    {isKa ? 'შეცვლა / გაყოფა ✂️' : 'Change / Split ✂️'}
                                                                </span>
                                                            </span>
                                                        </td>

                                                        {/* Early Net Column - Clickable */}
                                                        <td 
                                                            className="py-2.5 px-3 text-right text-slate-600 cursor-pointer hover:bg-indigo-50/30 select-none group"
                                                            onClick={handleToggleRow}
                                                        >
                                                            <div className="flex items-center justify-end gap-1">
                                                                <span>{stat.earlyNet.toFixed(1)} KG</span>
                                                                <span className="text-[8px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                                                            </div>
                                                        </td>

                                                        <td className="py-2 px-3 text-right text-slate-600">{stat.earlyBoxes} Bx</td>
                                                        <td className="py-2 px-3 text-right text-slate-900">{stat.reweighedNet.toFixed(1)} KG</td>
                                                        <td className="py-2 px-3 text-right text-slate-900">{stat.reweighedBoxes} Bx</td>
                                                        <td className={`py-2 px-3 text-right ${isPerfect ? 'text-emerald-600' : 'text-amber-600 font-extrabold'}`}>
                                                            {stat.netDiff > 0 ? `+${stat.netDiff.toFixed(1)}` : stat.netDiff.toFixed(1)} KG
                                                        </td>
                                                        <td className={`py-2 px-3 text-right ${stat.boxDiff === 0 ? 'text-emerald-600' : 'text-amber-600 font-extrabold'}`}>
                                                            {stat.boxDiff > 0 ? `+${stat.boxDiff}` : stat.boxDiff} Bx
                                                        </td>
                                                    </tr>

                                                    {/* Inline Splitting & Reassignment Expander */}
                                                    {isSelectedRow && (
                                                        <tr className="bg-indigo-50/10">
                                                            <td colSpan={7} className="p-4 border-t border-b border-indigo-100">
                                                                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                                                                    <div className="flex-1 text-left space-y-1">
                                                                        <div className="text-[11px] font-black uppercase text-indigo-950 flex items-center gap-1.5">
                                                                            <span>✂️</span> {isKa ? `ჯიშის ${stat.variety} გაყოფა ან შეცვლა` : `Split or Change Variety: ${stat.variety}`}
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-500 font-medium">
                                                                            {isKa 
                                                                                ? 'შეგიძლიათ შეცვალოთ მთლიანი ჯიში ან გაყოთ წონა და გადაიტანოთ სხვა ჯიშზე. სრული წონის გადატანა შეცვლის ყველა შესაბამის ჩანაწერს.' 
                                                                                : 'You can change the entire variety or split a portion of the weight to another variety. Reallocating the full weight will safely update all matching records.'}
                                                                        </p>
                                                                    </div>
                                                                    
                                                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 flex-wrap">
                                                                        {/* Target variety dropdown */}
                                                                        <div className="space-y-1 text-left min-w-[150px]">
                                                                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                {isKa ? 'სამიზნე ჯიში:' : 'Target Variety:'}
                                                                            </label>
                                                                            <select
                                                                                value={inlineTargetVar}
                                                                                onChange={e => setInlineTargetVar(e.target.value)}
                                                                                className="w-full text-xs font-bold p-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700 shadow-sm"
                                                                            >
                                                                                <option value="">{isKa ? '-- აირჩიეთ ჯიში --' : '-- Select Variety --'}</option>
                                                                                {availableVarieties.filter(v => v.toLowerCase() !== stat.variety.toLowerCase()).map(v => (
                                                                                    <option key={v} value={v}>🍇 {v}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>

                                                                        {/* Weight to split input */}
                                                                        <div className="space-y-1 text-left min-w-[120px]">
                                                                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                {isKa ? 'წონა (კგ):' : 'Weight (KG):'}
                                                                            </label>
                                                                            <div className="relative">
                                                                                <input
                                                                                    type="number"
                                                                                    step="any"
                                                                                    value={inlineSplitWeight}
                                                                                    onChange={e => setInlineSplitWeight(e.target.value)}
                                                                                    className="w-full text-xs font-bold p-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-550 pr-12 text-slate-800 shadow-sm"
                                                                                    placeholder={stat.earlyNet.toFixed(1)}
                                                                                />
                                                                                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[9px] text-slate-400 font-black">
                                                                                    KG
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Quick fill buttons */}
                                                                        <div className="flex items-center gap-1 pb-0.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setInlineSplitWeight(stat.earlyNet.toFixed(1))}
                                                                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[9px] font-black uppercase text-slate-600 transition-colors cursor-pointer"
                                                                                title={isKa ? 'ყველა' : 'All'}
                                                                            >
                                                                                {isKa ? 'ყველა' : 'All'}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setInlineSplitWeight((stat.earlyNet * 0.5).toFixed(1))}
                                                                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[9px] font-black uppercase text-slate-600 transition-colors cursor-pointer"
                                                                                title="50%"
                                                                            >
                                                                                50%
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setInlineSplitWeight((stat.earlyNet * 0.25).toFixed(1))}
                                                                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[9px] font-black uppercase text-slate-600 transition-colors cursor-pointer"
                                                                                title="25%"
                                                                            >
                                                                                25%
                                                                            </button>
                                                                        </div>

                                                                        {/* Change Entire Variety Button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (!inlineTargetVar) {
                                                                                    toast.error(isKa ? 'გთხოვთ აირჩიოთ სამიზნე ჯიში' : 'Please select a target variety');
                                                                                    return;
                                                                                }
                                                                                handleSplitYield(stat.variety, inlineTargetVar, stat.earlyNet);
                                                                                setSelectedVarietyRow(null);
                                                                            }}
                                                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                                                                        >
                                                                            <span>🔄</span>
                                                                            <span>{isKa ? 'ჯიშის შეცვლა' : 'Change All'}</span>
                                                                        </button>

                                                                        {/* Split Portion Button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (!inlineTargetVar) {
                                                                                    toast.error(isKa ? 'გთხოვთ აირჩიოთ სამიზნე ჯიში' : 'Please select a target variety');
                                                                                    return;
                                                                                }
                                                                                const wt = parseFloat(inlineSplitWeight);
                                                                                if (isNaN(wt) || wt <= 0) {
                                                                                    toast.error(isKa ? 'გთხოვთ მიუთითოთ ვალიდური წონა' : 'Please enter a valid weight');
                                                                                    return;
                                                                                }
                                                                                handleSplitYield(stat.variety, inlineTargetVar, wt);
                                                                                setSelectedVarietyRow(null);
                                                                            }}
                                                                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                                                                        >
                                                                            <span>✂️</span>
                                                                            <span>{isKa ? 'გაყოფა' : 'Split Portion'}</span>
                                                                        </button>

                                                                        {/* Close Button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setSelectedVarietyRow(null)}
                                                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                                                        >
                                                                            {isKa ? 'დახურვა' : 'Close'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* 💡 Help instruction tip */}
                        <div className="text-[10px] text-slate-400 font-bold bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-1.5">
                            <span>💡</span>
                            <span>
                                {isKa 
                                    ? 'დააწკაპუნეთ ნებისმიერ ჯიშზე ან მის ადრეულ წონაზე, რათა გახსნათ მისი გაყოფისა და გადატანის ინტერაქტიული მენიუ.' 
                                    : 'Click on any variety name or its Early Net weight to instantly open its inline change & split control menu.'}
                            </span>
                        </div>
                            </>
                        )}
                    </div>

                    {/* Return Empty Boxes & Punets Action Bar */}
                    {showReconciliationStatus && (
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs leading-normal">
                            <div className="space-y-1 text-left">
                                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                    <span>⚖️</span>
                                    <span>{t('adv.reconciliation_status')}</span>
                                    {(boxDifference > 0 || punetDifference > 0) ? (
                                        <span className="font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase text-[9px] border border-amber-200">
                                            ⚠️ {boxDifference} {isKa ? 'ყუთი' : 'Boxes'} / {punetDifference} {isKa ? 'პუნეტი ნაშთი' : 'Punets Leftover'}
                                        </span>
                                    ) : (
                                        <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase text-[9px] border border-emerald-200">✅ {t('adv.crates_aligned')}</span>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    {isKa 
                                        ? `ვირტუალური: ${Math.floor(calculatedVirtualBoxes)} ყუთი (${Math.round(calculatedVirtualPunets)} პუნეტი) | ფაქტობრივი: ${physicalBoxes} სრული + ${physicalHalfBoxes} ნახევარი (${totalPhysicalBoxesEffective.toFixed(1)} ჯამური, ${physicalPunets} პუნეტი) [${mergeHalfBoxes ? 'გაერთიანებული' : 'ცალ-ცალკე'}]` 
                                        : `Virtual: ${Math.floor(calculatedVirtualBoxes)} boxes (${Math.round(calculatedVirtualPunets)} punets) | Physical: ${physicalBoxes} full + ${physicalHalfBoxes} half (${totalPhysicalBoxesEffective.toFixed(1)} total, ${physicalPunets} punets) [${mergeHalfBoxes ? 'Merged' : 'Separate'}]`}
                                </p>
                            </div>

                            {(boxDifference > 0 || punetDifference > 0) && onSetInventoryItems && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600 mr-2 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                        <input 
                                            type="checkbox"
                                            checked={leaveReconciliationAsIs}
                                            onChange={e => setLeaveReconciliationAsIs(e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                                        />
                                        <span>{isKa ? 'დატოვე როგორც არის (საწყობში არ დაბრუნდეს)' : 'Leave as it is (no stock return)'}</span>
                                    </label>

                                    {!leaveReconciliationAsIs && (
                                        <>
                                            {boxDifference > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">📦</span>
                                                    <select 
                                                        value={selectedBoxItemId} 
                                                        onChange={e => setSelectedBoxItemId(e.target.value)}
                                                        className="text-xs font-bold p-1 border border-slate-200 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500 max-w-[140px]"
                                                    >
                                                        {packagingItems.map(pi => (
                                                            <option key={pi.id} value={pi.id}>{pi.name} ({pi.currentStock})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            {punetDifference > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] font-black text-amber-700 uppercase">🍓</span>
                                                    <select 
                                                        value={selectedPunetItemId} 
                                                        onChange={e => setSelectedPunetItemId(e.target.value)}
                                                        className="text-xs font-bold p-1 border border-amber-200 bg-amber-50/50 rounded outline-none focus:ring-1 focus:ring-amber-500 max-w-[140px]"
                                                    >
                                                        {punetItems.map(pi => (
                                                            <option key={pi.id} value={pi.id}>{pi.name} ({pi.currentStock})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            <button 
                                onClick={handleCrateReconciliation}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-sm transition-all cursor-pointer whitespace-nowrap"
                            >
                                {leaveReconciliationAsIs 
                                    ? (isKa ? 'დამტკიცება (ცვლილების გარეშე)' : 'Approve As-Is')
                                    : (boxDifference > 0 || punetDifference > 0)
                                        ? (isKa ? `დაბრუნება (${boxDifference} ყუთი / ${punetDifference} პუნეტი) და დამტკიცება` : `Return (${boxDifference} Boxes / ${punetDifference} Punets) & Approve`)
                                        : t('adv.approve_save_alignment')}
                            </button>
                        </div>
                    )}
                </div>
                )}

                {viewMode === 'management' && (
                    <div className="p-4 mx-4 my-2 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs font-bold text-indigo-900 shadow-2xs">
                        <div className="flex items-center gap-2">
                            <span>💡</span>
                            <span>{isKa ? 'მუშაკების ინდივიდუალური უწყისი, კრეფის ლოგები და სახელფასო ტარიფები იმართება "მოსავლის კონტროლი"-ს ჩანართში.' : 'Individual worker yield logs and payroll are managed in the "Yield Control" tab.'}</span>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => onSwitchTab?.('stats')}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg uppercase tracking-wider text-[10px] font-extrabold cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                        >
                            {isKa ? 'გადასვლა მოსავლის კონტროლზე →' : 'Go to Yield Control →'}
                        </button>
                    </div>
                )}

                {viewMode === 'statistics' && (
                    <div className="p-4 sm:p-6 space-y-6">
                        {/* Top Header Banner with Multi-dimensional Filters */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl text-lg">📊</span>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight">
                                            {isKa ? 'სტატისტიკის და აუდიტის ჰაბი' : 'Statistics & Audit Hub'}
                                        </h3>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase">
                                            {isKa ? `აქტიური ღონისძიება: ${event.name}` : `Active Event: ${event.name}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => setIsPrintModalOpen(true)}
                                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                                    >
                                        🖨️ {isKa ? 'ექსპორტი / PDF' : 'Export PDF/Excel'}
                                    </button>
                                </div>
                            </div>

                            {/* Filters Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-700">
                                <div className="flex flex-wrap items-center gap-3">
                                    {/* Role Filter */}
                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] uppercase font-black text-slate-400">Role:</span>
                                        <select 
                                            value={statRoleFilter} 
                                            onChange={e => setStatRoleFilter(e.target.value as any)}
                                            className="bg-transparent font-extrabold outline-none cursor-pointer"
                                        >
                                            <option value="all">All Roles</option>
                                            <option value="picker">Pickers</option>
                                            <option value="loader">Loaders</option>
                                            <option value="foreman">Foremen</option>
                                            <option value="driver">Drivers</option>
                                        </select>
                                    </div>

                                    {/* Salary Type Filter */}
                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] uppercase font-black text-slate-400">Salary:</span>
                                        <select 
                                            value={statSalaryFilter} 
                                            onChange={e => setStatSalaryFilter(e.target.value as any)}
                                            className="bg-transparent font-extrabold outline-none cursor-pointer"
                                        >
                                            <option value="all">Combined / All</option>
                                            <option value="daily">Flat Daily Rate</option>
                                            <option value="per_weight">Per Weight (Net)</option>
                                        </select>
                                    </div>

                                    {/* Group/Selection Filter */}
                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] uppercase font-black text-slate-400">Selection:</span>
                                        <select 
                                            value={statSelectionFilter} 
                                            onChange={e => setStatSelectionFilter(e.target.value as any)}
                                            className="bg-transparent font-extrabold outline-none cursor-pointer"
                                        >
                                            <option value="all">All Harvesters ({localPickers.length})</option>
                                            <option value="marked">Marked / Selected ({selectedPickers.size})</option>
                                        </select>
                                    </div>

                                    {/* Tare Weight Stripping Toggle */}
                                    <label className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl cursor-pointer select-none">
                                        <input 
                                            type="checkbox"
                                            checked={statTareStripped}
                                            onChange={e => setStatTareStripped(e.target.checked)}
                                            className="rounded text-amber-600 accent-amber-600 h-4 w-4"
                                        />
                                        <span className="text-xs font-black uppercase tracking-wider">Strip Tare Weight</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Automated Ratio Alert Banner */}
                        {minibusOvercrowdingRatio > 10.0 && (
                            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between text-xs font-black text-amber-900 shadow-2xs animate-fadeIn">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">⚠️</span>
                                    <span>
                                        {isKa 
                                            ? `ტრანსპორტის გადატვირთვის გაფრთხილება: საშუალოდ ${minibusOvercrowdingRatio.toFixed(1)} მუშა მოდის 1 ავტომობილზე. (რეკომენდებული: 1 ავტომობილი 9-10 კაცზე, საჭიროა კიდევ +${recommendedExtraVehicles} ტრანსპორტი)`
                                            : `Logistics Overcrowding Warning: ${minibusOvercrowdingRatio.toFixed(1)} people/vehicle. (Recommended target: 1 minibus per 9-10 people. Suggested deficit: +${recommendedExtraVehicles} vehicles)`
                                        }
                                    </span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => onSwitchTab?.('logistics')}
                                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg uppercase tracking-wider text-[10px] font-extrabold cursor-pointer transition-all whitespace-nowrap"
                                >
                                    {isKa ? 'ლოგისტიკის მართვა →' : 'Manage Fleet →'}
                                </button>
                            </div>
                        )}

                        {/* Logistics Ratio Matrix Card Grid */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <span>📐</span>
                                <span>{isKa ? 'ლოგისტიკის და პერსონალის შეფარდების კალკულატორი' : 'Logistics & Personnel Ratio Calculator Matrix'}</span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* 1. Attendance & Headcount */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs font-black text-slate-800">
                                        <span>👥 Attendance & Headcount</span>
                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-black">{arrivedPickersCount} Arrived</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600 font-bold">
                                        <div className="flex justify-between"><span>Expected Headcount:</span> <span className="font-black">{expectedHeadcountVal}</span></div>
                                        <div className="flex justify-between"><span>Actual Arrived:</span> <span className="font-black text-emerald-600">{arrivedPickersCount}</span></div>
                                        <div className="flex justify-between"><span>Missing / Absent:</span> <span className="font-black text-rose-600">{missingHeadcountVal}</span></div>
                                        <div className="flex justify-between pt-1 border-t border-slate-200"><span>Total Active Remaining:</span> <span className="font-black text-indigo-700">{arrivedPickersCount}</span></div>
                                    </div>
                                </div>

                                {/* 2. Passenger Vehicles Ratio */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs font-black text-slate-800">
                                        <span>🚐 Passenger Vehicles</span>
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${minibusOvercrowdingRatio > 10 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                            {minibusOvercrowdingRatio > 10 ? 'Overcrowded ⚠️' : 'Optimal Ratio ✅'}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600 font-bold">
                                        <div className="flex justify-between"><span>Total Minibuses / Cars:</span> <span className="font-black">{logisticsVehicleCount}</span></div>
                                        <div className="flex justify-between"><span>People-to-Vehicle Ratio:</span> <span className="font-black text-indigo-700">{minibusOvercrowdingRatio.toFixed(1)} / car</span></div>
                                        <div className="flex justify-between"><span>Target Guardrail:</span> <span className="font-black">1 car / 9-10 people</span></div>
                                        <div className="flex justify-between pt-1 border-t border-slate-200"><span>Status / Deficit:</span> <span className="font-black text-amber-700">{recommendedExtraVehicles > 0 ? `+${recommendedExtraVehicles} vehicles needed` : 'Balanced'}</span></div>
                                    </div>
                                </div>

                                {/* 3. Carriers / Loaders Ratio */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs font-black text-slate-800">
                                        <span>📦 Carriers & Loaders Ratio</span>
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-black">Balanced ✅</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600 font-bold">
                                        <div className="flex justify-between"><span>Total Carriers / Loaders:</span> <span className="font-black">{loadersCountVal}</span></div>
                                        <div className="flex justify-between"><span>Pickers-to-Carrier Ratio:</span> <span className="font-black text-indigo-700">{loaderRatioVal.toFixed(1)} pickers/loader</span></div>
                                        <div className="flex justify-between"><span>Target Guardrail:</span> <span className="font-black">1 carrier / 7-8 pickers</span></div>
                                        <div className="flex justify-between pt-1 border-t border-slate-200"><span>Staffing Balance:</span> <span className="font-black text-emerald-700">Optimal Serving Rate</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Foreman Brigade Comparison Mode */}
                        {brigadeComparisonData.length > 0 && (
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <span>⚔️</span>
                                        <span>{isKa ? 'ბრიგადების შედარებითი ანალიზი (Foreman Brigades)' : 'Foreman Brigade Side-by-Side Comparison'}</span>
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{brigadeComparisonData.length} Brigades Active</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {brigadeComparisonData.map((brigade, idx) => (
                                        <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 relative overflow-hidden">
                                            <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                                                <div>
                                                    <h5 className="font-black text-slate-900 text-sm uppercase">{brigade.foremanName}</h5>
                                                    <p className="text-[10px] text-slate-500 font-extrabold">{brigade.workerCount} Workers Assigned</p>
                                                </div>
                                                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-lg uppercase">
                                                    {formatCurrency(brigade.costPerKg)} / KG
                                                </span>
                                            </div>
                                            <div className="space-y-1.5 text-xs text-slate-700 font-bold">
                                                <div className="flex justify-between"><span>Total Yield:</span> <span className="font-black text-emerald-600">{brigade.totalNetKg.toFixed(1)} KG</span></div>
                                                <div className="flex justify-between"><span>Total Boxes:</span> <span className="font-black text-slate-800">{brigade.totalBoxes}</span></div>
                                                <div className="flex justify-between"><span>Total Payroll Payout:</span> <span className="font-black text-indigo-900">{formatCurrency(brigade.totalPayout)}</span></div>
                                                {brigade.topHarvester && (
                                                    <div className="pt-2 border-t border-slate-200 flex justify-between text-[11px]">
                                                        <span className="text-slate-500">🏆 Top Harvester:</span>
                                                        <span className="font-black text-amber-600">{brigade.topHarvester}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Real-Time Audit Log & Audit Rollback Engine */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>📜</span>
                                    <span>{isKa ? 'აუდიტის ისტორიის ლოგი (Audit Trail & Undo Engine)' : 'Real-Time Audit Trail Log & Rollback Engine'}</span>
                                </h4>
                                <span className="text-[10px] font-extrabold text-emerald-600 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>Synchronized Across Windows</span>
                                </span>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                                {auditLogs.map((log) => (
                                    <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">🕒 {log.timestamp}</span>
                                            <span className="font-black text-indigo-900">{log.actorName}</span>
                                            <span className="text-slate-600 font-medium">{log.description}</span>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => handleRollbackAudit(log.id)}
                                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all active:scale-95"
                                        >
                                            ↩️ {isKa ? 'გაუქმება (Undo)' : 'Undo Adjustment'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {(viewMode === 'payroll' || viewMode === 'all') && (
                <>
                {selectedPickers.size > 0 && (
                    <div className="bg-indigo-50/90 border-y border-indigo-200 p-3 px-6 flex flex-wrap items-center justify-between gap-3 animate-fadeIn shadow-xs">
                        <div className="flex items-center gap-2 text-xs font-black text-indigo-950">
                            <span>👥</span>
                            <span>{isKa ? `არჩეულია ${selectedPickers.size} მუშა` : `${selectedPickers.size} workers selected`}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-indigo-100 shadow-2xs">
                                <span className="text-[10px] font-black text-slate-400 uppercase px-1">{t('emp.salary_type') || 'Salary Type'}:</span>
                                <select 
                                    id="bulk-payment-model"
                                    className="text-xs font-bold p-1 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                                    defaultValue="per_weight"
                                >
                                    <option value="per_weight">{isKa ? 'კგ ტარიფი' : 'Per Weight'}</option>
                                    <option value="hourly">{isKa ? 'საათობრივი' : 'Hourly'}</option>
                                    <option value="daily">{isKa ? 'დღიური' : 'Daily'}</option>
                                    <option value="combined">{isKa ? 'კომბინირებული' : 'Combined'}</option>
                                    <option value="salary">{isKa ? 'ხელფასი' : 'Salary'}</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-indigo-100 shadow-2xs">
                                <span className="text-[10px] font-black text-slate-400 uppercase px-1">{t('adv.col_rate') || 'Rate'}:</span>
                                <input 
                                    id="bulk-rate-input"
                                    type="number" 
                                    step="0.01" 
                                    placeholder="e.g. 6.20" 
                                    className="w-20 text-xs font-bold p-1 border border-slate-200 rounded-md bg-white animate-none outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-indigo-100 shadow-2xs">
                                <span className="text-[10px] font-black text-slate-400 uppercase px-1">{isKa ? 'როლი' : 'Role'}:</span>
                                <select 
                                    id="bulk-role-select"
                                    className="text-xs font-bold p-1 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                                    defaultValue="Picker"
                                >
                                    {['Picker', 'Loader', 'Weigher', 'Keeper', 'Driver', 'Supervisor', 'Field Worker', ...(roles || []).map(r => r.name)]
                                        .filter((v, i, a) => v && a.indexOf(v) === i)
                                        .map(rName => (
                                            <option key={rName} value={rName}>{rName}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <button 
                                onClick={() => {
                                    const modelEl = document.getElementById('bulk-payment-model') as HTMLSelectElement;
                                    const rateEl = document.getElementById('bulk-rate-input') as HTMLInputElement;
                                    const roleEl = document.getElementById('bulk-role-select') as HTMLSelectElement;
                                    const newModel = modelEl?.value as PaymentModel;
                                    const newRate = parseFloat(rateEl?.value);
                                    const newRole = roleEl?.value;
                                    
                                    const updated = localPickers.map(p => {
                                        if (selectedPickers.has(p.employeeId)) {
                                            const targetModel = newModel || p.paymentModel;
                                            const isComb = targetModel === 'combined';
                                            return {
                                                ...p,
                                                paymentModel: targetModel,
                                                isDailyContract: isComb,
                                                combinedSubModel: isComb ? (p.combinedSubModel || 'daily / per weight') : p.combinedSubModel,
                                                rate: isNaN(newRate) ? p.rate : newRate,
                                                assignedRole: newRole || p.assignedRole
                                            };
                                        }
                                        return p;
                                    });
                                    setLocalPickers(updated);
                                    syncPickersToParent(updated);
                                    if (rateEl) rateEl.value = '';
                                    toast.success(isKa ? `განახლდა ${selectedPickers.size} მუშა!` : `Updated ${selectedPickers.size} workers!`);
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                            >
                                {isKa ? 'განახლება' : 'Apply Bulk Change'}
                            </button>

                            {/* Quick Bulk Action Buttons */}
                            <div className="flex items-center gap-1 border-l border-indigo-200/80 pl-2">
                                <button
                                    onClick={() => {
                                        const updated = localPickers.map(p => {
                                            if (selectedPickers.has(p.employeeId)) {
                                                return {
                                                    ...p,
                                                    paymentModel: 'combined' as PaymentModel,
                                                    isDailyContract: true,
                                                    combinedSubModel: p.combinedSubModel || 'daily / per weight'
                                                };
                                            }
                                            return p;
                                        });
                                        setLocalPickers(updated);
                                        syncPickersToParent(updated);
                                        toast.success(isKa ? `არჩეული ${selectedPickers.size} მუშა გადავიდა კომბინირებულ რეჟიმზე` : `Set ${selectedPickers.size} workers to Combined Mode`);
                                    }}
                                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-extrabold shadow-xs transition-all cursor-pointer active:scale-95"
                                    title={isKa ? 'მონიშნული მუშების გადაყვანა კომბინირებულ რეჟიმზე' : 'Switch selected workers to Combined Mode'}
                                >
                                    ⚡ {isKa ? 'კომბინირებული' : 'Set Combined'}
                                </button>

                                <button
                                    onClick={() => {
                                        const updated = localPickers.map(p => {
                                            if (selectedPickers.has(p.employeeId)) {
                                                return {
                                                    ...p,
                                                    paymentModel: 'daily' as PaymentModel,
                                                    isDailyContract: false
                                                };
                                            }
                                            return p;
                                        });
                                        setLocalPickers(updated);
                                        syncPickersToParent(updated);
                                        toast.success(isKa ? `არჩეული ${selectedPickers.size} მუშა გადავიდა დღიურ რეჟიმზე` : `Set ${selectedPickers.size} workers to Daily Mode`);
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold shadow-xs transition-all cursor-pointer active:scale-95"
                                >
                                    📅 {isKa ? 'დღიური' : 'Set Daily'}
                                </button>

                                <button
                                    onClick={() => {
                                        const updated = localPickers.map(p => {
                                            if (selectedPickers.has(p.employeeId)) {
                                                return {
                                                    ...p,
                                                    paymentModel: 'per_weight' as PaymentModel,
                                                    isDailyContract: false
                                                };
                                            }
                                            return p;
                                        });
                                        setLocalPickers(updated);
                                        syncPickersToParent(updated);
                                        toast.success(isKa ? `არჩეული ${selectedPickers.size} მუშა გადავიდა კგ ტარიფზე` : `Set ${selectedPickers.size} workers to Per-Weight Mode`);
                                    }}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold shadow-xs transition-all cursor-pointer active:scale-95"
                                >
                                    ⚖️ {isKa ? 'კგ ტარიფი' : 'Set Per Weight'}
                                </button>

                                <button
                                    onClick={() => {
                                        selectedPickers.forEach(empId => handleRestoreWorkerDefault(empId));
                                    }}
                                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-extrabold shadow-xs transition-all cursor-pointer active:scale-95"
                                    title={isKa ? 'მონიშნული მუშების აღდგენა HR სტანდარტულ ტარიფზე/ტიპზე' : 'Restore standard defaults for selected workers'}
                                >
                                    🔄 {isKa ? 'აღდგენა' : 'Restore Default'}
                                </button>
                            </div>

                            <button 
                                onClick={() => {
                                    const doubleCheck = window.confirm(
                                        isKa
                                            ? `დარწმუნებული ხართ, რომ გსურთ მონიშნული ${selectedPickers.size} მუშის წაშლა ამ კრეფის ღონისძიებიდან?`
                                            : `Are you sure you want to remove the selected ${selectedPickers.size} workers from this harvest event?`
                                    );
                                    if (!doubleCheck) return;
                                    const updated = localPickers.filter(p => !selectedPickers.has(p.employeeId));
                                    setLocalPickers(updated);
                                    syncPickersToParent(updated);
                                    setSelectedPickers(new Set());
                                    toast.success(
                                        isKa 
                                            ? 'არჩეული მუშები წაიშალა სიიდან.'
                                            : 'Selected workers removed.'
                                    );
                                }}
                                className="px-3 py-1.5 bg-rose-650 hover:bg-rose-600 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                            >
                                {isKa ? 'წაშლა' : 'Remove'}
                            </button>

                            <button
                                onClick={() => setSelectedPickers(new Set())}
                                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                title={isKa ? 'მონიშვნის გაუქმება' : 'Deselect All'}
                            >
                                ✖️
                            </button>

                            <div className="flex items-center gap-2 border-l border-indigo-200/50 pl-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase">{isKa ? 'გუნდის შექმნა' : 'Create Team'}:</span>
                                <input 
                                    type="text" 
                                    placeholder={isKa ? 'გუნდის სახელი...' : 'Team name...'} 
                                    value={newTeamName}
                                    onChange={e => setNewTeamName(e.target.value)}
                                    className="text-xs font-bold p-1.5 border border-slate-200 rounded-lg bg-white"
                                />
                                <button 
                                    onClick={() => {
                                        const nameVal = newTeamName.trim();
                                        if (!nameVal) {
                                            toast.error(isKa ? 'გთხოვთ შეიყვანოთ სახელი' : 'Please enter a team name');
                                            return;
                                        }
                                        if (onSetEmployeeGroups) {
                                            const newGroup: EmployeeGroup = {
                                                id: `group-${Date.now()}`,
                                                organizationId: event?.organizationId || '',
                                                name: nameVal,
                                                employeeIds: Array.from(selectedPickers)
                                            };
                                            onSetEmployeeGroups([...(employeeGroups || []), newGroup]);
                                            toast.success(isKa ? `გუნდი "${nameVal}" წარმატებით შეიქმნა!` : `Team "${nameVal}" created successfully!`);
                                            setNewTeamName('');
                                            setSelectedPickers(new Set());
                                        } else {
                                            toast.error('Unable to create team - missing handler');
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1"
                                >
                                    <span>➕</span> {isKa ? 'შექმნა' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Excel-style Column Management Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 bg-slate-100/90 border-b border-slate-200 text-xs flex-shrink-0">
                    <div className="flex items-center gap-2 text-slate-700 font-extrabold text-[11px] sm:text-xs">
                        <span>↔️</span>
                        <span>{isKa ? 'სვეტების მართვა (Column Widths):' : 'Column Widths:'}</span>
                        <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                            ({isKa ? 'გადაათრიეთ ხაზები სვეტის საზღვარზე သან გამოიყენეთ ღილაკები' : 'Drag header borders or use presets'})
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={expandAllColumns}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-700 font-extrabold border border-indigo-200 rounded-lg text-[10px] sm:text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                            title="Expand all columns for maximum room"
                        >
                            <span>↔️</span> {isKa ? 'გაფართოება (Expand All)' : 'Expand All'}
                        </button>
                        <button
                            type="button"
                            onClick={autoFitValues}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-[10px] sm:text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                            title="Auto-fit Rate, Net, Gross & Earnings"
                        >
                            <span>⚡</span> {isKa ? 'ციფრების გამოჩენა (Auto-Fit)' : 'Auto-Fit Digits'}
                        </button>
                        <button
                            type="button"
                            onClick={resetColumnWidths}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 font-extrabold border border-slate-200 rounded-lg text-[10px] sm:text-xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                        >
                            <span>🔄</span> {isKa ? 'საწყისი (Reset)' : 'Reset'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 relative custom-scrollbar border border-slate-200 rounded-xl bg-white touch-pan-x">
                    <table 
                        className="border-collapse text-left" 
                        style={{ minWidth: `${Object.values(colWidths).reduce((a, b) => a + b, 0)}px`, width: '100%' }}
                    >
                        <colgroup>
                            <col style={{ width: `${colWidths.select}px` }} />
                            <col style={{ width: `${colWidths.worker}px` }} />
                            <col style={{ width: `${colWidths.role}px` }} />
                            <col style={{ width: `${colWidths.context}px` }} />
                            <col style={{ width: `${colWidths.rate}px` }} />
                            <col style={{ width: `${colWidths.days}px` }} />
                            <col style={{ width: `${colWidths.hours}px` }} />
                            <col style={{ width: `${colWidths.boxes}px` }} />
                            <col style={{ width: `${colWidths.gross}px` }} />
                            <col style={{ width: `${colWidths.net}px` }} />
                            <col style={{ width: `${colWidths.bonus}px` }} />
                            <col style={{ width: `${colWidths.final}px` }} />
                        </colgroup>
                        <thead className="bg-slate-100 sticky top-0 z-10 shadow-2xs">
                            <tr className="text-left text-[10px] text-slate-500 uppercase font-black tracking-widest border-b border-slate-200 select-none">
                                <th style={{ width: `${colWidths.select}px` }} className="px-3 py-3 relative">
                                    <input 
                                        type="checkbox" 
                                        checked={filteredPickers.length > 0 && selectedPickers.size === filteredPickers.length} 
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedPickers(new Set(filteredPickers.map(p => p.employeeId)));
                                            } else {
                                                setSelectedPickers(new Set());
                                            }
                                        }} 
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer" 
                                    />
                                    <div
                                        onMouseDown={(e) => handleResizeStart('select', e.clientX)}
                                        onTouchStart={(e) => e.touches.length > 0 && handleResizeStart('select', e.touches[0].clientX)}
                                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-20 flex items-center justify-center group touch-none"
                                    >
                                        <div className="w-0.5 h-full bg-slate-300 group-hover:bg-indigo-500" />
                                    </div>
                                </th>
                                {renderResizableTh('worker', t('adv.col_worker'))}
                                {renderResizableTh('role', isKa ? 'როლი' : 'Role', 'center')}
                                {renderResizableTh('context', t('adv.col_context'), 'center')}
                                {renderResizableTh('rate', t('adv.col_rate'), 'center')}
                                {renderResizableTh('days', t('adv.col_days'), 'center')}
                                {renderResizableTh('hours', t('adv.col_hours'), 'center')}
                                {renderResizableTh('boxes', t('adv.col_boxes'), 'center')}
                                {renderResizableTh('gross', t('adv.col_gross'), 'center')}
                                {renderResizableTh('net', t('adv.col_net'), 'center')}
                                {renderResizableTh('bonus', t('adv.col_bonus'), 'center')}
                                {renderResizableTh('final', t('adv.col_final'), 'right')}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filteredPickers.map((picker, pIdx) => {
                                const employee = pickerDataMap.empMap.get(picker.employeeId);
                                const stats = pickerDataMap.entriesByWorker.get(picker.employeeId);
                                
                                const scannedWeight = stats?.scannedWeight || 0;
                                const scannedGross = stats?.scannedGross || 0;
                                const finalWeight = picker.manualNetWeight ?? scannedWeight;
                                
                                const scannedBoxes = stats?.scannedBoxes || 0;
                                const finalBoxes = picker.manualBoxes ?? scannedBoxes;
                                
                                const finalGross = (picker.manualNetWeight !== undefined || picker.manualBoxes !== undefined)
                                    ? finalWeight + (finalBoxes * eventTareWeightAverage)
                                    : scannedGross;
                                
                                const sessionHours = durationHours;
                                const finalHours = picker.manualHours ?? sessionHours;
                                
                                const earnings = calculatePickerEarnings(picker, finalWeight, finalHours);
                                const isRateOverridden = picker.rate !== (employee?.paymentRate ?? 0);
                                const isCombinedMode = picker.paymentModel === 'combined';
                                
                                return (
                                    <tr key={`${picker.employeeId || 'picker'}-${pIdx}`} className={`hover:bg-slate-50/80 transition-colors ${!employee ? 'bg-amber-50/40' : ''}`}>
                                        <td style={{ width: `${colWidths.select}px` }} className="px-3 py-2 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedPickers.has(picker.employeeId)} 
                                                onChange={() => {
                                                    const copy = new Set(selectedPickers);
                                                    if (copy.has(picker.employeeId)) {
                                                        copy.delete(picker.employeeId);
                                                    } else {
                                                        copy.add(picker.employeeId);
                                                    }
                                                    setSelectedPickers(copy);
                                                }} 
                                                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer" 
                                            />
                                        </td>
                                        <td style={{ width: `${colWidths.worker}px` }} className="px-2.5 sm:px-3 py-2 overflow-hidden">
                                            {employee ? (
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-800 truncate text-xs sm:text-sm" title={employee.name}>{employee.name}</div>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                                                        {isCombinedMode
                                                            ? (isKa ? `კომბინირებული (${picker.combinedSubModel || 'დღიური / წონით'})` : `COMBINED (${picker.combinedSubModel || 'daily / per weight'})`)
                                                            : getPaymentModelLabel(picker.paymentModel)
                                                        }
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-1 min-w-0">
                                                    <div className="font-extrabold text-amber-600 flex items-center gap-1.5 text-xs truncate">
                                                        <span className="animate-pulse">⚠️</span> {isKa ? 'ამოუცნობი მუშა' : 'Unrecognized'}
                                                    </div>
                                                    <select
                                                        value=""
                                                        onChange={(e) => {
                                                            const targetEmpId = e.target.value;
                                                            if (targetEmpId) {
                                                                handleMergeWorker(picker.employeeId, targetEmpId);
                                                            }
                                                        }}
                                                        className="w-full px-1.5 py-1 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    >
                                                        <option value="">🔗 {isKa ? 'კავშირი HR...' : 'Link to HR...'}</option>
                                                        {employees.map(emp => (
                                                            <option key={emp.id} value={emp.id}>
                                                                👤 {emp.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ width: `${colWidths.role}px` }} className="px-2 py-2 overflow-hidden text-center">
                                            <select
                                                value={picker.assignedRole || (employee?.roleId ? (roles?.find(r => r.id === employee.roleId)?.name || employee.roleId) : 'Picker')}
                                                onChange={(e) => handlePickerChange(picker.employeeId, 'assignedRole', e.target.value)}
                                                className="w-full text-xs font-bold py-1 px-1.5 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer truncate"
                                                title={isKa ? 'როლის შეცვლა' : 'Change Worker Role'}
                                            >
                                                {availableRoleNames.map(rName => (
                                                    <option key={rName} value={rName}>{rName}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ width: `${colWidths.context}px` }} className="px-2 py-2 text-center">
                                            <div className="flex flex-col gap-1 items-center justify-center">
                                                <select
                                                    value={picker.paymentModel || 'per_weight'}
                                                    onChange={(e) => handlePickerChange(picker.employeeId, 'paymentModel', e.target.value)}
                                                    className="text-[10px] font-extrabold bg-white border border-slate-200 text-slate-800 rounded px-1.5 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                                                    title={isKa ? 'გადახდის მოდელის არჩევა' : 'Select Payment Model'}
                                                >
                                                    <option value="per_weight">⚖️ {isKa ? 'კგ ტარიფი' : 'Per Weight'}</option>
                                                    <option value="daily">📅 {isKa ? 'დღიური' : 'Daily'}</option>
                                                    <option value="hourly">⏱️ {isKa ? 'საათობრივი' : 'Hourly'}</option>
                                                    <option value="combined">⚡ {isKa ? 'კომბინირებული' : 'Combined'}</option>
                                                    <option value="salary">💼 {isKa ? 'ხელფასი' : 'Salary'}</option>
                                                    <option value="RESTORE">🔄 {isKa ? 'სტანდარტზე დაბრუნება' : 'Restore Default'}</option>
                                                </select>

                                                <div className="flex items-center gap-1.5 justify-center">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handlePickerChange(picker.employeeId, 'isDailyContract', !isCombinedMode)}
                                                        className={`w-8 h-4 rounded-full transition-all relative cursor-pointer ${isCombinedMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                                        title={isKa ? 'კომბინირებული გადახდის ჩართვა/გამორთვა' : 'Toggle Combined Payment Mode'}
                                                    >
                                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isCombinedMode ? 'left-4.5' : 'left-0.5'}`} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestoreWorkerDefault(picker.employeeId)}
                                                        className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                                        title={isKa ? 'სტანდარტულ ტარიფზე/რეჟიმზე დაბრუნება' : 'Restore Standard Mode & Rates'}
                                                    >
                                                        🔄
                                                    </button>
                                                </div>

                                                {isCombinedMode && (
                                                    <select
                                                        value={picker.combinedSubModel || 'daily / per weight'}
                                                        onChange={(e) => handlePickerChange(picker.employeeId, 'combinedSubModel', e.target.value)}
                                                        className="text-[9px] font-extrabold bg-indigo-50 border border-indigo-200 text-indigo-800 rounded px-1 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                                                        title={isKa ? 'აირჩიეთ კომბინაციის ტიპი' : 'Select combination subtype'}
                                                    >
                                                        <option value="daily / per weight">{isKa ? 'დღიური / წონით' : 'daily / per weight'}</option>
                                                        <option value="hourly / per weight">{isKa ? 'საათობრივი / წონით' : 'hourly / per weight'}</option>
                                                        <option value="daily / hourly">{isKa ? 'დღიური / საათობრივი' : 'daily / hourly'}</option>
                                                        <option value="fixed_shift">{isKa ? 'ფიქსირებული ცვლა' : 'fixed shift'}</option>
                                                    </select>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ width: `${colWidths.rate}px` }} className="px-2 sm:px-3 py-2 overflow-hidden">
                                            <div className="flex flex-col items-center justify-center gap-1 w-full min-w-0">
                                                <div className="relative flex items-center gap-1 justify-center w-full min-w-0">
                                                    {isRateOverridden && <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full" title="Rate differs from default"></div>}
                                                    <div className="flex items-center gap-1 min-w-0 flex-1">
                                                        <span className="text-slate-400 font-bold text-xs shrink-0">{currency === 'USD' ? '$' : '₾'}</span>
                                                        <input 
                                                            type="number"
                                                            step="0.01"
                                                            inputMode="decimal"
                                                            value={picker.rate}
                                                            onChange={e => handlePickerChange(picker.employeeId, 'rate', e.target.value)}
                                                            className="bg-slate-100 focus:bg-white text-slate-900 font-extrabold rounded-lg w-full text-center py-1 px-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none border border-transparent focus:border-indigo-300 transition-all shadow-2xs"
                                                            title={`Per-KG or Base Rate: ${picker.rate}`}
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleDeletePicker(picker.employeeId)}
                                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 active:scale-95"
                                                        title={isKa ? 'მუშის წაშლა' : 'Remove Worker'}
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                {isCombinedMode && (
                                                    <div className="flex items-center gap-1 text-[9px] font-extrabold text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-200/80 w-full justify-center shadow-2xs">
                                                        <span className="text-slate-400 font-bold">Base:</span>
                                                        <input 
                                                            type="number" 
                                                            step="1" 
                                                            value={picker.combinedBaseRate ?? (picker.rate > 10 ? picker.rate : 50)} 
                                                            onChange={e => handlePickerChange(picker.employeeId, 'combinedBaseRate', parseFloat(e.target.value) || 0)}
                                                            className="w-10 bg-white border border-indigo-200 text-center rounded text-[9px] font-black text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                            title={isKa ? 'დღიური ბაზური განაკვეთი (მაგ: 50₾/დღე -> 0.5 დღე = 25₾)' : 'Base Daily Rate (e.g. 50 GEL/day -> 0.5 day = 25 GEL)'}
                                                        />
                                                        <span>{currency === 'USD' ? '$' : '₾'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ width: `${colWidths.days}px` }} className="px-2 sm:px-3 py-2 overflow-hidden">
                                            {(picker.paymentModel === 'daily' || isCombinedMode) ? (
                                                <InputCell 
                                                    value={picker.manualDays} 
                                                    placeholder={isCombinedMode ? "0.5" : "1"} 
                                                    onChange={v => handlePickerChange(picker.employeeId, 'manualDays', v)} 
                                                    isOverridden={picker.manualDays !== undefined} 
                                                />
                                            ) : (
                                                <div className="text-slate-300 text-center font-bold">-</div>
                                            )}
                                        </td>
                                        <td style={{ width: `${colWidths.hours}px` }} className="px-2 sm:px-3 py-2 overflow-hidden">
                                            <InputCell value={picker.manualHours} placeholder={sessionHours.toFixed(2)} onChange={v => handlePickerChange(picker.employeeId, 'manualHours', v)} isOverridden={picker.manualHours !== undefined} />
                                        </td>
                                        <td style={{ width: `${colWidths.boxes}px` }} className="px-2 sm:px-3 py-2 overflow-hidden">
                                            <InputCell value={picker.manualBoxes} placeholder={String(scannedBoxes)} onChange={v => handlePickerChange(picker.employeeId, 'manualBoxes', v)} isOverridden={picker.manualBoxes !== undefined} />
                                        </td>
                                        <td style={{ width: `${colWidths.gross}px` }} className="px-2 sm:px-3 py-2 overflow-hidden">
                                            <InputCell 
                                                value={picker.manualNetWeight !== undefined || picker.manualBoxes !== undefined ? parseFloat(finalGross.toFixed(2)) : undefined}
                                                placeholder={scannedGross.toFixed(2)}
                                                onChange={v => {
                                                    const parsed = parseFloat(v);
                                                    if (isNaN(parsed) || v.trim() === '') {
                                                        handlePickerChange(picker.employeeId, 'manualNetWeight', ''); 
                                                    } else {
                                                        const net = Math.max(0, parsed - (finalBoxes * eventTareWeightAverage));
                                                        handlePickerChange(picker.employeeId, 'manualNetWeight', net.toFixed(2));
                                                    }
                                                }}
                                                isOverridden={picker.manualNetWeight !== undefined || picker.manualBoxes !== undefined}
                                            />
                                        </td>
                                        <td style={{ width: `${colWidths.net}px` }} className="px-2 sm:px-3 py-2 overflow-hidden">
                                            <div className="flex flex-col gap-1">
                                                <InputCell value={picker.manualNetWeight} placeholder={scannedWeight.toFixed(2)} onChange={v => handlePickerChange(picker.employeeId, 'manualNetWeight', v)} isOverridden={picker.manualNetWeight !== undefined} />
                                                {isCombinedMode && (
                                                    <div className="flex flex-col gap-0.5 text-[8px] bg-indigo-50/90 p-1 rounded border border-indigo-200 shadow-2xs">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="font-bold text-slate-500">{isKa ? 'დღიური კგ:' : 'Daily KG:'}</span>
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                placeholder="20"
                                                                value={picker.combinedDailyKg ?? ''}
                                                                onChange={e => {
                                                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                                    handlePickerChange(picker.employeeId, 'combinedDailyKg', val);
                                                                    handlePickerChange(picker.employeeId, 'payableNetWeight', undefined);
                                                                }}
                                                                className="w-12 text-center bg-white border border-indigo-300 font-extrabold text-slate-800 rounded text-[9px] py-0.5 focus:ring-1 focus:ring-indigo-500"
                                                                title={isKa ? 'დღიურ/ბაზურ განაკვეთზე დაკრეფილი კგ (მაგ: 20კგ)' : 'KG harvested during flat daily rate phase'}
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="font-bold text-indigo-700">{isKa ? 'წონით კგ:' : 'Piece KG:'}</span>
                                                            <span className="font-black text-indigo-900">
                                                                {(() => {
                                                                    const totalNet = picker.manualNetWeight ?? scannedWeight;
                                                                    const dKg = picker.combinedDailyKg ?? (totalNet >= 20 ? 20 : totalNet * 0.5);
                                                                    const pKg = picker.payableNetWeight ?? Math.max(0, totalNet - dKg);
                                                                    return pKg.toFixed(2);
                                                                })()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ width: `${colWidths.bonus}px` }} className="px-2 sm:px-3 py-2 overflow-hidden">
                                            <div className="relative w-full">
                                                {picker.bonus !== undefined && picker.bonus > 0 && <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>}
                                                <div className="flex items-center gap-1 w-full min-w-0">
                                                    <span className="text-slate-400 font-bold text-xs shrink-0">{currency === 'USD' ? '$' : '₾'}</span>
                                                    <input
                                                        type="number" 
                                                        step="0.01"
                                                        inputMode="decimal"
                                                        value={picker.bonus || ''}
                                                        placeholder="0"
                                                        title={`Bonus: ${picker.bonus || 0}`}
                                                        onChange={e => handlePickerChange(picker.employeeId, 'bonus', e.target.value)}
                                                        className="bg-slate-100 focus:bg-white text-slate-900 font-extrabold rounded-lg w-full text-center py-1 px-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none border border-transparent focus:border-indigo-300 transition-all shadow-2xs"
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ width: `${colWidths.final}px` }} className="px-2.5 sm:px-3 py-2 text-right font-black text-sm sm:text-base text-red-600 whitespace-nowrap overflow-hidden">
                                            <div className="flex items-center justify-end gap-1.5 w-full">
                                                <div className="flex flex-col items-end">
                                                    <span className="truncate">{formatCurrency(earnings)}</span>
                                                    {isCombinedMode && (() => {
                                                        const totalNet = picker.manualNetWeight ?? scannedWeight;
                                                        const dKg = picker.combinedDailyKg ?? (totalNet >= 20 ? 20 : totalNet * 0.5);
                                                        const pKg = picker.payableNetWeight ?? Math.max(0, totalNet - dKg);
                                                        const days = picker.manualDays ?? picker.combinedShiftFraction ?? 0.5;
                                                        const baseDailyRate = picker.combinedBaseRate ?? (picker.rate > 10 ? picker.rate : 50);
                                                        const perKgRate = picker.combinedPerKgRate ?? (picker.rate <= 10 ? picker.rate : 1.4);
                                                        return (
                                                            <span className="text-[9px] font-extrabold text-indigo-600 tracking-tight" title={
                                                                isKa
                                                                    ? `(${days} დღე × ₾${baseDailyRate} = ₾${(days * baseDailyRate).toFixed(2)}) + (${pKg.toFixed(2)} კგ × ₾${perKgRate} = ₾${(pKg * perKgRate).toFixed(2)})`
                                                                    : `(${days} days × $${baseDailyRate} = $${(days * baseDailyRate).toFixed(2)}) + (${pKg.toFixed(2)} kg × $${perKgRate} = $${(pKg * perKgRate).toFixed(2)})`
                                                            }>
                                                                {days} Day ({dKg.toFixed(1)}kg) + {pKg.toFixed(1)}kg @ {perKgRate}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleDeletePicker(picker.employeeId)}
                                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                                    title={isKa ? 'მუშის წაშლა' : 'Remove Worker'}
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white font-black uppercase tracking-tighter text-[10px] sm:text-xs sticky bottom-0 z-10 shadow-md">
                            <tr>
                                <td style={{ width: `${colWidths.select + colWidths.worker + colWidths.role + colWidths.context}px` }} className="px-3 py-3 font-extrabold" colSpan={4}>
                                    {t('adv.totals').replace('{count}', String(filteredPickers.length))}
                                </td>
                                <td style={{ width: `${colWidths.rate}px` }} className="px-2 py-3 text-center text-slate-400 font-bold">
                                    -
                                </td>
                                <td style={{ width: `${colWidths.days}px` }} className="px-2 py-3 text-center">
                                    {filteredPickers.reduce((sum, p) => sum + (p.manualDays ?? 1), 0).toFixed(1)}
                                </td>
                                <td style={{ width: `${colWidths.hours}px` }} className="px-2 py-3 text-center">
                                    {filteredPickers.reduce((sum, p) => sum + (p.manualHours ?? calculateNetDurationHours(event)), 0).toFixed(1)}
                                </td>
                                <td style={{ width: `${colWidths.boxes}px` }} className="px-2 py-3 text-center">
                                    {filteredPickers.reduce((sum, p) => {
                                        const pickerEntries = entries.filter(e => e.employeeId === p.employeeId);
                                        const entriesCount = pickerEntries.reduce((s, e) => s + (e.boxCount || 1), 0);
                                        return sum + (p.manualBoxes ?? entriesCount);
                                    }, 0)}
                                </td>
                                <td style={{ width: `${colWidths.gross}px` }} className="px-2 py-3 text-center">
                                    {filteredPickers.reduce((sum, p) => {
                                        const pickerEntries = entries.filter(e => e.employeeId === p.employeeId);
                                        const scannedWeight = pickerEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
                                        const scannedGross = pickerEntries.reduce((s, e) => s + (e.grossWeightKg ?? ((e.netWeightKg || 0) + (e.boxCount || 1) * eventTareWeightAverage)), 0);
                                        const scannedBoxes = pickerEntries.reduce((s, e) => s + (e.boxCount || 1), 0);
                                        
                                        const finalNetWeight = p.manualNetWeight ?? scannedWeight;
                                        const finalBoxes = p.manualBoxes ?? scannedBoxes;
                                        
                                        return sum + ((p.manualNetWeight !== undefined || p.manualBoxes !== undefined)
                                            ? finalNetWeight + (finalBoxes * eventTareWeightAverage)
                                            : scannedGross);
                                    }, 0).toFixed(2)}
                                </td>
                                <td style={{ width: `${colWidths.bonus}px` }} className="px-2 py-3 text-center">
                                    {formatCurrency(filteredPickers.reduce((sum, p) => sum + (p.bonus || 0), 0))}
                                </td>
                                <td style={{ width: `${colWidths.final}px` }} className="px-3 py-3 text-right text-xs sm:text-sm font-black text-amber-300">
                                    {formatCurrency(filteredPickers.reduce((sum, p) => {
                                        const weight = entries.filter(e => e.employeeId === p.employeeId).reduce((s, e) => s + (e.netWeightKg || 0), 0);
                                        const hrs = p.manualHours ?? calculateNetDurationHours(event);
                                        return sum + calculatePickerEarnings(p, p.manualNetWeight ?? weight, hrs);
                                    }, 0))}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
             <div className="p-4 border-t border-slate-100 text-slate-500 text-xs flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-100 rounded-sm ring-1 ring-slate-300"></div>
                        <span>{t('adv.production_data')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                        <span>{t('adv.manual_override')}</span>
                    </div>
                </div>
                <span className="italic">{t('adv.edit_to_override')}</span>
            </div>

            {isAddWorkerOpen && (
                <div className="fixed inset-0 bg-black/50 z-[4000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                👤 {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'მუშის დამატება ღონისძიებაში' : 'Add Worker to Event'}
                            </h3>
                            <button 
                                type="button"
                                onClick={() => setIsAddWorkerOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-200/50 rounded-full transition-colors font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddWorkerSubmit} className="p-6 space-y-4">
                            {/* Toggle Mode */}
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setAddMode('existing')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                        addMode === 'existing' 
                                            ? 'bg-white text-slate-900 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-850'
                                    }`}
                                >
                                    {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'არსებული მუშა' : 'Select Existing'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddMode('new')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                        addMode === 'new' 
                                            ? 'bg-white text-slate-900 shadow-sm shadow-emerald-50 text-emerald-750 font-black' 
                                            : 'text-slate-500 hover:text-slate-850'
                                    }`}
                                >
                                    {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ახალი მუშის შექმნა' : 'Create New'}
                                </button>
                            </div>

                            {addMode === 'existing' ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                                            {isKa ? 'აირჩიეთ მუშა' : 'Select Worker'} ({filteredUnassignedEmployees.length})
                                        </label>
                                        {selectedEmpIds.length > 0 && (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                ✓ {isKa ? 'არჩეულია' : 'Selected'} ({selectedEmpIds.length})
                                            </span>
                                        )}
                                    </div>

                                    {/* Multi-select Tags */}
                                    {selectedEmpIds.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                            {selectedEmpIds.map(id => {
                                                const emp = employees.find(e => e.id === id);
                                                if (!emp) return null;
                                                return (
                                                    <div key={id} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-full text-[10px] font-bold text-slate-700 shadow-sm">
                                                        <div className="w-4 h-4 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center">
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <span className="truncate max-w-[100px]">{emp.name}</span>
                                                        <span className="text-slate-400 text-[8px] ml-1">ID: {emp.idNumber || emp.id.substring(0, 3)}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEmployeeSelectChange(id)}
                                                            className="ml-1 text-slate-400 hover:text-red-500 cursor-pointer p-0.5"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Worker Search Field */}
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                            🔍
                                        </div>
                                        <input
                                            type="text"
                                            value={addWorkerSearchQuery}
                                            onChange={e => setAddWorkerSearchQuery(e.target.value)}
                                            placeholder={isKa ? 'ძებნა სახელით, ID-ით ან კოდით...' : 'Search worker by name, ID or code...'}
                                            className="w-full bg-slate-50 hover:bg-white focus:bg-white border-2 border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-800 font-medium outline-none transition-all"
                                        />
                                        {addWorkerSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setAddWorkerSearchQuery('')}
                                                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>

                                    {/* Interactive Scrollable Worker List */}
                                    <div className="max-h-48 overflow-y-auto border-2 border-slate-100 rounded-xl p-1 bg-slate-50/50 space-y-1">
                                        {filteredUnassignedEmployees.length === 0 ? (
                                            <div className="p-3 text-center text-xs text-slate-400 italic">
                                                {isKa ? 'მუშაკი ვერ მოიძებნა' : 'No worker found matching query'}
                                            </div>
                                        ) : (
                                            filteredUnassignedEmployees.map(emp => {
                                                const isSelected = selectedEmpIds.includes(emp.id);
                                                const roleName = emp.roleId ? (roles?.find(r => r.id === emp.roleId)?.name || emp.roleId) : 'Worker';
                                                return (
                                                    <button
                                                        key={emp.id}
                                                        type="button"
                                                        onClick={() => handleEmployeeSelectChange(emp.id)}
                                                        className={`w-full text-left p-2 rounded-lg flex items-center justify-between transition-all cursor-pointer ${
                                                            isSelected 
                                                                ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                                                                : 'hover:bg-indigo-50 text-slate-800 bg-white border border-slate-100'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                                isSelected ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
                                                            }`}>
                                                                {emp.name.charAt(0)}
                                                            </div>
                                                            <div className="truncate">
                                                                <p className="text-xs font-bold truncate leading-tight">{emp.name}</p>
                                                                <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                                    {emp.idNumber ? `ID: ${emp.idNumber}` : ''} {emp.employeeCodeOverride ? `• Code: ${emp.employeeCodeOverride}` : ''} • {roleName}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {isSelected && <span className="text-xs font-black">✓</span>}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Fallback Standard Dropdown */}
                                    <select
                                        value={selectedEmpIds[0] || ''}
                                        onChange={e => handleEmployeeSelectChange(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                                    >
                                        <option value="">-- {isKa ? 'ან აირჩიეთ ჩამონათვალიდან...' : 'Or select from dropdown...'} --</option>
                                        {filteredUnassignedEmployees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} {emp.idNumber ? `(${emp.idNumber})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                                            {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'სახელი და გვარი' : 'Full Name'}
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder={t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'მაგ: გივი მამულაშვილი' : 'e.g. Givi Mamulashvili'}
                                            value={newWorkerName}
                                            onChange={e => setNewWorkerName(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                                            {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'პირადი ნომერი (არასავალდებულო)' : 'Personal ID (Optional)'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'მაგ: 010240...' : 'e.g. 010240...'}
                                            value={newWorkerId}
                                            onChange={e => setNewWorkerId(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                                        {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'გადახდის მოდელი' : 'Payment Model'}
                                    </label>
                                    <select
                                        value={chosenModel}
                                        onChange={e => setChosenModel(e.target.value as PaymentModel)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="per_weight">{t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'კილოგრამის ტარიფი (კგ)' : 'Per Weight'}</option>
                                        <option value="hourly">{t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'საათობრივი ტარიფი' : 'Hourly Rate'}</option>
                                        <option value="daily">{t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'დღიური ტარიფი' : 'Daily Rate'}</option>
                                        <option value="salary">{t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ფიქსირებული ხელფასი' : 'Fixed Salary'}</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                                        {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ტარიფი' : 'Rate'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={chosenRate}
                                            onChange={e => setChosenRate(e.target.value === '' ? '' : e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-3 pr-8 py-2 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-black">₾</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddWorkerOpen(false)}
                                    className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
                                >
                                    {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors shadow-md"
                                >
                                    {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'დამატება' : 'Add'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </>
            )}

            {/* ⚖️ Bulk Reweighing Pop-up Modal */}
            {isReweighOpen && (
                <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl sm:rounded-[2rem] w-full max-w-3xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 shadow-2xl border border-slate-100 max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-slate-100 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xl sm:text-2xl">⚖️</span>
                                <div>
                                    <h3 className="font-black text-slate-800 text-sm sm:text-lg uppercase tracking-wider">
                                        {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'აწონვის რე reconciliation-სადგური' : 'Bulk Reweighing & Reconciliation'}
                                    </h3>
                                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase">Compare entered data with selling/cold-storage weight</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsReweighOpen(false)}
                                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-500 transition-colors active:scale-95 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 pr-1 text-left">
                            
                            {/* Summary / Comparison Card */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 bg-slate-50 p-3.5 sm:p-5 rounded-2xl border border-slate-100">
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Early Entered Data</p>
                                    <p className="text-base sm:text-lg font-black text-slate-800">{calculatedTotalNetWeight.toFixed(1)} KG</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{physicalBoxes} Physical Boxes</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">Current Reweighed Sum</p>
                                    <p className="text-base sm:text-lg font-black text-indigo-600">{reweighRecords.reduce((s, r) => s + r.weight, 0).toFixed(1)} KG Net</p>
                                    <div className="text-[10px] text-indigo-500 font-bold uppercase space-y-0.5 mt-0.5">
                                        <p>{reweighRecords.reduce((s, r) => s + r.boxes, 0)} Reweighed Boxes</p>
                                        <p>Gross: {reweighRecords.reduce((s, r) => s + (r.brutto || r.weight), 0).toFixed(1)} KG</p>
                                        {reweighRecords.reduce((s, r) => s + (r.salary || 0), 0) > 0 && (
                                            <p className="text-emerald-600 font-extrabold">Salary: {reweighRecords.reduce((s, r) => s + (r.salary || 0), 0).toFixed(2)} GEL</p>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t sm:border-t-0 sm:border-l border-slate-200/60 sm:pl-4 pt-2 sm:pt-0">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Discrepancy (Early - Reweigh)</p>
                                    <p className={`text-base sm:text-lg font-black ${Math.abs(calculatedTotalNetWeight - reweighRecords.reduce((s, r) => s + r.weight, 0)) < 0.1 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {(calculatedTotalNetWeight - reweighRecords.reduce((s, r) => s + r.weight, 0)).toFixed(1)} KG
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">
                                        {physicalBoxes - reweighRecords.reduce((s, r) => s + r.boxes, 0)} Box Difference
                                    </p>
                                </div>
                            </div>

                            {/* Add Bulk Weighing Record */}
                            <div className="bg-indigo-50/40 p-3.5 sm:p-5 rounded-2xl border border-indigo-100/50 space-y-3.5 sm:space-y-4">
                                <div className="flex justify-between items-center flex-wrap gap-2">
                                    <h4 className="font-extrabold text-xs text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                                        <span>⚖️</span> Add Weighing Record (Net & Gross Auto-calculation)
                                    </h4>
                                    {newReweighBoxes && (
                                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-full border border-indigo-200 animate-fadeIn">
                                            ⚡ Box count live ({newReweighBoxes} Bx)
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">Boxes / ყუთები</label>
                                        </div>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={newReweighBoxes === '' || isNaN(Number(newReweighBoxes)) ? '' : newReweighBoxes}
                                            onChange={e => handleBoxesChange(e.target.value)}
                                            placeholder="e.g. 10"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[42px]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider truncate font-bold">Box Tare / ტარა (KG)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            inputMode="decimal"
                                            value={boxTare === undefined || isNaN(Number(boxTare)) ? '' : boxTare}
                                            onChange={e => handleTareChange(parseFloat(e.target.value) || 0)}
                                            placeholder="e.g. 1.5"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[42px]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider truncate font-bold">Net / ნეტი (KG)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            inputMode="decimal"
                                            value={newReweighWeight === '' || isNaN(Number(newReweighWeight)) ? '' : newReweighWeight}
                                            onChange={e => handleNetChange(e.target.value)}
                                            placeholder="e.g. 66.5"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[42px]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider truncate font-bold">Gross / ბრუტო (KG)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            inputMode="decimal"
                                            value={newReweighBrutto === '' || isNaN(Number(newReweighBrutto)) ? '' : newReweighBrutto}
                                            onChange={e => handleBruttoChange(e.target.value)}
                                            placeholder="e.g. 81.5"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[42px]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider truncate font-bold">Variety / ჯიში</label>
                                        <select
                                            value={newReweighVariety}
                                            onChange={e => setNewReweighVariety(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[42px]"
                                        >
                                            <option value="">Select Variety (Optional)</option>
                                            {availableVarieties.map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider truncate font-bold">Worker / მუშა</label>
                                        <select
                                            value={newReweighWorkerId}
                                            onChange={e => setNewReweighWorkerId(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[42px]"
                                        >
                                            <option value="">Select Worker (Optional)</option>
                                            {workerOptions.map(w => (
                                                <option key={w.id} value={w.id}>
                                                    {w.name} {(w as any).workerNumber ? `(#${(w as any).workerNumber})` : (w.idNumber ? `(${w.idNumber})` : '')}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {newReweighWorkerId && (
                                    <div className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex flex-wrap justify-between items-center gap-1 animate-fadeIn">
                                        <span>💰 Salary Preview / ხელფასი:</span>
                                        <span>{(parseFloat(newReweighWeight) || 0).toFixed(1)} KG × {getWorkerRate(newReweighWorkerId)} GEL = {((parseFloat(newReweighWeight) || 0) * getWorkerRate(newReweighWorkerId)).toFixed(2)} GEL</span>
                                    </div>
                                )}

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const boxes = parseInt(newReweighBoxes);
                                            const weight = parseFloat(newReweighWeight);
                                            const brutto = parseFloat(newReweighBrutto);
                                            if (isNaN(boxes) || boxes <= 0 || isNaN(weight) || weight <= 0) {
                                                toast.error("Please enter valid positive boxes and weight numbers!");
                                                return;
                                            }
                                            const rate = newReweighWorkerId ? getWorkerRate(newReweighWorkerId) : 0;
                                            const salary = weight * rate;

                                            const newRec = {
                                                id: `reweigh-${Date.now()}`,
                                                boxes,
                                                weight,
                                                brutto: !isNaN(brutto) ? brutto : (weight + (boxes * boxTare)),
                                                variety: newReweighVariety || undefined,
                                                workerId: newReweighWorkerId || undefined,
                                                salary: newReweighWorkerId ? salary : undefined
                                            };
                                            setReweighRecords([...reweighRecords, newRec]);
                                            // KEEP newReweighBoxes live as requested ("after add record live last entered box quantity")
                                            setNewReweighWeight('');
                                            setNewReweighBrutto('');
                                            toast.success(`Weighing record added! Box quantity (${boxes} Bx) kept live for fast entry.`);
                                        }}
                                        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-100 cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95"
                                    >
                                        <span>Add weighing record</span>
                                    </button>
                                </div>
                            </div>

                            {/* List of Weighings */}
                            <div className="space-y-2">
                                <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-widest">📋 Weighing Records list ({reweighRecords.length})</h4>
                                <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                                    {reweighRecords.map((r, i) => {
                                        const workerObj = employees.find(e => e.id === r.workerId);
                                        return (
                                            <div key={r.id} className="flex flex-wrap md:flex-nowrap justify-between items-center gap-2.5 px-3.5 sm:px-4 py-3 bg-slate-50 hover:bg-slate-100/60 transition-colors">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">#{i + 1}</span>
                                                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{r.boxes} Boxes</span>
                                                        {r.variety && (
                                                            <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">🍇 {r.variety}</span>
                                                        )}
                                                        {workerObj ? (
                                                            <span className="text-xs font-black text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                                                                👤 {workerObj.name} {(workerObj as any).workerNumber ? `(#${(workerObj as any).workerNumber})` : ''}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-black text-slate-400 bg-slate-100/50 border border-slate-200/40 rounded px-1.5 py-0.5 italic">No worker</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] sm:text-xs font-bold text-slate-600 flex items-center gap-2 flex-wrap">
                                                        <span>Net: <b className="text-slate-900 font-extrabold">{r.weight.toFixed(1)} KG</b></span>
                                                        <span className="text-slate-300">|</span>
                                                        <span>Gross: {(r.brutto ?? (r.weight + r.boxes * 1.5)).toFixed(1)} KG</span>
                                                        <span className="text-slate-300">|</span>
                                                        <span className="text-[10px] text-slate-400">Tare: {((r.brutto ?? (r.weight + r.boxes * 1.5)) - r.weight).toFixed(1)} KG</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 self-end sm:self-center">
                                                    {r.salary !== undefined && (
                                                        <div className="text-right">
                                                            <p className="text-[8px] font-black uppercase text-slate-400 leading-none">Salary</p>
                                                            <p className="text-xs font-black text-emerald-600 leading-none mt-1">{r.salary.toFixed(2)} GEL</p>
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReweighRecords(reweighRecords.filter(item => item.id !== r.id));
                                                            toast.info("Weighing record deleted.");
                                                        }}
                                                        className="h-8 w-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors border border-transparent hover:border-red-100 cursor-pointer active:scale-95"
                                                        title="Delete record"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {reweighRecords.length === 0 && (
                                        <div className="py-6 text-center text-slate-400 text-xs font-medium uppercase italic">No records added yet</div>
                                    )}
                                </div>
                            </div>

                            {/* Seller & Notes section */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 pt-2 border-t border-slate-100">
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Seller Reported Weight (KG) / მყიდველის წონა</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        inputMode="decimal"
                                        placeholder="Enter weight told by seller..."
                                        value={sellerReportedWeight || ''}
                                        onChange={e => setSellerReportedWeight(parseFloat(e.target.value) || undefined)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[42px]"
                                    />
                                    {sellerReportedWeight !== undefined && (
                                        <div className="text-[10px] text-slate-500 font-bold mt-1">
                                            Difference from Reweighed: <span className="font-black text-indigo-600">{(reweighRecords.reduce((s, r) => s + r.weight, 0) - sellerReportedWeight).toFixed(1)} KG</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Why it happened (Notes) / შენიშვნა</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Provide reasons for discrepancy (e.g. moisture loss, scales calibration difference)..."
                                        value={reweighNotes}
                                        onChange={e => setReweighNotes(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end pt-3 sm:pt-4 border-t border-slate-100 flex-shrink-0 bg-white">
                            <button
                                type="button"
                                onClick={() => setIsReweighOpen(false)}
                                className="w-full sm:w-auto px-5 py-2.5 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors text-center min-h-[42px]"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const totalReweighed = reweighRecords.reduce((sum, r) => sum + r.weight, 0);
                                    if (totalReweighed <= 0) {
                                        toast.error("Add some reweighed records first!");
                                        return;
                                    }
                                    setCorrectedWeight(totalReweighed);
                                    toast.success(`Corrected weight locked to reweighed total of ${totalReweighed.toFixed(1)} KG!`);
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md text-center cursor-pointer min-h-[42px]"
                            >
                                Apply to Corrected Weight
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const totalReweighed = reweighRecords.reduce((sum, r) => sum + r.weight, 0);
                                    const totalReweighBoxes = reweighRecords.reduce((sum, r) => sum + r.boxes, 0);
                                    const totalReweighGross = reweighRecords.reduce((sum, r) => sum + (r.brutto || r.weight), 0);
                                    const totalReweighSalary = reweighRecords.reduce((sum, r) => sum + (r.salary || 0), 0);
                                    
                                    const updatedEvent: HarvestEvent = {
                                        ...event,
                                        assignedPickers: localPickers,
                                        reweighRecords,
                                        reweighTotalWeight: totalReweighed,
                                        reweighTotalBoxes: totalReweighBoxes,
                                        reweighTotalGrossWeight: totalReweighGross,
                                        reweighTotalSalary: totalReweighSalary,
                                        sellerReportedWeight,
                                        reweighNotes,
                                        totalNetWeightKg: correctedWeight !== undefined ? correctedWeight : totalReweighed || calculatedTotalNetWeight,
                                        totalBoxes: physicalBoxes,
                                        physicalHalfBoxes,
                                        mergeHalfBoxes,
                                        physicalPunets,
                                        totalPunets: physicalPunets,
                                        punetsPerBox,
                                        standardBoxWeight,
                                        correctedWeight,
                                        leaveReconciliationAsIs
                                    };
                                    onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                    toast.success("Reweighing details saved perfectly!");
                                    setIsReweighOpen(false);
                                }}
                                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-indigo-100 text-center cursor-pointer min-h-[42px]"
                            >
                                Save details & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isExportModalOpen && (
                <ExportExcelModal 
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    event={event}
                    entries={entries}
                    employees={employees}
                    roles={roles || []}
                    localPickers={filteredPickers}
                    durationHours={durationHours}
                    calculatePickerEarnings={calculatePickerEarnings}
                />
            )}

            {isHistoryModalOpen && (
                <HarvestEventHistoryModal 
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    event={event}
                    entries={entries}
                    employees={employees}
                    localPickers={localPickers}
                    onSetHarvestEntries={onSetHarvestEntries}
                    onLogActivity={onLogActivity}
                    onRestoreVersion={(restoredEvent) => {
                        onSetHarvestEvents((harvestEvents || []).map(e => e.id === restoredEvent.id ? restoredEvent : e));
                        setIsHistoryModalOpen(false);
                    }}
                />
            )}

            {isShareModalOpen && (
                <ShareHarvestEventModal 
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    event={event}
                    entries={entries}
                />
            )}

            {isBoxQrOpen && (
                <HarvestBoxQrModal
                    isOpen={isBoxQrOpen}
                    onClose={() => setIsBoxQrOpen(false)}
                    harvestEvent={event}
                    employees={employees}
                />
            )}

            {/* Print Yield Control Audit Report Modal */}
            {isPrintModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-auto overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
                        {/* Modal Control Bar (Screen only) */}
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center print:hidden flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🖨️</span>
                                <div>
                                    <h3 className="font-black text-base uppercase tracking-tight text-white">
                                        {isKa ? 'მოსავლისა და ლოგისტიკის აუდიტის რეპორტი' : 'Yield & Logistics Audit Report'}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">
                                        {isKa ? 'დააჭირეთ "ბეჭდვა / PDF" სრული რეპორტის დასაბეჭდად' : 'Click "Print / Save PDF" to print or download as PDF'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                                >
                                    🖨️ {isKa ? 'ბეჭდვა / PDF შენახვა' : 'Print / Save PDF'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsPrintModalOpen(false)}
                                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase transition-colors cursor-pointer"
                                >
                                    ✕ {isKa ? 'დახურვა' : 'Close'}
                                </button>
                            </div>
                        </div>

                        {/* Print Area */}
                        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-900 bg-white" id="yield-control-print-area">
                            <style>{`
                                @media print {
                                    body * { visibility: hidden !important; }
                                    #yield-control-print-area, #yield-control-print-area * { visibility: visible !important; }
                                    #yield-control-print-area {
                                        position: absolute !important;
                                        left: 0 !important;
                                        top: 0 !important;
                                        width: 100% !important;
                                        padding: 20px !important;
                                        background: white !important;
                                        color: black !important;
                                    }
                                    .print\\:hidden { display: none !important; }
                                }
                            `}</style>

                            {/* Report Document Header */}
                            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                                        AGRIMAP V2 — HARVEST & OPEX AUDIT REPORT
                                    </h1>
                                    <p className="text-xs font-bold text-slate-500 mt-0.5">
                                        {isKa ? 'მოსავლის აღების, მუშახელის, ტრანსპორტის, ტარის და საოპერაციო ხარჯების სრული რეპორტი' : 'Full Audit Report of Harvest Yield, Workforce Payroll, Transport, Packaging, & OPEX'}
                                    </p>
                                </div>
                                <div className="text-right text-xs font-semibold text-slate-600">
                                    <p className="font-bold text-slate-900">{event.name}</p>
                                    <p>{(event as any).plantationName || (event as any).plantation || 'Main Plantation'} {(event as any).sectorName ? `• ${(event as any).sectorName}` : ''}</p>
                                    <p>{isKa ? 'თარიღი:' : 'Date:'} {(event as any).date || event.plannedStartDate || new Date().toISOString().split('T')[0]}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">{isKa ? 'გენერირებულია:' : 'Generated:'} {new Date().toLocaleString()}</p>
                                </div>
                            </div>

                            {/* 1. TOTAL OPEX & YIELD SUMMARY CARDS */}
                            <div>
                                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                    1. {isKa ? 'მოსავლისა და OPEX ხარჯების ჯამი (TOTAL SUMMARY)' : 'TOTAL YIELD & OPEX SUMMARY'}
                                </h2>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">{isKa ? 'წმინდა წონა (NET)' : 'Total Net Yield'}</span>
                                        <span className="text-xl font-black text-emerald-700">{summaryNetKg.toFixed(2)} KG</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">{isKa ? 'ბრუტო წონა (GROSS)' : 'Total Gross Weight'}</span>
                                        <span className="text-xl font-black text-slate-800">{summaryGrossKg.toFixed(2)} KG</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">{isKa ? 'ყუთები / პუნეტები' : 'Total Boxes & Punets'}</span>
                                        <span className="text-base font-black text-indigo-700">{summaryTotalBoxes} Boxes ({summaryTotalPunets} Punets)</span>
                                    </div>
                                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300">
                                        <span className="text-[10px] font-black text-emerald-800 uppercase block">{isKa ? 'სულ OPEX (TOTAL OPEX)' : 'TOTAL EVENT OPEX'}</span>
                                        <span className="text-xl font-black text-emerald-800">{formatNiceCurrency(totalCost)}</span>
                                    </div>
                                </div>

                                {/* OPEX Breakdown Row */}
                                <div className="mt-3 p-3 bg-slate-100 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">{isKa ? 'მუშახელის ანაზღაურება:' : 'Labor Payroll:'}</span>
                                        <span className="font-extrabold text-slate-800">{formatNiceCurrency(laborCost)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">{isKa ? 'ავტომობილები და მძღოლები:' : 'Cars & Foremen Transport:'}</span>
                                        <span className="font-extrabold text-slate-800">{formatNiceCurrency(machineCost)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">{isKa ? 'ტარა (ყუთები/პუნეტები):' : 'Packaging (Boxes/Punets):'}</span>
                                        <span className="font-extrabold text-slate-800">{formatNiceCurrency(packagingCost)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">{isKa ? 'მასალები და სხვა:' : 'Used Materials & Other:'}</span>
                                        <span className="font-extrabold text-slate-800">{formatNiceCurrency(otherCosts)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. NET YIELD BY VARIETIES */}
                            <div>
                                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                    2. {isKa ? 'წმინდა მოსავალი ჯიშების მიხედვით (NET YIELD BY VARIETIES)' : 'NET YIELD BY VARIETIES'}
                                </h2>
                                <table className="w-full text-xs text-left border-collapse border border-slate-200">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                                            <th className="p-2 border-r border-slate-200">{isKa ? 'ჯიში' : 'Crop Variety'}</th>
                                            <th className="p-2 border-r border-slate-200 text-center">{isKa ? 'ჩანაწერები' : 'Entries'}</th>
                                            <th className="p-2 border-r border-slate-200 text-right">{isKa ? 'წმინდა წონა (KG)' : 'Net Yield (KG)'}</th>
                                            <th className="p-2 text-right">{isKa ? 'წილი (%)' : 'Share (%)'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const vYields: Record<string, { weight: number; count: number }> = {};
                                            (entries || []).forEach(e => {
                                                if (String(e.harvestEventId) === String(event.id)) {
                                                    const vName = e.variety || (event as any).cropVariety || (event as any).variety || (event.varieties && event.varieties[0]) || (isKa ? 'სტანდარტული ჯიში' : 'Standard Variety');
                                                    if (!vYields[vName]) vYields[vName] = { weight: 0, count: 0 };
                                                    vYields[vName].weight += e.netWeightKg || 0;
                                                    vYields[vName].count += 1;
                                                }
                                            });
                                            const list = Object.entries(vYields);
                                            if (list.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={4} className="p-3 text-center text-slate-400 italic">
                                                            {isKa ? 'ჯიშების მონაცემები არ არის' : 'No variety breakdown data available'}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            return list.map(([vName, vData], idx) => {
                                                const pct = summaryNetKg > 0 ? ((vData.weight / summaryNetKg) * 100).toFixed(1) : '0';
                                                return (
                                                    <tr key={idx} className="border-b border-slate-150 hover:bg-slate-50 font-medium">
                                                        <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{vName}</td>
                                                        <td className="p-2 border-r border-slate-200 text-center text-slate-600">{vData.count}</td>
                                                        <td className="p-2 border-r border-slate-200 text-right font-black text-emerald-700">{vData.weight.toFixed(2)} KG</td>
                                                        <td className="p-2 text-right font-bold text-slate-600">{pct}%</td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            {/* 3. PACKAGING: BOXES AND PUNETS QUANTITY & COST */}
                            <div>
                                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                    3. {isKa ? 'ტარის რაოდენობა და ხარჯი (BOXES & PUNETS QUANTITY & COST)' : 'PACKAGING: BOXES & PUNETS QUANTITY & COST'}
                                </h2>
                                <table className="w-full text-xs text-left border-collapse border border-slate-200">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                                            <th className="p-2 border-r border-slate-200">{isKa ? 'ტარის ტიპი' : 'Packaging Type'}</th>
                                            <th className="p-2 border-r border-slate-200 text-center">{isKa ? 'რაოდენობა' : 'Quantity'}</th>
                                            <th className="p-2 border-r border-slate-200 text-right">{isKa ? 'ერთეულის ფასი' : 'Unit Cost'}</th>
                                            <th className="p-2 text-right">{isKa ? 'ჯამური ხარჯი' : 'Total Cost'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-slate-150 font-medium">
                                            <td className="p-2 border-r border-slate-200 font-bold text-slate-800">📦 {isKa ? 'ყუთები (Harvest Boxes)' : 'Harvest Boxes'}</td>
                                            <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-700">{summaryTotalBoxes}</td>
                                            <td className="p-2 border-r border-slate-200 text-right text-slate-600">{formatNiceCurrency(0.85)}</td>
                                            <td className="p-2 text-right font-black text-slate-900">{formatNiceCurrency(summaryTotalBoxes * 0.85)}</td>
                                        </tr>
                                        <tr className="border-b border-slate-150 font-medium">
                                            <td className="p-2 border-r border-slate-200 font-bold text-slate-800">🍓 {isKa ? 'პუნეტები (Punets)' : 'Punets'}</td>
                                            <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-700">{summaryTotalPunets}</td>
                                            <td className="p-2 border-r border-slate-200 text-right text-slate-600">{formatNiceCurrency(0.12)}</td>
                                            <td className="p-2 text-right font-black text-slate-900">{formatNiceCurrency(summaryTotalPunets * 0.12)}</td>
                                        </tr>
                                        <tr className="bg-slate-50 font-black">
                                            <td colSpan={3} className="p-2 border-r border-slate-200 text-right uppercase text-[10px] text-slate-600">{isKa ? 'სულ ტარის OPEX ხარჯი:' : 'Total Packaging OPEX:'}</td>
                                            <td className="p-2 text-right text-emerald-700">{formatNiceCurrency(packagingCost)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* 4. CARS & FOREMEN QUANTITY, LIST & COST */}
                            <div>
                                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                    4. {isKa ? 'ტრანსპორტი, მანქანები და ბრიგადირები (CARS & FOREMEN QUANTITY & COST)' : 'CARS & FOREMEN QUANTITY, LIST & COST'}
                                </h2>
                                <div className="flex gap-4 text-xs font-bold mb-2">
                                    <span>🚐 {isKa ? 'მანქანები/ტრანსპორტი:' : 'Vehicles/Cars:'} <strong className="text-indigo-700">{vehiclesCarsCount}</strong></span>
                                    <span>👨‍🌾 {isKa ? 'ბრიგადირების ჩანაწერები:' : 'Foremen Logs:'} <strong className="text-indigo-700">{foremenCount}</strong></span>
                                    <span>💵 {isKa ? 'ჯამური ლოგისტიკის OPEX:' : 'Total Logistics Cost:'} <strong className="text-emerald-700">{formatNiceCurrency(machineCost)}</strong></span>
                                </div>

                                <table className="w-full text-xs text-left border-collapse border border-slate-200">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                                            <th className="p-2 border-r border-slate-200">{isKa ? 'ბრიგადირი / მძღოლი' : 'Foreman / Driver'}</th>
                                            <th className="p-2 border-r border-slate-200">{isKa ? 'ტრანსპორტი / მანქანა' : 'Vehicle(s) Brought'}</th>
                                            <th className="p-2 border-r border-slate-200 text-center">{isKa ? 'მოყვანილი ხალხი' : 'People Brought'}</th>
                                            <th className="p-2 border-r border-slate-200 text-right">{isKa ? 'ტარიფი' : 'Rate Model'}</th>
                                            <th className="p-2 text-right">{isKa ? 'ხარჯი' : 'Cost'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const logs = event.logisticsRecords || [];
                                            if (logs.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                                                            {isKa ? 'ლოგისტიკის ჩანაწერები არ არის' : 'No logistics/transport records recorded for this event'}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            return logs.map((log: any, idx: number) => {
                                                const foremanObj = employees.find(e => e.id === log.foremanId);
                                                const foremanName = foremanObj ? foremanObj.name : (log.foremanName || 'Rental Transport');
                                                return (
                                                    <tr key={idx} className="border-b border-slate-150 font-medium">
                                                        <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{foremanName}</td>
                                                        <td className="p-2 border-r border-slate-200 text-slate-600">{log.vehicleCount || 1} Vehicle(s)</td>
                                                        <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-700">{log.actualPeopleBrought || 0}</td>
                                                        <td className="p-2 border-r border-slate-200 text-right text-slate-600">{log.rateModel} @ ${log.unitCost}</td>
                                                        <td className="p-2 text-right font-black text-slate-900">{formatNiceCurrency(log.calculatedTotalCost || 0)}</td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            {/* 5. USED MATERIALS AND OTHER OPEX */}
                            <div>
                                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                    5. {isKa ? 'გამოყენებული მასალები და სხვა OPEX ხარჯები (USED MATERIALS & OTHER OPEX)' : 'USED MATERIALS & OTHER OPEX'}
                                </h2>
                                <table className="w-full text-xs text-left border-collapse border border-slate-200">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                                            <th className="p-2 border-r border-slate-200">{isKa ? 'მასალა / ხარჯი' : 'Material / Expense Item'}</th>
                                            <th className="p-2 text-right">{isKa ? 'ხარჯი ($)' : 'Cost ($)'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const materials = (event as any).otherOpexItems || [];
                                            if (materials.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={2} className="p-3 text-center text-slate-400 italic">
                                                            {isKa ? 'სხვა მასალები/ხარჯები არ არის მითითებული' : 'No additional material or custom OPEX items recorded'}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            return materials.map((item: any, idx: number) => (
                                                <tr key={idx} className="border-b border-slate-150 font-medium">
                                                    <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{item.name || item.title || 'Material Item'}</td>
                                                    <td className="p-2 text-right font-black text-slate-900">{formatNiceCurrency(item.cost || item.amount || 0)}</td>
                                                </tr>
                                            ));
                                        })()}
                                        <tr className="bg-slate-50 font-black">
                                            <td className="p-2 border-r border-slate-200 text-right uppercase text-[10px] text-slate-600">{isKa ? 'სულ სხვა OPEX ხარჯი:' : 'Total Other OPEX:'}</td>
                                            <td className="p-2 text-right text-emerald-700">{formatNiceCurrency(otherCosts)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* 6. TOTAL ALL WORKERS LIST & HARVEST ENTRIES */}
                            <div>
                                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                    6. {isKa ? 'ყველა მუშის სია და აწონვის ჩანაწერები (ALL WORKERS LIST & ENTRIES)' : 'ALL WORKERS LIST & HARVEST ENTRIES'}
                                </h2>
                                <table className="w-full text-[11px] text-left border-collapse border border-slate-200">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-700 uppercase text-[9px] font-bold border-b border-slate-200">
                                            <th className="p-1.5 border-r border-slate-200">#</th>
                                            <th className="p-1.5 border-r border-slate-200">{isKa ? 'მუშა / სახელი' : 'Worker Name'}</th>
                                            <th className="p-1.5 border-r border-slate-200">{isKa ? 'როლი' : 'Role'}</th>
                                            <th className="p-1.5 border-r border-slate-200 text-center">{isKa ? 'ყუთები' : 'Boxes'}</th>
                                            <th className="p-1.5 border-r border-slate-200 text-center">{isKa ? 'პუნეტები' : 'Punets'}</th>
                                            <th className="p-1.5 border-r border-slate-200 text-right">{isKa ? 'წმინდა წონა (KG)' : 'Net Weight (KG)'}</th>
                                            <th className="p-1.5 border-r border-slate-200 text-right">{isKa ? 'ტარიფი' : 'Rate Model'}</th>
                                            <th className="p-1.5 text-right">{isKa ? 'გამოანგარიშებული ხელფასი' : 'Labor Pay'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPickers.map((picker, idx) => {
                                            const stats = pickerDataMap.entriesByWorker.get(picker.employeeId);
                                            const boxes = picker.manualBoxes ?? (stats?.scannedBoxes || 0);
                                            const punets = (picker as any).manualPunets ?? (boxes * (event.punetsPerBox || 12));
                                            const netKg = picker.manualNetWeight ?? (stats?.scannedWeight || 0);
                                            const workerName = (picker as any).employeeName || employees.find(e => e.id === picker.employeeId)?.name || picker.employeeId;
                                            const earnings = calculatePickerEarnings(picker, netKg, picker.manualHours || durationHours);

                                            return (
                                                <tr key={picker.employeeId || idx} className="border-b border-slate-150 font-medium hover:bg-slate-50">
                                                    <td className="p-1.5 border-r border-slate-200 text-slate-400 font-bold">{idx + 1}</td>
                                                    <td className="p-1.5 border-r border-slate-200 font-bold text-slate-800">{workerName}</td>
                                                    <td className="p-1.5 border-r border-slate-200 text-slate-600">{picker.assignedRole || 'Picker'}</td>
                                                    <td className="p-1.5 border-r border-slate-200 text-center font-bold text-slate-700">{boxes}</td>
                                                    <td className="p-1.5 border-r border-slate-200 text-center text-slate-600">{punets}</td>
                                                    <td className="p-1.5 border-r border-slate-200 text-right font-black text-emerald-700">{netKg.toFixed(2)} KG</td>
                                                    <td className="p-1.5 border-r border-slate-200 text-right text-slate-500 font-mono text-[10px]">{(picker as any).payModel || picker.paymentModel || 'per_weight'} (${picker.rate || 0})</td>
                                                    <td className="p-1.5 text-right font-black text-slate-900">{formatNiceCurrency(earnings)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Signatures Footer */}
                            <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-xs text-slate-600">
                                <div>
                                    <p className="font-bold text-slate-800">{isKa ? 'ბრიგადირი / ზედამხედველი:' : 'Foreman / Supervisor:'}</p>
                                    <div className="mt-6 border-b border-slate-400 w-3/4"></div>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{isKa ? 'საწყობის მენეჯერი:' : 'Inventory / Warehouse:'}</p>
                                    <div className="mt-6 border-b border-slate-400 w-3/4"></div>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{isKa ? 'მთავარი აგრონომი / მენეჯერი:' : 'Chief Agronomist / Manager:'}</p>
                                    <div className="mt-6 border-b border-slate-400 w-3/4"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);
};
