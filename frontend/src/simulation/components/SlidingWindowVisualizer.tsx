import React from 'react';
import { Activity } from 'lucide-react';
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
          {config.algorithm === 'SLIDING_LOG' ? 'Sliding Log' : 'Sliding Window Counter'}
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
        
        {config.algorithm === 'SLIDING_LOG' ? (
          <div className="my-4 space-y-3 w-full">
             <div className="flex justify-between items-end">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Active Memory Log
                </span>
                <span className="text-xs font-mono font-bold text-teal-500">
                  {(state.slidingLogTimestamps || []).length} <span className="text-muted-foreground font-normal">/ {config.requestLimit} Stored</span>
                </span>
             </div>
             
             <div className="flex flex-wrap gap-1.5 p-3 bg-black/40 border border-border/40 rounded-xl shadow-inner min-h-[64px]">
                {Array.from({ length: Math.min(config.requestLimit, 100) }).map((_, i) => {
                   const timestamp = (state.slidingLogTimestamps || [])[i];
                   const isActive = timestamp !== undefined;
                   
                   return (
                     <div 
                       key={i}
                       className={`
                         relative h-8 flex-1 min-w-[24px] max-w-[40px] rounded border flex items-center justify-center overflow-hidden transition-colors duration-150
                         ${isActive 
                           ? 'bg-teal-500/20 border-teal-500/50 shadow-[0_0_10px_rgba(20,184,166,0.2)]' 
                           : 'bg-muted/10 border-border/20'}
                       `}
                     >
                       {isActive ? (
                         <div className="w-1 h-3 bg-teal-400 rounded-sm shadow-[0_0_5px_rgba(45,212,191,0.8)]" />
                       ) : (
                         <div className="w-1 h-1 bg-border/50 rounded-full" />
                       )}
                     </div>
                   );
                })}
             </div>
             {config.requestLimit > 100 && (
                <div className="text-[10px] text-muted-foreground text-center italic mt-1">Showing first 100 memory slots</div>
             )}
          </div>
        ) : (
          <>
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
          </>
        )}

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
