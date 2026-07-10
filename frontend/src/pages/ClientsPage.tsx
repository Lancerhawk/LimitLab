import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Card, CardContent } from '../components/ui/Card';
import { Users, Plus, Key, Trash2, Cpu, Activity, Clock, Pencil, AlertTriangle, Timer, ChevronDown } from 'lucide-react';
import { getClients, createClient, updateClient, deleteClient, type Client } from '../api/clients';

const ClientsPage = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [algorithm, setAlgorithm] = useState<'TOKEN_BUCKET' | 'FIXED_WINDOW' | 'SLIDING_WINDOW' | 'SLIDING_LOG' | 'LEAKY_BUCKET'>('TOKEN_BUCKET');
  const [capacity, setCapacity] = useState('10');
  const [refillRate, setRefillRate] = useState('0.1');
  const [windowDurationMs, setWindowDurationMs] = useState('60000');
  const [requestLimit, setRequestLimit] = useState('10');

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
    setAlgorithm('TOKEN_BUCKET');
    setCapacity('10');
    setRefillRate('0.1');
    setWindowDurationMs('60000');
    setRequestLimit('10');
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
    const algo = (client.configuration?.algorithm as 'TOKEN_BUCKET' | 'FIXED_WINDOW' | 'SLIDING_WINDOW' | 'SLIDING_LOG' | 'LEAKY_BUCKET') || 'TOKEN_BUCKET';
    setAlgorithm(algo);
    if (algo === 'TOKEN_BUCKET') {
      setCapacity(client.configuration?.burstSize?.toString() || '10');
      setRefillRate(client.configuration?.refillRate?.toString() || '0.1');
    } else if (algo === 'LEAKY_BUCKET') {
      setCapacity(client.configuration?.queueCapacity?.toString() || '10');
      setRefillRate(client.configuration?.leakRate?.toString() || '1');
    } else {
      setWindowDurationMs(client.configuration?.windowDurationMs?.toString() || '60000');
      setRequestLimit(client.configuration?.requestsPerSecond?.toString() || '10');
    }
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
      if (algorithm === 'TOKEN_BUCKET' || algorithm === 'LEAKY_BUCKET') {
        await createClient({
          name,
          description,
          algorithm,
          capacity: parseInt(capacity),
          refillRate: parseFloat(refillRate),
        });
      } else {
        await createClient({
          name,
          description,
          algorithm: algorithm,
          windowDurationMs: parseInt(windowDurationMs),
          requestLimit: parseInt(requestLimit),
        });
      }
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
      const algo = selectedClient.configuration?.algorithm || 'TOKEN_BUCKET';
      if (algo === 'TOKEN_BUCKET' || algo === 'LEAKY_BUCKET') {
        await updateClient(selectedClient.id, {
          name,
          description,
          capacity: parseInt(capacity),
          refillRate: parseFloat(refillRate),
        });
      } else {
        await updateClient(selectedClient.id, {
          name,
          description,
          windowDurationMs: parseInt(windowDurationMs),
          requestLimit: parseInt(requestLimit),
        });
      }
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

  const formatWindowDuration = (ms: number) => {
    if (ms >= 60000) return `${ms / 60000}m`;
    return `${ms / 1000}s`;
  };

  const renderAlgorithmFields = (mode: 'create' | 'edit') => {
    const currentAlgo = mode === 'edit' ? (selectedClient?.configuration?.algorithm || 'TOKEN_BUCKET') : algorithm;

    if (currentAlgo === 'TOKEN_BUCKET') {
      return (
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
      );
    }
    
    if (currentAlgo === 'LEAKY_BUCKET') {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Queue Capacity</label>
            <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required disabled={isSubmitting} />
            <p className="text-xs text-muted-foreground">Maximum spaces in the bucket queue.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Leak Rate (Req/sec)</label>
            <Input type="number" min="0.01" step="0.01" value={refillRate} onChange={(e) => setRefillRate(e.target.value)} required disabled={isSubmitting} />
            <p className="text-xs text-muted-foreground">Requests leaking out of the queue per second. (e.g., 0.1 = 1 req clears every 10s)</p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Window Duration</label>
          <div className="relative">
            <select
              className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={windowDurationMs}
              onChange={(e) => setWindowDurationMs(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="10000">10 seconds</option>
              <option value="30000">30 seconds</option>
              <option value="60000">60 seconds</option>
              <option value="300000">5 minutes</option>
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 opacity-50 pointer-events-none" />
          </div>
          <p className="text-xs text-muted-foreground">Length of each fixed time window.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Request Limit</label>
          <Input type="number" min="1" value={requestLimit} onChange={(e) => setRequestLimit(e.target.value)} required disabled={isSubmitting} />
          <p className="text-xs text-muted-foreground">Maximum requests allowed per window.</p>
        </div>
      </div>
    );
  };

  const renderClientCard = (client: Client) => {
    const algo = client.configuration?.algorithm || 'TOKEN_BUCKET';
    const isTokenBucket = algo === 'TOKEN_BUCKET';

    return (
      <Card key={client.id} className="border-border/50 shadow-sm transition-all hover:border-primary/30 group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="pr-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{client.name}</h3>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${isTokenBucket ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : algo === 'LEAKY_BUCKET' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : algo === 'SLIDING_WINDOW' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : algo === 'SLIDING_LOG' ? 'bg-teal-500/10 text-teal-500 border-teal-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                  {isTokenBucket ? 'Token Bucket' : algo === 'LEAKY_BUCKET' ? 'Leaky Bucket' : algo === 'SLIDING_WINDOW' ? 'Sliding Window' : algo === 'SLIDING_LOG' ? 'Sliding Log' : 'Fixed Window'}
                </span>
              </div>
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

            {isTokenBucket ? (
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
            ) : algo === 'LEAKY_BUCKET' ? (
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Queue Size:</span>
                  <span className="font-medium">{client.configuration?.queueCapacity}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-500/70 ml-1.5 mr-1" />
                  <span className="text-muted-foreground">Queued:</span>
                  <span className="font-medium">{client.leakyBucketState?.queueLength != null ? Math.floor(client.leakyBucketState.queueLength) : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Leak Rate:</span>
                  <span className="font-medium">{client.configuration?.leakRate}/s</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ml-1.5 mr-1 ${client.isActive ? 'bg-green-500' : 'bg-destructive'}`} />
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">{client.isActive ? 'Active' : 'Disabled'}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Window:</span>
                  <span className="font-medium">{formatWindowDuration(client.configuration?.windowDurationMs || 60000)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Limit:</span>
                  <span className="font-medium">{client.configuration?.requestsPerSecond} req</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500/70 ml-1.5 mr-1" />
                  <span className="text-muted-foreground">Count:</span>
                  <span className="font-medium">{algo === 'SLIDING_WINDOW' ? client.slidingWindowState?.requestCount ?? 'N/A' : algo === 'SLIDING_LOG' ? 'Log-based' : client.windowState?.requestCount ?? 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ml-1.5 mr-1 ${client.isActive ? 'bg-green-500' : 'bg-destructive'}`} />
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">{client.isActive ? 'Active' : 'Disabled'}</span>
                </div>
              </div>
            )}

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
    );
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
          {clients.map((client) => renderClientCard(client))}
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Algorithm</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAlgorithm('TOKEN_BUCKET')}
                disabled={isSubmitting}
                className={`p-3 rounded-lg border-2 text-left transition-all ${algorithm === 'TOKEN_BUCKET'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                  }`}
              >
                <p className="text-sm font-semibold">Token Bucket</p>
                <p className="text-xs text-muted-foreground mt-0.5">Smooth rate limiting with burst support</p>
              </button>
              <button
                type="button"
                onClick={() => setAlgorithm('FIXED_WINDOW')}
                disabled={isSubmitting}
                className={`p-3 rounded-lg border-2 text-left transition-all ${algorithm === 'FIXED_WINDOW'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                  }`}
              >
                <p className="text-sm font-semibold">Fixed Window</p>
                <p className="text-xs text-muted-foreground mt-0.5">Counter resets at fixed intervals</p>
              </button>
              <button
                type="button"
                onClick={() => setAlgorithm('SLIDING_WINDOW')}
                disabled={isSubmitting}
                className={`p-3 rounded-lg border-2 text-left transition-all ${algorithm === 'SLIDING_WINDOW'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                  }`}
              >
                <p className="text-sm font-semibold">Sliding Window</p>
                <p className="text-xs text-muted-foreground mt-0.5">Smooth rate limiting with overlapping intervals</p>
              </button>
              <button
                type="button"
                onClick={() => setAlgorithm('SLIDING_LOG')}
                disabled={isSubmitting}
                className={`p-3 rounded-lg border-2 text-left transition-all ${algorithm === 'SLIDING_LOG'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                  }`}
              >
                <p className="text-sm font-semibold">Sliding Log</p>
                <p className="text-xs text-muted-foreground mt-0.5">Highly accurate timestamp-based windowing</p>
              </button>
              <button
                type="button"
                onClick={() => setAlgorithm('LEAKY_BUCKET')}
                disabled={isSubmitting}
                className={`p-3 rounded-lg border-2 text-left transition-all col-span-2 sm:col-span-1 ${algorithm === 'LEAKY_BUCKET'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                  }`}
              >
                <p className="text-sm font-semibold">Leaky Bucket</p>
                <p className="text-xs text-muted-foreground mt-0.5">Strict traffic policing and smooth queuing</p>
              </button>
            </div>
          </div>

          {renderAlgorithmFields('create')}

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

          <div className="space-y-2">
            <label className="text-sm font-medium">Algorithm</label>
            <div className="px-3 py-2 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground">
              {selectedClient?.configuration?.algorithm === 'FIXED_WINDOW' ? 'Fixed Window' : selectedClient?.configuration?.algorithm === 'SLIDING_WINDOW' ? 'Sliding Window' : selectedClient?.configuration?.algorithm === 'SLIDING_LOG' ? 'Sliding Log' : selectedClient?.configuration?.algorithm === 'LEAKY_BUCKET' ? 'Leaky Bucket' : 'Token Bucket'}
              <span className="text-xs ml-2 italic">(Cannot be changed after creation)</span>
            </div>
          </div>

          {renderAlgorithmFields('edit')}

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
