import React, { useState, useRef, useEffect } from 'react';
import type { User, LocalServerConfig } from '../types';
import { BellIcon, UserCircleIcon, FolderIcon, SaveIcon, NetworkIcon, CloudIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { Ticket, ChevronDown, BookOpen, Search, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { APP_VERSION_NAME } from '../utils/version';

interface HeaderProps {
  currentUser: User | null;
  onRegister: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onOpenProjects: () => void;
  onSaveProject: () => void;
  activeOrgName?: string;
  currentUserRole?: string;
  onOpenTicketManager: () => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  notificationsCount: number;
  isManualOffline?: boolean;
  onToggleOffline?: () => void;
  isCloudQuotaExceeded?: boolean;
  onOpenLocalServerConfig?: () => void;
  localServerConfig?: LocalServerConfig;
  onPushToCloud?: () => Promise<void>;
  pendingSyncCount?: number;
  onOpenDataAuditor: () => void;
  onOpenHomepage?: () => void;
  onOpenHelp?: () => void;
  onOpenChat?: () => void;
  onOpenMeet?: () => void;
  onOpenAssistant?: () => void;
  onOpenNotes?: () => void;
  notesCount?: number;
  onOpenThemeStudio?: () => void;
  onOpenGlobalSearch?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  currentUser, onRegister, onLogin, onLogout, onOpenProjects, onSaveProject, 
  activeOrgName, onOpenTicketManager, onOpenProfile, currentUserRole,
  onOpenNotifications, notificationsCount, isManualOffline, onToggleOffline,
  isCloudQuotaExceeded, onOpenLocalServerConfig, localServerConfig,
  onPushToCloud, pendingSyncCount = 0, onOpenDataAuditor, onOpenHomepage,
  onOpenHelp, onOpenChat, onOpenMeet, onOpenAssistant, onOpenNotes, notesCount = 0,
  onOpenThemeStudio, onOpenGlobalSearch
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, region, setRegion, currency, setCurrency, t } = useLanguage();
  const { isDark, currentTheme } = useAppTheme();
  const [storageUsage, setStorageUsage] = useState(0);

  const canManageLocalServer = currentUser?.roles?.some(r => r === 'Founder' || r === 'Admin' || r === 'ROOT_SUPER_ADMIN');

  const handleSyncClick = async () => {
      if (!onPushToCloud) return;
      setIsSyncing(true);
      await onPushToCloud();
      setIsSyncing(false);
  };

  useEffect(() => {
    const updateUsage = () => {
      let total = 0;
      for (let x in localStorage) {
        if (!localStorage.hasOwnProperty(x)) continue;
        total += ((localStorage[x].length + x.length) * 2);
      }
      const percentage = (total / (5 * 1024 * 1024)) * 100;
      setStorageUsage(Math.min(100, percentage));
    };
    updateUsage();
    window.addEventListener('storage', updateUsage);
    return () => window.removeEventListener('storage', updateUsage);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ka' : 'en';
    setLanguage(newLang);

  };

  return (
    <div 
      className={`flex-shrink-0 h-14 md:h-16 flex items-center justify-between px-3 md:px-6 z-[1000] shadow-sm relative transition-colors border-b ${
        isDark 
          ? 'bg-[#0d1527] border-slate-800/90 text-slate-100' 
          : 'bg-white border-gray-200 text-slate-800'
      }`}
      style={{
        backgroundColor: currentTheme.bgHeader || undefined,
        borderColor: currentTheme.borderColor || undefined,
        color: currentTheme.menubarLetterColor || currentTheme.universalLetterColor || undefined
      }}
    >
        {/* Left Side: Brand Logo and Active Workspace button */}
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 mr-1 sm:mr-2">
            <button 
                type="button" 
                onClick={onOpenHomepage} 
                className="flex flex-col lg:hidden leading-none justify-center text-left hover:opacity-80 transition-opacity cursor-pointer group"
                title="Go to Homepage / Startup Showcase"
            >
                <span className="font-black text-emerald-500 group-hover:text-emerald-400 text-base sm:text-lg uppercase tracking-tighter transition-colors">AgriMap</span>
                <span className="text-[8px] font-bold text-slate-400 font-mono tracking-wide mt-0.5">{APP_VERSION_NAME}</span>
            </button>
            
            {activeOrgName && (
              <button 
                onClick={onOpenTicketManager}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl transition-all group max-w-[130px] sm:max-w-[200px] border standing-light standing-beam ${
                  isDark 
                    ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200' 
                    : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-100 text-indigo-900'
                }`}
              >
                <div className={`p-0.5 sm:p-1 rounded-md text-white group-hover:scale-110 transition-transform flex-shrink-0 ${isDark ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                  <Ticket size={12} className="sm:h-3.5 sm:w-3.5" />
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className={`text-[7px] sm:text-[8px] font-black uppercase leading-none truncate w-full text-left ${isDark ? 'text-emerald-400' : 'text-indigo-400'}`}>{currentUserRole || 'Member'} at</span>
                  <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 w-full">
                    <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-tight truncate ${isDark ? 'text-white' : 'text-indigo-900'}`}>{activeOrgName}</span>
                    <ChevronDown size={10} className={isDark ? 'text-slate-400' : 'text-indigo-400'} />
                  </div>
                </div>
              </button>
            )}

            <div className={`hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl border standing-light ${isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'}`} title="Amount of data stored locally in your browser for offline use (max 5MB)">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Local Cache</span>
                    <div className={`w-20 h-1 rounded-full mt-1 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div 
                          className={`h-full transition-all duration-1000 ${storageUsage > 90 ? 'bg-red-500' : storageUsage > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${storageUsage}%` }}
                        />
                    </div>
                </div>
                <span className="text-[9px] font-black font-mono">{storageUsage.toFixed(1)}%</span>
            </div>

            {/* Global Spotlight Search Bar (Menu Bar) */}
            {onOpenGlobalSearch && (
                <button
                    onClick={onOpenGlobalSearch}
                    className={`flex items-center justify-between gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold shadow-xs flex-shrink-0 group cursor-pointer ${
                        isDark 
                            ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:border-emerald-500/50 hover:text-white' 
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-slate-900'
                    } w-28 sm:w-44 md:w-56 lg:w-64`}
                    title="Search everything by single letter (⌘K or /)"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                        <span className="truncate text-[11px] font-medium text-slate-400 group-hover:text-slate-200">
                            {language === 'ka' ? 'ძიება...' : 'Search all...'}
                        </span>
                    </div>
                    <kbd className={`hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border ${
                        isDark 
                            ? 'bg-slate-800 border-slate-700 text-slate-400' 
                            : 'bg-white border-slate-200 text-slate-500'
                    }`}>
                        ⌘K
                    </kbd>
                </button>
            )}
        </div>

        {/* Middle Area: Scrollable statuses and toggles */}
        <div className="flex-1 flex items-center justify-start md:justify-end gap-1.5 sm:gap-2.5 overflow-x-auto custom-scrollbar-hide flex-nowrap min-w-0 snap-x py-1 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
            {pendingSyncCount > 0 && (
                <button
                    onClick={handleSyncClick}
                    disabled={isSyncing}
                    className="flex flex-col items-center justify-center -space-y-1 flex-shrink-0 snap-end standing-light standing-beam"
                >
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-md transition-all animate-pulse">
                        <CloudIcon className="h-3.5 w-3.5 animate-bounce" />
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest leading-none">{isSyncing ? 'Pushing...' : `Push ${pendingSyncCount}`}</span>
                    </div>
                </button>
            )}

            {canManageLocalServer && (
                <button
                    onClick={onOpenLocalServerConfig}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 snap-end standing-light standing-beam ${
                        localServerConfig?.isLocalMode 
                        ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg underglow-box-active' 
                        : isDark
                        ? 'bg-slate-900/90 border-slate-700 text-indigo-400 hover:bg-slate-800'
                        : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100'
                    }`}
                    title={localServerConfig?.isLocalMode ? `Connected to Local Server: ${localServerConfig.serverIp}` : "Switch to Local Private Server Mode"}
                >
                    <NetworkIcon className={`h-3.5 w-3.5 ${localServerConfig?.isLocalMode ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                        {localServerConfig?.isLocalMode ? 'Local Active' : 'Local Node'}
                    </span>
                </button>
            )}

            {onToggleOffline && (
                <button
                    onClick={onToggleOffline}
                    className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 snap-end standing-light standing-beam ${
                        isManualOffline 
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-inner underglow-box-active' 
                        : isDark
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title={isManualOffline ? "You are currently OFFLINE (Local Mode)" : "You are currently ONLINE (Cloud Sync Active)"}
                >
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse flex-shrink-0 ${isManualOffline ? 'bg-amber-500' : isCloudQuotaExceeded ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                        {isManualOffline ? 'Local Mode' : isCloudQuotaExceeded ? 'Cloud Exceeded' : 'Cloud Sync'}
                    </span>
                </button>
            )}

            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 snap-end standing-light ${
                isCloudQuotaExceeded 
                ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                : isDark
                ? 'bg-slate-900/90 border-slate-700 text-slate-300'
                : 'bg-blue-50 border-blue-100 text-blue-700'
            }`} title={isCloudQuotaExceeded ? "Firebase Database Quota Exceeded for today." : "Cloud Status: All Green"}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCloudQuotaExceeded ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                    {isCloudQuotaExceeded ? 'Limit Hit' : 'Normal'}
                </span>
            </div>

            {/* Language Toggle */}
            <button
                onClick={toggleLanguage}
                className={`px-2 sm:px-2.5 py-1.5 rounded-xl border text-[10px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 snap-end standing-light standing-beam ${
                  isDark 
                    ? 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800' 
                    : 'bg-gray-50 border-gray-250 text-gray-700 hover:bg-gray-100'
                }`}
            >
                <span>{language === 'en' ? '🇺🇸' : '🇬🇪'}</span>
                <span className="hidden sm:inline font-bold">{language === 'en' ? 'EN' : 'GE'}</span>
            </button>

            <select aria-label="Pricing region" value={region} onChange={e=>setRegion(e.target.value as 'Georgia'|'Global')} className="bg-transparent max-w-[95px] text-xs"><option value="Global">🌐 Global</option><option value="Georgia">🇬🇪 Georgia</option></select>
              <button
                onClick={() => setCurrency(currency === 'USD' ? 'GEL' : 'USD')}
                className={`px-2 sm:px-2.5 py-1.5 rounded-xl border text-[10px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 snap-end standing-light standing-beam ${
                  isDark 
                    ? 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800' 
                    : 'bg-gray-50 border-gray-250 text-gray-700 hover:bg-gray-100'
                }`}
                title="Toggle Currency"
            >
                <span>{currency === 'USD' ? '💲' : '₾'}</span>
                <span className="hidden sm:inline font-bold">{currency}</span>
            </button>

            <button 
              onClick={onSaveProject} 
              className="hidden md:flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex-shrink-0 snap-end standing-light standing-beam"
            >
              <SaveIcon className="h-4 w-4 flex-shrink-0"/>
              {t('common.save')}
            </button>
        </div>

        {/* Right Side: Fixed core elements (Notifications, Help, & Profile) */}
        <div className={`flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0 ml-1 sm:ml-2 border-l pl-1.5 sm:pl-3 ${isDark ? 'border-slate-800' : 'border-slate-150'}`}>
            {onOpenHelp && (
                <button
                    onClick={onOpenHelp}
                    className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl transition-all font-bold text-xs shadow-sm standing-light standing-beam ${
                      isDark 
                        ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' 
                        : 'bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700'
                    }`}
                    title="Help & Architecture Guide (SOPs, Manual Architecture & AI Analysis)"
                >
                    <BookOpen className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="hidden sm:inline text-[10px] md:text-xs font-black uppercase tracking-wider">
                        {language === 'ka' ? 'დახმარება' : 'Help'}
                    </span>
                </button>
            )}

            <button 
                onClick={onOpenNotifications}
                className={`p-1.5 sm:p-2 rounded-full transition-colors relative group flex-shrink-0 standing-light ${
                  isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
            >
                <div className="relative">
                    <BellIcon className={`h-5 w-5 sm:h-5 sm:w-5 group-hover:scale-110 transition-transform ${notificationsCount > 0 ? 'text-emerald-400 animate-pulse' : ''}`} />
                    {notificationsCount > 0 && (
                        <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 block w-2 sm:w-2.5 h-2 sm:h-2.5 bg-red-600 rounded-full border-2 border-slate-900 shadow-sm" 
                        />
                    )}
                </div>
                {notificationsCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] sm:min-w-[18px] h-3.5 sm:h-4.5 bg-red-600 text-white text-[8px] sm:text-[9px] font-black rounded-full border border-slate-900 flex items-center justify-center px-0.5 sm:px-1 shadow-lg">
                        {notificationsCount > 99 ? '99+' : notificationsCount}
                    </span>
                )}
            </button>
            
            <div className="relative flex-shrink-0" ref={dropdownRef}>
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                  className={`flex items-center space-x-1 sm:space-x-2 p-1 rounded-xl transition-all cursor-pointer ${
                    isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-gray-50 text-gray-800'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                    <UserCircleIcon className={`h-6 w-6 sm:h-8 sm:w-8 md:h-8 md:w-8 ${isDark ? 'text-slate-400' : 'text-gray-300'}`} />
                    {currentUser && (
                        <span className="hidden lg:inline text-xs sm:text-sm font-black uppercase tracking-tight truncate max-w-[120px]">
                            {currentUser.name}
                        </span>
                    )}
                </button>
                {isDropdownOpen && (
                    <div className={`absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl py-2 z-50 border overflow-hidden animate-slide-up ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-gray-100 text-gray-700'
                    }`}>
                    {currentUser && !currentUser.isGuest ? (
                        <>
                        <div className={`px-4 py-2 border-b ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Workspace</p>
                            <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentUser.name}</p>
                        </div>
                        <button onClick={() => { onOpenProfile(); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 font-bold transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-indigo-50'}`}>
                            <UserCircleIcon className="h-4 w-4 text-indigo-400" /> My Profile
                        </button>
                        <button onClick={() => { onOpenProjects(); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 font-bold transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-green-50'}`}>
                            <FolderIcon className="h-4 w-4 text-emerald-400" /> My Projects
                        </button>
                        {onOpenHomepage && (
                            <button onClick={() => { onOpenHomepage(); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm text-emerald-400 flex items-center gap-3 font-bold transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-emerald-50'}`}>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                {language === 'ka' ? 'მთავარი / წარდგენა' : 'Go to Homepage'}
                            </button>
                        )}
                        {onOpenHelp && (
                            <button onClick={() => { onOpenHelp(); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 font-bold transition-colors ${isDark ? 'hover:bg-slate-800 text-indigo-300' : 'hover:bg-indigo-50 text-indigo-700'}`}>
                                <BookOpen className="h-4 w-4 text-indigo-400" />
                                {language === 'ka' ? 'დახმარება და გზამკვლევი' : 'Help & Architecture Guide'}
                            </button>
                        )}
                        <div className={`my-1 border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />
                        <button onClick={() => { onLogout(); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm text-red-400 font-bold transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-red-50'}`}>
                            {t('auth.logout')}
                        </button>
                        </>
                    ) : (
                        <>
                        <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-gray-100'}`}>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guest Mode</p>
                            <p className="text-xs font-bold text-slate-500">Limited Access</p>
                        </div>
                        <button onClick={() => { onLogin(); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 font-bold transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-indigo-50'}`}>
                            <UserCircleIcon className="h-4 w-4 text-indigo-400" /> Login
                        </button>
                        <button onClick={() => { onRegister(); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 font-bold transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-green-50'}`}>
                            <FolderIcon className="h-4 w-4 text-emerald-400" /> Register
                        </button>
                        {onOpenHomepage && (
                            <button onClick={() => { onOpenHomepage(); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm text-emerald-400 flex items-center gap-3 font-bold transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-emerald-50'}`}>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                {language === 'ka' ? 'მთავარი / წარდგენა' : 'Go to Homepage'}
                            </button>
                        )}
                        {onOpenHelp && (
                            <button onClick={() => { onOpenHelp(); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 font-bold transition-colors ${isDark ? 'hover:bg-slate-800 text-indigo-300' : 'hover:bg-indigo-50 text-indigo-700'}`}>
                                <BookOpen className="h-4 w-4 text-indigo-400" />
                                {language === 'ka' ? 'დახმარება და გზამკვლევი' : 'Help & Architecture Guide'}
                            </button>
                        )}
                        </>
                    )}
                    <div className={`border-t my-1 ${isDark ? 'border-slate-800' : 'border-gray-100'}`}></div>
                    <button 
                        type="button" 
                        onClick={() => { if (onOpenHomepage) onOpenHomepage(); setIsDropdownOpen(false); }}
                        className={`w-full px-4 py-1.5 text-[9px] font-mono font-bold uppercase text-center transition-colors cursor-pointer block ${
                          isDark 
                            ? 'text-slate-400 hover:text-emerald-400 bg-slate-950/60 hover:bg-slate-800' 
                            : 'text-slate-400 hover:text-emerald-600 bg-slate-50/50 hover:bg-emerald-50/30'
                        }`}
                        title="Click to Open Homepage Showcase"
                    >
                        {APP_VERSION_NAME}
                    </button>
                    </div>
                )}
            </div>
        </div>
        <style>{`
          .custom-scrollbar-hide::-webkit-scrollbar { display: none; }
          .custom-scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
    </div>
  );
};

export default Header;
