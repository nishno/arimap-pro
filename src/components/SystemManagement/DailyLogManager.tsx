import React, { useState } from 'react';
import { CalendarDaysIcon } from '../Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { Employee, DailyLogEntry, Permission } from '../../types';

interface DailyLogManagerProps {
    employees: Employee[];
    dailyLogs: DailyLogEntry[];
    onSetDailyLogs: (logs: DailyLogEntry[]) => void;
    currentUserPermissions: Set<Permission>;
}

const DailyLogManager: React.FC<DailyLogManagerProps> = ({ employees, dailyLogs, onSetDailyLogs, currentUserPermissions }) => {
    const { t } = useLanguage();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    const handleLog = (employeeId: string, type: DailyLogEntry['logType']) => {
        const existing = dailyLogs.find(l => l.employeeId === employeeId && l.date.startsWith(date));
        if (existing && existing.logType === type) {
            return;
        }
        const newLog: DailyLogEntry = {
            id: existing ? existing.id : `dl-${employeeId}-${date}`,
            employeeId,
            date,
            logType: type
        };
        const filtered = dailyLogs.filter(l => !(l.employeeId === employeeId && l.date.startsWith(date)));
        onSetDailyLogs([...filtered, newLog]);
    };

    const getStatus = (empId: string) => {
        const log = dailyLogs.find(l => l.employeeId === empId && l.date.startsWith(date));
        return log?.logType;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                        <CalendarDaysIcon className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black italic text-slate-800 tracking-tight uppercase">Daily</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Personnel Attendance and Status</p>
                    </div>
                </div>
                <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    className="bg-slate-50 p-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none border border-slate-100" 
                />
            </div>

            <div className="space-y-2">
                {employees.map(emp => {
                    const status = getStatus(emp.id);
                    return (
                        <div key={emp.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-all">
                            <div>
                                <span className="text-sm font-black italic text-slate-800 uppercase">{emp.name}</span>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{emp.employeeType}</p>
                            </div>
                            <div className="flex gap-2">
                                {status ? (
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
                                        status === 'Present' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                    }`}>{status}</span>
                                ) : (
                                    <>
                                        <button onClick={() => handleLog(emp.id, 'Present')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600 transition-colors">Present</button>
                                        <button onClick={() => handleLog(emp.id, 'Absent')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-colors">Absent</button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DailyLogManager;
