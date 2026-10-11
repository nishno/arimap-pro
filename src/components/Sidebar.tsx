
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Mail, Copy, Check, MessageSquare, X, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { 
  HomeIcon, AcademicCapIcon, PencilIcon, ServerStackIcon,
  Cog6ToothIcon, UserGroupIcon, BriefcaseIcon, ArchiveBoxIcon, RectangleStackIcon,
  BanknotesIcon, BeakerIcon, BuildingStorefrontIcon, BellIcon, SwatchIcon, LockClosedIcon, ShieldCheckIcon, DocumentTextIcon,
  ChatBubbleLeftRightIcon
} from './Icons';
import type { AppMode, User, Organization, Membership } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAppTheme } from '../contexts/ThemeContext';
import ContextualStatusEngine from './ContextualStatusEngine';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '../utils/version';

interface SidebarProps {
  appMode: AppMode;
  onSetAppMode: (mode: AppMode) => void;
  checkPermission: (mode: AppMode) => boolean;
  currentUser: User | null;
  activeOrg: Organization | null;
  memberships: Membership[];
  isConnectionHealthy?: boolean;
  onOpenHomepage?: () => void;
}

const NavItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  onClick: () => void; 
  locked?: boolean; 
  currentUser: User | null;
  isDark?: boolean;
}> = ({ icon, label, active, onClick, locked, currentUser, isDark }) => (
  <button
    onClick={locked ? undefined : onClick}
    data-active={active ? "true" : "false"}
    className={`flex items-center space-x-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 w-full text-left group relative standing-light standing-beam ${
      active
        ? isDark
          ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40 underglow-box-active active'
          : 'bg-slate-100 text-slate-900 font-bold underglow-box-active active'
        : locked
        ? isDark ? 'text-slate-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
        : isDark
        ? 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 hover:border-slate-700 border border-transparent'
        : 'text-gray-500 hover:bg-gray-100/70 hover:text-slate-900 border border-transparent'
    }`}
  >
    <div className={`transition-colors flex-shrink-0 ${
      locked 
        ? isDark ? 'text-slate-700' : 'text-gray-300' 
        : active 
        ? isDark ? 'text-emerald-400' : 'text-slate-800' 
        : isDark ? 'text-slate-500 group-hover:text-emerald-400' : 'text-gray-400 group-hover:text-indigo-600'
    }`}>{icon}</div>
    <span className="text-xs font-bold tracking-tight flex-grow truncate">{label}</span>
    {active && (
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm flex-shrink-0" />
    )}
    {currentUser?.roles?.includes('ROOT_SUPER_ADMIN') && !active && (
      <PencilIcon size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    )}
    {locked && <LockClosedIcon className="h-3.5 w-3.5 text-slate-600 ml-auto flex-shrink-0" />}
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ 
  appMode, 
  onSetAppMode, 
  checkPermission, 
  currentUser,
  activeOrg,
  memberships,
  isConnectionHealthy = true,
  onOpenHomepage
}) => {
  const { t, language } = useLanguage();
  const { isDark, currentTheme, toggleDarkLight } = useAppTheme();
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<'phone' | 'email' | null>(null);
  const isRoot = currentUser?.roles?.includes('ROOT_SUPER_ADMIN');
  
  const savedLocalConfig = localStorage.getItem('agrimap-local-config');
  let isLocalMode = false;
  try {
      if (savedLocalConfig) isLocalMode = JSON.parse(savedLocalConfig).isLocalMode;
  } catch (e) {}

  const publicPortal: { mode: AppMode, icon: React.ReactNode, label: string }[] = [
    { mode: 'dashboard', icon: <HomeIcon className="h-5 w-5" />, label: t('nav.dashboard') },
    { mode: 'marketplace', icon: <BuildingStorefrontIcon className="h-5 w-5" />, label: t('nav.market') },
    { mode: 'ai', icon: <AcademicCapIcon className="h-5 w-5" />, label: t('nav.ai_analyst') },
    { mode: 'community', icon: <ChatBubbleLeftRightIcon className="h-5 w-5" />, label: t('nav.communicator') },
  ];

  const individualTools: { mode: AppMode, icon: React.ReactNode, label: string }[] = [
    { mode: 'tools', icon: <Cog6ToothIcon className="h-5 w-5" />, label: t('nav.tools') },
    { mode: 'labs', icon: <BeakerIcon className="h-5 w-5" />, label: 'Labs' },
  ];

  const companyEnterprise: { mode: AppMode, icon: React.ReactNode, label: string, rootOnly?: boolean }[] = [
    { mode: 'harvesting', icon: <ArchiveBoxIcon className="h-5 w-5" />, label: t('nav.harvest') },
    { mode: 'tasks', icon: <BellIcon className="h-5 w-5" />, label: t('nav.tasks') },
    { mode: 'stock', icon: <RectangleStackIcon className="h-5 w-5" />, label: t('nav.stock') },
    { mode: 'accounting', icon: <BanknotesIcon className="h-5 w-5" />, label: t('nav.accounts') },
    { mode: 'agronomy', icon: <BeakerIcon className="h-5 w-5" />, label: t('nav.agronomy') },
    { mode: 'design', icon: <PencilIcon className="h-5 w-5" />, label: t('nav.map_planner') },
    { mode: 'system', icon: <BriefcaseIcon className="h-5 w-5" />, label: t('nav.field_manager') },
    { mode: 'founders', icon: <ShieldCheckIcon className="h-5 w-5" />, label: t('nav.founders') },
    { mode: 'logs', icon: <DocumentTextIcon className="h-5 w-5" />, label: t('nav.logs') },
    { mode: 'admin', icon: <ShieldCheckIcon className="h-5 w-5" />, label: t('nav.admin'), rootOnly: true },
  ];

  const renderSection = (title: string, items: typeof companyEnterprise) => (
    <div className="mb-6">
      <p className={`px-4 text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{title}</p>
      <div className="space-y-1">
        {items.map((item) => {
          if (item.rootOnly && !isRoot) return null;
          const hasAccess = checkPermission(item.mode);
          return (
            <NavItem 
              key={item.mode} 
              {...item}
              active={appMode === item.mode}
              locked={!hasAccess}
              onClick={() => onSetAppMode(item.mode)}
              currentUser={currentUser}
              isDark={isDark}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <aside 
      className={`hidden lg:flex w-64 flex-shrink-0 flex-col z-[2000] transition-colors border-r ${
        isDark 
          ? 'bg-[#0b1120] text-slate-100 border-slate-800/80 shadow-xl' 
          : 'bg-white text-slate-800 border-gray-150'
      }`}
      style={{
        backgroundColor: currentTheme.bgSidebar || undefined,
        borderColor: currentTheme.borderColor || undefined
      }}
    >
      <button 
        type="button"
        onClick={onOpenHomepage} 
        className={`h-16 flex flex-col justify-center px-5 border-b text-left transition-colors cursor-pointer group w-full ${
          isDark 
            ? 'border-slate-800/80 hover:bg-slate-900/60' 
            : 'border-gray-100 hover:bg-slate-50/80'
        }`}
        title="Go to Homepage / Startup Showcase"
      >
        <h1 className="text-xl font-black tracking-tighter uppercase leading-none transition-colors flex items-center gap-1.5">
          <span className={isDark ? 'text-white' : 'text-slate-800'}>AgriMap</span>
          <span className="text-emerald-500 italic">V2</span>
        </h1>
        <span className="text-[9px] font-bold font-mono tracking-wider mt-1 transition-colors text-slate-400 group-hover:text-emerald-400">
          {APP_VERSION_NAME}
        </span>
      </button>
      <nav className="flex-1 p-3 overflow-y-auto custom-scrollbar">
        <div className="mb-5 px-1">
          <div 
            className={`p-3.5 rounded-2xl border flex flex-col items-center cursor-pointer transition-all group standing-light standing-beam ${
              appMode === 'guide'
                ? isDark
                  ? 'bg-emerald-500/20 border-emerald-500/50 underglow-box-active active'
                  : 'bg-indigo-50 border-indigo-200 underglow-box-active active'
                : isDark 
                ? 'bg-slate-900/90 border-slate-800 hover:bg-slate-800/80 hover:border-emerald-500/40 shadow-sm' 
                : 'bg-slate-50/80 border-slate-100 hover:bg-indigo-50/50 hover:border-indigo-100'
            }`} 
            onClick={() => onSetAppMode('guide')}
            data-active={appMode === 'guide' ? "true" : "false"}
          >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform ${
                appMode === 'guide'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-indigo-100/50 text-indigo-600'
              }`}>
                  <DocumentTextIcon className="h-4.5 w-4.5" />
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest text-center ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Architecture Guide
              </p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5 text-center">SOPs & AI Models</p>
          </div>
        </div>
      {renderSection(t('nav.public_portal'), publicPortal as any)}
      {renderSection(t('nav.indiv_tools'), individualTools as any)}
      {renderSection(t('nav.enterprise'), companyEnterprise)}
    </nav>
      <div className={`p-3.5 border-t ${isDark ? 'border-slate-800/80' : 'border-gray-100'}`}>
          <div className="flex flex-col gap-2 mb-3 px-1">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isConnectionHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {isLocalMode ? 'Local Node' : 'Cloud Sync'}
                      </span>
                  </div>
                  {!isConnectionHealthy && (
                      <button 
                        onClick={() => window.location.reload()}
                        className="text-[10px] font-bold text-indigo-400 uppercase hover:underline"
                      >
                          Retry
                      </button>
                  )}
              </div>
              {!isConnectionHealthy && isLocalMode && (
                  <button 
                    onClick={() => {
                        localStorage.setItem('agrimap-local-config', JSON.stringify({ isLocalMode: false, serverIp: '127.0.0.1', autoDiscovery: true }));
                        window.location.reload();
                    }}
                    className="flex items-center justify-center py-2 bg-red-50 text-red-600 rounded-xl font-black uppercase tracking-widest text-[8px] border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm shadow-red-100"
                  >
                      Revert to Cloud Infrastructure
                  </button>
              )}
          </div>
          <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-transparent'}`}>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Support Center</p>
              <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setIsContactOpen(true)}
                    className="text-xs font-black text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors uppercase tracking-wider"
                  >
                    <span>Contact Us</span>
                  </button>
                  <span className={`text-[9px] font-black font-mono px-1.5 py-0.5 rounded leading-none ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200/50 text-slate-400'}`}>
                    {APP_VERSION_CODE}
                  </span>
              </div>
          </div>
      </div>

      <AnimatePresence>
        {isContactOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="bg-white rounded-[32px] p-6 md:p-8 max-w-md w-full border border-indigo-100 shadow-2xl relative"
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsContactOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3.5 mb-5">
                <div className="p-3 bg-indigo-50 text-[#5d5aeb] rounded-2xl border border-indigo-100/50">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    {language === 'ka' ? "მხარდაჭერის ცენტრი" : "Support Center"}
                  </h3>
                  <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                    {language === 'ka' ? "კავშირი ტექნიკურ ჯგუფთან" : "Contact Technical Team"}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
                {language === 'ka' 
                  ? "გაქვთ კითხვები ოფლაინ სინქრონიზაციაზე, ტაბლეტების კონფიგურაციაზე ან სასწორის ტექნიკურ გამართვაზე? დაგვიკავშირდით პირდაპირ:" 
                  : "Need assistance with offline sync, tablet configuration, device updates, or scale calibrations? Reach out to our technical coordinators directly:"}
              </p>

              <div className="space-y-4 mb-6">
                {/* Helpline item */}
                <div className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/85 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-105 transition-transform">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">
                        {language === 'ka' ? "ტელეფონის ნომერი" : "Direct Helpline"}
                      </span>
                      <a 
                        href="tel:+995595124747" 
                        className="text-sm font-black text-slate-800 hover:text-indigo-600 transition-colors"
                      >
                        +995 595 124 747
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('+995595124747');
                        setCopiedType('phone');
                        toast.success(language === 'ka' ? 'ნომერი კოპირებულია' : 'Phone number copied!');
                        setTimeout(() => setCopiedType(null), 2000);
                      }}
                      className="p-2 text-slate-400 hover:text-[#5d5aeb] hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-150"
                      title="Copy"
                    >
                      {copiedType === 'phone' ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Email item */}
                <div className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/85 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">
                        {language === 'ka' ? "ელ-ფოსტა" : "Support Email"}
                      </span>
                      <a 
                        href="mailto:giorgi@agrimap.pro" 
                        className="text-sm font-black text-slate-800 hover:text-emerald-650 transition-colors"
                      >
                        giorgi@agrimap.pro
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('giorgi@agrimap.pro');
                        setCopiedType('email');
                        toast.success(language === 'ka' ? 'ელ-ფოსტა კოპირებულია' : 'Email address copied!');
                        setTimeout(() => setCopiedType(null), 2000);
                      }}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-150"
                      title="Copy"
                    >
                      {copiedType === 'email' ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsContactOpen(false)}
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest transition-all"
              >
                {language === 'ka' ? "დახურვა" : "Close"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
      `}</style>
    </aside>
  );
};

export default Sidebar;
