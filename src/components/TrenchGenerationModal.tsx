import React, { useState, useMemo, useEffect } from 'react';
import type { AreaPlantationFeature, Crop } from '../types';
import { XIcon, WrenchScrewdriverIcon, PlusIcon, MinusIcon, PlantIcon } from './Icons';
import { generateTrenches, getSphericalPolygonArea, calculateLineLength } from '../services/geospatialService';
import { useLanguage } from '../contexts/LanguageContext';

interface TrenchGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: AreaPlantationFeature;
  crops?: Crop[];
  onGenerate: (params: { 
    distance: number; 
    angle: number; 
    plantSpacing: number; 
    from: number; 
    to: number;
    autoPopulateSeedlings?: boolean;
    seedVariety?: string;
  }) => void;
  onPreviewChange?: (previewLines: [number, number][][] | null) => void;
}

const TrenchGenerationModal: React.FC<TrenchGenerationModalProps> = ({ 
  isOpen, 
  onClose, 
  feature, 
  crops = [],
  onGenerate,
  onPreviewChange
}) => {
  const { language } = useLanguage();
  const isKa = language === 'ka';

  const [distance, setDistance] = useState(feature.defaultTrenchSpacing ?? 2.83);
  const [distanceInput, setDistanceInput] = useState((feature.defaultTrenchSpacing ?? 2.83).toString());
  const [plantSpacing, setPlantSpacing] = useState(feature.defaultPlantSpacing ?? 0.9);
  const [plantSpacingInput, setPlantSpacingInput] = useState((feature.defaultPlantSpacing ?? 0.9).toString());
  const [angle, setAngle] = useState(feature.defaultTrenchDirection ?? 90);
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(true);
  
  // Seedling Auto-population Option
  const [autoPopulateSeedlings, setAutoPopulateSeedlings] = useState(true);
  const [selectedVariety, setSelectedVariety] = useState<string>('Standard');

  const [potentialTrenches, setPotentialTrenches] = useState(0);
  const [totalEstimatedPlants, setTotalEstimatedPlants] = useState(0);
  const [fromTrench, setFromTrench] = useState<number | ''>(1);
  const [toTrench, setToTrench] = useState<number | ''>(100);

  // Extract available varieties from crops
  const availableVarieties = useMemo(() => {
    const list = new Set<string>(['Standard', 'Chandler', 'Fernor', 'Franquette', 'Lara', 'Tulare']);
    crops?.forEach(c => {
      c.varieties?.forEach(v => list.add(v));
    });
    return Array.from(list);
  }, [crops]);

  const featureAreaHa = useMemo(() => {
    if (!feature.geometry || feature.geometry.length < 3) return 0;
    try {
        return getSphericalPolygonArea(feature.geometry) / 10000;
    } catch (e) {
        return 0;
    }
  }, [feature.geometry]);

  // Handle active preview calculations on adjustment
  useEffect(() => {
    if (!isOpen) return;

    if (feature.geometry && distance > 0) {
      try {
        const trenches = generateTrenches(feature.geometry, distance, angle);
        setPotentialTrenches(trenches.length);
        
        let estimatedPlants = 0;
        if (plantSpacing > 0) {
            trenches.forEach(geom => {
                const len = calculateLineLength(geom);
                estimatedPlants += Math.floor(len / plantSpacing);
            });
        }
        setTotalEstimatedPlants(estimatedPlants);

        if (trenches.length > 0) {
            setToTrench(prev => {
                const max = trenches.length;
                if (prev === '' || (prev as number) > max || prev === 100) return max;
                return prev;
            });
        }

        // Send temporary lines to parent so it displays as "ghost layers" on the interactive canvas/map
        if (livePreviewEnabled && onPreviewChange) {
            onPreviewChange(trenches);
        } else if (onPreviewChange) {
            onPreviewChange(null);
        }
      } catch (e) {
        console.error("Error estimating trenches", e);
        setPotentialTrenches(0);
        setTotalEstimatedPlants(0);
      }
    }
  }, [feature.geometry, distance, angle, plantSpacing, livePreviewEnabled, isOpen]);

  // Clean preview lines on unmount or close
  useEffect(() => {
    return () => {
        if (onPreviewChange) {
            onPreviewChange(null);
        }
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const handleGenerate = () => {
    const finalFrom = fromTrench === '' ? 1 : fromTrench;
    const finalTo = toTrench === '' ? potentialTrenches : toTrench;
    if (distance > 0 && plantSpacing >= 0 && angle >= 0 && angle < 360 && finalFrom > 0 && finalTo >= finalFrom) {
      onGenerate({ 
        distance, 
        plantSpacing, 
        angle, 
        from: finalFrom, 
        to: finalTo,
        autoPopulateSeedlings,
        seedVariety: selectedVariety
      });
    } else {
      alert(isKa ? "გთხოვთ შეიყვანოთ სწორი პარამეტრები. 'საწყისი' უნდა იყოს ნაკლები ან ტოლი 'საბოლოო'-ზე." : "Please enter valid parameters. 'From' must be less than or equal to 'To'.");
    }
  };

  return (
    <div 
      className="fixed bottom-24 md:bottom-12 right-1/2 md:right-12 translate-x-1/2 md:translate-x-0 z-[2500] w-[94%] sm:w-full sm:max-w-md overflow-hidden bg-slate-950/90 backdrop-blur-xl border border-amber-500/30 text-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-all duration-300 font-sans pointer-events-auto animate-in fade-in zoom-in-95"
      id="trench-generator-floating-panel"
    >
      {/* Header */}
      <div className="p-4 md:p-5 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
            🚜
          </div>
          <div>
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest leading-none block">
              {isKa ? 'რიგებისა და ნერგების დამგეგმავი' : 'Row & Seed Planner'}
            </span>
            <h2 className="text-sm font-extrabold text-slate-100 truncate max-w-[220px] md:max-w-[260px]">
              {feature.name}
            </h2>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer" title={isKa ? 'დახურვა' : 'Close'}>
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      
      {/* Scrollable inputs space */}
      <div className="p-5 space-y-4 max-h-[50vh] md:max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-950/30 text-xs">
          {/* Quick Metrics Header */}
          <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-1.5 font-mono">
              <div className="flex justify-between items-center">
                 <span>{isKa ? 'სექტორის ფართობი:' : 'Sector Area:'}</span>
                 <span className="font-extrabold text-slate-100 italic">{(featureAreaHa || 0).toFixed(2)} HA</span>
              </div>
              <div className="flex justify-between items-center">
                 <span>{isKa ? 'თხრილების რაოდენობა:' : 'Trench Count:'}</span>
                 <span className="font-extrabold text-amber-400">{potentialTrenches} {isKa ? 'რიგი' : 'lines'}</span>
              </div>
              {totalEstimatedPlants > 0 && (
                 <div className="border-t border-slate-800/80 pt-1.5 mt-1.5 flex justify-between items-center text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                    <span>{isKa ? '🌱 სავარაუდო ნერგების რაოდენობა:' : '🌱 Est. Seedlings Pop:'}</span>
                    <span>{totalEstimatedPlants.toLocaleString()} {isKa ? 'ძირი' : 'UN'}</span>
                 </div>
              )}
          </div>

          <div className="space-y-4">
              {/* Incremental angle adjusting (Inclination Slider) */}
              <div className="space-y-2.5 p-3.5 bg-slate-900/40 rounded-2xl border border-slate-800/60">
                  <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isKa ? 'დახრის კუთხე (აზიმუტი)' : 'Inclination Angle'}</label>
                      <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 font-black rounded-lg text-xs font-mono border border-indigo-500/30">
                          {angle}°
                      </span>
                  </div>
                  <div className="relative flex items-center gap-3">
                      <span className="text-[10px] font-extrabold text-slate-500">0°</span>
                      <input 
                          type="range" 
                          min="0" 
                          max="359" 
                          className="flex-grow accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                          value={angle}
                          onChange={e => setAngle(parseInt(e.target.value) || 0)}
                      />
                      <span className="text-[10px] font-extrabold text-slate-500">359°</span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-tight">
                    {isKa ? 'გადააადგილეთ სლაიდერი რუკაზე რიგების მიმართულების რეალურ დროში შესაცვლელად (0° = ჩ-ს, 90° = ა-დ).' : 'Drag slider to rotate dashed "ghost layer" on the map in real time (0° = N-S, 90° = E-W).'}
                  </p>
              </div>

              {/* Range select to generate limit */}
              <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">{isKa ? 'საწყისი რიგი #' : 'From Trench #'}</span>
                      <input 
                          type="number" 
                          className="w-full p-2.5 bg-slate-900/75 border border-slate-800 focus:border-indigo-500/50 rounded-xl text-xs font-bold font-mono outline-none text-white focus:ring-1 focus:ring-indigo-500/30"
                          value={fromTrench}
                          onChange={e => {
                              const val = e.target.value;
                              setFromTrench(val === '' ? '' : parseInt(val) || 1);
                          }}
                      />
                  </div>
                  <div className="space-y-1.5">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">{isKa ? 'საბოლოო რიგი #' : 'To Trench #'}</span>
                      <input 
                          type="number" 
                          className="w-full p-2.5 bg-slate-900/75 border border-slate-800 focus:border-indigo-500/50 rounded-xl text-xs font-bold font-mono outline-none text-white focus:ring-1 focus:ring-indigo-500/30"
                          value={toTrench}
                          onChange={e => {
                              const val = e.target.value;
                              setToTrench(val === '' ? '' : parseInt(val) || 1);
                          }}
                      />
                  </div>
              </div>

              {/* Spacing adjustments */}
              <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">{isKa ? 'რიგებს შორის მანძილი' : 'Trench Spacing'}</label>
                      <div className="relative">
                          <input 
                              type="text" 
                              inputMode="decimal"
                              className="w-full p-2.5 pr-8 bg-slate-900/75 border border-slate-800 focus:border-indigo-500/50 rounded-xl text-xs font-semibold outline-none text-white focus:ring-1 focus:ring-indigo-500/30"
                              value={distanceInput}
                              onChange={e => {
                                  const valStr = e.target.value;
                                  setDistanceInput(valStr);
                                  const parsed = parseFloat(valStr);
                                  if (!isNaN(parsed) && parsed >= 0) {
                                      setDistance(parsed);
                                  }
                              }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold font-mono">m</span>
                      </div>
                  </div>

                  <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">{isKa ? 'ნერგებს შორის მანძილი' : 'Seedling Spacing'}</label>
                      <div className="relative">
                          <input 
                              type="text" 
                              inputMode="decimal"
                              className="w-full p-2.5 pr-8 bg-slate-900/75 border border-slate-800 focus:border-indigo-500/50 rounded-xl text-xs font-semibold outline-none text-white focus:ring-1 focus:ring-indigo-500/30"
                              value={plantSpacingInput}
                              onChange={e => {
                                  const valStr = e.target.value;
                                  setPlantSpacingInput(valStr);
                                  const parsed = parseFloat(valStr);
                                  if (!isNaN(parsed) && parsed >= 0) {
                                      setPlantSpacing(parsed);
                                  }
                              }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold font-mono">m</span>
                      </div>
                  </div>
              </div>

              {/* Seedling Variety & Instant Auto-Populate Option */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 border border-emerald-500/30 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                          <PlantIcon className="h-4 w-4 text-emerald-400" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                              {isKa ? 'ნერგების ავტომატური განთავსება რიგებში' : 'Auto-Populate Seeds in Trenches'}
                          </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                              type="checkbox" 
                              checked={autoPopulateSeedlings} 
                              onChange={e => setAutoPopulateSeedlings(e.target.checked)}
                              className="sr-only peer" 
                          />
                          <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                      </label>
                  </div>

                  {autoPopulateSeedlings && (
                      <div className="space-y-1 pt-1 border-t border-white/5 animate-in fade-in duration-200">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">{isKa ? 'აირჩიეთ ნერგის ჯიში' : 'Select Seed Variety'}</label>
                          <select
                              value={selectedVariety}
                              onChange={e => setSelectedVariety(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-emerald-300 font-bold outline-none focus:border-emerald-400"
                          >
                              {availableVarieties.map(v => (
                                  <option key={v} value={v}>🌱 {v}</option>
                              ))}
                          </select>
                          <p className="text-[8.5px] text-emerald-400/80">
                              {isKa 
                                ? `ავტომატურად განათავსებს ${plantSpacing}მ დაშორებით ${selectedVariety} ჯიშის ნერგებს ყოველ დაგენერირებულ რიგში.`
                                : `Automatically places ${plantSpacing}m spaced ${selectedVariety} seeds along every generated trench row.`
                              }
                          </p>
                      </div>
                  )}
              </div>

              {/* Dynamic Map Preview Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-2xl border border-slate-800/50 select-none">
                  <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-slate-200">{isKa ? 'ცოცხალი წინასწარი გადახედვა რუკაზე' : 'Live Map Ghost Lines'}</span>
                      <span className="text-[9.5px] text-slate-500 leading-none">{isKa ? 'ვირტუალური რიგების ჩვენება რეალურ დროში' : 'Renders non-persistent vectors locally'}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                          type="checkbox" 
                          checked={livePreviewEnabled} 
                          onChange={e => {
                              const enabled = e.target.checked;
                              setLivePreviewEnabled(enabled);
                              if (!enabled && onPreviewChange) onPreviewChange(null);
                          }}
                          className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                  </label>
              </div>
          </div>
      </div>

      {/* Footer operations */}
      <div className="p-4 md:p-5 border-t border-slate-800/80 bg-slate-900/60 flex justify-end gap-2.5">
        <button 
          onClick={onClose} 
          className="flex-1 px-4 py-2.5 text-xs font-extrabold text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer text-center"
        >
          {isKa ? 'გაუქმება' : 'Cancel'}
        </button>
        <button 
          onClick={handleGenerate} 
          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-orange-600/30 transition-all active:scale-95 cursor-pointer text-center"
        >
          <WrenchScrewdriverIcon className="h-3.5 w-3.5" /> 
          <span>
            {isKa 
                ? (autoPopulateSeedlings ? 'რიგებისა და ნერგების გენერირება' : 'თხრილების გენერირება') 
                : `Generate ${autoPopulateSeedlings ? 'Rows & Seeds' : 'Trenches'}`
            }
          </span>
        </button>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default TrenchGenerationModal;
