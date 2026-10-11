import React, { useState } from 'react';
import type { Employee } from '../types';
import { 
    Users, Video, MessageSquare, Radio, PhoneCall, 
    ChevronRight, Shield, Sparkles, Send, CheckCircle2,
    ExternalLink, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export interface TeamHubsWidgetProps {
    employees?: Employee[];
    onOpenMeet?: () => void;
    onOpenIntercom?: () => void;
    onNavigateMode?: (mode: string) => void;
}

export const TeamHubsWidget: React.FC<TeamHubsWidgetProps> = ({
    employees = [],
    onOpenMeet,
    onOpenIntercom,
    onNavigateMode
}) => {
    const { t } = useLanguage();
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const handleOpenIntercomChat = () => {
        if (onOpenIntercom) {
            onOpenIntercom();
        } else {
            window.dispatchEvent(new CustomEvent('agrimap_open_intercom'));
        }
    };

    const handleSendBroadcast = (e: React.FormEvent) => {
        e.preventDefault();
        if (!broadcastMsg.trim()) return;
        setIsBroadcasting(true);
        setTimeout(() => {
            setIsBroadcasting(false);
            toast.success(`Broadcast sent to ${employees.length || 8} field operators`);
            setBroadcastMsg('');
        }, 600);
    };

    const defaultStaff = [
        { name: 'David Beridze', role: 'Chief Agronomist', status: 'In Sector B', online: true },
        { name: 'Levan M.', role: 'Trench Supervisor', status: 'Active (Line 12)', online: true },
        { name: 'Nino K.', role: 'Quality & Weigh Master', status: 'Scale Station 1', online: true },
        { name: 'Giorgi T.', role: 'Irrigation Tech', status: 'Pump Station', online: false }
    ];

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col justify-between">
            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('dash.widget.team_hubs')}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
                                {t('team_widget.live_radio')}
                            </span>
                        </div>
                        <p className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
                            {t('team_widget.on_duty_count', { count: String(employees.length || 8) })}
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleOpenIntercomChat}
                            className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl border border-indigo-100 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-black uppercase tracking-wider group"
                            title="Open Intercom Chat Pop-up"
                        >
                            <MessageSquare size={16} className="group-hover:scale-110 transition-transform text-indigo-600" />
                            <span className="hidden sm:inline">Intercom</span>
                        </button>
                        <div className="p-2.5 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600">
                            <Users size={18} />
                        </div>
                    </div>
                </div>

                {/* Quick Call, Radio & Intercom Pop-up Bar */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (onOpenMeet) onOpenMeet();
                            else window.dispatchEvent(new CustomEvent('agrimap_open_meet'));
                        }}
                        className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-xs shadow-blue-200 flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer active:scale-95 group text-center"
                        title="Start Google Meet"
                    >
                        <Video size={15} className="group-hover:scale-110 transition-transform shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-wider truncate">{t('team_widget.start_meet')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            toast.info('Team Walkie-Talkie Radio Channel 1 connected');
                        }}
                        className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl transition-all shadow-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer active:scale-95 group text-center"
                        title="Radio Dispatch Channel"
                    >
                        <Radio size={15} className="text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-wider truncate">{t('team_widget.radio_dispatch')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenIntercomChat}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-xs shadow-indigo-200 flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer active:scale-95 group text-center"
                        title="Open Intercom Chat Pop-up Window"
                    >
                        <MessageSquare size={15} className="text-indigo-200 group-hover:scale-110 transition-transform shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-wider truncate">Intercom</span>
                    </button>
                </div>

                {/* Key On-Duty Crew List */}
                <div className="space-y-1.5 mb-3">
                    {defaultStaff.map((staff, idx) => (
                        <div 
                            key={idx}
                            onClick={handleOpenIntercomChat}
                            className="p-2 bg-slate-50/80 hover:bg-indigo-50/40 rounded-xl border border-slate-100 hover:border-indigo-200 flex items-center justify-between text-xs cursor-pointer transition-all group/staff"
                            title={`Open Intercom Transmission with ${staff.name}`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${staff.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <div className="truncate">
                                    <span className="font-black text-slate-800 text-xs block truncate group-hover/staff:text-indigo-700">{staff.name}</span>
                                    <span className="text-[9px] text-slate-400 font-medium">{staff.role} • {staff.status}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[8px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                    {staff.online ? t('team_widget.online') : t('team_widget.standby')}
                                </span>
                                <span className="p-1 text-slate-400 group-hover/staff:text-indigo-600 opacity-0 group-hover/staff:opacity-100 transition-opacity">
                                    <MessageSquare size={12} />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Broadcast message input */}
                <form onSubmit={handleSendBroadcast} className="flex items-center gap-1.5">
                    <input
                        type="text"
                        value={broadcastMsg}
                        onChange={(e) => setBroadcastMsg(e.target.value)}
                        placeholder={t('team_widget.broadcast_placeholder')}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-blue-400 font-medium"
                    />
                    <button
                        type="submit"
                        disabled={isBroadcasting || !broadcastMsg.trim()}
                        className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-all shrink-0 cursor-pointer"
                        title={t('team_widget.send_broadcast')}
                    >
                        <Send size={13} />
                    </button>
                </form>
            </div>

            {/* Operational footer buttons */}
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleOpenIntercomChat}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-xs shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Open Intercom Chat in Pop-up Window"
                >
                    <MessageSquare size={13} />
                    <span>Open Intercom Pop-up</span>
                    <ExternalLink size={12} />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (onNavigateMode) onNavigateMode('tools');
                        else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'tools' }));
                    }}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    title="Open System Tools"
                >
                    <span>{t('team_widget.open_team_hub')}</span>
                    <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
};
