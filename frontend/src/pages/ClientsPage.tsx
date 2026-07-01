import { PageHeader } from '../components/common/PageHeader';
import { Users } from 'lucide-react';

const ClientsPage = () => {
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Clients" 
        description="Manage API keys and rate limit configurations for your consumers." 
      />
      
      <section className="flex flex-col items-center justify-center min-h-[500px] border border-border/40 rounded-2xl bg-card shadow-sm p-8 text-center">
        <div className="rounded-2xl bg-primary/5 p-6 mb-6 border border-primary/10">
          <Users className="h-12 w-12 text-primary/40" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-3">No clients configured</h3>
        <p className="text-muted-foreground max-w-md leading-relaxed">
          The clients management table, API key generation, and per-client configurations will be implemented soon.
        </p>
      </section>
    </div>
  );
};

export default ClientsPage;
