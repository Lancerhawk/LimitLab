import type {
  SimulationConfig,
  SimulationState,
  TrafficEvent,
  TokenBucketState,
  FixedWindowState,
  SlidingWindowState,
  HistoryPoint,
} from './types';
import { simulateTokenBucket, refillTokenBucket } from './algorithms/tokenBucketSimulator';
import { simulateFixedWindow, getWindowInfo } from './algorithms/fixedWindowSimulator';
import { simulateSlidingWindow, getSlidingWindowInfo } from './algorithms/slidingWindowSimulator';

const HISTORY_INTERVAL_MS = 100;

export interface SimulationSnapshot {
  timeMs: number;
  tokens: number;
  requestCount: number;
  windowStartMs: number;
  totalAccepted: number;
  totalRejected: number;
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  historyVersion: number;
  trafficVersion: number;
}

export type TickCallback = (snapshot: SimulationSnapshot) => void;

export class SimulationEngine {
  private config: SimulationConfig;
  private traffic: TrafficEvent[] = [];
  private simulationTimeMs = 0;
  private lastRealTime: number | null = null;
  private rafId: number | null = null;
  private tickCallbacks: TickCallback[] = [];
  private isRunning = false;
  private isPaused = false;
  private isComplete = false;
  private lastHistoryTimeMs = 0;

  private tbState: TokenBucketState = { tokens: 0, lastRefillTimeMs: 0 };
  private fwState: FixedWindowState = { requestCount: 0, windowStartMs: 0 };
  private swState: SlidingWindowState = { currentWindowCount: 0, currentWindowStartMs: 0, previousWindowCount: 0, previousWindowStartMs: 0 };

  private totalAccepted = 0;
  private totalRejected = 0;
  private history: HistoryPoint[] = [];
  private processedEventIndex = 0;

  private acceptedInCurrentSecond = 0;
  private rejectedInCurrentSecond = 0;
  private incomingInCurrentSecond = 0;
  private currentSecondStart = 0;

  private _historyVersion = 0;
  private _trafficVersion = 0;

  constructor(config: SimulationConfig) {
    this.config = { ...config };
    this.tbState = { tokens: config.capacity, lastRefillTimeMs: 0 };
    this.fwState = { requestCount: 0, windowStartMs: 0 };
    this.swState = { currentWindowCount: 0, currentWindowStartMs: 0, previousWindowCount: 0, previousWindowStartMs: 0 };
  }

  onTick(callback: TickCallback): () => void {
    this.tickCallbacks.push(callback);
    return () => {
      this.tickCallbacks = this.tickCallbacks.filter(cb => cb !== callback);
    };
  }

  private notify() {
    const snapshot = this.getSnapshot();
    for (const cb of this.tickCallbacks) {
      cb(snapshot);
    }
  }

  getSnapshot(): SimulationSnapshot {
    let tokens: number;
    if (this.config.algorithm === 'TOKEN_BUCKET') {
      tokens = this.tbState.tokens;
    } else if (this.config.algorithm === 'SLIDING_WINDOW') {
      const info = getSlidingWindowInfo(this.swState, this.config, this.simulationTimeMs);
      tokens = info.remaining;
    } else {
      tokens = Math.max(0, this.config.requestLimit - this.fwState.requestCount);
    }

    return {
      timeMs: this.simulationTimeMs,
      tokens,
      requestCount: this.fwState.requestCount,
      windowStartMs: this.fwState.windowStartMs,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isComplete: this.isComplete,
      historyVersion: this._historyVersion,
      trafficVersion: this._trafficVersion,
    };
  }

  getState(): SimulationState {
    return {
      timeMs: this.simulationTimeMs,
      tokens: this.config.algorithm === 'TOKEN_BUCKET'
        ? this.tbState.tokens
        : this.config.algorithm === 'SLIDING_WINDOW'
          ? Math.max(0, this.config.requestLimit - (this.swState.currentWindowCount + this.swState.previousWindowCount * Math.max(0, 1 - ((this.simulationTimeMs - (Math.floor(this.simulationTimeMs / this.config.windowDurationMs) * this.config.windowDurationMs)) / this.config.windowDurationMs))))
          : Math.max(0, this.config.requestLimit - this.fwState.requestCount),
      requestCount: this.fwState.requestCount,
      windowStartMs: this.fwState.windowStartMs,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
      history: this.history,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isComplete: this.isComplete,
    };
  }

  getTraffic(): TrafficEvent[] {
    return this.traffic;
  }

  getHistoryVersion(): number {
    return this._historyVersion;
  }

  getTrafficVersion(): number {
    return this._trafficVersion;
  }

  getConfig(): SimulationConfig {
    return { ...this.config };
  }

  setConfig(config: SimulationConfig) {
    this.config = { ...config };
    this.reset();
  }

  setPlaybackSpeed(speed: number) {
    this.config.playbackSpeed = speed;
  }

  setTraffic(events: TrafficEvent[]) {
    this.traffic = events.map(e => ({ ...e, processed: false, decision: null, tokensAtTime: null }));
    this.traffic.sort((a, b) => a.timeMs - b.timeMs);
    this._trafficVersion++;
    if (this.isRunning || this.isPaused) {
      this.reprocessFromStart();
    }
  }

  addTrafficEvent(event: TrafficEvent) {
    this.traffic.push({ ...event, processed: false, decision: null, tokensAtTime: null });
    this.traffic.sort((a, b) => a.timeMs - b.timeMs);
    this._trafficVersion++;
    if (this.isRunning || this.isPaused) {
      this.reprocessFromStart();
    }
  }

  removeTrafficEvent(id: string) {
    this.traffic = this.traffic.filter(e => e.id !== id);
    this._trafficVersion++;
    if (this.isRunning || this.isPaused) {
      this.reprocessFromStart();
    }
  }

  moveTrafficEvent(id: string, newTimeMs: number) {
    const event = this.traffic.find(e => e.id === id);
    if (event) {
      event.timeMs = newTimeMs;
      this.traffic.sort((a, b) => a.timeMs - b.timeMs);
      this._trafficVersion++;
      if (this.isRunning || this.isPaused) {
        this.reprocessFromStart();
      }
    }
  }

  start() {
    if (this.isComplete) this.reset();
    this.isRunning = true;
    this.isPaused = false;
    this.lastRealTime = performance.now();
    this.loop();
  }

  pause() {
    this.isPaused = true;
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.notify();
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.isRunning = true;
    this.lastRealTime = performance.now();
    this.loop();
  }

  reset() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.simulationTimeMs = 0;
    this.lastRealTime = null;
    this.isRunning = false;
    this.isPaused = false;
    this.isComplete = false;
    this.lastHistoryTimeMs = 0;
    this.processedEventIndex = 0;

    this.tbState = { tokens: this.config.capacity, lastRefillTimeMs: 0 };
    this.fwState = { requestCount: 0, windowStartMs: 0 };
    this.swState = { currentWindowCount: 0, currentWindowStartMs: 0, previousWindowCount: 0, previousWindowStartMs: 0 };

    this.totalAccepted = 0;
    this.totalRejected = 0;
    this.history = [];

    this.acceptedInCurrentSecond = 0;
    this.rejectedInCurrentSecond = 0;
    this.incomingInCurrentSecond = 0;
    this.currentSecondStart = 0;

    for (const event of this.traffic) {
      event.processed = false;
      event.decision = null;
      event.tokensAtTime = null;
    }

    this._historyVersion++;
    this._trafficVersion++;
    this.recordHistory();
    this.notify();
  }

  step(stepMs: number = 100) {
    if (this.isComplete) return;

    const targetTime = Math.min(
      this.simulationTimeMs + stepMs,
      this.config.durationMs
    );

    this.advanceTo(targetTime);
    this.isPaused = true;
    this.isRunning = false;

    if (this.simulationTimeMs >= this.config.durationMs) {
      this.isComplete = true;
    }

    this.notify();
  }

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.tickCallbacks = [];
  }

  private loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    const realDelta = this.lastRealTime !== null ? now - this.lastRealTime : 0;
    this.lastRealTime = now;

    const simDelta = realDelta * this.config.playbackSpeed;
    const targetTime = Math.min(
      this.simulationTimeMs + simDelta,
      this.config.durationMs
    );

    this.advanceTo(targetTime);

    if (this.simulationTimeMs >= this.config.durationMs) {
      this.isComplete = true;
      this.isRunning = false;
      this.notify();
      return;
    }

    this.notify();
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private advanceTo(targetTimeMs: number) {
    while (this.processedEventIndex < this.traffic.length) {
      const event = this.traffic[this.processedEventIndex];
      if (event.timeMs > targetTimeMs) break;

      this.simulationTimeMs = event.timeMs;

      if (this.config.algorithm === 'TOKEN_BUCKET') {
        this.tbState = refillTokenBucket(this.tbState, this.config, event.timeMs);
        const result = simulateTokenBucket(this.tbState, this.config, event.timeMs);
        this.tbState = result.newState;
        event.decision = result.decision;
        event.tokensAtTime = result.newState.tokens;
      } else if (this.config.algorithm === 'SLIDING_WINDOW') {
        const result = simulateSlidingWindow(this.swState, this.config, event.timeMs);
        this.swState = result.newState;
        event.decision = result.decision;
        const info = getSlidingWindowInfo(result.newState, this.config, event.timeMs);
        event.tokensAtTime = info.remaining;
      } else {
        const result = simulateFixedWindow(this.fwState, this.config, event.timeMs);
        this.fwState = result.newState;
        event.decision = result.decision;
        event.tokensAtTime = this.config.requestLimit - result.newState.requestCount;
      }

      event.processed = true;

      if (event.decision === 'ALLOW') {
        this.totalAccepted++;
        this.acceptedInCurrentSecond++;
      } else {
        this.totalRejected++;
        this.rejectedInCurrentSecond++;
      }
      this.incomingInCurrentSecond++;

      this.processedEventIndex++;
    }

    if (this.config.algorithm === 'TOKEN_BUCKET') {
      this.tbState = refillTokenBucket(this.tbState, this.config, targetTimeMs);
    }

    if (this.config.algorithm === 'FIXED_WINDOW') {
      const info = getWindowInfo(this.fwState, this.config, targetTimeMs);
      if (info.isNewWindow) {
        this.fwState = {
          requestCount: 0,
          windowStartMs: Math.floor(targetTimeMs / this.config.windowDurationMs) * this.config.windowDurationMs,
        };
      }
    }

    if (this.config.algorithm === 'SLIDING_WINDOW') {
      const info = getSlidingWindowInfo(this.swState, this.config, targetTimeMs);
      if (info.isNewWindow) {
        this.swState = {
          ...this.swState,
          currentWindowCount: 0,
          currentWindowStartMs: Math.floor(targetTimeMs / this.config.windowDurationMs) * this.config.windowDurationMs,
          previousWindowCount: info.previousCount,
          previousWindowStartMs: (Math.floor(targetTimeMs / this.config.windowDurationMs) - 1) * this.config.windowDurationMs,
        };
      }
    }

    this.simulationTimeMs = targetTimeMs;

    const prevHistoryLen = this.history.length;
    while (this.lastHistoryTimeMs + HISTORY_INTERVAL_MS <= targetTimeMs) {
      this.lastHistoryTimeMs += HISTORY_INTERVAL_MS;
      this.recordHistory();
    }
    if (this.history.length !== prevHistoryLen) {
      this._historyVersion++;
    }

    const currentSecond = Math.floor(targetTimeMs / 1000);
    if (currentSecond !== Math.floor(this.currentSecondStart / 1000)) {
      this.acceptedInCurrentSecond = 0;
      this.rejectedInCurrentSecond = 0;
      this.incomingInCurrentSecond = 0;
      this.currentSecondStart = currentSecond * 1000;
    }
  }

  private recordHistory() {
    let tokens: number;
    if (this.config.algorithm === 'TOKEN_BUCKET') {
      tokens = this.tbState.tokens;
    } else if (this.config.algorithm === 'SLIDING_WINDOW') {
      const info = getSlidingWindowInfo(this.swState, this.config, this.lastHistoryTimeMs);
      tokens = info.remaining;
    } else {
      tokens = Math.max(0, this.config.requestLimit - this.fwState.requestCount);
    }

    this.history.push({
      timeMs: this.lastHistoryTimeMs,
      tokens: Math.round(tokens * 100) / 100,
      accepted: this.acceptedInCurrentSecond,
      rejected: this.rejectedInCurrentSecond,
      incomingRate: this.incomingInCurrentSecond,
    });
  }

  private reprocessFromStart() {
    const savedTime = this.simulationTimeMs;
    const wasRunning = this.isRunning;
    const wasPaused = this.isPaused;

    this.simulationTimeMs = 0;
    this.processedEventIndex = 0;
    this.tbState = { tokens: this.config.capacity, lastRefillTimeMs: 0 };
    this.fwState = { requestCount: 0, windowStartMs: 0 };
    this.swState = { currentWindowCount: 0, currentWindowStartMs: 0, previousWindowCount: 0, previousWindowStartMs: 0 };
    this.totalAccepted = 0;
    this.totalRejected = 0;
    this.history = [];
    this.lastHistoryTimeMs = 0;
    this.acceptedInCurrentSecond = 0;
    this.rejectedInCurrentSecond = 0;
    this.incomingInCurrentSecond = 0;
    this.currentSecondStart = 0;

    for (const event of this.traffic) {
      event.processed = false;
      event.decision = null;
      event.tokensAtTime = null;
    }

    this.recordHistory();
    this.advanceTo(savedTime);

    this._historyVersion++;
    this.isRunning = wasRunning;
    this.isPaused = wasPaused;
    this.notify();
  }
}
