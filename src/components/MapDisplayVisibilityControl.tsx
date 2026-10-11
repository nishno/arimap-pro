import React, { useState, useRef, useEffect } from 'react';
import { 
    Layers, SlidersHorizontal, Check, X, Eye, EyeOff, 
    RotateCcw, Sparkles, PenTool, Activity, Shield, 
    MapPin, Sprout, MessageSquare, Video, HelpCircle,
    ChevronDown, ChevronUp, GripHorizontal
} from 'lucide-react';
import { safeStorage } from '../services/storageService';
import { useLanguage } from '../contexts/LanguageContext';

export interface DisplayToolsPreferences {
    showDrawingToolbar: boolean;
    showMapToolsMenu: boolean;
    showUndoRedo: boolean;
    showGoogleMeet: boolean;
    showGoogleChat: boolean;
    showVoiceNotes: boolean;
    showAiAssistant: boolean;
    showMeasurementGuide: boolean;
    showSimulationDock: boolean;
    showZoomControls: boolean;
    showCommsHub?: boolean;
    // Map Layers
    showSectors: boolean;
    showLines: boolean;
    showSeedlings: boolean;
    showNotes: boolean;
    showOperations: boolean;
    showHarvests: boolean;
    showShowcases: boolean;
    showCameras: boolean;
    showDroneMissions: boolean;
}

export const DEFAULT_DISPLAY_PREFS: DisplayToolsPreferences = {
    showDrawingToolbar: true,
    showMapToolsMenu: true,
    showUndoRedo: true,
    showGoogleMeet: true,
    showGoogleChat: true,
    showVoiceNotes: true,
    showAiAssistant: true,
    showMeasurementGuide: true,
    showSimulationDock: true,
    showZoomControls: true,
    showCommsHub: true,
    showSectors: true,
    showLines: true,
    showSeedlings: true,
    showNotes: true,
    showOperations: true,
    showHarvests: true,
    showShowcases: true,
    showCameras: true,
    showDroneMissions: true
};

interface MapDisplayVisibilityControlProps {
    preferences: DisplayToolsPreferences;
    onChangePreferences: (prefs: DisplayToolsPreferences) => void;
    onResetAllPositions?: () => void;
}

export const MapDisplayVisibilityControl: React.FC<MapDisplayVisibilityControlProps> = ({
    preferences,
    onChangePreferences,
    onResetAllPositions
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'tools' | 'layers'>('tools');
    const menuRef = useRef<HTMLDivElement | null>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('pointerdown', handleClickOutside);
        }
        return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, [isOpen]);

    const togglePref = (key: keyof DisplayToolsPreferences) => {
        const updated = {
            ...preferences,
            [key]: !preferences[key]
        };
        onChangePreferences(updated);
        safeStorage.setItem('agrimap_display_tools_prefs', JSON.stringify(updated));
    };

    const handleShowAll = () => {
        const updated = { ...DEFAULT_DISPLAY_PREFS };
        onChangePreferences(updated);
        safeStorage.setItem('agrimap_display_tools_prefs', JSON.stringify(updated));
    };

    const handleCleanMap = () => {
        const updated: DisplayToolsPreferences = {
            ...preferences,
            showDrawingToolbar: false,
            showMapToolsMenu: false,
            showUndoRedo: false,
            showGoogleMeet: false,
            showGoogleChat: false,
            showVoiceNotes: false,
            showAiAssistant: false,
            showMeasurementGuide: false,
            showSimulationDock: false,
            showZoomControls: false,
            showCommsHub: false
        };
        onChangePreferences(updated);
        safeStorage.setItem('agrimap_display_tools_prefs', JSON.stringify(updated));
    };

    const toolItems = [
        { 
            key: 'showDrawingToolbar' as const, 
            label: isKa ? 'ხატვის & CAD ინსტრუმენტები' : 'Drawing & CAD Tools', 
            desc: isKa ? 'მოძრავი პანელი პოლიგონის, ფანქრის და ფიგურების ხელსაწყოებით' : 'Movable toolbar with polygon, pencil & shape tools' 
        },
        { 
            key: 'showMapToolsMenu' as const, 
            label: isKa ? 'რუკის ხელსაწყოების მენიუ' : 'Map Tools Dropdown', 
            desc: isKa ? 'ქვედა GPS, თანამგზავრული, შრეების და დრონის მენიუ' : 'Movable bottom GPS, satellite, layers & drone sim' 
        },
        { 
            key: 'showUndoRedo' as const, 
            label: isKa ? 'გაუქმება / გამეორება ღილაკები' : 'Undo / Redo Buttons', 
            desc: isKa ? 'ისტორიის ნაბიჯების მოძრავი ღილაკები' : 'Movable floating history action buttons' 
        },
        { 
            key: 'showGoogleMeet' as const, 
            label: isKa ? 'Google Meet ვიდეო' : 'Google Meet Video', 
            desc: isKa ? 'საკონფერენციო ოთახი და სივრცითი ზარები' : 'Movable conference room & spatial call' 
        },
        { 
            key: 'showGoogleChat' as const, 
            label: isKa ? 'Google Chat ჰაბი' : 'Google Chat Hub', 
            desc: isKa ? 'გუნდური სივრცეები და შეტყობინებები' : 'Movable team spaces & messaging' 
        },
        { 
            key: 'showVoiceNotes' as const, 
            label: isKa ? 'ხმოვანი & საველე ჩანაწერები' : 'Voice & Field Notes', 
            desc: isKa ? 'აუდიო ჩაწერა და საველე პინები' : 'Audio recording & field pins' 
        },
        { 
            key: 'showAiAssistant' as const, 
            label: isKa ? 'Agri-Assistant AI ასისტენტი' : 'Agri-Assistant AI', 
            desc: isKa ? 'მოძრავი ინტელექტუალური ასისტენტი & ავტომატიზაცია' : 'Movable intelligent assistant & automation' 
        },
        { 
            key: 'showMeasurementGuide' as const, 
            label: isKa ? 'გაზომვის გზამკვლევი' : 'Measurement Guide', 
            desc: isKa ? 'ცოცხალი სიგრძის, ფართობისა და კოორდინატების ზოლი' : 'Live length, area and coordinate banner' 
        },
        { 
            key: 'showSimulationDock' as const, 
            label: isKa ? 'სიმულაციის შავი დოკი' : 'Simulation Draft Dock', 
            desc: isKa ? 'ოფლაინ სიმულაციის მრიცხველი და ღრუბელში შენახვა' : 'Offline simulation counter and batch commit' 
        },
        { 
            key: 'showZoomControls' as const, 
            label: isKa ? 'მასშტაბის ღილაკები (+ / -)' : 'Map Zoom Buttons (+ / -)', 
            desc: isKa ? 'რუკის მასშტაბირების კონტროლი' : 'Leaflet navigation zoom controls' 
        }
    ];

    const layerItems = [
        { key: 'showCameras' as const, label: isKa ? 'ვიდეოკამერები & NVR (ოპტიკური დაფარვა)' : 'Surveillance Cameras & Optical FOV', count: isKa ? 'კამერები' : 'Cameras' },
        { key: 'showDroneMissions' as const, label: isKa ? 'დრონის ფრენის მარშრუტები & წერტილები' : 'Drone Flight Paths & Waypoints', count: isKa ? 'მარშრუტები' : 'Missions' },
        { key: 'showSectors' as const, label: isKa ? 'სექტორები & საზღვრები' : 'Sectors & Boundaries', count: isKa ? 'პოლიგონები' : 'Polygons' },
        { key: 'showLines' as const, label: isKa ? 'ხაზები & თხრილები' : 'Lines & Trenches', count: isKa ? 'რიგები' : 'Rows' },
        { key: 'showSeedlings' as const, label: isKa ? 'ნერგები' : 'Seedlings', count: isKa ? 'მცენარეები' : 'Plants' },
        { key: 'showNotes' as const, label: isKa ? 'ჩანაწერები & პუნქტები' : 'Notes & Checkpoints', count: isKa ? 'პინები' : 'Pins' },
        { key: 'showOperations' as const, label: isKa ? 'ოპერაციების ჟურნალი' : 'Operations Log', count: isKa ? 'საველე სამუშაოები' : 'Field tasks' },
        { key: 'showHarvests' as const, label: isKa ? 'მოსავლის ჟურნალი' : 'Harvest Log', count: isKa ? 'მოსავლიანობა' : 'Yield' },
        { key: 'showShowcases' as const, label: isKa ? 'პირდაპირი ეთერი' : 'Live Showcases', count: isKa ? 'ტრანსლაციები' : 'Broadcasts' }
    ];

    const activeToolsCount = toolItems.filter(t => preferences[t.key]).length;

    return (
        <div ref={menuRef} className="relative select-none pointer-events-auto">
            {/* Top-Right Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-black uppercase tracking-wider shadow-xl transition-all cursor-pointer backdrop-blur-md active:scale-95 ${
                    isOpen 
                        ? 'bg-blue-600 border-blue-400 text-white shadow-blue-900/40' 
                        : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-slate-500 hover:text-white'
                }`}
                title={isKa ? "ხელსაწყოების, ღილაკებისა და შრეების ხილვადობის მართვა" : "Toggle visible tools, buttons and map layers"}
            >
                <SlidersHorizontal size={14} className="text-emerald-400" />
                <span className="hidden sm:inline">{isKa ? "ხელსაწყოები & შრეები" : "Tools & Layers"}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[9px] font-mono border border-slate-700">
                    {activeToolsCount}/{toolItems.length}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-white' : ''}`} />
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-slate-950/95 backdrop-blur-2xl border border-slate-700/90 rounded-3xl shadow-2xl p-4 text-white z-[2300] animate-in fade-in slide-in-from-top-2">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-white">
                                {isKa ? "სამუშაო სივრცის ხილვადობა" : "Workspace Visibility"}
                            </h4>
                            <p className="text-[10px] text-slate-400">
                                {isKa ? "მონიშნეთ ან მოხსენით ხილვადი ხელსაწყოები და ღილაკები" : "Check or uncheck tools and buttons to display"}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleShowAll}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-bold uppercase transition-colors cursor-pointer"
                                title={isKa ? "ყველა ხელსაწყოს ჩვენება" : "Show all tools"}
                            >
                                {isKa ? "ყველა" : "Show All"}
                            </button>
                            <button
                                onClick={handleCleanMap}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-bold uppercase transition-colors cursor-pointer"
                                title={isKa ? "სუფთა რუკის რეჟიმი" : "Hide floating tools for clean map viewing"}
                            >
                                {isKa ? "სუფთა რუკა" : "Clean Map"}
                            </button>
                        </div>
                    </div>

                    {/* Tabs (Tools vs Layers) */}
                    <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl my-3 border border-slate-800">
                        <button
                            onClick={() => setActiveTab('tools')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'tools' 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {isKa ? `ხელსაწყოები (${activeToolsCount})` : `Floating Tools (${activeToolsCount})`}
                        </button>
                        <button
                            onClick={() => setActiveTab('layers')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'layers' 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {isKa ? "რუკის შრეები" : "Map Layers"}
                        </button>
                    </div>

                    {/* Tab 1: Floating Tools Checkboxes */}
                    {activeTab === 'tools' && (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                            {toolItems.map(tool => {
                                const checked = preferences[tool.key];
                                return (
                                    <label
                                        key={tool.key}
                                        onClick={() => togglePref(tool.key)}
                                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                            checked 
                                                ? 'bg-blue-950/40 border-blue-500/40 text-white' 
                                                : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                                checked 
                                                    ? 'bg-blue-600 border-blue-400 text-white' 
                                                    : 'border-slate-600 bg-slate-800'
                                            }`}>
                                                {checked && <Check size={11} strokeWidth={3} />}
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold leading-tight">{tool.label}</div>
                                                <div className="text-[9px] text-slate-400">{tool.desc}</div>
                                            </div>
                                        </div>
                                        {checked ? (
                                            <Eye size={14} className="text-emerald-400 shrink-0" />
                                        ) : (
                                            <EyeOff size={14} className="text-slate-600 shrink-0" />
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {/* Tab 2: Map Data Layers Checkboxes */}
                    {activeTab === 'layers' && (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                            {layerItems.map(layer => {
                                const checked = preferences[layer.key];
                                return (
                                    <label
                                        key={layer.key}
                                        onClick={() => togglePref(layer.key)}
                                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                            checked 
                                                ? 'bg-emerald-950/40 border-emerald-500/40 text-white' 
                                                : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                                checked 
                                                    ? 'bg-emerald-600 border-emerald-400 text-white' 
                                                    : 'border-slate-600 bg-slate-800'
                                            }`}>
                                                {checked && <Check size={11} strokeWidth={3} />}
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold leading-tight">{layer.label}</div>
                                                <div className="text-[9px] text-slate-400">{layer.count}</div>
                                            </div>
                                        </div>
                                        {checked ? (
                                            <Eye size={14} className="text-emerald-400 shrink-0" />
                                        ) : (
                                            <EyeOff size={14} className="text-slate-600 shrink-0" />
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer Reset Tool Positions */}
                    {onResetAllPositions && (
                        <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                                {isKa ? "პანელების გადაადგილების აღდგენა?" : "Moved toolbars around?"}
                            </span>
                            <button
                                onClick={onResetAllPositions}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] font-bold uppercase transition-colors cursor-pointer"
                            >
                                <RotateCcw size={12} />
                                <span>{isKa ? "პოზიციების დაბრუნება" : "Reset Positions"}</span>
                            </button>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
};

export default MapDisplayVisibilityControl;
