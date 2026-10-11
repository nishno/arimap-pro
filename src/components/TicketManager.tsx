import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, ChevronRight, Building2, Clock, Globe, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import type { OrganizationTicket } from '../types';

interface TicketManagerProps {
    isOpen: boolean;
    onClose: () => void;
    tickets: OrganizationTicket[];
    activeOrgId: string | null;
    onSelectTicket: (ticketId: string) => void;
}

const TicketManager: React.FC<TicketManagerProps> = ({ isOpen, onClose, tickets, activeOrgId, onSelectTicket }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-600 p-2 rounded-lg text-white">
                                    <Ticket size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Map Assets & Tickets</h2>
                                    <p className="text-sm text-gray-500">Switch between your active plantation workspaces</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {tickets.length === 0 ? (
                                <div className="text-center py-12">
                                    <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
                                    <p className="text-gray-500 font-medium">No tickets available</p>
                                    <p className="text-xs text-gray-400 mt-1">Register a company to create your first ticket</p>
                                </div>
                            ) : (
                                tickets.map((ticket) => {
                                    const isActive = ticket.organizationId === activeOrgId;
                                    const isArchived = ticket.status === 'Archived';

                                    return (
                                        <button
                                            key={ticket.id}
                                            onClick={() => onSelectTicket(ticket.id)}
                                            className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 group ${
                                                isActive 
                                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-md' 
                                                    : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                                            } ${isArchived ? 'opacity-75 grayscale-[0.5]' : ''}`}
                                        >
                                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                            }`}>
                                                <Building2 size={28} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className={`font-bold truncate ${isActive ? 'text-indigo-900' : 'text-gray-900'}`}>
                                                        {ticket.name}
                                                    </h3>
                                                    {isActive && (
                                                        <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-black">
                                                            Active Session
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                                    <div className="flex items-center gap-1">
                                                        <ShieldCheck size={14} className={isActive ? 'text-indigo-600' : ''} />
                                                        <span className="font-medium">{ticket.role}</span>
                                                    </div>
                                                    {ticket.years && (
                                                        <div className="flex items-center gap-1">
                                                            <Clock size={14} />
                                                            <span>{ticket.years}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1">
                                                        <Globe size={14} className={ticket.discoverable ? 'text-emerald-600' : 'text-gray-400'} />
                                                        <span>Discoverable: {ticket.discoverable ? 'ON' : 'OFF'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={`p-2 rounded-full transition-all ${
                                                isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white'
                                            }`}>
                                                <ChevronRight size={20} />
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <ShieldAlert size={14} className="text-amber-500" />
                                <span>Switching tickets will reload the workspace data</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-sm transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default TicketManager;
