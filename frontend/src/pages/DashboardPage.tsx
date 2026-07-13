import { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { Activity, Users, Zap, ShieldCheck, AreaChart, Cpu, Info } from 'lucide-react';
import { getDashboardStats, type DashboardStats } from '../api/dashboard';

export const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
    // In a real app we might poll here, but for now we just fetch on mount
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Dashboard" 
        description="Real-time overview of your rate limiting infrastructure." 
      />

      {/* Global Rate Limit Notice */}
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl p-4 flex gap-3 text-sm items-start">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-1 font-semibold text-blue-400">Public Sandbox Restrictions Active</strong>
          To prevent abuse, this public sandbox instance enforces strict global limits:
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li><strong>Hard Sandbox Burst Ceiling:</strong> 500 requests per second maximum for in-memory algorithm load testing.</li>
            <li><strong>Sandbox Sustained Limit:</strong> 3,000 requests per 15 minutes for in-memory testing.</li>
            <li><strong>Global API Limit:</strong> 100 requests per 15 minutes for all other endpoints (including database-backed algorithm testing).</li>
          </ol>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard 
          title="Total Requests" 
          value={loading ? "..." : stats?.totalRequests || "0"} 
          icon={<Activity className="h-4 w-4" />} 
        />
        <StatCard 
          title="Active Clients" 
          value={loading ? "..." : stats?.activeClients?.toString() || "0"} 
          icon={<Users className="h-4 w-4" />} 
          description={stats ? `${stats.totalClients} total configured` : undefined}
        />
        <StatCard 
          title="Blocked Requests" 
          value={loading ? "..." : stats?.deniedRequests || "0"} 
          icon={<ShieldCheck className="h-4 w-4" />} 
        />
        <StatCard 
          title="Allowed Requests" 
          value={loading ? "..." : stats?.allowedRequests || "0"} 
          icon={<Zap className="h-4 w-4" />} 
        />
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
