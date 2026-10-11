import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeftRight, ArrowUpDown, GripVertical, GripHorizontal } from 'lucide-react';
import { safeStorage } from '../../services/storageService';

interface ResizableDividerProps {
    direction?: 'horizontal' | 'vertical';
    currentSize: number;
    onResize: (newSize: number) => void;
    onResizeEnd?: (finalSize: number) => void;
    minSize?: number;
    maxSize?: number;
    storageKey?: string;
    isKa?: boolean;
    className?: string;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
    direction = 'horizontal',
    currentSize,
    onResize,
    onResizeEnd,
    minSize = 280,
    maxSize,
    storageKey,
    isKa = false,
    className = ''
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const startPosRef = useRef<number>(0);
    const startSizeRef = useRef<number>(currentSize);
    const activePointerIdRef = useRef<number | null>(null);

    const isHorizontal = direction === 'horizontal';

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        
        setIsDragging(true);
        activePointerIdRef.current = e.pointerId;
        startPosRef.current = isHorizontal ? e.clientX : e.clientY;
        startSizeRef.current = currentSize;

        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {
            // pointer capture fallback
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        e.preventDefault();

        const currentPos = isHorizontal ? e.clientX : e.clientY;
        const delta = currentPos - startPosRef.current;
        let newSize = startSizeRef.current + delta;

        const effectiveMin = minSize;
        const effectiveMax = maxSize || (isHorizontal ? Math.max(window.innerWidth - 240, 600) : 800);

        newSize = Math.max(effectiveMin, Math.min(newSize, effectiveMax));
        onResize(newSize);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('resize'));
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        setIsDragging(false);

        try {
            if (activePointerIdRef.current !== null && e.currentTarget.hasPointerCapture(activePointerIdRef.current)) {
                e.currentTarget.releasePointerCapture(activePointerIdRef.current);
            }
        } catch (err) {
            // ignore
        }
        activePointerIdRef.current = null;

        if (storageKey) {
            safeStorage.setItem(storageKey, String(Math.round(currentSize)));
        }
        onResizeEnd?.(currentSize);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('resize'));
        }
    };

    return (
        <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`relative group/divider flex-shrink-0 flex items-center justify-center select-none touch-none z-[1003] transition-colors ${
                isHorizontal 
                    ? 'w-3.5 -mx-1.5 cursor-col-resize h-full' 
                    : 'h-3.5 -my-1.5 cursor-row-resize w-full'
            } ${className}`}
            title={
                isKa 
                    ? (isHorizontal ? "ზომის გაზრდა / შემცირება (გაჭიმეთ მარცხნივ/მარჯვნივ ↔)" : "ზომის შეცვლა (გაჭიმეთ ზემოთ/ქვემოთ ↕)")
                    : (isHorizontal ? "Drag edge to resize terminal width ↔" : "Drag edge to resize height ↕")
            }
        >
            {/* Background Line Guide */}
            <div 
                className={`transition-all duration-150 rounded-full ${
                    isHorizontal 
                        ? 'w-1 h-full' 
                        : 'h-1 w-full'
                } ${
                    isDragging 
                        ? 'bg-[#3b36db] shadow-md shadow-indigo-300' 
                        : 'bg-slate-200/80 group-hover/divider:bg-[#3b36db]/60'
                }`} 
            />

            {/* Directional Resize Indicator Pill */}
            <div 
                className={`absolute pointer-events-none transition-all duration-150 flex items-center justify-center shadow-lg rounded-full border ${
                    isDragging 
                        ? 'scale-110 bg-[#3b36db] text-white border-indigo-300 shadow-indigo-300/60 opacity-100' 
                        : 'opacity-0 group-hover/divider:opacity-100 scale-95 group-hover/divider:scale-100 bg-white text-[#3b36db] border-slate-300'
                } ${
                    isHorizontal 
                        ? 'px-1.5 py-2 flex-col gap-1' 
                        : 'py-1.5 px-2 flex-row gap-1'
                }`}
            >
                {isHorizontal ? (
                    <>
                        <ArrowLeftRight size={13} className={isDragging ? 'animate-pulse' : ''} />
                        <GripVertical size={11} className="opacity-70" />
                    </>
                ) : (
                    <>
                        <ArrowUpDown size={13} className={isDragging ? 'animate-pulse' : ''} />
                        <GripHorizontal size={11} className="opacity-70" />
                    </>
                )}
            </div>

            {/* Live Size Floating Badge when dragging */}
            {isDragging && (
                <div 
                    className={`fixed z-[9999] pointer-events-none px-3.5 py-1.5 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-indigo-400 text-[11px] font-mono font-black flex items-center gap-2 animate-in fade-in zoom-in-95 duration-100 ${
                        isHorizontal 
                            ? 'top-20' 
                            : 'left-1/2 -translate-x-1/2'
                    }`}
                    style={
                        isHorizontal 
                            ? { left: `${Math.max(currentSize - 40, 20)}px` } 
                            : { top: `${currentSize + 20}px` }
                    }
                >
                    {isHorizontal ? <ArrowLeftRight size={13} className="text-indigo-400 animate-pulse" /> : <ArrowUpDown size={13} className="text-indigo-400 animate-pulse" />}
                    <span>{Math.round(currentSize)} px</span>
                    <span className="text-[9px] font-sans font-medium text-slate-300 uppercase tracking-widest">
                        {isKa ? 'სიგანე' : 'Width'}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ResizableDivider;
