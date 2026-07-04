import React from 'react';
import { Badge } from '../../components/ui/Badge';
import type { SimulationConfig, SimulationState } from '../types';
import { cn } from '../../utils/cn';

interface BucketVisualizerProps {
  config: SimulationConfig;
  state: SimulationState;
}

export const BucketVisualizer: React.FC<BucketVisualizerProps> = React.memo(({ config, state }) => {
  const isTokenBucket = config.algorithm === 'TOKEN_BUCKET';

  const maxCapacity = isTokenBucket ? config.capacity : config.requestLimit;
  const currentTokens = Math.max(0, state.tokens);
  const percentFull = Math.min(100, Math.max(0, (currentTokens / maxCapacity) * 100));

  const getColorClass = (percent: number) => {
    if (percent > 60) return 'bg-emerald-500';
    if (percent > 20) return 'bg-amber-400';
    return 'bg-destructive';
  };

  return (
    <div className="flex flex-col items-center justify-center bg-card border border-border/40 rounded-xl p-8 shadow-sm">
      
      <div className="flex flex-col items-center mb-8 w-full relative">
        <h3 className="text-lg font-bold text-foreground">
          {isTokenBucket ? 'Token Bucket' : 'Fixed Window'}
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

      <div className="flex items-end justify-center w-full max-w-sm h-64 mb-6">
        
        {isTokenBucket ? (
          <div className="relative w-48 h-full bg-muted/30 border-x-4 border-b-4 border-border/60 rounded-b-xl overflow-hidden flex flex-col justify-end shadow-inner">
            <div 
              className={cn("w-full shadow-[0_0_15px_rgba(var(--primary),0.3)]", getColorClass(percentFull))}
              style={{ height: `${percentFull}%` }}
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-white/20"></div>
            </div>
            
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="w-full border-b border-foreground/50"></div>
              <div className="w-full border-b border-foreground/50"></div>
              <div className="w-full border-b border-foreground/50"></div>
              <div className="w-full border-b border-foreground/50"></div>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center space-y-6">
            <div className="relative w-24 h-24 rounded-full border-4 border-muted/50 flex items-center justify-center bg-background/50">
               <div className="text-2xl font-mono text-foreground font-bold">
                 {Math.max(0, ((state.windowStartMs + config.windowDurationMs) - state.timeMs) / 1000).toFixed(1)}s
               </div>
               <div className="absolute -bottom-6 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                 Resets In
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
        )}

      </div>

      <div className="text-center space-y-1">
        <div className="text-4xl font-mono font-bold text-foreground">
          {isTokenBucket ? state.tokens.toFixed(2) : currentTokens.toFixed(0)}
        </div>
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Current Tokens
        </div>
      </div>

    </div>
  );
});

BucketVisualizer.displayName = 'BucketVisualizer';
