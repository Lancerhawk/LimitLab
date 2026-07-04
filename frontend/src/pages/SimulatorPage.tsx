import { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { useSimulation } from '../simulation/hooks/useSimulation';
import { SimulatorControls } from '../simulation/components/SimulatorControls';
import { SimulatorTimeline } from '../simulation/components/SimulatorTimeline';
import { BucketVisualizer } from '../simulation/components/BucketVisualizer';
import { SimulatorCharts } from '../simulation/components/SimulatorCharts';
import { SimulatorStats } from '../simulation/components/SimulatorStats';
import { BarChart3 } from 'lucide-react';

export const SimulatorPage = () => {
  const [comparisonMode, setComparisonMode] = useState(false);

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


  useEffect(() => {
    if (comparisonMode) {
      sim1.updateConfig({ algorithm: 'TOKEN_BUCKET' });
    }
  }, [comparisonMode]);


  useEffect(() => {
    if (comparisonMode) {
      sim2.setTraffic(sim1.traffic);
    }
  }, [comparisonMode]);


  useEffect(() => {
    if (comparisonMode && sim1.config.durationMs !== sim2.config.durationMs) {
      sim2.updateConfig({ durationMs: sim1.config.durationMs });
    }
  }, [comparisonMode, sim1.config.durationMs]);

  const handleStart = () => {
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

      <SimulatorTimeline
        durationMs={sim1.config.durationMs}
        currentTimeMs={sim1.state.timeMs}
        traffic={sim1.traffic}
        isRunning={sim1.state.isRunning}
        onAddEvent={(e) => {
          sim1.addTrafficEvent(e);
          if (comparisonMode) sim2.addTrafficEvent(e);
        }}
        onRemoveEvent={(id) => {
          sim1.removeTrafficEvent(id);
          if (comparisonMode) sim2.removeTrafficEvent(id);
        }}
        onMoveEvent={(id, t) => {
          sim1.moveTrafficEvent(id, t);
          if (comparisonMode) sim2.moveTrafficEvent(id, t);
        }}
      />

      {comparisonMode ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-center border-b border-border/40 pb-4">Token Bucket</h2>
            <BucketVisualizer config={sim1.config} state={sim1.state} />
            <SimulatorStats stats={sim1.stats} isComparisonMode={true} />

            {sim1Complete ? (
              <SimulatorCharts history={sim1.state.history} capacity={sim1.config.capacity} isComparisonMode={true} />
            ) : (
              <ChartPlaceholder />
            )}
          </div>


          <div className="space-y-6 border-t pt-8 xl:border-t-0 xl:pt-0 xl:border-l xl:border-border/40 xl:pl-8">
            <h2 className="text-xl font-bold text-center border-b border-border/40 pb-4">Fixed Window</h2>
            {sim2.state && sim2.stats && (
              <>
                <BucketVisualizer config={sim2.config} state={sim2.state} />
                <SimulatorStats stats={sim2.stats} isComparisonMode={true} />

                {sim2Complete ? (
                  <SimulatorCharts history={sim2.state.history} capacity={sim2.config.requestLimit} isComparisonMode={true} />
                ) : (
                  <ChartPlaceholder />
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              <BucketVisualizer config={sim1.config} state={sim1.state} />
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
