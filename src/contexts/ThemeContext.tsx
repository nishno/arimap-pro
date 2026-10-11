import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UnderglowIntensity = 'subtle' | 'medium' | 'vibrant' | 'neon_beam' | 'cyber_floor';
export type UnderglowColorMode = 'accent' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'white' | 'custom';
export type AllLettersColorMode = 'auto' | 'custom' | 'force_white' | 'force_black' | 'high_contrast_amber' | 'high_contrast_cyan' | 'high_contrast_emerald';
export type TextHaloMode = 'none' | 'subtle_dark' | 'subtle_light' | 'outline' | 'glow';
export type LetterWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'black';

export interface AppThemeConfig {
    id: string;
    name: string;
    description: string;
    isDark: boolean;
    bgCanvas: string;
    bgSurface: string;
    bgSubSurface: string;
    bgSidebar: string;
    bgHeader: string;
    textPrimary: string;
    textSecondary: string;
    borderColor: string;
    accentPrimary: string;
    accentPrimaryHover: string;
    accentSecondary: string;
    buttonRadius: 'rounded-md' | 'rounded-xl' | 'rounded-2xl' | 'rounded-full';
    buttonGlow: boolean;
    fontFamily: 'inter' | 'sans' | 'mono' | 'serif';
    // Underglow & Floor-Light Interactive System
    underglowEnabled?: boolean;
    underglowIntensity?: UnderglowIntensity;
    underglowColorMode?: UnderglowColorMode;
    underglowCustomColor?: string;
    underglowBlur?: number; // 4px to 40px
    underglowSpread?: number; // 0px to 25px
    underglowFloorLight?: boolean; // Radial floor reflection flare beneath buttons
    underglowTargets?: {
        sidebar: boolean;
        header: boolean;
        labsTabs: boolean;
        subTabs: boolean;
        actionButtons: boolean;
        mobileNav: boolean;
    };
    // All Letters & Typography Color Controls (Fixes letter visibility on white or dark themes)
    allLettersColorMode?: AllLettersColorMode;
    universalLetterColor?: string; // One color applied to ALL letters in the application
    forceAllLettersOverride?: boolean; // When true, forcefully overrides all text classes with !important
    menubarLetterColor?: string; // Dedicated letter color for menubars and headers
    optionsLetterColor?: string; // Dedicated letter color for dropdown options, selects, popup menus
    buttonLetterColor?: string; // Dedicated letter color for buttons and badges
    textHaloMode?: TextHaloMode; // Shadow/halo to prevent letters vanishing on conflicting backgrounds
    letterWeight?: LetterWeight; // Weight booster (normal, medium, semibold, bold, black)
    autoContrastGuard?: boolean; // Smart contrast protector
}

export const QUICK_LETTER_SWATCHES = [
    { name: 'High-Contrast Pure White', hex: '#ffffff', desc: 'Guaranteed 100% visibility on dark themes & dark menubars' },
    { name: 'High-Contrast Pitch Black', hex: '#000000', desc: 'Maximum contrast on white & light backgrounds' },
    { name: 'Solar Neon Amber', hex: '#fbbf24', desc: 'High visibility across all white, dark and colored menus' },
    { name: 'Electric Cyan Glow', hex: '#38bdf8', desc: 'Bright ice cyan high-tech contrast' },
    { name: 'Bio Neon Emerald', hex: '#34d399', desc: 'Crisp agricultural neon emerald' },
    { name: 'Hyper Violet Pink', hex: '#c084fc', desc: 'High-luminance purple' },
    { name: 'Signal Coral Rose', hex: '#fb7185', desc: 'Crisp high-alert warm rose' },
    { name: 'Bright Pearl Slate', hex: '#f1f5f9', desc: 'Soft high-readability off-white' },
    { name: 'Deep Midnight Charcoal', hex: '#0f172a', desc: 'Rich deep charcoal black' },
    { name: 'Luminous Solar Yellow', hex: '#facc15', desc: 'Maximum eye-catching contrast' }
];

export const THEME_PRESETS: AppThemeConfig[] = [
    {
        id: 'classic_light',
        name: 'Classic Clean Light (Original - As in Screenshot)',
        description: 'Original high-visibility daytime light mode with crystal-clear text across all fields and pop-up windows',
        isDark: false,
        bgCanvas: '#f3f4f6',
        bgSurface: '#ffffff',
        bgSubSurface: '#f8fafc',
        bgSidebar: '#ffffff',
        bgHeader: '#ffffff',
        textPrimary: '#0f172a',
        textSecondary: '#64748b',
        borderColor: '#e2e8f0',
        accentPrimary: '#16a34a',
        accentPrimaryHover: '#15803d',
        accentSecondary: '#0284c7',
        buttonRadius: 'rounded-xl',
        buttonGlow: false,
        fontFamily: 'inter',
        underglowEnabled: false,
        underglowIntensity: 'subtle',
        underglowColorMode: 'accent',
        underglowCustomColor: '#16a34a',
        underglowBlur: 14,
        underglowSpread: 2,
        underglowFloorLight: false,
        underglowTargets: {
            sidebar: false,
            header: false,
            labsTabs: false,
            subTabs: false,
            actionButtons: false,
            mobileNav: false
        },
        universalLetterColor: undefined,
        menubarLetterColor: undefined,
        optionsLetterColor: undefined,
        buttonLetterColor: undefined,
        textHaloMode: 'none',
        letterWeight: 'normal',
        forceAllLettersOverride: false
    },
    {
        id: 'obsidian_architecture',
        name: 'Obsidian Architecture Dark',
        description: 'Exact dark palette matching the Manual Architecture & AI Guide from the screenshot',
        isDark: true,
        bgCanvas: '#090d16',
        bgSurface: '#0f172a',
        bgSubSurface: '#070c18',
        bgSidebar: '#0b1120',
        bgHeader: '#0d1527',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        borderColor: '#1e293b',
        accentPrimary: '#10b981',
        accentPrimaryHover: '#059669',
        accentSecondary: '#3b82f6',
        buttonRadius: 'rounded-xl',
        buttonGlow: true,
        fontFamily: 'inter',
        underglowEnabled: true,
        underglowIntensity: 'vibrant',
        underglowColorMode: 'cyan',
        underglowCustomColor: '#38bdf8',
        underglowBlur: 22,
        underglowSpread: 6,
        underglowFloorLight: true,
        underglowTargets: {
            sidebar: true,
            header: true,
            labsTabs: true,
            subTabs: true,
            actionButtons: true,
            mobileNav: true
        }
    },
    {
        id: 'cyber_emerald',
        name: 'Cyber Ag-Tech Emerald',
        description: 'Deep agricultural stealth black with neon bio-emerald accents',
        isDark: true,
        bgCanvas: '#050f0b',
        bgSurface: '#081a14',
        bgSubSurface: '#030a07',
        bgSidebar: '#040d09',
        bgHeader: '#061510',
        textPrimary: '#ecfdf5',
        textSecondary: '#6ee7b7',
        borderColor: '#064e3b',
        accentPrimary: '#10b981',
        accentPrimaryHover: '#059669',
        accentSecondary: '#14b8a6',
        buttonRadius: 'rounded-xl',
        buttonGlow: true,
        fontFamily: 'inter',
        underglowEnabled: true,
        underglowIntensity: 'neon_beam',
        underglowColorMode: 'emerald',
        underglowCustomColor: '#10b981',
        underglowBlur: 24,
        underglowSpread: 8,
        underglowFloorLight: true,
        underglowTargets: {
            sidebar: true,
            header: true,
            labsTabs: true,
            subTabs: true,
            actionButtons: true,
            mobileNav: true
        }
    },
    {
        id: 'midnight_navy',
        name: 'Midnight Navy Studio',
        description: 'Deep oceanic slate navy with high-tech electric cyan and blue controls',
        isDark: true,
        bgCanvas: '#070c18',
        bgSurface: '#0d1629',
        bgSubSurface: '#050a14',
        bgSidebar: '#060a14',
        bgHeader: '#0a1222',
        textPrimary: '#f0f9ff',
        textSecondary: '#7dd3fc',
        borderColor: '#1e293b',
        accentPrimary: '#3b82f6',
        accentPrimaryHover: '#2563eb',
        accentSecondary: '#06b6d4',
        buttonRadius: 'rounded-xl',
        buttonGlow: true,
        fontFamily: 'inter',
        underglowEnabled: true,
        underglowIntensity: 'vibrant',
        underglowColorMode: 'cyan',
        underglowCustomColor: '#38bdf8',
        underglowBlur: 20,
        underglowSpread: 6,
        underglowFloorLight: true,
        underglowTargets: {
            sidebar: true,
            header: true,
            labsTabs: true,
            subTabs: true,
            actionButtons: true,
            mobileNav: true
        }
    },
    {
        id: 'carbon_oled',
        name: 'Carbon OLED Stealth',
        description: 'Pure high-contrast pitch carbon with amber and gold cybernetic accents',
        isDark: true,
        bgCanvas: '#050507',
        bgSurface: '#0f1015',
        bgSubSurface: '#08080a',
        bgSidebar: '#08080a',
        bgHeader: '#0a0b0f',
        textPrimary: '#ffffff',
        textSecondary: '#a1a1aa',
        borderColor: '#27272a',
        accentPrimary: '#f59e0b',
        accentPrimaryHover: '#d97706',
        accentSecondary: '#e11d48',
        buttonRadius: 'rounded-xl',
        buttonGlow: true,
        fontFamily: 'inter',
        underglowEnabled: true,
        underglowIntensity: 'neon_beam',
        underglowColorMode: 'amber',
        underglowCustomColor: '#f59e0b',
        underglowBlur: 26,
        underglowSpread: 8,
        underglowFloorLight: true,
        underglowTargets: {
            sidebar: true,
            header: true,
            labsTabs: true,
            subTabs: true,
            actionButtons: true,
            mobileNav: true
        }
    },
    {
        id: 'synthwave_purple',
        name: 'Synthwave Matrix Purple',
        description: 'Deep royal ultraviolet with vibrant electric violet highlights',
        isDark: true,
        bgCanvas: '#0d0718',
        bgSurface: '#160d26',
        bgSubSurface: '#0a0513',
        bgSidebar: '#0a0513',
        bgHeader: '#120b20',
        textPrimary: '#faf5ff',
        textSecondary: '#d8b4fe',
        borderColor: '#3b0764',
        accentPrimary: '#8b5cf6',
        accentPrimaryHover: '#7c3aed',
        accentSecondary: '#ec4899',
        buttonRadius: 'rounded-xl',
        buttonGlow: true,
        fontFamily: 'inter',
        underglowEnabled: true,
        underglowIntensity: 'vibrant',
        underglowColorMode: 'violet',
        underglowCustomColor: '#a855f7',
        underglowBlur: 24,
        underglowSpread: 7,
        underglowFloorLight: true,
        underglowTargets: {
            sidebar: true,
            header: true,
            labsTabs: true,
            subTabs: true,
            actionButtons: true,
            mobileNav: true
        }
    }
];

const STORAGE_KEY = 'agrimap_theme_config';

interface ThemeContextType {
    currentTheme: AppThemeConfig;
    isDark: boolean;
    setThemePreset: (presetId: string) => void;
    updateCustomTheme: (partial: Partial<AppThemeConfig>) => void;
    resetToDefault: () => void;
    toggleDarkLight: () => void;
    resolvedUnderglowColor: string;
    // Letter & Typography Color Controls (Fixes letter visibility across menubars and options)
    setAllLettersColor: (hex: string | null, mode?: AllLettersColorMode) => void;
    setMenubarLetterColor: (hex: string | null) => void;
    setOptionsLetterColor: (hex: string | null) => void;
    setButtonLetterColor: (hex: string | null) => void;
    setTextHaloMode: (mode: TextHaloMode) => void;
    setLetterWeight: (weight: LetterWeight) => void;
    setForceAllLettersOverride: (force: boolean) => void;
    resetAllLetterColors: () => void;
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    let cleaned = hex.replace('#', '');
    if (cleaned.length === 3) {
        cleaned = cleaned.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleaned, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState<AppThemeConfig>(() => {
        try {
            // Check if user has explicitly saved a theme
            const saved = localStorage.getItem(STORAGE_KEY);
            const isLightResetActive = localStorage.getItem('agrimap_clean_light_active');
            if (saved && isLightResetActive) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.bgCanvas && parsed.id !== 'obsidian_architecture') {
                    return {
                        ...THEME_PRESETS[0],
                        ...parsed,
                        underglowTargets: {
                            ...THEME_PRESETS[0].underglowTargets,
                            ...(parsed.underglowTargets || {})
                        }
                    };
                }
            }
        } catch (e) {
            console.error('Failed to load saved theme:', e);
        }
        // Default to the original Classic Clean Light matching the screenshot
        return THEME_PRESETS[0];
    });

    // Helper to resolve the active underglow color
    const getResolvedUnderglowColor = (theme: AppThemeConfig): string => {
        const mode = theme.underglowColorMode || 'cyan';
        switch (mode) {
            case 'cyan': return '#38bdf8';
            case 'emerald': return '#10b981';
            case 'amber': return '#f59e0b';
            case 'violet': return '#a855f7';
            case 'white': return '#ffffff';
            case 'custom': return theme.underglowCustomColor || '#38bdf8';
            case 'accent':
            default:
                return theme.accentPrimary || '#10b981';
        }
    };

    const resolvedUnderglowColor = getResolvedUnderglowColor(currentTheme);

    // Apply CSS variables and dark class to document root
    useEffect(() => {
        const root = document.documentElement;
        
        root.style.setProperty('--bg-canvas', currentTheme.bgCanvas);
        root.style.setProperty('--bg-surface', currentTheme.bgSurface);
        root.style.setProperty('--bg-subsurface', currentTheme.bgSubSurface || currentTheme.bgSurface);
        root.style.setProperty('--bg-sidebar', currentTheme.bgSidebar);
        root.style.setProperty('--bg-header', currentTheme.bgHeader);
        root.style.setProperty('--text-primary', currentTheme.textPrimary);
        root.style.setProperty('--text-secondary', currentTheme.textSecondary);
        root.style.setProperty('--border-color', currentTheme.borderColor);
        root.style.setProperty('--accent-primary', currentTheme.accentPrimary);
        root.style.setProperty('--accent-primary-hover', currentTheme.accentPrimaryHover);
        root.style.setProperty('--accent-secondary', currentTheme.accentSecondary);

        // Letter and Typography CSS Variables
        const effectivePrimaryText = (currentTheme.forceAllLettersOverride && currentTheme.universalLetterColor) 
            ? currentTheme.universalLetterColor 
            : currentTheme.textPrimary;
        const effectiveSecondaryText = (currentTheme.forceAllLettersOverride && currentTheme.universalLetterColor)
            ? currentTheme.universalLetterColor
            : currentTheme.textSecondary;
        const effectiveMenubarText = currentTheme.menubarLetterColor 
            || (currentTheme.forceAllLettersOverride && currentTheme.universalLetterColor ? currentTheme.universalLetterColor : undefined)
            || currentTheme.textPrimary;
        const effectiveOptionsText = currentTheme.optionsLetterColor 
            || (currentTheme.forceAllLettersOverride && currentTheme.universalLetterColor ? currentTheme.universalLetterColor : undefined)
            || currentTheme.textPrimary;
        const effectiveButtonText = currentTheme.buttonLetterColor 
            || (currentTheme.forceAllLettersOverride && currentTheme.universalLetterColor ? currentTheme.universalLetterColor : undefined)
            || '#ffffff';
        const effectiveUniversalText = currentTheme.universalLetterColor || currentTheme.textPrimary;

        root.style.setProperty('--text-primary', effectivePrimaryText);
        root.style.setProperty('--text-main', effectivePrimaryText);
        root.style.setProperty('--text-secondary', effectiveSecondaryText);
        root.style.setProperty('--text-menubar', effectiveMenubarText);
        root.style.setProperty('--text-options', effectiveOptionsText);
        root.style.setProperty('--text-button', effectiveButtonText);
        root.style.setProperty('--text-universal', effectiveUniversalText);

        // Inject high-priority dynamic CSS to guarantee letter colors update across hardcoded classes, menubars, and dropdowns
        const dynamicStyleId = 'agrimap-letter-color-styles';
        let styleTag = document.getElementById(dynamicStyleId) as HTMLStyleElement | null;
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = dynamicStyleId;
            document.head.appendChild(styleTag);
        }

        let dynamicCss = `
            :root {
                --text-primary: ${effectivePrimaryText};
                --text-secondary: ${effectiveSecondaryText};
                --text-menubar: ${effectiveMenubarText};
                --text-options: ${effectiveOptionsText};
                --text-button: ${effectiveButtonText};
                --text-universal: ${effectiveUniversalText};
            }
        `;

        // If universal letter color override is active, force color on all elements and standard Tailwind text classes
        // IMPORTANT: NEVER force white/light colors onto standard form inputs or textareas, so user-typed text is always visible!
        if (currentTheme.forceAllLettersOverride && currentTheme.universalLetterColor) {
            const uColor = currentTheme.universalLetterColor;
            dynamicCss += `
                body, main, header, nav, aside, footer,
                h1, h2, h3, h4, h5, h6,
                p, span, a, label, li, dt, dd,
                button, kbd,
                .text-slate-900, .text-slate-800, .text-slate-700, .text-slate-600, .text-slate-500, .text-slate-400, .text-slate-300, .text-slate-200, .text-slate-100, .text-slate-50,
                .text-gray-900, .text-gray-800, .text-gray-700, .text-gray-600, .text-gray-500, .text-gray-400, .text-gray-300, .text-gray-200, .text-gray-100, .text-gray-50,
                .text-zinc-900, .text-zinc-800, .text-zinc-700, .text-zinc-600, .text-zinc-500, .text-zinc-400, .text-zinc-300, .text-zinc-200, .text-zinc-100,
                .text-neutral-900, .text-neutral-800, .text-neutral-700, .text-neutral-600, .text-neutral-500, .text-neutral-400, .text-neutral-300, .text-neutral-200,
                .text-white, .text-black {
                    color: ${uColor} !important;
                }
            `;
        }

        // Global input visibility safety rule: inputs in white/light containers and modals must ALWAYS have visible dark text, and dark inputs must have light text
        dynamicCss += `
            input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),
            select,
            textarea {
                color: #0f172a;
                -webkit-text-fill-color: #0f172a;
            }
            .dark input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not(.bg-white):not([class*="bg-white"]):not([class*="bg-slate-50"]):not([class*="bg-slate-100"]):not([class*="bg-slate-200"]),
            .dark select:not(.bg-white):not([class*="bg-white"]):not([class*="bg-slate-50"]),
            .dark textarea:not(.bg-white):not([class*="bg-white"]):not([class*="bg-slate-50"]),
            input.bg-slate-900, input.bg-slate-800, input.bg-zinc-900, input.bg-slate-950,
            textarea.bg-slate-900, textarea.bg-slate-800, textarea.bg-zinc-900, textarea.bg-slate-950,
            select.bg-slate-900, select.bg-slate-800, select.bg-zinc-900 {
                color: #f8fafc !important;
                -webkit-text-fill-color: #f8fafc !important;
            }
            select option {
                background-color: #ffffff;
                color: #0f172a;
            }
            .dark select option {
                background-color: #0f172a;
                color: #f8fafc;
            }
        `;

        // Dedicated menubar and header letter color rules
        if (currentTheme.menubarLetterColor || (currentTheme.forceAllLettersOverride && currentTheme.universalLetterColor)) {
            const mColor = currentTheme.menubarLetterColor || currentTheme.universalLetterColor;
            dynamicCss += `
                header, header *:not(svg):not(path):not(circle):not(rect):not(polyline),
                [role="menubar"], [role="menubar"] *:not(svg):not(path):not(circle):not(rect):not(polyline),
                .menubar-item, .menubar-item *:not(svg):not(path):not(circle):not(rect):not(polyline),
                .menubar-text,
                nav[aria-label="top-nav"], nav[aria-label="top-nav"] *:not(svg):not(path):not(circle):not(rect):not(polyline),
                .header-nav-item, .header-nav-item *:not(svg):not(path):not(circle):not(rect):not(polyline) {
                    color: ${mColor} !important;
                }
            `;
        }

        // Dedicated dropdown options, selects, popup menus, and context menus letter color rules
        if (currentTheme.optionsLetterColor || (currentTheme.forceAllLettersOverride && currentTheme.universalLetterColor)) {
            const oColor = currentTheme.optionsLetterColor || currentTheme.universalLetterColor;
            dynamicCss += `
                select, select *, option,
                [role="menu"], [role="menu"] *:not(svg):not(path):not(circle):not(rect):not(polyline),
                [role="menuitem"], [role="menuitem"] *:not(svg):not(path):not(circle):not(rect):not(polyline),
                [role="listbox"], [role="listbox"] *:not(svg):not(path):not(circle):not(rect):not(polyline),
                .options-menu, .options-menu *:not(svg):not(path):not(circle):not(rect):not(polyline),
                .dropdown-content, .dropdown-content *:not(svg):not(path):not(circle):not(rect):not(polyline),
                [data-menu-option], [data-menu-option] *:not(svg):not(path):not(circle):not(rect):not(polyline),
                .context-menu, .context-menu *:not(svg):not(path):not(circle):not(rect):not(polyline) {
                    color: ${oColor} !important;
                }
            `;
        }

        // Text Halo / Contrast Shadow to guarantee visibility on contrasting or conflicting backgrounds
        if (currentTheme.textHaloMode === 'subtle_dark') {
            dynamicCss += `
                body, main, header, nav, button, p, span, h1, h2, h3, h4, h5, h6, label, a, kbd, select, option {
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95), 0 0 1px rgba(0, 0, 0, 0.9) !important;
                }
            `;
        } else if (currentTheme.textHaloMode === 'subtle_light') {
            dynamicCss += `
                body, main, header, nav, button, p, span, h1, h2, h3, h4, h5, h6, label, a, kbd, select, option {
                    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.95), 0 0 1px rgba(255, 255, 255, 0.9) !important;
                }
            `;
        } else if (currentTheme.textHaloMode === 'outline') {
            dynamicCss += `
                body, main, header, nav, button, p, span, h1, h2, h3, h4, h5, h6, label, a, kbd, select, option {
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000 !important;
                }
            `;
        } else if (currentTheme.textHaloMode === 'glow') {
            const glowColor = currentTheme.universalLetterColor || currentTheme.accentPrimary || '#38bdf8';
            dynamicCss += `
                body, main, header, nav, button, p, span, h1, h2, h3, h4, h5, h6, label, a, kbd, select, option {
                    text-shadow: 0 0 6px ${glowColor}, 0 0 12px ${glowColor}66 !important;
                }
            `;
        }

        // Font Weight Booster for maximum legibility of letters on low-contrast screens
        if (currentTheme.letterWeight && currentTheme.letterWeight !== 'normal') {
            const weightVal = currentTheme.letterWeight === 'black' ? '900' :
                currentTheme.letterWeight === 'bold' ? '700' :
                currentTheme.letterWeight === 'semibold' ? '600' : '500';
            dynamicCss += `
                body, main, header, nav, aside, p, span, a, button, label, h1, h2, h3, h4, h5, h6, input, select, option {
                    font-weight: ${weightVal} !important;
                }
            `;
        }

        styleTag.textContent = dynamicCss;

        // Underglow Lighting CSS Variables
        const isEnabled = currentTheme.underglowEnabled !== false;
        const colorHex = getResolvedUnderglowColor(currentTheme);
        const rgb = hexToRgb(colorHex);

        let alphaGlow = 0.65;
        let alphaAmbient = 0.35;
        let alphaBeam = 0.85;

        switch (currentTheme.underglowIntensity) {
            case 'subtle':
                alphaGlow = 0.35;
                alphaAmbient = 0.15;
                alphaBeam = 0.4;
                break;
            case 'medium':
                alphaGlow = 0.55;
                alphaAmbient = 0.25;
                alphaBeam = 0.65;
                break;
            case 'vibrant':
                alphaGlow = 0.75;
                alphaAmbient = 0.4;
                alphaBeam = 0.85;
                break;
            case 'neon_beam':
                alphaGlow = 0.9;
                alphaAmbient = 0.55;
                alphaBeam = 0.95;
                break;
            case 'cyber_floor':
                alphaGlow = 1.0;
                alphaAmbient = 0.65;
                alphaBeam = 1.0;
                break;
        }

        if (!isEnabled) {
            alphaGlow = 0;
            alphaAmbient = 0;
            alphaBeam = 0;
        }

        const blurVal = currentTheme.underglowBlur ?? 22;
        const spreadVal = currentTheme.underglowSpread ?? 6;

        root.style.setProperty('--underglow-raw', colorHex);
        root.style.setProperty('--underglow-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        root.style.setProperty('--underglow-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphaGlow})`);
        root.style.setProperty('--underglow-ambient', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphaAmbient})`);
        root.style.setProperty('--underglow-beam', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphaBeam})`);
        root.style.setProperty('--underglow-blur', `${blurVal}px`);
        root.style.setProperty('--underglow-spread', `${spreadVal}px`);
        root.style.setProperty('--underglow-floor-enabled', (currentTheme.underglowFloorLight !== false && isEnabled) ? '1' : '0');

        if (currentTheme.isDark) {
            root.classList.add('dark');
            document.body.style.backgroundColor = currentTheme.bgCanvas;
            document.body.style.color = currentTheme.textPrimary;
        } else {
            root.classList.remove('dark');
            document.body.style.backgroundColor = currentTheme.bgCanvas;
            document.body.style.color = currentTheme.textPrimary;
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTheme));
        } catch (e) {
            console.error('Failed to persist theme:', e);
        }
    }, [currentTheme]);

    const setThemePreset = (presetId: string) => {
        const found = THEME_PRESETS.find(p => p.id === presetId);
        if (found) {
            setCurrentTheme(found);
        }
    };

    const updateCustomTheme = (partial: Partial<AppThemeConfig>) => {
        setCurrentTheme(prev => ({
            ...prev,
            ...partial,
            id: 'custom',
            name: 'Custom User Theme'
        }));
    };

    const resetToDefault = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('agrimap_custom_theme');
            localStorage.removeItem('agrimap_letter_colors');
            localStorage.setItem('agrimap_clean_light_active', 'true');
        } catch (e) {}

        // Remove the 'dark' class from html document element and body
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');

        // Clean out injected letter color override styles
        const dynamicStyleTag = document.getElementById('agrimap-letter-color-styles');
        if (dynamicStyleTag) {
            dynamicStyleTag.textContent = '';
        }

        // Reset inline body styles to pristine clean light
        document.body.style.backgroundColor = '#f3f4f6';
        document.body.style.color = '#0f172a';

        // Reset theme state to original classic light preset
        setCurrentTheme({
            ...THEME_PRESETS[0],
            universalLetterColor: undefined,
            menubarLetterColor: undefined,
            optionsLetterColor: undefined,
            buttonLetterColor: undefined,
            textHaloMode: 'none',
            letterWeight: 'normal',
            forceAllLettersOverride: false
        });

        // Broadcast reset event for any other subscribers
        try {
            window.dispatchEvent(new CustomEvent('agrimap_theme_reset'));
        } catch (e) {}
    };

    // Expose global reset helper for emergency recovery
    useEffect(() => {
        (window as any).agrimapResetTheme = resetToDefault;
    }, []);

    const toggleDarkLight = () => {
        if (currentTheme.isDark) {
            setThemePreset('classic_light');
        } else {
            setThemePreset('obsidian_architecture');
        }
    };

    const setAllLettersColor = (hex: string | null, mode?: AllLettersColorMode) => {
        if (!hex) {
            updateCustomTheme({
                universalLetterColor: undefined,
                allLettersColorMode: 'auto',
                forceAllLettersOverride: false
            });
            return;
        }
        updateCustomTheme({
            universalLetterColor: hex,
            textPrimary: hex,
            allLettersColorMode: mode || 'custom',
            forceAllLettersOverride: true
        });
    };

    const setMenubarLetterColor = (hex: string | null) => {
        updateCustomTheme({
            menubarLetterColor: hex || undefined
        });
    };

    const setOptionsLetterColor = (hex: string | null) => {
        updateCustomTheme({
            optionsLetterColor: hex || undefined
        });
    };

    const setButtonLetterColor = (hex: string | null) => {
        updateCustomTheme({
            buttonLetterColor: hex || undefined
        });
    };

    const setTextHaloMode = (mode: TextHaloMode) => {
        updateCustomTheme({
            textHaloMode: mode
        });
    };

    const setLetterWeight = (weight: LetterWeight) => {
        updateCustomTheme({
            letterWeight: weight
        });
    };

    const setForceAllLettersOverride = (force: boolean) => {
        updateCustomTheme({
            forceAllLettersOverride: force
        });
    };

    const resetAllLetterColors = () => {
        updateCustomTheme({
            universalLetterColor: undefined,
            allLettersColorMode: 'auto',
            forceAllLettersOverride: false,
            menubarLetterColor: undefined,
            optionsLetterColor: undefined,
            buttonLetterColor: undefined,
            textHaloMode: 'none',
            letterWeight: 'normal',
            textPrimary: currentTheme.isDark ? '#f8fafc' : '#0f172a',
            textSecondary: currentTheme.isDark ? '#94a3b8' : '#475569'
        });
    };

    return (
        <ThemeContext.Provider value={{
            currentTheme,
            isDark: currentTheme.isDark,
            setThemePreset,
            updateCustomTheme,
            resetToDefault,
            toggleDarkLight,
            resolvedUnderglowColor,
            setAllLettersColor,
            setMenubarLetterColor,
            setOptionsLetterColor,
            setButtonLetterColor,
            setTextHaloMode,
            setLetterWeight,
            setForceAllLettersOverride,
            resetAllLetterColors
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useAppTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useAppTheme must be used within a ThemeProvider');
    }
    return context;
};

