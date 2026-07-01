import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Card, CardContent } from '../components/ui/Card';
import { Users, Plus, Key, Trash2, Cpu, Activity, Clock, Pencil, AlertTriangle } from 'lucide-react';
import { getClients, createClient, updateClient, deleteClient, type Client } from '../api/clients';

const ClientsPage = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Selection State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [refillRate, setRefillRate] = useState('0.1');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await getClients();
      setClients(data);
    } catch (error) {
      console.error('Failed to fetch clients', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCapacity('10');
    setRefillRate('0.1');
    setSelectedClient(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setSelectedClient(client);
    setName(client.name);
    setDescription(client.description || '');
    setCapacity(client.configuration?.burstSize.toString() || '10');
    setRefillRate(client.configuration?.refillRate.toString() || '0.1');
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (client: Client) => {
    setSelectedClient(client);
    setIsDeleteModalOpen(true);
  };

  const handleCreateClient = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createClient({
        name,
        description,
        capacity: parseInt(capacity),
        refillRate: parseFloat(refillRate),
      });
      setIsCreateModalOpen(false);
      resetForm();
      await fetchClients();
    } catch (error) {
      console.error('Failed to create client', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setIsSubmitting(true);
    try {
      await updateClient(selectedClient.id, {
        name,
        description,
        capacity: parseInt(capacity),
        refillRate: parseFloat(refillRate),
      });
      setIsEditModalOpen(false);
      resetForm();
      await fetchClients();
    } catch (error) {
      console.error('Failed to update client', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;
    setIsSubmitting(true);
    try {
      await deleteClient(selectedClient.id);
      setIsDeleteModalOpen(false);
      resetForm();
      await fetchClients();
    } catch (error) {
      console.error('Failed to delete client', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader 
          title="Clients" 
          description="Manage API keys and rate limit configurations for your consumers." 
        />
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Client
        </Button>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      ) : clients.length === 0 ? (
        <section className="flex flex-col items-center justify-center min-h-[500px] border border-border/40 rounded-2xl bg-card shadow-sm p-8 text-center">
          <div className="rounded-2xl bg-primary/5 p-6 mb-6 border border-primary/10">
            <Users className="h-12 w-12 text-primary/40" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-3">No clients configured</h3>
          <p className="text-muted-foreground max-w-md leading-relaxed mb-6">
            You don't have any clients configured yet. Create a client to generate an API key and start rate limiting traffic.
          </p>
          <Button onClick={handleOpenCreate}>Create First Client</Button>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="border-border/50 shadow-sm transition-all hover:border-primary/30 group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="pr-2">
                    <h3 className="font-semibold text-lg">{client.name}</h3>
                    {client.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{client.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity -mr-2 -mt-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(client)} className="text-muted-foreground hover:text-primary h-8 w-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDelete(client)} className="text-muted-foreground hover:text-destructive h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                    <Key className="h-4 w-4 text-primary/70 shrink-0" />
                    <code className="text-xs font-mono text-muted-foreground truncate" title={client.apiKey}>
                      {client.apiKey}
                    </code>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Capacity:</span>
                      <span className="font-medium">{client.configuration?.burstSize}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/70 ml-1.5 mr-1" />
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-medium">{client.bucketState?.remainingTokens != null ? Math.floor(client.bucketState.remainingTokens) : 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Refill:</span>
                      <span className="font-medium">{client.configuration?.refillRate}/s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ml-1.5 mr-1 ${client.isActive ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium">{client.isActive ? 'Active' : 'Disabled'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Last request: {client.statistics?.lastRequestTime ? new Date(client.statistics.lastRequestTime).toLocaleString() : 'Never'}
                    </div>
                    <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => navigate(`/clients/${client.id}`)}>
                      Test API
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Create New Client"
        description="Configure a new consumer with an API key and rate limits."
      >
        <form onSubmit={handleCreateClient} className="space-y-5 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Client Name</label>
            <Input placeholder="e.g. Mobile App" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (Optional)</label>
            <Input placeholder="Internal iOS application" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bucket Capacity</label>
              <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required disabled={isSubmitting} />
              <p className="text-xs text-muted-foreground">Maximum burst requests.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Refill Rate (Tokens/sec)</label>
              <Input type="number" min="0.01" step="0.01" value={refillRate} onChange={(e) => setRefillRate(e.target.value)} required disabled={isSubmitting} />
              <p className="text-xs text-muted-foreground">Tokens added per second. (e.g., 0.1 = 1 token every 10s)</p>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border/50 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Client'}</Button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title="Edit Client Configuration"
        description={`Update settings for ${selectedClient?.name}`}
      >
        <form onSubmit={handleEditClient} className="space-y-5 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Client Name</label>
            <Input placeholder="e.g. Mobile App" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (Optional)</label>
            <Input placeholder="Internal iOS application" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bucket Capacity</label>
              <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required disabled={isSubmitting} />
              <p className="text-xs text-muted-foreground">Maximum burst requests.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Refill Rate (Tokens/sec)</label>
              <Input type="number" min="0.01" step="0.01" value={refillRate} onChange={(e) => setRefillRate(e.target.value)} required disabled={isSubmitting} />
              <p className="text-xs text-muted-foreground">Tokens added per second. (e.g., 0.1 = 1 token every 10s)</p>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border/50 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>

      {/* DELETE MODAL */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Delete Client"
      >
        <div className="pt-2">
          <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 mb-6">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm">This action cannot be undone. All API keys and rate limit history for <strong>{selectedClient?.name}</strong> will be permanently destroyed.</p>
          </div>
          <div className="flex justify-end gap-3 border-t border-border/50 pt-6">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteClient} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Yes, Delete Client'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientsPage;
