import React, { useState, useMemo, useEffect } from 'react';
import type { 
    WorkAssignment, 
    Employee, 
    InventoryItem, 
    MaterialUsed, 
    WorkAssignmentAuditEntry,
    User,
    Machinery,
    AssignedVehicle
} from '../types';
import { 
    X, CheckCircle2, Clock, DollarSign, UserCheck, Plus, Trash2, 
    FileSpreadsheet, Download, Copy, History, Search, ArrowRight,
    AlertCircle, Layers, Check, ExternalLink, Calendar, Briefcase,
    Shield, RefreshCw, ScanLine, Truck
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { exportToExcel } from '../utils/excelExporter';
import { createSpreadsheet, ensureGoogleToken } from '../services/googleSheetsService';
import QrScannerModal, { ScannerCategory, ParsedScanResult } from './QrScannerModal';
import { parseUniversalScan } from '../utils/universalScannerParser';
import { findMatchingEmployee } from '../utils/employeeMatching';
import { toast } from 'sonner';

interface WorkDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    work: WorkAssignment;
    employees: Employee[];
    inventoryItems: InventoryItem[];
    machinery?: Machinery[];
    currentUser?: User | null;
    onSaveWork?: (updatedWork: WorkAssignment) => void;
}

interface WorkerDraftRow {
    employeeId: string;
    name: string;
    paymentType: string;
    rate: number;
    hours: number;
    bonus: number;
    status: 'present' | 'completed' | 'overtime' | 'absent';
    workerNotes: string;
}

export const WorkDetailsModal: React.FC<WorkDetailsModalProps> = ({ 
    isOpen, 
    onClose, 
    work, 
    employees, 
    inventoryItems,
    machinery = [],
    currentUser,
    onSaveWork
}) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    // Active status
    const [status, setStatus] = useState<WorkAssignment['status']>(work.status || 'planned');
    const [workName, setWorkName] = useState<string>(
        typeof work.workName === 'string' ? work.workName : (work.workName as any)?.title || 'Work Task'
    );
    const [workDate, setWorkDate] = useState<string>(
        work.date ? work.date.split('T')[0] : new Date().toISOString().split('T')[0]
    );
    const [generalNotes, setGeneralNotes] = useState<string>(work.notes || '');

    // Search and tab
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'workers' | 'vehicles' | 'materials' | 'history'>('workers');
    const [selectedNewEmployeeId, setSelectedNewEmployeeId] = useState('');
    const [isExportingGoogle, setIsExportingGoogle] = useState(false);

    // Draft worker rows
    const [workerRows, setWorkerRows] = useState<WorkerDraftRow[]>([]);
    
    // Draft materials
    const [materials, setMaterials] = useState<MaterialUsed[]>(work.materialsUsed || []);
    const [newMaterialId, setNewMaterialId] = useState('');
    const [newMaterialQty, setNewMaterialQty] = useState<number>(1);

    // Draft vehicles
    const [vehicles, setVehicles] = useState<AssignedVehicle[]>(work.assignedVehicles || []);
    const [selectedMachineryId, setSelectedMachineryId] = useState<string>(machinery[0]?.id || '');
    const [vehicleHours, setVehicleHours] = useState<number>(work.plannedTime || 8);

    // QR / Barcode Scanner state
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerCategory, setScannerCategory] = useState<ScannerCategory>('auto');

    // Audit logs
    const [auditLogs, setAuditLogs] = useState<WorkAssignmentAuditEntry[]>(work.changeHistory || []);

    // Initialize worker rows from work assignment and employees
    useEffect(() => {
        if (!isOpen) return;
        setStatus(work.status || 'planned');
        setWorkName(typeof work.workName === 'string' ? work.workName : (work.workName as any)?.title || 'Work Task');
        setWorkDate(work.date ? work.date.split('T')[0] : new Date().toISOString().split('T')[0]);
        setGeneralNotes(work.notes || '');
        setMaterials(work.materialsUsed || []);
        setVehicles(work.assignedVehicles || []);
        setAuditLogs(work.changeHistory || []);

        const defaultDuration = work.plannedTime || 8;
        const rawEmpIds = work.assignedEmployeeIds || [];
        const seenEmpIds = new Set<string>();
        const uniqueEmpIds = rawEmpIds.filter(id => {
            if (!id || seenEmpIds.has(id)) return false;
            seenEmpIds.add(id);
            return true;
        });

        const initialRows: WorkerDraftRow[] = uniqueEmpIds.map(empId => {
            const emp = employees.find(e => e.id === empId);
            const loggedHours = work.employeeHours?.find(h => h.employeeId === empId)?.hours;
            const hours = loggedHours !== undefined ? loggedHours : defaultDuration;
            const rate = emp?.paymentRate || 0;
            const paymentType = emp?.paymentType || 'hourly';

            return {
                employeeId: empId,
                name: emp?.name || (isKa ? 'თანამშრომელი' : 'Employee'),
                paymentType,
                rate,
                hours,
                bonus: 0,
                status: 'present',
                workerNotes: ''
            };
        });
        setWorkerRows(initialRows);
    }, [isOpen, work, employees, isKa]);

    if (!isOpen) return null;

    // Calculations
    const calculatedWorkers = workerRows.map(row => {
        let basePay = 0;
        if (row.paymentType === 'daily') {
            basePay = (row.hours / 8) * row.rate;
        } else if (row.paymentType === 'fixed_salary') {
            basePay = 0; // fixed monthly
        } else {
            basePay = row.hours * row.rate;
        }
        const totalPay = Math.max(0, basePay + (row.bonus || 0));
        return {
            ...row,
            basePay,
            totalPay
        };
    });

    const totalLaborCost = calculatedWorkers.reduce((sum, w) => sum + w.totalPay, 0);
    const totalHoursLogged = calculatedWorkers.reduce((sum, w) => sum + w.hours, 0);

    const materialDetails = materials.map(mat => {
        const item = inventoryItems.find(i => i.id === mat.inventoryItemId);
        const cost = (mat.quantity || 0) * (item?.unitCost || 0);
        return {
            ...mat,
            name: item?.name || 'Item',
            unit: item?.unitOfMeasure || 'units',
            unitCost: item?.unitCost || 0,
            totalCost: cost
        };
    });

    const totalMaterialCost = materialDetails.reduce((sum, m) => sum + m.totalCost, 0);

    const totalVehicleCost = vehicles.reduce((sum, v) => {
        if (!v.isOwned) {
            return sum + (v.usageHours || 0) * (v.hiredCost || 0);
        }
        return sum;
    }, 0);

    const totalOPEX = totalLaborCost + totalMaterialCost + totalVehicleCost;

    // Filtered workers for search
    const filteredWorkers = calculatedWorkers.filter(w => 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.paymentType.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Available employees to add
    const availableEmployeesToAdd = employees.filter(
        e => !workerRows.some(r => r.employeeId === e.id)
    );

    // Handlers
    const handleAddVehicle = () => {
        const mach = machinery.find(m => m.id === selectedMachineryId) || machinery[0];
        if (!mach) {
            toast.error(isKa ? "ტექნიკა ვერ მოიძებნა" : "No machinery available");
            return;
        }

        const newVeh: AssignedVehicle = {
            id: `v-${Date.now()}`,
            name: mach.name,
            machineryId: mach.id,
            isOwned: mach.isOwned ?? true,
            hiredCost: mach.hourlyRate || mach.baseCostRate || 0,
            usageHours: Number(vehicleHours) || 8,
            vehicleType: 'other'
        };

        setVehicles(prev => [...prev, newVeh]);
        toast.success(isKa ? `ტექნიკა "${mach.name}" დაემატა` : `Vehicle "${mach.name}" assigned`);
    };

    const handleRemoveVehicle = (id: string) => {
        setVehicles(prev => prev.filter(v => v.id !== id));
        toast.info(isKa ? "ტექნიკა წაიშალა" : "Vehicle removed");
    };
    const handleUpdateWorkerHours = (employeeId: string, hours: number) => {
        setWorkerRows(prev => prev.map(r => r.employeeId === employeeId ? { ...r, hours: Math.max(0, hours) } : r));
    };

    const handleUpdateWorkerRate = (employeeId: string, rate: number) => {
        setWorkerRows(prev => prev.map(r => r.employeeId === employeeId ? { ...r, rate: Math.max(0, rate) } : r));
    };

    const handleUpdateWorkerBonus = (employeeId: string, bonus: number) => {
        setWorkerRows(prev => prev.map(r => r.employeeId === employeeId ? { ...r, bonus } : r));
    };

    const handleUpdateWorkerStatus = (employeeId: string, newStatus: WorkerDraftRow['status']) => {
        setWorkerRows(prev => prev.map(r => r.employeeId === employeeId ? { ...r, status: newStatus } : r));
    };

    const handleAddWorker = () => {
        if (!selectedNewEmployeeId) return;
        if (workerRows.some(r => r.employeeId === selectedNewEmployeeId)) {
            toast.info(isKa ? "თანამშრომელი უკვე დამატებულია" : "Employee already assigned");
            setSelectedNewEmployeeId('');
            return;
        }
        const emp = employees.find(e => e.id === selectedNewEmployeeId);
        if (!emp) return;

        const newRow: WorkerDraftRow = {
            employeeId: emp.id,
            name: emp.name,
            paymentType: emp.paymentType || 'hourly',
            rate: emp.paymentRate || 0,
            hours: work.plannedTime || 8,
            bonus: 0,
            status: 'present',
            workerNotes: ''
        };

        setWorkerRows(prev => {
            if (prev.some(r => r.employeeId === newRow.employeeId)) return prev;
            return [...prev, newRow];
        });
        setSelectedNewEmployeeId('');
        toast.success(isKa ? `${emp.name} დაემატა სამუშაოზე` : `Added ${emp.name} to work`);
    };

    const handleRemoveWorker = (employeeId: string) => {
        const row = workerRows.find(r => r.employeeId === employeeId);
        setWorkerRows(prev => prev.filter(r => r.employeeId !== employeeId));
        if (row) {
            toast.info(isKa ? `${row.name} წაიშალა სიიდან` : `Removed ${row.name}`);
        }
    };

    const handleAddMaterial = () => {
        if (!newMaterialId) return;
        const item = inventoryItems.find(i => i.id === newMaterialId);
        if (!item) return;

        setMaterials(prev => {
            const existingIdx = prev.findIndex(m => m.inventoryItemId === newMaterialId);
            if (existingIdx >= 0) {
                const copy = [...prev];
                copy[existingIdx] = { ...copy[existingIdx], quantity: copy[existingIdx].quantity + newMaterialQty };
                return copy;
            } else {
                return [...prev, { inventoryItemId: newMaterialId, quantity: newMaterialQty }];
            }
        });
        setNewMaterialId('');
        setNewMaterialQty(1);
    };

    const handleRemoveMaterial = (inventoryItemId: string) => {
        setMaterials(prev => prev.filter(m => m.inventoryItemId !== inventoryItemId));
    };

    const handleScanResult = (result: string, targetCat: ScannerCategory = 'auto', parsed?: ParsedScanResult) => {
        const code = result.trim();
        if (!code) return;

        const scanData = parsed || parseUniversalScan(code, employees, inventoryItems, targetCat);

        // 1. Worker Identification
        if (scanData.detectedType === 'worker' || scanData.employee || targetCat === 'worker') {
            const matchedEmp = scanData.employee || findMatchingEmployee(employees, code) || employees.find(e => e.id === code || e.barcode === code || e.idNumber === code);
            if (matchedEmp) {
                if (workerRows.some(w => w.employeeId === matchedEmp.id)) {
                    toast.info(isKa ? `${matchedEmp.name} უკვე არის სიაში` : `${matchedEmp.name} is already assigned`);
                } else {
                    const defaultDuration = work.plannedTime || 8;
                    const newRow: WorkerDraftRow = {
                        employeeId: matchedEmp.id,
                        name: matchedEmp.name,
                        paymentType: matchedEmp.paymentType || 'hourly',
                        rate: matchedEmp.paymentRate || 0,
                        hours: defaultDuration,
                        bonus: 0,
                        status: 'present',
                        workerNotes: isKa ? 'დამატებულია QR სკანირებით' : 'Assigned via QR Scan'
                    };
                    setWorkerRows(prev => [...prev, newRow]);
                    toast.success(isKa ? `✓ ${matchedEmp.name} წარმატებით დაემატა სამუშაოზე!` : `✓ Assigned ${matchedEmp.name} to task!`);
                }
                return;
            } else if (targetCat === 'worker' && !workerRows.some(w => w.name === code || w.employeeId === code)) {
                const tempId = `worker-scan-${Date.now()}`;
                const newRow: WorkerDraftRow = {
                    employeeId: tempId,
                    name: code,
                    paymentType: 'hourly',
                    rate: 10,
                    hours: work.plannedTime || 8,
                    bonus: 0,
                    status: 'present',
                    workerNotes: isKa ? 'ახალი მუშაკი (QR)' : 'New worker (QR)'
                };
                setWorkerRows(prev => [...prev, newRow]);
                toast.success(isKa ? `✓ მუშაკი "${code}" დაემატა!` : `✓ Added worker "${code}"!`);
                return;
            }
        }

        // 2. Material / Agro-input Identification
        if (scanData.detectedType === 'material' || scanData.material || ['material', 'supplies', 'assets', 'goods'].includes(targetCat)) {
            const mat = scanData.material;
            const item = mat?.item || inventoryItems.find(i => 
                i.id === (mat?.materialId || code) || 
                (i as any).sku === (mat?.sku || code) ||
                i.name.toLowerCase() === (mat?.materialName || code).toLowerCase()
            );

            const qtyToAdd = mat?.quantity || 1;
            const unitToAdd = mat?.unit || item?.unitOfMeasure || 'units';
            const nameToAdd = mat?.materialName || item?.name || code;
            const unitCost = item?.unitCost || 0;

            if (item) {
                const existing = materials.find(m => m.inventoryItemId === item.id);
                if (existing) {
                    setMaterials(prev => prev.map(m => m.inventoryItemId === item.id 
                        ? { ...m, quantity: m.quantity + qtyToAdd, cost: (m.quantity + qtyToAdd) * (m.unitCost || 0) } 
                        : m
                    ));
                    toast.success(isKa ? `✓ +${qtyToAdd} ${unitToAdd} ${item.name}` : `✓ +${qtyToAdd} ${unitToAdd} ${item.name} added`);
                } else {
                    setMaterials(prev => [...prev, {
                        inventoryItemId: item.id,
                        name: item.name,
                        quantity: qtyToAdd,
                        unit: unitToAdd,
                        unitCost: unitCost,
                        cost: unitCost * qtyToAdd
                    }]);
                    toast.success(isKa ? `✓ ${item.name} (${qtyToAdd} ${unitToAdd}) დაემატა მასალებში!` : `✓ Added ${item.name} (${qtyToAdd} ${unitToAdd}) to materials!`);
                }
                setIsScannerOpen(false);
                return;
            } else {
                setMaterials(prev => [...prev, {
                    inventoryItemId: mat?.materialId || `mat-scan-${Date.now()}`,
                    name: nameToAdd,
                    quantity: qtyToAdd,
                    unit: unitToAdd,
                    unitCost: 0,
                    cost: 0
                }]);
                toast.success(isKa ? `✓ ${nameToAdd} (${qtyToAdd} ${unitToAdd}) დაემატა!` : `✓ Added ${nameToAdd} (${qtyToAdd} ${unitToAdd})!`);
                setIsScannerOpen(false);
                return;
            }
        }

        toast.error(isKa ? `კოდი ვერ მოიძებნა თანამშრომლებში ან მასალებში: ${code}` : `Unrecognized QR code: ${code}`);
    };

    // Save and commit changes
    const handleSaveChanges = () => {
        const userDisplayName = currentUser?.name || 'Administrator';
        const userEmail = currentUser?.email || 'admin@agrimap.ge';
        const nowIso = new Date().toISOString();

        // Build audit entries
        const newAuditEntries: WorkAssignmentAuditEntry[] = [];

        // Check status change
        if (status !== work.status) {
            newAuditEntries.push({
                id: `audit-${Date.now()}-status`,
                timestamp: nowIso,
                userName: userDisplayName,
                userEmail,
                action: 'Status Updated',
                details: `Status changed from "${work.status}" to "${status}".`,
                fieldChanged: 'status',
                oldValue: String(work.status),
                newValue: String(status)
            });
        }

        // Check worker changes
        const oldWorkersMap = new Map((work.employeeHours || []).map(h => [h.employeeId, h.hours]));
        workerRows.forEach(wr => {
            const oldHours = oldWorkersMap.get(wr.employeeId);
            if (oldHours === undefined) {
                newAuditEntries.push({
                    id: `audit-${Date.now()}-${wr.employeeId}-add`,
                    timestamp: nowIso,
                    userName: userDisplayName,
                    userEmail,
                    action: 'Worker Added',
                    details: `Added ${wr.name} with ${wr.hours}h at rate ${wr.rate}.`,
                    fieldChanged: 'workforce',
                    newValue: wr.name
                });
            } else if (oldHours !== wr.hours) {
                newAuditEntries.push({
                    id: `audit-${Date.now()}-${wr.employeeId}-hours`,
                    timestamp: nowIso,
                    userName: userDisplayName,
                    userEmail,
                    action: 'Hours Adjusted',
                    details: `${wr.name}: hours updated from ${oldHours}h to ${wr.hours}h (Payroll: ${wr.hours * wr.rate}).`,
                    fieldChanged: 'hours',
                    oldValue: `${oldHours}h`,
                    newValue: `${wr.hours}h`
                });
            }
        });

        // If payroll total changed
        const oldPayroll = work.totalLaborCost || 0;
        if (Math.abs(oldPayroll - totalLaborCost) > 0.01) {
            newAuditEntries.push({
                id: `audit-${Date.now()}-payroll`,
                timestamp: nowIso,
                userName: userDisplayName,
                userEmail,
                action: 'Payroll Recalculated',
                details: `Total payroll adjusted from ${oldPayroll.toFixed(2)} to ${totalLaborCost.toFixed(2)}.`,
                fieldChanged: 'totalLaborCost',
                oldValue: String(oldPayroll.toFixed(2)),
                newValue: String(totalLaborCost.toFixed(2))
            });
        }

        const combinedHistory = [...(work.changeHistory || []), ...newAuditEntries];

        const uniqueEmployeeIds = Array.from(new Set(workerRows.map(r => r.employeeId)));

        const updatedWork: WorkAssignment = {
            ...work,
            workName: workName.trim() || work.workName,
            date: new Date(workDate).toISOString(),
            status,
            notes: generalNotes,
            assignedEmployeeIds: uniqueEmployeeIds,
            employeeHours: uniqueEmployeeIds.map(empId => {
                const row = workerRows.find(r => r.employeeId === empId);
                return { employeeId: empId, hours: row ? row.hours : (work.plannedTime || 8) };
            }),
            materialsUsed: materials,
            assignedVehicles: vehicles,
            totalLaborCost,
            totalMaterialCost,
            totalCost: totalOPEX,
            changeHistory: combinedHistory
        };

        if (onSaveWork) {
            onSaveWork(updatedWork);
        }

        toast.success(isKa ? "სამუშაო და სახელფასო უწყისი წარმატებით განახლდა!" : "Work details & payroll reconciled successfully!");
        onClose();
    };

    // Export to Excel
    const handleExportExcel = () => {
        const rows = calculatedWorkers.map((w, idx) => ({
            'No / #': idx + 1,
            'Task Mission / სამუშაო': workName,
            'Date / თარიღი': workDate,
            'Status / სტატუსი': status,
            'Employee / თანამშრომელი': w.name,
            'Pay Type / ანაზღაურება': w.paymentType,
            'Hours / საათები': w.hours,
            'Rate / ტარიფი': w.rate,
            'Calculated Pay / ხელფასი': Number(w.basePay.toFixed(2)),
            'Bonus / პრემია': Number(w.bonus.toFixed(2)),
            'Total Sum / ჯამი': Number(w.totalPay.toFixed(2)),
            'Attendance / დასწრება': w.status,
            'Notes / შენიშვნა': w.workerNotes || generalNotes
        }));

        const fileName = `Work_Yield_Payroll_${workName.replace(/\s+/g, '_')}_${workDate}`;
        exportToExcel(rows, fileName, 'Task_Payroll');
        toast.success(isKa ? "Excel ფაილი გადმოწერილია" : "Exported to Excel (.xls) successfully");
    };

    // Copy TSV for Google Sheets
    const handleCopyForGoogleSheets = () => {
        const headers = ['No', 'Task Name', 'Date', 'Status', 'Employee', 'Pay Type', 'Hours', 'Rate', 'Base Pay', 'Bonus', 'Total Payroll', 'Attendance'];
        const lines = [headers.join('\t')];

        calculatedWorkers.forEach((w, idx) => {
            lines.push([
                idx + 1,
                workName,
                workDate,
                status,
                w.name,
                w.paymentType,
                w.hours,
                w.rate,
                w.basePay.toFixed(2),
                w.bonus.toFixed(2),
                w.totalPay.toFixed(2),
                w.status
            ].join('\t'));
        });

        // Totals row
        lines.push(['TOTAL', '', '', '', `${calculatedWorkers.length} Workers`, '', totalHoursLogged.toFixed(1), '', '', '', totalLaborCost.toFixed(2), ''].join('\t'));

        navigator.clipboard.writeText(lines.join('\n'));
        toast.success(isKa ? "ცხრილი დაკოპირებულია! გახსენით Google Sheets და ჩასვით (Ctrl+V)" : "Table copied to clipboard! Paste directly into Google Sheets (Ctrl+V)");
    };

    // Direct Google Sheets Export
    const handleExportGoogleSheets = async () => {
        try {
            setIsExportingGoogle(true);
            toast.info(isKa ? "Google Sheets-ში ექსპორტი მიმდინარეობს..." : "Creating Google Sheet spreadsheet...");
            
            const token = await ensureGoogleToken();
            const sheetTitle = `AgriMap Work - ${workName} (${workDate})`;

            const headerRow = ['No', 'Mission Name', 'Date', 'Status', 'Worker Name', 'Payment Type', 'Hours Worked', 'Hourly/Daily Rate', 'Base Pay', 'Bonus/Adjustment', 'Total Net Pay', 'Attendance'];
            const dataRows = calculatedWorkers.map((w, idx) => [
                idx + 1,
                workName,
                workDate,
                status,
                w.name,
                w.paymentType,
                w.hours,
                w.rate,
                Number(w.basePay.toFixed(2)),
                Number(w.bonus.toFixed(2)),
                Number(w.totalPay.toFixed(2)),
                w.status
            ]);

            const summaryRow = ['TOTALS', '', '', '', `${calculatedWorkers.length} Workers`, '', totalHoursLogged, '', '', '', totalLaborCost, ''];

            const newSpreadsheet = await createSpreadsheet(
                sheetTitle,
                [
                    {
                        title: 'Payroll & Work Details',
                        headers: headerRow,
                        rows: dataRows,
                        summaryRows: [summaryRow]
                    }
                ],
                token
            );

            if (!newSpreadsheet?.spreadsheetId) {
                throw new Error("Failed to create spreadsheet");
            }

            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-black text-xs">
                        {isKa ? 'Google Sheets წარმატებით შეიქმნა!' : 'Google Sheet Created Successfully!'}
                    </span>
                    <a 
                        href={newSpreadsheet.spreadsheetUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-400 font-bold underline text-[11px] flex items-center gap-1"
                    >
                        <ExternalLink size={12} /> {isKa ? 'გახსენით ცხრილი' : 'Open in Google Sheets'}
                    </a>
                </div>,
                { duration: 8000 }
            );
        } catch (err: any) {
            console.error("Google sheets export error:", err);
            toast.error(err?.message || (isKa ? "Google Sheets ექსპორტი ვერ მოხერხდა" : "Failed to export to Google Sheets"));
        } finally {
            setIsExportingGoogle(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
            <div 
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Top Yield Control Banner */}
                <div className="bg-slate-900 text-white p-4 sm:p-5 border-b border-slate-800 flex-shrink-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-2xl">
                                <Briefcase size={22} className="text-indigo-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-black tracking-tight uppercase text-white">
                                        {workName}
                                    </h2>
                                    <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 text-[9px] font-black px-2.5 py-0.5 rounded-lg uppercase tracking-widest">
                                        {isKa ? 'სამუშაოსა და ხელფასის კონტროლი' : 'Work & Payroll Control'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                    {workDate} • {work.taskType || 'Field Task'} • {status.toUpperCase()}
                                </p>
                            </div>
                        </div>

                        {/* Status Toggle & Close */}
                        <div className="flex items-center gap-2">
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border outline-none cursor-pointer transition-colors ${
                                    status === 'completed' ? 'bg-emerald-950 text-emerald-300 border-emerald-700' :
                                    status === 'in-progress' ? 'bg-blue-950 text-blue-300 border-blue-700' :
                                    'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                            >
                                <option value="planned">{isKa ? 'დაგეგმილი (Planned)' : 'Planned'}</option>
                                <option value="in-progress">{isKa ? 'მიმდინარე (In Progress)' : 'In Progress'}</option>
                                <option value="completed">{isKa ? 'დასრულებული (Completed)' : 'Completed'}</option>
                            </select>

                            <button 
                                onClick={onClose}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* KPI Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-[10px]">
                        <div className="bg-emerald-950/80 p-2.5 rounded-2xl border border-emerald-800/80 shadow-2xs">
                            <span className="text-emerald-400 font-black uppercase block tracking-wider text-[8px]">
                                {isKa ? 'სრული OPEX ხარჯი' : 'TOTAL OPEX'}
                            </span>
                            <span className="text-sm sm:text-base font-black text-emerald-300 truncate block">
                                {formatCurrency(totalOPEX)}
                            </span>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 shadow-2xs">
                            <span className="text-indigo-300 font-black uppercase block tracking-wider text-[8px]">
                                {isKa ? 'სახელფასო ფონდი (Labor)' : 'LABOR PAYROLL'}
                            </span>
                            <span className="text-sm sm:text-base font-black text-indigo-200 truncate block">
                                {formatCurrency(totalLaborCost)}
                            </span>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 shadow-2xs">
                            <span className="text-slate-400 font-black uppercase block tracking-wider text-[8px]">
                                {isKa ? 'ჯამური საათები' : 'TOTAL WORK HOURS'}
                            </span>
                            <span className="text-sm sm:text-base font-black text-white truncate block">
                                {totalHoursLogged.toFixed(1)} <span className="text-[10px] text-slate-400 font-bold">hrs</span>
                            </span>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 shadow-2xs">
                            <span className="text-slate-400 font-black uppercase block tracking-wider text-[8px]">
                                {isKa ? 'მუშახელის რაოდენობა' : 'ACTIVE WORKFORCE'}
                            </span>
                            <span className="text-sm sm:text-base font-black text-white truncate block">
                                {workerRows.length} <span className="text-[10px] text-slate-400 font-bold">{isKa ? 'მუშაკი' : 'workers'}</span>
                            </span>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 shadow-2xs">
                            <span className="text-emerald-300 font-black uppercase block tracking-wider text-[8px]">
                                {isKa ? 'ტექნიკა (Machinery)' : 'MACHINERY OPEX'}
                            </span>
                            <span className="text-sm sm:text-base font-black text-emerald-200 truncate block">
                                {formatCurrency(totalVehicleCost)}
                            </span>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 shadow-2xs">
                            <span className="text-amber-300 font-black uppercase block tracking-wider text-[8px]">
                                {isKa ? 'მასალების ხარჯი' : 'MATERIALS OPEX'}
                            </span>
                            <span className="text-sm sm:text-base font-black text-amber-200 truncate block">
                                {formatCurrency(totalMaterialCost)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Sub-Header Navigation & Actions */}
                <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                    {/* Tabs */}
                    <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-2xl">
                        <button
                            onClick={() => setActiveTab('workers')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                activeTab === 'workers' 
                                    ? 'bg-white text-indigo-600 shadow-sm' 
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <UserCheck size={14} />
                            <span>{isKa ? 'მუშაკები და ხელფასი' : 'Workers & Payroll'}</span>
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-md text-[10px]">
                                {workerRows.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('vehicles')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                activeTab === 'vehicles' 
                                    ? 'bg-white text-emerald-600 shadow-sm' 
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Truck size={14} />
                            <span>{isKa ? 'ტექნიკა' : 'Vehicles'}</span>
                            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded-md text-[10px]">
                                {vehicles.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('materials')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                activeTab === 'materials' 
                                    ? 'bg-white text-indigo-600 shadow-sm' 
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Layers size={14} />
                            <span>{isKa ? 'მასალები' : 'Materials'}</span>
                            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md text-[10px]">
                                {materials.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                activeTab === 'history' 
                                    ? 'bg-white text-indigo-600 shadow-sm' 
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <History size={14} />
                            <span>{isKa ? 'ცვლილებების ისტორია' : 'Audit History'}</span>
                            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md text-[10px]">
                                {auditLogs.length}
                            </span>
                        </button>
                    </div>

                    {/* Export Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all"
                            title="Export to Microsoft Excel"
                        >
                            <Download size={14} />
                            <span>Excel</span>
                        </button>

                        <button
                            onClick={handleExportGoogleSheets}
                            disabled={isExportingGoogle}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                            title="Export to Google Sheets"
                        >
                            {isExportingGoogle ? <RefreshCw size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                            <span>Google Sheets</span>
                        </button>

                        <button
                            onClick={handleCopyForGoogleSheets}
                            className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider shadow-2xs flex items-center gap-1.5 transition-all"
                            title="Copy TSV for quick paste into Google Sheets"
                        >
                            <Copy size={13} />
                            <span>Copy TSV</span>
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                    {/* TAB 1: WORKERS & PAYROLL */}
                    {activeTab === 'workers' && (
                        <div className="space-y-4">
                            {/* Controls row: Add Worker and Search */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
                                <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
                                    <select
                                        value={selectedNewEmployeeId}
                                        onChange={(e) => setSelectedNewEmployeeId(e.target.value)}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">
                                            {isKa ? '-- აირჩიეთ მუშაკი დასამატებლად --' : '-- Choose worker to assign --'}
                                        </option>
                                        {availableEmployeesToAdd.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} ({emp.paymentType}, {formatCurrency(emp.paymentRate)})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddWorker}
                                        disabled={!selectedNewEmployeeId}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all"
                                    >
                                        <Plus size={14} />
                                        <span>{isKa ? 'დამატება' : 'Add'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setScannerCategory('worker');
                                            setIsScannerOpen(true);
                                        }}
                                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all"
                                        title={isKa ? 'თანამშრომლის QR / ბეიჯის სკანირება' : 'Scan Worker QR / Badge'}
                                    >
                                        <ScanLine size={14} className="text-emerald-400" />
                                        <span>{isKa ? 'QR სკანერი' : 'Scan QR'}</span>
                                    </button>
                                </div>

                                <div className="relative min-w-[200px]">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder={isKa ? 'ძებნა სახელით...' : 'Search workers...'}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Workers Table */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[9px] tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="p-3">#</th>
                                            <th className="p-3">{isKa ? 'თანამშრომელი' : 'Employee'}</th>
                                            <th className="p-3">{isKa ? 'ტარიფის ტიპი' : 'Pay Type'}</th>
                                            <th className="p-3 text-right">{isKa ? 'საათები' : 'Hours'}</th>
                                            <th className="p-3 text-right">{isKa ? 'ტარიფი' : 'Rate'}</th>
                                            <th className="p-3 text-right">{isKa ? 'ბაზური თანხა' : 'Base Pay'}</th>
                                            <th className="p-3 text-right">{isKa ? 'პრემია / ბონუსი' : 'Bonus / Extra'}</th>
                                            <th className="p-3 text-right">{isKa ? 'სრული ხელფასი' : 'Calculated Sum'}</th>
                                            <th className="p-3 text-center">{isKa ? 'სტატუსი' : 'Attendance'}</th>
                                            <th className="p-3 text-center">{isKa ? 'წაშლა' : 'Action'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredWorkers.map((w, idx) => (
                                            <tr key={`${w.employeeId || 'worker'}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-3 font-mono text-slate-400 font-bold text-[10px]">
                                                    {idx + 1}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                                            {w.name.charAt(0)}
                                                        </div>
                                                        <span className="font-black text-slate-800 uppercase">
                                                            {w.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span className="capitalize px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold text-[10px]">
                                                        {w.paymentType}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={w.hours}
                                                        onChange={(e) => handleUpdateWorkerHours(w.employeeId, parseFloat(e.target.value) || 0)}
                                                        className="w-16 text-right px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-black text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={w.rate}
                                                        onChange={(e) => handleUpdateWorkerRate(w.employeeId, parseFloat(e.target.value) || 0)}
                                                        className="w-20 text-right px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-black text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-slate-600">
                                                    {formatCurrency(w.basePay)}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <input
                                                        type="number"
                                                        step="1"
                                                        value={w.bonus}
                                                        onChange={(e) => handleUpdateWorkerBonus(w.employeeId, parseFloat(e.target.value) || 0)}
                                                        className="w-16 text-right px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-black text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-right font-mono font-black text-indigo-700 text-sm">
                                                    {formatCurrency(w.totalPay)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <select
                                                        value={w.status}
                                                        onChange={(e) => handleUpdateWorkerStatus(w.employeeId, e.target.value as any)}
                                                        className="text-[10px] font-black uppercase px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                                                    >
                                                        <option value="present">{isKa ? 'დასწრება' : 'Present'}</option>
                                                        <option value="completed">{isKa ? 'დასრულებული' : 'Completed'}</option>
                                                        <option value="overtime">{isKa ? 'ზეგანაკვეთური' : 'Overtime'}</option>
                                                        <option value="absent">{isKa ? 'არ გამოცხადდა' : 'Absent'}</option>
                                                    </select>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleRemoveWorker(w.employeeId)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Remove worker"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}

                                        {filteredWorkers.length === 0 && (
                                            <tr>
                                                <td colSpan={10} className="p-8 text-center text-slate-400 font-bold uppercase text-[10px]">
                                                    {isKa ? 'თანამშრომლები არ არიან მითითებული' : 'No workers assigned yet. Select an employee above to assign.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {filteredWorkers.length > 0 && (
                                        <tfoot className="bg-slate-50 font-black text-slate-800 border-t-2 border-slate-200">
                                            <tr>
                                                <td colSpan={3} className="p-3 uppercase text-[10px] tracking-wider text-slate-500">
                                                    {isKa ? 'ჯამი / TOTALS' : 'GRAND TOTALS'}
                                                </td>
                                                <td className="p-3 text-right font-mono text-xs">
                                                    {totalHoursLogged.toFixed(1)} h
                                                </td>
                                                <td className="p-3 text-right font-mono text-[10px] text-slate-500">
                                                    {workerRows.length > 0 ? formatCurrency(totalLaborCost / (totalHoursLogged || 1)) + '/h' : '-'}
                                                </td>
                                                <td className="p-3 text-right font-mono text-xs text-slate-600">
                                                    {formatCurrency(calculatedWorkers.reduce((s, w) => s + w.basePay, 0))}
                                                </td>
                                                <td className="p-3 text-right font-mono text-xs text-slate-600">
                                                    {formatCurrency(calculatedWorkers.reduce((s, w) => s + w.bonus, 0))}
                                                </td>
                                                <td className="p-3 text-right font-mono text-base font-black text-emerald-600">
                                                    {formatCurrency(totalLaborCost)}
                                                </td>
                                                <td colSpan={2} />
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: VEHICLES & MACHINERY */}
                    {activeTab === 'vehicles' && (
                        <div className="space-y-4">
                            {/* Add Vehicle row */}
                            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                                <select
                                    value={selectedMachineryId}
                                    onChange={(e) => setSelectedMachineryId(e.target.value)}
                                    className="flex-1 min-w-[220px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="">
                                        {isKa ? '-- აირჩიეთ ტექნიკა / ავტომობილი --' : '-- Choose vehicle / machinery --'}
                                    </option>
                                    {machinery.map(mach => (
                                        <option key={mach.id} value={mach.id}>
                                            {mach.name} ({mach.isOwned ? (isKa ? 'კუთვნილი' : 'Owned') : `${isKa ? 'დაქირავებული' : 'Hired'} - ${formatCurrency(mach.hourlyRate || mach.baseCostRate || 0)}/h`})
                                        </option>
                                    ))}
                                </select>

                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-slate-500">{isKa ? 'საათი:' : 'Hours:'}</span>
                                    <input
                                        type="number"
                                        min="0.5"
                                        step="0.5"
                                        value={vehicleHours}
                                        onChange={(e) => setVehicleHours(Math.max(0.5, parseFloat(e.target.value) || 1))}
                                        className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-slate-800 text-right focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <button
                                    onClick={handleAddVehicle}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                >
                                    <Plus size={14} />
                                    <span>{isKa ? 'ტექნიკის დამატება' : 'Assign Vehicle'}</span>
                                </button>
                            </div>

                            {/* Vehicles Table */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        <tr>
                                            <th className="p-3">#</th>
                                            <th className="p-3">{isKa ? 'ტექნიკა / მოდელი' : 'Machinery / Model'}</th>
                                            <th className="p-3">{isKa ? 'ტიპი' : 'Asset Type'}</th>
                                            <th className="p-3 text-right">{isKa ? 'საათები' : 'Hours'}</th>
                                            <th className="p-3 text-right">{isKa ? 'ტარიფი' : 'Rate'}</th>
                                            <th className="p-3 text-right">{isKa ? 'ჯამური ხარჯი' : 'Total Cost'}</th>
                                            <th className="p-3 text-center">{isKa ? 'წაშლა' : 'Action'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {vehicles.map((veh, idx) => {
                                            const lineCost = !veh.isOwned ? (veh.usageHours || 0) * (veh.hiredCost || 0) : 0;
                                            return (
                                                <tr key={veh.id ? `${veh.id}-${idx}` : `veh-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="p-3 font-mono text-slate-400 font-bold text-[10px]">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="p-3 font-black text-slate-800 uppercase flex items-center gap-2">
                                                        <Truck size={14} className="text-emerald-600 flex-shrink-0" />
                                                        <span>{veh.name}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                                            veh.isOwned 
                                                                ? 'bg-blue-100 text-blue-800' 
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {veh.isOwned ? (isKa ? 'კუთვნილი' : 'Owned') : (isKa ? 'დაქირავებული' : 'Hired')}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <input
                                                            type="number"
                                                            min="0.5"
                                                            step="0.5"
                                                            value={veh.usageHours || 0}
                                                            onChange={(e) => {
                                                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                                                setVehicles(prev => prev.map(v => v.id === veh.id ? { ...v, usageHours: val } : v));
                                                            }}
                                                            className="w-16 text-right px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-slate-600">
                                                        {!veh.isOwned && veh.hiredCost ? `${formatCurrency(veh.hiredCost)}/h` : '-'}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-black text-emerald-600 text-sm">
                                                        {formatCurrency(lineCost)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            onClick={() => handleRemoveVehicle(veh.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title={isKa ? "ტექნიკის წაშლა" : "Remove vehicle"}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {vehicles.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-400 font-bold uppercase text-[10px]">
                                                    {isKa ? 'ტექნიკა არ არის მიმაგრებული ამ სამუშაოზე.' : 'No vehicles or machinery assigned to this task.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {vehicles.length > 0 && (
                                        <tfoot className="bg-slate-50 font-black text-slate-800 border-t-2 border-slate-200">
                                            <tr>
                                                <td colSpan={3} className="p-3 uppercase text-[10px] tracking-wider text-slate-500">
                                                    {isKa ? 'ჯამური საათები / ხარჯი' : 'TOTAL VEHICLE HOURS / COST'}
                                                </td>
                                                <td className="p-3 text-right font-mono text-xs text-slate-700">
                                                    {vehicles.reduce((s, v) => s + (v.usageHours || 0), 0).toFixed(1)} h
                                                </td>
                                                <td />
                                                <td className="p-3 text-right font-mono text-sm font-black text-emerald-600">
                                                    {formatCurrency(totalVehicleCost)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: MATERIALS */}
                    {activeTab === 'materials' && (
                        <div className="space-y-4">
                            {/* Add Material row */}
                            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200">
                                <select
                                    value={newMaterialId}
                                    onChange={(e) => setNewMaterialId(e.target.value)}
                                    className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="">
                                        {isKa ? '-- აირჩიეთ მასალა საწყობიდან --' : '-- Choose material from inventory --'}
                                    </option>
                                    {inventoryItems.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} ({item.unitOfMeasure}, {formatCurrency(item.unitCost || 0)})
                                        </option>
                                    ))}
                                </select>

                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.5"
                                    value={newMaterialQty}
                                    onChange={(e) => setNewMaterialQty(parseFloat(e.target.value) || 1)}
                                    className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-500"
                                    placeholder="Qty"
                                />

                                <button
                                    onClick={handleAddMaterial}
                                    disabled={!newMaterialId}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all"
                                >
                                    <Plus size={14} />
                                    <span>{isKa ? 'მასალის დამატება' : 'Add Material'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setScannerCategory('material');
                                        setIsScannerOpen(true);
                                    }}
                                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all"
                                    title={isKa ? 'მასალის / ინვენტარის QR / შტრიხკოდის სკანირება' : 'Scan Material QR / Barcode'}
                                >
                                    <ScanLine size={14} className="text-emerald-400" />
                                    <span>{isKa ? 'QR სკანერი' : 'Scan QR'}</span>
                                </button>
                            </div>

                            {/* Materials Table */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[9px] tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="p-3">#</th>
                                            <th className="p-3">{isKa ? 'მასალა' : 'Item Name'}</th>
                                            <th className="p-3 text-right">{isKa ? 'რაოდენობა' : 'Quantity'}</th>
                                            <th className="p-3 text-right">{isKa ? 'ერთეულის ფასი' : 'Unit Cost'}</th>
                                            <th className="p-3 text-right">{isKa ? 'ჯამური ხარჯი' : 'Total Cost'}</th>
                                            <th className="p-3 text-center">{isKa ? 'წაშლა' : 'Action'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {materialDetails.map((mat, idx) => (
                                            <tr key={`${mat.inventoryItemId || 'mat'}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-3 font-mono text-slate-400 font-bold text-[10px]">
                                                    {idx + 1}
                                                </td>
                                                <td className="p-3 font-black text-slate-800 uppercase">
                                                    {mat.name}
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-slate-700">
                                                    {mat.quantity} {mat.unit}
                                                </td>
                                                <td className="p-3 text-right font-mono text-slate-600">
                                                    {formatCurrency(mat.unitCost)}
                                                </td>
                                                <td className="p-3 text-right font-mono font-black text-amber-600">
                                                    {formatCurrency(mat.totalCost)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleRemoveMaterial(mat.inventoryItemId)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}

                                        {materialDetails.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-400 font-bold uppercase text-[10px]">
                                                    {isKa ? 'მასალები არ არის გამოყენებული' : 'No materials logged for this task.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {materialDetails.length > 0 && (
                                        <tfoot className="bg-slate-50 font-black text-slate-800 border-t-2 border-slate-200">
                                            <tr>
                                                <td colSpan={4} className="p-3 uppercase text-[10px] tracking-wider text-slate-500">
                                                    {isKa ? 'მასალების ჯამური ხარჯი' : 'TOTAL MATERIALS COST'}
                                                </td>
                                                <td className="p-3 text-right font-mono text-sm font-black text-amber-600">
                                                    {formatCurrency(totalMaterialCost)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: AUDIT HISTORY ("What was changed, when, and by whom") */}
                    {activeTab === 'history' && (
                        <div className="space-y-3">
                            <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-100 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-indigo-900">
                                    <History size={16} className="text-indigo-600" />
                                    <span className="text-xs font-black uppercase tracking-wider">
                                        {isKa ? 'ცვლილებებისა და აუდიტის ჟურნალი' : 'Change History & Audit Log'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-indigo-700 font-bold">
                                    {auditLogs.length} {isKa ? 'ჩანაწერი' : 'records logged'}
                                </span>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white divide-y divide-slate-100">
                                {auditLogs.map((entry, idx) => (
                                    <div key={entry.id ? `${entry.id}-${idx}` : `audit-${idx}`} className="p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[9px] font-black uppercase tracking-wider">
                                                    {entry.action}
                                                </span>
                                                <span className="text-xs font-bold text-slate-800">
                                                    {entry.details}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                                                <span className="font-bold text-slate-600">
                                                    👤 {entry.userName} {entry.userEmail ? `(${entry.userEmail})` : ''}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    🕒 {new Date(entry.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        {entry.oldValue && entry.newValue && (
                                            <div className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg shrink-0">
                                                <span className="text-red-500 line-through mr-1">{entry.oldValue}</span>
                                                <ArrowRight size={10} className="inline mx-1 text-slate-400" />
                                                <span className="text-emerald-600 font-bold">{entry.newValue}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {auditLogs.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'ცვლილებების ისტორია ჯერ ცარიელია' : 'No recorded changes yet. Changes you save will be logged here with author and timestamp.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls & Save Button */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{workerRows.length} {isKa ? 'მუშაკი დაფიქსირებულია' : 'workers logged'}</span>
                        <span>•</span>
                        <span className="font-black text-slate-800">{formatCurrency(totalOPEX)} Total OPEX</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition-colors"
                        >
                            {isKa ? 'დახურვა' : 'Close'}
                        </button>

                        <button
                            onClick={handleSaveChanges}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95"
                        >
                            <CheckCircle2 size={16} />
                            <span>{isKa ? 'ცვლილებების შენახვა და გადაანგარიშება' : 'Save Changes & Recalculate'}</span>
                        </button>
                    </div>
                </div>

                {/* Integrated Scanner Modal */}
                <QrScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => setIsScannerOpen(false)}
                    onScan={handleScanResult}
                    initialCategory={scannerCategory}
                    mockEmployees={employees}
                    inventoryItems={inventoryItems}
                    title={scannerCategory === 'worker' ? (isKa ? "თანამშრომლის QR სკანერი" : "Scan Worker QR / Badge") : (isKa ? "მასალის / ინვენტარის სკანერი" : "Scan Material SKU / Barcode")}
                    description={isKa ? "დაასკანერეთ კამერით ან USB/Bluetooth სკანერით" : "Scan with camera or USB/Bluetooth scanner"}
                />
            </div>
        </div>
    );
};

export default WorkDetailsModal;
