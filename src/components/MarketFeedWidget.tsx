import React, { useState, useMemo } from 'react';
import type { Listing } from '../types';
import { 
    ShoppingBag, TrendingUp, TrendingDown, Plus, 
    ChevronRight, Filter, Tag, ExternalLink, Sparkles 
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface MarketFeedWidgetProps {
    listings?: Listing[];
    onNavigateMode?: (mode: string) => void;
}

export const MarketFeedWidget: React.FC<MarketFeedWidgetProps> = ({
    listings = [],
    onNavigateMode
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'prices' | 'listings'>('prices');
    const [listingFilter, setListingFilter] = useState<'all' | 'sell' | 'buy'>('all');

    // Agricultural commodity price benchmarks
    const commodityPrices = [
        { name: 'Fresh Blueberry (Duke / Grade A)', price: '$6.80 / kg', change: '+4.5%', isUp: true, trend: 'High Export Demand' },
        { name: 'Industrial Blueberry (IQF / Class B)', price: '$3.40 / kg', change: '+1.2%', isUp: true, trend: 'Stable' },
        { name: 'Hazelnut (In-Shell Anakliuri)', price: '$2.90 / kg', change: '-2.1%', isUp: false, trend: 'Steady Volume' },
        { name: 'Fertilizer N-P-K (16-16-16)', price: '$42.00 / 50kg', change: '+0.8%', isUp: true, trend: 'Spring Procurement' },
        { name: 'Drip Irrigation Tubing (16mm)', price: '$0.18 / meter', change: '0.0%', isUp: true, trend: 'Bulk Inventory' }
    ];

    const sortedListings = useMemo(() => {
        let items = [...listings];
        if (items.length === 0) {
            // Default active realistic trade listings
            items = [
                {
                    id: 'sample-1',
                    title: 'Grade A Duke Blueberries (Pre-Cooled, 125g Clamshells)',
                    type: 'sell',
                    quantity: 1200,
                    unit: 'kg',
                    pricePerUnit: 7.20,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'sample-2',
                    title: 'Wanted: Plastic Harvest Crates (Euro standard 400x300x120)',
                    type: 'buy',
                    quantity: 500,
                    unit: 'pcs',
                    pricePerUnit: 2.50,
                    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
                },
                {
                    id: 'sample-3',
                    title: 'Contract Cold Storage Space in Samegrelo (2°C - 4°C)',
                    type: 'sell',
                    quantity: 40,
                    unit: 'pallet',
                    pricePerUnit: 15.00,
                    createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
                }
            ] as any[];
        }

        if (listingFilter !== 'all') {
            items = items.filter(i => (i.type || '').toLowerCase() === listingFilter);
        }

        return items;
    }, [listings, listingFilter]);

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col justify-between">
            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {t('dash.widget.market_feed')}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
                                {t('market_widget.live_prices')}
                            </span>
                        </div>
                        <p className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
                            {t('market_widget.terminal_title')}
                        </p>
                    </div>

                    <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600">
                        <ShoppingBag size={20} />
                    </div>
                </div>

                {/* Sub-Navigation */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3">
                    <button
                        onClick={() => setActiveTab('prices')}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeTab === 'prices' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('market_widget.tab_prices')}
                    </button>
                    <button
                        onClick={() => setActiveTab('listings')}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeTab === 'listings' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('market_widget.tab_listings').replace('{count}', String(sortedListings.length))}
                    </button>
                </div>

                {/* Tab Content Body */}
                <div className="max-h-[220px] overflow-y-auto custom-scrollbar pr-1 space-y-2">
                    {activeTab === 'prices' && (
                        <div className="space-y-1.5">
                            {commodityPrices.map(item => (
                                <div key={item.name} className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                                    <div className="min-w-0 pr-2">
                                        <span className="font-black text-slate-800 truncate block">{item.name}</span>
                                        <span className="text-[8px] text-slate-400 font-medium">{item.trend}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="font-black text-slate-800 block">{item.price}</span>
                                        <span className={`text-[8px] font-black flex items-center justify-end gap-0.5 ${item.isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {item.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                            {item.change}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'listings' && (
                        <div className="space-y-2">
                            <div className="flex gap-1 mb-2">
                                <button
                                    onClick={() => setListingFilter('all')}
                                    className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${listingFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                                >
                                    {t('market_widget.all')}
                                </button>
                                <button
                                    onClick={() => setListingFilter('sell')}
                                    className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${listingFilter === 'sell' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                                >
                                    {t('market_widget.for_sale')}
                                </button>
                                <button
                                    onClick={() => setListingFilter('buy')}
                                    className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${listingFilter === 'buy' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                                >
                                    {t('market_widget.wanted')}
                                </button>
                            </div>

                            {sortedListings.map(l => (
                                <div key={l.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-blue-300 transition-all">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                                            l.type === 'sale' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {l.type === 'sale' ? t('market_widget.available') : t('market_widget.wanted')}
                                        </span>
                                        <span className="text-[8px] text-slate-400 font-bold">
                                            {new Date(l.createdAt || Date.now()).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-xs font-black text-slate-800 truncate">{l.title}</p>
                                    <p className="text-[9px] font-bold text-slate-500 mt-0.5">
                                        {l.quantity} {l.unit} @ ${l.pricePerUnit}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Operational Footer Action */}
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center gap-2">
                <button
                    onClick={() => {
                        if (onNavigateMode) onNavigateMode('marketplace');
                        else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'marketplace' }));
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm shadow-blue-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <span>{t('market_widget.open_market')}</span>
                    <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
};
