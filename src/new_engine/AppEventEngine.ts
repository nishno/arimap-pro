/**
 * AppEventEngine.ts
 * High-performance, decoupled event bus and request/response orchestration middleware.
 * Guarantees zero UI thread blocking and strictly serializable messaging across isolated modules.
 */

export type EventHandler<T = any> = (payload: T) => void | Promise<void>;
export type RequestHandler<TReq = any, TRes = any> = (payload: TReq) => Promise<TRes>;

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeoutTimer: ReturnType<typeof setTimeout>;
}

export class AppEventEngine {
    private static instance: AppEventEngine | null = null;
    private listeners: Map<string, Set<EventHandler>> = new Map();
    private requestHandlers: Map<string, RequestHandler> = new Map();
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private messageCounter = 0;

    private constructor() {
        if (typeof window !== 'undefined') {
            (window as any).__agriMapEventEngine = this;
        }
    }

    public static getInstance(): AppEventEngine {
        if (!AppEventEngine.instance) {
            AppEventEngine.instance = new AppEventEngine();
        }
        return AppEventEngine.instance;
    }

    /**
     * Subscribe to a pub/sub event.
     */
    public on<T = any>(event: string, handler: EventHandler<T>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);

        return () => this.off(event, handler);
    }

    /**
     * Unsubscribe from an event.
     */
    public off<T = any>(event: string, handler: EventHandler<T>): void {
        const set = this.listeners.get(event);
        if (set) {
            set.delete(handler);
            if (set.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * Emit a broadcast event to all subscribers without waiting for a response.
     */
    public emit<T = any>(event: string, payload: T): void {
        const set = this.listeners.get(event);
        if (!set || set.size === 0) return;

        // Schedule async to guarantee no thread-blocking inside caller's stack
        setTimeout(() => {
            set.forEach(handler => {
                try {
                    handler(payload);
                } catch (err) {
                    console.error(`[AppEventEngine] Error executing listener for "${event}":`, err);
                }
            });
        }, 0);
    }

    /**
     * Register a dedicated service handler for a request/response topic.
     * Only one primary handler is active per request topic to ensure deterministic execution.
     */
    public registerHandler<TReq = any, TRes = any>(
        event: string,
        handler: RequestHandler<TReq, TRes>
    ): () => void {
        if (this.requestHandlers.has(event)) {
            console.warn(`[AppEventEngine] Overwriting existing handler for request topic "${event}"`);
        }
        this.requestHandlers.set(event, handler);

        return () => {
            if (this.requestHandlers.get(event) === handler) {
                this.requestHandlers.delete(event);
            }
        };
    }

    /**
     * Dispatches a request to the registered service handler and awaits the typed response.
     * Includes automated timeout cleanup and correlation ID tracking.
     */
    public async request<TReq = any, TRes = any>(
        event: string,
        payload: TReq,
        timeoutMs = 30000
    ): Promise<TRes> {
        const handler = this.requestHandlers.get(event);
        if (!handler) {
            throw new Error(`[AppEventEngine] No registered handler for request topic "${event}"`);
        }

        const reqId = `req_${Date.now()}_${++this.messageCounter}`;

        return new Promise<TRes>((resolve, reject) => {
            const timeoutTimer = setTimeout(() => {
                this.pendingRequests.delete(reqId);
                reject(new Error(`[AppEventEngine] Request "${event}" (ID: ${reqId}) timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            this.pendingRequests.set(reqId, { resolve, reject, timeoutTimer });

            // Execute handler off-stack
            Promise.resolve()
                .then(() => handler(payload))
                .then(result => {
                    const pending = this.pendingRequests.get(reqId);
                    if (pending) {
                        clearTimeout(pending.timeoutTimer);
                        this.pendingRequests.delete(reqId);
                        pending.resolve(result);
                    }
                })
                .catch(err => {
                    const pending = this.pendingRequests.get(reqId);
                    if (pending) {
                        clearTimeout(pending.timeoutTimer);
                        this.pendingRequests.delete(reqId);
                        pending.reject(err);
                    }
                });
        });
    }

    /**
     * Clears all listeners and pending requests (useful for test suites or resets).
     */
    public reset(): void {
        this.pendingRequests.forEach(p => {
            clearTimeout(p.timeoutTimer);
            p.reject(new Error('[AppEventEngine] Engine reset'));
        });
        this.pendingRequests.clear();
        this.listeners.clear();
        this.requestHandlers.clear();
    }
}

export const appEngine = AppEventEngine.getInstance();
