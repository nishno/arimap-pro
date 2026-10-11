
import React, { useState } from 'react';
import type { AreaPlantationFeature } from '../types';
import { XIcon, WaterDropIcon, PlusIcon, MinusIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface IrrigationGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: AreaPlantationFeature;
  onGenerate: (params: { distance: number; angle: number; dripperSpacing: number; litersPerDripper: number; }) => void;
}

const IrrigationGenerationModal: React.FC<IrrigationGenerationModalProps> = ({ isOpen, onClose, feature, onGenerate }) => {
  const { language } = useLanguage();
  const isKa = language === 'ka';

  const [distance, setDistance] = useState<number | ''>(3.0);
  const [angle, setAngle] = useState<number | ''>(0);
  const [dripperSpacing, setDripperSpacing] = useState<number | ''>(0.5);
  const [litersPerDripper, setLitersPerDripper] = useState<number | ''>(2.0);

  if (!isOpen) return null;

  const handleGenerate = () => {
    onGenerate({ 
      distance: distance === '' ? 3.0 : distance, 
      angle: angle === '' ? 0 : angle, 
      dripperSpacing: dripperSpacing === '' ? 0.5 : dripperSpacing, 
      litersPerDripper: litersPerDripper === '' ? 2.0 : litersPerDripper 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {isKa ? 'მორწყვის კონფიგურაცია:' : 'Irrigation Setup:'} {feature.name}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title={isKa ? 'დახურვა' : 'Close'}>
            <XIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {isKa ? 'ხაზებს შორის მანძილი' : 'Line Spacing'}
                    </label>
                    <div className="relative">
                        <input 
                            type="number" 
                            step="0.1"
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={distance}
                            onChange={e => {
                                const val = e.target.value;
                                setDistance(val === '' ? '' : parseFloat(val) || 0);
                            }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">m</span>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {isKa ? 'მიმართულება (კუთხე)' : 'Line Direction (Angle)'}
                    </label>
                    <div className="relative">
                        <input 
                            type="number" 
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={angle}
                            onChange={e => {
                                const val = e.target.value;
                                setAngle(val === '' ? '' : parseInt(val) || 0);
                            }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">°</span>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {isKa ? 'წვეთოვანებს შორის მანძილი' : 'Dripper Spacing'}
                    </label>
                    <div className="relative">
                        <input 
                            type="number" 
                            step="0.1"
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={dripperSpacing}
                            onChange={e => {
                                const val = e.target.value;
                                setDripperSpacing(val === '' ? '' : parseFloat(val) || 0);
                            }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">m</span>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {isKa ? 'წყლის ხარჯი (დებეტი)' : 'Flow Rate'}
                    </label>
                    <div className="relative">
                        <input 
                            type="number" 
                            step="0.1"
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={litersPerDripper}
                            onChange={e => {
                                const val = e.target.value;
                                setLitersPerDripper(val === '' ? '' : parseFloat(val) || 0);
                            }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">L/h</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-6 border-t bg-gray-50/50 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
          >
            {isKa ? 'გაუქმება' : 'Cancel'}
          </button>
          <button 
            onClick={handleGenerate} 
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <WaterDropIcon className="h-4 w-4" /> {isKa ? 'გენერირება' : 'Generate'}
          </button>
        </div>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }`}</style>
    </div>
  );
};

export default IrrigationGenerationModal;
