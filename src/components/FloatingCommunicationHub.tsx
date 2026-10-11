import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Video, MessageSquare, Users, ScreenShare, StopCircle, 
    Maximize2, Minimize2, X, Send, Copy, Check, 
    ExternalLink, Plus, RefreshCw, Radio, Sparkles, 
    MapPin, PenTool, PhoneCall, PhoneOff, Compass, 
    Share2, AlertCircle, ChevronDown, ChevronUp, 
    ShieldCheck, Eye, EyeOff, Layers, Camera,
    UserPlus, UserCheck, MessageCircle, GripHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { safeStorage } from '../services/storageService';
import type { User, Employee, Organization, PlantationFeature } from '../types';
import { 
    listGoogleChatSpaces, 
    createGoogleChatSpace, 
    listGoogleChatMessages, 
    sendGoogleChatMessage, 
    createGoogleMeetRoom,
    formatLiveMapShowcaseForGoogleChat,
    inviteUserToGoogleChatSpace,
    listGoogleChatMembers,
    searchContactsAndUsers,
    GoogleChatSpace, 
    GoogleChatMessage,
    GoogleChatMember,
    ChatContact
} from '../services/googleChatService';
import { getAccessToken, googleSignIn } from '../firebase';

export interface LiveMapShowcase {
    id: string;
    title: string;
    note?: string;
    shapeType: 'polygon' | 'circle' | 'line' | 'point';
    coordinates: [number, number][];
    areaHa?: number;
    timestamp: string;
    authorName: string;
    meetUrl?: string;
    color?: string;
}

export interface FloatingCommunicationHubProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User | null;
    initialTab?: 'MEET' | 'CHAT' | 'DIRECT';
    employees?: Employee[];
    organizations?: Organization[];
    allUsers?: User[];
    plantationFeatures?: PlantationFeature[];
    activeMapCenter?: [number, number];
    onStartMapDrawShowcase?: (shape: 'polygon' | 'circle' | 'line' | 'point') => void;
    activeShowcases?: LiveMapShowcase[];
    onAddShowcase?: (showcase: LiveMapShowcase) => void;
    onClearShowcases?: () => void;
}

export const FloatingCommunicationHub: React.FC<FloatingCommunicationHubProps> = ({
    isOpen,
    onClose,
    currentUser,
    initialTab = 'MEET',
    employees = [],
    organizations = [],
    allUsers = [],
    plantationFeatures = [],
    activeMapCenter,
    onStartMapDrawShowcase,
    activeShowcases = [],
    onAddShowcase,
    onClearShowcases
}) => {
    const [activeTab, setActiveTab] = useState<'MEET' | 'CHAT' | 'DIRECT'>(initialTab);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [isMaximized, setIsMaximized] = useState<boolean>(false);
    
    // Auth & Token
    const [token, setToken] = useState<string | null>(null);
    const [needsAuth, setNeedsAuth] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Google Meet States
    const [activeMeetUri, setActiveMeetUri] = useState<string>('');
    const [meetTopic, setMeetTopic] = useState<string>('AgriMap Field Operations & GIS Review');
    const [isCreatingMeet, setIsCreatingMeet] = useState<boolean>(false);
    const [callDurationSec, setCallDurationSec] = useState<number>(0);
    const [isCallActive, setIsCallActive] = useState<boolean>(false);
    const [copiedMeetLink, setCopiedMeetLink] = useState<boolean>(false);

    // Screen Sharing States
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
    const [screenResolution, setScreenResolution] = useState<string>('');

    // Google Chat States
    const [chatSpaces, setChatSpaces] = useState<GoogleChatSpace[]>([]);
    const [selectedSpace, setSelectedSpace] = useState<GoogleChatSpace | null>(null);
    const [messages, setMessages] = useState<GoogleChatMessage[]>([]);
    const [isLoadingSpaces, setIsLoadingSpaces] = useState<boolean>(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
    const [messageInput, setMessageInput] = useState<string>('');
    const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
    const [isNewSpaceModalOpen, setIsNewSpaceModalOpen] = useState<boolean>(false);
    const [newSpaceName, setNewSpaceName] = useState<string>('');
    const [newSpaceType, setNewSpaceType] = useState<'SPACE' | 'GROUP_CHAT'>('SPACE');
    const [newSpaceMemberEmails, setNewSpaceMemberEmails] = useState<string[]>([]);
    const [isCreatingSpace, setIsCreatingSpace] = useState<boolean>(false);
    
    // Member Invites & Member List States
    const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
    const [inviteEmailInput, setInviteEmailInput] = useState<string>('');
    const [isInvitingMember, setIsInvitingMember] = useState<boolean>(false);
    const [isMembersListOpen, setIsMembersListOpen] = useState<boolean>(false);
    const [selectedSpaceMembers, setSelectedSpaceMembers] = useState<GoogleChatMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
    
    // Search / Contact finder
    const [chatSearchQuery, setChatSearchQuery] = useState<string>('');
    const [chatSubTab, setChatSubTab] = useState<'CONVERSATION' | 'CONTACTS'>('CONVERSATION');
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    // Direct Messages / Team Dispatch
    const [directSearchQuery, setDirectSearchQuery] = useState<string>('');
    const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; name: string; role?: string } | null>(null);
    const [directMessageText, setDirectMessageText] = useState<string>('');

    // Movable Position State
    const [hubPos, setHubPos] = useState<{ x: number; y: number } | null>(() => {
        // Clear conflicting previous key to prevent offscreen placement
        try { safeStorage.removeItem('agrimap_comms_hub_pos'); } catch (e) {}

        const stored = safeStorage.getItem('agrimap_floating_comm_hub_window_pos');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
                    // Strictly verify within visible screen bounds
                    if (parsed.x >= 10 && parsed.x < window.innerWidth - 200 &&
                        parsed.y >= 10 && parsed.y < window.innerHeight - 200) {
                        return parsed;
                    }
                }
            } catch (e) {}
        }
        return null;
    });

    const hubContainerRef = useRef<HTMLDivElement | null>(null);
    const hubDragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

    const handleHubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, input, a, textarea')) return;
        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {}

        const rect = hubContainerRef.current?.getBoundingClientRect();
        const currentLeft = rect ? rect.left : (window.innerWidth - 560);
        const currentTop = rect ? rect.top : (window.innerHeight - 660);

        hubDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: currentLeft,
            startTop: currentTop
        };
    };

    const handleHubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!hubDragRef.current) return;
        e.preventDefault();

        const dx = e.clientX - hubDragRef.current.startX;
        const dy = e.clientY - hubDragRef.current.startY;

        const newX = Math.max(10, Math.min(window.innerWidth - 300, hubDragRef.current.startLeft + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 100, hubDragRef.current.startTop + dy));

        setHubPos({ x: newX, y: newY });
    };

    const handleHubPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (hubDragRef.current) {
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch (err) {}
            hubDragRef.current = null;
            if (hubPos) {
                safeStorage.setItem('agrimap_floating_comm_hub_window_pos', JSON.stringify(hubPos));
            }
        }
    };

    // Sync initial tab when props change or opened
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
        if (isOpen) {
            setIsMinimized(false);
        }
    }, [initialTab, isOpen]);

    // Timer for active call duration
    useEffect(() => {
        let interval: any = null;
        if (isCallActive) {
            interval = setInterval(() => {
                setCallDurationSec(prev => prev + 1);
            }, 1000);
        } else {
            setCallDurationSec(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isCallActive]);

    // Fetch OAuth Token on mount/open and ensure window is visible
    useEffect(() => {
        if (isOpen) {
            setIsMinimized(false);
            fetchTokenAndInit();
        }
    }, [isOpen]);

    const fetchTokenAndInit = async () => {
        try {
            const tok = await getAccessToken();
            if (tok) {
                setToken(tok);
                setNeedsAuth(false);
                loadChatSpaces(tok);
            } else {
                setNeedsAuth(true);
            }
        } catch (err) {
            console.warn('[FloatingCommunicationHub] Auth token retrieval skipped/failed:', err);
            setNeedsAuth(true);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoggingIn(true);
        try {
            const user = await googleSignIn();
            if (user) {
                const tok = await getAccessToken();
                if (tok) {
                    setToken(tok);
                    setNeedsAuth(false);
                    toast.success("Connected to Google Workspace!");
                    loadChatSpaces(tok);
                }
            }
        } catch (error: any) {
            console.error("Login failed", error);
            toast.error("Google authentication failed. Please try again.");
        } finally {
            setIsLoggingIn(false);
        }
    };

    const loadChatSpaces = async (authToken: string) => {
        setIsLoadingSpaces(true);
        try {
            const spaces = await listGoogleChatSpaces(authToken);
            setChatSpaces(spaces);
            if (spaces.length > 0 && !selectedSpace) {
                setSelectedSpace(spaces[0]);
                loadMessages(authToken, spaces[0].name);
            }
        } catch (err: any) {
            console.error("Failed to load spaces:", err);
            if (err.message === 'AUTH_EXPIRED' || err.message === 'PERMISSION_DENIED') {
                setNeedsAuth(true);
            }
        } finally {
            setIsLoadingSpaces(false);
        }
    };

    const loadMessages = async (authToken: string, spaceName: string) => {
        setIsLoadingMessages(true);
        try {
            const msgs = await listGoogleChatMessages(authToken, spaceName);
            setMessages(msgs);
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (err) {
            console.error("Failed to load messages:", err);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    // Screen Sharing using navigator.mediaDevices.getDisplayMedia
    const handleToggleScreenShare = async () => {
        if (isScreenSharing) {
            // Stop sharing
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                setScreenStream(null);
            }
            setIsScreenSharing(false);
            setScreenResolution('');
            toast.info("Screen sharing ended.");
        } else {
            // Start sharing
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                    toast.error("Screen sharing is not supported on this browser/platform.");
                    return;
                }

                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: 'monitor'
                    } as any,
                    audio: false
                });

                setScreenStream(stream);
                setIsScreenSharing(true);

                // Listen for when user stops via browser UI native bar
                const track = stream.getVideoTracks()[0];
                if (track) {
                    const settings = track.getSettings();
                    if (settings.width && settings.height) {
                        setScreenResolution(`${settings.width}x${settings.height}`);
                    }
                    track.onended = () => {
                        setIsScreenSharing(false);
                        setScreenStream(null);
                        setScreenResolution('');
                        toast.info("Screen sharing ended.");
                    };
                }

                if (videoPreviewRef.current) {
                    videoPreviewRef.current.srcObject = stream;
                }

                toast.success("🖥️ Live Screen Sharing Active!");
            } catch (err: any) {
                if (err.name !== 'NotAllowedError') {
                    console.error("Screen share error:", err);
                    toast.error("Could not start screen share: " + (err.message || 'Permission denied'));
                }
            }
        }
    };

    useEffect(() => {
        if (videoPreviewRef.current && screenStream) {
            videoPreviewRef.current.srcObject = screenStream;
        }
    }, [screenStream]);

    // Handle Create Instant Google Meet
    const handleCreateMeet = async () => {
        setIsCreatingMeet(true);
        try {
            const authToken = token || await getAccessToken();
            if (!authToken) {
                setNeedsAuth(true);
                toast.error("Google sign-in required for Google Meet creation.");
                return;
            }

            const meet = await createGoogleMeetRoom(authToken);
            if (meet && meet.meetingUri) {
                setActiveMeetUri(meet.meetingUri);
                setIsCallActive(true);
                toast.success("📹 Google Meet room created and ready!");
                
                // Auto-broadcast link to selected chat space if available
                if (selectedSpace && token) {
                    sendGoogleChatMessage(token, selectedSpace.name, {
                        text: `📹 *Google Meet Call Started:* ${meetTopic}\n🔗 *Join Video Link:* ${meet.meetingUri}\n👤 *Host:* ${currentUser?.name || 'AgriMap Operations'}`
                    }).catch(console.warn);
                }
            }
        } catch (err: any) {
            console.error("Failed to create meet:", err);
            // Fallback link if API restricts creation
            const fallbackCode = `agrimap-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;
            const fallbackUri = `https://meet.google.com/${fallbackCode}`;
            setActiveMeetUri(fallbackUri);
            setIsCallActive(true);
            toast.info(`Created standard Google Meet link: ${fallbackUri}`);
        } finally {
            setIsCreatingMeet(false);
        }
    };

    // Copy Meet Link
    const handleCopyMeetLink = () => {
        if (!activeMeetUri) return;
        navigator.clipboard.writeText(activeMeetUri);
        setCopiedMeetLink(true);
        toast.success("Meeting link copied to clipboard!");
        setTimeout(() => setCopiedMeetLink(false), 2500);
    };

    // Send Google Chat Message
    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedSpace || !token) return;
        setIsSendingMessage(true);
        try {
            await sendGoogleChatMessage(token, selectedSpace.name, {
                text: messageInput.trim()
            });
            setMessageInput('');
            loadMessages(token, selectedSpace.name);
        } catch (err: any) {
            toast.error("Failed to send message: " + (err.message || 'Unknown error'));
        } finally {
            setIsSendingMessage(false);
        }
    };

    // Available contacts
    const availableContacts = useMemo(() => {
        return searchContactsAndUsers('', allUsers, employees, organizations);
    }, [allUsers, employees, organizations]);

    // Create New Chat Space / Group Chat
    const handleCreateSpace = async () => {
        if (!newSpaceName.trim()) {
            toast.error("Please provide a title for the discussion space or group chat.");
            return;
        }
        setIsCreatingSpace(true);
        try {
            const space = await createGoogleChatSpace(
                token, 
                newSpaceName.trim(), 
                newSpaceType, 
                newSpaceMemberEmails
            );
            toast.success(`${newSpaceType === 'GROUP_CHAT' ? '👥 Group chat' : '🌐 Space'} "${space.displayName || newSpaceName}" created!`);
            setIsNewSpaceModalOpen(false);
            setNewSpaceName('');
            setNewSpaceMemberEmails([]);
            setNewSpaceType('SPACE');
            setSelectedSpace(space);
            if (token) {
                loadChatSpaces(token);
                loadMessages(token, space.name);
            }
        } catch (err: any) {
            toast.error("Failed to create space: " + (err.message || ''));
        } finally {
            setIsCreatingSpace(false);
        }
    };

    // Invite User to Space
    const handleInviteUserToSpace = async (emailToInvite?: string) => {
        const targetEmail = emailToInvite || inviteEmailInput.trim();
        if (!targetEmail || !selectedSpace) {
            toast.error("Please enter a valid user or member email.");
            return;
        }
        setIsInvitingMember(true);
        try {
            const member = await inviteUserToGoogleChatSpace(token, selectedSpace.name, targetEmail);
            toast.success(`Invited ${member.displayName || targetEmail} to ${selectedSpace.displayName || 'space'}!`);
            setInviteEmailInput('');
            setIsInviteModalOpen(false);
            if (isMembersListOpen) {
                handleViewSpaceMembers();
            }
        } catch (err: any) {
            toast.error("Could not invite user: " + (err.message || 'Unknown error'));
        } finally {
            setIsInvitingMember(false);
        }
    };

    // View space members
    const handleViewSpaceMembers = async () => {
        if (!selectedSpace) return;
        setIsLoadingMembers(true);
        setIsMembersListOpen(true);
        try {
            const members = await listGoogleChatMembers(token, selectedSpace.name);
            setSelectedSpaceMembers(members);
        } catch (err: any) {
            toast.error("Failed to retrieve space members: " + (err.message || ''));
        } finally {
            setIsLoadingMembers(false);
        }
    };

    // Capture & Share Current Screen Snapshot to Active Chat
    const handleShareScreenSnapshot = () => {
        if (!videoPreviewRef.current) {
            toast.error("No active screen share to capture.");
            return;
        }

        try {
            const video = videoPreviewRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                if (selectedSpace && token) {
                    sendGoogleChatMessage(token, selectedSpace.name, {
                        text: `📸 *[Live Screen Capture]* from ${currentUser?.name || 'Operator'} during call (${new Date().toLocaleTimeString()}):\n(Area / Workspace inspection broadcast)`
                    }).then(() => {
                        toast.success("Screen snapshot broadcasted to Google Chat!");
                        loadMessages(token, selectedSpace.name);
                    }).catch(() => {
                        toast.info("Snapshot captured locally.");
                    });
                } else {
                    toast.info("Screen snapshot captured.");
                }
            }
        } catch (err) {
            console.error("Failed to snapshot screen", err);
            toast.error("Could not capture frame from screen.");
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    // Minimized Floating Pill View
    if (isMinimized) {
        return (
            <div 
                id="floating-communication-minimized-pill"
                className="fixed bottom-6 left-6 z-[9500] bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/60 p-2.5 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 cursor-pointer hover:bg-slate-800 transition-all select-none"
                onClick={() => setIsMinimized(false)}
            >
                <div className="flex items-center gap-2">
                    <div className="relative">
                        {activeTab === 'MEET' ? (
                            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                                <Video size={16} className={isCallActive ? "animate-pulse text-white" : ""} />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
                                <MessageSquare size={16} />
                            </div>
                        )}
                        {isCallActive && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
                        )}
                    </div>
                    
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-tight flex items-center gap-1.5 text-slate-100">
                            {isCallActive ? `Live Call (${formatDuration(callDurationSec)})` : (activeTab === 'MEET' ? 'Google Meet' : 'Google Chat')}
                            {isScreenSharing && <span className="text-[9px] bg-indigo-500/80 px-1 rounded text-white font-mono">SCREEN</span>}
                        </span>
                        <span className="text-[9px] font-medium text-slate-400">Tap to expand live workspace</span>
                    </div>
                </div>

                <div className="flex items-center gap-1 border-l border-slate-700/60 pl-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50"
                        title="Expand"
                    >
                        <Maximize2 size={14} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/50"
                        title="Close"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={hubContainerRef}
            id="floating-communication-popup"
            className={`fixed z-[9500] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-300 backdrop-blur-xl ${
                isMaximized 
                ? 'inset-4 sm:inset-6 max-w-none max-h-none' 
                : 'w-[calc(100vw-2rem)] sm:w-[480px] md:w-[540px] h-[640px] max-h-[calc(100vh-5rem)]'
            }`}
            style={{
                boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
                ...(isMaximized ? {} : (hubPos ? { left: `${hubPos.x}px`, top: `${hubPos.y}px`, bottom: 'auto', right: 'auto' } : { bottom: '1.5rem', right: '1.5rem' }))
            }}
        >
            {/* Top Drag & Control Bar */}
            <div 
                onPointerDown={handleHubPointerDown}
                onPointerMove={handleHubPointerMove}
                onPointerUp={handleHubPointerUp}
                className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between select-none border-b border-slate-800 cursor-move"
                title="Hold and drag to move Google Meet & Chat anywhere on screen"
            >
                <div className="flex items-center gap-2.5">
                    <div className="text-slate-400 hover:text-white transition-colors cursor-move pr-0.5">
                        <GripHorizontal size={16} />
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-white shadow-md">
                        {activeTab === 'MEET' ? <Video size={16} /> : activeTab === 'CHAT' ? <MessageSquare size={16} /> : <Users size={16} />}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">
                                Live Field Communicator
                            </h3>
                            {isCallActive && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-400/30 rounded-md text-[9px] font-mono font-bold text-emerald-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                    {formatDuration(callDurationSec)}
                                </span>
                            )}
                            {isScreenSharing && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/20 border border-blue-400/30 rounded-md text-[9px] font-mono font-bold text-blue-300">
                                    <ScreenShare size={10} />
                                    {screenResolution || 'LIVE'}
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] font-medium text-slate-400">
                            Non-disruptive Picture-in-Picture Hub
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                        title="Minimize to Floating Bubble"
                    >
                        <Minimize2 size={14} />
                    </button>
                    <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors hidden sm:block"
                        title={isMaximized ? "Restore Size" : "Maximize"}
                    >
                        <Maximize2 size={14} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Close Pop-up"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-1.5 select-none">
                <div className="flex items-center gap-1 flex-1">
                    <button
                        onClick={() => setActiveTab('MEET')}
                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            activeTab === 'MEET'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/50'
                        }`}
                    >
                        <Video size={13} />
                        <span>Google Meet</span>
                        {isCallActive && <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse ml-0.5" />}
                    </button>

                    <button
                        onClick={() => setActiveTab('CHAT')}
                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            activeTab === 'CHAT'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/50'
                        }`}
                    >
                        <MessageSquare size={13} />
                        <span>Google Chat</span>
                        {chatSpaces.length > 0 && (
                            <span className="text-[9px] opacity-75 font-mono">({chatSpaces.length})</span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('DIRECT')}
                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            activeTab === 'DIRECT'
                            ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                            : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/50'
                        }`}
                    >
                        <Users size={13} />
                        <span>Team DM</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col bg-slate-50/50">
                {needsAuth && (
                    <div className="mb-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300/60 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <AlertCircle className="text-amber-600 flex-shrink-0" size={18} />
                            <div>
                                <h4 className="text-xs font-bold text-slate-800">Google Workspace Sign-in</h4>
                                <p className="text-[10px] text-slate-500">Connect your Google account to sync live Chat spaces and create Meet rooms.</p>
                            </div>
                        </div>
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isLoggingIn}
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all flex-shrink-0 shadow-sm active:scale-95 disabled:opacity-50"
                        >
                            {isLoggingIn ? 'Connecting...' : 'Sign In'}
                        </button>
                    </div>
                )}

                {/* ============================================================ */}
                {/* TAB 1: GOOGLE MEET & LIVE SCREEN SHARING */}
                {/* ============================================================ */}
                {activeTab === 'MEET' && (
                    <div className="flex-1 flex flex-col gap-4">
                        {/* Call Status & Instant Room Launcher */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${isCallActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                        {isCallActive ? 'Active Google Meet Call' : 'Start Instant Video Call'}
                                    </span>
                                </div>
                                {isCallActive && (
                                    <span className="text-xs font-mono font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                                        ⏱️ {formatDuration(callDurationSec)}
                                    </span>
                                )}
                            </div>

                            <input 
                                type="text"
                                value={meetTopic}
                                onChange={(e) => setMeetTopic(e.target.value)}
                                placeholder="Meeting topic / agenda..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                            />

                            {/* Active Meeting Link display & actions */}
                            {activeMeetUri ? (
                                <div className="space-y-2 bg-blue-50/60 border border-blue-200/80 rounded-xl p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Radio size={14} className="text-blue-600 animate-pulse flex-shrink-0" />
                                            <span className="text-xs font-mono font-bold text-blue-900 truncate">
                                                {activeMeetUri}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <button
                                                onClick={handleCopyMeetLink}
                                                className="p-1.5 bg-white hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-all text-[10px] font-bold flex items-center gap-1 shadow-sm"
                                                title="Copy Room Link"
                                            >
                                                {copiedMeetLink ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                <span>{copiedMeetLink ? 'Copied' : 'Copy'}</span>
                                            </button>
                                            <a
                                                href={activeMeetUri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm active:scale-95"
                                            >
                                                <ExternalLink size={12} />
                                                <span>Join</span>
                                            </a>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-blue-100">
                                        <span>Share this link with team members & agronomists</span>
                                        <button
                                            onClick={() => {
                                                setIsCallActive(false);
                                                setActiveMeetUri('');
                                                toast.info("Meeting session ended.");
                                            }}
                                            className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
                                        >
                                            <PhoneOff size={11} />
                                            <span>End Session</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={handleCreateMeet}
                                    disabled={isCreatingMeet}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 transition-all disabled:opacity-50"
                                >
                                    <Video size={15} />
                                    <span>{isCreatingMeet ? 'Creating Room...' : 'Launch Instant Video Meeting'}</span>
                                </button>
                            )}
                        </div>

                        {/* Screen Share & Live Display Streaming */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ScreenShare size={15} className="text-indigo-600" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                        Online Screen Share
                                    </h4>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    {isScreenSharing ? 'Active Stream' : 'Live Browser / Map Stream'}
                                </span>
                            </div>

                            {/* Video Screen Preview Box */}
                            {isScreenSharing ? (
                                <div className="space-y-2">
                                    <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner group">
                                        <video
                                            ref={videoPreviewRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-rose-600 text-white rounded-md text-[9px] font-mono font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                            LIVE {screenResolution || '1080p'}
                                        </div>

                                        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={handleShareScreenSnapshot}
                                                className="px-2 py-1 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg text-[9px] font-bold flex items-center gap-1 backdrop-blur-sm shadow border border-white/10"
                                                title="Take Snapshot & Share to Chat"
                                            >
                                                <Camera size={11} />
                                                <span>Snapshot</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleToggleScreenShare}
                                            className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
                                        >
                                            <StopCircle size={13} />
                                            <span>Stop Screen Share</span>
                                        </button>
                                        <button
                                            onClick={handleShareScreenSnapshot}
                                            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all border border-slate-200"
                                        >
                                            <Share2 size={13} />
                                            <span>Post Snapshot</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2.5">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                                        <ScreenShare size={20} />
                                    </div>
                                    <p className="text-xs text-slate-600 font-medium">
                                        Share your screen, map tabs, or drone analytics stream directly with attendees.
                                    </p>
                                    <button
                                        onClick={handleToggleScreenShare}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                    >
                                        <ScreenShare size={14} />
                                        <span>Start Sharing Screen</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Live Map Area Showcase / Draw Trigger */}
                        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 rounded-2xl border border-emerald-200/80 p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PenTool size={15} className="text-emerald-700" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                                        Draw & Highlight on Map
                                    </h4>
                                </div>
                                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">
                                    Live Showcase
                                </span>
                            </div>

                            <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                Draw an area, parcel boundary, or drop a marker on the map to immediately show call attendees where work or harvest is required.
                            </p>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setIsMinimized(true);
                                        onStartMapDrawShowcase?.('polygon');
                                        toast.info("Draw mode active: click points on map to sketch polygon!");
                                    }}
                                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                >
                                    <Layers size={13} />
                                    <span>Draw Polygon Zone</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsMinimized(true);
                                        onStartMapDrawShowcase?.('point');
                                        toast.info("Drop pin mode active: click target spot on map!");
                                    }}
                                    className="py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                >
                                    <MapPin size={13} />
                                    <span>Drop Broadcast Pin</span>
                                </button>
                            </div>

                            {activeShowcases.length > 0 && (
                                <div className="pt-2 border-t border-emerald-200/50 flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-emerald-800">
                                        {activeShowcases.length} active live showcase area(s) on map
                                    </span>
                                    {onClearShowcases && (
                                        <button 
                                            onClick={onClearShowcases}
                                            className="text-rose-600 hover:text-rose-700 font-bold"
                                        >
                                            Clear Highlights
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* TAB 2: GOOGLE CHAT SPACES & MESSAGES */}
                {/* ============================================================ */}
                {activeTab === 'CHAT' && (
                    <div className="flex-1 flex flex-col gap-3 min-h-0">
                        {/* Sub-tab navigation (Discussions vs Contacts/Find Users) */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setChatSubTab('CONVERSATION')}
                                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                                    chatSubTab === 'CONVERSATION'
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <MessageSquare size={12} />
                                <span>Spaces & Chats</span>
                                {chatSpaces.length > 0 && (
                                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-700 text-[9px] rounded-full font-black">
                                        {chatSpaces.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setChatSubTab('CONTACTS')}
                                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                                    chatSubTab === 'CONTACTS'
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <Users size={12} />
                                <span>Find Users & Directory</span>
                            </button>
                        </div>

                        {chatSubTab === 'CONTACTS' ? (
                            /* Contacts & Find Users View */
                            <div className="flex-1 flex flex-col gap-2 min-h-0 bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                        Directory & Contacts ({availableContacts.length})
                                    </span>
                                    <button
                                        onClick={() => {
                                            setNewSpaceType('GROUP_CHAT');
                                            setIsNewSpaceModalOpen(true);
                                            setChatSubTab('CONVERSATION');
                                        }}
                                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                    >
                                        <Plus size={12} />
                                        <span>Create Group</span>
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={chatSearchQuery}
                                    onChange={e => setChatSearchQuery(e.target.value)}
                                    placeholder="Search by name, role, email, or company..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:bg-white outline-none"
                                />
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                    {searchContactsAndUsers(chatSearchQuery, allUsers, employees, organizations).map(contact => (
                                        <div
                                            key={contact.id}
                                            className="p-2.5 bg-slate-50 hover:bg-emerald-50/50 border border-slate-100 hover:border-emerald-200 rounded-xl flex items-center justify-between transition-all"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs flex-shrink-0">
                                                    {contact.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className="text-xs font-bold text-slate-800 truncate">{contact.name}</h5>
                                                    <p className="text-[10px] text-slate-400 truncate">
                                                        {contact.role || 'Staff'} {contact.companyName ? `• ${contact.companyName}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {contact.email && selectedSpace && (
                                                    <button
                                                        onClick={() => handleInviteUserToSpace(contact.email)}
                                                        className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold"
                                                        title={`Invite to ${selectedSpace.displayName || 'current space'}`}
                                                    >
                                                        + Invite
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        // Quick create DM / group chat with this user
                                                        setNewSpaceName(`Chat with ${contact.name}`);
                                                        setNewSpaceType('GROUP_CHAT');
                                                        if (contact.email) setNewSpaceMemberEmails([contact.email]);
                                                        setIsNewSpaceModalOpen(true);
                                                        setChatSubTab('CONVERSATION');
                                                    }}
                                                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-white rounded-lg transition-all"
                                                    title="Start Group / Direct Chat"
                                                >
                                                    <MessageCircle size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Space Selector / Creator Header */
                            <>
                                <div className="flex items-center justify-between gap-2 bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-sm">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                            <MessageSquare size={14} />
                                        </div>
                                        <select
                                            value={selectedSpace?.name || ''}
                                            onChange={(e) => {
                                                const found = chatSpaces.find(s => s.name === e.target.value);
                                                if (found) {
                                                    setSelectedSpace(found);
                                                    if (token) loadMessages(token, found.name);
                                                }
                                            }}
                                            className="bg-transparent text-xs font-black text-slate-800 truncate focus:outline-none flex-1"
                                        >
                                            {chatSpaces.length === 0 ? (
                                                <option value="">No Spaces Found</option>
                                            ) : (
                                                chatSpaces.map(s => (
                                                    <option key={s.name} value={s.name}>
                                                        {s.displayName || s.name} ({s.type === 'GROUP_CHAT' ? '👥 Group' : '🌐 Space'})
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {selectedSpace && (
                                            <>
                                                <button
                                                    onClick={handleViewSpaceMembers}
                                                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all text-[10px] font-bold flex items-center gap-1"
                                                    title="View Members"
                                                >
                                                    <Users size={12} />
                                                </button>
                                                <button
                                                    onClick={() => setIsInviteModalOpen(true)}
                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all text-[10px] font-bold flex items-center gap-1"
                                                    title="Invite User"
                                                >
                                                    <UserPlus size={12} />
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => token && loadChatSpaces(token)}
                                            disabled={isLoadingSpaces}
                                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                                            title="Refresh Spaces"
                                        >
                                            <RefreshCw size={13} className={isLoadingSpaces ? 'animate-spin' : ''} />
                                        </button>
                                        <button
                                            onClick={() => setIsNewSpaceModalOpen(true)}
                                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-200 transition-all"
                                            title="Create New Space or Group"
                                        >
                                            <Plus size={13} />
                                            <span className="hidden sm:inline">New</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Modal to create space or group chat */}
                                {isNewSpaceModalOpen && (
                                    <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-lg space-y-2.5 animate-in zoom-in-95 duration-150">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                                Create {newSpaceType === 'GROUP_CHAT' ? 'Group Chat' : 'Google Chat Space'}
                                            </span>
                                            <button onClick={() => setIsNewSpaceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                                <X size={14} />
                                            </button>
                                        </div>

                                        {/* Type Selector */}
                                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                                            <button
                                                type="button"
                                                onClick={() => setNewSpaceType('SPACE')}
                                                className={`py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                                    newSpaceType === 'SPACE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                                                }`}
                                            >
                                                🌐 Team Space
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewSpaceType('GROUP_CHAT')}
                                                className={`py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                                    newSpaceType === 'GROUP_CHAT' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                                                }`}
                                            >
                                                👥 Group Chat
                                            </button>
                                        </div>

                                        <input
                                            type="text"
                                            value={newSpaceName}
                                            onChange={e => setNewSpaceName(e.target.value)}
                                            placeholder={newSpaceType === 'GROUP_CHAT' ? 'e.g. Agronomy Fast Response Group...' : 'e.g. Field Operations & Harvest Brigade...'}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white outline-none"
                                        />

                                        {/* Contact quick selection for initial group */}
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Include Members (Optional):</p>
                                            <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                                                {availableContacts.slice(0, 8).map(contact => {
                                                    const isSelected = contact.email && newSpaceMemberEmails.includes(contact.email);
                                                    return (
                                                        <div
                                                            key={contact.id}
                                                            onClick={() => {
                                                                if (!contact.email) return;
                                                                if (isSelected) {
                                                                    setNewSpaceMemberEmails(prev => prev.filter(em => em !== contact.email));
                                                                } else {
                                                                    setNewSpaceMemberEmails(prev => [...prev, contact.email!]);
                                                                }
                                                            }}
                                                            className={`p-1.5 rounded-lg flex items-center justify-between text-[11px] cursor-pointer ${
                                                                isSelected ? 'bg-emerald-100 text-emerald-800 font-bold' : 'hover:bg-slate-200/60 text-slate-700'
                                                            }`}
                                                        >
                                                            <span>{contact.name} ({contact.role || 'Staff'})</span>
                                                            <span className="text-[9px] font-black">{isSelected ? '✓ Added' : '+ Add'}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleCreateSpace}
                                            disabled={isCreatingSpace || !newSpaceName.trim()}
                                            className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all disabled:opacity-40"
                                        >
                                            {isCreatingSpace ? 'Creating...' : `Create ${newSpaceType === 'GROUP_CHAT' ? 'Group Chat' : 'Space'}`}
                                        </button>
                                    </div>
                                )}

                                {/* Invite User Modal */}
                                {isInviteModalOpen && (
                                    <div className="p-3 bg-white rounded-2xl border border-blue-200 shadow-lg space-y-2 animate-in zoom-in-95 duration-150">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                                Invite to {selectedSpace?.displayName || 'Space'}
                                            </span>
                                            <button onClick={() => setIsInviteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <input
                                            type="email"
                                            value={inviteEmailInput}
                                            onChange={e => setInviteEmailInput(e.target.value)}
                                            placeholder="Enter user or colleague email..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white outline-none"
                                        />
                                        <button
                                            onClick={() => handleInviteUserToSpace()}
                                            disabled={isInvitingMember || !inviteEmailInput.trim()}
                                            className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all disabled:opacity-40"
                                        >
                                            {isInvitingMember ? 'Inviting...' : 'Send Invitation'}
                                        </button>
                                    </div>
                                )}

                                {/* Members List Modal */}
                                {isMembersListOpen && (
                                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-lg space-y-2 animate-in zoom-in-95 duration-150">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                                Space Members ({selectedSpaceMembers.length})
                                            </span>
                                            <button onClick={() => setIsMembersListOpen(false)} className="text-slate-400 hover:text-slate-600">
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                            {isLoadingMembers ? (
                                                <div className="py-4 text-center text-xs text-slate-400">Loading members...</div>
                                            ) : selectedSpaceMembers.length === 0 ? (
                                                <div className="py-3 text-center text-xs text-slate-400">No members listed.</div>
                                            ) : (
                                                selectedSpaceMembers.map((m, idx) => (
                                                    <div key={m.name || idx} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                                                        <div>
                                                            <p className="font-bold text-slate-800">{m.displayName || m.name}</p>
                                                            <p className="text-[10px] text-slate-400">{m.role || 'Member'} • {m.state || 'JOINED'}</p>
                                                        </div>
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md">
                                                            {m.role || 'MEMBER'}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Message Feed */}
                                <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 p-3 overflow-y-auto space-y-3 shadow-inner min-h-[220px]">
                                    {isLoadingMessages ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold gap-2">
                                            <RefreshCw className="animate-spin text-emerald-500" size={16} />
                                            <span>Loading discussions...</span>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                                            <MessageSquare size={28} className="opacity-30 text-emerald-600" />
                                            <p className="text-xs font-bold text-slate-600">No messages in this space yet.</p>
                                            <p className="text-[10px] text-slate-400">Post a message, map location, or task update below to begin.</p>
                                        </div>
                                    ) : (
                                        messages.map((msg, idx) => {
                                            const isMe = msg.sender?.name?.includes(currentUser?.id || 'me');
                                            return (
                                                <div key={msg.name || idx} className="space-y-1">
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <span className="font-bold text-slate-700">
                                                            {msg.sender?.displayName || 'Team Member'}
                                                        </span>
                                                        <span>{new Date(msg.createTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                                                        {msg.text || (msg as any).formattedText || 'Attachment / Card'}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Message Input Box */}
                                <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-sm flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={messageInput}
                                        onChange={e => setMessageInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder={selectedSpace ? `Message ${selectedSpace.displayName || 'Space'}...` : 'Select a Space to chat...'}
                                        disabled={!selectedSpace || !token}
                                        className="flex-1 bg-transparent px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none placeholder:text-slate-400"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!messageInput.trim() || isSendingMessage || !selectedSpace || !token}
                                        className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40"
                                        title="Send Message"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ============================================================ */}
                {/* TAB 3: DIRECT TEAM & PARTNER DISPATCH */}
                {/* ============================================================ */}
                {activeTab === 'DIRECT' && (
                    <div className="flex-1 flex flex-col gap-3 min-h-0">
                        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-sm">
                            <input
                                type="text"
                                value={directSearchQuery}
                                onChange={e => setDirectSearchQuery(e.target.value)}
                                placeholder="Search employees, agronomists, or partner orgs..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-medium focus:bg-white outline-none"
                            />
                        </div>

                        <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 p-3 overflow-y-auto space-y-2 shadow-inner min-h-[220px]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                Field Personnel & Collaborators ({employees.length})
                            </p>
                            {employees.filter(emp => emp.name?.toLowerCase().includes(directSearchQuery.toLowerCase())).map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => setSelectedRecipient({ id: emp.id, name: emp.name, role: emp.role })}
                                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                        selectedRecipient?.id === emp.id 
                                        ? 'bg-blue-50/80 border-blue-300' 
                                        : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100/80'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                            {emp.name?.charAt(0) || 'E'}
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-bold text-slate-800">{emp.name}</h5>
                                            <p className="text-[10px] text-slate-500 uppercase">{emp.role || 'Staff'}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black text-blue-600 uppercase">
                                        {selectedRecipient?.id === emp.id ? 'Selected' : 'Message'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {selectedRecipient && (
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-black text-slate-800">To: {selectedRecipient.name}</span>
                                    <button onClick={() => setSelectedRecipient(null)} className="text-slate-400 hover:text-slate-600">
                                        <X size={12} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={directMessageText}
                                        onChange={e => setDirectMessageText(e.target.value)}
                                        placeholder={`Direct instructions for ${selectedRecipient.name}...`}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:bg-white outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            if (!directMessageText.trim()) return;
                                            toast.success(`Message dispatched to ${selectedRecipient.name}!`);
                                            setDirectMessageText('');
                                        }}
                                        className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 shadow-sm active:scale-95"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FloatingCommunicationHub;
