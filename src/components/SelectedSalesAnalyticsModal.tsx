import React, { useMemo } from 'react';
import { InventoryItem, HarvestEvent } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Brain, X, TrendingUp, Users, DollarSign, List, Calendar } from 'lucide-react';

interface Props {
    items: InventoryItem[];
    harvestEvents?: HarvestEvent[];
    isOpen: boolean;
    onClose: () => void;
}

export const SelectedSalesAnalyticsModal: React.FC<Props> = ({ items, harvestEvents = [], isOpen, onClose }) => {
    const { formatCurrency, language, t } = useLanguage();
    const isKa = language === 'ka';

    const analysis = useMemo(() => {
        if (!items.length) return null;

        // Group by variety
        const varietyStats: Record<string, { count: number; volume: number; revenue: number; priceSum: number; pxCount: number; buyers: Record<string, number> }> = {};
        const buyerStats: Record<string, { count: number; volume: number; spent: number }> = {};
        const yearStats: Record<string, { volume: number; profit: number; events: number; opex: number }> = {};

        let totalOpex = 0;
        let totalRevenue = 0;

        items.forEach(item => {
            const v = item.variety?.toLowerCase().trim() || 'unknown';
            const cost = item.unitCost || 0;
            const volume = item.currentStock || 0;
            const revenue = volume * cost * (item.rate || 1);
            const status = item.status || '';
            const buyer = item.buyer?.toLowerCase().trim() || 'unknown buyer';
            const year = item.date ? item.date.split('-')[0] : 'unknown';

            // Find related harvest event for cost
            let itemOpex = 0;
            if (item.relatedHarvestId) {
                const hEvent = harvestEvents.find(e => e.id === item.relatedHarvestId);
                if (hEvent) {
                    itemOpex = (hEvent.totalPickerCost || 0) + (hEvent.totalPackagingCost || 0) + (hEvent.totalVehicleCost || 0);
                }
            }
            
            totalOpex += itemOpex;
            totalRevenue += revenue;

            // Variety
            if (!varietyStats[v]) varietyStats[v] = { count: 0, volume: 0, revenue: 0, priceSum: 0, pxCount: 0, buyers: {} };
            varietyStats[v].count++;
            varietyStats[v].volume += volume;
            varietyStats[v].revenue += revenue;
            if (cost > 0) {
                varietyStats[v].priceSum += cost;
                varietyStats[v].pxCount++;
            }
            if (status === 'SOLD') {
                varietyStats[v].buyers[buyer] = (varietyStats[v].buyers[buyer] || 0) + volume;
                
                // General By Buyer
                if (!buyerStats[buyer]) buyerStats[buyer] = { count: 0, volume: 0, spent: 0 };
                buyerStats[buyer].count++;
                buyerStats[buyer].volume += volume;
                buyerStats[buyer].spent += revenue;
            }

            // Year
            if (!yearStats[year]) yearStats[year] = { volume: 0, profit: 0, events: 0, opex: 0 };
            yearStats[year].volume += volume;
            yearStats[year].profit += (revenue - itemOpex);
            yearStats[year].opex += itemOpex;
            yearStats[year].events++;
        });

        // Top buyer
        const topBuyer = Object.entries(buyerStats).sort((a, b) => b[1].spent - a[1].spent)[0];
        const mostFreqBuyer = Object.entries(buyerStats).sort((a, b) => b[1].count - a[1].count)[0];
        
        // Mid price of 'star'
        const starAvgPrice = varietyStats['star'] ? (varietyStats['star'].pxCount > 0 ? varietyStats['star'].priceSum / varietyStats['star'].pxCount : 0) : 0;

        // Top variety by volume
        const sortedVarieties = Object.entries(varietyStats).sort((a, b) => b[1].volume - a[1].volume);

        // Top Year
        const topYear = Object.entries(yearStats).sort((a, b) => b[1].profit - a[1].profit)[0];

        return {
            varietyStats: sortedVarieties,
            buyerStats,
            totalItems: items.length,
            topBuyer,
            mostFreqBuyer,
            starAvgPrice,
            topYear,
            yearStats,
            totalOpex,
            totalRevenue,
            totalProfit: totalRevenue - totalOpex
        };

    }, [items, harvestEvents]);

    if (!isOpen || !analysis) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm sm:p-6" style={{ margin: 0 }}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                            <Brain size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">
                                {isKa ? 'მონიშნული ჩანაწერების ანალიზი' : 'Selected Selection Analysis'}
                            </h2>
                            <p className="text-xs font-bold text-slate-500">
                                {analysis.totalItems} {isKa ? 'მონიშნული ჩანაწერი' : 'records selected'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                        title={t('common.cancel')}
                    >
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
                    
                    {/* Key Findings Card */}
                    <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="font-black text-lg text-slate-800 mb-4 flex items-center gap-2">
                            <TrendingUp className="text-emerald-500" size={20}/> 
                            {isKa ? 'ძირითადი მიგნებები' : 'Quick Insights'}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                    {isKa ? 'ყველაზე ხშირი მყიდველი' : 'Most Frequent Buyer'}
                                </p>
                                <p className="text-lg font-black text-slate-700 capitalize">{analysis.mostFreqBuyer ? analysis.mostFreqBuyer[0] : (isKa ? 'არ არის' : 'N/A')}</p>
                                <p className="text-xs font-bold text-slate-500 mt-1">{analysis.mostFreqBuyer ? `${analysis.mostFreqBuyer[1].count} ${isKa ? 'შესყიდვა' : 'purchases'}` : ''}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                    {isKa ? 'ყველაზე მსხვილი მყიდველი' : 'Highest Spender'}
                                </p>
                                <p className="text-lg font-black text-blue-600 capitalize">{analysis.topBuyer ? analysis.topBuyer[0] : (isKa ? 'არ არის' : 'N/A')}</p>
                                <p className="text-xs font-bold text-slate-500 mt-1">{analysis.topBuyer ? formatCurrency(analysis.topBuyer[1].spent) : ''}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                    {isKa ? 'საშ. ფასი "Star" ჯიშზე' : 'Avg Price "Star" Variety'}
                                </p>
                                <p className="text-lg font-black text-emerald-600">{analysis.starAvgPrice ? formatCurrency(analysis.starAvgPrice) : (isKa ? 'არ არის' : 'N/A')}</p>
                            </div>
                            <div className="p-4 bg-amber-50 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">
                                    {isKa ? 'ყველაზე მომგებიანი წელი' : 'Most Profitable Year'}
                                </p>
                                <p className="text-lg font-black text-amber-700">{analysis.topYear ? analysis.topYear[0] : (isKa ? 'არ არის' : 'N/A')}</p>
                                <p className="text-xs font-bold text-amber-600 mt-1">{analysis.topYear ? formatCurrency(analysis.topYear[1].profit) : ''}</p>
                            </div>
                            <div className="p-4 bg-red-50 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">
                                    {isKa ? 'მოსავლის ჯამური OPEX' : 'Harvest Total OPEX'}
                                </p>
                                <p className="text-lg font-black text-red-700">{formatCurrency(analysis.totalOpex)}</p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">
                                    {isKa ? 'მთლიანი შემოსავალი' : 'Gross Revenue'}
                                </p>
                                <p className="text-lg font-black text-blue-700">{formatCurrency(analysis.totalRevenue)}</p>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-2xl sm:col-span-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">
                                    {isKa ? 'წმინდა მოგება' : 'Net Profitability'}
                                </p>
                                <p className="text-2xl font-black text-emerald-700">{formatCurrency(analysis.totalProfit)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown by Variety */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
                        <h3 className="font-black text-lg text-slate-800 mb-4 flex items-center gap-2">
                            <List className="text-blue-500" size={20}/> 
                            {isKa ? 'განაწილება ჯიშების მიხედვით' : 'Breakdown by Variety'}
                        </h3>
                        <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {analysis.varietyStats.map(([variety, stat], i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="font-bold text-slate-700 uppercase pr-2 text-sm">{variety}</p>
                                        <p className="text-[10px] font-bold text-slate-400">{stat.count} {isKa ? 'ჩანაწერი' : 'records'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-slate-900">{parseFloat(stat.volume.toFixed(2))} {isKa ? 'კგ' : 'kg'}</p>
                                        <p className="font-black text-blue-600 text-sm">{formatCurrency(stat.revenue)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Breakdown by Year */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
                        <h3 className="font-black text-lg text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar className="text-indigo-500" size={20}/> 
                            {isKa ? 'წლიური მაჩვენებლები' : 'Yearly Performance'}
                        </h3>
                        <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {Object.entries(analysis.yearStats).sort((a,b) => parseInt(b[0]) - parseInt(a[0])).map(([year, stat], i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">{year}</p>
                                        <p className="text-[10px] font-bold text-slate-400">{stat.events} {isKa ? 'მოვლენა' : 'events'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-slate-900">{parseFloat(stat.volume.toFixed(2))} {isKa ? 'კგ' : 'kg'}</p>
                                        <p className="font-black text-emerald-600 text-sm">{formatCurrency(stat.profit)} {isKa ? 'მოგება' : 'profit'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SelectedSalesAnalyticsModal;
