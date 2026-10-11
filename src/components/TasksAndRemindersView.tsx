import React, { useState, useEffect, useMemo } from 'react';
import type { WorkAssignment, Employee, Alert } from '../types';
import { BellIcon, PlusCircleIcon, CalendarDaysIcon, CheckIcon, TrashIcon, MapPinIcon, XCircleIcon, BriefcaseIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
// FIX: Changed import to named import for MapComponent and its props.
import { MapComponent, type MapComponentProps } from './MapComponent';

interface TasksAndRemindersViewProps {
    workAssignments: WorkAssignment[];
    onSetWorkAssignments: (assignments: WorkAssignment[]) => void;
    employees: Employee[];
    alerts: Alert[];
    onSetAlerts: (alerts: Alert[]) => void;
    onSelectFeature: (id: string | null, options?: { fromPanel?: boolean }) => void;
    mapProps: MapComponentProps;
    onSetAppMode: (mode: any) => void;
}

const TaskModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: WorkAssignment) => void;
    task: WorkAssignment | null;
    employees: Employee[];
}> = ({ isOpen, onClose, onSave, task, employees }) => {
    const [formState, setFormState] = useState<Partial<WorkAssignment>>({
        workName: '',
        date: new Date().toISOString().split('T')[0],
        assignedEmployeeIds: [],
        notes: '',
        status: 'planned',
        attachedFileUrls: [],
    });
    
    const [taskTime, setTaskTime] = useState('09:00');
    const [addToPlanner, setAddToPlanner] = useState(true);
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderOffset, setReminderOffset] = useState(15);
    const [reminderType, setReminderType] = useState<'email' | 'notification'>('notification');

    useEffect(() => {
        if (isOpen) {
            if (task) {
                 const d = new Date(task.date);
                 const timeStr = d.toTimeString().slice(0, 5);
                 setFormState({
                    workName: task.workName,
                    date: d.toISOString().split('T')[0],
                    assignedEmployeeIds: task.assignedEmployeeIds,
                    notes: task.notes,
                    status: task.status,
                    attachedFileUrls: task.attachedFileUrls || [],
                });
                setTaskTime(timeStr);
                setAddToPlanner(task.source !== 'tasks'); 
                
                if (task.reminderSettings) {
                    setReminderEnabled(task.reminderSettings.enabled);
                    setReminderOffset(task.reminderSettings.offsetMinutes);
                    setReminderType(task.reminderSettings.type);
                } else {
                    setReminderEnabled(false);
                }
            } else {
                setFormState({
                    workName: '',
                    date: new Date().toISOString().split('T')[0],
                    assignedEmployeeIds: [],
                    notes: '',
                    status: 'planned',
                    attachedFileUrls: [],
                });
                setTaskTime('09:00');
                setAddToPlanner(true); 
                setReminderEnabled(false);
                setReminderOffset(15);
                setReminderType('notification');
            }
        }
    }, [task, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dateObj = new Date(`${formState.date}T${taskTime}`);
        
        const finalTask: WorkAssignment = {
            id: task?.id || `work-${Date.now()}`,
            complexity: 'solo',
            plannedTime: 8,
            employeeHours: [],
            sectorIds: [],
            taskType: 'Other',
            ...formState as any,
            assignedEmployeeIds: formState.assignedEmployeeIds || [],
            date: dateObj.toISOString(),
            status: formState.status || 'planned',
            workName: formState.workName || 'Untitled Task',
            source: addToPlanner ? 'planner' : 'tasks',
            reminderSettings: {
                enabled: reminderEnabled,
                offsetMinutes: reminderOffset,
                type: reminderType
            }
        };
        onSave(finalTask);
    };

    const toggleEmployee = (id: string) => {
        setFormState(prev => {
            const current = prev.assignedEmployeeIds || [];
            const newIds = current.includes(id) ? current.filter(e => e !== id) : [...current, id];
            return { ...prev, assignedEmployeeIds: newIds };
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">{task ? 'Edit Task' : 'New Task'}</h3>
                    <button onClick={onClose}><XCircleIcon className="h-6 w-6 text-gray-400"/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Task Name</label>
                        <input className="w-full p-2 border rounded mt-1" value={formState.workName} onChange={e => setFormState({...formState, workName: e.target.value})} required autoFocus />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date</label>
                            <input type="date" className="w-full p-2 border rounded mt-1" value={formState.date} onChange={e => setFormState({...formState, date: e.target.value})} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Time</label>
                            <input type="time" className="w-full p-2 border rounded mt-1" value={taskTime} onChange={e => setTaskTime(e.target.value)} required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assignees</label>
                        <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1 bg-gray-50">
                            {employees.map(emp => (
                                <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded">
                                    <input type="checkbox" checked={formState.assignedEmployeeIds?.includes(emp.id)} onChange={() => toggleEmployee(emp.id)} />
                                    {emp.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Notes</label>
                        <textarea className="w-full p-2 border rounded mt-1" rows={3} value={formState.notes} onChange={e => setFormState({...formState, notes: e.target.value})} />
                    </div>

                    <div className="pt-2 border-t space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)} className="rounded text-green-600 focus:ring-green-500" />
                            <span className="text-sm font-medium text-gray-700">Set Reminder</span>
                        </label>
                        
                        {reminderEnabled && (
                            <div className="pl-6 grid grid-cols-2 gap-2">
                                <select value={reminderOffset} onChange={e => setReminderOffset(Number(e.target.value))} className="p-1 border rounded text-sm">
                                    <option value={15}>15 min before</option>
                                    <option value={30}>30 min before</option>
                                    <option value={60}>1 hour before</option>
                                    <option value={1440}>1 day before</option>
                                </select>
                                <select value={reminderType} onChange={e => setReminderType(e.target.value as any)} className="p-1 border rounded text-sm">
                                    <option value="notification">Push Notification</option>
                                    <option value="email">Email</option>
                                </select>
                            </div>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={addToPlanner} onChange={e => setAddToPlanner(e.target.checked)} className="rounded text-green-600 focus:ring-green-500" />
                            <span className="text-sm font-medium text-gray-700">Show in System Planner</span>
                        </label>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Save Task</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CalendarGrid: React.FC<{ 
    currentDate: Date, 
    setCurrentDate: (d: Date) => void, 
    tasks: WorkAssignment[],
    selectedDate: string,
    onDateSelect: (d: string) => void 
}> = ({ currentDate, setCurrentDate, tasks, selectedDate, onDateSelect }) => {
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="p-2 border-r border-b bg-gray-50/50"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = new Date(year, month, i).toISOString().split('T')[0];
        const dayTasks = tasks.filter(t => t.date.startsWith(dateStr));
        
        let bgColorClass = 'bg-white';
        let textColorClass = 'text-gray-700';
        let indicator = null;
        
        if (dayTasks.length > 0) {
            const hasIncomplete = dayTasks.some(t => t.status !== 'completed');
            const isPast = new Date(dateStr) < new Date(new Date().toISOString().split('T')[0]);
            
            if (hasIncomplete && isPast) {
                bgColorClass = 'bg-red-50 hover:bg-red-100'; // Overdue
                textColorClass = 'text-red-700 font-bold';
            } else if (hasIncomplete) {
                bgColorClass = 'bg-blue-50 hover:bg-blue-100'; // Planned/Today
                textColorClass = 'text-blue-700 font-bold';
            } else {
                bgColorClass = 'bg-green-50 hover:bg-green-100'; // Completed
                textColorClass = 'text-green-700';
                indicator = <CheckIcon className="h-3 w-3 text-green-500 absolute top-1 right-1" />;
            }
        } else {
            bgColorClass = 'bg-white hover:bg-gray-50';
        }

        if (dateStr === selectedDate) {
            bgColorClass = 'ring-2 ring-inset ring-green-500 ' + bgColorClass;
        }

        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        days.push(
            <div 
                key={dateStr} 
                onClick={() => onDateSelect(dateStr)}
                className={`min-h-[60px] p-1 border-r border-b cursor-pointer transition-all ${bgColorClass} flex flex-col items-center justify-start relative`}
            >
                <span className={`text-xs rounded-full w-6 h-6 flex items-center justify-center mb-1 ${isToday ? 'bg-gray-800 text-white font-bold' : 'text-gray-500'}`}>
                    {i}
                </span>
                {indicator}
                {dayTasks.length > 0 && (
                    <div className={`text-[10px] px-1.5 py-0.5 rounded-full ${textColorClass} bg-white/50 shadow-sm border border-black/5`}>
                        {dayTasks.length} task{dayTasks.length > 1 ? 's' : ''}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex-shrink-0">
            <div className="flex justify-between items-center p-3 bg-gray-50 border-b">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-gray-200 rounded"><ChevronLeftIcon className="h-4 w-4 text-gray-600"/></button>
                <h3 className="font-bold text-gray-800">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-gray-200 rounded"><ChevronRightIcon className="h-4 w-4 text-gray-600"/></button>
            </div>
            <div className="grid grid-cols-7 border-b bg-gray-100 text-xs text-gray-500 font-semibold uppercase text-center py-1">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div className="grid grid-cols-7 text-sm">
                {days}
            </div>
        </div>
    );
};

const TasksAndRemindersView: React.FC<TasksAndRemindersViewProps> = (props) => {
    const { workAssignments, onSetWorkAssignments, employees, alerts, onSetAlerts, mapProps, onSetAppMode } = props;
    const { t } = useLanguage();
    const [view, setView] = useState<'list' | 'calendar'>('list');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [editingTask, setEditingTask] = useState<WorkAssignment | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const relevantTasks = useMemo(() => {
        return workAssignments.filter(w => {
            if (view === 'list') return w.status !== 'completed'; 
            return w.date.startsWith(selectedDate);
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [workAssignments, view, selectedDate]);

    const handleSaveTask = (task: WorkAssignment) => {
        if (editingTask) {
            onSetWorkAssignments(workAssignments.map(w => w.id === task.id ? task : w));
        } else {
            onSetWorkAssignments([...workAssignments, task]);
        }
        setIsModalOpen(false);
        setEditingTask(null);
    };

    const handleDeleteTask = (id: string) => {
        onSetWorkAssignments(workAssignments.filter(w => w.id !== id));
    };

    const handleCompleteTask = (task: WorkAssignment) => {
        onSetWorkAssignments(workAssignments.map(w => w.id === task.id ? { ...w, status: w.status === 'completed' ? 'planned' : 'completed' } : w));
    };

    const handleDismissAlert = (id: string) => {
        onSetAlerts(alerts.filter(a => a.id !== id));
    };

    return (
        <main className="flex-1 bg-gray-100 overflow-hidden flex flex-col md:flex-row h-full">
            {/* Left Panel: Tasks List & Calendar */}
            <div className="w-full md:w-96 bg-white border-r flex flex-col h-[50vh] md:h-full">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">{t('tasks.title')}</h2>
                        <p className="text-xs text-gray-500">{relevantTasks.length} tasks for {view === 'list' ? 'Pending' : new Date(selectedDate).toLocaleDateString()}</p>
                    </div>
                    <button 
                        onClick={() => { setEditingTask(null); setIsModalOpen(true); }} 
                        className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 shadow-sm flex items-center justify-center"
                        title={t('tasks.new_task')}
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-2 border-b flex gap-2 justify-center bg-white flex-shrink-0">
                    <button onClick={() => setView('list')} className={`px-4 py-1 text-sm rounded-full ${view === 'list' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{t('tasks.switch_list')}</button>
                    <button onClick={() => setView('calendar')} className={`px-4 py-1 text-sm rounded-full ${view === 'calendar' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{t('tasks.switch_calendar')}</button>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-3">
                    {/* Alerts Section */}
                    {alerts.length > 0 && (
                        <div className="space-y-2 mb-4">
                            <h3 className="text-xs font-bold text-red-500 uppercase flex items-center gap-1"><BellIcon className="h-3 w-3"/> Alerts</h3>
                            {alerts.map(alert => (
                                <div key={alert.id} className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-semibold text-red-800">{alert.title}</p>
                                        <p className="text-xs text-red-600 mt-1">{alert.content}</p>
                                    </div>
                                    <button onClick={() => handleDismissAlert(alert.id)} className="text-red-400 hover:text-red-700"><XCircleIcon className="h-4 w-4"/></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {view === 'calendar' && (
                        <div className="mb-4">
                            <CalendarGrid 
                                currentDate={calendarMonth} 
                                setCurrentDate={setCalendarMonth} 
                                tasks={workAssignments} 
                                selectedDate={selectedDate}
                                onDateSelect={setSelectedDate}
                            />
                        </div>
                    )}

                    {/* Tasks List */}
                    {relevantTasks.map(task => {
                        const assignees = task.assignedEmployeeIds.map(id => employees.find(e => e.id === id)?.name).filter(Boolean);
                        const isLate = new Date(task.date) < new Date() && task.status !== 'completed';
                        
                        return (
                            <div key={task.id} className={`p-3 bg-white border rounded-lg shadow-sm group hover:border-blue-400 transition-all ${isLate ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-blue-500'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleCompleteTask(task)}
                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 hover:border-green-500'}`}
                                            title="Toggle Status"
                                        >
                                            <CheckIcon className={`h-3 w-3 ${task.status === 'completed' ? 'text-white' : 'text-transparent group-hover:text-green-500'}`}/>
                                        </button>
                                        <div>
                                            <h4 className={`font-semibold text-gray-800 ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                                                {typeof task.workName === 'string' ? task.workName : ((task.workName as any)?.name || (task.workName as any)?.title || 'Task')}
                                            </h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                <span className={`flex items-center gap-1 ${isLate ? 'text-red-600 font-bold' : ''}`}>
                                                    <CalendarDaysIcon className="h-3 w-3"/> 
                                                    {new Date(task.date).toLocaleDateString()} {new Date(task.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingTask(task); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <TrashIcon className="h-4 w-4"/>
                                        </button>
                                    </div>
                                </div>
                                {assignees.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-2 pl-7">Assigned: {assignees.join(', ')}</p>
                                )}
                                {task.source === 'planner' && (
                                    <div className="mt-2 pl-7 flex gap-2">
                                        <button onClick={() => onSetAppMode('system')} className="text-[10px] bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 text-gray-600 flex items-center gap-1">
                                            <BriefcaseIcon className="h-3 w-3"/> {t('tasks.view_planner')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {relevantTasks.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                            <CheckIcon className="h-12 w-12 mx-auto mb-2 opacity-20"/>
                            <p>{t('tasks.no_tasks')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Map Context */}
            <div className="flex-1 h-[50vh] md:h-full relative bg-white">
                <MapComponent {...mapProps} showSearch={true} />
            </div>
            
            {isModalOpen && (
                <TaskModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSaveTask} 
                    task={editingTask} 
                    employees={employees} 
                />
            )}
        </main>
    );
};

export default TasksAndRemindersView;
