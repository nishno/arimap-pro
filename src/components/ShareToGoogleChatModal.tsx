import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
    XIcon, ChatBubbleLeftRightIcon, VideoCameraIcon, 
    PlusCircleIcon, SparklesIcon, CheckIcon, RefreshCwIcon,
    ArrowUpCircleIcon, PaperAirplaneIcon, ShieldCheckIcon, UserCircleIcon
} from './Icons';
import { MessageSquare, Users, Video, Link2, ExternalLink, Check, Copy, AlertCircle, Plus } from 'lucide-react';
import { 
    listGoogleChatSpaces, 
    createGoogleChatSpace, 
    sendGoogleChatMessage, 
    createGoogleMeetRoom,
    GoogleChatSpace 
} from '../services/googleChatService';
import { googleSignIn, initGoogleAuth, getAccessToken } from '../firebase';
import type { User } from '../types';

export interface ShareToGoogleChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    moduleName: string;
    itemsSummary: React.ReactNode;
    defaultNote?: string;
    formattedPayload: {
        text: string;
        cardsV2?: any[];
    };
    currentUser?: User | null;
    onSuccess?: () => void;
}

export const ShareToGoogleChatModal: React.FC<ShareToGoogleChatModalProps> = ({
    isOpen,
    onClose,
    title,
    moduleName,
    itemsSummary,
    defaultNote = '',
    formattedPayload,
    currentUser,
    onSuccess
}) => {
    const [spaces, setSpaces] = useState<GoogleChatSpace[]>([]);
    const [selectedSpaceName, setSelectedSpaceName] = useState<string>('');
    const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [customNote, setCustomNote] = useState(defaultNote);
    const [includeMeetLink, setIncludeMeetLink] = useState(false);
    const [meetUrl, setMeetUrl] = useState<string>('');
    const [isGeneratingMeet, setIsGeneratingMeet] = useState(false);
    
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [needsAuth, setNeedsAuth] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // New Space Inline Form
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);
    const [newSpaceName, setNewSpaceName] = useState('');
    const [isCreatingSpaceLoading, setIsCreatingSpaceLoading] = useState(false);

    // Filter spaces
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        
        const unsubscribe = initGoogleAuth(
            (_user, token) => {
                setAccessToken(token);
                setNeedsAuth(false);
                fetchSpaces(token);
            },
            () => {
                setNeedsAuth(true);
            }
        );

        // Also check cached token
        getAccessToken().then(token => {
            if (token) {
                setAccessToken(token);
                setNeedsAuth(false);
                fetchSpaces(token);
            }
        });

        return () => unsubscribe();
    }, [isOpen]);

    const handleGoogleAuth = async () => {
        setIsLoggingIn(true);
        try {
            const res = await googleSignIn();
            if (res && res.accessToken) {
                setAccessToken(res.accessToken);
                setNeedsAuth(false);
                toast.success("Google Workspace authorized successfully!");
                fetchSpaces(res.accessToken);
            }
        } catch (err: any) {
            console.error('Google Sign-in failed:', err);
            toast.error("Google Authorization failed. Please ensure popups are allowed.");
        } finally {
            setIsLoggingIn(false);
        }
    };

    const fetchSpaces = async (token: string) => {
        setIsLoadingSpaces(true);
        try {
            const fetched = await listGoogleChatSpaces(token);
            setSpaces(fetched);
            if (fetched.length > 0 && !selectedSpaceName) {
                setSelectedSpaceName(fetched[0].name);
            }
        } catch (err: any) {
            console.error('Fetch spaces error:', err);
            if (err.message === 'AUTH_EXPIRED' || err.message === 'PERMISSION_DENIED') {
                setNeedsAuth(true);
            } else {
                toast.error("Could not load Google Chat spaces. You can create a new space below.");
            }
        } finally {
            setIsLoadingSpaces(false);
        }
    };

    const handleToggleMeet = async () => {
        if (!includeMeetLink) {
            if (!accessToken) {
                toast.error("Please connect Google Workspace first.");
                return;
            }
            setIsGeneratingMeet(true);
            try {
                const meet = await createGoogleMeetRoom(accessToken);
                if (meet.meetingUri) {
                    setMeetUrl(meet.meetingUri);
                    setIncludeMeetLink(true);
                    toast.success("Google Meet room generated!");
                }
            } catch (err: any) {
                toast.error("Failed to generate Google Meet room.");
            } finally {
                setIsGeneratingMeet(false);
            }
        } else {
            setIncludeMeetLink(false);
            setMeetUrl('');
        }
    };

    const handleCreateNewSpace = async () => {
        if (!newSpaceName.trim()) {
            toast.error("Please enter a name for the new space.");
            return;
        }
        if (!accessToken) {
            toast.error("Please connect your Google Workspace account first.");
            return;
        }

        setIsCreatingSpaceLoading(true);
        try {
            const created = await createGoogleChatSpace(accessToken, newSpaceName.trim());
            toast.success(`Space "${newSpaceName}" created!`);
            setSpaces(prev => [created, ...prev]);
            setSelectedSpaceName(created.name);
            setNewSpaceName('');
            setIsCreatingSpace(false);
        } catch (err: any) {
            toast.error("Failed to create new space.");
        } finally {
            setIsCreatingSpaceLoading(false);
        }
    };

    const handleSend = async () => {
        if (!selectedSpaceName) {
            toast.error("Please select a Google Chat Space.");
            return;
        }
        if (!accessToken) {
            toast.error("Please authorize Google Workspace first.");
            return;
        }

        setIsSending(true);
        try {
            // Build the final text
            let finalNote = customNote.trim();
            let fullText = formattedPayload.text;

            if (finalNote && !fullText.includes(finalNote)) {
                fullText = `💬 *Note:* "${finalNote}"\n\n` + fullText;
            }
            if (includeMeetLink && meetUrl && !fullText.includes(meetUrl)) {
                fullText = `📹 *Google Meet Call:* ${meetUrl}\n\n` + fullText;
            }

            await sendGoogleChatMessage(accessToken, selectedSpaceName, {
                text: fullText,
                cardsV2: formattedPayload.cardsV2
            });

            toast.success(`Successfully dispatched to Google Chat!`, {
                description: `Shared to selected space with live deep links.`
            });

            onSuccess?.();
            onClose();
        } catch (err: any) {
            console.error('Send error:', err);
            toast.error("Failed to send message to Google Chat. Please check permissions.");
        } finally {
            setIsSending(false);
        }
    };

    const filteredSpaces = spaces.filter(s => {
        const name = s.displayName || s.name;
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[8000] flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
            <div 
                className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 md:p-8 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex justify-between items-start relative overflow-hidden">
                    <div className="relative z-10 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                                Google Workspace
                            </span>
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                • {moduleName}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase">{title}</h2>
                        <p className="text-xs text-slate-300 font-medium">Post rich operational cards, task lists & video links directly to Google Chat spaces</p>
                    </div>

                    <button 
                        onClick={onClose}
                        className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors relative z-10"
                    >
                        <XIcon size={20} />
                    </button>
                    
                    <MessageSquare className="absolute -right-6 -bottom-6 w-36 h-36 text-white/5 rotate-12 pointer-events-none" />
                </div>

                {/* Content */}
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-grow">
                    {/* Auth Banner if needed */}
                    {needsAuth ? (
                        <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-indigo-950 uppercase tracking-tight">Connect Google Workspace</h4>
                                    <p className="text-xs text-indigo-700 mt-0.5">Authorize access to your Google Chat Spaces and Google Meet calling.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleGoogleAuth}
                                disabled={isLoggingIn}
                                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95 whitespace-nowrap"
                            >
                                {isLoggingIn ? <RefreshCwIcon size={14} className="animate-spin" /> : <ShieldCheckIcon size={16} />}
                                <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/70 rounded-2xl">
                            <div className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold text-slate-700">Google Workspace Connected</span>
                            </div>
                            <button
                                onClick={() => accessToken && fetchSpaces(accessToken)}
                                disabled={isLoadingSpaces}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-wider"
                            >
                                <RefreshCwIcon size={12} className={isLoadingSpaces ? 'animate-spin' : ''} />
                                Refresh Spaces
                            </button>
                        </div>
                    )}

                    {/* Summary of Items being shared */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Content to Share</label>
                        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                            {itemsSummary}
                        </div>
                    </div>

                    {/* Space Selector & Space Creation */}
                    {!needsAuth && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Target Google Chat Space ({spaces.length})
                                </label>
                                <button
                                    onClick={() => setIsCreatingSpace(!isCreatingSpace)}
                                    className="text-[11px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                >
                                    <Plus size={14} /> New Space
                                </button>
                            </div>

                            {/* Create Space Inline */}
                            {isCreatingSpace && (
                                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 animate-in slide-in-from-top duration-200">
                                    <h4 className="text-xs font-black uppercase tracking-tight text-emerald-950">Create New Google Chat Space</h4>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newSpaceName}
                                            onChange={e => setNewSpaceName(e.target.value)}
                                            placeholder="e.g. Harvesting Brigade, Agronomy Ops..."
                                            className="flex-1 px-4 py-2.5 bg-white border border-emerald-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <button
                                            onClick={handleCreateNewSpace}
                                            disabled={isCreatingSpaceLoading}
                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5 transition-all"
                                        >
                                            {isCreatingSpaceLoading ? <RefreshCwIcon size={14} className="animate-spin" /> : <Check size={14} />}
                                            Create
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isLoadingSpaces ? (
                                <div className="p-6 text-center text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                    <RefreshCwIcon size={16} className="animate-spin text-indigo-500" />
                                    Loading your Google Chat spaces...
                                </div>
                            ) : spaces.length === 0 ? (
                                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
                                    <p className="text-xs font-bold text-slate-500">No Google Chat spaces found in your Google Workspace account.</p>
                                    <button
                                        onClick={() => setIsCreatingSpace(true)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2"
                                    >
                                        <Plus size={14} /> Create Your First Space
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {spaces.length > 5 && (
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Filter spaces..."
                                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white"
                                        />
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-44 overflow-y-auto pr-1">
                                        {filteredSpaces.map(space => {
                                            const isSelected = selectedSpaceName === space.name;
                                            const label = space.displayName || space.name.replace('spaces/', 'Space #');
                                            return (
                                                <button
                                                    key={space.name}
                                                    type="button"
                                                    onClick={() => setSelectedSpaceName(space.name)}
                                                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 ${
                                                        isSelected 
                                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm ring-2 ring-emerald-500/20' 
                                                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                            <MessageSquare size={16} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold truncate">{label}</p>
                                                            <p className="text-[10px] text-slate-400 uppercase font-medium">{space.type || 'Space'}</p>
                                                        </div>
                                                    </div>
                                                    {isSelected && <Check size={16} className="text-emerald-600 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Custom Note Input */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Add Agronomist / Manager Note (Optional)
                        </label>
                        <textarea
                            value={customNote}
                            onChange={e => setCustomNote(e.target.value)}
                            placeholder="Add urgent instructions, questions for the brigade, or context..."
                            className="w-full h-20 bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Google Meet Video Call Option */}
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                <VideoCameraIcon size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-blue-950 uppercase tracking-tight">Attach Instant Google Meet</p>
                                <p className="text-[10px] font-medium text-blue-700">Allow team to join a 1-click video call to discuss these items</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleToggleMeet}
                            disabled={isGeneratingMeet}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                includeMeetLink 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-100'
                            }`}
                        >
                            {isGeneratingMeet ? <RefreshCwIcon size={12} className="animate-spin" /> : <Video size={14} />}
                            <span>{includeMeetLink ? 'Meet Attached' : '+ Add Meet'}</span>
                        </button>
                    </div>

                    {includeMeetLink && meetUrl && (
                        <div className="p-3 bg-white border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 font-mono">
                            <span className="truncate">{meetUrl}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(meetUrl);
                                    toast.success("Meeting link copied!");
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg shrink-0 ml-2"
                                title="Copy Meet Link"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSend}
                            disabled={isSending || !selectedSpaceName || needsAuth}
                            className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-emerald-200 transition-all active:scale-95"
                        >
                            {isSending ? (
                                <>
                                    <RefreshCwIcon size={16} className="animate-spin" />
                                    <span>Dispatching...</span>
                                </>
                            ) : (
                                <>
                                    <PaperAirplaneIcon size={16} />
                                    <span>Dispatch to Google Chat</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareToGoogleChatModal;
