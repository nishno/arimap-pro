
import React, { useState, useMemo, useEffect } from 'react';
import type { HarvestEvent, PayrollRun, Transaction, Account, Employee, HarvestEntry, PurchaseOrder, Supplier, WorkAssignment, DashboardWidget, InventoryItem, Machinery, PaymentType, PaymentMode, AssignedPicker, Role } from '../types';
import { 
    BanknotesIcon, CheckIcon, PlusIcon, PlusCircleIcon, PencilSquareIcon, TrashIcon,
    ArrowTrendingUpIcon, ArrowTrendingDownIcon, CurrencyDollarIcon, InfoIcon, 
    SearchIcon, CalendarDaysIcon, ArrowPathIcon, XIcon, ArchiveBoxIcon, ChartBarIcon,
    ArrowUturnLeftIcon, ShieldCheckIcon, AlertTriangleIcon, ArrowUpTrayIcon,
    TractorIcon, BriefcaseIcon, UsersIcon, WrenchScrewdriverIcon, BeakerIcon, PhotoIcon
} from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { calculateNetDurationHours, calculatePickerEarnings } from './HarvestingStats';
import TransactionModal from './TransactionModal';

interface AccountingViewProps {
    harvestEvents: HarvestEvent[];
    onSetHarvestEvents: (events: HarvestEvent[]) => void;
    workAssignments: WorkAssignment[];
    onSetWorkAssignments: (assignments: WorkAssignment[]) => void;
    payrollRuns: PayrollRun[];
    onSetPayrollRuns: (runs: PayrollRun[]) => void;
    accounts: Account[];
    onSetAccounts: (accounts: Account[]) => void;
    transactions: Transaction[];
    onSetTransactions: (transactions: Transaction[]) => void;
    employees: Employee[];
    harvestEntries: HarvestEntry[];
    purchaseOrders: PurchaseOrder[];
    suppliers: Supplier[];
    inventoryItems: InventoryItem[];
    machinery: Machinery[];
    roles?: Role[];
    onAddToDashboard?: (widget: Omit<DashboardWidget, 'id' | 'order' | 'isVisible'>) => void;
}

const StatWidget: React.FC<{ label: string, value: string, sub?: string, colorClass: string, icon: React.ReactNode }> = ({ label, value, sub, colorClass, icon }) => (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 flex flex-col justify-between shadow-sm relative overflow-hidden group">
        <div className="flex justify-between items-start z-10">
            <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                <div className={`text-2xl md:text-3xl font-black mt-1 tracking-tighter ${colorClass}`}>{value}</div>
                {sub && <div className="text-[10px] font-bold text-slate-400 mt-1">{sub}</div>}
            </div>
            <div className={`p-3 rounded-2xl ${colorClass.replace('text-', 'bg-').replace('600', '50')}`}>
                {icon}
            </div>
        </div>
    </div>
);

const AccountingView: React.FC<AccountingViewProps> = (props) => {
    const { transactions, harvestEvents, workAssignments, onSetTransactions, accounts, employees, machinery, inventoryItems, suppliers, purchaseOrders, roles = [] } = props;
    const [activeTab, setActiveTab] = useState<'summary' | 'operations' | 'harvests_calc' | 'wallets' | 'payroll' | 'ledger'>('summary');
    const [searchTerm, setSearchTerm] = useState('');
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [prefilledTxn, setPrefilledTxn] = useState<Transaction | null>(null);
    const { t, formatCurrency } = useLanguage();
    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

    // 💰 Settle Salary States
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [salaryPayoutAmount, setSalaryPayoutAmount] = useState<number | ''>(0);
    const [salaryCreditAccountId, setSalaryCreditAccountId] = useState('acc-bank');
    const [salaryDate, setSalaryDate] = useState(new Date().toISOString().split('T')[0]);
    const [salaryPaymentSource, setSalaryPaymentSource] = useState<'general' | 'harvest' | 'task'>('general');
    const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

    const employeeSourceEvents = useMemo(() => {
        if (!selectedEmpId) return [];
        const emp = employees.find(e => e.id === selectedEmpId);
        if (!emp) return [];

        if (salaryPaymentSource === 'harvest') {
            return (harvestEvents || [])
                .filter(ev => ev.status === 'completed' || ev.totalPickerCost)
                .map(ev => {
                    let picker = (ev.assignedPickers || []).find(p => p.employeeId === selectedEmpId);
                    const pickerEntries = (props.harvestEntries || []).filter(
                        e => String(e.harvestEventId) === String(ev.id) && String(e.employeeId) === String(selectedEmpId)
                    );
                    if (!picker && pickerEntries.length > 0) {
                        const empRoleName = emp?.roleId ? (roles?.find(r => r.id === emp.roleId)?.name || emp.roleId) : 'Picker';
                        picker = {
                            employeeId: selectedEmpId,
                            paymentModel: emp?.paymentType === 'hourly' ? 'hourly' : 'per_weight',
                            rate: emp?.paymentRate || (ev as any).defaultRatePerKg || 0.4,
                            assignedRole: empRoleName
                        };
                    }
                    if (!picker) return null;

                    const durationHours = calculateNetDurationHours(ev);
                    const weight = picker.manualNetWeight ?? pickerEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
                    const hrs = picker.manualHours ?? durationHours;
                    const earned = calculatePickerEarnings(picker, weight, hrs);

                    const empTxns = transactions.filter(t => t.employeeId === selectedEmpId);
                    const directPaid = empTxns
                        .filter(t => t.debitAccountId === 'acc-payroll' && t.referenceId === ev.id)
                        .reduce((sum, t) => sum + t.amount, 0);

                    const accruals = empTxns
                        .filter(t => t.creditAccountId === 'acc-payroll')
                        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    const totalPayments = empTxns
                        .filter(t => t.debitAccountId === 'acc-payroll')
                        .reduce((sum, t) => sum + t.amount, 0);

                    const allDirectPaymentsSum = empTxns
                        .filter(t => t.debitAccountId === 'acc-payroll' && t.referenceId !== undefined)
                        .reduce((sum, t) => sum + t.amount, 0);

                    let fifoPool = Math.max(0, totalPayments - allDirectPaymentsSum);
                    let allocatedFifoAmountForThisAccrual = 0;
                    let foundAccrualForThisEvent = false;

                    for (const acc of accruals) {
                        const isTarget = acc.referenceId === ev.id;
                        const accAmt = acc.amount;
                        const allocatedFifo = Math.min(accAmt, fifoPool);
                        fifoPool -= allocatedFifo;

                        if (isTarget) {
                            allocatedFifoAmountForThisAccrual += allocatedFifo;
                            foundAccrualForThisEvent = true;
                        }
                    }

                    if (!foundAccrualForThisEvent && earned > 0) {
                        allocatedFifoAmountForThisAccrual += Math.min(earned, fifoPool);
                    }

                    const paid = directPaid + allocatedFifoAmountForThisAccrual;
                    const left = Math.max(0, earned - paid);

                    return {
                        id: ev.id,
                        name: ev.name,
                        date: ev.actualEndDate || ev.plannedStartDate || '',
                        earned,
                        paid,
                        left,
                        type: 'harvest' as const
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);
        } else if (salaryPaymentSource === 'task') {
            return (workAssignments || [])
                .filter(wa => wa.status === 'completed' && (wa.assignedEmployeeIds || []).includes(selectedEmpId))
                .map(wa => {
                    const workLog = (wa.employeeHours || []).find(eh => eh.employeeId === selectedEmpId);
                    const hours = workLog ? workLog.hours : (wa.plannedTime || 0);

                    let earned = 0;
                    if (emp.paymentType === 'hourly') {
                        earned = hours * emp.paymentRate;
                    } else if (emp.paymentType === 'daily') {
                        earned = (hours / 8) * emp.paymentRate;
                    } else {
                        earned = hours * (emp.paymentRate / 160 || 12);
                    }

                    const empTxns = transactions.filter(t => t.employeeId === selectedEmpId);
                    const paid = empTxns
                        .filter(t => t.debitAccountId === 'acc-payroll' && t.referenceId === wa.id)
                        .reduce((sum, t) => sum + t.amount, 0);

                    const left = Math.max(0, earned - paid);

                    return {
                        id: wa.id,
                        name: wa.workName,
                        date: wa.date,
                        earned,
                        paid,
                        left,
                        type: 'task' as const
                    };
                });
        }
        return [];
    }, [selectedEmpId, salaryPaymentSource, harvestEvents, workAssignments, transactions, props.harvestEntries, employees]);

    const sumSelectedOutstanding = useMemo(() => {
        if (salaryPaymentSource === 'general') return 0;
        return employeeSourceEvents
            .filter(ev => selectedEventIds.has(ev.id))
            .reduce((sum, ev) => sum + ev.left, 0);
    }, [employeeSourceEvents, selectedEventIds, salaryPaymentSource]);

    const totalAllOutstandingBasis = useMemo(() => {
        return employeeSourceEvents.reduce((sum, ev) => sum + ev.left, 0);
    }, [employeeSourceEvents]);

    useEffect(() => {
        if (selectedEmpId && salaryPaymentSource !== 'general') {
            const allIds = new Set(employeeSourceEvents.map(e => e.id));
            setSelectedEventIds(allIds);
            const sum = employeeSourceEvents.reduce((s, e) => s + e.left, 0);
            setSalaryPayoutAmount(sum);
        } else {
            setSelectedEventIds(new Set());
            if (selectedEmpId && salaryPaymentSource === 'general') {
                const empTransactions = transactions.filter(t => t.employeeId === selectedEmpId);
                const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                const balance = Math.max(0, accrued - paid);
                setSalaryPayoutAmount(balance);
            } else {
                setSalaryPayoutAmount(0);
            }
        }
    }, [selectedEmpId, salaryPaymentSource, employeeSourceEvents]);

    // 💸 Record Expense States
    const [expenseCategory, setExpenseCategory] = useState('OPEX');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseAmount, setExpenseAmount] = useState<number | ''>(0);
    const [expenseCreditAccountId, setExpenseCreditAccountId] = useState('acc-bank');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
    const [expensePaymentMode, setExpensePaymentMode] = useState<PaymentMode>('By Card');

    // 🍇 Harvest Price Calculator States
    const [selectedHarvestIds, setSelectedHarvestIds] = useState<Set<string>>(new Set());
    const [harvestManualTotalValues, setHarvestManualTotalValues] = useState<Record<string, number>>({});
    const [harvestManualYields, setHarvestManualYields] = useState<Record<string, number>>({});

    // 👥 Bulk Payout States
    const [selectedPayrollEmpIds, setSelectedPayrollEmpIds] = useState<Set<string>>(new Set());
    const [isBulkPayModalOpen, setIsBulkPayModalOpen] = useState(false);
    const [bulkPayMode, setBulkPayMode] = useState<PaymentMode>('Cash');
    const [bulkPaidBy, setBulkPaidBy] = useState('');
    const [bulkCreditAccountId, setBulkCreditAccountId] = useState('acc-bank');
    const [bulkPayDate, setBulkPayDate] = useState(new Date().toISOString().split('T')[0]);
    const [payrollSubTab, setPayrollSubTab] = useState<'employees' | 'events'>('employees');
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

    const selectableEmployees = useMemo(() => {
        return employees.filter(emp => {
            const empTransactions = transactions.filter(t => t.employeeId === emp.id);
            const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
            const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
            const balance = accrued - paid;
            return balance > 0;
        });
    }, [employees, transactions]);

    const selectedEmployeesTotalBalance = useMemo(() => {
        return employees.filter(emp => selectedPayrollEmpIds.has(emp.id)).reduce((sum, emp) => {
            const empTransactions = transactions.filter(t => t.employeeId === emp.id);
            const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
            const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
            const balance = accrued - paid;
            return sum + (balance > 0 ? balance : 0);
        }, 0);
    }, [employees, selectedPayrollEmpIds, transactions]);

    const harvestPayrollList = useMemo(() => {
        return harvestEvents.filter(ev => ev.status === 'completed' || ev.totalPickerCost).map(ev => {
            const durationHours = calculateNetDurationHours(ev);
            const assignedIds = new Set((ev.assignedPickers || []).map(p => p.employeeId));
            const unassignedEntryEmpIds = Array.from(new Set(
                (props.harvestEntries || [])
                    .filter(e => String(e.harvestEventId) === String(ev.id))
                    .map(e => String(e.employeeId))
            )).filter(empId => !assignedIds.has(empId));

            const extraPickers: AssignedPicker[] = unassignedEntryEmpIds.map(empId => {
                const emp = employees.find(e => e.id === empId);
                const empRoleName = emp?.roleId ? (roles?.find(r => r.id === emp.roleId)?.name || emp.roleId) : 'Picker';
                return {
                    employeeId: empId,
                    paymentModel: emp?.paymentType === 'hourly' ? 'hourly' : 'per_weight',
                    rate: emp?.paymentRate || (ev as any).defaultRatePerKg || 0.4,
                    assignedRole: empRoleName
                };
            });

            const allEventPickers = [...(ev.assignedPickers || []), ...extraPickers];

            const pickersDetail = allEventPickers.map(picker => {
                const employee = employees.find(e => e.id === picker.employeeId);
                const pickerEntries = (props.harvestEntries || []).filter(e => String(e.harvestEventId) === String(ev.id) && String(e.employeeId) === String(picker.employeeId));
                const weight = picker.manualNetWeight ?? pickerEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
                const hrs = picker.manualHours ?? durationHours;
                const earned = calculatePickerEarnings(picker, weight, hrs);

                const empTxns = transactions.filter(t => t.employeeId === picker.employeeId);
                const directPaid = empTxns
                    .filter(t => t.debitAccountId === 'acc-payroll' && t.referenceId === ev.id)
                    .reduce((sum, t) => sum + t.amount, 0);

                const accruals = empTxns
                    .filter(t => t.creditAccountId === 'acc-payroll')
                    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                const totalPayments = empTxns
                    .filter(t => t.debitAccountId === 'acc-payroll')
                    .reduce((sum, t) => sum + t.amount, 0);

                const allDirectPaymentsSum = empTxns
                    .filter(t => t.debitAccountId === 'acc-payroll' && t.referenceId !== undefined)
                    .reduce((sum, t) => sum + t.amount, 0);

                let fifoPool = Math.max(0, totalPayments - allDirectPaymentsSum);
                let allocatedFifoAmountForThisAccrual = 0;
                let foundAccrualForThisEvent = false;

                for (const acc of accruals) {
                    const isTarget = acc.referenceId === ev.id;
                    const accAmt = acc.amount;
                    const allocatedFifo = Math.min(accAmt, fifoPool);
                    fifoPool -= allocatedFifo;

                    if (isTarget) {
                        allocatedFifoAmountForThisAccrual += allocatedFifo;
                        foundAccrualForThisEvent = true;
                    }
                }

                if (!foundAccrualForThisEvent && earned > 0) {
                    allocatedFifoAmountForThisAccrual += Math.min(earned, fifoPool);
                }

                const paid = directPaid + allocatedFifoAmountForThisAccrual;
                const left = Math.max(0, earned - paid);

                const paymentTxns = empTxns.filter(t => t.debitAccountId === 'acc-payroll');

                return {
                    employeeId: picker.employeeId,
                    employeeName: employee?.name || picker.employeeId,
                    earned,
                    paid,
                    left,
                    paymentTxns
                };
            });

            const totalEarned = pickersDetail.reduce((sum, p) => sum + p.earned, 0);
            const totalPaid = pickersDetail.reduce((sum, p) => sum + p.paid, 0);
            const totalLeft = pickersDetail.reduce((sum, p) => sum + p.left, 0);

            return {
                id: ev.id,
                name: ev.name,
                date: ev.actualEndDate || ev.plannedStartDate || '',
                pickersDetail,
                totalEarned,
                totalPaid,
                totalLeft
            };
        });
    }, [harvestEvents, employees, transactions, props.harvestEntries]);

    const handleBulkPaySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const empsToPay = employees.filter(emp => {
            if (!selectedPayrollEmpIds.has(emp.id)) return false;
            const empTransactions = transactions.filter(t => t.employeeId === emp.id);
            const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
            const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
            const balance = accrued - paid;
            return balance > 0;
        });

        if (empsToPay.length === 0) {
            alert(isKa ? "მოსამზადებელი გადახდა არ მოიძებნა! გთხოვთ მონიშნოთ თანამშრომლები მყარი ნაშთით." : "No employees with outstanding balances were selected.");
            return;
        }

        const newTxns: Transaction[] = empsToPay.map(emp => {
            const empTransactions = transactions.filter(t => t.employeeId === emp.id);
            const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
            const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
            const balance = accrued - paid;

            return {
                id: `bulkpay-${emp.id}-${Date.now()}-${Math.random()}`,
                date: new Date(bulkPayDate).toISOString(),
                description: `Salary Payout: ${emp.name} (Bulk)`,
                debitAccountId: 'acc-payroll',
                creditAccountId: bulkCreditAccountId,
                amount: balance,
                transactionType: 'Outgoing Payment',
                employeeId: emp.id,
                category: 'PAYROLL',
                paymentMode: bulkPayMode,
                paidBy: bulkPaidBy
            };
        });

        onSetTransactions(newTxns);
        alert(isKa ? `წარმატებით გაიცა ხელფასი ${newTxns.length} თანამშრომელზე!` : `Successfully settled salaries for ${newTxns.length} employees!`);
        setIsBulkPayModalOpen(false);
        setSelectedPayrollEmpIds(new Set());
    };

    const stats = useMemo(() => {
        const income = transactions.reduce((s, t) => s + (t.transactionType === 'Incoming Payment' ? (t.managerOverrideAmount ?? t.amount) : 0), 0);
        const opExpenses = transactions.reduce((s, t) => s + (t.transactionType === 'Outgoing Payment' ? (t.managerOverrideAmount ?? t.amount) : 0), 0);
        const payrollLiability = accounts.find(a => a.id === 'acc-payroll')?.balance || 0;
        const totalWalletExposure = accounts.filter(a => a.isWallet).reduce((s, a) => s + (a.balance < 0 ? Math.abs(a.balance) : 0), 0);
        
        return { income, opExpenses, payrollLiability, totalWalletExposure, netProfit: income - opExpenses };
    }, [transactions, accounts]);

    const wallets = useMemo(() => accounts.filter(a => a.isWallet), [accounts]);

    const handleCommitAccruals = () => {
        const salaryEmployees = employees.filter(e => e.paymentType === 'salary');
        if (salaryEmployees.length === 0) return alert("No employees with 'Salary' payment model found.");

        const monthName = new Date().toLocaleString('default', { month: 'long' });
        const newTxns: Transaction[] = salaryEmployees.map(emp => ({
            id: `accrual-${emp.id}-${Date.now()}`,
            date: new Date().toISOString(),
            description: `Monthly Salary Accrual: ${emp.name} (${monthName})`,
            debitAccountId: 'acc-labor-expense',
            creditAccountId: 'acc-payroll',
            amount: emp.paymentRate,
            transactionType: 'Journal Entry',
            employeeId: emp.id,
            category: 'PAYROLL'
        }));

        onSetTransactions(newTxns);
    };

    // 💵 Disburse Salary transaction handler
    const handleDisburseSalary = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = Number(salaryPayoutAmount) || 0;
        if (!selectedEmpId || amt <= 0) {
            alert(isKa ? "გთხოვთ აირჩიოთ თანამშრომელი და მიუთითოთ გასაცემი თანხა." : "Please select an employee and specify payout amount.");
            return;
        }
        const worker = employees.find(emp => emp.id === selectedEmpId);
        if (!worker) return;

        let remainingToDisburse = amt;
        const selectedEvents = employeeSourceEvents.filter(ev => selectedEventIds.has(ev.id));

        const transactionsToCreate: Transaction[] = [];

        if (salaryPaymentSource !== 'general' && selectedEvents.length > 0) {
            // Distribute across selected events
            for (let i = 0; i < selectedEvents.length; i++) {
                const ev = selectedEvents[i];
                if (remainingToDisburse <= 0) break;

                // How much is outstanding on this event?
                const leftOnEvent = ev.left;
                
                // If we are on the very last event in the loop, and we still have remaining, we can add the rest here
                // (e.g. if paid extra, or just let it adjust). Otherwise, pay up to what is outstanding.
                let payForThisEvent = Math.min(leftOnEvent, remainingToDisburse);
                if (i === selectedEvents.length - 1 && remainingToDisburse > 0) {
                    payForThisEvent = remainingToDisburse;
                }

                if (payForThisEvent > 0) {
                    transactionsToCreate.push({
                        id: `salary-payout-${ev.id}-${Date.now()}-${i}`,
                        date: new Date(salaryDate).toISOString(),
                        description: salaryPaymentSource === 'harvest' 
                            ? `Salary Event: ${worker.name} - ${ev.name}`
                            : `Salary Task: ${worker.name} - ${ev.name}`,
                        debitAccountId: 'acc-payroll',
                        creditAccountId: salaryCreditAccountId,
                        amount: payForThisEvent,
                        transactionType: 'Outgoing Payment',
                        employeeId: selectedEmpId,
                        referenceId: ev.id,
                        category: 'PAYROLL',
                        paymentMode: 'Cash'
                    });
                    remainingToDisburse -= payForThisEvent;
                }
            }
        } else {
            // General layout
            transactionsToCreate.push({
                id: `salary-payout-general-${Date.now()}`,
                date: new Date(salaryDate).toISOString(),
                description: `Salary disbursement: ${worker.name} (General)`,
                debitAccountId: 'acc-payroll',
                creditAccountId: salaryCreditAccountId,
                amount: Number(salaryPayoutAmount) || 0,
                transactionType: 'Outgoing Payment',
                employeeId: selectedEmpId,
                category: 'PAYROLL'
            });
        }

        if (transactionsToCreate.length === 0) {
            alert(isKa ? "გთხოვთ მონიშნოთ აქტიური კრეფა ან სამუშაო." : "Please check active event or task.");
            return;
        }

        onSetTransactions(transactionsToCreate);
        alert(isKa 
            ? `ხელფასის გაცემა ${formatCurrency(Number(salaryPayoutAmount) || 0)} თანამშრომლისთვის "${worker.name}" წარმატებით დარეგისტრირდა (${transactionsToCreate.length} ტრანზაქციით)!` 
            : `Salary disbursement of ${formatCurrency(Number(salaryPayoutAmount) || 0)} for ${worker.name} successfully logged with ${transactionsToCreate.length} transactions!`);
        
        setSelectedEmpId('');
        setSalaryPayoutAmount('');
        setSalaryPaymentSource('general');
    };

    // 💸 Disburse Expense transaction handler
    const handleDisburseExpense = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = Number(expenseAmount) || 0;
        if (amt <= 0 || !expenseDescription.trim()) {
            alert(isKa ? "გთხოვთ მიუთითოთ ხარჯის სახელი და თანხა." : "Please specify expense description and amount.");
            return;
        }

        const newTx: Transaction = {
            id: `manual-expense-${Date.now()}`,
            date: new Date(expenseDate).toISOString(),
            description: `${expenseDescription} (${expenseCategory})`,
            debitAccountId: 'acc-op-expense',
            creditAccountId: expenseCreditAccountId,
            amount: amt,
            transactionType: 'Outgoing Payment',
            paymentMode: expensePaymentMode,
            category: expenseCategory as any
        };
        onSetTransactions([newTx]);
        alert(isKa ? `ხარჯი ${formatCurrency(amt)} ("${expenseDescription}") წარმატებით დარეგისტრირდა!` : `Expense payment of ${formatCurrency(amt)} ("${expenseDescription}") successfully logged!`);
        setExpenseDescription('');
        setExpenseAmount('');
    };

    // 🍇 Filter completed/partially sold harvests for the calculator
    const calcHarvests = useMemo(() => {
        return (harvestEvents || []).filter(e => e.status === 'completed' || e.status === 'partially_sold' || e.finalNetYieldKg !== undefined);
    }, [harvestEvents]);

    // 🍇 Dynamic computations for the interactive calculator
    const calculatorResult = useMemo(() => {
        let totalWeight = 0;
        let totalValue = 0;
        selectedHarvestIds.forEach(id => {
            const h = harvestEvents.find(e => e.id === id);
            if (h) {
                const yieldWeight = harvestManualYields[id] !== undefined ? harvestManualYields[id] : (h.finalNetYieldKg || h.totalNetWeightKg || 0);
                const saleValue = harvestManualTotalValues[id] !== undefined ? harvestManualTotalValues[id] : (h.saleDetails?.totalValue || 0);
                totalWeight += yieldWeight;
                totalValue += saleValue;
            }
        });
        const averagePrice = totalWeight > 0 ? totalValue / totalWeight : 0;
        return { totalWeight, totalValue, averagePrice };
    }, [selectedHarvestIds, harvestEvents, harvestManualTotalValues, harvestManualYields]);

    const handleSelectAllHarvests = () => {
        if (selectedHarvestIds.size === calcHarvests.length) {
            setSelectedHarvestIds(new Set());
        } else {
            setSelectedHarvestIds(new Set(calcHarvests.map(h => h.id)));
        }
    };

    return (
        <main className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-8 safe-area-bottom">
            <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">Audit <span className="text-blue-600">Ledger</span></h1>
                        <p className="text-sm font-bold text-slate-400">Institutional financial controls and Petty Cash (Sub-Account) diaries.</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <StatWidget label="Main Liquidity" value={formatCurrency(accounts.find(a => a.id === 'acc-bank')?.balance || 0)} icon={<BanknotesIcon size={24}/>} colorClass="text-blue-600" />
                    <StatWidget label="Wallet Exposure" value={formatCurrency(stats.totalWalletExposure)} icon={<ShieldCheckIcon size={24}/>} colorClass="text-orange-600" sub="Debt to Managers" />
                    <StatWidget label="Payroll Accruals" value={formatCurrency(stats.payrollLiability)} icon={<ArrowTrendingDownIcon size={24}/>} colorClass="text-red-600" />
                    <StatWidget label="Realized Income" value={formatCurrency(stats.income)} icon={<ArrowTrendingUpIcon size={24}/>} colorClass="text-green-600" />
                </div>

                <div className="flex gap-1 border-b border-slate-200 overflow-x-auto scrollbar-hide no-scrollbar">
                    {([
                        { id: 'summary', enValue: 'Summary', kaValue: 'რეზიუმე' },
                        { id: 'operations', enValue: 'Pay Desk & Expenses', kaValue: 'გადახდები და ხარჯები' },
                        { id: 'harvests_calc', enValue: 'Harvest Price Estimator', kaValue: 'მოსავლის საშუალო ფასი' },
                        { id: 'wallets', enValue: 'Manager Wallets', kaValue: 'მენეჯერის საფულეები' },
                        { id: 'payroll', enValue: 'Payroll Forensic', kaValue: 'ხელფასები' },
                        { id: 'ledger', enValue: 'Audit Ledger', kaValue: 'ჟურნალი' }
                    ] as const).map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id)} 
                            className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-2xl transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-slate-900 border-b-4 border-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {isKa ? tab.kaValue : tab.enValue}
                        </button>
                    ))}
                </div>

                {activeTab === 'summary' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                        <div className="bg-white p-6 md:p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Debt Structure</h3>
                            <div className="space-y-4">
                                {[
                                    { label: 'Unpaid Manager Expenses', value: stats.totalWalletExposure, icon: <CurrencyDollarIcon size={16}/>, color: 'bg-orange-500' },
                                    { label: 'Unpaid Employee Salaries', value: stats.payrollLiability, icon: <ShieldCheckIcon size={16}/>, color: 'bg-red-500' }
                                ].map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-left">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 ${item.color} text-white rounded-2xl flex items-center justify-center shadow-lg`}>{item.icon}</div>
                                            <span className="text-sm font-bold text-slate-600">{item.label}</span>
                                        </div>
                                        <div className="text-sm font-black text-slate-900">{formatCurrency(item.value)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-indigo-900 p-8 rounded-[3rem] text-white flex flex-col justify-center shadow-2xl shadow-indigo-100 relative overflow-hidden group text-left">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
                             <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Automated Audit Tip</h4>
                             <p className="text-xl font-bold leading-tight">Wallets are sub-accounts held by managers. If a manager spends more than their limit, the balance goes negative, signaling a needed reimbursement from the company.</p>
                             <button onClick={() => setActiveTab('wallets')} className="mt-6 self-start px-6 py-2.5 bg-white text-indigo-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl">Go to Wallets</button>
                        </div>
                    </div>
                )}

                {activeTab === 'operations' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in text-left">
                        {/* 💵 Worker Salary Settlement Form */}
                        <div id="salary-pay-desk" className="bg-white p-6 md:p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
                            <div>
                                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                            {isKa ? 'ხელფასის გაცემის პანელი' : 'Salary Settlement Desk'}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            {isKa ? 'გაუნაღდებელი დავალიანების გასტუმრება' : 'Settle outstanding workforce accruals'}
                                        </p>
                                    </div>
                                    <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-2xl">
                                        <UsersIcon size={22} />
                                    </div>
                                </div>

                                <form onSubmit={handleDisburseSalary} className="space-y-4 pt-4">
                                    {/* 📦 Source / Basis toggle buttons */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                            {isKa ? 'გაცემის საფუძველი (წყარო)' : 'Disbursement Basis / Source'}
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['general', 'harvest', 'task'] as const).map((source) => {
                                                const label = source === 'general' 
                                                    ? (isKa ? 'სხვა / ზოგადი' : 'General / Other')
                                                    : source === 'harvest'
                                                        ? (isKa ? 'კრეფა' : 'Harvest Event')
                                                        : (isKa ? 'სამუშაო/დავალება' : 'Work & Task');
                                                const isActive = salaryPaymentSource === source;
                                                return (
                                                    <button
                                                        key={source}
                                                        type="button"
                                                        onClick={() => setSalaryPaymentSource(source)}
                                                        className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                            isActive 
                                                                ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                                                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Select worker */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                            {isKa ? 'თანამშრომელი' : 'Select Employee'}
                                        </label>
                                        <select
                                            value={selectedEmpId}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                setSelectedEmpId(id);
                                            }}
                                            className="w-full text-sm font-bold p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans"
                                            required
                                        >
                                            <option value="">{isKa ? '-- აირჩიეთ თანამშრომელი --' : '-- Choose Employee --'}</option>
                                            {employees.map(emp => {
                                                const empTransactions = transactions.filter(t => t.employeeId === emp.id);
                                                const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                                const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                                const balance = accrued - paid;
                                                return (
                                                    <option key={emp.id} value={emp.id}>
                                                        {emp.name} ({isKa ? 'ბალანსი: ' : 'Balance: '} {formatCurrency(balance)})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    {/* Event Selection */}
                                    {selectedEmpId && salaryPaymentSource !== 'general' && (
                                        <div className="space-y-2 bg-slate-50 border border-slate-200 p-4 rounded-3xl animate-fade-in text-left">
                                            <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                                                <span className="text-[10px] font-black uppercase text-slate-500">
                                                    {salaryPaymentSource === 'harvest' 
                                                        ? (isKa ? 'მოსავლის კრეფების მონიშვნა' : 'Select Harvest Events')
                                                        : (isKa ? 'შესრულებული სამუშაოების მონიშვნა' : 'Select Work Assignments')}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (selectedEventIds.size === employeeSourceEvents.length) {
                                                            setSelectedEventIds(new Set());
                                                        } else {
                                                            setSelectedEventIds(new Set(employeeSourceEvents.map(e => e.id)));
                                                        }
                                                    }}
                                                    className="text-[9px] font-black uppercase tracking-tight text-blue-600 hover:underline bg-blue-50/50 px-2 py-1 rounded"
                                                >
                                                    {selectedEventIds.size === employeeSourceEvents.length 
                                                        ? (isKa ? 'ყველას მოხსნა' : 'Clear All')
                                                        : (isKa ? 'ყველას მონიშვნა' : 'Select All')}
                                                </button>
                                            </div>

                                            {employeeSourceEvents.length === 0 ? (
                                                <p className="text-[10px] text-slate-400 italic py-2">
                                                    {isKa ? 'აქტიური მონაცემები ამ კატეგორიაში ვერ მოიძებნა' : 'No active records found with outstanding payroll.'}
                                                </p>
                                            ) : (
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar scrollbar-hide">
                                                    {employeeSourceEvents.map(ev => {
                                                        const isChecked = selectedEventIds.has(ev.id);
                                                        return (
                                                            <div 
                                                                key={ev.id} 
                                                                onClick={() => {
                                                                    const next = new Set(selectedEventIds);
                                                                    if (next.has(ev.id)) next.delete(ev.id);
                                                                    else next.add(ev.id);
                                                                    setSelectedEventIds(next);
                                                                }}
                                                                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                                                    isChecked 
                                                                        ? 'bg-blue-50/40 border-blue-200 text-blue-900' 
                                                                        : 'bg-white border-slate-100 hover:border-slate-200 text-slate-700'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        readOnly
                                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                                                                    />
                                                                    <div>
                                                                        <div className="font-bold uppercase tracking-tight truncate max-w-[150px]">{ev.name}</div>
                                                                        <div className="text-[9px] text-slate-400 font-semibold">{ev.date.split('T')[0]}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="font-extrabold">{formatCurrency(ev.left)}</div>
                                                                    <div className="text-[8px] text-slate-400">
                                                                        {isKa ? 'კუთვნილი: ' : 'Due: '}{formatCurrency(ev.earned)} | {isKa ? 'გაცემული: ' : 'Paid: '}{formatCurrency(ev.paid)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* outstanding info banner */}
                                    {selectedEmpId && salaryPaymentSource === 'general' && (() => {
                                        const emp = employees.find(e => e.id === selectedEmpId);
                                        const empTransactions = transactions.filter(t => t.employeeId === selectedEmpId);
                                        const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                        const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                        const balance = accrued - paid;
                                        return (
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs flex justify-between items-center text-left">
                                                <div>
                                                    <div className="font-bold text-slate-800 uppercase tracking-tight">{isKa ? 'სახელფასო დავალიანება' : 'Unpaid Liability'}</div>
                                                    <div className="text-[10px] text-slate-400 font-semibold">{isKa ? 'დაგროვილი ხელფასი მინუს განაღდებული' : 'Total accrued minus disbursements'}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-base font-black ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {formatCurrency(balance)}
                                                    </div>
                                                    {balance > 0 && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setSalaryPayoutAmount(balance)}
                                                            className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase mt-0.5 tracking-tight hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                                                        >
                                                            {isKa ? 'თანხის შევსება' : 'Fill Outstanding'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* auto-calculated amount match suggestion */}
                                    {selectedEmpId && salaryPaymentSource !== 'general' && sumSelectedOutstanding > 0 && (
                                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex justify-between items-center text-xs text-emerald-800 animate-fade-in text-left">
                                            <div>
                                                <div className="font-black uppercase tracking-widest text-[8px] text-emerald-600">
                                                    {isKa ? 'ავტო-დაანგარიშებული ხელფასი' : 'Calculated Payroll from Checked Events'}
                                                </div>
                                                <div className="font-bold text-emerald-950 mt-0.5">
                                                    {isKa ? 'მონიშნული ჯამი: ' : 'Selected sum to pay: '} <span className="font-black">{formatCurrency(sumSelectedOutstanding)}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSalaryPayoutAmount(sumSelectedOutstanding)}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-100 transition-all cursor-pointer"
                                            >
                                                {isKa ? 'მონიშნულის შევსება' : 'Apply Sum'}
                                            </button>
                                        </div>
                                    )}

                                    {/* select payout funding source */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                {isKa ? 'დაფინანსების ანგარიში' : 'Funding Account'}
                                            </label>
                                            <select
                                                value={salaryCreditAccountId}
                                                onChange={(e) => setSalaryCreditAccountId(e.target.value)}
                                                className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            >
                                                {accounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                {isKa ? 'თარიღი' : 'Payment Date'}
                                            </label>
                                            <input
                                                type="date"
                                                value={salaryDate}
                                                onChange={(e) => setSalaryDate(e.target.value)}
                                                className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* payout amount input */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                            {isKa ? 'გასაცემი თანხა' : 'Disbursement / Payroll Amount'}
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="text-slate-400 font-extrabold text-sm">₾</span>
                                            </div>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0.01"
                                                value={salaryPayoutAmount}
                                                onChange={(e) => setSalaryPayoutAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                                className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-black text-slate-800"
                                                placeholder="0.00"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* how much is left to pay by event & sum across all events */}
                                    {selectedEmpId && (
                                        <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-3xl text-xs space-y-2 text-left">
                                            <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                {isKa ? 'აშკარა ნაშთის ანალიტიკა' : 'Post-Payment Ledger Analysis'}
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {salaryPaymentSource === 'general' 
                                                            ? (isKa ? 'დარჩენილი ბალანსი' : 'Remaining Balance')
                                                            : (isKa ? 'მონიშნულიდან დარჩენილი' : 'Checked Events Leftovers')}
                                                    </div>
                                                    <div className="text-xs font-black text-slate-700 mt-0.5">
                                                        {salaryPaymentSource === 'general' ? (
                                                            (() => {
                                                                const empTransactions = transactions.filter(t => t.employeeId === selectedEmpId);
                                                                const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                                                const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                                                const balance = accrued - paid;
                                                                const left = Math.max(0, balance - (Number(salaryPayoutAmount) || 0));
                                                                return (
                                                                    <span className={left > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                                                        {formatCurrency(left)}
                                                                    </span>
                                                                );
                                                            })()
                                                        ) : (
                                                            <span className={sumSelectedOutstanding - (Number(salaryPayoutAmount) || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                                                {formatCurrency(Math.max(0, sumSelectedOutstanding - (Number(salaryPayoutAmount) || 0)))}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {isKa ? 'ჯამში დავალიანება (ყველა)' : 'Sum Across All Basis Events'}
                                                    </div>
                                                    <div className="text-xs font-black text-slate-700 mt-0.5">
                                                        {salaryPaymentSource === 'general' ? (
                                                            (() => {
                                                                const empTransactions = transactions.filter(t => t.employeeId === selectedEmpId);
                                                                const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                                                const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                                                const balance = accrued - paid;
                                                                const left = Math.max(0, balance - (Number(salaryPayoutAmount) || 0));
                                                                return (
                                                                    <span className={left > 0 ? 'text-rose-600' : 'text-emerald-500'}>
                                                                        {formatCurrency(left)}
                                                                    </span>
                                                                );
                                                            })()
                                                        ) : (
                                                            <span className={totalAllOutstandingBasis - (Number(salaryPayoutAmount) || 0) > 0 ? 'text-rose-600' : 'text-emerald-500'}>
                                                                {formatCurrency(Math.max(0, totalAllOutstandingBasis - (Number(salaryPayoutAmount) || 0)))}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {salaryPaymentSource !== 'general' && (Number(salaryPayoutAmount) || 0) > sumSelectedOutstanding && (
                                                <div className="text-[9px] text-amber-600 font-bold bg-amber-50 rounded-lg p-2 border border-amber-100 leading-tight">
                                                    ⚠️ {isKa 
                                                        ? 'გასაცემი თანხა აღემატება მონიშნულ დავალიანებას. ზედმეტი თანხა განაწილდება ნაშთზე.' 
                                                        : 'Warning: Disbursement exceeds outstanding checked events basis. Excess allocation was initialized.'}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="w-full mt-2 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[10px] uppercase font-black tracking-widest shadow-xl shadow-slate-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <BanknotesIcon size={16} />
                                        {isKa ? 'ხელფასის გაცემა / ჩაწერა' : 'Record Salary Payment'}
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* 💸 Operational Expense Form */}
                        <div id="expense-pay-desk" className="bg-white p-6 md:p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
                            <div>
                                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                            {isKa ? 'საოპერაციო ხარჯები' : 'Record Company Expense'}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            {isKa ? 'საოპერაციო, ტექნიკური ან სხვა ხარჯი' : 'Write of OPEX, Rent, Machinery or Materials'}
                                        </p>
                                    </div>
                                    <div className="bg-rose-50 text-rose-700 p-2.5 rounded-2xl">
                                        <ArrowTrendingDownIcon size={22} />
                                    </div>
                                </div>

                                <form onSubmit={handleDisburseExpense} className="space-y-4 pt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* opex category */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                {isKa ? 'კატეგორია' : 'Expense Category'}
                                            </label>
                                            <select
                                                value={expenseCategory}
                                                onChange={(e) => setExpenseCategory(e.target.value)}
                                                className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            >
                                                <option value="OPEX">{isKa ? 'საოპერაციო (OPEX)' : 'General Operating (OPEX)'}</option>
                                                <option value="MACHINERY">{isKa ? 'მანქანა-დანადგარები' : 'Machinery & Tractor Maintenance'}</option>
                                                <option value="MATERIALS">{isKa ? 'სასუქები / მასალები' : 'Seeds & Fertilizers/Chemicals'}</option>
                                                <option value="FUEL">{isKa ? 'საწვავი / ენერგია' : 'Fuel & Propulsion'}</option>
                                                <option value="UTILITIES">{isKa ? 'კომუნალურები' : 'Utilities & Power'}</option>
                                                <option value="RENT">{isKa ? 'იჯარა' : 'Land Lease/Rent'}</option>
                                                <option value="TAXES">{isKa ? 'გადასახადები' : 'Local Property Taxes'}</option>
                                            </select>
                                        </div>

                                        {/* expense payment mode */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                {isKa ? 'გადახდის მეთოდი' : 'Payment Mode'}
                                            </label>
                                            <select
                                                value={expensePaymentMode}
                                                onChange={(e) => setExpensePaymentMode(e.target.value as any)}
                                                className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            >
                                                <option value="Card">{isKa ? 'საბანკო ბარათით' : 'By Card / Bank App'}</option>
                                                <option value="Cash">{isKa ? 'ნაღდი ანგარიშსწორებით' : 'Cash'}</option>
                                                <option value="Purchase Agreement">{isKa ? 'სესხის / შესყიდვის ხელშეკრულება' : 'Purchase Agreement'}</option>
                                                <option value="Contract for IE/Physical Person">{isKa ? 'მომსახურების ხელშეკრულება შპს/ინდ.მენ' : 'IE/Physical Person Contract'}</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* expense description */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                            {isKa ? 'დანიშნულება / აღწერა' : 'Expense Name/Description'}
                                        </label>
                                        <input
                                            type="text"
                                            value={expenseDescription}
                                            onChange={(e) => setExpenseDescription(e.target.value)}
                                            className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800"
                                            placeholder={isKa ? "მაგ. საწვავი ტრაქტორისთვის" : "e.g. Fuel purchase for land leveling"}
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* opex credit line */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                {isKa ? 'გადახდა ანგარიშიდან' : 'Funding Account'}
                                            </label>
                                            <select
                                                value={expenseCreditAccountId}
                                                onChange={(e) => setExpenseCreditAccountId(e.target.value)}
                                                className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            >
                                                {accounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                                                ))}
                                            </select>
                                        </div>
                                        {/* opex ledger date */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                                {isKa ? 'ხარჯვის თარიღი' : 'Expense Date'}
                                            </label>
                                            <input
                                                type="date"
                                                value={expenseDate}
                                                onChange={(e) => setExpenseDate(e.target.value)}
                                                className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* opex amount */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                            {isKa ? 'ხარჯის თანხა' : 'Operational Cost (Amount)'}
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="text-slate-400 font-extrabold text-sm">₾</span>
                                            </div>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0.01"
                                                value={expenseAmount}
                                                onChange={(e) => setExpenseAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                                className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-black text-slate-800"
                                                placeholder="0.00"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full mt-2 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] uppercase font-black tracking-widest shadow-xl shadow-rose-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CurrencyDollarIcon size={16} />
                                        {isKa ? 'ხარჯის ჩაწერა / ჩამოწერა' : 'Disburse & Log Expense'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'harvests_calc' && (
                    <div className="space-y-8 animate-fade-in text-left">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left panel: list with selections & overrides */}
                            <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col h-[650px]">
                                <div className="flex justify-between items-center pb-4 border-b border-rose-50 flex-shrink-0">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                            {isKa ? 'დასრულებული მოსავლების სია' : 'Completed Harvest Registry'}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            {isKa ? 'აირჩიეთ მოსავლები საანგარიშოდ (ნეტო კგ მოდიფიკაცია და ფასი)' : 'Select sessions and optionally edit volumes & sale values to override'}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={handleSelectAllHarvests}
                                        className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all"
                                    >
                                        {selectedHarvestIds.size === calcHarvests.length ? (isKa ? 'ყველას მოხსნა' : 'Uncheck All') : (isKa ? 'ყველას მონიშვნა' : 'Select All')}
                                    </button>
                                </div>

                                <div className="flex-grow overflow-y-auto pt-4 space-y-4 pr-1 scrollbar-hide no-scrollbar">
                                    {calcHarvests.map(h => {
                                        const hYield = h.finalNetYieldKg || h.totalNetWeightKg || 0;
                                        const value = h.saleDetails?.totalValue || 0;
                                        const isSelected = selectedHarvestIds.has(h.id);

                                        // current active values
                                        const activeWeight = harvestManualYields[h.id] !== undefined ? harvestManualYields[h.id] : hYield;
                                        const activeValue = harvestManualTotalValues[h.id] !== undefined ? harvestManualTotalValues[h.id] : value;
                                        const calculatedKgPrice = activeWeight > 0 ? activeValue / activeWeight : 0;

                                        return (
                                            <div 
                                                key={h.id} 
                                                className={`p-4 rounded-3xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                                                    isSelected ? 'bg-blue-50/20 border-blue-200 shadow-sm' : 'bg-slate-50/40 border-slate-100 opacity-75 hover:opacity-100'
                                                }`}
                                            >
                                                {/* Checkbox and title */}
                                                <div className="flex items-center gap-4 min-w-[200px]">
                                                    <input 
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            const next = new Set(selectedHarvestIds);
                                                            if (next.has(h.id)) next.delete(h.id);
                                                            else next.add(h.id);
                                                            setSelectedHarvestIds(next);
                                                        }}
                                                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                    <div className="cursor-pointer" onClick={() => {
                                                        const next = new Set(selectedHarvestIds);
                                                        if (next.has(h.id)) next.delete(h.id);
                                                        else next.add(h.id);
                                                        setSelectedHarvestIds(next);
                                                    }}>
                                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{h.name}</h4>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                            {new Date(h.plannedStartDate).toLocaleDateString()} • {h.sectorIds.length} {isKa ? 'უბანი' : 'sectors'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Parameters inputs for calculations simulation */}
                                                <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto">
                                                    {/* Yield kilograms override */}
                                                    <div className="space-y-0.5 w-24">
                                                        <span className="text-[7px] font-black uppercase text-slate-400 block">{isKa ? 'ნეტო წონა (კგ)' : 'Yield (KG)'}</span>
                                                        <input 
                                                            type="number"
                                                            step="any"
                                                            value={harvestManualYields[h.id] !== undefined ? harvestManualYields[h.id] : ''}
                                                            placeholder={hYield.toFixed(1)}
                                                            onChange={(e) => {
                                                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                                setHarvestManualYields(prev => {
                                                                    const c = { ...prev };
                                                                    if (val === undefined) delete c[h.id];
                                                                    else c[h.id] = val;
                                                                    return c;
                                                                });
                                                            }}
                                                            className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold font-mono outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>

                                                    {/* Sale value override */}
                                                    <div className="space-y-0.5 w-28">
                                                        <span className="text-[7px] font-black uppercase text-slate-400 block">{isKa ? 'რეალიზაციის ფასი (₾)' : 'Sale Value (₾)'}</span>
                                                        <input 
                                                            type="number"
                                                            step="any"
                                                            value={harvestManualTotalValues[h.id] !== undefined ? harvestManualTotalValues[h.id] : ''}
                                                            placeholder={value > 0 ? value.toFixed(1) : (isKa ? 'მიუთითეთ ფასი' : 'No sale registry')}
                                                            onChange={(e) => {
                                                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                                setHarvestManualTotalValues(prev => {
                                                                    const c = { ...prev };
                                                                    if (val === undefined) delete c[h.id];
                                                                    else c[h.id] = val;
                                                                    return c;
                                                                });
                                                            }}
                                                            className="w-full p-2 bg-white border border-slate-200 rounded-xl font-black font-mono outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>

                                                    {/* Price/kg indicator */}
                                                    <div className="text-right pl-2 shrink-0 min-w-[70px]">
                                                        <span className="text-[7px] font-black uppercase text-slate-400 block">{isKa ? 'ფასი კგ-ზე' : 'Price / KG'}</span>
                                                        <span className="text-xs font-extrabold text-blue-600 font-mono">
                                                            {formatCurrency(calculatedKgPrice)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {calcHarvests.length === 0 && (
                                        <div className="py-20 text-center text-slate-300">
                                            <p className="font-black text-xs uppercase tracking-widest">{isKa ? 'დასრულებული მოსავლები არ მოიძებნა' : 'No completed harvests found in history.'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right panel: Aggregated display computation result */}
                            <div className="lg:col-span-1 bg-indigo-950 p-8 rounded-[3rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden h-[650px] group text-left">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-1000"></div>
                                
                                <div>
                                    <div className="flex gap-2 items-center">
                                        <div className="p-2 bg-white/10 rounded-xl text-lg shrink-0">📈</div>
                                        <div>
                                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                                                {isKa ? 'საექსტრაქციო დაფა' : 'Yield & Price Extractor'}
                                            </h4>
                                            <p className="text-xs text-indigo-200 font-semibold mt-1">
                                                {isKa ? 'მორგებული საშუალო ფასის გამოყვანა' : 'Weighted mathematical pricing terminal'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Selected state stats */}
                                    <div className="mt-8 space-y-6">
                                        <div>
                                            <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">{isKa ? 'არჩეული მოსავლები' : 'Selected Sessions'}</span>
                                            <div className="text-3xl font-black mt-1 font-mono tracking-tighter">
                                                {selectedHarvestIds.size} <span className="text-indigo-300 text-xs font-semibold">{isKa ? 'სესია' : 'Sessions'}</span>
                                            </div>
                                        </div>

                                        <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">{isKa ? 'ჯამური მოსავალი' : 'Total Combined Yield'}</span>
                                                <div className="text-lg font-bold mt-1 font-mono">
                                                    {calculatorResult.totalWeight.toLocaleString(undefined, {maximumFractionDigits:1})} <span className="text-[10px] text-indigo-300">KG</span>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">{isKa ? 'ჯამური ღირებულება' : 'Total Market Value'}</span>
                                                <div className="text-lg font-bold mt-1 font-mono text-emerald-300 font-black">
                                                    {formatCurrency(calculatorResult.totalValue)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-white/15 pt-6 flex flex-col justify-center">
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                                                {isKa ? '1 კილოგრამის საშუალო ფასი' : 'WEIGHTED AVERAGE PRICE / 1 KG'}
                                            </span>
                                            <div className="text-4xl md:text-5xl font-black mt-2 text-indigo-100 tracking-tighter font-extrabold font-mono text-emerald-400 flex items-baseline gap-1">
                                                {formatCurrency(calculatorResult.averagePrice)}
                                                <span className="text-stone-300 text-xs font-bold font-sans uppercase tracking-widest">/ kg</span>
                                            </div>
                                            <p className="text-[9px] text-indigo-200 mt-2 font-medium leading-normal">
                                                {isKa 
                                                    ? 'საშუალო ფასი გამოთვლილია არჩეული მოსავლების ჯამური გაყიდვების ღირებულების გაყოფით ჯამურ ნეტო წონაზე:'
                                                    : 'Calculated instantly by dividing aggregate revenue of selected crops by aggregate raw net weight:'
                                                }
                                                <br/>
                                                <span className="font-mono text-white/80 font-black tracking-tight">{formatCurrency(calculatorResult.totalValue)} ÷ {calculatorResult.totalWeight.toLocaleString(undefined, {maximumFractionDigits: 1})} kg</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-white/5 border border-white/5 text-[10px] text-stone-300 rounded-3xl mt-8 leading-relaxed font-semibold">
                                    💡 {isKa 
                                        ? 'ეს ინსტრუმენტი გაძლევთ საშუალებას მონიშნოთ ნებისმიერი მოსავლები, ჩაუწეროთ მას გაყიდვების ფასები რეალურ დროში და წამიერად გაიგოთ საშუალო კილოგრამის ფასი!'
                                        : 'This helper extracts weight & proceeds directly from your direct sales database. Click checkbox next to crops above to run live average extraction!'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'wallets' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {wallets.map(wallet => (
                                <WalletDiary key={wallet.id} wallet={wallet} transactions={transactions} onSetTransactions={onSetTransactions} accounts={accounts} formatCurrency={formatCurrency} />
                            ))}
                        </div>
                        {wallets.length === 0 && (
                            <div className="py-20 text-center text-slate-300 border-2 border-dashed border-slate-200 rounded-[3rem]">
                                <AlertTriangleIcon size={48} className="mx-auto opacity-20 mb-4" />
                                <p className="font-black uppercase text-xs tracking-widest">No manager wallets configured.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'payroll' && (
                    <div className="space-y-6 animate-fade-in text-left">
                         <div className="flex flex-col md:flex-row md:justify-between md:items-center px-2 gap-4">
                             <div>
                                 <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Payroll Forensic</h2>
                                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                     {payrollSubTab === 'employees' 
                                         ? (isKa ? 'შრომის ანაზღაურება პერსონალის მიხედვით' : 'Track and settle outstanding balances by employee') 
                                         : (isKa ? 'კაჰორტის ხელფასები მოსავლის კრეფების მიხედვით' : 'Track and settle worker payouts per harvest event')}
                                 </p>
                             </div>
                             <div className="flex flex-wrap gap-2">
                                 <button onClick={handleCommitAccruals} className="px-5 py-3 bg-indigo-50 hover:bg-slate-100 text-indigo-700 border border-indigo-100 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2">
                                     <PlusIcon size={14}/> Commit Monthly Accruals
                                 </button>
                             </div>
                        </div>

                        {/* Sub Tab Navigation */}
                        <div className="flex gap-2 border-b border-slate-100 pb-2 px-2">
                            <button 
                                onClick={() => setPayrollSubTab('employees')}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${payrollSubTab === 'employees' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                {isKa ? 'თანამშრომლებით' : 'By Employee / HR'}
                            </button>
                            <button 
                                onClick={() => setPayrollSubTab('events')}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${payrollSubTab === 'events' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                {isKa ? 'კრეფების მიხედვით' : 'By Harvest Event / კრეფები'}
                            </button>
                        </div>

                        {selectedPayrollEmpIds.size > 0 && payrollSubTab === 'employees' && (
                            <div className="bg-indigo-50/60 border border-indigo-100 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in text-left">
                                <div>
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Bulk Payment Queue</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        Selected: <span className="text-indigo-600 font-black">{selectedPayrollEmpIds.size} employees</span> • Total to disburse: <span className="text-emerald-600 font-black">{formatCurrency(selectedEmployeesTotalBalance)}</span>
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setSelectedPayrollEmpIds(new Set())}
                                        className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                                    >
                                        Deselect All
                                    </button>
                                    <button 
                                        onClick={() => setIsBulkPayModalOpen(true)}
                                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <BanknotesIcon size={14}/> Pay Selected Together
                                    </button>
                                </div>
                            </div>
                        )}

                        {payrollSubTab === 'employees' ? (
                            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
                                <table className="min-w-full text-left">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                                        <tr>
                                            <th className="px-6 py-5 w-12 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectableEmployees.length > 0 && selectedPayrollEmpIds.size === selectableEmployees.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedPayrollEmpIds(new Set(selectableEmployees.map(emp => emp.id)));
                                                        } else {
                                                            setSelectedPayrollEmpIds(new Set());
                                                        }
                                                    }}
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                            </th>
                                            <th className="px-8 py-5">Employee / Status</th>
                                            <th className="px-8 py-5">Role / Model</th>
                                            <th className="px-8 py-5 text-right">Ledger Balance</th>
                                            <th className="px-8 py-5 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {employees.map(emp => {
                                            const empTransactions = transactions.filter(t => t.employeeId === emp.id);
                                            const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                            const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                                            const balance = accrued - paid;
                                            const isSelected = selectedPayrollEmpIds.has(emp.id);
                                            return (
                                                <tr key={emp.id} className={`hover:bg-slate-50/50 ${isSelected ? 'bg-indigo-50/10' : ''}`}>
                                                    <td className="px-6 py-6 w-12 text-center whitespace-nowrap">
                                                        {balance > 0 && (
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isSelected}
                                                                onChange={() => {
                                                                    const next = new Set(selectedPayrollEmpIds);
                                                                    if (next.has(emp.id)) next.delete(emp.id);
                                                                    else next.add(emp.id);
                                                                    setSelectedPayrollEmpIds(next);
                                                                }}
                                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-6 whitespace-nowrap">
                                                        <div className="font-black text-slate-800 uppercase tracking-tight cursor-pointer" onClick={() => {
                                                            if (balance > 0) {
                                                                const next = new Set(selectedPayrollEmpIds);
                                                                if (next.has(emp.id)) next.delete(emp.id);
                                                                else next.add(emp.id);
                                                                setSelectedPayrollEmpIds(next);
                                                            }
                                                        }}>
                                                            {emp.name}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 uppercase font-bold text-[10px] text-slate-400">{emp.paymentType.replace('_', ' ')}</td>
                                                    <td className={`px-8 py-6 text-right font-black ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balance)}</td>
                                                    <td className="px-8 py-6 text-right whitespace-nowrap">
                                                        {balance > 0 && (
                                                            <button 
                                                                onClick={() => { 
                                                                    setPrefilledTxn({ 
                                                                        id: '', 
                                                                        date: new Date().toISOString(), 
                                                                        description: `Salary: ${emp.name}`, 
                                                                        debitAccountId: 'acc-payroll', 
                                                                        creditAccountId: 'acc-bank', 
                                                                        amount: balance, 
                                                                        transactionType: 'Outgoing Payment', 
                                                                        employeeId: emp.id, 
                                                                        category: 'PAYROLL',
                                                                        paidBy: '',
                                                                        paymentMode: 'Cash'
                                                                    }); 
                                                                    setIsTransactionModalOpen(true); 
                                                                }} 
                                                                className="px-4 py-2 bg-green-50 text-green-700 rounded-xl font-black text-[10px] uppercase hover:bg-green-600 hover:text-white transition-all"
                                                            >
                                                                Settle
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-fade-in space-y-4">
                                <table className="min-w-full text-left">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                                        <tr>
                                            <th className="px-8 py-5">Event Name</th>
                                            <th className="px-8 py-5">Date</th>
                                            <th className="px-8 py-5 text-right">Earning (Due)</th>
                                            <th className="px-8 py-5 text-right">Paid Salary</th>
                                            <th className="px-8 py-5 text-right">Left Balance</th>
                                            <th className="px-8 py-5 text-center">Breakdown</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {harvestPayrollList.map(ev => {
                                            const isExpanded = expandedEventId === ev.id;
                                            return (
                                                <React.Fragment key={ev.id}>
                                                    <tr className="hover:bg-slate-50/50">
                                                        <td className="px-8 py-6 whitespace-nowrap">
                                                            <div className="font-black text-slate-800 uppercase tracking-tight">
                                                                {ev.name}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6 text-xs text-slate-400 font-bold whitespace-nowrap">
                                                            {ev.date ? ev.date.split('T')[0] : 'N/A'}
                                                        </td>
                                                        <td className="px-8 py-6 text-right font-black text-slate-700">
                                                            {formatCurrency(ev.totalEarned)}
                                                        </td>
                                                        <td className="px-8 py-6 text-right font-black text-emerald-600">
                                                            {formatCurrency(ev.totalPaid)}
                                                        </td>
                                                        <td className={`px-8 py-6 text-right font-black ${ev.totalLeft > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {formatCurrency(ev.totalLeft)}
                                                        </td>
                                                        <td className="px-8 py-6 text-center whitespace-nowrap">
                                                            <button 
                                                                onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all"
                                                            >
                                                                {isExpanded ? (isKa ? 'დახურვა' : 'Hide') : (isKa ? 'დეტალურად' : 'View Details')}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-slate-50/50">
                                                            <td colSpan={6} className="px-8 py-8 border-l-4 border-indigo-500">
                                                                <div className="space-y-4">
                                                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                                                        {isKa ? 'კრეფის ხელფასის დეტალიზაცია' : 'Worker Cost & Payment Ledger Alignment'}
                                                                    </h4>
                                                                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                                                                        <table className="min-w-full text-left">
                                                                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                                                                                <tr>
                                                                                    <th className="px-6 py-4">Worker</th>
                                                                                    <th className="px-6 py-4 text-right">Earning</th>
                                                                                    <th className="px-6 py-4 text-right">Paid</th>
                                                                                    <th className="px-6 py-4 text-right">Left</th>
                                                                                    <th className="px-6 py-4">Audit Trace (How Paid & By Whom!)</th>
                                                                                    <th className="px-6 py-4 text-right">Actions</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 text-xs">
                                                                                {ev.pickersDetail.map((p, pIdx) => (
                                                                                    <tr key={`${p.employeeId || 'picker'}-${pIdx}`} className="hover:bg-slate-50/40">
                                                                                        <td className="px-6 py-4 font-black text-slate-800 uppercase">{p.employeeName}</td>
                                                                                        <td className="px-6 py-4 text-right font-black text-slate-600">{formatCurrency(p.earned)}</td>
                                                                                        <td className="px-6 py-4 text-right font-black text-emerald-600">{formatCurrency(p.paid)}</td>
                                                                                        <td className={`px-6 py-4 text-right font-black ${p.left > 0 ? 'text-rose-600' : 'text-green-600'}`}>{formatCurrency(p.left)}</td>
                                                                                        <td className="px-6 py-4 font-bold text-slate-500 max-w-sm">
                                                                                            <div className="space-y-1">
                                                                                                {p.paymentTxns.map((ptx, i) => (
                                                                                                    <div key={i} className="text-[10px] bg-slate-50 border border-slate-200/55 p-2 rounded-xl text-slate-600 shadow-sm leading-tight">
                                                                                                        Paid <strong className="text-indigo-600">{formatCurrency(ptx.amount)}</strong> via <strong className="uppercase text-slate-800">{ptx.paymentMode || 'Cash'}</strong> on {ptx.date.split('T')[0]} ({ptx.paidBy ? `By: ${ptx.paidBy}` : 'System Authorized'})
                                                                                                    </div>
                                                                                                ))}
                                                                                                {p.paymentTxns.length === 0 && (
                                                                                                    <div className="text-[10px] text-slate-400 italic">No payments detected for this employee.</div>
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                                                                            {p.left > 0 ? (
                                                                                                <button 
                                                                                                    onClick={() => {
                                                                                                        setPrefilledTxn({
                                                                                                            id: '',
                                                                                                            date: new Date().toISOString(),
                                                                                                            description: `Event pay: ${p.employeeName} - ${ev.name}`,
                                                                                                            debitAccountId: 'acc-payroll',
                                                                                                            creditAccountId: 'acc-bank',
                                                                                                            amount: p.left,
                                                                                                            transactionType: 'Outgoing Payment',
                                                                                                            employeeId: p.employeeId,
                                                                                                            referenceId: ev.id,
                                                                                                            category: 'PAYROLL',
                                                                                                            paidBy: '',
                                                                                                            paymentMode: 'Cash'
                                                                                                        });
                                                                                                        setIsTransactionModalOpen(true);
                                                                                                    }}
                                                                                                    className="px-3 py-1.5 bg-green-50 hover:bg-green-600 text-green-700 hover:text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-all"
                                                                                                >
                                                                                                    Settle Item
                                                                                                </button>
                                                                                            ) : (
                                                                                                <span className="px-2.5 py-1 bg-green-100/60 text-green-800 text-[9px] font-black uppercase tracking-widest rounded-md">Paid All</span>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'ledger' && (
                    <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4">
                            <div><h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Financial Audit Trail</h2></div>
                            <div className="relative"><SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input type="text" placeholder="Search ledger..." className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 w-full md:w-80" onChange={(e) => setSearchTerm(e.target.value)} /></div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="px-8 py-5">Source / Entity</th>
                                        <th className="px-8 py-5">Date</th>
                                        <th className="px-8 py-5 text-right">Debit</th>
                                        <th className="px-8 py-5 text-right">Credit</th>
                                        <th className="px-8 py-5 text-right">Method</th>
                                        <th className="px-8 py-5 text-right">Paid By</th>
                                        <th className="px-8 py-5 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-xs text-left">
                                    {transactions
                                        .filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(tx => (
                                            <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-8 py-5"><div className="font-black text-slate-800 uppercase tracking-tight">{tx.description}</div><div className="text-[10px] text-slate-400 font-bold uppercase">{tx.transactionType}</div></td>
                                                <td className="px-8 py-5 font-bold text-slate-500">{new Date(tx.date).toLocaleDateString()}</td>
                                                <td className="px-8 py-5 text-right font-bold text-indigo-600">{accounts.find(a => a.id === tx.debitAccountId)?.name}</td>
                                                <td className="px-8 py-5 text-right font-bold text-orange-600">{accounts.find(a => a.id === tx.creditAccountId)?.name}</td>
                                                <td className="px-8 py-5 text-right font-bold text-slate-500">{tx.paymentMode || 'N/A'}</td>
                                                <td className="px-8 py-5 text-right font-bold text-slate-500">{tx.paidBy || 'System'}</td>
                                                <td className="px-8 py-5 text-right font-black text-slate-900">{formatCurrency(tx.amount)}</td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {isTransactionModalOpen && (
                <TransactionModal isOpen={isTransactionModalOpen} onClose={() => setIsTransactionModalOpen(false)} onSave={(tx) => { onSetTransactions([tx]); setIsTransactionModalOpen(false); }} transaction={prefilledTxn} accounts={accounts} purchaseOrders={purchaseOrders} suppliers={suppliers} />
            )}

            {isBulkPayModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 max-w-lg w-full text-left shadow-2xl relative animate-fade-in">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <BanknotesIcon size={24} className="text-indigo-600"/> Batch Payroll Settlement
                            </h3>
                            <button onClick={() => setIsBulkPayModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XIcon size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleBulkPaySubmit} className="space-y-6 pt-6">
                            <div className="space-y-1 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Execution Scope</span>
                                <div className="text-sm font-bold text-slate-800">
                                    Paying <span className="text-indigo-600 font-extrabold">{selectedPayrollEmpIds.size} workers</span> in total sum of <span className="text-emerald-600 font-extrabold">{formatCurrency(selectedEmployeesTotalBalance)}</span>.
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Payout Date</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={bulkPayDate}
                                        onChange={(e) => setBulkPayDate(e.target.value)}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Credit Account / Cash Source</label>
                                    <select 
                                        value={bulkCreditAccountId}
                                        onChange={(e) => setBulkCreditAccountId(e.target.value)}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    >
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type}) - {formatCurrency(a.balance)}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Payment Mode</label>
                                        <select 
                                            value={bulkPayMode}
                                            onChange={(e) => setBulkPayMode(e.target.value as PaymentMode)}
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="By Card">By Bank Card / Transfer</option>
                                            <option value="Purchase Agreement">Purchase Agreement</option>
                                            <option value="Contract for IE/Physical Person">Contract for IE/Physical Person</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Authorized Paid By</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="e.g. Giorgi (Manager)"
                                            value={bulkPaidBy}
                                            onChange={(e) => setBulkPaidBy(e.target.value)}
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-slate-100">
                                <button 
                                    type="button" 
                                    onClick={() => setIsBulkPayModalOpen(false)}
                                    className="flex-1 py-4 border border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all text-center"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all text-center active:scale-95"
                                >
                                    Execute Disbursals
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
};

const WalletDiary: React.FC<{ wallet: Account, transactions: Transaction[], onSetTransactions: (txns: Transaction[]) => void, accounts: Account[], formatCurrency: (amount: number) => string }> = ({ wallet, transactions, onSetTransactions, accounts, formatCurrency }) => {
    const [isLogging, setIsLogging] = useState(false);
    const [logForm, setLogForm] = useState<{ date: string, name: string, price: number, qty: number, type: 'Purchase' | 'Service', payment: PaymentMode, receipt?: string }>({
        date: new Date().toISOString().split('T')[0], name: '', price: 0, qty: 1, type: 'Purchase', payment: 'Cash'
    });

    const diaryEntries = useMemo(() => transactions.filter(t => t.creditAccountId === wallet.id || t.debitAccountId === wallet.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [transactions, wallet.id]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (logForm.payment === 'Cash' && !logForm.receipt) return alert("Receipt photo is mandatory for Cash payments!");
        
        const total = logForm.price * logForm.qty;
        const newTx: Transaction = {
            id: `exp-${Date.now()}`,
            date: new Date(logForm.date).toISOString(),
            description: `${logForm.type}: ${logForm.name} (Qty: ${logForm.qty}) via ${logForm.payment}`,
            amount: total,
            debitAccountId: 'acc-op-expense',
            creditAccountId: wallet.id,
            transactionType: 'Outgoing Payment',
            paymentMode: logForm.payment,
            documentUrl: logForm.receipt,
            category: 'OPEX'
        };
        onSetTransactions([newTx]);
        setIsLogging(false);
        setLogForm({ date: new Date().toISOString().split('T')[0], name: '', price: 0, qty: 1, type: 'Purchase', payment: 'Cash' });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setLogForm(p => ({ ...p, receipt: ev.target?.result as string }));
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[600px]">
            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{wallet.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personal Petty Cash Diary</p>
                </div>
                <div className="text-right">
                    <div className={`text-2xl font-black ${wallet.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(wallet.balance)}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Available Funds</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {isLogging ? (
                    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Date</label><input type="date" value={logForm.date} onChange={e => setLogForm({...logForm, date: e.target.value})} className="input-field" required /></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Type</label><select value={logForm.type} onChange={e => setLogForm({...logForm, type: e.target.value as any})} className="input-field"><option>Purchase</option><option>Service</option></select></div>
                        </div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Item/Service Name</label><input value={logForm.name} onChange={e => setLogForm({...logForm, name: e.target.value})} placeholder="e.g. Car Repair" className="input-field" required /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Unit Price</label><input type="number" step="0.01" value={logForm.price} onChange={e => setLogForm({...logForm, price: parseFloat(e.target.value)})} className="input-field" required /></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Quantity</label><input type="number" value={logForm.qty} onChange={e => setLogForm({...logForm, qty: parseInt(e.target.value)})} className="input-field" required /></div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Payment Method</label>
                            <select value={logForm.payment} onChange={e => setLogForm({...logForm, payment: e.target.value as any})} className="input-field">
                                <option>Cash</option>
                                <option>By Card</option>
                                <option>Purchase Agreement</option>
                                <option>Contract for IE/Physical Person</option>
                            </select>
                        </div>
                        <div className="p-6 border-2 border-dashed border-slate-200 rounded-[2rem] text-center relative hover:bg-slate-50 transition-colors">
                            <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            {logForm.receipt ? <img src={logForm.receipt} className="h-32 mx-auto rounded-xl object-contain" /> : (
                                <div className="space-y-1">
                                    <PhotoIcon className="h-8 w-8 mx-auto text-slate-300" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Attach Receipt Image</p>
                                    {logForm.payment === 'Cash' && <p className="text-[9px] text-red-500 font-bold">* Mandatory for cash</p>}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => setIsLogging(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cancel</button>
                            <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">Record Expense</button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        {diaryEntries.map(entry => (
                            <div key={entry.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 group flex justify-between items-center transition-all hover:bg-white hover:shadow-md">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${entry.transactionType === 'Outgoing Payment' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                        {entry.transactionType === 'Outgoing Payment' ? <ArrowTrendingDownIcon size={18}/> : <ArrowTrendingUpIcon size={18}/>}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate max-w-[200px]">{entry.description}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(entry.date).toLocaleDateString()} • {entry.paymentMode || 'System'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-sm font-black ${entry.transactionType === 'Outgoing Payment' ? 'text-red-600' : 'text-green-600'}`}>
                                        {entry.transactionType === 'Outgoing Payment' ? '- ' : '+ '}{formatCurrency(entry.amount)}
                                    </div>
                                    {entry.documentUrl && <button onClick={() => window.open(entry.documentUrl, '_blank')} className="text-[9px] font-black text-blue-600 uppercase hover:underline">View Receipt</button>}
                                </div>
                            </div>
                        ))}
                        {diaryEntries.length === 0 && <p className="text-center text-slate-400 text-[10px] font-black uppercase tracking-widest py-10">No records in this diary.</p>}
                    </div>
                )}
            </div>

            {!isLogging && (
                <div className="p-8 border-t bg-gray-50 flex gap-4">
                     <button onClick={() => {
                         const debt = wallet.balance < 0 ? Math.abs(wallet.balance) : 0;
                         onSetTransactions([{ id: `reim-${Date.now()}`, date: new Date().toISOString(), description: `Top-up: ${wallet.name}`, debitAccountId: wallet.id, creditAccountId: 'acc-bank', amount: debt || 100, transactionType: 'Bank Transfer', category: 'REIMBURSEMENT' }]);
                     }} className="flex-1 py-4 border-2 border-slate-200 text-slate-600 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                        <ArrowPathIcon size={16}/> Top Up
                    </button>
                    <button onClick={() => setIsLogging(true)} className="flex-[2] py-4 bg-blue-600 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <PlusIcon size={16}/> Log Entry
                    </button>
                </div>
            )}
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }`}</style>
        </div>
    );
};

export default AccountingView;
