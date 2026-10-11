import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { 
    X, Search, Send, Check, PlusCircle, Users, 
    Paperclip, MapPin, Mic, Maximize2, Minimize2, 
    ShieldCheck, ExternalLink, Radio, MessageSquare
} from 'lucide-react';
import type { 
    User, ForumPost, PlantationFeature, Membership, 
    Organization, Employee, Role 
} from '../types';
import type { MapComponentProps } from './MapComponent';

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const MessageInput: React.FC<{
    onSend: (msg: Partial<ForumPost>) => void;
    conversationId: string | null;
    currentUser: User | null;
    mapProps?: any;
}> = ({ onSend, conversationId, currentUser, mapProps }) => {
    const [text, setText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const handleSend = (attachment?: any) => {
        if ((!text.trim() && !attachment) || !conversationId || !currentUser) return;
        
        onSend({
            content: text,
            attachment
        });
        setText('');
    };
    
    const handleVoiceRecord = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            mediaRecorderRef.current.ondataavailable = e => chunks.push(e.data);
            mediaRecorderRef.current.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const dataUrl = await fileToDataUrl(new File([blob], "voice.webm"));
                handleSend({ type: 'audio', payload: dataUrl, mimeType: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Microphone access denied:", err);
            const errorMsg = err instanceof Error ? err.message : String(err);
            toast.error("Microphone Access Failed", {
                description: `${errorMsg}. Try opening in a new tab if you are in an iframe.`,
                duration: 6000,
            });
        }
    };
    
    const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const dataUrl = await fileToDataUrl(file);
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        handleSend({ type, payload: dataUrl, mimeType: file.type, fileName: file.name, fileSize: file.size });
    };

    const handleAttachMap = () => {
        handleSend({ 
            type: 'geo', 
            payload: { 
                center: mapProps?.center || [42.14, 42.45], 
                zoom: mapProps?.zoom || 13,
                name: "Current Viewport" 
            } 
        });
    };

    return (
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <input type="file" id="file-attach-teamhub" className="hidden" onChange={handleFileAttach} />
            <button 
                type="button"
                onClick={() => document.getElementById('file-attach-teamhub')?.click()} 
                className="p-2 sm:p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all cursor-pointer"
                title="Attach Document or Photo"
            >
                <Paperclip className="h-4 w-4 sm:h-5 sm:w-5"/>
            </button>
            <button 
                type="button"
                onClick={handleAttachMap} 
                className="p-2 sm:p-3 text-slate-400 hover:text-emerald-500 hover:bg-white rounded-xl transition-all cursor-pointer" 
                title="Attach Map Coordinates View"
            >
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5"/>
            </button>
            <button 
                type="button"
                onClick={handleVoiceRecord} 
                className={`p-2 sm:p-3 rounded-xl transition-all cursor-pointer ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-red-500 hover:bg-white'}`}
                title="Record Voice Note"
            >
                <Mic className="h-4 w-4 sm:h-5 sm:w-5"/>
            </button>
            <input 
                value={text} 
                onChange={e => setText(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), handleSend()) : null} 
                placeholder="Type a transmission message..." 
                className="flex-grow p-2 sm:p-3 bg-transparent text-xs font-bold text-slate-700 outline-none placeholder:text-slate-400 min-w-0"
            />
            <button 
                type="button"
                onClick={() => handleSend()} 
                disabled={!text.trim()}
                className="p-2 sm:p-3 bg-blue-600 disabled:opacity-40 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all cursor-pointer shrink-0"
                title="Send Message"
            >
                <Send className="h-4 w-4 sm:h-5 sm:w-5"/>
            </button>
        </div>
    );
};

export interface TeamHubManagerProps {
    currentUser: User | null;
    forumPosts: ForumPost[];
    onAddPost: (post: Partial<ForumPost>) => void;
    onAddReply?: (postId: string, content: string) => void;
    onUpdatePost?: (postId: string, updates: Partial<ForumPost>) => void;
    allUsers?: User[];
    memberships?: Membership[];
    onSetMemberships?: (memberships: Membership[]) => void;
    activeOrgId?: string | null;
    employees?: Employee[];
    onSetEmployees?: (employees: Employee[]) => void;
    users?: User[];
    onSetUsers?: (users: User[]) => void;
    roles?: Role[];
    plantationFeatures?: PlantationFeature[];
    mapProps?: any;
    onOpenPopUp?: () => void;
    isPopUp?: boolean;
    onClose?: () => void;
}

export const TeamHubManager: React.FC<TeamHubManagerProps> = ({
    currentUser,
    forumPosts = [],
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
    mapProps,
    onOpenPopUp,
    isPopUp = false,
    onClose
}) => {
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [mode, setMode] = useState<'dm' | 'group'>('dm');
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Group posts into conversations
    const conversations = useMemo(() => {
        if (!currentUser) return [];
        const convos: { [key: string]: ForumPost } = {};
        
        forumPosts.forEach(post => {
            if (post.hubType !== 'internal') return;
            
            if (post.isDirectMessage) {
                if (post.authorId === currentUser.id || post.recipientId === currentUser.id) {
                    const otherUserId = post.authorId === currentUser.id ? post.recipientId : post.authorId;
                    if (otherUserId) {
                        const key = [currentUser.id, otherUserId].sort().join('-');
                        if (!convos[key] || new Date(post.timestamp) > new Date(convos[key].timestamp)) {
                            convos[key] = post;
                        }
                    }
                }
            } else if (post.channelId) {
                if (!convos[post.channelId] || new Date(post.timestamp) > new Date(convos[post.channelId].timestamp)) {
                    convos[post.channelId] = post;
                }
            }
        });
        
        return Object.values(convos).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [forumPosts, currentUser]);

    // Select first conversation if none selected
    useEffect(() => {
        if (!activeConversationId && conversations.length > 0) {
            setActiveConversationId(conversations[0].id);
        }
    }, [conversations, activeConversationId]);

    // Scroll to bottom when conversation messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [forumPosts, activeConversationId]);
    
    if (!currentUser) {
        return (
            <div className="p-16 text-center font-black uppercase tracking-widest text-slate-300 text-xs">
                Please log in to access the Team Hub Intercom.
            </div>
        );
    }
    
    const activeMessages = forumPosts.filter(p => {
        if (!activeConversationId) return false;
        const activeConvo = conversations.find(c => c.id === activeConversationId);
        if (!activeConvo) return false;
        
        if (activeConvo.isDirectMessage) {
            const otherUserId = activeConvo.authorId === currentUser.id ? activeConvo.recipientId : activeConvo.authorId;
            return p.isDirectMessage && ((p.authorId === currentUser.id && p.recipientId === otherUserId) || (p.recipientId === currentUser.id && p.authorId === otherUserId));
        } else {
            return p.channelId === activeConvo.channelId;
        }
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const getUserName = (id: string) => {
        const found = allUsers.find(u => u.id === id) || users.find(u => u.id === id);
        return found?.name || id.slice(0, 6);
    };

    const startNewDm = (targetUser: User) => {
        const existingConvo = conversations.find(c => c.isDirectMessage && (c.authorId === targetUser.id || c.recipientId === targetUser.id));
        if (existingConvo) {
            setActiveConversationId(existingConvo.id);
        } else {
            const tempId = `temp-${Date.now()}`;
            onAddPost({
                id: tempId,
                content: `Start of conversation with ${targetUser.name}`,
                authorId: currentUser.id,
                recipientId: targetUser.id,
                isDirectMessage: true,
                hubType: 'internal',
                timestamp: new Date().toISOString(),
                replies: []
            });
            setActiveConversationId(tempId);
        }
        setShowUserSearch(false);
        setUserSearchTerm('');
    };

    const createGroupChat = () => {
        if (!groupName || selectedUsers.size === 0) return;
        const channelId = `group-${Date.now()}`;
        const participants = Array.from(selectedUsers);
        onAddPost({
            title: groupName,
            content: `Group conversation "${groupName}" created`,
            authorId: currentUser.id,
            channelId: channelId,
            hubType: 'internal',
            isDirectMessage: false,
            participantIds: [currentUser.id, ...participants],
            timestamp: new Date().toISOString(),
            replies: []
        });
        setActiveConversationId(channelId);
        setShowUserSearch(false);
        setGroupName('');
        setSelectedUsers(new Set());
    };

    const searchableUsers = useMemo(() => {
        const pool = allUsers.length > 0 ? allUsers : users;
        if (!userSearchTerm) return pool.filter(u => u.id !== currentUser.id);
        return pool.filter(u => 
            u.id !== currentUser.id && 
            (u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
             u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
             u.personalNumber?.toLowerCase().includes(userSearchTerm.toLowerCase()))
        );
    }, [allUsers, users, currentUser.id, userSearchTerm]);

    return (
        <div className={`bg-white ${isPopUp ? 'h-full w-full' : 'rounded-[2.5rem] shadow-sm border border-slate-100 h-[650px]'} overflow-hidden flex flex-col md:flex-row relative`}>
            {/* New Conversation Modal Layer */}
            {showUserSearch && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-6 sm:p-10 flex flex-col items-center animate-in zoom-in duration-200 overflow-y-auto">
                    <button 
                        type="button"
                        onClick={() => setShowUserSearch(false)} 
                        className="absolute top-6 right-6 p-2.5 hover:bg-slate-100 rounded-full transition-all cursor-pointer text-slate-500"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    
                    <div className="w-full max-w-2xl space-y-6 sm:space-y-8 my-auto">
                        <div className="text-center">
                            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                                New <span className="text-blue-600">Conversation</span>
                            </h2>
                            <p className="text-xs font-bold text-slate-400 mt-2">Transmit encrypted direct message or establish crew group channel</p>
                            <div className="flex justify-center gap-3 sm:gap-4 mt-6">
                                <button 
                                    type="button"
                                    onClick={() => setMode('dm')} 
                                    className={`px-5 sm:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${mode === 'dm' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    Direct Message
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setMode('group')} 
                                    className={`px-5 sm:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${mode === 'group' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    Group Chat
                                </button>
                            </div>
                        </div>

                        {mode === 'group' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Channel Name</label>
                                <input 
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-all" 
                                    placeholder="Scientific Unit Alpha, Field Team Bravo..." 
                                    value={groupName}
                                    onChange={e => setGroupName(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="relative">
                            <Search className="h-5 w-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"/>
                            <input 
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-all" 
                                placeholder={mode === 'dm' ? "Search by name, email, or ID number..." : "Select crew members to invite..."} 
                                value={userSearchTerm}
                                onChange={e => setUserSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-1">
                            {(searchableUsers || []).map(user => (
                                <div key={user.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-300 transition-all">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-700 shrink-0">
                                            {(user?.name && typeof user.name === 'string') ? user.name.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div className="min-w-0 truncate">
                                            <p className="text-xs font-black text-slate-800 truncate">{user?.name || 'Unknown User'}</p>
                                            <p className="text-[9px] font-bold text-slate-400 truncate">{user?.email || user?.personalNumber || 'No email'}</p>
                                        </div>
                                    </div>
                                    {mode === 'dm' ? (
                                        <button 
                                            type="button"
                                            onClick={() => startNewDm(user)} 
                                            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all cursor-pointer shrink-0 ml-2"
                                            title="Start DM"
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                    ) : (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const next = new Set(selectedUsers);
                                                next.has(user.id) ? next.delete(user.id) : next.add(user.id);
                                                setSelectedUsers(next);
                                            }}
                                            className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 ml-2 ${selectedUsers.has(user.id) ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {searchableUsers.length === 0 && (
                                <div className="col-span-2 p-8 text-center text-xs font-bold text-slate-400">
                                    No matching users found.
                                </div>
                            )}
                        </div>

                        {mode === 'group' && selectedUsers.size > 0 && (
                            <button 
                                type="button"
                                onClick={createGroupChat}
                                className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 cursor-pointer"
                            >
                                Establish Channel ({selectedUsers.size} Members)
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Left Intercom Threads Sidebar */}
            <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50 flex flex-col shrink-0">
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest leading-none">
                            Intercom
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200">
                            {conversations.length} Active
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button 
                            type="button"
                            onClick={() => setShowUserSearch(true)} 
                            className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all cursor-pointer"
                            title="New Transmission Channel"
                        >
                            <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        {!isPopUp && onOpenPopUp && (
                            <button 
                                type="button"
                                onClick={onOpenPopUp} 
                                className="p-2 bg-slate-100 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                                title="Open in Pop-up Window"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto max-h-48 md:max-h-none divide-y divide-slate-100/60">
                    {conversations.map(convo => {
                        const otherUserId = convo.isDirectMessage ? (convo.authorId === currentUser.id ? convo.recipientId : convo.authorId) : undefined;
                        const name = otherUserId ? getUserName(otherUserId!) : (convo.title || convo.channelId || 'Group');
                        const isActive = activeConversationId === convo.id;
                        return (
                            <button 
                                key={convo.id} 
                                type="button"
                                onClick={() => setActiveConversationId(convo.id)} 
                                className={`w-full text-left p-4 sm:p-5 transition-all cursor-pointer ${isActive ? 'bg-white shadow-inner border-l-4 border-l-blue-600' : 'hover:bg-white/80'}`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className={`font-black text-xs uppercase tracking-tight truncate ${isActive ? 'text-blue-600' : 'text-slate-800'}`}>
                                        {name}
                                    </p>
                                    <span className="text-[8px] font-bold text-slate-400 shrink-0">
                                        {new Date(convo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-wider">
                                    {convo.content}
                                </p>
                            </button>
                        );
                    })}
                    {conversations.length === 0 && (
                        <div className="p-8 text-center space-y-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-full mx-auto flex items-center justify-center">
                                <Users className="h-5 w-5 text-slate-300" />
                            </div>
                            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">
                                System Standby.<br/>Start a secure channel.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Message Stream / Active Transmission Terminal */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0">
                {activeConversationId ? (
                    <>
                        {/* Conversation Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white">
                            <div className="min-w-0 flex items-center gap-2">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest truncate">
                                    {conversations.find(c => c.id === activeConversationId)?.isDirectMessage 
                                        ? getUserName(conversations.find(c => c.id === activeConversationId)?.authorId === currentUser.id 
                                            ? conversations.find(c => c.id === activeConversationId)?.recipientId! 
                                            : conversations.find(c => c.id === activeConversationId)?.authorId!)
                                        : (conversations.find(c => c.id === activeConversationId)?.title || conversations.find(c => c.id === activeConversationId)?.channelId || 'Group Transmission')}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Secure Wave
                                </span>
                            </div>
                        </div>

                        {/* Messages Stream */}
                        <div className="flex-grow p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto bg-slate-50/20">
                            {(activeMessages || []).map(msg => {
                                const isMe = msg.authorId === currentUser.id;
                                const authorName = getUserName(msg.authorId) || 'User';
                                return (
                                    <div key={msg.id} className={`flex items-end gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${isMe ? 'justify-end' : ''}`}>
                                        {!isMe && (
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-blue-600 shadow-xs mb-1 uppercase">
                                                {(authorName && typeof authorName === 'string') ? authorName.charAt(0) : 'U'}
                                            </div>
                                        )}
                                        <div className={`p-3.5 sm:p-4 rounded-3xl max-w-[85%] sm:max-w-[78%] shadow-xs ${isMe ? 'bg-slate-900 text-white rounded-br-xs' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-xs'}`}>
                                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isMe ? 'text-slate-400' : 'text-blue-600'}`}>
                                                {isMe ? "Sent by You" : authorName}
                                            </p>
                                            {msg.attachment?.type === 'geo' && (
                                                <div className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 bg-slate-800/40 p-2.5 rounded-2xl text-emerald-300">
                                                    <MapPin className="h-4 w-4" /> Location Shared
                                                </div>
                                            )}
                                            {msg.attachment?.type === 'image' && (
                                                <img src={msg.attachment.payload as string} className="rounded-2xl mb-2 max-h-60 w-full object-cover border border-white/10" alt="attachment" />
                                            )}
                                            {msg.attachment?.type === 'audio' && (
                                                <audio controls src={msg.attachment.payload as string} className="w-full h-8 mb-2 opacity-90" />
                                            )}
                                            
                                            {msg.title === 'Join Request' && !memberships.some(m => m.userId === msg.authorId && m.organizationId === activeOrgId) && !isMe && (
                                                <div className="mb-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left">
                                                    <p className="text-[10px] font-black text-blue-800 uppercase mb-3">Professional Connection Request</p>
                                                    <div className="mb-3">
                                                        <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Grant Connection Role:</label>
                                                        <select 
                                                            id={`role-select-${msg.id}`}
                                                            className="w-full p-2 bg-white border border-slate-200 text-xs rounded-xl font-bold text-slate-700 outline-none"
                                                            defaultValue="Employee"
                                                        >
                                                            <option value="Employee">Employee / Staff</option>
                                                            <option value="Admin">Administrator</option>
                                                            <option value="Field Manager">Field Manager</option>
                                                        </select>
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const selectEl = document.getElementById(`role-select-${msg.id}`) as HTMLSelectElement;
                                                            const selectedRole = selectEl ? selectEl.value : 'Employee';
                                                            const permissionLevel = selectedRole === 'Admin' ? 'admin' : selectedRole === 'Field Manager' ? 'write' : 'read';

                                                            if (activeOrgId && onSetMemberships) {
                                                                const newMem: Membership = {
                                                                    id: `${msg.authorId}_${activeOrgId}`,
                                                                    userId: msg.authorId,
                                                                    organizationId: activeOrgId,
                                                                    role: selectedRole as any,
                                                                    status: 'active',
                                                                    joinedAt: new Date().toISOString(),
                                                                    permissionLevel: permissionLevel
                                                                };
                                                                onSetMemberships([...memberships, newMem]);

                                                                const requestingUser = users?.find(u => u.id === msg.authorId) || allUsers.find(u => u.id === msg.authorId);
                                                                if (onSetEmployees && employees) {
                                                                    const roleId = roles?.find(r => r.name === selectedRole)?.id || roles?.[0]?.id || '';
                                                                    const newEmp: Employee = {
                                                                        id: `emp-${msg.authorId}-${activeOrgId}`,
                                                                        name: requestingUser?.name || 'Authorized Partner',
                                                                        email: requestingUser?.email || '',
                                                                        phone: requestingUser?.phone || '',
                                                                        idNumber: requestingUser?.personalNumber || '',
                                                                        roleId: roleId,
                                                                        paymentType: 'hourly',
                                                                        paymentRate: 0,
                                                                        barcode: `BC-${Date.now()}`,
                                                                        employeeType: 'Permanent',
                                                                        accountType: 'Bank Account',
                                                                        status: 'active',
                                                                        joinedAt: new Date().toISOString(),
                                                                        organizationId: activeOrgId,
                                                                        isGlobalUser: true
                                                                    };
                                                                    onSetEmployees([...employees, newEmp]);
                                                                }

                                                                if (requestingUser && onSetUsers && users) {
                                                                    const updatedUser = {
                                                                        ...requestingUser,
                                                                        roles: [selectedRole as any, ...(requestingUser.roles || []).filter(r => r !== selectedRole && r !== 'Guest')]
                                                                    };
                                                                    onSetUsers(users.map(u => u.id === requestingUser.id ? updatedUser : u));
                                                                }

                                                                onAddPost({
                                                                    content: `Welcome to the team! Your request to join as ${selectedRole} has been accepted.`,
                                                                    channelId: 'internal',
                                                                    hubType: 'internal',
                                                                    isDirectMessage: true,
                                                                    recipientId: msg.authorId,
                                                                    replies: []
                                                                });

                                                                toast.success(`User accepted as ${selectedRole}`);
                                                            }
                                                        }}
                                                        className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                                    >
                                                        <Check size={14} /> Accept Request
                                                    </button>
                                                </div>
                                            )}
                                            
                                            <p className="text-xs font-bold leading-relaxed">{msg.content}</p>
                                            <p className="text-[8px] font-bold opacity-40 mt-2 text-right">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 sm:p-4 border-t border-slate-100 flex-shrink-0 bg-white">
                            <MessageInput 
                                onSend={(msg) => {
                                    const activeConvo = conversations.find(c => c.id === activeConversationId);
                                    if (!activeConvo) return;
                                    
                                    const partial: Partial<ForumPost> = {
                                        ...msg,
                                        hubType: 'internal',
                                        isDirectMessage: activeConvo.isDirectMessage,
                                        timestamp: new Date().toISOString(),
                                        authorId: currentUser.id,
                                        authorName: currentUser.name,
                                        replies: []
                                    };

                                    if (activeConvo.isDirectMessage) {
                                        const otherUserId = activeConvo.authorId === currentUser.id ? activeConvo.recipientId : activeConvo.authorId;
                                        partial.recipientId = otherUserId;
                                        partial.channelId = 'direct';
                                    } else {
                                        partial.channelId = activeConvo.channelId;
                                        partial.participantIds = activeConvo.participantIds;
                                    }
                                    
                                    onAddPost(partial);
                                }} 
                                conversationId={activeConversationId} 
                                currentUser={currentUser} 
                                mapProps={mapProps} 
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-8 sm:p-14 animate-in fade-in duration-300">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 sm:mb-8 border border-slate-100">
                            <Users className="h-8 w-8 sm:h-10 sm:w-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-slate-400 uppercase tracking-tight">
                            Communications <span className="text-slate-300">Terminal</span>
                        </h3>
                        <p className="mt-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] max-w-[220px]">
                            Select any active frequency to begin transmission.
                        </p>
                        <button 
                            type="button"
                            onClick={() => setShowUserSearch(true)} 
                            className="mt-8 sm:mt-10 px-6 sm:px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-100 cursor-pointer"
                        >
                            Initialize Wave
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
