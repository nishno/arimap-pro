import React, { useState, useMemo, useRef, useEffect } from 'react';
import L from 'leaflet';
import { useMapEvents, Marker, MapContainer, TileLayer } from 'react-leaflet';
import { toast } from 'sonner';
import type { User, ForumPost, ForumReply, PlantationFeature, AppMode, MessageAttachment, Employee, Organization, UserRole, Crop } from '../types';
import { isValidCoordinate } from '../types';
import { SparklesIcon, UserGroupIcon, PaperAirplaneIcon, MapPinIcon, 
    ChevronRightIcon, AcademicCapIcon, UserCircleIcon, 
    ChatBubbleLeftRightIcon, PhotoIcon, MicrophoneIcon, 
    PaperClipIcon, HashtagIcon, SearchIcon, XIcon, 
    PlusCircleIcon, MapIcon, BuildingStorefrontIcon, 
    TagIcon, BriefcaseIcon, UsersIcon, ShieldCheckIcon,
    CameraIcon, ShoppingBagIcon, AtSignIcon, VideoCameraIcon,
    RefreshCwIcon
} from './Icons';
import { MessageSquare, Users, Video, Link2, ExternalLink, Check, Copy, AlertCircle, Plus, PhoneCall, Globe, WifiOff, Share2, UserPlus, Mail, UserCheck, MessageCircle, UserSearch } from 'lucide-react';
import MapComponent, { type MapComponentProps } from './MapComponent';
import ResizableDivider from './common/ResizableDivider';
import { safeStorage } from '../services/storageService';
import { initGoogleAuth, googleSignIn, getAccessToken } from '../firebase';
import { 
    listGoogleChatSpaces, 
    createGoogleChatSpace, 
    listGoogleChatMessages, 
    sendGoogleChatMessage, 
    createGoogleMeetRoom,
    inviteUserToGoogleChatSpace,
    listGoogleChatMembers,
    searchContactsAndUsers,
    GoogleChatSpace, 
    GoogleChatMessage,
    GoogleChatMember,
    ChatContact 
} from '../services/googleChatService';

interface CommunicationHubPanelProps {
    currentUser: User | null;
    forumPosts: ForumPost[];
    onAddPost: (post: Partial<ForumPost>) => void;
    onAddReply: (postId: string, content: string) => void;
    plantationFeatures: PlantationFeature[];
    onSetFlyToBounds: (bounds: L.LatLngBoundsExpression) => void;
    onSetAppMode: (mode: AppMode) => void;
    employees: Employee[];
    mapProps: MapComponentProps;
    allUsers?: User[];
    organizations?: Organization[];
    crops?: Crop[];
    onClearInitialConversation?: () => void;
    initialConversationId?: string | null;
    onForwardToAnalyst?: (data: any) => void;
    isManualOffline?: boolean;
    alerts?: any[];
    setAlerts?: React.Dispatch<React.SetStateAction<any[]>>;
    onSetAiTab?: (tab: 'agro' | 'global' | 'market') => void;
    onMarkPostAsRead?: (postId: string) => void;
}

const QuickMessageModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    recipientName: string;
    onSend: (text: string, type: 'chat' | 'ticket') => void;
}> = ({ isOpen, onClose, recipientName, onSend }) => {
    const [text, setText] = useState('');
    const [type, setType] = useState<'chat' | 'ticket'>('chat');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
                <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Direct to {recipientName}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select dispatch mode</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
                        <XIcon size={24} className="text-slate-300" />
                    </button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                        <button 
                            onClick={() => setType('chat')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === 'chat' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Open Conversation
                        </button>
                        <button 
                            onClick={() => setType('ticket')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === 'ticket' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Send as Ticket
                        </button>
                    </div>
                    <textarea 
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder={type === 'chat' ? "Start your professional dialogue..." : "Describe the official inquiry or ticket details..."}
                        className="w-full h-32 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
                    />
                    <button 
                        onClick={() => { onSend(text, type); onClose(); }}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                    >
                        Dispatch {type === 'chat' ? 'Message' : 'Ticket'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const StatsCard: React.FC<{ buyers: number; sellers: number; workers: number }> = ({ buyers, sellers, workers }) => {
    return (
        <div className="absolute bottom-6 left-6 z-[1000] bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-slide-up">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                    <ShoppingBagIcon size={16} className="text-blue-600" />
                </div>
                <div>
                    <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Buyers</p>
                    <p className="text-sm font-black text-slate-800">{buyers}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <TagIcon size={16} className="text-emerald-600" />
                </div>
                <div>
                    <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Sellers</p>
                    <p className="text-sm font-black text-slate-800">{sellers}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                    <BriefcaseIcon size={16} className="text-orange-600" />
                </div>
                <div>
                    <p className="text-xs font-black text-orange-600 uppercase tracking-widest">Workers</p>
                    <p className="text-sm font-black text-slate-800">{workers}</p>
                </div>
            </div>
        </div>
    );
};

const isUserOnline = (user?: User) => {
    if (!user?.lastActive) return false;
    const lastActiveDate = new Date(user.lastActive);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActiveDate.getTime()) / (1000 * 60);
    return diffMinutes < 5; // Online if active in last 5 mins
};

const CommunicationHubPanel: React.FC<CommunicationHubPanelProps> = (props) => {
    const { allUsers = [], organizations = [], crops = [], onSetAppMode, mapProps, onAddPost, currentUser, forumPosts, onAddReply, initialConversationId, onClearInitialConversation, onForwardToAnalyst, isManualOffline, setAlerts, onSetAiTab, onMarkPostAsRead } = props;
    const [mainTab, setMainTab] = useState<'GOOGLE_CHAT' | 'GOOGLE_MEET' | 'COMMUNICATOR' | 'PARTNERS'>('GOOGLE_CHAT');
    const [hubType, setHubType] = useState<'INTERNAL' | 'REGIONAL' | 'GLOBAL'>('INTERNAL');
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [sortByOnline, setSortByOnline] = useState(false);
    const [isOnlineGreen, setIsOnlineGreen] = useState(!isManualOffline);

    // Resizable Edge Handle state
    const [communicatorPanelWidth, setCommunicatorPanelWidth] = useState<number>(() => {
        const saved = safeStorage.getItem('communicator_panel_width');
        const parsed = saved ? parseInt(saved, 10) : 560;
        return Number.isFinite(parsed) && parsed >= 300 ? parsed : 560;
    });

    // Google Chat & Meet States
    const [chatSpaces, setChatSpaces] = useState<GoogleChatSpace[]>([]);
    const [selectedChatSpace, setSelectedChatSpace] = useState<GoogleChatSpace | null>(null);
    const [chatMessages, setChatMessages] = useState<GoogleChatMessage[]>([]);
    const [isLoadingChatSpaces, setIsLoadingChatSpaces] = useState(false);
    const [isLoadingChatMessages, setIsLoadingChatMessages] = useState(false);
    const [chatMessageText, setChatMessageText] = useState('');
    const [isSendingChatMessage, setIsSendingChatMessage] = useState(false);
    
    // Space & Group Chat Creation
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);
    const [newSpaceDisplayName, setNewSpaceDisplayName] = useState('');
    const [spaceCreationType, setSpaceCreationType] = useState<'SPACE' | 'GROUP_CHAT'>('SPACE');
    const [selectedInviteEmails, setSelectedInviteEmails] = useState<string[]>([]);
    const [inviteEmailInput, setInviteEmailInput] = useState('');
    const [isCreatingSpaceLoading, setIsCreatingSpaceLoading] = useState(false);

    // Google Chat User Search & Member Management
    const [chatUserSearchQuery, setChatUserSearchQuery] = useState('');
    const [activeChatSubTab, setActiveChatSubTab] = useState<'CHATS' | 'CONTACTS'>('CHATS');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isInvitingUser, setIsInvitingUser] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [spaceMembersList, setSpaceMembersList] = useState<GoogleChatMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);

    // Google Meet States
    const [activeMeetUri, setActiveMeetUri] = useState<string>('');
    const [isGeneratingInstantMeet, setIsGeneratingInstantMeet] = useState(false);
    const [meetAgenda, setMeetAgenda] = useState('');
    const [recentMeets, setRecentMeets] = useState<{ uri: string; time: string; topic: string }[]>([]);

    // Contacts search across users, employees, and organizations
    const chatContacts = useMemo(() => {
        return searchContactsAndUsers(chatUserSearchQuery, allUsers, props.employees || [], organizations);
    }, [chatUserSearchQuery, allUsers, props.employees, organizations]);

    useEffect(() => {
        setIsOnlineGreen(!isManualOffline);
    }, [isManualOffline]);
    const [postTitle, setPostTitle] = useState('');
    const [postContent, setPostContent] = useState('');
    const [replyToPostId, setReplyToPostId] = useState<string | null>(null);
    const [hoveredPartnerId, setHoveredPartnerId] = useState<string | null>(null);
    const [quickMessageRecipient, setQuickMessageRecipient] = useState<{ id: string, name: string, type: 'user' | 'org' } | null>(null);

    const [needsAuth, setNeedsAuth] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const fetchSpaces = async (authToken: string) => {
        setIsLoadingChatSpaces(true);
        try {
            const spaces = await listGoogleChatSpaces(authToken);
            setChatSpaces(spaces);
            if (spaces.length > 0) {
                const initial = spaces[0];
                setSelectedChatSpace(initial);
                fetchMessages(authToken, initial.name);
            }
        } catch (err: any) {
            console.error('[GoogleChat] Error fetching spaces:', err);
            if (err.message === 'AUTH_EXPIRED' || err.message === 'PERMISSION_DENIED') {
                setNeedsAuth(true);
            }
        } finally {
            setIsLoadingChatSpaces(false);
        }
    };

    const fetchMessages = async (authToken: string, spaceName: string) => {
        setIsLoadingChatMessages(true);
        try {
            const msgs = await listGoogleChatMessages(authToken, spaceName);
            setChatMessages(msgs);
        } catch (err) {
            console.error('[GoogleChat] Error fetching messages:', err);
        } finally {
            setIsLoadingChatMessages(false);
        }
    };

    useEffect(() => {
        const unsubscribe = initGoogleAuth(
            (_user, t) => {
                setToken(t);
                setNeedsAuth(false);
                fetchSpaces(t);
            },
            () => setNeedsAuth(true)
        );

        getAccessToken().then(t => {
            if (t) {
                setToken(t);
                setNeedsAuth(false);
                fetchSpaces(t);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleGoogleAuth = async () => {
        setIsLoggingIn(true);
        try {
            const result = await googleSignIn();
            if (result && result.accessToken) {
                setToken(result.accessToken);
                setNeedsAuth(false);
                toast.success("Google Workspace authorized!");
                fetchSpaces(result.accessToken);
            }
        } catch (err) {
            console.error('Google sign-in error:', err);
            toast.error("Google Authorization failed. Ensure popups are allowed.");
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleSelectSpace = (space: GoogleChatSpace) => {
        setSelectedChatSpace(space);
        if (token) {
            fetchMessages(token, space.name);
        }
    };

    const handleCreateSpace = async () => {
        if (!newSpaceDisplayName.trim()) {
            toast.error("Please enter a space or group name.");
            return;
        }
        if (!token) {
            handleGoogleAuth();
            return;
        }
        setIsCreatingSpaceLoading(true);
        try {
            const space = await createGoogleChatSpace(
                token, 
                newSpaceDisplayName.trim(),
                spaceCreationType,
                selectedInviteEmails
            );
            toast.success(spaceCreationType === 'GROUP_CHAT' 
                ? `Group Chat "${newSpaceDisplayName}" initialized!`
                : `Google Chat Space "${newSpaceDisplayName}" created!`
            );
            setChatSpaces(prev => [space, ...prev.filter(s => s.name !== space.name)]);
            setSelectedChatSpace(space);
            setNewSpaceDisplayName('');
            setSelectedInviteEmails([]);
            setInviteEmailInput('');
            setIsCreatingSpace(false);
            fetchMessages(token, space.name);
        } catch (err) {
            toast.error("Failed to create Google Chat space.");
        } finally {
            setIsCreatingSpaceLoading(false);
        }
    };

    const handleInviteUserToSpace = async (email: string) => {
        const clean = email.trim();
        if (!clean || !selectedChatSpace) return;
        if (!token) {
            handleGoogleAuth();
            return;
        }
        setIsInvitingUser(true);
        try {
            await inviteUserToGoogleChatSpace(token, selectedChatSpace.name, clean);
            toast.success(`User ${clean} added/invited to ${selectedChatSpace.displayName || 'Space'}!`);
            setIsInviteModalOpen(false);
            setInviteEmailInput('');
            // refresh space members
            const updatedMembers = await listGoogleChatMembers(token, selectedChatSpace.name);
            setSpaceMembersList(updatedMembers);
        } catch (err) {
            toast.error(`Failed to invite ${clean}.`);
        } finally {
            setIsInvitingUser(false);
        }
    };

    const handleViewSpaceMembers = async (space: GoogleChatSpace) => {
        setSelectedChatSpace(space);
        setIsMembersModalOpen(true);
        setIsLoadingMembers(true);
        try {
            const members = await listGoogleChatMembers(token || '', space.name);
            setSpaceMembersList(members);
        } catch (err) {
            console.error('Error fetching members:', err);
        } finally {
            setIsLoadingMembers(false);
        }
    };

    const handleStartDirectOrGroupWithContact = async (contact: ChatContact) => {
        const title = `${contact.name} & Ops`;
        setIsCreatingSpaceLoading(true);
        try {
            const space = await createGoogleChatSpace(
                token || '',
                title,
                'GROUP_CHAT',
                [contact.email]
            );
            setChatSpaces(prev => [space, ...prev.filter(s => s.name !== space.name)]);
            setSelectedChatSpace(space);
            setActiveChatSubTab('CHATS');
            if (token) fetchMessages(token, space.name);
            toast.success(`Started conversation with ${contact.name}!`);
        } catch (e) {
            toast.error(`Could not start chat with ${contact.name}`);
        } finally {
            setIsCreatingSpaceLoading(false);
        }
    };

    const handleSendChatMessage = async () => {
        if (!chatMessageText.trim() || !selectedChatSpace) return;
        if (!token) {
            toast.error("Please connect Google Workspace.");
            return;
        }
        setIsSendingChatMessage(true);
        try {
            await sendGoogleChatMessage(token, selectedChatSpace.name, {
                text: chatMessageText.trim(),
                senderName: currentUser?.name || 'AgriMap Operator',
                senderEmail: currentUser?.email || undefined
            });
            setChatMessageText('');
            toast.success("Message dispatched to Google Chat!");
            fetchMessages(token, selectedChatSpace.name);
        } catch (err) {
            toast.error("Failed to send message to Google Chat.");
        } finally {
            setIsSendingChatMessage(false);
        }
    };

    const handleCreateInstantMeet = async () => {
        if (!token) {
            handleGoogleAuth();
            return;
        }
        setIsGeneratingInstantMeet(true);
        try {
            const meet = await createGoogleMeetRoom(token);
            if (meet.meetingUri) {
                setActiveMeetUri(meet.meetingUri);
                const topic = meetAgenda.trim() || 'AgriMap Operations Standup';
                setRecentMeets(prev => [{ uri: meet.meetingUri, time: new Date().toLocaleTimeString(), topic }, ...prev]);
                toast.success("Google Meet Room created!", {
                    description: meet.meetingUri
                });
            }
        } catch (err) {
            toast.error("Failed to generate Google Meet room.");
        } finally {
            setIsGeneratingInstantMeet(false);
        }
    };

    const createMeetSpace = async (accessToken: string) => {
        try {
            const res = await fetch('https://meet.googleapis.com/v2/spaces', {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.meetingUri) {
                toast.success("Meeting created!");
                setPostContent(prev => prev + (prev.length > 0 ? '\n' : '') + `Join my video meeting: ${data.meetingUri}`);
            } else {
                console.error(data);
                if (data.error && data.error.status === 'PERMISSION_DENIED') {
                    toast.error("Please log in with an account that has Google Workspace permissions.");
                } else {
                    toast.error("Error creating meeting.");
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to connect to Google Meet.");
        }
    };

    const handleCreateMeet = async () => {
        if (needsAuth || !token) {
            setIsLoggingIn(true);
            try {
                const result = await googleSignIn();
                if (result) {
                    setToken(result.accessToken);
                    setNeedsAuth(false);
                    createMeetSpace(result.accessToken);
                }
            } catch (err) {
                console.error('Login failed:', err);
                toast.error("Failed to authenticate with Google.");
            } finally {
                setIsLoggingIn(false);
            }
        } else {
            createMeetSpace(token);
        }
    };

    // Filtered lists moved up to avoid ReferenceErrors
    const filteredPosts = useMemo(() => {
        return forumPosts.filter(p => {
            if (mainTab === 'COMMUNICATOR') {
                if (hubType === 'INTERNAL') return p.hubType === 'internal' && !p.isDirectMessage;
                if (hubType === 'REGIONAL') return (p.hubType === 'regional' || (!p.hubType && p.channelId === 'general')) && !p.isDirectMessage;
                if (hubType === 'GLOBAL') return p.hubType === 'global' && !p.isDirectMessage;
                return !p.isDirectMessage;
            }
            return !p.isDirectMessage;
        }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [forumPosts, hubType, mainTab, currentUser]);

    const filteredPartners = useMemo(() => {
        const query = searchQuery.toLowerCase();
        
        let individualPartners = allUsers.filter(u => {
            if (u.id === currentUser?.id) return false;
            if (!u.isPubliclyVisible && !u.isProfileDiscoverable) return false;
            
            const matchesRole = roleFilter === 'ALL' || 
                               (roleFilter === 'BUYER' && u.roles?.includes('Buyer')) ||
                               (roleFilter === 'SELLER' && u.roles?.includes('seller')) ||
                               (roleFilter === 'WORKER' && u.roles?.includes('worker')) ||
                               (roleFilter === 'AGRONOMIST' && u.roles?.includes('Agronomist')) ||
                               (roleFilter === 'SHOP' && u.roles?.includes('Agro-Shop'));
                               
            const matchesSearch = u.name.toLowerCase().includes(query) || 
                                 u.email.toLowerCase().includes(query) || 
                                 u.region?.toLowerCase().includes(query);
                                 
            return matchesRole && matchesSearch;
        });

        if (sortByOnline) {
            individualPartners = [...individualPartners].sort((a, b) => {
                const aOnline = isUserOnline(a);
                const bOnline = isUserOnline(b);
                if (aOnline && !bOnline) return -1;
                if (!aOnline && bOnline) return 1;
                return 0;
            });
        }

        const orgPartners = organizations.filter(o => {
            if (!o.isDiscoverable) return false;
            if (roleFilter !== 'ALL' && roleFilter !== 'COMPANY') return false;
            
            const matchesSearch = o.name.toLowerCase().includes(query) || 
                                 o.region?.toLowerCase().includes(query) ||
                                 o.type.toLowerCase().includes(query);
            return matchesSearch;
        });

        return [...individualPartners, ...orgPartners];
    }, [allUsers, organizations, currentUser, roleFilter, searchQuery, sortByOnline]);

    const handleExportPartners = () => {
        const headers = ['Name', 'Type', 'Region', 'Crops', 'Area', 'Contact Email'];
        const rows = filteredPartners.map(p => {
            const partnerCrops = crops.filter(c => c.organizationId === (p as any).id || (p as any).organizationId === c.organizationId).map(c => c.name).join(', ');
            return [
                p.name,
                (p as any).type ? 'Company' : 'Individual',
                p.region || 'N/A',
                partnerCrops || 'N/A',
                (p as any).areaHa || 'N/A',
                (p as any).email || 'N/A'
            ].join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'agrimap_partners_export.csv');
        link.click();
    };

    useEffect(() => {
        if (initialConversationId) {
            setMainTab('COMMUNICATOR');
            // If the conversation exists, it will be in the filtered list.
            // If it doesn't exist, the UI will show "No conversations here yet" 
            // unless we trigger one.
            const conversationExists = forumPosts.some(p => p.channelId === initialConversationId);
            if (!conversationExists) {
                // Find potential recipient
                const userId = initialConversationId.replace('dm_', '').split('_').find(id => id !== currentUser?.id);
                const partner = allUsers.find(u => u.id === userId);
                if (partner) {
                     onAddPost({
                        title: `Secure Session with ${partner.name}`,
                        content: `Starting a professional dialogue with ${partner.name}.`,
                        isDirectMessage: true,
                        recipientId: partner.id,
                        recipientName: partner.name,
                        hubType: 'internal',
                        channelId: initialConversationId
                    });
                }
            }
            onClearInitialConversation?.();
        }
    }, [initialConversationId, forumPosts, currentUser, allUsers, onAddPost]);

    const renderContentWithMentions = (content: string) => {
        const parts = content.split(/(\s+)/);
        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                return (
                    <span key={index} className="text-blue-600 font-black cursor-pointer hover:underline">
                        {part}
                    </span>
                );
            }
            if (part.startsWith('#')) {
                return (
                    <span key={index} className="text-emerald-600 font-extrabold cursor-pointer hover:underline">
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    // Stats for map overlay
    const stats = useMemo(() => {
        return {
            buyers: allUsers.filter(u => u.roles?.includes('Buyer')).length,
            sellers: allUsers.filter(u => u.roles?.includes('seller')).length,
            workers: allUsers.filter(u => u.roles?.includes('worker')).length
        };
    }, [allUsers]);

    useEffect(() => {
        if (!currentUser || !onMarkPostAsRead) return;
        
        filteredPosts.forEach(post => {
            const isUnread = !(post.readBy || []).includes(currentUser.id);
            const isTarget = post.isDirectMessage ? post.recipientId === currentUser.id : post.content.includes(`@${currentUser.name}`);
            
            if (isUnread && isTarget) {
                onMarkPostAsRead(post.id);
            }
        });
    }, [filteredPosts, currentUser, onMarkPostAsRead]);

    return (
        <main className="w-full h-full bg-white overflow-hidden flex flex-col md:flex-row min-h-0">
            {/* Left Panel */}
            <div 
                className="w-full flex flex-col border-r h-full bg-white relative z-20 shadow-2xl min-h-0 flex-shrink-0"
                style={{
                    width: typeof window !== 'undefined' && window.innerWidth > 768 ? `${communicatorPanelWidth}px` : undefined,
                    maxWidth: '85vw'
                }}
            >
                {/* Main Tabs */}
                <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide bg-slate-50/90 shrink-0 min-h-[52px] h-[52px] items-stretch">
                    <button 
                        onClick={() => setMainTab('GOOGLE_CHAT')}
                        className={`flex-1 py-3 px-3.5 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 min-w-[120px] shrink-0 h-full ${mainTab === 'GOOGLE_CHAT' ? 'border-emerald-600 text-emerald-600 bg-white font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <MessageSquare size={16} className="text-emerald-500 shrink-0" />
                        <span>Google Chat</span>
                    </button>
                    <button 
                        onClick={() => setMainTab('GOOGLE_MEET')}
                        className={`flex-1 py-3 px-3.5 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 min-w-[120px] shrink-0 h-full ${mainTab === 'GOOGLE_MEET' ? 'border-blue-600 text-blue-600 bg-white font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Video size={16} className="text-blue-500 shrink-0" />
                        <span>Google Meet</span>
                    </button>
                    <button 
                        onClick={() => setMainTab('COMMUNICATOR')}
                        className={`flex-1 py-3 px-3.5 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 min-w-[120px] shrink-0 h-full ${mainTab === 'COMMUNICATOR' ? 'border-indigo-600 text-indigo-600 bg-white font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <UserGroupIcon size={16} className="shrink-0" />
                        <span>Forum & Hub</span>
                    </button>
                    <button 
                        onClick={() => setMainTab('PARTNERS')}
                        className={`flex-1 py-3 px-3.5 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 min-w-[120px] shrink-0 h-full ${mainTab === 'PARTNERS' ? 'border-slate-900 text-slate-900 bg-white font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <SearchIcon size={16} className="shrink-0" />
                        <span>Partners Find</span>
                    </button>
                </div>

                {/* Sub Content View */}
                <div className="flex-grow flex flex-col overflow-hidden min-h-0">
                    {/* Google Chat Tab */}
                    {mainTab === 'GOOGLE_CHAT' && (
                        <div className="flex-grow flex flex-col overflow-hidden">
                            {/* Google Auth Banner */}
                            {needsAuth && (
                                <div className="m-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                                            <MessageSquare size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-emerald-950 uppercase tracking-tight">Connect Google Workspace</h4>
                                            <p className="text-[11px] text-emerald-700 font-medium">Link your account to access live Google Chat spaces and team messaging.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleGoogleAuth}
                                        disabled={isLoggingIn}
                                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 whitespace-nowrap shrink-0"
                                    >
                                        {isLoggingIn ? <RefreshCwIcon size={14} className="animate-spin" /> : <ShieldCheckIcon size={16} />}
                                        <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
                                    </button>
                                </div>
                            )}

                            {/* Sub Navigation: Chat Spaces vs Find Users / Contacts */}
                            <div className="px-4 pt-3 pb-2 border-b border-slate-100 bg-white flex items-center justify-between gap-2 shrink-0">
                                <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                                    <button
                                        onClick={() => setActiveChatSubTab('CHATS')}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                            activeChatSubTab === 'CHATS'
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <MessageSquare size={13} />
                                        <span>Spaces ({chatSpaces.length})</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveChatSubTab('CONTACTS')}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                            activeChatSubTab === 'CONTACTS'
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <Users size={13} />
                                        <span>Find Users ({chatContacts.length})</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            setSpaceCreationType('SPACE');
                                            setIsCreatingSpace(!isCreatingSpace);
                                        }}
                                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                                        title="Create Space"
                                    >
                                        <Plus size={13} /> Space
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSpaceCreationType('GROUP_CHAT');
                                            setIsCreatingSpace(true);
                                        }}
                                        className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                                        title="Create Group Chat"
                                    >
                                        <UserPlus size={13} /> Group Chat
                                    </button>
                                    <button
                                        onClick={() => token && fetchSpaces(token)}
                                        disabled={isLoadingChatSpaces}
                                        className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-all"
                                        title="Refresh Spaces"
                                    >
                                        <RefreshCwIcon size={13} className={isLoadingChatSpaces ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            {/* Space & Group Creation Form Drawer */}
                            {isCreatingSpace && (
                                <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-b border-emerald-200 space-y-3 animate-in slide-in-from-top duration-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">
                                                {spaceCreationType === 'GROUP_CHAT' ? 'New Group Chat' : 'New Google Chat Space'}
                                            </span>
                                            <span className="text-xs text-slate-500 font-bold">
                                                {spaceCreationType === 'GROUP_CHAT' ? 'Multi-user operational group' : 'Public operational room'}
                                            </span>
                                        </div>
                                        <button onClick={() => setIsCreatingSpace(false)} className="text-slate-400 hover:text-slate-600">
                                            <XIcon size={14} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            value={newSpaceDisplayName}
                                            onChange={e => setNewSpaceDisplayName(e.target.value)}
                                            placeholder={spaceCreationType === 'GROUP_CHAT' ? "Group Name (e.g. Harvest Team Beta)..." : "Space Name (e.g. Field Operations)..."}
                                            className="px-3.5 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                        <div className="flex gap-1.5">
                                            <input
                                                type="email"
                                                value={inviteEmailInput}
                                                onChange={e => setInviteEmailInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && inviteEmailInput.trim()) {
                                                        e.preventDefault();
                                                        if (!selectedInviteEmails.includes(inviteEmailInput.trim())) {
                                                            setSelectedInviteEmails([...selectedInviteEmails, inviteEmailInput.trim()]);
                                                        }
                                                        setInviteEmailInput('');
                                                    }
                                                }}
                                                placeholder="Invite member email + press Enter..."
                                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (inviteEmailInput.trim() && !selectedInviteEmails.includes(inviteEmailInput.trim())) {
                                                        setSelectedInviteEmails([...selectedInviteEmails, inviteEmailInput.trim()]);
                                                        setInviteEmailInput('');
                                                    }
                                                }}
                                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Selected Member Tags */}
                                    {selectedInviteEmails.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Inviting:</span>
                                            {selectedInviteEmails.map(email => (
                                                <span key={email} className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1">
                                                    <span>{email}</span>
                                                    <button
                                                        onClick={() => setSelectedInviteEmails(selectedInviteEmails.filter(e => e !== email))}
                                                        className="text-emerald-700 hover:text-rose-600 font-black ml-1"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Quick Contact Picker for invites */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">Quick Add:</span>
                                        {chatContacts.slice(0, 6).map(c => {
                                            const isAdded = selectedInviteEmails.includes(c.email);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isAdded) {
                                                            setSelectedInviteEmails(selectedInviteEmails.filter(e => e !== c.email));
                                                        } else {
                                                            setSelectedInviteEmails([...selectedInviteEmails, c.email]);
                                                        }
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all shrink-0 flex items-center gap-1 ${
                                                        isAdded 
                                                        ? 'bg-emerald-600 text-white' 
                                                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <span>{c.name}</span>
                                                    {isAdded ? <Check size={10} /> : <Plus size={10} />}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex justify-end gap-2 pt-1">
                                        <button
                                            onClick={() => setIsCreatingSpace(false)}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreateSpace}
                                            disabled={isCreatingSpaceLoading}
                                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                                        >
                                            {isCreatingSpaceLoading ? <RefreshCwIcon size={14} className="animate-spin" /> : <Check size={14} />}
                                            <span>Create & Launch {spaceCreationType === 'GROUP_CHAT' ? 'Group' : 'Space'}</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* SUB-VIEW 1: CONTACTS & FIND USERS DIRECTORY */}
                            {activeChatSubTab === 'CONTACTS' ? (
                                <div className="flex-grow flex flex-col overflow-hidden bg-slate-50/50">
                                    <div className="p-3 bg-white border-b border-slate-100">
                                        <div className="relative">
                                            <SearchIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={chatUserSearchQuery}
                                                onChange={e => setChatUserSearchQuery(e.target.value)}
                                                placeholder="Find users, field engineers, agronomists, or partner orgs..."
                                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-grow overflow-y-auto p-4 space-y-2.5">
                                        {chatContacts.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-2">
                                                <Users size={32} className="text-slate-300" />
                                                <p className="text-xs font-bold text-slate-600 uppercase">No users or contacts found</p>
                                                <p className="text-[11px] text-slate-400">Try searching by name, email, or operational role.</p>
                                            </div>
                                        ) : (
                                            chatContacts.map(contact => (
                                                <div
                                                    key={contact.id}
                                                    className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800 font-black text-sm flex items-center justify-center shadow-xs">
                                                                {contact.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            {contact.isOnline && (
                                                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h5 className="text-xs font-black text-slate-900">{contact.name}</h5>
                                                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">
                                                                    {contact.type}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 font-medium">{contact.email} • <span className="text-emerald-700 font-bold">{contact.role}</span></p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                                        <button
                                                            onClick={() => handleStartDirectOrGroupWithContact(contact)}
                                                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                                                            title="Start Chat Group"
                                                        >
                                                            <MessageCircle size={12} />
                                                            <span>Chat Group</span>
                                                        </button>
                                                        {selectedChatSpace && (
                                                            <button
                                                                onClick={() => handleInviteUserToSpace(contact.email)}
                                                                disabled={isInvitingUser}
                                                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                                                                title={`Invite to ${selectedChatSpace.displayName || 'Current Space'}`}
                                                            >
                                                                <UserPlus size={12} />
                                                                <span>Add to Space</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* SUB-VIEW 2: ACTIVE SPACE & MESSAGES */
                                <div className="flex-grow flex flex-col overflow-hidden">
                                    {/* Spaces Horizontal Carousel Selector */}
                                    <div className="p-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                                            {isLoadingChatSpaces ? (
                                                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 py-1">
                                                    <RefreshCwIcon size={14} className="animate-spin text-emerald-500" />
                                                    Loading Spaces...
                                                </div>
                                            ) : chatSpaces.length === 0 ? (
                                                <span className="text-[11px] font-bold text-slate-400 italic">No spaces active</span>
                                            ) : (
                                                chatSpaces.map(space => {
                                                    const isSelected = selectedChatSpace?.name === space.name;
                                                    const label = space.displayName || space.name.replace('spaces/', 'Space #');
                                                    const isGroup = space.type === 'GROUP_CHAT' || space.spaceType === 'GROUP_CHAT';
                                                    return (
                                                        <button
                                                            key={space.name}
                                                            onClick={() => handleSelectSpace(space)}
                                                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                                                isSelected 
                                                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                                                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            {isGroup ? <Users size={12} /> : <MessageSquare size={12} />}
                                                            <span className="max-w-[120px] truncate">{label}</span>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Active Space Banner & Action Bar */}
                                    {selectedChatSpace && (
                                        <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <h4 className="text-xs font-black text-slate-900 truncate">
                                                    {selectedChatSpace.displayName || selectedChatSpace.name}
                                                </h4>
                                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-black uppercase">
                                                    {selectedChatSpace.type || 'SPACE'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleViewSpaceMembers(selectedChatSpace)}
                                                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                                                >
                                                    <Users size={12} />
                                                    <span>Members ({selectedChatSpace.membersCount || selectedChatSpace.members?.length || 1})</span>
                                                </button>
                                                <button
                                                    onClick={() => setIsInviteModalOpen(true)}
                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs transition-all"
                                                >
                                                    <UserPlus size={12} />
                                                    <span>+ Invite</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Invite Modal for current space */}
                                    {isInviteModalOpen && (
                                        <div className="p-3 bg-emerald-50/90 border-b border-emerald-200 space-y-2 animate-in zoom-in-95 duration-150">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-950">
                                                    Invite Member to {selectedChatSpace?.displayName || 'Space'}
                                                </span>
                                                <button onClick={() => setIsInviteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                                    <XIcon size={14} />
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="email"
                                                    value={inviteEmailInput}
                                                    onChange={e => setInviteEmailInput(e.target.value)}
                                                    placeholder="Enter colleague or partner email (e.g. sam@agrimap.io)..."
                                                    className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                                <button
                                                    onClick={() => handleInviteUserToSpace(inviteEmailInput)}
                                                    disabled={isInvitingUser || !inviteEmailInput.trim()}
                                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1"
                                                >
                                                    {isInvitingUser ? <RefreshCwIcon size={13} className="animate-spin" /> : <UserPlus size={13} />}
                                                    <span>Invite</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Members List Modal */}
                                    {isMembersModalOpen && (
                                        <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5 animate-in slide-in-from-top duration-150">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                                    Active Space Members ({spaceMembersList.length})
                                                </span>
                                                <button onClick={() => setIsMembersModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                                    <XIcon size={14} />
                                                </button>
                                            </div>
                                            {isLoadingMembers ? (
                                                <div className="py-2 text-center text-xs font-bold text-slate-400 flex items-center justify-center gap-2">
                                                    <RefreshCwIcon size={14} className="animate-spin text-emerald-500" />
                                                    <span>Loading participants...</span>
                                                </div>
                                            ) : spaceMembersList.length === 0 ? (
                                                <p className="text-xs text-slate-500 italic">No external members recorded yet.</p>
                                            ) : (
                                                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                                    {spaceMembersList.map((m, idx) => (
                                                        <div key={m.name || idx} className="p-2 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                                                                    {(m.displayName || m.email || 'M').charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-slate-800">{m.displayName || m.email || m.name}</span>
                                                                    {m.email && <span className="text-[10px] text-slate-400 ml-1.5">{m.email}</span>}
                                                                </div>
                                                            </div>
                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                                                                {m.role || 'MEMBER'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Message Feed */}
                                    <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                                        {isLoadingChatMessages ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                                                <RefreshCwIcon size={24} className="animate-spin text-emerald-500" />
                                                <p className="text-xs font-bold uppercase tracking-widest">Loading Google Chat Messages...</p>
                                            </div>
                                        ) : !selectedChatSpace ? (
                                            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-3">
                                                <MessageSquare size={36} className="text-slate-300" />
                                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Select or Create a Google Chat Space to begin</p>
                                                {needsAuth && (
                                                    <button onClick={handleGoogleAuth} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">
                                                        Connect Google Workspace
                                                    </button>
                                                )}
                                            </div>
                                        ) : chatMessages.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 gap-2">
                                                <MessageSquare size={32} className="text-slate-300" />
                                                <p className="text-xs font-bold text-slate-600 uppercase tracking-tight">No messages in this space yet</p>
                                                <p className="text-[11px] text-slate-400">Post operational updates, dispatch orders, or ask agronomist questions!</p>
                                            </div>
                                        ) : (
                                            chatMessages.map(msg => {
                                                const senderName = msg.sender?.displayName || msg.sender?.name?.replace('users/', 'Member ') || 'Team Member';
                                                const timeStr = msg.createTime ? new Date(msg.createTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                                return (
                                                    <div key={msg.name} className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shadow-xs">
                                                                    {senderName.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{senderName}</span>
                                                                    <p className="text-[10px] font-bold text-slate-400">{timeStr}</p>
                                                                </div>
                                                            </div>
                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-black uppercase tracking-widest">
                                                                Google Chat
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed pl-1 font-medium">
                                                            {msg.text || msg.formattedText}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Post Composer */}
                                    <div className="p-4 border-t border-slate-100 bg-white">
                                        <div className="flex gap-2">
                                            <textarea
                                                value={chatMessageText}
                                                onChange={e => setChatMessageText(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendChatMessage();
                                                    }
                                                }}
                                                placeholder={selectedChatSpace ? `Message in ${selectedChatSpace.displayName || 'Space'}...` : "Select a space first..."}
                                                disabled={!selectedChatSpace}
                                                rows={2}
                                                className="flex-1 bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none disabled:opacity-50"
                                            />
                                            <div className="flex flex-col gap-1.5 justify-end">
                                                <button
                                                    onClick={handleSendChatMessage}
                                                    disabled={isSendingChatMessage || !chatMessageText.trim() || !selectedChatSpace}
                                                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                >
                                                    {isSendingChatMessage ? <RefreshCwIcon size={14} className="animate-spin" /> : <PaperAirplaneIcon size={14} />}
                                                    <span>Send</span>
                                                </button>
                                                <button
                                                    onClick={handleCreateInstantMeet}
                                                    className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 rounded-xl transition-all flex items-center justify-center"
                                                    title="Attach Google Meet Video Link"
                                                >
                                                    <Video size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Google Meet Tab */}
                    {mainTab === 'GOOGLE_MEET' && (
                        <div className="flex-grow flex flex-col p-6 space-y-6 overflow-y-auto bg-slate-50/40">
                            {/* Meet Banner */}
                            <div className="p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-[2rem] shadow-xl relative overflow-hidden space-y-4">
                                <div className="relative z-10 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                                            Google Meet Conference Hub
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Real-Time Team Video & Audio</h3>
                                    <p className="text-xs text-blue-200 max-w-md font-medium">
                                        Launch high-definition video calls for harvest brigades, agronomy councils, and field inspectors with one click.
                                    </p>
                                </div>
                                <Video className="absolute -right-6 -bottom-6 w-36 h-36 text-white/5 rotate-12 pointer-events-none" />
                            </div>

                            {/* 1-Click Launch */}
                            <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-sm space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">Launch Instant Meeting</h4>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meeting Topic / Agenda</label>
                                    <input
                                        type="text"
                                        value={meetAgenda}
                                        onChange={e => setMeetAgenda(e.target.value)}
                                        placeholder="e.g. Morning Harvest Briefing, Pest Outbreak Inspection..."
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                                    />
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={handleCreateInstantMeet}
                                        disabled={isGeneratingInstantMeet}
                                        className="flex-1 py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {isGeneratingInstantMeet ? <RefreshCwIcon size={16} className="animate-spin" /> : <Video size={18} />}
                                        <span>{isGeneratingInstantMeet ? 'Generating Room...' : 'Start Instant Google Meet'}</span>
                                    </button>
                                </div>

                                {activeMeetUri && (
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-800">Active Room Generated</span>
                                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-md uppercase">Live</span>
                                        </div>
                                        <div className="p-3 bg-white border border-blue-200 rounded-xl flex items-center justify-between gap-2 font-mono text-xs text-blue-950 font-bold">
                                            <span className="truncate">{activeMeetUri}</span>
                                            <div className="flex gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(activeMeetUri);
                                                        toast.success("Meeting link copied!");
                                                    }}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                    title="Copy Link"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                <a
                                                    href={activeMeetUri}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5"
                                                >
                                                    <span>Join</span>
                                                    <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Recent Meetings */}
                            {recentMeets.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent Session Links</h4>
                                    <div className="space-y-2">
                                        {recentMeets.map((m, idx) => (
                                            <div key={idx} className="p-4 bg-white border border-slate-200/70 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                                                <div>
                                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{m.topic}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">Created at {m.time}</p>
                                                </div>
                                                <a
                                                    href={m.uri}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                                                >
                                                    <span>Re-enter</span>
                                                    <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Offline / Local Communicator Hub */}
                    {mainTab === 'COMMUNICATOR' && (
                        <>
                            <div className="p-4 flex gap-2 shrink-0 bg-white border-b border-slate-100">
                                {['INTERNAL', 'REGIONAL', 'GLOBAL'].map((t) => (
                                    <button 
                                        key={t}
                                        onClick={() => setHubType(t as any)}
                                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${hubType === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            {/* Channel List */}
                            <div className="px-4 py-2 shrink-0 bg-slate-50 border-b border-slate-100">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm">
                                    <HashtagIcon size={12} /> Local Offline Network
                                </span>
                            </div>

                            {/* Post Feed */}
                            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                                {filteredPosts.length === 0 ? (
                                    <div className="h-full flex items-center justify-center italic text-slate-300 font-bold uppercase tracking-widest text-[10px]">
                                        No conversations here yet.
                                    </div>
                                ) : (
                                    filteredPosts.map(post => (
                                        <div key={post.id} className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                                            <UserCircleIcon size={24} className="text-slate-300" />
                                                        </div>
                                                        {isUserOnline(allUsers.find(u => u.id === post.authorId)) && (
                                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-slate-800 text-xs uppercase tracking-tight">
                                                            {post.title || (post.isDirectMessage ? `Chat with ${post.authorId === currentUser?.id ? post.recipientName : post.authorName}` : 'Conversation')}
                                                        </h4>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-2">
                                                            {post.authorName} • {new Date(post.timestamp).toLocaleTimeString()}
                                                            {isUserOnline(allUsers.find(u => u.id === post.authorId)) && <span className="text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Online</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                                {renderContentWithMentions(post.content)}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => {
                                                            setReplyToPostId(post.id);
                                                            setPostContent(`@${post.authorName} `);
                                                        }} 
                                                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                                                    >
                                                        Reply
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Post Input UI */}
                            <div className="p-6 border-t border-slate-100 bg-white">
                                {replyToPostId && (
                                    <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-t-xl mb-[-1px]">
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Replying to post</p>
                                        <button onClick={() => setReplyToPostId(null)} className="text-indigo-400 hover:text-indigo-600">
                                            <XIcon size={14} />
                                        </button>
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <input 
                                        type="text" 
                                        placeholder="Post title (Optional for replies)..." 
                                        value={postTitle}
                                        onChange={e => setPostTitle(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                    />
                                    <textarea 
                                        placeholder="Type your message..." 
                                        rows={3}
                                        value={postContent}
                                        onChange={e => setPostContent(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-medium text-slate-600 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
                                    />
                                    <div className="flex items-center justify-end">
                                        <button 
                                            onClick={() => {
                                                if (!postContent.trim()) return;
                                                onAddPost({
                                                    title: postTitle,
                                                    content: postContent,
                                                    hubType: hubType.toLowerCase() as any,
                                                    isDirectMessage: false,
                                                    parentPostId: replyToPostId || undefined
                                                });
                                                setPostTitle('');
                                                setPostContent('');
                                                setReplyToPostId(null);
                                            }}
                                            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
                                        >
                                            Post <PaperAirplaneIcon size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Partners Tab */}
                    {mainTab === 'PARTNERS' && (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* Partners Search */}
                            <div className="p-4 border-b border-slate-100 space-y-4 shrink-0">
                                <div className="relative">
                                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="Search..." 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-xs font-black text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    <button 
                                        onClick={() => setSortByOnline(!sortByOnline)}
                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 ${sortByOnline ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        Show Online Users
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (onSetAiTab) onSetAiTab('market');
                                            onSetAppMode('ai');
                                        }}
                                        className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-indigo-600 text-white border-indigo-600 shadow-sm hover:bg-indigo-700 transition-all shrink-0"
                                    >
                                        Market Intelligence
                                    </button>
                                    {['ALL', 'COMPANY', 'BUYER', 'SELLER', 'WORKER', 'AGRONOMIST', 'SHOP'].map(role => (
                                        <button 
                                            key={role}
                                            onClick={() => setRoleFilter(role)}
                                            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 ${roleFilter === role ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                    <button 
                                        onClick={handleExportPartners}
                                        className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 bg-white text-indigo-600 hover:bg-indigo-50 transition-all shrink-0 ml-auto"
                                    >
                                        Export List
                                    </button>
                                </div>
                            </div>

                            {/* Partners List */}
                            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                                {filteredPartners.map(partner => {
                                    const isOrg = (partner as any).type !== undefined;
                                    const partnerCrops = crops.filter(c => c.organizationId === (partner as any).id || (partner as any).organizationId === c.organizationId);
                                    
                                    return (
                                        <div 
                                            key={partner.id} 
                                            onMouseEnter={() => setHoveredPartnerId(partner.id)}
                                            onMouseLeave={() => setHoveredPartnerId(null)}
                                            className="p-6 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:shadow-slate-100 hover:scale-[1.01] transition-all group relative"
                                        >
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                                                        {(partner as any).avatar ? <img src={(partner as any).avatar} className="w-full h-full object-cover" /> : isOrg ? <BuildingStorefrontIcon size={24} className="text-blue-400" /> : <UserCircleIcon size={32} className="text-slate-300" />}
                                                    </div>
                                                    {!isOrg && isUserOnline(partner as User) && (
                                                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white"></div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 
                                                        className="font-black text-slate-900 text-sm uppercase tracking-tight hover:text-blue-600 cursor-pointer transition-colors"
                                                        onClick={() => onSetAppMode('profile')}
                                                    >
                                                        {partner.name}
                                                    </h4>
                                                    {(partner as User).email && hoveredPartnerId === partner.id && (
                                                        <div className="absolute left-full ml-4 p-4 bg-slate-900 text-white rounded-2xl z-[5000] w-64 shadow-2xl animate-fade-in">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Direct Contact</p>
                                                            <div className="space-y-1.5">
                                                                <p className="text-xs font-bold truncate flex items-center gap-2 cursor-pointer hover:text-blue-400" onClick={() => onSetAppMode('profile')}><AtSignIcon size={12} className="text-blue-400" /> {partner ? (partner as User).email : 'N/A'}</p>
                                                                {partner && (partner as User).phone && <p className="text-xs font-bold flex items-center gap-2 cursor-pointer hover:text-emerald-400" onClick={() => onSetAppMode('profile')}><PaperAirplaneIcon size={12} className="text-emerald-400 rotate-90" /> {(partner as User).phone}</p>}
                                                            </div>
                                                            <p className="mt-3 pt-3 border-t border-slate-800 text-[9px] text-slate-500 font-bold uppercase tracking-widest">Click name or contact to view full CV</p>
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {isOrg ? (partner as any).type : (partner as User).roles?.find(r => ['Buyer', 'seller', 'worker', 'Agronomist', 'Agro-Shop'].includes(r || ''))?.toUpperCase() || 'PARTNER'}
                                                    </span>
                                                </div>

                                                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => onForwardToAnalyst?.({ 
                                                            name: partner.name, 
                                                            region: partner.region, 
                                                            crops: partnerCrops.map(c => c.name),
                                                            areaHa: (partner as any).areaHa
                                                        })}
                                                        className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors"
                                                        title="Forward to Market Intelligence"
                                                    >
                                                        <SparklesIcon size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Hover Tooltip Details */}
                                            {hoveredPartnerId === partner.id && (
                                                <div className="absolute left-6 top-0 -translate-y-full mb-2 z-[3000] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl w-48 animate-slide-up pointer-events-none">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Entity Details</p>
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[10px] font-bold">
                                                            <span className="text-slate-400">Region:</span>
                                                            <span>{partner.region || 'All'}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] font-bold">
                                                            <span className="text-slate-400">Crops:</span>
                                                            <span className="text-right truncate ml-2">{partnerCrops.length > 0 ? partnerCrops[0].name : 'N/A'}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] font-bold">
                                                            <span className="text-slate-400">Area:</span>
                                                            <span>{(partner as any).areaHa || 0} ha</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <p className="text-[11px] font-medium text-slate-500 line-clamp-2 mb-4 leading-relaxed tracking-tight italic uppercase">
                                                {(partner as any).publicData?.description || (partner as any).description || `${isOrg ? (partner as any).type : (partner as User).roles?.join(', ')} active in ${partner.region || 'Georgia'}.`}
                                            </p>

                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setQuickMessageRecipient({ 
                                                            id: partner.id, 
                                                            name: partner.name, 
                                                            type: isOrg ? 'org' : 'user' 
                                                        });
                                                    }}
                                                    className="flex-grow py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
                                                >
                                                    Message
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const latlng = (partner as any).location;
                                                        if (latlng && Array.isArray(latlng) && latlng.length === 2) {
                                                            const lat = typeof latlng[0] === 'string' ? parseFloat(latlng[0]) : latlng[0];
                                                            const lng = typeof latlng[1] === 'string' ? parseFloat(latlng[1]) : latlng[1];
                                                            if (!isNaN(lat) && !isNaN(lng)) {
                                                                props.onSetFlyToBounds([[lat - 0.005, lng - 0.005], [lat + 0.005, lng + 0.005]]);
                                                            } else {
                                                                toast.error("Invalid partner location.");
                                                            }
                                                        } else {
                                                            toast.info("Partner has no registered map location.");
                                                        }
                                                    }}
                                                    className="p-3.5 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-2xl transition-all border border-slate-100"
                                                >
                                                    <MapPinIcon size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Resizable Divider between Communicator Panel and Map */}
            <ResizableDivider 
                direction="horizontal"
                currentSize={communicatorPanelWidth}
                onResize={(newWidth) => setCommunicatorPanelWidth(newWidth)}
                minSize={300}
                maxSize={typeof window !== 'undefined' ? Math.max(window.innerWidth - 300, 600) : 900}
                storageKey="communicator_panel_width"
                isKa={localStorage.getItem('agri-app-lang') === 'ka'}
                className="hidden md:flex"
            />

            {/* Map Area */}
            <div className="flex-1 h-full relative overflow-hidden bg-slate-200">
                <MapComponent 
                    {...mapProps} 
                    showSearch={false} 
                    externalUsers={mainTab === 'PARTNERS' ? (allUsers || []).filter(u => 
                        (u.isPubliclyVisible || u.isProfileDiscoverable) && 
                        (u.location || u.workingArea?.center)
                    ) : []} 
                    externalOrganizations={mainTab === 'PARTNERS' ? (organizations || []).filter(o => 
                        o.isDiscoverable && (o.location || o.areaGeometry)
                    ) : []}
                    onMapClick={(ll) => {
                        // Region search trigger
                        if (mainTab === 'PARTNERS') setSearchQuery(`${ll.lat.toFixed(2)}, ${ll.lng.toFixed(2)}`);
                    }}
                />
                
                {/* Map Overlays */}
                <StatsCard buyers={stats.buyers} sellers={stats.sellers} workers={stats.workers} />
                
                <div className="absolute top-6 left-6 z-[1000]">
                    <span className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-blue-200">
                        <ShieldCheckIcon size={16}/> Partner Checkpoints Enabled
                    </span>
                </div>

                <div className="absolute bottom-6 right-6 z-[1000]">
                    <button onClick={() => setMainTab('PARTNERS')} className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl border border-indigo-50 hover:bg-indigo-50 transition-all flex items-center gap-2">
                        <SparklesIcon size={18}/> AI Partner Helper
                    </button>
                </div>
            </div>

            {quickMessageRecipient && (
                <QuickMessageModal 
                    isOpen={!!quickMessageRecipient}
                    onClose={() => setQuickMessageRecipient(null)}
                    recipientName={quickMessageRecipient.name}
                    onSend={(text, type) => {
                        if (type === 'chat') {
                             onAddPost({
                                title: `Direct Session: ${quickMessageRecipient.name}`,
                                content: text,
                                isDirectMessage: true,
                                recipientId: quickMessageRecipient.id,
                                recipientName: quickMessageRecipient.name,
                                hubType: 'internal'
                            });
                            setMainTab('COMMUNICATOR');
                        } else {
                             onAddPost({
                                title: `Official Ticket for ${quickMessageRecipient.name}`,
                                content: `[TICKET-REQUEST]\n${text}`,
                                isDirectMessage: false,
                                hubType: 'internal'
                            });
                            toast.success("Ticket dispatched to company logistics.");
                            if (setAlerts) {
                                setAlerts(prev => [{
                                    id: `ticket-${Date.now()}`,
                                    title: 'Ticket Dispatched',
                                    content: `Your official ticket for ${quickMessageRecipient.name} has been recorded in the logistics ledger.`,
                                    type: 'success',
                                    timestamp: new Date().toISOString(),
                                    isRead: false
                                } as any, ...prev]);
                            }
                        }
                    }}
                />
            )}
        </main>
    );
};

export default CommunicationHubPanel;
