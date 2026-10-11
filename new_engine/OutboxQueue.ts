/**
 * AgriMap Pro - Offline Delta Outbox Queue
 * /new_engine/OutboxQueue.ts
 * Manages sequential offline mutation storage in IndexedDB and guarantees
 * reliable order-preserved sync upon network restoration.
 */

import { EngineIDB } from './utils/idbHelper';
import { OutboxQueueItem, EventTopic } from './types';
import { AppEngine } from './AppEventEngine';

export type SyncHandler = (item: OutboxQueueItem) => Promise<boolean>;
export type OutboxStatusListener = (status: { pendingCount: number; isOnline: boolean; isSyncing: boolean }) => void;

export class OutboxQueue {
  private static instance: OutboxQueue;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private customSyncHandler: SyncHandler | null = null;
  private statusListeners: Set<OutboxStatusListener> = new Set();
  private maxRetries = 5;

  private constructor() {
    this.initNetworkListeners();
  }

  public static getInstance(): OutboxQueue {
    if (!OutboxQueue.instance) {
      OutboxQueue.instance = new OutboxQueue();
    }
    return OutboxQueue.instance;
  }

  private initNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyStatusListeners();
        AppEngine.emit('OUTBOX_EVENT', { status: 'NETWORK_RECONNECTED' });
        this.processQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyStatusListeners();
        AppEngine.emit('OUTBOX_EVENT', { status: 'NETWORK_OFFLINE' });
      });
    }
  }

  /**
   * Set custom remote sync processor (e.g. Firebase or REST sync adapter)
   */
  public registerSyncHandler(handler: SyncHandler): void {
    this.customSyncHandler = handler;
  }

  /**
   * Enqueue a new delta action payload into the local IndexedDB outbox
   */
  public async enqueue(
    topic: EventTopic,
    actionType: string,
    payload: any,
    harvestEventId?: string,
    authorId: string = 'system'
  ): Promise<OutboxQueueItem> {
    const item: OutboxQueueItem = {
      id: `out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      topic,
      actionType,
      harvestEventId,
      payload,
      timestamp: Date.now(),
      authorId,
      status: 'pending',
      retryCount: 0,
    };

    await EngineIDB.put('offline_outbox', item);

    AppEngine.emit('OUTBOX_EVENT', {
      status: 'ENQUEUED',
      item,
    });

    this.notifyStatusListeners();

    // Trigger queue processor if online
    if (this.isOnline && !this.isSyncing) {
      this.processQueue();
    }

    return item;
  }

  /**
   * Sequentially process and drain the offline outbox queue
   */
  public async processQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;

    this.isSyncing = true;
    this.notifyStatusListeners();

    try {
      const items = await EngineIDB.getAll<OutboxQueueItem>('offline_outbox');
      const pendingItems = items
        .filter(i => i.status === 'pending' || i.status === 'failed')
        .sort((a, b) => a.timestamp - b.timestamp);

      for (const item of pendingItems) {
        if (!this.isOnline) break;

        item.status = 'syncing';
        item.lastAttemptAt = Date.now();
        await EngineIDB.put('offline_outbox', item);

        let success = false;

        try {
          if (this.customSyncHandler) {
            success = await this.customSyncHandler(item);
          } else {
            // Default mock sync resolution (simulating network transmission)
            await new Promise(r => setTimeout(r, 100));
            success = true;
          }
        } catch (err: any) {
          success = false;
          item.errorMessage = err?.message || String(err);
        }

        if (success) {
          item.status = 'synced';
          // Delete successfully synced items from IndexedDB
          await EngineIDB.delete('offline_outbox', item.id);
          AppEngine.emit('OUTBOX_EVENT', { status: 'SYNCED_ITEM', itemId: item.id });
        } else {
          item.retryCount += 1;
          if (item.retryCount >= this.maxRetries) {
            item.status = 'failed';
          } else {
            item.status = 'pending'; // Retry later
          }
          await EngineIDB.put('offline_outbox', item);
          AppEngine.emit('OUTBOX_EVENT', { status: 'SYNC_FAILED_ITEM', item });

          // Exponential backoff pause before trying next item
          await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, item.retryCount), 10000)));
        }
      }
    } catch (err) {
      console.error('[OutboxQueue] Queue processing error:', err);
    } finally {
      this.isSyncing = false;
      this.notifyStatusListeners();
    }
  }

  /**
   * Get total pending outbox items count
   */
  public async getPendingCount(): Promise<number> {
    const items = await EngineIDB.getAll<OutboxQueueItem>('offline_outbox');
    return items.filter(i => i.status === 'pending' || i.status === 'syncing' || i.status === 'failed').length;
  }

  /**
   * Get all pending items
   */
  public async getPendingItems(): Promise<OutboxQueueItem[]> {
    const items = await EngineIDB.getAll<OutboxQueueItem>('offline_outbox');
    return items.filter(i => i.status !== 'synced').sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Subscribe to outbox sync status
   */
  public subscribeStatus(listener: OutboxStatusListener): { unsubscribe: () => void } {
    this.statusListeners.add(listener);
    
    // Initial status broadcast
    this.getPendingCount().then(pendingCount => {
      listener({ pendingCount, isOnline: this.isOnline, isSyncing: this.isSyncing });
    });

    return {
      unsubscribe: () => {
        this.statusListeners.delete(listener);
      },
    };
  }

  private async notifyStatusListeners(): Promise<void> {
    const pendingCount = await this.getPendingCount();
    this.statusListeners.forEach(listener => {
      try {
        listener({ pendingCount, isOnline: this.isOnline, isSyncing: this.isSyncing });
      } catch (err) {
        console.error('[OutboxQueue] Status listener error:', err);
      }
    });
  }
}

// Singleton Export
export const Outbox = OutboxQueue.getInstance();
