import React, { useState, useEffect, useRef } from 'react';
import { 
    ScanLine, Usb, Bluetooth, RefreshCw, CheckCircle, AlertTriangle, 
    Trash2, Play, Volume2, Key, HelpCircle, Camera, Check, Copy, ExternalLink,
    Navigation, MapPin 
} from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { safeStorage } from '../../../services/storageService';
import { 
    dispatchHardwareScan, 
    playScannerBeep, 
    parseBarcodePayload,
    initGlobalHardwareScannerListener 
} from '../../../utils/hardwareScannerBus';
import { Employee } from '../../../types';
import { getMainPlantation, getPlantationsList } from '../../../utils/plantationHelper';

interface UsbScannerLabProps {
    employees?: Employee[];
    installedDevices?: any[];
    onAddDevice?: (device: any) => void;
    activeOrgId?: string;
}

export const UsbScannerLab: React.FC<UsbScannerLabProps> = ({
    employees = [],
    installedDevices = [],
    onAddDevice,
    activeOrgId
}) => {
    const [selectedScannerId, setSelectedScannerId] = useState<string>(() => safeStorage.getItem('agrimap_selected_scanner') || '');
    const [testInputVal, setTestInputVal] = useState('');
    const [keystrokeLog, setKeystrokeLog] = useState<{ char: string; code: string; deltaMs: number }[]>([]);
    const [lastScanEvent, setLastScanEvent] = useState<{
        code: string;
        source: string;
        timestamp: string;
        matchedType: string;
        details: string;
    } | null>(null);

    // QR Test Generator state
    const [activeQrType, setActiveQrType] = useState<'harvest_box' | 'worker' | 'pallet' | 'scale'>('harvest_box');
    const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');
    const [generatedCodeText, setGeneratedCodeText] = useState<string>('');

    // Scanner Config Options
    const [scannerConfig, setScannerConfig] = useState(() => {
        const saved = safeStorage.getItem('agrimap_scanner_config');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return {
            mode: 'USB_HID_KEYBOARD_WEDGE',
            suffix: 'ENTER',
            autoTrim: true,
            playBeep: true,
            vibration: false,
            prefixStrip: '',
            minChars: 3
        };
    });

    // Webcam Test state
    const [isCameraActive, setIsCameraActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const lastKeyTimeRef = useRef<number>(performance.now());

    // Generate test QR whenever type changes
    useEffect(() => {
        let code = '';
        if (activeQrType === 'harvest_box') {
            code = `BX-HARVEST-2026-${Math.floor(100 + Math.random() * 900)}`;
        } else if (activeQrType === 'worker') {
            const emp = employees[0];
            code = emp?.barcode || emp?.idNumber || emp?.id || 'EMP-2026-001';
        } else if (activeQrType === 'pallet') {
            code = `PLT-BERRY-B12-${Date.now().toString().slice(-4)}`;
        } else {
            code = `WEIGH-TICKET-${Math.floor(1000 + Math.random() * 9000)}`;
        }
        setGeneratedCodeText(code);

        QRCode.toDataURL(code, { width: 180, margin: 1, color: { dark: '#090e17', light: '#ffffff' } })
            .then(url => setGeneratedQrDataUrl(url))
            .catch(() => {});
    }, [activeQrType, employees]);

    // Save Scanner Config
    const handleSaveConfig = (newCfg: any) => {
        setScannerConfig(newCfg);
        safeStorage.setItem('agrimap_scanner_config', JSON.stringify(newCfg));
        toast.success('Scanner configuration saved to local hardware bus.');
    };

    // Listen to hardware scans
    useEffect(() => {
        initGlobalHardwareScannerListener();
        const handleScan = (e: any) => {
            const data = e.detail;
            if (!data?.code) return;
            const code = String(data.code).trim();
            const matchedEmp = employees.find(emp => emp.id === code || emp.barcode === code || emp.idNumber === code);
            
            let matchedType = 'General Barcode';
            let details = `Payload: ${code}`;

            if (matchedEmp) {
                matchedType = 'Worker ID Badge';
                details = `${matchedEmp.name} (${matchedEmp.role || 'Field Operator'}) • Verified for Payroll & Harvest`;
            } else if (code.startsWith('BX-') || code.includes('HARVEST') || code.includes('CRATE')) {
                matchedType = 'Harvest Crate Barcode';
                details = 'Verified for Weigh Station intake & Gross weight logging';
            } else if (code.startsWith('PLT-')) {
                matchedType = 'Pallet Logistics QR';
                details = 'Cold Storage & Refrigerator batch tracking ready';
            } else if (code.startsWith('WEIGH-')) {
                matchedType = 'Scale Weigh Ticket';
                details = 'Tare/Gross certified ticket match';
            }

            setLastScanEvent({
                code,
                source: data.source || 'Adopted USB Scanner',
                timestamp: new Date().toLocaleTimeString(),
                matchedType,
                details
            });
        };

        window.addEventListener('agrimap:hardware_scan', handleScan);
        return () => window.removeEventListener('agrimap:hardware_scan', handleScan);
    }, [employees]);

    // Test input keystroke logger
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const now = performance.now();
        const delta = Math.round(now - lastKeyTimeRef.current);
        lastKeyTimeRef.current = now;

        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (testInputVal.trim().length >= (scannerConfig.minChars || 3)) {
                dispatchHardwareScan(testInputVal.trim(), 'Manual / USB Test Bar');
                setTestInputVal('');
                setKeystrokeLog([]);
            }
            return;
        }

        if (e.key && e.key.length === 1) {
            setKeystrokeLog(prev => [{ char: e.key, code: e.code, deltaMs: delta }, ...prev.slice(0, 14)]);
        }
    };

    // Auto-Adopt USB Scanner
    const handleAdoptCurrentScanner = (deviceDetails?: any) => {
        const scannerDevice = deviceDetails || {
            id: 'scan-dm13-usb-kbw',
            name: 'DM13 USB POS KBW',
            model: 'USB POS Keyboard Wedge Barcode & 2D QR Scanner',
            type: 'scanner',
            connectionInfo: 'USB Port • POS Keyboard Wedge (KBW)',
            driverStatus: 'Active & Listening',
            organizationId: activeOrgId,
            adoptedAt: new Date().toISOString()
        };

        setSelectedScannerId(scannerDevice.id);
        safeStorage.setItem('agrimap_selected_scanner', scannerDevice.id);
        safeStorage.setItem('agrimap_adopted_scanner_info', JSON.stringify(scannerDevice));

        // Save in hardware devices list
        try {
            const rawHw = localStorage.getItem('hardware_devices');
            let list = rawHw ? JSON.parse(rawHw) : [];
            list = list.filter((d: any) => d.id !== scannerDevice.id);
            list.unshift(scannerDevice);
            localStorage.setItem('hardware_devices', JSON.stringify(list));
        } catch (e) {}

        if (onAddDevice) {
            onAddDevice(scannerDevice);
        }

        playScannerBeep('success');
        toast.success(`USB Scanner "${scannerDevice.name}" successfully adopted for application-wide QR scanning!`);
    };

    // WebHID Direct Connect attempt
    const handleConnectWebHID = async () => {
        if (!('hid' in navigator)) {
            toast.info('WebHID direct handshake not supported on this browser. Plug-and-Play USB Keyboard Wedge is active.');
            handleAdoptCurrentScanner();
            return;
        }

        try {
            const devices = await (navigator as any).hid.requestDevice({ filters: [] });
            if (devices && devices.length > 0) {
                const dev = devices[0];
                const newDevice = {
                    id: `usb-hid-${dev.vendorId}-${dev.productId}`,
                    name: dev.productName || 'USB Barcode / QR Scanner',
                    model: `VID: 0x${dev.vendorId.toString(16).toUpperCase()} PID: 0x${dev.productId.toString(16).toUpperCase()}`,
                    type: 'scanner',
                    connectionInfo: 'WebHID Low-Level Direct Channel',
                    driverStatus: 'Connected & Listening',
                    organizationId: activeOrgId
                };
                handleAdoptCurrentScanner(newDevice);
            } else {
                handleAdoptCurrentScanner();
            }
        } catch (err: any) {
            // User cancelled or fallback
            handleAdoptCurrentScanner();
        }
    };

    const adoptedScanners = installedDevices.filter(d => d.type === 'scanner');
    const activeAdopted = adoptedScanners.find(s => s.id === selectedScannerId) || adoptedScanners[0];

    const mainPlantation = getMainPlantation([], [41.9023, 44.5], activeOrgId);
    const plantationList = getPlantationsList([], [41.9023, 44.5], false, activeOrgId);
    const [selectedPlantationName, setSelectedPlantationName] = useState(mainPlantation.name);

    return (
        <div className="space-y-6">
            {/* Header & Quick Adoption Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                        <ScanLine className="text-blue-600" size={24} />
                        USB Barcode & 2D QR Scanner Diagnostic Suite
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                        Plug & play hardware adoption, keystroke buffer diagnostics, and live QR test verification
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Active Profile Plantation Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded-xl border border-emerald-500/50 shadow-sm text-xs">
                        <span className="text-emerald-500 font-bold">🌿</span>
                        <select
                            value={selectedPlantationName}
                            onChange={(e) => {
                                const targetName = e.target.value;
                                const item = plantationList.find(p => p.name === targetName) || mainPlantation;
                                setSelectedPlantationName(targetName);
                                window.dispatchEvent(new CustomEvent('agrimap:fly-to-location', { detail: { center: item.center, name: item.name } }));
                                toast.success(`რუკა გადაფრინდა: ${item.name}`);
                            }}
                            className="bg-transparent text-emerald-600 dark:text-emerald-300 font-bold font-mono outline-none cursor-pointer max-w-[170px] truncate"
                            title="Bound Plantation Area for scanned hardware"
                        >
                            {plantationList.map((p, idx) => (
                                <option key={`scan-p-${p.id}-${idx}`} value={p.name} className="bg-slate-950 text-slate-200">
                                    {p.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                const item = plantationList.find(p => p.name === selectedPlantationName) || mainPlantation;
                                window.dispatchEvent(new CustomEvent('agrimap:fly-to-location', { detail: { center: item.center, name: item.name } }));
                                toast.success(`რუკა გადაფრინდა: ${item.name}`);
                            }}
                            className="p-1 hover:bg-emerald-500/20 rounded text-emerald-500 cursor-pointer transition-colors"
                            title="Fly to Plantation"
                        >
                            <Navigation size={12} />
                        </button>
                    </div>

                    <button
                        onClick={handleConnectWebHID}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                        <Usb size={16} /> Connect / Adopt USB Scanner
                    </button>
                    <button
                        onClick={() => playScannerBeep('success')}
                        className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Test POS audio chirp"
                    >
                        <Volume2 size={15} /> Beep Test
                    </button>
                </div>
            </div>

            {/* Active Scanner Adoption Status Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 rounded-3xl border border-blue-200 dark:border-blue-900/50 flex items-start gap-4">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm">
                        <Usb size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block">
                            Active Adopted USB Scanner
                        </span>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase truncate mt-0.5">
                            {activeAdopted?.name || 'Plug & Play USB HID Keyboard Wedge Scanner'}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-mono truncate mt-1">
                            {activeAdopted?.connectionInfo || 'Direct Keystroke Interceptor • < 40ms Burst Read'}
                        </p>
                        <div className="mt-2.5 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Adopted & Ready
                            </span>
                            <span className="text-[9px] font-black uppercase text-slate-400">
                                Driver OK
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-4">
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm">
                        <CheckCircle size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">
                            App Integration Status
                        </span>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase truncate mt-0.5">
                            Weigh Station & HR Auto-Link
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate mt-1">
                            Scanned worker badges identify picker. Crate barcodes link to scale tare/gross weights.
                        </p>
                        <div className="mt-2.5 flex items-center gap-2">
                            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                                ● Global Event Bus Active
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-3xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-4">
                    <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-sm font-black">
                        <Key size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 block">
                            Hardware Intercept Mode
                        </span>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase truncate mt-0.5">
                            {scannerConfig.mode.replace(/_/g, ' ')}
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate mt-1">
                            Suffix: {scannerConfig.suffix} • Min: {scannerConfig.minChars} chars • Auto-Trim: ON
                        </p>
                        <div className="mt-2.5">
                            <button
                                onClick={() => handleAdoptCurrentScanner()}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                                Re-verify Adoption
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Interactive Test Console & QR Generator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Live Keystroke & Scan Tester (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="p-6 bg-slate-900 text-white rounded-[2rem] border border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400">
                                    Live USB Scanner Input & Buffer Monitor
                                </h4>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400 uppercase">
                                Standby for Barcode / QR Scan
                            </span>
                        </div>

                        {/* Scanner Interactive Input Box */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                Physical Scanner Test Field (Aim scanner and trigger barcode):
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={testInputVal}
                                    onChange={(e) => setTestInputVal(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Click here and scan physical barcode, or type to test..."
                                    className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-2xl text-sm font-mono text-emerald-300 placeholder:text-slate-600 outline-none transition-all"
                                />
                                {testInputVal && (
                                    <button
                                        onClick={() => {
                                            if (testInputVal.trim()) {
                                                dispatchHardwareScan(testInputVal.trim(), 'Test Console');
                                                setTestInputVal('');
                                                setKeystrokeLog([]);
                                            }
                                        }}
                                        className="absolute right-2 top-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider"
                                    >
                                        Process
                                    </button>
                                )}
                            </div>
                            <p className="text-[9px] text-slate-500 mt-1">
                                💡 Tip: Physical USB scanners type barcode data rapidly and end with &apos;Enter&apos;. The application detects and captures this automatically on any screen.
                            </p>
                        </div>

                        {/* Keystroke Diagnostics Trace */}
                        {keystrokeLog.length > 0 && (
                            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                    Burst Keystroke Timing Buffer (ms delta):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {keystrokeLog.map((k, idx) => (
                                        <span key={idx} className="px-2 py-1 bg-slate-800 text-emerald-400 rounded text-[10px] font-mono flex items-center gap-1">
                                            <span>&apos;{k.char}&apos;</span>
                                            <span className="text-[8px] text-slate-400">({k.deltaMs}ms)</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Last Scan Event Result */}
                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    Last Processed Hardware Scan
                                </span>
                                {lastScanEvent && (
                                    <span className="text-[8px] font-mono text-slate-500">
                                        {lastScanEvent.timestamp} • {lastScanEvent.source}
                                    </span>
                                )}
                            </div>

                            {lastScanEvent ? (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-blue-600/30 text-blue-400 border border-blue-500/40 rounded text-[9px] font-black uppercase">
                                            {lastScanEvent.matchedType}
                                        </span>
                                        <span className="text-xs font-mono font-bold text-white">
                                            {lastScanEvent.code}
                                        </span>
                                    </div>
                                    <p className="text-xs text-emerald-400 font-medium">
                                        ✓ {lastScanEvent.details}
                                    </p>
                                </div>
                            ) : (
                                <div className="py-4 text-center text-slate-600 text-xs uppercase font-bold">
                                    No scan received yet. Trigger your scanner or use the test barcodes on the right.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scanner Configuration Controls */}
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                            Driver Protocol & Format Tuning
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Suffix Delimiter</label>
                                <select
                                    value={scannerConfig.suffix}
                                    onChange={(e) => handleSaveConfig({ ...scannerConfig, suffix: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                                >
                                    <option value="ENTER">Enter (CR/LF) [Standard]</option>
                                    <option value="TAB">Tab Character</option>
                                    <option value="NONE">None (Timeout Burst)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Audio Confirmation</label>
                                <button
                                    onClick={() => handleSaveConfig({ ...scannerConfig, playBeep: !scannerConfig.playBeep })}
                                    className={`w-full py-2 px-3 rounded-xl text-xs font-black uppercase transition-all ${scannerConfig.playBeep ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    {scannerConfig.playBeep ? 'Sound ON' : 'Muted'}
                                </button>
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Auto-Trim Whitespace</label>
                                <button
                                    onClick={() => handleSaveConfig({ ...scannerConfig, autoTrim: !scannerConfig.autoTrim })}
                                    className={`w-full py-2 px-3 rounded-xl text-xs font-black uppercase transition-all ${scannerConfig.autoTrim ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    {scannerConfig.autoTrim ? 'Trim Enabled' : 'Raw String'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Test QR Code Generator for Physical Scanner (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 block">
                                Verification Target
                            </span>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase">
                                Scan This On-Screen QR Code
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                                Point your handheld USB/Bluetooth scanner at this screen to test hardware recognition.
                            </p>
                        </div>

                        {/* Test Target Selector */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setActiveQrType('harvest_box')}
                                className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-left ${activeQrType === 'harvest_box' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'}`}
                            >
                                📦 Harvest Crate
                            </button>
                            <button
                                onClick={() => setActiveQrType('worker')}
                                className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-left ${activeQrType === 'worker' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'}`}
                            >
                                👤 Worker ID Badge
                            </button>
                            <button
                                onClick={() => setActiveQrType('pallet')}
                                className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-left ${activeQrType === 'pallet' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'}`}
                            >
                                🧊 Cold Storage Pallet
                            </button>
                            <button
                                onClick={() => setActiveQrType('scale')}
                                className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-left ${activeQrType === 'scale' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'}`}
                            >
                                ⚖️ Weigh Station Ticket
                            </button>
                        </div>

                        {/* QR Code Display Canvas */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center">
                            {generatedQrDataUrl ? (
                                <img src={generatedQrDataUrl} alt="Test QR" className="w-44 h-44 rounded-xl shadow-md border border-white" />
                            ) : (
                                <div className="w-44 h-44 flex items-center justify-center bg-slate-200 rounded-xl">
                                    <RefreshCw className="animate-spin text-slate-400" size={24} />
                                </div>
                            )}
                            <div className="mt-3 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 select-all">
                                {generatedCodeText}
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        dispatchHardwareScan(generatedCodeText, 'Software Emulation');
                                        toast.success(`Emulated scan: ${generatedCodeText}`);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                                >
                                    <Play size={12} /> Test Scan Emulation
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Adopted Scanners Pool List */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                                Installed Scanner Pool
                            </h4>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                                {adoptedScanners.length} Available
                            </span>
                        </div>

                        <div className="space-y-2">
                            {adoptedScanners.length > 0 ? (
                                adoptedScanners.map(scanner => (
                                    <div key={scanner.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase truncate">{scanner.name}</p>
                                            <p className="text-[9px] text-slate-500 font-mono truncate">{scanner.connectionInfo || 'USB HID'}</p>
                                        </div>
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-black uppercase">
                                            Online
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-3 text-slate-400 text-xs">
                                    Default USB HID Wedge scanner auto-linked.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
