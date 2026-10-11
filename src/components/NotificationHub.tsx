
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircleIcon, BellIcon, AtSignIcon, HashIcon, CheckIcon, TrashIcon } from './Icons';
import { Alert, User } from '../types';

interface NotificationHubProps {
    isOpen: boolean;
    onClose: () => void;
    alerts: Alert[];
    onClearAll: () => void;
    onMarkAsRead: (id: string) => void;
    onAlertClick: (alert: Alert) => void;
    currentUser: User | null;
}

export const NotificationHub: React.FC<NotificationHubProps> = ({ isOpen, onClose, alerts, onClearAll, onMarkAsRead, onAlertClick, currentUser }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[4000]"
                    />
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[4001] flex flex-col pt-safe"
                    >
                        <div className="p-8 border-b flex justify-between items-center bg-slate-900 text-white">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                    <BellIcon className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tight leading-none">Notifications</h2>
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">Updates & Alerts</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-2xl transition-colors">
                                <XCircleIcon className="h-8 w-8 text-white/30" />
                            </button>
                        </div>

                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center px-8">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{alerts.length} New Alerts</span>
                            <button 
                                onClick={onClearAll}
                                className="flex items-center gap-1.5 text-[10px] font-black text-red-600 uppercase tracking-widest hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <TrashIcon size={12} /> Clear All
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 px-8">
                            {alerts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                        <BellIcon className="h-10 w-10 text-slate-300" />
                                    </div>
                                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">All Caught Up</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 leading-relaxed">No new notifications at the moment.</p>
                                </div>
                            ) : (
                                alerts.map(alert => (
                                    <motion.div 
                                        key={alert.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        onClick={() => onAlertClick(alert)}
                                        className={`p-6 rounded-[2rem] border transition-all relative group cursor-pointer hover:shadow-md ${
                                            alert.type === 'error' ? 'bg-red-50 border-red-100' : 
                                            alert.type === 'warning' ? 'bg-amber-50 border-amber-100' : 
                                            'bg-white border-slate-100 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                alert.type === 'error' ? 'bg-red-100 text-red-600' : 
                                                alert.type === 'warning' ? 'bg-amber-100 text-amber-600' : 
                                                'bg-blue-50 text-blue-600'
                                            }`}>
                                                {alert.content.includes('@') ? <AtSignIcon size={20} /> :
                                                 alert.content.includes('#') ? <HashIcon size={20} /> :
                                                 <BellIcon size={20} />}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-black text-slate-900 text-xs uppercase tracking-tight mb-1">{alert.title}</h4>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                                    {renderContentWithMentions(alert.content)}
                                                </p>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4 block">
                                                    {new Date(alert.timestamp).toLocaleTimeString()} • {new Date(alert.timestamp).toLocaleDateString()}
                                                </span>
                                                {alert.actions && alert.actions.length > 0 && (
                                                    <div className="mt-4 flex gap-2">
                                                        {alert.actions.map((action, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (onAlertClick) {
                                                                        onAlertClick({ ...alert, metadata: { ...alert.metadata, _clickedAction: action } });
                                                                    }
                                                                }}
                                                                className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors"
                                                            >
                                                                {action.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => onMarkAsRead(alert.id)}
                                            className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 hover:bg-indigo-600 hover:text-white rounded-xl"
                                        >
                                            <CheckIcon size={14} />
                                        </button>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        <div className="p-8 border-t bg-slate-50 space-y-4">
                            <div className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <AtSignIcon size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Mention Tips</p>
                                    <p className="text-[9px] text-slate-400 font-medium">Use <span className="font-bold text-indigo-600">@user</span> or <span className="font-bold text-emerald-600">#topic</span> in chats to trigger notifications.</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

const renderContentWithMentions = (content?: string) => {
    if (!content) return null;
    const parts = content.split(/(@\w+|#\w+)/g);
    return parts.map((part, i) => {
        if (part.startsWith('@')) {
            return <span key={i} className="text-indigo-600 font-black px-1.5 py-0.5 bg-indigo-50 rounded-lg mx-0.5">{part}</span>;
        }
        if (part.startsWith('#')) {
            return <span key={i} className="text-emerald-600 font-black px-1.5 py-0.5 bg-emerald-50 rounded-lg mx-0.5">{part}</span>;
        }
        return part;
    });
};
