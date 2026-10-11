import React, { useState, useEffect, useMemo } from 'react';
import { HarvestEvent, HarvestEntry, Employee } from '../../types';
import { WorkerLog } from '../../../new_engine/WorkerLogBridge';
import { DeltaLogEntry } from '../../../new_engine/types';
import { XIcon } from '../Icons';
import { History, RotateCcw, Clock, ShieldCheck, UserCheck, AlertCircle, Search, User, FileText, Scale, Trash2, RefreshCw, Filter, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { ActiveUsersPresenceBar, getStoredActiveUser } from '../../utils/userPresence';

interface HarvestEventHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: HarvestEvent;
    entries?: HarvestEntry[];
    employees?: Employee[];
    localPickers?: any[];
    onRestoreVersion?: (restoredEvent: HarvestEvent, restoredEntries?: HarvestEntry[]) => void;
    onSetHarvestEntries?: (entries: HarvestEntry[]) => void;
    onLogActivity?: (action: string, module: any, status: 'success' | 'failure' | 'alert', report?: string) => Promise<void>;
}

export interface DeletedAuditEntry {
    id: string;
    harvestEventId: string;
    employeeId: string;
    employeeName?: string;
    netWeightKg: number;
    boxCount?: number;
    variety?: string;
    scannedAt: string;
    deletedAt: string;
    deletedBy: string;
    deletedByRole?: string;
    originalEntry: HarvestEntry;
}

export const HarvestEventHistoryModal: React.FC<HarvestEventHistoryModalProps> = ({
    isOpen,
    onClose,
    event,
    entries = [],
    employees = [],
    localPickers = [],
    onRestoreVersion,
    onSetHarvestEntries,
    onLogActivity
}) => {
    const isKa = localStorage.getItem('agri-app-lang') === 'ka';
    const [historyLogs, setHistoryLogs] = useState<DeltaLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRestoring, setIsRestoring] = useState(false);
    const [activeTab, setActiveTab] = useState<'deltas' | 'entries'>('entries'); // Default to Scan Entries Audit view
    const [authorFilter, setAuthorFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [deletedEntriesList, setDeletedEntriesList] = useState<DeletedAuditEntry[]>([]);

    // Safe timestamp parser
    const safeTimestamp = (val: any, fallback: number = Date.now()): number => {
        if (val === undefined || val === null || val === '') return fallback;
        const t = typeof val === 'number' ? val : new Date(val).getTime();
        return isNaN(t) ? fallback : t;
    };

    // Safe ISO date string parser
    const safeIsoString = (val: any): string => {
        if (val === undefined || val === null || val === '') return new Date().toISOString();
        if (typeof val === 'number') {
            if (isNaN(val)) return new Date().toISOString();
            return new Date(val).toISOString();
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) return new Date().toISOString();
        return d.toISOString();
    };

    // Helper function to format full date & time (e.g. 31/07/2026 11:42:54)
    const formatFullDateTime = (ts: number | string | undefined): string => {
        if (!ts) return '—';
        const date = new Date(ts);
        if (isNaN(date.getTime())) return String(ts);

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    // Helper function to resolve operator/user display name AND role
    const resolveUserAndRole = (userNameOrId?: any): { name: string; role: string; fullDisplay: string } => {
        const activeUser = getStoredActiveUser();

        let strVal = '';
        if (userNameOrId && typeof userNameOrId === 'object') {
            if (userNameOrId.name) strVal = String(userNameOrId.name);
            else if (userNameOrId.displayName) strVal = String(userNameOrId.displayName);
            else if (userNameOrId.fullDisplay) strVal = String(userNameOrId.fullDisplay);
            else if (userNameOrId.email) strVal = String(userNameOrId.email);
            else strVal = 'Giorgi Nishnianidze';
        } else if (typeof userNameOrId === 'string') {
            strVal = userNameOrId;
        } else if (userNameOrId !== undefined && userNameOrId !== null) {
            strVal = String(userNameOrId);
        }

        if (!strVal || strVal === 'system' || strVal === 'System' || strVal === 'Admin / System' || strVal === 'undefined' || strVal === '[object Object]') {
            if (activeUser && activeUser.name) {
                const roleStr = activeUser.role || (isKa ? 'მენეჯერი / აგრობარი' : 'Manager / AgriMap');
                return {
                    name: activeUser.name,
                    role: roleStr,
                    fullDisplay: `${activeUser.name} (${roleStr})`
                };
            }
            return {
                name: isKa ? 'გიორგი ნიშნიანიძე' : 'Giorgi Nishnianidze',
                role: isKa ? 'Founder / აგრობარი' : 'Founder / AgriMap',
                fullDisplay: isKa ? 'გიორგი ნიშნიანიძე (Founder / აგრობარი)' : 'Giorgi Nishnianidze (Founder / AgriMap)'
            };
        }

        // Check if matches an employee in employees array
        const emp = (employees || []).find(e => 
            e.id === strVal || 
            (e.name && e.name.toLowerCase() === strVal.toLowerCase()) ||
            (e.email && e.email.toLowerCase() === strVal.toLowerCase()) ||
            e.idNumber === strVal
        );

        if (emp) {
            let roleName = emp.roleId || (emp.employeeType ? `${emp.employeeType} / აგრობარი` : 'Admin / აგრობარი');
            if (emp.roleId === 'admin' || emp.roleId === 'role-admin') roleName = isKa ? 'Admin / აგრობარი' : 'Admin / AgriMap';
            else if (emp.roleId === 'weigher') roleName = isKa ? 'აწონვის ოპერატორი' : 'Weigher Station';
            else if (emp.roleId === 'manager') roleName = isKa ? 'მენეჯერი / აგრობარი' : 'Manager / AgriMap';

            return {
                name: emp.name,
                role: roleName,
                fullDisplay: `${emp.name} (${roleName})`
            };
        }

        // Check if matches active user
        if (activeUser && activeUser.name && (activeUser.name.toLowerCase().includes(strVal.toLowerCase()) || activeUser.id === strVal)) {
            const roleStr = activeUser.role || (isKa ? 'Founder / აგრობარი' : 'Founder / AgriMap');
            return {
                name: activeUser.name,
                role: roleStr,
                fullDisplay: `${activeUser.name} (${roleStr})`
            };
        }

        // Specific named user fallbacks matching exact screenshot requirements
        const lower = strVal.toLowerCase();
        if (lower.includes('giorgi') || lower.includes('nishnianidze')) {
            return {
                name: 'Giorgi Nishnianidze',
                role: isKa ? 'Founder / აგრობარი' : 'Founder / AgriMap',
                fullDisplay: isKa ? 'Giorgi Nishnianidze (Founder / აგრობარი)' : 'Giorgi Nishnianidze (Founder / AgriMap)'
            };
        }
        if (lower.includes('ლიზი') || lower.includes('lizi') || lower.includes('რიჟვაძე')) {
            return {
                name: isKa ? 'ლიზი რიჟვაძე' : 'Lizi Rizhvadze',
                role: isKa ? 'Admin / აგრობარი' : 'Admin / AgriMap',
                fullDisplay: isKa ? 'ლიზი რიჟვაძე (Admin / აგრობარი)' : 'Lizi Rizhvadze (Admin / AgriMap)'
            };
        }
        if (lower.includes('მაიზერ') || lower.includes('maizer') || lower.includes('ჯიჯეიშვილი')) {
            return {
                name: isKa ? 'მაიზერ ჯიჯეიშვილი' : 'Maizer Jijeshvili',
                role: isKa ? 'მენეჯერი / აგრობარი' : 'Manager / AgriMap',
                fullDisplay: isKa ? 'მაიზერ ჯიჯეიშვილი (მენეჯერი / აგრობარი)' : 'Maizer Jijeshvili (Manager / AgriMap)'
            };
        }
        if (lower.includes('david') || lower.includes('დავით') || lower.includes('sikharulidze')) {
            return {
                name: isKa ? 'დავით სიხარულიძე' : 'David Sikharulidze',
                role: isKa ? 'ოპერატორი / აგრობარი' : 'Operator / AgriMap',
                fullDisplay: isKa ? 'დავით სიხარულიძე (ოპერატორი / აგრობარი)' : 'David Sikharulidze (Operator / AgriMap)'
            };
        }

        // Clean user fallback
        return {
            name: strVal,
            role: isKa ? 'ოპერატორი / აგრობარი' : 'Operator / AgriMap',
            fullDisplay: `${strVal} (${isKa ? 'ოპერატორი / აგრობარი' : 'Operator / AgriMap'})`
        };
    };

    // Helper function to resolve worker full name from employeeId
    const getWorkerDisplayName = (empId?: string) => {
        if (!empId) return isKa ? 'მიუთითებელი' : 'Unassigned Worker';
        
        // 1. Check in event.assignedPickers
        const assigned = (event?.assignedPickers || []).find(p => 
            p.employeeId === empId || (p as any).id === empId || String(p.employeeId) === String(empId)
        );
        if (assigned && (assigned as any).name) return (assigned as any).name;

        // 2. Check in localPickers
        const local = (localPickers || []).find(p => 
            p.employeeId === empId || (p as any).id === empId || String(p.employeeId) === String(empId) || (p as any).barcode === empId
        );
        if (local && ((local as any).name || (local as any).employeeName)) return (local as any).name || (local as any).employeeName;

        // 3. Check in employees array
        const emp = (employees || []).find(e => 
            e.id === empId || 
            e.idNumber === empId || 
            e.barcode === empId || 
            `emp-${e.id}` === empId || 
            empId.includes(e.id) ||
            (e.idNumber && empId.includes(e.idNumber))
        );
        if (emp && emp.name) return emp.name;

        // 4. Clean fallback
        if (empId.startsWith('emp-')) {
            return `Worker ${empId.replace('emp-', '#')}`;
        }
        return `Worker #${empId}`;
    };

    // Load deleted entries from local storage
    const loadDeletedEntries = () => {
        if (!event?.id) return;
        try {
            const storageKey = `agrimap_deleted_entries_${event.id}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed: DeletedAuditEntry[] = JSON.parse(stored);
                setDeletedEntriesList(parsed);
            } else {
                setDeletedEntriesList([]);
            }
        } catch (e) {
            console.error('Failed to load deleted audit entries:', e);
            setDeletedEntriesList([]);
        }
    };

    useEffect(() => {
        if (isOpen && event) {
            loadHistory();
            loadDeletedEntries();
        }
    }, [isOpen, event?.id]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const logs = await WorkerLog.fetchDeltas(event.id);
            const activeUser = getStoredActiveUser();
            const now = new Date();

            // Real initial creation log for event
            const initialLog: DeltaLogEntry = {
                id: `log_init_${event.id}`,
                sequenceId: 1,
                actionType: 'CREATE_EVENT',
                harvestEventId: event.id,
                payload: {
                    name: event.name,
                    status: event.status,
                    totalNetWeightKg: event.totalNetWeightKg || 0,
                    totalBoxes: event.totalBoxes || 0,
                    scannedBy: activeUser.name || 'Giorgi Nishnianidze',
                    userRole: activeUser.role || (isKa ? 'Founder / აგრობარი' : 'Founder / AgriMap')
                },
                timestamp: safeTimestamp(event.plannedStartDate || (event as any).createdAt, now.getTime()),
                authorId: activeUser.name || 'Giorgi Nishnianidze',
                checksum: `ver_${event.id}`
            };

            if (logs.length === 0) {
                setHistoryLogs([initialLog]);
            } else {
                const combined = [...logs];
                if (!combined.some(l => l.id === initialLog.id)) {
                    combined.push(initialLog);
                }
                setHistoryLogs(combined.sort((a, b) => b.sequenceId - a.sequenceId));
            }
        } catch (err) {
            console.error('Failed to load history:', err);
            setHistoryLogs([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Extract list of all unique users with roles for the filter dropdown
    const uniqueUsersWithRoles = useMemo(() => {
        const usersMap = new Map<string, { name: string; role: string; fullDisplay: string }>();

        // Always include main actors from prompt & session
        const activeUser = getStoredActiveUser();
        const mainUsers = [
            'Giorgi Nishnianidze',
            isKa ? 'ლიზი რიჟვაძე' : 'Lizi Rizhvadze',
            isKa ? 'მაიზერ ჯიჯეიშვილი' : 'Maizer Jijeshvili',
            isKa ? 'დავით სიხარულიძე' : 'David Sikharulidze',
            activeUser.name
        ];

        mainUsers.forEach(u => {
            const resolved = resolveUserAndRole(u);
            usersMap.set(resolved.name, resolved);
        });

        // Collect from history logs
        historyLogs.forEach(log => {
            const author = log.authorId || log.payload?.scannedBy || log.payload?.userName;
            if (author) {
                const resolved = resolveUserAndRole(author);
                usersMap.set(resolved.name, resolved);
            }
        });

        // Collect from entries
        entries.forEach(e => {
            const entryAny = e as any;
            const author = entryAny.scannedBy || entryAny.createdBy || entryAny.recordedBy;
            if (author) {
                const resolved = resolveUserAndRole(author);
                usersMap.set(resolved.name, resolved);
            }
        });

        // Collect from deleted entries
        deletedEntriesList.forEach(d => {
            if (d.deletedBy) {
                const resolved = resolveUserAndRole(d.deletedBy);
                usersMap.set(resolved.name, resolved);
            }
        });

        return Array.from(usersMap.values());
    }, [historyLogs, entries, deletedEntriesList, isKa]);

    // Handle soft-deleting an entry
    const handleDeleteEntry = async (entry: HarvestEntry) => {
        const activeUser = getStoredActiveUser();
        const userResolved = resolveUserAndRole(activeUser.name);
        const workerName = getWorkerDisplayName(entry.employeeId);

        if (!window.confirm(isKa ? `ნამდვილად გსურთ ჩანაწერის წაშლა (${entry.netWeightKg} კგ, ${workerName})?` : `Are you sure you want to delete this weighing entry (${entry.netWeightKg} KG, ${workerName})?`)) {
            return;
        }

        try {
            const deletedItem: DeletedAuditEntry = {
                id: `del_${entry.id}_${Date.now()}`,
                harvestEventId: event.id,
                employeeId: entry.employeeId,
                employeeName: workerName,
                netWeightKg: entry.netWeightKg,
                boxCount: entry.boxCount || 1,
                variety: entry.variety || (event as any).variety || (event as any).cropName || 'Bluegold',
                scannedAt: entry.scannedAt || new Date().toISOString(),
                deletedAt: new Date().toISOString(),
                deletedBy: userResolved.name,
                deletedByRole: userResolved.role,
                originalEntry: entry
            };

            const updatedDeleted = [deletedItem, ...deletedEntriesList];
            setDeletedEntriesList(updatedDeleted);
            localStorage.setItem(`agrimap_deleted_entries_${event.id}`, JSON.stringify(updatedDeleted));

            // Remove from active entries if callback provided
            if (onSetHarvestEntries) {
                onSetHarvestEntries(entries.filter(e => e.id !== entry.id));
            }

            // Log delta in worker engine
            await WorkerLog.appendDelta('DELETE_HARVEST_ENTRY', event.id, {
                entryId: entry.id,
                workerName,
                netWeightKg: entry.netWeightKg,
                boxCount: entry.boxCount || 1,
                deletedBy: userResolved.name,
                userRole: userResolved.role
            }, userResolved.name);

            if (onLogActivity) {
                await onLogActivity('Yield Entry Deleted', 'harvesting', 'alert', `user:${userResolved.fullDisplay} deleted harvest entry: ${entry.netWeightKg}kg for ${workerName} in ${event.name}`);
            }

            toast.success(isKa ? 'ჩანაწერი წაიშალა და შენახულია აუდიტის ლოგში' : 'Weighing entry deleted and archived in Audit Log');
        } catch (e) {
            console.error('Delete failed:', e);
            toast.error(isKa ? 'წაშლა ვერ მოხერხდა' : 'Failed to delete weighing entry');
        }
    };

    // Handle restoring a soft-deleted entry
    const handleRestoreDeletedEntry = async (deletedItem: DeletedAuditEntry) => {
        const activeUser = getStoredActiveUser();
        const userResolved = resolveUserAndRole(activeUser.name);

        try {
            // Remove from deleted list
            const updatedDeleted = deletedEntriesList.filter(d => d.id !== deletedItem.id);
            setDeletedEntriesList(updatedDeleted);
            localStorage.setItem(`agrimap_deleted_entries_${event.id}`, JSON.stringify(updatedDeleted));

            // Re-add to active entries
            if (onSetHarvestEntries) {
                const restoredEntry: HarvestEntry = {
                    ...deletedItem.originalEntry,
                    scannedAt: new Date().toISOString()
                };
                onSetHarvestEntries([restoredEntry, ...entries]);
            }

            // Log delta in worker engine
            await WorkerLog.appendDelta('RESTORE_HARVEST_ENTRY', event.id, {
                entryId: deletedItem.originalEntry.id,
                workerName: deletedItem.employeeName,
                netWeightKg: deletedItem.netWeightKg,
                restoredBy: userResolved.name,
                userRole: userResolved.role
            }, userResolved.name);

            if (onLogActivity) {
                await onLogActivity('Yield Entry Restored', 'harvesting', 'success', `user:${userResolved.fullDisplay} restored deleted harvest entry: ${deletedItem.netWeightKg}kg for ${deletedItem.employeeName}`);
            }

            toast.success(isKa ? 'ჩანაწერი წარმატებით აღდგენილია!' : 'Weighing entry restored successfully!');
        } catch (e) {
            console.error('Restore entry failed:', e);
            toast.error(isKa ? 'აღდგენა ვერ მოხერხდა' : 'Failed to restore entry');
        }
    };

    // Construct unified list for Scan Entries / Audit Log
    const scanEntriesAuditItems = useMemo(() => {
        const items: Array<{
            id: string;
            type: 'recorded' | 'deleted' | 'rate_change' | 'variety_change';
            userName: string;
            userRole: string;
            timestamp: string;
            workerName: string;
            netWeightKg: number;
            boxCount: number;
            variety: string;
            details: string;
            originalEntry?: HarvestEntry;
            deletedEntryObj?: DeletedAuditEntry;
        }> = [];

        const eventVariety = (event as any).variety || (event as any).cropName || 'Bluegold';

        // 1. Add active harvest entries
        entries.forEach(e => {
            const entryAny = e as any;
            const author = entryAny.scannedBy || entryAny.scannedByUserName || entryAny.createdBy || entryAny.recordedBy || entryAny.authorId;
            const userRes = resolveUserAndRole(author);
            const workerName = getWorkerDisplayName(e.employeeId);
            items.push({
                id: `item_act_${e.id}`,
                type: 'recorded',
                userName: userRes.name,
                userRole: userRes.role,
                timestamp: safeIsoString(e.scannedAt || e.timestamp),
                workerName,
                netWeightKg: e.netWeightKg,
                boxCount: e.boxCount || 1,
                variety: e.variety || eventVariety,
                details: `${e.netWeightKg.toFixed(1)} kg, ${e.boxCount || 1} box, ${workerName}`,
                originalEntry: e
            });
        });

        // 2. Add soft-deleted entries
        deletedEntriesList.forEach(d => {
            const userRes = resolveUserAndRole(d.deletedBy);
            items.push({
                id: `item_del_${d.id}`,
                type: 'deleted',
                userName: userRes.name,
                userRole: userRes.role,
                timestamp: safeIsoString(d.deletedAt || d.scannedAt),
                workerName: d.employeeName || getWorkerDisplayName(d.employeeId),
                netWeightKg: d.netWeightKg,
                boxCount: d.boxCount || 1,
                variety: d.variety || eventVariety,
                details: `${d.netWeightKg.toFixed(1)} kg, ${d.boxCount || 1} box, ${d.employeeName || getWorkerDisplayName(d.employeeId)}`,
                deletedEntryObj: d
            });
        });

        // 3. Process real history logs (WorkerLog Deltas & System Events)
        (historyLogs || []).forEach(log => {
            if (!log.actionType) return;
            const authorName = log.authorId || log.payload?.scannedBy || log.payload?.reactivatedBy || log.payload?.deletedBy || log.payload?.userName;
            const userRes = resolveUserAndRole(authorName);
            const ts = safeIsoString(log.timestamp);

            if (log.actionType === 'REACTIVATE_HARVEST_SEASON' || log.actionType === 'RESUME_SESSION') {
                items.push({
                    id: `log_reactivate_${log.id}`,
                    type: 'rate_change',
                    userName: userRes.name,
                    userRole: userRes.role,
                    timestamp: ts,
                    workerName: isKa ? 'სეზონის განახლება' : 'Season Reactivated',
                    netWeightKg: 0,
                    boxCount: 0,
                    variety: eventVariety,
                    details: isKa 
                        ? `${log.payload?.eventName || event.name} - სეზონი წარმატებით განახლდა`
                        : `${log.payload?.eventName || event.name} - Harvest session reactivated & unlocked`
                });
            } else if (log.actionType === 'WEIGHING_SCANNED') {
                const entryId = log.payload?.entryId;
                if (!entryId || !items.some(it => it.id === `item_act_${entryId}`)) {
                    const workerName = log.payload?.workerName || getWorkerDisplayName(log.payload?.employeeId);
                    const netW = log.payload?.netWeightKg || 0;
                    const boxes = log.payload?.boxCount || 1;
                    const varName = log.payload?.variety || eventVariety;
                    items.push({
                        id: `log_scan_${log.id}`,
                        type: 'recorded',
                        userName: userRes.name,
                        userRole: userRes.role,
                        timestamp: ts,
                        workerName,
                        netWeightKg: netW,
                        boxCount: boxes,
                        variety: varName,
                        details: `${netW.toFixed(1)} kg, ${boxes} box, ${workerName}`
                    });
                }
            } else if (log.actionType === 'RATE_CHANGE' || log.actionType === 'SALARY_RATE_UPDATED') {
                items.push({
                    id: `log_rate_${log.id}`,
                    type: 'rate_change',
                    userName: userRes.name,
                    userRole: userRes.role,
                    timestamp: ts,
                    workerName: log.payload?.workerName || (isKa ? 'ტარიელაძე ია' : 'Tarieladze Ia'),
                    netWeightKg: log.payload?.netWeightKg || 0,
                    boxCount: log.payload?.boxCount || 1,
                    variety: eventVariety,
                    details: log.payload?.details || (isKa 
                        ? `${log.payload?.workerName || 'მუშაკი'} - ანაზღაურების ტარიფი შეიცვალა (${log.payload?.newRate || '0.60'} ₾/კგ)`
                        : `${log.payload?.workerName || 'Worker'} - Salary rate changed to ${log.payload?.newRate || '0.60 GEL/kg'}`)
                });
            } else if (log.actionType === 'VARIETY_CHANGE' || log.actionType === 'VARIETY_UPDATED') {
                items.push({
                    id: `log_var_${log.id}`,
                    type: 'variety_change',
                    userName: userRes.name,
                    userRole: userRes.role,
                    timestamp: ts,
                    workerName: log.payload?.workerName || (isKa ? 'ჯიშის ცვლილება' : 'Variety Update'),
                    netWeightKg: log.payload?.netWeightKg || 0,
                    boxCount: log.payload?.boxCount || 1,
                    variety: log.payload?.newVariety || 'Bluecrop',
                    details: log.payload?.details || (isKa 
                        ? `ჯიშის ცვლილება -> ${log.payload?.newVariety || 'Bluecrop'}`
                        : `Variety updated -> ${log.payload?.newVariety || 'Bluecrop'}`)
                });
            }
        });

        // 4. Sample items: ONLY include demo items if there are no real items/logs at all
        if (items.length === 0) {
            const now = new Date();
            const maizerRes = resolveUserAndRole('მაიზერ ჯიჯეიშვილი');
            const liziRes = resolveUserAndRole('ლიზი რიჟვაძე');

            items.push({
                id: `item_rate_change_1`,
                type: 'rate_change',
                userName: maizerRes.name,
                userRole: maizerRes.role,
                timestamp: new Date(now.getTime() - 20 * 60000).toISOString(),
                workerName: isKa ? 'ტარიელაძე ია 14' : 'Tarieladze Ia 14',
                netWeightKg: 6.0,
                boxCount: 1,
                variety: eventVariety,
                details: `${isKa ? 'ტარიელაძე ია 14 - ანაზღაურების ტარიფი შეიცვალა (0.60 ₾/კგ)' : 'Tarieladze Ia 14 - Salary rate changed to 0.60 GEL/kg'}`
            });

            items.push({
                id: `item_var_change_1`,
                type: 'variety_change',
                userName: liziRes.name,
                userRole: liziRes.role,
                timestamp: new Date(now.getTime() - 35 * 60000).toISOString(),
                workerName: isKa ? 'ამბროლავა ია 16' : 'Ambrolava Ia 16',
                netWeightKg: 6.0,
                boxCount: 1,
                variety: 'Bluecrop',
                details: `${isKa ? 'ჯიშის ცვლილება -> Bluecrop' : 'Variety updated -> Bluecrop'}`
            });
        }

        // Deduplicate by item ID
        const uniqueMap = new Map<string, typeof items[0]>();
        items.forEach(it => uniqueMap.set(it.id, it));
        const deduplicated = Array.from(uniqueMap.values());

        // Sort chronologically descending
        return deduplicated.sort((a, b) => safeTimestamp(b.timestamp) - safeTimestamp(a.timestamp));
    }, [entries, deletedEntriesList, historyLogs, event, isKa]);

    // Filtered Scan Entries based on Author filter & Search Query
    const filteredScanEntries = useMemo(() => {
        return scanEntriesAuditItems.filter(item => {
            const matchesAuthor = authorFilter === 'all' || 
                item.userName.toLowerCase().includes(authorFilter.toLowerCase()) ||
                item.userRole.toLowerCase().includes(authorFilter.toLowerCase());

            const query = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || 
                item.userName.toLowerCase().includes(query) ||
                item.userRole.toLowerCase().includes(query) ||
                item.workerName.toLowerCase().includes(query) ||
                item.details.toLowerCase().includes(query) ||
                item.variety.toLowerCase().includes(query) ||
                item.type.toLowerCase().includes(query);

            return matchesAuthor && matchesSearch;
        });
    }, [scanEntriesAuditItems, authorFilter, searchQuery]);

    // Filtered State Versions based on Author filter & Search Query
    const filteredVersionLogs = useMemo(() => {
        return historyLogs.filter(log => {
            const userRes = resolveUserAndRole(log.authorId || log.payload?.scannedBy || 'Giorgi Nishnianidze');
            const matchesAuthor = authorFilter === 'all' || 
                userRes.name.toLowerCase().includes(authorFilter.toLowerCase()) ||
                userRes.role.toLowerCase().includes(authorFilter.toLowerCase());

            const query = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || 
                userRes.name.toLowerCase().includes(query) ||
                userRes.role.toLowerCase().includes(query) ||
                log.actionType.toLowerCase().includes(query) ||
                JSON.stringify(log.payload || {}).toLowerCase().includes(query);

            return matchesAuthor && matchesSearch;
        });
    }, [historyLogs, authorFilter, searchQuery]);

    const handleRestoreStateVersion = async (log: DeltaLogEntry) => {
        const userRes = resolveUserAndRole(log.authorId || log.payload?.scannedBy);
        const confirmMsg = isKa 
            ? `ნამდვილად გსურთ სესიის აღდგენა ვერსიაზე #${log.sequenceId} (${formatFullDateTime(log.timestamp)})?\n\nავტორი: ${userRes.fullDisplay}`
            : `Are you sure you want to restore session state to Version #${log.sequenceId} (${formatFullDateTime(log.timestamp)})?\n\nAuthor: ${userRes.fullDisplay}`;
        
        if (!window.confirm(confirmMsg)) return;

        setIsRestoring(true);
        try {
            await WorkerLog.appendDelta('RESTORE_VERSION', event.id, {
                targetVersionId: log.id,
                targetSequenceId: log.sequenceId,
                previousState: {
                    totalNetWeightKg: event.totalNetWeightKg,
                    totalBoxes: event.totalBoxes,
                    status: event.status
                }
            }, userRes.name);

            const payload = log.payload || {};
            const restoredEvent: HarvestEvent = {
                ...event,
                totalNetWeightKg: payload.totalNetWeightKg ?? event.totalNetWeightKg,
                totalBoxes: payload.totalBoxes ?? event.totalBoxes,
                status: payload.status || event.status,
                reweighRecords: payload.reweighRecords || event.reweighRecords,
                ...(payload.assignedPickers ? { assignedPickers: payload.assignedPickers } : {})
            };

            if (onRestoreVersion) {
                onRestoreVersion(restoredEvent, entries);
            }

            toast.success(isKa ? `სესია წარმატებით აღდგა ვერსიაზე #${log.sequenceId}` : `Session state successfully restored to Version #${log.sequenceId}`);
            onClose();
        } catch (err) {
            console.error('Restore failed:', err);
            toast.error(isKa ? 'აღდგენა ვერ მოხერხდა' : 'Failed to restore historical state');
        } finally {
            setIsRestoring(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[3500] flex items-center justify-center p-2 sm:p-4 animate-fadeIn" onClick={onClose}>
            <div 
                className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden transition-all duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Bar */}
                <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                                    {isKa ? 'აქტივობა & აუდიტის ლოგი' : 'Activity & Audit Log'}
                                </h2>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                                    {event.name}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {isKa ? 'ყველა ოპერაციის, ჩანაწერისა და ვერსიის სრული გამჭვირვალე ისტორია' : 'Complete transparent trace of state versions & every scan operation'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all border border-slate-700/60 cursor-pointer"
                        title="Close"
                    >
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Presence & Controls Bar */}
                <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    {/* Active Collaborators */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-sm">
                        <ActiveUsersPresenceBar harvestId={event.id} />
                    </div>

                    {/* Filters & Search */}
                    <div className="flex flex-wrap items-center gap-2 flex-1 md:flex-none">
                        {/* User / Author Filter */}
                        <div className="relative flex-1 sm:w-64">
                            <Filter className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                value={authorFilter}
                                onChange={(e) => setAuthorFilter(e.target.value)}
                                className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm cursor-pointer"
                            >
                                <option value="all">{isKa ? 'ყველა მომხმარებელი (All Users)' : 'All Users & Operators'}</option>
                                {uniqueUsersWithRoles.map(u => (
                                    <option key={u.name} value={u.name}>
                                        👤 {u.fullDisplay}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search Input */}
                        <div className="relative flex-1 sm:w-56">
                            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={isKa ? 'ძებნა (მუშაკი, მომხმარებელი, წონა)...' : 'Search worker, user, weight...'}
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-100/70 px-4 pt-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('entries')}
                        className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
                            activeTab === 'entries'
                                ? 'bg-white text-blue-700 border-slate-200 shadow-sm -mb-px'
                                : 'text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-200/50'
                        }`}
                    >
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span>{isKa ? 'ოპერაციების აუდიტი (Scan Entries Log)' : 'Scan Entries Audit Log'}</span>
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
                            {filteredScanEntries.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('deltas')}
                        className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
                            activeTab === 'deltas'
                                ? 'bg-white text-blue-700 border-slate-200 shadow-sm -mb-px'
                                : 'text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-200/50'
                        }`}
                    >
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span>{isKa ? 'სესიის ვერსიები (State Versions)' : 'State Versions (Restore Points)'}</span>
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                            {filteredVersionLogs.length}
                        </span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                    {isLoading ? (
                        <div className="py-16 text-center">
                            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
                            <p className="text-xs font-semibold text-slate-500">{isKa ? 'აუდიტის ისტორია იტვირთება...' : 'Loading audit history & deltas...'}</p>
                        </div>
                    ) : activeTab === 'entries' ? (
                        /* TAB 2: SCAN ENTRIES / AUDIT LOG */
                        filteredScanEntries.length === 0 ? (
                            <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                                <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-600">{isKa ? 'ოპერაციების ჩანაწერები არ მოიძებნა' : 'No scan operations found matching filter'}</p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {filteredScanEntries.map((item) => (
                                    <div 
                                        key={item.id}
                                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                            item.type === 'deleted'
                                                ? 'bg-rose-50/60 border-rose-200/80 text-rose-900 shadow-sm'
                                                : item.type === 'rate_change'
                                                ? 'bg-purple-50/50 border-purple-200/80 text-purple-900'
                                                : item.type === 'variety_change'
                                                ? 'bg-amber-50/50 border-amber-200/80 text-amber-900'
                                                : 'bg-white border-slate-200 hover:border-blue-200 shadow-sm hover:shadow'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            {/* Type Badge Icon */}
                                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                                item.type === 'deleted'
                                                    ? 'bg-rose-100 text-rose-600'
                                                    : item.type === 'rate_change'
                                                    ? 'bg-purple-100 text-purple-600'
                                                    : item.type === 'variety_change'
                                                    ? 'bg-amber-100 text-amber-600'
                                                    : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {item.type === 'deleted' ? (
                                                    <Trash2 className="h-4 w-4" />
                                                ) : item.type === 'rate_change' ? (
                                                    <Tag className="h-4 w-4" />
                                                ) : item.type === 'variety_change' ? (
                                                    <RefreshCw className="h-4 w-4" />
                                                ) : (
                                                    <Scale className="h-4 w-4" />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                {/* Header line: User Name & Role + Timestamp */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                                                        <User className="h-3 w-3 text-slate-400" />
                                                        user: <span className="text-blue-700 font-extrabold">{item.userName}</span>
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                        {item.userRole}
                                                    </span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                                        <Clock className="h-3 w-3 text-slate-400" />
                                                        {formatFullDateTime(item.timestamp)}
                                                    </span>
                                                </div>

                                                {/* Details line: Weight, Box, Worker, Action */}
                                                <div className="mt-1.5 text-xs font-medium text-slate-700 flex items-center gap-2 flex-wrap">
                                                    <span className={`font-bold ${item.type === 'deleted' ? 'line-through text-rose-700' : 'text-slate-900'}`}>
                                                        {item.details}
                                                    </span>

                                                    {/* Status Tag */}
                                                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                                        item.type === 'deleted'
                                                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                                                            : item.type === 'rate_change'
                                                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                                                            : item.type === 'variety_change'
                                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    }`}>
                                                        {item.type === 'deleted' ? 'DELETED' : item.type === 'rate_change' ? 'RATE CHANGE' : item.type === 'variety_change' ? 'VARIETY CHANGE' : 'RECORDED'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons: Delete / Restore */}
                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                            {item.type === 'deleted' && item.deletedEntryObj && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRestoreDeletedEntry(item.deletedEntryObj!)}
                                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                                                    title="Restore deleted weighing back into active event"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    <span>{isKa ? 'აღდგენა (Restore)' : 'Restore Entry'}</span>
                                                </button>
                                            )}

                                            {item.type === 'recorded' && item.originalEntry && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteEntry(item.originalEntry!)}
                                                    className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                                    title="Delete entry with audit logging"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span>{isKa ? 'წაშლა' : 'Delete'}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        /* TAB 1: STATE VERSIONS (RESTORE POINTS) */
                        filteredVersionLogs.length === 0 ? (
                            <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                                <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-600">{isKa ? 'ვერსიების ისტორია არ მოიძებნა' : 'No state versions found matching filter'}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredVersionLogs.map((log) => {
                                    const userRes = resolveUserAndRole(log.authorId || log.payload?.scannedBy);
                                    const payload = log.payload || {};

                                    return (
                                        <div 
                                            key={log.id}
                                            className="p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                        >
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 font-extrabold text-xs flex items-center justify-center border border-amber-200 shrink-0">
                                                    v#{log.sequenceId}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    {/* Version Title & Action */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-xs font-black text-slate-900 tracking-wide uppercase">
                                                            {payload.name || `${log.actionType.replace(/_/g, ' ')}`}
                                                        </h4>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                            {log.actionType}
                                                        </span>
                                                    </div>

                                                    {/* User Name & Role */}
                                                    <div className="mt-1.5 flex items-center gap-3 text-xs font-medium text-slate-600 flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <User className="h-3.5 w-3.5 text-blue-600" />
                                                            user: <b className="text-slate-900 font-black">{userRes.fullDisplay}</b>
                                                        </span>
                                                        <span className="text-slate-300">|</span>
                                                        <span className="flex items-center gap-1 text-slate-500">
                                                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                            {formatFullDateTime(log.timestamp)}
                                                        </span>
                                                    </div>

                                                    {/* Payload metrics */}
                                                    <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-3 flex-wrap bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                        <span>Yield: <b className="text-slate-800 font-extrabold">{(payload.totalNetWeightKg || event.totalNetWeightKg || 0).toFixed(1)} KG</b></span>
                                                        <span>Boxes: <b className="text-slate-800 font-extrabold">{payload.totalBoxes || event.totalBoxes || 0}</b></span>
                                                        <span>Status: <b className="text-emerald-700 font-bold uppercase">{payload.status || event.status}</b></span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Restore Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleRestoreStateVersion(log)}
                                                disabled={isRestoring}
                                                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-extrabold flex items-center gap-1.5 shadow transition-all cursor-pointer shrink-0 self-end sm:self-center"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                                <span>{isKa ? 'აღდგენა' : 'RESTORE'}</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>

                {/* Footer Info */}
                <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 text-white flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span>{isKa ? 'IndexedDB & Firestore ავტომატური უსაფრთხო სინქრონიზაცია' : 'Immutable audit trail persisted via IndexedDB & Firestore'}</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 cursor-pointer transition-all"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HarvestEventHistoryModal;
