import { PageHeader } from '../components/common/PageHeader';
import { BarChart3 } from 'lucide-react';

const AnalyticsPage = () => {
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Analytics" 
        description="Historical data and detailed insights on API usage." 
      />
      
      <section className="flex flex-col items-center justify-center min-h-[500px] border border-border/40 rounded-2xl bg-card shadow-sm p-8 text-center">
        <div className="rounded-2xl bg-primary/5 p-6 mb-6 border border-primary/10">
          <BarChart3 className="h-12 w-12 text-primary/40" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-3">Analytics Offline</h3>
        <p className="text-muted-foreground max-w-md leading-relaxed">
          Historical data processing, detailed usage insights, and chart visualizations will be fully implemented soon.
        </p>
      </section>
    </div>
  );
};

export default AnalyticsPage;
