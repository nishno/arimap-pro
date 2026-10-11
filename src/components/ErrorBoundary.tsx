
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by ErrorBoundary:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public handleClearCacheAndReload = async () => {
    try {
      localStorage.removeItem('agri-planter-temp-boundary');
      localStorage.removeItem('agri-planter-pending-org');
      localStorage.removeItem('agrimap-pending-sync');
      localStorage.removeItem('agri-planter-mode');
      localStorage.removeItem('agrimap_sandbox_hill_spine_profile');
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] w-full bg-slate-50 flex items-center justify-center p-4 rounded-3xl border border-red-100">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-red-100 max-w-lg w-full text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                  {this.props.fallbackTitle || "System Error Detected"}
                </h2>
                <p className="text-slate-500 font-bold text-sm">Something went wrong while rendering this component.</p>
            </div>

            {this.state.error && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Error Details</p>
                    <p className="text-xs font-mono text-red-700 break-words">{this.state.error.message || String(this.state.error)}</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-2xl font-black tracking-wider uppercase text-xs hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Recover View
              </button>
              <button
                onClick={this.handleClearCacheAndReload}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white rounded-2xl font-black tracking-wider uppercase text-xs hover:bg-slate-800 transition-all shadow-md shadow-slate-200 cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reboot App
              </button>
            </div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pt-1">Error Protocol: AIS-EB-500</p>
          </div>
          <style>{`
            .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
            @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
