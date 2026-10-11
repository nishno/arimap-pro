import React, { useState } from 'react';
import { PresenceUser } from '../../../new_engine/types';
import { XIcon } from '../Icons';
import { Users, Wifi, Shield, Activity, Clock, CheckCircle2, Search, Smartphone } from 'lucide-react';

interface OnlineUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: PresenceUser[];
    eventName?: string;
    eventId?: string;
}

export const OnlineUsersModal: React.FC<OnlineUsersModalProps> = ({
    isOpen,
    onClose,
    users = [],
    eventName,
    eventId
}) => {
    const isKa = localStorage.getItem('agri-app-lang') === 'ka';
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    // Filter users based on search
    const filteredUsers = users.filter(u => 
        (u.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.activeView || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleBadgeColor = (role?: string) => {
        const r = (role || '').toLowerCase();
        if (r.includes('admin') || r.includes('root')) return 'bg-purple-100 text-purple-800 border-purple-200';
        if (r.includes('weigher') || r.includes('operator')) return 'bg-amber-100 text-amber-800 border-amber-200';
        if (r.includes('agronomist') || r.includes('agro')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        if (r.includes('manager') || r.includes('supervisor')) return 'bg-blue-100 text-blue-800 border-blue-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3500] flex items-center justify-center p-3 sm:p-6 animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 flex items-center justify-center relative">
                            <Users size={22} />
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                                {isKa ? 'აქტიური ონლაინ მომხმარებლები' : 'Active Online Team Members'}
                            </h2>
                            <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                <Wifi size={12} className="text-emerald-400" />
                                {eventName ? `${eventName} (${eventId || ''})` : (isKa ? 'ლაივ მონიტორინგი' : 'Live Session Monitoring')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white cursor-pointer">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Sub-Header & Search */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wide">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 font-extrabold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            {users.length} {isKa ? 'მომხმარებელი' : 'Active'}
                        </span>
                        <span className="text-slate-400 text-[10px] font-bold">
                            {isKa ? 'რეალურ დროში სინქრონიზებული' : 'Real-Time Presence Engine Active'}
                        </span>
                    </div>

                    {users.length > 3 && (
                        <div className="relative w-full sm:w-48">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={isKa ? 'ძებნა...' : 'Search user...'}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                            />
                        </div>
                    )}
                </div>

                {/* Users List */}
                <div className="p-4 overflow-y-auto space-y-2.5 flex-1 max-h-[50vh]">
                    {filteredUsers.length === 0 ? (
                        <div className="py-10 text-center space-y-2 text-slate-400">
                            <Users size={32} className="mx-auto text-slate-300" />
                            <p className="text-xs font-bold uppercase tracking-wide">
                                {isKa ? 'ონლაინ მომხმარებლები არ მოიძებნა' : 'No active users found'}
                            </p>
                        </div>
                    ) : (
                        filteredUsers.map((user) => {
                            const lastActiveDate = user.lastActiveTimestamp ? new Date(user.lastActiveTimestamp) : new Date();
                            const timeAgoSeconds = Math.max(0, Math.floor((Date.now() - lastActiveDate.getTime()) / 1000));
                            const timeAgoText = timeAgoSeconds < 10 
                                ? (isKa ? 'ახლახანს' : 'Just now')
                                : timeAgoSeconds < 60 
                                ? (isKa ? `${timeAgoSeconds} წამის წინ` : `${timeAgoSeconds}s ago`)
                                : (isKa ? `${Math.floor(timeAgoSeconds / 60)} წუთის წინ` : `${Math.floor(timeAgoSeconds / 60)}m ago`);

                            return (
                                <div 
                                    key={user.userId}
                                    className="p-3.5 bg-white border border-slate-100 hover:border-slate-200 rounded-2xl shadow-sm flex items-center justify-between gap-3 transition-all hover:shadow-md"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-sm flex items-center justify-center uppercase shadow-sm">
                                                {user.userName ? user.userName.substring(0, 2) : 'US'}
                                            </div>
                                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-xs"></span>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-xs sm:text-sm font-black text-slate-800 truncate">
                                                    {user.userName || 'Operator'}
                                                </h4>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${getRoleBadgeColor(user.role)}`}>
                                                    {user.role || 'Team Member'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5 truncate">
                                                <Activity size={11} className="text-indigo-500 flex-shrink-0" />
                                                <span>{user.activeView || 'Harvesting Module'}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 flex items-center gap-1 justify-end">
                                            <CheckCircle2 size={10} />
                                            {isKa ? 'აქტიური' : 'Active'}
                                        </span>
                                        <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 justify-end mt-1">
                                            <Clock size={10} />
                                            {timeAgoText}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Smartphone size={13} />
                        {isKa ? 'ტაბლეტის სესიის მონიტორინგი' : 'Tablet session sync enabled'}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase text-xs tracking-wider transition-colors cursor-pointer"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnlineUsersModal;
