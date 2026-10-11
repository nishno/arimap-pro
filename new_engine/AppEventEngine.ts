/**
 * AgriMap Pro - Central Event-Driven Integration Engine
 * /new_engine/AppEventEngine.ts
 * High-throughput, non-blocking Pub/Sub event bus designed for hardware telemetry,
 * real-time user actions, and field operations.
 */

import { EventTopic, HarvestActionPayload, HardwareEventPayload, EngineSystemMetrics } from './types';

export type EventCallback<T = any> = (payload: T, topic: EventTopic) => void | Promise<void>;

export interface Subscription {
  unsubscribe: () => void;
}

export type EventMiddleware = (topic: EventTopic, payload: any, next: () => void) => void;

export class AppEventEngine {
  private static instance: AppEventEngine;
  private listeners: Map<EventTopic, Set<EventCallback>> = new Map();
  private middlewares: EventMiddleware[] = [];
  private replayBuffer: Array<{ id: string; topic: EventTopic; payload: any; timestamp: number }> = [];
  private maxReplayBufferSize = 200;
  private telemetryMetrics: EngineSystemMetrics = {
    eventQueueLength: 0,
    outboxPendingCount: 0,
    logsCount: 0,
    workerActive: false,
    indexedDbHealthy: true,
  };

  private constructor() {
    // Initialize default listener buckets
    const topics: EventTopic[] = ['HARVEST_ACTION', 'HARDWARE_EVENT', 'PRESENCE_EVENT', 'SYSTEM_TELEMETRY', 'OUTBOX_EVENT', 'LOG_EVENT', '*'];
    topics.forEach(t => this.listeners.set(t, new Set()));
  }

  public static getInstance(): AppEventEngine {
    if (!AppEventEngine.instance) {
      AppEventEngine.instance = new AppEventEngine();
    }
    return AppEventEngine.instance;
  }

  /**
   * Subscribe to a specific event topic or '*' for all events.
   * Returns an object with an `unsubscribe` method.
   */
  public subscribe<T = any>(topic: EventTopic, callback: EventCallback<T>): Subscription {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    const bucket = this.listeners.get(topic)!;
    bucket.add(callback);

    return {
      unsubscribe: () => {
        bucket.delete(callback);
      },
    };
  }

  /**
   * Register middleware that inspects or intercepts all emitted events
   */
  public use(middleware: EventMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Emit an event asynchronously without blocking the UI thread or caller execution.
   */
  public emit<T = any>(topic: EventTopic, payload: T): void {
    const timestamp = Date.now();
    const eventRecord = {
      id: `evt_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
      topic,
      payload,
      timestamp,
    };

    // Store in internal circular replay buffer for diagnostics / state audit
    this.replayBuffer.push(eventRecord);
    if (this.replayBuffer.length > this.maxReplayBufferSize) {
      this.replayBuffer.shift();
    }

    // Execute middlewares sequentially, then notify subscribers asynchronously
    this.runMiddlewares(topic, payload, () => {
      this.dispatchToSubscribers(topic, payload);
    });
  }

  /**
   * Helper shorthand for Harvest Actions
   */
  public emitHarvestAction(actionType: string, harvestEventId: string, payload: Partial<HarvestActionPayload>): void {
    this.emit<HarvestActionPayload>('HARVEST_ACTION', {
      harvestEventId,
      timestamp: Date.now(),
      ...payload,
      metadata: { actionType, ...payload.metadata },
    } as HarvestActionPayload);
  }

  /**
   * Helper shorthand for Hardware Sensor & Stream Telemetry
   */
  public emitHardwareEvent(deviceId: string, deviceType: HardwareEventPayload['deviceType'], telemetry: HardwareEventPayload['telemetry'], location?: HardwareEventPayload['location']): void {
    this.emit<HardwareEventPayload>('HARDWARE_EVENT', {
      deviceId,
      deviceType,
      timestamp: Date.now(),
      telemetry,
      location,
    });
  }

  private runMiddlewares(topic: EventTopic, payload: any, onComplete: () => void): void {
    if (this.middlewares.length === 0) {
      onComplete();
      return;
    }

    let index = 0;
    const next = () => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index++];
        try {
          mw(topic, payload, next);
        } catch (err) {
          console.error('[AppEventEngine] Middleware error:', err);
          next();
        }
      } else {
        onComplete();
      }
    };
    next();
  }

  private dispatchToSubscribers(topic: EventTopic, payload: any): void {
    // Non-blocking asynchronous dispatch using setTimeout / queueMicrotask
    setTimeout(() => {
      const topicBucket = this.listeners.get(topic);
      const wildcardBucket = this.listeners.get('*');

      const callbacks = new Set<EventCallback>([
        ...(topicBucket ? Array.from(topicBucket) : []),
        ...(wildcardBucket ? Array.from(wildcardBucket) : []),
      ]);

      this.telemetryMetrics.eventQueueLength = callbacks.size;

      callbacks.forEach(cb => {
        try {
          const res = cb(payload, topic);
          if (res && typeof res.catch === 'function') {
            res.catch(err => console.error(`[AppEventEngine] Async subscriber error on ${topic}:`, err));
          }
        } catch (err) {
          console.error(`[AppEventEngine] Subscriber error on ${topic}:`, err);
        }
      });
    }, 0);
  }

  /**
   * Retrieve recent event replay buffer
   */
  public getReplayBuffer(): Array<{ id: string; topic: EventTopic; payload: any; timestamp: number }> {
    return [...this.replayBuffer];
  }

  /**
   * Clear all listeners & buffers (Reset)
   */
  public clear(): void {
    this.listeners.forEach(bucket => bucket.clear());
    this.replayBuffer = [];
  }
}

// Singleton Export
export const AppEngine = AppEventEngine.getInstance();
