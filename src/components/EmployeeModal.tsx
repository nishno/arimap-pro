
import React, { useState } from 'react';
import type { Employee, Role, EmployeeType, AccountType, PaymentType, Organization } from '../types';
import { EMPLOYEE_TYPES, ACCOUNT_TYPES, PAYMENT_TYPES } from '../types';
import { XCircleIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface EmployeeModalProps {
    employee: Employee | null;
    allEmployees: Employee[];
    onSave: (emp: Employee) => void;
    onClose: () => void;
    roles: Role[];
    organizations?: Organization[];
    activeOrgId?: string | null;
}

const Modal: React.FC<{ children: React.ReactNode; title: string; onClose: () => void; }> = ({ children, title, onClose }) => (
    <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

const EmployeeModal: React.FC<EmployeeModalProps> = ({ employee, allEmployees, onSave, onClose, roles, organizations, activeOrgId }) => {
    const { t } = useLanguage();
    const [formState, setFormState] = useState<Omit<Employee, 'id'>>({
        name: employee?.name || '',
        idNumber: employee?.idNumber || '',
        barcode: employee?.barcode || '',
        employeeType: employee?.employeeType || 'Permanent',
        email: employee?.email || '',
        phone: employee?.phone || '',
        roleId: employee?.roleId || roles.find(r => r.name === 'Field Worker')?.id || '',
        paymentType: employee?.paymentType || 'hourly',
        paymentRate: employee?.paymentRate || 0,
        accountType: employee?.accountType || 'Bank Account',
        notes: employee?.notes || '',
        visibleModules: employee?.visibleModules || [],
        password: employee?.password || '',
        status: employee?.status || 'active',
        joinedAt: employee?.joinedAt || new Date().toISOString(),
        isGlobalUser: false,
        organizationId: employee?.organizationId || (activeOrgId !== 'ALL' ? activeOrgId : (organizations?.[0]?.id || null)) as any,
        age: employee?.age,
        sex: employee?.sex || '',
        isGeorgianCitizen: employee?.isGeorgianCitizen || false
    });
    const [error, setError] = useState<string | null>(null);
    const [addManualNumber, setAddManualNumber] = useState(false);

    // Provide the next available number when "add manual number" is checked
    React.useEffect(() => {
        if (!employee && addManualNumber && !formState.barcode) {
            let nextNum = 1;
            const existingNumbers = allEmployees
                .map(e => parseInt(e.barcode || '', 10))
                .filter(n => !isNaN(n));
            
            while (existingNumbers.includes(nextNum)) {
                nextNum++;
            }
            setFormState(prev => ({ ...prev, barcode: nextNum.toString() }));
        }
    }, [addManualNumber, employee, allEmployees]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormState(prev => ({ 
            ...prev, 
            [name]: type === 'number' ? (value === '' ? '' : value.replace(',', '.')) : value 
        }));
    };

    const toggleModule = (module: string) => {
        setFormState(prev => {
            const current = prev.visibleModules || [];
            const newModules = current.includes(module) ? current.filter(m => m !== module) : [...current, module];
            return { ...prev, visibleModules: newModules };
        });
    };

    const getRateLabel = (paymentType: PaymentType) => {
        switch(paymentType) {
            case 'hourly': return 'Rate ($/hr)';
            case 'daily': return 'Rate ($/day)';
            case 'per_weight': return 'Rate ($/kg)';
            case 'combined': return 'Base Rate + Per-KG Rate ($)';
            case 'salary': return 'Monthly Salary ($)';
            case 'by_person': return 'Foreman Rate ($/person brought)';
            case 'by_car': return 'Foreman Rate ($/vehicle brought)';
            case 'fixed': return 'Fixed Event Rate ($)';
            case 'custom': return 'Custom Rate ($)';
            default: return 'Rate';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation for duplicate ID number
        const isDuplicateId = allEmployees.some(
            emp => emp.idNumber === formState.idNumber && emp.id !== employee?.id
        );
        if (isDuplicateId) {
            setError('An employee with this ID number already exists.');
            return;
        }

        // Validation for duplicate Barcode/Unique Number
        if (addManualNumber && formState.barcode.trim()) {
            const isDuplicateBarcode = allEmployees.some(
                emp => emp.barcode === formState.barcode.trim() && emp.id !== employee?.id
            );
            if (isDuplicateBarcode) {
                setError(`The unique number ${formState.barcode} is already assigned to someone else. Choose another number.`);
                return;
            }
        }

        onSave({
            id: employee?.id || '', // ID will be generated/kept by parent
            ...formState,
            paymentRate: (formState.paymentRate as any) === '' ? 0 : Number(formState.paymentRate) || 0
        });
    };

    const modules = ['Planning', 'Harvest', 'Admin', 'Store'];

    return (
        <Modal title={employee ? t('emp.edit') : t('emp.add')} onClose={onClose}>
            <form onSubmit={handleSubmit}>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm max-h-[70vh] overflow-y-auto">
                    {error && <div className="md:col-span-3 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">{error}</div>}

                    <h4 className="md:col-span-3 font-semibold text-gray-500 text-xs uppercase tracking-wider border-b pb-1">{t('emp.personal_info')}</h4>
                    <div className="md:col-span-2"><label>{t('emp.full_name')}</label><input name="name" value={formState.name} onChange={handleChange} className="input-field" placeholder="Full Name" required /></div>
                    <div><label>{t('emp.id_number')}</label><input name="idNumber" value={formState.idNumber} onChange={handleChange} className="input-field" required /></div>
                    <div><label>Email</label><input name="email" type="email" value={formState.email} onChange={handleChange} className="input-field" placeholder="user@example.com"/></div>
                    <div><label>{t('emp.phone')}</label><input name="phone" type="tel" value={formState.phone} onChange={handleChange} className="input-field" /></div>
                    
                    <div>
                        <label>Age</label>
                        <input 
                            name="age" 
                            type="number" 
                            value={formState.age ?? ''} 
                            onChange={(e) => setFormState(prev => ({ ...prev, age: e.target.value === '' ? undefined : parseInt(e.target.value, 10) }))} 
                            min="0" 
                            max="120" 
                            className="input-field" 
                            placeholder="Enter age (Optional)" 
                        />
                    </div>
                    <div>
                        <label>Sex</label>
                        <select 
                            name="sex" 
                            value={formState.sex || ''} 
                            onChange={handleChange} 
                            className="input-field"
                        >
                            <option value="">Select Sex (Optional)</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                        <input 
                            type="checkbox" 
                            id="isGeorgianCitizen"
                            name="isGeorgianCitizen" 
                            checked={formState.isGeorgianCitizen || false} 
                            onChange={(e) => setFormState(prev => ({ ...prev, isGeorgianCitizen: e.target.checked }))}
                            className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer shadow-sm"
                        />
                        <label htmlFor="isGeorgianCitizen" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                            Citizen of Georgia?
                        </label>
                    </div>
                    
                    {activeOrgId === 'ALL' && organizations && (
                        <div>
                            <label>Organization</label>
                            <select 
                                name="organizationId" 
                                value={formState.organizationId || ''} 
                                onChange={handleChange} 
                                className="input-field"
                                required
                            >
                                <option value="" disabled>Select Organization</option>
                                {organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {!employee && (
                        <>
                            <div><label>Initial Password</label><input name="password" type="password" value={formState.password} onChange={handleChange} className="input-field" placeholder="Default: Welcome123" /></div>
                            <div className="flex items-center gap-2 mt-6">
                                <input 
                                    type="checkbox" 
                                    id="isGlobalUser"
                                    name="isGlobalUser" 
                                    checked={formState.isGlobalUser} 
                                    onChange={(e) => setFormState(prev => ({ ...prev, isGlobalUser: e.target.checked }))}
                                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="isGlobalUser" className="text-sm font-black text-slate-700 cursor-pointer">
                                    Create Global User Account
                                </label>
                            </div>
                        </>
                    )}

                    <div className="md:col-span-3 border p-4 rounded bg-gray-50 flex flex-col gap-2">
                        <div className="flex items-center gap-2 block">
                            <input 
                                type="checkbox" 
                                id="addManualNumber"
                                checked={addManualNumber} 
                                onChange={(e) => setAddManualNumber(e.target.checked)}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <label htmlFor="addManualNumber" className="text-sm font-black text-slate-700 cursor-pointer">
                                Add Manual Number (In addition to QR)
                            </label>
                        </div>
                        {addManualNumber && (
                            <div>
                                <label className="text-xs">Unique Number / Barcode</label>
                                <input 
                                    name="barcode" 
                                    value={formState.barcode} 
                                    onChange={handleChange} 
                                    className="input-field" 
                                    placeholder="Enter unique manual number" 
                                />
                            </div>
                        )}
                    </div>

                    <h4 className="md:col-span-3 font-semibold text-gray-500 text-xs uppercase tracking-wider border-b pb-1 mt-4">{t('emp.employment_details')}</h4>
                    <div>
                        <label>{t('emp.role')}</label>
                        <select name="roleId" value={formState.roleId} onChange={handleChange} className="input-field" required>
                            <option value="" disabled>Select a role</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>{t('emp.type')}</label>
                        <select name="employeeType" value={formState.employeeType} onChange={(e) => setFormState(prev => ({...prev, employeeType: e.target.value as EmployeeType}))} className="input-field">
                            {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    
                    <div className="md:col-span-3">
                        <label className="block mb-2 text-gray-700 font-medium">{t('emp.visible_modules')}</label>
                        <div className="flex gap-4">
                            {modules.map(mod => (
                                <label key={mod} className="flex items-center gap-2 cursor-pointer bg-gray-50 p-2 rounded border hover:bg-gray-100">
                                    <input 
                                        type="checkbox" 
                                        checked={formState.visibleModules?.includes(mod)} 
                                        onChange={() => toggleModule(mod)} 
                                        className="rounded text-green-600 focus:ring-green-500"
                                    />
                                    <span>{mod}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">If none selected, employee appears everywhere.</p>
                    </div>

                    <h4 className="md:col-span-3 font-semibold text-gray-500 text-xs uppercase tracking-wider border-b pb-1 mt-4">{t('emp.financial')}</h4>
                    <div>
                        <label>{t('emp.salary_type')}</label>
                        <select name="paymentType" value={formState.paymentType} onChange={(e) => setFormState(prev => ({...prev, paymentType: e.target.value as PaymentType}))} className="input-field">
                            {PAYMENT_TYPES.map(pt => (
                                <option key={pt} value={pt} className="capitalize">
                                    {pt === 'by_person' ? 'By Person (Foreman)' : pt === 'by_car' ? 'By Car (Foreman)' : pt === 'per_weight' ? 'Per Weight' : pt.replace('_', ' ')}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>{getRateLabel(formState.paymentType)}</label>
                        <input name="paymentRate" type="number" step="0.01" min="0" value={formState.paymentRate} onChange={handleChange} className="input-field" required />
                    </div>
                    <div>
                        <label>{t('emp.account_type')}</label>
                        <select name="accountType" value={formState.accountType} onChange={(e) => setFormState(prev => ({...prev, accountType: e.target.value as AccountType}))} className="input-field">
                            {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    
                    <div className="md:col-span-3 mt-4">
                        <label>{t('common.notes')}</label>
                        <textarea name="notes" value={formState.notes} onChange={handleChange} className="input-field" rows={3}/>
                    </div>

                    <h4 className="md:col-span-3 font-semibold text-gray-500 text-xs uppercase tracking-wider border-b pb-1 mt-4">Hardware Credentials</h4>
                    <div className="md:col-span-2">
                        <label>Hardware Card/Tag Type</label>
                        <select 
                            name="hardwareType" 
                            value={formState.hardwareCredentials?.type || ''} 
                            onChange={(e) => setFormState(prev => ({
                                ...prev,
                                hardwareCredentials: {
                                    type: e.target.value as any,
                                    serialNumber: prev.hardwareCredentials?.serialNumber || ''
                                }
                            }))} 
                            className="input-field"
                        >
                            <option value="">None</option>
                            <option value="NFC Card">NFC Card</option>
                            <option value="NFC Bracelet">NFC Bracelet</option>
                            <option value="RFID Tag">RFID Tag</option>
                        </select>
                    </div>
                    <div>
                        <label>Hardware Serial Number</label>
                        <input 
                            name="hardwareSerial" 
                            value={formState.hardwareCredentials?.serialNumber || ''} 
                            onChange={(e) => setFormState(prev => ({
                                ...prev,
                                hardwareCredentials: {
                                    type: prev.hardwareCredentials?.type || 'NFC Card',
                                    serialNumber: e.target.value
                                }
                            }))} 
                            className="input-field" 
                            placeholder="Scan or Enter SN"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label>Employee Code (Override)</label>
                        <input 
                            name="employeeCodeOverride" 
                            value={formState.employeeCodeOverride || ''} 
                            onChange={handleChange} 
                            className="input-field" 
                            placeholder="Manual override"
                        />
                    </div>
                </div>
                <div className="p-3 bg-gray-50 flex justify-end gap-2 border-t">
                    <button type="button" onClick={onClose} className="button-secondary">{t('common.cancel')}</button>
                    <button type="submit" className="button-primary">{t('common.save')}</button>
                </div>
            </form>
             <style>{`
                .input-field { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; margin-top: 0.25rem; background-color: white; }
                .button-primary { padding: 0.5rem 1rem; background-color: #16a34a; color: white; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; }
                .button-primary:hover { background-color: #15803d; }
                .button-secondary { padding: 0.5rem 1rem; background-color: #e5e7eb; color: #1f2937; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; }
                .button-secondary:hover { background-color: #d1d5db; }
             `}</style>
        </Modal>
    );
};

export default EmployeeModal;
