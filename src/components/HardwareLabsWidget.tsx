import React, { useState } from 'react';
import { 
    Cpu, Scale, QrCode, Printer, Wifi, WifiOff, 
    RefreshCw, ChevronRight, Activity, CheckCircle, Zap 
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export interface HardwareLabsWidgetProps {
    onNavigateMode?: (mode: string) => void;
    organizationId?: string;
}

export const HardwareLabsWidget: React.FC<HardwareLabsWidgetProps> = ({
    onNavigateMode
}) => {
    const { t } = useLanguage();
    const [isScaleZeroed, setIsScaleZeroed] = useState(false);
    const [lastScanCode, setLastScanCode] = useState<string>('BX-HARVEST-2026-089');

    const handleTareScale = () => {
        setIsScaleZeroed(true);
        toast.success('Scale tare calibrated: 0.35 kg tare deducted. Scale set to 0.000 kg');
        setTimeout(() => setIsScaleZeroed(false), 2000);
    };

    const handleSimulateScan = () => {
        const randomBox = `BX-${Math.floor(1000 + Math.random() * 9000)}`;
        setLastScanCode(randomBox);
        window.dispatchEvent(new CustomEvent('agrimap:hardware_scan', {
            detail: { code: randomBox, source: 'Bluetooth Wedge Scanner' }
        }));
        toast.success(`Barcode Scanned: ${randomBox}`);
    };

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col justify-between">
            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('dash.widget.hardware_labs')}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                {t('hardware_widget.protocols_active')}
                            </span>
                        </div>
                        <p className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
                            {t('hardware_widget.subtitle')}
                        </p>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 text-amber-600">
                        <Cpu size={20} />
                    </div>
                </div>

                {/* Device Grid */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                    {/* Electronic Scale Protocol */}
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Scale size={12} className="text-amber-600" />
                                {t('hardware_widget.scale_protocol')}
                            </span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <p className="text-sm font-black text-slate-800">Yaohua / CAS</p>
                        <p className="text-[8px] font-bold text-emerald-600 mt-0.5">{t('hardware_widget.tare_ready')}</p>
                    </div>

                    {/* Barcode & QR Scanner */}
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <QrCode size={12} className="text-blue-600" />
                                {t('hardware_widget.scanner')}
                            </span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <p className="text-sm font-black text-slate-800 truncate">{lastScanCode}</p>
                        <p className="text-[8px] font-bold text-blue-600 mt-0.5">{t('hardware_widget.keyboard_wedge')}</p>
                    </div>

                    {/* Thermal Label Printer */}
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Printer size={12} className="text-indigo-600" />
                                {t('hardware_widget.printer')}
                            </span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <p className="text-sm font-black text-slate-800">ESC/POS 58/80</p>
                        <p className="text-[8px] font-bold text-slate-400 mt-0.5">{t('hardware_widget.auto_cut')}</p>
                    </div>

                    {/* Weather & Soil Sensors */}
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Activity size={12} className="text-emerald-600" />
                                {t('hardware_widget.telemetry')}
                            </span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <p className="text-sm font-black text-slate-800">22.4°C • 68%</p>
                        <p className="text-[8px] font-bold text-emerald-600 mt-0.5">{t('hardware_widget.soil_optimal')}</p>
                    </div>
                </div>

                {/* Quick actions row */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleTareScale}
                        disabled={isScaleZeroed}
                        className="flex-1 py-1.5 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                        <RefreshCw size={11} className={isScaleZeroed ? 'animate-spin' : ''} />
                        <span>{isScaleZeroed ? t('hardware_widget.zeroing') : t('hardware_widget.zero_scale')}</span>
                    </button>

                    <button
                        onClick={handleSimulateScan}
                        className="flex-1 py-1.5 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                        <Zap size={11} />
                        <span>{t('hardware_widget.test_scan')}</span>
                    </button>
                </div>
            </div>

            {/* Operational footer launcher */}
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center gap-2">
                <button
                    onClick={() => {
                        if (onNavigateMode) onNavigateMode('labs');
                        else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'labs' }));
                    }}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm shadow-amber-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <span>{t('hardware_widget.open_console')}</span>
                    <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
};
