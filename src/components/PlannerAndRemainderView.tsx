import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { WorkAssignment, Employee, Alert, ActiveDrawingTool, DrawingTool, PlantationFeature, LinePlantationFeature, AreaPlantationFeature, User } from '../types';
import { isValidCoordinate } from '../types';
import { 
    BellIcon, PlusCircleIcon, CalendarDaysIcon, CheckIcon, TrashIcon, 
    MapPinIcon, XCircleIcon, BriefcaseIcon, ChevronLeftIcon, ChevronRightIcon, 
    MicrophoneIcon, AcademicCapIcon, StopIcon, RectangleGroupIcon,
    SearchIcon, RectangleStackIcon, PlayIcon, CircleIcon, MapIcon
} from './Icons';
import { MessageSquare, Video, Share2, CheckSquare, EyeOff } from 'lucide-react';
import ShareToGoogleChatModal from './ShareToGoogleChatModal';
import { formatTasksForGoogleChat, formatPlantationFeatureForGoogleChat } from '../services/googleChatService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAiAssistant } from '../hooks/useAiAssistant';
import { toast } from 'sonner';
import ModuleAiAssistant from './ModuleAiAssistant';
import { generateSeedlingCoordinates } from '../services/geospatialService';
import MapComponent, { MapComponentProps } from './MapComponent';
import { Polyline } from 'react-leaflet';
import L from 'leaflet';
import ResizableDivider from './common/ResizableDivider';
import { safeStorage } from '../services/storageService';

interface PlannerAndRemainderViewProps {
    workAssignments: WorkAssignment[];
    onSetWorkAssignments: (assignments: WorkAssignment[]) => void;
    employees: Employee[];
    checkpoints: any[];
    notes: any[];
    alerts: Alert[];
    onSetAlerts: (alerts: Alert[]) => void;
    onUpdateFeature: (feature: PlantationFeature) => void;
    onSelectFeature: (id: string | null, options?: { fromPanel?: boolean }) => void;
    onDeleteFeature?: (ids: string[]) => void;
    mapProps: MapComponentProps;
    onSetAppMode: (mode: any) => void;
    activeDrawingTool: ActiveDrawingTool;
    onSetActiveDrawingTool: (tool: ActiveDrawingTool) => void;
    onFeatureDrawn: (type: any, geometry: any, clickPos?: any, metadata?: any) => void;
    currentUser?: User | null;
}

/**
 * TaskModal: A clean, focused modal for creating and editing tasks.
 */
const TaskModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: WorkAssignment) => void;
    task: WorkAssignment | null;
    employees: Employee[];
    checkpoints: any[];
    onSendCommand: (cmd: string, context: any) => Promise<void>;
    isAiLoading: boolean;
}> = ({ isOpen, onClose, onSave, task, employees, checkpoints, onSendCommand, isAiLoading }) => {
    const [formState, setFormState] = useState<Partial<WorkAssignment>>({
        workName: '',
        date: new Date().toISOString().split('T')[0],
        assignedEmployeeIds: [],
        notes: '',
        status: 'planned',
        taskType: 'Other',
        sectorIds: [],
        checkpointId: '',
        linkedFeatureId: '',
    });
    
    const [taskTime, setTaskTime] = useState('09:00');
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [addToWorkAssignment, setAddToWorkAssignment] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    const plantationFeatures = (window as any).plantationFeatures || [];

    useEffect(() => {
        if (isOpen) {
            if (task) {
                const d = new Date(task.date);
                setFormState({
                    ...task,
                    date: d.toISOString().split('T')[0],
                });
                setTaskTime(d.toTimeString().slice(0, 5));
                setReminderEnabled(!!task.reminderSettings?.enabled);
                setAddToWorkAssignment(!!task.addToWorkAssignment);
            } else {
                setFormState({
                    workName: '',
                    date: new Date().toISOString().split('T')[0],
                    assignedEmployeeIds: [],
                    notes: '',
                    status: 'planned',
                    taskType: 'Other',
                    sectorIds: [],
                });
                setTaskTime('09:00');
                setReminderEnabled(false);
                setAddToWorkAssignment(false);
            }
        }
    }, [task, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dateObj = new Date(`${formState.date}T${taskTime}`);
        onSave({
            ...formState,
            id: task?.id || `work-${Date.now()}`,
            date: dateObj.toISOString(),
            workName: formState.workName || 'Untitled Task',
            status: formState.status || 'planned',
            source: 'planner',
            addToWorkAssignment,
        } as WorkAssignment);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[5000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">{task ? 'Edit Task' : 'New Task'}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Planner Integration</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-all"><XCircleIcon className="h-6 w-6 text-slate-400"/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Task Title</label>
                            <input 
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                                value={formState.workName} 
                                onChange={e => setFormState({...formState, workName: e.target.value})} 
                                placeholder="What needs to be done?"
                                required 
                                autoFocus 
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date</label>
                                <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none" value={formState.date} onChange={e => setFormState({...formState, date: e.target.value})} required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Time</label>
                                <input type="time" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none" value={taskTime} onChange={e => setTaskTime(e.target.value)} required />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col justify-center">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Add to Work Assignment</label>
                                <button 
                                    type="button"
                                    onClick={() => setAddToWorkAssignment(!addToWorkAssignment)}
                                    className={`w-full p-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${
                                        addToWorkAssignment 
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' 
                                        : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                                    }`}
                                >
                                    {addToWorkAssignment ? 'Enabled' : 'Disabled'}
                                </button>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Link to Map Feature</label>
                                <select 
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none"
                                    value={formState.linkedFeatureId || ''}
                                    onChange={e => setFormState({...formState, linkedFeatureId: e.target.value})}
                                >
                                    <option value="">No linked feature</option>
                                    {plantationFeatures
                                        .map((f: any) => (
                                            <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notes</label>
                            <textarea 
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none min-h-[100px]" 
                                value={formState.notes} 
                                onChange={e => setFormState({...formState, notes: e.target.value})} 
                                placeholder="Additional details..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancel</button>
                        <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all">Save Task</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/**
 * CalendarGrid: A compact, stylish calendar for task visualization.
 */
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
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="p-2 border-r border-b bg-slate-50/30"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = new Date(year, month, i).toISOString().split('T')[0];
        const dayTasks = tasks.filter(t => t.date.startsWith(dateStr));
        const isSelected = dateStr === selectedDate;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        days.push(
            <div 
                key={dateStr} 
                onClick={() => onDateSelect(dateStr)}
                className={`min-h-[60px] p-2 border-r border-b cursor-pointer transition-all flex flex-col items-center justify-start relative group ${isSelected ? 'bg-indigo-50/50 ring-2 ring-inset ring-indigo-500 z-10' : 'bg-white hover:bg-slate-50'}`}
            >
                <span className={`text-[10px] font-black rounded-full w-6 h-6 flex items-center justify-center mb-1 transition-all ${isToday ? 'bg-indigo-600 text-white' : isSelected ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {i}
                </span>
                {dayTasks.length > 0 && (
                    <div className="flex gap-0.5 mt-auto">
                        {dayTasks.slice(0, 3).map((t, idx) => (
                            <div key={idx} className={`w-1 h-1 rounded-full ${t.status === 'completed' ? 'bg-green-400' : 'bg-indigo-400'}`} />
                        ))}
                        {dayTasks.length > 3 && <div className="w-1 h-1 rounded-full bg-slate-300" />}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-xl shadow-slate-200/40">
            <div className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-100">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeftIcon className="h-4 w-4 text-slate-600"/></button>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRightIcon className="h-4 w-4 text-slate-600"/></button>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 text-[8px] text-slate-400 font-black uppercase tracking-widest text-center py-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 text-sm">
                {days}
            </div>
        </div>
    );
};

const renderSafeText = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
        return value.name || value.workName || value.title || value.taskType || JSON.stringify(value);
    }
    return String(value);
};

/**
 * PlannerAndRemainderView: The main view component.
 */
const PlannerAndRemainderView: React.FC<PlannerAndRemainderViewProps> = (props) => {
    const { 
        workAssignments, onSetWorkAssignments, employees, checkpoints, notes, alerts, onSetAlerts, onUpdateFeature,
        onSelectFeature, mapProps, onSetAppMode, activeDrawingTool, onSetActiveDrawingTool, onFeatureDrawn, onDeleteFeature,
        currentUser
    } = props;
    const { t, language } = useLanguage();
    const isKa = language === 'ka';
    const { handleSendCommand, isAssistantLoading } = useAiAssistant('en');
    
    // Resizable Edge Handle state
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        const saved = safeStorage.getItem('planner_sidebar_width');
        const parsed = saved ? parseInt(saved, 10) : 400;
        return Number.isFinite(parsed) && parsed >= 280 ? parsed : 400;
    });

    const [view, setView] = useState<'list' | 'calendar' | 'map'>('list');
    const [dateFilter, setDateFilter] = useState<'today' | 'past' | 'future' | 'all'>('all');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [mapFilterDate, setMapFilterDate] = useState<string | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [editingTask, setEditingTask] = useState<WorkAssignment | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
    const [mapTheme, setMapTheme] = useState<'default' | 'status'>('default');

    const [isTrackingWalk, setIsTrackingWalk] = useState(false);
    const [trackedPath, setTrackedPath] = useState<[number, number][]>([]);
    const watchIdRef = useRef<number | null>(null);

    // Google Chat & Meet Sharing States
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [sharePayload, setSharePayload] = useState<any>(null);
    const [shareTitle, setShareTitle] = useState('Share Tasks to Google Chat');
    const [shareIncludeMeet, setShareIncludeMeet] = useState(false);
    const [selectedTasksForBatch, setSelectedTasksForBatch] = useState<string[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const handleShareSingleTask = (task: WorkAssignment, withMeet: boolean = false) => {
        const payload = formatTasksForGoogleChat([task], withMeet ? 'Google Meet Video Session Requested' : undefined);
        setSharePayload(payload);
        setShareTitle(`Share "${task.workName}" to Google Chat`);
        setShareIncludeMeet(withMeet);
        setIsShareModalOpen(true);
    };

    const handleShareBatchTasks = (withMeet: boolean = false) => {
        const tasksToShare = workAssignments.filter(w => selectedTasksForBatch.includes(w.id));
        if (tasksToShare.length === 0) {
            toast.error("Please select at least one task to share.");
            return;
        }
        const payload = formatTasksForGoogleChat(tasksToShare, withMeet ? 'Urgent Multi-Task Review via Google Meet' : undefined);
        setSharePayload(payload);
        setShareTitle(`Share ${tasksToShare.length} Tasks to Google Chat`);
        setShareIncludeMeet(withMeet);
        setIsShareModalOpen(true);
    };

    const handleShareFeatureNote = (feature: PlantationFeature, withMeet: boolean = false) => {
        const payload = formatPlantationFeatureForGoogleChat(feature, withMeet ? 'Field Review via Google Meet' : undefined);
        setSharePayload(payload);
        setShareTitle(`Share Note "${feature.name}" to Google Chat`);
        setShareIncludeMeet(withMeet);
        setIsShareModalOpen(true);
    };

    const toggleTaskSelection = (taskId: string) => {
        setSelectedTasksForBatch(prev => 
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const handleSimulateStep = () => {
        setTrackedPath(prev => {
            let last = prev[prev.length - 1];
            if (!isValidCoordinate(last)) {
                const c = mapProps.center;
                if (c && Array.isArray(c) && c.length === 2) {
                    const lat = typeof c[0] === 'string' ? parseFloat(c[0]) : c[0];
                    const lng = typeof c[1] === 'string' ? parseFloat(c[1]) : c[1];
                    if (Number.isFinite(lat) && Number.isFinite(lng)) {
                        last = [lat, lng];
                    } else {
                        last = [42.14, 42.0];
                    }
                } else {
                    last = [42.14, 42.0];
                }
            }
            const lastLat = typeof last[0] === 'string' ? parseFloat(last[0]) : last[0];
            const lastLng = typeof last[1] === 'string' ? parseFloat(last[1]) : last[1];
            const angle = Math.random() * Math.PI * 2;
            const nextLat = lastLat + Math.sin(angle) * 0.00015;
            const nextLng = lastLng + Math.cos(angle) * 0.00015;
            return [...prev, [nextLat, nextLng]];
        });
        toast.info("Walk point simulated! Added path segment.");
    };

    const handleSaveTrackedWalk = () => {
        if (trackedPath.length < 2) {
            toast.error("Tracked walk path must have at least 2 points!");
            return;
        }
        
        const timestamp = new Date();
        const walkName = `WALK ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        
        onFeatureDrawn('line', trackedPath, null, {
            name: walkName.toUpperCase(),
            notes: 'Walk path stored in simulation.',
            lineType: 'walk',
            source: 'planner'
        });
        
        setIsTrackingWalk(false);
        setTrackedPath([]);
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        toast.success(`Walk tracking completed! Saved to simulation.`);
    };

    const handleCancelTrackedWalk = () => {
        setIsTrackingWalk(false);
        setTrackedPath([]);
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        toast.info("Walk session canceled.");
    };

    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            if (mapProps) {
                try {
                    mapProps.onSetActiveDrawingTool?.({ tool: null });
                    mapProps.onSelectFeature?.(null);
                } catch (e) {
                    console.warn("Could not reset drawing/selection on unmount:", e);
                }
            }
        };
    }, []);

    const selectedFeatureId = mapProps.selectedFeatureIds?.[0];
    const selectedFeature = useMemo(() => {
        if (!selectedFeatureId) return null;
        return mapProps.plantationFeatures.find(f => f.id === selectedFeatureId);
    }, [selectedFeatureId, mapProps.plantationFeatures]);

    // Trench generation logic inside details
    const handleGenerateSeeds = (feature: LinePlantationFeature) => {
        const spacing = 0.5; // Default 0.5m spacing
        try {
            const coords = typeof feature.geometry === 'string' ? JSON.parse(feature.geometry) : feature.geometry;
            const seedlings = generateSeedlingCoordinates(coords, spacing);
            onUpdateFeature({
                ...feature,
                seedlings: seedlings.map((c, i) => ({ id: `s-${feature.id}-${i}`, lat: c[0], lng: c[1] })),
                status: 'active'
            } as any);
            toast.success(`Generated ${seedlings.length} seeds for ${feature.name}`);
        } catch (e) {
            toast.error("Failed to generate seeds");
        }
    };

    // Sync features for modal usage
    useEffect(() => {
        (window as any).plantationFeatures = mapProps.plantationFeatures;
    }, [mapProps.plantationFeatures]);

    const relevantTasks = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Combine assignments, notes, checkpoints AND drawn features from map labeled for planner or note/checkpoint types
        const drawnPlannerFeatures = mapProps.plantationFeatures
            .filter(f => f.type === 'note' || f.type === 'checkpoint' || (f as any).source === 'planner' || (f as any).source === 'tasks' || (f as any).source === 'remainder')
            .map(f => ({
                id: f.id,
                workName: f.name || `Drawn ${f.type}`,
                date: (f as any).date || todayStr,
                status: (f as any).status || 'planned',
                notes: f.notes || '',
                source: (f as any).source || 'planner',
                unifiedType: f.type === 'note' ? 'note' : f.type === 'checkpoint' ? 'checkpoint' : 'area',
                sectorIds: [f.id]
            }));

        const unifiedList = [
            ...workAssignments.map(w => ({ ...w, unifiedType: 'task' as const })),
            ...notes.map(n => ({ ...n, id: n.id || `note-${Math.random()}`, unifiedType: 'note' as const, workName: n.title || n.name || 'Note', date: n.date || todayStr, status: 'note' })),
            ...checkpoints.map(cp => ({ ...cp, id: cp.id || `cp-${Math.random()}`, unifiedType: 'checkpoint' as const, workName: cp.name || 'Checkpoint', date: cp.date || todayStr, status: 'checkpoint' })),
            ...drawnPlannerFeatures
        ];

        // Deduplicate by ID
        const uniqueList = Array.from(new Map(unifiedList.map(item => [item.id, item])).values());

        const todayLocal = new Date().toLocaleDateString();

        return (uniqueList as any[]).filter(w => {
            const taskDateLocal = new Date(w.date).toLocaleDateString();
            
            if (view === 'calendar') {
                return taskDateLocal === new Date(selectedDate).toLocaleDateString();
            }

            if (dateFilter === 'today') return taskDateLocal === todayLocal;
            if (dateFilter === 'past') {
                const tDate = new Date(w.date);
                tDate.setHours(0,0,0,0);
                const today = new Date();
                today.setHours(0,0,0,0);
                return tDate.getTime() < today.getTime();
            }
            if (dateFilter === 'future') {
                const tDate = new Date(w.date);
                tDate.setHours(0,0,0,0);
                const today = new Date();
                today.setHours(0,0,0,0);
                return tDate.getTime() > today.getTime();
            }
            return true; // all
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [workAssignments, notes, checkpoints, mapProps.plantationFeatures, view, selectedDate, dateFilter]);

    const stats = useMemo(() => {
        const total = workAssignments.length;
        const completed = workAssignments.filter(w => w.status === 'completed').length;
        return { total, completed, pending: total - completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }, [workAssignments]);

    const handleSaveTask = (task: WorkAssignment) => {
        if (editingTask) {
            onSetWorkAssignments(workAssignments.map(w => w.id === task.id ? task : w));
        } else {
            onSetWorkAssignments([...workAssignments, task]);
        }

        // Sync task info back to the linked feature if applicable
        if (task.sectorIds?.[0]) {
            const featureId = task.sectorIds[0];
            const feature = mapProps.plantationFeatures.find(f => f.id === featureId);
            if (feature && (feature as any).source === 'planner') {
                mapProps.onUpdateFeature?.({
                    ...feature,
                    name: (task.workName || feature.name).toUpperCase(),
                    notes: task.notes || feature.notes,
                    date: task.date
                } as any);
            }
        }

        setIsModalOpen(false);
        setEditingTask(null);
    };

    const handleZoomToFeature = (featureId: string) => {
        const feature = mapProps.plantationFeatures.find(f => f.id === featureId);
        if (feature) {
            const geometry = typeof feature.geometry === 'string' ? JSON.parse(feature.geometry) : feature.geometry;
            if (Array.isArray(geometry)) {
                if (Array.isArray(geometry[0])) {
                    // It's a polyline/polygon (area, sector, trench, irrigation_line, boundary, walk, etc.)
                    const validPoints = geometry.filter(p => isValidCoordinate(p)).map(p => [
                        typeof p[0] === 'string' ? parseFloat(p[0]) : p[0],
                        typeof p[1] === 'string' ? parseFloat(p[1]) : p[1]
                    ] as [number, number]);
                    if (validPoints.length > 0) {
                        mapProps.onSetFlyToBounds?.(validPoints);
                    }
                } else if (isValidCoordinate(geometry)) {
                    // It's a single point coordinate (checkpoint, note, seedling, etc.)
                    const lat = typeof geometry[0] === 'string' ? parseFloat(geometry[0]) : geometry[0];
                    const lng = typeof geometry[1] === 'string' ? parseFloat(geometry[1]) : geometry[1];
                    mapProps.onSetMapCenter?.([lat, lng]);
                    mapProps.onSetMapZoom?.(17);
                }
            }
        }
    };

    const handleFeatureDrawnWithModal = (type: any, geometry: any, clickPos?: any) => {
        const featureId = `${type}-${Date.now()}`;
        onFeatureDrawn(type, geometry, clickPos, { source: 'planner', id: featureId });
        setEditingTask({
            id: `work-${Date.now()}`,
            workName: `Task for ${type}`,
            date: new Date().toISOString(),
            status: 'planned',
            assignedEmployeeIds: [],
            notes: '',
            source: 'planner',
            complexity: 'solo',
            plannedTime: 1,
            employeeHours: [],
            sectorIds: [featureId],
            taskType: 'Other'
        });
        setIsModalOpen(true);
    };

    // Filter features for the map based on date and completion
    const filteredFeaturesForMap = useMemo(() => {
        return mapProps.plantationFeatures.map(f => {
            if (mapTheme === 'status') {
                const task = workAssignments.find(w => w.sectorIds?.includes(f.id));
                if (task) {
                    return {
                        ...f,
                        color: task.status === 'completed' ? '#10b981' : task.status === 'active' ? '#f59e0b' : '#6366f1'
                    };
                }
            }
            return f;
        }).filter(f => {
            if (!f) return false;
            let geom: any = null;
            try {
                geom = typeof f.geometry === 'string' ? JSON.parse(f.geometry) : f.geometry;
            } catch (e) {
                return false;
            }
            if (!geom) return false;
            if (f.type === 'seedling' || f.type === 'note' || f.type === 'checkpoint') {
                if (!isValidCoordinate(geom)) return false;
            } else {
                if (!Array.isArray(geom) || geom.length === 0) return false;
                if (!geom.every(p => isValidCoordinate(p))) return false;
            }

            const isFromPlanner = (f as any).source === 'planner' || (f as any).source === 'tasks';
            if (!isFromPlanner) return true;

            // If it's from planner, find its associated task
            const task = workAssignments.find(w => w.sectorIds?.includes(f.id));
            if (task) {
                // If it's a planner task, we check the date if filter is active
                if (mapFilterDate) {
                    const taskDate = task.date.split('T')[0];
                    if (taskDate !== mapFilterDate) return false;
                }
            }
            return true;
        });
    }, [mapProps.plantationFeatures, workAssignments, mapFilterDate, mapTheme]);

    return (
        <main className="flex-1 bg-slate-50 overflow-hidden flex flex-col md:flex-row h-full">
            {/* Sidebar: Tasks & Controls */}
            <div 
                className={`w-full bg-white border-r border-slate-200 flex flex-col shadow-xl z-10 transition-all ${view === 'map' ? 'h-auto md:h-full' : 'h-full md:h-full'}`}
                style={{
                    width: typeof window !== 'undefined' && window.innerWidth > 768 ? `${sidebarWidth}px` : undefined,
                    maxWidth: '85vw'
                }}
            >
                <div className={`p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-6 ${view === 'map' ? 'hidden md:flex' : 'flex'}`}>
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none text-slate-900">PLANNER</h2>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Precision Agriculture Sync</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setView('map')} 
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-[9.5px] font-black uppercase tracking-widest border border-indigo-500"
                                title="Switch to Map"
                            >
                                <MapIcon className="h-4 w-4 shrink-0" />
                                <span>Switch to Map</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => onSetActiveDrawingTool({...activeDrawingTool, tool: 'note'})}
                                className="flex-1 py-3 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all flex flex-col items-center gap-1 shadow-sm"
                            >
                                <MapPinIcon size={16} className="text-rose-500" /> New Note
                            </button>
                            <button 
                                onClick={() => onSetActiveDrawingTool({...activeDrawingTool, tool: 'checkpoint'})}
                                className="flex-1 py-3 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all flex flex-col items-center gap-1 shadow-sm"
                            >
                                <BellIcon size={16} className="text-violet-500" /> Checkpoint
                            </button>
                            {isTrackingWalk ? (
                                <button 
                                    onClick={handleCancelTrackedWalk}
                                    className="flex-1 py-3 px-4 bg-red-50 border border-red-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 transition-all flex flex-col items-center justify-center gap-1 shadow-sm animate-pulse"
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping mb-0.5 shrink-0" />
                                    Cancel Walk
                                </button>
                            ) : (
                                <button 
                                    onClick={() => {
                                        setIsTrackingWalk(true);
                                        const c = mapProps.center;
                                        let centerPoint: [number, number] = [42.14, 42.0];
                                        if (c && Array.isArray(c) && c.length === 2) {
                                            const lat = typeof c[0] === 'string' ? parseFloat(c[0]) : c[0];
                                            const lng = typeof c[1] === 'string' ? parseFloat(c[1]) : c[1];
                                            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                                centerPoint = [lat, lng];
                                            }
                                        }
                                        setTrackedPath([centerPoint]);
                                        toast.success("Walk tracking started! Press 'Simulate Step' or walk to record position.");
                                    }}
                                    className="flex-1 py-3 px-4 bg-orange-50 border border-orange-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-orange-700 hover:bg-orange-100/50 transition-all flex flex-col items-center gap-1 shadow-sm border-dashed"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H19V11H13V5ZM13 13H19V19H13V13ZM5 5H11V11H5V5ZM5 13H11V19H5V13Z" />
                                    </svg>
                                    Track Walk
                                </button>
                            )}
                        </div>

                        {isTrackingWalk && (
                            <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-3xl shadow-sm space-y-3 animate-in slide-in-from-top duration-300">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-600"></span>
                                        </span>
                                        <h4 className="text-[9px] font-black text-orange-850 uppercase tracking-widest">Walk Session Tracking</h4>
                                    </div>
                                    <span className="text-[9px] font-mono text-slate-500 font-bold bg-white px-2 py-0.5 rounded-lg shadow-sm border border-slate-100">{trackedPath.length} points</span>
                                </div>
                                <p className="text-[9px] text-orange-700/80 font-bold uppercase tracking-tight">
                                    Simulating GPS movement local state only. Walk or trigger simulation steps.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSimulateStep}
                                        className="flex-1 py-2.5 bg-white border border-orange-200 text-orange-750 rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-sm hover:bg-orange-100/50 active:scale-95 transition-all flex items-center justify-center gap-1"
                                    >
                                        Simulate Step
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveTrackedWalk}
                                        className="flex-1 py-2.5 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-md shadow-orange-600/20 hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-1"
                                    >
                                        Stop & Save
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Progress</p>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-black text-slate-800">{stats.percent}%</span>
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${stats.percent}%` }} />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending</p>
                            <span className="text-2xl font-black text-slate-800">{stats.pending}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-100 flex gap-2 bg-white sticky top-0 z-20">
                    <button onClick={() => setView('list')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${view === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <RectangleStackIcon className="h-4 w-4"/> List
                    </button>
                    <button onClick={() => setView('calendar')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${view === 'calendar' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <CalendarDaysIcon className="h-4 w-4"/> Calendar
                    </button>
                    <button onClick={() => setView('map')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${view === 'map' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <MapIcon className="h-4 w-4"/> Map
                    </button>
                </div>

                <div className={`px-6 py-2 border-b border-slate-50 flex items-center justify-between ${view === 'map' ? 'hidden md:flex' : 'flex'}`}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Map Theme</span>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setMapTheme('default')}
                            className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${mapTheme === 'default' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            Default
                        </button>
                        <button 
                            onClick={() => setMapTheme('status')}
                            className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${mapTheme === 'status' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            Status
                        </button>
                    </div>
                </div>

                {view === 'list' && (
                    <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-hide border-b border-slate-50">
                        {[
                            { id: 'past', label: 'Past' },
                            { id: 'today', label: 'Today' },
                            { id: 'future', label: 'Future' },
                            { id: 'all', label: 'All' }
                        ].map(f => (
                            <button 
                                key={f.id}
                                onClick={() => setDateFilter(f.id as any)}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${dateFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className={`flex-grow overflow-y-auto p-6 space-y-4 ${view === 'map' ? 'hidden md:block' : ''}`}>
                    {selectedFeature ? (
                        <div className="space-y-6 animate-in slide-in-from-left duration-300">
                            <button 
                                onClick={() => onSelectFeature(null)}
                                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 mb-4"
                            >
                                <ChevronLeftIcon className="h-4 w-4" /> Back to Task List
                            </button>

                            <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                                <div className="relative z-10">
                                    <span className="px-3 py-1 bg-white/10 rounded-full text-[8px] font-black uppercase tracking-widest text-white/60 mb-3 inline-block border border-white/5">{selectedFeature.type}</span>
                                    <h3 className="text-2xl font-black italic tracking-tight uppercase leading-none">{selectedFeature.name || 'Unnamed Feature'}</h3>
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-2">{selectedFeature.id}</p>
                                </div>
                                <MapPinIcon className="absolute -right-8 -bottom-8 h-40 w-40 text-white/5 rotate-12" />
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                        <span className="text-sm font-black uppercase italic text-indigo-600">{(selectedFeature as any).status || 'Planned'}</span>
                                    </div>
                                    {selectedFeature.type === 'line' && (
                                        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Length</p>
                                            <span className="text-sm font-black uppercase italic text-slate-800">{(selectedFeature as any).lengthMeters?.toFixed(1) || '0.0'} m</span>
                                        </div>
                                    )}
                                    {selectedFeature.type === 'area' && (
                                        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Area</p>
                                            <span className="text-sm font-black uppercase italic text-slate-800">{(selectedFeature as any).areaHa?.toFixed(4) || '0.0'} ha</span>
                                        </div>
                                    )}
                                </div>

                                {selectedFeature.type === 'line' && (selectedFeature as any).lineType === 'row' && (
                                    <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Trench Operations</h4>
                                                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-tight">Generate seedlings along this line</p>
                                            </div>
                                            <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-500">
                                                <PlusCircleIcon className="h-5 w-5" />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleGenerateSeeds(selectedFeature as LinePlantationFeature)}
                                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
                                        >
                                            Generate Seeds
                                        </button>
                                        {(selectedFeature as any).seedlings && (
                                            <div className="flex items-center gap-2 pt-2 border-t border-emerald-100/50">
                                                <CheckIcon className="h-4 w-4 text-emerald-500" />
                                                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">{(selectedFeature as any).seedlings.length} seeds active</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedFeature.notes && (
                                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem]">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Notes</label>
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed italic">"{selectedFeature.notes}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {view === 'calendar' && (
                                <div className="mb-6">
                                    <CalendarGrid 
                                        currentDate={calendarMonth} 
                                        setCurrentDate={setCalendarMonth} 
                                        tasks={workAssignments} 
                                        selectedDate={selectedDate}
                                        onDateSelect={setSelectedDate}
                                    />
                                </div>
                            )}

                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {view === 'list' ? 'Active Tasks' : `Tasks for ${new Date(selectedDate).toLocaleDateString()}`}
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setIsSelectionMode(!isSelectionMode);
                                            if (isSelectionMode) setSelectedTasksForBatch([]);
                                        }}
                                        className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                                            isSelectionMode 
                                            ? 'bg-emerald-100 text-emerald-800' 
                                            : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <CheckSquare size={12} />
                                        <span>{isSelectionMode ? 'Cancel Selection' : 'Multi-Select for Chat'}</span>
                                    </button>
                                </div>

                                {/* Floating Batch Actions Bar */}
                                {isSelectionMode && selectedTasksForBatch.length > 0 && (
                                    <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl shadow-xl flex items-center justify-between gap-2 animate-in slide-in-from-top duration-200">
                                        <div className="text-[10px] font-black uppercase tracking-wider pl-2">
                                            {selectedTasksForBatch.length} Selected
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleShareBatchTasks(false)}
                                                className="px-3 py-1.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                                            >
                                                <MessageSquare size={12} className="text-emerald-600" />
                                                <span>Share to Google Chat</span>
                                            </button>
                                            <button
                                                onClick={() => handleShareBatchTasks(true)}
                                                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                                                title="Share and Attach Instant Google Meet"
                                            >
                                                <Video size={12} />
                                                <span>Chat + Meet</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {relevantTasks
                                    .filter(t => t.status !== 'completed' && t.status !== 'note' && t.status !== 'checkpoint')
                                    .map(task => {
                                    const linkedId = task.sectorIds?.[0];
                                    const isActive = task.status === 'active';
                                    const isSelected = selectedTasksForBatch.includes(task.id);
                                    return (
                                        <div 
                                            key={task.id} 
                                            onMouseEnter={() => linkedId && setHighlightedIds([linkedId])}
                                            onMouseLeave={() => setHighlightedIds([])}
                                            className={`group p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all relative overflow-hidden ${isActive ? 'ring-2 ring-amber-400 ring-offset-2' : ''} ${isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''}`}
                                        >
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="flex gap-4 items-start">
                                                    {isSelectionMode ? (
                                                        <button
                                                            onClick={() => toggleTaskSelection(task.id)}
                                                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all mt-1 ${
                                                                isSelected 
                                                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                                                                : 'border-slate-300 hover:border-emerald-500 bg-white'
                                                            }`}
                                                        >
                                                            {isSelected && <CheckIcon className="h-3.5 w-3.5 stroke-[3]" />}
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => onSetWorkAssignments(workAssignments.map(w => w.id === task.id ? { ...w, status: 'completed' } : w))}
                                                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all border-slate-200 hover:border-emerald-500`}
                                                        >
                                                            <CheckIcon className="h-4 w-4 text-slate-300"/>
                                                        </button>
                                                    )}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-sm font-black uppercase tracking-tight text-slate-800">{renderSafeText(task.workName)}</h4>
                                                            {isActive && <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                                <CalendarDaysIcon className="h-3 w-3"/> {new Date(task.date).toLocaleDateString()}
                                                            </span>
                                                            {linkedId && (
                                                                <button onClick={() => onSelectFeature(linkedId)} className="text-[10px] font-bold text-indigo-500 flex items-center gap-1 hover:underline">
                                                                    <MapPinIcon className="h-3 w-3"/> Linked
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1.5 items-end">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleShareSingleTask(task, false)}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-xs"
                                                            title="Share Task to Google Chat"
                                                        >
                                                            <MessageSquare size={12} />
                                                            <span className="hidden sm:inline">Chat</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleShareSingleTask(task, true)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-xs"
                                                            title="Discuss Task via Google Meet Video"
                                                        >
                                                            <Video size={12} />
                                                            <span className="hidden sm:inline">Meet</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => onSetWorkAssignments(workAssignments.map(w => w.id === task.id ? { ...w, status: isActive ? 'planned' : 'active' } : w))}
                                                            className={`p-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-600'}`}
                                                        >
                                                            {isActive ? 'Pause' : 'Start'}
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        {linkedId && (
                                                            <button onClick={() => handleZoomToFeature(linkedId)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><MapPinIcon className="h-4 w-4"/></button>
                                                        )}
                                                        <button onClick={() => { setEditingTask(task); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"><PlusCircleIcon className="h-4 w-4 rotate-45"/></button>
                                                        <button onClick={() => onSetWorkAssignments(workAssignments.filter(w => w.id !== task.id))} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><TrashIcon className="h-4 w-4"/></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Informational items (Notes/Checkpoints) */}
                                {relevantTasks.filter(t => t.status === 'note' || t.status === 'checkpoint').map(task => {
                                    const linkedFeature = task.sectorIds?.[0] ? mapProps.plantationFeatures.find(f => f.id === task.sectorIds![0]) : null;
                                    return (
                                        <div 
                                            key={task.id} 
                                            className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-white hover:border-indigo-100 transition-all"
                                            onClick={() => task.sectorIds?.[0] && onSelectFeature(task.sectorIds[0])}
                                        >
                                            {task.status === 'note' ? <RectangleStackIcon className="h-4 w-4 text-indigo-400"/> : <BellIcon className="h-4 w-4 text-violet-400"/>}
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black uppercase text-slate-600">{renderSafeText(task.workName)}</p>
                                                <p className="text-[9px] text-slate-400">{new Date(task.date).toLocaleDateString()}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {linkedFeature && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleShareFeatureNote(linkedFeature);
                                                        }}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg text-[9px] font-black flex items-center gap-1"
                                                        title="Share Note to Google Chat"
                                                    >
                                                        <MessageSquare size={12} />
                                                    </button>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); task.sectorIds?.[0] && handleZoomToFeature(task.sectorIds[0]); }} className="p-2 text-slate-300 hover:text-indigo-400" title={isKa ? "რუკაზე ჩვენება" : "Locate on Map"}><MapPinIcon size={14}/></button>
                                                {task.sectorIds?.[0] && (
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            if (task.sectorIds?.[0] && onDeleteFeature) {
                                                                onDeleteFeature([task.sectorIds[0]]);
                                                            }
                                                            onSetWorkAssignments(workAssignments.map(w => w.id === task.id ? { ...w, sectorIds: [] } : w));
                                                            toast.success(isKa ? "მარკერი წაიშალა რუკიდან (ჩანაწერი შენარჩუნებულია)" : "Marker removed from map (Task kept).");
                                                        }} 
                                                        className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-amber-50"
                                                        title={isKa ? "რუკიდან მოხსნა" : "Remove marker from map"}
                                                    >
                                                        <EyeOff size={14}/>
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if (task.sectorIds?.[0] && onDeleteFeature) {
                                                            onDeleteFeature([task.sectorIds[0]]);
                                                        }
                                                        onSetWorkAssignments(workAssignments.filter(w => w.id !== task.id));
                                                        toast.success(isKa ? "დავალება და რუკის მარკერი წაიშალა." : "Task and map marker deleted.");
                                                    }} 
                                                    className="p-2 text-slate-300 hover:text-red-500"
                                                    title={isKa ? "წაშლა (რუკიდან & სიიდან)" : "Delete Task & Map Marker"}
                                                >
                                                    <TrashIcon size={14}/>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Completed Tasks Section */}
                                <div className="pt-6 border-t border-slate-50">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 mb-3">Completed Tasks</h3>
                                    <div className="space-y-2">
                                        {relevantTasks.filter(t => t.status === 'completed').map(task => (
                                            <div key={task.id} className="p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-2xl flex items-center gap-3 group opacity-70 hover:opacity-100 transition-all">
                                                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                                    <CheckIcon className="h-3 w-3"/>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-black uppercase text-slate-500 line-through">{renderSafeText(task.workName)}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Done at {new Date(task.date).toLocaleDateString()}</p>
                                                </div>
                                                <button 
                                                    onClick={() => onSetWorkAssignments(workAssignments.map(w => w.id === task.id ? { ...w, status: 'planned' } : w))}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-indigo-500 transition-all text-[8px] font-black uppercase tracking-widest"
                                                >
                                                    Restore
                                                </button>
                                            </div>
                                        ))}
                                        {relevantTasks.filter(t => t.status === 'completed').length === 0 && (
                                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-center py-4">No completed records</p>
                                        )}
                                    </div>
                                </div>

                                {relevantTasks.length === 0 && (
                                    <div className="text-center py-12 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                        <CheckIcon className="h-12 w-12 mx-auto text-slate-200 mb-2"/>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No tasks found</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Resizable Divider between Planner Sidebar and Map */}
            <ResizableDivider 
                direction="horizontal"
                currentSize={sidebarWidth}
                onResize={(newWidth) => setSidebarWidth(newWidth)}
                minSize={280}
                maxSize={typeof window !== 'undefined' ? Math.max(window.innerWidth - 300, 600) : 800}
                storageKey="planner_sidebar_width"
                isKa={language === 'ka'}
                className="hidden md:flex"
            />

            {/* Main Content: Map */}
            <div className={`flex-1 relative bg-slate-200 ${view !== 'map' ? 'hidden md:block' : 'block'}`}>
                <MapComponent 
                    {...mapProps} 
                    plantationFeatures={filteredFeaturesForMap}
                    showSearch={true} 
                    activeDrawingTool={activeDrawingTool}
                    highlightedFeatureIds={highlightedIds}
                    onFeatureDrawn={handleFeatureDrawnWithModal}
                    onSetActiveDrawingTool={onSetActiveDrawingTool}
                    onUpdateFeature={onUpdateFeature}
                    onDeleteFeature={onDeleteFeature}
                >
                    {isTrackingWalk && trackedPath.filter(isValidCoordinate).length >= 2 && (
                        <Polyline 
                            positions={trackedPath.filter(isValidCoordinate).map(p => [
                                typeof p[0] === 'string' ? parseFloat(p[0]) : p[0],
                                typeof p[1] === 'string' ? parseFloat(p[1]) : p[1]
                            ] as [number, number])} 
                            pathOptions={{ color: '#f97316', weight: 6, dashArray: '8, 8', lineCap: 'round', lineJoin: 'round' }} 
                        />
                    )}
                </MapComponent>

                {/* Date Choice Overlay */}
                <div className="absolute bottom-10 left-10 z-[1001] bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-3xl p-4 flex flex-col gap-2 min-w-[200px]">
                    <div className="flex justify-between items-center">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Map View Date</h4>
                        <button onClick={() => setMapFilterDate(null)} className="text-[8px] font-black text-blue-600 uppercase">Clear</button>
                    </div>
                    <div className="flex items-center gap-3">
                        <CalendarDaysIcon className="h-4 w-4 text-indigo-600" />
                        <input 
                            type="date" 
                            value={mapFilterDate || ''} 
                            onChange={(e) => setMapFilterDate(e.target.value)} 
                            className="text-xs font-black text-slate-800 bg-transparent outline-none flex-1"
                        />
                    </div>
                </div>

                {/* Relocated Floating Toolbar - Now at the Bottom */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-3xl p-1.5 animate-in fade-in slide-in-from-bottom-4">
                    <button onClick={() => onSetActiveDrawingTool({...activeDrawingTool, tool: activeDrawingTool.tool === 'note' ? null : 'note'})} className={`p-3 rounded-2xl transition-all ${activeDrawingTool.tool === 'note' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-600'}`} title="Add Note"><MapPinIcon size={20}/></button>
                    <button onClick={() => onSetActiveDrawingTool({...activeDrawingTool, tool: activeDrawingTool.tool === 'checkpoint' ? null : 'checkpoint'})} className={`p-3 rounded-2xl transition-all ${activeDrawingTool.tool === 'checkpoint' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-600'}`} title="Add Checkpoint"><BellIcon size={20}/></button>
                    <button onClick={() => onSetActiveDrawingTool({...activeDrawingTool, tool: activeDrawingTool.tool === 'area' ? null : 'area'})} className={`p-3 rounded-2xl transition-all ${activeDrawingTool.tool === 'area' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-600'}`} title="Draw Area"><RectangleGroupIcon size={20}/></button>
                </div>

                {/* AI Assistant */}
                <div className="absolute bottom-8 right-8 z-[1001]">
                    <ModuleAiAssistant 
                        onSendCommand={handleSendCommand} 
                        isLoading={isAssistantLoading} 
                        context={{ workAssignments, alerts }}
                        title="Planner AI"
                        placeholder="Ask anything about your schedule..."
                    />
                </div>
            </div>

            {isModalOpen && (
                <TaskModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSaveTask} 
                    task={editingTask} 
                    employees={employees} 
                    checkpoints={checkpoints}
                    onSendCommand={handleSendCommand}
                    isAiLoading={isAssistantLoading}
                />
            )}

            {isShareModalOpen && sharePayload && (
                <ShareToGoogleChatModal
                    isOpen={isShareModalOpen}
                    onClose={() => {
                        setIsShareModalOpen(false);
                        setSharePayload(null);
                    }}
                    title={shareTitle}
                    moduleName="Planner & Operations"
                    itemsSummary={<span className="text-xs font-semibold text-slate-700">{shareTitle}</span>}
                    formattedPayload={sharePayload}
                    currentUser={currentUser}
                />
            )}
        </main>
    );
};

export default PlannerAndRemainderView;
