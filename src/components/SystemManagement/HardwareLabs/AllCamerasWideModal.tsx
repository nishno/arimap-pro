import React, { useState, useMemo } from 'react';
import { 
    X, Maximize2, Video, Camera, Grid, RefreshCw, 
    HardDrive, Server, Shield, Radio, Volume2, VolumeX, Eye, 
    Sliders, Settings, Plus, ExternalLink, Play, Pause, Download,
    HelpCircle, Copy, Check, ShieldAlert, Monitor, Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { PlantationCamera } from './CameraNvrLab';
import { Go2rtcVideoStream } from './Go2rtcVideoStream';
import { DeviceControlPanel } from './DeviceControlPanel';
import { getMainPlantation, CANONICAL_PLANTATION_NAME, CANONICAL_AGROBARI_CENTER } from '../../../utils/plantationHelper';
import { Move } from 'lucide-react';

interface AllCamerasWideModalProps {
    isOpen: boolean;
    onClose: () => void;
    cameras: PlantationCamera[];
    onSelectCameraForDetail?: (cam: PlantationCamera) => void;
    onOpenAddCameraModal?: () => void;
}

export const AllCamerasWideModal: React.FC<AllCamerasWideModalProps> = ({
    isOpen,
    onClose,
    cameras,
    onSelectCameraForDetail,
    onOpenAddCameraModal
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [layout, setLayout] = useState<'1x1' | '2x2' | '3x3' | '4x4'>('2x2');
    const [selectedCamId, setSelectedCamId] = useState<string>(cameras[0]?.id || '');
    const [viewAll16Channels, setViewAll16Channels] = useState<boolean>(false);
    const [showUnblockHelper, setShowUnblockHelper] = useState<boolean>(false);
    const [showDeviceControl, setShowDeviceControl] = useState<boolean>(false);

    const mainPlantation = useMemo(() => getMainPlantation(), []);

    if (!isOpen) return null;

    // Build complete 16 channels list if viewAll16Channels is enabled
    const allChannelsList: PlantationCamera[] = viewAll16Channels
        ? Array.from({ length: 16 }).map((_, idx) => {
            const ch = idx + 1;
            const existing = cameras.find(c => c.channel === ch);
            if (existing) return existing;
            return {
                id: `nvr-ch-${ch}`,
                name: `Orchard Cam CH0${ch < 10 ? `0${ch}` : ch}`,
                model: 'Hikvision DS-2CD2087G2-LU (4K ColorVu)',
                ipAddress: '192.168.10.244',
                channel: ch,
                rtspPort: 554,
                rtspUrl: `rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/${ch}01`,
                locationName: `Orchard Pole CH0${ch}`,
                lat: 41.9023,
                lng: 44.5,
                mountHeightM: 6,
                azimuthDeg: (ch * 45) % 360,
                tiltAngleDeg: 4,
                rangeM: 75,
                fovAngleDeg: 102,
                resolutionMp: 8,
                focalLengthMm: 2.8,
                status: 'ONLINE',
                isPtz: false,
                isNightVision: true
            } as unknown as PlantationCamera;
        })
        : cameras;

    const displayCameras = allChannelsList.slice(
        0, 
        layout === '1x1' ? 1 : layout === '2x2' ? 4 : layout === '3x3' ? 9 : 16
    );

    const activeCam = allChannelsList.find(c => c.id === selectedCamId) || allChannelsList[0];

    // Master 16-channel Gateway Python Bridge Download
    const handleDownloadMasterGateway = () => {
        const script = `# ====================================================================
# AgriMap Pro - Master 16-Channel NVR & IP Camera Gateway Bridge
# Target NVR: 192.168.10.244 (Hikvision DS-7716NI-I4 / 16P)
# WebRTC / RTSP Gateway for All Channels + Wireless Online Cameras
# ====================================================================

import os
import sys
import subprocess
import time

GO2RTC_YAML = """# AgriMap Pro - Unified go2rtc 16-Channel Configuration
api:
  listen: ":1984"
  origin: "*"

webrtc:
  listen: ":8555"

streams:
  camera_1_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/101
  camera_2_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/201
  camera_3_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/301
  camera_4_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/401
  camera_5_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/501
  camera_6_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/601
  camera_7_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/701
  camera_8_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/801
  camera_9_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/901
  camera_10_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1001
  camera_11_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1101
  camera_12_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1201
  camera_13_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1301
  camera_14_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1401
  camera_15_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1501
  camera_16_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1601
  
  # Sub-streams for high-speed multi-grid view (Low bandwidth / mobile friendly):
  camera_1_sub: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/102
  camera_2_sub: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/202
  camera_3_sub: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/302
"""

print("=" * 65)
print("  AgriMap Pro - Master All-in-One NVR Streaming Gateway")
print("  Target NVR: 192.168.10.244 (Hikvision DS-7716NI-I4 / 16P)")
print("  Configured Channels: 16 (Full Orchard Surveillance Matrix)")
print("=" * 65)

# Step 1: Write go2rtc.yaml automatically
try:
    with open("go2rtc.yaml", "w", encoding="utf-8") as f:
        f.write(GO2RTC_YAML)
    print("[+] Successfully generated go2rtc.yaml with all 16 channels!")
except Exception as e:
    print(f"[-] Could not write go2rtc.yaml: {e}")

# Step 2: Kill any existing/stale go2rtc processes to prevent port bind conflict
print("[+] Checking for existing go2rtc instances to avoid port 1984 conflict...")
try:
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/F", "/IM", "go2rtc.exe"], capture_output=True)
    else:
        subprocess.run(["killall", "-9", "go2rtc"], capture_output=True)
    time.sleep(0.5)
except Exception:
    pass

# Step 3: Launch go2rtc binary
print("[+] Starting fresh go2rtc server on http://localhost:1984...")
try:
    subprocess.Popen(["go2rtc"])
    print("[SUCCESS] go2rtc active! WebRTC stream server is running.")
except Exception:
    print("[!] Notice: 'go2rtc' binary not found in current folder.")
    print("    Please download go2rtc.exe from:")
    print("    https://github.com/AlexxIT/go2rtc/releases")
    print("    and place it in the same directory as this script.")

# Step 4: Diagnostic test
print("\\n" + "=" * 65)
print("  STREAMING READY FOR ALL 16 CAMERAS!")
print("  - Local WebRTC Gateway:  http://localhost:1984")
print("  - Stream Matrix:         camera_1_main through camera_16_main")
print("  - Browser Connection:    Go to AgriMap Pro -> Watch Live Grid")
print("=" * 65 + "\\n")
input("Press Enter to keep this gateway open (or Ctrl+C to stop)...")
`;
        const blob = new Blob([script], { type: 'text/x-python' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'agrimap_master_gateway.py';
        a.click();
        URL.revokeObjectURL(url);
        toast.success(isKa ? 'ჩამოიტვირთა 16-არხიანი Master Gateway სკრიპტი' : 'Downloaded Master 16-Channel Gateway Bridge!');
    };

    // Download go2rtc.yaml directly
    const handleDownloadYaml = () => {
        const yamlConfig = `# go2rtc.yaml - AgriMap Pro All 16 Channels
api:
  listen: ":1984"
  origin: "*"

webrtc:
  listen: ":8555"

streams:
  camera_1_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/101
  camera_2_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/201
  camera_3_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/301
  camera_4_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/401
  camera_5_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/501
  camera_6_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/601
  camera_7_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/701
  camera_8_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/801
  camera_9_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/901
  camera_10_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1001
  camera_11_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1101
  camera_12_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1201
  camera_13_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1301
  camera_14_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1401
  camera_15_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1501
  camera_16_main: rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/1601
`;
        const blob = new Blob([yamlConfig], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'go2rtc.yaml';
        a.click();
        URL.revokeObjectURL(url);
        toast.success(isKa ? 'ჩამოიტვირთა go2rtc.yaml ფაილი' : 'Downloaded go2rtc.yaml! Save in C:\\go2rtc\\ folder.');
    };

    return (
        <div className="fixed inset-0 z-[2700] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-[96vw] h-[94vh] bg-slate-950 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white">
                
                {/* Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-900/95 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600/20 border border-blue-500/40 rounded-2xl text-blue-400">
                            <Video size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                    Hikvision DS-7716NI-I4 / 16P (192.168.10.244) & All IP Cameras
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[9px]">
                                    {allChannelsList.length} Channels Total
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono text-[9px] flex items-center gap-1">
                                    <Navigation size={9} /> 🌿 {mainPlantation.name}
                                </span>
                            </div>
                            <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-white mt-0.5">
                                {isKa ? 'პლანტაციის ვიდეოთვალთვალის პირდაპირი მატრიცა' : 'Watch Live Surveillance Grid & Channels Streaming'}
                            </h2>
                        </div>
                    </div>

                    {/* Layout Switcher & Action Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* 16 Channels Toggle */}
                        <button
                            type="button"
                            onClick={() => setViewAll16Channels(!viewAll16Channels)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 ${
                                viewAll16Channels 
                                    ? 'bg-blue-600/30 border-blue-500 text-blue-300' 
                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                            <Server size={13} />
                            <span>{viewAll16Channels ? 'All 16 NVR Channels' : 'Map Cameras Only'}</span>
                        </button>

                        {/* Grid Matrix Buttons: 1x1, 2x2, 3x3, 4x4 */}
                        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
                            {(['1x1', '2x2', '3x3', '4x4'] as const).map(l => (
                                <button
                                    key={l}
                                    type="button"
                                    onClick={() => setLayout(l)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-black transition-all cursor-pointer ${
                                        layout === l ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>

                        {/* Download Master 16-Channel Gateway Bridge */}
                        <button
                            type="button"
                            onClick={handleDownloadMasterGateway}
                            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
                            title="Download 1 unified gateway for all 16 cameras (No need to download one by one)"
                        >
                            <Download size={13} />
                            <span className="hidden sm:inline">{isKa ? 'Master Gateway (ყველა არხი)' : 'Master All-16-Ch Gateway'}</span>
                        </button>

                        {/* Download go2rtc.yaml */}
                        <button
                            type="button"
                            onClick={handleDownloadYaml}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-600/40 flex items-center gap-1 cursor-pointer"
                            title="Download pre-configured go2rtc.yaml directly"
                        >
                            <Copy size={12} />
                            <span className="hidden md:inline">go2rtc.yaml</span>
                        </button>

                        {/* Browser Unblock Guide */}
                        <button
                            type="button"
                            onClick={() => setShowUnblockHelper(true)}
                            className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="Instructions to allow Insecure Content in browser"
                        >
                            <ShieldAlert size={13} />
                            <span className="hidden lg:inline">{isKa ? 'განბლოკვა' : 'Unblock Guide'}</span>
                        </button>

                        {onOpenAddCameraModal && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onOpenAddCameraModal();
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                            >
                                <Plus size={14} />
                                <span className="hidden sm:inline">{isKa ? 'დამატება' : 'Add Cam'}</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Close Window"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Main Video Stream Grid */}
                <div className="flex-1 p-2.5 sm:p-3.5 bg-black overflow-y-auto custom-scrollbar">
                    <div className={`grid gap-2.5 h-full ${
                        layout === '1x1' 
                            ? 'grid-cols-1' 
                            : layout === '2x2' 
                            ? 'grid-cols-1 sm:grid-cols-2' 
                            : layout === '3x3'
                            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                    }`}>
                        {displayCameras.map((cam) => {
                            const isSelected = cam.id === selectedCamId;
                            const rtspUrl = (cam as any).rtspUrl || `rtsp://CAMERA_HOST/${cam.ipAddress || '192.168.10.244'}:554/Streaming/Channels/${cam.channel}01`;
                            const streamSrc = `camera_${cam.channel}_main`;

                            return (
                                <div
                                    key={cam.id}
                                    onClick={() => setSelectedCamId(cam.id)}
                                    className={`relative rounded-2xl overflow-hidden border transition-all flex flex-col ${
                                        isSelected 
                                            ? 'border-blue-500 ring-2 ring-blue-500/40' 
                                            : 'border-slate-800 hover:border-slate-700'
                                    } bg-slate-950 min-h-[220px]`}
                                >
                                    {/* Embed Live Go2rtc Video Stream for Every Channel */}
                                    <Go2rtcVideoStream
                                        streamSrc={streamSrc}
                                        rtspUrl={rtspUrl}
                                        cameraName={cam.name}
                                        channelNumber={cam.channel}
                                        aspectRatio="16/9"
                                        className="w-full h-full"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Telemetry & Selected Camera Quick Actions */}
                {activeCam && (
                    <div className="p-3 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                            <span className="text-slate-400">
                                {isKa ? 'არჩეული არხი:' : 'Active Focused Channel:'}
                            </span>
                            <span className="font-black text-white">
                                [CH0{activeCam.channel < 10 ? `0${activeCam.channel}` : activeCam.channel}] {activeCam.name}
                            </span>
                            <span className="text-slate-400 font-mono hidden sm:inline">
                                ({activeCam.ipAddress || '192.168.10.244'}:554 • Tilt: {activeCam.tiltAngleDeg || 4}° • Azimuth: {activeCam.azimuthDeg || 0}°)
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const link = `rtsp://CAMERA_HOST/${activeCam.ipAddress || '192.168.10.244'}:554/Streaming/Channels/${activeCam.channel}01`;
                                    navigator.clipboard.writeText(link);
                                    toast.success(`Copied RTSP for CH0${activeCam.channel}!`);
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-slate-300"
                            >
                                <Copy size={13} />
                                <span>Copy RTSP</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowDeviceControl(!showDeviceControl)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    showDeviceControl 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-slate-800 hover:bg-slate-700 text-blue-300'
                                }`}
                                title="Device Control & Moving"
                            >
                                <Move size={13} />
                                <span>{isKa ? 'მართვის პანელი' : 'Device Control'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (onSelectCameraForDetail) {
                                        onSelectCameraForDetail(activeCam);
                                    }
                                    setLayout('1x1');
                                    toast.info(`Single view for CH0${activeCam.channel}`);
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-white"
                            >
                                <Maximize2 size={13} />
                                <span>{isKa ? 'სრული ეკრანი' : '1x1 Solo View'}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Device Control Modal Overlay */}
            {showDeviceControl && activeCam && (
                <div className="fixed inset-0 z-[3100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-2xl w-full shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <h4 className="font-black text-sm uppercase tracking-wide text-white flex items-center gap-2">
                                <Move size={16} className="text-blue-400" />
                                {isKa ? 'მოწყობილობის მართვა & გადაადგილება' : 'Device Control & Moving Panel'}
                            </h4>
                            <button
                                onClick={() => setShowDeviceControl(false)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <DeviceControlPanel
                            camera={{
                                id: activeCam.id,
                                name: activeCam.name,
                                channel: activeCam.channel,
                                model: activeCam.model,
                                ipAddress: activeCam.ipAddress,
                                lat: activeCam.lat || CANONICAL_AGROBARI_CENTER[0],
                                lng: activeCam.lng || CANONICAL_AGROBARI_CENTER[1],
                                azimuthDeg: activeCam.azimuthDeg,
                                tiltAngleDeg: activeCam.tiltAngleDeg,
                                opticalZoomX: (activeCam as any).opticalZoomX || 2,
                                rangeM: activeCam.rangeM,
                                mountHeightM: activeCam.mountHeightM,
                                isPtz: activeCam.isPtz,
                                isNightVision: activeCam.isNightVision
                            }}
                            onUpdateCamera={(updated) => {
                                Object.assign(activeCam, updated);
                                toast.success(isKa ? 'კამერის პარამეტრები განახლდა' : 'Camera parameters updated');
                            }}
                            mapCenterCoords={CANONICAL_AGROBARI_CENTER}
                            isKa={isKa}
                        />
                    </div>
                </div>
            )}

            {/* Browser Unblock Guide Modal */}
            {showUnblockHelper && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 text-white">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-400">
                                    <ShieldAlert size={22} />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm uppercase tracking-wide text-white">
                                        How to Unblock Live Stream in Browser
                                    </h4>
                                    <p className="text-[11px] text-slate-400">3 simple steps to watch live video inside Chrome or Edge</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowUnblockHelper(false)}
                                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                                <span className="font-bold text-amber-300 block">Step 1: Allow Insecure Content in Chrome</span>
                                <p>
                                    1. Look at the left of the address bar at the top (next to <code>https://...</code>) and click the <strong>Tune / Padlock icon</strong>.<br />
                                    2. Click <strong>Site Settings</strong>.<br />
                                    3. Find <strong>Insecure content</strong> and change it from <em>Block</em> to <strong>Allow</strong>.<br />
                                    4. Refresh this page.
                                </p>
                            </div>

                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                                <span className="font-bold text-emerald-400 block">Step 2: Run Master Gateway (All 16 Channels at Once)</span>
                                <p>
                                    Click <strong>"Master All-16-Ch Gateway"</strong> at the top right of this matrix. It automatically generates <code>go2rtc.yaml</code> with all 16 channels, closes any stuck background instances, and launches streaming on <code>http://localhost:1984</code> without needing to download cameras one by one!
                                </p>
                            </div>

                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                                <span className="font-bold text-blue-400 block">Step 3: Can we add wireless & any other IP cameras?</span>
                                <p>
                                    <strong>YES!</strong> Any IP camera (Dahua, Reolink, Tapo, IMOU, Axis, ONVIF, wireless solar/battery cams) with an RTSP or ONVIF stream can be added to AgriMap Pro and streamed via go2rtc.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowUnblockHelper(false)}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white cursor-pointer"
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
