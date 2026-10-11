import React, { useEffect, useState, useRef } from 'react';
import { 
    X, 
    Minus,
    Maximize2, 
    Minimize2, 
    Stethoscope, 
    Sparkles,
    ArrowLeftRight,
    ArrowUpDown,
    GripHorizontal
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { AiAnalysisSuite } from './AiAnalysisSuite';
import { safeStorage } from '../services/storageService';

interface AiAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTool?: 'disease' | 'document' | 'agro_image' | 'history';
    activeOrgId?: string;
    activeOrgName?: string;
    currentUser?: any;
    onAddTask?: (task: any) => void;
    onAddNutritionPlan?: (plan: any) => void;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
    isOpen,
    onClose,
    initialTool = 'disease',
    activeOrgId,
    activeOrgName,
    currentUser,
    onAddTask,
    onAddNutritionPlan
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Live custom window dimensions
    const [modalSize, setModalSize] = useState<{ width: number; height: number }>(() => {
        const stored = safeStorage.getItem('agrimap_analysis_modal_size');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Number.isFinite(parsed?.width) && Number.isFinite(parsed?.height)) {
                    return {
                        width: Math.max(360, Math.min(typeof window !== 'undefined' ? window.innerWidth - 20 : 1280, parsed.width)),
                        height: Math.max(420, Math.min(typeof window !== 'undefined' ? window.innerHeight - 20 : 920, parsed.height)),
                    };
                }
            } catch (e) {}
        }
        const defaultW = typeof window !== 'undefined' ? Math.min(1100, Math.max(360, window.innerWidth - 32)) : 1080;
        const defaultH = typeof window !== 'undefined' ? Math.min(840, Math.max(450, window.innerHeight - 40)) : 820;
        return { width: defaultW, height: defaultH };
    });

    const [isResizing, setIsResizing] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement | null>(null);
    const resizeRef = useRef<{
        direction: string;
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
    } | null>(null);

    // Escape key listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Resizing pointer event handlers
    const startResize = (e: React.PointerEvent<HTMLDivElement>, direction: string) => {
        if (isFullscreen) return;
        e.preventDefault();
        e.stopPropagation();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {}

        const rect = modalRef.current?.getBoundingClientRect();
        const currentWidth = rect ? rect.width : modalSize.width;
        const currentHeight = rect ? rect.height : modalSize.height;

        setIsResizing(direction);
        resizeRef.current = {
            direction,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: currentWidth,
            startHeight: currentHeight
        };
    };

    const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeRef.current || isFullscreen) return;
        e.preventDefault();
        const { direction, startX, startY, startWidth, startHeight } = resizeRef.current;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        const minW = Math.min(360, window.innerWidth - 16);
        const maxW = Math.min(1440, window.innerWidth - 16);
        const minH = Math.min(420, window.innerHeight - 16);
        const maxH = Math.min(1100, window.innerHeight - 16);

        // For symmetric centered modal: horizontal dragging on either side scales 2x or 1x
        if (direction.includes('right')) {
            newWidth = Math.max(minW, Math.min(maxW, startWidth + deltaX * 2));
        } else if (direction.includes('left')) {
            newWidth = Math.max(minW, Math.min(maxW, startWidth - deltaX * 2));
        }

        if (direction.includes('bottom')) {
            newHeight = Math.max(minH, Math.min(maxH, startHeight + deltaY * 2));
        } else if (direction.includes('top')) {
            newHeight = Math.max(minH, Math.min(maxH, startHeight - deltaY * 2));
        }

        setModalSize({
            width: Math.round(newWidth),
            height: Math.round(newHeight)
        });
    };

    const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeRef.current) return;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
        resizeRef.current = null;
        setIsResizing(null);
        safeStorage.setItem('agrimap_analysis_modal_size', JSON.stringify(modalSize));
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-1.5 sm:p-4 animate-in fade-in duration-200 select-none pointer-events-auto overflow-hidden"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div 
                ref={modalRef}
                style={!isFullscreen ? {
                    width: `${modalSize.width}px`,
                    height: `${modalSize.height}px`,
                    maxWidth: 'calc(100vw - 16px)',
                    maxHeight: 'calc(100vh - 16px)',
                } : undefined}
                className={`bg-white border border-slate-700/60 rounded-xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden relative transition-[box-shadow,border-color] duration-150 ${
                    isFullscreen 
                        ? 'w-full h-full rounded-none sm:rounded-none' 
                        : ''
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Top Header with Clear Window Controls */}
                <div className="p-3 sm:p-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white flex items-center justify-between shrink-0 select-none gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0">
                            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                                <Stethoscope className="w-5 h-5 text-emerald-400" />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-sm sm:text-base font-black tracking-tight text-white uppercase truncate">
                                    {isKa ? 'AI აგრო დიაგნოსტიკა & კლინიკური კონსოლი' : 'AI Agro Diagnostics & Clinical Console'}
                                </h2>
                                <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/50 font-bold">
                                    {isKa ? 'ვერსია v3.8 Flash' : 'v3.8 Flash'}
                                </span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-300 flex items-center gap-2 truncate">
                                <span className="truncate">{isKa ? 'მცენარეთა დაავადებები, რეცეპტები, აგრო ხედვა & გამოცდილების ბაზა' : 'Plant pathology, prescription ledger, agro vision & cross-learning'}</span>
                                {activeOrgName && (
                                    <>
                                        <span className="text-slate-500">•</span>
                                        <span className="text-emerald-400 font-semibold truncate">{activeOrgName}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Window Controls: Collapse (-), Maximize/Restore, Close (X) */}
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        {/* Collapse (-) Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-400/40 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title={isKa ? 'ჩაკეცვა (-)' : 'Collapse (-)'}
                        >
                            <Minus size={15} strokeWidth={2.5} />
                        </button>

                        {/* Fullscreen / Restore Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title={isFullscreen ? (isKa ? 'სტანდარტული ზომა' : 'Exit Fullscreen') : (isKa ? 'მთელ ეკრანზე გაშლა' : 'Fullscreen')}
                        >
                            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </button>

                        {/* Close (X) Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-500/25 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/50 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title={isKa ? 'დახურვა (X)' : 'Close (X)'}
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Body Area with Full Responsive AiAnalysisSuite */}
                <div className="flex-1 min-h-0 bg-slate-50 overflow-hidden flex flex-col relative">
                    <AiAnalysisSuite
                        mode="full"
                        initialTool={initialTool}
                        activeOrgId={activeOrgId}
                        currentUser={currentUser}
                        onClose={onClose}
                        onAddTask={onAddTask}
                        onAddNutritionPlan={onAddNutritionPlan}
                    />
                </div>

                {/* Live Resize Handles on Edges and Corners (Active when not Fullscreen) */}
                {!isFullscreen && (
                    <>
                        {/* Left Edge Handle */}
                        <div
                            onPointerDown={(e) => startResize(e, 'left')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/edge-left absolute -left-2 top-4 bottom-4 w-5 cursor-ew-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ მარცხნივ/მარჯვნივ)" : "Live resize width (drag left/right)"}
                        >
                            <div className="w-1.5 h-full bg-emerald-500/0 group-hover/edge-left:bg-emerald-500/70 rounded-full transition-colors" />
                            <div className="absolute left-1 bg-emerald-600 text-white rounded-full p-1.5 shadow-xl border border-emerald-300 opacity-0 group-hover/edge-left:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
                                <ArrowLeftRight size={14} />
                            </div>
                        </div>

                        {/* Right Edge Handle */}
                        <div
                            onPointerDown={(e) => startResize(e, 'right')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/edge-right absolute -right-2 top-4 bottom-4 w-5 cursor-ew-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ მარცხნივ/მარჯვნივ)" : "Live resize width (drag left/right)"}
                        >
                            <div className="w-1.5 h-full bg-emerald-500/0 group-hover/edge-right:bg-emerald-500/70 rounded-full transition-colors" />
                            <div className="absolute right-1 bg-emerald-600 text-white rounded-full p-1.5 shadow-xl border border-emerald-300 opacity-0 group-hover/edge-right:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
                                <ArrowLeftRight size={14} />
                            </div>
                        </div>

                        {/* Top Edge Handle */}
                        <div
                            onPointerDown={(e) => startResize(e, 'top')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/edge-top absolute -top-2 left-4 right-4 h-5 cursor-ns-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ ზემოთ/ქვემოთ)" : "Live resize height (drag up/down)"}
                        >
                            <div className="h-1.5 w-full bg-emerald-500/0 group-hover/edge-top:bg-emerald-500/70 rounded-full transition-colors" />
                            <div className="absolute top-1 bg-emerald-600 text-white rounded-full p-1.5 shadow-xl border border-emerald-300 opacity-0 group-hover/edge-top:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
                                <ArrowUpDown size={14} />
                            </div>
                        </div>

                        {/* Bottom Edge Handle */}
                        <div
                            onPointerDown={(e) => startResize(e, 'bottom')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/edge-bottom absolute -bottom-2 left-4 right-4 h-5 cursor-ns-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ ზემოთ/ქვემოთ)" : "Live resize height (drag up/down)"}
                        >
                            <div className="h-1.5 w-full bg-emerald-500/0 group-hover/edge-bottom:bg-emerald-500/70 rounded-full transition-colors" />
                            <div className="absolute bottom-1 bg-emerald-600 text-white rounded-full p-1.5 shadow-xl border border-emerald-300 opacity-0 group-hover/edge-bottom:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
                                <ArrowUpDown size={14} />
                            </div>
                        </div>

                        {/* Corners */}
                        <div
                            onPointerDown={(e) => startResize(e, 'bottom-right')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/corner-br absolute -bottom-2 -right-2 w-7 h-7 cursor-nwse-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
                        >
                            <div className="w-4 h-4 border-r-2 border-b-2 border-slate-400 group-hover/corner-br:border-emerald-500 rounded-br transition-colors" />
                        </div>
                        <div
                            onPointerDown={(e) => startResize(e, 'bottom-left')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/corner-bl absolute -bottom-2 -left-2 w-7 h-7 cursor-nesw-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
                        >
                            <div className="w-4 h-4 border-l-2 border-b-2 border-slate-400 group-hover/corner-bl:border-emerald-500 rounded-bl transition-colors" />
                        </div>
                        <div
                            onPointerDown={(e) => startResize(e, 'top-right')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/corner-tr absolute -top-2 -right-2 w-7 h-7 cursor-nesw-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
                        >
                            <div className="w-4 h-4 border-r-2 border-t-2 border-slate-400 group-hover/corner-tr:border-emerald-500 rounded-tr transition-colors" />
                        </div>
                        <div
                            onPointerDown={(e) => startResize(e, 'top-left')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/corner-tl absolute -top-2 -left-2 w-7 h-7 cursor-nwse-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
                        >
                            <div className="w-4 h-4 border-l-2 border-t-2 border-slate-400 group-hover/corner-tl:border-emerald-500 rounded-tl transition-colors" />
                        </div>

                        {/* Live Resizing Dimension Overlay Badge */}
                        {isResizing && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[6100] px-4 py-2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-emerald-500 text-xs font-mono font-bold flex items-center gap-2.5 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                                <ArrowLeftRight size={14} className="text-emerald-400 animate-pulse" />
                                <span>{Math.round(modalSize.width)} × {Math.round(modalSize.height)} px</span>
                                <span className="text-[10px] text-emerald-300 font-sans font-medium">
                                    {isKa ? 'რეალურ დროში ზომა' : 'Live Size'}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AiAnalysisModal;
