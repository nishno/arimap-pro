import React, { useState, useMemo } from 'react';
import type { 
    Employee, 
    Role, 
    WorkAssignment, 
    PlantationFeature, 
    AreaPlantationFeature, 
    HarvestEvent, 
    HarvestEntry, 
    EmployeeWorkLog 
} from '../types';
import EmployeeIdCard from './EmployeeIdCard';
import QRCode from 'qrcode';
import { useLanguage } from '../contexts/LanguageContext';
import { 
    User, 
    Briefcase, 
    DollarSign, 
    QrCode, 
    Printer, 
    CheckCircle, 
    Clock, 
    Calendar, 
    MapPin, 
    Phone, 
    Mail, 
    Shield, 
    Scale, 
    X,
    FileText,
    Tag,
    Cpu,
    BadgeCheck
} from 'lucide-react';

const calculateNetDurationHours = (event: HarvestEvent): number => {
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

interface ScannedIdCardModalProps {
    employee: Employee;
    roles: Role[];
    workAssignments: WorkAssignment[];
    harvestEvents: HarvestEvent[];
    harvestEntries: HarvestEntry[];
    plantationFeatures: PlantationFeature[];
    onClose: () => void;
}

const ScannedIdCardModal: React.FC<ScannedIdCardModalProps> = ({ 
    employee, 
    roles, 
    workAssignments = [], 
    harvestEvents = [], 
    harvestEntries = [], 
    plantationFeatures = [], 
    onClose 
}) => {
    const { formatCurrency } = useLanguage();
    const [activeTab, setActiveTab] = useState<'personal' | 'work' | 'payroll' | 'badge'>('personal');
    const roleName = (roles || []).find(r => r.id === employee.roleId)?.name || employee.role || 'Field Worker';
    
    // Calculate full payroll statistics and all-time work history
    const payrollInfo = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // --- Work Assignments (This Month) ---
        const workThisMonth = (workAssignments || []).filter(wa => 
            wa.status === 'completed' && 
            (wa.assignedEmployeeIds || []).includes(employee.id) &&
            new Date(wa.date) >= firstDayOfMonth &&
            new Date(wa.date) <= lastDayOfMonth
        );

        let monthWorkEarnings = 0;
        let monthWorkHours = 0;
        const workBreakdown = workThisMonth.map(wa => {
            let earnings = 0;
            let hours = 0;
            const workLog = (wa.employeeHours || []).find((eh: EmployeeWorkLog) => eh.employeeId === employee.id);
            
            if (workLog && workLog.hours > 0) {
                hours = workLog.hours;
                if (employee.paymentType === 'hourly') earnings = hours * employee.paymentRate;
                if (employee.paymentType === 'daily') earnings = (hours / 8) * employee.paymentRate;
            }
            
            monthWorkHours += hours;
            monthWorkEarnings += earnings;
            return { id: wa.id, name: wa.workName, date: wa.date, hours, earnings, taskType: wa.taskType };
        });

        // --- Harvest Events (This Month: Approved + Live Active Sessions) ---
        const harvestsThisMonth = (harvestEvents || []).filter(he => 
            he.status !== 'deleted' &&
            (he.assignedPickers || []).some(p => p.employeeId === employee.id) &&
            ((he.actualEndDate && new Date(he.actualEndDate) >= firstDayOfMonth && new Date(he.actualEndDate) <= lastDayOfMonth) ||
             (he.plannedStartDate && new Date(he.plannedStartDate) >= firstDayOfMonth && new Date(he.plannedStartDate) <= lastDayOfMonth) ||
             he.status === 'active' || he.payrollApproved)
        );
        
        let monthHarvestEarnings = 0;
        let monthHarvestKg = 0;
        let approvedHarvestEarnings = 0;
        let draftHarvestEarnings = 0;

        const harvestBreakdown = harvestsThisMonth.map(he => {
            const pickerInfo = (he.assignedPickers || []).find(p => p.employeeId === employee.id);
            if (!pickerInfo) return null;

            const pickerEntries = (harvestEntries || []).filter(e => e.employeeId === employee.id && e.harvestEventId === he.id);
            const totalWeight = pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
            const netHours = calculateNetDurationHours(he);

            const finalWeight = pickerInfo.manualNetWeight ?? totalWeight;
            const finalHours = pickerInfo.manualHours ?? netHours;
            
            let earnings = 0;
            switch(pickerInfo.paymentModel) {
                case 'per_weight': earnings = finalWeight * pickerInfo.rate; break;
                case 'hourly': earnings = finalHours * pickerInfo.rate; break;
                case 'daily': earnings = (finalHours / 8) * pickerInfo.rate; break;
                case 'salary': earnings = 0; break;
            }
            monthHarvestEarnings += earnings;
            monthHarvestKg += finalWeight;

            const isApproved = Boolean(he.payrollApproved || he.status === 'completed');
            if (isApproved) {
                approvedHarvestEarnings += earnings;
            } else {
                draftHarvestEarnings += earnings;
            }

            return { 
                id: he.id, 
                name: he.name, 
                date: he.actualEndDate || he.plannedStartDate || new Date().toISOString(), 
                earnings, 
                weight: Number(finalWeight.toFixed(2)), 
                hours: finalHours,
                crates: pickerEntries.length,
                paymentModel: pickerInfo.paymentModel,
                rate: pickerInfo.rate,
                isApproved,
                status: he.status
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        const totalEarnings = employee.paymentType === 'salary' 
            ? employee.paymentRate 
            : (monthWorkEarnings + monthHarvestEarnings);

        // --- All-time Statistics ---
        const allCompletedWork = (workAssignments || []).filter(wa => 
            (wa.assignedEmployeeIds || []).includes(employee.id)
        );

        const totalAllTimeHours = allCompletedWork.reduce((sum, wa) => {
            const log = (wa.employeeHours || []).find(eh => eh.employeeId === employee.id);
            return sum + (log?.hours || 0);
        }, 0);

        const allHarvestEntries = (harvestEntries || []).filter(e => e.employeeId === employee.id);
        const totalAllTimeKg = allHarvestEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);

        return {
            period: `${firstDayOfMonth.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
            monthWorkHours: Number(monthWorkHours).toFixed(1),
            monthHarvestKg: Number(monthHarvestKg).toFixed(1),
            monthWorkEarnings,
            monthHarvestEarnings,
            totalEarnings,
            workBreakdown,
            harvestBreakdown,
            allCompletedWork,
            totalAllTimeHours: Number(totalAllTimeHours).toFixed(1),
            totalAllTimeKg: Number(totalAllTimeKg).toFixed(1),
            totalCratesLogged: allHarvestEntries.length
        };
    }, [employee, workAssignments, harvestEvents, harvestEntries]);

    // Active adopted printer discovery from Hardware Labs
    const activePrinter = useMemo(() => {
        try {
            const hwStr = localStorage.getItem('hardware_devices');
            const printingStr = localStorage.getItem('agrimap_printing_printer');
            const selectedStr = localStorage.getItem('agrimap_selected_printer');
            if (hwStr) {
                const hw = JSON.parse(hwStr);
                const printers = hw.filter((d: any) => d.type === 'printer');
                return printers.find((p: any) => p.id === printingStr) || 
                       printers.find((p: any) => p.id === selectedStr) || 
                       printers[0] || null;
            }
        } catch (e) {}
        return null;
    }, []);

    const handlePrint = async (mode: 'full' | 'qr-only') => {
        let qrDataUrl = '';
        const displayBarcode = employee.barcode || employee.idNumber || employee.id;
        if (displayBarcode) {
            try {
                const qrData = JSON.stringify({
                    id: displayBarcode,
                    name: employee.name,
                    role: roleName,
                });
                qrDataUrl = await QRCode.toDataURL(qrData, { margin: 1, width: mode === 'qr-only' ? 300 : 120 });
            } catch (e) {
                console.error("QR Code generation failed:", e);
            }
        }

        const printerName = activePrinter?.name || 'Standard System Spooler';

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            alert("Please allow popups to print badge.");
            return;
        }

        if (mode === 'qr-only') {
            // High-density ZPL/Thermal Label
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Thermal Label - ${employee.name}</title>
                    <style>
                        body { margin: 0; padding: 16px; font-family: monospace; text-align: center; }
                        @media print {
                            @page { margin: 0; size: auto; }
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div style="border: 2px solid #000; border-radius: 8px; padding: 12px; max-width: 280px; margin: 0 auto;">
                        <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">${employee.name}</h2>
                        <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: bold; color: #444;">${roleName}</p>
                        <img src="${qrDataUrl}" style="width: 180px; height: 180px; display: block; margin: 0 auto;" />
                        <p style="margin: 8px 0 0 0; font-size: 12px; font-weight: 900; letter-spacing: 1px;">ID: ${displayBarcode}</p>
                        <div style="margin-top: 10px; font-size: 8px; border-top: 1px dashed #666; padding-top: 6px; text-transform: uppercase;">
                            TARGET SPOOL: ${printerName} • HARVEST PASSPORT
                        </div>
                    </div>
                    <script>
                        window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 300); };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
            return;
        }

        // Full ID Card
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Employee Badge - ${employee.name}</title>
                <style>
                    body { margin: 0; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; box-sizing: border-box; background: #fafafa; }
                    .card { width: 3.375in; height: 2.125in; border: 1px solid #d1d5db; border-radius: 14px; padding: 14px; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; }
                    .header { display: flex; align-items: center; gap: 12px; }
                    .avatar { width: 50px; height: 50px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #4b5563; }
                    .name { font-size: 14px; font-weight: 900; color: #111827; margin: 0; text-transform: uppercase; }
                    .role { font-size: 10px; font-weight: 700; color: #16a34a; margin: 2px 0 0 0; text-transform: uppercase; }
                    .body-row { display: flex; justify-content: space-between; align-items: flex-end; }
                    .info { font-size: 8px; color: #4b5563; line-height: 1.4; text-transform: uppercase; }
                    .qr { width: 68px; height: 68px; }
                    @media print {
                        body { background: transparent; padding: 0; }
                        @page { margin: 0; size: auto; }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <div class="avatar">${employee.name.charAt(0)}</div>
                        <div>
                            <p class="name">${employee.name}</p>
                            <p class="role">${roleName}</p>
                        </div>
                    </div>
                    <div class="body-row">
                        <div class="info">
                            <p style="margin: 0;"><strong>ID Number:</strong> ${employee.idNumber || 'N/A'}</p>
                            <p style="margin: 0;"><strong>Barcode:</strong> ${displayBarcode}</p>
                            <p style="margin: 0;"><strong>Contract:</strong> ${employee.employeeType || 'Permanent'}</p>
                            <p style="margin: 0;"><strong>Payment:</strong> ${employee.paymentType} (${formatCurrency(employee.paymentRate)})</p>
                        </div>
                        <img src="${qrDataUrl}" class="qr" />
                    </div>
                </div>
                <script>
                    window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 300); };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
            <div 
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Banner */}
                <div className="p-6 sm:p-8 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden shrink-0">
                    <div className="flex items-center gap-4 z-10">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl font-black text-white shrink-0 shadow-inner">
                            {employee.name.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase leading-tight">
                                    {employee.name}
                                </h2>
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                    employee.status === 'active' 
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                }`}>
                                    {employee.status || 'Active'}
                                </span>
                            </div>
                            <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-2">
                                <span className="text-blue-400 uppercase tracking-widest">{roleName}</span>
                                <span>•</span>
                                <span>ID: <strong className="text-white font-mono">{employee.idNumber || employee.id}</strong></span>
                                {employee.barcode && (
                                    <>
                                        <span>•</span>
                                        <span>Barcode: <strong className="text-emerald-400 font-mono">{employee.barcode}</strong></span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center z-10">
                        <button
                            onClick={() => handlePrint('qr-only')}
                            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                            title="Print Zebra / Thermal Label"
                        >
                            <Printer size={13} />
                            <span>Zebra Label</span>
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-2.5 bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white rounded-xl transition-all"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Decorative Background Glow */}
                    <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
                </div>

                {/* Navigation Tabs Bar */}
                <div className="px-6 sm:px-8 border-b border-slate-100 bg-slate-50/70 flex flex-wrap gap-2 items-center justify-between shrink-0">
                    <div className="flex gap-1 py-2">
                        <button
                            onClick={() => setActiveTab('personal')}
                            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                                activeTab === 'personal'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'text-slate-600 hover:bg-slate-200/60'
                            }`}
                        >
                            <User size={14} />
                            <span>Personal Info</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('work')}
                            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                                activeTab === 'work'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'text-slate-600 hover:bg-slate-200/60'
                            }`}
                        >
                            <Briefcase size={14} />
                            <span>Work History</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('payroll')}
                            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                                activeTab === 'payroll'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'text-slate-600 hover:bg-slate-200/60'
                            }`}
                        >
                            <DollarSign size={14} />
                            <span>Payroll & Payout</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('badge')}
                            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                                activeTab === 'badge'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'text-slate-600 hover:bg-slate-200/60'
                            }`}
                        >
                            <QrCode size={14} />
                            <span>ID Badge & Print</span>
                        </button>
                    </div>

                    <div className="py-2 hidden md:block">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Hardware Link: <strong className="text-slate-700">{activePrinter?.name || 'Local Driver'}</strong>
                        </span>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-slate-50/30 custom-scrollbar">
                    {/* TAB 1: PERSONAL INFORMATION */}
                    {activeTab === 'personal' && (
                        <div className="space-y-6">
                            {/* Profile Highlight Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1">
                                        <Shield size={12} className="text-blue-500" />
                                        National / ID Number
                                    </span>
                                    <p className="text-sm font-black text-slate-900 font-mono">
                                        {employee.idNumber || 'Not Registered'}
                                    </p>
                                </div>
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1">
                                        <Tag size={12} className="text-emerald-500" />
                                        Barcode / Scanner Code
                                    </span>
                                    <p className="text-sm font-black text-emerald-700 font-mono">
                                        {employee.barcode || employee.idNumber || employee.id}
                                    </p>
                                </div>
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1">
                                        <DollarSign size={12} className="text-purple-500" />
                                        Payment Scheme
                                    </span>
                                    <p className="text-sm font-black text-purple-700 uppercase">
                                        {employee.paymentType} • {formatCurrency(employee.paymentRate)}
                                    </p>
                                </div>
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1">
                                        <Calendar size={12} className="text-amber-500" />
                                        Joined Date
                                    </span>
                                    <p className="text-sm font-black text-slate-900">
                                        {employee.joinedAt ? new Date(employee.joinedAt).toLocaleDateString() : 'Active Member'}
                                    </p>
                                </div>
                            </div>

                            {/* Full Detailed Registry Grid */}
                            <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <FileText size={14} className="text-blue-600" />
                                    Employee Registry Profile
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Full Legal Name</label>
                                        <p className="text-sm font-black text-slate-900">{employee.name}</p>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Assigned Role</label>
                                        <p className="text-sm font-black text-slate-900">{roleName}</p>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Employment Type</label>
                                        <p className="text-sm font-black text-slate-900">{employee.employeeType || 'Permanent'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 flex items-center gap-1">
                                            <Phone size={10} /> Phone Number
                                        </label>
                                        <p className="text-sm font-bold text-slate-900">{employee.phone || 'No phone recorded'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 flex items-center gap-1">
                                            <Mail size={10} /> Email Address
                                        </label>
                                        <p className="text-sm font-bold text-slate-900">{employee.email || 'No email recorded'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Account Deposit Type</label>
                                        <p className="text-sm font-bold text-slate-900">{employee.accountType || 'Bank Account'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Citizenship Status</label>
                                        <p className="text-sm font-bold text-slate-900">
                                            {employee.isGeorgianCitizen ? 'Georgian Citizen' : 'International / Work Permit'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Age & Demographics</label>
                                        <p className="text-sm font-bold text-slate-900">
                                            {employee.age ? `${employee.age} Years Old` : 'Age not listed'} {employee.sex ? `(${employee.sex})` : ''}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Platform Account Type</label>
                                        <p className="text-sm font-bold text-slate-900">
                                            {employee.isGlobalUser ? 'Global Cloud User' : 'Local Farm Registry'}
                                        </p>
                                    </div>
                                </div>

                                {/* Hardware RFID/NFC Credentials */}
                                <div className="border-t border-slate-100 pt-6">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                                        <Cpu size={12} className="text-indigo-600" />
                                        Hardware Smart Card / RFID Tag Credentials
                                    </h4>
                                    {employee.hardwareCredentials ? (
                                        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                                            <div>
                                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                                    {employee.hardwareCredentials.type} Linked
                                                </span>
                                                <p className="text-xs font-mono font-black text-slate-900 mt-0.5">
                                                    UID: {employee.hardwareCredentials.serialNumber}
                                                </p>
                                            </div>
                                            <span className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase">
                                                Active Key
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs font-bold text-slate-400 flex items-center justify-between">
                                            <span>No physical RFID wristband or NFC card bound to this profile.</span>
                                            <span className="text-[9px] text-blue-600 uppercase font-black">Bindable via Hardware Labs</span>
                                        </div>
                                    )}
                                </div>

                                {employee.notes && (
                                    <div className="border-t border-slate-100 pt-6">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Operational Remarks & Notes</label>
                                        <p className="text-xs font-medium text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 leading-relaxed">
                                            {employee.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: WORK HISTORY */}
                    {activeTab === 'work' && (
                        <div className="space-y-6">
                            {/* Work Summary Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Total Assignments</span>
                                    <p className="text-2xl font-black text-slate-900">{payrollInfo.allCompletedWork.length}</p>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Farm Tasks Recorded</span>
                                </div>
                                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Hours Logged (Month)</span>
                                    <p className="text-2xl font-black text-blue-600">{payrollInfo.monthWorkHours} hrs</p>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Lifetime: {payrollInfo.totalAllTimeHours} hrs</span>
                                </div>
                                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Harvest Boxes / Crates</span>
                                    <p className="text-2xl font-black text-emerald-600">{payrollInfo.totalCratesLogged}</p>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Total Weight: {payrollInfo.totalAllTimeKg} kg</span>
                                </div>
                            </div>

                            {/* Completed Work Assignments Table */}
                            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                        <Briefcase size={14} className="text-blue-600" />
                                        All Assigned Tasks & Field Logs
                                    </h3>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        {payrollInfo.allCompletedWork.length} Total Records
                                    </span>
                                </div>

                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                    {payrollInfo.allCompletedWork.map(wa => {
                                        const log = (wa.employeeHours || []).find(eh => eh.employeeId === employee.id);
                                        const hours = log?.hours || 0;
                                        const sectorNames = (wa.sectorIds || [])
                                            .map(sId => (plantationFeatures || []).find(f => f.id === sId)?.name)
                                            .filter(Boolean)
                                            .join(', ') || 'General Plantation';

                                        return (
                                            <div key={wa.id} className="p-4 bg-slate-50/70 border border-slate-100 rounded-2xl flex items-center justify-between hover:bg-slate-100/70 transition-all">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-white rounded-xl border border-slate-200/60 text-blue-600 shrink-0 mt-0.5">
                                                        <Clock size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900 uppercase">
                                                            {typeof wa.workName === 'string' ? wa.workName : ((wa.workName as any)?.name || (wa.workName as any)?.title || 'Task')}
                                                        </p>
                                                        <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                                                            {wa.taskType} • Sector: {sectorNames}
                                                        </p>
                                                        <p className="text-[8px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                                                            <Calendar size={10} />
                                                            {new Date(wa.date).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-wider block mb-1">
                                                        {hours} Hours Logged
                                                    </span>
                                                    <span className={`text-[8px] font-black uppercase tracking-wider ${
                                                        wa.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'
                                                    }`}>
                                                        {wa.status}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {payrollInfo.allCompletedWork.length === 0 && (
                                        <div className="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                                            No farm work assignments recorded for this worker yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: PAYROLL & EARNINGS */}
                    {activeTab === 'payroll' && (
                        <div className="space-y-6">
                            {/* Payroll Overview Metric Banner */}
                            <div className="p-6 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-3xl shadow-lg relative overflow-hidden">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 relative">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200">
                                            {payrollInfo.period} Payroll Calculation
                                        </span>
                                        <h3 className="text-3xl font-black tracking-tight mt-1">
                                            {formatCurrency(payrollInfo.totalEarnings)}
                                        </h3>
                                        <p className="text-xs font-bold text-emerald-100 uppercase mt-1">
                                            Model: {employee.paymentType} • Base Rate: {formatCurrency(employee.paymentRate)}
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:items-end gap-1">
                                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/20">
                                            Status: Approved for Payout
                                        </span>
                                        <span className="text-[9px] text-emerald-200 font-bold uppercase mt-1">
                                            Account: {employee.accountType || 'Bank Transfer'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Monthly Breakdown Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Shift Work Compensation</span>
                                        <span className="text-xs font-black text-blue-600">{formatCurrency(payrollInfo.monthWorkEarnings)}</span>
                                    </div>
                                    <p className="text-lg font-black text-slate-900">{payrollInfo.monthWorkHours} Hours</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Across {payrollInfo.workBreakdown.length} completed shift logs</p>
                                </div>
                                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Harvest Pick Piece-Rate</span>
                                        <span className="text-xs font-black text-emerald-600">{formatCurrency(payrollInfo.monthHarvestEarnings)}</span>
                                    </div>
                                    <p className="text-lg font-black text-slate-900">{payrollInfo.monthHarvestKg} kg Net</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">From {payrollInfo.harvestBreakdown.length} weighing station events</p>
                                </div>
                            </div>

                            {/* Detailed Itemized Earnings Ledger */}
                            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <FileText size={14} className="text-emerald-600" />
                                    Itemized Pay Ledger for {payrollInfo.period}
                                </h3>

                                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                    {[...(payrollInfo.workBreakdown || []), ...(payrollInfo.harvestBreakdown || [])]
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(item => {
                                            const isHarvest = 'weight' in item;
                                            return (
                                                <div key={item.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-black text-slate-900 uppercase">{item.name}</p>
                                                            <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${
                                                                isHarvest ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                                {isHarvest ? 'Harvest Weight' : 'Farm Work'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                                                            {isHarvest ? (
                                                                `${(item as any).weight} kg • ${(item as any).crates} Crates`
                                                            ) : (
                                                                `${(item as any).hours} Hours logged`
                                                            )}
                                                        </p>
                                                        <p className="text-[8px] font-bold text-slate-400 mt-1">
                                                            {new Date(item.date).toLocaleDateString()}
                                                        </p>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-emerald-600">
                                                            {formatCurrency(item.earnings)}
                                                        </p>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase">
                                                            Verified
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    {payrollInfo.workBreakdown.length === 0 && payrollInfo.harvestBreakdown.length === 0 && (
                                        <div className="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                                            No completed payroll items logged for this worker in the current month.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: BADGE & HARDWARE PRINTING */}
                    {activeTab === 'badge' && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row items-center justify-center gap-8 p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                <div className="shrink-0 scale-95 sm:scale-100 transition-transform">
                                    <EmployeeIdCard employee={employee} roleName={roleName} />
                                </div>

                                <div className="space-y-4 max-w-sm">
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                                            Hardware Barcode & QR Deployment
                                        </h4>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 leading-relaxed">
                                            Print physical identification badges directly to Zebra label printers or standard laser spoolers adopted in Hardware Labs.
                                        </p>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                                            <span className="text-slate-400">Target Spool Device:</span>
                                            <span className="text-blue-600">{activePrinter?.name || 'Local Spooler'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                                            <span className="text-slate-400">Scanner Compatibility:</span>
                                            <span className="text-emerald-600">Honeywell / Zebra 2D HID</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 pt-2">
                                        <button
                                            onClick={() => handlePrint('full')}
                                            className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <Printer size={15} />
                                            Print Full ID Card
                                        </button>
                                        <button
                                            onClick={() => handlePrint('qr-only')}
                                            className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <BadgeCheck size={15} />
                                            Print Zebra Thermal Label
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Bar */}
                <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span>Worker Profile Synchronized with Weight Station & HR Registry</span>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Close Window
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScannedIdCardModal;
