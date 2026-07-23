import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { TrafficEvent } from '../types';
import { createManualEvent } from '../trafficGenerator';
import { cn } from '../../utils/cn';

interface SimulatorTimelineProps {
  durationMs: number;
  currentTimeMs: number;
  traffic: TrafficEvent[];
  isRunning: boolean;
  onAddEvent: (event: TrafficEvent) => void;
  onRemoveEvent: (id: string) => void;
  onMoveEvent: (id: string, timeMs: number) => void;
}

const getEventColor = (event: TrafficEvent) => {
  if (!event.processed) return 'bg-muted-foreground/60 ring-background';
  return event.decision === 'ALLOW' ? 'bg-emerald-500 ring-background' : 'bg-destructive ring-background';
};


const TickMarks = React.memo(({ durationMs }: { durationMs: number }) => {
  const durationSeconds = durationMs / 1000;
  const ticks = Array.from({ length: durationSeconds + 1 }, (_, i) => i);
  return (
    <>
      {ticks.map((tick) => {
        const percent = (tick * 1000 / durationMs) * 100;
        return (
          <div
            key={tick}
            className="absolute top-0 bottom-0 border-l border-border/20 pointer-events-none"
            style={{ left: `${percent}%` }}
          >
            <div className="absolute top-1 left-1 text-[10px] text-muted-foreground font-mono select-none">
              {tick}s
            </div>
          </div>
        );
      })}
    </>
  );
});
TickMarks.displayName = 'TickMarks';


const Playhead = React.memo(({ percent }: { percent: number }) => (
  <div
    className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none z-10 shadow-[0_0_8px_rgba(var(--primary),0.5)]"
    style={{ left: `${percent}%` }}
  >
    <div className="absolute top-0 -translate-x-1/2 w-2 h-2 rounded-full bg-primary" />
  </div>
));
Playhead.displayName = 'Playhead';


const TrafficLayer = React.memo(({ localTraffic, durationMs, isRunning, draggingId, onRemoveEvent, setDraggingId }: {
  localTraffic: TrafficEvent[];
  durationMs: number;
  isRunning: boolean;
  draggingId: string | null;
  onRemoveEvent: (id: string) => void;
  setDraggingId: (id: string) => void;
}) => {
  const renderableEvents: TrafficEvent[] = [];
  const seenKeys = new Set<string>();

  for (const event of localTraffic) {
    const percent = ((event.timeMs / durationMs) * 100).toFixed(1);
    const status = event.processed ? event.decision : 'pending';
    const key = `${percent}-${status}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      renderableEvents.push(event);
    }
  }

  return (
    <>
      {renderableEvents.map((event: TrafficEvent) => {
        const percent = (event.timeMs / durationMs) * 100;
        return (
          <div
            key={event.id}
            className={cn(
              "traffic-event absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full shadow-sm ring-1 z-20",
              getEventColor(event),
              !isRunning && "cursor-grab hover:scale-150 active:cursor-grabbing",
              draggingId === event.id && "scale-150 ring-2 ring-primary z-30"
            )}
            style={{ left: `${percent}%` }}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!isRunning) setDraggingId(event.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!isRunning) onRemoveEvent(event.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isRunning) onRemoveEvent(event.id);
            }}
            title={`Time: ${(event.timeMs / 1000).toFixed(2)}s\nDecision: ${event.decision || 'Pending'}`}
          />
        );
      })}
    </>
  );
});
TrafficLayer.displayName = 'TrafficLayer';


const TimelineLegend = React.memo(() => (
  <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between text-xs text-muted-foreground">
    <div className="flex gap-4">
      <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-muted-foreground/60" /> Pending</span>
      <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Accepted</span>
      <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive" /> Rejected</span>
    </div>
    <div className="text-muted-foreground/60">Click timeline to add • Double-click or Right-click to remove • Drag to move</div>
  </div>
));
TimelineLegend.displayName = 'TimelineLegend';

export const SimulatorTimeline: React.FC<SimulatorTimelineProps> = ({
  durationMs,
  currentTimeMs,
  traffic,
  isRunning,
  onAddEvent,
  onRemoveEvent,
  onMoveEvent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverTimeMs, setHoverTimeMs] = useState<number | null>(null);
  const [localTraffic, setLocalTraffic] = useState<TrafficEvent[]>(traffic);

  useEffect(() => {
    if (!draggingId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalTraffic(traffic);
    }
  }, [traffic, draggingId]);

  const durationSeconds = durationMs / 1000;
  const playheadPercent = (currentTimeMs / durationMs) * 100;

  const getTimeFromMouseX = useCallback((clientX: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = x / rect.width;
    return Math.round(percent * durationMs);
  }, [durationMs]);

  const handleMouseMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    const newTimeMs = getTimeFromMouseX(e.clientX);
    if (draggingId && !isRunning) {
      setLocalTraffic(prev => prev.map(t => t.id === draggingId ? { ...t, timeMs: newTimeMs } : t));
    }
    setHoverTimeMs(newTimeMs);
  }, [draggingId, isRunning, getTimeFromMouseX]);

  const handleMouseUp = useCallback(() => {
    setDraggingId((prevId) => {
      if (prevId) {
        setLocalTraffic(prevTraffic => {
          const draggedEvent = prevTraffic.find(t => t.id === prevId);
          if (draggedEvent) {
            onMoveEvent(prevId, draggedEvent.timeMs);
          }
          return prevTraffic;
        });
      }
      return null;
    });
  }, [onMoveEvent]);

  useEffect(() => {
    if (draggingId) {
      window.addEventListener('mousemove', handleMouseMove as EventListener);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove as EventListener);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingId, handleMouseMove, handleMouseUp]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (isRunning) return;
    if ((e.target as HTMLElement).closest('.traffic-event')) return;
    const timeMs = getTimeFromMouseX(e.clientX);
    onAddEvent(createManualEvent(timeMs));
  }, [isRunning, getTimeFromMouseX, onAddEvent]);

  const handleMouseLeave = useCallback(() => setHoverTimeMs(null), []);

  return (
    <div className="w-full bg-card border border-border/40 rounded-xl p-6 shadow-sm overflow-hidden select-none">
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-sm font-semibold text-foreground">Interactive Timeline</h3>
        <div className="text-xs text-muted-foreground font-mono">
          {(currentTimeMs / 1000).toFixed(2)}s / {durationSeconds}s
          {hoverTimeMs !== null && !isRunning && !draggingId && (
            <span className="ml-4 opacity-60">Hover: {(hoverTimeMs / 1000).toFixed(2)}s</span>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "relative h-20 bg-muted/20 rounded-md border border-border/30 overflow-hidden cursor-crosshair",
          isRunning && "cursor-default opacity-90"
        )}
        onClick={handleTimelineClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <TickMarks durationMs={durationMs} />
        <Playhead percent={playheadPercent} />

        {hoverTimeMs !== null && !isRunning && !draggingId && (
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/20 pointer-events-none border-dashed border-l border-foreground/30 z-0"
            style={{ left: `${(hoverTimeMs / durationMs) * 100}%` }}
          />
        )}

        <TrafficLayer
          localTraffic={localTraffic}
          durationMs={durationMs}
          isRunning={isRunning}
          draggingId={draggingId}
          onRemoveEvent={onRemoveEvent}
          setDraggingId={setDraggingId}
        />
      </div>

      <TimelineLegend />
    </div>
  );
};
