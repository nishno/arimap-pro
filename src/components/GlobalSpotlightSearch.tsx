import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Search, 
    Command, 
    X, 
    Sliders, 
    MapPin, 
    Users, 
    CheckSquare, 
    Package, 
    Building2, 
    Sparkles, 
    Moon, 
    Sun, 
    Palette, 
    Globe, 
    DollarSign, 
    Cloud, 
    Database, 
    Shield, 
    Key, 
    Video, 
    MessageSquare, 
    Folder, 
    Save, 
    BookOpen, 
    Bell, 
    ArrowRight, 
    CornerDownLeft, 
    Zap, 
    FileText, 
    Layers, 
    Activity, 
    Wifi, 
    TrendingUp, 
    Wheat, 
    Sprout, 
    Truck, 
    Cpu, 
    History,
    Mic,
    QrCode,
    Lock,
    Compass,
    Scale,
    Wrench,
    Grid,
    Flame
} from 'lucide-react';
import type { 
    AppMode, 
    PlantationFeature, 
    Employee, 
    WorkAssignment, 
    InventoryItem, 
    Organization, 
    User,
    Machinery
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAppTheme, THEME_PRESETS } from '../contexts/ThemeContext';
import { toast } from 'sonner';

export type SearchCategory = 'all' | 'pages' | 'settings' | 'map' | 'employees' | 'tasks' | 'stock' | 'orgs' | 'actions';

export interface SearchItem {
    id: string;
    title: string;
    subtitle: string;
    category: SearchCategory;
    icon: React.ReactNode;
    badge?: string;
    badgeColor?: string;
    keywords: string[];
    action: () => void;
    shortcut?: string;
}

interface GlobalSpotlightSearchProps {
    isOpen: boolean;
    onClose: () => void;
    appMode: AppMode;
    onSetAppMode: (mode: AppMode) => void;
    currentUser: User | null;
    plantationFeatures?: PlantationFeature[];
    employees?: Employee[];
    workAssignments?: WorkAssignment[];
    inventoryItems?: InventoryItem[];
    harvestEntries?: any[];
    organizations?: Organization[];
    allUsers?: User[];
    machinery?: Machinery[];
    notes?: any[];
    onOpenTicketManager?: () => void;
    onOpenProfile?: () => void;
    onOpenNotifications?: () => void;
    onOpenSaveProject?: () => void;
    onOpenProjects?: () => void;
    onOpenHelp?: () => void;
    onOpenChat?: () => void;
    onOpenMeet?: () => void;
    onOpenLocalServerConfig?: () => void;
    onOpenThemeStudio?: () => void;
    onToggleOffline?: () => void;
    isManualOffline?: boolean;
    onPushToCloud?: () => Promise<void>;
    pendingSyncCount?: number;
    onOpenDataAuditor?: () => void;
    onOpenHomepage?: () => void;
    onSetMapCenter?: (center: [number, number]) => void;
    onSetMapZoom?: (zoom: number) => void;
    onSelectFeatureId?: (id: string) => void;
    onOpenVoiceNotes?: () => void;
    onStartMapDrawShowcase?: (shape: 'polygon' | 'circle' | 'line' | 'point') => void;
}

// Highlight matching search query characters
const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
    const strText = typeof text === 'string' ? text : String(text || '');
    if (!query || !query.trim()) return <>{strText}</>;
    
    const trimmed = query.trim().toLowerCase();
    const index = strText.toLowerCase().indexOf(trimmed);
    
    if (index === -1) {
        // If single letter match across multiple occurrences
        if (trimmed.length === 1) {
            const char = trimmed;
            const parts: React.ReactNode[] = [];
            let lastIdx = 0;
            for (let i = 0; i < strText.length; i++) {
                if (strText[i].toLowerCase() === char) {
                    if (i > lastIdx) parts.push(strText.substring(lastIdx, i));
                    parts.push(
                        <span key={i} className="text-emerald-400 font-black bg-emerald-500/20 px-0.5 rounded">
                            {strText[i]}
                        </span>
                    );
                    lastIdx = i + 1;
                }
            }
            if (lastIdx < strText.length) parts.push(strText.substring(lastIdx));
            return <>{parts}</>;
        }
        return <>{strText}</>;
    }
    
    const before = strText.substring(0, index);
    const match = strText.substring(index, index + trimmed.length);
    const after = strText.substring(index + trimmed.length);
    
    return (
        <>
            {before}
            <span className="text-emerald-400 font-black bg-emerald-500/20 px-0.5 rounded">
                {match}
            </span>
            {after}
        </>
    );
};

export const GlobalSpotlightSearch: React.FC<GlobalSpotlightSearchProps> = ({
    isOpen,
    onClose,
    appMode,
    onSetAppMode,
    currentUser,
    plantationFeatures = [],
    employees = [],
    workAssignments = [],
    inventoryItems = [],
    harvestEntries = [],
    organizations = [],
    allUsers = [],
    machinery = [],
    notes = [],
    onOpenTicketManager,
    onOpenProfile,
    onOpenNotifications,
    onOpenSaveProject,
    onOpenProjects,
    onOpenHelp,
    onOpenChat,
    onOpenMeet,
    onOpenLocalServerConfig,
    onOpenThemeStudio,
    onToggleOffline,
    isManualOffline,
    onPushToCloud,
    pendingSyncCount = 0,
    onOpenDataAuditor,
    onOpenHomepage,
    onSetMapCenter,
    onSetMapZoom,
    onSelectFeatureId,
    onOpenVoiceNotes,
    onStartMapDrawShowcase
}) => {
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [recentSearches, setRecentSearches] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('agrimap-spotlight-recent') || '["Harvesting", "Dark Mode", "Map GIS", "Employees", "Currency"]');
        } catch {
            return ["Harvesting", "Dark Mode", "Map GIS", "Employees", "Currency"];
        }
    });

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const { language, setLanguage, currency, setCurrency, t } = useLanguage();
    const { isDark, currentTheme, setThemePreset, toggleDarkLight } = useAppTheme();

    // Auto-focus input on open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Save recent search
    const recordSearch = (title: string) => {
        try {
            const updated = [title, ...recentSearches.filter(s => s !== title)].slice(0, 8);
            setRecentSearches(updated);
            localStorage.setItem('agrimap-spotlight-recent', JSON.stringify(updated));
        } catch (e) {}
    };

    // Construct Master Search Registry
    const allSearchItems: SearchItem[] = useMemo(() => {
        const items: SearchItem[] = [];

        // -------------------------------------------------------------
        // 1. ALL APPLICATION PAGES & MAIN MODULES
        // -------------------------------------------------------------
        const pages: { mode: AppMode; title: string; subtitle: string; icon: React.ReactNode; keywords: string[] }[] = [
            {
                mode: 'dashboard',
                title: 'Operational Dashboard',
                subtitle: 'Overview KPIs, active field alerts, live weather & operational feed',
                icon: <Activity className="w-4 h-4 text-emerald-400" />,
                keywords: ['home', 'kpi', 'metrics', 'weather', 'summary', 'overview', 'dashboard', 'analytics', 'feed']
            },
            {
                mode: 'design',
                title: 'Map Design & GIS Land Planning',
                subtitle: 'Draw parcels, GPS field polygons, irrigation lines, seedling grids & aerial drone layers',
                icon: <MapPin className="w-4 h-4 text-blue-400" />,
                keywords: ['map', 'gis', 'polygon', 'field', 'parcel', 'draw', 'satellite', 'design', 'cad', 'boundary', 'drone', 'gps']
            },
            {
                mode: 'harvesting',
                title: 'Harvesting, Weighing & Post-Harvest Cold Chain',
                subtitle: 'Berry picking logs, digital scales, fruit sorting, cold storage refrigeration & sales dispatch',
                icon: <Wheat className="w-4 h-4 text-amber-400" />,
                keywords: ['harvest', 'berry', 'fruit', 'picking', 'weight', 'yield', 'scale', 'refrigerator', 'storage', 'sales', 'boxes', 'crates', 'crop']
            },
            {
                mode: 'stock',
                title: 'Stock, Warehouse & Inventory Control',
                subtitle: 'Fertilizers, agrochemicals, seedlings, irrigation parts, machinery stock & supplier reorders',
                icon: <Package className="w-4 h-4 text-indigo-400" />,
                keywords: ['inventory', 'stock', 'warehouse', 'fertilizer', 'pesticide', 'chemical', 'seedling', 'supplies', 'parts', 'reorder', 'purchase']
            },
            {
                mode: 'accounting',
                title: 'Accounting, Payroll & Financial Ledger',
                subtitle: 'Daily worker payroll, picker wages, operational expenses, profit/loss balance & revenue',
                icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
                keywords: ['payroll', 'salary', 'finance', 'ledger', 'accounting', 'money', 'wage', 'rate', 'cost', 'expense', 'income', 'profit', 'balance']
            },
            {
                mode: 'agronomy',
                title: 'Agronomy & AI Crop Protection',
                subtitle: 'Crop disease diagnostics, nutrition planning, soil analysis, spray schedules & NDVI health',
                icon: <Sprout className="w-4 h-4 text-teal-400" />,
                keywords: ['agronomy', 'ai', 'disease', 'spray', 'fertilization', 'soil', 'ph', 'crop', 'health', 'protection', 'nutrition', 'ndvi']
            },
            {
                mode: 'tasks',
                title: 'Tasks, Reminders & Work Orders',
                subtitle: 'Field operations, work assignments, foreman duties, pruning, spraying & daily logs',
                icon: <CheckSquare className="w-4 h-4 text-orange-400" />,
                keywords: ['tasks', 'works', 'assignments', 'todos', 'reminders', 'schedule', 'foreman', 'pruning', 'spray', 'jobs']
            },
            {
                mode: 'system',
                title: 'System Workforce & Fleet Management',
                subtitle: 'Employee directory, daily laborers, machinery fleet, operational logs & role permissions',
                icon: <Users className="w-4 h-4 text-purple-400" />,
                keywords: ['system', 'employees', 'workers', 'fleet', 'tractors', 'machinery', 'staff', 'management', 'workforce', 'roles']
            },
            {
                mode: 'founders',
                title: 'Founders Vault & Plantation Subscriptions',
                subtitle: 'Active plantation tickets, organization registry, multi-farm billing & enterprise licensing',
                icon: <Building2 className="w-4 h-4 text-amber-500" />,
                keywords: ['founders', 'vault', 'plantations', 'ticket', 'subscription', 'license', 'farms', 'enterprise', 'billing']
            },
            {
                mode: 'marketplace',
                title: 'Agro-Marketplace & B2B Trading Hub',
                subtitle: 'Fresh produce trading, wholesale buyers, agrochemical suppliers & equipment listings',
                icon: <TrendingUp className="w-4 h-4 text-rose-400" />,
                keywords: ['marketplace', 'market', 'trade', 'b2b', 'sell', 'buy', 'listings', 'produce', 'buyer', 'seller', 'shop']
            },
            {
                mode: 'tools',
                title: 'GIS Diagnostic Tools & Geocoding',
                subtitle: 'Walk GPS tracking, parcel area calculator, tree density estimator & QR scanner',
                icon: <Compass className="w-4 h-4 text-cyan-400" />,
                keywords: ['tools', 'gps', 'walk', 'distance', 'area', 'qr', 'density', 'calculator', 'diagnostic']
            },
            {
                mode: 'labs',
                title: 'Labs & Theme Color Studio',
                subtitle: 'Customize color palettes, dark/light themes, accent tones, and experimental UI layouts',
                icon: <Palette className="w-4 h-4 text-pink-400" />,
                keywords: ['labs', 'theme', 'color', 'palette', 'studio', 'dark', 'light', 'styling', 'appearance', 'customization']
            },
            {
                mode: 'guide',
                title: 'Help, SOPs & Architecture Guide',
                subtitle: 'Standard Operating Procedures, user manuals, system architecture & video workflows',
                icon: <BookOpen className="w-4 h-4 text-blue-400" />,
                keywords: ['help', 'guide', 'sop', 'manual', 'documentation', 'architecture', 'instructions', 'faq', 'support']
            },
            {
                mode: 'profile',
                title: 'User Profile & Identity KYC',
                subtitle: 'Master identity credentials, security settings, password update & verification badges',
                icon: <Shield className="w-4 h-4 text-emerald-400" />,
                keywords: ['profile', 'user', 'account', 'kyc', 'identity', 'password', 'security', 'email', 'settings']
            },
            {
                mode: 'admin',
                title: 'Administration & Role Security Matrix',
                subtitle: 'Granular role-based access control, security policies & membership manager',
                icon: <Lock className="w-4 h-4 text-red-400" />,
                keywords: ['admin', 'roles', 'permissions', 'security', 'access', 'rbac', 'users', 'privileges']
            },
            {
                mode: 'logs',
                title: 'System Telemetry & Audit Logs',
                subtitle: 'Cloud synchronization traces, system errors, database writes & audit trails',
                icon: <Activity className="w-4 h-4 text-slate-400" />,
                keywords: ['logs', 'audit', 'telemetry', 'trace', 'errors', 'debug', 'history', 'sync']
            },
            {
                mode: 'community',
                title: 'Farmer Community & Agro-Agent Network',
                subtitle: 'Agronomist forum, community discussions, regional knowledge sharing & Q&A',
                icon: <Globe className="w-4 h-4 text-emerald-400" />,
                keywords: ['community', 'forum', 'agents', 'growers', 'chat', 'network', 'discussion']
            }
        ];

        pages.forEach(p => {
            items.push({
                id: `page-${p.mode}`,
                title: p.title,
                subtitle: p.subtitle,
                category: 'pages',
                icon: p.icon,
                badge: 'PAGE',
                badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
                keywords: [...p.keywords, p.title.toLowerCase(), p.subtitle.toLowerCase(), p.mode],
                action: () => {
                    onSetAppMode(p.mode);
                    recordSearch(p.title);
                    toast.success(`Navigated to ${p.title}`);
                    onClose();
                }
            });
        });

        // -------------------------------------------------------------
        // 2. SETTINGS & CONFIGURATION ACTIONS (All accessible by letter)
        // -------------------------------------------------------------
        
        // Dark / Light Theme Toggle
        items.push({
            id: 'setting-toggle-theme',
            title: isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme',
            subtitle: `Currently active: ${currentTheme.name} (${isDark ? 'Dark Mode' : 'Light Mode'})`,
            category: 'settings',
            icon: isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />,
            badge: 'THEME',
            badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
            keywords: ['theme', 'dark', 'light', 'mode', 'color', 'night', 'day', 'appearance', 'background', 'black', 'white'],
            action: () => {
                if (toggleDarkLight) toggleDarkLight();
                recordSearch(isDark ? 'Light Theme' : 'Dark Theme');
                toast.success(isDark ? "Switched to Light Theme" : "Switched to Dark Theme");
                onClose();
            }
        });

        // Theme Presets selection
        THEME_PRESETS.forEach(preset => {
            items.push({
                id: `setting-preset-${preset.id}`,
                title: `Theme Preset: ${preset.name}`,
                subtitle: `Apply ${preset.name} visual style with primary color ${preset.accentPrimary}`,
                category: 'settings',
                icon: <Palette className="w-4 h-4" style={{ color: preset.accentPrimary }} />,
                badge: 'COLOR',
                badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                keywords: ['theme', 'preset', 'color', 'palette', preset.name.toLowerCase(), preset.id, 'style'],
                action: () => {
                    setThemePreset(preset.id);
                    recordSearch(`Theme: ${preset.name}`);
                    toast.success(`Applied ${preset.name} theme preset`);
                    onClose();
                }
            });
        });

        // Language Switcher - English
        items.push({
            id: 'setting-lang-en',
            title: 'Language: English (US)',
            subtitle: `Active UI language is ${language === 'en' ? 'English (Active)' : 'Georgian'}`,
            category: 'settings',
            icon: <Globe className="w-4 h-4 text-blue-400" />,
            badge: 'LANG',
            badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            keywords: ['language', 'english', 'en', 'us', 'translate', 'locale', 'ენები'],
            action: () => {
                setLanguage('en');
                recordSearch('Language: English');
                toast.success("Language switched to English");
                onClose();
            }
        });

        // Language Switcher - Georgian
        items.push({
            id: 'setting-lang-ka',
            title: 'ენა: ქართული (Georgian)',
            subtitle: 'ინტერფეისის გადართვა ქართულ ენაზე',
            category: 'settings',
            icon: <Globe className="w-4 h-4 text-red-400" />,
            badge: 'LANG',
            badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
            keywords: ['language', 'georgian', 'ქართული', 'ენა', 'ka', 'ge', 'translate'],
            action: () => {
                setLanguage('ka');
                recordSearch('Language: Georgian');
                toast.success("ინტერფეისი გადაირთო ქართულ ენაზე");
                onClose();
            }
        });

        // Currency Toggle - USD
        items.push({
            id: 'setting-curr-usd',
            title: 'Currency: US Dollar ($ USD)',
            subtitle: `Active pricing currency: ${currency === 'USD' ? 'USD (Active)' : 'GEL'}`,
            category: 'settings',
            icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
            badge: 'CURRENCY',
            badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            keywords: ['currency', 'usd', 'dollar', 'money', 'price', 'pricing', 'valuta', 'ვალუტა', 'დოლარი'],
            action: () => {
                setCurrency('USD');
                recordSearch('Currency: USD');
                toast.success("Active currency set to USD ($)");
                onClose();
            }
        });

        // Currency Toggle - GEL
        items.push({
            id: 'setting-curr-gel',
            title: 'Currency: Georgian Lari (₾ GEL)',
            subtitle: `Active pricing currency: ${currency === 'GEL' ? 'GEL (Active)' : 'USD'}`,
            category: 'settings',
            icon: <span className="font-bold text-sm text-emerald-400">₾</span>,
            badge: 'CURRENCY',
            badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            keywords: ['currency', 'gel', 'lari', 'lari', 'ლარი', 'money', 'price', 'pricing', 'valuta', 'ვალუტა'],
            action: () => {
                setCurrency('GEL');
                recordSearch('Currency: GEL');
                toast.success("Active currency set to Georgian Lari (₾)");
                onClose();
            }
        });

        // Offline / Online Mode Toggle
        if (onToggleOffline) {
            items.push({
                id: 'setting-offline-toggle',
                title: isManualOffline ? 'Switch to Online Cloud Sync Mode' : 'Switch to Offline Local Mode',
                subtitle: isManualOffline ? 'Currently running strictly offline locally' : 'Currently synced in real-time with Firebase Cloud',
                category: 'settings',
                icon: isManualOffline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <Cloud className="w-4 h-4 text-amber-400" />,
                badge: 'SYNC',
                badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                keywords: ['offline', 'online', 'sync', 'cloud', 'local', 'network', 'connection', 'internet', 'disconnect', 'reconnect'],
                action: () => {
                    onToggleOffline();
                    recordSearch('Offline/Online Mode');
                    onClose();
                }
            });
        }

        // Push to Cloud
        if (onPushToCloud) {
            items.push({
                id: 'setting-push-cloud',
                title: `Push Queued Changes to Cloud (${pendingSyncCount} pending)`,
                subtitle: 'Force upload all local modifications to Firebase Firestore backend',
                category: 'settings',
                icon: <Cloud className="w-4 h-4 text-blue-400" />,
                badge: 'SYNC',
                badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                keywords: ['push', 'sync', 'upload', 'cloud', 'pending', 'firebase', 'firestore', 'save', 'commit'],
                action: async () => {
                    recordSearch('Push to Cloud');
                    toast.info("Pushing pending records to cloud backend...");
                    await onPushToCloud();
                    onClose();
                }
            });
        }

        // Local Server Private Node Config
        if (onOpenLocalServerConfig) {
            items.push({
                id: 'setting-local-node',
                title: 'Local Private Server Node Configuration',
                subtitle: 'Configure on-premise local gateway, subnet sync & IP bridge',
                category: 'settings',
                icon: <Cpu className="w-4 h-4 text-indigo-400" />,
                badge: 'SERVER',
                badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                keywords: ['local', 'server', 'node', 'ip', 'lan', 'subnet', 'private', 'onpremise', 'network', 'gateway'],
                action: () => {
                    onOpenLocalServerConfig();
                    recordSearch('Local Server Node');
                    onClose();
                }
            });
        }

        // Data State Auditor & Local Storage
        if (onOpenDataAuditor) {
            items.push({
                id: 'setting-data-auditor',
                title: 'Data State Auditor & Cache Usage',
                subtitle: 'Inspect local storage usage (5MB browser limit), integrity & memory telemetry',
                category: 'settings',
                icon: <Database className="w-4 h-4 text-teal-400" />,
                badge: 'STORAGE',
                badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
                keywords: ['storage', 'cache', 'localstorage', 'auditor', 'memory', 'usage', 'cleanup', 'data', 'integrity'],
                action: () => {
                    onOpenDataAuditor();
                    recordSearch('Data State Auditor');
                    onClose();
                }
            });
        }

        // Ticket Manager & Plantation Switcher
        if (onOpenTicketManager) {
            items.push({
                id: 'setting-ticket-manager',
                title: 'Plantation Tickets & Farm Switcher',
                subtitle: 'Switch active farm workspace, join plantations or generate invitation tokens',
                category: 'settings',
                icon: <Building2 className="w-4 h-4 text-emerald-400" />,
                badge: 'WORKSPACE',
                badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                keywords: ['ticket', 'plantation', 'farm', 'switch', 'workspace', 'organization', 'token', 'invite', 'company'],
                action: () => {
                    onOpenTicketManager();
                    recordSearch('Ticket Manager');
                    onClose();
                }
            });
        }

        // Notification Hub
        if (onOpenNotifications) {
            items.push({
                id: 'setting-notifications',
                title: 'Notification Center & Operational Alerts',
                subtitle: 'View weather warnings, harvest notifications, task reminders & system logs',
                category: 'settings',
                icon: <Bell className="w-4 h-4 text-amber-400" />,
                badge: 'ALERTS',
                badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                keywords: ['notifications', 'alerts', 'warnings', 'messages', 'bell', 'unread', 'updates'],
                action: () => {
                    onOpenNotifications();
                    recordSearch('Notifications');
                    onClose();
                }
            });
        }

        // Save Project Backup
        if (onOpenSaveProject) {
            items.push({
                id: 'setting-save-project',
                title: 'Save Project Snapshot & Cloud Backup',
                subtitle: 'Commit all current map polygons, crops, and harvest records into a named snapshot',
                category: 'settings',
                icon: <Save className="w-4 h-4 text-emerald-400" />,
                badge: 'BACKUP',
                badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                keywords: ['save', 'backup', 'export', 'project', 'snapshot', 'commit', 'store'],
                action: () => {
                    onOpenSaveProject();
                    recordSearch('Save Project');
                    onClose();
                }
            });
        }

        // Project Manager (Load Projects)
        if (onOpenProjects) {
            items.push({
                id: 'setting-load-project',
                title: 'Saved Projects & Map Archives',
                subtitle: 'Load previously saved plantation maps, versions and historical land layouts',
                category: 'settings',
                icon: <Folder className="w-4 h-4 text-blue-400" />,
                badge: 'PROJECTS',
                badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                keywords: ['projects', 'load', 'open', 'files', 'versions', 'history', 'archive'],
                action: () => {
                    onOpenProjects();
                    recordSearch('Saved Projects');
                    onClose();
                }
            });
        }

        // Google Meet Video
        if (onOpenMeet) {
            items.push({
                id: 'action-google-meet',
                title: 'Launch Google Meet Video Call Hub',
                subtitle: 'Instant video conference with field managers, agronomists & workers with map sharing',
                category: 'actions',
                icon: <Video className="w-4 h-4 text-blue-400" />,
                badge: 'VIDEO',
                badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                keywords: ['meet', 'google meet', 'video', 'call', 'conference', 'screen share', 'talk'],
                action: () => {
                    onOpenMeet();
                    recordSearch('Google Meet');
                    onClose();
                }
            });
        }

        // Google Chat Workspace
        if (onOpenChat) {
            items.push({
                id: 'action-google-chat',
                title: 'Google Chat Operations Workspace',
                subtitle: 'Team channels, field worker DMs, task dispatch cards & agronomic discussions',
                category: 'actions',
                icon: <MessageSquare className="w-4 h-4 text-emerald-400" />,
                badge: 'CHAT',
                badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                keywords: ['chat', 'google chat', 'message', 'team', 'space', 'dm', 'discussion', 'dispatch'],
                action: () => {
                    onOpenChat();
                    recordSearch('Google Chat');
                    onClose();
                }
            });
        }

        // Live Map Broadcast / Showcase
        if (onStartMapDrawShowcase) {
            items.push({
                id: 'action-live-map-showcase',
                title: 'Start Live Map Drawing Broadcast',
                subtitle: 'Highlight field parcels in real-time and broadcast cards to Google Chat / Meet',
                category: 'actions',
                icon: <Flame className="w-4 h-4 text-amber-500" />,
                badge: 'LIVE GIS',
                badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                keywords: ['live', 'map', 'broadcast', 'draw', 'showcase', 'annotate', 'stream', 'highlight'],
                action: () => {
                    onStartMapDrawShowcase('polygon');
                    recordSearch('Live Map Broadcast');
                    onClose();
                }
            });
        }

        // Voice Notes & Memos
        if (onOpenVoiceNotes) {
            items.push({
                id: 'action-voice-notes',
                title: 'Voice Notes & Audio Memos',
                subtitle: 'Record hands-free spoken field observations with automatic AI transcription',
                category: 'actions',
                icon: <Mic className="w-4 h-4 text-purple-400" />,
                badge: 'VOICE',
                badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                keywords: ['voice', 'audio', 'mic', 'record', 'speech', 'dictate', 'notes', 'memo'],
                action: () => {
                    onOpenVoiceNotes();
                    recordSearch('Voice Notes');
                    onClose();
                }
            });
        }

        // -------------------------------------------------------------
        // 3. GIS MAP FEATURES & PLANTATION PARCELS
        // -------------------------------------------------------------
        if (Array.isArray(plantationFeatures)) {
            plantationFeatures.forEach(feature => {
                if (!feature) return;
                const fid = String(feature.id || Math.random());
                const rawName = feature.name || (feature as any).crop || `Parcel ${fid.slice(0, 6)}`;
                const name = typeof rawName === 'string' ? rawName : String(rawName || 'Parcel');
                const crop = String((feature as any).crop || 'Field Zone');
                const variety = (feature as any).variety ? ` • ${(feature as any).variety}` : '';
                const area = (feature as any).areaHa ? ` • ${Number((feature as any).areaHa).toFixed(2)} Ha` : '';
                const seedlings = (feature as any).seedlingCount ? ` • ${(feature as any).seedlingCount} seedlings` : '';
                const typeStr = feature.type ? String(feature.type).toUpperCase() : 'PARCEL';

                items.push({
                    id: `feature-${fid}`,
                    title: name,
                    subtitle: `${typeStr} • ${crop}${variety}${area}${seedlings}`,
                    category: 'map',
                    icon: <MapPin className="w-4 h-4 text-emerald-400" />,
                    badge: typeStr,
                    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                    keywords: [
                        name.toLowerCase(),
                        crop.toLowerCase(),
                        String((feature as any).variety || '').toLowerCase(),
                        fid.toLowerCase(),
                        'map',
                        'parcel',
                        'polygon',
                        'block',
                        'field',
                        'gis'
                    ].filter(Boolean),
                    action: () => {
                        onSetAppMode('design');
                        if (onSelectFeatureId) onSelectFeatureId(feature.id);
                        
                        // Extract center coordinates if available
                        const coords = (feature as any).geometry || (feature as any).coordinates || (feature as any).points;
                        if (Array.isArray(coords) && coords.length > 0 && onSetMapCenter) {
                            const first = coords[0];
                            if (Array.isArray(first) && first.length >= 2) {
                                onSetMapCenter([first[0], first[1]]);
                                if (onSetMapZoom) onSetMapZoom(16);
                            } else if (typeof first === 'object' && ('lat' in first || 'latitude' in first)) {
                                onSetMapCenter([first.lat || first.latitude, first.lng || first.longitude]);
                                if (onSetMapZoom) onSetMapZoom(16);
                            }
                        }
                        recordSearch(name);
                        toast.success(`Navigated to field parcel: ${name}`);
                        onClose();
                    }
                });
            });
        }

        // -------------------------------------------------------------
        // 4. EMPLOYEES & WORKERS
        // -------------------------------------------------------------
        if (Array.isArray(employees)) {
            employees.forEach(emp => {
                if (!emp) return;
                const empId = String(emp.id || Math.random());
                const empName = String(emp.name || 'Employee');
                const role = String(emp.role || 'Worker');
                const dept = (emp as any).department ? ` (${String((emp as any).department)})` : '';
                const phone = emp.phone ? ` • Tel: ${String(emp.phone)}` : '';
                const email = emp.email ? ` • ${String(emp.email)}` : '';

                items.push({
                    id: `emp-${empId}`,
                    title: empName,
                    subtitle: `${role}${dept}${phone}${email}`,
                    category: 'employees',
                    icon: <Users className="w-4 h-4 text-blue-400" />,
                    badge: role.toUpperCase(),
                    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                    keywords: [
                        empName.toLowerCase(),
                        role.toLowerCase(),
                        String(emp.phone || ''),
                        String(emp.email || '').toLowerCase(),
                        String((emp as any).department || '').toLowerCase(),
                        'employee',
                        'worker',
                        'staff',
                        'laborer',
                        'picker'
                    ].filter(Boolean),
                    action: () => {
                        onSetAppMode('system');
                        recordSearch(empName);
                        toast.success(`Opened details for ${empName}`);
                        onClose();
                    }
                });
            });
        }

        // -------------------------------------------------------------
        // 5. TASKS & WORK ASSIGNMENTS
        // -------------------------------------------------------------
        if (Array.isArray(workAssignments)) {
            workAssignments.forEach(task => {
                if (!task) return;
                const taskId = String(task.id || Math.random());
                const rawName = (task as any)?.workName ?? (task as any)?.title ?? (task as any)?.name ?? 'Field Task';
                const workName = typeof rawName === 'string' ? rawName : (typeof (rawName as any)?.title === 'string' ? (rawName as any).title : String(rawName || 'Field Task'));
                const taskType = String(task.taskType || 'Operation');
                const status = String(task.status || 'pending').toUpperCase();
                const dateStr = task.date ? new Date(task.date).toLocaleDateString() : 'Scheduled';
                const notesStr = task.notes ? ` • ${String(task.notes).slice(0, 40)}` : '';

                items.push({
                    id: `task-${taskId}`,
                    title: workName,
                    subtitle: `${taskType} • Status: ${status} • Date: ${dateStr}${notesStr}`,
                    category: 'tasks',
                    icon: <CheckSquare className="w-4 h-4 text-orange-400" />,
                    badge: status,
                    badgeColor: status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                    keywords: [
                        String(workName || '').toLowerCase(),
                        String(taskType || '').toLowerCase(),
                        String(status || '').toLowerCase(),
                        String(task.notes || '').toLowerCase(),
                        'task',
                        'work',
                        'assignment',
                        'operation',
                        'job'
                    ].filter(Boolean),
                    action: () => {
                        onSetAppMode('tasks');
                        recordSearch(workName);
                        toast.success(`Opened task: ${workName}`);
                        onClose();
                    }
                });
            });
        }

        // -------------------------------------------------------------
        // 6. STOCK & INVENTORY ITEMS
        // -------------------------------------------------------------
        if (Array.isArray(inventoryItems)) {
            inventoryItems.forEach(item => {
                if (!item) return;
                const itemId = String(item.id || Math.random());
                const itemName = String(item.name || 'Inventory Item');
                const cat = String(item.category || 'Stock');
                const stockQty = item.currentStock ?? (item as any).quantity ?? 0;
                const uom = String(item.unitOfMeasure || (item as any).unit || 'units');
                const qty = `${stockQty} ${uom}`;
                const unitCost = item.unitCost ?? (item as any).price;
                const price = unitCost ? ` • $${unitCost}` : '';
                const location = item.location ? ` • Loc: ${String(item.location)}` : '';

                items.push({
                    id: `stock-${itemId}`,
                    title: itemName,
                    subtitle: `Category: ${cat} • In Stock: ${qty}${price}${location}`,
                    category: 'stock',
                    icon: <Package className="w-4 h-4 text-purple-400" />,
                    badge: cat.toUpperCase(),
                    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                    keywords: [
                        itemName.toLowerCase(),
                        cat.toLowerCase(),
                        uom.toLowerCase(),
                        String(item.location || '').toLowerCase(),
                        'stock',
                        'inventory',
                        'warehouse',
                        'item',
                        'fertilizer',
                        'chemical'
                    ].filter(Boolean),
                    action: () => {
                        onSetAppMode('stock');
                        recordSearch(itemName);
                        toast.success(`Opened stock item: ${itemName}`);
                        onClose();
                    }
                });
            });
        }

        // -------------------------------------------------------------
        // 7. ORGANIZATIONS & PLANTATIONS
        // -------------------------------------------------------------
        if (Array.isArray(organizations)) {
            organizations.forEach(org => {
                if (!org) return;
                const orgId = String(org.id || Math.random());
                const orgName = String(org.name || 'Farm');
                const agri = String(org.agricultureType || 'General Agriculture');
                const region = String(org.region || org.country || 'Global');
                const tax = org.taxNumber ? ` • TAX: ${String(org.taxNumber)}` : '';

                items.push({
                    id: `org-${orgId}`,
                    title: orgName,
                    subtitle: `${agri} • ${region}${tax}`,
                    category: 'orgs',
                    icon: <Building2 className="w-4 h-4 text-amber-400" />,
                    badge: 'FARM',
                    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                    keywords: [
                        orgName.toLowerCase(),
                        String(org.legalName || '').toLowerCase(),
                        agri.toLowerCase(),
                        region.toLowerCase(),
                        String(org.taxNumber || '').toLowerCase(),
                        'organization',
                        'farm',
                        'company',
                        'plantation'
                    ].filter(Boolean),
                    action: () => {
                        if (onOpenTicketManager) onOpenTicketManager();
                        recordSearch(orgName);
                        toast.success(`Selected farm: ${orgName}`);
                        onClose();
                    }
                });
            });
        }

        // -------------------------------------------------------------
        // 8. MACHINERY & FLEET
        // -------------------------------------------------------------
        if (Array.isArray(machinery)) {
            machinery.forEach(mach => {
                if (!mach) return;
                const machId = String(mach.id || Math.random());
                const machName = String(mach.name || 'Machine');
                const status = String(mach.status || 'Active').toUpperCase();
                const typeStr = String(mach.type || 'Equipment');

                items.push({
                    id: `mach-${machId}`,
                    title: machName,
                    subtitle: `${typeStr} • Status: ${status}`,
                    category: 'stock',
                    icon: <Truck className="w-4 h-4 text-cyan-400" />,
                    badge: 'MACHINERY',
                    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                    keywords: [
                        machName.toLowerCase(),
                        typeStr.toLowerCase(),
                        status.toLowerCase(),
                        'tractor',
                        'machinery',
                        'equipment',
                        'fleet',
                        'vehicle'
                    ].filter(Boolean),
                    action: () => {
                        onSetAppMode('system');
                        recordSearch(machName);
                        toast.success(`Opened machine: ${machName}`);
                        onClose();
                    }
                });
            });
        }

        return items;
    }, [
        plantationFeatures,
        employees,
        workAssignments,
        inventoryItems,
        organizations,
        machinery,
        language,
        currency,
        isDark,
        currentTheme,
        isManualOffline,
        pendingSyncCount
    ]);

    // Live Instant Filtering (Works from 1 single letter, Mac/iOS Spotlight style)
    const filteredResults = useMemo(() => {
        const q = query.trim().toLowerCase();
        
        let pool = allSearchItems;
        if (selectedCategory !== 'all') {
            pool = pool.filter(item => item.category === selectedCategory);
        }

        if (!q) {
            // If empty, return pool limited to top relevant recommendations
            return pool.slice(0, 30);
        }

        // Scoring algorithm for character-by-character instant lookup
        const scored = pool.map(item => {
            let score = 0;
            const titleLower = String(item.title || '').toLowerCase();
            const subLower = String(item.subtitle || '').toLowerCase();

            // 1. Exact title match
            if (titleLower === q) score += 1000;
            // 2. Title starts with query
            else if (titleLower.startsWith(q)) score += 500;
            // 3. Word in title starts with query
            else if (titleLower.split(/\s+/).some(w => w.startsWith(q))) score += 300;
            // 4. Substring in title
            else if (titleLower.includes(q)) score += 200;
            // 5. Query matches badge/category
            else if (String(item.category || '').includes(q) || (item.badge && String(item.badge).toLowerCase().includes(q))) score += 150;
            // 6. Keywords match
            else if (Array.isArray(item.keywords) && item.keywords.some(k => typeof k === 'string' && k.startsWith(q))) score += 100;
            else if (Array.isArray(item.keywords) && item.keywords.some(k => typeof k === 'string' && k.includes(q))) score += 50;
            // 7. Subtitle match
            else if (subLower.includes(q)) score += 30;

            return { item, score };
        });

        return scored
            .filter(res => res.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(res => res.item)
            .slice(0, 40);
    }, [allSearchItems, query, selectedCategory]);

    // Keyboard navigation (Arrow Up / Down / Enter / Esc / Tab)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < filteredResults.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredResults.length - 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredResults[selectedIndex]) {
                    filteredResults[selectedIndex].action();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredResults, selectedIndex, onClose]);

    // Keep selected item visible in viewport
    useEffect(() => {
        if (listRef.current) {
            const activeElem = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (activeElem) {
                activeElem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    // Reset index on query change
    useEffect(() => {
        setSelectedIndex(0);
    }, [query, selectedCategory]);

    // Categories list for chips
    const categories: { key: SearchCategory; label: string; count: number }[] = useMemo(() => {
        const getCount = (cat: SearchCategory) => {
            if (cat === 'all') return allSearchItems.length;
            return allSearchItems.filter(i => i.category === cat).length;
        };

        return [
            { key: 'all', label: 'All Items', count: getCount('all') },
            { key: 'pages', label: 'Pages', count: getCount('pages') },
            { key: 'settings', label: 'Settings', count: getCount('settings') },
            { key: 'map', label: 'Map & GIS', count: getCount('map') },
            { key: 'employees', label: 'Team', count: getCount('employees') },
            { key: 'tasks', label: 'Tasks', count: getCount('tasks') },
            { key: 'stock', label: 'Inventory', count: getCount('stock') },
            { key: 'orgs', label: 'Farms', count: getCount('orgs') },
            { key: 'actions', label: 'Actions', count: getCount('actions') }
        ];
    }, [allSearchItems]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-6">
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-all"
                />

                {/* Spotlight Command Modal */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.96, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -20 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="relative w-full max-w-3xl bg-[#0b1222] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[82vh]"
                >
                    {/* Search Input Bar (Mac iOS / Spotlight Bar) */}
                    <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center gap-3.5 relative">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                            <Search className="w-5 h-5 animate-pulse" />
                        </div>

                        <input 
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Type any letter to search pages, settings, parcels, workers, tasks..."
                            className="flex-1 bg-transparent text-white placeholder-slate-400 text-sm sm:text-base font-semibold focus:outline-none tracking-tight"
                        />

                        {query ? (
                            <button 
                                onClick={() => setQuery('')}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        ) : (
                            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-mono font-bold">
                                <span>ESC</span>
                            </div>
                        )}
                    </div>

                    {/* Category Filter Chips */}
                    <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900/50 border-b border-slate-800/80 overflow-x-auto custom-scrollbar-hide flex-nowrap">
                        {categories.map(cat => {
                            const isSelected = selectedCategory === cat.key;
                            return (
                                <button
                                    key={cat.key}
                                    onClick={() => setSelectedCategory(cat.key)}
                                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
                                        isSelected 
                                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30' 
                                            : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    }`}
                                >
                                    <span>{cat.label}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-700/60 text-slate-400'}`}>
                                        {cat.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search Results List */}
                    <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar max-h-[50vh]">
                        {filteredResults.length > 0 ? (
                            filteredResults.map((item, idx) => {
                                const isSelected = idx === selectedIndex;
                                return (
                                    <div
                                        key={item.id}
                                        data-index={idx}
                                        onClick={item.action}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={`p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all border ${
                                            isSelected 
                                                ? 'bg-emerald-600/15 border-emerald-500/40 text-white shadow-md' 
                                                : 'bg-slate-900/40 border-slate-800/50 hover:bg-slate-800/50 text-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                            <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                                                isSelected 
                                                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                            }`}>
                                                {item.icon}
                                            </div>

                                            <div className="flex flex-col min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm truncate text-white">
                                                        <HighlightMatch text={item.title} query={query} />
                                                    </span>
                                                    {item.badge && (
                                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border flex-shrink-0 ${
                                                            item.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'
                                                        }`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                                    <HighlightMatch text={item.subtitle} query={query} />
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {isSelected && (
                                                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                                    <span>Press Enter</span>
                                                    <CornerDownLeft className="w-3 h-3" />
                                                </span>
                                            )}
                                            <ArrowRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-slate-600'}`} />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-12 px-4 text-center">
                                <div className="w-14 h-14 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400 border border-slate-700">
                                    <Search className="w-6 h-6" />
                                </div>
                                <h4 className="text-base font-bold text-white mb-1">No matches found for "{query}"</h4>
                                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                    Try searching by partial word, setting name (e.g. "theme", "currency", "offline"), worker name, or parcel crop.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer Bar with Keyboard Shortcuts & Recent Searches */}
                    <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
                        {recentSearches.length > 0 && !query && (
                            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hide max-w-full">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 flex-shrink-0">
                                    <History className="w-3 h-3 text-slate-500" /> Recent:
                                </span>
                                {recentSearches.map((rec, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setQuery(rec)}
                                        className="text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700 whitespace-nowrap transition-colors"
                                    >
                                        {rec}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 ml-auto flex-shrink-0">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">↑</kbd>
                                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">↓</kbd>
                                <span>Navigate</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">↵</kbd>
                                <span>Select</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">ESC</kbd>
                                <span>Close</span>
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default GlobalSpotlightSearch;
