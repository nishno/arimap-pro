
import React from 'react';
import type { Employee, WorkAssignment, Machinery, OperationalLog, Role, Permission, DailyLogEntry, NutritionPlan, InventoryItem, AreaPlantationFeature } from '../types';
import WorkManager from './SystemManagement/WorkManager';

export interface SystemManagementPlannerProps {
    employees: Employee[];
    onSetEmployees: (employees: Employee[]) => void;
    workAssignments: WorkAssignment[];
    onSetWorkAssignments: (assignments: WorkAssignment[]) => void;
    machinery?: Machinery[];
    onSetMachinery?: (machinery: Machinery[]) => void;
    plantationFeatures: any[]; // Using any[] to avoid circular dependency if needed, or imported type
    onSetHighlightedFeatureId: (id: string | null) => void;
    operationalLogs: OperationalLog[];
    onSetOperationalLogs: (logs: OperationalLog[]) => void;
    roles: Role[];
    onSetRoles: (roles: Role[]) => void;
    dailyLogs?: DailyLogEntry[];
    onSetDailyLogs?: (logs: DailyLogEntry[]) => void;
    currentUserPermissions: Set<Permission>;
    nutritionPlans: NutritionPlan[];
    inventoryItems: InventoryItem[];
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    notes: any[];
    checkpoints: any[];
    onLogOnMapRequest: (assignment: WorkAssignment) => void;
    selectedWorkIds?: string[];
    onToggleSelectWork?: (id: string) => void;
    standingWorkId?: string | null;
    onSelectStandingWork?: (id: string) => void;
    onOpenRegistryModal?: (work: WorkAssignment) => void;
    dayFilter?: 'today' | 'past' | 'future' | 'choose' | 'all';
    onSetDayFilter?: (filter: 'today' | 'past' | 'future' | 'choose' | 'all') => void;
    startDate?: string;
    onSetStartDate?: (date: string) => void;
    endDate?: string;
    onSetEndDate?: (date: string) => void;
    onOpenAddModal?: () => void;
}

const SystemManagementPlanner: React.FC<SystemManagementPlannerProps> = (props) => {
    // Filter sectors for WorkManager
    const sectors = (props.plantationFeatures || []).filter(f => f.type === 'area') as AreaPlantationFeature[];

    return (
        <div className="flex flex-col h-full bg-white">
            <WorkManager 
                {...props} 
                machinery={props.machinery || []}
                sectors={sectors} 
                notes={props.notes} 
                checkpoints={props.checkpoints} 
            />
        </div>
    );
};

export default SystemManagementPlanner;
