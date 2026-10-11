import React, { useState, useMemo } from 'react';
import { HarvestEvent, AssignedPicker, Employee, HarvestEntry, Role } from '../../types';
import { XIcon, ArrowDownTrayIcon } from '../Icons';
import { FileSpreadsheet, CheckSquare, Filter, ShieldCheck, ExternalLink, RefreshCw, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { createSpreadsheet, ensureGoogleToken } from '../../services/googleSheetsService';

interface ExportExcelModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: HarvestEvent;
    localPickers?: AssignedPicker[];
    employees: Employee[];
    entries: HarvestEntry[];
    roles?: Role[];
    durationHours?: number;
    calculatePickerEarnings?: (picker: AssignedPicker, totalWeight: number, hours: number) => number;
    selectedPickerIds?: Set<string>;
}

export const ExportExcelModal: React.FC<ExportExcelModalProps> = ({
    isOpen,
    onClose,
    event,
    localPickers = event.assignedPickers || [],
    employees,
    entries,
    roles = [],
    durationHours = 8,
    calculatePickerEarnings = (picker, totalWeight, hours) => {
        const rate = Number(picker.rate) || 0;
        const bonus = Number(picker.bonus) || 0;
        const model = String(picker.paymentModel || '');
        const isCombined = model === 'combined';
        if (isCombined) {
            const days = picker.manualDays ?? picker.combinedShiftFraction ?? 0.5;
            const baseDailyRate = picker.combinedBaseRate ?? (rate > 10 ? rate : 50);
            const payableWeight = picker.payableNetWeight ?? (picker.manualNetWeight ?? totalWeight);
            const perKgRate = picker.combinedPerKgRate ?? (rate <= 10 ? rate : 1.4);
            return (days * baseDailyRate) + (payableWeight * perKgRate) + bonus;
        }
        if (model === 'hourly') return (hours * rate) + bonus;
        if (model === 'daily' || model === 'fixed_day' || model === 'salary') return ((picker.manualDays ?? 1) * rate) + bonus;
        return (totalWeight * rate) + bonus;
    },
    selectedPickerIds = new Set()
}) => {
    const isKa = localStorage.getItem('agri-app-lang') === 'ka';

    // Filters state
    const [exportScope, setExportScope] = useState<'all' | 'zero_only' | 'nonzero_only' | 'bonus_only' | 'corrected_only' | 'selected_only'>('all');
    const [selectedRole, setSelectedRole] = useState<string>('all');
    const [selectedPaymentModel, setSelectedPaymentModel] = useState<string>('all');
    const [minNetWeight, setMinNetWeight] = useState<string>('');
    const [maxNetWeight, setMaxNetWeight] = useState<string>('');
    const [minSalary, setMinSalary] = useState<string>('');

    // Column inclusion selection
    const [cols, setCols] = useState({
        code: true,
        name: true,
        role: true,
        paymentModel: true,
        days: true,
        hours: true,
        boxes: true,
        grossWeight: true,
        netWeight: true,
        rate: true,
        bonus: true,
        totalEarnings: true
    });

    const availableRoles = useMemo(() => {
        const set = new Set<string>();
        // Standard AgriMap roles
        ['Loader', 'Weigher', 'Picker', 'Keeper', 'Driver', 'Supervisor', 'Field Worker', 'Security'].forEach(r => set.add(r));
        localPickers.forEach(p => {
            if (p.assignedRole) set.add(p.assignedRole);
        });
        roles.forEach(r => {
            if (r.name) set.add(r.name);
        });
        return Array.from(set);
    }, [localPickers, roles]);

    const filteredPickersToExport = useMemo(() => {
        return localPickers.filter(picker => {
            const emp = employees.find(e => e.id === picker.employeeId);
            const pickerEntries = entries.filter(e => e.employeeId === picker.employeeId);
            const scannedWeight = pickerEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
            const netWeight = picker.manualNetWeight ?? scannedWeight;
            const hrs = picker.manualHours ?? durationHours;
            const earnings = calculatePickerEarnings(picker, netWeight, hrs);
            const bonus = picker.bonus || 0;
            const isCorrected = picker.manualNetWeight !== undefined || picker.manualHours !== undefined || picker.manualBoxes !== undefined || picker.manualDays !== undefined;
            const isSelected = selectedPickerIds.has(picker.employeeId);

            // 1. Scope filter
            if (exportScope === 'zero_only' && netWeight > 0.001) return false;
            if (exportScope === 'nonzero_only' && netWeight <= 0.001) return false;
            if (exportScope === 'bonus_only' && bonus <= 0) return false;
            if (exportScope === 'corrected_only' && !isCorrected) return false;
            if (exportScope === 'selected_only' && !isSelected) return false;

            // 2. Role filter
            if (selectedRole !== 'all') {
                const pickerRole = picker.assignedRole || (emp?.roleId ? roles.find(r => r.id === emp.roleId)?.name : 'Picker');
                if (pickerRole?.toLowerCase() !== selectedRole.toLowerCase()) return false;
            }

            // 3. Payment Model filter
            if (selectedPaymentModel !== 'all') {
                const model = picker.paymentModel || 'per_weight';
                if (model !== selectedPaymentModel) return false;
            }

            // 4. Min/Max NET Weight filter
            if (minNetWeight !== '' && !isNaN(parseFloat(minNetWeight)) && netWeight < parseFloat(minNetWeight)) return false;
            if (maxNetWeight !== '' && !isNaN(parseFloat(maxNetWeight)) && netWeight > parseFloat(maxNetWeight)) return false;

            // 5. Min Salary filter
            if (minSalary !== '' && !isNaN(parseFloat(minSalary)) && earnings < parseFloat(minSalary)) return false;

            return true;
        });
    }, [localPickers, employees, entries, exportScope, selectedRole, selectedPaymentModel, minNetWeight, maxNetWeight, minSalary, selectedPickerIds, durationHours, calculatePickerEarnings, roles]);

    const handleExecuteExport = () => {
        if (filteredPickersToExport.length === 0) {
            toast.error(isKa ? 'არჩეული ფილტრებით მონაცემები ვერ მოიძებნა' : 'No worker records match your export filters!');
            return;
        }

        const headers: string[] = [];
        if (cols.code) headers.push(isKa ? '"კოდი / ID"' : '"Code/ID"');
        if (cols.name) headers.push(isKa ? '"სახელი და გვარი"' : '"Employee Name"');
        if (cols.role) headers.push(isKa ? '"პოზიცია / როლი"' : '"Role/Position"');
        if (cols.paymentModel) headers.push(isKa ? '"ანაზღაურების ტიპი"' : '"Payment Model"');
        if (cols.days) headers.push(isKa ? '"დღეები"' : '"Days"');
        if (cols.hours) headers.push(isKa ? '"საათები"' : '"Hours"');
        if (cols.boxes) headers.push(isKa ? '"ყუთები"' : '"Boxes"');
        if (cols.grossWeight) headers.push(isKa ? '"Gross Weight (KG)"' : '"Gross Weight (KG)"');
        if (cols.netWeight) headers.push(isKa ? '"NET Weight (KG)"' : '"NET Weight (KG)"');
        if (cols.rate) headers.push(isKa ? '"ტარიფი"' : '"Rate"');
        if (cols.bonus) headers.push(isKa ? '"ბონუსი"' : '"Bonus"');
        if (cols.totalEarnings) headers.push(isKa ? '"სულ ანაზღაურება"' : '"Total Earnings"');

        const rows = filteredPickersToExport.map(picker => {
            const emp = employees.find(e => e.id === picker.employeeId);
            const pickerEntries = entries.filter(e => e.employeeId === picker.employeeId);
            const scannedWeight = pickerEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
            const scannedGross = pickerEntries.reduce((s, e) => s + (e.grossWeightKg ?? (e.netWeightKg || 0)), 0);
            const scannedBoxes = pickerEntries.reduce((s, e) => s + (e.boxCount || 1), 0);

            const netWeight = picker.manualNetWeight ?? scannedWeight;
            const boxes = picker.manualBoxes ?? scannedBoxes;
            const grossWeight = (picker.manualNetWeight !== undefined || picker.manualBoxes !== undefined) ? netWeight + (boxes * 1.5) : scannedGross;
            const hrs = picker.manualHours ?? durationHours;
            const days = picker.manualDays ?? 1;
            const earnings = calculatePickerEarnings(picker, netWeight, hrs);
            const roleName = picker.assignedRole || (emp?.roleId ? roles.find(r => r.id === emp.roleId)?.name : 'Picker') || 'Worker';
            const model = picker.paymentModel || 'per_weight';

            const row: string[] = [];
            if (cols.code) row.push(`"${emp?.id || picker.employeeId}"`);
            if (cols.name) row.push(`"${emp?.name || 'Worker ' + picker.employeeId}"`);
            if (cols.role) row.push(`"${roleName}"`);
            if (cols.paymentModel) row.push(`"${model}"`);
            if (cols.days) row.push(days.toFixed(1));
            if (cols.hours) row.push(hrs.toFixed(2));
            if (cols.boxes) row.push(String(boxes));
            if (cols.grossWeight) row.push(grossWeight.toFixed(2));
            if (cols.netWeight) row.push(netWeight.toFixed(2));
            if (cols.rate) row.push((picker.rate || 0).toString());
            if (cols.bonus) row.push((picker.bonus || 0).toString());
            if (cols.totalEarnings) row.push(earnings.toFixed(2));

            return row.join('\t'); // TSV tab-separated format for pristine Excel pasting and columns
        });

        // Column Totals Row
        const totalsRow: string[] = [];
        if (cols.code) totalsRow.push(`"TOTALS"`);
        if (cols.name) totalsRow.push(`"Count: ${filteredPickersToExport.length}"`);
        if (cols.role) totalsRow.push(`""`);
        if (cols.paymentModel) totalsRow.push(`""`);
        if (cols.days) totalsRow.push(filteredPickersToExport.reduce((s, p) => s + (p.manualDays ?? 1), 0).toFixed(1));
        if (cols.hours) totalsRow.push(filteredPickersToExport.reduce((s, p) => s + (p.manualHours ?? durationHours), 0).toFixed(2));
        if (cols.boxes) totalsRow.push(String(filteredPickersToExport.reduce((s, p) => s + (p.manualBoxes ?? entries.filter(e => e.employeeId === p.employeeId).reduce((x, e) => x + (e.boxCount || 1), 0)), 0)));
        if (cols.grossWeight) totalsRow.push(filteredPickersToExport.reduce((s, p) => {
            const pe = entries.filter(e => e.employeeId === p.employeeId);
            const nw = p.manualNetWeight ?? pe.reduce((x, e) => x + (e.netWeightKg || 0), 0);
            const bx = p.manualBoxes ?? pe.reduce((x, e) => x + (e.boxCount || 1), 0);
            return s + (p.manualNetWeight !== undefined || p.manualBoxes !== undefined ? nw + (bx * 1.5) : pe.reduce((x, e) => x + (e.grossWeightKg ?? (e.netWeightKg || 0)), 0));
        }, 0).toFixed(2));
        if (cols.netWeight) totalsRow.push(filteredPickersToExport.reduce((s, p) => s + (p.manualNetWeight ?? entries.filter(e => e.employeeId === p.employeeId).reduce((x, e) => x + (e.netWeightKg || 0), 0)), 0).toFixed(2));
        if (cols.rate) totalsRow.push(`""`);
        if (cols.bonus) totalsRow.push(filteredPickersToExport.reduce((s, p) => s + (p.bonus || 0), 0).toFixed(2));
        if (cols.totalEarnings) totalsRow.push(filteredPickersToExport.reduce((s, p) => {
            const nw = p.manualNetWeight ?? entries.filter(e => e.employeeId === p.employeeId).reduce((x, e) => x + (e.netWeightKg || 0), 0);
            const hrs = p.manualHours ?? durationHours;
            return s + calculatePickerEarnings(p, nw, hrs);
        }, 0).toFixed(2));

        // Use UTF-8 BOM so Excel opens Georgian text flawlessly
        const bom = '\uFEFF';
        const fileContent = bom + [headers.join('\t'), ...rows, totalsRow.join('\t')].join('\n');
        
        const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const cleanName = event.name.replace(/[^\w\s-]/gi, '_');
        link.download = `Harvest_Export_${cleanName}_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(isKa ? `წარმატებით დაექსპორტდა ${filteredPickersToExport.length} ჩანაწერი Excel-ში!` : `Exported ${filteredPickersToExport.length} worker records to Excel successfully!`);
        onClose();
    };

    const [isExportingToGoogleSheets, setIsExportingToGoogleSheets] = useState(false);

    const handleExecuteGoogleSheetsExport = async () => {
        setIsExportingToGoogleSheets(true);
        try {
            const token = await ensureGoogleToken();

            // 1. Prepare Event Summary & Statistics Tab
            const totalGross = filteredPickersToExport.reduce((s, p) => {
                const pe = entries.filter(e => e.employeeId === p.employeeId);
                const nw = p.manualNetWeight ?? pe.reduce((x, e) => x + (e.netWeightKg || 0), 0);
                const bx = p.manualBoxes ?? pe.reduce((x, e) => x + (e.boxCount || 1), 0);
                return s + (p.manualNetWeight !== undefined || p.manualBoxes !== undefined ? nw + (bx * 1.5) : pe.reduce((x, e) => x + (e.grossWeightKg ?? (e.netWeightKg || 0)), 0));
            }, 0);

            const totalNet = filteredPickersToExport.reduce((s, p) => {
                return s + (p.manualNetWeight ?? entries.filter(e => e.employeeId === p.employeeId).reduce((x, e) => x + (e.netWeightKg || 0), 0));
            }, 0);

            const totalBoxes = filteredPickersToExport.reduce((s, p) => {
                return s + (p.manualBoxes ?? entries.filter(e => e.employeeId === p.employeeId).reduce((x, e) => x + (e.boxCount || 1), 0));
            }, 0);

            const totalPayroll = filteredPickersToExport.reduce((s, p) => {
                const nw = p.manualNetWeight ?? entries.filter(e => e.employeeId === p.employeeId).reduce((x, e) => x + (e.netWeightKg || 0), 0);
                const hrs = p.manualHours ?? durationHours;
                return s + calculatePickerEarnings(p, nw, hrs);
            }, 0);

            const logisticsCost = (event as any).logisticsCost || 0;
            const packagingCost = totalBoxes * 1.2;
            const totalOpex = totalPayroll + logisticsCost + packagingCost;
            const estimatedRevenue = totalNet * 12.5;
            const netMargin = estimatedRevenue - totalOpex;

            const summaryHeaders = ['Metric / Parameter', 'Value', 'Unit / Currency', 'Notes / Observations'];
            const summaryRows: any[][] = [
                ['Event ID', event.id, 'String', 'Internal identifier'],
                ['Event Title / Name', event.name, 'Text', 'Harvest Session Name'],
                ['Event Date', event.plannedStartDate ? new Date(event.plannedStartDate).toLocaleDateString() : ((event as any).date ? new Date((event as any).date).toLocaleDateString() : 'N/A'), 'Date', 'Day of operation'],
                ['Field / Sector', event.sectorId || (event as any).fieldId || 'Main Parcel', 'Location', 'Geographic zone'],
                ['Event Status', event.status || 'Active', 'Status', 'Operational state'],
                ['Total Pickers / Workers', filteredPickersToExport.length, 'Persons', 'Active workforce count'],
                ['Total Gross Weight', Number(totalGross.toFixed(2)), 'KG', 'Combined crop + container'],
                ['Total Net Weight (Yield)', Number(totalNet.toFixed(2)), 'KG', 'Clean harvested berry weight'],
                ['Total Boxes Collected', totalBoxes, 'Boxes', 'Crates harvested and counted'],
                ['Average Weight per Box', totalBoxes > 0 ? Number((totalNet / totalBoxes).toFixed(2)) : 0, 'KG / Box', 'Density check'],
                ['Total Picker Payroll', Number(totalPayroll.toFixed(2)), 'GEL', 'Direct labor wages & bonuses'],
                ['Logistics & Transportation Cost', Number(logisticsCost.toFixed(2)), 'GEL', 'Vehicle & transit expense'],
                ['Packaging & Box Opex', Number(packagingCost.toFixed(2)), 'GEL', 'Crates & consumables'],
                ['Total Operating Expenditure (Opex)', Number(totalOpex.toFixed(2)), 'GEL', 'Sum of payroll, logistics & packing'],
                ['Estimated Crop Revenue', Number(estimatedRevenue.toFixed(2)), 'GEL', 'Valuation at 12.5 GEL / KG benchmark'],
                ['Net Operating Margin', Number(netMargin.toFixed(2)), 'GEL', 'Profit margin for harvest session'],
                ['Unit Opex Cost', totalNet > 0 ? Number((totalOpex / totalNet).toFixed(2)) : 0, 'GEL / KG', 'Cost per net kilogram harvested']
            ];

            if (event.yieldByVariety && event.yieldByVariety.length > 0) {
                summaryRows.push(['', '', '', '']);
                summaryRows.push(['--- YIELD BY VARIETY BREAKDOWN ---', '', '', '']);
                event.yieldByVariety.forEach(v => {
                    const share = totalNet > 0 ? ((v.weightKg / totalNet) * 100).toFixed(1) : '0';
                    summaryRows.push([v.variety, v.weightKg, 'KG', `${share}% of total harvest yield`]);
                });
            }

            // 2. Prepare Workers & Payroll Tab
            const workerHeaders: string[] = [];
            if (cols.code) workerHeaders.push('Worker ID');
            if (cols.name) workerHeaders.push('Name');
            if (cols.role) workerHeaders.push('Role');
            if (cols.paymentModel) workerHeaders.push('Payment Model');
            if (cols.days) workerHeaders.push('Days');
            if (cols.hours) workerHeaders.push('Hours');
            if (cols.boxes) workerHeaders.push('Boxes');
            if (cols.grossWeight) workerHeaders.push('Gross KG');
            if (cols.netWeight) workerHeaders.push('Net KG');
            if (cols.rate) workerHeaders.push('Rate (GEL)');
            if (cols.bonus) workerHeaders.push('Bonus (GEL)');
            if (cols.totalEarnings) workerHeaders.push('Total Earnings (GEL)');

            const workerRows = filteredPickersToExport.map(picker => {
                const emp = employees.find(e => e.id === picker.employeeId || e.idNumber === picker.employeeId);
                const pEntries = entries.filter(e => e.employeeId === picker.employeeId);
                const boxes = picker.manualBoxes ?? pEntries.reduce((s, e) => s + (e.boxCount || 1), 0);
                const netWeight = picker.manualNetWeight ?? pEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
                const grossWeight = picker.manualNetWeight !== undefined || picker.manualBoxes !== undefined 
                    ? netWeight + (boxes * 1.5) 
                    : pEntries.reduce((s, e) => s + (e.grossWeightKg ?? (e.netWeightKg || 0)), 0);
                const days = picker.manualDays ?? 1;
                const hrs = picker.manualHours ?? durationHours;
                const earnings = calculatePickerEarnings(picker, netWeight, hrs);
                const roleName = picker.assignedRole || (emp?.roleId ? roles.find(r => r.id === emp.roleId)?.name : 'Picker') || 'Worker';
                const model = picker.paymentModel || 'per_weight';

                const r: any[] = [];
                if (cols.code) r.push(emp?.id || picker.employeeId);
                if (cols.name) r.push(emp?.name || 'Worker ' + picker.employeeId);
                if (cols.role) r.push(roleName);
                if (cols.paymentModel) r.push(model);
                if (cols.days) r.push(Number(days.toFixed(1)));
                if (cols.hours) r.push(Number(hrs.toFixed(2)));
                if (cols.boxes) r.push(boxes);
                if (cols.grossWeight) r.push(Number(grossWeight.toFixed(2)));
                if (cols.netWeight) r.push(Number(netWeight.toFixed(2)));
                if (cols.rate) r.push(picker.rate || 0);
                if (cols.bonus) r.push(picker.bonus || 0);
                if (cols.totalEarnings) r.push(Number(earnings.toFixed(2)));
                return r;
            });

            const workerSummaryRows = [
                ['--- TOTALS ---'],
                [
                    cols.code ? 'TOTALS' : '',
                    cols.name ? `${filteredPickersToExport.length} Workers` : '',
                    '',
                    '',
                    cols.days ? Number(filteredPickersToExport.reduce((s, p) => s + (p.manualDays ?? 1), 0).toFixed(1)) : '',
                    cols.hours ? Number(filteredPickersToExport.reduce((s, p) => s + (p.manualHours ?? durationHours), 0).toFixed(2)) : '',
                    cols.boxes ? totalBoxes : '',
                    cols.grossWeight ? Number(totalGross.toFixed(2)) : '',
                    cols.netWeight ? Number(totalNet.toFixed(2)) : '',
                    '',
                    cols.bonus ? Number(filteredPickersToExport.reduce((s, p) => s + (p.bonus || 0), 0).toFixed(2)) : '',
                    cols.totalEarnings ? Number(totalPayroll.toFixed(2)) : ''
                ].filter((_, idx) => idx < workerHeaders.length)
            ];

            const spreadsheetTitle = `Harvest_Audit_${event.name.replace(/[^\w\s-]/gi, '_')}_${new Date().toISOString().split('T')[0]}`;
            
            const result = await createSpreadsheet(
                spreadsheetTitle,
                [
                    {
                        title: 'Live_Monitoring_&_Yield',
                        headers: summaryHeaders,
                        rows: summaryRows
                    },
                    {
                        title: 'Worker_Payroll_Settlement',
                        headers: workerHeaders,
                        rows: workerRows,
                        summaryRows: workerSummaryRows
                    }
                ],
                token
            );

            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-bold">Google Sheet created with full yield & logistics stats!</span>
                    <a 
                        href={result.spreadsheetUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-emerald-700 dark:text-emerald-300 underline font-mono text-xs flex items-center gap-1"
                    >
                        <ExternalLink size={12} /> View in Google Sheets
                    </a>
                </div>,
                { duration: 9000 }
            );

            onClose();
        } catch (err: any) {
            console.error("Google Sheets export failed:", err);
            toast.error(err?.message || "Failed to export to Google Sheets");
        } finally {
            setIsExportingToGoogleSheets(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3500] flex items-center justify-center p-3 sm:p-6 animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                                {isKa ? 'მოქნილი Excel ექსპორტიორი' : 'Flexible Excel / Payroll Data Exporter'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {event.name} • Filtered Export Engine
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
                    {/* Filter Category selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Filter size={14} className="text-indigo-600" />
                            {isKa ? '1. ექსპორტის ჯგუფი / ფილტრი' : '1. Select Worker Category Filter'}
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[
                                { id: 'all', label: isKa ? 'ყველა მუშა' : 'All Workers' },
                                { id: 'nonzero_only', label: isKa ? 'მხოლოდ მოსავლით (>0 კგ)' : 'With Harvest (> 0 kg)' },
                                { id: 'zero_only', label: isKa ? 'ნულოვანი მოსავალი (0 კგ)' : 'Zero Harvest (0 kg)' },
                                { id: 'bonus_only', label: isKa ? 'მხოლოდ ბონუსით' : 'With Bonus Only' },
                                { id: 'corrected_only', label: isKa ? 'კორექტირებული მუშები' : 'Corrected Workers' },
                                { id: 'selected_only', label: isKa ? `მონიშნულები (${selectedPickerIds.size})` : `Selected Only (${selectedPickerIds.size})` },
                            ].map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setExportScope(item.id as any)}
                                    className={`p-2.5 rounded-xl border text-xs font-black uppercase tracking-tight text-left transition-all ${
                                        exportScope === item.id 
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Secondary Advanced Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                                {isKa ? 'პოზიცია / როლი' : 'Position / Role'}
                            </label>
                            <select
                                value={selectedRole}
                                onChange={e => setSelectedRole(e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                            >
                                <option value="all">{isKa ? 'ყველა როლი (All Roles)' : 'All Roles / Positions'}</option>
                                {availableRoles.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                                {isKa ? 'ანაზღაურების მოდელი' : 'Payment Model'}
                            </label>
                            <select
                                value={selectedPaymentModel}
                                onChange={e => setSelectedPaymentModel(e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                            >
                                <option value="all">{isKa ? 'ყველა ტიპი' : 'All Models'}</option>
                                <option value="per_weight">{isKa ? 'კგ ტარიფი (Per Weight)' : 'Per Weight'}</option>
                                <option value="hourly">{isKa ? 'საათობრივი (Hourly)' : 'Hourly'}</option>
                                <option value="daily">{isKa ? 'დღიური (Daily Contract)' : 'Daily'}</option>
                                <option value="salary">{isKa ? 'ხელფასი (Salary)' : 'Salary'}</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                                {isKa ? 'მინიმალური NET (კგ)' : 'Min Net Weight (KG)'}
                            </label>
                            <input
                                type="number"
                                placeholder="0"
                                value={minNetWeight}
                                onChange={e => setMinNetWeight(e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                                {isKa ? 'მინიმალური ხელფასი (GEL)' : 'Min Earnings (GEL)'}
                            </label>
                            <input
                                type="number"
                                placeholder="0"
                                value={minSalary}
                                onChange={e => setMinSalary(e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Column Toggle Checklist */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <CheckSquare size={14} className="text-emerald-600" />
                                {isKa ? '2. Excel-ის სვეტების არჩევა' : '2. Select Columns to Include'}
                            </label>
                            <button
                                type="button"
                                onClick={() => setCols({
                                    code: true, name: true, role: true, paymentModel: true,
                                    days: true, hours: true, boxes: true, grossWeight: true,
                                    netWeight: true, rate: true, bonus: true, totalEarnings: true
                                })}
                                className="text-[10px] font-black uppercase text-indigo-600 hover:underline"
                            >
                                {isKa ? 'ყველას ჩართვა' : 'Select All'}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            {[
                                { key: 'code', label: 'Code/ID' },
                                { key: 'name', label: 'Name' },
                                { key: 'role', label: 'Role/Position' },
                                { key: 'paymentModel', label: 'Payment Model' },
                                { key: 'days', label: 'Days' },
                                { key: 'hours', label: 'Hours' },
                                { key: 'boxes', label: 'Boxes' },
                                { key: 'grossWeight', label: 'Gross KG' },
                                { key: 'netWeight', label: 'Net KG' },
                                { key: 'rate', label: 'Rate' },
                                { key: 'bonus', label: 'Bonus' },
                                { key: 'totalEarnings', label: 'Total Earnings' },
                            ].map(c => (
                                <label key={c.key} className="flex items-center gap-2 p-1 text-xs font-bold text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={(cols as any)[c.key]}
                                        onChange={e => setCols({ ...cols, [c.key]: e.target.checked })}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer accent-indigo-600"
                                    />
                                    <span>{c.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Preview matching count indicator */}
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                        <span className="text-xs font-black text-emerald-800 uppercase flex items-center gap-1.5">
                            <ShieldCheck size={16} />
                            {isKa ? 'ექსპორტირებადი მუშები:' : 'Matching Records to Export:'}
                        </span>
                        <span className="text-sm font-black bg-emerald-600 text-white px-3 py-1 rounded-lg">
                            {filteredPickersToExport.length} {isKa ? 'მუშა' : 'workers'}
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black uppercase text-xs tracking-wider cursor-pointer transition-colors"
                    >
                        {isKa ? 'გაუქმება' : 'Cancel'}
                    </button>

                    <div className="flex items-center gap-2">
                        <button 
                            type="button" 
                            onClick={handleExecuteGoogleSheetsExport}
                            disabled={isExportingToGoogleSheets}
                            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-black uppercase text-xs tracking-wider flex items-center gap-2 shadow-lg shadow-teal-600/20 cursor-pointer active:scale-95 transition-all"
                        >
                            {isExportingToGoogleSheets ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                            {isExportingToGoogleSheets ? 'Exporting...' : 'Export to Google Sheets'}
                        </button>

                        <button 
                            type="button" 
                            onClick={handleExecuteExport} 
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-xs tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95 transition-all"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            {isKa ? 'Excel-ში ჩამოტვირთვა (.XLS)' : 'Download Excel File (.XLS)'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportExcelModal;
