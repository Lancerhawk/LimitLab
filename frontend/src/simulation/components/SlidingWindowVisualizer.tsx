import React from 'react';
import { Badge } from '../../components/ui/Badge';
import type { SimulationConfig, SimulationState } from '../types';
import { cn } from '../../utils/cn';

interface SlidingWindowVisualizerProps {
  config: SimulationConfig;
  state: SimulationState;
}

export const SlidingWindowVisualizer: React.FC<SlidingWindowVisualizerProps> = React.memo(({ config, state }) => {
  const maxCapacity = config.requestLimit;
  const currentTokens = Math.max(0, state.tokens);
  const percentFull = Math.min(100, Math.max(0, (currentTokens / maxCapacity) * 100));

  const getColorClass = (percent: number) => {
    if (percent > 60) return 'bg-emerald-500';
    if (percent > 20) return 'bg-amber-400';
    return 'bg-destructive';
  };

  // Derive math for sliding window visualization
  const currentWindowStartMs = Math.floor(state.timeMs / config.windowDurationMs) * config.windowDurationMs;
  const elapsedInCurrentWindow = state.timeMs - currentWindowStartMs;
  const overlapPercentage = Math.max(0, 1 - (elapsedInCurrentWindow / config.windowDurationMs));
  
  // Reconstruct effective count parts
  const remainingTokens = state.tokens;
  const effectiveCount = maxCapacity - remainingTokens;

  return (
    <div className="flex flex-col items-center justify-center bg-card border border-border/40 rounded-xl p-8 shadow-sm">
      
      <div className="flex flex-col items-center mb-6 w-full relative">
        <h3 className="text-lg font-bold text-foreground">
          Sliding Window Counter
        </h3>
        
        <div className="flex gap-4 mt-4 w-full justify-center">
          <Badge variant="success" className="text-sm px-3 py-1">
            {state.totalAccepted} Accepted
          </Badge>
          <Badge variant="destructive" className="text-sm px-3 py-1 bg-destructive/15 text-destructive">
            {state.totalRejected} Rejected
          </Badge>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center w-full max-w-md space-y-6 mb-6">
        
        <div className="w-full space-y-2">
           <div className="flex justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
             <span>Previous Window</span>
             <span>Current Window</span>
           </div>
           
           <div className="relative w-full h-12 bg-muted/30 rounded-lg overflow-hidden border border-border/50 flex">
             {/* Previous Window Bar */}
             <div 
                className="h-full bg-primary/20 flex items-center justify-end px-3 border-r border-primary/40 transition-all duration-100 ease-linear"
                style={{ width: `${overlapPercentage * 100}%` }}
             >
                <span className="text-xs font-bold text-primary truncate">
                  {(overlapPercentage * 100).toFixed(0)}% Overlap
                </span>
             </div>
             
             {/* Current Window Bar */}
             <div 
                className="h-full bg-emerald-500/20 flex items-center px-3 transition-all duration-100 ease-linear"
                style={{ width: `${(1 - overlapPercentage) * 100}%` }}
             >
                <span className="text-xs font-bold text-emerald-600 truncate">
                  Current
                </span>
             </div>
           </div>
        </div>

        <div className="grid grid-cols-3 gap-2 w-full text-center">
          <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
             <div className="text-xl font-bold font-mono text-primary/80">{(overlapPercentage * 100).toFixed(0)}%</div>
             <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Weight</div>
          </div>
          <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
             <div className="text-xl font-bold font-mono text-foreground">{effectiveCount.toFixed(1)}</div>
             <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Effective</div>
          </div>
          <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
             <div className="text-xl font-bold font-mono text-emerald-600">{currentTokens.toFixed(1)}</div>
             <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Remaining</div>
          </div>
        </div>

        <div className="w-full h-8 bg-muted/30 border border-border/60 rounded-full overflow-hidden relative shadow-inner mt-4">
          <div 
            className={cn("h-full", getColorClass(percentFull))}
            style={{ width: `${percentFull}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md z-10 mix-blend-difference">
            {currentTokens.toFixed(0)} / {maxCapacity} Tokens
          </div>
        </div>
      </div>

    </div>
  );
});

SlidingWindowVisualizer.displayName = 'SlidingWindowVisualizer';
