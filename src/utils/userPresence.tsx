import React, { useState, useEffect } from 'react';
import { PresenceEngine } from '../../new_engine/PresenceEngine';
import { PresenceUser } from '../../new_engine/types';
import { Users, Eye, CheckCircle2, ShieldCheck } from 'lucide-react';

export interface ActiveUserSession {
    id: string;
    name: string;
    email?: string;
    role?: string;
    avatar?: string;
}

/**
 * Get current active user from session / localStorage / fallback
 */
export function getStoredActiveUser(): ActiveUserSession {
    try {
        const sessionStr = localStorage.getItem('agri-planter-session') 
            || localStorage.getItem('agri-planter-mock-user') 
            || localStorage.getItem('agri-app-user') 
            || localStorage.getItem('user-name');
        
        if (sessionStr) {
            try {
                const parsed = JSON.parse(sessionStr);
                if (typeof parsed === 'object' && parsed !== null) {
                    const name = parsed.name || (parsed.firstName ? `${parsed.firstName} ${parsed.lastName || ''}`.trim() : parsed.email);
                    if (name) {
                        return {
                            id: parsed.id || 'usr_giorgi',
                            name: name,
                            email: parsed.email || 'giorgi.nishno@gmail.com',
                            role: parsed.activeRole || parsed.role || 'Farm Manager',
                            avatar: parsed.avatar
                        };
                    }
                }
            } catch (e) {
                if (typeof sessionStr === 'string' && !sessionStr.startsWith('{')) {
                    return {
                        id: 'usr_giorgi',
                        name: sessionStr,
                        role: 'Farm Manager'
                    };
                }
            }
        }
    } catch (e) {}

    // Primary company user fallback
    return {
        id: 'usr_giorgi',
        name: 'Giorgi Nishnianidze',
        email: 'giorgi.nishno@gmail.com',
        role: 'Farm Manager & Lead Weigher'
    };
}

// Co-worker state stored in localStorage so toggles persist across views
export function getStoredCoWorkerEvent(defaultHarvestId: string): { name: string; eventId: string; isOnline: boolean } {
    try {
        const stored = localStorage.getItem('agri-coworker-state');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {}
    return {
        name: 'მაიზერ ჯიჯეიშვილი',
        eventId: defaultHarvestId,
        isOnline: true
    };
}

export function setStoredCoWorkerEvent(state: { name: string; eventId: string; isOnline: boolean }) {
    try {
        localStorage.setItem('agri-coworker-state', JSON.stringify(state));
    } catch (e) {}
}

/**
 * React hook to manage real-time collaborators & presence for company workers
 */
export function useActiveCollaborators(harvestId: string, activeViewName: string = 'Weigh Station & Audit') {
    const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
    const currentUser = getStoredActiveUser();

    useEffect(() => {
        if (!harvestId) return;

        const engine = PresenceEngine.getInstance();

        // 1. Announce current logged-in user presence
        engine.announcePresence(harvestId, {
            userId: currentUser.id,
            userName: currentUser.name,
            role: currentUser.role,
            activeView: activeViewName,
            avatar: currentUser.avatar,
            color: '#4f46e5'
        });

        // 2. Co-worker (მაიზერ ჯიჯეიშვილი - Maizer Jijeishvili) - Internal Company Worker with Harvest Access
        const coWorkerConfig = getStoredCoWorkerEvent(harvestId);

        if (coWorkerConfig.isOnline) {
            const targetEventId = coWorkerConfig.eventId || harvestId;
            engine.announcePresence(targetEventId, {
                userId: 'usr_maizer',
                userName: coWorkerConfig.name || 'მაიზერ ჯიჯეიშვილი',
                role: 'Weigher / Field Operator',
                activeView: targetEventId === harvestId ? activeViewName : `Working on event ${targetEventId}`,
                color: '#10b981'
            });
        }

        // 3. Subscribe to presence updates for this harvest event
        const sub = engine.subscribePresence(harvestId, (users) => {
            // Filter out any invalid/system users to ensure ONLY company workers appear
            const companyWorkers = users.filter(u => u && u.userName && u.userName !== 'System' && u.userName !== 'Weigher Station');
            setActiveUsers(companyWorkers);
        });

        // 4. Heartbeat
        const heartbeat = setInterval(() => {
            engine.touchPresence(harvestId, currentUser.id, activeViewName);
            if (coWorkerConfig.isOnline) {
                const targetEventId = coWorkerConfig.eventId || harvestId;
                engine.touchPresence(targetEventId, 'usr_maizer', targetEventId === harvestId ? activeViewName : `Working on event ${targetEventId}`);
            }
        }, 10000);

        return () => {
            clearInterval(heartbeat);
            sub.unsubscribe();
        };
    }, [harvestId, activeViewName]);

    return {
        activeUsers,
        currentUser
    };
}

/**
 * UI Component displaying active collaborators / users working on the event
 */
export const ActiveUsersPresenceBar: React.FC<{
    harvestId: string;
    activeViewName?: string;
    className?: string;
    defaultCollapsed?: boolean;
}> = ({ harvestId, activeViewName = 'Live Event Editor', className = '', defaultCollapsed }) => {
    const isKa = localStorage.getItem('agri-app-lang') === 'ka';
    const { activeUsers, currentUser } = useActiveCollaborators(harvestId, activeViewName);
    const [coWorkerState, setCoWorkerState] = useState(() => getStoredCoWorkerEvent(harvestId));
    const [isCollapsed, setIsCollapsed] = useState(() => defaultCollapsed ?? true);

    const handleToggleCoWorkerEvent = (newEventId: string) => {
        const next = { ...coWorkerState, eventId: newEventId, isOnline: true };
        setCoWorkerState(next);
        setStoredCoWorkerEvent(next);
        // Force refresh presence
        const engine = PresenceEngine.getInstance();
        engine.announcePresence(newEventId, {
            userId: 'usr_maizer',
            userName: coWorkerState.name,
            role: 'Weigher / Field Operator',
            activeView: newEventId === harvestId ? activeViewName : `Working on event ${newEventId}`,
            color: '#10b981'
        });
    };

    const safeHarvestId = harvestId || 'default-harvest';
    const isMaizerOnSameEvent = coWorkerState.isOnline && (coWorkerState.eventId === safeHarvestId);
    const isMaizerOnline = coWorkerState.isOnline;

    const displayEventName = safeHarvestId;

    let presenceSummaryText = '';
    const safeUserName = currentUser?.name || 'Manager';
    if (isMaizerOnline && isMaizerOnSameEvent) {
        presenceSummaryText = isKa
            ? `2 აქტიური მომხმარებელი: თქვენ და ${coWorkerState.name} მუშაობთ ამ ღონისძიებაზე (${displayEventName})`
            : `2 active online users: You and ${coWorkerState.name} are working on this event (${displayEventName})`;
    } else if (isMaizerOnline && !isMaizerOnSameEvent) {
        presenceSummaryText = isKa
            ? `2 აქტიური მომხმარებელი: თქვენ მუშაობთ ${displayEventName}-ზე, ხოლო ${coWorkerState.name} მუშაობს ღონისძიებაზე ${coWorkerState.eventId}`
            : `2 active users: You (working on ${displayEventName}) and ${coWorkerState.name} (working on event ${coWorkerState.eventId})`;
    } else {
        presenceSummaryText = isKa
            ? `1 აქტიური მომხმარებელი: თქვენ (${safeUserName}) მუშაობთ ღონისძიებაზე ${displayEventName}`
            : `1 active user: You (${safeUserName}) are working on event ${displayEventName}`;
    }

    const activeUsersCount = isMaizerOnline ? 2 : 1;

    if (isCollapsed) {
        return (
            <div className={`flex justify-end ${className}`}>
                <button
                    type="button"
                    onClick={() => setIsCollapsed(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900/95 text-indigo-200 border border-indigo-500/40 text-[11px] font-black flex items-center gap-2 hover:bg-slate-800 transition-all cursor-pointer shadow-md hover:border-indigo-400"
                    title={isKa ? "ონლაინ მომხმარებლების პანელის გამოჩენა" : "Expand active online users panel"}
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Users size={13} className="text-emerald-400" />
                    <span>{isKa ? `აქტიური ონლაინ მომხმარებლები (${activeUsersCount})` : `Active Online Users (${activeUsersCount})`}</span>
                    <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded font-extrabold uppercase">
                        {isKa ? "გახსნა" : "Show"}
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className={`bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 rounded-2xl border border-indigo-500/30 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs ${className}`}>
            <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="relative flex items-center justify-center shrink-0">
                    <span className="absolute inline-flex h-3.5 w-3.5 animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </div>
                <div>
                    <div className="font-extrabold text-indigo-100 text-xs flex items-center gap-1.5 leading-snug">
                        <Users size={15} className="text-emerald-400 shrink-0" />
                        <span>{presenceSummaryText}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                            <ShieldCheck size={12} />
                            {isKa ? 'კომპანიის შიდა თანამშრომლები' : 'Company Staff Access Only'}
                        </span>
                        <span>•</span>
                        <span>{isKa ? 'რეალური დროის კოლაბორაცია' : 'Real-time live presence'}</span>
                    </div>
                </div>
            </div>

            {/* Active User Badges & Co-Worker Simulator Toggle */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
                {/* Current User Badge */}
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl border bg-indigo-600/30 border-indigo-400/50 text-indigo-100 ring-1 ring-indigo-500/40">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white">
                        {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left leading-tight">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-xs">{currentUser.name}</span>
                            <span className="text-[9px] font-bold bg-indigo-500/40 text-indigo-200 px-1 rounded uppercase">
                                {isKa ? 'თქვენ' : 'You'}
                            </span>
                        </div>
                        <span className="text-[9px] font-medium text-slate-300 block">{currentUser.role}</span>
                    </div>
                </div>

                {/* Co-Worker (Maizer Jijeishvili) Badge */}
                {isMaizerOnline && (
                    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all ${
                        isMaizerOnSameEvent 
                            ? 'bg-emerald-950/60 border-emerald-400/60 text-emerald-100 ring-1 ring-emerald-500/30' 
                            : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    }`}>
                        <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white">
                            MJ
                        </div>
                        <div className="text-left leading-tight">
                            <div className="flex items-center gap-1">
                                <span className="font-bold text-xs">{coWorkerState.name}</span>
                                <span className={`text-[9px] font-bold px-1 rounded uppercase ${
                                    isMaizerOnSameEvent ? 'bg-emerald-500/30 text-emerald-300' : 'bg-amber-500/30 text-amber-300'
                                }`}>
                                    {isMaizerOnSameEvent 
                                        ? (isKa ? 'ამ ღონისძიებაზე' : 'Same Event') 
                                        : (isKa ? `ღონისძიებაზე ${coWorkerState.eventId}` : `Event ${coWorkerState.eventId}`)}
                                </span>
                            </div>
                            <span className="text-[9px] font-medium text-slate-300 block">
                                {isKa ? 'აწონვის ოპერატორი' : 'Weigher Operator'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Toggle Controls for Co-Worker Event Testing */}
                <div className="flex items-center gap-1 pl-1 border-l border-slate-700/80">
                    <button
                        type="button"
                        onClick={() => handleToggleCoWorkerEvent(harvestId)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                            isMaizerOnSameEvent
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="Set Maizer working on this exact same harvest event"
                    >
                        {isKa ? 'მაიზერი: ამ ღონისძიებაზე' : 'Maizer: Same Event'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToggleCoWorkerEvent('13.06.2026')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                            coWorkerState.eventId === '13.06.2026'
                                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="Set Maizer working on event 13.06.2026"
                    >
                        {isKa ? 'მაიზერი: 13.06.2026' : 'Maizer: 13.06.2026'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(true)}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all flex items-center gap-1 cursor-pointer"
                        title={isKa ? "პანელის დამალვა" : "Hide panel"}
                    >
                        <span>✕</span>
                        <span>{isKa ? 'დამალვა' : 'Hide'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
