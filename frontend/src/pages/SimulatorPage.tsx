import { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { useSimulation } from '../simulation/hooks/useSimulation';
import { SimulatorControls } from '../simulation/components/SimulatorControls';
import { SimulatorTimeline } from '../simulation/components/SimulatorTimeline';
import { BucketVisualizer } from '../simulation/components/BucketVisualizer';
import { SlidingWindowVisualizer } from '../simulation/components/SlidingWindowVisualizer';
import { LeakyBucketVisualizer } from '../simulation/components/LeakyBucketVisualizer';
import { SimulatorCharts } from '../simulation/components/SimulatorCharts';
import { SimulatorStats } from '../simulation/components/SimulatorStats';
import { BarChart3 } from 'lucide-react';
import type { AlgorithmType } from '../simulation/types';

const ALGO_LABELS: Record<AlgorithmType, string> = {
  TOKEN_BUCKET: 'Token Bucket',
  FIXED_WINDOW: 'Fixed Window',
  SLIDING_WINDOW: 'Sliding Window',
  SLIDING_LOG: 'Sliding Log',
  LEAKY_BUCKET: 'Leaky Bucket',
};

const ALGO_COLORS: Record<AlgorithmType, string> = {
  TOKEN_BUCKET: 'border-blue-500/40',
  FIXED_WINDOW: 'border-amber-500/40',
  SLIDING_WINDOW: 'border-purple-500/40',
  SLIDING_LOG: 'border-teal-500/40',
  LEAKY_BUCKET: 'border-orange-500/40',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AlgorithmConfiguration = ({ config, updateConfig, disabled }: { config: any, updateConfig: any, disabled: boolean }) => {
  if (config.algorithm === 'TOKEN_BUCKET') {
    return (
      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-foreground">Capacity</label>
          <input type="number" min="1" value={config.capacity} onChange={(e) => updateConfig({ capacity: Number(e.target.value) })} disabled={disabled} className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-foreground">Refill /sec</label>
          <input type="number" min="0.1" step="0.1" value={config.refillRate} onChange={(e) => updateConfig({ refillRate: Number(e.target.value) })} disabled={disabled} className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
      </div>
    );
  }
  if (config.algorithm === 'LEAKY_BUCKET') {
    return (
      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-foreground">Queue Capacity</label>
          <input type="number" min="1" value={config.capacity} onChange={(e) => updateConfig({ capacity: Number(e.target.value) })} disabled={disabled} className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-foreground">Leak Rate /sec</label>
          <input type="number" min="0.1" step="0.1" value={config.refillRate} onChange={(e) => updateConfig({ refillRate: Number(e.target.value) })} disabled={disabled} className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row gap-4 mt-4">
      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-foreground">Request Limit</label>
        <input type="number" min="1" value={config.requestLimit} onChange={(e) => updateConfig({ requestLimit: Number(e.target.value) })} disabled={disabled} className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50" />
      </div>
      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-foreground">Window Size (s)</label>
        <input type="number" min="1" value={config.windowDurationMs / 1000} onChange={(e) => updateConfig({ windowDurationMs: Number(e.target.value) * 1000 })} disabled={disabled} className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50" />
      </div>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AlgoVisualizer = ({ config, state }: { config: any; state: any }) => {
  if (config.algorithm === 'SLIDING_WINDOW' || config.algorithm === 'SLIDING_LOG') {
    return <SlidingWindowVisualizer config={config} state={state} />;
  }
  if (config.algorithm === 'LEAKY_BUCKET') {
    return <LeakyBucketVisualizer config={config} state={state} />;
  }
  return <BucketVisualizer config={config} state={state} />;
};

export const SimulatorPage = () => {
  const [comparisonMode, setComparisonMode] = useState(false);
  const [algo2, setAlgo2] = useState<AlgorithmType>('FIXED_WINDOW');

  const sim1 = useSimulation();
  const sim2 = useSimulation({
    algorithm: 'FIXED_WINDOW',
    capacity: 10,
    refillRate: 1,
    windowDurationMs: 10000,
    requestLimit: 10,
    durationMs: 30000,
    playbackSpeed: 1,
  });

  // Sync sim2 algorithm when user picks a new comparison target
  useEffect(() => {
    if (comparisonMode) {
      sim2.updateConfig({ algorithm: algo2 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonMode, algo2]);

  useEffect(() => {
    sim1.setPlaybackSpeed(1);
    if (comparisonMode) {
      sim2.setPlaybackSpeed(1);
      sim1.reset();
      sim2.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonMode, sim1.config.algorithm, algo2]);

  useEffect(() => {
    if (comparisonMode && !sim1.state.isRunning && !sim1.state.isPaused && !sim1.state.isComplete) {
      sim2.setTraffic(sim1.traffic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonMode, sim1.traffic, sim1.state.isRunning, sim1.state.isPaused, sim1.state.isComplete]);

  useEffect(() => {
    if (comparisonMode && sim1.config.durationMs !== sim2.config.durationMs) {
      sim2.updateConfig({ durationMs: sim1.config.durationMs });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonMode, sim1.config.durationMs]);

  const handleStart = () => {
    if (comparisonMode) {
      sim2.setTraffic(sim1.traffic);
    }
    sim1.start();
    if (comparisonMode) sim2.start();
  };

  const handlePause = () => {
    sim1.pause();
    if (comparisonMode) sim2.pause();
  };

  const handleResume = () => {
    sim1.resume();
    if (comparisonMode) sim2.resume();
  };

  const handleReset = () => {
    sim1.reset();
    if (comparisonMode) sim2.reset();
  };

  const handleStep = () => {
    sim1.step();
    if (comparisonMode) sim2.step();
  };

  const handleSetPlaybackSpeed = (speed: number) => {
    sim1.setPlaybackSpeed(speed);
    if (comparisonMode) sim2.setPlaybackSpeed(speed);
  };

  if (!sim1.state || !sim1.stats) return null;

  const sim1Complete = sim1.state.isComplete;
  const sim2Complete = sim2.state?.isComplete ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interactive Algorithm Simulator"
        description="Pure client-side deterministic simulation engine for learning and comparing rate-limiting algorithms."
      >
        <button
          onClick={() => setComparisonMode(!comparisonMode)}
          className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer ${comparisonMode
            ? 'bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90'
            : 'bg-card hover:bg-accent border-border text-foreground shadow-sm'
            }`}
        >
          {comparisonMode ? 'Disable Comparison Mode' : 'Enable Comparison Mode'}
        </button>
      </PageHeader>

      {comparisonMode && (
        <div className="flex flex-col lg:flex-row items-stretch justify-center gap-4 mb-6">
          <div className="flex-1 p-4 bg-muted/20 rounded-xl border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Simulator A</div>
            </div>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-md border border-input bg-card px-3 py-1.5 text-sm font-semibold shadow-sm cursor-pointer hover:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary pr-8"
                value={sim1.config.algorithm}
                onChange={(e) => sim1.updateConfig({ algorithm: e.target.value as AlgorithmType })}
                disabled={sim1.state.isRunning || sim1.state.isPaused}
              >
                {(Object.keys(ALGO_LABELS) as AlgorithmType[]).map(a => (
                  <option key={a} value={a}>{ALGO_LABELS[a]}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            <AlgorithmConfiguration config={sim1.config} updateConfig={sim1.updateConfig} disabled={sim1.state.isRunning || sim1.state.isPaused} />
          </div>

          <div className="flex items-center justify-center">
            <span className="text-sm font-bold tracking-widest text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">VS</span>
          </div>

          <div className="flex-1 p-4 bg-muted/20 rounded-xl border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Simulator B</div>
            </div>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-md border border-input bg-card px-3 py-1.5 text-sm font-semibold shadow-sm cursor-pointer hover:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary pr-8"
                value={algo2}
                onChange={(e) => setAlgo2(e.target.value as AlgorithmType)}
                disabled={sim1.state.isRunning || sim1.state.isPaused}
              >
                {(Object.keys(ALGO_LABELS) as AlgorithmType[]).map(a => (
                  <option key={a} value={a}>{ALGO_LABELS[a]}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            <AlgorithmConfiguration config={sim2.config} updateConfig={sim2.updateConfig} disabled={sim1.state.isRunning || sim1.state.isPaused} />
          </div>
        </div>
      )}

      <SimulatorControls
        config={sim1.config}
        isRunning={sim1.state.isRunning}
        isPaused={sim1.state.isPaused}
        isComplete={sim1.state.isComplete}
        traffic={sim1.traffic}
        isComparisonMode={comparisonMode}
        updateConfig={(config) => {
          sim1.updateConfig(config);
          if (comparisonMode && config.durationMs !== undefined) {
            sim2.updateConfig({ durationMs: config.durationMs });
          }
        }}
        setTraffic={(traffic) => {
          sim1.setTraffic(traffic);
          if (comparisonMode) sim2.setTraffic(traffic);
        }}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onReset={handleReset}
        onStep={handleStep}
        onSetPlaybackSpeed={handleSetPlaybackSpeed}
      />
      <div className="space-y-6">
        <div>
          {comparisonMode && <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Simulator A Timeline</h3>}
          <SimulatorTimeline
            durationMs={sim1.config.durationMs}
            currentTimeMs={sim1.state.timeMs}
            traffic={sim1.traffic}
            isRunning={sim1.state.isRunning}
            onAddEvent={(e) => {
              sim1.addTrafficEvent(e);
            }}
            onRemoveEvent={(id) => {
              sim1.removeTrafficEvent(id);
            }}
            onMoveEvent={(id, t) => {
              sim1.moveTrafficEvent(id, t);
            }}
          />
        </div>

        {comparisonMode && (
          <div>
            <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Simulator B Timeline</h3>
            <div className="pointer-events-none">
              <SimulatorTimeline
                durationMs={sim2.config.durationMs}
                currentTimeMs={sim2.state.timeMs}
                traffic={sim2.traffic}
                isRunning={sim2.state.isRunning}
                onAddEvent={() => { }}
                onRemoveEvent={() => { }}
                onMoveEvent={() => { }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">Edit Simulator A's timeline above to sync traffic to Simulator B.</p>
          </div>
        )}
      </div>

      {comparisonMode ? (
        <div className="space-y-6 mt-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* LEFT: sim1 (primary algorithm) */}
            <div className={`space-y-6 rounded-xl border-2 ${ALGO_COLORS[sim1.config.algorithm]} p-5 bg-card/30`}>
              <h2 className="text-lg font-bold text-center pb-3 border-b border-border/30">{ALGO_LABELS[sim1.config.algorithm]}</h2>
              <AlgoVisualizer config={sim1.config} state={sim1.state} />
              <SimulatorStats stats={sim1.stats} isComparisonMode={true} />
              {sim1Complete ? (
                <SimulatorCharts
                  history={sim1.state.history}
                  capacity={sim1.config.algorithm === 'TOKEN_BUCKET' ? sim1.config.capacity : sim1.config.requestLimit}
                  isComparisonMode={true}
                />
              ) : (
                <ChartPlaceholder />
              )}
            </div>

            {/* RIGHT: sim2 (comparison algorithm) */}
            <div className={`space-y-6 rounded-xl border-2 ${ALGO_COLORS[algo2]} p-5 bg-card/30`}>
              <h2 className="text-lg font-bold text-center pb-3 border-b border-border/30">{ALGO_LABELS[algo2]}</h2>
              {sim2.state && sim2.stats && (
                <>
                  <AlgoVisualizer config={sim2.config} state={sim2.state} />
                  <SimulatorStats stats={sim2.stats} isComparisonMode={true} />
                  {sim2Complete ? (
                    <SimulatorCharts
                      history={sim2.state.history}
                      capacity={sim2.config.algorithm === 'TOKEN_BUCKET' ? sim2.config.capacity : sim2.config.requestLimit}
                      isComparisonMode={true}
                    />
                  ) : (
                    <ChartPlaceholder />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              <AlgoVisualizer config={sim1.config} state={sim1.state} />
            </div>
          </div>
          <SimulatorStats stats={sim1.stats} />

          {sim1Complete ? (
            <SimulatorCharts
              history={sim1.state.history}
              capacity={sim1.config.algorithm === 'TOKEN_BUCKET' ? sim1.config.capacity : sim1.config.requestLimit}
            />
          ) : (
            <ChartPlaceholder />
          )}
        </div>
      )}
    </div>
  );
};

const ChartPlaceholder = () => (
  <div className="flex flex-col items-center justify-center py-16 px-8 bg-card/50 border border-border/30 rounded-xl mt-6">
    <BarChart3 className="w-12 h-12 text-muted-foreground/40 mb-4" />
    <p className="text-sm font-medium text-muted-foreground">
      Charts will be generated once the simulation completes
    </p>
    <p className="text-xs text-muted-foreground/60 mt-1">
      Hit Play and let the timeline finish, or use Step to advance manually
    </p>
  </div>
);

export default SimulatorPage;
