import React, { useState } from 'react';
import { HarvestEvent, HarvestEntry } from '../../types';
import { XIcon } from '../Icons';
import { Share2, Copy, Check, QrCode, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ShareHarvestEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: HarvestEvent;
    entries?: HarvestEntry[];
}

export const ShareHarvestEventModal: React.FC<ShareHarvestEventModalProps> = ({
    isOpen,
    onClose,
    event,
    entries = []
}) => {
    const isKa = localStorage.getItem('agri-app-lang') === 'ka';
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const netWeight = (event as any).finalNetYieldKg || event.totalNetWeightKg || entries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
    const boxes = (event as any).finalBoxesCount || event.totalBoxes || entries.reduce((s, e) => s + (e.boxCount || 1), 0);
    const pickersCount = event.assignedPickers?.length || new Set(entries.map(e => e.employeeId)).size;

    const shareUrl = `${window.location.origin}/?session=${event.id}`;
    const shareText = `🍇 AgriMap Pro Harvest Report\n📌 Session: ${typeof event.name === 'object' ? (event.name as any).name || event.id : event.name}\n⚖️ Net Weight: ${netWeight.toFixed(1)} KG\n📦 Boxes: ${boxes}\n👥 Active Pickers: ${pickersCount}\n📅 Date: ${new Date(event.plannedStartDate).toLocaleDateString()}\n🔗 Access Link: ${shareUrl}`;

    const handleCopyText = () => {
        navigator.clipboard.writeText(shareText);
        setCopied(true);
        toast.success(isKa ? 'რეპორტის ტექსტი დაკოპირდა ბუფერში' : 'Report copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWebShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Harvest Session: ${event.name}`,
                    text: shareText,
                    url: shareUrl
                });
                toast.success(isKa ? 'წარმატებით გაზიარდა' : 'Shared successfully');
            } catch (err) {
                console.warn('Share cancelled or failed', err);
            }
        } else {
            handleCopyText();
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3500] flex items-center justify-center p-3 sm:p-6 animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                            <Share2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-tight text-white">
                                {isKa ? 'მოსავლის სესიის გაზიარება' : 'Share Harvest Session'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {typeof event.name === 'object' ? (event.name as any).name || event.id : event.name}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* Summary Card Preview */}
                    <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-xl border border-slate-800">
                        <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">AgriMap Session Code</span>
                                <h3 className="text-lg font-black text-white">{event.id}</h3>
                            </div>
                            <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase rounded-lg">
                                {event.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-slate-800/60 p-2.5 rounded-xl">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">{isKa ? 'წმინდა' : 'Net KG'}</span>
                                <span className="text-base font-black text-emerald-400">{netWeight.toFixed(1)}</span>
                            </div>
                            <div className="bg-slate-800/60 p-2.5 rounded-xl">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">{isKa ? 'ყუთი' : 'Boxes'}</span>
                                <span className="text-base font-black text-indigo-400">{boxes}</span>
                            </div>
                            <div className="bg-slate-800/60 p-2.5 rounded-xl">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">{isKa ? 'მუშა' : 'Pickers'}</span>
                                <span className="text-base font-black text-purple-400">{pickersCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Link Input */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                            {isKa ? 'სესიის ბმული' : 'Direct Session URL'}
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                readOnly 
                                value={shareUrl}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold px-3 py-2 text-slate-700 outline-none"
                            />
                            <button 
                                type="button" 
                                onClick={handleCopyText}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? (isKa ? 'დაკოპირდა' : 'Copied') : (isKa ? 'კოპირება' : 'Copy')}
                            </button>
                        </div>
                    </div>

                    {/* Share Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                        <button 
                            type="button" 
                            onClick={handleWebShare}
                            className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
                        >
                            <Share2 size={16} />
                            {isKa ? 'გაზიარება (WhatsApp / Telegram)' : 'Share via App'}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black uppercase text-xs tracking-wider cursor-pointer transition-colors"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShareHarvestEventModal;
