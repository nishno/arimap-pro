import React from 'react';
import { User, ShieldCheck, ChevronRight, Users, PlusCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PostRegistrationChoiceModalProps {
  isOpen: boolean;
  onChoice: (choice: 'hr' | 'add_new' | 'profile') => void;
  orgName: string;
}

const PostRegistrationChoiceModal: React.FC<PostRegistrationChoiceModalProps> = ({ isOpen, onChoice, orgName }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-slide-up">
        <div className="p-10 text-center bg-slate-50/50">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Users className="h-10 w-10 text-indigo-600" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-2">
              {t('postreg.company_registered')}
            </h2>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              {(t('postreg.is_live') || '{orgName} is now live.').replace('{orgName}', orgName)}
            </p>
        </div>

        <div className="p-10 pt-8 grid grid-cols-1 gap-4">
            <button 
                onClick={() => onChoice('hr')}
                className="group p-6 bg-white border-2 border-slate-100 hover:border-indigo-600 rounded-3xl transition-all text-left flex items-center gap-6 shadow-sm hover:shadow-xl"
            >
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 transition-colors">
                    <User className="h-7 w-7 text-indigo-600 group-hover:text-white" />
                </div>
                <div className="flex-grow">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                      {t('postreg.manage_hr')}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic text-indigo-600/60">
                      {t('postreg.already_added')}
                    </p>
                </div>
                <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </button>

            <button 
                onClick={() => onChoice('add_new')}
                className="group p-6 bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-3xl transition-all text-left flex items-center gap-6 shadow-sm hover:shadow-xl"
            >
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-emerald-500 transition-colors">
                    <PlusCircle className="h-7 w-7 text-emerald-500 group-hover:text-white" />
                </div>
                <div className="flex-grow">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight group-hover:text-emerald-500 transition-colors">
                      {t('postreg.add_team')}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {t('postreg.hire_employees')}
                    </p>
                </div>
                <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </button>
        </div>

        <div className="p-8 bg-gray-50 border-t flex justify-between items-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {t('postreg.initialization_code')}
            </p>
            <button onClick={() => onChoice('profile')} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 uppercase tracking-widest underline underline-offset-4">
              {t('postreg.skip_to_profile')}
            </button>
        </div>
      </div>
      <style>{`
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slide-up { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
};

export default PostRegistrationChoiceModal;
