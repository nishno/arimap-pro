import React, { useState, useEffect } from 'react';
import { 
    X, Maximize2, Minimize2, MessageSquare, Radio, 
    ShieldCheck, Sparkles, ExternalLink 
} from 'lucide-react';
import { TeamHubManager, TeamHubManagerProps } from './TeamHubManager';
import { useLanguage } from '../contexts/LanguageContext';

export interface IntercomPopUpModalProps extends Omit<TeamHubManagerProps, 'isPopUp'> {
    isOpen: boolean;
    onClose: () => void;
}

export const IntercomPopUpModal: React.FC<IntercomPopUpModalProps> = ({
    isOpen,
    onClose,
    currentUser,
    forumPosts,
    onAddPost,
    onAddReply,
    onUpdatePost,
    allUsers = [],
    memberships = [],
    onSetMemberships,
    activeOrgId = null,
    employees = [],
    onSetEmployees,
    users = [],
    onSetUsers,
    roles = [],
    plantationFeatures = [],
    mapProps
}) => {
    const { t } = useLanguage();
    const [isMaximized, setIsMaximized] = useState(false);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            id="intercom-popup-backdrop"
            className="fixed inset-0 z-[9500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
            onClick={(e) => {
                if ((e.target as HTMLElement).id === 'intercom-popup-backdrop') {
                    onClose();
                }
            }}
        >
            <div 
                className={`bg-white rounded-3xl md:rounded-[2.5rem] shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden transition-all duration-200 ${
                    isMaximized 
                        ? 'w-full h-full max-w-none rounded-none' 
                        : 'w-full max-w-5xl h-[88vh] max-h-[820px]'
                }`}
            >
                {/* Pop-up Window Header */}
                <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between select-none shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30 flex items-center justify-center shrink-0">
                            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate">
                                    Intercom Communications Terminal
                                </h3>
                                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                    Live Wave
                                </span>
                            </div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block truncate">
                                Direct Dispatch & Team Intercom Frequency
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsMaximized(prev => !prev)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer"
                            title={isMaximized ? "Restore Size" : "Maximize Fullscreen"}
                        >
                            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                            title="Close Intercom Pop-up"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Pop-up Window Body: Full Intercom Chat */}
                <div className="flex-1 min-h-0 bg-slate-50/50 flex flex-col overflow-hidden">
                    <TeamHubManager
                        currentUser={currentUser}
                        forumPosts={forumPosts}
                        onAddPost={onAddPost}
                        onAddReply={onAddReply}
                        onUpdatePost={onUpdatePost}
                        allUsers={allUsers}
                        memberships={memberships}
                        onSetMemberships={onSetMemberships}
                        activeOrgId={activeOrgId}
                        employees={employees}
                        onSetEmployees={onSetEmployees}
                        users={users}
                        onSetUsers={onSetUsers}
                        roles={roles}
                        plantationFeatures={plantationFeatures}
                        mapProps={mapProps}
                        isPopUp={true}
                        onClose={onClose}
                    />
                </div>
            </div>
        </div>
    );
};
