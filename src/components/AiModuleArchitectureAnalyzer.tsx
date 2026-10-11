import React, { useState, useMemo, useEffect } from 'react';
import { 
    PLATFORM_MODULES, 
    PLATFORM_CONNECTIONS,
    PlatformModuleDefinition, 
    ModuleConnection,
    ModuleFolder,
    ModuleComponentItem,
    AiArchitectureReport,
    getMergedPlatformModules,
    saveCustomComponentOrModule,
    generateAiArchitectureAnalysis,
    generatePresentationSlidesHtml,
    generateComprehensiveUserGuideMarkdown
} from '../services/architectureGuideService';
import {
    PresentationDeck,
    PresentationSlide,
    generateCustomAiPresentationDeck,
    answerPresentationCopilotQuestion,
    exportPresentationPptx,
    exportPresentationPdf,
    exportPresentationHtml,
    buildStandardPresentationDeck
} from '../services/presentationService';
import { useLanguage } from '../contexts/LanguageContext';
import { 
    Download, 
    Sparkles, 
    Presentation, 
    FileText, 
    CheckSquare, 
    Square, 
    Network, 
    TrendingUp, 
    Layers, 
    Cpu, 
    Info, 
    ChevronDown, 
    ChevronUp, 
    ChevronRight,
    ArrowRight,
    ArrowLeft,
    Sliders,
    Zap,
    Scale,
    Users,
    Package,
    Map,
    FlaskConical,
    LayoutDashboard,
    Coins,
    ShoppingBag,
    Brain,
    Folder,
    FolderPlus,
    FileCode,
    Search,
    Plus,
    RefreshCw,
    Grid,
    List,
    ShieldCheck,
    Check,
    X,
    HelpCircle,
    Calendar,
    MessageSquare,
    Wrench,
    TestTubes,
    Crown,
    Activity,
    Target,
    BookOpen,
    FileDown,
    FileType,
    FileSpreadsheet,
    Bot,
    MessageSquareQuote,
    CheckCircle2,
    Eye,
    EyeOff,
    Play,
    Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../types';

interface Props {
    onNavigateMode?: (mode: string) => void;
    currentUser?: User | null;
}

const downloadBlobFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const AiModuleArchitectureAnalyzer: React.FC<Props> = ({ onNavigateMode, currentUser }) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    // Verify if active user is Root or Super Admin
    const isRootOrSuperAdmin = useMemo(() => {
        if (!currentUser) return false;
        return Boolean(
            currentUser.roles?.includes('ROOT_SUPER_ADMIN') ||
            currentUser.roles?.some(r => ['root', 'superadmin', 'super_admin', 'ROOT_SUPER_ADMIN'].includes(String(r).toLowerCase())) ||
            (currentUser as any)?.role === 'ROOT_SUPER_ADMIN' ||
            (currentUser as any)?.role === 'root' ||
            (currentUser as any)?.role === 'superadmin' ||
            currentUser.id === 'root-system' ||
            currentUser.email?.toLowerCase() === 'nishno@agrimap.pro' ||
            currentUser.email?.toLowerCase() === 'giorgi.nishno@gmail.com' ||
            currentUser.email?.toLowerCase() === 'admin@agrimap.io'
        );
    }, [currentUser]);

    // Master module data
    const [allModules, setAllModules] = useState<PlatformModuleDefinition[]>(() => getMergedPlatformModules());
    const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>(() => allModules.map(m => m.id));
    
    // Active focused module & active selected component IDs
    const [activeModuleId, setActiveModuleId] = useState<string>('stock');
    const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
    
    // Active component inspection
    const [inspectedComponent, setInspectedComponent] = useState<ModuleComponentItem | null>(null);

    // Connections and filters
    const [connections, setConnections] = useState<ModuleConnection[]>(PLATFORM_CONNECTIONS);
    const [activeConnectionFilter, setActiveConnectionFilter] = useState<'all' | 'stock_deduction' | 'payroll_labor' | 'spatial_gis' | 'ai_telemetry'>('all');
    
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [hoveredModuleId, setHoveredModuleId] = useState<string | null>(null);

    // AI Custom Presentation & Copilot state
    const [copilotPrompt, setCopilotPrompt] = useState(
        isKa 
            ? 'გთხოვ დააგენერირო პრეზენტაცია აპლიკაციაზე, მაგრამ მთავარი აქცენტი უნდა იყოს მოსავლის მოდულზე (Harvest), განსაკუთრებით ამწონ პუნქტზე (Weigh Station).'
            : 'please generate presentation about application, but main issue must be harvest module, to be more confident weight station'
    );
    const [customDeck, setCustomDeck] = useState<PresentationDeck | null>(null);
    const [isGeneratingDeck, setIsGeneratingDeck] = useState(false);
    const [isAskingCopilot, setIsAskingCopilot] = useState(false);
    const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
    const [showDeckPreview, setShowDeckPreview] = useState(false);
    const [previewSlideIdx, setPreviewSlideIdx] = useState(0);
    const [isDownloadingFormat, setIsDownloadingFormat] = useState<'pptx' | 'pdf' | 'html' | null>(null);
    const [showComponentFilter, setShowComponentFilter] = useState(false);

    // Categorized Analysis tabs: 'manual' (Manual Architecture), 'global_ai' (Global / Focused AI Report), 'hud' (Live HUD Inspector), 'topology' (Data Pipelines)
    const [activeAnalysisMode, setActiveAnalysisMode] = useState<'manual' | 'global_ai' | 'hud' | 'topology'>('manual');
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [aiReport, setAiReport] = useState<AiArchitectureReport | null>(null);

    // Add Custom Feature / Component modal state
    const [isAddFeatureModalOpen, setIsAddFeatureModalOpen] = useState(false);
    const [newFeatureForm, setNewFeatureForm] = useState({
        targetModuleId: 'other_custom',
        targetFolderId: 'custom_user_features',
        nameEn: '',
        nameKa: '',
        shortDescEn: '',
        shortDescKa: '',
        fullDocEn: '',
        fullDocKa: '',
        inputsEn: '',
        inputsKa: '',
        outputsEn: '',
        outputsKa: '',
        formulaEn: '',
        formulaKa: '',
        hardwareBridgeEn: '',
        hardwareBridgeKa: '',
        isUniqueInWorld: true
    });

    // Refresh modules on mount
    useEffect(() => {
        const merged = getMergedPlatformModules();
        setAllModules(merged);
    }, []);

    // Get current active module definition
    const activeModule = useMemo(() => {
        return allModules.find(m => m.id === activeModuleId) || allModules[0];
    }, [allModules, activeModuleId]);

    // All components inside current active module
    const currentModuleComponents = useMemo(() => {
        if (!activeModule) return [];
        return activeModule.folders.flatMap(f => f.components);
    }, [activeModule]);

    // Filtered components by search
    const filteredCurrentComponents = useMemo(() => {
        if (!searchQuery.trim()) return currentModuleComponents;
        const q = searchQuery.toLowerCase();
        return currentModuleComponents.filter(c => 
            c.nameEn.toLowerCase().includes(q) ||
            c.nameKa.toLowerCase().includes(q) ||
            c.shortDescEn.toLowerCase().includes(q) ||
            c.shortDescKa.toLowerCase().includes(q)
        );
    }, [currentModuleComponents, searchQuery]);

    // Selected modules for synthesis
    const selectedModules = useMemo(() => {
        return allModules.filter(m => selectedModuleIds.includes(m.id));
    }, [allModules, selectedModuleIds]);

    // Filtered connections
    const filteredConnections = useMemo(() => {
        return connections.filter(c => {
            if (!c.enabled) return false;
            if (activeConnectionFilter !== 'all' && c.type !== activeConnectionFilter) return false;
            return selectedModuleIds.includes(c.fromModuleId) && selectedModuleIds.includes(c.toModuleId);
        });
    }, [connections, activeConnectionFilter, selectedModuleIds]);

    // Module Multi-Selection Handlers
    const handleToggleModuleInList = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedModuleIds(prev => {
            if (prev.includes(id)) {
                if (prev.length === 1) {
                    toast.error(isKa ? 'მინიმუმ 1 მოდული უნდა იყოს არჩეული' : 'At least one module must be selected');
                    return prev;
                }
                return prev.filter(x => x !== id);
            }
            return [...prev, id];
        });
    };

    const handleSelectAllModules = () => {
        setSelectedModuleIds(allModules.map(m => m.id));
        toast.info(isKa ? 'ყველა 17+ მოდული არჩეულია' : 'All 17+ modules selected');
    };

    const handleDeselectAllModules = () => {
        setSelectedModuleIds([activeModuleId]);
        toast.info(isKa ? `არჩეულია მხოლოდ: ${activeModule.nameKa}` : `Selected only: ${activeModule.nameEn}`);
    };

    // Component Selection Handlers
    const handleToggleComponent = (compId: string) => {
        setSelectedComponentIds(prev => 
            prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
        );
    };

    const handleSelectAllComponentsInModule = () => {
        const allCompIds = currentModuleComponents.map(c => c.id);
        setSelectedComponentIds(allCompIds);
        toast.info(isKa ? 'ამ მოდულის ყველა კომპონენტი არჩეულია' : 'All components in module selected');
    };

    const handleClearComponentSelection = () => {
        setSelectedComponentIds([]);
    };

    // Add active module to multi-select list
    const handleAddCurrentModuleToList = () => {
        if (!selectedModuleIds.includes(activeModuleId)) {
            setSelectedModuleIds(prev => [...prev, activeModuleId]);
            toast.success(isKa ? `[${activeModule.nameKa}] დაემატა ანალიზის სიას` : `[${activeModule.nameEn}] added to analysis list`);
        } else {
            toast.info(isKa ? `[${activeModule.nameKa}] უკვე სიაშია` : `[${activeModule.nameEn}] is already in analysis list`);
        }
    };

    // AI Analysis Handlers
    const handleRunAiAnalysis = async (options?: { singleModuleId?: string; customFeaturesOnly?: boolean }) => {
        setIsGeneratingAi(true);
        try {
            const targetModId = options?.singleModuleId || (options?.customFeaturesOnly ? 'other_custom' : undefined);
            const report = await generateAiArchitectureAnalysis(
                selectedModuleIds, 
                isKa ? 'ka' : 'en', 
                {
                    modulesList: allModules,
                    singleModuleId: targetModId,
                    customFeaturesOnly: options?.customFeaturesOnly,
                    focusedComponentIds: selectedComponentIds.length > 0 ? selectedComponentIds : undefined
                }
            );
            setAiReport(report);
            setActiveAnalysisMode('global_ai');
            toast.success(
                targetModId
                    ? (isKa ? `ფოკუსირებული AI ანალიზი [${activeModule.nameKa}] მზადაა` : `Focused AI Analysis for [${activeModule.nameEn}] ready`)
                    : (isKa ? 'გლობალური AI არქიტექტურული ანალიზი მზადაა' : 'Global AI Architecture Synthesis completed')
            );
        } catch (e) {
            toast.error(isKa ? 'ანალიზის გენერირება ვერ მოხერხდა' : 'Failed to generate AI analysis');
        } finally {
            setIsGeneratingAi(false);
        }
    };

    // Save Custom Feature
    const handleSaveNewCustomFeature = () => {
        if (!newFeatureForm.nameEn.trim() && !newFeatureForm.nameKa.trim()) {
            toast.error(isKa ? 'გთხოვთ შეიყვანოთ ფუნქციის სახელი' : 'Please enter feature name');
            return;
        }

        const nameEn = newFeatureForm.nameEn.trim() || newFeatureForm.nameKa.trim();
        const nameKa = newFeatureForm.nameKa.trim() || newFeatureForm.nameEn.trim();
        const descEn = newFeatureForm.shortDescEn.trim() || 'Custom farm intelligence sub-component';
        const descKa = newFeatureForm.shortDescKa.trim() || 'მომხმარებლის მიერ დამატებული აგრო-კომპონენტი';

        const updated = saveCustomComponentOrModule(
            newFeatureForm.targetModuleId,
            newFeatureForm.targetFolderId,
            {
                folderId: newFeatureForm.targetFolderId,
                nameEn,
                nameKa,
                shortDescEn: descEn,
                shortDescKa: descKa,
                fullDocEn: newFeatureForm.fullDocEn.trim() || descEn,
                fullDocKa: newFeatureForm.fullDocKa.trim() || descKa,
                inputsEn: newFeatureForm.inputsEn ? newFeatureForm.inputsEn.split(',').map(s => s.trim()) : undefined,
                inputsKa: newFeatureForm.inputsKa ? newFeatureForm.inputsKa.split(',').map(s => s.trim()) : undefined,
                outputsEn: newFeatureForm.outputsEn ? newFeatureForm.outputsEn.split(',').map(s => s.trim()) : undefined,
                outputsKa: newFeatureForm.outputsKa ? newFeatureForm.outputsKa.split(',').map(s => s.trim()) : undefined,
                formulaOrLogicEn: newFeatureForm.formulaEn.trim() || undefined,
                formulaOrLogicKa: newFeatureForm.formulaKa.trim() || undefined,
                hardwareBridgeEn: newFeatureForm.hardwareBridgeEn.trim() || undefined,
                hardwareBridgeKa: newFeatureForm.hardwareBridgeKa.trim() || undefined,
                isUniqueInWorld: newFeatureForm.isUniqueInWorld
            }
        );

        setAllModules(updated);
        setActiveModuleId(newFeatureForm.targetModuleId);
        setIsAddFeatureModalOpen(false);
        toast.success(isKa ? 'ახალი ფუნქცია წარმატებით დაემატა მექანიკურ არქიტექტურას!' : 'New feature added to Manual Architecture successfully!');
    };

    // Generate custom deck based on prompt
    const handleGenerateCustomDeck = async (overridePrompt?: string) => {
        const promptToUse = (overridePrompt ?? copilotPrompt).trim();
        if (!promptToUse) {
            toast.error(isKa ? 'გთხოვთ შეიყვანოთ მოთხოვნა AI პრეზენტაციისთვის' : 'Please enter a prompt for the AI presentation');
            return;
        }

        setIsGeneratingDeck(true);
        setCopilotAnswer(null);

        try {
            const deck = await generateCustomAiPresentationDeck(
                promptToUse,
                isKa ? 'ka' : 'en',
                allModules,
                aiReport || undefined
            );
            setCustomDeck(deck);
            setShowDeckPreview(true);
            setPreviewSlideIdx(0);
            
            const summaryMsg = isKa
                ? `✅ მორგებული პრეზენტაცია შეიქმნა (${deck.slides.length} სლაიდი) მოთხოვნით: "${promptToUse}". მთავარი აქცენტი: ${deck.focusAreas?.join(', ') || 'არქიტექტურა'}. შეგიძლიათ ჩამოტვირთოთ PPTX, PDF ან HTML ფორმატში.`
                : `✅ Custom presentation generated (${deck.slides.length} slides) for prompt: "${promptToUse}". Focus: ${deck.focusAreas?.join(', ') || 'Architecture'}. Ready for PPTX, PDF, or HTML export.`;
            setCopilotAnswer(summaryMsg);
            toast.success(isKa ? 'პრეზენტაცია წარმატებით დაგენერირდა!' : 'Custom presentation generated successfully!');
        } catch (err) {
            console.error('Failed to generate custom deck:', err);
            toast.error(isKa ? 'შეცდომა პრეზენტაციის გენერირებისას' : 'Failed to generate presentation');
        } finally {
            setIsGeneratingDeck(false);
        }
    };

    // Ask AI Copilot a question
    const handleAskCopilot = async (overrideQuestion?: string) => {
        const questionToUse = (overrideQuestion ?? copilotPrompt).trim();
        if (!questionToUse) {
            toast.error(isKa ? 'გთხოვთ შეიყვანოთ კითხვა AI-სთვის' : 'Please enter a question for the AI');
            return;
        }

        setIsAskingCopilot(true);
        try {
            const answer = await answerPresentationCopilotQuestion(
                questionToUse,
                customDeck,
                allModules,
                isKa ? 'ka' : 'en'
            );
            setCopilotAnswer(answer);
            toast.success(isKa ? 'AI პასუხი მზადაა!' : 'AI Copilot response ready!');
        } catch (err) {
            console.error('Failed to query copilot:', err);
            toast.error(isKa ? 'შეცდომა AI ასისტენტთან დაკავშირებისას' : 'Failed to query copilot');
        } finally {
            setIsAskingCopilot(false);
        }
    };

    // Export presentation in specified format: pptx, pdf, or html
    const handleExportDeck = async (format: 'pptx' | 'pdf' | 'html') => {
        if (!isRootOrSuperAdmin) {
            toast.error(
                isKa 
                    ? 'ჩამოტვირთვა შეზღუდულია: არქიტექტურული პრეზენტაციებისა და ფაილების ექსპორტი დაშვებულია მხოლოდ Super Admin და Root მომხმარებლებისთვის.' 
                    : 'Downloads Restricted: Exporting system architecture slide decks is limited exclusively to Super Admin and Root users.'
            );
            return;
        }

        try {
            setIsDownloadingFormat(format);
            let deckToExport = customDeck;
            if (!deckToExport) {
                let currentReport = aiReport;
                if (!currentReport) {
                    currentReport = await generateAiArchitectureAnalysis(selectedModuleIds, isKa ? 'ka' : 'en', { modulesList: allModules });
                    setAiReport(currentReport);
                }
                deckToExport = buildStandardPresentationDeck(selectedModules, connections, currentReport, isKa ? 'ka' : 'en');
            }

            if (format === 'pptx') {
                await exportPresentationPptx(deckToExport);
                toast.success(isKa ? 'PowerPoint პრეზენტაცია (.pptx) ჩამოიტვირთა!' : 'PowerPoint presentation (.pptx) downloaded!');
            } else if (format === 'pdf') {
                await exportPresentationPdf(deckToExport);
                toast.success(isKa ? 'PDF პრეზენტაცია (.pdf) ჩამოიტვირთა!' : 'PDF presentation (.pdf) downloaded!');
            } else {
                const html = exportPresentationHtml(deckToExport, isKa ? 'ka' : 'en');
                downloadBlobFile(html, `AgriMap_Pro_Presentation_${Date.now()}.html`, 'text/html;charset=utf-8');
                toast.success(isKa ? 'ინტერაქტიული პრეზენტაცია (.html) ჩამოტვირთულია!' : 'Interactive presentation (.html) downloaded!');
            }
        } catch (err) {
            console.error('Error exporting presentation:', err);
            toast.error(isKa ? 'შეცდომა პრეზენტაციის ექსპორტისას' : 'Error exporting presentation');
        } finally {
            setIsDownloadingFormat(null);
        }
    };

    // Download presentation (defaults to current active deck HTML)
    const handleDownloadPresentation = async () => {
        await handleExportDeck('html');
    };

    // Download guide markdown
    const handleDownloadGuideMarkdown = async () => {
        if (!isRootOrSuperAdmin) {
            toast.error(
                isKa 
                    ? 'ჩამოტვირთვა შეზღუდულია: სისტემური სახელმძღვანელოს (.md) ექსპორტი დაშვებულია მხოლოდ Super Admin და Root მომხმარებლებისთვის.' 
                    : 'Downloads Restricted: Exporting system operational manuals (.md) is limited exclusively to Super Admin and Root users.'
            );
            return;
        }

        let currentReport = aiReport;
        if (!currentReport) {
            currentReport = await generateAiArchitectureAnalysis(selectedModuleIds, isKa ? 'ka' : 'en', { modulesList: allModules });
            setAiReport(currentReport);
        }
        const md = generateComprehensiveUserGuideMarkdown(selectedModules, connections, currentReport, isKa ? 'ka' : 'en');
        downloadBlobFile(md, `AgriMap_Pro_Master_Manual_Guide_${Date.now()}.md`, 'text/markdown;charset=utf-8');
        toast.success(isKa ? 'სრული გზამკვლევი (.md) ჩამოტვირთულია!' : 'Master User Manual (.md) downloaded!');
    };

    const renderModuleIcon = (iconName: string, className: string = 'w-4 h-4') => {
        switch (iconName) {
            case 'Users': return <Users className={className} />;
            case 'LayoutDashboard': return <LayoutDashboard className={className} />;
            case 'Map': return <Map className={className} />;
            case 'FlaskConical': return <FlaskConical className={className} />;
            case 'Package': return <Package className={className} />;
            case 'CheckSquare': return <CheckSquare className={className} />;
            case 'Scale': return <Scale className={className} />;
            case 'Brain': return <Brain className={className} />;
            case 'Coins': return <Coins className={className} />;
            case 'ShoppingBag': return <ShoppingBag className={className} />;
            case 'Calendar': return <Calendar className={className} />;
            case 'MessageSquare': return <MessageSquare className={className} />;
            case 'Wrench': return <Wrench className={className} />;
            case 'HelpCircle': return <HelpCircle className={className} />;
            case 'TestTubes': return <TestTubes className={className} />;
            case 'FileText': return <FileText className={className} />;
            case 'Crown': return <Crown className={className} />;
            case 'ShieldCheck': return <ShieldCheck className={className} />;
            case 'Sparkles': return <Sparkles className={className} />;
            default: return <Folder className={className} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-100 min-h-screen">
            {/* TOP HEADER & BRANDING */}
            <div className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-4 py-3 sticky top-0 z-30 shadow-lg">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/40 text-white">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                                    {isKa ? 'მექანიკური არქიტექტურა & AI გზამკვლევი' : 'Manual Architecture & AI Guide'}
                                </h1>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    17+ Modules
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                {isKa ? 'აირჩიეთ მოდული, შეისწავლეთ ყველა კომპონენტი და ჩაატარეთ კატეგორიზებული AI ანალიზი' : 'Select any module, inspect all components, and execute categorized AI analysis'}
                            </p>
                        </div>
                    </div>

                    {/* CATEGORIZED ACTIONS BAR */}
                    <div className="flex items-center flex-wrap gap-2">
                        {/* Global Analysis */}
                        <button
                            onClick={() => handleRunAiAnalysis()}
                            disabled={isGeneratingAi}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-900/30 transition-all disabled:opacity-50"
                            title={isKa ? 'გლობალური AI სინთეზი ყველა არჩეული მოდულისთვის' : 'Global AI Synthesis across all selected modules'}
                        >
                            {isGeneratingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            <span>{isKa ? 'გლობალური ანალიზი' : 'Global Analysis'}</span>
                        </button>

                        {/* Analyze Only It */}
                        <button
                            onClick={() => handleRunAiAnalysis({ singleModuleId: activeModuleId })}
                            disabled={isGeneratingAi}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-900/30 transition-all disabled:opacity-50"
                            title={isKa ? `მხოლოდ ამ მოდულის [${activeModule.nameKa}] დამოუკიდებელი AI ანალიზი` : `Focused analysis on only this module [${activeModule.nameEn}]`}
                        >
                            <Target className="w-3.5 h-3.5" />
                            <span>{isKa ? 'მხოლოდ ამის ანალიზი (Only It)' : 'Analyze Only It'}</span>
                        </button>

                        {/* Live HUD Inspector Toggle */}
                        <button
                            onClick={() => setActiveAnalysisMode(prev => prev === 'hud' ? 'manual' : 'hud')}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs border transition-all ${
                                activeAnalysisMode === 'hud'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-md shadow-amber-900/20'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            }`}
                        >
                            <Activity className="w-3.5 h-3.5 text-amber-400" />
                            <span>{isKa ? 'Live HUD ინსპექტორი' : 'Live HUD Inspector'}</span>
                        </button>

                        {/* Make Presentation - Grouped PPTX, PDF, HTML */}
                        <div className="inline-flex items-center rounded-lg bg-slate-800 border border-slate-700 p-0.5 shadow-md shadow-blue-950/40 relative">
                            {!isRootOrSuperAdmin && (
                                <div className="absolute -top-2.5 -right-2 z-10">
                                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-0.5 shadow-xs">
                                        <Lock className="w-2 h-2" />
                                        <span>SuperAdmin</span>
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={() => handleExportDeck('pptx')}
                                disabled={isDownloadingFormat !== null}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all disabled:opacity-50 ${
                                    isRootOrSuperAdmin 
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer' 
                                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer'
                                }`}
                                title={
                                    !isRootOrSuperAdmin 
                                        ? (isKa ? 'შეზღუდულია: მხოლოდ Root და Super Admin მომხმარებლებისთვის' : 'Restricted: Super Admin & Root Users Only')
                                        : (isKa ? 'PowerPoint პრეზენტაციის (.pptx) ჩამოტვირთვა' : 'Download PowerPoint Presentation (.pptx)')
                                }
                            >
                                {!isRootOrSuperAdmin ? <Lock className="w-3 h-3 text-amber-400" /> : <Presentation className="w-3.5 h-3.5" />}
                                <span>{isDownloadingFormat === 'pptx' ? 'PPTX...' : 'PPTX'}</span>
                            </button>
                            <button
                                onClick={() => handleExportDeck('pdf')}
                                disabled={isDownloadingFormat !== null}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-700 text-slate-200 font-medium text-xs transition-all disabled:opacity-50 cursor-pointer"
                                title={
                                    !isRootOrSuperAdmin 
                                        ? (isKa ? 'შეზღუდულია: მხოლოდ Root და Super Admin მომხმარებლებისთვის' : 'Restricted: Super Admin & Root Users Only')
                                        : (isKa ? 'PDF პრეზენტაციის (.pdf) ჩამოტვირთვა' : 'Download PDF Slide Deck (.pdf)')
                                }
                            >
                                {!isRootOrSuperAdmin ? <Lock className="w-3 h-3 text-amber-400" /> : <FileDown className="w-3.5 h-3.5 text-rose-400" />}
                                <span>{isDownloadingFormat === 'pdf' ? 'PDF...' : 'PDF'}</span>
                            </button>
                            <button
                                onClick={() => handleExportDeck('html')}
                                disabled={isDownloadingFormat !== null}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-700 text-slate-200 font-medium text-xs transition-all disabled:opacity-50 cursor-pointer"
                                title={
                                    !isRootOrSuperAdmin 
                                        ? (isKa ? 'შეზღუდულია: მხოლოდ Root და Super Admin მომხმარებლებისთვის' : 'Restricted: Super Admin & Root Users Only')
                                        : (isKa ? 'ინტერაქტიული HTML პრეზენტაციის (.html) ჩამოტვირთვა' : 'Download Interactive Presentation (.html)')
                                }
                            >
                                {!isRootOrSuperAdmin ? <Lock className="w-3 h-3 text-amber-400" /> : <FileType className="w-3.5 h-3.5 text-cyan-400" />}
                                <span>{isDownloadingFormat === 'html' ? 'HTML...' : 'HTML'}</span>
                            </button>
                        </div>

                        {/* Create Guide */}
                        <button
                            onClick={handleDownloadGuideMarkdown}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs shadow-md transition-all cursor-pointer ${
                                isRootOrSuperAdmin 
                                    ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-900/30' 
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                            }`}
                            title={
                                !isRootOrSuperAdmin 
                                    ? (isKa ? 'შეზღუდულია: მხოლოდ Root და Super Admin მომხმარებლებისთვის' : 'Restricted: Super Admin & Root Users Only')
                                    : (isKa ? 'სრული მომხმარებლის გზამკვლევის (.md) ჩამოტვირთვა' : 'Download master operational manual (.md)')
                            }
                        >
                            {!isRootOrSuperAdmin ? <Lock className="w-3 h-3 text-amber-400" /> : <BookOpen className="w-3.5 h-3.5" />}
                            <span>{isKa ? 'გზამკვლევი (.md)' : 'Create Guide'}</span>
                        </button>

                        {/* Add Feature ("Other") */}
                        <button
                            onClick={() => setIsAddFeatureModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium text-xs shadow-md shadow-fuchsia-900/30 transition-all"
                            title={isKa ? 'ახალი ფუნქციის ან ქვეკომპონენტის დამატება' : 'Add custom feature or extension'}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isKa ? '+ ფუნქციის დამატება' : '+ Add Feature'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 17 MODULES + "OTHER" HORIZONTAL SELECTION RIBBON */}
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
                <div className="max-w-7xl mx-auto flex items-center gap-1.5 min-w-max">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {isKa ? 'მოდულები (17):' : 'Modules (17):'}
                    </span>

                    {/* SELECT ALL / DESELECT CONTROLS */}
                    <div className="flex items-center gap-1 mr-3 pr-3 border-r border-slate-800">
                        <button
                            onClick={handleSelectAllModules}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                        >
                            {isKa ? 'ყველა' : 'All'}
                        </button>
                        <button
                            onClick={handleDeselectAllModules}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors"
                        >
                            {isKa ? 'გასუფთავება' : 'Clear'}
                        </button>
                    </div>

                    {/* 17 CORE MODULE CHIPS */}
                    {allModules.map(mod => {
                        const isActive = mod.id === activeModuleId;
                        const isChecked = selectedModuleIds.includes(mod.id);
                        const isOther = mod.id === 'other_custom';

                        return (
                            <div
                                key={mod.id}
                                onClick={() => {
                                    setActiveModuleId(mod.id);
                                    setSelectedComponentIds([]);
                                    setInspectedComponent(null);
                                    if (activeAnalysisMode === 'global_ai') {
                                        setActiveAnalysisMode('manual');
                                    }
                                }}
                                onMouseEnter={() => setHoveredModuleId(mod.id)}
                                onMouseLeave={() => setHoveredModuleId(null)}
                                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                                    isActive
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950'
                                        : isOther
                                            ? 'bg-fuchsia-950/40 text-fuchsia-300 border-fuchsia-800/40 hover:bg-fuchsia-900/30'
                                            : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <button
                                    onClick={(e) => handleToggleModuleInList(mod.id, e)}
                                    className="text-slate-400 hover:text-emerald-400 transition-colors p-0.5"
                                    title={isKa ? 'ჩართვა/გამორთვა სინთეზისთვის' : 'Toggle for synthesis'}
                                >
                                    {isChecked ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                        <Square className="w-3.5 h-3.5 text-slate-500" />
                                    )}
                                </button>
                                
                                <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>
                                    {renderModuleIcon(mod.iconName, 'w-3.5 h-3.5')}
                                </span>
                                
                                <span className="whitespace-nowrap">
                                    {isKa ? mod.nameKa.split('(')[0].replace(/^\d+\.\s*/, '') : mod.nameEn.split('.')[1]?.trim() || mod.nameEn}
                                </span>

                                <span className="px-1.5 py-0.2 text-[10px] rounded bg-slate-900/80 text-slate-400 border border-slate-700/50">
                                    {mod.folders.reduce((acc, f) => acc + f.components.length, 0)}
                                </span>
                            </div>
                        );
                    })}

                    {/* DEDICATED "OTHER" BUTTON */}
                    <button
                        onClick={() => {
                            setActiveModuleId('other_custom');
                            setSelectedComponentIds([]);
                            setInspectedComponent(null);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                            activeModuleId === 'other_custom'
                                ? 'bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-500/50 shadow-md shadow-fuchsia-950'
                                : 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-700/40 hover:bg-fuchsia-900/50'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                        <span>{isKa ? 'სხვა (Other)' : 'Other'}</span>
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LEFT PANEL: ACTIVE MODULE & ALL ITS COMPONENTS */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    
                    {/* ACTIVE MODULE BANNER */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                        
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shadow-inner">
                                    {renderModuleIcon(activeModule.iconName, 'w-6 h-6')}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                            {activeModule.category}
                                        </span>
                                        <h2 className="text-lg font-bold text-white">
                                            {isKa ? activeModule.nameKa : activeModule.nameEn}
                                        </h2>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                                        {isKa ? activeModule.shortDescKa : activeModule.shortDescEn}
                                    </p>
                                </div>
                            </div>

                            {/* MODULE ACTION BUTTONS */}
                            <div className="flex items-center flex-wrap gap-2">
                                <button
                                    onClick={handleAddCurrentModuleToList}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                                    title={isKa ? 'დაამატეთ ეს მოდული მრავალმოდულური ანალიზის სიაში' : 'Add module to multi-selection list'}
                                >
                                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{isKa ? 'სიაში დამატება (Add to List)' : 'Add to List'}</span>
                                </button>

                                <button
                                    onClick={() => handleRunAiAnalysis({ singleModuleId: activeModuleId })}
                                    disabled={isGeneratingAi}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 transition-all disabled:opacity-50"
                                >
                                    <Target className="w-3.5 h-3.5" />
                                    <span>{isKa ? 'მხოლოდ ამის ანალიზი (Analyze Only It)' : 'Analyze Only It'}</span>
                                </button>
                            </div>
                        </div>

                        {/* AI PRESENTATION ARCHITECT & COPILOT COMMAND CENTER (CONVERTED SEARCH PANEL) */}
                        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                                                {isKa ? 'AI პრეზენტაციის არქიტექტორი & ასისტენტი' : 'AI Presentation Architect & Copilot'}
                                            </span>
                                            {customDeck ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-600/40">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                                    {isKa ? `მორგებული დექი: ${customDeck.slides.length} სლაიდი` : `Custom Deck Active: ${customDeck.slides.length} slides`}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                                                    {isKa ? 'სტანდარტული 17 მოდული' : 'Standard 17 Modules'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400">
                                            {isKa 
                                                ? 'მოითხოვეთ პრეზენტაცია კონკრეტული აქცენტით (მაგ: მოსავალი და ამწონი პუნქტი) ან დაუსვით კითხვები არქიტექტურაზე.'
                                                : 'Prompt AI to generate a custom presentation (e.g. focus on Harvest & Weigh Station) or ask architecture questions.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {customDeck && (
                                        <button
                                            onClick={() => setShowDeckPreview(prev => !prev)}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                                showDeckPreview 
                                                    ? 'bg-emerald-900/40 border-emerald-600 text-emerald-300' 
                                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                            }`}
                                            title={isKa ? 'სლაიდების გადახედვა' : 'Toggle slide preview carousel'}
                                        >
                                            {showDeckPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            <span>{showDeckPreview ? (isKa ? 'სლაიდების დახურვა' : 'Hide Slides') : (isKa ? 'სლაიდების გადახედვა' : 'Preview Slides')}</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setShowComponentFilter(prev => !prev)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                            showComponentFilter || searchQuery 
                                                ? 'bg-indigo-900/40 border-indigo-600 text-indigo-300' 
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                        title={isKa ? 'კომპონენტების ტექსტური ძებნა' : 'Filter component cards'}
                                    >
                                        <Search className="w-3.5 h-3.5" />
                                        <span>{isKa ? 'ფილტრი' : 'Filter Cards'}</span>
                                    </button>

                                    <button
                                        onClick={handleSelectAllComponentsInModule}
                                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700"
                                    >
                                        {isKa ? 'ყველა' : 'Select All'}
                                    </button>
                                    {selectedComponentIds.length > 0 && (
                                        <button
                                            onClick={handleClearComponentSelection}
                                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-colors border border-slate-700"
                                        >
                                            {isKa ? `გასუფთავება (${selectedComponentIds.length})` : `Clear (${selectedComponentIds.length})`}
                                        </button>
                                    )}
                                    <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-1 rounded ${viewMode === 'grid' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                                            title="Grid View"
                                        >
                                            <Grid className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-1 rounded ${viewMode === 'list' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                                            title="List View"
                                        >
                                            <List className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* MAIN AI PROMPT INPUT & ACTION BUTTONS */}
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2.5 shadow-inner">
                                <div className="relative">
                                    <textarea
                                        rows={2}
                                        value={copilotPrompt}
                                        onChange={(e) => setCopilotPrompt(e.target.value)}
                                        placeholder={isKa 
                                            ? 'მაგალითი: გთხოვ დააგენერირო პრეზენტაცია აპლიკაციაზე, მაგრამ მთავარი აქცენტი უნდა იყოს მოსავლის მოდულზე (Harvest), განსაკუთრებით ამწონ პუნქტზე (Weigh Station)...'
                                            : 'Example: please generate presentation about application, but main issue must be harvest module, to be more confident weight station...'}
                                        className="w-full pl-3 pr-8 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none leading-relaxed"
                                    />
                                    {copilotPrompt && (
                                        <button
                                            onClick={() => setCopilotPrompt('')}
                                            className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white transition-colors"
                                            title="Clear input"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    {/* Action Buttons */}
                                    <div className="flex items-center flex-wrap gap-2">
                                        <button
                                            onClick={() => handleGenerateCustomDeck()}
                                            disabled={isGeneratingDeck}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-950 transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                            {isGeneratingDeck ? (
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-3.5 h-3.5" />
                                            )}
                                            <span>
                                                {isGeneratingDeck 
                                                    ? (isKa ? 'დექის გენერაცია...' : 'Generating Custom Deck...') 
                                                    : (isKa ? '✨ მორგებული პრეზენტაციის გენერაცია' : '✨ Generate Custom Presentation')}
                                            </span>
                                        </button>

                                        <button
                                            onClick={() => handleAskCopilot()}
                                            disabled={isAskingCopilot}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-medium text-xs border border-indigo-500/30 transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                            {isAskingCopilot ? (
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                                            )}
                                            <span>
                                                {isAskingCopilot 
                                                    ? (isKa ? 'ანალიზი...' : 'Thinking...') 
                                                    : (isKa ? '💬 კითხვა AI-ს' : '💬 Ask AI Copilot')}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Export Buttons directly inside the panel when custom deck or standard is active */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                                            {!isRootOrSuperAdmin && <Lock className="w-3 h-3 text-amber-400" />}
                                            <span>{isKa ? 'ჩამოტვირთვა:' : 'Download:'}</span>
                                        </span>
                                        <button
                                            onClick={() => handleExportDeck('pptx')}
                                            disabled={isDownloadingFormat !== null}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                            title={!isRootOrSuperAdmin ? (isKa ? 'შეზღუდულია: Root/SuperAdmin მხოლოდ' : 'Restricted: Root/SuperAdmin only') : "Download as PowerPoint (.pptx)"}
                                        >
                                            {!isRootOrSuperAdmin ? <Lock className="w-2.5 h-2.5 text-amber-300" /> : <Presentation className="w-3 h-3" />}
                                            <span>PPTX</span>
                                        </button>
                                        <button
                                            onClick={() => handleExportDeck('pdf')}
                                            disabled={isDownloadingFormat !== null}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-rose-700/80 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                            title={!isRootOrSuperAdmin ? (isKa ? 'შეზღუდულია: Root/SuperAdmin მხოლოდ' : 'Restricted: Root/SuperAdmin only') : "Download as PDF Document (.pdf)"}
                                        >
                                            {!isRootOrSuperAdmin ? <Lock className="w-2.5 h-2.5 text-amber-300" /> : <FileDown className="w-3 h-3" />}
                                            <span>PDF</span>
                                        </button>
                                        <button
                                            onClick={() => handleExportDeck('html')}
                                            disabled={isDownloadingFormat !== null}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-cyan-700/80 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                            title={!isRootOrSuperAdmin ? (isKa ? 'შეზღუდულია: Root/SuperAdmin მხოლოდ' : 'Restricted: Root/SuperAdmin only') : "Download as Interactive HTML (.html)"}
                                        >
                                            {!isRootOrSuperAdmin ? <Lock className="w-2.5 h-2.5 text-amber-300" /> : <FileType className="w-3 h-3" />}
                                            <span>HTML</span>
                                        </button>
                                    </div>
                                </div>

                                {/* PRESET QUICK PROMPT CHIPS */}
                                <div className="flex items-center flex-wrap gap-1.5 pt-1 border-t border-slate-900">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mr-1">
                                        {isKa ? 'სწრაფი მოთხოვნები:' : 'Quick Presets:'}
                                    </span>
                                    {[
                                        {
                                            label: isKa ? '⚖️ მოსავლის აღება & ამწონი პუნქტი' : '⚖️ Harvest & Weigh Station Focus',
                                            prompt: isKa
                                                ? 'გთხოვ დააგენერირო პრეზენტაცია აპლიკაციაზე, მაგრამ მთავარი აქცენტი უნდა იყოს მოსავლის მოდულზე (Harvest), განსაკუთრებით ამწონ პუნქტზე (Weigh Station).'
                                                : 'please generate presentation about application, but main issue must be harvest module, to be more confident weight station'
                                        },
                                        {
                                            label: isKa ? '📦 საწყობის 10 კომპონენტი & QR' : '📦 Stock 10-Component Warehouse',
                                            prompt: isKa
                                                ? 'დააგენერირე პრეზენტაცია საწყობის 10 კომპონენტზე, მარაგების ავტო-ჩამოწერასა და QR სამაცივრე ლოტებზე.'
                                                : 'generate detailed presentation focusing on Stock Warehouse 10 components, real-time agro-deductions, and cold storage QR lots'
                                        },
                                        {
                                            label: isKa ? '🗺️ GIS & 1 კგ-ის თვითღირებულება' : '🗺️ GIS & Micro-Zoned Cost/KG',
                                            prompt: isKa
                                                ? 'შექმენი პრეზენტაცია GIS რუკებზე, სატელიტურ ტელემეტრიასა და 1 კგ მოსავლის თვითღირებულების გამოთვლაზე.'
                                                : 'create presentation on precision GIS mapping, satellite vegetation telemetry, and micro-zoned cost per kg'
                                        },
                                        {
                                            label: isKa ? '💰 ფერმის ROI & 4.2x სისწრაფე' : '💰 Farm ROI & 4.2x Speed',
                                            prompt: isKa
                                                ? 'მოამზადე პრეზენტაცია ამწონ პუნქტში თაღლითობის აღმოფხვრასა და 4.2-ჯერ აჩქარებულ მიღებაზე.'
                                                : 'prepare executive presentation showing zero weigh-in fraud and 4.2x intake throughput acceleration'
                                        }
                                    ].map((preset, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setCopilotPrompt(preset.prompt);
                                                handleGenerateCustomDeck(preset.prompt);
                                            }}
                                            className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 text-[11px] font-medium border border-slate-800 hover:border-emerald-600/40 transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>{preset.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* INLINE COPILOT ANSWER CARD */}
                            {copilotAnswer && (
                                <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 text-xs text-slate-200 relative animate-fadeIn">
                                    <button
                                        onClick={() => setCopilotAnswer(null)}
                                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="flex items-start gap-2.5 pr-6">
                                        <div className="p-1 rounded bg-indigo-500/20 text-indigo-400 flex-shrink-0 mt-0.5">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                        <div className="space-y-1 leading-relaxed whitespace-pre-line">
                                            {copilotAnswer}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* INLINE SLIDE PREVIEW CAROUSEL */}
                            {showDeckPreview && customDeck && (
                                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 space-y-3 shadow-xl">
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                                {isKa ? 'სლაიდების გადახედვა' : 'Custom Slide Preview'}
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-semibold text-slate-300">
                                                {previewSlideIdx + 1} / {customDeck.slides.length}
                                            </span>
                                            <span className="text-xs text-slate-400 font-medium">
                                                {customDeck.slides[previewSlideIdx]?.category}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setPreviewSlideIdx(prev => Math.max(0, prev - 1))}
                                                disabled={previewSlideIdx === 0}
                                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
                                            >
                                                ← {isKa ? 'წინა' : 'Prev'}
                                            </button>
                                            <button
                                                onClick={() => setPreviewSlideIdx(prev => Math.min(customDeck.slides.length - 1, prev + 1))}
                                                disabled={previewSlideIdx === customDeck.slides.length - 1}
                                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
                                            >
                                                {isKa ? 'შემდეგი' : 'Next'} →
                                            </button>
                                            <button
                                                onClick={() => setShowDeckPreview(false)}
                                                className="p-1 rounded text-slate-400 hover:text-white"
                                                title="Close preview"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Active Slide Body */}
                                    {(() => {
                                        const s = customDeck.slides[previewSlideIdx];
                                        if (!s) return null;
                                        return (
                                            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                                                <div>
                                                    {s.badge && (
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-950 text-sky-400 border border-sky-800 mb-1">
                                                            {s.badge}
                                                        </span>
                                                    )}
                                                    <h3 className="text-base font-bold text-sky-300">{s.title}</h3>
                                                    {s.subtitle && <p className="text-xs text-slate-400 mt-0.5">{s.subtitle}</p>}
                                                </div>

                                                {/* Stats */}
                                                {s.stats && s.stats.length > 0 && (
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {s.stats.map((st, i) => (
                                                            <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-center">
                                                                <span className="text-sm font-extrabold text-emerald-400 block">{st.value}</span>
                                                                <span className="text-[10px] text-slate-400">{st.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {/* Bullets */}
                                                    {s.bullets && s.bullets.length > 0 && (
                                                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1.5">
                                                            {s.bullets.map((b, i) => (
                                                                <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                                                    <span className="text-sky-400 font-bold">•</span>
                                                                    <span>{b}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Highlight Box & Formulas */}
                                                    <div className="space-y-2">
                                                        {s.highlightBox && (
                                                            <div className="bg-emerald-950/70 border border-emerald-600/50 rounded-lg p-3">
                                                                <h4 className="text-xs font-bold text-emerald-300 mb-1">{s.highlightBox.title}</h4>
                                                                <p className="text-[11px] text-emerald-100 leading-relaxed">{s.highlightBox.text}</p>
                                                            </div>
                                                        )}
                                                        {(s.formulaOrLogic || s.callout) && (
                                                            <div className="bg-slate-900 border border-sky-500/40 rounded-lg p-2.5 text-[11px] text-slate-300">
                                                                <strong className="text-sky-400 block mb-0.5">
                                                                    {s.formulaOrLogic ? '📐 System Logic / Formula:' : '💡 Operational Takeaway:'}
                                                                </strong>
                                                                {s.formulaOrLogic || s.callout}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* COMPONENT TEXT SEARCH FILTER (TOGGLEABLE) */}
                            {(showComponentFilter || searchQuery) && (
                                <div className="relative pt-1 animate-fadeIn">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 mt-0.5" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={isKa ? `ძებნა ${activeModule.nameKa}-ს კომპონენტებში...` : `Filter in ${activeModule.nameEn} component cards...`}
                                        className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COMPONENT CARDS LIST / GRID */}
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {isKa ? 'მოდულის კომპონენტები:' : 'Module Components:'} ({filteredCurrentComponents.length})
                        </span>
                        {selectedComponentIds.length > 0 && (
                            <span className="text-xs text-emerald-400 font-medium">
                                {isKa ? `არჩეულია ${selectedComponentIds.length} კომპონენტი` : `${selectedComponentIds.length} component(s) chosen for focused review`}
                            </span>
                        )}
                    </div>

                    {filteredCurrentComponents.length === 0 ? (
                        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
                            <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 font-medium">
                                {isKa ? 'კომპონენტები ვერ მოიძებნა' : 'No components found for this query'}
                            </p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {filteredCurrentComponents.map((comp, idx) => {
                                const isSelected = selectedComponentIds.includes(comp.id);
                                const isInspected = inspectedComponent?.id === comp.id;

                                return (
                                    <div
                                        key={comp.id}
                                        onClick={() => setInspectedComponent(comp)}
                                        className={`group p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                                            isInspected
                                                ? 'bg-emerald-950/30 border-emerald-500/60 shadow-md shadow-emerald-950/40'
                                                : isSelected
                                                    ? 'bg-slate-800/90 border-emerald-500/40'
                                                    : 'bg-slate-900/70 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleComponent(comp.id);
                                                        }}
                                                        className="text-slate-400 hover:text-emerald-400 transition-colors p-0.5"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                                                        ) : (
                                                            <Square className="w-4 h-4 text-slate-500" />
                                                        )}
                                                    </button>
                                                    <span className="text-xs font-semibold text-slate-400">
                                                        #{idx + 1}
                                                    </span>
                                                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                                                        {isKa ? comp.nameKa : comp.nameEn}
                                                    </h3>
                                                </div>
                                                {comp.isUniqueInWorld && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                                                        ⭐ {isKa ? 'უნიკალური' : 'World Unique'}
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                                                {isKa ? comp.shortDescKa : comp.shortDescEn}
                                            </p>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                                                <Activity className="w-3 h-3" />
                                                {isKa ? 'დეტალების ნახვა' : 'Inspect Specs'}
                                            </span>
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filteredCurrentComponents.map((comp, idx) => {
                                const isSelected = selectedComponentIds.includes(comp.id);
                                const isInspected = inspectedComponent?.id === comp.id;

                                return (
                                    <div
                                        key={comp.id}
                                        onClick={() => setInspectedComponent(comp)}
                                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-all ${
                                            isInspected
                                                ? 'bg-emerald-950/30 border-emerald-500/60'
                                                : isSelected
                                                    ? 'bg-slate-800/90 border-emerald-500/40'
                                                    : 'bg-slate-900/70 border-slate-800 hover:bg-slate-850'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleComponent(comp.id);
                                                }}
                                                className="text-slate-400 hover:text-emerald-400 transition-colors"
                                            >
                                                {isSelected ? (
                                                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-slate-500" />
                                                )}
                                            </button>
                                            <span className="text-xs text-slate-500 font-mono">#{idx + 1}</span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-xs font-bold text-white truncate">
                                                        {isKa ? comp.nameKa : comp.nameEn}
                                                    </h3>
                                                    {comp.isUniqueInWorld && (
                                                        <span className="px-1.5 py-0.2 text-[9px] font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                            ⭐
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-400 truncate">
                                                    {isKa ? comp.shortDescKa : comp.shortDescEn}
                                                </p>
                                            </div>
                                        </div>

                                        <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL: DEEP COMPONENT INSPECTOR / LIVE HUD / AI REPORT */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    
                    {/* VIEW SWITCHER / TABS */}
                    <div className="flex items-center rounded-xl bg-slate-900 p-1 border border-slate-800">
                        <button
                            onClick={() => setActiveAnalysisMode('manual')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                activeAnalysisMode === 'manual'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {isKa ? 'დეტალები' : 'Details'}
                        </button>
                        <button
                            onClick={() => setActiveAnalysisMode('hud')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                activeAnalysisMode === 'hud'
                                    ? 'bg-slate-800 text-amber-300 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {isKa ? 'Live HUD' : 'Live HUD'}
                        </button>
                        <button
                            onClick={() => setActiveAnalysisMode('global_ai')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                activeAnalysisMode === 'global_ai'
                                    ? 'bg-slate-800 text-emerald-300 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {isKa ? 'AI ანგარიში' : 'AI Report'}
                        </button>
                    </div>

                    {/* TAB 1: COMPONENT OR MODULE DETAILS */}
                    {activeAnalysisMode === 'manual' && (
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                            {inspectedComponent ? (
                                <>
                                    <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                                {isKa ? 'არჩეული ქვეკომპონენტი' : 'Inspected Sub-Component'}
                                            </span>
                                            <h3 className="text-base font-bold text-white mt-0.5">
                                                {isKa ? inspectedComponent.nameKa : inspectedComponent.nameEn}
                                            </h3>
                                        </div>
                                        <button
                                            onClick={() => setInspectedComponent(null)}
                                            className="text-slate-400 hover:text-white p-1"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-300 mb-1">
                                            {isKa ? 'ფუნქციური აღწერა & მექანიზმი' : 'Functional Description & Logic'}
                                        </h4>
                                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                                            {isKa ? inspectedComponent.fullDocKa : inspectedComponent.fullDocEn}
                                        </p>
                                    </div>

                                    {inspectedComponent.formulaOrLogicEn && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                                                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                                                {isKa ? 'ფორმულა / გამოთვლის ლოგიკა:' : 'Formula / Calculation Logic:'}
                                            </h4>
                                            <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/20 text-amber-300 font-mono text-[11px]">
                                                {isKa ? (inspectedComponent.formulaOrLogicKa || inspectedComponent.formulaOrLogicEn) : inspectedComponent.formulaOrLogicEn}
                                            </div>
                                        </div>
                                    )}

                                    {inspectedComponent.inputsEn && inspectedComponent.inputsEn.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-300 mb-1">
                                                {isKa ? 'შემავალი მონაცემები (Inputs):' : 'Data Inputs:'}
                                            </h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(isKa ? (inspectedComponent.inputsKa || inspectedComponent.inputsEn) : inspectedComponent.inputsEn).map((inp, i) => (
                                                    <span key={i} className="px-2 py-0.5 text-[11px] rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                        ⬇️ {inp}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {inspectedComponent.outputsEn && inspectedComponent.outputsEn.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-300 mb-1">
                                                {isKa ? 'გამომავალი ნაკადები (Outputs):' : 'Data Outputs:'}
                                            </h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(isKa ? (inspectedComponent.outputsKa || inspectedComponent.outputsEn) : inspectedComponent.outputsEn).map((out, i) => (
                                                    <span key={i} className="px-2 py-0.5 text-[11px] rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                                                        ⬆️ {out}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {inspectedComponent.hardwareBridgeEn && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                                                <Scale className="w-3.5 h-3.5 text-blue-400" />
                                                {isKa ? 'აპარატურული კავშირი (Hardware Bridge):' : 'Hardware Bridge Protocol:'}
                                            </h4>
                                            <div className="p-2.5 rounded-lg bg-slate-950 border border-blue-500/20 text-blue-300 text-[11px]">
                                                {isKa ? (inspectedComponent.hardwareBridgeKa || inspectedComponent.hardwareBridgeEn) : inspectedComponent.hardwareBridgeEn}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="border-b border-slate-800 pb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            {isKa ? 'მოდულის სრული მიმოხილვა' : 'Module Architecture Deep-Dive'}
                                        </span>
                                        <h3 className="text-base font-bold text-white mt-0.5">
                                            {isKa ? activeModule.nameKa : activeModule.nameEn}
                                        </h3>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-300 mb-1">
                                            {isKa ? 'არქიტექტურული აღწერა' : 'Full Architecture Scope'}
                                        </h4>
                                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                                            {isKa ? activeModule.fullDescriptionKa : activeModule.fullDescriptionEn}
                                        </p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            <span>{isKa ? 'მომგებიანობა & ROI' : 'Economic Impact & Profitability'}</span>
                                        </div>
                                        <p className="text-xs text-slate-300">
                                            {isKa ? activeModule.profitabilityKa : activeModule.profitabilityEn}
                                        </p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-1">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span>{isKa ? 'მსოფლიო დონის უპირატესობა' : 'World-First Competitive Edge'}</span>
                                        </div>
                                        <p className="text-xs text-slate-300">
                                            {isKa ? activeModule.worldFirstAdvantageKa : activeModule.worldFirstAdvantageEn}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* TAB 2: LIVE HUD INSPECTOR */}
                    {activeAnalysisMode === 'hud' && (
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-amber-400" />
                                    <h3 className="text-sm font-bold text-white">
                                        {isKa ? 'Live HUD & მონაცემთა ნაკადები' : 'Live HUD & Data Pipelines'}
                                    </h3>
                                </div>
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Real-time
                                </span>
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    {isKa ? 'აქტიური ინტეგრაციები ამ მოდულზე:' : 'Active Pipelines for this Module:'}
                                </span>

                                {connections
                                    .filter(c => c.fromModuleId === activeModuleId || c.toModuleId === activeModuleId)
                                    .map(conn => {
                                        const fromMod = allModules.find(m => m.id === conn.fromModuleId);
                                        const toMod = allModules.find(m => m.id === conn.toModuleId);

                                        return (
                                            <div key={conn.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                                                <div className="flex items-center justify-between gap-1 mb-1">
                                                    <span className="font-bold text-slate-300">
                                                        {isKa ? fromMod?.nameKa.split('(')[0] : fromMod?.nameEn.split('.')[1] || conn.fromModuleId}
                                                    </span>
                                                    <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                                    <span className="font-bold text-emerald-300">
                                                        {isKa ? toMod?.nameKa.split('(')[0] : toMod?.nameEn.split('.')[1] || conn.toModuleId}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-1">
                                                    {isKa ? conn.labelKa : conn.labelEn}
                                                </p>
                                                <span className="inline-block mt-2 px-1.5 py-0.5 text-[9px] rounded bg-slate-800 text-slate-400 font-mono">
                                                    Type: {conn.type}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: AI ARCHITECTURE SYNTHESIS REPORT */}
                    {activeAnalysisMode === 'global_ai' && (
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-emerald-400" />
                                    <h3 className="text-sm font-bold text-white">
                                        {isKa ? 'AI არქიტექტურული სინთეზი' : 'AI Strategic Synthesis'}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => handleRunAiAnalysis()}
                                    disabled={isGeneratingAi}
                                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                    <RefreshCw className={`w-3 h-3 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                                    {isKa ? 'განახლება' : 'Refresh'}
                                </button>
                            </div>

                            {aiReport ? (
                                <div className="flex flex-col gap-4 text-xs">
                                    <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30">
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                                            {isKa ? 'სტრატეგიული დასკვნა' : 'Executive Synthesis'}
                                        </span>
                                        <p className="text-slate-300 leading-relaxed">
                                            {isKa ? aiReport.executiveSummaryKa : aiReport.executiveSummaryEn}
                                        </p>
                                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 font-semibold text-emerald-300">
                                            {isKa ? 'მარჟის მულტიპლიკატორი: ' : 'Profit Multiplier: '}
                                            <span className="text-white">{isKa ? aiReport.overallProfitMultiplierKa : aiReport.overallProfitMultiplierEn}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-slate-200 mb-2">
                                            {isKa ? '⚡ საკვანძო სინერგიები:' : '⚡ Key Synergies:'}
                                        </h4>
                                        <div className="flex flex-col gap-1.5">
                                            {(isKa ? aiReport.synergiesKa : aiReport.synergiesEn).map((syn, idx) => (
                                                <div key={idx} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-slate-300">
                                                    {syn}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {aiReport.gapAnalysisKa.length > 0 && (
                                        <div>
                                            <h4 className="font-bold text-amber-300 mb-2">
                                                {isKa ? '🔍 გამოვლენილი ხარვეზები & გამოწვევები:' : '🔍 Architectural Gaps Identified:'}
                                            </h4>
                                            <div className="flex flex-col gap-1.5">
                                                {(isKa ? aiReport.gapAnalysisKa : aiReport.gapAnalysisEn).slice(0, 4).map((gap, idx) => (
                                                    <div key={idx} className="p-2 rounded-lg bg-amber-950/20 border border-amber-900/30 text-amber-200">
                                                        {gap}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400">
                                        {isKa ? 'დააჭირეთ "გლობალური ანალიზი" ან "მხოლოდ ამის ანალიზი" რეპორტის მისაღებად' : 'Click "Global Analysis" or "Analyze Only It" to run the neural synthesis'}
                                    </p>
                                    <button
                                        onClick={() => handleRunAiAnalysis()}
                                        className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow"
                                    >
                                        {isKa ? 'ანალიზის დაწყება' : 'Start Synthesis'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL: ADD CUSTOM FEATURE / SUB-COMPONENT */}
            {isAddFeatureModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-fuchsia-500/20 text-fuchsia-400">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <h3 className="text-base font-bold text-white">
                                    {isKa ? 'ახალი ფუნქციის / კომპონენტის დამატება' : 'Add Custom Feature / Sub-Component'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsAddFeatureModalOpen(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 text-xs">
                            <div>
                                <label className="block text-slate-300 font-medium mb-1">
                                    {isKa ? 'სამიზნე მოდული' : 'Target Module'}
                                </label>
                                <select
                                    value={newFeatureForm.targetModuleId}
                                    onChange={(e) => setNewFeatureForm(prev => ({ ...prev, targetModuleId: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                                >
                                    {allModules.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {isKa ? m.nameKa : m.nameEn}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-300 font-medium mb-1">
                                    {isKa ? 'ფუნქციის სახელი (ქართულად)' : 'Feature Name (Georgian)'}
                                </label>
                                <input
                                    type="text"
                                    value={newFeatureForm.nameKa}
                                    onChange={(e) => setNewFeatureForm(prev => ({ ...prev, nameKa: e.target.value }))}
                                    placeholder="მაგ: ავტონომიური დრონით წამლობის მოდული"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 font-medium mb-1">
                                    {isKa ? 'ფუნქციის სახელი (ინგლისურად)' : 'Feature Name (English)'}
                                </label>
                                <input
                                    type="text"
                                    value={newFeatureForm.nameEn}
                                    onChange={(e) => setNewFeatureForm(prev => ({ ...prev, nameEn: e.target.value }))}
                                    placeholder="e.g. Autonomous Drone Spraying Protocol"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 font-medium mb-1">
                                    {isKa ? 'მოკლე აღწერა' : 'Short Description'}
                                </label>
                                <textarea
                                    rows={2}
                                    value={newFeatureForm.shortDescKa}
                                    onChange={(e) => setNewFeatureForm(prev => ({ ...prev, shortDescKa: e.target.value }))}
                                    placeholder="აღწერეთ რას აკეთებს ეს კომპონენტი..."
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 font-medium mb-1">
                                    {isKa ? 'ფორმულა / გამოთვლის ლოგიკა' : 'Formula / Calculation Logic'}
                                </label>
                                <input
                                    type="text"
                                    value={newFeatureForm.formulaKa}
                                    onChange={(e) => setNewFeatureForm(prev => ({ ...prev, formulaKa: e.target.value }))}
                                    placeholder="მაგ: ხარჯი = ფართობი × დოზირება"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4 mt-2">
                            <button
                                onClick={() => setIsAddFeatureModalOpen(false)}
                                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                            >
                                {isKa ? 'გაუქმება' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleSaveNewCustomFeature}
                                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950"
                            >
                                {isKa ? 'შენახვა და ანალიზში ასახვა' : 'Save & Sync into Architecture'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
