import React, { useMemo, useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import type { PlantationFeature, ActiveDrawingTool, DrawingTool, Layer, AreaPlantationFeature, FeatureType, LinePlantationFeature, SeedlingPlantationFeature, SeedlingCondition, VarietyRule, Template, AppMode, Crop, Organization, User, Membership } from '../types';
import { MapComponent, type MapComponentProps, FloatingSearch } from './MapComponent';
import { Polygon, Polyline, Marker } from 'react-leaflet';
import { WalkTrackingPanel, type WalkPath } from './WalkTrackingPanel';
import { toast } from 'sonner';
import InfoPanel from './InfoPanel';
import TrenchGenerationModal from './TrenchGenerationModal';
import IrrigationGenerationModal from './IrrigationGenerationModal';
import CropManagementModal, { formatPlantationCrops } from './CropManagementModal';
import CreateOrganizationModal from './CreateOrganizationModal';
import MapCanvasContextMenu from './MapCanvasContextMenu';
import { 
    FolderIcon, PlusIcon, RectangleGroupIcon, ArrowLongRightIcon, MapPinIcon, BellIcon, LeafIcon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon,
    EllipsisVerticalIcon, XIcon, XCircleIcon, WaterDropIcon, RectangleStackIcon, MinusIcon, TractorIcon,
    EyeIcon, EyeSlashIcon, GripVerticalIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, InfoIcon, SearchIcon,
    ArrowUturnLeftIcon, RulerIcon, TrashIcon, CheckIcon, RefreshCwIcon, ShieldCheckIcon,
    AlertTriangleIcon, PencilSquareIcon, MapIcon, PlayIcon, StopIcon, PauseIcon, FastForwardIcon, CompassIcon,
    CrosshairIcon, ActivityIcon, RotateCwIcon, SparklesIcon, CloudUploadIcon, MicrophoneIcon, BuildingStorefrontIcon
} from './Icons';
import { PenTool, Plane, GripHorizontal, Video, MessageSquare, Building2, Briefcase, LayoutGrid, Navigation, Camera, Server, Wifi, Mountain } from 'lucide-react';
import { offsetFeatures, calculateLineLength, generateTrenches, generateSeedlingCoordinates } from '../services/geospatialService';
import { toGeoJSON, toKML } from '../services/fileService';
import { safeStorage } from '../services/storageService';
import PencilSketchOptionsModal from './PencilSketchOptionsModal';
import DroneSimulationModal from './DroneSimulationModal';
import { SpatialAnalysisModal } from '../new_engine/ui/SpatialAnalysisModal';
import MapDisplayVisibilityControl, { DEFAULT_DISPLAY_PREFS, type DisplayToolsPreferences } from './MapDisplayVisibilityControl';
import MapFeatureContextMenu from './MapFeatureContextMenu';
import { TransparencyPopover } from './TransparencyPopover';
import { useLanguage } from '../contexts/LanguageContext';
import { CameraPlannerModal } from './SystemManagement/HardwareLabs/CameraPlannerModal';
import { CameraLiveMonitorWindow } from './SystemManagement/HardwareLabs/CameraLiveMonitorWindow';
import { AllCamerasWideModal } from './SystemManagement/HardwareLabs/AllCamerasWideModal';
import { DroneFlightPathPlanner, type DroneFlightMission } from './DroneFlightPathPlanner';
import type { PlantationCamera } from './SystemManagement/HardwareLabs/CameraNvrLab';
import { MapElementPropertiesPanel } from './MapElementPropertiesPanel';
import { NetworkCameraNvrManagerModal } from './NetworkCameraNvrManagerModal';
import { TerrainSlopeSculptorModal } from './TerrainSlopeSculptorModal';
import { type CustomTerrainSlope, setActiveSlopesCache } from '../utils/demTerrainViewshed';

interface DesignViewProps {
  layers: Layer[];
  plantationFeatures: PlantationFeature[];
  activeDrawingTool: ActiveDrawingTool;
  onSetActiveDrawingTool: (tool: ActiveDrawingTool) => void;
  onFeatureDrawn: (type: any, geometry: any, clickPos?: L.LatLng, metadata?: any) => void;
  selectedFeatureIds: string[];
  onSelectFeature: (id: string | null, options?: { event?: MouseEvent; fromPanel?: boolean; }) => void;
  onUpdateFeature: (feature: PlantationFeature) => void;
  onUpdateLayer: (layer: Layer) => void;
  onDeleteItems: (ids: string[]) => void;
  mapProps: MapComponentProps;
  onSetFlyToBounds: (bounds: L.LatLngBoundsExpression) => void;
  onGenerateTrenches: (params: { parentFeature: AreaPlantationFeature; distance: number; angle: number; plantSpacing: number; from: number; to: number; }) => void;
  onGenerateSeedlings: (trenchId: string, rules: VarietyRule[], spacing: number) => void;
  onMoveFeature?: (id: string, deltaLat: number, deltaLng: number) => void;
  onReparentFeature: (featureId: string, newParentId: string | null) => void;
  // FIX: Removed onAddSeedlingManually from DesignViewProps as it's implemented internally and not required from App.tsx.
  crops: Crop[];
  onAddLayer: (name: string, isFolder: boolean) => Promise<Layer> | void;
  onGenerateIrrigation: (params: { parentFeature: AreaPlantationFeature; distance: number; angle: number; dripperSpacing: number; litersPerDripper: number; }) => void;
  onSendCommand: (command: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImport: (file: File) => void;
  templates: Template[];
  onSetPlacingTemplate: (template: Template | null) => void;
  appMode?: AppMode;
  onClearMap?: () => void;
  isGuest?: boolean;
  onSendToBack?: (id: string) => void;
  onBringToFront?: (id: string) => void;
  isManualOffline?: boolean;
  onToggleOffline?: (offline: boolean) => void;
  tempBoundaryGeometry?: [number, number][] | null;
  harvestLogs?: any[];
  onAddCropVariety?: (variety: string) => void;
  onPublishDraftFeatures?: (drafts: PlantationFeature[]) => Promise<void>;
  onLogActivity?: (action: string, module: AppMode, status: 'success' | 'failure' | 'alert', report?: string) => Promise<void>;
  onOpenMeet?: () => void;
  onOpenChat?: () => void;
  onOpenNotes?: () => void;
  onOpenAssistant?: () => void;
  currentUser?: User | null;
  activeOrg?: Organization | null;
  organizations?: Organization[];
  onUpdateOrganization?: (org: Organization) => void;
  onAddOrg?: (org: Organization, mem: Membership, selectedCrops?: any[]) => void;
  onSwitchOrg?: (orgId: string) => void;
  onUpdateUser?: (user: User) => void;
  onStartMapRegistration?: (data: { name: string; crops?: string[]; area?: number }) => void;
}

interface MapComponentsProps extends Pick<DesignViewProps, 'layers' | 'plantationFeatures' | 'selectedFeatureIds' | 'onSelectFeature' | 'onAddLayer' | 'onDeleteItems' | 'onUpdateLayer' | 'onUpdateFeature' | 'onReparentFeature' | 'onSetActiveDrawingTool' | 'activeDrawingTool' | 'onSendToBack' | 'onBringToFront' | 'onGenerateTrenches' | 'onGenerateIrrigation' | 'onGenerateSeedlings' | 'harvestLogs'> {
    activeOrg?: Organization | null;
    organizations?: Organization[];
    crops?: Crop[];
    onOpenCropModal?: (tab: 'crops' | 'plantation') => void;
    onOpenCompanyRegistration?: () => void;
    onStartMapRegistration?: (data: { name: string; crops?: string[]; area?: number }) => void;
}

const MapComponents: React.FC<MapComponentsProps> = (props) => {
    const { layers, plantationFeatures, selectedFeatureIds, onSelectFeature, onAddLayer, onDeleteItems, onUpdateLayer, onUpdateFeature, onReparentFeature, onSetActiveDrawingTool, activeDrawingTool, onSendToBack, onBringToFront, onGenerateTrenches, onGenerateIrrigation, onGenerateSeedlings, harvestLogs, activeOrg, organizations, onOpenCropModal, onOpenCompanyRegistration, onStartMapRegistration } = props;
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: TreeItem } | null>(null);
    const [editingItem, setEditingItem] = useState<{ id: string, name: string, type: 'layer' | 'feature' } | null>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleSaveRename = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;
        if (editingItem.type === 'layer') {
            const layer = layers.find(l => l.id === editingItem.id);
            if (layer) onUpdateLayer({ ...layer, name: editingItem.name });
        } else {
            const feature = plantationFeatures.find(f => f.id === editingItem.id);
            if (feature) onUpdateFeature({ ...feature, name: editingItem.name });
        }
        setEditingItem(null);
        setContextMenu(null);
    };

    const treeData = useMemo(() => {
        // Filter out features that are from the planner/remainder module
        const filteredPlantationFeatures = plantationFeatures.filter(f => (f as any).source !== 'planner');
        const items: (any)[] = [...layers, ...filteredPlantationFeatures];
        // Filter out unwanted items
        const unwantedNames = ['Harvest login', 'map planner', 'components panel'];
        const filteredItems = items.filter(i => !unwantedNames.includes(i.name));
        
        const itemMap = new Map<string, TreeItem>();
        
        // Helper to add node
        const createNode = (i: PlantationFeature | Layer): TreeItem => {
            const isFeature = 'type' in i;
            const feature = isFeature ? i as PlantationFeature : null;
            return {
                id: i.id,
                name: i.name || (feature?.type === 'trench' ? (isKa ? `თხრილი ${i.id.substring(0, 4)}` : `Trench ${i.id.substring(0, 4)}`) : feature?.type === 'seedling' ? (isKa ? `ნერგი ${i.id.substring(0, 4)}` : `Plant ${i.id.substring(0, 4)}`) : (isKa ? 'უსახელო' : 'UNNAMED')),
                type: feature ? feature.type : 'layer',
                isVisible: i.isVisible ?? true,
                children: [],
                original: i,
                totalChildrenCount: 0
            };
        };

        // First pass: Create all nodes and include bundled items
        const processItem = (i: PlantationFeature | Layer) => {
            if (!itemMap.has(i.id)) {
                itemMap.set(i.id, createNode(i));
            }
            
            // Check for bundles
            if ('type' in i) {
                const feature = i as PlantationFeature;
                if ((feature.type === 'area' || feature.type === 'sector') && (feature as AreaPlantationFeature).bundledLines) {
                    (feature as AreaPlantationFeature).bundledLines!.forEach(l => processItem(l as unknown as PlantationFeature));
                }
                if ((feature.type === 'line' || feature.type === 'trench') && (feature as LinePlantationFeature).bundledSeedlings) {
                    (feature as LinePlantationFeature).bundledSeedlings!.forEach(s => processItem(s as unknown as PlantationFeature));
                }
            }
        };

        filteredItems.forEach(processItem);

        const roots: TreeItem[] = [];

        // Second pass: Link parents and children
        itemMap.forEach(node => {
            const item = node.original;
            let pId: string | null = null;
            
            if ('layerId' in item) {
                pId = item.parentId || item.layerId || 'root';
            } else if ((item as Layer).parentId) {
                pId = (item as Layer).parentId || 'root';
            }

            if (pId && pId !== 'root' && itemMap.has(pId)) {
                const parentNode = itemMap.get(pId)!;
                if (!parentNode.children.some(c => c.id === node.id)) {
                    parentNode.children.push(node);
                }
            } else {
                // Check if it's already a child via bundle to avoid duplicate roots
                let isAlreadyAChild = false;
                itemMap.forEach(otherNode => {
                    if (otherNode.children.some(c => c.id === node.id)) isAlreadyAChild = true;
                });
                
                if (!isAlreadyAChild) {
                    roots.push(node);
                }
            }
        });

        // Third pass: Calculate total children counts recursively
        const calculateChildren = (node: TreeItem): number => {
            let count = node.children.length;
            node.children.forEach(child => {
                count += calculateChildren(child);
            });
            node.totalChildrenCount = count;
            return count;
        };

        roots.forEach(calculateChildren);

        return roots;
    }, [layers, plantationFeatures]);

    const [isPanelMinimized, setIsPanelMinimized] = useState(false);

    const onDropToRoot = (e: React.DragEvent) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('sourceId');
        if (sourceId) {
            onReparentFeature(sourceId, 'root');
            toast.success(isKa ? "გადატანილია ძირეულში" : "Moved to Root");
        }
    };

    return (
        <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropToRoot}
            className={`fixed sm:absolute top-0 sm:top-6 left-0 sm:left-6 bottom-0 sm:bottom-6 w-full sm:w-80 bg-[#0a1224]/95 backdrop-blur-xl sm:border sm:border-white/10 sm:rounded-[2.5rem] shadow-[0_32px_64px_rgba(0,0,0,0.5)] z-[2000] flex flex-col overflow-hidden text-white animate-slide-right transition-all duration-300 ${isPanelMinimized ? '-translate-x-[calc(100%-48px)]' : ''}`}
        >
            <button 
                onClick={() => setIsPanelMinimized(!isPanelMinimized)}
                className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-12 bg-[#1a2b4b] border border-white/10 rounded-full flex items-center justify-center hover:bg-blue-600 transition-all z-50 shadow-xl cursor-pointer"
                title={isPanelMinimized ? (isKa ? "პანელის ჩვენება" : "Show Panel") : (isKa ? "პანელის დამალვა" : "Hide Panel")}
            >
                <ChevronDownIcon size={12} className={`text-white/50 transition-transform ${isPanelMinimized ? 'rotate-90' : '-rotate-90'}`} />
            </button>

            <div className={`p-6 md:p-8 pb-4 flex justify-between items-start transition-opacity ${isPanelMinimized ? 'opacity-0' : 'opacity-100'}`}>
                <div>
                    <h2 className="text-lg md:text-xl font-black italic tracking-tighter uppercase leading-none">{isKa ? 'რუკის' : 'MAP'} <span className="text-blue-500">{isKa ? 'აქტივები' : 'ASSETS'}</span></h2>
                    <p className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-[0.25em] mt-2">{isKa ? 'კომპონენტები' : 'Map Assets'}</p>
                </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('collapse-all-assets'));
                                toast.info(isKa ? "ხე ჩაიკეცა" : "Tree Collapsed", { icon: '📂' });
                            }}
                            className="p-2 md:p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl shadow-lg border border-white/5 active:scale-90 transition-all cursor-pointer"
                            title={isKa ? "ყველას ჩაკეცვა" : "Collapse All"}
                        >
                            <ArrowsPointingInIcon size={18} />
                        </button>
                        <button 
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('expand-all-assets'));
                                toast.info(isKa ? "ხე გაიშალა" : "Tree Expanded", { icon: '📖' });
                            }}
                            className="p-2 md:p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl shadow-lg border border-white/5 active:scale-90 transition-all cursor-pointer"
                            title={isKa ? "ყველას გაშლა" : "Expand All"}
                        >
                            <ArrowsPointingOutIcon size={18} />
                        </button>
                        <button 
                            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                            className="p-2 md:p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-900/20 active:scale-90 transition-all cursor-pointer"
                            title={isKa ? "ფენის / საქაღალდის დამატება" : "Add Layer / Folder"}
                        >
                            <PlusIcon size={18} />
                        </button>
                        <button onClick={() => onSelectFeature(null)} className="md:hidden p-2 bg-white/10 rounded-xl text-white">
                            <XIcon size={18} />
                        </button>
                    </div>
            </div>

            {/* Active Company & Plantation Crops Section */}
            <div className="mx-4 mb-3 p-3 bg-gradient-to-r from-emerald-950/70 via-[#102035]/80 to-[#0c1828] border border-emerald-500/25 rounded-2xl transition-all shadow-md">
                <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                        <span className="text-[10px] font-black text-slate-200 uppercase tracking-tight truncate">
                            {activeOrg?.name || (isKa ? 'აქტიური კომპანია' : 'Company')}
                        </span>
                    </div>
                    <button 
                        onClick={() => onOpenCropModal?.('plantation')}
                        className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-transform active:scale-95 flex-shrink-0"
                        title={isKa ? "პლანტაციის კულტურების არჩევა / შეცვლა" : "Choose / Change Plantation Crops"}
                    >
                        <LeafIcon className="w-2.5 h-2.5 text-emerald-400" />
                        <span>{isKa ? 'არჩევა' : 'Choose'}</span>
                    </button>
                </div>
                <div 
                    onClick={() => onOpenCropModal?.('plantation')}
                    className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-300 bg-black/30 hover:bg-black/45 px-2.5 py-1.5 rounded-xl border border-emerald-500/15 cursor-pointer transition-colors group"
                    title={isKa ? "დააჭირეთ კულტურების ასარჩევად ან სამართავად" : "Click to select or manage plantation crops"}
                >
                    <span className="truncate flex-1">
                        {formatPlantationCrops(activeOrg?.plantationCrops || activeOrg?.crops, isKa)}
                    </span>
                    <PencilSquareIcon className="w-3 h-3 text-emerald-400 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                </div>
            </div>

            {/* Company Registration Tools Section (Below Crop Management) */}
            <div className="mx-4 mb-3 p-3 bg-gradient-to-r from-blue-950/70 via-[#102035]/80 to-[#0c1828] border border-blue-500/25 rounded-2xl transition-all shadow-md">
                <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                        <span className="text-[10px] font-black text-slate-200 uppercase tracking-tight truncate">
                            {isKa ? 'კომპანიის რეგისტრაცია' : 'Company Registration'}
                        </span>
                    </div>
                    <button 
                        onClick={() => onOpenCompanyRegistration?.()}
                        className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-transform active:scale-95 flex-shrink-0"
                        title={isKa ? "კომპანიის რეგისტრაცია / პროფილი" : "Register / Manage Enterprise"}
                    >
                        <BuildingStorefrontIcon className="w-2.5 h-2.5 text-blue-400" />
                        <span>{isKa ? 'რეგისტრაცია' : 'Register'}</span>
                    </button>
                </div>
                {activeOrg ? (
                    <div className="space-y-1.5">
                        <div 
                            onClick={() => onOpenCompanyRegistration?.()}
                            className="flex items-center justify-between gap-1.5 text-[9px] font-bold text-blue-200 bg-black/30 hover:bg-black/45 px-2.5 py-1.5 rounded-xl border border-blue-500/15 cursor-pointer transition-colors group"
                            title={isKa ? "დააჭირეთ კომპანიის სამართავად ან ახლის დასარეგისტრირებლად" : "Click to manage or register companies"}
                        >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                                <span className="font-black text-white truncate">{activeOrg.name}</span>
                                {activeOrg.type && (
                                    <span className="px-1 py-0.2 bg-blue-500/20 text-blue-300 text-[7.5px] rounded border border-blue-500/30">
                                        {activeOrg.type}
                                    </span>
                                )}
                            </div>
                            <span className="text-[8px] text-blue-400 font-normal shrink-0">
                                {activeOrg.region || (activeOrg.areaHa ? `${activeOrg.areaHa} ha` : '')}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => onOpenCompanyRegistration?.()}
                                className="flex-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                                <BuildingStorefrontIcon className="w-2.5 h-2.5 text-blue-400" />
                                <span>{isKa ? '+ ახალი კომპანია' : '+ New Enterprise'}</span>
                            </button>
                            {onStartMapRegistration && (
                                <button
                                    type="button"
                                    onClick={() => onStartMapRegistration({ name: activeOrg.name })}
                                    className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                                    title={isKa ? "კომპანიის საზღვრის მოხაზვა რუკაზე" : "Draw Company Boundary on Map"}
                                >
                                    <CompassIcon className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>{isKa ? 'საზღვარი' : 'Boundary'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => onOpenCompanyRegistration?.()}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                        <BuildingStorefrontIcon className="w-3 h-3" />
                        <span>{isKa ? '+ კომპანიის რეგისტრაცია' : '+ Register Company'}</span>
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 custom-scrollbar mb-4">
                <div className="space-y-1">
                    {treeData.map(node => (
                        <TreeNode 
                            key={node.id} 
                            item={node} 
                            level={0} 
                            selectedIds={selectedFeatureIds} 
                            onSelect={onSelectFeature as any}
                            onUpdateFeature={onUpdateFeature}
                            onUpdateLayer={onUpdateLayer}
                            onReparentFeature={onReparentFeature}
                            activeLayerId={activeDrawingTool.activeLayerId}
                            onSetActiveLayer={(id) => onSetActiveDrawingTool({ ...activeDrawingTool, activeLayerId: id })}
                            onContextMenu={(e, item) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }); }}
                            onSendToBack={onSendToBack}
                            onBringToFront={onBringToFront}
                        />
                    ))}
                </div>
            </div>

            {isAddMenuOpen && (
                <div className="absolute top-20 right-8 bg-[#1a2b4b] border border-white/10 rounded-2xl shadow-2xl p-2 z-10 w-56 text-[10px] font-black uppercase tracking-widest animate-slide-up">
                    <button onClick={() => { onAddLayer(isKa ? "ახალი ფენა" : "New Layer", false); setIsAddMenuOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl cursor-pointer">
                        {isKa ? 'მონაცემთა ფენის დამატება' : 'Add Data Layer'}
                    </button>
                    <button onClick={() => { onAddLayer(isKa ? "ახალი საქაღალდე" : "New Folder", true); setIsAddMenuOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl border-t border-white/5 cursor-pointer">
                        {isKa ? 'საქაღალდის შექმნა' : 'Create Folder'}
                    </button>
                    <button 
                        onClick={() => { 
                            onOpenCropModal?.('crops');
                            setIsAddMenuOpen(false); 
                        }} 
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/20 text-emerald-300 rounded-xl border-t border-white/10 flex items-center justify-between cursor-pointer group"
                    >
                        <span>{isKa ? 'კულტურები & ჯიშები' : 'Add & Manage Crops & Varieties'}</span>
                        <LeafIcon className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                        onClick={() => { 
                            onOpenCropModal?.('plantation');
                            setIsAddMenuOpen(false); 
                        }} 
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-500/20 text-blue-300 rounded-xl border-t border-white/5 flex items-center justify-between cursor-pointer group"
                    >
                        <span>{isKa ? 'პლანტაციის კულტურები' : 'Choose Plantation Crops'}</span>
                        <span className="text-[9px] bg-blue-500/30 px-1.5 py-0.5 rounded text-blue-200">Multi</span>
                    </button>
                </div>
            )}

            {contextMenu && (
                <div 
                    ref={menuRef}
                    className="fixed bg-white rounded-2xl shadow-2xl py-2 z-[3000] min-w-[180px] text-[10px] font-black uppercase tracking-widest text-slate-600 animate-fade-in"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button 
                        onClick={() => {
                            setEditingItem({ 
                                id: contextMenu.item.id, 
                                name: contextMenu.item.name, 
                                type: contextMenu.item.type === 'layer' ? 'layer' : 'feature' 
                            });
                        }} 
                        className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 cursor-pointer"
                    >
                        <PencilSquareIcon size={14} className="text-blue-500" />
                        {isKa ? 'სახელის გადარქმევა' : 'Rename Item'}
                    </button>
                    <button onClick={() => { onSelectFeature(contextMenu.item.id); setContextMenu(null); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center gap-3 cursor-pointer">
                        {isKa ? 'ფოკუსირება ობიექტზე' : 'Focus on Item'}
                    </button>
                    {contextMenu.item.type !== 'layer' && (
                        <>
                            <button 
                                onClick={() => { onSendToBack?.(contextMenu.item.id); setContextMenu(null); }} 
                                className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center gap-3 cursor-pointer"
                            >
                                <RectangleStackIcon size={14} className="text-slate-400" />
                                {isKa ? 'უკანა პლანზე გადატანა' : 'Send to Back'}
                            </button>
                            <button 
                                onClick={() => { onBringToFront?.(contextMenu.item.id); setContextMenu(null); }} 
                                className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center gap-3 cursor-pointer"
                            >
                                <RectangleStackIcon size={14} className="text-blue-400" />
                                {isKa ? 'წინა პლანზე გადმოტანა' : 'Bring to Front'}
                            </button>
                        </>
                    )}
                    {contextMenu.item.type === 'layer' && (
                        <button 
                            onClick={() => { 
                                onSetActiveDrawingTool({ ...activeDrawingTool, activeLayerId: contextMenu.item.id }); 
                                setContextMenu(null); 
                            }} 
                            className="w-full text-left px-5 py-3 hover:bg-blue-50 text-blue-600 flex items-center gap-3 cursor-pointer"
                        >
                            <PlusIcon size={14} />
                            {isKa ? 'აქტიურ ფენად დაყენება' : 'Set as Active Layer'}
                        </button>
                    )}
                    {(contextMenu.item.type === 'area' || contextMenu.item.type === 'sector') && (
                        <>
                            <button 
                                onClick={() => { 
                                    onGenerateTrenches({ parentFeature: contextMenu.item.original as AreaPlantationFeature, distance: 6, angle: 0, plantSpacing: 2.5, from: 0, to: 100 }); 
                                    setContextMenu(null); 
                                }} 
                                className="w-full text-left px-5 py-3 hover:bg-emerald-50 text-emerald-600 flex items-center gap-3 border-t border-slate-50 cursor-pointer"
                            >
                                <RulerIcon size={14} />
                                {isKa ? 'რიგების გენერირება' : 'Generate Rows'}
                            </button>
                            <button 
                                onClick={() => { 
                                    onGenerateIrrigation({ parentFeature: contextMenu.item.original as AreaPlantationFeature, distance: 6, angle: 0, dripperSpacing: 0.5, litersPerDripper: 1.6 }); 
                                    setContextMenu(null); 
                                }} 
                                className="w-full text-left px-5 py-3 hover:bg-blue-50 text-blue-600 flex items-center gap-3 cursor-pointer"
                            >
                                <WaterDropIcon size={14} />
                                {isKa ? 'მორწყვის გენერირება' : 'Generate Irrigation'}
                            </button>
                        </>
                    )}
                    {(contextMenu.item.type === 'line' && (contextMenu.item.original as LinePlantationFeature).lineType === 'row') && (
                        <button 
                            onClick={() => { 
                                const feature = contextMenu.item.original as LinePlantationFeature;
                                onUpdateFeature({ ...feature, type: 'trench' });
                                setContextMenu(null);
                                toast.success(isKa ? "გადაკეთდა თხრილის აქტივად" : "Converted to Trench Asset");
                            }} 
                            className="w-full text-left px-5 py-3 hover:bg-amber-50 text-amber-600 flex items-center gap-3 border-t border-slate-50 cursor-pointer"
                        >
                            <TractorIcon size={14} />
                            {isKa ? 'თხრილად გადაკეთება' : 'Convert to Trench'}
                        </button>
                    )}
                    {(contextMenu.item.type === 'line' || contextMenu.item.type === 'trench') && (
                        <button 
                            onClick={() => { 
                                onGenerateSeedlings(contextMenu.item.id as string, [], 0.5); 
                                setContextMenu(null); 
                            }} 
                            className="w-full text-left px-5 py-3 hover:bg-emerald-50 text-emerald-600 flex items-center gap-3 border-t border-slate-50 cursor-pointer"
                        >
                            <LeafIcon size={14} />
                            {isKa ? 'დარგვის ბრძანება' : 'Plant Command'}
                        </button>
                    )}
                    {contextMenu.item.type === 'seedling' && (
                        <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/50">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-[0.15em]">{isKa ? 'ჯანმრთელობის სტატუსი' : 'Refine Health Status'}</p>
                            <div className="flex gap-1">
                                {([
                                    { key: 'Good', labelKa: 'კარგი', labelEn: 'Good' },
                                    { key: 'Suspicious', labelKa: 'რისკი', labelEn: 'Risk' },
                                    { key: 'Dried', labelKa: 'გამხმარი', labelEn: 'Dried' }
                                ] as const).map(condition => (
                                    <button 
                                        key={condition.key}
                                        onClick={() => {
                                            const feature = contextMenu.item.original as SeedlingPlantationFeature;
                                            onUpdateFeature({ ...feature, condition: condition.key });
                                            setContextMenu(null);
                                            toast.success(isKa ? `ნერგი მონიშნულია: ${condition.labelKa}` : `Plant marked as ${condition.key}`);
                                        }}
                                        className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all cursor-pointer ${
                                            condition.key === 'Good' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500' :
                                            condition.key === 'Suspicious' ? 'bg-amber-50 text-amber-600 hover:bg-amber-500' :
                                            'bg-red-50 text-red-600 hover:bg-red-500'
                                        } hover:text-white`}
                                    >
                                        {isKa ? condition.labelKa : condition.labelEn}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Crop Management */}
                    <button 
                        onClick={() => {
                            onOpenCropModal?.('plantation');
                            setContextMenu(null);
                        }}
                        className="w-full text-left px-5 py-2.5 hover:bg-emerald-50 text-emerald-600 flex items-center gap-3 border-t border-slate-100 text-xs font-bold cursor-pointer"
                    >
                        <LeafIcon size={14} />
                        <span>{isKa ? 'კულტურების მართვა' : 'Crop Management'}</span>
                    </button>

                    {/* Company Registration */}
                    <button 
                        onClick={() => {
                            onOpenCompanyRegistration?.();
                            setContextMenu(null);
                        }}
                        className="w-full text-left px-5 py-2.5 hover:bg-blue-50 text-blue-600 flex items-center gap-3 border-t border-slate-100 text-xs font-bold cursor-pointer"
                    >
                        <BuildingStorefrontIcon size={14} />
                        <span>{isKa ? 'კომპანიის რეგისტრაცია' : 'Company Registration'}</span>
                    </button>

                    <button onClick={() => { onDeleteItems([contextMenu.item.id]); setContextMenu(null); }} className="w-full text-left px-5 py-3 hover:bg-red-50 text-red-600 flex items-center gap-3 border-t border-slate-100 font-bold cursor-pointer">
                        <TrashIcon size={14} />
                        {isKa ? 'აქტივის წაშლა' : 'Delete Asset'}
                    </button>
                </div>
            )}
            {editingItem && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[4000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-slide-up">
                        <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl mb-6">{isKa ? 'აქტივის სახელის შეცვლა' : 'Rename Asset'}</h3>
                        <form onSubmit={handleSaveRename} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{isKa ? 'ახალი სახელი' : 'New Name'}</label>
                                <input 
                                    autoFocus
                                    value={editingItem.name}
                                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setEditingItem(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] cursor-pointer">{isKa ? 'გაუქმება' : 'Cancel'}</button>
                                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 cursor-pointer">{isKa ? 'შენახვა' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const TreeNode: React.FC<{
    item: TreeItem,
    level: number,
    selectedIds: string[],
    onSelect: (id: string, options: any) => void,
    onContextMenu: (e: React.MouseEvent, item: TreeItem) => void,
    onUpdateFeature: (feature: PlantationFeature) => void,
    onUpdateLayer: (layer: Layer) => void,
    onReparentFeature: (featureId: string, newParentId: string | null) => void,
    activeLayerId?: string;
    onSetActiveLayer: (id: string) => void;
    onSendToBack?: (id: string) => void;
    onBringToFront?: (id: string) => void;
}> = ({ item, level, selectedIds, onSelect, onContextMenu, onUpdateFeature, onUpdateLayer, onReparentFeature, activeLayerId, onSetActiveLayer, onSendToBack, onBringToFront }) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const [isExpanded, setIsExpanded] = useState(() => {
        const stored = safeStorage.getItem(`expanded-node-${item.id}`);
        return stored === null ? true : stored === 'true';
    });

    useEffect(() => {
        safeStorage.setItem(`expanded-node-${item.id}`, isExpanded.toString());
    }, [isExpanded, item.id]);

    useEffect(() => {
        const handleCollapseAll = () => {
            setIsExpanded(false);
            safeStorage.setItem(`expanded-node-${item.id}`, 'false');
        };
        const handleExpandAll = () => {
            setIsExpanded(true);
            safeStorage.setItem(`expanded-node-${item.id}`, 'true');
        };
        window.addEventListener('collapse-all-assets', handleCollapseAll);
        window.addEventListener('expand-all-assets', handleExpandAll);
        return () => {
            window.removeEventListener('collapse-all-assets', handleCollapseAll);
            window.removeEventListener('expand-all-assets', handleExpandAll);
        };
    }, [item.id]); // Re-subscribe if ID changes

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('sourceId', id);
        e.stopPropagation();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const sourceId = e.dataTransfer.getData('sourceId');
        if (sourceId && sourceId !== targetId) {
            onReparentFeature(sourceId, targetId === 'root' ? null : targetId);
        }
    };

    const isSelected = selectedIds.includes(item.id);
    const isFolder = item.type === 'layer' && (item.original as Layer).isFolder;
    const nodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isSelected && nodeRef.current) {
            nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [isSelected]);

    // Auto-expand if a child is selected
    useEffect(() => {
        const hasSelectedChild = (node: TreeItem): boolean => {
            if (selectedIds.includes(node.id)) return true;
            return node.children.some(child => hasSelectedChild(child));
        };
        if (hasSelectedChild(item)) {
            setIsExpanded(true);
        }
    }, [selectedIds, item]);

    const getIcon = () => {
        if (isFolder) return <FolderIcon size={14} className="text-amber-500" />;
        
        if (item.type === 'layer') {
            return <FolderIcon size={14} className="text-slate-400" />;
        }

        const feature = item.original as PlantationFeature;
        
        switch(item.type) {
            case 'area': return <RectangleGroupIcon size={14} className="text-blue-400" />;
            case 'sector': return <RectangleGroupIcon size={14} className="text-emerald-400" />;
            case 'line': return <ArrowLongRightIcon size={14} className="text-orange-400" />;
            case 'trench': return <ArrowLongRightIcon size={14} className="text-amber-400" />;
            case 'irrigation_line': return <WaterDropIcon size={14} className="text-sky-400" />;
            case 'seedling': {
                const condition = (feature as SeedlingPlantationFeature).condition || 'Good';
                const colors = { Good: 'text-emerald-500', Suspicious: 'text-amber-500', Dried: 'text-red-500' };
                return <LeafIcon size={12} className={colors[condition] || 'text-slate-400'} />;
            }
            case 'note': return <MapPinIcon size={14} className="text-rose-500" />;
            case 'checkpoint': return <BellIcon size={14} className="text-violet-500" />;
            default: return <RectangleStackIcon size={14} className="text-slate-400" />;
        }
    };

    const toggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.type === 'layer') {
            onUpdateLayer({ ...item.original as Layer, isVisible: !item.isVisible });
        } else {
            onUpdateFeature({ ...item.original as PlantationFeature, isVisible: !item.isVisible });
        }
    };

    return (
        <div>
            <div 
                ref={nodeRef}
                onClick={(e) => onSelect(item.id, { fromPanel: true, event: e })}
                onContextMenu={(e) => onContextMenu(e, item)}
                draggable={true}
                onDragStart={(e) => {
                    e.dataTransfer.setData('sourceId', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                    // Visual feedback
                    if (nodeRef.current) nodeRef.current.style.opacity = '0.4';
                }}
                onDragEnd={() => {
                    if (nodeRef.current) nodeRef.current.style.opacity = '1';
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    const acceptsChildren = item.type === 'layer' || item.type === 'area' || item.type === 'sector';
                    if (acceptsChildren) {
                        e.dataTransfer.dropEffect = 'move';
                        if (nodeRef.current) nodeRef.current.classList.add('bg-blue-600/20', 'ring-2', 'ring-blue-500');
                    }
                }}
                onDragLeave={() => {
                    if (nodeRef.current) nodeRef.current.classList.remove('bg-blue-600/20', 'ring-2', 'ring-blue-500');
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    if (nodeRef.current) nodeRef.current.classList.remove('bg-blue-600/20', 'ring-2', 'ring-blue-500');
                    const sourceId = e.dataTransfer.getData('sourceId');
                    const acceptsChildren = item.type === 'layer' || item.type === 'area' || item.type === 'sector';
                    if (sourceId && sourceId !== item.id && acceptsChildren) {
                        onReparentFeature(sourceId, item.id);
                        toast.success(isKa ? "ობიექტი გადაადგილდა" : "Item moved");
                    }
                }}
                className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-all group ${isSelected ? 'bg-blue-600 text-white shadow-lg ring-1 ring-blue-400' : 'hover:bg-white/5 text-slate-300'} ${activeLayerId === item.id ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''}`}
                style={{ marginLeft: `${level * 12}px` }}
            >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {item.children.length > 0 ? (
                        <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="transition-transform active:scale-75">
                            {isExpanded ? <ChevronDownIcon size={12}/> : <ChevronRightIcon size={12}/>}
                        </button>
                    ) : <div className="w-3" />}
                    <div className="flex-shrink-0">{getIcon()}</div>
                    <span className={`text-[10px] font-black uppercase tracking-tight truncate flex-1 ${activeLayerId === item.id ? 'text-blue-400' : ''}`}>{item.name}</span>
                    {activeLayerId === item.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    )}
                </div>
                
                <button 
                    onClick={toggleVisibility}
                    className={`p-1.5 rounded-lg transition-all ${item.isVisible ? 'text-blue-400 opacity-0 group-hover:opacity-100' : 'text-slate-600 opacity-100'}`}
                >
                    {item.isVisible ? <EyeIcon size={14} /> : <EyeSlashIcon size={14} />}
                </button>
            </div>
            {isExpanded && item.children.map(child => (
                <TreeNode 
                    key={child.id} 
                    item={child} 
                    level={level + 1} 
                    selectedIds={selectedIds} 
                    onSelect={onSelect} 
                    onContextMenu={onContextMenu} 
                    onUpdateFeature={onUpdateFeature} 
                    onUpdateLayer={onUpdateLayer} 
                    onReparentFeature={onReparentFeature} 
                    activeLayerId={activeLayerId}
                    onSetActiveLayer={onSetActiveLayer}
                    onSendToBack={onSendToBack}
                    onBringToFront={onBringToFront}
                />
            ))}
        </div>
    );
};

interface TreeItem {
    id: string;
    name: string;
    type: FeatureType | 'layer';
    isVisible: boolean;
    children: TreeItem[];
    original: Layer | PlantationFeature;
    totalChildrenCount: number;
}

const isLatLngValidLocal = (p: any): p is [number, number] => {
    if (!p || !Array.isArray(p) || p.length !== 2) return false;
    const lat = typeof p[0] === 'string' ? parseFloat(p[0]) : p[0];
    const lng = typeof p[1] === 'string' ? parseFloat(p[1]) : p[1];
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
};

const DesignView: React.FC<DesignViewProps> = (props) => {
    const { 
        activeDrawingTool, onSetActiveDrawingTool, mapProps, onFeatureDrawn, 
        canUndo, canRedo, onUndo, onRedo, plantationFeatures, 
        selectedFeatureIds, onReparentFeature, isGuest, onSetFlyToBounds, 
        onSelectFeature, crops, layers, isManualOffline, onToggleOffline
    } = props;

    const { language } = useLanguage();
    const isKa = language === 'ka';

    const cropVarieties = useMemo(() => {
        const varieties = new Set<string>();
        crops?.forEach(c => {
            c.varieties?.forEach(v => varieties.add(v));
        });
        return Array.from(varieties);
    }, [crops]);
    const [isLayersHidden, setIsLayersHidden] = useState(false);
    const [isSatellite, setIsSatellite] = useState(true);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [editingGeometryId, setEditingGeometryId] = useState<string | null>(null);
    const [isHubOpen, setIsHubOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    
    // Simulation Drawing & Draft State
    const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
    const [draftFeatures, setDraftFeatures] = useState<PlantationFeature[]>(() => {
        const stored = safeStorage.getItem('agrimap_draft_features');
        return stored ? safeStorage.safeParse(stored, []) : [];
    });
    // Default collapsed to keep the screen uncluttered and avoid spamming the user
    const [isSandboxCollapsed, setIsSandboxCollapsed] = useState<boolean>(() => safeStorage.getItem('agrimap_sandbox_collapsed') !== 'false');
    const [isSandboxDismissed, setIsSandboxDismissed] = useState<boolean>(false);

    useEffect(() => {
        safeStorage.setItem('agrimap_draft_features', JSON.stringify(draftFeatures));
    }, [draftFeatures]);

    // Combined features for map, tree components, and inspection
    const allFeatures = useMemo(() => {
        const map = new Map<string, PlantationFeature>();
        plantationFeatures.forEach(f => map.set(f.id, f));
        draftFeatures.forEach(f => map.set(f.id, f));
        return Array.from(map.values());
    }, [plantationFeatures, draftFeatures]);
    
    const [trenchModalFeature, setTrenchModalFeature] = useState<AreaPlantationFeature | null>(null);
    const [irrigationModalFeature, setIrrigationModalFeature] = useState<AreaPlantationFeature | null>(null);
    const [trenchPreviewLines, setTrenchPreviewLines] = useState<[number, number][][] | null>(null);

    // GPS Walking Path Tracker States
    const [isTracking, setIsTracking] = useState(false);
    const [trackedPoints, setTrackedPoints] = useState<[number, number][]>([]);
    const [walkedPaths, setWalkedPaths] = useState<WalkPath[]>(() => {
        const stored = safeStorage.getItem('mock_walked_paths');
        return stored ? safeStorage.safeParse(stored, []) : [];
    });
    const [isTrackingPanelOpen, setIsTrackingPanelOpen] = useState(false);

    // Save walked paths to local storage
    useEffect(() => {
        safeStorage.setItem('mock_walked_paths', JSON.stringify(walkedPaths));
    }, [walkedPaths]);

    // GPS Geolocated walking watch
    const watchIdRef = useRef<number | null>(null);
    useEffect(() => {
        if (isTracking) {
            if (navigator.geolocation) {
                toast.info("GPS Path Tracker Activated. Walk to draw details on map!");
                watchIdRef.current = navigator.geolocation.watchPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                            setTrackedPoints(prev => {
                                if (prev.length > 0) {
                                    const last = prev[prev.length - 1];
                                    // distance calculation (threshold: 1.5 meters)
                                    const R = 6371e3;
                                    const phi1 = last[0] * Math.PI/180;
                                    const phi2 = latitude * Math.PI/180;
                                    const deltaPhi = (latitude - last[0]) * Math.PI/180;
                                    const deltaLambda = (longitude - last[1]) * Math.PI/180;
                                    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
                                              Math.cos(phi1) * Math.cos(phi2) *
                                              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
                                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                    const distance = R * c;
                                    
                                    if (distance < 1.5) return prev;
                                }
                                const nextVal = [latitude, longitude] as [number, number];
                                return [...prev, nextVal];
                            });

                            // Center/fly map to latest point
                            props.onSetFlyToBounds([
                                [latitude - 0.001, longitude - 0.001],
                                [latitude + 0.001, longitude + 0.001]
                            ]);
                        }
                    },
                    (err) => {
                        console.error("GPS Tracker Watch error", err);
                        toast.warning("GPS connection weak. Make sure location services are enabled!");
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            } else {
                toast.error("GPS Geolocator is not supported by your workspace browser.");
            }
        } else {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        }

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [isTracking]);

    const [isLocating, setIsLocating] = useState<boolean>(false);

    // Dynamic Geolocation Fly To Me Handler
    const handleFlyToMe = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser.");
            return;
        }
        setIsLocating(true);
        const toastId = toast.loading("Acquiring GPS coordinates...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                    props.onSetFlyToBounds([
                        [latitude - 0.003, longitude - 0.003],
                        [latitude + 0.003, longitude + 0.003]
                    ]);
                    toast.dismiss(toastId);
                    toast.success(`Arrived at location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                } else {
                    toast.dismiss(toastId);
                    toast.error("Invalid GPS coordinates retrieved.");
                }
                setIsLocating(false);
            },
            (err) => {
                toast.dismiss(toastId);
                let msg = "Could not retrieve your location.";
                if (err.code === err.PERMISSION_DENIED) {
                    msg = "Location permission denied. Please allow geolocation access in your browser.";
                }
                toast.error(msg);
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // Reset preview lines when modal closes
    useEffect(() => {
        if (!trenchModalFeature) {
            setTrenchPreviewLines(null);
        }
    }, [trenchModalFeature]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 1024) {
                setIsHubOpen(false);
                setIsInfoOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Map & GPS Tools Dropdown State (Collapsed option)
    const [isMapToolsMenuOpen, setIsMapToolsMenuOpen] = useState<boolean>(false);
    const [isTopBadgesCollapsed, setIsTopBadgesCollapsed] = useState<boolean>(false);
    const mapToolsMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isMapToolsMenuOpen) return;
        const handleClickOutside = (e: MouseEvent | PointerEvent) => {
            if (mapToolsMenuRef.current && !mapToolsMenuRef.current.contains(e.target as Node)) {
                setIsMapToolsMenuOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleClickOutside);
        return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, [isMapToolsMenuOpen]);

    // Movable & Resizable Floating Toolbar State
    const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(() => {
        const stored = safeStorage.getItem('agrimap_design_toolbar_pos');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
                    return parsed;
                }
            } catch (e) {}
        }
        return null;
    });

    const [toolbarScale, setToolbarScale] = useState<number>(() => {
        const stored = safeStorage.getItem('agrimap_design_toolbar_scale');
        return stored ? (parseFloat(stored) || 1) : 1;
    });

    const [isToolbarMinimized, setIsToolbarMinimized] = useState<boolean>(() => {
        return safeStorage.getItem('agrimap_design_toolbar_minimized') === 'true';
    });

    const toolbarRef = useRef<HTMLDivElement | null>(null);
    const isDraggingToolbarRef = useRef<boolean>(false);
    const toolbarDragStartRef = useRef<{ pointerX: number; pointerY: number; startLeft: number; startTop: number }>({
        pointerX: 0,
        pointerY: 0,
        startLeft: 0,
        startTop: 0
    });

    const handleToolbarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // If clicking a button, input, or interactive element inside, do not initiate dragging
        if ((e.target as HTMLElement).closest('button, input, select, a, textarea')) return;
        
        e.preventDefault();
        const target = e.currentTarget;
        try {
            target.setPointerCapture(e.pointerId);
        } catch (err) {}

        const rect = toolbarRef.current?.getBoundingClientRect();
        const currentLeft = rect ? rect.left : (window.innerWidth / 2 - 200);
        const currentTop = rect ? rect.top : 32;

        isDraggingToolbarRef.current = true;
        toolbarDragStartRef.current = {
            pointerX: e.clientX,
            pointerY: e.clientY,
            startLeft: currentLeft,
            startTop: currentTop
        };
    };

    const handleToolbarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingToolbarRef.current) return;
        e.preventDefault();
        const dx = e.clientX - toolbarDragStartRef.current.pointerX;
        const dy = e.clientY - toolbarDragStartRef.current.pointerY;

        const width = toolbarRef.current?.offsetWidth || 320;
        const height = toolbarRef.current?.offsetHeight || 50;
        const maxX = Math.max(10, window.innerWidth - width - 10);
        const maxY = Math.max(10, window.innerHeight - height - 60);

        const newX = Math.max(10, Math.min(maxX, toolbarDragStartRef.current.startLeft + dx));
        const newY = Math.max(10, Math.min(maxY, toolbarDragStartRef.current.startTop + dy));

        setToolbarPos({ x: Math.round(newX), y: Math.round(newY) });
    };

    const handleToolbarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDraggingToolbarRef.current) {
            isDraggingToolbarRef.current = false;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch (err) {}
            setToolbarPos(prev => {
                if (prev) {
                    safeStorage.setItem('agrimap_design_toolbar_pos', JSON.stringify(prev));
                }
                return prev;
            });
        }
    };

    const handleResetToolbarPosition = () => {
        setToolbarPos(null);
        safeStorage.removeItem('agrimap_design_toolbar_pos');
        toast.info("Toolbar position reset to top center");
    };

    const handleToggleToolbarScale = () => {
        const scales = [1, 0.85, 0.72];
        const currentIndex = scales.indexOf(toolbarScale);
        const nextScale = scales[(currentIndex + 1) % scales.length];
        setToolbarScale(nextScale);
        safeStorage.setItem('agrimap_design_toolbar_scale', nextScale.toString());
        toast.info(`Toolbar scale: ${Math.round(nextScale * 100)}%`);
    };

    // Movable Undo/Redo (History) Panel State
    const [historyPos, setHistoryPos] = useState<{ x: number; y: number } | null>(() => {
        const stored = safeStorage.getItem('agrimap_design_history_pos');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
                    return parsed;
                }
            } catch (e) {}
        }
        return null;
    });

    const isDraggingHistoryRef = useRef<boolean>(false);
    const historyDragStartRef = useRef<{ pointerX: number; pointerY: number; startLeft: number; startTop: number }>({
        pointerX: 0,
        pointerY: 0,
        startLeft: 0,
        startTop: 0
    });
    const historyPanelRef = useRef<HTMLDivElement | null>(null);

    const handleHistoryPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, input, select, a')) return;
        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {}

        const rect = historyPanelRef.current?.getBoundingClientRect();
        const currentLeft = rect ? rect.left : (window.innerWidth - 80);
        const currentTop = rect ? rect.top : (window.innerHeight - 150);

        isDraggingHistoryRef.current = true;
        historyDragStartRef.current = {
            pointerX: e.clientX,
            pointerY: e.clientY,
            startLeft: currentLeft,
            startTop: currentTop
        };
    };

    const handleHistoryPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingHistoryRef.current) return;
        e.preventDefault();
        const dx = e.clientX - historyDragStartRef.current.pointerX;
        const dy = e.clientY - historyDragStartRef.current.pointerY;

        const width = historyPanelRef.current?.offsetWidth || 60;
        const height = historyPanelRef.current?.offsetHeight || 120;
        const maxX = Math.max(10, window.innerWidth - width - 10);
        const maxY = Math.max(10, window.innerHeight - height - 60);

        const newX = Math.max(10, Math.min(maxX, historyDragStartRef.current.startLeft + dx));
        const newY = Math.max(10, Math.min(maxY, historyDragStartRef.current.startTop + dy));

        setHistoryPos({ x: Math.round(newX), y: Math.round(newY) });
    };

    const handleHistoryPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDraggingHistoryRef.current) {
            isDraggingHistoryRef.current = false;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch (err) {}
            setHistoryPos(prev => {
                if (prev) {
                    safeStorage.setItem('agrimap_design_history_pos', JSON.stringify(prev));
                }
                return prev;
            });
        }
    };

    const handleResetHistoryPosition = () => {
        setHistoryPos(null);
        safeStorage.removeItem('agrimap_design_history_pos');
        toast.info("History panel position reset to default");
    };

    // Display Tools & Visibility Preferences
    const [displayPrefs, setDisplayPrefs] = useState<DisplayToolsPreferences>(() => {
        const saved = safeStorage.getItem('agrimap_display_tools_prefs');
        if (saved) {
            try {
                return { ...DEFAULT_DISPLAY_PREFS, ...JSON.parse(saved) };
            } catch (e) {}
        }
        return DEFAULT_DISPLAY_PREFS;
    });

    const handleDisplayPrefsChange = (newPrefs: DisplayToolsPreferences) => {
        setDisplayPrefs(newPrefs);
        safeStorage.setItem('agrimap_display_tools_prefs', JSON.stringify(newPrefs));
    };

    // Drone Flight Simulation Modal State
    const [isDroneSimOpen, setIsDroneSimOpen] = useState(false);
    // AI Spatial Analysis Modal State (Decoupled Worker Engine)
    const [isSpatialAnalysisOpen, setIsSpatialAnalysisOpen] = useState(false);

    // Surveillance Cameras & Hardware State
    const [cameras, setCameras] = useState<PlantationCamera[]>(() => {
        const saved = safeStorage.getItem('agrimap_plantation_cameras');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        const baseLat = mapProps.center?.[0] || 41.9023;
        const baseLng = mapProps.center?.[1] || 44.5;
        return [
            {
                id: 'cam-01',
                name: 'Main Plantation Gate & Weigh Scale',
                channel: 1,
                model: 'Hikvision DS-2CD2087G2-LU (4K ColorVu)',
                ipAddress: '192.168.1.121',
                rtspPort: 554,
                locationName: 'Front Security Gate & Weighing Terminal',
                lat: baseLat - 0.0018,
                lng: baseLng - 0.0005,
                mountHeightM: 6,
                azimuthDeg: 45,
                fovAngleDeg: 102,
                rangeM: 65,
                tiltAngleDeg: 4, // 4 degrees down-tilt as requested
                isPtz: false,
                isNightVision: true,
                status: 'RECORDING'
            },
            {
                id: 'cam-02',
                name: 'North Blueberry Field Block A',
                channel: 2,
                model: 'Hikvision DS-2CD2386G2-ISU (AcuSense 4K)',
                ipAddress: '192.168.1.122',
                rtspPort: 554,
                locationName: 'North Orchard Pole #4',
                lat: baseLat + 0.0012,
                lng: baseLng + 0.0008,
                mountHeightM: 8,
                azimuthDeg: 135,
                fovAngleDeg: 89,
                rangeM: 90,
                tiltAngleDeg: 4,
                isPtz: false,
                isNightVision: true,
                status: 'RECORDING'
            },
            {
                id: 'cam-03',
                name: 'Cold Storage & Packing Facility',
                channel: 3,
                model: 'Hikvision DarkFighter Ultra-LowLight',
                ipAddress: '192.168.1.123',
                rtspPort: 554,
                locationName: 'Post-Harvest Logistics Shed',
                lat: baseLat - 0.0010,
                lng: baseLng + 0.0018,
                mountHeightM: 5,
                azimuthDeg: 270,
                fovAngleDeg: 110,
                rangeM: 45,
                tiltAngleDeg: 4,
                isPtz: false,
                isNightVision: true,
                status: 'RECORDING'
            },
            {
                id: 'cam-04',
                name: 'Irrigation Pump House & Deep Well',
                channel: 4,
                model: 'Hikvision DS-2DE4425IW-DE (25x PTZ)',
                ipAddress: '192.168.1.124',
                rtspPort: 554,
                locationName: 'Central Fertigation Station',
                lat: baseLat + 0.0002,
                lng: baseLng - 0.0014,
                mountHeightM: 10,
                azimuthDeg: 180,
                fovAngleDeg: 60,
                rangeM: 160,
                tiltAngleDeg: 4,
                isPtz: true,
                isNightVision: true,
                status: 'ONLINE'
            }
        ];
    });

    const [isCameraPlannerOpen, setIsCameraPlannerOpen] = useState(false);
    const [cameraPlannerCoords, setCameraPlannerCoords] = useState<[number, number] | undefined>(undefined);
    const [activeCameraForLiveView, setActiveCameraForLiveView] = useState<PlantationCamera | null>(null);
    const [isAllCamerasWideOpen, setIsAllCamerasWideOpen] = useState(false);

    // Selected camera or drone mission for floating properties panel
    const [selectedCameraForProperties, setSelectedCameraForProperties] = useState<PlantationCamera | null>(null);
    const [selectedDroneMissionForProperties, setSelectedDroneMissionForProperties] = useState<DroneFlightMission | null>(null);
    const [isNetworkNvrManagerOpen, setIsNetworkNvrManagerOpen] = useState(false);

    // 3D Area and Terrain Slope Sculptor State
    const [isTerrainSculptorOpen, setIsTerrainSculptorOpen] = useState(false);
    const [customSlopes, setCustomSlopes] = useState<CustomTerrainSlope[]>(() => {
        try {
            const raw = safeStorage.getItem('agrimap_custom_terrain_slopes');
            if (raw) {
                const parsed = JSON.parse(raw);
                setActiveSlopesCache(parsed);
                return parsed;
            }
        } catch (_) {}
        return [];
    });

    // Save camera from planner
    const handleSavePlannedCamera = (cam: PlantationCamera) => {
        setCameras(prev => {
            const exists = prev.some(c => c.id === cam.id);
            const next = exists ? prev.map(c => c.id === cam.id ? cam : c) : [...prev, cam];
            safeStorage.setItem('agrimap_plantation_cameras', JSON.stringify(next));
            return next;
        });
        window.dispatchEvent(new CustomEvent('agrimap:camera_deployed', { detail: cam }));
    };

    // Save batch of cameras from multi-camera planner
    const handleSaveBatchCameras = (batch: PlantationCamera[]) => {
        setCameras(prev => {
            const updated = [...prev];
            batch.forEach(cam => {
                const idx = updated.findIndex(c => c.id === cam.id);
                if (idx >= 0) {
                    updated[idx] = cam;
                } else {
                    updated.push(cam);
                }
            });
            safeStorage.setItem('agrimap_plantation_cameras', JSON.stringify(updated));
            return updated;
        });
        batch.forEach(c => window.dispatchEvent(new CustomEvent('agrimap:camera_deployed', { detail: c })));
    };

    // Move/Relocate Camera position directly on map
    const handleMoveCameraPosition = (camId: string, lat: number, lng: number) => {
        setCameras(prev => {
            const next = prev.map(c => c.id === camId ? { ...c, lat, lng } : c);
            safeStorage.setItem('agrimap_plantation_cameras', JSON.stringify(next));
            return next;
        });
        if (selectedCameraForProperties?.id === camId) {
            setSelectedCameraForProperties(prev => prev ? { ...prev, lat, lng } : null);
        }
        toast.success(isKa ? "კამერის პოზიცია განახლდა რუკაზე" : "Camera moved on map");
    };

    // Copy Camera handler
    const handleCopyCamera = (cam: PlantationCamera) => {
        const nextChannel = cameras.length + 1;
        const newCam: PlantationCamera = {
            ...cam,
            id: `cam-${Date.now()}-${nextChannel}`,
            name: `${cam.name} (Copy)`,
            channel: nextChannel,
            ipAddress: `192.168.1.${120 + nextChannel}`,
            lat: cam.lat + 0.0004,
            lng: cam.lng + 0.0004
        };
        handleSavePlannedCamera(newCam);
        setSelectedCameraForProperties(newCam);
        toast.success(isKa ? `კამერის ასლი შეიქმნა: ${newCam.name}` : `Camera duplicated: ${newCam.name}`);
    };

    // Delete Camera handler
    const handleDeleteCamera = (camId: string) => {
        setCameras(prev => {
            const next = prev.filter(c => c.id !== camId);
            safeStorage.setItem('agrimap_plantation_cameras', JSON.stringify(next));
            return next;
        });
        if (selectedCameraForProperties?.id === camId) {
            setSelectedCameraForProperties(null);
        }
        if (activeCameraForLiveView?.id === camId) {
            setActiveCameraForLiveView(null);
        }
    };

    // Import All Cameras from Online NVR / DVR
    const handleImportAllCamerasFromNvr = (importedList: PlantationCamera[]) => {
        setCameras(prev => {
            const next = [...prev, ...importedList];
            safeStorage.setItem('agrimap_plantation_cameras', JSON.stringify(next));
            return next;
        });
        importedList.forEach(cam => {
            window.dispatchEvent(new CustomEvent('agrimap:camera_deployed', { detail: cam }));
        });
    };

    // Listen for cameras deployed globally
    useEffect(() => {
        const handleCameraDeployed = (e: any) => {
            if (e?.detail) {
                setCameras(prev => {
                    const exists = prev.some(c => c.id === e.detail.id);
                    const next = exists ? prev.map(c => c.id === e.detail.id ? e.detail : c) : [...prev, e.detail];
                    safeStorage.setItem('agrimap_plantation_cameras', JSON.stringify(next));
                    return next;
                });
            }
        };
        window.addEventListener('agrimap:camera_deployed', handleCameraDeployed);
        return () => window.removeEventListener('agrimap:camera_deployed', handleCameraDeployed);
    }, []);

    // Drone Real-time Mission State (Waypoints & Circle Sector)
    const [droneMission, setDroneMission] = useState<DroneFlightMission | null>(() => {
        const saved = safeStorage.getItem('agrimap_drone_realtime_mission');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        const baseLat = mapProps.center?.[0] || 41.9023;
        const baseLng = mapProps.center?.[1] || 44.5;
        return {
            id: 'mission-01',
            name: 'Orchard Perimeter & Tree Row Inspection',
            mode: 'waypoints',
            altitudeM: 50,
            speedMs: 12,
            timeIntervalSec: 5,
            headingDeg: 45,
            isHidden: false,
            waypoints: [
                { id: 'wp-0', lat: baseLat - 0.002, lng: baseLng - 0.002, altitudeM: 0, speedMs: 0, leg: 'takeoff', name: 'Home Base' },
                { id: 'wp-1', lat: baseLat - 0.001, lng: baseLng - 0.001, altitudeM: 50, speedMs: 12, leg: 'outbound', name: 'WP 1' },
                { id: 'wp-2', lat: baseLat + 0.001, lng: baseLng - 0.0005, altitudeM: 50, speedMs: 12, leg: 'outbound', name: 'WP 2' },
                { id: 'wp-3', lat: baseLat + 0.002, lng: baseLng + 0.001, altitudeM: 50, speedMs: 12, leg: 'outbound', name: 'WP 3' },
                { id: 'wp-4', lat: baseLat - 0.002, lng: baseLng - 0.002, altitudeM: 50, speedMs: 12, leg: 'return', name: 'RTH Home' }
            ]
        };
    });

    const [isDroneMissionPlannerOpen, setIsDroneMissionPlannerOpen] = useState<boolean>(false);
    const [simulatedDronePos, setSimulatedDronePos] = useState<{ lat: number; lng: number; heading: number } | null>(null);
    const droneAnimTimerRef = useRef<any>(null);

    const handleUpdateDroneMission = (updated: DroneFlightMission | null) => {
        setDroneMission(updated);
        if (updated) {
            safeStorage.setItem('agrimap_drone_realtime_mission', JSON.stringify(updated));
        } else {
            safeStorage.removeItem('agrimap_drone_realtime_mission');
            setSimulatedDronePos(null);
        }
    };

    const handleDeleteDroneMission = () => {
        handleUpdateDroneMission(null);
        setSelectedDroneMissionForProperties(null);
        toast.info(isKa ? 'დრონის მარშრუტი წაიშალა' : 'Drone flight mission deleted');
    };

    const handleCopyDroneMission = (missionToCopy: DroneFlightMission) => {
        const copied: DroneFlightMission = {
            ...missionToCopy,
            id: `mission-${Date.now()}`,
            name: `${missionToCopy.name} (Copy)`,
            waypoints: missionToCopy.waypoints.map((wp, idx) => ({
                ...wp,
                id: `wp-${Date.now()}-${idx}`,
                lat: wp.lat + 0.0003,
                lng: wp.lng + 0.0003
            }))
        };
        handleUpdateDroneMission(copied);
        setSelectedDroneMissionForProperties(copied);
        toast.success(isKa ? 'მარშრუტის ასლი შეიქმნა' : 'Drone flight path duplicated');
    };

    const handleStartDroneSimulation = (missionToSim: DroneFlightMission) => {
        if (!missionToSim || missionToSim.waypoints.length < 2) {
            toast.warning(isKa ? "სიმულაციისთვის საჭიროა მინიმუმ 2 წერტილი" : "At least 2 waypoints required for simulation");
            return;
        }

        if (droneAnimTimerRef.current) clearInterval(droneAnimTimerRef.current);

        let wpIdx = 0;
        let progress = 0;
        const totalLegs = missionToSim.waypoints.length - 1;

        droneAnimTimerRef.current = setInterval(() => {
            const p1 = missionToSim.waypoints[wpIdx];
            const p2 = missionToSim.waypoints[wpIdx + 1];
            if (!p1 || !p2) {
                clearInterval(droneAnimTimerRef.current);
                setSimulatedDronePos(null);
                toast.success(isKa ? "დრონის მისია წარმატებით დასრულდა!" : "Drone mission flight completed!");
                return;
            }

            progress += 0.04;
            if (progress >= 1) {
                progress = 0;
                wpIdx++;
                if (wpIdx >= totalLegs) {
                    clearInterval(droneAnimTimerRef.current);
                    setSimulatedDronePos(null);
                    toast.success(isKa ? "დრონი წარმატებით დაბრუნდა ბაზაზე!" : "Drone safely returned to base (RTH)!");
                    return;
                }
            }

            const currentLat = p1.lat + (p2.lat - p1.lat) * progress;
            const currentLng = p1.lng + (p2.lng - p1.lng) * progress;
            const dLat = p2.lat - p1.lat;
            const dLng = p2.lng - p1.lng;
            const heading = Math.round((Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360);

            setSimulatedDronePos({ lat: currentLat, lng: currentLng, heading });
        }, 150);
    };

    useEffect(() => {
        return () => {
            if (droneAnimTimerRef.current) clearInterval(droneAnimTimerRef.current);
        };
    }, []);

    // Crops & Varieties and Plantation Crops Modal State
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [cropModalTab, setCropModalTab] = useState<'crops' | 'plantation'>('plantation');

    // Floating windows transparency settings (% opacity, e.g. 95)
    const [toolbarTransparency, setToolbarTransparency] = useState<number>(() => {
        const stored = safeStorage.getItem('agrimap_toolbar_transparency');
        return stored ? (parseInt(stored, 10) || 95) : 95;
    });
    const [sandboxTransparency, setSandboxTransparency] = useState<number>(() => {
        const stored = safeStorage.getItem('agrimap_sandbox_transparency');
        return stored ? (parseInt(stored, 10) || 95) : 95;
    });
    const [propertiesTransparency, setPropertiesTransparency] = useState<number>(() => {
        const stored = safeStorage.getItem('agrimap_properties_transparency');
        return stored ? (parseInt(stored, 10) || 95) : 95;
    });
    const [isPropertiesFolded, setIsPropertiesFolded] = useState<boolean>(false);

    const handleUpdateToolbarTransparency = (val: number) => {
        setToolbarTransparency(val);
        safeStorage.setItem('agrimap_toolbar_transparency', String(val));
    };

    const handleUpdateSandboxTransparency = (val: number) => {
        setSandboxTransparency(val);
        safeStorage.setItem('agrimap_sandbox_transparency', String(val));
    };

    const handleUpdatePropertiesTransparency = (val: number) => {
        setPropertiesTransparency(val);
        safeStorage.setItem('agrimap_properties_transparency', String(val));
    };

    // Pencil Sketch Interaction Options Modal State
    const [selectedPencilSketch, setSelectedPencilSketch] = useState<PlantationFeature | null>(null);
    const keptSketchIdsRef = useRef<Set<string>>(new Set());

    // Listen to on-map click on pencil badge to open pencil modal
    useEffect(() => {
        const handleOpenPencilModal = (e: any) => {
            const targetId = e?.detail?.featureId;
            if (!targetId) return;
            const target = allFeatures.find(f => f.id === targetId);
            if (target) {
                setSelectedPencilSketch(target);
            }
        };
        window.addEventListener('agrimap:open-pencil-modal', handleOpenPencilModal);
        return () => {
            window.removeEventListener('agrimap:open-pencil-modal', handleOpenPencilModal);
        };
    }, [allFeatures]);

    // Movable Map Tools Menu State
    const [mapToolsPos, setMapToolsPos] = useState<{ x: number; y: number } | null>(() => {
        const saved = safeStorage.getItem('agrimap_map_tools_pos');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
            } catch (e) {}
        }
        return null;
    });
    const mapToolsDragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

    const handleMapToolsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
        const rect = mapToolsMenuRef.current?.getBoundingClientRect();
        mapToolsDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect ? rect.left : 24,
            startTop: rect ? rect.top : (window.innerHeight - 80)
        };
    };

    const handleMapToolsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!mapToolsDragRef.current) return;
        e.preventDefault();
        const deltaX = e.clientX - mapToolsDragRef.current.startX;
        const deltaY = e.clientY - mapToolsDragRef.current.startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - 180, mapToolsDragRef.current.startLeft + deltaX));
        const newTop = Math.max(10, Math.min(window.innerHeight - 60, mapToolsDragRef.current.startTop + deltaY));
        setMapToolsPos({ x: Math.round(newLeft), y: Math.round(newTop) });
    };

    const handleMapToolsPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!mapToolsDragRef.current) return;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
        mapToolsDragRef.current = null;
        setMapToolsPos(curr => {
            if (curr) safeStorage.setItem('agrimap_map_tools_pos', JSON.stringify(curr));
            return curr;
        });
    };

    // Movable Simulation Sandbox Dock State
    const [sandboxPos, setSandboxPos] = useState<{ x: number; y: number } | null>(() => {
        const saved = safeStorage.getItem('agrimap_sandbox_pos');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
            } catch (e) {}
        }
        return null;
    });
    const sandboxDragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
    const sandboxDockRef = useRef<HTMLDivElement | null>(null);

    const handleSandboxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
        const rect = sandboxDockRef.current?.getBoundingClientRect();
        sandboxDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect ? rect.left : (window.innerWidth / 2 - 200),
            startTop: rect ? rect.top : (window.innerHeight - 80)
        };
    };

    const handleSandboxPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!sandboxDragRef.current) return;
        e.preventDefault();
        const deltaX = e.clientX - sandboxDragRef.current.startX;
        const deltaY = e.clientY - sandboxDragRef.current.startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - 220, sandboxDragRef.current.startLeft + deltaX));
        const newTop = Math.max(10, Math.min(window.innerHeight - 60, sandboxDragRef.current.startTop + deltaY));
        setSandboxPos({ x: Math.round(newLeft), y: Math.round(newTop) });
    };

    const handleSandboxPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!sandboxDragRef.current) return;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
        sandboxDragRef.current = null;
        setSandboxPos(curr => {
            if (curr) safeStorage.setItem('agrimap_sandbox_pos', JSON.stringify(curr));
            return curr;
        });
    };

    // Movable Communication & AI Dock (Meet, Chat, Notes, AI)
    const [commsToolsPos, setCommsToolsPos] = useState<{ x: number; y: number } | null>(() => {
        const saved = safeStorage.getItem('agrimap_comms_tools_pos');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
            } catch (e) {}
        }
        return null;
    });
    const commsToolsPanelRef = useRef<HTMLDivElement | null>(null);
    const commsToolsDragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

    const handleCommsToolsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
        const rect = commsToolsPanelRef.current?.getBoundingClientRect();
        commsToolsDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect ? rect.left : (window.innerWidth - 80),
            startTop: rect ? rect.top : (window.innerHeight - 240)
        };
    };

    const handleCommsToolsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!commsToolsDragRef.current) return;
        e.preventDefault();
        const deltaX = e.clientX - commsToolsDragRef.current.startX;
        const deltaY = e.clientY - commsToolsDragRef.current.startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - 70, commsToolsDragRef.current.startLeft + deltaX));
        const newTop = Math.max(10, Math.min(window.innerHeight - 80, commsToolsDragRef.current.startTop + deltaY));
        setCommsToolsPos({ x: Math.round(newLeft), y: Math.round(newTop) });
    };

    const handleCommsToolsPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!commsToolsDragRef.current) return;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
        commsToolsDragRef.current = null;
        setCommsToolsPos(curr => {
            if (curr) safeStorage.setItem('agrimap_comms_tools_pos', JSON.stringify(curr));
            return curr;
        });
    };

    const handleResetAllPositions = () => {
        setToolbarPos(null);
        safeStorage.removeItem('agrimap_design_toolbar_pos');
        setHistoryPos(null);
        safeStorage.removeItem('agrimap_design_history_pos');
        setMapToolsPos(null);
        safeStorage.removeItem('agrimap_map_tools_pos');
        setSandboxPos(null);
        safeStorage.removeItem('agrimap_sandbox_pos');
        setCommsToolsPos(null);
        safeStorage.removeItem('agrimap_comms_tools_pos');
        safeStorage.removeItem('agrimap_comms_hub_pos');
        safeStorage.removeItem('agrimap_drawing_info_pos');
        toast.success("All toolbar and panel positions reset to defaults!");
    };

    const handlePencilConvert = (targetType: 'row' | 'sector' | 'road' | 'irrigation' | 'measure' | 'note' | 'checkpoint' | 'drone_direction') => {
        if (!selectedPencilSketch) return;
        const targetId = selectedPencilSketch.id;
        
        if (targetType === 'measure') {
            const geom = typeof selectedPencilSketch.geometry === 'string' ? JSON.parse(selectedPencilSketch.geometry) : selectedPencilSketch.geometry;
            const valid = (Array.isArray(geom) ? geom : []).filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
            const dist = calculateLineLength(valid as any);
            toast.success(`📏 Pencil sketch distance measured: ${dist.toFixed(1)} meters!`, { duration: 5000 });
            setSelectedPencilSketch(null);
            return;
        }

        const isDraft = draftFeatures.some(d => d.id === targetId) || (selectedPencilSketch as any).isDraft;

        if (targetType === 'row') {
            const updated: any = {
                ...selectedPencilSketch,
                type: 'line',
                lineType: 'row',
                isPencil: false,
                subType: undefined,
                color: '#f97316',
                name: selectedPencilSketch.name === 'Pencil Sketch' ? 'Trench Row' : selectedPencilSketch.name
            };
            if (isDraft) {
                setDraftFeatures(prev => prev.map(f => f.id === targetId ? updated : f));
            } else {
                props.onUpdateFeature(updated);
            }
            toast.success("Converted pencil sketch to Trench Row! You can now plant seedlings.", { duration: 3500 });
        } else if (targetType === 'sector') {
            let geom = typeof selectedPencilSketch.geometry === 'string' ? JSON.parse(selectedPencilSketch.geometry) : [...(selectedPencilSketch.geometry || [])];
            if (Array.isArray(geom) && geom.length >= 3) {
                const first = geom[0];
                const last = geom[geom.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    geom.push(first);
                }
            }
            const updated: any = {
                ...selectedPencilSketch,
                type: 'area',
                subType: 'sector',
                isPencil: false,
                geometry: geom,
                color: '#10b981',
                name: selectedPencilSketch.name === 'Pencil Sketch' ? 'Field Sector' : selectedPencilSketch.name
            };
            if (isDraft) {
                setDraftFeatures(prev => prev.map(f => f.id === targetId ? updated : f));
            } else {
                props.onUpdateFeature(updated);
            }
            toast.success("Converted pencil sketch to Field Sector Boundary!", { duration: 3500 });
        } else if (targetType === 'road') {
            const updated: any = {
                ...selectedPencilSketch,
                type: 'line',
                lineType: 'road',
                isPencil: false,
                subType: undefined,
                color: '#78716c',
                name: selectedPencilSketch.name === 'Pencil Sketch' ? 'Access Road' : selectedPencilSketch.name
            };
            if (isDraft) {
                setDraftFeatures(prev => prev.map(f => f.id === targetId ? updated : f));
            } else {
                props.onUpdateFeature(updated);
            }
            logMapPlannerAction("Converted to Road", `Converted pencil sketch to vehicle access road`);
        } else if (targetType === 'irrigation') {
            const updated: any = {
                ...selectedPencilSketch,
                type: 'irrigation_line',
                lineType: 'irrigation',
                isPencil: false,
                subType: undefined,
                color: '#0284c7',
                name: selectedPencilSketch.name === 'Pencil Sketch' ? 'Irrigation Main' : selectedPencilSketch.name
            };
            if (isDraft) {
                setDraftFeatures(prev => prev.map(f => f.id === targetId ? updated : f));
            } else {
                props.onUpdateFeature(updated);
            }
            logMapPlannerAction("Converted to Irrigation", `Converted pencil sketch to irrigation pipe line`);
        } else if (targetType === 'note') {
            const geom = typeof selectedPencilSketch.geometry === 'string' ? JSON.parse(selectedPencilSketch.geometry) : (selectedPencilSketch.geometry || []);
            const valid = (Array.isArray(geom) ? geom : []).filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
            const centerLat = valid.length > 0 ? valid.reduce((s, p) => s + p[0], 0) / valid.length : 41.7151;
            const centerLng = valid.length > 0 ? valid.reduce((s, p) => s + p[1], 0) / valid.length : 44.8271;
            const updated: any = {
                ...selectedPencilSketch,
                type: 'note',
                monitoringType: 'sensor',
                geometry: [centerLat, centerLng],
                color: '#3b82f6',
                name: selectedPencilSketch.name.replace(/sketch/gi, 'Note').trim() || 'Field Note',
                notes: selectedPencilSketch.notes || 'Field observation note converted from pencil sketch.',
                isPencil: false,
                subType: undefined
            };
            if (isDraft) {
                setDraftFeatures(prev => prev.map(f => f.id === targetId ? updated : f));
            } else {
                props.onUpdateFeature(updated);
            }
            toast.success("Converted pencil sketch to Field Note marker!", { duration: 3500 });
            logMapPlannerAction("Converted to Note", `Converted pencil sketch to field note`);
        } else if (targetType === 'checkpoint') {
            const geom = typeof selectedPencilSketch.geometry === 'string' ? JSON.parse(selectedPencilSketch.geometry) : (selectedPencilSketch.geometry || []);
            const valid = (Array.isArray(geom) ? geom : []).filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
            const centerLat = valid.length > 0 ? valid.reduce((s, p) => s + p[0], 0) / valid.length : 41.7151;
            const centerLng = valid.length > 0 ? valid.reduce((s, p) => s + p[1], 0) / valid.length : 44.8271;
            const updated: any = {
                ...selectedPencilSketch,
                type: 'note',
                monitoringType: 'checkpoint',
                geometry: [centerLat, centerLng],
                color: '#8b5cf6',
                status: 'pending',
                name: selectedPencilSketch.name.replace(/sketch/gi, 'Checkpoint').trim() || 'Scout Checkpoint',
                notes: selectedPencilSketch.notes || 'Inspection checkpoint converted from pencil sketch.',
                isPencil: false,
                subType: undefined
            };
            if (isDraft) {
                setDraftFeatures(prev => prev.map(f => f.id === targetId ? updated : f));
            } else {
                props.onUpdateFeature(updated);
            }
            toast.success("Converted pencil sketch to Field Checkpoint!", { duration: 3500 });
            logMapPlannerAction("Converted to Checkpoint", `Converted pencil sketch to inspection checkpoint`);
        } else if (targetType === 'drone_direction') {
            const geom = typeof selectedPencilSketch.geometry === 'string' ? JSON.parse(selectedPencilSketch.geometry) : (selectedPencilSketch.geometry || []);
            const updated: any = {
                ...selectedPencilSketch,
                type: 'line',
                lineType: 'path',
                subType: 'drone_direction',
                geometry: geom,
                color: '#06b6d4',
                name: selectedPencilSketch.name.replace(/sketch/gi, 'Drone Path').trim() || 'Drone Flight Direction',
                notes: selectedPencilSketch.notes || 'Drone survey flight direction corridor',
                isPencil: false
            };
            if (isDraft) {
                setDraftFeatures(prev => prev.map(f => f.id === targetId ? updated : f));
            } else {
                props.onUpdateFeature(updated);
            }
            toast.success("Converted pencil sketch to Drone Flight Direction corridor!", { duration: 3500 });
            logMapPlannerAction("Converted to Drone Direction", `Converted pencil sketch to UAV flight direction`);
        }
        setSelectedPencilSketch(null);
    };

    // Centralized Map Planner Logger: records clean, structured audit trails forwarded to the "Logs" module
    const logMapPlannerAction = (action: string, detail: string, status: 'success' | 'failure' | 'alert' = 'success') => {
        const userName = props.mapProps?.currentUser?.name || props.mapProps?.currentUser?.email || (props.isGuest ? 'Guest Operator' : 'Operator');
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();
        const currentTool = activeDrawingTool?.tool || 'None';
        const formattedReport = `[Map Planner Log] Date: ${dateStr} | Time: ${timeStr} | User: ${userName} | Tool: ${currentTool} | ${detail}`;

        if (props.onLogActivity) {
            props.onLogActivity(action, 'design', status, formattedReport);
        } else {
            try {
                const newLog = {
                    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    timestamp: now.toISOString(),
                    userId: props.mapProps?.currentUser?.id || 'operator-user',
                    userName,
                    organizationId: props.mapProps?.activeOrgId || null,
                    action,
                    module: 'design' as const,
                    status,
                    report: formattedReport
                };
                const saved = safeStorage.safeParse(localStorage.getItem('mock_systemLogs'), []);
                localStorage.setItem('mock_systemLogs', JSON.stringify([newLog, ...saved].slice(0, 100)));
            } catch (err) {
                console.error("Failed to log activity locally", err);
            }
        }
    };

    // Map Context Menu State (Right-click or left-click on pencil sketch)
    const [mapContextMenu, setMapContextMenu] = useState<{
        isOpen: boolean;
        feature: PlantationFeature | null;
        position: { x: number; y: number };
    }>({
        isOpen: false,
        feature: null,
        position: { x: 0, y: 0 }
    });

    // Map Canvas / Background Context Menu State (Right-click on map background)
    const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);

    // Company Registration Modal State
    const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);

    const handleOpenMapContextMenu = (feature: PlantationFeature, screenPoint: { x: number; y: number }) => {
        setCanvasContextMenu(null);
        setMapContextMenu({
            isOpen: true,
            feature,
            position: screenPoint
        });
    };

    const handleMapContextMenu = (screenPoint: { x: number; y: number }) => {
        if (selectedFeatureIds.length > 0) {
            const selected = allFeatures.find(f => f.id === selectedFeatureIds[0]);
            if (selected) {
                setCanvasContextMenu(null);
                setMapContextMenu({
                    isOpen: true,
                    feature: selected,
                    position: screenPoint
                });
                return;
            }
        }
        // Right clicked on background map canvas:
        setMapContextMenu(prev => ({ ...prev, isOpen: false, feature: null }));
        setCanvasContextMenu(screenPoint);
    };

    const handleMoveFromContextMenu = (feature: PlantationFeature) => {
        setEditingGeometryId(feature.id);
        logMapPlannerAction("Move Geometry Activated", `Activated geometry repositioning and vertex edit mode for "${feature.name}"`);
    };

    const handleConvertFeature = (feature: PlantationFeature, targetType: 'road' | 'trench' | 'irrigation' | 'area' | 'boundary' | 'note' | 'checkpoint' | 'drone_direction') => {
        const isDraft = draftFeatures.some(d => d.id === feature.id) || (feature as any).isDraft;
        let updated: PlantationFeature;

        if (targetType === 'road') {
            updated = {
                ...feature,
                type: 'line',
                lineType: 'road',
                isPencil: false,
                subType: undefined,
                color: '#78716c',
                name: feature.name.replace(/trench|line|sketch/gi, 'Road').trim() || 'Access Road',
                calculatedPlantCount: undefined,
                bundledSeedlings: undefined
            } as any;
            logMapPlannerAction("Feature Converted to Road", `Converted trench "${feature.name}" to vehicle road`);
        } else if (targetType === 'trench') {
            updated = {
                ...feature,
                type: 'line',
                lineType: 'row',
                isPencil: false,
                subType: undefined,
                color: '#f97316',
                name: feature.name.replace(/road|line|sketch/gi, 'Trench').trim() || 'Trench Row'
            } as any;
            logMapPlannerAction("Feature Converted to Trench", `Converted road "${feature.name}" to trench row`);
        } else if (targetType === 'irrigation') {
            updated = {
                ...feature,
                type: 'irrigation_line',
                lineType: 'irrigation',
                isPencil: false,
                subType: undefined,
                color: '#0284c7',
                name: feature.name.replace(/road|trench|sketch/gi, 'Irrigation Main').trim() || 'Irrigation Main'
            } as any;
            logMapPlannerAction("Feature Converted to Irrigation", `Converted feature "${feature.name}" to irrigation line`);
        } else if (targetType === 'area') {
            let geom = typeof feature.geometry === 'string' ? JSON.parse(feature.geometry) : [...(feature.geometry || [])];
            if (Array.isArray(geom) && geom.length >= 3) {
                const first = geom[0];
                const last = geom[geom.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    geom.push(first);
                }
            }
            updated = {
                ...feature,
                type: 'area',
                subType: 'sector',
                isPencil: false,
                geometry: geom,
                color: '#10b981',
                name: feature.name.replace(/sketch|line|road/gi, 'Sector').trim() || 'Field Sector'
            } as any;
            logMapPlannerAction("Feature Converted to Sector Area", `Converted feature "${feature.name}" to field sector boundary`);
        } else if (targetType === 'boundary') {
            let geom = typeof feature.geometry === 'string' ? JSON.parse(feature.geometry) : [...(feature.geometry || [])];
            if (Array.isArray(geom) && geom.length >= 3) {
                const first = geom[0];
                const last = geom[geom.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    geom.push(first);
                }
            }
            updated = {
                ...feature,
                type: 'boundary',
                subType: undefined,
                isPencil: false,
                geometry: geom,
                color: '#059669',
                name: feature.name.replace(/sketch|line|road/gi, 'Boundary').trim() || 'Outer Boundary'
            } as any;
            logMapPlannerAction("Feature Converted to Boundary", `Converted feature "${feature.name}" to farm boundary`);
        } else if (targetType === 'note') {
            const geom = typeof feature.geometry === 'string' ? JSON.parse(feature.geometry) : [...(feature.geometry || [])];
            const valid = (Array.isArray(geom) ? geom : []).filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
            const centerLat = valid.length > 0 ? valid.reduce((s, p) => s + p[0], 0) / valid.length : 41.7151;
            const centerLng = valid.length > 0 ? valid.reduce((s, p) => s + p[1], 0) / valid.length : 44.8271;
            updated = {
                ...feature,
                type: 'note',
                monitoringType: 'sensor',
                geometry: [centerLat, centerLng],
                color: '#3b82f6',
                name: feature.name.replace(/sketch|line|road|trench/gi, 'Note').trim() || 'Field Note',
                notes: feature.notes || 'Field observation note converted from map asset.',
                isPencil: false,
                subType: undefined
            } as any;
            logMapPlannerAction("Feature Converted to Note", `Converted feature "${feature.name}" to field note pin`);
            toast.success(`Converted to Field Note!`);
        } else if (targetType === 'checkpoint') {
            const geom = typeof feature.geometry === 'string' ? JSON.parse(feature.geometry) : [...(feature.geometry || [])];
            const valid = (Array.isArray(geom) ? geom : []).filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
            const centerLat = valid.length > 0 ? valid.reduce((s, p) => s + p[0], 0) / valid.length : 41.7151;
            const centerLng = valid.length > 0 ? valid.reduce((s, p) => s + p[1], 0) / valid.length : 44.8271;
            updated = {
                ...feature,
                type: 'note',
                monitoringType: 'checkpoint',
                geometry: [centerLat, centerLng],
                color: '#8b5cf6',
                status: 'pending',
                name: feature.name.replace(/sketch|line|road|trench/gi, 'Checkpoint').trim() || 'Scout Checkpoint',
                notes: feature.notes || 'Inspection checkpoint converted from map asset.',
                isPencil: false,
                subType: undefined
            } as any;
            logMapPlannerAction("Feature Converted to Checkpoint", `Converted feature "${feature.name}" to inspection checkpoint`);
            toast.success(`Converted to Checkpoint!`);
        } else if (targetType === 'drone_direction') {
            updated = {
                ...feature,
                type: 'line',
                lineType: 'path',
                subType: 'drone_direction',
                color: '#06b6d4',
                name: feature.name.replace(/sketch|line|road|trench/gi, 'Drone Path').trim() || 'Drone Flight Direction',
                notes: feature.notes || 'Drone flight direction corridor',
                isPencil: false
            } as any;
            logMapPlannerAction("Feature Converted to Drone Direction", `Converted feature "${feature.name}" to UAV flight direction`);
            toast.success(`Converted to Drone Flight Direction!`);
        } else {
            return;
        }

        if (isDraft) {
            setDraftFeatures(prev => {
                const next = prev.map(f => f.id === feature.id ? updated : f);
                safeStorage.setItem('agrimap_draft_features', JSON.stringify(next));
                return next;
            });
        } else {
            props.onUpdateFeature(updated);
        }

        setMapContextMenu(prev => ({ ...prev, isOpen: false, feature: null }));
    };

    const handleDeleteFromContextMenu = (feature: PlantationFeature) => {
        handleUnifiedDelete([feature.id]);
        logMapPlannerAction("Feature Deleted", `Deleted feature "${feature.name}" (ID: ${feature.id})`);
        setMapContextMenu(prev => ({ ...prev, isOpen: false, feature: null }));
    };

    const openHub = () => {
        setIsHubOpen(true);
        if (window.innerWidth < 1280) {
            setIsInfoOpen(false);
        }
    };

    const openInfo = () => {
        setIsInfoOpen(true);
        if (window.innerWidth < 1280) {
            setIsHubOpen(false);
        }
    };

    // Open InfoPanel only when a feature is selected by the user, and check for pencil sketches
    useEffect(() => {
        if (selectedFeatureIds.length > 0) {
            openInfo();
            const firstSelected = allFeatures.find(f => f.id === selectedFeatureIds[0]);
            if (firstSelected && (firstSelected.isPencil || firstSelected.subType === 'pencil' || (firstSelected as any).type === 'pencil')) {
                const autoShow = safeStorage.getItem('agrimap_auto_open_pencil_modal') !== 'false';
                if (autoShow && !keptSketchIdsRef.current.has(firstSelected.id)) {
                    setSelectedPencilSketch(firstSelected);
                }
            }
        }
    }, [selectedFeatureIds.length]);

    const filteredFeatures = useMemo(() => {
        if (isLayersHidden) return [];
        return allFeatures.filter(f => {
            if (f.isVisible === false) return false;
            if (!displayPrefs.showSectors && (f.type === 'area' || f.type === 'boundary' || f.type === 'sector')) return false;
            if (!displayPrefs.showLines && (f.type === 'line' || f.type === 'trench' || f.type === 'irrigation_line')) return false;
            if (!displayPrefs.showSeedlings && f.type === 'seedling') return false;
            if (!displayPrefs.showNotes && (f.type === 'note' || f.type === 'checkpoint')) return false;
            if (!displayPrefs.showCameras && (f.type === 'camera' || (f as any).subType === 'camera' || (f as any).monitoringType === 'camera')) return false;
            if (!displayPrefs.showDroneMissions && (f.type === 'drone_path' || (f as any).subType === 'drone_direction' || (f as any).subType === 'drone_flight_path')) return false;
            return true;
        });
    }, [allFeatures, isLayersHidden, displayPrefs]);

    // Handlers for Simulation & Draft Features
    const handleMapFeatureDrawn = (type: any, geometry: any, clickPos?: L.LatLng, metadata?: any) => {
        if (type === 'camera') {
            const coords: [number, number] = Array.isArray(geometry) && typeof geometry[0] === 'number' 
                ? [geometry[0], geometry[1]] 
                : clickPos ? [clickPos.lat, clickPos.lng] : [mapProps.center?.[0] || 41.9023, mapProps.center?.[1] || 44.5];
            setCameraPlannerCoords(coords);
            setIsCameraPlannerOpen(true);
            onSetActiveDrawingTool({ tool: null });
            return;
        }

        if (!isSimulationMode) {
            // Standard Live Cloud Saving
            props.onFeatureDrawn(type, geometry, clickPos, metadata);
            return;
        }

        // Simulated Drawing: Save in local draft storage (zero cloud writes / quota impact)
        const draftId = `draft-${type}-${Date.now()}`;
        const newDraftFeature: PlantationFeature = {
            id: draftId,
            name: metadata?.name || `Draft ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            type: type as any,
            geometry: geometry,
            layerId: activeDrawingTool.activeLayerId || 'root',
            color: metadata?.color || (type === 'boundary' ? '#059669' : type === 'area' ? '#3b82f6' : '#f59e0b'),
            opacity: 0.5,
            isVisible: true,
            isLocked: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDraft: true,
            isSimulated: true,
            ...metadata
        } as any;

        setDraftFeatures(prev => [...prev, newDraftFeature]);
        logMapPlannerAction("Area Created in Simulator", `Created ${type} "${newDraftFeature.name}" in simulation draft`);

        // Keep selected on map
        onSelectFeature(draftId);

        // Turn off active drawing tool once drawn if not seedling
        if (type !== 'seedling') {
            onSetActiveDrawingTool({ tool: null });
        }
    };

    // Simulation Trench Generator (Stores trenches locally in area.bundledLines without Firestore writes)
    const handleGenerateTrenchesLocal = (params: { parentFeature: AreaPlantationFeature; distance: number; angle: number; plantSpacing: number; from: number; to: number; }) => {
        const isDraftParent = draftFeatures.some(d => d.id === params.parentFeature.id) || isSimulationMode;
        if (isDraftParent) {
            try {
                const featureGeom = typeof params.parentFeature.geometry === 'string' 
                    ? JSON.parse(params.parentFeature.geometry) 
                    : params.parentFeature.geometry;
                const trenchGeometries = generateTrenches(featureGeom, params.distance, params.angle);
                if (!trenchGeometries || trenchGeometries.length === 0) {
                    logMapPlannerAction("Trench Generation Failed", "No area found for trenches at selected angle/spacing", "alert");
                    return;
                }
                const newTrenches: LinePlantationFeature[] = trenchGeometries.slice(params.from - 1, params.to).map((geom, idx) => ({
                    id: `draft-trench-${Date.now()}-${idx}`,
                    name: `${params.parentFeature.name} - TRENCH ${params.from + idx}`,
                    type: 'line',
                    lineType: 'row',
                    geometry: geom,
                    layerId: params.parentFeature.layerId || 'root',
                    parentId: params.parentFeature.id,
                    isVisible: true,
                    color: '#f97316',
                    calculatedPlantCount: Math.floor(calculateLineLength(geom) / params.plantSpacing),
                    defaultPlantSpacing: params.plantSpacing,
                    isDraft: true,
                    isSimulated: true
                }));

                const updatedParent: AreaPlantationFeature = {
                    ...params.parentFeature,
                    defaultPlantSpacing: params.plantSpacing,
                    defaultTrenchSpacing: params.distance,
                    defaultTrenchDirection: params.angle,
                    bundledLines: [...(params.parentFeature.bundledLines || []), ...newTrenches],
                    isDraft: true,
                    isSimulated: true
                };

                setDraftFeatures(prev => {
                    const exists = prev.some(d => d.id === updatedParent.id);
                    let next: PlantationFeature[];
                    if (exists) {
                        next = prev.map(d => d.id === updatedParent.id ? updatedParent : d);
                    } else {
                        next = [...prev, updatedParent];
                    }
                    safeStorage.setItem('agrimap_draft_features', JSON.stringify(next));
                    return next;
                });
                logMapPlannerAction("Trench Created in Simulator", `Generated ${newTrenches.length} bundled trenches in simulation draft`);
            } catch (err) {
                console.error("Simulation trench generation error", err);
                logMapPlannerAction("Trench Generation Error", "Failed to generate trenches in simulation", "failure");
            }
            return;
        }
        props.onGenerateTrenches(params);
    };

    // Simulation Seedling Generator (Stores seedlings locally in trench.bundledSeedlings without Firestore writes)
    const handleGenerateSeedlingsLocal = (trenchId: string, rules: VarietyRule[], spacing: number) => {
        let foundTrench: LinePlantationFeature | null = null;
        let parentArea: AreaPlantationFeature | null = null;

        for (const df of draftFeatures) {
            if (df.id === trenchId && (df.type === 'line' || (df as any).lineType === 'row')) {
                foundTrench = df as LinePlantationFeature;
                break;
            }
            if (df.bundledLines) {
                const line = df.bundledLines.find((l: any) => l.id === trenchId);
                if (line) {
                    foundTrench = line as LinePlantationFeature;
                    parentArea = df as AreaPlantationFeature;
                    break;
                }
            }
        }

        if (foundTrench || isSimulationMode) {
            try {
                if (!foundTrench) {
                    for (const pf of plantationFeatures) {
                        if (pf.id === trenchId) {
                            foundTrench = pf as LinePlantationFeature;
                            break;
                        }
                        if (pf.bundledLines) {
                            const line = pf.bundledLines.find((l: any) => l.id === trenchId);
                            if (line) {
                                foundTrench = line as LinePlantationFeature;
                                parentArea = pf as AreaPlantationFeature;
                                break;
                            }
                        }
                    }
                }

                if (!foundTrench) {
                    logMapPlannerAction("Seedling Generation Alert", "Trench not found for seedling generation", "alert");
                    return;
                }

                const parsedGeom = typeof foundTrench.geometry === 'string' ? JSON.parse(foundTrench.geometry) : foundTrench.geometry;
                const plantSpacing = spacing || foundTrench.defaultPlantSpacing || 1.0;
                const seedlingCoords = generateSeedlingCoordinates(parsedGeom, plantSpacing);

                const newSeedlings: SeedlingPlantationFeature[] = seedlingCoords.map((coord, idx) => {
                    const rule = rules.find(r => (idx + 1) >= r.from && (idx + 1) <= r.to) || rules[0];
                    const variety = rule?.variety || 'Standard';
                    return {
                        id: `draft-seedling-${Date.now()}-${idx}`,
                        name: `${variety.toUpperCase()} ${idx + 1}`,
                        type: 'seedling',
                        geometry: coord,
                        condition: 'Good',
                        cropVariety: variety,
                        layerId: foundTrench!.layerId || 'root',
                        parentId: foundTrench!.id,
                        isVisible: true,
                        isDraft: true,
                        isSimulated: true
                    };
                });

                const updatedTrench: LinePlantationFeature = {
                    ...foundTrench,
                    defaultPlantSpacing: plantSpacing,
                    calculatedPlantCount: seedlingCoords.length,
                    bundledSeedlings: [...(foundTrench.bundledSeedlings || []), ...newSeedlings],
                    isDraft: true,
                    isSimulated: true
                };

                setDraftFeatures(prev => {
                    let next: PlantationFeature[];
                    if (parentArea) {
                        const exists = prev.some(df => df.id === parentArea!.id);
                        if (exists) {
                            next = prev.map(df => {
                                if (df.id === parentArea!.id) {
                                    return {
                                        ...df,
                                        bundledLines: (df.bundledLines || []).map((l: any) => l.id === trenchId ? updatedTrench : l),
                                        isDraft: true,
                                        isSimulated: true
                                    };
                                }
                                return df;
                            });
                        } else {
                            const updatedArea: AreaPlantationFeature = {
                                ...parentArea,
                                bundledLines: (parentArea.bundledLines || []).map((l: any) => l.id === trenchId ? updatedTrench : l),
                                isDraft: true,
                                isSimulated: true
                            };
                            next = [...prev, updatedArea];
                        }
                    } else {
                        const exists = prev.some(df => df.id === trenchId);
                        if (exists) {
                            next = prev.map(df => df.id === trenchId ? updatedTrench : df);
                        } else {
                            next = [...prev, updatedTrench];
                        }
                    }
                    safeStorage.setItem('agrimap_draft_features', JSON.stringify(next));
                    return next;
                });

                logMapPlannerAction("Seedlings Generated in Simulator", `Generated ${newSeedlings.length} seedlings in simulation draft`);
                return;
            } catch (err) {
                console.error("Simulation seedling generation error", err);
                logMapPlannerAction("Seedling Generation Error", "Failed to generate seedlings in simulation", "failure");
            }
        }

        props.onGenerateSeedlings(trenchId, rules, spacing);
    };

    // Feature updates in DesignView (routes draft features to draftFeatures, live to props)
    const handleUpdateFeatureDesign = (feature: PlantationFeature) => {
        const updateRecursive = (list: PlantationFeature[]): { updated: PlantationFeature[]; found: boolean } => {
            let found = false;
            const updated = list.map(item => {
                if (item.id === feature.id) {
                    found = true;
                    return { ...item, ...feature, isDraft: true, isSimulated: true };
                }
                const copy: any = { ...item };
                if (Array.isArray(copy.bundledLines)) {
                    const res = updateRecursive(copy.bundledLines);
                    if (res.found) {
                        found = true;
                        copy.bundledLines = res.updated;
                    }
                }
                if (Array.isArray(copy.bundledSeedlings)) {
                    const res = updateRecursive(copy.bundledSeedlings);
                    if (res.found) {
                        found = true;
                        copy.bundledSeedlings = res.updated;
                    }
                }
                return copy;
            });
            return { updated, found };
        };

        const result = updateRecursive(draftFeatures);
        if (result.found || isSimulationMode) {
            setDraftFeatures(prev => {
                const res = updateRecursive(prev);
                const next = res.found ? res.updated : (isSimulationMode ? [...prev, { ...feature, isDraft: true, isSimulated: true }] : prev);
                safeStorage.setItem('agrimap_draft_features', JSON.stringify(next));
                return next;
            });
            logMapPlannerAction("Draft Update", `Updated feature "${feature.name}" in simulation draft`);
            return;
        }
        props.onUpdateFeature(feature);
    };

    // Unified Delete Handler: handles selected items, editing geometry, active drawing discard, and simulation drafts
    const handleUnifiedDelete = (ids?: string[]) => {
        let targetIds = ids && ids.length > 0 ? ids : selectedFeatureIds;

        // 1. If no selected feature IDs, check if user is currently editing a geometry
        if ((!targetIds || targetIds.length === 0) && editingGeometryId) {
            targetIds = [editingGeometryId];
            setEditingGeometryId(null);
        }

        // 2. If still no feature selected, check if user is in active drawing mode: cancel drawing
        if (!targetIds || targetIds.length === 0) {
            if (activeDrawingTool.tool) {
                const toolName = activeDrawingTool.tool;
                onSetActiveDrawingTool({ tool: null });
                logMapPlannerAction("Drawing Cancelled", `Cancelled ${toolName} drawing`);
                return;
            }

            // 3. In simulation mode with draft features, delete the most recent draft item
            if (draftFeatures.length > 0) {
                const lastDraft = draftFeatures[draftFeatures.length - 1];
                setDraftFeatures(prev => {
                    const next = prev.filter(d => d.id !== lastDraft.id);
                    safeStorage.setItem('agrimap_draft_features', JSON.stringify(next));
                    return next;
                });
                props.onSelectFeature(null);
                logMapPlannerAction("Draft Item Deleted", `Deleted draft item: ${lastDraft.name}`);
                return;
            }
            return;
        }

        const draftIdsToDelete = targetIds.filter(id => {
            return draftFeatures.some(df => df.id === id || (df.bundledLines && df.bundledLines.some((l: any) => l.id === id)));
        });
        const liveIdsToDelete = targetIds.filter(id => !draftIdsToDelete.includes(id));

        if (draftIdsToDelete.length > 0) {
            setDraftFeatures(prev => {
                const next = prev.filter(df => !draftIdsToDelete.includes(df.id)).map(df => {
                    if (df.bundledLines) {
                        return {
                            ...df,
                            bundledLines: df.bundledLines.filter((l: any) => !draftIdsToDelete.includes(l.id))
                        };
                    }
                    return df;
                });
                safeStorage.setItem('agrimap_draft_features', JSON.stringify(next));
                return next;
            });
            logMapPlannerAction("Draft Items Deleted", `Deleted ${draftIdsToDelete.length} draft item(s)`);
        }

        if (liveIdsToDelete.length > 0) {
            props.onDeleteItems(liveIdsToDelete);
        }

        props.onSelectFeature(null);
    };

    // 1. Finish: finishes drawing, exits drawing tool, stays in simulation mode with draft intact
    const handleFinishDrawing = () => {
        onSetActiveDrawingTool({ tool: null });
        logMapPlannerAction("Drawing Finished", "Finished drawing, draft features saved in local simulator");
    };

    // 2. Save: publishes all draft items to live components and commits them to cloud as one document/batch
    const handleSaveDraft = async () => {
        if (draftFeatures.length === 0) {
            return;
        }

        try {
            if (props.onPublishDraftFeatures) {
                await props.onPublishDraftFeatures(draftFeatures);
                setDraftFeatures([]);
                safeStorage.removeItem('agrimap_draft_features');
                setIsSimulationMode(false);
                // IMPORTANT TOAST: Crucial user feedback for successful cloud sync
                toast.success("Document is synced to the cloud successfully!", { duration: 4000 });
                logMapPlannerAction("Cloud Synchronization", "Document is synced to the cloud successfully", "success");
            } else {
                // Fallback: publish one by one via onFeatureDrawn
                draftFeatures.forEach(f => {
                    props.onFeatureDrawn(f.type as any, f.geometry, undefined, {
                        name: f.name,
                        color: f.color
                    });
                });
                setDraftFeatures([]);
                setIsSimulationMode(false);
                safeStorage.removeItem('agrimap_draft_features');
                toast.success("Document is synced to the cloud successfully!", { duration: 4000 });
                logMapPlannerAction("Cloud Synchronization", "Document is synced to the cloud successfully", "success");
            }
        } catch (err: any) {
            console.error("Synchronization error:", err);
            // IMPORTANT TOAST: Crucial user feedback for sync error
            toast.error("Synchronization error: Failed to sync document to cloud.", { duration: 5000 });
            logMapPlannerAction("Synchronization Error", `Failed to sync document to cloud: ${err?.message || 'Unknown error'}`, "failure");
        }
    };

    // 3. Delete: deletes selected draft item(s) one by one
    const handleDeleteDraftItem = (specificId?: string) => {
        const idToDelete = specificId || selectedFeatureIds.find(id => draftFeatures.some(d => d.id === id));
        if (!idToDelete) {
            if (draftFeatures.length === 1) {
                const soleId = draftFeatures[0].id;
                setDraftFeatures(prev => prev.filter(d => d.id !== soleId));
                props.onSelectFeature(null);
                logMapPlannerAction("Draft Item Deleted", `Deleted sole draft item: ${soleId}`);
                return;
            }
            return;
        }

        handleUnifiedDelete([idToDelete]);
    };

    // 4. Discard: removes all draft items from draft and map
    const handleDiscardDraft = () => {
        if (draftFeatures.length === 0) {
            return;
        }
        if (window.confirm(`Are you sure you want to discard all ${draftFeatures.length} draft simulation items?`)) {
            const count = draftFeatures.length;
            setDraftFeatures([]);
            safeStorage.removeItem('agrimap_draft_features');
            props.onSelectFeature(null);
            logMapPlannerAction("Draft Discarded", `Discarded ${count} draft simulation items`);
        }
    };

    const draftStats = useMemo(() => {
        let areas = 0;
        let lines = 0;
        let seedlings = 0;
        let boundaries = 0;
        let other = 0;

        draftFeatures.forEach(f => {
            if (f.type === 'boundary') {
                boundaries++;
            } else if (f.type === 'area' || f.type === 'sector') {
                areas++;
                if (f.bundledLines) {
                    lines += f.bundledLines.length;
                    f.bundledLines.forEach((l: any) => {
                        if (l.bundledSeedlings) seedlings += l.bundledSeedlings.length;
                    });
                }
            } else if (f.type === 'line' || (f as any).lineType === 'row') {
                lines++;
                if ((f as any).bundledSeedlings) seedlings += (f as any).bundledSeedlings.length;
            } else if (f.type === 'seedling') {
                seedlings++;
            } else {
                other++;
            }
        });

        return { areas, lines, seedlings, boundaries, other, total: draftFeatures.length };
    }, [draftFeatures]);

    const selectedDraftItems = useMemo(() => {
        return draftFeatures.filter(d => selectedFeatureIds.includes(d.id));
    }, [draftFeatures, selectedFeatureIds]);

    const handleSaveCurrentTrack = (name: string) => {
        const newPath: WalkPath = {
            id: `walk-${Date.now()}`,
            name,
            geometry: [...trackedPoints],
            timestamp: new Date().toISOString()
        };
        setWalkedPaths(prev => [newPath, ...prev]);
        setTrackedPoints([]);
    };

    const handleRegisterWalkFeature = (params: {
        name: string;
        type: FeatureType | 'boundary' | 'plant-sequence';
        geometry: [number, number][];
        layerId: string;
        color: string;
        cropType?: string;
        plantSpacing?: number;
    }) => {
        if (params.type === 'plant-sequence') {
            const spacing = params.plantSpacing || 2.0;
            const geom = params.geometry;
            if (geom.length < 2) {
                toast.error("Need at least 2 coordinate points to map custom seedling sequences.");
                return;
            }

            // High-resolution geodesic spatial measuring in meters
            const getGeoDistance = (p1: [number, number], p2: [number, number]): number => {
                const R = 6371e3;
                const phi1 = p1[0] * Math.PI / 180;
                const phi2 = p2[0] * Math.PI / 180;
                const dPhi = (p2[0] - p1[0]) * Math.PI / 180;
                const dLam = (p2[1] - p1[1]) * Math.PI / 180;
                const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
                          Math.cos(phi1) * Math.cos(phi2) *
                          Math.sin(dLam / 2) * Math.sin(dLam / 2);
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            };

            let accumulatedDist = 0;
            let nextSpawnDist = 0; // First plant right at start point of walk
            let count = 0;

            for (let i = 0; i < geom.length - 1; i++) {
                const cur = geom[i];
                const nxt = geom[i + 1];
                const segmentLength = getGeoDistance(cur, nxt);
                if (segmentLength === 0) continue;

                while (accumulatedDist + segmentLength >= nextSpawnDist) {
                    const ratio = (nextSpawnDist - accumulatedDist) / segmentLength;
                    const lat = cur[0] + (nxt[0] - cur[0]) * ratio;
                    const lng = cur[1] + (nxt[1] - cur[1]) * ratio;

                    count++;
                    const plantMetadata = {
                        name: `${params.name} (#${count})`,
                        color: params.color,
                        cropType: params.cropType || undefined,
                        condition: 'Good'
                    };
                    
                    // Register seedling on the map
                    props.onFeatureDrawn('seedling', [lat, lng], undefined, plantMetadata);
                    nextSpawnDist += spacing;
                }
                accumulatedDist += segmentLength;
            }
            toast.success(`Registered ${count} plants sequentially along tracked walk at ${spacing}m intervals!`);
        } else {
            // Build properties and register standard/boundary assets on map
            const newMetadata = {
                name: params.name,
                color: params.color,
                cropType: params.cropType || undefined
            };
            props.onFeatureDrawn(params.type as any, params.geometry, undefined, newMetadata);
        }
    };

    const handleSetTool = (tool: DrawingTool | null) => {
        onSetActiveDrawingTool({
            ...activeDrawingTool,
            tool: activeDrawingTool.tool === tool ? null : tool,
            activeLayerId: activeDrawingTool.activeLayerId || 'root'
        });
    };

    return (
        <main className="flex-1 relative flex overflow-hidden h-full bg-[#f8fafc]">
            <div className="flex-1 relative">
                <div className="absolute inset-0 z-0">
                    <MapComponent 
                        {...mapProps} 
                        showSearch={false}
                        plantationFeatures={isLayersHidden ? [] : filteredFeatures}
                        activeDrawingTool={activeDrawingTool} 
                        onFeatureDrawn={handleMapFeatureDrawn}
                        editingGeometryId={editingGeometryId}
                        onSetActiveDrawingTool={onSetActiveDrawingTool}
                        isSatellite={isSatellite}
                        setIsSatellite={setIsSatellite}
                        trenchPreviewLines={trenchPreviewLines || undefined}
                        hideBottomControls={true}
                        hideUndoRedo={true}
                        showMeasurementGuide={displayPrefs.showMeasurementGuide}
                        showZoomControls={displayPrefs.showZoomControls}
                        onContextMenuFeature={handleOpenMapContextMenu}
                        onMapContextMenu={handleMapContextMenu}
                        cameras={cameras}
                        showCameras={displayPrefs.showCameras}
                        onSelectCameraForLiveView={(cam) => setActiveCameraForLiveView(cam)}
                        onSelectCameraForProperties={(cam) => {
                            setSelectedCameraForProperties(cam);
                            setSelectedDroneMissionForProperties(null);
                        }}
                        onUpdateCameraPosition={handleMoveCameraPosition}
                        customSlopes={customSlopes}
                        droneMission={droneMission}
                        showDroneMissions={displayPrefs.showDroneMissions}
                        onSelectDroneMissionForProperties={() => {
                            if (droneMission) {
                                setSelectedDroneMissionForProperties(droneMission);
                                setSelectedCameraForProperties(null);
                            }
                        }}
                        simulatedDronePosition={simulatedDronePos}
                    >
                        {props.tempBoundaryGeometry && props.tempBoundaryGeometry.filter(isLatLngValidLocal).length > 0 && (
                            <Polygon 
                                positions={props.tempBoundaryGeometry.filter(isLatLngValidLocal).map(p => [Number(p[0]), Number(p[1])])} 
                                pathOptions={{ 
                                    color: '#059669', 
                                    fillColor: '#10b981', 
                                    fillOpacity: 0.2, 
                                    weight: 4, 
                                    dashArray: '10, 10' 
                                }} 
                            />
                        )}

                        {/* GPS Active Walk Trail */}
                        {trackedPoints.filter(isLatLngValidLocal).length > 1 && (
                            <Polyline
                                positions={trackedPoints.filter(isLatLngValidLocal).map(p => [Number(p[0]), Number(p[1])])}
                                pathOptions={{ 
                                    color: '#10b981', 
                                    weight: 4.5, 
                                    dashArray: '4, 8',
                                    opacity: 0.95 
                                }}
                            />
                        )}

                        {/* Pulse GPS Marker */}
                        {trackedPoints.filter(isLatLngValidLocal).length > 0 && (
                            <Marker
                                position={(() => {
                                    const lastPt = trackedPoints.filter(isLatLngValidLocal)[trackedPoints.filter(isLatLngValidLocal).length - 1];
                                    return [Number(lastPt[0]), Number(lastPt[1])] as [number, number];
                                })()}
                                icon={L.divIcon({
                                    className: 'relative flex items-center justify-center',
                                    html: `
                                        <div class="relative flex items-center justify-center">
                                            <span class="inline-flex rounded-full h-5 w-5 bg-emerald-500 border-2 border-white shadow-lg"></span>
                                        </div>
                                    `,
                                    iconSize: [24, 24],
                                    iconAnchor: [12, 12]
                                })}
                            />
                        )}

                        {/* Saved walked boundaries and roads */}
                        {walkedPaths.map(path => {
                            const validGeom = path.geometry.filter(isLatLngValidLocal).map(p => [Number(p[0]), Number(p[1])]);
                            if (validGeom.length < 2) return null;
                            return (
                                <Polyline
                                    key={`walk-path-${path.id}`}
                                    positions={validGeom as [number, number][]}
                                    interactive={true}
                                    pathOptions={{
                                        color: path.selected ? '#eab308' : '#6366f1',
                                        weight: path.selected ? 6.5 : 4.5,
                                        opacity: path.selected ? 1.0 : 0.8,
                                        dashArray: path.selected ? undefined : '5, 5'
                                    }}
                                    eventHandlers={{
                                        click: (e) => {
                                            // Toggle selected state of walked path to trigger interactive vertex editing
                                            L.DomEvent.stopPropagation(e);
                                            setWalkedPaths(prev => prev.map(p => 
                                                p.id === path.id ? { ...p, selected: !p.selected } : p
                                            ));
                                            toast.success(`Selected walked path: "${path.name}"`);
                                        }
                                    }}
                                />
                            );
                        })}

                        {/* Interactive Vertex Handles for Selected Walked Paths */}
                        {walkedPaths.filter(path => path.selected).map(path => (
                            <React.Fragment key={`vertices-edit-${path.id}`}>
                                {path.geometry.map((point, idx) => {
                                    if (!isLatLngValidLocal(point)) return null;
                                    return (
                                        <Marker
                                            key={`vertex-${path.id}-${idx}`}
                                            position={[Number(point[0]), Number(point[1])]}
                                            draggable={true}
                                            eventHandlers={{
                                                dragend: (e) => {
                                                    const marker = e.target;
                                                    const latlng = marker.getLatLng();
                                                    if (latlng && Number.isFinite(latlng.lat) && Number.isFinite(latlng.lng)) {
                                                        const updated = [...path.geometry];
                                                        updated[idx] = [latlng.lat, latlng.lng];
                                                        
                                                        setTimeout(() => {
                                                            setWalkedPaths(prev => prev.map(p => 
                                                                p.id === path.id ? { ...p, geometry: updated } : p
                                                            ));
                                                            toast.info(`Updated coordinate #${idx + 1} of path "${path.name}"`);
                                                        }, 0);
                                                    } else {
                                                        toast.error("Invalid drag coordinates ignored.");
                                                    }
                                                },
                                                click: () => {
                                                    if (path.geometry.length <= 2) {
                                                        toast.warning("Cannot delete coordinate. Paths need at least 2 coordinate points.");
                                                        return;
                                                    }
                                                    const updated = path.geometry.filter((_, i) => i !== idx);
                                                    setWalkedPaths(prev => prev.map(p => 
                                                        p.id === path.id ? { ...p, geometry: updated } : p
                                                    ));
                                                    toast.success(`Removed coordinate #${idx + 1} of path "${path.name}"`);
                                                }
                                            }}
                                            icon={L.divIcon({
                                                className: 'custom-leaflet-vertex-handle bg-amber-500 border border-slate-950 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:scale-125 transition-all text-[8px] font-black text-slate-950',
                                                html: `<div class="w-5 h-5 flex items-center justify-center font-bold text-slate-950">${idx + 1}</div>`,
                                                iconSize: [20, 20],
                                                iconAnchor: [10, 10]
                                            })}
                                        />
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </MapComponent>
                </div>
                
                {/* Always-Visible Slide-Out Toggles (Tablet/Desktop) */}
                {!isHubOpen && (
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 z-[2100] hidden sm:block">
                        <button 
                            onClick={openHub}
                            className="py-6 px-2 bg-[#1a2b4b] text-white rounded-r-2xl shadow-2xl border-y border-r border-white/10 transition-all hover:bg-blue-600 flex items-center gap-2 group cursor-pointer"
                            title={isKa ? "კომპონენტების პანელის გახსნა" : "Open Components Panel"}
                        >
                            <span className="[writing-mode:vertical-lr] font-black uppercase tracking-[0.2em] text-[10px]">{isKa ? 'კომპონენტები' : 'Components'}</span>
                            <ChevronRightIcon size={16} className="group-hover:translate-x-1" />
                        </button>
                    </div>
                )}
                
                {!isInfoOpen && (
                    <div className="absolute top-1/2 right-0 -translate-y-1/2 z-[2100] hidden sm:block">
                        <button 
                            onClick={openInfo}
                            className="py-6 px-2 bg-white text-slate-800 rounded-l-2xl shadow-2xl border-y border-l border-slate-200 transition-all hover:bg-slate-50 flex items-center gap-2 group cursor-pointer"
                            title={isKa ? "თვისებების პანელის გახსნა" : "Open Properties Panel"}
                        >
                            <ChevronDownIcon size={16} className="rotate-90 group-hover:-translate-x-1 text-blue-600" />
                            <span className="[writing-mode:vertical-rl] font-black uppercase tracking-[0.2em] text-[10px]">{isKa ? 'თვისებები' : 'Properties'}</span>
                        </button>
                    </div>
                )}

                {/* Mobile/Small Tablet Edge Toggles */}
                <div className="sm:hidden absolute top-4 left-3 z-[2100] flex items-center gap-2">
                    <button 
                        onClick={() => { if (isHubOpen) setIsHubOpen(false); else openHub(); }}
                        className={`p-2.5 rounded-2xl shadow-xl transition-all border border-white/10 ${isHubOpen ? 'bg-blue-600 text-white' : 'bg-slate-900/80 text-white backdrop-blur-md'}`}
                        title={isKa ? "კომპონენტების გადართვა" : "Toggle Components"}
                    >
                        <RectangleStackIcon size={18} />
                    </button>
                    <button 
                        onClick={() => { if (isInfoOpen) setIsInfoOpen(false); else openInfo(); }}
                        className={`p-2.5 rounded-2xl shadow-xl transition-all border border-slate-200 ${isInfoOpen ? 'bg-blue-600 text-white' : 'bg-white/90 text-slate-800 backdrop-blur-md'}`}
                        title={isKa ? "თვისებების გადართვა" : "Toggle Properties"}
                    >
                        <InfoIcon size={18} />
                    </button>
                </div>

                {/* Top Plantation Crops & Enterprise Registration Badges */}
                <div className={`absolute top-4 z-[2120] pointer-events-auto transition-all duration-300 hidden sm:flex flex-col gap-2 ${
                    isHubOpen ? 'left-4 sm:left-[380px]' : 'left-4 sm:left-6'
                }`}>
                    {isTopBadgesCollapsed ? (
                        <button
                            onClick={() => setIsTopBadgesCollapsed(false)}
                            className="p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 shadow-lg backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
                            title={isKa ? "პლანტაციისა და კომპანიის ბეიჯების გახსნა" : "Expand Plantation & Company Badges"}
                        >
                            <LeafIcon className="w-3.5 h-3.5 text-emerald-400" />
                            <BuildingStorefrontIcon className="w-3.5 h-3.5 text-blue-400" />
                            <ChevronDownIcon size={12} className="text-slate-400" />
                        </button>
                    ) : (
                        <div className="flex flex-col gap-2 relative group/badges">
                            {/* Plantation Crops Badge */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        setCropModalTab('plantation');
                                        setIsCropModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-900 backdrop-blur-xl border border-emerald-500/30 text-white rounded-2xl shadow-xl hover:border-emerald-500/60 transition-all hover:scale-105 active:scale-95 cursor-pointer group"
                                    title={isKa ? "პლანტაციის კულტურების არჩევა / შეცვლა" : "Choose / Change Plantation Crops"}
                                >
                                    <div className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform">
                                        <LeafIcon className="w-3 h-3" />
                                    </div>
                                    <div className="flex flex-col items-start text-left">
                                        <span className="text-[7.5px] font-black text-emerald-400 uppercase tracking-widest leading-none">
                                            {isKa ? 'კულტურების მართვა' : 'Crops Management'}
                                        </span>
                                        <span className="text-[9.5px] font-black text-slate-100 uppercase tracking-tight truncate max-w-[200px] sm:max-w-[280px]">
                                            {formatPlantationCrops(props.activeOrg?.plantationCrops || props.activeOrg?.crops, isKa)}
                                        </span>
                                    </div>
                                    <PencilSquareIcon className="w-3 h-3 text-emerald-400 opacity-60 group-hover:opacity-100 ml-0.5" />
                                </button>
                                <button
                                    onClick={() => setIsTopBadgesCollapsed(true)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors opacity-0 group-hover/badges:opacity-100 cursor-pointer"
                                    title={isKa ? "ჩაკეცვა" : "Collapse"}
                                >
                                    <ChevronUpIcon size={12} />
                                </button>
                            </div>

                            {/* Company Registration Badge */}
                            <button
                                onClick={() => setIsCreateOrgModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-900 backdrop-blur-xl border border-blue-500/30 text-white rounded-2xl shadow-xl hover:border-blue-500/60 transition-all hover:scale-105 active:scale-95 cursor-pointer group"
                                title={isKa ? "კომპანიის რეგისტრაცია / პროფილი" : "Company Registration / Profile"}
                            >
                                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform">
                                    <BuildingStorefrontIcon className="w-3 h-3" />
                                </div>
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-[7.5px] font-black text-blue-400 uppercase tracking-widest leading-none">
                                        {isKa ? 'კომპანიის რეგისტრაცია' : 'Company Registration'}
                                    </span>
                                    <span className="text-[9.5px] font-black text-slate-100 uppercase tracking-tight truncate max-w-[200px] sm:max-w-[280px]">
                                        {props.activeOrg?.name || (isKa ? '+ კომპანიის რეგისტრაცია' : '+ Register Company')}
                                    </span>
                                </div>
                                <PlusIcon size={12} className="text-blue-400 opacity-60 group-hover:opacity-100 ml-0.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Top-Right Unified Tools & Layers Visibility Control Dropdown */}
                <div className={`absolute top-4 z-[2150] pointer-events-auto transition-all duration-300 ${
                    isInfoOpen ? 'right-4 sm:right-[380px]' : 'right-4 sm:right-6'
                }`}>
                    <MapDisplayVisibilityControl 
                        preferences={displayPrefs} 
                        onChangePreferences={handleDisplayPrefsChange} 
                        onResetAllPositions={handleResetAllPositions} 
                    />
                </div>

                {/* Floating Movable & Resizable Integrated Header Toolbar */}
                {displayPrefs.showDrawingToolbar && (
                <div 
                    ref={toolbarRef}
                    style={{
                        position: 'absolute',
                        zIndex: 2200,
                        ...(toolbarPos 
                            ? { left: `${toolbarPos.x}px`, top: `${toolbarPos.y}px` } 
                            : { left: '50%', top: '2.5rem', transform: 'translateX(-50%)' }
                        ),
                        ...(toolbarScale !== 1 ? {
                            transform: toolbarPos ? `scale(${toolbarScale})` : `translateX(-50%) scale(${toolbarScale})`,
                            transformOrigin: toolbarPos ? 'top left' : 'top center'
                        } : {})
                    }}
                    className="flex flex-col items-center gap-2 max-w-[calc(100vw-24px)] select-none pointer-events-auto"
                >
                    {isToolbarMinimized ? (
                        /* Minimized Floating Pill */
                        <div 
                            onPointerDown={handleToolbarPointerDown}
                            onPointerMove={handleToolbarPointerMove}
                            onPointerUp={handleToolbarPointerUp}
                            className="bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl rounded-2xl p-1.5 px-3 flex items-center gap-2 cursor-grab active:cursor-grabbing text-slate-800 animate-in fade-in"
                            title={isKa ? "გადაათრიეთ გადასაადგილებლად. დააჭირეთ გაშლას ხელსაწყოების გასახსნელად." : "Drag to move. Click Expand to open tools."}
                        >
                            <GripVerticalIcon size={14} className="text-slate-400" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">🛠️ {isKa ? 'რუკის პანელი' : 'Map Toolbar'}</span>
                            {activeDrawingTool.tool && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[9px] font-mono font-bold">
                                    {activeDrawingTool.tool}
                                </span>
                            )}
                            {toolbarPos && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleResetToolbarPosition(); }}
                                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                                    title={isKa ? "პოზიციის დაბრუნება ცენტრში" : "Reset position to top center"}
                                >
                                    <RotateCwIcon size={12} />
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setIsToolbarMinimized(false);
                                    safeStorage.setItem('agrimap_design_toolbar_minimized', 'false');
                                }}
                                className="p-1 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                            >
                                <span>{isKa ? 'გაშლა' : 'Expand'}</span>
                                <ChevronDownIcon size={12} />
                            </button>
                        </div>
                    ) : (
                        /* Full Expanded Movable Toolbar */
                        <div 
                            onPointerDown={handleToolbarPointerDown}
                            onPointerMove={handleToolbarPointerMove}
                            onPointerUp={handleToolbarPointerUp}
                            style={{
                                backgroundColor: `rgba(255, 255, 255, ${toolbarTransparency / 100})`,
                                backdropFilter: 'blur(16px)'
                            }}
                            className="border border-slate-200/80 shadow-2xl rounded-2xl p-0.5 md:p-1 flex items-center gap-0.5 md:gap-1 w-auto max-w-full overflow-x-auto no-scrollbar transition-colors duration-150"
                        >
                            {/* Drag Handle (Touch & Mouse) */}
                            <div 
                                className="cursor-grab active:cursor-grabbing p-1 md:p-1.5 text-slate-400 hover:text-slate-800 touch-none flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors select-none group shrink-0"
                                title={isKa ? "დააჭირეთ და გადაათრიეთ ხელსაწყოების პანელი" : "Hold and drag via mouse or touch to move toolbar anywhere"}
                            >
                                <GripVerticalIcon size={15} className="group-hover:scale-110 transition-transform text-slate-500" />
                            </div>

                            <div className="h-6 w-px bg-slate-200 mx-px md:mx-0.5 shrink-0" />

                            {/* Offline Toggle */}
                            <button 
                                onClick={() => onToggleOffline?.(!isManualOffline)}
                                className={`p-1 md:p-2 rounded-xl transition-all flex items-center gap-1.5 border shrink-0 cursor-pointer ${isManualOffline ? 'bg-orange-500 text-white border-orange-400 shadow-sm' : 'hover:bg-slate-50 text-slate-400 border-transparent'}`}
                                title={isManualOffline ? (isKa ? "ონლაინ რეჟიმზე გადართვა" : "Switch to Online Mode") : (isKa ? "ოფლაინ რეჟიმზე გადასვლა" : "Go Offline (LAN Mode)")}
                            >
                                <ShieldCheckIcon size={13} className="md:w-[15px] md:h-[15px]" />
                            </button>

                            <div className="h-6 w-px bg-slate-200 mx-px md:mx-0.5 shrink-0" />

                            {/* Search, Satellite, Simulation, Layers Buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button 
                                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                                    className={`p-1 md:p-2 rounded-xl transition-all flex items-center gap-1 border shrink-0 cursor-pointer ${isSearchOpen ? 'bg-indigo-600 border-indigo-500 text-white shadow-md scale-105' : 'hover:bg-slate-50 text-slate-600 border-transparent'}`}
                                    title={isKa ? "რუკის ობიექტების ძიება" : "Search map features"}
                                >
                                    <SearchIcon size={13} className="md:w-[15px] md:h-[15px]" />
                                    <span className="text-[9px] font-black uppercase hidden sm:inline">{isKa ? 'ძიება' : 'Search'}</span>
                                </button>
                                <button 
                                    onClick={() => setIsSatellite(!isSatellite)}
                                    className={`p-1 md:p-2 rounded-xl transition-all flex items-center gap-1 border shrink-0 cursor-pointer ${isSatellite ? 'bg-emerald-600 border-emerald-500 text-white shadow-md scale-105' : 'hover:bg-slate-50 text-slate-600 border-transparent'}`}
                                    title={isKa ? "სატელიტური ხედის გადართვა" : "Toggle satellite view"}
                                >
                                    <MapIcon size={13} className="md:w-[15px] md:h-[15px]" />
                                    <span className="text-[9px] font-black uppercase hidden sm:inline">{isSatellite ? (isKa ? 'სატ' : 'Sat') : (isKa ? 'რუკა' : 'Map')}</span>
                                </button>
                                
                                {/* Simulation Mode Toggle Button */}
                                <button 
                                    onClick={() => {
                                        const next = !isSimulationMode;
                                        setIsSimulationMode(next);
                                        if (next) {
                                            logMapPlannerAction("Simulation Mode Enabled", "Activated offline draft simulation mode");
                                            setIsSandboxDismissed(false);
                                        } else {
                                            onSetActiveDrawingTool({ tool: null });
                                            logMapPlannerAction("Simulation Mode Disabled", "Turned off simulation mode");
                                        }
                                    }}
                                    className={`relative p-1 md:p-2 rounded-xl transition-all flex items-center gap-1.5 border shrink-0 cursor-pointer select-none active:scale-90 active:brightness-150 active:ring-2 active:ring-amber-400 ${
                                        isSimulationMode 
                                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-400 ring-offset-2 scale-105' 
                                            : 'hover:bg-slate-100 text-slate-600 border-transparent hover:scale-105'
                                    }`}
                                    title={isSimulationMode ? (isKa ? "[აქტიური] სიმულაციის რეჟიმი - გამოსართავად დააწკაპუნეთ" : "[ACTIVE] Simulation Mode - Click to turn off") : (isKa ? "ოფლაინ სიმულაციის რეჟიმის ჩართვა" : "Activate Offline Draft Simulation Mode")}
                                >
                                    {isSimulationMode && (
                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-white"></span>
                                        </span>
                                    )}
                                    <span className="text-xs">🎮</span>
                                    <span className="text-[9px] font-black uppercase hidden sm:inline">{isSimulationMode ? (isKa ? 'სიმ. ჩართ' : 'Sim ON') : (isKa ? 'სიმულაცია' : 'Simulate')}</span>
                                    {draftFeatures.length > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-mono font-bold ${
                                            isSimulationMode ? 'bg-slate-950 text-amber-300' : 'bg-amber-100 text-amber-900'
                                        }`}>
                                            {draftFeatures.length}
                                        </span>
                                    )}
                                </button>

                                <button 
                                    onClick={() => setIsLayersHidden(!isLayersHidden)}
                                    className={`p-1 md:p-2 rounded-xl transition-all flex items-center gap-1 border shrink-0 cursor-pointer ${isLayersHidden ? 'bg-slate-900 border-slate-700 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600 border-transparent'}`}
                                    title={isLayersHidden ? (isKa ? "რუკის ფენების ჩვენება" : "Show Map Layers") : (isKa ? "რუკის ფენების დამალვა" : "Hide Map Layers")}
                                >
                                    <RectangleStackIcon size={13} className="md:w-[15px] md:h-[15px]" />
                                    <span className="text-[9px] font-black uppercase hidden sm:inline">{isLayersHidden ? (isKa ? 'ფენები გამორთ' : 'Layers OFF') : (isKa ? 'ფენები' : 'Layers')}</span>
                                </button>
                            </div>

                            <div className="h-6 w-px bg-slate-200 mx-px md:mx-0.5 shrink-0" />

                            {/* Always-Visible Highly-Illuminated Drawing Tools & Action Buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                                {/* Place Marker Tool */}
                                <button 
                                    onClick={() => handleSetTool('note')} 
                                    className={`relative p-1 md:p-2 rounded-xl transition-all shrink-0 cursor-pointer select-none active:scale-90 active:brightness-150 active:ring-2 active:ring-blue-400 ${
                                        activeDrawingTool.tool === 'note' 
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/40 ring-2 ring-blue-400 ring-offset-2 scale-105' 
                                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 hover:scale-105'
                                    }`} 
                                    title={activeDrawingTool.tool === 'note' ? (isKa ? "[აქტიური] მარკერის დასმა - გამორთვა" : "[ACTIVE] Place Marker - Click to deactivate") : (isKa ? "მარკერის დასმა რუკაზე" : "Place Marker on map")}
                                >
                                    {activeDrawingTool.tool === 'note' && (
                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400 border border-white"></span>
                                        </span>
                                    )}
                                    <MapPinIcon size={13} className="md:w-[15px] md:h-[15px]"/>
                                </button>

                                {/* Draw Area Tool */}
                                <button 
                                    onClick={() => handleSetTool('area')} 
                                    className={`relative p-1 md:p-2 rounded-xl transition-all shrink-0 cursor-pointer select-none active:scale-90 active:brightness-150 active:ring-2 active:ring-blue-400 ${
                                        activeDrawingTool.tool === 'area' 
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/40 ring-2 ring-blue-400 ring-offset-2 scale-105' 
                                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 hover:scale-105'
                                    }`} 
                                    title={activeDrawingTool.tool === 'area' ? (isKa ? "[აქტიური] ფართობის მოხაზვა - გამორთვა" : "[ACTIVE] Draw Area - Click to deactivate") : (isKa ? "ფართობის პოლიგონის მოხაზვა" : "Draw Area polygon")}
                                >
                                    {activeDrawingTool.tool === 'area' && (
                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400 border border-white"></span>
                                        </span>
                                    )}
                                    <RectangleGroupIcon size={13} className="md:w-[15px] md:h-[15px]"/>
                                </button>

                                {/* Company Boundary Tool */}
                                <button 
                                    onClick={() => handleSetTool('boundary')} 
                                    className={`relative p-1 md:p-2 rounded-xl transition-all shrink-0 cursor-pointer select-none active:scale-90 active:brightness-150 active:ring-2 active:ring-emerald-400 ${
                                        activeDrawingTool.tool === 'boundary' 
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400 ring-offset-2 scale-105' 
                                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 hover:scale-105'
                                    }`} 
                                    title={activeDrawingTool.tool === 'boundary' ? (isKa ? "[აქტიური] საზღვარი - გამორთვა" : "[ACTIVE] Boundary - Click to deactivate") : (isKa ? "კომპანიის / ნაკვეთის საზღვარი" : "Draw Company Boundary")}
                                >
                                    {activeDrawingTool.tool === 'boundary' && (
                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-white"></span>
                                        </span>
                                    )}
                                    <ShieldCheckIcon size={13} className="md:w-[15px] md:h-[15px]"/>
                                </button>

                                {/* Draw Path / Line Tool */}
                                <button 
                                    onClick={() => handleSetTool('line')} 
                                    className={`relative p-1 md:p-2 rounded-xl transition-all shrink-0 cursor-pointer select-none active:scale-90 active:brightness-150 active:ring-2 active:ring-blue-400 ${
                                        activeDrawingTool.tool === 'line' 
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/40 ring-2 ring-blue-400 ring-offset-2 scale-105' 
                                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 hover:scale-105'
                                    }`} 
                                    title={activeDrawingTool.tool === 'line' ? (isKa ? "[აქტიური] გზის/ხაზის გავლება - გამორთვა" : "[ACTIVE] Draw Path - Click to deactivate") : (isKa ? "გზის ან თხრილის ხაზის გავლება" : "Draw Path or Trench line")}
                                >
                                    {activeDrawingTool.tool === 'line' && (
                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400 border border-white"></span>
                                        </span>
                                    )}
                                    <ArrowLongRightIcon size={13} className="md:w-[15px] md:h-[15px]"/>
                                </button>

                                {/* Measure Tool */}
                                <button 
                                    onClick={() => handleSetTool('measure')} 
                                    className={`relative p-1 md:p-2 rounded-xl transition-all shrink-0 cursor-pointer select-none active:scale-90 active:brightness-150 active:ring-2 active:ring-purple-400 ${
                                        activeDrawingTool.tool === 'measure' 
                                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40 ring-2 ring-purple-400 ring-offset-2 scale-105' 
                                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 hover:scale-105'
                                    }`} 
                                    title={activeDrawingTool.tool === 'measure' ? (isKa ? "[აქტიური] მანძილის გაზომვა - გამორთვა" : "[ACTIVE] Measure Distance - Click to deactivate") : (isKa ? "მანძილის გაზომვა" : "Measure distance")}
                                >
                                    {activeDrawingTool.tool === 'measure' && (
                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-300 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-400 border border-white"></span>
                                        </span>
                                    )}
                                    <RulerIcon size={13} className="md:w-[15px] md:h-[15px]"/>
                                </button>

                                {/* Freehand Pencil Tool */}
                                <button 
                                    onClick={() => handleSetTool('pencil' as any)} 
                                    className={`relative p-1 md:p-2 rounded-xl transition-all shrink-0 cursor-pointer select-none active:scale-90 active:brightness-150 active:ring-2 active:ring-amber-400 ${
                                        activeDrawingTool.tool === 'pencil' 
                                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/40 ring-2 ring-amber-400 ring-offset-2 scale-105' 
                                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 hover:scale-105'
                                    }`} 
                                    title={activeDrawingTool.tool === 'pencil' ? (isKa ? "[აქტიური] ფანქარი - გამორთვა" : "[ACTIVE] Pencil Tool - Click to deactivate") : (isKa ? "ფანქარი (თავისუფალი ხაზვა • რუკაზე დაწკაპუნებით წაშლა, გადაადგილება ან გადაკეთება)" : "Pencil Tool (Freehand drawing • Click drawn sketch on map to Delete, Move, or Convert)")}
                                >
                                    {activeDrawingTool.tool === 'pencil' && (
                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 border border-white"></span>
                                        </span>
                                    )}
                                    <PenTool size={13} className="md:w-[15px] md:h-[15px] text-amber-600" />
                                </button>

                                {/* AI Spatial Analyzer Quick Trigger */}
                                <button 
                                    onClick={() => setIsSpatialAnalysisOpen(true)}
                                    className="relative p-1 md:p-2 rounded-xl transition-all shrink-0 cursor-pointer select-none active:scale-90 hover:scale-105 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 shadow-sm flex items-center gap-1"
                                    title={isKa ? "AI სივრცითი და აგრონომიული ანალიზატორი (მონიშნული ან ყველა არეალი)" : "AI Spatial & Agronomic Analyzer (selected or all areas)"}
                                >
                                    <SparklesIcon size={13} className="md:w-[15px] md:h-[15px] text-emerald-600" />
                                    <span className="hidden xl:inline text-[10px] font-black uppercase tracking-wider text-emerald-800">
                                        {isKa ? 'AI ანალიზი' : 'AI Analyze'}
                                    </span>
                                </button>

                                <div className="h-6 w-px bg-slate-200 mx-px md:mx-0.5 shrink-0" />

                                {/* Permanent, Instant-Delete Button (Lights up brightly when items are selected) */}
                                <button 
                                    onClick={() => handleUnifiedDelete()} 
                                    className={`relative p-1 md:p-2 rounded-xl transition-all shrink-0 cursor-pointer select-none active:scale-90 active:brightness-150 flex items-center gap-1 ${
                                        (selectedFeatureIds.length > 0 || editingGeometryId)
                                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/50 ring-2 ring-red-400 ring-offset-1 animate-pulse scale-105' 
                                            : activeDrawingTool.tool
                                                ? 'bg-red-50 hover:bg-red-100 text-red-600 hover:scale-105'
                                                : 'hover:bg-red-50 text-slate-400 hover:text-red-600 hover:scale-105'
                                    }`} 
                                    title={
                                        (selectedFeatureIds.length > 0 || editingGeometryId)
                                            ? (isKa ? `წაშალე ${selectedFeatureIds.length || 1} მონიშნული ობიექტი` : `Delete ${selectedFeatureIds.length || 1} selected item(s) immediately`)
                                            : activeDrawingTool.tool
                                                ? (isKa ? `გააუქმე აქტიური ${activeDrawingTool.tool} ხაზვა` : `Cancel / Discard active ${activeDrawingTool.tool} drawing`)
                                                : (isKa ? "მონიშნული ობიექტის წაშლა (ჯერ დააწკაპუნეთ ასარჩევად)" : "Delete selected map feature (click feature first to select)")
                                    }
                                >
                                    <TrashIcon size={13} className="md:w-[15px] md:h-[15px]"/>
                                    {(selectedFeatureIds.length > 0 || editingGeometryId) && (
                                        <span className="px-1.5 py-0.2 bg-white text-red-700 rounded-full text-[9px] font-black leading-none">
                                            {selectedFeatureIds.length || 1}
                                        </span>
                                    )}
                                </button>

                                {/* Clear All Map Features Button */}
                                <button 
                                    onClick={props.onClearMap} 
                                    className="p-1 md:p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all shrink-0 cursor-pointer select-none active:scale-90 active:brightness-150 hover:scale-105" 
                                    title={isKa ? "რუკის ყველა ობიექტის გასუფთავება" : "Clear All Map Features"}
                                >
                                    <RefreshCwIcon size={13} className="md:w-[15px] md:h-[15px]"/>
                                </button>

                                {/* Active Tool Live Status Chip & One-Click Cancel */}
                                {activeDrawingTool.tool && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50/90 border border-blue-200/80 rounded-xl text-blue-800 animate-in fade-in slide-in-from-left-2 shrink-0 shadow-sm">
                                        <span className="relative flex h-2 w-2">
                                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSimulationMode ? 'bg-amber-400' : 'bg-blue-400'} opacity-75`}></span>
                                            <span className={`relative inline-flex rounded-full h-2 w-2 ${isSimulationMode ? 'bg-amber-500' : 'bg-blue-600'}`}></span>
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                                            {isSimulationMode ? (isKa ? 'დრაფტი: ' : 'Draft: ') : ''}{activeDrawingTool.tool}
                                        </span>
                                        <button 
                                            onClick={() => onSetActiveDrawingTool({ tool: null })}
                                            className="ml-1 px-1.5 py-0.5 bg-red-100 hover:bg-red-500 text-red-700 hover:text-white rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                                            title={isKa ? "აქტიური ხელსაწყოს გაუქმება (Esc)" : "Cancel active tool (Esc)"}
                                        >
                                            {isKa ? 'გაუქმება' : 'Cancel'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="h-6 w-px bg-slate-200 mx-px md:mx-0.5 shrink-0" />

                            {/* Scale / Resize Control */}
                            <button 
                                onClick={handleToggleToolbarScale}
                                className="p-1 md:p-1.5 px-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-all flex items-center gap-0.5 text-[9px] font-black shrink-0 cursor-pointer"
                                title={isKa ? "პანელის მასშტაბის შეცვლა (100% / 85% / 72%)" : "Resize toolbar scale (100% / 85% / 72%)"}
                            >
                                <ArrowsPointingInIcon size={12} />
                                <span>{Math.round(toolbarScale * 100)}%</span>
                            </button>

                            {/* Window Transparency % Control */}
                            <TransparencyPopover 
                                value={toolbarTransparency}
                                onChange={handleUpdateToolbarTransparency}
                                theme="light"
                                label={isKa ? "პანელი" : "Toolbar"}
                                popoverPlacement="bottom"
                            />

                            {/* Reset Position Button (Shown when moved) */}
                            {toolbarPos && (
                                <button 
                                    onClick={handleResetToolbarPosition}
                                    className="p-1 md:p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors shrink-0 cursor-pointer"
                                    title={isKa ? "პოზიციის დაბრუნება ზედა ცენტრში" : "Reset position to top center"}
                                >
                                    <RotateCwIcon size={12} />
                                </button>
                            )}

                            {/* Minimize / Collapse Button */}
                            <button 
                                onClick={() => {
                                    setIsToolbarMinimized(true);
                                    safeStorage.setItem('agrimap_design_toolbar_minimized', 'true');
                                }}
                                className="p-1 md:p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors shrink-0 cursor-pointer"
                                title={isKa ? "პანელის ჩაკეცვა მინიატურულ ზოლად" : "Collapse toolbar to compact floating pill"}
                            >
                                <MinusIcon size={13} />
                            </button>
                        </div>
                    )}

                    {/* Centered Integrated Floating Search Dropdown */}
                    {isSearchOpen && (
                        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl rounded-2xl p-2 w-[320px] max-w-full animate-in fade-in slide-in-from-top-2 duration-200">
                            <FloatingSearch 
                                onSearch={(b) => {
                                    onSetFlyToBounds?.(b);
                                    setIsSearchOpen(false);
                                }} 
                                plantationFeatures={allFeatures}
                                onSelectFeature={(id) => {
                                    onSelectFeature(id);
                                    setIsSearchOpen(false);
                                }}
                                crops={crops}
                            />
                        </div>
                    )}
                </div>
                )}

                {/* Floating Movable Undo/Redo Panel */}
                {displayPrefs.showUndoRedo && (
                <div 
                    ref={historyPanelRef}
                    style={{
                        position: 'absolute',
                        zIndex: 2200,
                        ...(historyPos 
                            ? { left: `${historyPos.x}px`, top: `${historyPos.y}px`, bottom: 'auto', right: 'auto' } 
                            : { bottom: '5.5rem', right: '1.25rem' }
                        )
                    }}
                    className="flex flex-col items-center gap-1.5 pointer-events-auto select-none"
                >
                    <div 
                        onPointerDown={handleHistoryPointerDown}
                        onPointerMove={handleHistoryPointerMove}
                        onPointerUp={handleHistoryPointerUp}
                        className="bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-xl md:rounded-[1.2rem] p-1 md:p-1.5 flex flex-col items-center gap-0.5 md:gap-1 cursor-grab active:cursor-grabbing"
                        title={isKa ? "გადაათრიეთ ისტორიის პანელი" : "Hold and drag to move History panel anywhere"}
                    >
                        <div className="w-5 h-1.5 bg-slate-300 rounded-full my-0.5 cursor-grab active:cursor-grabbing hover:bg-slate-400 transition-colors" />
                        <button 
                            onClick={onUndo} 
                            disabled={!canUndo} 
                            className={`p-2 md:p-3 rounded-lg md:rounded-xl transition-all cursor-pointer ${canUndo ? 'text-slate-800 hover:bg-slate-100 active:scale-90 bg-white shadow-sm' : 'text-slate-300 bg-slate-50 cursor-not-allowed'}`} 
                            title={isKa ? "მოქმედების გაუქმება (Undo)" : "Undo Action"}
                        >
                            <ArrowUturnLeftIcon size={16} className="md:w-[20px] md:h-[20px] -scale-x-100"/>
                        </button>
                        <button 
                            onClick={onRedo} 
                            disabled={!canRedo} 
                            className={`p-2 md:p-3 rounded-lg md:rounded-xl transition-all cursor-pointer ${canRedo ? 'text-slate-800 hover:bg-slate-100 active:scale-90 bg-white shadow-sm' : 'text-slate-300 bg-slate-50 cursor-not-allowed'}`} 
                            title={isKa ? "მოქმედების დაბრუნება (Redo)" : "Redo Action"}
                        >
                            <ArrowUturnLeftIcon size={16} className="md:w-[20px] md:h-[20px]"/>
                        </button>
                    </div>
                    <div 
                        onPointerDown={handleHistoryPointerDown}
                        onPointerMove={handleHistoryPointerMove}
                        onPointerUp={handleHistoryPointerUp}
                        className="bg-slate-900/90 backdrop-blur-md text-[7px] md:text-[8px] font-black text-white uppercase tracking-[0.2em] px-2 py-1 md:px-3 md:py-1 rounded-full text-center shadow-xl cursor-grab active:cursor-grabbing flex items-center gap-1.5"
                        title={isKa ? "გადაათრიეთ გადასაადგილებლად" : "Hold and drag to move"}
                    >
                        <span>{isKa ? 'ისტორია' : 'History'}</span>
                        {historyPos && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleResetHistoryPosition(); }}
                                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title={isKa ? "ნაგულისხმევ პოზიციაზე დაბრუნება" : "Reset position to default"}
                            >
                                <RotateCwIcon size={9} />
                            </button>
                        )}
                    </div>
                </div>
                )}

                {/* Floating Movable Comms & Assistant Dock (Google Meet, Chat, Notes, AI) */}
                {(displayPrefs.showGoogleMeet || displayPrefs.showGoogleChat || displayPrefs.showVoiceNotes || displayPrefs.showAiAssistant) && (
                <div 
                    ref={commsToolsPanelRef}
                    style={{
                        position: 'absolute',
                        zIndex: 2200,
                        ...(commsToolsPos 
                            ? { left: `${commsToolsPos.x}px`, top: `${commsToolsPos.y}px`, bottom: 'auto', right: 'auto' } 
                            : { bottom: '11.5rem', right: '1.25rem' }
                        )
                    }}
                    className="flex flex-col items-center gap-1.5 pointer-events-auto select-none"
                >
                    <div 
                        onPointerDown={handleCommsToolsPointerDown}
                        onPointerMove={handleCommsToolsPointerMove}
                        onPointerUp={handleCommsToolsPointerUp}
                        className="bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-xl md:rounded-[1.2rem] p-1 md:p-1.5 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
                        title={isKa ? "გადაათრიეთ კომუნიკაციების პანელი" : "Hold and drag to move Meet, Chat & AI anywhere"}
                    >
                        <div className="w-5 h-1.5 bg-slate-300 rounded-full my-0.5 cursor-grab active:cursor-grabbing hover:bg-slate-400 transition-colors" />
                        
                        {/* Google Meet Button */}
                        {displayPrefs.showGoogleMeet && (
                            <button
                                onClick={() => props.onOpenMeet?.()}
                                className="p-2 md:p-2.5 rounded-lg md:rounded-xl text-blue-600 hover:bg-blue-50 bg-blue-50/50 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                title={isKa ? "Google Meet ვიდეო ზარი" : "Google Meet Video Call"}
                            >
                                <Video size={18} />
                            </button>
                        )}

                        {/* Google Chat Button */}
                        {displayPrefs.showGoogleChat && (
                            <button
                                onClick={() => props.onOpenChat?.()}
                                className="p-2 md:p-2.5 rounded-lg md:rounded-xl text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                title={isKa ? "Google Chat ჰაბი" : "Google Chat Hub"}
                            >
                                <MessageSquare size={18} />
                            </button>
                        )}

                        {/* Voice & Field Notes Button */}
                        {displayPrefs.showVoiceNotes && (
                            <button
                                onClick={() => props.onOpenNotes?.()}
                                className="p-2 md:p-2.5 rounded-lg md:rounded-xl text-amber-600 hover:bg-amber-50 bg-amber-50/50 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                title={isKa ? "საველე და ხმოვანი ჩანაწერები" : "Field & Voice Notes"}
                            >
                                <MicrophoneIcon size={18} />
                            </button>
                        )}

                        {/* Agri-Assistant AI Button */}
                        {displayPrefs.showAiAssistant && (
                            <button
                                onClick={() => props.onOpenAssistant?.()}
                                className="p-2 md:p-2.5 rounded-lg md:rounded-xl text-purple-600 hover:bg-purple-50 bg-purple-50/50 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                title={isKa ? "Agri-Assistant AI ასისტენტი" : "Agri-Assistant AI"}
                            >
                                <SparklesIcon size={18} />
                            </button>
                        )}
                    </div>
                    <div 
                        onPointerDown={handleCommsToolsPointerDown}
                        onPointerMove={handleCommsToolsPointerMove}
                        onPointerUp={handleCommsToolsPointerUp}
                        className="bg-slate-900/90 backdrop-blur-md text-[7px] md:text-[8px] font-black text-white uppercase tracking-[0.2em] px-2 py-1 md:px-3 md:py-1 rounded-full text-center shadow-xl cursor-grab active:cursor-grabbing flex items-center gap-1.5"
                        title={isKa ? "გადაათრიეთ გადასაადგილებლად" : "Hold and drag to move"}
                    >
                        <span>{isKa ? 'კომუნიკაცია' : 'Comms'}</span>
                        {commsToolsPos && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setCommsToolsPos(null); safeStorage.removeItem('agrimap_comms_tools_pos'); }}
                                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title={isKa ? "ნაგულისხმევ პოზიციაზე დაბრუნება" : "Reset position to default"}
                            >
                                <RotateCwIcon size={9} />
                            </button>
                        )}
                    </div>
                </div>
                )}

                {isHubOpen && (
                    <div className="fixed sm:absolute top-16 sm:top-20 left-2 sm:left-6 bottom-16 sm:bottom-20 w-[calc(100vw-16px)] sm:w-[360px] max-w-[calc(100vw-16px)] z-[2150] animate-slide-right flex flex-col">
                        <button 
                            onClick={() => setIsHubOpen(false)}
                            className="hidden sm:flex absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-16 bg-white border border-slate-200 rounded-r-full items-center justify-center hover:bg-slate-50 transition-all shadow-xl z-50 group cursor-pointer"
                            title={isKa ? "კომპონენტების პანელის დამალვა" : "Hide Components Panel"}
                        >
                            <ChevronRightIcon size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors rotate-180" />
                        </button>
                        <div className="sm:hidden absolute top-4 right-4 z-[2210]">
                            <button 
                                onClick={() => setIsHubOpen(false)} 
                                className="p-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/20 active:scale-95 transition-all flex items-center gap-2 font-black uppercase text-[10px] tracking-widest cursor-pointer"
                            >
                                <XIcon size={18}/>
                                <span>{isKa ? 'დახურვა' : 'Close'}</span>
                            </button>
                        </div>
                        <MapComponents 
                            {...props} 
                            plantationFeatures={allFeatures}
                            onUpdateFeature={handleUpdateFeatureDesign}
                            onDeleteItems={handleUnifiedDelete}
                            onGenerateTrenches={handleGenerateTrenchesLocal}
                            onGenerateSeedlings={handleGenerateSeedlingsLocal}
                            activeOrg={props.activeOrg}
                            organizations={props.organizations}
                            crops={props.crops}
                            onOpenCropModal={(tab) => {
                                setCropModalTab(tab);
                                setIsCropModalOpen(true);
                            }}
                            onOpenCompanyRegistration={() => setIsCreateOrgModalOpen(true)}
                            onStartMapRegistration={props.onStartMapRegistration}
                        />
                    </div>
                )}

                {/* Unified Bottom Map Controls Menu (Collapsed into a single clean dropdown menu, Movable) */}
                {displayPrefs.showMapToolsMenu && (
                <div 
                    ref={mapToolsMenuRef}
                    style={mapToolsPos ? {
                        position: 'fixed',
                        left: `${mapToolsPos.x}px`,
                        top: `${mapToolsPos.y}px`,
                        bottom: 'auto',
                        zIndex: 2100
                    } : undefined}
                    className={`absolute bottom-4 sm:bottom-6 z-[2010] pointer-events-auto transition-all duration-300 ${
                        mapToolsPos ? '' : (isHubOpen ? 'left-4 sm:left-[380px]' : 'left-4 sm:left-6')
                    }`}
                >
                    <div className="relative flex items-center gap-1">
                        {/* Drag Handle for Map Tools */}
                        <div 
                            onPointerDown={handleMapToolsPointerDown}
                            onPointerMove={handleMapToolsPointerMove}
                            onPointerUp={handleMapToolsPointerUp}
                            className="bg-slate-900/90 border border-slate-700/80 p-2.5 rounded-2xl cursor-grab active:cursor-grabbing hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shadow-2xl backdrop-blur-md shrink-0 flex items-center justify-center select-none"
                            title={isKa ? "გადაათრიეთ რუკის ხელსაწყოების პანელი ეკრანზე" : "Hold and drag to move Map Tools anywhere on screen"}
                        >
                            <GripVerticalIcon size={14} />
                        </div>

                        {/* Dropdown Menu Popup */}
                        {isMapToolsMenuOpen && (
                            <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl rounded-2xl p-2 flex flex-col gap-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                <div className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-800/80 mb-0.5">
                                    <span>{isKa ? "რუკა და GPS ხელსაწყოები" : "Map & GPS Tools"}</span>
                                    <span className="text-[8px] font-mono text-slate-500">{isKa ? "სწრაფი მენიუ" : "Quick Menu"}</span>
                                </div>

                                {/* Plantation Crops Management - Added to Widget as Requested */}
                                <button
                                    onClick={() => {
                                        setCropModalTab('plantation');
                                        setIsCropModalOpen(true);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer border border-emerald-500/20 bg-emerald-950/20"
                                >
                                    <div className="flex items-center gap-2">
                                        <LeafIcon size={15} className="text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? 'კულტურების მართვა' : 'Crops Management'}</span>
                                            <span className="text-[9px] text-emerald-400 font-semibold truncate max-w-[140px]">
                                                {formatPlantationCrops(props.activeOrg?.plantationCrops || props.activeOrg?.crops, isKa)}
                                            </span>
                                        </div>
                                    </div>
                                    <PencilSquareIcon className="w-3.5 h-3.5 text-emerald-400 opacity-60 group-hover:opacity-100 shrink-0" />
                                </button>

                                {/* Company Registration - Added to Widget as Requested */}
                                <button
                                    onClick={() => {
                                        setIsCreateOrgModalOpen(true);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer border border-blue-500/20 bg-blue-950/20"
                                >
                                    <div className="flex items-center gap-2">
                                        <BuildingStorefrontIcon className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? 'კომპანიის რეგისტრაცია' : 'Company Registration'}</span>
                                            <span className="text-[9px] text-blue-400 font-semibold truncate max-w-[140px]">
                                                {props.activeOrg?.name || (isKa ? '+ რეგისტრაცია' : '+ Register')}
                                            </span>
                                        </div>
                                    </div>
                                    <PlusIcon size={13} className="text-blue-400 opacity-60 group-hover:opacity-100 shrink-0" />
                                </button>

                                <div className="w-full h-[1px] bg-slate-800/80 my-0.5" />

                                {/* Satellite Toggle */}
                                <button
                                    onClick={() => {
                                        setIsSatellite(!isSatellite);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                                        isSatellite 
                                            ? 'bg-emerald-600 text-white' 
                                            : 'hover:bg-slate-800/80 text-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <MapIcon size={15} className={isSatellite ? "text-white" : "text-emerald-400"} />
                                        <span>{isSatellite ? (isKa ? 'თანამგზავრული ხედი' : 'Satellite Imagery') : (isKa ? 'საგზაო რუკის ხედი' : 'Street Map View')}</span>
                                    </div>
                                    <span className="text-[9px] opacity-75 font-mono">{isSatellite ? (isKa ? 'ჩართ.' : 'ON') : (isKa ? 'გამორთ.' : 'OFF')}</span>
                                </button>

                                {/* Fly To Me */}
                                <button
                                    onClick={() => {
                                        handleFlyToMe();
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    disabled={isLocating}
                                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left disabled:opacity-50 cursor-pointer"
                                >
                                    <CrosshairIcon size={15} className={`text-blue-400 ${isLocating ? 'animate-spin' : ''}`} />
                                    <span>{isLocating ? (isKa ? 'მდებარეობის დადგენა...' : 'Locating...') : (isKa ? 'ჩემს GPS-ზე გადასვლა' : 'Fly to My GPS')}</span>
                                </button>

                                {/* Drone Mission Simulation */}
                                <button
                                    onClick={() => {
                                        setIsDroneSimOpen(true);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Plane size={15} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                                        <span>{isKa ? 'დრონის სიმულაცია (პოპაპი)' : 'Drone Simulation Modal'}</span>
                                    </div>
                                    <span className="text-[8px] font-mono px-1.5 py-0.5 bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 rounded-md">UAV</span>
                                </button>

                                {/* Drone Real-Time Flight Path on Map (Outbound, Return & Circle Sector) */}
                                <button
                                    onClick={() => {
                                        setIsDroneMissionPlannerOpen(!isDroneMissionPlannerOpen);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer border border-cyan-500/20 bg-cyan-950/20"
                                >
                                    <div className="flex items-center gap-2">
                                        <Navigation size={15} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? 'დრონის ფრენის გეგმა (რუკაზე)' : 'Drone Flight Path (Map)'}</span>
                                            <span className="text-[9px] text-cyan-400 font-semibold truncate max-w-[140px]">
                                                {droneMission?.waypoints.length || 0} {isKa ? 'წერტილი' : 'Waypoints'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[8px] font-mono px-1.5 py-0.5 bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 rounded-md">LIVE</span>
                                </button>

                                <div className="w-full h-[1px] bg-slate-800/80 my-0.5" />

                                {/* Camera Adding Tool on Map */}
                                <button
                                    onClick={() => {
                                        setCameraPlannerCoords(mapProps.center || [41.9023, 44.5]);
                                        setIsCameraPlannerOpen(true);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer border border-blue-500/20 bg-blue-950/20"
                                >
                                    <div className="flex items-center gap-2">
                                        <Camera size={15} className="text-blue-400 group-hover:scale-110 transition-transform shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? 'კამერის დამატება & დაგეგმვა' : 'Add & Plan Camera'}</span>
                                            <span className="text-[9px] text-blue-400 font-semibold truncate max-w-[140px]">
                                                {cameras.length} {isKa ? 'აქტიური კამერა' : 'Active Cameras'}
                                            </span>
                                        </div>
                                    </div>
                                    <PlusIcon size={13} className="text-blue-400 opacity-60 group-hover:opacity-100 shrink-0" />
                                </button>

                                {/* All Cameras Wide Window Matrix Link */}
                                <button
                                    onClick={() => {
                                        setIsAllCamerasWideOpen(true);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <LayoutGrid size={15} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                                        <span>{isKa ? 'ყველა კამერა (მატრიცა)' : 'All Cameras (Wide View)'}</span>
                                    </div>
                                    <span className="text-[8px] font-mono px-1.5 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 rounded-md">NVR</span>
                                </button>

                                {/* Clear All Cameras from Map Button */}
                                {cameras.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm(isKa ? `დარწმუნებული ხართ, რომ გსურთ რუკიდან ყველა კამერის წაშლა (${cameras.length} კამერა)?` : `Are you sure you want to remove all ${cameras.length} cameras from the map?`)) {
                                                setCameras([]);
                                                safeStorage.removeItem('agrimap_plantation_cameras');
                                                setSelectedCameraForProperties(null);
                                                setActiveCameraForLiveView(null);
                                                toast.success(isKa ? "ყველა კამერა წაიშალა რუკიდან" : "All cameras cleared from map");
                                                setIsMapToolsMenuOpen(false);
                                            }
                                        }}
                                        className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-950/50 text-red-300 transition-all text-left group cursor-pointer border border-red-500/20 bg-red-950/10"
                                    >
                                        <div className="flex items-center gap-2">
                                            <TrashIcon size={15} className="text-red-400 group-hover:scale-110 transition-transform shrink-0" />
                                            <span className="leading-tight text-[11px] font-bold text-red-200">{isKa ? 'ყველა კამერის გასუფთავება' : 'Clear All Cameras from Map'}</span>
                                        </div>
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-red-950 text-red-400 border border-red-800/60 rounded-md">{cameras.length}</span>
                                    </button>
                                )}

                                {/* Local Network Scanner & Online NVR / DVR Hub */}
                                <button
                                    onClick={() => {
                                        setIsNetworkNvrManagerOpen(true);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer border border-cyan-500/20 bg-cyan-950/20"
                                >
                                    <div className="flex items-center gap-2">
                                        <Server size={15} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? 'ქსელის სკანერი & NVR / DVR' : 'Network Scanner & NVR / DVR'}</span>
                                            <span className="text-[9px] text-cyan-400 font-semibold truncate max-w-[140px]">
                                                {isKa ? 'სკანირება, იმპორტი & LIVE' : 'Scan, Import & Live View'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[8px] font-mono px-1.5 py-0.5 bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 rounded-md">SCAN</span>
                                </button>

                                {/* 3D Area & Slope Sculptor (Falloff Engine) */}
                                <button
                                    onClick={() => {
                                        setIsTerrainSculptorOpen(true);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer border border-emerald-500/20 bg-emerald-950/20"
                                >
                                    <div className="flex items-center gap-2">
                                        <Mountain size={15} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? '3D რელიეფი & ფერდობის მოდელირება' : '3D Terrain & Slope Sculptor'}</span>
                                            <span className="text-[9px] text-emerald-400 font-semibold truncate max-w-[140px]">
                                                {isKa ? 'სიმაღლე (H), რადიუსი (R) & Falloff' : 'Height (H), Radius (R) & Falloff'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[8px] font-mono px-1.5 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 rounded-md">3D DEM</span>
                                </button>

                                {/* AI Spatial Analyzer */}
                                <button
                                    onClick={() => {
                                        setIsSpatialAnalysisOpen(true);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <SparklesIcon size={15} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                                        <span>{isKa ? 'AI სივრცითი ანალიზატორი' : 'AI Spatial Analyzer'}</span>
                                    </div>
                                    <span className="text-[8px] font-mono px-1.5 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 rounded-md">GIS AI</span>
                                </button>

                                {/* Track Walk */}
                                <button
                                    onClick={() => {
                                        setIsTrackingPanelOpen(!isTrackingPanelOpen);
                                        setIsMapToolsMenuOpen(false);
                                    }}
                                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                                        isTrackingPanelOpen 
                                            ? 'bg-indigo-600 text-white' 
                                            : 'hover:bg-slate-800/80 text-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <ActivityIcon size={15} className={isTrackingPanelOpen ? "text-white" : "text-amber-400"} />
                                        <span>{isKa ? 'სიარულის ტრეკერი' : 'Walk Tracker'}</span>
                                    </div>
                                    {isTracking && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Collapsed Single Trigger Button */}
                        <button
                            onClick={() => setIsMapToolsMenuOpen(!isMapToolsMenuOpen)}
                            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-bold uppercase tracking-wider shadow-2xl transition-all cursor-pointer backdrop-blur-md active:scale-95 ${
                                isMapToolsMenuOpen
                                    ? 'bg-blue-600 border-blue-400 text-white shadow-blue-900/40'
                                    : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-slate-500 hover:text-white'
                            }`}
                            title={isKa ? "რუკის და GPS ხელსაწყოების მენიუ" : "Map & GPS Tools Menu"}
                        >
                            <MapIcon size={15} className="text-emerald-400" />
                            <span>{isKa ? 'რუკის ხელსაწყოები' : 'Map Tools'}</span>
                            {isTracking && (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            )}
                            <ChevronDownIcon size={14} className={`text-slate-400 transition-transform ${isMapToolsMenuOpen ? 'rotate-180 text-white' : ''}`} />
                        </button>
                    </div>
                </div>
                )}

                {/* Dedicated Simulation Sandbox Dock (Bottom Center, Movable) */}
                {displayPrefs.showSimulationDock && (isSimulationMode || draftFeatures.length > 0) && !isSandboxDismissed && (
                    <div 
                        ref={sandboxDockRef}
                        style={sandboxPos ? {
                            position: 'fixed',
                            left: `${sandboxPos.x}px`,
                            top: `${sandboxPos.y}px`,
                            bottom: 'auto',
                            transform: 'none',
                            zIndex: 2120
                        } : undefined}
                        className={`absolute bottom-4 sm:bottom-6 z-[2120] pointer-events-auto transition-all duration-300 max-w-[calc(100vw-32px)] ${
                            sandboxPos ? '' : 'left-1/2 -translate-x-1/2'
                        }`}
                    >
                        {isSandboxCollapsed ? (
                            /* Collapsed Pill View */
                            <div className="bg-slate-950/95 backdrop-blur-2xl border border-amber-500/40 text-white shadow-2xl rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                                <div 
                                    onPointerDown={handleSandboxPointerDown}
                                    onPointerMove={handleSandboxPointerMove}
                                    onPointerUp={handleSandboxPointerUp}
                                    className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-amber-300 rounded-lg transition-colors select-none"
                                    title={isKa ? "გადაათრიეთ სიმულაციის პანელი" : "Hold and drag to move Simulation Draft anywhere"}
                                >
                                    <GripVerticalIcon size={14} />
                                </div>
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                                    setIsSandboxCollapsed(false);
                                    safeStorage.setItem('agrimap_sandbox_collapsed', 'false');
                                }}>
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                    </span>
                                    <span className="text-xs font-black uppercase tracking-wider text-amber-300">{isKa ? 'სიმულაციის შავი ვარიანტი' : 'Simulation Draft'}</span>
                                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-mono font-bold">
                                        {draftStats.total} {isKa ? 'ელემენტი' : (draftStats.total === 1 ? 'item' : 'items')}
                                    </span>
                                </div>
                                <div className="h-4 w-px bg-slate-800" />
                                <div className="flex items-center gap-1.5">
                                    {draftFeatures.length > 0 && (
                                        <button
                                            onClick={handleSaveDraft}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-md shadow-emerald-900/30 active:scale-95 cursor-pointer"
                                            title={isKa ? "ყველა შავი ვარიანტის შენახვა ღრუბელში ერთიან დოკუმენტად" : "Commit all draft items to cloud as one document batch"}
                                        >
                                            <CloudUploadIcon size={12} />
                                            <span>{isKa ? 'შენახვა' : 'Save'}</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setIsSandboxCollapsed(false);
                                            safeStorage.setItem('agrimap_sandbox_collapsed', 'false');
                                        }}
                                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                        title={isKa ? "პანელის გაშლა" : "Expand Sandbox Controls"}
                                    >
                                        <ChevronUpIcon size={16} />
                                    </button>
                                    <button
                                        onClick={() => setIsSandboxDismissed(true)}
                                        className="p-1 hover:bg-slate-800 text-slate-500 hover:text-white rounded-lg transition-colors cursor-pointer ml-0.5"
                                        title={isKa ? "პანელის დახურვა" : "Dismiss dock (click Simulate to show again)"}
                                    >
                                        <XIcon size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Expanded Full Sandbox Dock */
                            <div 
                                style={{
                                    backgroundColor: `rgba(2, 6, 23, ${sandboxTransparency / 100})`,
                                    backdropFilter: 'blur(20px)'
                                }}
                                className="border border-amber-500/30 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-3xl p-3 sm:p-4 w-[480px] max-w-[calc(100vw-32px)] flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-3 transition-colors duration-150"
                            >
                                {/* Header Row */}
                                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                                    <div className="flex items-center gap-2.5">
                                        <div 
                                            onPointerDown={handleSandboxPointerDown}
                                            onPointerMove={handleSandboxPointerMove}
                                            onPointerUp={handleSandboxPointerUp}
                                            className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-amber-300 rounded-lg transition-colors select-none"
                                            title={isKa ? "გადაათრიეთ სიმულაციის პანელი" : "Hold and drag to move Simulation Draft anywhere"}
                                        >
                                            <GripVerticalIcon size={14} />
                                        </div>
                                        <div className="p-1.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
                                            <span className="text-sm">🎮</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-100">
                                                    {isKa ? 'სიმულაციის რეჟიმი (ოფლაინ მონახაზი)' : 'Simulation Mode (Offline Draft)'}
                                                </h4>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                                    isSimulationMode 
                                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' 
                                                        : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {isSimulationMode ? (isKa ? 'აქტიური ხაზვა' : 'Active Drawing') : (isKa ? 'მონახაზი შენახულია' : 'Draft Saved')}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400">
                                                {draftFeatures.length === 0 
                                                    ? (isKa ? 'გამოიყენეთ ხელსაწყოების ზოლი ლოკალურად სახაზავად და გენერირებისთვის ღრუბლის ხარჯების გარეშე.' : 'Use standard toolbar to draw, generate trenches and seedlings locally without cloud cost.') 
                                                    : (isKa ? `მონახაზი: ${draftStats.areas} ზონა • ${draftStats.lines} თხრილი • ${draftStats.seedlings} ნერგი` : `Draft: ${draftStats.areas} Area(s) • ${draftStats.lines} Trench(es) • ${draftStats.seedlings} Seedling(s)`)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {/* Transparency % Control */}
                                        <TransparencyPopover 
                                            value={sandboxTransparency}
                                            onChange={handleUpdateSandboxTransparency}
                                            theme="dark"
                                            label={isKa ? "გამჭვირვალობა" : "Simulation"}
                                            popoverPlacement="bottom"
                                        />
                                        <button
                                            onClick={() => {
                                                setIsSimulationMode(false);
                                                onSetActiveDrawingTool({ tool: null });
                                                logMapPlannerAction("Simulation Mode Exited", "Exited simulation mode; draft items remain saved locally");
                                            }}
                                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                                            title={isKa ? "სიმულაციიდან გამოსვლა" : "Exit Simulation Mode (draft items stay saved in local storage)"}
                                        >
                                            {isKa ? 'გამოსვლა' : 'Exit'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsSandboxCollapsed(true);
                                                safeStorage.setItem('agrimap_sandbox_collapsed', 'true');
                                            }}
                                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                                            title={isKa ? "პანელის ჩაკეცვა" : "Collapse Sandbox Dock"}
                                        >
                                            <ChevronDownIcon size={16} />
                                        </button>
                                        <button
                                            onClick={() => setIsSandboxDismissed(true)}
                                            className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-white rounded-xl transition-colors cursor-pointer"
                                            title={isKa ? "პანელის დახურვა" : "Dismiss dock"}
                                        >
                                            <XIcon size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Main Action Buttons Row (Finish, Save, Delete, Discard) */}
                                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                                    {/* Finish Button */}
                                    <button
                                        onClick={handleFinishDrawing}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border border-slate-700 active:scale-95 cursor-pointer"
                                        title={isKa ? "ხაზვის დასრულება: თიშავს ხელსაწყოს და ინახავს მონახაზში" : "Finish drawing: turns off drawing tool and stays saved in draft (local storage)"}
                                    >
                                        <CheckIcon size={14} className="text-emerald-400" />
                                        <span>{isKa ? 'დასრულება' : 'Finish'}</span>
                                    </button>

                                    {/* Save Button (Commit draft to cloud) */}
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={draftFeatures.length === 0}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer ${
                                            draftFeatures.length > 0
                                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 border border-emerald-400/50'
                                                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed'
                                        }`}
                                        title={isKa ? "ყველა ელემენტის ღრუბელში გაგზავნა" : "Add to live components and send all draft features as one document to cloud"}
                                    >
                                        <CloudUploadIcon size={14} />
                                        <span>{isKa ? 'ღრუბელში შენახვა' : 'Save to Cloud'}</span>
                                    </button>

                                    {/* Delete Selected Item Button */}
                                    <button
                                        onClick={() => handleDeleteDraftItem()}
                                        disabled={selectedDraftItems.length === 0 && draftFeatures.length === 0}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border active:scale-95 cursor-pointer ${
                                            selectedDraftItems.length > 0
                                                ? 'bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white border-amber-500/50'
                                                : 'bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed'
                                        }`}
                                        title={selectedDraftItems.length > 0 ? (isKa ? `არჩეული მონახაზის წაშლა (${selectedDraftItems[0].name})` : `Delete selected draft item (${selectedDraftItems[0].name})`) : (isKa ? "აირჩიეთ ელემენტი წასაშლელად" : "Select a draft item on map to delete it")}
                                    >
                                        <TrashIcon size={14} className={selectedDraftItems.length > 0 ? 'text-amber-300' : 'text-slate-500'} />
                                        <span>{isKa ? 'წაშლა' : 'Delete'}</span>
                                    </button>

                                    {/* Discard Whole Draft Button */}
                                    <button
                                        onClick={handleDiscardDraft}
                                        disabled={draftFeatures.length === 0}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border active:scale-95 cursor-pointer ${
                                            draftFeatures.length > 0
                                                ? 'bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border-red-500/40'
                                                : 'bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed'
                                        }`}
                                        title={isKa ? "მთლიანი მონახაზის გაუქმება/წაშლა" : "Remove all draft items (discard entire draft)"}
                                    >
                                        <XCircleIcon size={14} />
                                        <span>{isKa ? 'გაუქმება' : 'Discard'}</span>
                                    </button>
                                </div>

                                {/* Selected Item Helper Tag */}
                                {selectedDraftItems.length > 0 && (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1 flex items-center justify-between text-[10px] text-amber-300">
                                        <span>{isKa ? 'არჩეული მონახაზი:' : 'Selected draft item:'} <strong className="text-white">{selectedDraftItems[0].name}</strong></span>
                                        <button 
                                            onClick={() => handleDeleteDraftItem(selectedDraftItems[0].id)}
                                            className="text-red-400 hover:text-red-300 font-bold underline text-[9px] uppercase tracking-wider cursor-pointer"
                                        >
                                            {isKa ? 'წაშლა' : 'Delete this'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Property Detail Sidebar (Floating Right) */}
            {isInfoOpen && isPropertiesFolded && (
                <button
                    onClick={() => setIsPropertiesFolded(false)}
                    className="fixed sm:absolute top-1/2 right-0 -translate-y-1/2 z-[2001] bg-slate-900/95 hover:bg-blue-600 text-white pl-2.5 pr-2 py-4 rounded-l-2xl border-y border-l border-white/20 shadow-2xl flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 group cursor-pointer"
                    title={isKa ? "ობიექტის თვისებების პანელის გაშლა" : "Unfold Asset Details Properties Panel"}
                >
                    <ChevronRightIcon size={16} className="rotate-180 text-blue-400 group-hover:text-white" />
                    <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-black uppercase tracking-widest text-slate-200 group-hover:text-white">
                        {isKa ? 'ობიექტის თვისებები' : 'Asset Details'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse mt-1" />
                </button>
            )}

            {isInfoOpen && !isPropertiesFolded && (
                <aside 
                    style={{
                        backgroundColor: `rgba(255, 255, 255, ${propertiesTransparency / 100})`,
                        backdropFilter: 'blur(20px)'
                    }}
                    className="fixed sm:absolute top-16 sm:top-20 right-2 sm:right-6 bottom-16 sm:bottom-20 w-[calc(100vw-16px)] sm:w-96 max-w-[calc(100vw-16px)] sm:border sm:border-slate-200 rounded-3xl sm:rounded-[2.5rem] shadow-[0_32px_64px_rgba(0,0,0,0.15)] z-[2001] flex flex-col overflow-visible animate-slide-left transition-all duration-300"
                >
                    <button 
                        onClick={() => setIsPropertiesFolded(true)}
                        className="hidden sm:flex absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-16 bg-white/95 border border-slate-200 rounded-l-full items-center justify-center hover:bg-slate-50 transition-all shadow-xl z-50 group cursor-pointer"
                        title={isKa ? "თვისებების პანელის ჩაკეცვა" : "Fold Properties Panel"}
                    >
                        <ChevronRightIcon size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </button>
                    
                    <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-transparent relative">
                        <div>
                            <h3 className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">{isKa ? 'თვისებები' : 'Properties'}</h3>
                            <h4 className="font-black uppercase tracking-tight text-slate-800 text-base sm:text-lg">
                                {isKa ? (
                                    <>ობიექტის <span className="text-blue-600">დეტალები</span></>
                                ) : (
                                    <>Asset <span className="text-blue-600">Details</span></>
                                )}
                            </h4>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {/* Transparency % Control */}
                            <TransparencyPopover 
                                value={propertiesTransparency}
                                onChange={handleUpdatePropertiesTransparency}
                                theme="light"
                                label={isKa ? "თვისებები" : "Properties"}
                                popoverPlacement="bottom"
                            />

                            {/* Fold / Minimize Button */}
                            <button
                                onClick={() => setIsPropertiesFolded(true)}
                                className="p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                                title={isKa ? "პანელის ჩაკეცვა" : "Fold / Minimize Properties Window"}
                            >
                                <MinusIcon size={14} />
                                <span className="hidden sm:inline text-[9px] font-black uppercase">{isKa ? 'ჩაკეცვა' : 'Fold'}</span>
                            </button>

                            {/* Close Button */}
                            <button 
                                onClick={() => setIsInfoOpen(false)} 
                                className="p-1.5 sm:p-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl active:scale-95 transition-all cursor-pointer"
                                title={isKa ? "ფანჯრის დახურვა" : "Close Properties Window"}
                            >
                                <XIcon size={16}/>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <InfoPanel 
                            {...props} 
                            plantationFeatures={allFeatures}
                            onUpdateFeature={handleUpdateFeatureDesign}
                            onDeleteItems={handleUnifiedDelete}
                            onGenerateTrenches={handleGenerateTrenchesLocal}
                            onGenerateSeedlings={handleGenerateSeedlingsLocal}
                            editingGeometryId={editingGeometryId} 
                            onEditGeometry={setEditingGeometryId}
                            onOpenTrenchModal={setTrenchModalFeature}
                            onOpenIrrigationModal={setIrrigationModalFeature}
                            onOpenSpatialAnalysis={(sectorId) => {
                                if (sectorId) onSelectFeature(sectorId);
                                setIsSpatialAnalysisOpen(true);
                            }}
                            onAddSeedlingManually={(id) => onSetActiveDrawingTool({ tool: 'seedling', context: { parentId: id } })}
                            onAddCropVariety={props.onAddCropVariety}
                        />
                    </div>
                </aside>
            )}

            {trenchModalFeature && (
                <TrenchGenerationModal 
                    isOpen={!!trenchModalFeature}
                    onClose={() => setTrenchModalFeature(null)}
                    feature={trenchModalFeature}
                    onGenerate={(params) => {
                        handleGenerateTrenchesLocal({ parentFeature: trenchModalFeature, ...params });
                        setTrenchModalFeature(null);
                    }}
                    onPreviewChange={setTrenchPreviewLines}
                />
            )}

            {irrigationModalFeature && (
                <IrrigationGenerationModal 
                    isOpen={!!irrigationModalFeature}
                    onClose={() => setIrrigationModalFeature(null)}
                    feature={irrigationModalFeature}
                    onGenerate={(params) => {
                        props.onGenerateIrrigation({ parentFeature: irrigationModalFeature, ...params });
                        setIrrigationModalFeature(null);
                    }}
                />
            )}

            {isTrackingPanelOpen && (
                <WalkTrackingPanel
                    isOpen={isTrackingPanelOpen}
                    onClose={() => setIsTrackingPanelOpen(false)}
                    layers={props.layers}
                    crops={props.crops}
                    features={allFeatures}
                    isTracking={isTracking}
                    trackedPoints={trackedPoints}
                    onToggleTracking={setIsTracking}
                    onClearCurrentTrack={() => setTrackedPoints([])}
                    onSaveCurrentTrack={handleSaveCurrentTrack}
                    walkedPaths={walkedPaths}
                    onUpdateWalkedPaths={setWalkedPaths}
                    onRegisterFeature={handleRegisterWalkFeature}
                    onSetFlyToBounds={props.onSetFlyToBounds}
                />
            )}

            {/* Pencil Sketch Options Modal (Delete, Move, Convert, Leave As Is) */}
            <PencilSketchOptionsModal
                isOpen={!!selectedPencilSketch}
                onClose={() => setSelectedPencilSketch(null)}
                feature={selectedPencilSketch}
                onDelete={(id) => {
                    handleUnifiedDelete([id]);
                    setSelectedPencilSketch(null);
                }}
                onUpdateFeature={handleUpdateFeatureDesign}
                onGenerateSeedlingsForLine={(lineFeature) => {
                    const spacing = (lineFeature as any).defaultPlantSpacing || 2.0;
                    handleGenerateSeedlingsLocal(lineFeature.id, [{ id: 'rule-default', from: 1, to: 9999, variety: 'Standard' }], spacing);
                }}
                onOpenDroneSimulation={(flightFeature) => {
                    setSelectedPencilSketch(null);
                    setIsDroneSimOpen(true);
                }}
                onKeepAsIs={(feat) => {
                    handleUpdateFeatureDesign(feat);
                    keptSketchIdsRef.current.add(feat.id);
                    setSelectedPencilSketch(null);
                }}
            />

            {/* Drone Mission Simulation Modal */}
            <DroneSimulationModal
                isOpen={isDroneSimOpen}
                onClose={() => setIsDroneSimOpen(false)}
                plantationFeatures={allFeatures}
                activeMapCenter={mapProps.center || [41.7151, 44.8271]}
                onSaveFlightPathToDraft={(feature) => {
                    setDraftFeatures(prev => {
                        const next = [feature, ...prev];
                        safeStorage.setItem('agrimap_draft_features', JSON.stringify(next));
                        return next;
                    });
                    logMapPlannerAction("Drone Flight Plan Created", `Flight plan "${feature.name}" saved to simulation draft`);
                }}
            />

            {/* AI Spatial Analysis Modal (Decoupled Web Worker Bridge) */}
            <SpatialAnalysisModal
                isOpen={isSpatialAnalysisOpen}
                onClose={() => setIsSpatialAnalysisOpen(false)}
                activeOrgId={(allFeatures[0] as any)?.organizationId || null}
                features={allFeatures}
                activeSectorId={selectedFeatureIds[0]}
                isKa={isKa}
            />

            {/* Map Feature Context Menu (Right-click or left-click on sketch/feature) */}
            {mapContextMenu.isOpen && mapContextMenu.feature && (
                <MapFeatureContextMenu
                    feature={mapContextMenu.feature}
                    position={mapContextMenu.position}
                    onClose={() => setMapContextMenu(prev => ({ ...prev, isOpen: false, feature: null }))}
                    onMove={handleMoveFromContextMenu}
                    onConvert={handleConvertFeature}
                    onDelete={handleDeleteFromContextMenu}
                    onOpenPencilOptions={(feat) => setSelectedPencilSketch(feat)}
                    onOpenCropModal={() => {
                        setCropModalTab('plantation');
                        setIsCropModalOpen(true);
                    }}
                    onOpenCompanyRegistration={() => setIsCreateOrgModalOpen(true)}
                />
            )}

            {/* Map Canvas Background Context Menu (Right-click on map background) */}
            {canvasContextMenu && (
                <MapCanvasContextMenu
                    position={canvasContextMenu}
                    onClose={() => setCanvasContextMenu(null)}
                    onOpenCropModal={() => {
                        setCropModalTab('plantation');
                        setIsCropModalOpen(true);
                    }}
                    onOpenCompanyRegistration={() => setIsCreateOrgModalOpen(true)}
                    onSelectDrawingTool={(tool) => {
                        if (tool === 'sector') props.onSetActiveDrawingTool({ tool: 'sector', color: '#10b981' });
                        else if (tool === 'trench') props.onSetActiveDrawingTool({ tool: 'trench', color: '#f59e0b' });
                        else if (tool === 'irrigation') props.onSetActiveDrawingTool({ tool: 'irrigation_line', color: '#06b6d4' });
                        else if (tool === 'note') props.onSetActiveDrawingTool({ tool: 'note', color: '#f59e0b' });
                    }}
                    activeOrgName={props.activeOrg?.name}
                />
            )}

            {/* Crops & Varieties and Plantation Crops Modal */}
            <CropManagementModal 
                isOpen={isCropModalOpen}
                onClose={() => setIsCropModalOpen(false)}
                crops={props.crops || []}
                organizationId={props.activeOrg?.id || (props.mapProps as any)?.activeOrgId || ''}
                organization={props.activeOrg}
                onUpdateOrganization={props.onUpdateOrganization}
                initialTab={cropModalTab}
                isKa={isKa}
            />

            {/* Company Registration Modal */}
            <CreateOrganizationModal
                isOpen={isCreateOrgModalOpen}
                onClose={() => setIsCreateOrgModalOpen(false)}
                user={props.currentUser || (props.mapProps as any)?.currentUser}
                onAddOrg={props.onAddOrg}
                onSwitchOrg={props.onSwitchOrg}
                onUpdateUser={props.onUpdateUser}
                onStartMapRegistration={props.onStartMapRegistration}
            />

            {/* Camera Planner & Deployment Modal */}
            <CameraPlannerModal
                isOpen={isCameraPlannerOpen}
                onClose={() => setIsCameraPlannerOpen(false)}
                plantationCoords={cameraPlannerCoords}
                onSaveCamera={handleSavePlannedCamera}
                onSaveBatchCameras={handleSaveBatchCameras}
                plantationFeatures={allFeatures}
                currentMapCameras={cameras}
                onDeleteCameraFromMap={handleDeleteCamera}
                onClearAllCameras={() => {
                    setCameras([]);
                    safeStorage.removeItem('agrimap_plantation_cameras');
                    setSelectedCameraForProperties(null);
                    setActiveCameraForLiveView(null);
                    toast.success(isKa ? "ყველა კამერა წაიშალა რუკიდან" : "All cameras cleared from map");
                }}
                onOpenAllCamerasWide={() => setIsAllCamerasWideOpen(true)}
            />

            {/* 3D Terrain & Slope Sculptor Modal (Falloff Engine) */}
            {isTerrainSculptorOpen && (
                <TerrainSlopeSculptorModal
                    isOpen={isTerrainSculptorOpen}
                    onClose={() => setIsTerrainSculptorOpen(false)}
                    mapCenter={mapProps.center || [41.9023, 44.5]}
                    plantationFeatures={allFeatures}
                    activeDroneMission={droneMission}
                    onUpdateDroneMission={handleUpdateDroneMission}
                    cameras={cameras}
                    onSlopeUpdated={(newSlopes) => setCustomSlopes(newSlopes)}
                    isKa={isKa}
                />
            )}

            {/* Small Live Monitoring Window for clicked camera with Wide View link */}
            {activeCameraForLiveView && (
                <CameraLiveMonitorWindow
                    camera={activeCameraForLiveView}
                    onClose={() => setActiveCameraForLiveView(null)}
                    onOpenAllCamerasWide={() => setIsAllCamerasWideOpen(true)}
                />
            )}

            {/* All Cameras Wide Matrix Grid Window */}
            <AllCamerasWideModal
                isOpen={isAllCamerasWideOpen}
                onClose={() => setIsAllCamerasWideOpen(false)}
                cameras={cameras}
                onSelectCameraForDetail={(cam) => setActiveCameraForLiveView(cam)}
                onOpenAddCameraModal={() => {
                    setCameraPlannerCoords(mapProps.center || [41.9023, 44.5]);
                    setIsCameraPlannerOpen(true);
                }}
            />

            {/* Drone Flight Path Planner on Real-Time Map */}
            {droneMission && (
                <DroneFlightPathPlanner
                    isOpen={isDroneMissionPlannerOpen}
                    onClose={() => setIsDroneMissionPlannerOpen(false)}
                    mission={droneMission}
                    onChangeMission={handleUpdateDroneMission}
                    plantationFeatures={allFeatures}
                    onStartSimulation={handleStartDroneSimulation}
                    activeDrawingTool={activeDrawingTool}
                    onSetActiveDrawingTool={onSetActiveDrawingTool}
                />
            )}

            {/* Floating Properties Panel for Selected Camera or Drone Flight Path */}
            {(selectedCameraForProperties || selectedDroneMissionForProperties) && (
                <MapElementPropertiesPanel
                    selectedCamera={selectedCameraForProperties}
                    onUpdateCamera={handleSavePlannedCamera}
                    onDeleteCamera={handleDeleteCamera}
                    onCopyCamera={handleCopyCamera}
                    onOpenLiveView={(cam) => setActiveCameraForLiveView(cam)}
                    selectedDroneMission={selectedDroneMissionForProperties}
                    onUpdateDroneMission={handleUpdateDroneMission}
                    onDeleteDroneMission={handleDeleteDroneMission}
                    onCopyDroneMission={handleCopyDroneMission}
                    onStartDroneSimulation={handleStartDroneSimulation}
                    onClose={() => {
                        setSelectedCameraForProperties(null);
                        setSelectedDroneMissionForProperties(null);
                    }}
                    isKa={isKa}
                />
            )}

            {/* Local Network Scanner & Online NVR / DVR Manager Modal */}
            {isNetworkNvrManagerOpen && (
                <NetworkCameraNvrManagerModal
                    isOpen={isNetworkNvrManagerOpen}
                    onClose={() => setIsNetworkNvrManagerOpen(false)}
                    plantationCoords={mapProps.center || [41.9023, 44.5]}
                    plantationFeatures={allFeatures}
                    onImportAllCameras={handleImportAllCamerasFromNvr}
                    onSelectCameraForDetail={(cam) => {
                        setActiveCameraForLiveView(cam);
                        setIsNetworkNvrManagerOpen(false);
                    }}
                    currentCameras={cameras}
                    isKa={isKa}
                />
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .bg-white .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); }
                
                .animate-slide-right { animation: slideRight 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                .animate-slide-left { animation: slideLeft 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
                .animate-blink { animation: blink 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                
                @keyframes slideRight { from { transform: translateX(-100%) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }
                @keyframes slideLeft { from { transform: translateX(100%) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
            `}</style>
        </main>
    );
};

export default DesignView;
