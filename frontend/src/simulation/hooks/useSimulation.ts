import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SimulationEngine, type SimulationSnapshot } from '../simulationEngine';
import type { SimulationConfig, SimulationState, SimulationStats, TrafficEvent, HistoryPoint } from '../types';
import { computeStats } from '../statistics';
import { DEFAULT_CONFIG } from '../types';


interface FastState {
  timeMs: number;
  tokens: number;
  totalAccepted: number;
  totalRejected: number;
  requestCount: number;
  windowStartMs: number;
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
}


interface SlowState {
  history: HistoryPoint[];
  stats: SimulationStats;
  traffic: TrafficEvent[];
}

const EMPTY_STATS: SimulationStats = {
  totalRequests: 0,
  accepted: 0,
  rejected: 0,
  acceptancePercent: 0,
  averageTokens: 0,
  lowestTokens: 0,
  peakThroughput: 0,
  longestEmptyDurationMs: 0,
  largestBurst: 0,
  refillCount: 0,
};

export function useSimulation(initialConfig: SimulationConfig = DEFAULT_CONFIG) {
  const [config, setConfig] = useState<SimulationConfig>(initialConfig);
  const engineRef = useRef<SimulationEngine | null>(null);

  const [fast, setFast] = useState<FastState>({
    timeMs: 0,
    tokens: initialConfig.capacity,
    totalAccepted: 0,
    totalRejected: 0,
    requestCount: 0,
    windowStartMs: 0,
    isRunning: false,
    isPaused: false,
    isComplete: false,
  });

  const [slow, setSlow] = useState<SlowState>({
    history: [],
    stats: EMPTY_STATS,
    traffic: [],
  });

  const lastHistoryVersionRef = useRef(0);
  const lastTrafficVersionRef = useRef(0);

  const pendingSnapshotRef = useRef<SimulationSnapshot | null>(null);
  const rafUpdateRef = useRef<number | null>(null);

  useEffect(() => {
    const engine = new SimulationEngine(config);
    engineRef.current = engine;

    const cleanupTick = engine.onTick((snapshot: SimulationSnapshot) => {
      pendingSnapshotRef.current = snapshot;

      if (!snapshot.isRunning) {
        flushUpdate(engine, snapshot);
        return;
      }

      if (rafUpdateRef.current === null) {
        rafUpdateRef.current = requestAnimationFrame(() => {
          rafUpdateRef.current = null;
          const latest = pendingSnapshotRef.current;
          if (latest) {
            flushUpdate(engine, latest);
          }
        });
      }
    });

    const initSnapshot = engine.getSnapshot();
    flushUpdate(engine, initSnapshot);

    return () => {
      cleanupTick();
      engine.destroy();
      if (rafUpdateRef.current !== null) {
        cancelAnimationFrame(rafUpdateRef.current);
      }
    };
  }, []);

  function flushUpdate(engine: SimulationEngine, snapshot: SimulationSnapshot) {
    setFast({
      timeMs: snapshot.timeMs,
      tokens: snapshot.tokens,
      totalAccepted: snapshot.totalAccepted,
      totalRejected: snapshot.totalRejected,
      requestCount: snapshot.requestCount,
      windowStartMs: snapshot.windowStartMs,
      isRunning: snapshot.isRunning,
      isPaused: snapshot.isPaused,
      isComplete: snapshot.isComplete,
    });

    const historyChanged = snapshot.historyVersion !== lastHistoryVersionRef.current;
    const trafficChanged = snapshot.trafficVersion !== lastTrafficVersionRef.current;

    if (historyChanged || trafficChanged || !snapshot.isRunning) {
      lastHistoryVersionRef.current = snapshot.historyVersion;
      lastTrafficVersionRef.current = snapshot.trafficVersion;

      const history = [...engine.getState().history];
      const traffic = engine.getTraffic();

      setSlow({
        history,
        stats: computeStats(history, traffic),
        traffic: [...traffic],
      });
    }
  }

  const updateConfig = useCallback((newConfig: Partial<SimulationConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      if (engineRef.current) {
        engineRef.current.setConfig(updated);
      }
      return updated;
    });
  }, []);

  const setTrafficEvents = useCallback((events: TrafficEvent[]) => {
    if (engineRef.current) {
      engineRef.current.setTraffic(events);
      const traffic = engineRef.current.getTraffic();
      const history = engineRef.current.getState().history;
      setSlow({
        history,
        stats: computeStats(history, traffic),
        traffic: [...traffic],
      });
    }
  }, []);

  const addTrafficEvent = useCallback((event: TrafficEvent) => {
    if (engineRef.current) {
      engineRef.current.addTrafficEvent(event);
      const traffic = engineRef.current.getTraffic();
      const history = engineRef.current.getState().history;
      setSlow({
        history,
        stats: computeStats(history, traffic),
        traffic: [...traffic],
      });
    }
  }, []);

  const removeTrafficEvent = useCallback((id: string) => {
    if (engineRef.current) {
      engineRef.current.removeTrafficEvent(id);
      const traffic = engineRef.current.getTraffic();
      const history = engineRef.current.getState().history;
      setSlow({
        history,
        stats: computeStats(history, traffic),
        traffic: [...traffic],
      });
    }
  }, []);

  const moveTrafficEvent = useCallback((id: string, newTimeMs: number) => {
    if (engineRef.current) {
      engineRef.current.moveTrafficEvent(id, newTimeMs);
      const traffic = engineRef.current.getTraffic();
      const history = engineRef.current.getState().history;
      setSlow({
        history,
        stats: computeStats(history, traffic),
        traffic: [...traffic],
      });
    }
  }, []);

  const start = useCallback(() => engineRef.current?.start(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const resume = useCallback(() => engineRef.current?.resume(), []);
  const reset = useCallback(() => engineRef.current?.reset(), []);
  const step = useCallback((stepMs?: number) => engineRef.current?.step(stepMs), []);
  const setPlaybackSpeed = useCallback((speed: number) => {
    if (engineRef.current) {
      engineRef.current.setPlaybackSpeed(speed);
    }
  }, []);

  const state: SimulationState = useMemo(() => ({
    timeMs: fast.timeMs,
    tokens: fast.tokens,
    requestCount: fast.requestCount,
    windowStartMs: fast.windowStartMs,
    totalAccepted: fast.totalAccepted,
    totalRejected: fast.totalRejected,
    history: slow.history,
    isRunning: fast.isRunning,
    isPaused: fast.isPaused,
    isComplete: fast.isComplete,
  }), [fast, slow.history]);

  return {
    config,
    state,
    stats: slow.stats,
    traffic: slow.traffic,
    updateConfig,
    setTraffic: setTrafficEvents,
    addTrafficEvent,
    removeTrafficEvent,
    moveTrafficEvent,
    start,
    pause,
    resume,
    reset,
    step,
    setPlaybackSpeed,
  };
}
