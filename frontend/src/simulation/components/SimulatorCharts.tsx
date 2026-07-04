import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import type { HistoryPoint } from '../types';
import { cn } from '../../utils/cn';

interface SimulatorChartsProps {
  history: HistoryPoint[];
  capacity: number;
  isComparisonMode?: boolean;
}

export const SimulatorCharts: React.FC<SimulatorChartsProps> = React.memo(({ history, capacity, isComparisonMode = false }) => {

  const formattedHistory = history.map(h => ({
    ...h,
    displayTime: (h.timeMs / 1000).toFixed(1) + 's',
  }));


  const colors = {
    primary: 'hsl(var(--primary))',
    primaryOp: 'hsla(var(--primary), 0.2)',
    success: 'hsl(142.1, 76.2%, 36.3%)',
    destructive: 'hsl(var(--destructive))',
    muted: 'hsl(var(--muted-foreground))',
    grid: 'hsl(var(--border) / 0.5)',
  };

  const chartFont = {
    fontSize: 12,
    fill: colors.muted,
  };

  return (
    <div className={cn("grid gap-6 mt-6", isComparisonMode ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3")}>
      

      <Card className="col-span-full lg:col-span-1 border-border/40 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tokens vs Time</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
              <XAxis dataKey="displayTime" tick={chartFont} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={chartFont} tickLine={false} axisLine={false} domain={[0, capacity]} />
              <Tooltip 
                cursor={{ stroke: 'hsl(var(--foreground) / 0.2)', strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <ReferenceLine y={capacity} stroke={colors.muted} strokeDasharray="3 3" />
              <Area 
                type="stepAfter" 
                dataKey="tokens" 
                stroke={colors.primary} 
                fillOpacity={1} 
                fill="url(#colorTokens)" 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>


      <Card className="col-span-full lg:col-span-1 border-border/40 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Accepted vs Rejected</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
              <XAxis dataKey="displayTime" tick={chartFont} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={chartFont} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip 
                cursor={{ fill: 'hsl(var(--foreground) / 0.05)' }}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
              <Bar dataKey="accepted" stackId="a" fill={colors.success} isAnimationActive={false} />
              <Bar dataKey="rejected" stackId="a" fill={colors.destructive} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>


      <Card className="col-span-full lg:col-span-1 border-border/40 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Incoming Traffic Rate</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
              <XAxis dataKey="displayTime" tick={chartFont} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={chartFont} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip 
                cursor={{ stroke: 'hsl(var(--foreground) / 0.2)', strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line 
                type="stepAfter" 
                dataKey="incomingRate" 
                name="Reqs / sec"
                stroke="hsl(var(--accent-foreground))" 
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
});

SimulatorCharts.displayName = 'SimulatorCharts';
