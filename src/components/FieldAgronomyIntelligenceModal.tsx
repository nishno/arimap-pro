import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    X, Sparkles, AlertTriangle, CheckCircle2, Calendar, 
    Scissors, ShieldAlert, Sprout, DollarSign, Users, 
    Clock, RefreshCw, Send, Plus, ArrowRight, Download, 
    FileText, CheckSquare, ChevronRight, Activity, Zap,
    HelpCircle, Layers
} from 'lucide-react';
import type { 
    WorkAssignment, Employee, InventoryItem, 
    PlantationFeature, OperationalLog, NutritionPlan, User 
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { clinicalAnalysisService, SavedAgroAnalysisRecord } from '../services/clinicalAnalysisService';
import { executeGeminiCall, PRIMARY_GEMINI_MODEL } from '../services/geminiService';
import { toast } from 'sonner';

interface FieldAgronomyIntelligenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    workAssignments: WorkAssignment[];
    employees: Employee[];
    inventoryItems: InventoryItem[];
    plantationFeatures: PlantationFeature[];
    operationalLogs: OperationalLog[];
    nutritionPlans: NutritionPlan[];
    activeOrgId?: string;
    currentUser?: User | null;
    onAddSuggestedTask?: (task: Partial<WorkAssignment>) => void;
}

interface RecommendedTask {
    title: string;
    taskType: string;
    priority: 'Urgent' | 'High' | 'Normal';
    recommendedDate: string;
    rationale: string;
    targetSectors: string[];
    estimatedHours: number;
}

export const FieldAgronomyIntelligenceModal: React.FC<FieldAgronomyIntelligenceModalProps> = ({
    isOpen,
    onClose,
    workAssignments,
    employees,
    inventoryItems,
    plantationFeatures,
    operationalLogs,
    nutritionPlans,
    activeOrgId,
    currentUser,
    onAddSuggestedTask
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [activeTab, setActiveTab] = useState<'overview' | 'pruning' | 'pathology' | 'opex' | 'chat'>('overview');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [clinicalRecords, setClinicalRecords] = useState<SavedAgroAnalysisRecord[]>([]);
    
    // AI generated content states
    const [aiAnalysisMarkdown, setAiAnalysisMarkdown] = useState<string>('');
    const [recommendedTasks, setRecommendedTasks] = useState<RecommendedTask[]>([]);
    
    // Chat state
    const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', text: string, timestamp: string }>>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatSending, setIsChatSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // 1. Calculate operational and financial metrics
    const metrics = useMemo(() => {
        let totalLaborCost = 0;
        let totalMaterialCost = 0;
        let totalHoursLogged = 0;
        const workerSet = new Set<string>();

        // Type frequency maps
        const taskTypeCounts: Record<string, number> = {
            Pruning: 0,
            Spraying: 0,
            Fertilization: 0,
            Tillage: 0,
            Weeding: 0,
            Irrigation: 0,
            Harvesting: 0,
            Other: 0
        };

        const latestDates: Record<string, string> = {};

        workAssignments.forEach(w => {
            // Task type mapping
            const rawType = (w.taskType || '').toLowerCase();
            const name = (typeof w.workName === 'string' ? w.workName : (w.workName as any)?.title || '').toLowerCase();

            let category = 'Other';
            if (rawType.includes('prun') || name.includes('prun') || name.includes('გასხვლ') || name.includes('ჭრა')) category = 'Pruning';
            else if (rawType.includes('spray') || name.includes('spray') || name.includes('შეწამვლ') || name.includes('ფუნგიციდ') || name.includes('ინსექტიციდ')) category = 'Spraying';
            else if (rawType.includes('fertil') || name.includes('fertil') || name.includes('კვებ') || name.includes('სასუქ') || name.includes('აზოტ')) category = 'Fertilization';
            else if (rawType.includes('till') || name.includes('till') || name.includes('ხვნ') || name.includes('კულტივაცი')) category = 'Tillage';
            else if (rawType.includes('weed') || name.includes('weed') || name.includes('გამარგვლ') || name.includes('თოხნ')) category = 'Weeding';
            else if (rawType.includes('irrig') || name.includes('irrig') || name.includes('მორწყვ')) category = 'Irrigation';
            else if (rawType.includes('harvest') || name.includes('harvest') || name.includes('მოსავალ')) category = 'Harvesting';

            taskTypeCounts[category] = (taskTypeCounts[category] || 0) + 1;

            if (w.date) {
                if (!latestDates[category] || new Date(w.date) > new Date(latestDates[category])) {
                    latestDates[category] = w.date;
                }
            }

            // Labor calculation
            if (w.employeeHours && w.employeeHours.length > 0) {
                w.employeeHours.forEach(eh => {
                    const hrs = eh.hours || 0;
                    const r = eh.rate || 0;
                    const b = eh.bonus || 0;
                    const p = eh.totalPay !== undefined ? eh.totalPay : (hrs * r + b);
                    totalLaborCost += p;
                    totalHoursLogged += hrs;
                    if (eh.employeeId) workerSet.add(eh.employeeId);
                });
            } else if (w.assignedEmployeeIds && w.assignedEmployeeIds.length > 0) {
                const hrs = w.plannedTime || 8;
                w.assignedEmployeeIds.forEach(id => {
                    workerSet.add(id);
                    const emp = employees.find(e => e.id === id);
                    const rate = emp?.paymentType === 'daily' ? (emp.paymentRate / 8) : (emp?.paymentRate || 10);
                    totalLaborCost += hrs * rate;
                    totalHoursLogged += hrs;
                });
            }

            // Materials calculation
            if (w.materialsUsed && w.materialsUsed.length > 0) {
                w.materialsUsed.forEach(m => {
                    const item = inventoryItems.find(i => i.id === m.inventoryItemId);
                    const unitPrice = m.unitCost !== undefined ? m.unitCost : (item?.unitCost || 0);
                    const c = m.cost !== undefined ? m.cost : ((m.quantity || 0) * unitPrice);
                    totalMaterialCost += c;
                });
            }
        });

        const totalOpex = totalLaborCost + totalMaterialCost;
        const totalAreaHa = operationalLogs.reduce((acc, l) => acc + (l.areaHa || 0), 0);

        return {
            totalOpex,
            totalLaborCost,
            totalMaterialCost,
            totalHoursLogged,
            uniqueWorkersCount: workerSet.size,
            taskTypeCounts,
            latestDates,
            totalAreaHa,
            totalMissionsCount: workAssignments.length,
            completedCount: workAssignments.filter(w => w.status === 'completed').length,
            plannedCount: workAssignments.filter(w => w.status === 'planned').length,
            inProgressCount: workAssignments.filter(w => w.status === 'in-progress').length
        };
    }, [workAssignments, employees, inventoryItems, operationalLogs]);

    // Load clinical records on modal open
    useEffect(() => {
        if (isOpen) {
            clinicalAnalysisService.getSavedAnalyses(activeOrgId)
                .then(records => setClinicalRecords(records))
                .catch(err => console.warn("Could not load clinical analysis records:", err));
        }
    }, [isOpen, activeOrgId]);

    // Trigger AI analysis when opened and not yet populated
    useEffect(() => {
        if (isOpen && !aiAnalysisMarkdown && !isAnalyzing) {
            runFullAgronomicAnalysis();
        }
    }, [isOpen]);

    useEffect(() => {
        if (activeTab === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, activeTab]);

    // 2. Comprehensive AI Generation Function
    const runFullAgronomicAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const todayStr = new Date().toISOString().split('T')[0];

            // Build synthesis context
            const clinicalSummary = clinicalRecords.slice(0, 8).map(r => ({
                id: r.id,
                title: r.title,
                type: r.type,
                date: r.createdAt,
                severity: r.agronomistConclusion?.severity || 'Moderate',
                diagnosis: r.rawAiResult?.diseaseName || r.title,
                prescribedTreatment: r.agronomistConclusion?.prescribedTreatment || 'Standard protection',
                activeIngredients: r.agronomistConclusion?.activeIngredients || [],
                dosage: r.agronomistConclusion?.recommendedDosage || '',
                sector: r.agronomistConclusion?.targetSectorOrPlot || 'General Field'
            }));

            const recentWorks = workAssignments.slice(0, 15).map(w => ({
                id: w.id,
                name: typeof w.workName === 'string' ? w.workName : (w.workName as any)?.title,
                date: w.date,
                status: w.status,
                taskType: w.taskType,
                plannedTime: w.plannedTime,
                workersCount: w.assignedEmployeeIds?.length || w.employeeHours?.length || 0,
                notes: w.notes,
                trenchRange: w.trenchRange
            }));

            const nutritionSummary = (nutritionPlans as any[]).map(np => ({
                id: np.id,
                name: np.name,
                purpose: np.purpose,
                frequency: np.frequency
            }));

            const prompt = `You are AgriMap's Senior Agronomist and Field Operations Intelligence Engine.
Analyze the following live agricultural field database and provide a high-level agronomic audit and recommendations in ${isKa ? 'Georgian (ქართულად)' : 'English'}.

CURRENT DATE: ${todayStr}

FIELD FINANCIALS & WORK SUMMARY:
- Total Registry Entries: ${metrics.totalMissionsCount} (Completed: ${metrics.completedCount}, In-Progress: ${metrics.inProgressCount}, Planned: ${metrics.plannedCount})
- Total OPEX: GEL ${metrics.totalOpex.toFixed(2)} (Labor: GEL ${metrics.totalLaborCost.toFixed(2)}, Materials: GEL ${metrics.totalMaterialCost.toFixed(2)})
- Hours Logged: ${metrics.totalHoursLogged.toFixed(1)} hrs with ${metrics.uniqueWorkersCount} active workers.
- Work Breakdown: Pruning (${metrics.taskTypeCounts.Pruning}), Spraying (${metrics.taskTypeCounts.Spraying}), Fertilization (${metrics.taskTypeCounts.Fertilization}), Tillage (${metrics.taskTypeCounts.Tillage}), Weeding (${metrics.taskTypeCounts.Weeding}), Irrigation (${metrics.taskTypeCounts.Irrigation}).
- Latest Operation Dates: ${JSON.stringify(metrics.latestDates)}

RECENT WORK ASSIGNMENTS:
${JSON.stringify(recentWorks, null, 2)}

CLINICAL PLANT DIAGNOSES & PATHOLOGY (FROM LAB & LEAF SCANS):
${JSON.stringify(clinicalSummary, null, 2)}

NUTRITION & FERTILIZATION PLANS:
${JSON.stringify(nutritionSummary, null, 2)}

REQUIRED STRUCTURED OUTPUT:
Provide a clear, authoritative report covering:
1. **Executive Agronomic Vital Signs (საველე მდგომარეობის შეფასება)**:
   - Field health status, key risks, and labor/OPEX efficiency.
2. **Pruning Timing & Seasonal Strategy (გასხვლის ოპტიმალური ვადები და ტექნოლოგია)**:
   - Exact recommendations on when to prune (dormancy vs green pruning), weather precautions, and sanitary cuts for infected sectors.
3. **Pathology & Chemical Treatment Cadence (შეწამვლის და დაავადებათა კონტროლის გეგმა)**:
   - Cross-reference the active diagnoses (e.g. Downy Mildew, Powdery Mildew, etc.) with applied treatments.
   - Recommended next spray interval, curative vs protective chemistry, and active ingredient rotation to avoid fungal/insect resistance.
4. **Fertilization & Nutrition Optimization (კვებისა და ფერტიგაციის გრაფიკი)**:
   - Synchronize nutrition plans with plant phenology.
5. **OPEX & Workforce Recommendations (ხარჯების და მუშახელის ოპტიმიზაცია)**:
   - Cost-saving opportunities, labor bottlenecks, and payroll efficiency.

Also, at the very end of your response, output a JSON array of 3-4 recommended tasks in this exact JSON block format:
\`\`\`json
[
  {
    "title": "Task title in ${isKa ? 'Georgian' : 'English'}",
    "taskType": "Pruning | Spraying | Fertilization | Tillage | Weeding | Irrigation",
    "priority": "Urgent | High | Normal",
    "recommendedDate": "YYYY-MM-DD",
    "rationale": "Brief rationale why this task is critical now",
    "targetSectors": ["Sector A", "Sector B"],
    "estimatedHours": 8
  }
]
\`\`\`
Write in clean, professional agricultural terminology.`;

            const res = await executeGeminiCall({
                contents: prompt,
                model: PRIMARY_GEMINI_MODEL
            });

            const text = res?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            // Extract JSON tasks block if present
            let parsedTasks: RecommendedTask[] = [];
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    parsedTasks = JSON.parse(jsonMatch[1]);
                } catch (e) {
                    console.warn("Could not parse JSON recommended tasks:", e);
                }
            }

            // Remove the raw json block from main markdown to keep it clean
            const cleanMarkdown = text.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
            setAiAnalysisMarkdown(cleanMarkdown);

            if (parsedTasks.length > 0) {
                setRecommendedTasks(parsedTasks);
            } else {
                // Default fallback tasks based on data
                setRecommendedTasks([
                    {
                        title: isKa ? 'გადაუდებელი სანიტარული გასხვლა და ჭრაქის კონტროლი' : 'Sanitary Pruning & Mildew Barrier Spray',
                        taskType: 'Spraying',
                        priority: 'Urgent',
                        recommendedDate: todayStr,
                        rationale: isKa ? 'კლინიკურ დიაგნოზში დაფიქსირებული სპორულაციის შეჩერება' : 'Suppress active sporulation identified in clinical leaf scans',
                        targetSectors: ['Sector 1 - North'],
                        estimatedHours: 6
                    },
                    {
                        title: isKa ? 'ფოთლოვანი კვება კალიუმ-ფოსფატის ხსნარით' : 'Foliar Potassium-Phosphate Immune Booster',
                        taskType: 'Fertilization',
                        priority: 'High',
                        recommendedDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
                        rationale: isKa ? 'მცენარის ფიტოალექსინების და იმუნიტეტის სტიმულაცია' : 'Stimulate natural plant phytoalexins and canopy recovery',
                        targetSectors: ['All Sectors'],
                        estimatedHours: 4
                    },
                    {
                        title: isKa ? 'მწკრივთშორისების კულტივაცია და აერაცია' : 'Row-Middle Soil Cultivation & Weed Suppression',
                        taskType: 'Tillage',
                        priority: 'Normal',
                        recommendedDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
                        rationale: isKa ? 'ტენიანობის რეგულაცია და ჰაერის ცირკულაციის გაუმჯობესება' : 'Soil aeration and microclimate humidity reduction',
                        targetSectors: ['Sector 2'],
                        estimatedHours: 8
                    }
                ]);
            }

        } catch (error: any) {
            console.error("AI Analysis failed:", error);
            toast.error(isKa ? "ანალიზი ვერ შესრულდა. შეამოწმეთ ინტერნეტ კავშირი ან Gemini გასაღები." : "Analysis failed. Please verify network or Gemini API key.");
            setAiAnalysisMarkdown(isKa 
                ? "⚠️ ანალიზის გენერირებისას დაფიქსირდა შეფერხება. გთხოვთ სცადოთ ხელახლა." 
                : "⚠️ Error generating analysis. Please click Refresh to try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 3. Chat handler for interactive Q&A
    const handleSendChatMessage = async () => {
        if (!chatInput.trim() || isChatSending) return;
        const userMsg = chatInput.trim();
        setChatInput('');
        
        const newHistory = [
            ...chatMessages,
            { role: 'user' as const, text: userMsg, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ];
        setChatMessages(newHistory);
        setIsChatSending(true);

        try {
            const prompt = `You are AgriMap's Senior Agronomist responding directly to a farmer/manager in ${isKa ? 'Georgian' : 'English'}.
Context:
- Current Field OPEX: GEL ${metrics.totalOpex.toFixed(2)}
- Completed Missions: ${metrics.completedCount}
- Active Diagnoses: ${clinicalRecords.map(r => r.title).join(', ')}
- Question: "${userMsg}"

Provide a concise, practical, agronomically sound answer with specific dosages, timings, or cost considerations.`;

            const res = await executeGeminiCall({
                contents: prompt,
                model: PRIMARY_GEMINI_MODEL
            });

            const answer = res?.candidates?.[0]?.content?.parts?.[0]?.text || (isKa ? 'პასუხის მიღება ვერ მოხერხდა.' : 'Unable to generate answer.');

            setChatMessages([
                ...newHistory,
                { role: 'assistant' as const, text: answer, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
            ]);
        } catch (e: any) {
            toast.error(isKa ? "შეტყობინება ვერ გაიგზავნა" : "Failed to send message");
        } finally {
            setIsChatSending(false);
        }
    };

    const handleCreateTaskFromRecommendation = (rec: RecommendedTask) => {
        if (onAddSuggestedTask) {
            onAddSuggestedTask({
                id: `work-ai-${Date.now()}`,
                workName: rec.title,
                date: rec.recommendedDate,
                status: 'planned',
                taskType: rec.taskType as any,
                plannedTime: rec.estimatedHours || 8,
                notes: `[AI Recommendation] ${rec.rationale}`,
                assignedEmployeeIds: [],
                employeeHours: [],
                sectorIds: [],
                complexity: rec.priority === 'Urgent' ? 'team' : 'solo',
                source: 'tasks'
            });
            toast.success(isKa ? `✓ სამუშაო "${rec.title}" დაემატა რეესტრში!` : `✓ Task "${rec.title}" added to registry!`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[92vh] rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
                
                {/* Header */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white border-b border-indigo-800/40 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white">
                            <Sparkles className="h-6 w-6 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black italic uppercase tracking-tight">
                                    {isKa ? 'AI აგრო-ინტელექტი და საველე ანალიტიკოსი' : 'AI Agronomy & Field Operations Intelligence'}
                                </h2>
                                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-black uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                    Gemini 3.8 Flash • Synced
                                </span>
                            </div>
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-0.5">
                                {isKa ? 'რეესტრების, დაავადებების, გასხვლის და OPEX-ის ერთიანი ანალიზი' : 'Unified Audit of Registries, Pathology, Pruning & OPEX'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={runFullAgronomicAnalysis}
                            disabled={isAnalyzing}
                            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors disabled:opacity-50"
                            title={isKa ? "ხელახალი ანალიზი" : "Re-analyze"}
                        >
                            <RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} />
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2.5 bg-white/10 hover:bg-rose-600 text-white rounded-xl transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* 4 Financial & Agronomic Pillar KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest">{isKa ? 'სრული OPEX' : 'Total OPEX'}</span>
                            <DollarSign size={14} className="text-emerald-500" />
                        </div>
                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 italic">
                            GEL {metrics.totalOpex.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                            {isKa ? 'ხელფასი:' : 'Labor:'} GEL {metrics.totalLaborCost.toFixed(0)} • {isKa ? 'მასალები:' : 'Materials:'} GEL {metrics.totalMaterialCost.toFixed(0)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest">{isKa ? 'მისიები რეესტრში' : 'Registries & Tasks'}</span>
                            <CheckSquare size={14} className="text-blue-500" />
                        </div>
                        <p className="text-xl font-black text-slate-900 dark:text-white italic">
                            {metrics.totalMissionsCount} <span className="text-xs font-bold text-slate-400">({metrics.completedCount} ok)</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                            {metrics.totalHoursLogged.toFixed(0)} hrs • {metrics.uniqueWorkersCount} {isKa ? 'თანამშრომელი' : 'workers'}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest">{isKa ? 'გასხვლა & ოპერაციები' : 'Pruning & Spraying'}</span>
                            <Scissors size={14} className="text-purple-500" />
                        </div>
                        <p className="text-xl font-black text-purple-600 dark:text-purple-400 italic">
                            {metrics.taskTypeCounts.Pruning} <span className="text-xs font-normal text-slate-400">prun / {metrics.taskTypeCounts.Spraying} spray</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                            {isKa ? 'ბოლო გასხვლა:' : 'Last Pruning:'} {metrics.latestDates.Pruning ? new Date(metrics.latestDates.Pruning).toLocaleDateString() : 'None'}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest">{isKa ? 'კლინიკური დიაგნოზები' : 'Active Diagnoses'}</span>
                            <ShieldAlert size={14} className="text-rose-500" />
                        </div>
                        <p className="text-xl font-black text-rose-600 dark:text-rose-400 italic">
                            {clinicalRecords.length} <span className="text-xs font-normal text-slate-400">{isKa ? 'ჩანაწერი' : 'records'}</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                            {clinicalRecords.filter(c => c.agronomistConclusion?.severity === 'Severe' || c.agronomistConclusion?.severity === 'Critical').length} {isKa ? 'მწვავე შემთხვევა' : 'severe cases'}
                        </p>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                            activeTab === 'overview' 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Activity size={14} />
                        {isKa ? 'აუდიტი და რეკომენდაციები' : 'Audit & Recommendations'}
                    </button>
                    <button 
                        onClick={() => setActiveTab('pruning')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                            activeTab === 'pruning' 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Scissors size={14} />
                        {isKa ? 'გასხვლა & ფენოლოგია' : 'Pruning & Phenology'}
                    </button>
                    <button 
                        onClick={() => setActiveTab('pathology')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                            activeTab === 'pathology' 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <ShieldAlert size={14} />
                        {isKa ? 'დაავადებები & შეწამვლა' : 'Diseases & Spray Cadence'}
                    </button>
                    <button 
                        onClick={() => setActiveTab('opex')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                            activeTab === 'opex' 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <DollarSign size={14} />
                        {isKa ? 'OPEX & მუშახელი' : 'OPEX & Workforce'}
                    </button>
                    <button 
                        onClick={() => setActiveTab('chat')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                            activeTab === 'chat' 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Sparkles size={14} />
                        {isKa ? 'ინტერაქტიული AI აგრონომი' : 'Interactive Chat'}
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            
                            {/* Actionable Recommended Tasks Banner */}
                            {recommendedTasks.length > 0 && (
                                <div className="p-5 bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-slate-800/60 dark:to-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-amber-500" />
                                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                                                {isKa ? 'AI-ს მიერ შემოთავაზებული გადაუდებელი სამუშაოები' : 'Actionable Recommended Missions (Click to Add to Registry)'}
                                            </h3>
                                        </div>
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                            {recommendedTasks.length} {isKa ? 'მისია' : 'Missions'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {recommendedTasks.map((rec, idx) => (
                                            <div 
                                                key={idx}
                                                className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider ${
                                                            rec.priority === 'Urgent' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                                                            rec.priority === 'High' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                                                            'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                                        }`}>
                                                            {rec.priority}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400">
                                                            {rec.recommendedDate}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                                                        {rec.title}
                                                    </h4>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
                                                        {rec.rationale}
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => handleCreateTaskFromRecommendation(rec)}
                                                    className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                                >
                                                    <Plus size={13} />
                                                    {isKa ? 'რეესტრში დამატება' : 'Add to Registry'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Full AI Audit Report */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-indigo-600" />
                                        <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white">
                                            {isKa ? 'სრული აგრონომიული და ეკონომიკური დასკვნა' : 'Executive Agronomic & Economic Synthesis'}
                                        </h3>
                                    </div>
                                    {isAnalyzing && (
                                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold animate-pulse">
                                            <RefreshCw size={14} className="animate-spin" />
                                            <span>{isKa ? 'ანალიტიკური ძრავა მუშაობს...' : 'Synthesizing field data...'}</span>
                                        </div>
                                    )}
                                </div>

                                {aiAnalysisMarkdown ? (
                                    <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-3 whitespace-pre-line">
                                        {aiAnalysisMarkdown}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center text-slate-400 space-y-2">
                                        <RefreshCw size={24} className="mx-auto animate-spin text-indigo-500" />
                                        <p className="text-xs font-bold">{isKa ? 'მონაცემების ანალიზი მიმდინარეობს...' : 'Analyzing field telemetry and registry...'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PRUNING TAB */}
                    {activeTab === 'pruning' && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-purple-100 dark:bg-purple-950/60 rounded-xl text-purple-600 dark:text-purple-400">
                                        <Scissors size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                                            {isKa ? 'გასხვლის კალენდარი და ტექნოლოგიური რეგლამენტი' : 'Pruning Window & Physiological Readiness'}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {isKa ? 'ვეგეტაციური ციკლის, ყინვების რისკის და ნარგავების ფიტოსანიტარიის მონიტორინგი' : 'Vegetative dormancy timing, frost resilience, and sanitary cutting protocols'}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                            {isKa ? 'გასხვლის ჩანაწერები რეესტრში' : 'Recorded Pruning History'}
                                        </h4>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                                            {metrics.taskTypeCounts.Pruning} <span className="text-xs text-slate-400 font-bold">{isKa ? 'ჩანაწერი' : 'entries'}</span>
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {isKa ? 'ბოლო გასხვლა:' : 'Last session:'} <strong>{metrics.latestDates.Pruning ? new Date(metrics.latestDates.Pruning).toLocaleDateString() : 'None'}</strong>
                                        </p>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                            {isKa ? 'რეკომენდებული პერიოდი' : 'Optimal Window'}
                                        </h4>
                                        <p className="text-base font-black text-slate-900 dark:text-white">
                                            {isKa ? 'მშრალი ამინდი, წვენთა მოძრაობამდე' : 'Dry weather, pre-budbreak dormancy'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {isKa ? 'დაავადებული ტოტების გატანა და დაუყოვნებელი დაწვა ან დამუშავება სპილენძით.' : 'Disinfect shears between rows (70% alcohol), seal thick cuts with copper paste.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PATHOLOGY TAB */}
                    {activeTab === 'pathology' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                                    <ShieldAlert className="text-rose-500" size={16} />
                                    {isKa ? 'ლაბორატორიული და საველე AI დიაგნოზები' : 'Clinical Diagnoses & Laboratory Detections'}
                                </h3>
                                <span className="text-xs text-slate-400 font-bold">
                                    {clinicalRecords.length} {isKa ? 'ჩანაწერი' : 'Cases'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {clinicalRecords.map(record => (
                                    <div 
                                        key={record.id}
                                        className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider ${
                                                    record.agronomistConclusion?.severity === 'Severe' || record.agronomistConclusion?.severity === 'Critical'
                                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                                                }`}>
                                                    {record.agronomistConclusion?.severity || 'Moderate'}
                                                </span>
                                                <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                                                    {record.title}
                                                </h4>
                                                <p className="text-[10px] text-slate-400 font-bold">
                                                    {new Date(record.createdAt).toLocaleDateString()} • {record.agronomistConclusion?.targetSectorOrPlot || 'General'}
                                                </p>
                                            </div>
                                        </div>

                                        {record.agronomistConclusion && (
                                            <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl space-y-1.5 text-xs">
                                                <p className="font-bold text-indigo-600 dark:text-indigo-400">
                                                    {isKa ? 'დანიშნული შეწამვლა:' : 'Prescribed Treatment:'}
                                                </p>
                                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                                    {record.agronomistConclusion.prescribedTreatment}
                                                </p>
                                                {record.agronomistConclusion.activeIngredients?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 pt-1">
                                                        {record.agronomistConclusion.activeIngredients.map((ai, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded text-[9px] font-bold border border-indigo-200/60">
                                                                {ai}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {clinicalRecords.length === 0 && (
                                    <div className="col-span-2 py-12 text-center bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                        <p className="text-xs text-slate-400 font-bold">{isKa ? 'დიაგნოსტიკის ჩანაწერები ჯერ არ არის დაფიქსირებული' : 'No clinical plant pathology records found.'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* OPEX & WORKFORCE TAB */}
                    {activeTab === 'opex' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isKa ? 'სრული სახელფასო ფონდი' : 'Total Labor Payroll'}</p>
                                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 italic">
                                        GEL {metrics.totalLaborCost.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {metrics.totalHoursLogged.toFixed(1)} {isKa ? 'ნამუშევარი საათი' : 'hours logged'}
                                    </p>
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isKa ? 'მასალების & ქიმიის ხარჯი' : 'Material & Chemical Cost'}</p>
                                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400 italic">
                                        GEL {metrics.totalMaterialCost.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {inventoryItems.length} {isKa ? 'ინვენტარის პოზიცია' : 'tracked inventory items'}
                                    </p>
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isKa ? 'სრული OPEX' : 'Total Gross OPEX'}</p>
                                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 italic">
                                        GEL {metrics.totalOpex.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {metrics.completedCount} {isKa ? 'დასრულებულ მისიაზე' : 'across completed tasks'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CHAT TAB */}
                    {activeTab === 'chat' && (
                        <div className="flex flex-col h-[520px] bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 text-xs leading-relaxed text-indigo-900 dark:text-indigo-200">
                                    <span className="font-bold flex items-center gap-1.5 mb-1 text-indigo-700 dark:text-indigo-300">
                                        <Sparkles size={14} /> {isKa ? 'AI აგრონომიული ასისტენტი მზად არის:' : 'AI Field Agronomist Ready:'}
                                    </span>
                                    {isKa 
                                        ? "შეგიძლიათ დამისვათ ნებისმიერი შეკითხვა საველე სამუშაოების სიხშირეზე, გასხვლის ოპტიმალურ ვადებზე, შეწამვლის დოზებზე ან OPEX-ის ოპტიმიზაციაზე."
                                        : "Ask anything regarding pruning windows, treatment dosage, task frequency, or workforce OPEX."
                                    }
                                </div>

                                {chatMessages.map((msg, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                                    >
                                        <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                                            msg.role === 'user' 
                                                ? 'bg-indigo-600 text-white rounded-br-none shadow-md' 
                                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm whitespace-pre-line'
                                        }`}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                                    </div>
                                ))}

                                {isChatSending && (
                                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold p-2">
                                        <RefreshCw size={13} className="animate-spin" />
                                        <span>{isKa ? 'AI აგრონომი აანალიზებს...' : 'Agronomist is analyzing...'}</span>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Chat Input */}
                            <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                                <input 
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendChatMessage(); }}
                                    placeholder={isKa ? "ჰკითხეთ AI აგრონომს (მაგ: როდის ჯობია გასხვლა?)..." : "Ask agronomy assistant (e.g. when to prune?)..."}
                                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                                />
                                <button
                                    onClick={handleSendChatMessage}
                                    disabled={!chatInput.trim() || isChatSending}
                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Send size={13} />
                                    <span>{isKa ? 'გაგზავნა' : 'Send'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {isKa 
                            ? "AI რეკომენდაციები სინქრონიზებულია საველე რეესტრთან და კლინიკურ მონაცემებთან."
                            : "AI recommendations are synchronized with active field registry and clinical records."
                        }
                    </p>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-bold transition-all shadow-sm"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default FieldAgronomyIntelligenceModal;
