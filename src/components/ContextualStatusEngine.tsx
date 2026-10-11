
import React, { useMemo } from 'react';
import { 
  ShieldCheckIcon, 
  BuildingStorefrontIcon, 
  MapIcon, 
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon
} from './Icons';
import type { User, Organization, Membership } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextualStatusEngineProps {
  user: User | null;
  activeOrg: Organization | null;
  memberships: Membership[];
  onAction: (targetMode: 'profile' | 'design' | 'founders' | 'marketplace') => void;
}

const ContextualStatusEngine: React.FC<ContextualStatusEngineProps> = ({ 
  user, 
  activeOrg, 
  memberships,
  onAction 
}) => {
  const steps = useMemo(() => {
    if (!user) return [];

    const isProfileComplete = user.roles && user.roles.length > 0 && user.name;
    const hasOrg = memberships.length > 0 || ((user.roles || []).includes('ROOT_SUPER_ADMIN'));
    const hasMapData = activeOrg?.areaGeometry && activeOrg.areaGeometry.length > 0;

    return [
      {
        id: 'identity',
        label: 'Identity Profile',
        status: isProfileComplete ? 'complete' : 'missing',
        icon: ShieldCheckIcon,
        missingmsg: 'Profile incomplete: No roles defined',
        actionLabel: 'Complete Profile',
        targetMode: 'profile' as const
      },
      {
        id: 'org',
        label: 'Organization Hub',
        status: hasOrg ? 'complete' : 'missing',
        icon: BuildingStorefrontIcon,
        missingmsg: 'Not connected to any organization',
        actionLabel: 'Join/Create Org',
        targetMode: 'marketplace' as const
      },
      {
        id: 'operations',
        label: 'Operational Map',
        status: hasMapData ? 'complete' : (hasOrg ? 'missing' : 'blocked'),
        icon: MapIcon,
        missingmsg: 'No operational boundary defined',
        actionLabel: 'Draw Boundary',
        targetMode: 'design' as const
      }
    ];
  }, [user, activeOrg, memberships]);

  const activeAlert = useMemo(() => steps.find(s => s.status === 'missing'), [steps]);

  if (!user || user.id === 'guest') return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1 mb-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">System Status</p>
        <div className="flex gap-1">
          {steps.map(s => (
            <div 
              key={s.id} 
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                s.status === 'complete' ? 'bg-emerald-400' : 
                s.status === 'missing' ? 'bg-amber-400 animate-pulse' : 'bg-slate-200'
              }`} 
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeAlert ? (
          <motion.div 
            key={activeAlert.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden relative group cursor-pointer hover:border-amber-300 transition-all"
            onClick={() => onAction(activeAlert.targetMode)}
          >
            <div className="absolute top-0 right-0 p-2 opacity-5">
               <activeAlert.icon className="w-12 h-12 text-amber-500" />
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertTriangleIcon className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{activeAlert.label}</p>
                <p className="text-xs font-bold text-slate-700 leading-tight mt-0.5">{activeAlert.missingmsg}</p>
                <button className="flex items-center gap-1 mt-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest group-hover:gap-2 transition-all">
                  {activeAlert.actionLabel}
                  <ChevronRightIcon size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center gap-3"
          >
            <div className="p-2 bg-emerald-100 rounded-xl">
              <CheckIcon size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">All Tunnels Clear</p>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-tighter">Operational Readiness: 100%</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContextualStatusEngine;
