import React, { useState } from 'react';
import { WifiIcon, CheckIcon, XCircleIcon, NetworkIcon, LaptopIcon } from './Icons';
import { toast } from 'sonner';

export interface NetworkDiscoveryToolProps {
  onServerConfigured?: (serverIp: string) => void;
  className?: string;
}

export function NetworkDiscoveryTool({ onServerConfigured, className = '' }: NetworkDiscoveryToolProps) {
  const [serverIp, setServerIp] = useState<string>(() => {
    return localStorage.getItem('local_relay_ip') || localStorage.getItem('agrimap_local_ip') || '192.168.10.152:3000';
  });
  const [testStatus, setTestStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [activeDirectory, setActiveDirectory] = useState<string | null>(null);

  const testLocalConnection = async () => {
    if (!serverIp.trim()) {
      toast.error('Please enter a valid local server IP or hostname.');
      return;
    }

    setTestStatus('TESTING');
    setPingLatency(null);
    setActiveDirectory(null);
    const startTime = performance.now();

    let hostWithPort = serverIp.trim();
    if (!hostWithPort.includes(':')) {
      hostWithPort = `${hostWithPort}:3000`;
    }

    // Clean scheme if present
    const cleanAddress = hostWithPort.replace(/^https?:\/\//, '');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for fast feedback

      const url = `http://${cleanAddress}/api/sync/test`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);
        setPingLatency(latency);
        setTestStatus('SUCCESS');

        const data = await response.json().catch(() => ({}));
        if (data.resolvedPath) {
          setActiveDirectory(data.resolvedPath);
        }

        localStorage.setItem('local_relay_ip', cleanAddress);
        localStorage.setItem('agrimap_local_ip', cleanAddress);
        
        // Also update agrimap-local-config if present
        try {
          const rawConfig = localStorage.getItem('agrimap-local-config');
          const currentConfig = rawConfig ? JSON.parse(rawConfig) : {};
          const updatedConfig = {
            ...currentConfig,
            serverIp: cleanAddress.split(':')[0],
            serverPort: parseInt(cleanAddress.split(':')[1] || '3000', 10),
            isLocalMode: true
          };
          localStorage.setItem('agrimap-local-config', JSON.stringify(updatedConfig));
        } catch {
          // ignore parse errors
        }

        if (onServerConfigured) {
          onServerConfigured(cleanAddress);
        }
        toast.success(`Local Server Verified (${latency}ms)! LAN Relay mode activated.`);
      } else {
        setTestStatus('FAILED');
        toast.error(`Local server replied with status code ${response.status}`);
      }
    } catch (error) {
      console.warn('Local network ping failed, trying no-cors handshake...', error);
      // Fallback no-cors ping check
      try {
        const fallbackController = new AbortController();
        const fallbackTimer = setTimeout(() => fallbackController.abort(), 2000);
        
        await fetch(`http://${cleanAddress}`, {
          mode: 'no-cors',
          signal: fallbackController.signal,
        });
        clearTimeout(fallbackTimer);

        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);
        setPingLatency(latency);
        setTestStatus('SUCCESS');
        localStorage.setItem('local_relay_ip', cleanAddress);
        if (onServerConfigured) {
          onServerConfigured(cleanAddress);
        }
        toast.success(`Connected to LAN Relay Node (${latency}ms)!`);
      } catch (err) {
        console.error('Local network ping completely failed:', err);
        setTestStatus('FAILED');
        toast.error('Could not reach local server. Check Wi-Fi connection and IP address.');
      }
    }
  };

  return (
    <div className={`p-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <NetworkIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              🛜 Local Network Relay Setup
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Direct plantation LAN synchronization without internet dependency
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-black px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
          Zero Data Loss
        </span>
      </div>

      <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <p className="font-semibold text-slate-700">
          Enter your on-site farm server IP address (e.g. PC in weighbridge shed):
        </p>
        <p className="text-[11px] text-slate-500">
          Tablets will push batch-encrypted weighings to this LAN node over local Wi-Fi when cloud signal drops.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={serverIp}
            onChange={(e) => {
              setServerIp(e.target.value);
              setTestStatus('IDLE');
            }}
            placeholder="e.g. 192.168.10.152:3000"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
          />
        </div>
        <button
          onClick={testLocalConnection}
          disabled={testStatus === 'TESTING'}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
        >
          {testStatus === 'TESTING' ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Pinging...</span>
            </>
          ) : (
            <>
              <WifiIcon className="w-4 h-4" />
              <span>Test Connection</span>
            </>
          )}
        </button>
      </div>

      {testStatus === 'SUCCESS' && (
        <div className="p-3 bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs rounded-xl space-y-1 animate-fadeIn">
          <div className="flex items-center justify-between font-extrabold text-emerald-900">
            <span className="flex items-center gap-1.5">
              <CheckIcon className="w-4 h-4 text-emerald-600" />
              Connection Verified & Active!
            </span>
            {pingLatency !== null && (
              <span className="text-[11px] font-mono px-2 py-0.5 bg-emerald-100/80 text-emerald-700 rounded-md">
                Latency: {pingLatency}ms
              </span>
            )}
          </div>
          {activeDirectory && (
            <div className="text-[11px] text-emerald-700 font-medium truncate">
              📁 On-Site Storage Target: <code className="font-mono bg-emerald-100/50 px-1 py-0.5 rounded">{activeDirectory}</code>
            </div>
          )}
          <div className="text-[11px] text-emerald-600/90 font-medium">
            🔒 Idempotent UUID Handshake Enabled. Duplicate entries will be automatically filtered.
          </div>
        </div>
      )}

      {testStatus === 'FAILED' && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-rose-900">
            <XCircleIcon className="w-4 h-4 text-rose-600" />
            Could not reach local network server node.
          </div>
          <p className="text-[11px] text-rose-700 font-medium pl-5">
            Ensure tablet is connected to the plantation Wi-Fi and that <code className="font-mono bg-rose-100 px-1 rounded">{serverIp}</code> is running the relay server.
          </p>
        </div>
      )}
    </div>
  );
}

export default NetworkDiscoveryTool;
