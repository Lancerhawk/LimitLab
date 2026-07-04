import React from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Play, Pause, Square, SkipForward, Zap, LineChart, Timer, Trash2 } from 'lucide-react';
import type { SimulationConfig, AlgorithmType, TrafficEvent } from '../types';
import { generateConstantTraffic, generateBurstTraffic, generateRandomTraffic, mergeTraffic } from '../trafficGenerator';
import { PLAYBACK_SPEEDS } from '../types';

interface SimulatorControlsProps {
  config: SimulationConfig;
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  traffic: TrafficEvent[];
  updateConfig: (config: Partial<SimulationConfig>) => void;
  setTraffic: (events: TrafficEvent[]) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onStep: () => void;
  onSetPlaybackSpeed: (speed: number) => void;
  isComparisonMode?: boolean;
}

export const SimulatorControls: React.FC<SimulatorControlsProps> = React.memo(({
  config,
  isRunning,
  isPaused,
  isComplete,
  traffic,
  updateConfig,
  setTraffic,
  onStart,
  onPause,
  onResume,
  onReset,
  onStep,
  onSetPlaybackSpeed,
  isComparisonMode = false,
}) => {
  const handleAlgorithmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateConfig({ algorithm: e.target.value as AlgorithmType });
  };

  const handleGenerateBurst = () => {
    const burst = generateBurstTraffic(10, 2000);
    setTraffic(mergeTraffic(traffic, burst));
  };

  const handleGenerateConstant = () => {
    const constant = generateConstantTraffic(2, config.durationMs);
    setTraffic(mergeTraffic(traffic, constant));
  };

  const handleGenerateRandom = () => {
    const random = generateRandomTraffic(3, 1.5, config.durationMs, Math.random() * 1000);
    setTraffic(mergeTraffic(traffic, random));
  };

  const handleClearTraffic = () => {
    setTraffic([]);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card className="col-span-full lg:col-span-1">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Algorithm</label>
            <div className="relative">
              <select
                className="flex h-10 w-full appearance-none rounded-md border border-input bg-card/50 px-3 py-2 text-sm shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                value={config.algorithm}
                onChange={handleAlgorithmChange}
                disabled={isRunning || isPaused || isComparisonMode}
              >
                {isComparisonMode ? (
                  <option value="TOKEN_BUCKET" className="bg-card text-foreground">Token Bucket vs Fixed Window</option>
                ) : (
                  <>
                    <option value="TOKEN_BUCKET" className="bg-card text-foreground">Token Bucket</option>
                    <option value="FIXED_WINDOW" className="bg-card text-foreground">Fixed Window</option>
                  </>
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Duration (seconds)</label>
            <div className="flex items-center gap-2">
              <Input
                type="range"
                min="5"
                max="120"
                step="1"
                value={config.durationMs / 1000}
                onChange={(e) => updateConfig({ durationMs: Number(e.target.value) * 1000 })}
                disabled={isRunning || isPaused}
                className="flex-1"
              />
              <span className="text-sm w-12 text-right font-mono">{config.durationMs / 1000}s</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Playback Speed</label>
            <div className="relative">
              <select
                className="flex h-10 w-full appearance-none rounded-md border border-input bg-card/50 px-3 py-2 text-sm shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
                value={config.playbackSpeed}
                onChange={(e) => onSetPlaybackSpeed(Number(e.target.value))}
              >
                {PLAYBACK_SPEEDS.map(speed => (
                  <option key={speed} value={speed} className="bg-card text-foreground">{speed}x</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-full lg:col-span-1">
        <CardContent className="p-4 space-y-4">
          {config.algorithm === 'TOKEN_BUCKET' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Bucket Capacity</label>
                <Input
                  type="number"
                  min="1"
                  value={config.capacity}
                  onChange={(e) => updateConfig({ capacity: Number(e.target.value) })}
                  disabled={isRunning || isPaused}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Refill Rate (tokens/sec)</label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={config.refillRate}
                  onChange={(e) => updateConfig({ refillRate: Number(e.target.value) })}
                  disabled={isRunning || isPaused}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Request Limit</label>
                <Input
                  type="number"
                  min="1"
                  value={config.requestLimit}
                  onChange={(e) => updateConfig({ requestLimit: Number(e.target.value) })}
                  disabled={isRunning || isPaused}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Window Duration (seconds)</label>
                <Input
                  type="number"
                  min="1"
                  value={config.windowDurationMs / 1000}
                  onChange={(e) => updateConfig({ windowDurationMs: Number(e.target.value) * 1000 })}
                  disabled={isRunning || isPaused}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="col-span-full lg:col-span-1">
        <CardContent className="p-4 space-y-3">
          <div className="text-sm font-medium text-foreground mb-1">Traffic Generators</div>
          <Button variant="outline" className="w-full justify-start" onClick={handleGenerateBurst} disabled={isRunning || isPaused}>
            <Zap className="mr-2 h-4 w-4 text-primary" />
            Generate Burst
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={handleGenerateConstant} disabled={isRunning || isPaused}>
            <LineChart className="mr-2 h-4 w-4 text-emerald-500" />
            Generate Constant
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={handleGenerateRandom} disabled={isRunning || isPaused}>
            <Timer className="mr-2 h-4 w-4 text-purple-500" />
            Generate Random
          </Button>
          <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleClearTraffic} disabled={isRunning || isPaused || traffic.length === 0}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Traffic
          </Button>
        </CardContent>
      </Card>
      
      <Card className="col-span-full lg:col-span-1 flex flex-col">
        <CardContent className="p-4 flex-1 flex flex-col justify-center space-y-4">
          <div className="text-sm font-medium text-foreground mb-1">Simulation Controls</div>
          <div className="grid grid-cols-2 gap-2">
            {!isRunning ? (
              <Button onClick={isPaused ? onResume : onStart} disabled={isComplete} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Play className="mr-2 h-4 w-4" /> {isPaused ? 'Resume' : 'Play'}
              </Button>
            ) : (
              <Button onClick={onPause} variant="secondary">
                <Pause className="mr-2 h-4 w-4" /> Pause
              </Button>
            )}
            
            <Button onClick={onReset} variant="outline" disabled={!isRunning && !isPaused && !isComplete && traffic.every(t => !t.processed)}>
              <Square className="mr-2 h-4 w-4" /> Reset
            </Button>
          </div>
          
          <Button onClick={onStep} variant="outline" className="w-full" disabled={isRunning || isComplete}>
            <SkipForward className="mr-2 h-4 w-4" /> Step (100ms)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
});

SimulatorControls.displayName = 'SimulatorControls';
