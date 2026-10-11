import React, { useState, useMemo, useEffect } from 'react';
import L from 'leaflet';
import type { User, Listing, Bid, Review, ListingType, AnalysisLocation } from '../types';
import { isValidCoordinate } from '../types';
import type { MapComponentProps } from './MapComponent';
import { Marker, Tooltip, Popup } from 'react-leaflet';
import { MapComponent } from './MapComponent';
import { BuildingStorefrontIcon, PlusCircleIcon, SearchIcon, CurrencyDollarIcon, StarIcon, ChatBubbleBottomCenterTextIcon, PencilSquareIcon, SparklesIcon, XCircleIcon, XIcon, MapIcon, ArrowsRightLeftIcon, ChevronLeftIcon, PlusIcon } from './Icons';
import CreateListingModal from './CreateListingModal';
import { getRoute } from '../services/osrmService';
import { useLanguage } from '../contexts/LanguageContext';
import ResizableDivider from './common/ResizableDivider';
import { safeStorage } from '../services/storageService';

const MapMarker = Marker as any;

interface MarketplaceViewProps {
    currentUser: User | null;
    listings: Listing[];
    bids: Bid[];
    reviews: Review[];
    onSetReviews: (reviews: Review[]) => void;
    onSaveListing: (listing: Partial<Listing>, file: File | null) => void;
    onAddBid: (listingId: string, amount: number) => void;
    mapProps: Omit<MapComponentProps, 'children'>;
    onSetRoute: (route: [number, number][] | null) => void;
    onSetFlyToBounds: (bounds: L.LatLngBoundsExpression | null) => void;
    initialListing?: Partial<Listing> | null;
    onClearInitialListing?: () => void;
}

const ListingDetails: React.FC<{
    listing: Listing;
    bids: Bid[];
    reviews: Review[];
    currentUser: User | null;
    onAddBid: (listingId: string, amount: number) => void;
    onAddReview: (review: Omit<Review, 'id'>) => void;
    onBack: () => void;
    onEdit: (listing: Listing) => void;
    onGetDirections: () => void;
    isRouting: boolean;
}> = ({ listing, bids, reviews, currentUser, onAddBid, onAddReview, onBack, onEdit, onGetDirections, isRouting }) => {
    const { t } = useLanguage();
    const highestBid = useMemo(() => {
        return bids.reduce((max, bid) => bid.amount > max ? bid.amount : max, listing.auctionDetails?.currentPrice || 0);
    }, [bids, listing.auctionDetails]);

    const [bidAmount, setBidAmount] = useState(highestBid + 1);
    const highestReviews = useMemo(() => reviews.filter(r => r.listingId === listing.id || r.targetId === listing.sellerId), [reviews, listing]);
    const isOwner = currentUser?.id === listing.sellerId;

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b bg-white sticky top-0 z-10 flex items-center justify-between">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-2xl transition-all"><ChevronLeftIcon className="h-6 w-6 text-slate-800"/></button>
                <h3 className="font-black text-slate-900 truncate px-2">{listing.title}</h3>
                {isOwner ? (
                    <button onClick={() => onEdit(listing)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"><PencilSquareIcon className="h-5 w-5"/></button>
                ) : <div className="w-10"></div>}
            </div>
            <div className="flex-grow overflow-y-auto p-5 space-y-6">
                {listing.mediaUrl && <img src={listing.mediaUrl} alt={listing.title} className="w-full h-56 object-cover rounded-[2rem] shadow-xl border border-slate-100" />}
                
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</p>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{listing.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</p>
                        <p className="text-xl font-black text-slate-800">{listing.quantity} {listing.unit}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-3xl border border-green-100">
                        <p className="text-[9px] font-black text-green-600 uppercase tracking-widest">Price / {listing.unit}</p>
                        <p className="text-xl font-black text-green-700">${(listing.pricePerUnit || listing.auctionDetails?.currentPrice || 0).toFixed(2)}</p>
                    </div>
                </div>

                {!isOwner && currentUser && (
                    <div className="p-5 bg-blue-50 rounded-[2rem] border border-blue-100 space-y-4 shadow-sm">
                        <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest">Purchase Inquiry</h4>
                        <div className="flex gap-2">
                            <button className="flex-1 py-3 bg-white border border-blue-200 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm">Send Message</button>
                            <button onClick={onGetDirections} disabled={isRouting} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
                                <MapIcon className="h-4 w-4"/> {isRouting ? 'Routing...' : 'Navigate'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor Reliability</h4>
                    {highestReviews.length > 0 ? highestReviews.map(review => (
                        <div key={review.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-1 mb-2">
                                {[...Array(5)].map((_, i) => <StarIcon key={i} className={`h-3 w-3 ${i < review.rating ? 'text-yellow-400' : 'text-slate-300'}`} />)}
                            </div>
                            <p className="text-xs font-medium text-slate-600 italic leading-snug">"{review.comment}"</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">— {review.authorName}</p>
                        </div>
                    )) : <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest text-center py-4">No reviews found.</p>}
                </div>
            </div>
        </div>
    );
};

const MarketplaceView: React.FC<MarketplaceViewProps> = (props) => {
    const { currentUser, listings, onSaveListing, mapProps, onSetRoute, onSetFlyToBounds, initialListing, onClearInitialListing } = props;
    const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
    const { t } = useLanguage();
    
    const [cropFilter, setCropFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState<ListingType | 'all'>('all');
    const [isRouting, setIsRouting] = useState(false);

    // Resizable Edge Handle state
    const [marketPanelWidth, setMarketPanelWidth] = useState<number>(() => {
        const saved = safeStorage.getItem('marketplace_panel_width');
        const parsed = saved ? parseInt(saved, 10) : 420;
        return Number.isFinite(parsed) && parsed >= 280 ? parsed : 420;
    });

    useEffect(() => {
        if (initialListing && currentUser) {
            setIsCreateModalOpen(true);
            if(onClearInitialListing) onClearInitialListing();
        }
    }, [initialListing, currentUser, onClearInitialListing]);

    const handleGetDirections = async (listing: Listing) => {
        if (!navigator.geolocation) return alert("Geolocation not supported");
        setIsRouting(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const routeData = await getRoute([position.coords.latitude, position.coords.longitude], listing.location);
                onSetRoute(routeData);
                
                const currentPos: [number, number] = [position.coords.latitude, position.coords.longitude];
                if (isValidCoordinate(currentPos) && isValidCoordinate(listing.location)) {
                    const lLoc: [number, number] = [
                        typeof listing.location[0] === 'string' ? parseFloat(listing.location[0]) : listing.location[0],
                        typeof listing.location[1] === 'string' ? parseFloat(listing.location[1]) : listing.location[1]
                    ];
                    onSetFlyToBounds(L.latLngBounds([currentPos, lLoc]).pad(0.3));
                }
                
                setActiveTab('map');
            } catch (error) { alert("Routing error"); } finally { setIsRouting(false); }
        });
    };

    const filteredListings = useMemo(() => {
        let result = listings;
        if (typeFilter !== 'all') {
            result = result.filter(l => l.type === typeFilter);
        }
        if (cropFilter) {
            const q = cropFilter.toLowerCase();
            result = result.filter(l => l.title.toLowerCase().includes(q) || l.cropType?.toLowerCase().includes(q));
        }
        return result;
    }, [listings, cropFilter, typeFilter]);

    return (
        <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden h-full relative">
            <div className="md:hidden flex-shrink-0 bg-white border-b p-2 flex gap-1 z-20">
                <button onClick={() => setActiveTab('list')} className={`flex-1 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Listing Results</button>
                <button onClick={() => setActiveTab('map')} className={`flex-1 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'map' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Satellite View</button>
            </div>

            <div className="flex-grow flex overflow-hidden">
                <div 
                    className={`${activeTab === 'list' ? 'flex' : 'hidden md:flex'} w-full flex-shrink-0 flex-col bg-white border-r border-slate-200 shadow-2xl z-10 overflow-hidden`}
                    style={{
                        width: typeof window !== 'undefined' && window.innerWidth > 768 ? `${marketPanelWidth}px` : undefined,
                        maxWidth: '85vw'
                    }}
                >
                    {selectedListing ? (
                        <ListingDetails 
                            listing={selectedListing} 
                            bids={props.bids.filter(b => b.listingId === selectedListing.id)} 
                            reviews={props.reviews}
                            onAddReview={() => {}}
                            currentUser={currentUser}
                            onAddBid={props.onAddBid}
                            onBack={() => { setSelectedListing(null); onSetRoute(null); }}
                            onEdit={() => {}}
                            onGetDirections={() => handleGetDirections(selectedListing)}
                            isRouting={isRouting}
                        />
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="p-6 border-b flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{t('market.title')}</h1>
                                    <button 
                                        onClick={() => setIsCreateModalOpen(true)} 
                                        disabled={currentUser?.isGuest}
                                        className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl transition-transform active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed" 
                                        title={currentUser?.isGuest ? "Verification required" : "New Listing"}
                                    >
                                        <PlusCircleIcon className="h-6 w-6" />
                                    </button>
                                </div>
                                <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
                                    <button onClick={() => setTypeFilter('all')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${typeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>All</button>
                                    <button onClick={() => setTypeFilter('sale')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${typeFilter === 'sale' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Sales</button>
                                    <button onClick={() => setTypeFilter('wanted')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${typeFilter === 'wanted' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Wanted</button>
                                </div>
                                <div className="relative">
                                    <SearchIcon className="h-5 w-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="text" value={cropFilter} onChange={e => setCropFilter(e.target.value)} placeholder="Search crops..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                                {filteredListings.map((l, idx) => (
                                    <div key={`listing-item-${l.id || idx}-${idx}`} onClick={() => setSelectedListing(l)} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 truncate">
                                                <h4 className="font-black text-slate-900 tracking-tight leading-none group-hover:text-blue-600 transition-colors truncate">{l.title}</h4>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{l.sellerName}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-black text-green-700 leading-none">${(l.pricePerUnit || l.auctionDetails?.currentPrice || 0).toFixed(1)}</div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-1">per {l.unit}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredListings.length === 0 && <p className="text-center py-20 text-[10px] font-black text-slate-300 uppercase tracking-widest">No listings match filters.</p>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Resizable Divider between Marketplace Panel and Map */}
                <ResizableDivider 
                    direction="horizontal"
                    currentSize={marketPanelWidth}
                    onResize={(newWidth) => setMarketPanelWidth(newWidth)}
                    minSize={280}
                    maxSize={typeof window !== 'undefined' ? Math.max(window.innerWidth - 300, 600) : 850}
                    storageKey="marketplace_panel_width"
                    isKa={t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'}
                    className="hidden md:flex"
                />

                <div className={`${activeTab === 'map' ? 'flex' : 'hidden md:flex'} flex-1 h-full relative overflow-hidden bg-slate-200`}>
                    <MapComponent {...mapProps} showSearch={true}>
                        {filteredListings
                            .map((listing, idx) => {
                                if (!isValidCoordinate(listing.location)) return null;
                                const lLoc: [number, number] = [
                                    typeof listing.location[0] === 'string' ? parseFloat(listing.location[0]) : listing.location[0],
                                    typeof listing.location[1] === 'string' ? parseFloat(listing.location[1]) : listing.location[1]
                                ];
                                return (
                                    <MapMarker 
                                        key={`marker-${listing.id || idx}-${idx}`} 
                                        position={lLoc} 
                                        icon={L.divIcon({
                                            html: `<div class="w-10 h-10 rounded-2xl bg-white border-2 border-slate-900 flex items-center justify-center text-slate-900 shadow-2xl hover:scale-110 active:scale-90 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path d="M5.223 2.25c-.497 0-.974.198-1.325.55l-1.1 1.1a1.875 1.875 0 0 0 0 2.652L12 15.75l9.202-9.202a1.875 1.875 0 0 0 0-2.652l-1.1-1.1a1.875 1.875 0 0 0-1.325-.55H5.223Z" /><path fill-rule="evenodd" d="M3 20.25c0 .414.336.75.75.75h16.5a.75.75 0 0 0 .75-.75V8.125l-8.5 8.5a.75.75 0 0 1-1.06 0L3 8.125v12.125Z" clip-rule="evenodd" /></svg></div>`,
                                            className: '', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20]
                                        })}
                                        eventHandlers={{ click: () => { setSelectedListing(listing); setActiveTab('list'); } }}
                                    />
                                );
                            })
                            .filter(Boolean)
                        }
                    </MapComponent>
                    <div className="absolute bottom-6 right-6 z-[1000] md:hidden">
                        <button 
                            onClick={() => setIsCreateModalOpen(true)} 
                            disabled={currentUser?.isGuest}
                            className="bg-slate-900 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                            title={currentUser?.isGuest ? "Verification required" : "New Listing"}
                        >
                             <PlusIcon className="h-6 w-6"/>
                        </button>
                    </div>
                </div>
            </div>

            {isCreateModalOpen && currentUser && (
                <CreateListingModal 
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSave={(data, file) => { props.onSaveListing(data, file); setIsCreateModalOpen(false); }}
                    currentUser={currentUser}
                    mapCenter={mapProps.center}
                    listingToEdit={null}
                />
            )}
        </div>
    );
};

export default MarketplaceView;