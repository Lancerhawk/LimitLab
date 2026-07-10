export type AlgorithmType = 'TOKEN_BUCKET' | 'FIXED_WINDOW' | 'SLIDING_WINDOW' | 'SLIDING_LOG' | 'LEAKY_BUCKET';

export interface SimulationConfig {
  algorithm: AlgorithmType;
  capacity: number;
  refillRate: number;
  windowDurationMs: number;
  requestLimit: number;
  durationMs: number;
  playbackSpeed: number;
}

export interface TrafficEvent {
  id: string;
  timeMs: number;
  processed: boolean;
  decision: 'ALLOW' | 'DENY' | null;
  tokensAtTime: number | null;
}

export interface TokenBucketState {
  tokens: number;
  lastRefillTimeMs: number;
}

export interface FixedWindowState {
  requestCount: number;
  windowStartMs: number;
}

export interface SlidingWindowState {
  currentWindowCount: number;
  currentWindowStartMs: number;
  previousWindowCount: number;
  previousWindowStartMs: number;
}

export interface SlidingLogState {
  timestamps: number[];
}

export interface LeakyBucketState {
  queueLength: number;
  lastLeakTimeMs: number;
}

export interface HistoryPoint {
  timeMs: number;
  tokens: number;
  accepted: number;
  rejected: number;
  incomingRate: number;
}

export interface SimulationState {
  timeMs: number;
  tokens: number;
  requestCount: number;
  windowStartMs: number;
  totalAccepted: number;
  totalRejected: number;
  history: HistoryPoint[];
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  slidingLogTimestamps?: number[];
  queueLength?: number;
}

export interface SimulationStats {
  totalRequests: number;
  accepted: number;
  rejected: number;
  acceptancePercent: number;
  averageTokens: number;
  lowestTokens: number;
  peakThroughput: number;
  longestEmptyDurationMs: number;
  largestBurst: number;
  refillCount: number;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  algorithm: 'TOKEN_BUCKET',
  capacity: 10,
  refillRate: 1,
  windowDurationMs: 10000,
  requestLimit: 10,
  durationMs: 30000,
  playbackSpeed: 1,
};

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 5, 10];

export const STEP_SIZE_MS = 100;
