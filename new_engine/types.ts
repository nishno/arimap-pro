/**
 * AgriMap Pro - New Engine Type Definitions
 * /new_engine/types.ts
 */

export type EventTopic = 
  | 'HARVEST_ACTION'
  | 'HARDWARE_EVENT'
  | 'PRESENCE_EVENT'
  | 'SYSTEM_TELEMETRY'
  | 'OUTBOX_EVENT'
  | 'LOG_EVENT'
  | '*';

export type HarvestActionType = 
  | 'ADD_ENTRY'
  | 'UPDATE_WEIGHT'
  | 'DELETE_ENTRY'
  | 'REWEIGH_ENTRY'
  | 'ASSIGN_PICKER'
  | 'UNASSIGN_PICKER'
  | 'UPDATE_EVENT_STATUS';

export interface HarvestActionPayload {
  harvestEventId: string;
  entryId?: string;
  employeeId?: string;
  netWeightKg?: number;
  grossWeightKg?: number;
  tareWeightKg?: number;
  containerType?: string;
  qualityGrade?: string;
  notes?: string;
  timestamp: number;
  authorId?: string;
  metadata?: Record<string, any>;
}

export type HardwareDeviceType = 'GPS' | 'RTSP_CAMERA' | 'SOIL_SENSOR' | 'DRONE' | 'WEATHER_STATION' | 'WEIGH_SCALE' | 'RFID_SCANNER';

export interface HardwareEventPayload {
  deviceId: string;
  deviceType: HardwareDeviceType;
  timestamp: number;
  location?: { lat: number; lng: number; altitude?: number; accuracy?: number };
  telemetry?: {
    weightKg?: number;
    moisturePct?: number;
    tempCelsius?: number;
    batteryLevelPct?: number;
    rtspFrameSnapshotUrl?: string;
    signalStrengthDb?: number;
    rawPayload?: any;
  };
}

export interface DeltaLogEntry {
  id: string;
  sequenceId: number;
  actionType: HarvestActionType | string;
  harvestEventId: string;
  payload: any;
  timestamp: number;
  authorId: string;
  deviceId?: string;
  checksum: string;
  previousChecksum?: string;
}

export interface RehydrationResult<T = any> {
  currentState: T;
  appliedCount: number;
  lastSequenceId: number;
  rehydratedAt: number;
  history: DeltaLogEntry[];
}

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OutboxQueueItem {
  id: string;
  topic: EventTopic;
  actionType: string;
  harvestEventId?: string;
  payload: any;
  timestamp: number;
  authorId: string;
  status: OutboxStatus;
  retryCount: number;
  lastAttemptAt?: number;
  errorMessage?: string;
}

export interface PresenceUser {
  userId: string;
  userName: string;
  role?: string;
  harvestId: string;
  activeView?: string;
  focusedEntryId?: string;
  lastActiveTimestamp: number;
  isOnline: boolean;
  avatarUrl?: string;
  avatar?: string;
  color?: string;
}

export interface EngineSystemMetrics {
  eventQueueLength: number;
  outboxPendingCount: number;
  logsCount: number;
  workerActive: boolean;
  indexedDbHealthy: boolean;
  lastSyncTimestamp?: number;
}
