import React, { useState, useMemo } from 'react';
import type { 
    PlanExecution, NutritionPlan, AreaPlantationFeature, 
    Employee, InventoryItem, User, PlanExecutionSectorMeasurement,
    PlanExecutionAuditLog
} from '../../types';
import { 
    XCircleIcon, BeakerIcon, ClockIcon, 
    ArrowUturnLeftIcon, PencilSquareIcon, CheckIcon, 
    AlertTriangleIcon, SparklesIcon, TrashIcon,
    ShieldCheckIcon
} from '../Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAgronomyEligibleEmployees } from '../../utils/employeeFilters';

interface ExecutionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    execution: PlanExecution | null;
    plans: NutritionPlan[];
    sectors: AreaPlantationFeature[];
    employees: Employee[];
    inventoryItems: InventoryItem[];
    currentUser: User | null;
    onSaveExecution: (updatedExecution: PlanExecution, editReason?: string) => void;
    onRestoreExecution: (executionId: string) => void;
    onDeleteExecution: (executionId: string) => void;
}

export const ExecutionDetailModal: React.FC<ExecutionDetailModalProps> = ({
    isOpen,
    onClose,
    execution,
    plans,
    sectors,
    employees,
    inventoryItems,
    currentUser,
    onSaveExecution,
    onRestoreExecution,
    onDeleteExecution
}) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    // Mode: 'VIEW' | 'EDIT'
    const [isEditing, setIsEditing] = useState(false);

    // Edit form state
    const [editDate, setEditDate] = useState<string>('');
    const [editOperatorId, setEditOperatorId] = useState<string>('');
    const [editWaterLiters, setEditWaterLiters] = useState<number>(0);
    const [editNotes, setEditNotes] = useState<string>('');
    const [editSectors, setEditSectors] = useState<PlanExecutionSectorMeasurement[]>([]);
    const [editElements, setEditElements] = useState<{ name: string; quantity: number; unit: string; inventoryItemId: string; stockDeduction: number }[]>([]);

    // Audit reason modal state
    const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
    const [editReasonText, setEditReasonText] = useState('');
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

    // Initialize edit form when execution changes or edit mode enters
    React.useEffect(() => {
        if (execution) {
            setEditDate(execution.date ? new Date(execution.date).toISOString().split('T')[0] : '');
            setEditOperatorId(execution.executedByEmployeeId || '');
            setEditWaterLiters(execution.actualWaterLiters || 0);
            setEditNotes(execution.notes || '');

            // Initialize sector measurements
            if (execution.sectorMeasurements && execution.sectorMeasurements.length > 0) {
                setEditSectors(execution.sectorMeasurements.map(s => ({ ...s })));
            } else {
                // Fallback from sectorIds
                setEditSectors((execution.sectorIds || []).map(secId => {
                    const sec = sectors.find(s => s.id === secId);
                    return {
                        sectorId: secId,
                        sectorName: sec?.name || 'Sector',
                        durationMinutes: 50,
                        ec: 1.6,
                        ph: 5.8
                    };
                }));
            }

            // Initialize elements
            setEditElements((execution.actualElements || []).map(el => ({
                name: el.newItemName || inventoryItems.find(i => i.id === el.inventoryItemId)?.name || 'Material',
                quantity: el.actualQuantity || el.quantity || 0,
                unit: el.unit || 'kg',
                inventoryItemId: el.inventoryItemId || '',
                stockDeduction: el.stockDeduction || el.actualQuantity || el.quantity || 0
            })));
            setIsEditing(false);
        }
    }, [execution, sectors, inventoryItems]);

    const activePlan = useMemo(() => {
        return plans.find(p => p.id === execution?.planId);
    }, [plans, execution]);

    const activeOperator = useMemo(() => {
        return employees.find(e => e.id === (isEditing ? editOperatorId : execution?.executedByEmployeeId));
    }, [employees, isEditing, editOperatorId, execution]);

    const eligibleEmployees = useMemo(() => getAgronomyEligibleEmployees(employees), [employees]);

    if (!isOpen || !execution) return null;

    // Calculate total cost
    const totalExecutionCost = (execution.actualElements || []).reduce((sum, el) => {
        const item = inventoryItems.find(i => i.id === el.inventoryItemId || i.name.toLowerCase() === (el.newItemName || '').toLowerCase());
        const cost = (el.stockDeduction || el.actualQuantity || el.quantity || 0) * (item?.unitCost || 0);
        return sum + cost;
    }, 0);

    // Save changes after entering reason
    const handleConfirmSaveWithReason = () => {
        if (!editReasonText.trim()) {
            alert(isKa ? 'გთხოვთ მიუთითოთ ცვლილების მიზეზი.' : 'Please provide a reason explaining why this log is being edited.');
            return;
        }

        const editorName = currentUser?.name || currentUser?.firstName || currentUser?.email?.split('@')[0] || 'Administrator';
        const editorId = currentUser?.id || undefined;

        const newAuditLog: PlanExecutionAuditLog = {
            editedByUserName: editorName,
            editedByUserId: editorId,
            editedAt: new Date().toISOString(),
            editReason: editReasonText.trim(),
            previousValuesSummary: `Water: ${execution.actualWaterLiters}L -> ${editWaterLiters}L; Date: ${execution.date} -> ${editDate}; Operator: ${execution.executedByEmployeeId} -> ${editOperatorId}`
        };

        const updatedExecution: PlanExecution = {
            ...execution,
            date: editDate,
            executedByEmployeeId: editOperatorId || undefined,
            actualWaterLiters: editWaterLiters,
            notes: editNotes,
            sectorIds: editSectors.map(s => s.sectorId),
            sectorMeasurements: editSectors,
            actualElements: editElements.map(el => ({
                inventoryItemId: el.inventoryItemId,
                newItemName: el.name,
                quantity: el.quantity,
                actualQuantity: el.quantity,
                unit: el.unit,
                stockDeduction: el.stockDeduction
            })),
            auditLogs: [...(execution.auditLogs || []), newAuditLog]
        };

        onSaveExecution(updatedExecution, editReasonText.trim());
        setIsReasonModalOpen(false);
        setIsEditing(false);
        setEditReasonText('');
    };

    return (
        <div className="fixed inset-0 bg-black/75 z-[6000] flex items-center justify-center p-3 md:p-6 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-scale-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Banner */}
                <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-start flex-shrink-0 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                <SparklesIcon className="w-3.5 h-3.5" />
                                {execution.isReverted 
                                    ? (isKa ? 'გაუქმებული და აღდგენილი' : 'REVERTED & RESTORED') 
                                    : (isKa ? 'შესრულების ჩანაწერი' : 'EXECUTION LOG')}
                            </span>
                            {execution.cycleFeedingNumber && (
                                <span className="px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                                    {isKa ? `კვება #${execution.cycleFeedingNumber}` : `Feeding Run #${execution.cycleFeedingNumber}`}
                                </span>
                            )}
                            {execution.auditLogs && execution.auditLogs.length > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                                    {isKa ? `ჩასწორებულია ${execution.auditLogs.length}-ჯერ` : `Edited ${execution.auditLogs.length} time${execution.auditLogs.length === 1 ? '' : 's'}`}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl md:text-2xl font-black mt-2 tracking-tight">
                            {activePlan?.name || (isKa ? 'მორწყვა-კვების პროცესი' : 'Field Fertigation & Treatment')}
                        </h2>
                        <p className="text-xs text-indigo-200 mt-1">
                            {isKa ? 'თარიღი:' : 'Recorded on:'} <strong>{new Date(execution.date).toLocaleDateString()}</strong> • {isKa ? 'შემსრულებელი:' : 'Executed by:'} <strong>{activeOperator?.name || (isKa ? 'სისტემური ოპერატორი' : 'System Operator')}</strong>
                        </p>
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                        {!isEditing && !execution.isReverted && (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="px-3.5 py-2 bg-indigo-600/40 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all border border-indigo-400/30 flex items-center gap-1.5 cursor-pointer"
                            >
                                <PencilSquareIcon className="w-4 h-4" /> {isKa ? 'რედაქტირება' : 'Edit Record'}
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer">
                            <XCircleIcon className="w-7 h-7" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800 text-xs">
                    {/* Status Reverted Banner */}
                    {execution.isReverted && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900">
                            <AlertTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0" />
                            <div>
                                <h4 className="font-black text-sm">{isKa ? 'შესრულება გაუქმებულია' : 'Execution Has Been Reverted'}</h4>
                                <p className="text-xs text-amber-700">
                                    {isKa 
                                        ? `ამ კვებაში გახარჯული სასუქები სრულად დაბრუნდა საწყობში${execution.revertedBy ? ` (${execution.revertedBy})` : ''}.`
                                        : `The fertilizers consumed in this feeding were fully restored to warehouse inventory stock${execution.revertedBy ? ` by ${execution.revertedBy}` : ''}.`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Summary Metric Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isKa ? 'სამუშაო ხსნარი' : 'Total Solution'}</div>
                            <div className="text-base font-black text-slate-900 mt-1">
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editWaterLiters}
                                        onChange={e => setEditWaterLiters(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm font-black text-indigo-600"
                                    />
                                ) : (
                                    `${execution.actualWaterLiters || 0} ${isKa ? 'ლიტრი' : 'Liters'}`
                                )}
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isKa ? 'ჯამური ღირებულება' : 'Total Cost'}</div>
                            <div className="text-base font-black text-emerald-600 mt-1">
                                {formatCurrency(execution.totalCost || totalExecutionCost)}
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isKa ? 'თარიღი' : 'Date Logged'}</div>
                            <div className="text-base font-black text-slate-900 mt-1">
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={editDate}
                                        onChange={e => setEditDate(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold"
                                    />
                                ) : (
                                    new Date(execution.date).toLocaleDateString()
                                )}
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isKa ? 'ოპერატორი' : 'Operator'}</div>
                            <div className="text-base font-black text-slate-900 mt-1 truncate">
                                {isEditing ? (
                                    <select
                                        value={editOperatorId}
                                        onChange={e => setEditOperatorId(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold cursor-pointer"
                                    >
                                        <option value="">-- {isKa ? 'არცერთი' : 'None'} --</option>
                                        {eligibleEmployees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name} {emp.role ? `(${emp.role})` : ''}</option>
                                        ))}
                                    </select>
                                ) : (
                                    activeOperator?.name || (isKa ? 'შეუვსებელი' : 'Unassigned')
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Target Plantation Sectors & Irrigation Duration with AC (EC) and PH telemetry */}
                    <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <ClockIcon className="w-4 h-4 text-emerald-600" />
                                    {isKa ? 'დამუშავებული სექტორები და ხანგრძლივობა (EC და pH მონიტორინგი)' : 'Target Plantation Sectors & Irrigation Duration (EC & pH Monitoring)'}
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    {isKa ? 'სექტორების მიხედვით ელექტროგამტარობის (EC) და pH კონტროლი.' : 'Monitors Electrical Conductivity (EC) and pH levels per sector.'}
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl font-black text-[10px] uppercase tracking-wider self-start sm:self-auto">
                                {isKa ? 'სენსორი მზადაა' : 'Sensor Ready'}
                            </span>
                        </div>

                        {/* Sectors Grid with Duration, EC, and pH */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                            {(isEditing ? editSectors : (execution.sectorMeasurements || [])).map((sec, idx) => {
                                const sectorMeta = sectors.find(s => s.id === sec.sectorId);
                                const displayName = sec.sectorName || sectorMeta?.name || `${isKa ? 'სექტორი' : 'Sector'} ${idx + 1}`;

                                return (
                                    <div key={sec.sectorId || idx} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-black text-slate-800 text-xs truncate">{displayName}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{isKa ? `სექტორი ${idx + 1}` : `Sector ${idx + 1}`}</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-100">
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase block">{isKa ? 'დრო' : 'Duration'}</span>
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={sec.durationMinutes}
                                                        onChange={e => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            setEditSectors(prev => prev.map((s, i) => i === idx ? { ...s, durationMinutes: val } : s));
                                                        }}
                                                        className="w-full bg-slate-50 border border-slate-300 rounded px-1 py-0.5 text-xs font-black text-center"
                                                    />
                                                ) : (
                                                    <strong className="text-slate-800 text-xs">{sec.durationMinutes || 0} {isKa ? 'წთ' : 'min'}</strong>
                                                )}
                                            </div>

                                            <div>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase block">EC</span>
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={sec.ec !== undefined ? sec.ec : 1.6}
                                                        onChange={e => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setEditSectors(prev => prev.map((s, i) => i === idx ? { ...s, ec: val } : s));
                                                        }}
                                                        className="w-full bg-slate-50 border border-slate-300 rounded px-1 py-0.5 text-xs font-black text-emerald-600 text-center"
                                                    />
                                                ) : (
                                                    <strong className="text-emerald-600 text-xs font-black">
                                                        {sec.ec !== undefined ? sec.ec : 1.6} <span className="text-[9px] font-normal">mS/cm</span>
                                                    </strong>
                                                )}
                                            </div>

                                            <div>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase block">pH</span>
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={sec.ph !== undefined ? sec.ph : 5.8}
                                                        onChange={e => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setEditSectors(prev => prev.map((s, i) => i === idx ? { ...s, ph: val } : s));
                                                        }}
                                                        className="w-full bg-slate-50 border border-slate-300 rounded px-1 py-0.5 text-xs font-black text-amber-600 text-center"
                                                    />
                                                ) : (
                                                    <strong className="text-amber-600 text-xs font-black">
                                                        {sec.ph !== undefined ? sec.ph : 5.8}
                                                    </strong>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {(isEditing ? editSectors : (execution.sectorMeasurements || [])).length === 0 && (
                                <div className="col-span-3 p-4 bg-white rounded-2xl text-center text-slate-400 italic">
                                    {isKa ? 'სექტორების მონაცემები არ არის.' : 'No specific sector measurements logged.'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dissolved Fertilizers & Materials Table */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <BeakerIcon className="w-4 h-4 text-indigo-600" />
                            {isKa ? 'გამოყენებული სასუქები და პრეპარატები (ჩამოწერა საწყობიდან)' : 'Fertilizers & Chemicals Consumed (Stock Deductions)'}
                        </h3>

                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-100 text-[10px] font-black text-slate-600 uppercase">
                                    <tr>
                                        <th className="p-3">{isKa ? 'სასუქის / პრეპარატის დასახელება' : 'Material Name'}</th>
                                        <th className="p-3 text-right">{isKa ? 'დოზა' : 'Dose'}</th>
                                        <th className="p-3 text-right">{isKa ? 'ჩამოწერილი' : 'Stock Charged'}</th>
                                        <th className="p-3 text-right">{isKa ? 'ერთეულის ფასი' : 'Unit Price'}</th>
                                        <th className="p-3 text-right">{isKa ? 'ჯამი' : 'Total Cost'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {(isEditing ? editElements : execution.actualElements || []).map((el: any, idx: number) => {
                                        const item = inventoryItems.find(i => i.id === el.inventoryItemId || i.name.toLowerCase() === (el.newItemName || el.name || '').toLowerCase());
                                        const unitCost = item?.unitCost || 0;
                                        const chargedAmount = el.stockDeduction || el.actualQuantity || el.quantity || 0;
                                        const totalCost = chargedAmount * unitCost;

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-3 font-bold text-slate-800">
                                                    {el.newItemName || el.name || item?.name || (isKa ? 'სასუქი' : 'Fertilizer Material')}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={el.quantity}
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                setEditElements(prev => prev.map((item, i) => i === idx ? {
                                                                    ...item,
                                                                    quantity: val,
                                                                    stockDeduction: val
                                                                } : item));
                                                            }}
                                                            className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 font-bold text-right text-xs"
                                                        />
                                                    ) : (
                                                        `${el.actualQuantity || el.quantity || 0} ${el.unit || (isKa ? 'კგ' : 'kg')}`
                                                    )}
                                                </td>
                                                <td className="p-3 font-black text-emerald-600 text-right">
                                                    {chargedAmount} {item?.unitOfMeasure || el.unit || (isKa ? 'კგ' : 'kg')}
                                                </td>
                                                <td className="p-3 text-slate-500 text-right font-medium">
                                                    {formatCurrency(unitCost)}
                                                </td>
                                                <td className="p-3 font-bold text-slate-800 text-right">
                                                    {formatCurrency(totalCost)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {(isEditing ? editElements : execution.actualElements || []).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-4 text-center text-slate-400 italic">{isKa ? 'სასუქები არ არის ჩაწერილი' : 'No fertilizers recorded'}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Operational Notes */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                            {isKa ? 'შენიშვნები და დაკვირვება:' : 'Operational Notes & Observations:'}
                        </label>
                        {isEditing ? (
                            <textarea
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                rows={3}
                                className="w-full bg-white border border-slate-300 rounded-xl p-3 font-medium text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                placeholder={isKa ? "დაამატეთ შენიშვნა..." : "Add any observations, EC adjustments, weather notes..."}
                            />
                        ) : (
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 font-medium">
                                {execution.notes || (isKa ? 'შენიშვნა არ არის ჩაწერილი.' : 'No specific notes recorded for this feeding.')}
                            </div>
                        )}
                    </div>

                    {/* Audit History Log */}
                    {execution.auditLogs && execution.auditLogs.length > 0 && (
                        <div className="space-y-3 pt-2">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <ShieldCheckIcon className="w-4 h-4 text-indigo-600" />
                                {isKa ? `ცვლილებების ისტორია (${execution.auditLogs.length})` : `Edit Audit Trail (${execution.auditLogs.length} Modification${execution.auditLogs.length === 1 ? '' : 's'})`}
                            </h3>
                            <div className="space-y-2">
                                {execution.auditLogs.map((log, idx) => (
                                    <div key={idx} className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-black text-amber-900 flex items-center gap-1.5">
                                                👤 {isKa ? 'ჩაასწორა:' : 'Modified by:'} {log.editedByUserName}
                                            </span>
                                            <span className="text-[10px] text-amber-700 font-medium">
                                                {new Date(log.editedAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-amber-950 font-bold">
                                            {isKa ? 'მიზეზი:' : 'Reason:'} <span className="font-normal">{log.editReason}</span>
                                        </div>
                                        {log.previousValuesSummary && (
                                            <div className="text-[10px] text-amber-800/80 italic">
                                                {log.previousValuesSummary}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer Controls */}
                <div className="p-6 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {!execution.isReverted && (
                            <button
                                type="button"
                                onClick={() => setShowRestoreConfirm(true)}
                                className="w-full sm:w-auto px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                                <ArrowUturnLeftIcon className="w-4 h-4" /> {isKa ? 'გაუქმება და ნაშთის დაბრუნება' : 'Revert & Restore Stock'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                if (confirm(isKa ? "დარწმუნებული ხართ რომ გსურთ ამ ჩანაწერის წაშლა?" : "Are you sure you want to delete this log?")) {
                                    onDeleteExecution(execution.id);
                                    onClose();
                                }
                            }}
                            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            title={isKa ? "ჩანაწერის წაშლა" : "Delete Log"}
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        {isEditing ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel Edit'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsReasonModalOpen(true)}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <CheckIcon className="w-4 h-4" /> {isKa ? 'შენახვა' : 'Save Changes'}
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                            >
                                {isKa ? 'დახურვა' : 'Close'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mandatory Audit Reason Dialog */}
            {isReasonModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[7000] flex items-center justify-center p-4" onClick={() => setIsReasonModalOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 text-indigo-600">
                            <PencilSquareIcon className="w-6 h-6" />
                            <div>
                                <h3 className="text-base font-black text-slate-900">{isKa ? 'ცვლილების მიზეზი' : 'Reason for Modification'}</h3>
                                <p className="text-xs text-slate-500">{isKa ? 'გთხოვთ აღწეროთ რატომ შეგაქვთ ცვლილება ჩანაწერში.' : 'Please describe why changes are being made to this feeding log.'}</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                {isKa ? 'რატომ შეიცვალა?' : 'Why is this log being changed?'} <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                value={editReasonText}
                                onChange={e => setEditReasonText(e.target.value)}
                                rows={3}
                                required
                                placeholder={isKa ? "მაგ. შესწორდა EC ან წყლის მოცულობა..." : "E.g., Adjusted EC measurement; corrected operator name..."}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 font-medium text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                {isKa ? 'რედაქტორი:' : 'Modified by:'} <strong>{currentUser?.name || currentUser?.firstName || currentUser?.email?.split('@')[0] || 'Administrator'}</strong>
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsReasonModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                            >
                                {isKa ? 'უკან' : 'Back'}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSaveWithReason}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer"
                            >
                                {isKa ? 'დადასტურება' : 'Confirm & Record Audit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Restore Confirmation Dialog */}
            {showRestoreConfirm && (
                <div className="fixed inset-0 bg-black/80 z-[7000] flex items-center justify-center p-4" onClick={() => setShowRestoreConfirm(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 text-amber-600">
                            <AlertTriangleIcon className="w-7 h-7" />
                            <div>
                                <h3 className="text-base font-black text-slate-900">{isKa ? 'გაუქმება და ნაშთის დაბრუნება' : 'Revert & Restore Stock'}</h3>
                                <p className="text-xs text-slate-500">{isKa ? 'საწყობის ნაშთის აღდგენა' : 'Warehouse Inventory Reversal'}</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                            {isKa 
                                ? 'დარწმუნებული ხართ, რომ გსურთ ამ კვების გაუქმება? ყველა ჩამოწერილი სასუქი უკან დაბრუნდება საწყობში და ჩანაწერი მიიღებს გაუქმებულის სტატუსს.'
                                : 'Are you sure you want to fully restore this feeding run? This will return all consumed fertilizers back into warehouse stock and mark the execution as reverted.'}
                        </p>

                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                            <div className="font-bold text-amber-900">{isKa ? 'დასაბრუნებელი მასალები:' : 'Materials to be returned:'}</div>
                            {(execution.actualElements || []).map((el, i) => {
                                const matItem = inventoryItems.find(item => item.id === el.inventoryItemId);
                                return (
                                    <div key={i} className="text-amber-800 flex justify-between text-[11px]">
                                        <span>{el.newItemName || matItem?.name || (isKa ? 'სასუქი' : 'Fertilizer')}</span>
                                        <strong>+{el.stockDeduction || el.actualQuantity || el.quantity || 0} {el.unit || (isKa ? 'კგ' : 'kg')}</strong>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowRestoreConfirm(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                            >
                                {isKa ? 'გაუქმება' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onRestoreExecution(execution.id);
                                    setShowRestoreConfirm(false);
                                    onClose();
                                }}
                                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer"
                            >
                                {isKa ? 'აღდგენის დადასტურება' : 'Confirm Restore'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExecutionDetailModal;
