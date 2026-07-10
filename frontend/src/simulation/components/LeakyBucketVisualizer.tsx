import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import type { SimulationConfig, SimulationState } from '../types';
import { cn } from '../../utils/cn';

interface LeakyBucketVisualizerProps {
  config: SimulationConfig;
  state: SimulationState;
}

export const LeakyBucketVisualizer: React.FC<LeakyBucketVisualizerProps> = React.memo(({ config, state }) => {
  const maxCapacity = config.capacity;
  const rawQueue = Math.min(maxCapacity, Math.max(0, state.queueLength ?? 0));
  const isLeaking = rawQueue > 0.05;

  // ─── Smooth interpolation: displayQueue chases rawQueue at 60fps ───
  const [displayQueue, setDisplayQueue] = useState(rawQueue);
  const targetRef = useRef(rawQueue);
  const rafRef = useRef<number | null>(null);

  // Update target whenever engine value changes
  targetRef.current = rawQueue;

  useEffect(() => {
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min(now - lastTime, 50); // cap at 50ms to avoid jumps on tab-switch
      lastTime = now;

      setDisplayQueue(prev => {
        const target = targetRef.current;
        const diff = target - prev;

        // Move toward target at a rate proportional to the gap
        // This creates a smooth ease-out effect
        // Speed: covers ~90% of any gap within ~400ms
        const speed = Math.max(0.5, Math.abs(diff) * 6); // units per second, minimum 0.5
        const step = speed * (dt / 1000);

        if (Math.abs(diff) < 0.02) return target; // snap when close enough
        return diff > 0 ? Math.min(prev + step, target) : Math.max(prev - step, target);
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // runs once, reads targetRef

  const fillPercent = Math.min(100, Math.max(0, (displayQueue / maxCapacity) * 100));
  const remaining = Math.max(0, Math.ceil(maxCapacity - displayQueue));

  // Color scheme
  const ratio = displayQueue / maxCapacity;
  const fillColor = ratio > 0.8 ? '#ef4444' : ratio > 0.5 ? '#f97316' : '#22d3ee';
  const textColor = ratio > 0.8 ? 'text-red-400' : ratio > 0.5 ? 'text-orange-400' : 'text-cyan-400';
  const dropColor = ratio > 0.8 ? 'bg-red-400' : ratio > 0.5 ? 'bg-orange-400' : 'bg-cyan-400';

  return (
    <div className="flex flex-col items-center justify-center bg-card border border-border/40 rounded-xl p-6 shadow-sm">
      {/* Header */}
      <h3 className="text-lg font-bold text-foreground mb-2">Leaky Bucket Queue</h3>
      <div className="flex gap-3 mb-5">
        <Badge variant="success" className="text-sm px-3 py-1">
          {state.totalAccepted} Accepted
        </Badge>
        <Badge variant="destructive" className="text-sm px-3 py-1 bg-destructive/15 text-destructive">
          {state.totalRejected} Rejected
        </Badge>
      </div>

      <div className="flex flex-col items-center">
        {/* IN label */}
        <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] mb-1">▼ Requests In</div>

        {/* ═══ BUCKET ═══ */}
        <div className="relative" style={{ width: 160 }}>
          <div
            className="relative overflow-hidden"
            style={{
              height: 230,
              borderLeft: '3px solid rgba(255,255,255,0.13)',
              borderRight: '3px solid rgba(255,255,255,0.13)',
              borderBottom: '3px solid rgba(255,255,255,0.13)',
              borderRadius: '0 0 12px 12px',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            {/* Water fill — driven by displayQueue, NOT raw engine value */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${fillPercent}%`,
                background: `linear-gradient(to top, ${fillColor}ee, ${fillColor}bb)`,
                borderRadius: '0 0 9px 9px',
              }}
            >
              {/* Wave on surface */}
              {fillPercent > 1 && (
                <div className="absolute top-0 left-0 right-0 h-[5px] overflow-hidden" style={{ opacity: 0.3 }}>
                  <div
                    style={{
                      width: '200%',
                      height: '100%',
                      background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 10px, rgba(255,255,255,0.5) 10px, rgba(255,255,255,0.5) 20px)',
                      animation: 'lbWave 1.8s linear infinite',
                    }}
                  />
                </div>
              )}

              {/* Subtle horizontal lines inside water */}
              <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06 }}>
                {Array.from({ length: Math.min(maxCapacity, 15) }).map((_, i) => (
                  <div key={i} style={{ height: `${100 / Math.min(maxCapacity, 15)}%`, borderBottom: '1px solid white' }} />
                ))}
              </div>
            </div>

            {/* Queue count overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <div className={cn("text-3xl font-mono font-black", fillPercent > 35 ? "text-white/80" : "text-foreground/15")}>
                {Math.floor(displayQueue)}
              </div>
              <div className={cn("text-[9px] font-semibold uppercase tracking-wider", fillPercent > 35 ? "text-white/40" : "text-foreground/8")}>
                in queue
              </div>
            </div>

            {/* Scale markers */}
            <div className="absolute right-1 top-0.5 bottom-0.5 flex flex-col justify-between pointer-events-none">
              <span className="text-[7px] text-muted-foreground/25 font-mono">{maxCapacity}</span>
              <span className="text-[7px] text-muted-foreground/25 font-mono">0</span>
            </div>
          </div>

          {/* Nozzle */}
          <div className="mx-auto w-3.5 h-2 rounded-b" style={{ background: 'rgba(255,255,255,0.12)' }} />
        </div>

        {/* ═══ DRIP ANIMATION — pure CSS infinite loops ═══ */}
        <div className="relative h-14 w-10 overflow-hidden">
          {isLeaking ? (
            <>
              <div className={cn("lb-drop absolute left-1/2", dropColor)} style={{ animationDelay: '0s' }} />
              <div className={cn("lb-drop absolute left-1/2", dropColor)} style={{ animationDelay: '0.4s' }} />
              <div className={cn("lb-drop absolute left-1/2", dropColor)} style={{ animationDelay: '0.8s' }} />
              {/* Splash */}
              <div
                className="absolute bottom-0.5 left-1/2 rounded-full lb-splash"
                style={{ border: `1.5px solid ${fillColor}` }}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="w-1 h-1 rounded-full bg-muted-foreground/15" />
            </div>
          )}
        </div>

        {/* OUT label */}
        <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">▼ Leaks Out</div>
      </div>

      {/* Stats */}
      <div className="text-center mt-5 space-y-1 w-full">
        <div className="flex items-baseline justify-center gap-1.5">
          <span className={cn("text-4xl font-mono font-bold tabular-nums", textColor)}>
            {remaining}
          </span>
          <span className="text-base text-muted-foreground font-mono">/ {maxCapacity}</span>
          <span className="text-xs text-muted-foreground ml-1">free</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
          {isLeaking && (
            <span className="relative flex h-2 w-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dropColor)} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", dropColor)} />
            </span>
          )}
          Leak rate: <span className="font-mono font-semibold text-foreground">{config.refillRate}</span> req/sec
        </div>
      </div>

      <style>{`
        @keyframes lbWave {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .lb-drop {
          width: 5px;
          height: 8px;
          margin-left: -2.5px;
          border-radius: 0 0 50% 50% / 0 0 100% 100%;
          border-top-left-radius: 45%;
          border-top-right-radius: 45%;
          animation: lbDropFall 1.2s ease-in infinite;
        }
        @keyframes lbDropFall {
          0%   { top: 0; opacity: 0; transform: scaleY(0.4); }
          8%   { opacity: 0.9; transform: scaleY(1); }
          65%  { top: 70%; opacity: 0.75; transform: scaleY(1.1); }
          85%  { top: 85%; opacity: 0.4; transform: scaleY(0.6) scaleX(1.4); }
          100% { top: 90%; opacity: 0; transform: scaleY(0.2) scaleX(2); }
        }
        .lb-splash {
          width: 12px;
          height: 4px;
          margin-left: -6px;
          animation: lbSplash 1.2s ease-out infinite;
          animation-delay: 0.55s;
        }
        @keyframes lbSplash {
          0%, 35% { transform: scale(0); opacity: 0; }
          55%     { transform: scale(1); opacity: 0.5; }
          100%    { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
});

LeakyBucketVisualizer.displayName = 'LeakyBucketVisualizer';
