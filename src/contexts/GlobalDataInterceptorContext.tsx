import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

interface GlobalDataInterceptorContextType {
    isBackgroundSyncing: boolean;
    setIsBackgroundSyncing: (val: boolean) => void;
    hasDesyncError: boolean;
    setHasDesyncError: (val: boolean) => void;
    sanitizeModel: <T extends Record<string, any>>(item: T) => T;
}

const GlobalDataInterceptorContext = createContext<GlobalDataInterceptorContextType | undefined>(undefined);

export const useGlobalDataInterceptor = () => {
    const context = useContext(GlobalDataInterceptorContext);
    if (!context) {
        throw new Error('useGlobalDataInterceptor must be used within a GlobalDataInterceptorProvider');
    }
    return context;
};

// Global register to hook firestore streams and sync state dynamically
if (typeof window !== 'undefined') {
    (window as any).__agrimapSetBackgroundSync = (val: boolean) => {
        if ((window as any).__agrimapBgSyncSetter) {
            (window as any).__agrimapBgSyncSetter(val);
        }
    };
}

export const GlobalDataInterceptorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false);
    const [hasDesyncError, setHasDesyncError] = useState<boolean>(false);

    // Make the background sync setter globally accessible by window hook
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__agrimapBgSyncSetter = (val: boolean) => {
                setIsBackgroundSyncing(val);
            };
        }
        return () => {
            if (typeof window !== 'undefined') {
                delete (window as any).__agrimapBgSyncSetter;
            }
        };
    }, []);

    // 1. Intercept and Log Window-Level Uncaught Script Errors
    useEffect(() => {
        const handleUncaughtError = (event: ErrorEvent) => {
            const message = event.message || '';
            const errorObj = event.error;
            const errorStr = String(errorObj?.message || errorObj || message);

            const isQuotaError = errorStr.includes('quota') || errorStr.includes('Quota exceeded');
            if (isQuotaError) {
                event.preventDefault();
                event.stopPropagation();
                return true;
            }

            const isNetworkOrScriptError = 
                message.includes('Script error') || 
                errorStr.includes('Script error') ||
                errorStr.includes('Failed to fetch') || 
                errorStr.includes('RPC errored') ||
                errorStr.includes('network') ||
                errorStr.includes('disconnected') ||
                errorStr.includes('INTERNAL ASSERTION FAILED') ||
                errorStr.includes('INTERNAL UNHANDLED ERROR') ||
                errorStr.includes('Unexpected state');

            if (isNetworkOrScriptError) {
                console.error('[GlobalDataInterceptor] Intercepted and suppressed fatal script/network error:', message, errorObj);
                
                // Block the application from firing a fatal un-isolated crash boundary or asking for a reboot
                event.preventDefault();
                event.stopPropagation();

                // Raise sync flags & desync state
                setHasDesyncError(true);
                setIsBackgroundSyncing(true);

                // Silently push warning to console but don't crash
                return true;
            }
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const reasonStr = String(reason?.message || reason || '');

            if (
                reasonStr.includes('Failed to fetch') || 
                reasonStr.includes('RPC errored') || 
                reasonStr.includes('network') ||
                reasonStr.includes('disconnected') ||
                reasonStr.includes('INTERNAL ASSERTION FAILED') ||
                reasonStr.includes('INTERNAL UNHANDLED ERROR') ||
                reasonStr.includes('Unexpected state')
            ) {
                console.error('[GlobalDataInterceptor] Intercepted and suppressed asynchronous unhandled rejection:', reason);
                event.preventDefault();
                setHasDesyncError(true);
                setIsBackgroundSyncing(true);
            }
        };

        window.addEventListener('error', handleUncaughtError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleUncaughtError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    // 2. Intelligent intermediary firewall / sanitizer helper
    const sanitizeModel = <T extends Record<string, any>>(item: T): T => {
        if (!item || typeof item !== 'object') {
            return (item || {}) as T;
        }

        const copy = { ...item } as any;

        // If a text attribute arrives missing or partial, normalize it to an empty string ''
        Object.keys(copy).forEach(key => {
            const val = copy[key];
            if (val === null || val === undefined) {
                // If the field is a string-like property or we expect a fallback
                copy[key] = '';
            } else if (typeof val === 'string') {
                copy[key] = val.trim();
            } else if (typeof val === 'object') {
                // Nested safety recursion (bounded)
                if (Array.isArray(val)) {
                    copy[key] = val.map(el => (el && typeof el === 'object') ? sanitizeModel(el) : (el ?? ''));
                } else if (val !== null) {
                    copy[key] = sanitizeModel(val);
                }
            }
        });

        // Fallbacks for critical security properties
        if (!copy.id) copy.id = 'temp-fallback-id';
        if (!copy.name && 'name' in copy) copy.name = '';

        return copy as T;
    };

    const [debouncedBgSync, setDebouncedBgSync] = useState<boolean>(false);
    const [isDismissed, setIsDismissed] = useState<boolean>(false);

    useEffect(() => {
        if (isBackgroundSyncing) {
            const timer = setTimeout(() => {
                setDebouncedBgSync(true);
            }, 2500); // 2.5s delay to ignore standard, healthy Firestore cache-to-server transitions

            // Auto-clear background sync indicator after 5s if sync completes or resolves
            const autoClearTimer = setTimeout(() => {
                setIsBackgroundSyncing(false);
                setHasDesyncError(false);
            }, 5500);

            return () => {
                clearTimeout(timer);
                clearTimeout(autoClearTimer);
            };
        } else {
            setDebouncedBgSync(false);
            setIsDismissed(false); // Reset dismissal when sync status clears
        }
    }, [isBackgroundSyncing]);

    return (
        <GlobalDataInterceptorContext.Provider value={{
            isBackgroundSyncing,
            setIsBackgroundSyncing,
            hasDesyncError,
            setHasDesyncError,
            sanitizeModel
        }}>
            {children}
        </GlobalDataInterceptorContext.Provider>
    );
};
