import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { Activity, Users, Zap, ShieldCheck, AreaChart, Cpu } from 'lucide-react';

export const DashboardPage = () => {
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Dashboard" 
        description="Real-time overview of your rate limiting infrastructure." 
      />

      {/* Primary Stats */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Requests" value="---" icon={<Activity className="h-4 w-4" />} />
        <StatCard title="Active Clients" value="---" icon={<Users className="h-4 w-4" />} />
        <StatCard title="Blocked Requests" value="---" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard title="Avg Latency" value="---" icon={<Zap className="h-4 w-4" />} />
      </div>

      {/* Main Sections - Completely Rebuilt for Ultra-Premium UI */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Traffic Overview Panel */}
        <section className="flex flex-col border border-border/40 rounded-2xl bg-card shadow-sm overflow-hidden min-h-[400px] transition-all hover:border-primary/20 hover:shadow-md">
          <div className="px-6 py-5 border-b border-border/40 flex items-center gap-3 bg-muted/5">
            <AreaChart className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg text-foreground tracking-tight">Traffic Overview</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-transparent to-muted/10 text-center">
            <div className="rounded-2xl bg-primary/5 p-6 mb-6 border border-primary/10">
              <Activity className="h-12 w-12 text-primary/40" />
            </div>
            <h4 className="text-xl font-bold text-foreground mb-3">No data available yet</h4>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              Real-time request metrics, traffic spikes, and throughput charts will be fully implemented soon.
            </p>
          </div>
        </section>

        {/* Algorithm Status Panel */}
        <section className="flex flex-col border border-border/40 rounded-2xl bg-card shadow-sm overflow-hidden min-h-[400px] transition-all hover:border-primary/20 hover:shadow-md">
          <div className="px-6 py-5 border-b border-border/40 flex items-center gap-3 bg-muted/5">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg text-foreground tracking-tight">Algorithm Status</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-transparent to-muted/10 text-center">
            <div className="rounded-2xl bg-primary/5 p-6 mb-6 border border-primary/10">
              <Zap className="h-12 w-12 text-primary/40" />
            </div>
            <h4 className="text-xl font-bold text-foreground mb-3">No algorithms active</h4>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              Live configuration status, bucket depths, and sliding window telemetry will be fully implemented soon.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
