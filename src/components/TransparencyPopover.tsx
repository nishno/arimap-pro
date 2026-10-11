import React, { useState, useRef, useEffect } from 'react';
import { Eye, Check, Sliders } from 'lucide-react';

interface TransparencyPopoverProps {
    value: number; // 10 to 100
    onChange: (val: number) => void;
    theme?: 'light' | 'dark';
    label?: string;
    buttonClassName?: string;
    popoverPlacement?: 'top' | 'bottom' | 'left' | 'right';
}

export const TransparencyPopover: React.FC<TransparencyPopoverProps> = ({
    value,
    onChange,
    theme = 'light',
    label = 'Transparency',
    buttonClassName = '',
    popoverPlacement = 'bottom'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [typedValue, setTypedValue] = useState<string>(String(value));
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setTypedValue(String(value));
    }, [value]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent | PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleClickOutside);
        return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, [isOpen]);

    const handleCommitTyped = (valStr: string) => {
        let num = parseInt(valStr, 10);
        if (isNaN(num)) num = 95;
        num = Math.max(10, Math.min(100, num));
        setTypedValue(String(num));
        onChange(num);
    };

    const presets = [30, 50, 75, 90, 100];

    const isDark = theme === 'dark';

    // Placement positioning
    const placementClasses = {
        bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
        top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
        left: 'right-full mr-2 top-0',
        right: 'left-full ml-2 top-0'
    }[popoverPlacement];

    return (
        <div ref={containerRef} className="relative inline-block select-none">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(prev => !prev);
                }}
                className={buttonClassName || `px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95 ${
                    isDark 
                        ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:text-white' 
                        : 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 border border-slate-200 hover:text-slate-950'
                }`}
                title={`${label}: ${value}% opacity (Click to set by % or write exact percent)`}
            >
                <Eye size={12} className={isDark ? 'text-amber-400' : 'text-blue-600'} />
                <span>{value}%</span>
            </button>

            {/* Popover */}
            {isOpen && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`absolute z-[2500] w-60 p-3 rounded-2xl shadow-2xl border animate-in fade-in zoom-in-95 duration-150 ${placementClasses} ${
                        isDark 
                            ? 'bg-slate-950/95 backdrop-blur-xl border-slate-800 text-white' 
                            : 'bg-white/95 backdrop-blur-xl border-slate-200 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.2)]'
                    }`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200/40 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                            <Eye size={14} className={isDark ? 'text-amber-400' : 'text-blue-600'} />
                            <span className="text-[11px] font-black uppercase tracking-wider">
                                {label}
                            </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 dark:text-amber-400">
                            {value}%
                        </span>
                    </div>

                    {/* Write what percent we want to make it (Direct Input) */}
                    <div className="mb-2.5">
                        <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Write Percent (10% - 100%)
                        </label>
                        <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    min="10"
                                    max="100"
                                    value={typedValue}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        setTypedValue(raw);
                                        const num = parseInt(raw, 10);
                                        if (!isNaN(num) && num >= 10 && num <= 100) {
                                            onChange(num);
                                        }
                                    }}
                                    onBlur={(e) => handleCommitTyped(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCommitTyped(typedValue);
                                            setIsOpen(false);
                                        }
                                    }}
                                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold border outline-none transition-all ${
                                        isDark 
                                            ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400' 
                                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                    }`}
                                    placeholder="e.g. 70"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none">
                                    %
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    handleCommitTyped(typedValue);
                                    setIsOpen(false);
                                }}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold uppercase transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                                Apply
                            </button>
                        </div>
                    </div>

                    {/* Smooth Range Slider */}
                    <div className="mb-3">
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 mb-1 uppercase">
                            <span>See-through (10%)</span>
                            <span>Solid (100%)</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="1"
                            value={value}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                onChange(v);
                                setTypedValue(String(v));
                            }}
                            className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-800 accent-blue-600 dark:accent-amber-400 cursor-pointer"
                        />
                    </div>

                    {/* Quick Presets */}
                    <div>
                        <div className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Quick Presets
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                            {presets.map((p) => {
                                const active = value === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => {
                                            onChange(p);
                                            setTypedValue(String(p));
                                        }}
                                        className={`py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                                            active
                                                ? (isDark ? 'bg-amber-500 text-slate-950 font-black' : 'bg-blue-600 text-white font-black')
                                                : (isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')
                                        }`}
                                    >
                                        {p}%
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
