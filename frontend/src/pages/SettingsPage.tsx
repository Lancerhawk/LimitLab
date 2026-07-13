import { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Shield, KeyRound, Save } from 'lucide-react';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

const SettingsPage = () => {
  const [adminKey, setAdminKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('adminKey');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedKey) setAdminKey(savedKey);
  }, []);

  const handleSave = async () => {
    if (!adminKey.trim()) return;

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 600));

    localStorage.setItem('adminKey', adminKey.trim());
    toast.success('Developer Mode Enabled');
    setIsSaving(false);
  };

  const handleDisable = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 400));

    localStorage.removeItem('adminKey');
    setAdminKey('');
    toast.success('Developer Mode Disabled');
    setIsSaving(false);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Configure global application preferences and developer access."
      />

      <div className="max-w-3xl space-y-6">
        {/* Developer Mode Card */}
        <section className="border border-border/40 rounded-2xl bg-card shadow-sm p-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Shield className="w-48 h-48" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6 border-b border-border/40 pb-4">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Developer Mode</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Unlock administrative features to create and delete clients</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  Admin Key
                </label>
                <div className="flex gap-3">
                  <input
                    type="password"
                    placeholder="Enter x-admin-key..."
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  />
                  <Button
                    onClick={handleSave}
                    className="flex items-center gap-2"
                    isLoading={isSaving}
                    disabled={!adminKey.trim()}
                  >
                    <Save className="w-4 h-4" />
                    Save Settings
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisable}
                    isLoading={isSaving}
                    disabled={!adminKey.trim() && !localStorage.getItem('adminKey')}
                  >
                    Disable
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  <strong>Note for visitors:</strong> If you enter a key here, the UI will unlock the Create/Delete buttons. However, your key is strictly verified by the backend when you actually attempt to submit a change. If your key does not match the server's environment variable, your request will be blocked and rejected (401 Unauthorized). Standard users do not need a key to run load tests.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
