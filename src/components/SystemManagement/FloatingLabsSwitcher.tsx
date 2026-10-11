import React, { useState, useRef } from 'react';
import { GripHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

interface FloatingLabsSwitcherProps {
    labTab: string;
    onSelectLabTab: (tab: any) => void;
}

export const FloatingLabsSwitcher: React.FC<FloatingLabsSwitcherProps> = ({
    labTab,
    onSelectLabTab
}) => {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {}

        const rect = containerRef.current?.getBoundingClientRect();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect ? rect.left : (window.innerWidth / 2 - 250),
            startTop: rect ? rect.top : 12
        };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        e.preventDefault();
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const newX = Math.max(8, Math.min(window.innerWidth - 120, dragRef.current.startLeft + dx));
        const newY = Math.max(8, Math.min(window.innerHeight - 80, dragRef.current.startTop + dy));
        setPos({ x: newX, y: newY });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
        dragRef.current = null;
    };

    if (isMinimized) {
        return (
            <div
                ref={containerRef}
                style={pos ? {
                    position: 'absolute',
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    transform: 'none'
                } : undefined}
                className={`z-[1300] flex items-center gap-1.5 p-1 px-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl select-none text-xs ${
                    pos ? '' : 'absolute top-3 left-1/2 -translate-x-1/2'
                }`}
            >
                <div
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-white flex items-center gap-1.5 py-1"
                    title="Drag anywhere"
                >
                    <GripHorizontal size={13} />
                    <span className="font-black uppercase tracking-wider text-[11px] text-blue-400">
                        🗺️ Labs Nav
                    </span>
                </div>
                <button
                    onClick={() => setIsMinimized(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Expand Labs switcher"
                >
                    <ChevronDown size={13} />
                </button>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={pos ? {
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                transform: 'none'
            } : undefined}
            className={`z-[1300] flex items-center p-1 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl gap-1 select-none ${
                pos ? '' : 'absolute top-3 left-1/2 -translate-x-1/2'
            }`}
        >
            <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onDoubleClick={() => setPos(null)}
                className="px-1.5 py-1 cursor-grab active:cursor-grabbing text-slate-500 hover:text-cyan-400 flex items-center justify-center transition-colors rounded-lg hover:bg-slate-800/60"
                title="Drag anywhere on map (double click to reset)"
            >
                <GripHorizontal size={14} />
            </div>

            <button
                onClick={() => onSelectLabTab('devices_map')}
                data-active={labTab === 'devices_map' ? 'true' : 'false'}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    labTab === 'devices_map'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
            >
                🗺️ Devices Map
            </button>
            <button
                onClick={() => onSelectLabTab('hardware')}
                data-active={labTab === 'hardware' ? 'true' : 'false'}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    labTab === 'hardware'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
            >
                🔌 Hardware & Devices
            </button>
            <button
                onClick={() => onSelectLabTab('theme')}
                data-active="false"
                className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800/80 flex items-center gap-1.5 transition-all cursor-pointer"
            >
                🎨 Theme Studio
            </button>
            <button
                onClick={() => onSelectLabTab('letters')}
                data-active="false"
                className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-slate-800/80 flex items-center gap-1.5 transition-all cursor-pointer"
            >
                🔤 Letters & Menu Colors
            </button>
            <button
                onClick={() => onSelectLabTab('analytics')}
                data-active="false"
                className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800/80 flex items-center gap-1.5 transition-all cursor-pointer"
            >
                🧠 Intelligence
            </button>

            <button
                onClick={() => setIsMinimized(true)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Minimize Labs switcher"
            >
                <ChevronUp size={13} />
            </button>
        </div>
    );
};
