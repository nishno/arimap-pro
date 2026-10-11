import React, { useState, useMemo } from 'react';
import type { User, Organization, Membership, UserGoal } from '../types';
import { 
    BuildingStorefrontIcon, BriefcaseIcon, ShoppingBagIcon, 
    UserGroupIcon, HomeIcon, SearchIcon, PlusIcon, CheckIcon
} from './Icons';
import { ArrowRight, User as UserLucideIcon } from 'lucide-react';
import { CreateOrganizationModal } from './CreateOrganizationModal';
import { OfferServiceModal } from './OfferServiceModal';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export interface ChooseYourGoalWidgetProps {
    currentUser?: User | null;
    organizations?: Organization[];
    discoverableOrganizations?: Organization[];
    memberships?: Membership[];
    onUpdateUser?: (user: User) => void;
    onAddOrg?: (org: Organization, mem: Membership, selectedCrops?: any[]) => void;
    onSwitchOrg?: (orgId: string) => void;
    onNavigateMode?: (mode: string) => void;
    onOpenProfile?: () => void;
}

export const ChooseYourGoalWidget: React.FC<ChooseYourGoalWidgetProps> = ({
    currentUser,
    organizations = [],
    discoverableOrganizations = [],
    memberships = [],
    onUpdateUser,
    onAddOrg,
    onSwitchOrg,
    onNavigateMode,
    onOpenProfile
}) => {
    const { t } = useLanguage();

    // Current active tab in the widget (defaults to user's primary goal or MANAGE_COMPANY)
    const [activeGoalTab, setActiveGoalTab] = useState<UserGoal>(() => {
        return currentUser?.primaryGoal || 'MANAGE_COMPANY';
    });

    const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
    const [isOfferServiceModalOpen, setIsOfferServiceModalOpen] = useState(false);
    const [orgSearchQuery, setOrgSearchQuery] = useState('');

    const defaultServices = ['Field Worker', 'Tractor Operator', 'Agronomist', 'Pruning Specialist', 'General Labor'];
    const userServices = currentUser?.servicesOffered || [];

    const toggleQuickService = (service: string) => {
        if (!currentUser || !onUpdateUser) return;
        const currentList = currentUser.servicesOffered || [];
        const updated = currentList.includes(service)
            ? currentList.filter(s => s !== service)
            : [...currentList, service];
        
        onUpdateUser({
            ...currentUser,
            primaryGoal: 'OFFER_SERVICE',
            servicesOffered: updated,
            roles: (currentUser.roles || []).includes('Independent') 
                ? currentUser.roles 
                : [...(currentUser.roles || []), 'Independent']
        });
        toast.success(`Updated services: ${service}`);
    };

    const handleSelectGoal = (goal: UserGoal) => {
        setActiveGoalTab(goal);
        if (currentUser && onUpdateUser && currentUser.primaryGoal !== goal) {
            onUpdateUser({
                ...currentUser,
                primaryGoal: goal
            });
            toast.success(`Primary goal updated to ${goal.replace('_', ' ')}`);
        }
    };

    // User's joined organizations
    const userMemberships = useMemo(() => {
        return (memberships || []).filter(m => m.userId === currentUser?.id);
    }, [memberships, currentUser]);

    // Filtered discoverable organizations for join search
    const filteredDiscoverableOrgs = useMemo(() => {
        const query = orgSearchQuery.trim().toLowerCase();
        if (!query) return (discoverableOrganizations || []).slice(0, 4);
        return (discoverableOrganizations || []).filter(o => 
            (o.name && o.name.toLowerCase().includes(query)) ||
            (o.legalName && o.legalName.toLowerCase().includes(query)) ||
            (o.taxNumber && o.taxNumber.toLowerCase().includes(query)) ||
            (o.agricultureType && o.agricultureType.toLowerCase().includes(query))
        ).slice(0, 4);
    }, [discoverableOrganizations, orgSearchQuery]);

    const handleSendJoinRequest = (org: Organization) => {
        toast.success(`Join request sent to ${org.name}! The company founder will review your request.`);
    };

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col justify-between relative overflow-hidden">
            {/* Top Glow Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6" />

            <div>
                {/* Header with Title & Goal Badges */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                            <BuildingStorefrontIcon size={18} />
                        </div>
                        <div>
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                {t('dash.widget.choose_goal')}
                            </h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                {t('goal.subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 bg-indigo-100/70 text-indigo-800 rounded-xl text-[9px] font-black uppercase tracking-wider border border-indigo-200">
                            {currentUser?.primaryGoal?.replace('_', ' ') || 'Goal Hub'}
                        </span>
                    </div>
                </div>

                {/* Goal Selector Switcher Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-2xl border border-slate-100 mb-5 overflow-x-auto no-scrollbar">
                    <button
                        type="button"
                        onClick={() => handleSelectGoal('MANAGE_COMPANY')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeGoalTab === 'MANAGE_COMPANY'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                        }`}
                    >
                        <BuildingStorefrontIcon size={14} />
                        <span>{t('goal.tab.org')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSelectGoal('OFFER_SERVICE')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeGoalTab === 'OFFER_SERVICE'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                        }`}
                    >
                        <BriefcaseIcon size={14} />
                        <span>{t('goal.tab.service')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSelectGoal('BUY_PRODUCTS')}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeGoalTab === 'BUY_PRODUCTS'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                        }`}
                        title="Buy Products & Produce"
                    >
                        <ShoppingBagIcon size={14} />
                        <span>{t('goal.tab.buyer')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSelectGoal('BECOME_AGENT')}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeGoalTab === 'BECOME_AGENT'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                        }`}
                        title="Agro-Agent / Contractor"
                    >
                        <UserGroupIcon size={14} />
                        <span>{t('goal.tab.agent')}</span>
                    </button>
                </div>

                {/* TAB CONTENT: 1. CREATE / JOIN ORGANIZATION */}
                {activeGoalTab === 'MANAGE_COMPANY' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Two Quick Action Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Create Org Card */}
                            <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/80 flex flex-col justify-between hover:bg-indigo-50/70 transition-all">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                                            <PlusIcon size={12} />
                                        </div>
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                            {t('goal.create_org.title')}
                                        </h4>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                                        {t('goal.create_org.desc')}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOrgModalOpen(true)}
                                    className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <span>{t('goal.create_org.btn')}</span>
                                    <ArrowRight size={12} />
                                </button>
                            </div>

                            {/* Join Org Card */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between hover:bg-slate-100/60 transition-all">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-slate-700 text-white rounded-lg">
                                            <SearchIcon size={12} />
                                        </div>
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                            {t('goal.join_org.title')}
                                        </h4>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                                        {t('goal.join_org.desc')}
                                    </p>
                                </div>
                                <div className="mt-3 relative">
                                    <input 
                                        type="text"
                                        placeholder={t('goal.join_org.search')}
                                        value={orgSearchQuery}
                                        onChange={e => setOrgSearchQuery(e.target.value)}
                                        className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* Search Results or Joined Orgs List */}
                        {orgSearchQuery.trim().length > 0 ? (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    {t('goal.matching_orgs')} ({filteredDiscoverableOrgs.length})
                                </p>
                                {filteredDiscoverableOrgs.map(org => (
                                    <div key={org.id} className="p-2.5 bg-white border border-slate-100 rounded-xl flex items-center justify-between shadow-xs">
                                        <div>
                                            <p className="text-xs font-black text-slate-800">{org.name}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">{org.type} • {org.agricultureType}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSendJoinRequest(org)}
                                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                        >
                                            {t('goal.join_request')}
                                        </button>
                                    </div>
                                ))}
                                {filteredDiscoverableOrgs.length === 0 && (
                                    <p className="text-center py-3 text-[10px] font-bold text-slate-400">{t('goal.no_orgs_found')}</p>
                                )}
                            </div>
                        ) : (
                            /* User's existing organizations status */
                            userMemberships.length > 0 && (
                                <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        {t('goal.active_orgs')}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {userMemberships.map(m => {
                                            const org = (organizations || []).find(o => o.id === m.organizationId);
                                            return (
                                                <div key={m.id} className="px-3 py-1.5 bg-white border border-indigo-100 rounded-xl flex items-center gap-2 shadow-xs">
                                                    <span className="text-xs font-black text-slate-800">{org?.name || 'Organization'}</span>
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black uppercase">
                                                        {m.role === 'Founder' ? '👑 Founder' : m.role}
                                                    </span>
                                                    {onSwitchOrg && m.organizationId && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => onSwitchOrg(m.organizationId)}
                                                            className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer"
                                                        >
                                                            {t('goal.switch')}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* TAB CONTENT: 2. OFFER SERVICE / FIND JOB */}
                {activeGoalTab === 'OFFER_SERVICE' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100/80">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                        {t('goal.specializations.title')}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                        {t('goal.specializations.desc')}
                                    </p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase ${
                                    currentUser?.availability === 'Unavailable' 
                                        ? 'bg-amber-100 text-amber-700' 
                                        : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    {currentUser?.availability === 'Unavailable' ? t('goal.unavailable') : t('goal.available')}
                                </span>
                            </div>

                            {/* Service Quick Toggle Chips */}
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {defaultServices.map(service => {
                                    const isSelected = userServices.includes(service);
                                    return (
                                        <button
                                            key={service}
                                            type="button"
                                            onClick={() => toggleQuickService(service)}
                                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-emerald-600 text-white shadow-xs font-black' 
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'
                                            }`}
                                        >
                                            {isSelected && <CheckIcon size={12} />}
                                            <span>{service}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Action to open full CV & Services modal */}
                            <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 font-medium">
                                    {t('goal.experience_logged', { count: String(currentUser?.cv?.experience?.length || 0) })}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsOfferServiceModalOpen(true)}
                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>{t('goal.edit_cv_btn')}</span>
                                    <ArrowRight size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: 3. BUY PRODUCTS */}
                {activeGoalTab === 'BUY_PRODUCTS' && (
                    <div className="p-5 bg-purple-50/40 rounded-2xl border border-purple-100/80 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2">
                            <ShoppingBagIcon size={18} className="text-purple-600" />
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                {t('goal.buyer.title')}
                            </h4>
                        </div>
                        <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                            {t('goal.buyer.desc')}
                        </p>
                        <button
                            type="button"
                            onClick={() => onNavigateMode?.('marketplace')}
                            className="px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:bg-purple-700 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>{t('goal.buyer.btn')}</span>
                            <ArrowRight size={12} />
                        </button>
                    </div>
                )}

                {/* TAB CONTENT: 4. BECOME AN AGRO-AGENT */}
                {activeGoalTab === 'BECOME_AGENT' && (
                    <div className="p-5 bg-blue-50/40 rounded-2xl border border-blue-100/80 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2">
                            <UserGroupIcon size={18} className="text-blue-600" />
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                {t('goal.agent.title')}
                            </h4>
                        </div>
                        <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                            {t('goal.agent.desc')}
                        </p>
                        <button
                            type="button"
                            onClick={() => onNavigateMode?.('tools')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:bg-blue-700 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>{t('goal.agent.btn')}</span>
                            <ArrowRight size={12} />
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => {
                        if (onOpenProfile) onOpenProfile();
                        else if (onNavigateMode) onNavigateMode('profile');
                    }}
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                >
                    <UserLucideIcon size={12} />
                    <span>{t('goal.open_profile')}</span>
                </button>

                {activeGoalTab === 'MANAGE_COMPANY' && (
                    <button
                        type="button"
                        onClick={() => onNavigateMode?.('founders')}
                        className="text-[10px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                    >
                        <span>{t('goal.founders_hub')}</span>
                        <ArrowRight size={12} />
                    </button>
                )}
            </div>

            {/* Modals */}
            {currentUser && (
                <>
                    <CreateOrganizationModal
                        isOpen={isCreateOrgModalOpen}
                        onClose={() => setIsCreateOrgModalOpen(false)}
                        user={currentUser}
                        onAddOrg={onAddOrg}
                        onSwitchOrg={onSwitchOrg}
                        onUpdateUser={onUpdateUser}
                    />

                    <OfferServiceModal
                        isOpen={isOfferServiceModalOpen}
                        onClose={() => setIsOfferServiceModalOpen(false)}
                        user={currentUser}
                        onUpdateUser={onUpdateUser || (() => {})}
                        organizations={discoverableOrganizations}
                    />
                </>
            )}
        </div>
    );
};
