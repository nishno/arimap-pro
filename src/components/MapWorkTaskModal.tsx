import React, { useState } from 'react';
import { 
    X, MapPin, Briefcase, Calendar, Clock, User, 
    FileText, CheckCircle2, AlertCircle, Plus, Sparkles, Tag, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import type { Employee, TaskType, TaskStatus } from '../types';

export interface MapWorkTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    coordinates?: { lat: number; lng: number };
    initialMode?: 'work' | 'task' | 'note';
    employees?: Employee[];
    sectors?: any[];
    crops?: any[];
    isKa?: boolean;
    onSaveWork?: (workData: {
        workName: string;
        taskType: TaskType;
        date: string;
        assignedEmployeeIds: string[];
        plannedHours: number;
        notes: string;
        coordinates: { lat: number; lng: number };
        createMapMarker: boolean;
        linkedFeatureId?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        color?: string;
    }) => void;
    onSaveTask?: (taskData: {
        title: string;
        workName?: string;
        dueDate: string;
        dueTime?: string;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        assignedEmployeeId?: string;
        reminderEnabled: boolean;
        notes: string;
        coordinates: { lat: number; lng: number };
        createMapMarker: boolean;
        linkedFeatureId?: string;
        color?: string;
    }) => void;
    onSaveNote?: (noteData: {
        title: string;
        content: string;
        category: string;
        coordinates: { lat: number; lng: number };
        createMapMarker: boolean;
        linkedFeatureId?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        color?: string;
    }) => void;
}

const TASK_TYPES: { type: TaskType; labelEn: string; labelKa: string; color: string }[] = [
    { type: 'Irrigation', labelEn: 'Irrigation & Watering', labelKa: 'მორწყვა და სარწყავი სისტემა', color: '#06b6d4' },
    { type: 'Fertilization', labelEn: 'Fertilization & Nutrition', labelKa: 'განაყოფიერება და კვება', color: '#10b981' },
    { type: 'Pesticide', labelEn: 'Pesticide & Crop Protection', labelKa: 'შესხურება და დაცვა', color: '#8b5cf6' },
    { type: 'Harvest', labelEn: 'Harvest & Produce Gathering', labelKa: 'მოსავლის აღება / კრეფა', color: '#f59e0b' },
    { type: 'Pruning', labelEn: 'Pruning & Canopy Care', labelKa: 'გასხვლა და ვარჯის ფორმირება', color: '#ec4899' },
    { type: 'Planting', labelEn: 'Planting & Seedlings', labelKa: 'დარგვა და ნერგები', color: '#22c55e' },
    { type: 'Other', labelEn: 'Other Field Work', labelKa: 'სხვა საველე სამუშაო', color: '#6b7280' }
];

interface PriorityColorSelectorProps {
    priority: 'low' | 'medium' | 'high' | 'urgent';
    onPriorityChange: (p: 'low' | 'medium' | 'high' | 'urgent') => void;
    color: string;
    onColorChange: (color: string) => void;
    isKa: boolean;
    title?: string;
}

const PriorityColorSelector: React.FC<PriorityColorSelectorProps> = ({
    priority,
    onPriorityChange,
    color,
    onColorChange,
    isKa,
    title
}) => {
    const handlePriorityClick = (p: 'low' | 'medium' | 'high' | 'urgent') => {
        onPriorityChange(p);
        if (p === 'urgent') onColorChange('#dc2626');
        else if (p === 'high') onColorChange('#ef4444');
        else if (p === 'medium') onColorChange('#f59e0b');
        else if (p === 'low') onColorChange('#64748b');
    };

    const colorPresets = [
        { hex: '#ef4444', label: 'Red (High Priority)' },
        { hex: '#dc2626', label: 'Crimson (Urgent)' },
        { hex: '#f59e0b', label: 'Yellow/Amber (Medium)' },
        { hex: '#10b981', label: 'Emerald Green' },
        { hex: '#3b82f6', label: 'Blue' },
        { hex: '#8b5cf6', label: 'Purple' },
        { hex: '#64748b', label: 'Grey (Low Priority)' },
    ];

    return (
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    {title || (isKa ? 'პრიორიტეტი & რუკის მარკერის ფერი' : 'Priority & Map Point Color')}
                </label>
                <div className="flex items-center gap-1.5">
                    <span 
                        className="w-3.5 h-3.5 rounded-full border border-white/60 shadow-sm"
                        style={{ backgroundColor: color }}
                    />
                    <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                        priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                        priority === 'high' ? 'bg-rose-500/20 text-rose-400' :
                        priority === 'low' ? 'bg-slate-700/50 text-slate-300' :
                        'bg-amber-500/20 text-amber-400'
                    }`}>
                        {priority}
                    </span>
                </div>
            </div>

            {/* 4 Priority Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
                {[
                    { id: 'urgent' as const, labelEn: 'Urgent', labelKa: 'სასწრაფო', colorClass: 'bg-red-600 text-white shadow-red-600/30' },
                    { id: 'high' as const, labelEn: 'High', labelKa: 'მაღალი', colorClass: 'bg-rose-500 text-white shadow-rose-500/30' },
                    { id: 'medium' as const, labelEn: 'Medium', labelKa: 'საშუალო', colorClass: 'bg-amber-500 text-slate-950 shadow-amber-500/30' },
                    { id: 'low' as const, labelEn: 'Low', labelKa: 'დაბალი', colorClass: 'bg-slate-600 text-white shadow-slate-600/30' },
                ].map(p => {
                    const isSelected = priority === p.id;
                    return (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => handlePriorityClick(p.id)}
                            className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                isSelected
                                    ? `${p.colorClass} shadow-md ring-2 ring-white/40 font-bold`
                                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <span>{isKa ? p.labelKa : p.labelEn}</span>
                        </button>
                    );
                })}
            </div>

            {/* Color Palette & Custom Picker */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400">
                    {isKa ? 'ფერის არჩევა:' : 'Choose Color:'}
                </span>
                <div className="flex items-center gap-1.5">
                    {colorPresets.map(preset => (
                        <button
                            key={preset.hex}
                            type="button"
                            title={preset.label}
                            onClick={() => onColorChange(preset.hex)}
                            style={{ backgroundColor: preset.hex }}
                            className={`w-4 h-4 rounded-full border border-white/60 shadow-sm transition-transform hover:scale-125 cursor-pointer ${
                                color === preset.hex ? 'ring-2 ring-white scale-110' : ''
                            }`}
                        />
                    ))}
                    {/* Custom Color Input */}
                    <label 
                        className="relative w-4 h-4 rounded-full overflow-hidden border border-white/60 shadow-sm hover:scale-125 transition-transform cursor-pointer"
                        title={isKa ? "საკუთარი ფერის არჩევა" : "Choose custom color"}
                    >
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => onColorChange(e.target.value)}
                            className="absolute -top-3 -left-3 w-10 h-10 opacity-0 cursor-pointer"
                        />
                        <span className="w-full h-full block bg-gradient-to-tr from-rose-500 via-amber-400 to-indigo-500" />
                    </label>
                </div>
            </div>
        </div>
    );
};

export const MapWorkTaskModal: React.FC<MapWorkTaskModalProps> = ({
    isOpen,
    onClose,
    coordinates,
    initialMode = 'work',
    employees = [],
    onSaveWork,
    onSaveTask,
    onSaveNote
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [activeTab, setActiveTab] = useState<'work' | 'task' | 'note'>(initialMode);

    // Work Form State
    const [workName, setWorkName] = useState('');
    const [taskType, setTaskType] = useState<TaskType>('Irrigation');
    const [workDate, setWorkDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [plannedHours, setPlannedHours] = useState<number>(4);
    const [workPriority, setWorkPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [workColor, setWorkColor] = useState<string>('#f59e0b');
    const [workNotes, setWorkNotes] = useState('');
    const [createWorkMarker, setCreateWorkMarker] = useState(true);

    // Planner Task Form State
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDueDate, setTaskDueDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [taskDueTime, setTaskDueTime] = useState('10:00');
    const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [taskColor, setTaskColor] = useState<string>('#f59e0b');
    const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>('');
    const [taskReminder, setTaskReminder] = useState(true);
    const [taskNotes, setTaskNotes] = useState('');
    const [createTaskMarker, setCreateTaskMarker] = useState(true);

    // Note Form State
    const [noteTitle, setNoteTitle] = useState('');
    const [noteContent, setNoteContent] = useState('');
    const [noteCategory, setNoteCategory] = useState('Agronomy');
    const [notePriority, setNotePriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [noteColor, setNoteColor] = useState<string>('#10b981');
    const [createNoteMarker, setCreateNoteMarker] = useState(true);

    if (!isOpen) return null;

    const coordsDisplay = coordinates 
        ? `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
        : 'Active Map Center';

    const handleSaveWorkAssignment = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = workName.trim();
        if (!trimmed) {
            toast.error(isKa ? "გთხოვთ შეიყვანოთ სამუშაოს სახელი" : "Please enter work name");
            return;
        }

        const safeCoords = coordinates || { lat: 41.7151, lng: 44.8271 };

        if (onSaveWork) {
            onSaveWork({
                workName: trimmed,
                taskType,
                date: workDate,
                assignedEmployeeIds: selectedEmployeeIds,
                plannedHours,
                notes: workNotes,
                coordinates: safeCoords,
                createMapMarker: createWorkMarker,
                priority: workPriority,
                color: workColor
            });
        } else {
            // Global event fallback
            window.dispatchEvent(new CustomEvent('agrimap_add_map_work', {
                detail: {
                    workName: trimmed,
                    taskType,
                    date: workDate,
                    assignedEmployeeIds: selectedEmployeeIds,
                    plannedHours,
                    notes: workNotes,
                    coordinates: safeCoords,
                    createMapMarker: createWorkMarker,
                    priority: workPriority,
                    color: workColor
                }
            }));
            toast.success(isKa ? "სამუშაო დაემატა რუკაზე და სამუშაოების მოდულში!" : "Work assignment created on map and added to Works module!");
        }

        onClose();
    };

    const handleSavePlannerTask = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = taskTitle.trim();
        if (!trimmed) {
            toast.error(isKa ? "გთხოვთ შეიყვანოთ დავალების სათაური" : "Please enter task title");
            return;
        }

        const safeCoords = coordinates || { lat: 41.7151, lng: 44.8271 };

        if (onSaveTask) {
            onSaveTask({
                title: trimmed,
                dueDate: taskDueDate,
                dueTime: taskDueTime,
                priority: taskPriority,
                color: taskColor,
                assignedEmployeeId: assignedEmployeeId || undefined,
                reminderEnabled: taskReminder,
                notes: taskNotes,
                coordinates: safeCoords,
                createMapMarker: createTaskMarker
            });
        } else {
            window.dispatchEvent(new CustomEvent('agrimap_add_map_task', {
                detail: {
                    title: trimmed,
                    dueDate: taskDueDate,
                    dueTime: taskDueTime,
                    priority: taskPriority,
                    color: taskColor,
                    assignedEmployeeId,
                    reminderEnabled: taskReminder,
                    notes: taskNotes,
                    coordinates: safeCoords,
                    createMapMarker: createTaskMarker
                }
            }));
            toast.success(isKa ? "დავალება დაემატა დამგეგმავში და რუკაზე!" : "Task created and synced with Planner & Reminders!");
        }

        onClose();
    };

    const handleSaveFieldNote = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedContent = noteContent.trim();
        if (!trimmedContent) {
            toast.error(isKa ? "გთხოვთ შეიყვანოთ შენიშვნის ტექსტი" : "Please enter note content");
            return;
        }

        const safeCoords = coordinates || { lat: 41.7151, lng: 44.8271 };

        if (onSaveNote) {
            onSaveNote({
                title: noteTitle.trim() || (isKa ? 'საველე შენიშვნა' : 'Field Note'),
                content: trimmedContent,
                category: noteCategory,
                coordinates: safeCoords,
                createMapMarker: createNoteMarker,
                priority: notePriority,
                color: noteColor
            });
        } else {
            window.dispatchEvent(new CustomEvent('agrimap_add_map_note', {
                detail: {
                    title: noteTitle.trim() || (isKa ? 'საველე შენიშვნა' : 'Field Note'),
                    content: trimmedContent,
                    category: noteCategory,
                    coordinates: safeCoords,
                    createMapMarker: createNoteMarker,
                    priority: notePriority,
                    color: noteColor
                }
            }));
            toast.success(isKa ? "შენიშვნა განთავსდა რუკაზე!" : "Field note pinned to map and saved!");
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div 
                className="bg-slate-900 border border-slate-700/80 rounded-[2rem] w-full max-w-lg shadow-2xl text-white overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                            <MapPin size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-sm uppercase tracking-wider text-slate-100 truncate">
                                {isKa ? 'ადგილზე ელემენტის დამატება' : 'Add Item at Map Location'}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono mt-0.5 truncate">
                                <span>📍 {coordsDisplay}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title={isKa ? "დახურვა" : "Close"}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Mode Selector Tabs */}
                <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setActiveTab('work')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'work'
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                        }`}
                    >
                        <Briefcase size={14} />
                        <span>{isKa ? 'სამუშაო' : 'Work Assignment'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('task')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'task'
                                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                        }`}
                    >
                        <Calendar size={14} />
                        <span>{isKa ? 'დავალება' : 'Planner Task'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('note')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'note'
                                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                        }`}
                    >
                        <FileText size={14} />
                        <span>{isKa ? 'შენიშვნა' : 'Field Note'}</span>
                    </button>
                </div>

                {/* Form Content */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {/* TAB 1: WORK ASSIGNMENT */}
                    {activeTab === 'work' && (
                        <form onSubmit={handleSaveWorkAssignment} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                    {isKa ? 'სამუშაოს დასახელება *' : 'Work Assignment Name *'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={workName}
                                    onChange={(e) => setWorkName(e.target.value)}
                                    placeholder={isKa ? "მაგ: სექტორი 2-ის მორწყვა და შემოწმება" : "e.g. Sector 2 Drip Irrigation Inspection"}
                                    className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                                />
                            </div>

                            {/* Task Type Grid */}
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                    {isKa ? 'სამუშაოს ტიპი' : 'Work Operation Type'}
                                </label>
                                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-950/50 rounded-xl border border-slate-800">
                                    {TASK_TYPES.map(t => (
                                        <button
                                            key={t.type}
                                            type="button"
                                            onClick={() => setTaskType(t.type)}
                                            className={`p-2 rounded-lg text-left text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                                taskType === t.type
                                                    ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300'
                                                    : 'hover:bg-slate-800/70 text-slate-300'
                                            }`}
                                        >
                                            <span 
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: t.color }}
                                            />
                                            <span className="truncate">{isKa ? t.labelKa : t.labelEn}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date & Planned Duration */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                        {isKa ? 'თარიღი' : 'Scheduled Date'}
                                    </label>
                                    <input
                                        type="date"
                                        value={workDate}
                                        onChange={(e) => setWorkDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                        {isKa ? 'დაგეგმილი საათები' : 'Planned Hours'}
                                    </label>
                                    <input
                                        type="number"
                                        min="0.5"
                                        step="0.5"
                                        value={plannedHours}
                                        onChange={(e) => setPlannedHours(parseFloat(e.target.value) || 1)}
                                        className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Assignee Selection */}
                            {employees.length > 0 && (
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                        {isKa ? 'პასუხისმგებელი თანამშრომელი' : 'Assigned Workers / Team'}
                                    </label>
                                    <select
                                        multiple
                                        value={selectedEmployeeIds}
                                        onChange={(e) => {
                                            const options = Array.from(e.target.selectedOptions, o => o.value);
                                            setSelectedEmployeeIds(options);
                                        }}
                                        className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors max-h-24"
                                    >
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} {emp.role ? `(${emp.role})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        {isKa ? 'დააჭირეთ Ctrl/Cmd რამდენიმე პირის ასარჩევად' : 'Hold Ctrl/Cmd to select multiple workers'}
                                    </p>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                    {isKa ? 'ინსტრუქცია / შენიშვნა' : 'Instructions & Notes'}
                                </label>
                                <textarea
                                    rows={2}
                                    value={workNotes}
                                    onChange={(e) => setWorkNotes(e.target.value)}
                                    placeholder={isKa ? "დამატებითი დეტალები..." : "Add field instructions or equipment notes..."}
                                    className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors resize-none"
                                />
                            </div>

                            {/* Priority & Color Selection */}
                            <PriorityColorSelector
                                priority={workPriority}
                                onPriorityChange={setWorkPriority}
                                color={workColor}
                                onColorChange={setWorkColor}
                                isKa={isKa}
                                title={isKa ? 'სამუშაოს პრიორიტეტი & რუკის მარკერის ფერი' : 'Work Priority & Map Marker Color'}
                            />

                            {/* Toggle Show on Map */}
                            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={createWorkMarker}
                                    onChange={(e) => setCreateWorkMarker(e.target.checked)}
                                    className="w-4 h-4 text-amber-500 rounded bg-slate-900 border-slate-600 focus:ring-amber-500"
                                />
                                <div className="text-xs">
                                    <div className="font-bold text-slate-200">
                                        {isKa ? 'რუკაზე მარკერის გამოჩენა' : 'Display interactive marker on Map'}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        {isKa ? 'სამუშაო გამოჩნდება რუკაზეც და "სამუშაოები & დავალებების" მოდულშიც' : 'Marker links to this GPS point and syncs with Tasks & Works module'}
                                    </div>
                                </div>
                            </label>

                            {/* Submit Button */}
                            <div className="pt-2 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <Plus size={15} />
                                    <span>{isKa ? 'სამუშაოს დამატება' : 'Save Work Assignment'}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* TAB 2: PLANNER TASK */}
                    {activeTab === 'task' && (
                        <form onSubmit={handleSavePlannerTask} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                    {isKa ? 'დავალების სათაური *' : 'Task Title *'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={taskTitle}
                                    onChange={(e) => setTaskTitle(e.target.value)}
                                    placeholder={isKa ? "მაგ: ნიადაგის სინჯის აღება და ანალიზი" : "e.g. Soil sampling and salinity test"}
                                    className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                        {isKa ? 'შესრულების ვადა' : 'Due Date'}
                                    </label>
                                    <input
                                        type="date"
                                        value={taskDueDate}
                                        onChange={(e) => setTaskDueDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                        {isKa ? 'დრო' : 'Due Time'}
                                    </label>
                                    <input
                                        type="time"
                                        value={taskDueTime}
                                        onChange={(e) => setTaskDueTime(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Priority & Color Selection */}
                            <PriorityColorSelector
                                priority={taskPriority}
                                onPriorityChange={setTaskPriority}
                                color={taskColor}
                                onColorChange={setTaskColor}
                                isKa={isKa}
                                title={isKa ? 'დავალების პრიორიტეტი & რუკის მარკერის ფერი' : 'Task Priority & Map Marker Color'}
                            />

                            {/* Employee */}
                            {employees.length > 0 && (
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                        {isKa ? 'შემსრულებელი' : 'Assignee'}
                                    </label>
                                    <select
                                        value={assignedEmployeeId}
                                        onChange={(e) => setAssignedEmployeeId(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400 transition-colors"
                                    >
                                        <option value="">{isKa ? 'აირჩიეთ თანამშრომელი...' : 'Select employee...'}</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} {emp.role ? `(${emp.role})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                    {isKa ? 'დამატებითი დეტალები' : 'Details & Reminders'}
                                </label>
                                <textarea
                                    rows={2}
                                    value={taskNotes}
                                    onChange={(e) => setTaskNotes(e.target.value)}
                                    placeholder={isKa ? "ჩანიშნეთ დეტალები..." : "Add task notes..."}
                                    className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 transition-colors resize-none"
                                />
                            </div>

                            {/* Toggles */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={taskReminder}
                                        onChange={(e) => setTaskReminder(e.target.checked)}
                                        className="w-4 h-4 text-blue-500 rounded bg-slate-900 border-slate-600 focus:ring-blue-500"
                                    />
                                    <div className="text-xs">
                                        <div className="font-bold text-slate-200">
                                            {isKa ? 'შეხსენების გააქტიურება' : 'Enable Notification Reminder'}
                                        </div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={createTaskMarker}
                                        onChange={(e) => setCreateTaskMarker(e.target.checked)}
                                        className="w-4 h-4 text-blue-500 rounded bg-slate-900 border-slate-600 focus:ring-blue-500"
                                    />
                                    <div className="text-xs">
                                        <div className="font-bold text-slate-200">
                                            {isKa ? 'რუკაზე მარკერის ჩვენება' : 'Show Task Pin on Map'}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            {isKa ? 'სინქრონიზდება დამგეგმავის მოდულთან' : 'Visible in Planner & Reminders calendar & on the map'}
                                        </div>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <Plus size={15} />
                                    <span>{isKa ? 'დავალების შენახვა' : 'Save Planner Task'}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* TAB 3: FIELD NOTE */}
                    {activeTab === 'note' && (
                        <form onSubmit={handleSaveFieldNote} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                    {isKa ? 'შენიშვნის სათაური' : 'Note Title (Optional)'}
                                </label>
                                <input
                                    type="text"
                                    value={noteTitle}
                                    onChange={(e) => setNoteTitle(e.target.value)}
                                    placeholder={isKa ? "მაგ: ფოთლების გაყვითლება / დაზიანება" : "e.g. Leaf yellowing observation / pipe leak"}
                                    className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                    {isKa ? 'კატეგორია / თემატიკა' : 'Category / Topic'}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Agronomy', 'Irrigation', 'Soil/Water', 'Disease/Pest', 'Machinery', 'General'].map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setNoteCategory(cat)}
                                            className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                                noteCategory === cat
                                                    ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
                                                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Note Content */}
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                                    {isKa ? 'შენიშვნის ტექსტი *' : 'Note Content *'}
                                </label>
                                <textarea
                                    rows={4}
                                    required
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    placeholder={isKa ? "ჩაწერეთ საველე დაკვირვება ან შენიშვნა..." : "Enter field observations, measurements, or urgent memo..."}
                                    className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors resize-none"
                                />
                            </div>

                            {/* Priority & Color Selection */}
                            <PriorityColorSelector
                                priority={notePriority}
                                onPriorityChange={setNotePriority}
                                color={noteColor}
                                onColorChange={setNoteColor}
                                isKa={isKa}
                                title={isKa ? 'შენიშვნის პრიორიტეტი & რუკის მარკერის ფერი' : 'Note Priority & Map Marker Color'}
                            />

                            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={createNoteMarker}
                                    onChange={(e) => setCreateNoteMarker(e.target.checked)}
                                    className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-600 focus:ring-emerald-500"
                                />
                                <div className="text-xs">
                                    <div className="font-bold text-slate-200">
                                        {isKa ? 'რუკაზე შენიშვნის ქინძისთავის დასმა' : 'Pin Note on Map'}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        {isKa ? 'შენიშვნა გამოჩნდება რუკის ამ წერტილზე და შენიშვნების სიაში' : 'Pins note to this exact GPS location and adds to notes list'}
                                    </div>
                                </div>
                            </label>

                            <div className="pt-2 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <Plus size={15} />
                                    <span>{isKa ? 'შენიშვნის შენახვა' : 'Save Field Note'}</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MapWorkTaskModal;
