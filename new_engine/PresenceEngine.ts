/**
 * AgriMap Pro - Presence & Real-Time Collaboration Engine
 * /new_engine/PresenceEngine.ts
 * Ephemeral presence tracking (/presence/harvestId/userId) with throttled heartbeats
 * and zero-re-render store subscriptions.
 */

import { PresenceUser } from './types';
import { AppEngine } from './AppEventEngine';

export type PresenceListener = (users: PresenceUser[]) => void;

export class PresenceEngine {
  private static instance: PresenceEngine;
  private activeUsersMap: Map<string, Map<string, PresenceUser>> = new Map(); // harvestId -> (userId -> User)
  private presenceSubscribers: Map<string, Set<PresenceListener>> = new Map(); // harvestId -> Listeners
  private heartbeatIntervals: Map<string, number> = new Map();
  private HEARTBEAT_FREQ_MS = 15000; // 15s throttled heartbeat
  private STALE_TIMEOUT_MS = 45000; // 45s offline threshold

  private constructor() {
    // Periodically prune stale presence records off main cycle
    if (typeof globalThis !== 'undefined' && typeof globalThis.setInterval === 'function') {
      setInterval(() => this.pruneStaleUsers(), 20000);
    }
  }

  public static getInstance(): PresenceEngine {
    if (!PresenceEngine.instance) {
      PresenceEngine.instance = new PresenceEngine();
    }
    return PresenceEngine.instance;
  }

  /**
   * Join or update active presence for a specific harvest event
   */
  public announcePresence(
    harvestId: string,
    user: Omit<PresenceUser, 'harvestId' | 'lastActiveTimestamp' | 'isOnline'>
  ): void {
    if (!this.activeUsersMap.has(harvestId)) {
      this.activeUsersMap.set(harvestId, new Map());
    }

    const harvestUsers = this.activeUsersMap.get(harvestId)!;
    const now = Date.now();

    const presenceUser: PresenceUser = {
      ...user,
      harvestId,
      lastActiveTimestamp: now,
      isOnline: true,
    };

    harvestUsers.set(user.userId, presenceUser);

    // Notify local subscribers without re-rendering unrelated UI components
    this.notifySubscribers(harvestId);

    // Emit presence event for event engine listeners
    AppEngine.emit('PRESENCE_EVENT', {
      type: 'USER_JOIN',
      user: presenceUser,
    });

    // Setup or reset throttled heartbeat interval
    const heartbeatKey = `${harvestId}:${user.userId}`;
    if (!this.heartbeatIntervals.has(heartbeatKey)) {
      const timer = (setInterval(() => {
        this.touchPresence(harvestId, user.userId);
      }, this.HEARTBEAT_FREQ_MS) as unknown) as number;
      this.heartbeatIntervals.set(heartbeatKey, timer);
    }
  }

  /**
   * Touch last active timestamp to keep session alive
   */
  public touchPresence(harvestId: string, userId: string, activeView?: string, focusedEntryId?: string): void {
    const harvestUsers = this.activeUsersMap.get(harvestId);
    if (harvestUsers && harvestUsers.has(userId)) {
      const u = harvestUsers.get(userId)!;
      u.lastActiveTimestamp = Date.now();
      u.isOnline = true;
      if (activeView) u.activeView = activeView;
      if (focusedEntryId !== undefined) u.focusedEntryId = focusedEntryId;

      this.notifySubscribers(harvestId);
    }
  }

  /**
   * Explicitly leave presence channel
   */
  public leavePresence(harvestId: string, userId: string): void {
    const harvestUsers = this.activeUsersMap.get(harvestId);
    if (harvestUsers && harvestUsers.has(userId)) {
      const u = harvestUsers.get(userId)!;
      u.isOnline = false;
      harvestUsers.delete(userId);

      const heartbeatKey = `${harvestId}:${userId}`;
      if (this.heartbeatIntervals.has(heartbeatKey)) {
        clearInterval(this.heartbeatIntervals.get(heartbeatKey));
        this.heartbeatIntervals.delete(heartbeatKey);
      }

      this.notifySubscribers(harvestId);

      AppEngine.emit('PRESENCE_EVENT', {
        type: 'USER_LEAVE',
        userId,
        harvestId,
      });
    }
  }

  /**
   * Subscribe to live presence changes for a harvest event
   */
  public subscribePresence(harvestId: string, callback: PresenceListener): { unsubscribe: () => void } {
    if (!this.presenceSubscribers.has(harvestId)) {
      this.presenceSubscribers.set(harvestId, new Set());
    }
    const bucket = this.presenceSubscribers.get(harvestId)!;
    bucket.add(callback);

    // Initial callback invocation
    callback(this.getPresentUsers(harvestId));

    return {
      unsubscribe: () => {
        bucket.delete(callback);
      },
    };
  }

  /**
   * Get active users list for a harvest event
   */
  public getPresentUsers(harvestId: string): PresenceUser[] {
    const harvestUsers = this.activeUsersMap.get(harvestId);
    if (!harvestUsers) return [];
    return Array.from(harvestUsers.values()).filter(u => u.isOnline);
  }

  private pruneStaleUsers(): void {
    const now = Date.now();
    this.activeUsersMap.forEach((users, harvestId) => {
      let changed = false;
      users.forEach((u, userId) => {
        if (now - u.lastActiveTimestamp > this.STALE_TIMEOUT_MS) {
          users.delete(userId);
          changed = true;
          const heartbeatKey = `${harvestId}:${userId}`;
          if (this.heartbeatIntervals.has(heartbeatKey)) {
            clearInterval(this.heartbeatIntervals.get(heartbeatKey));
            this.heartbeatIntervals.delete(heartbeatKey);
          }
        }
      });
      if (changed) {
        this.notifySubscribers(harvestId);
      }
    });
  }

  private notifySubscribers(harvestId: string): void {
    const bucket = this.presenceSubscribers.get(harvestId);
    if (!bucket) return;
    const currentUsers = this.getPresentUsers(harvestId);
    bucket.forEach(cb => {
      try {
        cb(currentUsers);
      } catch (e) {
        console.error('[PresenceEngine] Subscriber error:', e);
      }
    });
  }
}

// Singleton Export
export const Presence = PresenceEngine.getInstance();
