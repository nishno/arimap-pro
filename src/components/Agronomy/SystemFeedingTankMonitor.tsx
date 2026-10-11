import React, { useState, useMemo, useEffect } from 'react';
import type { 
    User, NutritionPlan, PlanExecution, InventoryItem, 
    AreaPlantationFeature, Employee, FertigationTank, 
    TankDissolvedMaterial, RecipeTankConfig, VisualTankLevelPreset,
    PlanExecutionSectorMeasurement
} from '../../types';
import { 
    BeakerIcon, CheckIcon, PlusIcon, TrashIcon, 
    ClockIcon, SparklesIcon, AlertTriangleIcon, 
    ArrowPathIcon, ShieldCheckIcon, PencilSquareIcon,
    ArrowUturnLeftIcon, CalendarDaysIcon
} from '../Icons';
import { useLanguage } from '../../contexts/LanguageContext';

interface SystemFeedingTankMonitorProps {
    currentUser: User | null;
    nutritionPlans: NutritionPlan[];
    planExecutions: PlanExecution[];
    onSetPlanExecutions: (executions: PlanExecution[]) => void;
    inventoryItems: InventoryItem[];
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    sectors: AreaPlantationFeature[];
    employees: Employee[];
    onOpenExecutionDetail?: (execution: PlanExecution) => void;
}

interface FeedingCycleRecord {
    feedingNumber: number;
    timestamp: string;
    date: string;
    totalWaterLiters: number;
    totalCost: number;
    sectors: { sectorId: string; sectorName: string; durationMinutes: number; ec?: number; ph?: number }[];
    materials: { name: string; inventoryItemId?: string; consumedKg: number; cost: number }[];
    tankBreakdown: { tankId: string; tankName: string; consumedLiters: number; materials: { name: string; consumedKg: number }[] }[];
}

interface ActiveFeedingCycle {
    cycleId: string;
    recipeId: string;
    recipeName: string;
    startedAt: string;
    feedings: FeedingCycleRecord[];
    isFinished: boolean;
}

const STORAGE_KEY_TANKS = 'agrimap_fertigation_tanks_v2';
const STORAGE_KEY_CYCLE = 'agrimap_active_feeding_cycle_v2';

const DEFAULT_INITIAL_TANKS: FertigationTank[] = [
    {
        id: 'tank-a',
        tankKey: 'tank-a',
        name: 'Tank A (Ferti A)',
        type: 'fertilizer',
        capacityLiters: 1000,
        currentVolumeLiters: 1000,
        preparedWaterLiters: 1000,
        expectedFeedingsPerBatch: 1,
        activeRecipeName: 'Post-Harvest Nutrition #01',
        status: 'ACTIVE',
        isEnabled: true,
        colorTheme: 'emerald',
        autoCycleFactor: 1.0,
        materials: [
            { inventoryItemId: '', name: 'კალიუმის სულფატი (Potassium Sulphate)', dissolvedKg: 23, activeConcentrationKgPerL: 0.023 },
            { inventoryItemId: '', name: 'ამონიუმის სულფატი (Ammonium Sulphate)', dissolvedKg: 23, activeConcentrationKgPerL: 0.023 },
            { inventoryItemId: '', name: 'ბორი (Boron)', dissolvedKg: 1, activeConcentrationKgPerL: 0.001 },
            { inventoryItemId: '', name: 'თუთია (Zinc)', dissolvedKg: 0.9, activeConcentrationKgPerL: 0.0009 }
        ]
    },
    {
        id: 'tank-b',
        tankKey: 'tank-b',
        name: 'Tank B (Ferti B)',
        type: 'fertilizer',
        capacityLiters: 1000,
        currentVolumeLiters: 1000,
        preparedWaterLiters: 1000,
        expectedFeedingsPerBatch: 2,
        activeRecipeName: 'Post-Harvest Nutrition #01',
        status: 'ACTIVE',
        isEnabled: true,
        colorTheme: 'blue',
        autoCycleFactor: 0.5,
        materials: [
            { inventoryItemId: '', name: 'მონოკალიუმის სულფატი (MonoKalium)', dissolvedKg: 12, activeConcentrationKgPerL: 0.012 },
            { inventoryItemId: '', name: 'მაგნიუმის სულფატი (Magnesium Sulphate)', dissolvedKg: 13, activeConcentrationKgPerL: 0.013 }
        ]
    },
    {
        id: 'mixer-a',
        tankKey: 'mixer-a',
        name: 'Mixer A (EC Booster)',
        type: 'mixer',
        capacityLiters: 1000,
        currentVolumeLiters: 100,
        preparedWaterLiters: 100,
        expectedFeedingsPerBatch: 3,
        activeRecipeName: 'EC 1.6 Booster',
        status: 'ACTIVE',
        isEnabled: true,
        colorTheme: 'purple',
        autoCycleFactor: 0.333,
        materials: [
            { inventoryItemId: '', name: 'ამინომჟავა (Amino Acid / EC 1.6)', dissolvedKg: 15, activeConcentrationKgPerL: 0.15 }
        ]
    },
    {
        id: 'mixer-b',
        tankKey: 'mixer-b',
        name: 'Mixer B (pH Regulator)',
        type: 'acid',
        capacityLiters: 1000,
        currentVolumeLiters: 70,
        preparedWaterLiters: 70,
        expectedFeedingsPerBatch: 1,
        activeRecipeName: 'pH 4.8 Acidifier',
        status: 'ACTIVE',
        isEnabled: true,
        colorTheme: 'amber',
        autoCycleFactor: 1.0,
        materials: [
            { inventoryItemId: '', name: 'გოგირდმჟავა (Sulphuric Acid / pH 4.8)', dissolvedKg: 10, activeConcentrationKgPerL: 0.143 }
        ]
    }
];

const PRESETS: { key: VisualTankLevelPreset; label: string; fraction: number; badgeColor: string }[] = [
    { key: 'FULL', label: '100% Full (სავსე)', fraction: 1.0, badgeColor: 'bg-emerald-500 text-white' },
    { key: 'THREE_QUARTERS', label: '75% (3/4)', fraction: 0.75, badgeColor: 'bg-teal-500 text-white' },
    { key: 'HALF', label: '50% Half (1/2)', fraction: 0.5, badgeColor: 'bg-amber-500 text-white' },
    { key: 'ONE_THIRD', label: '33% (1/3)', fraction: 0.33, badgeColor: 'bg-orange-500 text-white' },
    { key: 'TRACE', label: '10% Trace (ცოტა)', fraction: 0.1, badgeColor: 'bg-red-400 text-white' },
    { key: 'EMPTY', label: '0% Empty (დაცლილი)', fraction: 0.0, badgeColor: 'bg-slate-700 text-white' }
];

export const SystemFeedingTankMonitor: React.FC<SystemFeedingTankMonitorProps> = ({
    currentUser,
    nutritionPlans = [],
    planExecutions = [],
    onSetPlanExecutions,
    inventoryItems = [],
    onSetInventoryItems,
    sectors = [],
    employees = [],
    onOpenExecutionDetail
}) => {
    const { formatCurrency } = useLanguage();

    // Tanks state
    const [tanks, setTanks] = useState<FertigationTank[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_TANKS);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map((t: FertigationTank) => ({
                        ...t,
                        isEnabled: t.isEnabled !== undefined ? t.isEnabled : true
                    }));
                }
            }
        } catch (e) {
            console.error('Failed to load tanks from storage', e);
        }
        return DEFAULT_INITIAL_TANKS;
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_TANKS, JSON.stringify(tanks));
        } catch (e) {
            console.error('Failed to persist tanks', e);
        }
    }, [tanks]);

    // Active session configuration
    const [selectedRecipeId, setSelectedRecipeId] = useState<string>(() => {
        return nutritionPlans[0]?.id || '';
    });

    // Active Cycle Tracking state
    const [activeCycle, setActiveCycle] = useState<ActiveFeedingCycle>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_CYCLE);
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return {
            cycleId: `cycle-${Date.now()}`,
            recipeId: nutritionPlans[0]?.id || '',
            recipeName: nutritionPlans[0]?.name || 'Standard Feeding',
            startedAt: new Date().toISOString(),
            feedings: [],
            isFinished: false
        };
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_CYCLE, JSON.stringify(activeCycle));
        } catch (e) {}
    }, [activeCycle]);

    const [executionMode, setExecutionMode] = useState<'AUTO' | 'MANUAL'>('MANUAL');
    const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [operatorId, setOperatorId] = useState<string>(employees[0]?.id || '');
    const [sessionNotes, setSessionNotes] = useState<string>('');

    // Active selected plan
    const activePlan = useMemo(() => {
        return nutritionPlans.find(p => p.id === selectedRecipeId);
    }, [nutritionPlans, selectedRecipeId]);

    // Target Plantation Sectors & Irrigation Duration with AC (EC) and pH Telemetry
    const [selectedSectors, setSelectedSectors] = useState<PlanExecutionSectorMeasurement[]>(() => {
        const defaultEC = 1.6;
        const defaultPH = 5.8;
        if (sectors.length > 0) {
            return sectors.slice(0, 5).map((s, idx) => ({
                sectorId: s.id,
                sectorName: s.name || `Sector ${idx + 1}`,
                durationMinutes: 50 + (idx % 2 === 0 ? 9 : 0),
                ec: defaultEC,
                ph: defaultPH
            }));
        }
        return [
            { sectorId: 'sec-1', sectorName: 'Sector I', durationMinutes: 59, ec: defaultEC, ph: defaultPH },
            { sectorId: 'sec-2', sectorName: 'Sector II', durationMinutes: 50, ec: defaultEC, ph: defaultPH },
            { sectorId: 'sec-3', sectorName: 'Sector III', durationMinutes: 55, ec: defaultEC, ph: defaultPH }
        ];
    });

    // Track tank levels for current run: { [tankId]: endVolumeLiters }
    const [currentEndVolumes, setCurrentEndVolumes] = useState<{ [tankId: string]: number }>({});

    // Modals state
    const [mixingTank, setMixingTank] = useState<FertigationTank | null>(null);
    const [editingTank, setEditingTank] = useState<FertigationTank | null>(null);
    const [isAddTankOpen, setIsAddTankOpen] = useState(false);
    const [recipeChangeAlert, setRecipeChangeAlert] = useState<{ oldPlan?: NutritionPlan; newPlan?: NutritionPlan } | null>(null);
    const [pendingRecipeId, setPendingRecipeId] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState<any | null>(null);
    const [showCycleCompleteModal, setShowCycleCompleteModal] = useState<boolean>(false);

    // Mixing modal ingredient rows state
    const [mixingIngredients, setMixingIngredients] = useState<{ name: string; dissolvedKg: number; inventoryItemId?: string }[]>([]);
    const [mixingWaterLiters, setMixingWaterLiters] = useState<number>(1000);
    const [mixingExpectedFeedings, setMixingExpectedFeedings] = useState<number>(1);

    // When opening mixing modal, pre-populate exact fertilizer ingredients and purposed quantities from active purpose/recipe
    useEffect(() => {
        if (mixingTank) {
            const tankConfig = activePlan?.tankConfigs?.find(c => 
                (c.tankKey && mixingTank.tankKey && c.tankKey === mixingTank.tankKey) ||
                (c.tankKey && c.tankKey === mixingTank.id) ||
                c.tankName.toLowerCase() === mixingTank.name.toLowerCase() ||
                (c.tankType === mixingTank.type)
            );

            if (tankConfig && tankConfig.ingredients && tankConfig.ingredients.length > 0) {
                setMixingIngredients(tankConfig.ingredients.map(ing => ({
                    name: ing.name,
                    dissolvedKg: ing.quantity,
                    inventoryItemId: ing.inventoryItemId || ''
                })));
                setMixingWaterLiters(tankConfig.waterLiters || mixingTank.capacityLiters || 1000);
                setMixingExpectedFeedings(tankConfig.expectedFeedingsPerBatch || mixingTank.expectedFeedingsPerBatch || 1);
            } else if (mixingTank.materials && mixingTank.materials.length > 0) {
                setMixingIngredients(mixingTank.materials.map(m => ({
                    name: m.name,
                    dissolvedKg: m.dissolvedKg,
                    inventoryItemId: m.inventoryItemId
                })));
                setMixingWaterLiters(mixingTank.preparedWaterLiters || mixingTank.capacityLiters || 1000);
                setMixingExpectedFeedings(mixingTank.expectedFeedingsPerBatch || 1);
            } else if (activePlan?.elements && activePlan.elements.length > 0 && mixingTank.type === 'fertilizer') {
                setMixingIngredients(activePlan.elements.map(el => ({
                    name: el.newItemName || inventoryItems.find(i => i.id === el.inventoryItemId)?.name || 'Fertilizer Input',
                    dissolvedKg: el.quantity || 0,
                    inventoryItemId: el.inventoryItemId
                })));
                setMixingWaterLiters(activePlan.targetWaterLiters || mixingTank.capacityLiters || 1000);
                setMixingExpectedFeedings(1);
            } else {
                setMixingIngredients([{ name: '', dissolvedKg: 0 }]);
                setMixingWaterLiters(mixingTank.capacityLiters || 1000);
                setMixingExpectedFeedings(mixingTank.expectedFeedingsPerBatch || 1);
            }
        }
    }, [mixingTank, activePlan, inventoryItems]);

    // Load Blueprint from Selected Recipe
    const handleApplyRecipeBlueprint = (planToApply?: NutritionPlan) => {
        const targetPlan = planToApply || activePlan;
        if (!targetPlan) return;

        if (targetPlan.tankConfigs && targetPlan.tankConfigs.length > 0) {
            const newTanks: FertigationTank[] = targetPlan.tankConfigs.map((cfg, idx) => {
                const colorThemes: ('emerald' | 'blue' | 'purple' | 'amber' | 'cyan')[] = ['emerald', 'blue', 'purple', 'amber', 'cyan'];
                const autoFactor = cfg.expectedFeedingsPerBatch > 0 ? (1 / cfg.expectedFeedingsPerBatch) : 1;
                
                return {
                    id: cfg.tankKey || `tank-${idx}-${Date.now()}`,
                    tankKey: cfg.tankKey,
                    name: cfg.tankName,
                    type: cfg.tankType,
                    capacityLiters: cfg.capacityLiters || 1000,
                    currentVolumeLiters: cfg.waterLiters || 1000,
                    preparedWaterLiters: cfg.waterLiters || 1000,
                    expectedFeedingsPerBatch: cfg.expectedFeedingsPerBatch || 1,
                    activeRecipeId: targetPlan.id,
                    activeRecipeName: targetPlan.name,
                    status: 'ACTIVE',
                    isEnabled: true,
                    colorTheme: colorThemes[idx % colorThemes.length],
                    autoCycleFactor: autoFactor,
                    materials: cfg.ingredients.map(ing => ({
                        inventoryItemId: ing.inventoryItemId || '',
                        name: ing.name,
                        dissolvedKg: ing.quantity,
                        activeConcentrationKgPerL: ing.quantity / (cfg.waterLiters || 1000)
                    }))
                };
            });

            setTanks(newTanks);
            const newEndVols: { [id: string]: number } = {};
            newTanks.forEach(t => {
                newEndVols[t.id] = t.currentVolumeLiters;
            });
            setCurrentEndVolumes(newEndVols);

            setActiveCycle({
                cycleId: `cycle-${Date.now()}`,
                recipeId: targetPlan.id,
                recipeName: targetPlan.name,
                startedAt: new Date().toISOString(),
                feedings: [],
                isFinished: false
            });
        }
    };

    // Toggle Tank Enabled/Disabled for the current purpose/run
    const handleToggleTankEnabled = (tankId: string) => {
        setTanks(prev => prev.map(t => {
            if (t.id === tankId) {
                const newEnabled = !(t.isEnabled !== false);
                return {
                    ...t,
                    isEnabled: newEnabled
                };
            }
            return t;
        }));

        setCurrentEndVolumes(prev => {
            const tank = tanks.find(t => t.id === tankId);
            if (!tank) return prev;
            return {
                ...prev,
                [tankId]: tank.currentVolumeLiters
            };
        });
    };

    const handleEnableAllTanks = () => {
        setTanks(prev => prev.map(t => ({ ...t, isEnabled: true })));
    };

    // Auto-calculate default end volumes based on execution mode and enabled state
    useEffect(() => {
        setCurrentEndVolumes(prev => {
            const next = { ...prev };
            tanks.forEach(tank => {
                const isEnabled = tank.isEnabled !== false;
                if (!isEnabled) {
                    next[tank.id] = tank.currentVolumeLiters;
                } else if (next[tank.id] === undefined) {
                    if (executionMode === 'AUTO') {
                        const factor = tank.autoCycleFactor || (tank.expectedFeedingsPerBatch ? 1 / tank.expectedFeedingsPerBatch : 1);
                        const dropLiters = Math.round(tank.preparedWaterLiters * factor);
                        next[tank.id] = Math.max(0, tank.currentVolumeLiters - dropLiters);
                    } else {
                        next[tank.id] = tank.currentVolumeLiters;
                    }
                }
            });
            return next;
        });
    }, [tanks, executionMode]);

    // Handle Recipe Change with Safety Guard
    const handleRecipeSelect = (recipeId: string) => {
        const hasLeftover = tanks.some(t => t.currentVolumeLiters > 0 && t.materials.length > 0 && (t.isEnabled !== false));
        if (hasLeftover && recipeId !== selectedRecipeId) {
            const oldPlan = nutritionPlans.find(p => p.id === selectedRecipeId);
            const newPlan = nutritionPlans.find(p => p.id === recipeId);
            setRecipeChangeAlert({ oldPlan, newPlan });
            setPendingRecipeId(recipeId);
        } else {
            setSelectedRecipeId(recipeId);
            const newPlan = nutritionPlans.find(p => p.id === recipeId);
            if (newPlan?.tankConfigs && newPlan.tankConfigs.length > 0) {
                handleApplyRecipeBlueprint(newPlan);
            }
        }
    };

    const confirmRecipeChange = (option: 'FLUSH' | 'CARRYOVER' | 'APPLY_BLUEPRINT' | 'CANCEL') => {
        if (option === 'CANCEL') {
            setRecipeChangeAlert(null);
            setPendingRecipeId(null);
            return;
        }

        if (pendingRecipeId) {
            setSelectedRecipeId(pendingRecipeId);
            const newPlan = nutritionPlans.find(p => p.id === pendingRecipeId);

            if (option === 'FLUSH' || option === 'APPLY_BLUEPRINT') {
                if (newPlan?.tankConfigs && newPlan.tankConfigs.length > 0) {
                    handleApplyRecipeBlueprint(newPlan);
                } else {
                    setTanks(prev => prev.map(t => ({
                        ...t,
                        currentVolumeLiters: 0,
                        status: 'DEPLETED',
                        materials: []
                    })));
                }
            }
        }

        setRecipeChangeAlert(null);
        setPendingRecipeId(null);
    };

    // Calculate consumption summary for single feeding run (EXCLUDING DISABLED TANKS)
    const consumptionSummary = useMemo(() => {
        let totalCost = 0;
        let totalConsumedLiters = 0;

        const details = tanks.map(tank => {
            const isEnabled = tank.isEnabled !== false;
            const startVol = tank.currentVolumeLiters;
            const endVol = isEnabled ? (currentEndVolumes[tank.id] !== undefined ? currentEndVolumes[tank.id] : startVol) : startVol;
            const consumedLiters = isEnabled ? Math.max(0, startVol - endVol) : 0;
            const isDepleted = isEnabled && endVol <= 0;
            totalConsumedLiters += consumedLiters;

            const consumedMaterials = isEnabled ? tank.materials.map(mat => {
                const item = inventoryItems.find(i => i.id === mat.inventoryItemId || i.name.toLowerCase() === mat.name.toLowerCase());
                const unitCost = item?.unitCost || 0;

                const conc = mat.activeConcentrationKgPerL || (mat.dissolvedKg / (tank.preparedWaterLiters || 1));
                const consumedKg = Math.round(consumedLiters * conc * 100) / 100;
                const remainingKg = Math.max(0, Math.round((mat.dissolvedKg - consumedKg) * 100) / 100);
                const cost = consumedKg * unitCost;
                totalCost += cost;

                return {
                    inventoryItemId: item?.id || mat.inventoryItemId,
                    name: mat.name,
                    consumedKg,
                    remainingKg,
                    unitCost,
                    cost
                };
            }) : [];

            return {
                tankId: tank.id,
                tankName: tank.name,
                type: tank.type,
                capacityLiters: tank.capacityLiters,
                startVolumeLiters: startVol,
                endVolumeLiters: endVol,
                consumedLiters,
                isDepleted,
                isEnabled,
                expectedFeedingsPerBatch: tank.expectedFeedingsPerBatch || 1,
                consumedMaterials
            };
        });

        return {
            details,
            totalCost,
            totalConsumedLiters
        };
    }, [tanks, currentEndVolumes, inventoryItems]);

    // Calculate Cumulative Cycle Statistics
    const cycleCumulativeStats = useMemo(() => {
        const totalFeedings = activeCycle.feedings.length;
        const totalWater = activeCycle.feedings.reduce((sum, f) => sum + f.totalWaterLiters, 0);
        const totalCost = activeCycle.feedings.reduce((sum, f) => sum + f.totalCost, 0);

        const materialMap: { [name: string]: { name: string; totalKg: number; totalCost: number } } = {};
        activeCycle.feedings.forEach(f => {
            f.materials.forEach(m => {
                if (!materialMap[m.name]) {
                    materialMap[m.name] = { name: m.name, totalKg: 0, totalCost: 0 };
                }
                materialMap[m.name].totalKg += m.consumedKg;
                materialMap[m.name].totalCost += m.cost;
            });
        });

        const materialSummary = Object.values(materialMap).map(m => ({
            ...m,
            totalKg: Math.round(m.totalKg * 100) / 100,
            totalCost: Math.round(m.totalCost * 100) / 100
        }));

        const enabledTanks = tanks.filter(t => t.isEnabled !== false);
        const allEnabledDepleted = enabledTanks.length > 0 && enabledTanks.every(t => t.currentVolumeLiters <= 0);

        return {
            totalFeedings,
            totalWater,
            totalCost,
            materialSummary,
            allEnabledDepleted,
            enabledTanksCount: enabledTanks.length
        };
    }, [activeCycle, tanks]);

    // Handle quick preset level click
    const handleSetPreset = (tankId: string, fraction: number) => {
        const tank = tanks.find(t => t.id === tankId);
        if (!tank || tank.isEnabled === false) return;
        const targetVol = Math.round(tank.preparedWaterLiters * fraction);
        setCurrentEndVolumes(prev => ({
            ...prev,
            [tankId]: targetVol
        }));
    };

    // Mark Tank Empty (0%)
    const handleMarkDepleted = (tankId: string) => {
        const tank = tanks.find(t => t.id === tankId);
        if (!tank || tank.isEnabled === false) return;
        setCurrentEndVolumes(prev => ({
            ...prev,
            [tankId]: 0
        }));
    };

    // 1-Click Auto Run Calculation
    const handleExecuteAutoRun = () => {
        const nextVolumes: { [id: string]: number } = {};
        tanks.forEach(tank => {
            if (tank.isEnabled === false) {
                nextVolumes[tank.id] = tank.currentVolumeLiters;
            } else {
                const feedings = tank.expectedFeedingsPerBatch || 1;
                const singleRunLiters = Math.round(tank.preparedWaterLiters / feedings);
                const newVol = Math.max(0, tank.currentVolumeLiters - singleRunLiters);
                nextVolumes[tank.id] = newVol;
            }
        });
        setCurrentEndVolumes(nextVolumes);
    };

    // Delete a Tank
    const handleDeleteTank = (tankId: string) => {
        if (tanks.length <= 1) {
            alert('System must have at least one tank.');
            return;
        }
        if (window.confirm('Are you sure you want to delete this tank?')) {
            setTanks(prev => prev.filter(t => t.id !== tankId));
            setCurrentEndVolumes(prev => {
                const next = { ...prev };
                delete next[tankId];
                return next;
            });
        }
    };

    // Sector Management with AC (EC) and pH Telemetry
    const handleToggleSector = (sectorId: string) => {
        const exists = selectedSectors.find(s => s.sectorId === sectorId);
        if (exists) {
            setSelectedSectors(prev => prev.filter(s => s.sectorId !== sectorId));
        } else {
            const sec = sectors.find(s => s.id === sectorId);
            setSelectedSectors(prev => [...prev, {
                sectorId,
                sectorName: sec?.name || 'Sector',
                durationMinutes: 50,
                ec: activePlan?.targetEC !== undefined ? activePlan.targetEC : 1.6,
                ph: activePlan?.targetPH !== undefined ? activePlan.targetPH : 5.8
            }]);
        }
    };

    const handleUpdateSectorDuration = (sectorId: string, duration: number) => {
        setSelectedSectors(prev => prev.map(s => s.sectorId === sectorId ? { ...s, durationMinutes: Math.max(1, duration) } : s));
    };

    const handleUpdateSectorEC = (sectorId: string, ec: number) => {
        setSelectedSectors(prev => prev.map(s => s.sectorId === sectorId ? { ...s, ec } : s));
    };

    const handleUpdateSectorPH = (sectorId: string, ph: number) => {
        setSelectedSectors(prev => prev.map(s => s.sectorId === sectorId ? { ...s, ph } : s));
    };

    // 1-Click Sync All Sectors to Active Recipe Target EC & pH
    const handleSyncAllSectorsECPH = () => {
        const targetEC = activePlan?.targetEC !== undefined ? activePlan.targetEC : 1.6;
        const targetPH = activePlan?.targetPH !== undefined ? activePlan.targetPH : 5.8;
        setSelectedSectors(prev => prev.map(s => ({
            ...s,
            ec: targetEC,
            ph: targetPH
        })));
    };

    // Refill All Tanks from Active Recipe
    const handleRefillAllFromRecipe = () => {
        if (activePlan?.tankConfigs && activePlan.tankConfigs.length > 0) {
            handleApplyRecipeBlueprint(activePlan);
        } else {
            setTanks(prev => prev.map(t => ({
                ...t,
                currentVolumeLiters: t.preparedWaterLiters || t.capacityLiters,
                status: 'ACTIVE'
            })));
            const resetEndVols: { [id: string]: number } = {};
            tanks.forEach(t => {
                resetEndVols[t.id] = t.preparedWaterLiters || t.capacityLiters;
            });
            setCurrentEndVolumes(resetEndVols);

            setActiveCycle({
                cycleId: `cycle-${Date.now()}`,
                recipeId: selectedRecipeId,
                recipeName: activePlan?.name || 'Standard Feeding',
                startedAt: new Date().toISOString(),
                feedings: [],
                isFinished: false
            });
        }
    };

    // Push Finish Button: Commit 1 Feeding Run, Log History with EC/pH, Deduct Stock, and Update Tanks
    const handleCommitFeedingRun = () => {
        const activeEnabledDetails = consumptionSummary.details.filter(d => d.isEnabled);

        if (activeEnabledDetails.every(d => d.consumedLiters === 0)) {
            alert('No fertilizer consumption recorded from active tanks. Please adjust tank levels or click "Execute 1 Auto Feed".');
            return;
        }

        const totalDuration = selectedSectors.reduce((sum, s) => sum + s.durationMinutes, 0);
        const currentFeedingNumber = activeCycle.feedings.length + 1;

        // 1. Update Master Stock Inventory (Deduct only exact consumed kg from enabled tanks)
        if (onSetInventoryItems) {
            const updatedStock = [...inventoryItems];
            let changed = false;

            activeEnabledDetails.forEach(tank => {
                tank.consumedMaterials.forEach(mat => {
                    if (mat.consumedKg > 0) {
                        const stockIdx = updatedStock.findIndex(i => i.id === mat.inventoryItemId || i.name.toLowerCase() === mat.name.toLowerCase());
                        if (stockIdx !== -1) {
                            const item = updatedStock[stockIdx];
                            const isContainer = (item.packageContent && item.packageContent > 0) || ['bag', 'bags', 'sack', 'bottle', 'can', 'drum'].includes((item.unitOfMeasure || '').toLowerCase());
                            
                            let deduction = mat.consumedKg;
                            if (isContainer && item.packageContent && item.packageContent > 0) {
                                deduction = mat.consumedKg / item.packageContent;
                            }
                            
                            item.currentStock = Math.max(0, Math.round((item.currentStock - deduction) * 100) / 100);
                            changed = true;
                        }
                    }
                });
            });

            if (changed) {
                onSetInventoryItems(updatedStock);
            }
        }

        // 2. Update Virtual Tank Ledgers
        const updatedTanks = tanks.map(tank => {
            if (tank.isEnabled === false) {
                return tank;
            }

            const endVol = currentEndVolumes[tank.id] !== undefined ? currentEndVolumes[tank.id] : tank.currentVolumeLiters;
            const isDepleted = endVol <= 0;

            if (isDepleted) {
                return {
                    ...tank,
                    currentVolumeLiters: 0,
                    status: 'DEPLETED' as const,
                    materials: tank.materials.map(m => ({ ...m, dissolvedKg: 0 }))
                };
            } else {
                const consumedDetail = consumptionSummary.details.find(d => d.tankId === tank.id);
                const updatedMaterials = tank.materials.map(mat => {
                    const consumed = consumedDetail?.consumedMaterials.find(m => m.name === mat.name)?.consumedKg || 0;
                    return {
                        ...mat,
                        dissolvedKg: Math.max(0, Math.round((mat.dissolvedKg - consumed) * 100) / 100)
                    };
                });

                return {
                    ...tank,
                    currentVolumeLiters: endVol,
                    status: 'ACTIVE' as const,
                    materials: updatedMaterials
                };
            }
        });

        setTanks(updatedTanks);

        // 3. Prepare Materials breakdown for this run
        const runMaterials: { name: string; inventoryItemId?: string; consumedKg: number; cost: number }[] = [];
        activeEnabledDetails.forEach(tank => {
            tank.consumedMaterials.forEach(mat => {
                if (mat.consumedKg > 0) {
                    runMaterials.push({
                        name: mat.name,
                        inventoryItemId: mat.inventoryItemId,
                        consumedKg: mat.consumedKg,
                        cost: mat.cost
                    });
                }
            });
        });

        // 4. Record Feeding in Active Cycle
        const newFeedingRecord: FeedingCycleRecord = {
            feedingNumber: currentFeedingNumber,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: sessionDate,
            totalWaterLiters: consumptionSummary.totalConsumedLiters,
            totalCost: consumptionSummary.totalCost,
            sectors: selectedSectors.map(s => ({
                sectorId: s.sectorId,
                sectorName: s.sectorName || 'Sector',
                durationMinutes: s.durationMinutes,
                ec: s.ec,
                ph: s.ph
            })),
            materials: runMaterials,
            tankBreakdown: activeEnabledDetails.map(t => ({
                tankId: t.tankId,
                tankName: t.tankName,
                consumedLiters: t.consumedLiters,
                materials: t.consumedMaterials.map(m => ({ name: m.name, consumedKg: m.consumedKg }))
            }))
        };

        const updatedFeedings = [...activeCycle.feedings, newFeedingRecord];
        const allNowDepleted = updatedTanks.filter(t => t.isEnabled !== false).every(t => t.currentVolumeLiters <= 0);

        setActiveCycle(prev => ({
            ...prev,
            feedings: updatedFeedings,
            isFinished: allNowDepleted
        }));

        // 5. Create PlanExecution record in master logs with sector measurements (AC & pH)
        const executionRecord: PlanExecution = {
            id: `nutriexec-tank-${Date.now()}`,
            planId: selectedRecipeId || 'plan-system-feeding',
            date: sessionDate,
            sectorIds: selectedSectors.map(s => s.sectorId),
            executedByEmployeeId: operatorId || undefined,
            actualWaterLiters: consumptionSummary.totalConsumedLiters,
            cycleFeedingNumber: currentFeedingNumber,
            totalCost: consumptionSummary.totalCost,
            sectorMeasurements: selectedSectors.map(s => ({
                sectorId: s.sectorId,
                sectorName: s.sectorName,
                durationMinutes: s.durationMinutes,
                ec: s.ec !== undefined ? s.ec : (activePlan?.targetEC || 1.6),
                ph: s.ph !== undefined ? s.ph : (activePlan?.targetPH || 5.8)
            })),
            notes: `[System Feeding #${currentFeedingNumber}] Total: ${totalDuration} min across ${selectedSectors.length} sectors. Active Tanks: ${activeEnabledDetails.map(d => `${d.tankName}: ${d.consumedLiters}L`).join(', ')}. ${sessionNotes}`,
            actualElements: activeEnabledDetails.flatMap(d => 
                d.consumedMaterials.map(m => ({
                    inventoryItemId: m.inventoryItemId || '',
                    newItemName: m.name,
                    quantity: m.consumedKg,
                    actualQuantity: m.consumedKg,
                    unit: 'kg',
                    stockDeduction: m.consumedKg
                }))
            )
        };

        onSetPlanExecutions([...planExecutions, executionRecord]);

        // Reset current end volumes to the new current volume for remaining tanks
        const nextEndVols: { [id: string]: number } = {};
        updatedTanks.forEach(t => {
            nextEndVols[t.id] = t.currentVolumeLiters;
        });
        setCurrentEndVolumes(nextEndVols);

        if (allNowDepleted) {
            setShowCycleCompleteModal(true);
        } else {
            setShowSuccessModal({
                feedingNumber: currentFeedingNumber,
                summary: consumptionSummary,
                sectorsCount: selectedSectors.length,
                duration: totalDuration,
                cost: consumptionSummary.totalCost,
                totalConsumedLiters: consumptionSummary.totalConsumedLiters,
                executionRecord
            });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in text-slate-800">
            {/* Top Control Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl border border-indigo-900/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Live Fertigation Engine / ფერტიგაციის მართვა
                            </span>
                            <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-black uppercase tracking-widest">
                                Cycle #{activeCycle.feedings.length + 1} • {activeCycle.feedings.length} Feedings Done / ჩატარებული კვება
                            </span>
                            {cycleCumulativeStats.allEnabledDepleted && (
                                <span className="px-3 py-1 rounded-full bg-amber-500/30 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase tracking-widest animate-bounce">
                                    🏆 All Tanks Finished / ყველა ავზი დაცლილია
                                </span>
                            )}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2 flex items-center gap-3">
                            🚜 System Feeding & Active Tank Monitor
                        </h2>
                        <p className="text-xs md:text-sm text-slate-300 max-w-2xl mt-1">
                            Visual tank manifold. Refill tanks with exact recipe inputs, toggle active vs disabled tanks, calibrate feedings per 1000L batch, and monitor per-sector AC (EC) & pH uniformity. / ავზების ვიზუალური მართვა. ავზების შევსება რეცეპტით, აქტიური/გათიშული ავზები, პარტიის კალიბრაცია და სექტორული EC & pH მონიტორინგი.
                        </p>
                    </div>

                    {/* Quick Mode & Tank Actions */}
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setExecutionMode('MANUAL')}
                                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    executionMode === 'MANUAL'
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                🖐️ Manual
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setExecutionMode('AUTO');
                                    handleExecuteAutoRun();
                                }}
                                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                    executionMode === 'AUTO'
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                ⚡ Auto Calc
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleRefillAllFromRecipe}
                            className="px-4 py-2.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                            title="Refill all active tanks from selected purpose"
                        >
                            <ArrowPathIcon className="w-4 h-4" /> Refill All (სავსე)
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsAddTankOpen(true)}
                            className="px-4 py-2.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                        >
                            <PlusIcon className="w-4 h-4" /> + Add Tank / ავზის დამატება
                        </button>
                    </div>
                </div>

                {/* Session Configuration Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs">
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                1. Purpose / Recipe (რეცეპტი)
                            </label>
                            {activePlan?.tankConfigs && activePlan.tankConfigs.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleApplyRecipeBlueprint()}
                                    className="text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    📥 Load Blueprint / ჩატვირთვა
                                </button>
                            )}
                        </div>
                        <select
                            value={selectedRecipeId}
                            onChange={e => handleRecipeSelect(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="">-- Custom Field Mix / თავისუფალი ნაზავი --</option>
                            {nutritionPlans.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.purpose}) {p.tankConfigs?.length ? `• ${p.tankConfigs.length} Tanks` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                            2. Date of Feeding (თარიღი)
                        </label>
                        <input
                            type="date"
                            value={sessionDate}
                            onChange={e => setSessionDate(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                            3. Operator in Charge (ოპერატორი)
                        </label>
                        <select
                            value={operatorId}
                            onChange={e => setOperatorId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="">-- Select Operator / აირჩიეთ ოპერატორი --</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} ({emp.role})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                            4. Target Water / EC & pH Specs / პარამეტრები
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1.5 bg-slate-800 rounded-xl border border-slate-700 text-slate-300 font-bold text-[11px] flex-1 text-center">
                                EC: <strong className="text-emerald-400">{activePlan?.targetEC || '1.6'}</strong>
                            </span>
                            <span className="px-2.5 py-1.5 bg-slate-800 rounded-xl border border-slate-700 text-slate-300 font-bold text-[11px] flex-1 text-center">
                                pH: <strong className="text-amber-400">{activePlan?.targetPH || '5.8'}</strong>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Cycle Progress & Summary Card */}
            {activeCycle.feedings.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-900/90 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/30">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-indigo-800/60">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                                <SparklesIcon className="w-4 h-4" /> Active Batch Cycle Progress / მიმდინარე ციკლის პროგრესი
                            </div>
                            <h3 className="text-xl font-black mt-1">
                                {activeCycle.feedings.length} Feeding{activeCycle.feedings.length === 1 ? '' : 's'} Made in this Batch
                            </h3>
                            <p className="text-xs text-indigo-200">
                                Purpose / მიზანი: <strong>{activeCycle.recipeName}</strong> • Total Water / წყალი: <strong>{cycleCumulativeStats.totalWater} L</strong> • Total Cost / ღირებულება: <strong>{formatCurrency(cycleCumulativeStats.totalCost)}</strong>
                            </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setShowCycleCompleteModal(true)}
                                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                📊 View Total Usage & Details / დეტალები
                            </button>
                            <button
                                type="button"
                                onClick={handleRefillAllFromRecipe}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                🔄 Start Next Cycle / ახალი ციკლი
                            </button>
                        </div>
                    </div>

                    {/* Cumulative Material Totals Pill Matrix */}
                    <div className="mt-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block mb-2">
                            Total Cumulative Fertilizers Consumed Across All {activeCycle.feedings.length} Feedings / ჯამური სასუქები:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            {cycleCumulativeStats.materialSummary.map((mat, idx) => (
                                <div key={idx} className="p-2.5 bg-slate-800/80 rounded-xl border border-indigo-500/20 flex flex-col justify-between">
                                    <div className="text-[11px] font-bold text-slate-200 truncate" title={mat.name}>
                                        {mat.name}
                                    </div>
                                    <div className="mt-1 flex justify-between items-baseline">
                                        <span className="text-sm font-black text-emerald-400">{mat.totalKg} kg</span>
                                        <span className="text-[10px] text-slate-400 font-bold">{formatCurrency(mat.totalCost)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Visual Tank Cluster Matrix */}
            <div>
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <div>
                        <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                            <BeakerIcon className="w-5 h-5 text-indigo-600" />
                            Active Fertigation Tanks ({tanks.filter(t => t.isEnabled !== false).length} / {tanks.length} In Use)
                        </h3>
                        <p className="text-xs text-slate-500">
                            Tanks in purpose are enabled and calculated. Disabled tanks are safely bypassed and won't deduct stock. / რეცეპტის ავზები აქტიურია და ითვლება. გათიშული ავზებიდან ჩამოწერა არ მოხდება.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleEnableAllTanks}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                        >
                            Enable All Tanks / ყველას ჩართვა
                        </button>
                        {executionMode === 'AUTO' && (
                            <button
                                type="button"
                                onClick={handleExecuteAutoRun}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all cursor-pointer"
                            >
                                ⚡ Auto Feed Next Portion (ერთი კვება)
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {tanks.map((tank) => {
                        const isEnabled = tank.isEnabled !== false;
                        const startVol = tank.currentVolumeLiters;
                        const endVol = isEnabled ? (currentEndVolumes[tank.id] !== undefined ? currentEndVolumes[tank.id] : startVol) : startVol;
                        const fillPercent = tank.capacityLiters > 0 ? Math.round((endVol / tank.capacityLiters) * 100) : 0;
                        const consumedLiters = isEnabled ? Math.max(0, startVol - endVol) : 0;
                        const isDepleted = isEnabled && endVol <= 0;
                        const feedings = tank.expectedFeedingsPerBatch || 1;

                        const themeGradients = {
                            emerald: 'from-emerald-500 to-teal-600 border-emerald-400',
                            blue: 'from-blue-500 to-indigo-600 border-blue-400',
                            purple: 'from-purple-500 to-pink-600 border-purple-400',
                            amber: 'from-amber-500 to-orange-600 border-amber-400',
                            cyan: 'from-cyan-500 to-blue-600 border-cyan-400'
                        };
                        const activeGradient = themeGradients[tank.colorTheme || 'emerald'];

                        return (
                            <div
                                key={tank.id}
                                className={`rounded-3xl p-5 shadow-xl border flex flex-col justify-between transition-all duration-300 relative group ${
                                    isEnabled 
                                        ? 'bg-white border-slate-100 hover:shadow-2xl' 
                                        : 'bg-slate-50 border-slate-200 opacity-75'
                                }`}
                            >
                                {/* Tank Top Header with Enable / Disable Toggle */}
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                                    {tank.type.toUpperCase()} • {tank.capacityLiters} L
                                                </span>
                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                                    {feedings} {feedings === 1 ? 'Feed' : 'Feeds'} / Batch
                                                </span>
                                            </div>
                                            <h4 className="text-base font-black text-slate-900 mt-1">{tank.name}</h4>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setEditingTank(tank)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                                title="Edit Tank Properties / ავზის რედაქტირება"
                                            >
                                                <PencilSquareIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTank(tank.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                                title="Delete Tank / წაშლა"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Enable / Disable Switch Banner */}
                                    <div className="mt-3 flex items-center justify-between p-2 rounded-xl bg-slate-100/80 border border-slate-200/80">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                                                {isEnabled ? 'In Use (გამოიყენება)' : 'Disabled (გამორთული)'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleTankEnabled(tank.id)}
                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                isEnabled
                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                    : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                                            }`}
                                        >
                                            {isEnabled ? 'ON' : 'OFF'}
                                        </button>
                                    </div>

                                    {/* Visual Realistic Tank Illustration */}
                                    <div className="mt-4 flex items-center justify-center">
                                        <div className={`relative w-36 h-48 rounded-3xl border-4 shadow-inner flex flex-col justify-end overflow-hidden ${
                                            isEnabled ? 'bg-slate-100 border-slate-300/80' : 'bg-slate-200 border-slate-300'
                                        }`}>
                                            {/* Measurement Gauge Ticks */}
                                            <div className="absolute inset-y-0 right-1.5 flex flex-col justify-between py-3 pointer-events-none z-20">
                                                <span className="text-[8px] font-black text-slate-400">100%</span>
                                                <span className="text-[8px] font-black text-slate-400">75%</span>
                                                <span className="text-[8px] font-black text-slate-400">50%</span>
                                                <span className="text-[8px] font-black text-slate-400">25%</span>
                                                <span className="text-[8px] font-black text-slate-400">0%</span>
                                            </div>

                                            {/* Liquid Fill Element */}
                                            {isEnabled ? (
                                                <div
                                                    className={`w-full transition-all duration-500 bg-gradient-to-t ${activeGradient} relative flex items-center justify-center`}
                                                    style={{ height: `${fillPercent}%` }}
                                                >
                                                    {fillPercent > 0 && (
                                                        <div className="absolute top-0 inset-x-0 h-2 bg-white/30 rounded-full animate-pulse"></div>
                                                    )}
                                                    <div className="text-center z-10 text-white font-black drop-shadow text-xs">
                                                        {fillPercent}%
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-300/60 p-2 text-center">
                                                    <span className="px-2 py-1 bg-slate-600 text-white text-[9px] font-black uppercase rounded-lg shadow">
                                                        STANDBY / BYPASS
                                                    </span>
                                                    <span className="text-[8px] text-slate-500 mt-1 font-bold">Not in purpose</span>
                                                </div>
                                            )}

                                            {/* Status Stamp if Empty */}
                                            {isEnabled && fillPercent === 0 && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px]">
                                                    <span className="px-2 py-1 bg-red-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg">
                                                        DEPLETED (0%)
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Volume Readouts */}
                                    <div className="grid grid-cols-2 gap-2 mt-4 text-center">
                                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="text-[9px] font-bold text-slate-400 uppercase">Start Level / საწყისი</div>
                                            <div className="text-xs font-black text-slate-700">{startVol} L</div>
                                        </div>
                                        <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                                            <div className="text-[9px] font-bold text-indigo-500 uppercase">After Finish / დასრულებისას</div>
                                            <div className="text-xs font-black text-indigo-700">{endVol} L</div>
                                        </div>
                                    </div>

                                    {/* Quick Discrete Presets */}
                                    <div className="mt-3">
                                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                                            Status After Irrigation:
                                        </label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {PRESETS.map(preset => {
                                                const targetVol = Math.round(tank.preparedWaterLiters * preset.fraction);
                                                const isCurrentSelected = isEnabled && endVol === targetVol;

                                                return (
                                                    <button
                                                        key={preset.key}
                                                        type="button"
                                                        disabled={!isEnabled}
                                                        onClick={() => handleSetPreset(tank.id, preset.fraction)}
                                                        className={`py-1.5 px-1 rounded-lg text-[10px] font-black transition-all border cursor-pointer ${
                                                            !isEnabled
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                : isCurrentSelected
                                                                    ? `${preset.badgeColor} border-transparent shadow-md scale-[1.02]`
                                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {preset.label.split(' ')[0]}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Dissolved Ingredients & Consumption Delta */}
                                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex justify-between">
                                            <span>Active Recipe Ingredients:</span>
                                            <span className="text-emerald-600 font-bold">
                                                {isEnabled ? `Δ ${consumedLiters} L Consumed` : 'Bypassed (0 L)'}
                                            </span>
                                        </div>

                                        {tank.materials.map((mat, idx) => {
                                            const conc = mat.activeConcentrationKgPerL || (mat.dissolvedKg / (tank.preparedWaterLiters || 1));
                                            const singleRunConsumedKg = isEnabled ? Math.round(consumedLiters * conc * 100) / 100 : 0;
                                            const remainingKg = Math.max(0, Math.round((mat.dissolvedKg - singleRunConsumedKg) * 100) / 100);

                                            return (
                                                <div key={idx} className="p-2 bg-slate-50 rounded-xl text-xs space-y-1">
                                                    <div className="font-bold text-slate-800 text-[11px] truncate">
                                                        {mat.name}
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-emerald-600 font-bold">
                                                            - {singleRunConsumedKg} kg (Charged)
                                                        </span>
                                                        <span className="text-slate-400 font-medium">
                                                            {remainingKg} kg left
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {tank.materials.length === 0 && (
                                            <div className="p-3 bg-amber-50 rounded-xl text-center text-amber-700 text-xs font-bold">
                                                Tank is empty. Click "Mix / Refill" to fill from warehouse stock / ავზი ცარიელია. დააჭირეთ "შევსება"-ს.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Tank Bottom Actions */}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                                    <button
                                        type="button"
                                        disabled={!isEnabled}
                                        onClick={() => handleMarkDepleted(tank.id)}
                                        className="flex-1 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:hover:bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                        Mark Empty (0%) / დაცლა
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMixingTank(tank)}
                                        className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <ArrowPathIcon className="w-3 h-3" /> Mix / Refill / შევსება
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sectors & Timings Matrix with AC (EC) & pH Telemetry Inputs */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                                <ClockIcon className="w-5 h-5 text-emerald-600" />
                                Target Plantation Sectors & Irrigation Duration / სამიზნე სექტორები & მორწყვის დრო
                            </h3>
                            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-black text-[9px] uppercase tracking-wider flex items-center gap-1">
                                <SparklesIcon className="w-3 h-3" /> AC / EC & pH Ready
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Set irrigation duration (minutes), Electrical Conductivity (AC/EC), and pH per sector to monitor purpose uniformity across the farm. / მიუთითეთ მორწყვის ხანგრძლივობა (წთ), ელექტროგამტარობა (EC/AC) და pH სექტორების მიხედვით.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleSyncAllSectorsECPH}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                            title="Sync all sectors with purpose recipe target EC & pH"
                        >
                            ⚡ Sync Target EC/pH / EC & pH სინქრონიზაცია
                        </button>
                        <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
                            Total / სულ: {selectedSectors.reduce((acc, s) => acc + s.durationMinutes, 0)} Min / წთ
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {sectors.map(sec => {
                        const isSelected = selectedSectors.some(s => s.sectorId === sec.id);
                        const currentEntry = selectedSectors.find(s => s.sectorId === sec.id);

                        return (
                            <div
                                key={sec.id}
                                className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                                    isSelected
                                        ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-200 shadow-sm'
                                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex justify-between items-center">
                                    <label
                                        onClick={() => handleToggleSector(sec.id)}
                                        className="font-black text-xs text-slate-900 cursor-pointer flex items-center gap-2 select-none"
                                    >
                                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                                            isSelected ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                                        }`}>
                                            {isSelected && <CheckIcon className="w-3 h-3" />}
                                        </div>
                                        <span className="truncate">{sec.name}</span>
                                    </label>
                                </div>

                                {isSelected && (
                                    <div className="space-y-2 pt-1 border-t border-emerald-200/60">
                                        {/* Duration */}
                                        <div>
                                            <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
                                                <span>Duration / ხანგრძლივობა:</span>
                                                <span>{currentEntry?.durationMinutes || 50} min / წთ</span>
                                            </div>
                                            <input
                                                type="number"
                                                value={currentEntry?.durationMinutes || 50}
                                                onChange={e => handleUpdateSectorDuration(sec.id, parseInt(e.target.value) || 0)}
                                                className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-slate-900 text-center mt-0.5"
                                            />
                                        </div>

                                        {/* AC / EC & pH Telemetry fields */}
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <div>
                                                <span className="text-[9px] font-black text-emerald-700 uppercase block">
                                                    EC (AC)
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={currentEntry?.ec !== undefined ? currentEntry.ec : 1.6}
                                                    onChange={e => handleUpdateSectorEC(sec.id, parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-white border border-emerald-300 rounded-lg px-1.5 py-1 text-xs font-black text-emerald-700 text-center"
                                                    placeholder="1.6"
                                                />
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-black text-amber-700 uppercase block">
                                                    pH
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={currentEntry?.ph !== undefined ? currentEntry.ph : 5.8}
                                                    onChange={e => handleUpdateSectorPH(sec.id, parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-white border border-amber-300 rounded-lg px-1.5 py-1 text-xs font-black text-amber-700 text-center"
                                                    placeholder="5.8"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Consumption Impact & Master Stock Charge Panel */}
            <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl space-y-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                            <SparklesIcon className="w-4 h-4" /> Live Warehouse Stock Charge / საწყობიდან ჩამოწერა
                        </div>
                        <h3 className="text-xl md:text-2xl font-black mt-1">
                            Feeding Run #{activeCycle.feedings.length + 1} Stock Charge Summary / კვების ჩამოწერის შეჯამება
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Charges only fertilizers consumed from ACTIVE / IN USE tanks for this specific feeding. / ჩამოიწერება მხოლოდ აქტიური ავზებიდან რეალურად გახარჯული სასუქები.
                        </p>
                    </div>

                    <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Run Cost / ჯამური ღირებულება</div>
                        <div className="text-2xl font-black text-amber-400">{formatCurrency(consumptionSummary.totalCost)}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {consumptionSummary.details.map(d => (
                        <div key={d.tankId} className={`p-4 rounded-2xl border space-y-2 ${
                            d.isEnabled ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/40 border-slate-800 opacity-60'
                        }`}>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-xs text-white">{d.tankName}</span>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                    !d.isEnabled ? 'bg-slate-700 text-slate-400' :
                                    d.isDepleted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                    {!d.isEnabled ? 'Bypassed / გამოტოვებული' : d.isDepleted ? 'Depleted (0 L) / დაცლილი' : `${d.consumedLiters} L Used / გახარჯული`}
                                </span>
                            </div>

                            <div className="space-y-1 pt-2 border-t border-slate-700 text-xs">
                                {d.consumedMaterials.map((m, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-300 truncate max-w-[130px]">{m.name}</span>
                                        <span className="font-black text-emerald-400">{m.consumedKg} kg</span>
                                    </div>
                                ))}
                                {d.consumedMaterials.length === 0 && (
                                    <div className="text-[10px] text-slate-500 italic">
                                        {!d.isEnabled ? 'Tank is disabled / ავზი გათიშულია' : 'No consumption / ხარჯის გარეშე'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Final Execution Button */}
                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-slate-400 text-center sm:text-left">
                        * Pushing Finish completes 1 feeding run, logs treatment history with AC & pH, and writes down exact fertilizer kg from the warehouse. / ღილაკზე დაჭერით დასრულდება 1 კვება, აღირიცხება ისტორიაში და ჩამოიწერება სასუქები საწყობიდან.
                    </p>
                    <button
                        type="button"
                        onClick={handleCommitFeedingRun}
                        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <ShieldCheckIcon className="w-5 h-5" /> Finish Feeding #{activeCycle.feedings.length + 1} & Log Stock Charge / კვების დასრულება & ჩამოწერა
                    </button>
                </div>
            </div>

            {/* Refill / Mix Batch Modal */}
            {mixingTank && (
                <div className="fixed inset-0 bg-black/70 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setMixingTank(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-black">Mix New Batch & Fill Tank / ახალი პარტიის მომზადება & ავზის შევსება</h3>
                                <p className="text-xs text-slate-400">
                                    {mixingTank.name} • Capacity / ტევადობა: {mixingTank.capacityLiters} L • Selected Purpose / მიზანი: <strong>{activePlan?.name || 'Standard Mix'}</strong>
                                </p>
                            </div>
                            <button onClick={() => setMixingTank(null)} className="text-slate-400 hover:text-white text-lg cursor-pointer">✕</button>
                        </div>

                        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Water Prepared (Liters) / მომზადებული წყალი (ლიტრი)</label>
                                    <input
                                        type="number"
                                        value={mixingWaterLiters}
                                        onChange={e => setMixingWaterLiters(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-slate-800"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Expected Feedings / Batch / კვების რაოდენობა / პარტია</label>
                                    <input
                                        type="number"
                                        value={mixingExpectedFeedings}
                                        onChange={e => setMixingExpectedFeedings(parseFloat(e.target.value) || 1)}
                                        step="0.5"
                                        min="1"
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-slate-800"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Fertilizer Inputs */}
                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <label className="font-black text-slate-900 block text-xs uppercase tracking-wider">
                                            Dissolved Inputs (from Warehouse Stock) / გახსნილი სასუქები (საწყობიდან)
                                        </label>
                                        <span className="text-[10px] text-indigo-600 font-bold">
                                            ✓ Auto-loaded from "{activePlan?.name || 'Selected Recipe'}" for this tank / ჩატვირთულია რეცეპტიდან
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setMixingIngredients(prev => [...prev, { name: '', dissolvedKg: 0 }])}
                                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                    >
                                        <PlusIcon className="w-3 h-3" /> + Add Ingredient / ინგრედიენტის დამატება
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {mixingIngredients.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 rounded-2xl border border-slate-200">
                                            <div className="col-span-7">
                                                <input
                                                    list="mix-mat-list"
                                                    value={item.name}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const found = inventoryItems.find(i => i.name.toLowerCase() === val.toLowerCase());
                                                        setMixingIngredients(prev => prev.map((ing, i) => i === idx ? {
                                                            ...ing,
                                                            name: val,
                                                            inventoryItemId: found?.id || ing.inventoryItemId
                                                        } : ing));
                                                    }}
                                                    placeholder={`Ingredient / ინგრედიენტი ${idx + 1} (მაგ. კალიუმის სულფატი)`}
                                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-xs"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.dissolvedKg}
                                                        onChange={e => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setMixingIngredients(prev => prev.map((ing, i) => i === idx ? {
                                                                ...ing,
                                                                dissolvedKg: val
                                                            } : ing));
                                                        }}
                                                        placeholder="kg / კგ"
                                                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 font-black text-center text-xs"
                                                    />
                                                    <span className="text-[10px] font-bold text-slate-500">kg / კგ</span>
                                                </div>
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setMixingIngredients(prev => prev.filter((_, i) => i !== idx))}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                                    title="Remove Ingredient / წაშლა"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <datalist id="mix-mat-list">
                                    {inventoryItems.map(i => (
                                        <option key={i.id} value={i.name}>{i.name} (Stock / ნაშთი: {i.currentStock} {i.unitOfMeasure})</option>
                                    ))}
                                </datalist>
                            </div>

                            {/* Concentration summary banner */}
                            <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-2xl text-[11px] space-y-1">
                                <div className="font-bold flex justify-between">
                                    <span>Calculated Active Concentration / გათვლილი აქტიური კონცენტრაცია:</span>
                                    <span>
                                        Total Dissolved / სულ გახსნილი: {mixingIngredients.reduce((sum, i) => sum + (i.dissolvedKg || 0), 0).toFixed(2)} kg
                                    </span>
                                </div>
                                <div className="text-[10px] text-indigo-700">
                                    {mixingIngredients.filter(i => i.name && i.dissolvedKg > 0).map(i => 
                                        `${i.name}: ${(i.dissolvedKg / (mixingWaterLiters || 1)).toFixed(4)} kg/L`
                                    ).join(' • ') || 'No ingredients added / ინგრედიენტები არ არის დამატებული'}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t flex justify-end gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setMixingTank(null)}
                                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs cursor-pointer"
                            >
                                Cancel / გაუქმება
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const waterLiters = mixingWaterLiters > 0 ? mixingWaterLiters : mixingTank.capacityLiters;
                                    const feedings = mixingExpectedFeedings > 0 ? mixingExpectedFeedings : 1;

                                    const newMaterials: TankDissolvedMaterial[] = mixingIngredients
                                        .filter(ing => ing.name.trim() !== '' && ing.dissolvedKg > 0)
                                        .map(ing => ({
                                            inventoryItemId: ing.inventoryItemId || '',
                                            name: ing.name.trim(),
                                            dissolvedKg: ing.dissolvedKg,
                                            activeConcentrationKgPerL: ing.dissolvedKg / waterLiters
                                        }));

                                    setTanks(prev => prev.map(t => t.id === mixingTank.id ? {
                                        ...t,
                                        currentVolumeLiters: waterLiters,
                                        preparedWaterLiters: waterLiters,
                                        expectedFeedingsPerBatch: feedings,
                                        autoCycleFactor: 1 / feedings,
                                        status: 'ACTIVE',
                                        isEnabled: true,
                                        materials: newMaterials
                                    } : t));

                                    setCurrentEndVolumes(prev => ({
                                        ...prev,
                                        [mixingTank.id]: waterLiters
                                    }));

                                    setMixingTank(null);
                                }}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <CheckIcon className="w-4 h-4" /> CONFIRM BATCH & REFILL / პარტიის დადასტურება & შევსება
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add New Custom Tank Modal */}
            {isAddTankOpen && (
                <div className="fixed inset-0 bg-black/70 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsAddTankOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black">Add New Fertigation Tank / ახალი ავზის დამატება</h3>
                                <p className="text-xs text-slate-400">Configure tank capacity and type / პარამეტრების კონფიგურაცია</p>
                            </div>
                            <button onClick={() => setIsAddTankOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
                        </div>

                        <form
                            onSubmit={e => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const name = formData.get('name') as string;
                                const capacity = parseFloat(formData.get('capacity') as string) || 1000;
                                const type = formData.get('type') as any;
                                const colorTheme = formData.get('colorTheme') as any;
                                const feedings = parseFloat(formData.get('feedings') as string) || 1;

                                const newTank: FertigationTank = {
                                    id: `tank-${Date.now()}`,
                                    name,
                                    type,
                                    capacityLiters: capacity,
                                    currentVolumeLiters: capacity,
                                    preparedWaterLiters: capacity,
                                    expectedFeedingsPerBatch: feedings,
                                    autoCycleFactor: 1 / feedings,
                                    status: 'ACTIVE',
                                    isEnabled: true,
                                    colorTheme,
                                    materials: []
                                };

                                setTanks(prev => [...prev, newTank]);
                                setCurrentEndVolumes(prev => ({ ...prev, [newTank.id]: capacity }));
                                setIsAddTankOpen(false);
                            }}
                            className="p-6 space-y-4 text-xs"
                        >
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Tank Name / Identifier / ავზის სახელი</label>
                                <input
                                    name="name"
                                    defaultValue={`Tank ${String.fromCharCode(65 + tanks.length)}`}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Capacity (Liters) / მოცულობა (ლ)</label>
                                    <input
                                        name="capacity"
                                        type="number"
                                        defaultValue={1000}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-center"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Feedings / Batch / კვება / პარტია</label>
                                    <input
                                        name="feedings"
                                        type="number"
                                        defaultValue={1}
                                        step="0.5"
                                        min="1"
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-center"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Tank Type / ავზის ტიპი</label>
                                    <select name="type" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold">
                                        <option value="fertilizer">Fertilizer Tank / სასუქის ავზი</option>
                                        <option value="mixer">EC Booster / Mixer / მიქსერი</option>
                                        <option value="acid">pH Acid Tank / მჟავის ავზი</option>
                                        <option value="custom">Custom Injection / ინექცია</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Color Theme / ფერი</label>
                                    <select name="colorTheme" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold">
                                        <option value="emerald">Emerald Green / ზურმუხტისფერი</option>
                                        <option value="blue">Royal Blue / ლურჯი</option>
                                        <option value="purple">Purple / იასამნისფერი</option>
                                        <option value="amber">Amber / ნარინჯისფერი</option>
                                        <option value="cyan">Cyan / ცისფერი</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button type="button" onClick={() => setIsAddTankOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-xl font-bold cursor-pointer">
                                    Cancel / გაუქმება
                                </button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer">
                                    Create Tank / ავზის შექმნა
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Tank Properties Modal */}
            {editingTank && (
                <div className="fixed inset-0 bg-black/70 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingTank(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black">Edit Tank Properties / ავზის რედაქტირება</h3>
                                <p className="text-xs text-slate-400">{editingTank.name}</p>
                            </div>
                            <button onClick={() => setEditingTank(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
                        </div>

                        <form
                            onSubmit={e => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const name = formData.get('name') as string;
                                const capacity = parseFloat(formData.get('capacity') as string) || editingTank.capacityLiters;
                                const feedings = parseFloat(formData.get('feedings') as string) || (editingTank.expectedFeedingsPerBatch || 1);
                                const colorTheme = formData.get('colorTheme') as any;

                                setTanks(prev => prev.map(t => t.id === editingTank.id ? {
                                    ...t,
                                    name,
                                    capacityLiters: capacity,
                                    expectedFeedingsPerBatch: feedings,
                                    autoCycleFactor: 1 / feedings,
                                    colorTheme
                                } : t));

                                setEditingTank(null);
                            }}
                            className="p-6 space-y-4 text-xs"
                        >
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Tank Name / ავზის სახელი</label>
                                <input
                                    name="name"
                                    defaultValue={editingTank.name}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Capacity (Liters) / მოცულობა (ლ)</label>
                                    <input
                                        name="capacity"
                                        type="number"
                                        defaultValue={editingTank.capacityLiters}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-center"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Feedings / Batch / კვება / პარტია</label>
                                    <input
                                        name="feedings"
                                        type="number"
                                        defaultValue={editingTank.expectedFeedingsPerBatch || 1}
                                        step="0.5"
                                        min="1"
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-center"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Color Theme / ფერი</label>
                                <select name="colorTheme" defaultValue={editingTank.colorTheme || 'emerald'} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold">
                                    <option value="emerald">Emerald Green / ზურმუხტისფერი</option>
                                    <option value="blue">Royal Blue / ლურჯი</option>
                                    <option value="purple">Purple / იასამნისფერი</option>
                                    <option value="amber">Amber / ნარინჯისფერი</option>
                                    <option value="cyan">Cyan / ცისფერი</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button type="button" onClick={() => setEditingTank(null)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-xl font-bold cursor-pointer">
                                    Cancel / გაუქმება
                                </button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer">
                                    Save Changes / შენახვა
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Purpose / Recipe Change Alert Guard */}
            {recipeChangeAlert && (
                <div className="fixed inset-0 bg-black/70 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 p-6 space-y-4">
                        <div className="flex items-center gap-3 text-amber-600">
                            <AlertTriangleIcon className="w-8 h-8" />
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Leftover Solution Detected / ნარჩენი ხსნარი ავზებში</h3>
                                <p className="text-xs text-slate-500">Tanks contain residual fertilizer from the current formula / ავზებში დარჩენილია მიმდინარე სასუქი.</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                            You are switching to <strong>{recipeChangeAlert.newPlan?.name || 'a new recipe'}</strong>. How should the system handle the remaining liquid in the active tanks? / თქვენ ირჩევთ ახალ რეცეპტს. როგორ მოვიქცეთ ავზებში დარჩენილ სითხესთან?
                        </p>

                        <div className="space-y-2 pt-2">
                            {recipeChangeAlert.newPlan?.tankConfigs && (
                                <button
                                    type="button"
                                    onClick={() => confirmRecipeChange('APPLY_BLUEPRINT')}
                                    className="w-full p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-2xl text-xs font-bold text-left border border-indigo-200 transition-all flex items-center justify-between cursor-pointer"
                                >
                                    <span>📥 Load New Recipe Blueprint & Replace Tanks / რეცეპტის ავზების ჩატვირთვა</span>
                                    <span className="text-[10px] bg-indigo-200 px-2 py-0.5 rounded font-black">Recommended</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => confirmRecipeChange('FLUSH')}
                                className="w-full p-3 bg-red-50 hover:bg-red-100 text-red-900 rounded-2xl text-xs font-bold text-left border border-red-200 transition-all cursor-pointer"
                            >
                                🗑️ Flush & Discard Leftover Fluid (Zero Out Tanks) / ავზების დაცლა და ჩამორეცხვა
                            </button>

                            <button
                                type="button"
                                onClick={() => confirmRecipeChange('CARRYOVER')}
                                className="w-full p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-2xl text-xs font-bold text-left border border-emerald-200 transition-all cursor-pointer"
                            >
                                🧪 Keep Residual Liquid & Continue Dispensing / ნარჩენის შენარჩუნება და გაგრძელება
                            </button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => confirmRecipeChange('CANCEL')}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Cancel / გაუქმება
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Single Feeding Success Modal with Direct Link to Detailed Log */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/70 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowSuccessModal(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="text-center space-y-2">
                            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                                ✓
                            </div>
                            <h3 className="text-xl font-black text-slate-900">
                                Feeding #{showSuccessModal.feedingNumber} Completed & Logged in History! / კვება #{showSuccessModal.feedingNumber} დასრულდა და აღირიცხა!
                            </h3>
                            <p className="text-xs text-slate-500">
                                Fertilizer consumption has been deducted accurately from master warehouse stock and recorded in Recent History. / სასუქების რაოდენობა ჩამოიწერა საწყობის ნაშთიდან.
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Sectors Irrigated / სექტორები:</span>
                                <strong className="text-slate-800">{showSuccessModal.sectorsCount} Sectors ({showSuccessModal.duration} min)</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Water Dispensed / წყლის ხარჯი:</span>
                                <strong className="text-indigo-600 font-bold">{showSuccessModal.totalConsumedLiters} Liters / ლ</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Feeding Run Cost / კვების ხარჯი:</span>
                                <strong className="text-emerald-600 font-black">{formatCurrency(showSuccessModal.cost)}</strong>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            {onOpenExecutionDetail && showSuccessModal.executionRecord && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const rec = showSuccessModal.executionRecord;
                                        setShowSuccessModal(null);
                                        onOpenExecutionDetail(rec);
                                    }}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                                >
                                    🔍 View Detailed Log / დეტალური ჟურნალი
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowSuccessModal(null)}
                                className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all cursor-pointer"
                            >
                                Continue Cycle / გაგრძელება
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cycle Completed Modal */}
            {showCycleCompleteModal && (
                <div className="fixed inset-0 bg-black/70 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowCycleCompleteModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center flex-shrink-0">
                            <div>
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Cycle Analytics & Audit / ციკლის ანალიტიკა
                                </span>
                                <h3 className="text-xl font-black mt-1">Fertigation Batch Cycle Summary / ფერტიგაციის ციკლის შეჯამება</h3>
                                <p className="text-xs text-indigo-200">
                                    Purpose / მიზანი: <strong>{activeCycle.recipeName}</strong> • {cycleCumulativeStats.totalFeedings} Feeding Runs Executed / ჩატარებული კვება
                                </p>
                            </div>
                            <button onClick={() => setShowCycleCompleteModal(false)} className="text-slate-400 hover:text-white text-lg cursor-pointer">✕</button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
                            {/* Key Performance Metric Cards */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Feedings Made / კვებები</div>
                                    <div className="text-2xl font-black text-indigo-900 mt-1">{cycleCumulativeStats.totalFeedings} Runs</div>
                                </div>
                                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-teal-600">Total Solution / სულ წყალი</div>
                                    <div className="text-2xl font-black text-teal-900 mt-1">{cycleCumulativeStats.totalWater} L</div>
                                </div>
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Cost / ჯამური ხარჯი</div>
                                    <div className="text-2xl font-black text-emerald-900 mt-1">{formatCurrency(cycleCumulativeStats.totalCost)}</div>
                                </div>
                            </div>

                            {/* Fertilizer Usage Breakdown Across Entire Batch */}
                            <div>
                                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wider mb-2">
                                    Total Fertilizer & Chemical Usage / გამოყენებული სასუქები
                                </h4>
                                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-100 text-[10px] font-black text-slate-600 uppercase">
                                            <tr>
                                                <th className="p-3">Fertilizer / Material / სასუქი</th>
                                                <th className="p-3 text-right">Total Kg Used / სულ კგ</th>
                                                <th className="p-3 text-right">Avg / Feeding / საშუალო კვებაზე</th>
                                                <th className="p-3 text-right">Total Cost / ღირებულება</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs">
                                            {cycleCumulativeStats.materialSummary.map((m, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-3 font-bold text-slate-800">{m.name}</td>
                                                    <td className="p-3 font-black text-emerald-600 text-right">{m.totalKg} kg</td>
                                                    <td className="p-3 text-slate-500 text-right font-medium">
                                                        {cycleCumulativeStats.totalFeedings > 0 ? (m.totalKg / cycleCumulativeStats.totalFeedings).toFixed(2) : 0} kg
                                                    </td>
                                                    <td className="p-3 font-bold text-slate-700 text-right">{formatCurrency(m.totalCost)}</td>
                                                </tr>
                                            ))}
                                            {cycleCumulativeStats.materialSummary.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">No consumption recorded in this cycle / ჩანაწერი არ არის</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Detailed Feeding Run Timeline */}
                            {activeCycle.feedings.length > 0 && (
                                <div>
                                    <h4 className="font-black text-slate-900 text-sm uppercase tracking-wider mb-2">
                                        Feeding Runs Timeline / კვების ქრონოლოგია
                                    </h4>
                                    <div className="space-y-2">
                                        {activeCycle.feedings.map(f => (
                                            <div key={f.feedingNumber} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                <div>
                                                    <div className="font-black text-slate-900 text-xs flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px]">
                                                            Run #{f.feedingNumber}
                                                        </span>
                                                        <span>{f.date} at {f.timestamp}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-1">
                                                        Sectors: {f.sectors.map(s => `${s.sectorName} (${s.durationMinutes}m, EC:${s.ec || 1.6}, pH:${s.ph || 5.8})`).join(', ')}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-black text-emerald-600 text-xs">{formatCurrency(f.totalCost)}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold">{f.totalWaterLiters} L water</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-center gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowCycleCompleteModal(false)}
                                className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                            >
                                Close / დახურვა
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    handleRefillAllFromRecipe();
                                    setShowCycleCompleteModal(false);
                                }}
                                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <ArrowPathIcon className="w-4 h-4" /> Start New Cycle & Refill All Tanks / ახალი ციკლის დაწყება
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemFeedingTankMonitor;
