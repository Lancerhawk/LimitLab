import React from 'react';
import { StatCard } from '../../components/common/StatCard';
import { Activity, ShieldCheck, ShieldAlert, Percent, Droplets, ArrowDown, Zap, History } from 'lucide-react';
import type { SimulationStats } from '../types';
import { cn } from '../../utils/cn';

interface SimulatorStatsProps {
  stats: SimulationStats;
  isComparisonMode?: boolean;
}

export const SimulatorStats: React.FC<SimulatorStatsProps> = React.memo(({ stats, isComparisonMode = false }) => {
  return (
    <div className={cn("grid gap-4 mt-6", isComparisonMode ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")}>
      <StatCard 
        title="Total Requests" 
        value={stats.totalRequests.toString()} 
        icon={<Activity className="h-4 w-4" />} 
      />
      <StatCard 
        title="Accepted" 
        value={stats.accepted.toString()} 
        icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />} 
      />
      <StatCard 
        title="Rejected" 
        value={stats.rejected.toString()} 
        icon={<ShieldAlert className="h-4 w-4 text-destructive" />} 
      />
      <StatCard 
        title="Acceptance Rate" 
        value={`${stats.acceptancePercent}%`} 
        icon={<Percent className="h-4 w-4" />} 
      />
      <StatCard 
        title="Average Tokens" 
        value={stats.averageTokens.toFixed(2)} 
        icon={<Droplets className="h-4 w-4 text-blue-500" />} 
      />
      <StatCard 
        title="Lowest Tokens" 
        value={stats.lowestTokens.toFixed(2)} 
        icon={<ArrowDown className="h-4 w-4 text-blue-500" />} 
      />
      <StatCard 
        title="Peak Throughput" 
        value={`${stats.peakThroughput} req/s`} 
        icon={<Zap className="h-4 w-4 text-amber-500" />} 
      />
      <StatCard 
        title="Longest Empty" 
        value={`${(stats.longestEmptyDurationMs / 1000).toFixed(2)}s`} 
        icon={<History className="h-4 w-4 text-amber-500" />} 
      />
    </div>
  );
});

SimulatorStats.displayName = 'SimulatorStats';
