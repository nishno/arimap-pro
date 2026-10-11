
import React, { useRef } from 'react';
import { 
  HomeIcon, BellIcon, BriefcaseIcon, AcademicCapIcon,
  BuildingStorefrontIcon, PencilIcon, BeakerIcon, ArchiveBoxIcon, 
  RectangleStackIcon, BanknotesIcon, Cog6ToothIcon, ChatBubbleLeftRightIcon,
  DocumentTextIcon, ShieldCheckIcon
} from './Icons';
import { BookOpen } from 'lucide-react';
import type { AppMode } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface MobileNavProps {
  appMode: AppMode;
  onSetAppMode: (mode: AppMode) => void;
  checkPermission: (mode: AppMode) => boolean;
}

const MobileNav: React.FC<MobileNavProps> = ({ appMode, onSetAppMode, checkPermission }) => {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const allItems: { mode: AppMode, icon: React.ReactNode, label: string }[] = [
    { mode: 'dashboard', icon: <HomeIcon className="h-5 w-5" />, label: t('nav.dashboard') },
    { mode: 'tasks', icon: <BellIcon className="h-5 w-5" />, label: t('nav.tasks') },
    { mode: 'design', icon: <PencilIcon className="h-5 w-5" />, label: t('nav.map_planner') },
    { mode: 'agronomy', icon: <BeakerIcon className="h-5 w-5" />, label: t('nav.agronomy') },
    { mode: 'harvesting', icon: <ArchiveBoxIcon className="h-5 w-5" />, label: t('nav.harvest') },
    { mode: 'stock', icon: <RectangleStackIcon className="h-5 w-5" />, label: t('nav.stock') },
    { mode: 'accounting', icon: <BanknotesIcon className="h-5 w-5" />, label: t('nav.accounts') },
    { mode: 'system', icon: <BriefcaseIcon className="h-5 w-5" />, label: t('nav.field_manager') },
    { mode: 'marketplace', icon: <BuildingStorefrontIcon className="h-5 w-5" />, label: t('nav.market') },
    { mode: 'ai', icon: <AcademicCapIcon className="h-5 w-5" />, label: t('nav.ai_analyst') },
    { mode: 'community', icon: <ChatBubbleLeftRightIcon className="h-5 w-5" />, label: t('nav.communicator') },
    { mode: 'tools', icon: <Cog6ToothIcon className="h-5 w-5" />, label: 'Tools' },
    { mode: 'guide', icon: <BookOpen className="h-5 w-5" />, label: t('nav.guide') || 'Help' },
    { mode: 'labs', icon: <BeakerIcon className="h-5 w-5" />, label: 'Labs' },
    { mode: 'logs', icon: <DocumentTextIcon className="h-5 w-5" />, label: 'Logs' },
    { mode: 'founders', icon: <ShieldCheckIcon className="h-5 w-5" />, label: 'Founders' },
    { mode: 'admin', icon: <ShieldCheckIcon className="h-5 w-5 text-red-500" />, label: 'Admin' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 z-[3000] pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
      {/* Scrollable Container */}
      <div 
        ref={scrollRef}
        className="flex items-center space-x-1 overflow-x-auto custom-scrollbar-hide px-4 py-3 scroll-smooth"
      >
        {allItems.map((item) => {
          const hasAccess = checkPermission(item.mode);
          const active = appMode === item.mode;
          const isHelp = item.mode === 'guide';
          
          if (!hasAccess && (item.mode === 'admin' || item.mode === 'logs' || item.mode === 'founders')) return null;

          return (
            <button
              key={item.mode}
              onClick={() => hasAccess && onSetAppMode(item.mode)}
              className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[70px] sm:min-w-[78px] md:min-w-[88px] h-14 rounded-2xl transition-all duration-200 relative ${
                active 
                  ? 'bg-indigo-600 shadow-lg shadow-indigo-200 text-white' 
                  : isHelp
                  ? 'text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-100 active:scale-95'
                  : hasAccess 
                  ? 'text-slate-500 hover:bg-slate-50 active:scale-90' 
                  : 'text-slate-200 grayscale cursor-not-allowed'
              }`}
              title={item.label}
            >
              <div className={`${active ? 'scale-110' : 'scale-100'} transition-transform duration-200`}>
                {item.icon}
              </div>
              <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-tighter mt-1 truncate max-w-[64px] md:max-w-[76px] transition-colors ${active ? 'text-white' : isHelp ? 'text-indigo-700 font-bold' : 'text-slate-500'}`}>
                {item.label}
              </span>
              
              {active && (
                <div className="absolute -bottom-1 w-1.5 h-1.5 bg-white rounded-full shadow-sm" />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Subtle Scroll Indicator for Tablet */}
      <div className="hidden sm:flex absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 to-transparent pointer-events-none items-center justify-end px-1">
        <div className="w-1 h-8 bg-slate-200/50 rounded-full" />
      </div>

      <style>{`
        .custom-scrollbar-hide::-webkit-scrollbar { display: none; }
        .custom-scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </nav>
  );
};

export default MobileNav;
