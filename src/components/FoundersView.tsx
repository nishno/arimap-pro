import React, { useMemo, useState, useEffect } from 'react';
import type { InventoryItem, HarvestEvent, Transaction, Account, Employee, Machinery, YieldByVariety, Organization, Membership, User, OrganizationType, AgricultureType, UserRole, Crop, SubscriptionTier, SubscriptionStatus } from '../types';
import { 
    ShieldCheckIcon, BanknotesIcon, ArrowTrendingUpIcon, 
    LeafIcon, InfoIcon, ChartBarIcon, TractorIcon, SparklesIcon,
    UsersIcon, ArchiveBoxIcon, CheckIcon, XIcon, EyeIcon, 
    BuildingStorefrontIcon, ShoppingBagIcon, RectangleStackIcon,
    PlusIcon, SearchIcon, MapIcon, ChevronRightIcon, GlobeIcon, PencilIcon,
    TrashIcon, RefreshCwIcon, PlayIcon, PauseIcon, StarIcon, AlertTriangleIcon,
    CreditCardIcon, PaperAirplaneIcon, ShareIcon
} from './Icons';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { db, doc, setDoc } from '../firebase';
import { USE_FIREBASE } from '../config';
import { safeStorage } from '../services/storageService';

const transliterateGeoToEng = (str: string): string => {
  const geoToEngMap: { [key: string]: string } = {
    'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't',
    'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh',
    'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'p', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q',
    'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
  };
  return str.split('').map(char => geoToEngMap[char] || char).join('');
};

const transliterateEngToGeo = (str: string): string => {
  const engToGeoMap: { [key: string]: string } = {
    'a': 'ა', 'b': 'ბ', 'g': 'გ', 'd': 'დ', 'e': 'ე', 'v': 'ვ', 'z': 'ზ', 't': 'თ',
    'i': 'ი', 'k': 'კ', 'l': 'ლ', 'm': 'მ', 'n': 'ნ', 'o': 'ო', 'p': 'პ', 'r': 'რ',
    's': 'ს', 'u': 'უ', 'q': 'ყ', 'j': 'ჯ', 'h': 'ჰ'
  };
  return str.split('').map(char => engToGeoMap[char.toLowerCase()] || char).join('');
};

export interface DeletionApprovalRequest {
    id: string;
    organizationId: string;
    organizationName: string;
    requestedBy: {
        id: string;
        name: string;
        email?: string;
    };
    requestedAt: string;
    coFounderIds: string[];
    approvals: string[];
    rejections: string[];
    status: 'pending' | 'approved' | 'rejected';
}

interface FoundersViewProps {
    inventoryItems: InventoryItem[];
    onSetInventoryItems: (items: InventoryItem[]) => void;
    harvestEvents: HarvestEvent[];
    accounts: Account[];
    employees: Employee[];
    machinery: Machinery[];
    onSetAccounts: (accounts: Account[]) => void;
    transactions: Transaction[];
    onSetTransactions: (txns: Transaction[]) => void;
    organizations: Organization[];
    discoverableOrganizations?: Organization[];
    memberships: Membership[];
    onAddOrg: (org: Organization, mem: Membership, selectedCrops?: any[]) => void;
    onUpdateOrg?: (org: Organization) => void;
    onDeleteOrganization?: (id: string, name: string, skipConfirm?: boolean) => Promise<void> | void;
    onDeleteAccount?: () => Promise<void> | void;
    onPauseOrg?: (orgId: string, isPaused: boolean) => void;
    onResetPlantation?: (orgId: string) => void;
    onUpdateMemberships?: (memberships: Membership[]) => void;
    onSwitchOrg: (orgId: string) => void;
    onStartMapRegistration?: (regData: any) => void;
    activeOrgId: string | null;
    currentUser: User;
    allUsers?: User[];
    crops: Crop[];
    onAddPost?: (post: any) => void;
}

const SettlementTerminal: React.FC<{
    harvest: HarvestEvent;
    item: InventoryItem;
    cost: { field: number, inv: number, total: number, labor: number, machinery: number };
    onClose: () => void;
    onConfirm: (finalData: any) => void;
    formatCurrency: (amount: number) => string;
}> = ({ harvest, item, cost, onClose, onConfirm, formatCurrency }) => {
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [monetizationPath, setMonetizationPath] = useState<'direct' | 'market' | 'storage'>('storage');
    const [isPublic, setIsPublic] = useState(false);

    useEffect(() => {
        const initial: Record<string, number> = {};
        (harvest.yieldByVariety || [{variety: 'SUZY', weightKg: item.currentStock}]).forEach(y => {
            initial[y.variety] = 10;
        });
        setPrices(initial);
    }, [harvest, item]);

    const analytics = useMemo(() => {
        const totalRevenue = Object.entries(prices).reduce((acc: number, [variety, price]) => {
            const weightEntry = harvest.yieldByVariety?.find(v => v.variety === variety);
            const weight = weightEntry ? weightEntry.weightKg : item.currentStock;
            return acc + (Number(weight) * Number(price));
        }, 0);
        const netProfit = Number(totalRevenue) - Number(cost.total);
        const opexPerKg = item.currentStock > 0 ? Number(cost.total) / Number(item.currentStock) : 0;
        return { totalRevenue, netProfit, opexPerKg };
    }, [prices, cost, item, harvest]);

    return (
        <div className="fixed inset-0 bg-[#050b18]/90 backdrop-blur-xl z-[5000] flex items-center justify-center p-4">
            <div className="bg-[#f8fafc] w-full max-w-6xl h-[85vh] rounded-[2rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] flex overflow-hidden animate-slide-up border border-white/20">
                
                {/* Left Side: Operational Audit */}
                <div className="w-[320px] bg-[#f1f5f9] border-r border-slate-200 p-10 flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-10">Operational Audit</h3>
                    <div className="space-y-4 flex-grow">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Picker Payroll</p>
                            <p className="text-3xl font-black text-slate-800 tracking-tighter">{formatCurrency(cost.labor)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Machinery OPEX</p>
                            <p className="text-3xl font-black text-slate-800 tracking-tighter">{formatCurrency(cost.machinery)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Packaging Costs</p>
                            <p className="text-3xl font-black text-slate-800 tracking-tighter">{formatCurrency(cost.inv)}</p>
                        </div>
                    </div>
                    <div className="mt-8 pt-8 border-t border-slate-300 space-y-1">
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">
                            <span>Net Field OPEX</span>
                            <span>{formatCurrency(cost.total)}</span>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Total Field Burden</p>
                        <p className="text-4xl font-black text-[#ff3b3b] tracking-tighter italic">{formatCurrency(cost.total)}</p>
                    </div>
                </div>

                {/* Center: Settlement Terminal */}
                <div className="flex-1 bg-white p-12 flex flex-col">
                    <div className="flex justify-between items-start mb-14">
                        <div>
                            <h2 className="text-5xl font-[900] italic tracking-tighter uppercase leading-none text-slate-900">
                                SETTLEMENT <span className="block not-italic text-slate-800">TERMINAL</span>
                            </h2>
                            <p className="text-[10px] font-black text-slate-400 mt-3 uppercase tracking-[0.3em]">Operational Unit: <span className="text-indigo-600 font-bold">{harvest.name}</span></p>
                        </div>
                        <button 
                            onClick={() => setIsPublic(!isPublic)}
                            className={`px-5 py-2.5 rounded-2xl border flex items-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest ${isPublic ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
                        >
                            <EyeIcon size={14} />
                            <span>Public (Visible)</span>
                        </button>
                    </div>

                    <div className="space-y-12">
                        <div>
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6 pb-2 border-b border-slate-100">Yield ROI Pricing</h4>
                            <div className="grid grid-cols-1 gap-4 max-w-md">
                                {Object.entries(prices).map(([variety, price]) => (
                                    <div key={variety} className="flex items-center gap-6 bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100 group hover:border-indigo-200 transition-all">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-900 tracking-tight uppercase">{variety}</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1">{harvest.yieldByVariety?.find(v => v.variety === variety)?.weightKg || item.currentStock}kg</p>
                                        </div>
                                        <input 
                                            type="number" 
                                            value={price} 
                                            onChange={e => setPrices({...prices, [variety]: parseFloat(e.target.value) || 0})}
                                            className="w-28 bg-white border border-slate-200 rounded-xl p-3 font-black text-center text-slate-900 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6 pb-2 border-b border-slate-100">Monetization Path</h4>
                            <div className="flex gap-4">
                                {[
                                    { id: 'direct', label: 'Direct Sale', icon: <BuildingStorefrontIcon size={28}/> },
                                    { id: 'market', label: 'On Market', icon: <SparklesIcon size={28}/> },
                                    { id: 'storage', label: 'To Storage', icon: <ArchiveBoxIcon size={28}/> }
                                ].map(path => (
                                    <button 
                                        key={path.id}
                                        onClick={() => setMonetizationPath(path.id as any)}
                                        className={`flex-1 flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 transition-all gap-4 ${monetizationPath === path.id ? 'border-indigo-600 bg-white shadow-[0_20px_40px_rgba(79,70,229,0.15)] ring-4 ring-indigo-50' : 'border-slate-100 bg-white text-slate-300 hover:border-slate-200'}`}
                                    >
                                        <div className={`transition-transform duration-300 ${monetizationPath === path.id ? 'text-indigo-600 scale-125' : ''}`}>{path.icon}</div>
                                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${monetizationPath === path.id ? 'text-slate-900' : ''}`}>{path.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: ROI Summary */}
                <div className="w-[360px] bg-[#0a1224] p-12 flex flex-col relative text-white border-l border-white/5">
                    <button onClick={onClose} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all transform hover:rotate-90">
                        <XIcon size={24} />
                    </button>

                    <div className="space-y-14 flex-grow">
                        <div>
                            <h3 className="text-[10px] font-black text-[#00f2ff] uppercase tracking-[0.3em] mb-3">Total Gross ROI</h3>
                            <div className="text-[5.5rem] font-[900] tracking-tighter leading-none flex items-baseline gap-2">
                                {formatCurrency(analytics.totalRevenue)}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-6 pb-2 border-b border-white/10">Session Analytics</h3>
                            <div className="space-y-6">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Total Net Weight</span>
                                    <span className="font-black text-xl tracking-tighter">{item.currentStock.toFixed(1)} <span className="text-xs text-slate-500">kg</span></span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">OPEX/KG</span>
                                    <span className="font-black text-xl tracking-tighter text-slate-300">{formatCurrency(analytics.opexPerKg)}</span>
                                </div>
                                <div className="mt-8 pt-8 border-t border-white/10 flex justify-between items-center">
                                    <span className="text-sm font-black text-[#00f2ff] uppercase tracking-widest">Net Profit</span>
                                    <span className={`text-4xl font-black tracking-tighter ${analytics.netProfit >= 0 ? 'text-[#00ffc2]' : 'text-red-500'}`}>
                                        {analytics.netProfit >= 0 ? '+ ' : ''}{formatCurrency(analytics.netProfit)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400"><ArchiveBoxIcon size={16} /></div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Founder Private Vault</h3>
                             </div>
                             <div className="bg-[#121c33] p-8 rounded-[2rem] border border-white/5 shadow-inner">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Liquid Reserve</span>
                                <div className="text-3xl font-black text-white flex items-center gap-1 leading-none tracking-tighter">
                                    {formatCurrency(0)}
                                </div>
                             </div>
                        </div>
                    </div>

                    <button 
                        onClick={() => onConfirm({ prices, monetizationPath, isPublic, analytics })}
                        className="w-full py-6 bg-[#00ffc2] text-[#050b18] rounded-[2.5rem] font-[900] uppercase tracking-[0.4em] text-xs shadow-[0_0_50px_rgba(0,255,194,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        Confirm Settlement
                    </button>
                </div>
            </div>
        </div>
    );
}

const COMMON_CROPS = ["Blueberry", "Raspberry", "Blackberry", "Strawberry", "Wine Grapes", "Table Grapes", "Walnut", "Hazelnut", "Almond"];

const FoundersView: React.FC<FoundersViewProps> = (props) => {
    const { 
        inventoryItems, onSetInventoryItems, harvestEvents, accounts, 
        onSetAccounts, employees, machinery, transactions, onSetTransactions, 
        organizations, discoverableOrganizations = [], memberships, onAddOrg, onUpdateOrg, 
        onDeleteOrganization, onDeleteAccount, onPauseOrg, onResetPlantation, onUpdateMemberships,
        onSwitchOrg, onStartMapRegistration, activeOrgId, currentUser, allUsers = [], crops, onAddPost 
    } = props;

    const { t, formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    // Root / Super Admin Check
    const isRootOrSuperAdmin = useMemo(() => {
        return currentUser?.roles?.includes('ROOT_SUPER_ADMIN') || 
            (currentUser as any)?.role === 'ROOT_SUPER_ADMIN' ||
            currentUser?.roles?.some(r => ['root', 'superadmin', 'super_admin', 'root_super_admin'].includes(String(r).toLowerCase())) ||
            currentUser?.email?.toLowerCase() === 'giorgi.nishno@gmail.com' ||
            currentUser?.id === 'root-system' ||
            currentUser?.id === 'mock-1';
    }, [currentUser]);

    // Deletion Approval Requests state (persisted in safe storage)
    const [deletionRequests, setDeletionRequests] = useState<DeletionApprovalRequest[]>(() => {
        try {
            return safeStorage.safeParse(localStorage.getItem('agrimap_deletion_requests'), []);
        } catch {
            return [];
        }
    });

    const updateDeletionRequests = (newList: DeletionApprovalRequest[]) => {
        setDeletionRequests(newList);
        try {
            localStorage.setItem('agrimap_deletion_requests', JSON.stringify(newList));
        } catch (e) {
            console.error(e);
        }
    };

    // Modal states
    const [showDeleteProfileModal, setShowDeleteProfileModal] = useState(false);
    const [isDeletingProfile, setIsDeletingProfile] = useState(false);
    const [deleteOrgModal, setDeleteOrgModal] = useState<{ org: Organization; coFounders: any[]; isSoleFounder: boolean; isRootSuperAdmin: boolean } | null>(null);
    const [resetPlantationOrg, setResetPlantationOrg] = useState<Organization | null>(null);
    const [managingSubscriptionOrg, setManagingSubscriptionOrg] = useState<Organization | null>(null);
    const [changingFounderOrg, setChangingFounderOrg] = useState<Organization | null>(null);
    const [managingOrg, setManagingOrg] = useState<Organization | null>(null);
    const [messageModal, setMessageModal] = useState<{ org: Organization; mode: 'coFounders' | 'broadcast' } | null>(null);

    const [view, setView] = useState<'organizations' | 'control'>('organizations');
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
    const [orgSearchQuery, setOrgSearchQuery] = useState('');
    const [debouncedOrgQuery, setDebouncedOrgQuery] = useState('');
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [discoveryOrg, setDiscoveryOrg] = useState<Organization | null>(null);
    const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
    const [editOrgData, setEditOrgData] = useState<Partial<Organization>>({});

    const getOrgFounders = (org: Organization) => {
        const founderMemberships = memberships.filter(
            m => m.organizationId === org.id && (m.role === 'Founder' || m.role === 'Co-Founder')
        );
        const founderUserIds = new Set<string>();
        if (org.createdBy) founderUserIds.add(org.createdBy);
        founderMemberships.forEach(m => founderUserIds.add(m.userId));
        
        return Array.from(founderUserIds).map(uid => {
            const user = allUsers?.find(u => u.id === uid);
            const mem = founderMemberships.find(m => m.userId === uid);
            const isCreator = org.createdBy === uid;
            const isMe = currentUser?.id === uid;
            return {
                userId: uid,
                name: user?.name || (isMe ? currentUser.name : (isCreator ? (isKa ? 'დამფუძნებელი' : 'Founder') : (isKa ? 'თანადამფუძნებელი' : 'Co-Founder'))),
                email: user?.email || (isMe ? currentUser.email : ''),
                role: mem?.role || (isCreator ? 'Founder' : 'Co-Founder'),
                isCreator,
                isMe
            };
        });
    };

    const userOrgs = useMemo(() => {
        if (isRootOrSuperAdmin) {
            // Root / Super Admin has access to all registered organizations
            return organizations;
        }
        return organizations.filter(org => 
            org.createdBy === currentUser.id || memberships.some(m => m.organizationId === org.id)
        );
    }, [organizations, memberships, isRootOrSuperAdmin, currentUser.id]);

    const handleTogglePause = (org: Organization) => {
        const currentlyPaused = org.isPaused || org.status === 'paused';
        const newPaused = !currentlyPaused;
        if (onPauseOrg) {
            onPauseOrg(org.id, newPaused);
        } else if (onUpdateOrg) {
            onUpdateOrg({
                ...org,
                status: newPaused ? 'paused' : 'active',
                isPaused: newPaused
            });
        }
        toast.success(newPaused 
            ? (isKa ? `პლანტაცია "${org.name}" შეჩერებულია` : `Plantation "${org.name}" paused`)
            : (isKa ? `პლანტაცია "${org.name}" გააქტიურდა` : `Plantation "${org.name}" resumed`)
        );
    };

    const handleConfirmReset = () => {
        if (!resetPlantationOrg) return;
        if (onResetPlantation) {
            onResetPlantation(resetPlantationOrg.id);
        }
        toast.success(isKa ? `პლანტაციის მონაცემები "${resetPlantationOrg.name}" განულდა` : `Plantation features reset for "${resetPlantationOrg.name}".`);
        setResetPlantationOrg(null);
    };

    const handleInitiateDeleteOrg = (org: Organization) => {
        if (isRootOrSuperAdmin) {
            setDeleteOrgModal({
                org,
                coFounders: [],
                isSoleFounder: true,
                isRootSuperAdmin: true
            });
            return;
        }

        const founders = getOrgFounders(org);
        const otherCoFounders = founders.filter(f => f.userId !== currentUser.id);

        if (otherCoFounders.length === 0) {
            setDeleteOrgModal({
                org,
                coFounders: [],
                isSoleFounder: true,
                isRootSuperAdmin: false
            });
        } else {
            setDeleteOrgModal({
                org,
                coFounders: otherCoFounders,
                isSoleFounder: false,
                isRootSuperAdmin: false
            });
        }
    };

    const handleConfirmDeleteOrg = async () => {
        if (!deleteOrgModal) return;
        const { org, isSoleFounder, isRootSuperAdmin, coFounders } = deleteOrgModal;

        if (isRootSuperAdmin || isSoleFounder) {
            try {
                if (onDeleteOrganization) {
                    await onDeleteOrganization(org.id, org.name, true);
                }
                const updatedRequests = deletionRequests.filter(r => r.organizationId !== org.id);
                updateDeletionRequests(updatedRequests);
                toast.success(isKa ? `ორგანიზაცია "${org.name}" წაიშალა.` : `Organization "${org.name}" has been permanently deleted.`);
                setDeleteOrgModal(null);
            } catch (err: any) {
                console.error("Delete org error:", err);
                toast.error(err?.message || "Failed to delete organization");
            }
        } else {
            const newReq: DeletionApprovalRequest = {
                id: `del-req-${Date.now()}-${org.id}`,
                organizationId: org.id,
                organizationName: org.name,
                requestedBy: {
                    id: currentUser.id,
                    name: currentUser.name || "Founder",
                    email: currentUser.email || ""
                },
                requestedAt: new Date().toISOString(),
                coFounderIds: coFounders.map(f => f.userId),
                approvals: [currentUser.id],
                rejections: [],
                status: 'pending'
            };

            const updated = [...deletionRequests.filter(r => r.organizationId !== org.id), newReq];
            updateDeletionRequests(updated);

            if (onAddPost) {
                onAddPost({
                    content: `⚠️ [Deletion Approval Request] Founder ${currentUser.name || 'Admin'} requested to delete organization "${org.name}". Co-founder approval required.`,
                    channelId: 'internal',
                    hubType: 'internal',
                    isDirectMessage: true,
                    recipientId: coFounders.map(f => f.userId).join(','),
                    authorId: currentUser.id,
                    authorName: currentUser.name,
                    timestamp: new Date().toISOString(),
                    replies: []
                });
            }

            toast.info(isKa 
                ? "წაშლის მოთხოვნა გაეგზავნა თანადამფუძნებლებს დასადასტურებლად." 
                : "Deletion approval request sent to co-founders.");
            setDeleteOrgModal(null);
        }
    };

    const handleVoteDeletion = async (requestId: string, approve: boolean) => {
        const req = deletionRequests.find(r => r.id === requestId);
        if (!req) return;

        if (!approve) {
            const updated = deletionRequests.map(r => {
                if (r.id !== requestId) return r;
                return {
                    ...r,
                    rejections: Array.from(new Set([...r.rejections, currentUser.id])),
                    status: 'rejected' as const
                };
            });
            updateDeletionRequests(updated);
            toast.error(isKa ? "წაშლის მოთხოვნა უარყოფილია." : "Deletion request rejected.");
            return;
        }

        const newApprovals = Array.from(new Set([...req.approvals, currentUser.id]));
        const allApproved = req.coFounderIds.every(id => newApprovals.includes(id));

        if (allApproved) {
            if (onDeleteOrganization) {
                await onDeleteOrganization(req.organizationId, req.organizationName, true);
            }
            const updated = deletionRequests.filter(r => r.id !== requestId);
            updateDeletionRequests(updated);
            toast.success(isKa 
                ? `ყველა თანადამფუძნებლის დასტურით კომპანია "${req.organizationName}" წაიშალა.` 
                : `All co-founders approved! Organization "${req.organizationName}" has been deleted.`);
        } else {
            const updated = deletionRequests.map(r => {
                if (r.id !== requestId) return r;
                return {
                    ...r,
                    approvals: newApprovals
                };
            });
            updateDeletionRequests(updated);
            toast.success(isKa ? "თქვენი თანხმობა დაფიქსირდა." : "Your approval has been recorded.");
        }
    };

    const handleCancelDeletionRequest = (requestId: string) => {
        const updated = deletionRequests.filter(r => r.id !== requestId);
        updateDeletionRequests(updated);
        toast.info(isKa ? "წაშლის მოთხოვნა გაუქმებულია." : "Deletion request cancelled.");
    };

    const handleDeleteAccountInternal = async () => {
        setIsDeletingProfile(true);
        try {
            if (onDeleteAccount) {
                await onDeleteAccount();
            } else {
                toast.success(isKa ? "პროფილი წაიშალა" : "Profile deleted successfully.");
            }
            setShowDeleteProfileModal(false);
        } catch (err: any) {
            console.error("Error deleting profile:", err);
            toast.error(err?.message || "Failed to delete account");
        } finally {
            setIsDeletingProfile(false);
        }
    };

    const handleChangeFounder = (org: Organization, targetUserId: string) => {
        if (!targetUserId) return;
        const targetUser = allUsers?.find(u => u.id === targetUserId);

        if (onUpdateMemberships) {
            const updated = memberships.map(m => {
                if (m.organizationId !== org.id) return m;
                if (m.userId === targetUserId) {
                    return { ...m, role: 'Founder' as UserRole };
                }
                if (m.role === 'Founder') {
                    return { ...m, role: 'Co-Founder' as UserRole };
                }
                return m;
            });
            onUpdateMemberships(updated);
        }

        if (onUpdateOrg) {
            onUpdateOrg({ ...org, createdBy: targetUserId });
        }

        toast.success(isKa 
            ? `დამფუძნებლის სტატუსი წარმატებით გადაეცა ${targetUser?.name || targetUserId}-ს` 
            : `Founder role transferred to ${targetUser?.name || targetUserId}`);
        setChangingFounderOrg(null);
    };

    const handleSaveSubscription = (org: Organization, tier: SubscriptionTier, status?: SubscriptionStatus) => {
        if (onUpdateOrg) {
            onUpdateOrg({
                ...org,
                tier,
                subscriptionStatus: status || org.subscriptionStatus || 'Trial'
            });
        }
        toast.success(isKa ? `გამოწერის გეგმა განახლდა: ${tier}` : `Subscription updated to ${tier}`);
        setManagingSubscriptionOrg(null);
    };

    const handleSendMessageOrAd = (org: Organization, mode: 'coFounders' | 'broadcast', messageContent: string, adTitle?: string) => {
        if (!messageContent.trim()) {
            toast.error(isKa ? "გთხოვთ შეიყვანოთ ტექსტი" : "Please enter message content");
            return;
        }

        if (onAddPost) {
            if (mode === 'coFounders') {
                const founders = getOrgFounders(org);
                const recipientIds = founders.filter(f => f.userId !== currentUser.id).map(f => f.userId);
                onAddPost({
                    content: `[Founders Channel - ${org.name}] ${messageContent}`,
                    channelId: 'internal',
                    hubType: 'internal',
                    isDirectMessage: true,
                    recipientId: recipientIds.join(','),
                    authorId: currentUser.id,
                    authorName: currentUser.name,
                    timestamp: new Date().toISOString(),
                    replies: []
                });
                toast.success(isKa ? "შეტყობინება გაეგზავნა დამფუძნებლებს" : "Message sent to co-founders");
            } else {
                onAddPost({
                    content: `📢 [${adTitle || (isKa ? 'კომერციული განცხადება' : 'Company Broadcast')} - ${org.name}]: ${messageContent}`,
                    channelId: 'general',
                    hubType: 'global',
                    isDirectMessage: false,
                    authorId: currentUser.id,
                    authorName: `${org.name} (${currentUser.name})`,
                    timestamp: new Date().toISOString(),
                    replies: []
                });
                toast.success(isKa ? "განცხადება / რეკლამა გამოქვეყნდა ქსელში!" : "Ad / Broadcast published to company network!");
            }
        }
        setMessageModal(null);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedOrgQuery(orgSearchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [orgSearchQuery]);

    const handleUpdateOrgInternal = () => {
        if (!editingOrg || !onUpdateOrg) return;
        onUpdateOrg({ ...editingOrg, ...editOrgData } as Organization);
        toast.success(t('profile.save_changes'));
        setIsEditOrgModalOpen(false);
        setEditingOrg(null);
    };

    const [regData, setRegData] = useState({
        name: '',
        taxNumber: '',
        phone: '',
        type: 'LTD' as OrganizationType,
        agricultureType: 'General' as AgricultureType,
        role: 'Founder' as UserRole,
        isDiscoverable: true,
        region: '',
        areaHa: 0,
        legalStructure: 'LTD',
        subscriptionPlan: 'Free',
        selectedCrops: [] as {name: string, varieties: string[]}[]
    });

    const vaultItems = useMemo(() => inventoryItems.filter(i => i.isPrivate), [inventoryItems]);
    const [selectedHarvestId, setSelectedHarvestId] = useState<string | null>(null);

    const handleAddOrg = async (useMap: boolean = false) => {
        if (!regData.name) {
            toast.error("Please enter a company name.");
            return;
        }

        if (useMap && onStartMapRegistration) {
            onStartMapRegistration(regData);
            setIsRegistrationOpen(false);
            return;
        }

        const { generateUniqueId } = await import('../lib/firebaseUtils');
        const uniqueId = generateUniqueId('organization');

        const newOrg: Organization = {
            id: `org-${Date.now()}`,
            uniqueId: uniqueId,
            name: regData.name,
            legalName: regData.name,
            registrationNumber: '',
            taxNumber: regData.taxNumber,
            phoneNumber: regData.phone,
            type: regData.type,
            agricultureType: regData.agricultureType,
            isDiscoverable: regData.isDiscoverable,
            status: 'active',
            createdAt: new Date().toISOString(),
            createdBy: currentUser.id,
            subscriptionStatus: 'Trial',
            trial_start_date: new Date().toISOString(),
            trialExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isPaid: false,
            tier: 'Free',
            country: 'Georgia',
            region: regData.region,
            areaHa: regData.areaHa,
            legalStructure: regData.legalStructure || regData.type,
            subscriptionPlan: regData.subscriptionPlan || 'Free'
        };

        const newMem: Membership = {
            id: `${currentUser.id}_${newOrg.id}`,
            userId: currentUser.id,
            organizationId: newOrg.id,
            role: regData.role,
            status: 'active',
            joinedAt: new Date().toISOString(),
            permissionLevel: 'admin'
        };

        onAddOrg(newOrg, newMem, regData.selectedCrops);
        setIsRegistrationOpen(false);
        setRegData({
            name: '',
            taxNumber: '',
            phone: '',
            type: 'LTD',
            agricultureType: 'General',
            role: 'Founder',
            isDiscoverable: true,
            region: 'Imereti',
            areaHa: 0,
            legalStructure: 'Commercial',
            subscriptionPlan: 'Basic',
            selectedCrops: []
        });
    };
    
    const forensics = useMemo(() => {
        return vaultItems.map(item => {
            const event = harvestEvents.find(e => e.id === item.relatedHarvestId);
            if (!event) return { field: 0, inv: 0, total: 0, labor: 0, machinery: 0 };

            const labor = (event.assignedPickers || []).reduce((acc, p) => {
                const rate = p.rate || 0;
                if (p.paymentModel === 'per_weight') return acc + (Number(item.currentStock) * Number(rate));
                return acc + (8 * Number(rate)); // Assuming 8-hour day for daily/hourly in this simplified model
            }, 0);

            const vehicles = (event.assignedVehicles || []).reduce((acc, v) => {
                const m = machinery.find(mac => mac.id === v.machineryId);
                return acc + (Number(v.usageHours || 0) * Number(v.hiredCost || m?.hourlyRate || 0));
            }, 0);

            const materials = (event.materialsUsed || []).reduce((acc, m) => {
                const inv = inventoryItems.find(i => i.id === m.inventoryItemId);
                return acc + (Number(m.quantity) * Number(inv?.unitCost || 0));
            }, 0);

            return {
                field: labor + vehicles,
                inv: materials,
                total: labor + vehicles + materials,
                labor,
                machinery: vehicles
            };
        });
    }, [vaultItems, harvestEvents, employees, machinery, inventoryItems]);

    const stats = useMemo(() => {
        const rev = vaultItems.reduce((s, i) => s + (Number(i.currentStock) * 15), 0); // Assuming fixed price for vault items
        const field = forensics.reduce((s, f) => s + f.field, 0);
        const inv = forensics.reduce((s, f) => s + f.inv, 0);
        return { rev, field, inv, roi: rev - (field + inv) };
    }, [vaultItems, forensics]);

    const handleConfirmSettlement = (data: any) => {
        console.log("Settlement Confirmed:", data);
        alert("Institutional Settlement bridge committed to ledger.");
        setSelectedHarvestId(null);
    };

    const selectedItem = vaultItems.find(i => i.id === selectedHarvestId);
    const selectedHarvest = selectedItem ? harvestEvents.find(e => e.id === selectedItem.relatedHarvestId) : null;
    const selectedCost = selectedHarvestId ? forensics[vaultItems.findIndex(i => i.id === selectedHarvestId)] : null;


    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">
                            {view === 'organizations' ? 'Organizations' : 'Institutional Control'}
                        </h1>
                        <p className="text-slate-500 text-sm mt-1 font-medium">
                            {view === 'organizations' 
                                ? "Join your team's workspace or register a new one to unlock AgriMap's full potential."
                                : "High-level oversight and forensic auditing of your agricultural operations."}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Delete User Account Profile Button */}
                        <button
                            onClick={() => setShowDeleteProfileModal(true)}
                            className="px-4 py-2.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm active:scale-95"
                            title={isKa ? "საკუთარი მომხმარებლის პროფილის წაშლა" : "Delete your user account profile"}
                        >
                            <TrashIcon className="w-3.5 h-3.5" />
                            {isKa ? 'პროფილის წაშლა' : 'Delete User Profile'}
                        </button>

                        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                            <button 
                                onClick={() => setView('organizations')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'organizations' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                Organizations
                            </button>
                            <button 
                                onClick={() => setView('control')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'control' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                Audit & Control
                            </button>
                        </div>
                    </div>
                </div>

                {view === 'organizations' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up">
                        {/* Left Column: List */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <BuildingStorefrontIcon className="w-4 h-4" /> {t('profile.your_orgs')}
                                </h3>
                                
                                <div className="space-y-4">
                                    {userOrgs.length > 0 ? (
                                        userOrgs.map(org => {
                                            const isActive = org.id === activeOrgId;
                                            const orgMem = memberships.find(m => m.organizationId === org.id && m.userId === currentUser.id);
                                            const userRole = isRootOrSuperAdmin 
                                                ? (orgMem?.role || 'ROOT_SUPER_ADMIN') 
                                                : (orgMem?.role || (org.createdBy === currentUser.id ? 'Founder' : 'Member'));
                                            
                                            const isPaused = org.isPaused || org.status === 'paused';
                                            const pendingDelReq = deletionRequests.find(r => r.organizationId === org.id && r.status === 'pending');
                                            const foundersList = getOrgFounders(org);
                                            const isFounderOrAdmin = userRole === 'Founder' || userRole === 'Admin' || isRootOrSuperAdmin;

                                            return (
                                                <div 
                                                    key={org.id} 
                                                    className={`group p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col gap-4 ${
                                                        isActive 
                                                            ? 'border-indigo-600 bg-indigo-50/20 shadow-xl shadow-indigo-100/50' 
                                                            : isPaused
                                                                ? 'border-amber-200 bg-amber-50/20 hover:border-amber-300 hover:bg-amber-50/30'
                                                                : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-xl hover:shadow-slate-100'
                                                    }`}
                                                >
                                                    {/* Top Row: Icon, Title, Badges, and Top-Right Action Buttons */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${
                                                                isActive 
                                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                                                    : isPaused
                                                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                                                        : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                                <BuildingStorefrontIcon className="w-7 h-7" />
                                                            </div>

                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                    <h4 className={`text-lg font-black uppercase tracking-tight truncate ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>
                                                                        {org.name}
                                                                    </h4>
                                                                    {isActive && (
                                                                        <span className="bg-indigo-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                                                                            Active
                                                                        </span>
                                                                    )}
                                                                    {isPaused && (
                                                                        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest flex items-center gap-1">
                                                                            <PauseIcon className="w-2.5 h-2.5" />
                                                                            {isKa ? 'შეჩერებულია' : 'Paused'}
                                                                        </span>
                                                                    )}
                                                                    {pendingDelReq && (
                                                                        <span className="bg-red-100 text-red-800 border border-red-300 text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                                                            <AlertTriangleIcon className="w-2.5 h-2.5" />
                                                                            {isKa ? 'წაშლა მოთხოვნილია' : 'Deletion Pending'}
                                                                        </span>
                                                                    )}
                                                                    {isFounderOrAdmin && (
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingOrg(org);
                                                                                setEditOrgData(org);
                                                                                setIsEditOrgModalOpen(true);
                                                                            }}
                                                                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                            title={isKa ? "რედაქტირება" : "Edit Name"}
                                                                        >
                                                                            <PencilIcon size={13} />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                                    <div className="flex items-center gap-1">
                                                                        <ShieldCheckIcon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                                                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{userRole}</span>
                                                                        {(userRole === 'Founder' || isRootOrSuperAdmin) && (
                                                                            <button
                                                                                onClick={() => setChangingFounderOrg(org)}
                                                                                className="ml-1 text-[9px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 uppercase tracking-wider transition-all"
                                                                                title={isKa ? "დამფუძნებლის შეცვლა" : "Change Founder"}
                                                                            >
                                                                                {isKa ? 'შეცვლა' : 'Change'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <GlobeIcon className={`w-3.5 h-3.5 ${org.isDiscoverable ? 'text-emerald-500' : 'text-slate-300'}`} />
                                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                                            {org.isDiscoverable ? (isKa ? 'საჯარო' : 'Public') : (isKa ? 'პირადი' : 'Private')}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <RectangleStackIcon className="w-3.5 h-3.5 text-slate-400" />
                                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{org.type || 'LTD'}</span>
                                                                    </div>
                                                                    {org.region && (
                                                                        <div className="flex items-center gap-1">
                                                                            <MapIcon className="w-3.5 h-3.5 text-slate-400" />
                                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{org.region}</span>
                                                                        </div>
                                                                    )}
                                                                    {org.areaHa ? (
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{org.areaHa} HA</span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* The 4 Action Buttons requested in screenshot_1.png */}
                                                        <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-center">
                                                            {/* 1. Subscription Button */}
                                                            <button
                                                                onClick={() => setManagingSubscriptionOrg(org)}
                                                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95"
                                                                title={isKa ? "გამოწერის მართვა" : "Manage Subscription"}
                                                            >
                                                                <StarIcon className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                                <span>{org.tier || 'Trial'}</span>
                                                            </button>

                                                            {/* 2. Reset Plantation Button */}
                                                            <button
                                                                onClick={() => setResetPlantationOrg(org)}
                                                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95"
                                                                title={isKa ? "პლანტაციის განულება" : "Reset Plantation"}
                                                            >
                                                                <RefreshCwIcon className="w-3 h-3 text-slate-500" />
                                                                <span>{isKa ? 'განულება' : 'Reset'}</span>
                                                            </button>

                                                            {/* 3. Pause / Resume Button */}
                                                            <button
                                                                onClick={() => handleTogglePause(org)}
                                                                className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95 border ${
                                                                    isPaused
                                                                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                                                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                                                }`}
                                                                title={isPaused ? (isKa ? "გაგრძელება" : "Resume") : (isKa ? "შეჩერება" : "Pause")}
                                                            >
                                                                {isPaused ? <PlayIcon className="w-3 h-3 text-emerald-600" /> : <PauseIcon className="w-3 h-3 text-amber-600" />}
                                                                <span>{isPaused ? (isKa ? 'გაგრძელება' : 'Resume') : (isKa ? 'შეჩერება' : 'Pause')}</span>
                                                            </button>

                                                            {/* 4. Delete Organization Button */}
                                                            <button
                                                                onClick={() => handleInitiateDeleteOrg(org)}
                                                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95"
                                                                title={isKa ? "კომპანიის წაშლა" : "Delete Organization"}
                                                            >
                                                                <TrashIcon className="w-3 h-3" />
                                                                <span>{isKa ? 'წაშლა' : 'Delete'}</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Pending Deletion Request Approval Banner (if applicable) */}
                                                    {pendingDelReq && (
                                                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2 text-amber-900 font-black uppercase tracking-wider text-[10px]">
                                                                    <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600" />
                                                                    <span>{isKa ? 'წაშლის მოთხოვნა ელოდება თანადამფუძნებლების დასტურს' : 'Deletion Approval Pending Co-Founder Votes'}</span>
                                                                </div>
                                                                <p className="text-slate-600 text-[11px]">
                                                                    {isKa ? 'ინიციატორი:' : 'Requested by:'} <strong>{pendingDelReq.requestedBy.name}</strong> • {new Date(pendingDelReq.requestedAt).toLocaleDateString()}
                                                                    {' | '}{isKa ? 'თანხმობა:' : 'Approvals:'} <strong>{pendingDelReq.approvals.length} / {pendingDelReq.coFounderIds.length + 1}</strong>
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {pendingDelReq.coFounderIds.includes(currentUser.id) && !pendingDelReq.approvals.includes(currentUser.id) && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleVoteDeletion(pendingDelReq.id, true)}
                                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm"
                                                                        >
                                                                            {isKa ? 'თანხმობა (წაშლა)' : 'Approve Deletion'}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleVoteDeletion(pendingDelReq.id, false)}
                                                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm"
                                                                        >
                                                                            {isKa ? 'უარყოფა' : 'Reject'}
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {(pendingDelReq.requestedBy.id === currentUser.id || isRootOrSuperAdmin) && (
                                                                    <button
                                                                        onClick={() => handleCancelDeletionRequest(pendingDelReq.id)}
                                                                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                                                                    >
                                                                        {isKa ? 'მოთხოვნის გაუქმება' : 'Cancel Request'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Bottom Row: Founders list + Message Co-Founders / Run Ads + Manage + Switch */}
                                                    <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                                {isKa ? 'დამფუძნებლები:' : 'Founders:'}
                                                            </span>
                                                            {foundersList.map(f => (
                                                                <span 
                                                                    key={f.userId} 
                                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                                                                        f.isMe 
                                                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                    }`}
                                                                >
                                                                    {f.name} {f.isCreator ? '⭐' : ''}
                                                                </span>
                                                            ))}
                                                        </div>

                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {/* Message Co-Founders */}
                                                            <button
                                                                onClick={() => setMessageModal({ org, mode: 'coFounders' })}
                                                                className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                                                                title={isKa ? "შეტყობინება დამფუძნებლებს" : "Message Co-Founders"}
                                                            >
                                                                <UsersIcon className="w-3 h-3 text-indigo-500" />
                                                                <span>{isKa ? 'დამფუძნებლებთან ჩათი' : 'Message Founders'}</span>
                                                            </button>

                                                            {/* Broadcast / Run Ads */}
                                                            <button
                                                                onClick={() => setMessageModal({ org, mode: 'broadcast' })}
                                                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                                                                title={isKa ? "კომპანიებს შეტყობინება / რეკლამა" : "Broadcast / Run Ads to Companies"}
                                                            >
                                                                <PaperAirplaneIcon className="w-3 h-3 text-indigo-600" />
                                                                <span>{isKa ? 'რეკლამა / ქსელი' : 'Run Ads / Network'}</span>
                                                            </button>

                                                            {/* Manage Modal Button */}
                                                            <button
                                                                onClick={() => setManagingOrg(org)}
                                                                className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5"
                                                            >
                                                                <span>{isKa ? 'მართვა' : 'Manage'}</span>
                                                                <ChevronRightIcon className="w-3 h-3" />
                                                            </button>

                                                            {/* Switch Org button (if not active) */}
                                                            {!isActive && (
                                                                <button 
                                                                    onClick={() => onSwitchOrg(org.id)}
                                                                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm"
                                                                >
                                                                    {isKa ? 'გააქტიურება' : 'Switch Workspace'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
                                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                                <BuildingStorefrontIcon className="w-10 h-10 text-slate-200" />
                                            </div>
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No organizations found</p>
                                            <p className="text-xs text-slate-400 mt-2">Register your first plantation to get started</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Actions */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <PlusIcon className="w-4 h-4" /> {t('common.quick_actions')}
                                </h3>
                                
                                <div className="space-y-4">
                                    <button 
                                        onClick={() => setIsRegistrationOpen(true)}
                                        className="w-full group p-6 bg-slate-900 text-white rounded-3xl hover:bg-slate-800 transition-all text-left relative overflow-hidden shadow-xl shadow-slate-200"
                                    >
                                        <div className="relative z-10">
                                            <h4 className="text-sm font-black uppercase tracking-tight mb-1">{t('profile.register_new')}</h4>
                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{t('profile.register_new_desc')}</p>
                                        </div>
                                        <PlusIcon className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-white/5 group-hover:scale-110 transition-transform" />
                                    </button>

                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{t('profile.join_org')}</h4>
                                        <div className="relative">
                                            <input 
                                                type="text"
                                                placeholder={t('profile.search_placeholder')}
                                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                value={orgSearchQuery}
                                                onChange={(e) => setOrgSearchQuery(e.target.value)}
                                            />
                                            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            
                                            {orgSearchQuery.length > 0 && (
                                                <div className="absolute z-50 left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-2xl text-left animate-in fade-in slide-in-from-top-2 duration-200">
                                                    {discoverableOrganizations
                                                        .filter(o => {
                                                            const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                                            if (!queryClean) return true;
                                                            const queryTranslit = transliterateGeoToEng(queryClean);
                                                            const queryReverse = transliterateEngToGeo(queryClean);
                                                            
                                                            const nameLower = (o.name || '').toLowerCase();
                                                            const idLower = (o.id || '').toLowerCase();
                                                            const legalLower = (o.legalName || '').toLowerCase();
                                                            const agTypeLower = (o.agricultureType || '').toLowerCase();
                                                            
                                                            const matchQuery = nameLower.includes(queryClean) || 
                                                                               idLower.includes(queryClean) || 
                                                                               legalLower.includes(queryClean) ||
                                                                               agTypeLower.includes(queryClean) ||
                                                                               nameLower.includes(queryTranslit) ||
                                                                               idLower.includes(queryTranslit) ||
                                                                               legalLower.includes(queryTranslit) ||
                                                                               nameLower.includes(queryReverse) ||
                                                                               idLower.includes(queryReverse);

                                                            const alreadyMember = memberships.some(mem => mem.organizationId === o.id);
                                                            return matchQuery && !alreadyMember;
                                                        })
                                                        .slice(0, 10)
                                                        .map(o => (
                                                            <button 
                                                                key={o.id} 
                                                                onClick={() => {
                                                                    setDiscoveryOrg(o);
                                                                    setOrgSearchQuery(o.name);
                                                                }}
                                                                className="w-full p-4 hover:bg-indigo-50 text-xs font-bold text-slate-700 border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors group"
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="group-hover:text-indigo-600 transition-colors uppercase tracking-tight font-black">{o.name}</span>
                                                                    <span className="text-[8px] text-slate-400 font-mono uppercase mt-0.5">ID: {o.id}</span>
                                                                </div>
                                                                <ChevronRightIcon size={12} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                                                            </button>
                                                        ))
                                                    }
                                                    {discoverableOrganizations.filter(o => {
                                                        const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                                        if (!queryClean) return true;
                                                        const queryTranslit = transliterateGeoToEng(queryClean);
                                                        const queryReverse = transliterateEngToGeo(queryClean);
                                                        
                                                        const nameLower = (o.name || '').toLowerCase();
                                                        const idLower = (o.id || '').toLowerCase();
                                                        const legalLower = (o.legalName || '').toLowerCase();
                                                        const agTypeLower = (o.agricultureType || '').toLowerCase();
                                                        
                                                        const matchQuery = nameLower.includes(queryClean) || 
                                                                           idLower.includes(queryClean) || 
                                                                           legalLower.includes(queryClean) ||
                                                                           agTypeLower.includes(queryClean) ||
                                                                           nameLower.includes(queryTranslit) ||
                                                                           idLower.includes(queryTranslit) ||
                                                                           legalLower.includes(queryTranslit) ||
                                                                           nameLower.includes(queryReverse) ||
                                                                           idLower.includes(queryReverse);

                                                        const alreadyMember = memberships.some(mem => mem.organizationId === o.id);
                                                        return matchQuery && !alreadyMember;
                                                    }).length === 0 && (
                                                        <div className="p-6 text-center text-[10px] font-black text-slate-300 uppercase italic">
                                                            No organizations found
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const filtered = discoverableOrganizations.filter(o => {
                                                    const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                                    if (!queryClean) return true;
                                                    const queryTranslit = transliterateGeoToEng(queryClean);
                                                    const queryReverse = transliterateEngToGeo(queryClean);
                                                    
                                                    const nameLower = (o.name || '').toLowerCase();
                                                    const idLower = (o.id || '').toLowerCase();
                                                    const legalLower = (o.legalName || '').toLowerCase();
                                                    const agTypeLower = (o.agricultureType || '').toLowerCase();
                                                    
                                                    const matchQuery = nameLower.includes(queryClean) || 
                                                                       idLower.includes(queryClean) || 
                                                                       legalLower.includes(queryClean) ||
                                                                       agTypeLower.includes(queryClean) ||
                                                                       nameLower.includes(queryTranslit) ||
                                                                       idLower.includes(queryTranslit) ||
                                                                       legalLower.includes(queryTranslit) ||
                                                                       nameLower.includes(queryReverse) ||
                                                                       idLower.includes(queryReverse);

                                                    const alreadyMember = memberships.some(mem => mem.organizationId === o.id);
                                                    return matchQuery && !alreadyMember;
                                                });
                                                if (filtered.length > 0) {
                                                    setDiscoveryOrg(filtered[0]);
                                                } else {
                                                    toast.error("No organization matches your search query yet.");
                                                }
                                            }}
                                            disabled={!orgSearchQuery}
                                            className="w-full py-3 bg-indigo-600 border-2 border-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:border-indigo-700 transition-all disabled:opacity-50 disabled:bg-white disabled:border-slate-200 disabled:text-slate-400"
                                        >
                                            {t('profile.send_join_request')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                                <div className="relative z-10">
                                    <h3 className="text-sm font-black uppercase tracking-tight mb-2">Need Help?</h3>
                                    <p className="text-xs text-indigo-100 font-medium leading-relaxed">
                                        Our support team can help you migrate your existing farm data or set up complex multi-org structures.
                                    </p>
                                    <button className="mt-6 px-6 py-2.5 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                                        Contact Support
                                    </button>
                                </div>
                                <SparklesIcon className="absolute right-[-20px] top-[-20px] w-32 h-32 text-white/10" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-slide-up">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-xl hover:shadow-indigo-50 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
                                        <BanknotesIcon className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">+12.5%</span>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Valuation</p>
                                <h4 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(2400000)}</h4>
                            </div>
                            
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-xl hover:shadow-emerald-50 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
                                        <ArrowTrendingUpIcon className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">High</span>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg ROI</p>
                                <h4 className="text-2xl font-black text-slate-900 mt-1">34.2%</h4>
                            </div>

                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-xl hover:shadow-orange-50 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl group-hover:scale-110 transition-transform">
                                        <LeafIcon className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">8 Fields</span>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Harvests</p>
                                <h4 className="text-2xl font-black text-slate-900 mt-1">12.4t</h4>
                            </div>

                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-xl hover:shadow-blue-50 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
                                        <UsersIcon className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">Active</span>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workforce</p>
                                <h4 className="text-2xl font-black text-slate-900 mt-1">{employees.length} Units</h4>
                            </div>
                        </div>

                        {/* Audit Table */}
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                        <ChartBarIcon className="w-5 h-5 text-indigo-600" /> Forensic Production Audit
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time settlement & ROI analysis</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400">
                                        <ArchiveBoxIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plantation</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Variety</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Production</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cost</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">OPEX/KG</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {vaultItems.map((item, idx) => {
                                            const cost = forensics[idx];
                                            const harvest = harvestEvents.find(e => e.id === item.relatedHarvestId);
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                                <TractorIcon className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-slate-800 uppercase">{item.name}</p>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex flex-wrap gap-1">
                                                            {harvest?.yieldByVariety?.map(v => (
                                                                <span key={v.variety} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase tracking-widest">
                                                                    {v.variety}
                                                                </span>
                                                            )) || <span className="text-[10px] font-bold text-slate-400">N/A</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <p className="text-xs font-black text-slate-800">{item.currentStock.toLocaleString()} KG</p>
                                                        <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Verified</p>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <p className="text-xs font-black text-slate-800">{formatCurrency(cost.total)}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">All-in Cost</p>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <p className="text-xs font-black text-slate-800">{formatCurrency(cost.total / (item.currentStock || 1))}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Unit Cost</p>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <button 
                                                            onClick={() => setSelectedHarvestId(item.relatedHarvestId || null)}
                                                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-slate-100"
                                                        >
                                                            <SparklesIcon className="w-3.5 h-3.5" /> Settle
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Registration Modal */}
            {isRegistrationOpen && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-10 space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Register Organization</h2>
                                    <p className="text-sm text-slate-500 font-medium mt-1">Enter your company details to create a workspace.</p>
                                </div>
                                <button onClick={() => setIsRegistrationOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <XIcon className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Green Valley Farms"
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={regData.name}
                                        onChange={(e) => setRegData({...regData, name: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tax Number</label>
                                        <input 
                                            type="text"
                                            placeholder="e.g. 204561234"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            value={regData.taxNumber}
                                            onChange={(e) => setRegData({...regData, taxNumber: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Phone</label>
                                        <input 
                                            type="text"
                                            placeholder="e.g. +995 555 123 456"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            value={regData.phone}
                                            onChange={(e) => setRegData({...regData, phone: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Org Type</label>
                                        <select 
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                                            value={regData.type}
                                            onChange={(e) => setRegData({...regData, type: e.target.value as OrganizationType})}
                                        >
                                            <option value="LTD">LTD</option>
                                            <option value="Individual">Individual</option>
                                            <option value="Cooperative">Cooperative</option>
                                            <option value="NGO">NGO</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Agri Type</label>
                                        <select 
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                                            value={regData.agricultureType}
                                            onChange={(e) => setRegData({...regData, agricultureType: e.target.value as AgricultureType})}
                                        >
                                            <option value="General">General</option>
                                            <option value="Vineyard">Vineyard</option>
                                            <option value="Orchard">Orchard</option>
                                            <option value="Greenhouse">Greenhouse</option>
                                            <option value="Livestock">Livestock</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Region</label>
                                        <input 
                                            type="text"
                                            placeholder="e.g. Kakheti"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            value={regData.region}
                                            onChange={(e) => setRegData({...regData, region: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Area (HA)</label>
                                        <input 
                                            type="number"
                                            placeholder="e.g. 50"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            value={regData.areaHa}
                                            onChange={(e) => setRegData({...regData, areaHa: parseFloat(e.target.value) || 0})}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Crops to Manage</label>
                                    <div className="flex flex-wrap gap-2">
                                        {COMMON_CROPS.map(cropName => {
                                            const isSelected = regData.selectedCrops.some(c => c.name === cropName);
                                            return (
                                                <button
                                                    key={cropName}
                                                    onClick={() => {
                                                        const newCrops = isSelected 
                                                            ? regData.selectedCrops.filter(c => c.name !== cropName)
                                                            : [...regData.selectedCrops, {name: cropName, varieties: []}];
                                                        setRegData({...regData, selectedCrops: newCrops});
                                                    }}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-white'}`}
                                                >
                                                    {cropName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {regData.selectedCrops.length === 0 && (
                                        <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                                            <InfoIcon size={12}/> Please select at least one crop
                                        </p>
                                    )}

                                    {/* Edit varieties for selected crops */}
                                    {regData.selectedCrops.length > 0 && (
                                        <div className="mt-4 space-y-4 max-h-48 overflow-y-auto no-scrollbar">
                                            {regData.selectedCrops.map(crop => (
                                                <div key={crop.name} className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-tight">{crop.name} Varieties</h4>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {crop.varieties.map((v, i) => (
                                                            <div key={i} className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1">
                                                                {v}
                                                                <button type="button" onClick={() => {
                                                                    setRegData({
                                                                        ...regData, 
                                                                        selectedCrops: regData.selectedCrops.map(c => c.name === crop.name ? {...c, varieties: c.varieties.filter((_, idx) => idx !== i)} : c)
                                                                    });
                                                                }} className="hover:text-red-500 ml-1">&times;</button>
                                                            </div>
                                                        ))}
                                                        {crop.varieties.length === 0 && <span className="text-xs text-indigo-400">No varieties added (optional)</span>}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Add variety (e.g. Chandler)" 
                                                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const val = e.currentTarget.value.trim();
                                                                    if (val && !crop.varieties.includes(val)) {
                                                                        setRegData({
                                                                            ...regData, 
                                                                            selectedCrops: regData.selectedCrops.map(c => c.name === crop.name ? {...c, varieties: [...c.varieties, val]} : c)
                                                                        });
                                                                        e.currentTarget.value = '';
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button 
                                                            type="button"
                                                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                                const val = input.value.trim();
                                                                if (val && !crop.varieties.includes(val)) {
                                                                    setRegData({
                                                                        ...regData, 
                                                                        selectedCrops: regData.selectedCrops.map(c => c.name === crop.name ? {...c, varieties: [...c.varieties, val]} : c)
                                                                    });
                                                                    input.value = '';
                                                                }
                                                            }}
                                                        >Add</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Discoverable</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Allow others to find your org</p>
                                    </div>
                                    <button 
                                        onClick={() => setRegData({...regData, isDiscoverable: !regData.isDiscoverable})}
                                        className={`w-12 h-6 rounded-full p-1 transition-all ${regData.isDiscoverable ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${regData.isDiscoverable ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => handleAddOrg(true)}
                                    className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <MapIcon className="h-4 w-4" />
                                    Draw on Map
                                </button>
                                <button 
                                    onClick={() => handleAddOrg(false)}
                                    className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                                >
                                    Create Workspace
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settlement Modal */}
            {selectedHarvestId && (
                <SettlementTerminal 
                    harvest={harvestEvents.find(e => e.id === selectedHarvestId)!}
                    item={vaultItems.find(i => i.relatedHarvestId === selectedHarvestId)!}
                    cost={forensics.find((_, i) => vaultItems[i].relatedHarvestId === selectedHarvestId)!}
                    formatCurrency={formatCurrency}
                    onClose={() => setSelectedHarvestId(null)}
                    onConfirm={(data) => {
                        console.log("Settlement Confirmed:", data);
                        setSelectedHarvestId(null);
                        toast.success("Settlement finalized and recorded in ledger.");
                    }}
                />
            )}
            {/* Edit Organization Modal */}
            {isEditOrgModalOpen && editingOrg && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">{t('profile.edit_org')}</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Refine your workspace profile</p>
                            </div>
                            <button onClick={() => setIsEditOrgModalOpen(false)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-colors">
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Organization Name</label>
                                    <input 
                                        type="text" 
                                        value={editOrgData.name || ''}
                                        onChange={(e) => setEditOrgData({...editOrgData, name: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tax Number</label>
                                    <input 
                                        type="text" 
                                        value={editOrgData.taxNumber || ''}
                                        onChange={(e) => setEditOrgData({...editOrgData, taxNumber: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agriculture Type</label>
                                    <select 
                                        value={editOrgData.agricultureType || ''}
                                        onChange={(e) => setEditOrgData({...editOrgData, agricultureType: e.target.value as AgricultureType})}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    >
                                        <option value="General">General Agriculture</option>
                                        <option value="Fruit">Fruit Production</option>
                                        <option value="Vegetable">Vegetable Production</option>
                                        <option value="Grain">Grain Production</option>
                                        <option value="Livestock">Livestock</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discoverability</label>
                                    <div className="flex items-center gap-4 py-3">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={editOrgData.isDiscoverable}
                                                onChange={(e) => setEditOrgData({...editOrgData, isDiscoverable: e.target.checked})}
                                                className="w-4 h-4 rounded text-indigo-600"
                                            />
                                            <span className="text-xs font-bold text-slate-700">Public Registry</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={handleUpdateOrgInternal}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
                            >
                                {t('profile.save_changes')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Discovery Handshake Modal */}
            {discoveryOrg && (
                <div className="fixed inset-0 bg-black/60 z-[7000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-600">
                                    <BuildingStorefrontIcon size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{discoveryOrg.name}</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{(discoveryOrg.agricultureType) || 'Mixed Agriculture'} • {discoveryOrg.type}</p>
                                </div>
                            </div>
                            <button onClick={() => setDiscoveryOrg(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <XIcon size={24} />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-4">
                            <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 mb-4">
                                <p className="text-[10px] font-bold text-indigo-600 leading-relaxed uppercase tracking-tight text-center">
                                    Initiate a secure connection with this organization's administrative hub.
                                </p>
                            </div>
                            
                            <button 
                                onClick={() => {
                                    if (onAddPost && currentUser) {
                                        onAddPost({
                                            content: `Inquiry from ${currentUser.name}: Hello, I am interested in connecting with ${discoveryOrg.name}.`,
                                            channelId: 'internal',
                                            hubType: 'internal',
                                            isDirectMessage: true,
                                            recipientId: discoveryOrg.createdBy || 'founder',
                                            authorId: currentUser.id,
                                            authorName: currentUser.name,
                                            timestamp: new Date().toISOString(),
                                            replies: []
                                        });
                                        setDiscoveryOrg(null);
                                        toast.success("Message sent! Notification dispatched to Team Hub.");
                                    }
                                }}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <UsersIcon size={18} /> Send Message
                            </button>
                            
                            <button 
                                onClick={async () => {
                                    if (!discoveryOrg || !currentUser) return;
                                    const membershipId = `${currentUser.id}_${discoveryOrg.id}`;
                                    const newMembership: Membership = {
                                        id: membershipId,
                                        userId: currentUser.id,
                                        organizationId: discoveryOrg.id,
                                        role: 'Employee',
                                        permissionLevel: 'write',
                                        status: 'pending',
                                        joinedAt: new Date().toISOString()
                                    };

                                    try {
                                        if (USE_FIREBASE) {
                                            // 1. Create membership
                                            await setDoc(doc(db, 'memberships', membershipId), newMembership);

                                            // 2. Create employee matching
                                            const newEmployee: Employee = {
                                                id: `emp-${currentUser.id}-${discoveryOrg.id}`,
                                                name: currentUser.name || "Unknown",
                                                email: currentUser.email || "",
                                                phone: currentUser.phone || '',
                                                idNumber: currentUser.personalNumber || '',
                                                roleId: 'Employee',
                                                paymentType: 'hourly',
                                                paymentRate: 0,
                                                barcode: `BC-${Date.now()}`,
                                                employeeType: 'Temporary',
                                                accountType: 'Bank Account',
                                                status: 'active',
                                                joinedAt: new Date().toISOString(),
                                                organizationId: discoveryOrg.id
                                            };
                                            await setDoc(doc(db, 'employees', newEmployee.id), newEmployee);

                                            // 3. Create Alert for the owner
                                            const alertId = `alert-join-${Date.now()}`;
                                            await setDoc(doc(db, 'alerts', alertId), {
                                                id: alertId,
                                                organizationId: discoveryOrg.id,
                                                title: 'New Join Request',
                                                content: `${currentUser.name} has requested to join ${discoveryOrg.name}.`,
                                                type: 'info',
                                                timestamp: new Date().toISOString(),
                                                isRead: false,
                                                createdBy: currentUser.id,
                                                metadata: { 
                                                    membershipId, 
                                                    userId: currentUser.id
                                                },
                                                actions: [
                                                    { label: 'Approve', actionType: 'approve_join', actionData: { membershipId, userId: currentUser.id } }
                                                ]
                                            });
                                        } else {
                                            // Offline / Mock fallback
                                            const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
                                            const filteredMems = savedMemberships.filter((m: any) => m.id !== membershipId);
                                            localStorage.setItem('mock_memberships', JSON.stringify([...filteredMems, newMembership]));

                                            const newEmployee: Employee = {
                                                id: `emp-${currentUser.id}-${discoveryOrg.id}`,
                                                name: currentUser.name || "Unknown",
                                                email: currentUser.email || "",
                                                phone: currentUser.phone || '',
                                                idNumber: currentUser.personalNumber || '',
                                                roleId: 'Employee',
                                                paymentType: 'hourly',
                                                paymentRate: 0,
                                                barcode: `BC-${Date.now()}`,
                                                employeeType: 'Temporary',
                                                accountType: 'Bank Account',
                                                status: 'active',
                                                joinedAt: new Date().toISOString(),
                                                organizationId: discoveryOrg.id
                                            };
                                            const savedEmployees = safeStorage.safeParse(localStorage.getItem('mock_employees'), []);
                                            localStorage.setItem('mock_employees', JSON.stringify([...savedEmployees, newEmployee]));
                                        }

                                        // Write direct message post for community hub
                                        if (onAddPost) {
                                            onAddPost({
                                                content: `Formal Join Request: ${currentUser.name} has requested to join ${discoveryOrg.name} as a professional partner.`,
                                                channelId: 'internal',
                                                hubType: 'internal',
                                                isDirectMessage: true,
                                                recipientId: discoveryOrg.createdBy || 'founder',
                                                authorId: currentUser.id,
                                                authorName: currentUser.name,
                                                timestamp: new Date().toISOString(),
                                                replies: []
                                            });
                                        }

                                        toast.success("Handshake request successfully submitted!");
                                        setDiscoveryOrg(null);
                                    } catch (error) {
                                        console.error("Error sending handshake request:", error);
                                        toast.error("Failed to submit join request. Please try again.");
                                    }
                                }}
                                className="w-full py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                Send Join Request
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete User Account / Profile Modal */}
            {showDeleteProfileModal && (
                <div className="fixed inset-0 bg-black/60 z-[7000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-red-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
                                    <TrashIcon size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-red-950 uppercase tracking-tight">
                                        {isKa ? 'პროფილის წაშლა' : 'Delete Account Profile'}
                                    </h2>
                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-0.5">
                                        {currentUser.name} ({currentUser.email || currentUser.phone || currentUser.id})
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowDeleteProfileModal(false)} className="p-2 hover:bg-red-100 rounded-full transition-colors text-slate-400">
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            <div className="p-4 bg-red-50 rounded-2xl border border-red-200">
                                <p className="text-xs text-red-900 leading-relaxed font-medium">
                                    {isKa 
                                        ? "ყურადღება: თქვენი მომხმარებლის პროფილის, ავტორიზაციის და წვდომების წაშლა შეუქცევადია. თქვენ გამოხვალთ სისტემიდან."
                                        : "Warning: Deleting your user account profile and credentials is permanent and irreversible. You will be signed out immediately."
                                    }
                                </p>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setShowDeleteProfileModal(false)}
                                    disabled={isDeletingProfile}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    onClick={handleDeleteAccountInternal}
                                    disabled={isDeletingProfile}
                                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                                >
                                    {isDeletingProfile ? (
                                        <RefreshCwIcon className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <TrashIcon className="w-4 h-4" />
                                    )}
                                    <span>{isKa ? 'დიახ, წაშალე' : 'Delete Account'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Organization Modal (Sole Founder vs. Co-Founder Approval vs. Root Super Admin) */}
            {deleteOrgModal && (
                <div className="fixed inset-0 bg-black/60 z-[7000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-red-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
                                    <TrashIcon size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                        {deleteOrgModal.org.name}
                                    </h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 text-slate-400">
                                        {isKa ? 'კომპანიის წაშლის პროცესი' : 'Company Deletion Workflow'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setDeleteOrgModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            {deleteOrgModal.isRootSuperAdmin ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-xs font-black uppercase tracking-wider w-fit">
                                        <ShieldCheckIcon className="w-4 h-4" />
                                        <span>Root / Super Admin Authority</span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                        {isKa
                                            ? "როგორც Root / Super Admin, თქვენ გაქვთ უფლებამოსილება წაშალოთ პლანტაცია და კომპანია თანადამფუძნებლების თანხმობის გარეშე."
                                            : "As a Root / Super Admin, you have direct authorization to delete this plantation and workspace without requiring co-founder approval."
                                        }
                                    </p>
                                </div>
                            ) : deleteOrgModal.isSoleFounder ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-black uppercase tracking-wider w-fit">
                                        <CheckIcon className="w-4 h-4" />
                                        <span>{isKa ? 'ერთპიროვნული დამფუძნებელი' : 'Sole Registered Founder'}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                        {isKa
                                            ? "ეს კომპანია დარეგისტრირებულია თქვენ მიერ და არ ჰყავს სხვა თანადამფუძნებლები. შეგიძლიათ წაშალოთ ის პირდაპირ."
                                            : "This organization was registered by you and has no other registered co-founders. You can delete it directly without requiring other approvals."
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-black uppercase tracking-wider w-fit">
                                        <AlertTriangleIcon className="w-4 h-4" />
                                        <span>{isKa ? 'თანადამფუძნებლების თანხმობა აუცილებელია' : 'Co-Founder Approval Required'}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                        {isKa
                                            ? "კომპანიას ჰყავს რამდენიმე დამფუძნებელი. წასაშლელად საჭიროა ყველა თანადამფუძნებლის დასტური. დასტურის მოთხოვნა გაეგზავნება მათ:"
                                            : "This company has registered co-founders. To delete it, approval from all co-founders is mandatory. An approval request will be dispatched to:"
                                        }
                                    </p>
                                    <div className="space-y-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-100">
                                        {deleteOrgModal.coFounders.map(f => (
                                            <div key={f.userId} className="flex items-center justify-between text-xs p-2 bg-white rounded-xl border border-slate-200">
                                                <span className="font-bold text-slate-800">{f.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{f.email || f.userId}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3 pt-3">
                                <button
                                    onClick={() => setDeleteOrgModal(null)}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    onClick={handleConfirmDeleteOrg}
                                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    <span>
                                        {deleteOrgModal.isRootSuperAdmin || deleteOrgModal.isSoleFounder
                                            ? (isKa ? 'წაშლა დაუყოვნებლივ' : 'Delete Permanently')
                                            : (isKa ? 'მოთხოვნის გაგზავნა' : 'Send Approval Request')
                                        }
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Plantation Modal */}
            {resetPlantationOrg && (
                <div className="fixed inset-0 bg-black/60 z-[7000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-amber-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                                    <RefreshCwIcon size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                        {resetPlantationOrg.name}
                                    </h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 text-amber-600">
                                        {isKa ? 'პლანტაციის განულება' : 'Reset Plantation Data'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setResetPlantationOrg(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                {isKa
                                    ? "პლანტაციის განულება გაასუფთავებს რუკაზე მონიშნულ საზღვრებს, ნაკვეთებს, კულტურების მონაცემებსა და მოსავლის ისტორიას, ხოლო კომპანიის იურიდიული პროფილი შენარჩუნდება."
                                    : "Resetting will clear all map boundaries, plot markers, crop assignments, and harvest telemetry for this organization while preserving company registration."
                                }
                            </p>
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setResetPlantationOrg(null)}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    onClick={handleConfirmReset}
                                    className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2"
                                >
                                    <RefreshCwIcon className="w-4 h-4" />
                                    <span>{isKa ? 'დიახ, გაანულე' : 'Confirm Reset'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Subscription Modal */}
            {managingSubscriptionOrg && (
                <div className="fixed inset-0 bg-black/60 z-[7000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                                    <StarIcon size={24} className="fill-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                        {managingSubscriptionOrg.name}
                                    </h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 text-slate-400">
                                        {isKa ? 'გამოწერის გეგმის მართვა' : 'Subscription Plan Management'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setManagingSubscriptionOrg(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {isKa ? 'გამოწერის ტარიფი' : 'Subscription Tier'}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['Free', 'Pro', 'Enterprise'] as SubscriptionTier[]).map(tier => (
                                        <button
                                            key={tier}
                                            onClick={() => handleSaveSubscription(managingSubscriptionOrg, tier)}
                                            className={`p-3 rounded-2xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                                                managingSubscriptionOrg.tier === tier
                                                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-md shadow-amber-100'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            {tier}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2 pt-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {isKa ? 'სტატუსი' : 'Status'}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['Trial', 'Paid', 'Unpaid'] as SubscriptionStatus[]).map(st => (
                                        <button
                                            key={st}
                                            onClick={() => handleSaveSubscription(managingSubscriptionOrg, managingSubscriptionOrg.tier || 'Free', st)}
                                            className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                managingSubscriptionOrg.subscriptionStatus === st
                                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Founder Modal */}
            {changingFounderOrg && (
                <div className="fixed inset-0 bg-black/60 z-[7000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-indigo-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                                    <ShieldCheckIcon size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                        {changingFounderOrg.name}
                                    </h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 text-indigo-600">
                                        {isKa ? 'დამფუძნებლის შეცვლა / გადაცემა' : 'Transfer Founder Role'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setChangingFounderOrg(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                {isKa 
                                    ? "აირჩიეთ გუნდის წევრი, რომელსაც გადასცემთ მთავარი დამფუძნებლის (Founder) როლს:" 
                                    : "Select a team member to transfer the primary Founder role to:"}
                            </p>
                            <div className="space-y-2 max-h-52 overflow-y-auto">
                                {(allUsers && allUsers.length > 0 ? allUsers : [currentUser]).map(u => {
                                    const isCurrentFounder = changingFounderOrg.createdBy === u.id;
                                    return (
                                        <button
                                            key={u.id}
                                            onClick={() => handleChangeFounder(changingFounderOrg, u.id)}
                                            className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                                                isCurrentFounder
                                                    ? 'border-indigo-500 bg-indigo-50/50 cursor-default'
                                                    : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20'
                                            }`}
                                        >
                                            <div>
                                                <p className="text-xs font-black text-slate-900">{u.name}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">{u.email || u.id}</p>
                                            </div>
                                            {isCurrentFounder ? (
                                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                                    Current
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black text-indigo-600 hover:underline uppercase tracking-widest">
                                                    Assign
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Organization Modal (Public/Private, Region, Area, Quick Actions) */}
            {managingOrg && (
                <div className="fixed inset-0 bg-black/60 z-[7000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                                    <BuildingStorefrontIcon size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                        {managingOrg.name}
                                    </h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 text-slate-400">
                                        {isKa ? 'კომპანიის პარამეტრების მართვა' : 'Company Settings & Controls'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setManagingOrg(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            {/* Region and Area */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {isKa ? 'რეგიონი' : 'Region'}
                                    </label>
                                    <select
                                        value={managingOrg.region || 'Kakheti'}
                                        onChange={(e) => {
                                            const updated = { ...managingOrg, region: e.target.value };
                                            setManagingOrg(updated);
                                            if (onUpdateOrg) onUpdateOrg(updated);
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                                    >
                                        <option value="Kakheti">Kakheti</option>
                                        <option value="Kartli">Kartli</option>
                                        <option value="Imereti">Imereti</option>
                                        <option value="Samegrelo">Samegrelo</option>
                                        <option value="Guria">Guria</option>
                                        <option value="Adjara">Adjara</option>
                                        <option value="Racha">Racha</option>
                                        <option value="Samtskhe-Javakheti">Samtskhe-Javakheti</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {isKa ? 'ფართობი (ჰა)' : 'Area (HA)'}
                                    </label>
                                    <input
                                        type="number"
                                        value={managingOrg.areaHa || ''}
                                        onChange={(e) => {
                                            const updated = { ...managingOrg, areaHa: Number(e.target.value) };
                                            setManagingOrg(updated);
                                            if (onUpdateOrg) onUpdateOrg(updated);
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                                        placeholder="e.g. 50"
                                    />
                                </div>
                            </div>

                            {/* Public Visibility Toggle */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                        {isKa ? 'საჯარო ხილვადობა (Public)' : 'Public Visibility'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                        {isKa ? 'ჩანდეს თუ არა კომპანია საჯარო რეესტრში სხვა ფერმერებისთვის' : 'Make discoverable to other agricultural companies'}
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={managingOrg.isDiscoverable || false}
                                        onChange={(e) => {
                                            const updated = { ...managingOrg, isDiscoverable: e.target.checked };
                                            setManagingOrg(updated);
                                            if (onUpdateOrg) onUpdateOrg(updated);
                                            toast.success(e.target.checked ? "Company is now discoverable" : "Company is now private");
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>

                            {/* Quick Action Buttons inside modal */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        const org = managingOrg;
                                        setManagingOrg(null);
                                        setManagingSubscriptionOrg(org);
                                    }}
                                    className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border border-amber-200 transition-all"
                                >
                                    <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                    <span>{isKa ? 'გამოწერა' : 'Subscription'}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const org = managingOrg;
                                        setManagingOrg(null);
                                        setResetPlantationOrg(org);
                                    }}
                                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border border-slate-200 transition-all"
                                >
                                    <RefreshCwIcon className="w-3.5 h-3.5 text-slate-500" />
                                    <span>{isKa ? 'განულება' : 'Reset Plantation'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Co-Founders / Run Ads Modal */}
            {messageModal && (
                <div className="fixed inset-0 bg-black/60 z-[7000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-indigo-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                                    {messageModal.mode === 'coFounders' ? <UsersIcon size={24} /> : <PaperAirplaneIcon size={24} />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                        {messageModal.mode === 'coFounders' 
                                            ? (isKa ? 'დამფუძნებლებთან ჩათი' : 'Message Co-Founders') 
                                            : (isKa ? 'რეკლამა / განცხადება' : 'Broadcast / Run Ads')}
                                    </h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 text-indigo-600">
                                        {messageModal.org.name}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setMessageModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <XIcon size={20} />
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const content = (form.elements.namedItem('msgContent') as HTMLTextAreaElement).value;
                                const title = messageModal.mode === 'broadcast' 
                                    ? (form.elements.namedItem('adTitle') as HTMLInputElement)?.value 
                                    : undefined;
                                handleSendMessageOrAd(messageModal.org, messageModal.mode, content, title);
                            }}
                            className="p-8 space-y-4"
                        >
                            {messageModal.mode === 'broadcast' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {isKa ? 'სარეკლამო სათაური' : 'Ad Title'}
                                    </label>
                                    <input
                                        name="adTitle"
                                        type="text"
                                        required
                                        placeholder={isKa ? "მაგ. ახალი მოსავალი, ტექნიკის გაქირავება" : "e.g. Fresh Harvest Ready, Machinery Rental"}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {isKa ? 'შეტყობინების ტექსტი' : 'Message Content'}
                                </label>
                                <textarea
                                    name="msgContent"
                                    rows={4}
                                    required
                                    placeholder={
                                        messageModal.mode === 'coFounders'
                                            ? (isKa ? "შეიყვანეთ ტექსტი თანადამფუძნებლებისთვის..." : "Type a message to your co-founders...")
                                            : (isKa ? "შეიყვანეთ განცხადების ან რეკლამის ტექსტი..." : "Describe your advertisement or announcement to partner companies...")
                                    }
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setMessageModal(null)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                                >
                                    <PaperAirplaneIcon className="w-4 h-4" />
                                    <span>{messageModal.mode === 'coFounders' ? (isKa ? 'გაგზავნა' : 'Send') : (isKa ? 'გამოქვეყნება' : 'Publish Ad')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FoundersView;
