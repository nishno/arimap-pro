import React, { useState } from 'react';
import { 
    useAppTheme, 
    QUICK_LETTER_SWATCHES, 
    TextHaloMode, 
    LetterWeight 
} from '../contexts/ThemeContext';
import { 
    Type, 
    Sliders, 
    Check, 
    RotateCcw, 
    Sun, 
    Moon, 
    Eye, 
    Shield, 
    CheckCircle2, 
    Sparkles, 
    Menu, 
    ChevronDown, 
    Search,
    Lightbulb,
    Palette,
    Layers,
    Compass
} from 'lucide-react';
import { toast } from 'sonner';

export const LetterColorStudio: React.FC = () => {
    const { 
        currentTheme, 
        updateCustomTheme, 
        setAllLettersColor, 
        setMenubarLetterColor, 
        setOptionsLetterColor, 
        setButtonLetterColor, 
        setTextHaloMode, 
        setLetterWeight, 
        setForceAllLettersOverride, 
        resetAllLetterColors,
        resetToDefault
    } = useAppTheme();

    const [testBgMode, setTestBgMode] = useState<'theme' | 'white' | 'dark' | 'light_gray'>('theme');
    const [isMenuOpen, setIsMenuOpen] = useState(true);

    const activeUniversal = currentTheme.universalLetterColor || (currentTheme.isDark ? '#f8fafc' : '#0f172a');
    const activeMenubar = currentTheme.menubarLetterColor || currentTheme.universalLetterColor || (currentTheme.isDark ? '#f8fafc' : '#0f172a');
    const activeOptions = currentTheme.optionsLetterColor || currentTheme.universalLetterColor || (currentTheme.isDark ? '#f8fafc' : '#0f172a');
    const activeHalo = currentTheme.textHaloMode || 'none';
    const activeWeight = currentTheme.letterWeight || 'normal';
    const isOverrideActive = !!currentTheme.forceAllLettersOverride;

    const getTestBg = () => {
        switch (testBgMode) {
            case 'white': return '#ffffff';
            case 'dark': return '#090d16';
            case 'light_gray': return '#f1f5f9';
            case 'theme': default: return currentTheme.bgCanvas;
        }
    };

    const getTestCardBg = () => {
        switch (testBgMode) {
            case 'white': return '#f8fafc';
            case 'dark': return '#0f172a';
            case 'light_gray': return '#ffffff';
            case 'theme': default: return currentTheme.bgSurface;
        }
    };

    const getTestBorder = () => {
        switch (testBgMode) {
            case 'white': return '#e2e8f0';
            case 'dark': return '#1e293b';
            case 'light_gray': return '#cbd5e1';
            case 'theme': default: return currentTheme.borderColor;
        }
    };

    return (
        <div className="bg-slate-900/95 rounded-3xl border border-slate-800 p-6 sm:p-8 text-slate-100 shadow-2xl backdrop-blur-xl space-y-8 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
                        <Type className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                                Letter & Typography Color Studio
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                High Contrast Engine
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Change colors for all text letters in the application, specifically tuning menubars, options, and dropdowns to ensure perfect readability on white or dark themes.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => {
                            resetAllLetterColors();
                            toast.success('Letter colors reset to default theme styles');
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Letters
                    </button>
                    <button
                        onClick={() => {
                            resetToDefault();
                            toast.success('Restored to original default light theme (as shown in image)!');
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset to Image Defaults
                    </button>
                </div>
            </div>

            {/* SCREENSHOT MATCH BANNER */}
            <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-950 to-amber-950/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-wider text-white">Original Theme & Letter Colors</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Matches Image</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                            Restores high-contrast dark charcoal text (#0f172a) on pristine light cards and inputs, matching the daytime screenshot state.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetToDefault();
                        toast.success('Restored to original default light theme (as shown in image)!');
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer flex-shrink-0"
                >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset to Image Defaults</span>
                </button>
            </div>

            {/* SECTION 1: MASTER UNIVERSAL LETTER COLOR OVERRIDE */}
            <div className="p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/20 to-slate-950 space-y-5 shadow-lg relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <h3 className="text-base font-black text-white uppercase tracking-wider">
                                1. Change Color for ALL Letters in Application
                            </h3>
                            {isOverrideActive && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                                    Enforced Globally
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                            Applies a high-priority override to every text character across all screens, menubars, dropdown options, and card labels. Eliminates invisible text on dark or white themes.
                        </p>
                    </div>

                    {/* Master Override Toggle */}
                    <button
                        onClick={() => {
                            const newOverride = !isOverrideActive;
                            setForceAllLettersOverride(newOverride);
                            if (newOverride && !currentTheme.universalLetterColor) {
                                setAllLettersColor(currentTheme.isDark ? '#ffffff' : '#000000');
                            }
                            toast.success(newOverride ? 'Universal letter color enforced!' : 'Universal override disabled (theme colors restored)');
                        }}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border standing-light standing-beam shadow-lg ${
                            isOverrideActive
                                ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-amber-500/20 underglow-box-active active font-black'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <Shield className={`w-4 h-4 ${isOverrideActive ? 'text-slate-950' : 'text-slate-500'}`} />
                        <span>Force Universal Color: {isOverrideActive ? 'ACTIVE' : 'OFF'}</span>
                    </button>
                </div>

                {/* Color Input & Quick Swatches */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
                    {/* Color Picker & Manual Hex */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3">
                        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                            <span>Universal Letter Color</span>
                            <span className="font-mono text-amber-400 text-xs">{activeUniversal}</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <input 
                                type="color" 
                                value={activeUniversal}
                                onChange={(e) => {
                                    setAllLettersColor(e.target.value);
                                    toast.success(`Letters set to ${e.target.value}`);
                                }}
                                className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                            />
                            <input 
                                type="text" 
                                value={activeUniversal}
                                onChange={(e) => setAllLettersColor(e.target.value)}
                                placeholder="#ffffff"
                                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Updates typography across all components in real-time.
                        </p>
                    </div>

                    {/* High-Contrast Quick Presets */}
                    <div className="lg:col-span-2 p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-2.5">
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                            Guaranteed High-Contrast Letter Swatches:
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {QUICK_LETTER_SWATCHES.map((swatch) => {
                                const isCurrent = currentTheme.universalLetterColor?.toLowerCase() === swatch.hex.toLowerCase();
                                return (
                                    <button
                                        key={swatch.name}
                                        onClick={() => {
                                            setAllLettersColor(swatch.hex);
                                            toast.success(`Applied ${swatch.name} letters`);
                                        }}
                                        className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                                            isCurrent
                                                ? 'border-amber-400 bg-slate-800 text-white shadow-md'
                                                : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 hover:text-white'
                                        }`}
                                    >
                                        <div 
                                            className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                                            style={{ backgroundColor: swatch.hex }}
                                        />
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold truncate">{swatch.name}</p>
                                            <p className="text-[9px] text-slate-400 truncate">{swatch.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 2: GRANULAR MENUBARS & OPTIONS LETTER COLORS */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        2. Specific Menubars & Dropdown Options Letter Colors
                    </h3>
                </div>
                <p className="text-xs text-slate-400">
                    Fix specific visibility issues on top navigation bars, ticket menus, search bars, and dropdown option sheets.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Menubars & Navigation Letters */}
                    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                                <Menu className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Menubars & Top Header Letters</span>
                            </label>
                            <span className="font-mono text-emerald-400 text-xs">{activeMenubar}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Styles top navigation headers, breadcrumbs, search labels, and menubar buttons.
                        </p>

                        <div className="flex items-center gap-3">
                            <input 
                                type="color" 
                                value={activeMenubar}
                                onChange={(e) => setMenubarLetterColor(e.target.value)}
                                className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                            />
                            <input 
                                type="text" 
                                value={activeMenubar}
                                onChange={(e) => setMenubarLetterColor(e.target.value)}
                                placeholder="#ffffff"
                                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                            <button
                                onClick={() => setMenubarLetterColor('#ffffff')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1"
                            >
                                <span className="w-2 h-2 rounded-full bg-white" /> Pure White
                            </button>
                            <button
                                onClick={() => setMenubarLetterColor('#000000')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center gap-1"
                            >
                                <span className="w-2 h-2 rounded-full bg-black border border-white/40" /> Black
                            </button>
                            <button
                                onClick={() => setMenubarLetterColor('#fbbf24')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-amber-400 flex items-center gap-1"
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-400" /> Amber
                            </button>
                        </div>
                    </div>

                    {/* Dropdown Options & Context Menus */}
                    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                                <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                                <span>Dropdown Menus & Option Letters</span>
                            </label>
                            <span className="font-mono text-blue-400 text-xs">{activeOptions}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Styles popup context menus, select option tags, listbox items, and action sheets.
                        </p>

                        <div className="flex items-center gap-3">
                            <input 
                                type="color" 
                                value={activeOptions}
                                onChange={(e) => setOptionsLetterColor(e.target.value)}
                                className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                            />
                            <input 
                                type="text" 
                                value={activeOptions}
                                onChange={(e) => setOptionsLetterColor(e.target.value)}
                                placeholder="#ffffff"
                                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                            <button
                                onClick={() => setOptionsLetterColor('#ffffff')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1"
                            >
                                <span className="w-2 h-2 rounded-full bg-white" /> Pure White
                            </button>
                            <button
                                onClick={() => setOptionsLetterColor('#000000')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center gap-1"
                            >
                                <span className="w-2 h-2 rounded-full bg-black border border-white/40" /> Black
                            </button>
                            <button
                                onClick={() => setOptionsLetterColor('#38bdf8')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-cyan-400 flex items-center gap-1"
                            >
                                <span className="w-2 h-2 rounded-full bg-cyan-400" /> Cyan
                            </button>
                        </div>
                    </div>

                    {/* Action Button & Pill Letters */}
                    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                                <Palette className="w-3.5 h-3.5 text-purple-400" />
                                <span>Button & Badge Letters</span>
                            </label>
                            <span className="font-mono text-purple-400 text-xs">
                                {currentTheme.buttonLetterColor || 'Auto Contrast'}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Styles text inside primary action buttons, status pills, and toggle chips.
                        </p>

                        <div className="flex items-center gap-3">
                            <input 
                                type="color" 
                                value={currentTheme.buttonLetterColor || '#ffffff'}
                                onChange={(e) => setButtonLetterColor(e.target.value)}
                                className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                            />
                            <input 
                                type="text" 
                                value={currentTheme.buttonLetterColor || ''}
                                onChange={(e) => setButtonLetterColor(e.target.value)}
                                placeholder="Auto (contrast match)"
                                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                            <button
                                onClick={() => setButtonLetterColor('#ffffff')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1"
                            >
                                White
                            </button>
                            <button
                                onClick={() => setButtonLetterColor('#000000')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center gap-1"
                            >
                                Black
                            </button>
                            <button
                                onClick={() => setButtonLetterColor(null)}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400"
                            >
                                Auto
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 3: CONTRAST SHIELD & FONT WEIGHT BOOSTER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Text Contrast Halo / Outline */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-4">
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Shield className="w-4 h-4 text-emerald-400" />
                            Text Contrast Shield (Halo / Shadow)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Protects text legibility if you switch between white and dark backgrounds without changing letter colors.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'none', label: 'None (Standard)', desc: 'Natural typography without shadow' },
                            { id: 'subtle_dark', label: 'Dark Halo Shield', desc: 'Protects white letters on white/gray themes' },
                            { id: 'subtle_light', label: 'Light Halo Shield', desc: 'Protects dark letters on dark navy themes' },
                            { id: 'outline', label: 'Contrast Perimeter', desc: '1px crisp border around every letter' },
                        ].map((halo) => {
                            const isSelected = activeHalo === halo.id;
                            return (
                                <button
                                    key={halo.id}
                                    onClick={() => {
                                        setTextHaloMode(halo.id as TextHaloMode);
                                        toast.success(`Applied ${halo.label}`);
                                    }}
                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md'
                                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <p className="text-xs font-black flex items-center justify-between">
                                        <span>{halo.label}</span>
                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">{halo.desc}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Letter Font Weight Booster */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-4">
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Type className="w-4 h-4 text-amber-400" />
                            Letter Thickness & Weight Booster
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Thicker letters dramatically improve readability in crowded menubars and small dropdown options.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { id: 'normal', label: 'Regular 400' },
                            { id: 'medium', label: 'Medium 500' },
                            { id: 'semibold', label: 'Semi-Bold 600' },
                            { id: 'bold', label: 'Bold 700' },
                        ].map((wt) => {
                            const isSelected = activeWeight === wt.id;
                            return (
                                <button
                                    key={wt.id}
                                    onClick={() => {
                                        setLetterWeight(wt.id as LetterWeight);
                                        toast.success(`Letter weight: ${wt.label}`);
                                    }}
                                    className={`p-2.5 rounded-xl border text-center transition-all ${
                                        isSelected
                                            ? 'bg-amber-500/20 border-amber-400 text-white font-black shadow-md'
                                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <p className="text-xs font-bold">{wt.label}</p>
                                    <p className="text-[9px] text-slate-500 mt-0.5">
                                        {wt.id === 'semibold' ? 'Recommended' : wt.id}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* SECTION 4: LIVE INTERACTIVE MENUBAR & OPTIONS SIMULATION TESTER */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Eye className="w-4 h-4 text-emerald-400" />
                            Interactive Menubar & Dropdown Sandbox Verification
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Test your letter colors immediately against White, Dark, or Navy backgrounds to verify visibility.
                        </p>
                    </div>

                    {/* Background Simulator Switcher */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Simulate:</span>
                        <button
                            onClick={() => setTestBgMode('white')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                testBgMode === 'white' 
                                    ? 'bg-white text-slate-950 shadow-sm' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Sun className="w-3 h-3 text-amber-500" /> White Theme
                        </button>
                        <button
                            onClick={() => setTestBgMode('dark')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                testBgMode === 'dark' 
                                    ? 'bg-slate-800 text-white shadow-sm' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Moon className="w-3 h-3 text-cyan-400" /> Dark Theme
                        </button>
                        <button
                            onClick={() => setTestBgMode('light_gray')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                testBgMode === 'light_gray' 
                                    ? 'bg-slate-200 text-slate-950 shadow-sm' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Slate Light
                        </button>
                        <button
                            onClick={() => setTestBgMode('theme')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                testBgMode === 'theme' 
                                    ? 'bg-emerald-600 text-white shadow-sm' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Theme Canvas
                        </button>
                    </div>
                </div>

                {/* Simulated Canvas Box */}
                <div 
                    className="p-6 rounded-2xl border transition-all duration-300 space-y-6 shadow-inner"
                    style={{
                        backgroundColor: getTestBg(),
                        borderColor: getTestBorder(),
                    }}
                >
                    {/* Simulated Top Menubar */}
                    <div 
                        className="p-3.5 rounded-2xl border shadow-lg flex flex-wrap items-center justify-between gap-3"
                        style={{
                            backgroundColor: getTestCardBg(),
                            borderColor: getTestBorder(),
                        }}
                    >
                        {/* Menubar Brand & Title */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-md">
                                AG
                            </div>
                            <div>
                                <h4 
                                    className="text-xs font-black uppercase tracking-wider"
                                    style={{ color: activeMenubar }}
                                >
                                    AGRIMAP ENTERPRISE MENUBAR
                                </h4>
                                <p 
                                    className="text-[10px]"
                                    style={{ color: activeMenubar, opacity: 0.8 }}
                                >
                                    Active Workspace: North Highland Block A-1
                                </p>
                            </div>
                        </div>

                        {/* Menubar Search & Action Buttons */}
                        <div className="flex items-center gap-2">
                            <div 
                                className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs"
                                style={{
                                    borderColor: getTestBorder(),
                                    color: activeMenubar
                                }}
                            >
                                <Search className="w-3.5 h-3.5 opacity-70" />
                                <span className="text-[11px] font-medium">Search features, tickets, plots...</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded border border-current opacity-60">⌘K</span>
                            </div>

                            {/* Dropdown Toggle Button */}
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                                style={{
                                    backgroundColor: `${currentTheme.accentPrimary}20`,
                                    color: activeMenubar,
                                    borderColor: `${currentTheme.accentPrimary}50`
                                }}
                            >
                                <span>Menubar Options</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Simulated Open Dropdown Options Sheet & Simulated Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Dropdown Options Popup */}
                        <div 
                            className="p-4 rounded-2xl border shadow-2xl space-y-2.5"
                            style={{
                                backgroundColor: getTestCardBg(),
                                borderColor: getTestBorder(),
                            }}
                        >
                            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: getTestBorder() }}>
                                <span 
                                    className="text-[10px] font-black uppercase tracking-wider"
                                    style={{ color: activeOptions }}
                                >
                                    Simulated Dropdown Options List
                                </span>
                                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400">
                                    Options letters tested
                                </span>
                            </div>

                            <div className="space-y-1">
                                {[
                                    { label: '🌾 Export Plantation Shapefile (.geojson)', badge: 'Layer' },
                                    { label: '📊 Generate Real-Time NDVI Health Report', badge: 'AI Engine' },
                                    { label: '⚙️ Configure IoT Soil Moisture Telemetry', badge: 'Hardware' },
                                    { label: '🎫 Open Field Incident Ticket Tracker', badge: 'Operations' },
                                    { label: '🗑️ Delete Selected Boundary Geometry', badge: 'Danger' }
                                ].map((item, idx) => (
                                    <div 
                                        key={idx}
                                        className="p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium cursor-pointer transition-colors hover:bg-slate-800/40"
                                        style={{
                                            borderColor: getTestBorder(),
                                            color: activeOptions
                                        }}
                                    >
                                        <span className="font-semibold">{item.label}</span>
                                        <span 
                                            className="text-[9px] px-2 py-0.5 rounded font-mono border"
                                            style={{
                                                borderColor: getTestBorder(),
                                                color: activeOptions,
                                                opacity: 0.8
                                            }}
                                        >
                                            {item.badge}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Simulated Content Card */}
                        <div 
                            className="p-4 rounded-2xl border shadow-xl space-y-3"
                            style={{
                                backgroundColor: getTestCardBg(),
                                borderColor: getTestBorder(),
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <h5 
                                    className="text-xs font-black uppercase tracking-wider"
                                    style={{ color: activeUniversal }}
                                >
                                    Crop Phenology & Nitrogen State
                                </h5>
                                <span className="text-[10px] font-mono font-bold text-emerald-400">
                                    +14.2% Growth
                                </span>
                            </div>

                            <p 
                                className="text-xs leading-relaxed"
                                style={{ color: activeUniversal, opacity: 0.9 }}
                            >
                                Letters render with crystal-clear visibility and contrast. Even when switching backgrounds from light white to deep midnight slate, text remains sharp and perfectly legible.
                            </p>

                            <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: getTestBorder() }}>
                                <span className="text-[10px] font-bold" style={{ color: activeUniversal, opacity: 0.7 }}>
                                    Status: Verified 100% Legible
                                </span>
                                <button
                                    className="px-3 py-1 rounded-xl text-xs font-black text-white shadow-md"
                                    style={{ backgroundColor: currentTheme.accentPrimary }}
                                >
                                    Action Button
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LetterColorStudio;
