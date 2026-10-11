import React, { useState } from 'react';
import { 
    useAppTheme, 
    THEME_PRESETS, 
    AppThemeConfig, 
    UnderglowIntensity, 
    UnderglowColorMode,
    QUICK_LETTER_SWATCHES,
    AllLettersColorMode,
    TextHaloMode,
    LetterWeight
} from '../contexts/ThemeContext';
import { 
    Palette, 
    Sparkles, 
    RotateCcw, 
    Download, 
    Upload, 
    Copy, 
    Sliders, 
    Eye, 
    Layers, 
    Cpu, 
    CheckCircle2,
    Zap,
    MousePointerClick,
    AlertTriangle,
    TrendingUp,
    Check,
    SunMedium,
    Lightbulb,
    Flame,
    Type,
    Shield,
    SlidersHorizontal,
    Sun,
    Moon,
    Menu,
    ChevronDown,
    Search
} from 'lucide-react';
import { toast } from 'sonner';
import { LetterColorStudio } from './LetterColorStudio';

const QUICK_CANVAS_SWATCHES = [
    { name: 'Architecture Slate', hex: '#090d16' },
    { name: 'Midnight Navy', hex: '#070c18' },
    { name: 'Carbon OLED', hex: '#050507' },
    { name: 'Cyber Stealth', hex: '#050f0b' },
    { name: 'Deep Void', hex: '#040406' },
    { name: 'Soft Dark 900', hex: '#0f172a' },
    { name: 'Clean Light', hex: '#f8fafc' },
];

const QUICK_SURFACE_SWATCHES = [
    { name: 'Architecture Box', hex: '#0f172a' },
    { name: 'Midnight Surface', hex: '#0a1020' },
    { name: 'Dark Slate 900', hex: '#0d1527' },
    { name: 'Carbon Box', hex: '#0f1015' },
    { name: 'Zinc 900', hex: '#18181b' },
    { name: 'Emerald Glass', hex: '#081a14' },
    { name: 'Pure White', hex: '#ffffff' },
];

const QUICK_SUBSURFACE_SWATCHES = [
    { name: 'Inner Architecture Dark', hex: '#070c18' },
    { name: 'Midnight Inner Box', hex: '#050a14' },
    { name: 'Deep Carbon Row', hex: '#08080a' },
    { name: 'Cyber Emerald Inner', hex: '#040d09' },
    { name: 'Deep Purple Inner', hex: '#0a0513' },
    { name: 'Zinc 950 Inner', hex: '#09090b' },
    { name: 'Light Slate Inner', hex: '#f1f5f9' },
];

const QUICK_BORDER_SWATCHES = [
    { name: 'Slate 800', hex: '#1e293b' },
    { name: 'Dark Navy Border', hex: '#1e2942' },
    { name: 'Slate 700 High Contrast', hex: '#334155' },
    { name: 'Zinc 800 Border', hex: '#27272a' },
    { name: 'Emerald Border', hex: '#064e3b' },
    { name: 'Subtle Slate 900', hex: '#0f172a' },
    { name: 'Light Border', hex: '#e2e8f0' },
];

const QUICK_ACCENT_SWATCHES = [
    { name: 'Vibrant Emerald', hex: '#10b981', hover: '#059669' },
    { name: 'Cyber Blue', hex: '#3b82f6', hover: '#2563eb' },
    { name: 'Electric Violet', hex: '#8b5cf6', hover: '#7c3aed' },
    { name: 'Amber Gold', hex: '#f59e0b', hover: '#d97706' },
    { name: 'Rose Red', hex: '#f43f5e', hover: '#e11d48' },
    { name: 'Cyan Aqua', hex: '#06b6d4', hover: '#0891b2' },
    { name: 'Classic Indigo', hex: '#4f46e5', hover: '#4338ca' },
];

const QUICK_LIGHTING_COLORS: { name: string; mode: UnderglowColorMode; hex: string; desc: string }[] = [
    { name: 'Emerald Neon', mode: 'emerald', hex: '#10b981', desc: 'Architecture green underglow' },
    { name: 'Cyber Cyan', mode: 'cyan', hex: '#38bdf8', desc: 'High-tech cyan floor beam' },
    { name: 'Cobalt Blue', mode: 'custom', hex: '#3b82f6', desc: 'Deep electric blue' },
    { name: 'Neon Purple', mode: 'violet', hex: '#a855f7', desc: 'Cyberpunk ultraviolet' },
    { name: 'Amber Warmth', mode: 'amber', hex: '#f59e0b', desc: 'Golden solar flare' },
    { name: 'Rose Crimson', mode: 'custom', hex: '#f43f5e', desc: 'Vibrant crimson pulse' },
    { name: 'Pure White Aurora', mode: 'white', hex: '#ffffff', desc: 'Clean high-lumen white' },
    { name: 'Theme Accent Match', mode: 'accent', hex: '#10b981', desc: 'Follows primary button color' },
];

const INTENSITY_LEVELS: { id: UnderglowIntensity; label: string; desc: string }[] = [
    { id: 'subtle', label: 'Subtle', desc: 'Discreet soft lighting' },
    { id: 'medium', label: 'Medium', desc: 'Balanced glow' },
    { id: 'vibrant', label: 'Vibrant', desc: 'High visibility beam' },
    { id: 'neon_beam', label: 'Neon Beam', desc: 'Rich intense projection' },
    { id: 'cyber_floor', label: 'Cyber Floor', desc: 'Maximum 100% luminance' },
];

export const ThemeColorStudio: React.FC = () => {
    const { 
        currentTheme, 
        setThemePreset, 
        updateCustomTheme, 
        resetToDefault, 
        resolvedUnderglowColor,
        setAllLettersColor,
        setMenubarLetterColor,
        setOptionsLetterColor,
        setButtonLetterColor,
        setTextHaloMode,
        setLetterWeight,
        setForceAllLettersOverride,
        resetAllLetterColors
    } = useAppTheme();
    const [activeStudioTab, setActiveStudioTab] = useState<'presets' | 'customizer' | 'letters' | 'lighting' | 'export'>('letters');
    const [testClickCount, setTestClickCount] = useState(0);
    const [previewBgMode, setPreviewBgMode] = useState<'theme' | 'white' | 'dark' | 'light_gray'>('theme');
    const [isSimulatedMenuOpen, setIsSimulatedMenuOpen] = useState(true);

    const isUnderglowEnabled = currentTheme.underglowEnabled !== false;
    const activeColor = currentTheme.underglowColorMode === 'custom' 
        ? (currentTheme.underglowCustomColor || '#38bdf8') 
        : resolvedUnderglowColor;

    const handleCopyCssVars = () => {
        const cssString = `
:root {
  --bg-canvas: ${currentTheme.bgCanvas};
  --bg-surface: ${currentTheme.bgSurface};
  --bg-subsurface: ${currentTheme.bgSubSurface || currentTheme.bgSurface};
  --bg-sidebar: ${currentTheme.bgSidebar};
  --bg-header: ${currentTheme.bgHeader};
  --text-primary: ${currentTheme.universalLetterColor || currentTheme.textPrimary};
  --text-secondary: ${currentTheme.universalLetterColor || currentTheme.textSecondary};
  --text-menubar: ${currentTheme.menubarLetterColor || currentTheme.universalLetterColor || currentTheme.textPrimary};
  --text-options: ${currentTheme.optionsLetterColor || currentTheme.universalLetterColor || currentTheme.textPrimary};
  --border-color: ${currentTheme.borderColor};
  --accent-primary: ${currentTheme.accentPrimary};
  --accent-primary-hover: ${currentTheme.accentPrimaryHover};
  --accent-secondary: ${currentTheme.accentSecondary};
  --underglow-raw: ${resolvedUnderglowColor};
}
        `.trim();
        navigator.clipboard.writeText(cssString);
        toast.success('CSS Variables copied to clipboard!');
    };

    const handleExportJson = () => {
        const json = JSON.stringify(currentTheme, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agrimap-theme-${currentTheme.id}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Theme configuration exported!');
    };

    const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (parsed.bgCanvas && parsed.accentPrimary) {
                    updateCustomTheme(parsed);
                    toast.success('Custom theme imported successfully!');
                } else {
                    toast.error('Invalid theme configuration file.');
                }
            } catch (err) {
                toast.error('Failed to parse JSON file.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 sm:p-8 text-slate-100 shadow-2xl backdrop-blur-xl space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
                        <Palette className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                                UI & Color Studio
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Live Engine
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Customize dark tones, application canvas, module outer containers, inner module boxes, and action button colors.
                        </p>
                    </div>
                </div>

                {/* Sub tabs and Global Reset */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                        <button
                            onClick={() => setActiveStudioTab('presets')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 standing-light standing-beam ${
                                activeStudioTab === 'presets' 
                                    ? 'bg-emerald-600 text-white shadow-md underglow-box-active active' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Presets
                        </button>
                        <button
                            onClick={() => setActiveStudioTab('customizer')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 standing-light standing-beam ${
                                activeStudioTab === 'customizer' 
                                    ? 'bg-emerald-600 text-white shadow-md underglow-box-active active' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Sliders className="w-3.5 h-3.5" />
                            Color Customizer
                        </button>
                        <button
                            onClick={() => setActiveStudioTab('letters')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 standing-light standing-beam ${
                                activeStudioTab === 'letters' 
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-md underglow-box-active active' 
                                    : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20'
                            }`}
                            title="Change color for all letters in application, menubars, and options"
                        >
                            <Type className="w-3.5 h-3.5" />
                            Letter & Menubar Colors
                            {currentTheme.forceAllLettersOverride && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveStudioTab('lighting')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 standing-light standing-beam ${
                                activeStudioTab === 'lighting' 
                                    ? 'bg-emerald-600 text-white shadow-md underglow-box-active active' 
                                    : 'text-emerald-400 hover:text-emerald-300'
                            }`}
                        >
                            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                            Lighting & Underglow
                        </button>
                        <button
                            onClick={() => setActiveStudioTab('export')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 standing-light standing-beam ${
                                activeStudioTab === 'export' 
                                    ? 'bg-emerald-600 text-white shadow-md underglow-box-active active' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export / Import
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            resetToDefault();
                            toast.success('All UI & Color Studio configurations restored to original default!');
                        }}
                        className="px-3.5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 hover:border-rose-400/80 active:scale-95 cursor-pointer shadow-md shadow-rose-950/40 flex-shrink-0"
                        title="Restore all colors, dark themes, and typography settings to original default"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                        <span>Reset to Default</span>
                    </button>
                </div>
            </div>

            {/* SCREENSHOT MATCH RESTORE HERO BANNER */}
            <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-950 to-teal-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-wider text-white">Original Default Theme & Letter Colors</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Matches Image</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                            Restores the daytime clean light theme: pristine white cards, crisp high-contrast dark letters across all inputs/pop-up windows, and standard action buttons without dark mode color clashing.
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

            {/* LIVE PREVIEW BANNER (MATCHES USER SCREENSHOT) */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-950/80 relative overflow-hidden shadow-inner">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                        <Eye className="w-4 h-4 text-emerald-400" />
                        Live Interactive Sandbox Preview
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500">Active Theme:</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                            {currentTheme.name}
                        </span>
                    </div>
                </div>

                {/* Simulated Main Canvas */}
                <div 
                    className="p-6 rounded-2xl border transition-all duration-300 relative shadow-2xl space-y-4"
                    style={{
                        backgroundColor: currentTheme.bgCanvas,
                        borderColor: currentTheme.borderColor,
                        color: currentTheme.textPrimary
                    }}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: currentTheme.textSecondary }}>
                            Simulated Screen Canvas (Background: {currentTheme.bgCanvas})
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ borderColor: currentTheme.borderColor, color: currentTheme.textSecondary }}>
                            Border: {currentTheme.borderColor}
                        </span>
                    </div>

                    {/* Simulated Module Card (Surface) */}
                    <div 
                        className="p-5 rounded-2xl border transition-all duration-300 space-y-4 shadow-xl"
                        style={{
                            backgroundColor: currentTheme.bgSurface,
                            borderColor: currentTheme.borderColor,
                        }}
                    >
                        {/* Module Header Bar */}
                        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: currentTheme.borderColor }}>
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md"
                                    style={{ backgroundColor: currentTheme.accentPrimary }}
                                >
                                    <Cpu className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black" style={{ color: currentTheme.textPrimary }}>
                                        AI Autonomous Stream & Operational Anomaly Engine
                                    </h4>
                                    <p className="text-[11px]" style={{ color: currentTheme.textSecondary }}>
                                        Module Surface Container (Background: {currentTheme.bgSurface})
                                    </p>
                                </div>
                            </div>
                            <span 
                                className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1"
                                style={{
                                    backgroundColor: `${currentTheme.accentPrimary}20`,
                                    color: currentTheme.accentPrimary,
                                    borderColor: `${currentTheme.accentPrimary}40`
                                }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.accentPrimary }} />
                                Real-time Synced
                            </span>
                        </div>

                        {/* Inside Module Rows / Sub-Surface Cards */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: currentTheme.textSecondary }}>
                                Inner Module Content & Alert Boxes (Background: {currentTheme.bgSubSurface || currentTheme.bgSurface}):
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {/* Anomaly Box 1 */}
                                <div 
                                    className="p-4 rounded-xl border transition-all duration-300 space-y-2.5 group"
                                    style={{
                                        backgroundColor: currentTheme.bgSubSurface || currentTheme.bgSurface,
                                        borderColor: currentTheme.borderColor,
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: currentTheme.textPrimary }}>
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                            Stock / Inventory Spike
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                                            High
                                        </span>
                                    </div>
                                    <p className="text-xs leading-relaxed" style={{ color: currentTheme.textSecondary }}>
                                        Nails depletion rate running 2.1x higher than standard fence construction benchmark.
                                    </p>
                                    <div className="pt-2 border-t flex items-center justify-between text-[11px]" style={{ borderColor: currentTheme.borderColor }}>
                                        <div className="flex items-center gap-1 font-bold text-amber-400">
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            <span>+118% Variance</span>
                                        </div>
                                        <button 
                                            className="text-xs font-black hover:underline"
                                            style={{ color: currentTheme.accentSecondary }}
                                        >
                                            Diagnose →
                                        </button>
                                    </div>
                                </div>

                                {/* Anomaly Box 2 */}
                                <div 
                                    className="p-4 rounded-xl border transition-all duration-300 space-y-2.5 group"
                                    style={{
                                        backgroundColor: currentTheme.bgSubSurface || currentTheme.bgSurface,
                                        borderColor: currentTheme.borderColor,
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: currentTheme.textPrimary }}>
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                            Agronomy Application Normal
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            Normal
                                        </span>
                                    </div>
                                    <p className="text-xs leading-relaxed" style={{ color: currentTheme.textSecondary }}>
                                        Nitrogen fertilizer dosage optimal across Sector B plantation rows.
                                    </p>
                                    <div className="pt-2 border-t flex items-center justify-between text-[11px]" style={{ borderColor: currentTheme.borderColor }}>
                                        <div className="flex items-center gap-1 font-bold text-emerald-400">
                                            <span>100% In Range</span>
                                        </div>
                                        <button 
                                            className="text-xs font-black hover:underline"
                                            style={{ color: currentTheme.accentSecondary }}
                                        >
                                            View Logs →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Buttons Bar */}
                        <div className="flex flex-wrap items-center gap-3 pt-3 border-t" style={{ borderColor: currentTheme.borderColor }}>
                            <button
                                onClick={() => setTestClickCount(c => c + 1)}
                                className={`px-4 py-2 font-bold text-xs text-white transition-all flex items-center gap-2 active:scale-95 ${
                                    currentTheme.buttonRadius
                                } ${
                                    currentTheme.buttonGlow ? 'shadow-lg' : ''
                                }`}
                                style={{ 
                                    backgroundColor: currentTheme.accentPrimary,
                                    boxShadow: currentTheme.buttonGlow ? `0 8px 20px -4px ${currentTheme.accentPrimary}60` : 'none'
                                }}
                            >
                                <Zap className="w-3.5 h-3.5" />
                                <span>Action Button ({testClickCount})</span>
                            </button>

                            <button
                                className={`px-3.5 py-2 font-bold text-xs transition-all border flex items-center gap-1.5 ${currentTheme.buttonRadius}`}
                                style={{
                                    borderColor: currentTheme.borderColor,
                                    color: currentTheme.textPrimary,
                                    backgroundColor: currentTheme.bgSubSurface || currentTheme.bgSurface
                                }}
                            >
                                <MousePointerClick className="w-3.5 h-3.5 text-slate-400" />
                                <span>Secondary Action</span>
                            </button>

                            <span 
                                className="text-[10px] px-2.5 py-1 rounded-lg border font-mono font-bold"
                                style={{
                                    borderColor: currentTheme.borderColor,
                                    color: currentTheme.accentSecondary,
                                    backgroundColor: `${currentTheme.accentSecondary}15`
                                }}
                            >
                                Accent: {currentTheme.accentPrimary}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TAB 1: PRESETS */}
            {activeStudioTab === 'presets' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">
                            Curated Theme Presets
                        </h3>
                        <button
                            onClick={() => {
                                resetToDefault();
                                toast.success('Reset to original default light theme!');
                            }}
                            className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset to Original Default (Classic Light)
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {THEME_PRESETS.map((preset) => {
                            const isSelected = currentTheme.id === preset.id;
                            const isScreenshotMatch = preset.id === 'classic_light';

                            return (
                                <div
                                    key={preset.id}
                                    onClick={() => setThemePreset(preset.id)}
                                    className={`group cursor-pointer p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                                        isSelected 
                                            ? 'border-emerald-500 bg-slate-950 shadow-xl shadow-emerald-950/40 ring-2 ring-emerald-500/30' 
                                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950'
                                    }`}
                                >
                                    {isScreenshotMatch && (
                                        <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-600 to-teal-500 text-white text-[9px] font-black uppercase tracking-wider px-3 py-0.5 rounded-bl-xl shadow-md">
                                            Screenshot Match
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                                                    style={{ backgroundColor: preset.accentPrimary }}
                                                />
                                                <h4 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">
                                                    {preset.name}
                                                </h4>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            )}
                                        </div>

                                        <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                                            {preset.description}
                                        </p>
                                    </div>

                                    {/* Palette chips */}
                                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-lg border border-slate-700" style={{ backgroundColor: preset.bgCanvas }} title={`Canvas: ${preset.bgCanvas}`} />
                                            <div className="w-5 h-5 rounded-lg border border-slate-700" style={{ backgroundColor: preset.bgSurface }} title={`Surface: ${preset.bgSurface}`} />
                                            <div className="w-5 h-5 rounded-lg border border-slate-700" style={{ backgroundColor: preset.bgSubSurface || preset.bgSurface }} title={`SubSurface: ${preset.bgSubSurface}`} />
                                            <div className="w-5 h-5 rounded-lg border border-slate-700" style={{ backgroundColor: preset.accentPrimary }} title={`Button: ${preset.accentPrimary}`} />
                                        </div>

                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-slate-300">
                                            {isSelected ? 'Active' : 'Apply'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: LIVE COLOR CUSTOMIZER */}
            {activeStudioTab === 'customizer' && (
                <div className="space-y-8">
                    {/* Quick Reset Option */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                        <div>
                            <span className="text-xs font-bold text-slate-200">Custom Color Tuning</span>
                            <p className="text-[10px] text-slate-400">Tuning custom dark or light palettes. You can restore pristine factory defaults whenever needed.</p>
                        </div>
                        <button
                            onClick={() => {
                                resetToDefault();
                                toast.success('Restored all UI & Color Studio configurations to original default!');
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-rose-300 hover:text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm self-start sm:self-auto"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                            Reset to Default
                        </button>
                    </div>

                    {/* Section 1: Backgrounds (Canvas, Surface, SubSurface) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                1. Backgrounds & Module Hierarchy (Canvas, Card & Inner Boxes)
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Canvas Color */}
                            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                    <span>Main Screen Canvas</span>
                                    <span className="font-mono text-emerald-400 text-xs">{currentTheme.bgCanvas}</span>
                                </label>
                                
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={currentTheme.bgCanvas}
                                        onChange={(e) => updateCustomTheme({ bgCanvas: e.target.value, bgSidebar: e.target.value })}
                                        className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                    />
                                    <input 
                                        type="text" 
                                        value={currentTheme.bgCanvas}
                                        onChange={(e) => updateCustomTheme({ bgCanvas: e.target.value, bgSidebar: e.target.value })}
                                        placeholder="#090d16"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="pt-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Canvas Swatches:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUICK_CANVAS_SWATCHES.map((swatch) => (
                                            <button
                                                key={swatch.hex}
                                                onClick={() => updateCustomTheme({ bgCanvas: swatch.hex, bgSidebar: swatch.hex })}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all ${
                                                    currentTheme.bgCanvas === swatch.hex
                                                        ? 'border-emerald-400 bg-slate-800 text-white shadow-sm'
                                                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                <div className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: swatch.hex }} />
                                                {swatch.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Card Surface Color */}
                            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                    <span>Module Card Surface</span>
                                    <span className="font-mono text-emerald-400 text-xs">{currentTheme.bgSurface}</span>
                                </label>
                                
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={currentTheme.bgSurface}
                                        onChange={(e) => updateCustomTheme({ bgSurface: e.target.value })}
                                        className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                    />
                                    <input 
                                        type="text" 
                                        value={currentTheme.bgSurface}
                                        onChange={(e) => updateCustomTheme({ bgSurface: e.target.value })}
                                        placeholder="#0f172a"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="pt-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Surface Swatches:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUICK_SURFACE_SWATCHES.map((swatch) => (
                                            <button
                                                key={swatch.hex}
                                                onClick={() => updateCustomTheme({ bgSurface: swatch.hex })}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all ${
                                                    currentTheme.bgSurface === swatch.hex
                                                        ? 'border-emerald-400 bg-slate-800 text-white shadow-sm'
                                                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                <div className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: swatch.hex }} />
                                                {swatch.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Sub-Surface / Inside Module Rows Background */}
                            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3 ring-1 ring-emerald-500/20">
                                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                    <span className="text-emerald-400">Inside Module Boxes & Rows</span>
                                    <span className="font-mono text-emerald-400 text-xs">{currentTheme.bgSubSurface || currentTheme.bgSurface}</span>
                                </label>
                                
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={currentTheme.bgSubSurface || currentTheme.bgSurface}
                                        onChange={(e) => updateCustomTheme({ bgSubSurface: e.target.value })}
                                        className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                    />
                                    <input 
                                        type="text" 
                                        value={currentTheme.bgSubSurface || currentTheme.bgSurface}
                                        onChange={(e) => updateCustomTheme({ bgSubSurface: e.target.value })}
                                        placeholder="#070c18"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="pt-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Inner Box Swatches:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUICK_SUBSURFACE_SWATCHES.map((swatch) => (
                                            <button
                                                key={swatch.hex}
                                                onClick={() => updateCustomTheme({ bgSubSurface: swatch.hex })}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all ${
                                                    currentTheme.bgSubSurface === swatch.hex
                                                        ? 'border-emerald-400 bg-slate-800 text-white shadow-sm'
                                                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                <div className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: swatch.hex }} />
                                                {swatch.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Borders & Action Buttons */}
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                2. Borders, Action Buttons & Accent Highlights
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Border Color */}
                            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                    <span>Card & Divider Borders</span>
                                    <span className="font-mono text-emerald-400 text-xs">{currentTheme.borderColor}</span>
                                </label>
                                
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={currentTheme.borderColor}
                                        onChange={(e) => updateCustomTheme({ borderColor: e.target.value })}
                                        className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                    />
                                    <input 
                                        type="text" 
                                        value={currentTheme.borderColor}
                                        onChange={(e) => updateCustomTheme({ borderColor: e.target.value })}
                                        placeholder="#1e293b"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="pt-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Border Swatches:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUICK_BORDER_SWATCHES.map((swatch) => (
                                            <button
                                                key={swatch.hex}
                                                onClick={() => updateCustomTheme({ borderColor: swatch.hex })}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all ${
                                                    currentTheme.borderColor === swatch.hex
                                                        ? 'border-emerald-400 bg-slate-800 text-white shadow-sm'
                                                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                <div className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: swatch.hex }} />
                                                {swatch.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Primary Button Color */}
                            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                    <span>Primary Button & Action Accent</span>
                                    <span className="font-mono text-emerald-400 text-xs">{currentTheme.accentPrimary}</span>
                                </label>
                                
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={currentTheme.accentPrimary}
                                        onChange={(e) => updateCustomTheme({ accentPrimary: e.target.value, accentPrimaryHover: e.target.value })}
                                        className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                    />
                                    <input 
                                        type="text" 
                                        value={currentTheme.accentPrimary}
                                        onChange={(e) => updateCustomTheme({ accentPrimary: e.target.value, accentPrimaryHover: e.target.value })}
                                        placeholder="#10b981"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="pt-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Button Accents:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUICK_ACCENT_SWATCHES.map((swatch) => (
                                            <button
                                                key={swatch.hex}
                                                onClick={() => updateCustomTheme({ accentPrimary: swatch.hex, accentPrimaryHover: swatch.hover })}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all ${
                                                    currentTheme.accentPrimary === swatch.hex
                                                        ? 'border-emerald-400 bg-slate-800 text-white shadow-sm'
                                                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: swatch.hex }} />
                                                {swatch.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Secondary Highlight & Button Style */}
                            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                    <span>Secondary Accent / Cyan Link</span>
                                    <span className="font-mono text-blue-400 text-xs">{currentTheme.accentSecondary}</span>
                                </label>
                                
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={currentTheme.accentSecondary}
                                        onChange={(e) => updateCustomTheme({ accentSecondary: e.target.value })}
                                        className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                    />
                                    <input 
                                        type="text" 
                                        value={currentTheme.accentSecondary}
                                        onChange={(e) => updateCustomTheme({ accentSecondary: e.target.value })}
                                        placeholder="#3b82f6"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="pt-2 space-y-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Button Corners & Glow:</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {(['rounded-md', 'rounded-xl', 'rounded-2xl', 'rounded-full'] as const).map((rad) => (
                                            <button
                                                key={rad}
                                                onClick={() => updateCustomTheme({ buttonRadius: rad })}
                                                className={`px-2.5 py-1 text-xs font-bold border transition-all ${rad} ${
                                                    currentTheme.buttonRadius === rad
                                                        ? 'bg-emerald-600 text-white border-emerald-500'
                                                        : 'bg-slate-900 text-slate-400 border-slate-800'
                                                }`}
                                            >
                                                {rad.replace('rounded-', '')}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => updateCustomTheme({ buttonGlow: !currentTheme.buttonGlow })}
                                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
                                                currentTheme.buttonGlow
                                                    ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                                                    : 'bg-slate-900 text-slate-500 border-slate-800'
                                            }`}
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            {currentTheme.buttonGlow ? 'Glow' : 'No Glow'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Letter & Typography Colors */}
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Type className="w-4 h-4 text-amber-400" />
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                    3. Letter, Menubar & Options Typography Colors
                                </h3>
                            </div>
                            <button
                                onClick={() => setActiveStudioTab('letters')}
                                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                            >
                                Open Full Typography Studio →
                            </button>
                        </div>
                        <p className="text-xs text-slate-400">
                            Change colors for all letters in the application, menubars, and dropdown options to prevent invisible text on light or dark themes.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* All Letters Universal Color */}
                            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                    <span>All Letters (Universal Override)</span>
                                    <span className="font-mono text-amber-400 text-xs">
                                        {currentTheme.universalLetterColor || 'Auto Theme'}
                                    </span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={currentTheme.universalLetterColor || (currentTheme.isDark ? '#ffffff' : '#000000')}
                                        onChange={(e) => setAllLettersColor(e.target.value)}
                                        className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                    />
                                    <input 
                                        type="text" 
                                        value={currentTheme.universalLetterColor || ''}
                                        onChange={(e) => setAllLettersColor(e.target.value)}
                                        placeholder="Auto (theme default)"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 pt-1">
                                    <button
                                        onClick={() => setAllLettersColor('#ffffff')}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white"
                                    >
                                        Pure White
                                    </button>
                                    <button
                                        onClick={() => setAllLettersColor('#000000')}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200"
                                    >
                                        Black
                                    </button>
                                    <button
                                        onClick={() => setAllLettersColor(null)}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>

                            {/* Menubar Letter Color */}
                            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                    <span>Menubars & Navigation Letters</span>
                                    <span className="font-mono text-emerald-400 text-xs">
                                        {currentTheme.menubarLetterColor || currentTheme.universalLetterColor || 'Auto'}
                                    </span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={currentTheme.menubarLetterColor || currentTheme.universalLetterColor || (currentTheme.isDark ? '#ffffff' : '#000000')}
                                        onChange={(e) => setMenubarLetterColor(e.target.value)}
                                        className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                    />
                                    <input 
                                        type="text" 
                                        value={currentTheme.menubarLetterColor || ''}
                                        onChange={(e) => setMenubarLetterColor(e.target.value)}
                                        placeholder="Auto (inherits)"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 pt-1">
                                    <button
                                        onClick={() => setMenubarLetterColor('#ffffff')}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white"
                                    >
                                        Pure White
                                    </button>
                                    <button
                                        onClick={() => setMenubarLetterColor('#fbbf24')}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-amber-400"
                                    >
                                        Amber
                                    </button>
                                    <button
                                        onClick={() => setMenubarLetterColor(null)}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400"
                                    >
                                        Inherit
                                    </button>
                                </div>
                            </div>

                            {/* Dropdown Options Letter Color */}
                            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                    <span>Dropdown Menus & Options Letters</span>
                                    <span className="font-mono text-blue-400 text-xs">
                                        {currentTheme.optionsLetterColor || currentTheme.universalLetterColor || 'Auto'}
                                    </span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={currentTheme.optionsLetterColor || currentTheme.universalLetterColor || (currentTheme.isDark ? '#ffffff' : '#000000')}
                                        onChange={(e) => setOptionsLetterColor(e.target.value)}
                                        className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                    />
                                    <input 
                                        type="text" 
                                        value={currentTheme.optionsLetterColor || ''}
                                        onChange={(e) => setOptionsLetterColor(e.target.value)}
                                        placeholder="Auto (inherits)"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 pt-1">
                                    <button
                                        onClick={() => setOptionsLetterColor('#ffffff')}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white"
                                    >
                                        Pure White
                                    </button>
                                    <button
                                        onClick={() => setOptionsLetterColor('#38bdf8')}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-cyan-400"
                                    >
                                        Cyan
                                    </button>
                                    <button
                                        onClick={() => setOptionsLetterColor(null)}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400"
                                    >
                                        Inherit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: LETTER & MENUBAR COLORS */}
            {activeStudioTab === 'letters' && (
                <LetterColorStudio />
            )}

            {/* TAB 3: LIGHTING & UNDERGLOW (NEW CONTROLS AS REQUESTED BY USER) */}
            {activeStudioTab === 'lighting' && (
                <div className="space-y-8 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <SunMedium className="w-4 h-4 text-amber-400" />
                                Button Underglow & Standing Lighting Controls
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Customize the light cast beneath buttons, navigation items, and modules when standing on or hovering them.
                            </p>
                        </div>

                        {/* Master Toggle */}
                        <button
                            onClick={() => updateCustomTheme({ underglowEnabled: !isUnderglowEnabled })}
                            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border standing-light standing-beam ${
                                isUnderglowEnabled
                                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20 underglow-box-active active'
                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                        >
                            <Lightbulb className={`w-4 h-4 ${isUnderglowEnabled ? 'text-white animate-pulse' : 'text-slate-500'}`} />
                            <span>Standing Light: {isUnderglowEnabled ? 'Enabled' : 'Disabled'}</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Lighting Color Picker */}
                        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                    Light Beam Color
                                </span>
                                <span className="font-mono text-emerald-400 text-xs">{activeColor}</span>
                            </label>
                            
                            <div className="flex items-center gap-3">
                                <input 
                                    type="color" 
                                    value={activeColor}
                                    onChange={(e) => updateCustomTheme({ 
                                        underglowColorMode: 'custom', 
                                        underglowCustomColor: e.target.value 
                                    })}
                                    className="w-12 h-10 rounded-xl cursor-pointer bg-transparent border border-slate-700"
                                />
                                <input 
                                    type="text" 
                                    value={activeColor}
                                    onChange={(e) => updateCustomTheme({ 
                                        underglowColorMode: 'custom', 
                                        underglowCustomColor: e.target.value 
                                    })}
                                    placeholder="#38bdf8"
                                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="pt-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Preset Lighting Colors:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {QUICK_LIGHTING_COLORS.map((item) => (
                                        <button
                                            key={item.name}
                                            onClick={() => updateCustomTheme({ 
                                                underglowColorMode: item.mode,
                                                underglowCustomColor: item.hex
                                            })}
                                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border flex items-center gap-1.5 transition-all standing-light ${
                                                currentTheme.underglowColorMode === item.mode
                                                    ? 'border-emerald-400 bg-slate-800 text-white shadow-sm'
                                                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: item.hex }} />
                                            {item.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Intensity & Floor Light Toggle */}
                        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-300 block mb-2">Beam Intensity Level</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {INTENSITY_LEVELS.map((level) => (
                                        <button
                                            key={level.id}
                                            onClick={() => updateCustomTheme({ underglowIntensity: level.id })}
                                            className={`p-2 rounded-xl text-left border transition-all ${
                                                currentTheme.underglowIntensity === level.id
                                                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-sm'
                                                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            <div className="text-xs font-bold">{level.label}</div>
                                            <div className="text-[9px] text-slate-500 truncate">{level.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800/80">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-white block">Floor Beam Projection</span>
                                        <span className="text-[10px] text-slate-400">Renders radial floor light cast underneath buttons</span>
                                    </div>
                                    <button
                                        onClick={() => updateCustomTheme({ underglowFloorLight: !(currentTheme.underglowFloorLight !== false) })}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                                            currentTheme.underglowFloorLight !== false
                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-inner'
                                                : 'bg-slate-900 text-slate-500 border-slate-800'
                                        }`}
                                    >
                                        {currentTheme.underglowFloorLight !== false ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Blur & Spread Parameters */}
                        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-slate-300">Glow Blur Radius</label>
                                    <span className="font-mono text-xs font-bold text-emerald-400">{currentTheme.underglowBlur ?? 22}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="4" 
                                    max="40" 
                                    step="2"
                                    value={currentTheme.underglowBlur ?? 22}
                                    onChange={(e) => updateCustomTheme({ underglowBlur: parseInt(e.target.value, 10) })}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                                    <span>Tight (4px)</span>
                                    <span>Medium (22px)</span>
                                    <span>Diffuse Aurora (40px)</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800/80">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-slate-300">Glow Spread Expansion</label>
                                    <span className="font-mono text-xs font-bold text-emerald-400">{currentTheme.underglowSpread ?? 6}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="20" 
                                    step="1"
                                    value={currentTheme.underglowSpread ?? 6}
                                    onChange={(e) => updateCustomTheme({ underglowSpread: parseInt(e.target.value, 10) })}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quick Lighting Test Deck */}
                    <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                <MousePointerClick className="w-4 h-4 text-emerald-400" />
                                Interactive Standing-Light Test Deck (Hover & Active States)
                            </h4>
                            <span className="text-[10px] text-slate-400">Hover over any button below to test underglow response</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold standing-light standing-beam transition-all hover:border-emerald-500/50">
                                Navigation Item Test
                            </button>
                            <button className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wider standing-light standing-beam transition-all shadow-md active:scale-95" data-active="true">
                                Active State (Always Lit)
                            </button>
                            <button className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold standing-light standing-beam transition-all">
                                Action Secondary
                            </button>
                            <button className="px-5 py-2.5 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold standing-light standing-beam transition-all">
                                Purple Pill
                            </button>
                            <button className="px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold standing-light standing-beam transition-all">
                                Amber Warning
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: EXPORT / IMPORT */}
            {activeStudioTab === 'export' && (
                <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">
                        Export & Developer Tools
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                            <h4 className="text-sm font-black text-white flex items-center gap-2">
                                <Copy className="w-4 h-4 text-emerald-400" />
                                Copy Tailwind CSS Variables
                            </h4>
                            <p className="text-xs text-slate-400">
                                Export root CSS variables for developer integration or custom stylesheets.
                            </p>
                            <button
                                onClick={handleCopyCssVars}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 transition-all"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copy :root Variables
                            </button>
                        </div>

                        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
                            <h4 className="text-sm font-black text-white flex items-center gap-2">
                                <Download className="w-4 h-4 text-emerald-400" />
                                Export / Import Theme JSON
                            </h4>
                            <p className="text-xs text-slate-400">
                                Download this theme preset to disk or load an existing configuration.
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleExportJson}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-950/40"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Download JSON
                                </button>
                                <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all">
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Import JSON</span>
                                    <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThemeColorStudio;
