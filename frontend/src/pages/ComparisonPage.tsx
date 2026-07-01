import { PageHeader } from '../components/common/PageHeader';
import { SlidersHorizontal } from 'lucide-react';

const ComparisonPage = () => {
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Algorithm Comparison" 
        description="Run multiple algorithms side-by-side to compare behavior and performance." 
      />
      
      <section className="flex flex-col items-center justify-center min-h-[500px] border border-border/40 rounded-2xl bg-card shadow-sm p-8 text-center">
        <div className="rounded-2xl bg-primary/5 p-6 mb-6 border border-primary/10">
          <SlidersHorizontal className="h-12 w-12 text-primary/40" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-3">No comparisons active</h3>
        <p className="text-muted-foreground max-w-md leading-relaxed">
          The side-by-side algorithm comparison charts and metrics panel will be fully implemented soon.
        </p>
      </section>
    </div>
  );
};

export default ComparisonPage;
