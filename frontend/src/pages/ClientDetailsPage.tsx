import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { getClientById, type Client } from '../api/clients';
import { evaluateRateLimit, evaluateFixedWindowRateLimit, evaluateSlidingWindowRateLimit } from '../api/rateLimit';
import { ArrowLeft, Copy, Check, Clock, Cpu, Activity, Play, RefreshCw, Zap, ShieldAlert, Terminal, Download, Code, Timer } from 'lucide-react';
import toast from 'react-hot-toast';

interface RequestLog {
  id: string;
  timestamp: Date;
  decision: 'ALLOW' | 'DENY';
  remainingTokens: number;
  retryAfter?: number;
  status: number;
}

const ClientDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  // Playground State
  const [requestCount, setRequestCount] = useState<number | string>(1);
  const [delayMs, setDelayMs] = useState<number | string>(600);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [sessionStats, setSessionStats] = useState({ total: 0, allowed: 0, denied: 0 });
  const [liveTokens, setLiveTokens] = useState<number>(0);


  const fetchClient = async () => {
    if (!id) return;
    try {
      const data = await getClientById(id);
      setClient(data);
    } catch (error) {
      console.error('Failed to fetch client', error);
      toast.error('Failed to load client details');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isFixedWindow = client?.configuration?.algorithm === 'FIXED_WINDOW';
  const isSlidingWindow = client?.configuration?.algorithm === 'SLIDING_WINDOW';

  useEffect(() => {
    if (!client?.configuration) return;

    if (isFixedWindow) {
      const limit = client.configuration!.requestsPerSecond ?? 10;

      const calculateFixedWindowTokens = () => {
        if (!client.windowState?.resetTime) return limit;

        const resetTimeMs = new Date(client.windowState.resetTime).getTime();
        if (Date.now() >= resetTimeMs) {
          return limit; // Window has passed, tokens are reset
        }

        return Math.max(0, limit - (client.windowState.requestCount ?? 0));
      };

      setLiveTokens(calculateFixedWindowTokens());

      const interval = setInterval(() => {
        setLiveTokens(calculateFixedWindowTokens());
      }, 1000); // Check every second to see if window expired

      return () => clearInterval(interval);
    }

    if (isSlidingWindow) {
      const limit = client.configuration!.requestsPerSecond ?? 10;

      const calculateSlidingWindowTokens = () => {
        if (!client.slidingWindowState?.resetTime) return limit;

        const now = Date.now();
        const durationMs = client.configuration!.windowDurationMs ?? 60000;
        const currentWindow = Math.floor(now / durationMs);
        
        // Note: resetTime is (currentWindow + 1) * durationMs when it was last saved
        const storedWindow = Math.floor((new Date(client.slidingWindowState.resetTime).getTime() - durationMs) / durationMs);

        let curCount = 0;
        let prevCount = 0;

        if (currentWindow === storedWindow) {
          curCount = client.slidingWindowState.requestCount ?? 0;
          prevCount = client.slidingWindowState.previousCount ?? 0;
        } else if (currentWindow === storedWindow + 1) {
          prevCount = client.slidingWindowState.requestCount ?? 0;
        }

        const elapsed = now - (currentWindow * durationMs);
        const overlap = Math.max(0, 1 - (elapsed / durationMs));
        const effectiveCount = curCount + (prevCount * overlap);

        return Math.max(0, limit - effectiveCount);
      };

      setLiveTokens(calculateSlidingWindowTokens());

      const interval = setInterval(() => {
        setLiveTokens(calculateSlidingWindowTokens());
      }, 1000);

      return () => clearInterval(interval);
    }

    if (!client?.bucketState) return;

    const calculateLiveTokens = () => {
      const capacity = client.configuration!.burstSize ?? 10;
      const refillRate = client.configuration!.refillRate ?? 1;
      const remainingTokens = client.bucketState!.remainingTokens;
      const lastRefillTime = new Date(client.bucketState!.lastRefillTime);

      const elapsedMs = Math.max(0, Date.now() - lastRefillTime.getTime());
      const elapsedSeconds = elapsedMs / 1000;

      return Math.min(capacity, remainingTokens + (elapsedSeconds * refillRate));
    };

    setLiveTokens(calculateLiveTokens());

    const interval = setInterval(() => {
      setLiveTokens(calculateLiveTokens());
    }, 50);

    return () => clearInterval(interval);
  }, [client]);

  const copyToClipboard = () => {
    if (!client) return;
    navigator.clipboard.writeText(client.apiKey);
    setCopied(true);
    toast.success('API Key copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadScript = (language: 'node' | 'python' | 'bash', variant: 'basic' | 'advanced') => {
    if (!client) return;

    const endpoint = isFixedWindow
      ? 'http://localhost:3001/api/v1/rate-limit/fixed-window/memory'
      : isSlidingWindow 
      ? 'http://localhost:3001/api/v1/rate-limit/sliding-window/memory'
      : 'http://localhost:3001/api/v1/rate-limit/memory';
    const waitS = isFixedWindow || isSlidingWindow ? 61 : 12;
    const waitMsg = isFixedWindow || isSlidingWindow ? 'for window to reset' : 'for refill';
    
    let content = '';
    let filename = '';
    const fileSuffix = variant === 'advanced' ? '_advanced' : '_basic';

    if (language === 'node') {
      filename = `load_test${fileSuffix}.js`;
      const headerCode = variant === 'advanced' ? `, {\n      headers: { 'x-client-id': 'simulated-user-' + requestNumber },\n      validateStatus: () => true\n    }` : `, {\n      validateStatus: () => true\n    }`;
      content = `const axios = require('axios');

const ENDPOINT = '${endpoint}';

async function sendRequest(requestNumber) {
  const start = Date.now();
  try {
    const res = await axios.post(ENDPOINT, {}${headerCode});
    return { req: requestNumber, status: res.status, decision: res.data.decision, latency: Date.now() - start };
  } catch (err) {
    return { req: requestNumber, status: 0, decision: 'ERROR', latency: Date.now() - start };
  }
}

async function runSimultaneous(count) {
  const promises = [];
  for (let i = 1; i <= count; i++) promises.push(sendRequest(i));
  return Promise.all(promises);
}

async function runSequential(count, delayMs) {
  const results = [];
  for (let i = 1; i <= count; i++) {
    results.push(await sendRequest(i));
    if (i < count) await new Promise(r => setTimeout(r, delayMs));
  }
  return results;
}

function printResults(name, results) {
  console.log(\`\\n--- \${name} ---\`);
  const allowed = results.filter(r => r.decision === 'ALLOW').length;
  const denied = results.filter(r => r.decision === 'DENY').length;
  console.log(\`Allowed: \${allowed}, Denied: \${denied}\`);
}

async function run() {
  console.log(\`Starting tests against \${ENDPOINT}...\\n\`);

  printResults("TEST 1: 10 Simultaneous", await runSimultaneous(10));
  console.log("Waiting ${waitS}s ${waitMsg}...");
  await new Promise(r => setTimeout(r, ${waitS * 1000}));

  printResults("TEST 2: 11 Simultaneous", await runSimultaneous(11));
  console.log("Waiting ${waitS}s ${waitMsg}...");
  await new Promise(r => setTimeout(r, ${waitS * 1000}));

  printResults("TEST 3: 20 Simultaneous", await runSimultaneous(20));
  console.log("Waiting ${waitS}s ${waitMsg}...");
  await new Promise(r => setTimeout(r, ${waitS * 1000}));

  printResults("TEST 4: 15 Sequential (100ms delay)", await runSequential(15, 100));
}

run();
`;
    } else if (language === 'python') {
      filename = `load_test${fileSuffix}.py`;
      const headerCode = variant === 'advanced' ? `headers={'x-client-id': f'simulated-user-{i}'}` : ``;
      content = `import requests
import concurrent.futures
import time

ENDPOINT = '${endpoint}'

def send_request(i):
    try:
        res = requests.post(ENDPOINT${headerCode ? `, ${headerCode}` : ''})
        return res.json().get('decision', 'DENY' if res.status_code == 429 else 'ALLOW')
    except Exception:
        return 'ERROR'

def run_simultaneous(count):
    with concurrent.futures.ThreadPoolExecutor(max_workers=count) as executor:
        return list(executor.map(send_request, range(1, count + 1)))

def run_sequential(count, delay_ms):
    results = []
    for i in range(1, count + 1):
        results.append(send_request(i))
        if i < count:
            time.sleep(delay_ms / 1000.0)
    return results

def print_results(name, results):
    print(f"\\n--- {name} ---")
    allowed = results.count('ALLOW')
    denied = results.count('DENY')
    print(f"Allowed: {allowed}, Denied: {denied}")

print(f"Starting tests against {ENDPOINT}...\\n")

print_results("TEST 1: 10 Simultaneous", run_simultaneous(10))
print("Waiting ${waitS}s ${waitMsg}...")
time.sleep(${waitS})

print_results("TEST 2: 11 Simultaneous", run_simultaneous(11))
print("Waiting ${waitS}s ${waitMsg}...")
time.sleep(${waitS})

print_results("TEST 3: 20 Simultaneous", run_simultaneous(20))
print("Waiting ${waitS}s ${waitMsg}...")
time.sleep(${waitS})

print_results("TEST 4: 15 Sequential (100ms delay)", run_sequential(15, 100))
`;
    } else if (language === 'bash') {
      filename = `load_test${fileSuffix}.sh`;
      const headerCode = variant === 'advanced' ? ` -H "x-client-id: simulated-user-$i"` : ``;
      content = `#!/bin/bash
ENDPOINT="${endpoint}"

echo "Starting tests against $ENDPOINT..."

run_simultaneous() {
  echo -e "\\n--- TEST: $1 Simultaneous ---"
  for i in $(seq 1 $1); do
    curl -s -X POST "$ENDPOINT"${headerCode} &
  done
  wait
  echo -e "\\nDone."
}

run_sequential() {
  echo -e "\\n--- TEST: $1 Sequential (100ms delay) ---"
  for i in $(seq 1 $1); do
    curl -s -X POST "$ENDPOINT"${headerCode}
    echo ""
    sleep 0.1
  done
}

run_simultaneous 10
echo -e "\\nWaiting ${waitS}s ${waitMsg}..."
sleep ${waitS}

run_simultaneous 11
echo -e "\\nWaiting ${waitS}s ${waitMsg}..."
sleep ${waitS}

run_simultaneous 20
echo -e "\\nWaiting ${waitS}s ${waitMsg}..."
sleep ${waitS}

run_sequential 15
`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
    setIsDownloadModalOpen(false);
  };

  const handleExecuteRequests = async (count: number) => {
    if (!client) return;
    setIsExecuting(true);

    const safeCount = Math.min(Math.max(1, count), 100);
    const safeDelay = Math.min(Math.max(600, Number(delayMs) || 600), 60000);

    const promises = [];

    for (let i = 0; i < safeCount; i++) {
      const execute = async () => {
        // Stagger requests exactly by the delay amount, instead of waiting for network roundtrips
        if (safeDelay > 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, safeDelay * i));
        }

        try {
          const evaluator = isFixedWindow 
            ? evaluateFixedWindowRateLimit 
            : isSlidingWindow 
            ? evaluateSlidingWindowRateLimit 
            : evaluateRateLimit;
          const response = await evaluator(client.apiKey, safeCount, safeDelay);

          const logEntry: RequestLog = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date(),
            decision: response.decision,
            remainingTokens: response.remainingTokens,
            retryAfter: response.retryAfter,
            status: response.decision === 'ALLOW' ? 200 : 429
          };

          setLogs(prev => {
            const newLogs = [logEntry, ...prev];
            return newLogs.slice(0, 50); // Keep only last 50
          });

          setSessionStats(prev => ({
            total: prev.total + 1,
            allowed: prev.allowed + (response.decision === 'ALLOW' ? 1 : 0),
            denied: prev.denied + (response.decision === 'DENY' ? 1 : 0)
          }));

          // Update local client state for visualization instantly
          setClient(prev => {
            if (!prev) return prev;

            if (isFixedWindow) {
              const limit = prev.configuration?.requestsPerSecond ?? 10;
              const durationMs = prev.configuration?.windowDurationMs ?? 60000;

              // Calculate the correct current window reset time locally
              const now = Date.now();
              const currentWindow = Math.floor(now / durationMs);
              const calculatedResetTime = new Date((currentWindow + 1) * durationMs).toISOString();

              return {
                ...prev,
                windowState: {
                  ...prev.windowState,
                  requestCount: limit - response.remainingTokens,
                  currentWindow: currentWindow.toString(),
                  resetTime: response.resetTimestamp ? new Date(response.resetTimestamp * 1000).toISOString() : calculatedResetTime
                }
              };
            }

            if (isSlidingWindow) {
              const durationMs = prev.configuration?.windowDurationMs ?? 60000;
              const now = Date.now();
              const currentWindow = Math.floor(now / durationMs);
              const calculatedResetTime = new Date((currentWindow + 1) * durationMs).toISOString();
              
              const isNewWindow = prev.slidingWindowState?.currentWindow !== currentWindow.toString();
              const currentCount = isNewWindow ? 0 : (prev.slidingWindowState?.requestCount ?? 0);
              
              let previousCount = prev.slidingWindowState?.previousCount ?? 0;
              if (isNewWindow) {
                if (prev.slidingWindowState?.currentWindow === (currentWindow - 1).toString()) {
                  previousCount = prev.slidingWindowState.requestCount ?? 0;
                } else {
                  previousCount = 0;
                }
              }

              return {
                ...prev,
                slidingWindowState: {
                  ...prev.slidingWindowState,
                  requestCount: response.decision === 'ALLOW' ? currentCount + 1 : currentCount,
                  currentWindow: currentWindow.toString(),
                  previousWindow: (currentWindow - 1).toString(),
                  previousCount: previousCount,
                  resetTime: response.resetTimestamp ? new Date(response.resetTimestamp * 1000).toISOString() : calculatedResetTime
                }
              };
            }

            return {
              ...prev,
              bucketState: {
                ...prev.bucketState,
                remainingTokens: response.remainingTokens,
                currentCapacity: response.capacity,
                lastRefillTime: new Date().toISOString()
              }
            };
          });

        } catch (error: any) {
          const logEntry: RequestLog = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date(),
            decision: 'DENY',
            remainingTokens: 0,
            status: error.response?.status || 500
          };

          setLogs(prev => {
            const newLogs = [logEntry, ...prev];
            return newLogs.slice(0, 50);
          });

          setSessionStats(prev => ({
            total: prev.total + 1,
            allowed: prev.allowed,
            denied: prev.denied + 1
          }));
        }
      };

      promises.push(execute());
    }

    await Promise.all(promises);
    setIsExecuting(false);
  };

  const resetPlayground = () => {
    setLogs([]);
    setSessionStats({ total: 0, allowed: 0, denied: 0 });
    // Refetch client to get accurate state from DB
    fetchClient();
  };

  if (loading || !client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  const capacity = isFixedWindow
    ? (client.configuration?.requestsPerSecond || 10)
    : (client.configuration?.burstSize || 10);
  const currentTokens = Math.floor(liveTokens);
  const percentFull = Math.max(0, Math.min(100, (liveTokens / capacity) * 100));

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title={client.name}
          description={client.description || 'Client Configuration and Test Playground'}
          className="pb-0"
        />
      </div>

      {/* CLIENT DETAILS CARD */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
          <CardTitle className="text-lg flex justify-between items-center">
            Client Details
            <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${client.isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
              {client.isActive ? 'Active' : 'Disabled'}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">API Key</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded-md border border-border/50 flex-1 truncate">
                    {client.apiKey}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyToClipboard}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {isFixedWindow ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2"><Timer className="h-4 w-4" /> Window Duration</p>
                      <p className="font-semibold">{(client.configuration?.windowDurationMs || 60000) / 1000}s</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2"><Cpu className="h-4 w-4" /> Request Limit</p>
                      <p className="font-semibold">{client.configuration?.requestsPerSecond} requests</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2"><Cpu className="h-4 w-4" /> Capacity</p>
                      <p className="font-semibold">{capacity} tokens</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2"><Activity className="h-4 w-4" /> Refill Rate</p>
                      <p className="font-semibold">{client.configuration?.refillRate} / sec</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="hidden md:block w-px bg-border/50"></div>

            <div className="flex-1 space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Created At</p>
                <p className="font-medium text-sm">{new Date(client.createdAt).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Zap className="h-4 w-4" /> Last Request</p>
                <p className="font-medium text-sm">{client.statistics?.lastRequestTime ? new Date(client.statistics.lastRequestTime).toLocaleString() : 'Never'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* REQUEST PLAYGROUND */}
      <Card className="border-primary/20 shadow-sm border-2">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
          <CardTitle className="text-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-primary">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Request Playground
            </div>
            <span className="text-sm font-normal text-muted-foreground bg-background px-3 py-1 rounded-full border border-border">
              Developer Testing Playground
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">

          {/* Info Panel */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-500 mb-2 flex items-center gap-2">
              About Request Timing
            </h4>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                This playground sends <strong>real HTTP requests</strong> to the backend. Each request travels through your browser, operating system, network stack, Node.js event loop, and database, all of which process work asynchronously. As a result, requests are never guaranteed to arrive at the backend at the exact same instant, regardless of the configured delay.
              </p>
              <p>
                To produce consistent, understandable results while manually testing the {isFixedWindow ? 'Fixed Window' : 'Token Bucket'} algorithm, extremely small delays are intentionally restricted. This is <strong>not</strong> a limitation of the rate limiter itself. The implementation is fully correct. It is simply the nature of testing real HTTP requests over a real network stack.
              </p>
              <p className="text-blue-500/80 italic">
                A dedicated Traffic Simulator will be introduced in a future phase to demonstrate mathematically perfect traffic bursts, ideal algorithm behavior, and side-by-side algorithm comparisons without browser, network, or database timing effects.
              </p>
            </div>
          </div>

          {/* Controls & Visualizer Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Control Panel */}
            <div className="space-y-6">
              <div className="space-y-4 p-5 rounded-xl border border-border/50 bg-muted/10">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endpoint target</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-muted text-muted-foreground text-sm font-semibold">
                      POST
                    </span>
                    <code className="flex-1 px-3 py-2 rounded-none rounded-r-md border border-border bg-background text-sm text-muted-foreground">
                      {isFixedWindow ? '/api/v1/rate-limit/fixed-window' : '/api/v1/rate-limit'}
                    </code>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Request Count</label>
                    <Input
                      type="number"
                      min="1" max="100"
                      value={requestCount}
                      onChange={(e) => setRequestCount(e.target.value)}
                      onBlur={() => {
                        let val = Number(requestCount);
                        if (isNaN(val) || val < 1) val = 1;
                        if (val > 100) val = 100;
                        setRequestCount(val);
                      }}
                      disabled={isExecuting}
                      className={Number(requestCount) < 1 || Number(requestCount) > 100 ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {(Number(requestCount) < 1 || Number(requestCount) > 100) && (
                      <p className="text-xs text-destructive">Request count must be between 1 and 100.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Delay (ms)</label>
                    <Input
                      type="number"
                      min="600" max="60000"
                      value={delayMs}
                      onChange={(e) => setDelayMs(e.target.value)}
                      onBlur={() => {
                        let val = Number(delayMs);
                        if (isNaN(val) || val < 600) val = 600;
                        if (val > 60000) val = 60000;
                        setDelayMs(val);
                      }}
                      disabled={isExecuting}
                      className={Number(delayMs) < 600 || Number(delayMs) > 60000 ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {(Number(delayMs) < 600 || Number(delayMs) > 60000) && (
                      <p className="text-xs text-destructive">Delay must be between 600ms and 60000ms.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleExecuteRequests(Number(requestCount) || 1)}
                  disabled={isExecuting || Number(requestCount) < 1 || Number(requestCount) > 100 || Number(delayMs) < 600 || Number(delayMs) > 60000}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" /> Send Custom
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExecuteRequests(1)}
                  disabled={isExecuting || Number(delayMs) < 600 || Number(delayMs) > 60000}
                  className="w-full"
                >
                  Send 1 Request
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleExecuteRequests(10)}
                  disabled={isExecuting || Number(delayMs) < 600 || Number(delayMs) > 60000}
                  className="w-full"
                >
                  Send 10 Requests
                </Button>
                <Button variant="destructive" onClick={resetPlayground} disabled={isExecuting} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" /> Reset
                </Button>
              </div>
            </div>

            <div className="space-y-6">

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <h3 className="text-sm font-medium text-muted-foreground">{isFixedWindow ? 'Window Remaining' : 'Live Bucket State'}</h3>
                  <div className="text-xl font-bold font-mono">
                    {currentTokens} <span className="text-sm text-muted-foreground font-normal">/ {capacity}</span>
                  </div>
                </div>

                <div className="h-8 w-full bg-muted/50 rounded-lg border border-border overflow-hidden relative shadow-inner">
                  <div
                    className="absolute top-0 left-0 h-full bg-primary flex items-center justify-end px-2"
                    style={{ width: `${percentFull}%` }}
                  >
                  </div>
                  <div className="absolute inset-0 flex justify-between px-[1%] opacity-20 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent calc((100% / ${Math.min(capacity, 50)}) - 1px), var(--border) calc((100% / ${Math.min(capacity, 50)}) - 1px), var(--border) calc(100% / ${Math.min(capacity, 50)}))` }}>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {isFixedWindow ? 'Visualization represents remaining requests in current window.' : 'Visualization represents currently available tokens.'}
                </p>
              </div>

              {/* Session Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Sent</p>
                  <p className="text-2xl font-bold">{sessionStats.total}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider text-green-500/70">Allowed</p>
                  <p className="text-2xl font-bold text-green-500">{sessionStats.allowed}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider text-destructive/70">Denied</p>
                  <p className="text-2xl font-bold text-destructive">{sessionStats.denied}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Request Log */}
          <div className="mt-8 border border-border/50 rounded-xl overflow-hidden bg-[#0A0A0A]">
            <div className="bg-muted/10 px-4 py-2 border-b border-border/50 flex justify-between items-center">
              <span className="text-xs font-mono text-muted-foreground">Session Log (Last 50 requests)</span>
              {isExecuting && <span className="flex items-center gap-2 text-xs text-primary"><div className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Executing...</span>}
            </div>

            <div className="h-[250px] overflow-y-auto p-4 font-mono text-sm space-y-2">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 italic text-sm">
                  Waiting for requests...
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 py-1.5 border-b border-border/10 last:border-0 hover:bg-white/5 px-2 rounded transition-colors">
                    <span className="text-muted-foreground w-20 shrink-0 text-xs">{log.timestamp.toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 2 })}</span>

                    <span className={`w-16 shrink-0 font-bold ${log.decision === 'ALLOW' ? 'text-green-500' : 'text-destructive'}`}>
                      {log.decision}
                    </span>

                    <span className="w-12 shrink-0 text-center text-muted-foreground">
                      {log.status}
                    </span>

                    <span className="flex-1 text-muted-foreground">
                      Rem: <span className="text-foreground">{Math.floor(log.remainingTokens)}</span>
                      {log.retryAfter && (
                        <span className="ml-4 text-amber-500/80 text-xs">
                          <ShieldAlert className="h-3 w-3 inline mr-1 -mt-0.5" />
                          Retry in {log.retryAfter}s
                        </span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </CardContent>
      </Card>
      <Card className="border-primary/20 shadow-sm border-2 overflow-hidden relative">
        <div className="absolute -top-12 -right-12 p-3 opacity-[0.03] pointer-events-none">
          <Code className="h-64 w-64 text-primary" />
        </div>
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4 relative z-10">
          <CardTitle className="text-xl flex items-center gap-2 text-primary">
            <Zap className="h-5 w-5" />
            High-Performance Load Testing
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-foreground">In-Memory Testing Endpoint</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When performing high-throughput load tests or testing simultaneous bursts,
                you should use the dedicated <strong>In-Memory</strong> endpoint.
                Unlike the persistent PostgreSQL endpoint which relies on database networking
                and Optimistic Concurrency Control (OCC), the in-memory endpoint has
                <strong className="text-foreground"> virtually zero latency</strong> and perfectly handles simultaneous traffic spikes.
              </p>
              <div className="bg-muted/30 rounded-md border border-border/50 p-3 space-y-2 mt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Endpoint:</span>
                  <code className="text-primary font-semibold">
                    {isFixedWindow ? '/api/v1/rate-limit/fixed-window/memory' : isSlidingWindow ? '/api/v1/rate-limit/sliding-window/memory' : '/api/v1/rate-limit/memory'}
                  </code>
                </div>
                {isFixedWindow || isSlidingWindow ? (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Default Limit:</span>
                      <code className="text-foreground font-semibold">10 requests</code>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Default Window:</span>
                      <code className="text-foreground font-semibold">60 seconds</code>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Fixed Capacity:</span>
                      <code className="text-foreground font-semibold">10 tokens</code>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Fixed Refill Rate:</span>
                      <code className="text-foreground font-semibold">1 token / sec</code>
                    </div>
                  </>
                )}
              </div>

              <div className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 p-3 rounded-md mt-4">
                <span className="font-semibold text-blue-500">Note:</span> This is a pure sandbox environment. Requests made to this endpoint are <strong>not saved</strong> to the database and will not appear in your dashboard analytics. Buckets are isolated by IP address and automatically cleared after 30 minutes of inactivity.
              </div>
            </div>

            <div className="space-y-4 flex flex-col justify-center">
              <h3 className="font-semibold text-lg text-foreground text-center md:text-left">Download Test Scripts</h3>
              <p className="text-sm text-muted-foreground text-center md:text-left">
                Download a standalone, ready-to-run script pre-configured with this client's credentials. No external configuration required.
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <Button className="w-full" size="lg" onClick={() => setIsDownloadModalOpen(true)}>
                  <Download className="h-5 w-5 mr-2" /> Download Test Scripts
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        title={`Download ${isFixedWindow ? 'Fixed Window' : isSlidingWindow ? 'Sliding Window' : 'Token Bucket'} Scripts`}
        description="Choose the type of load testing script you want to download."
        className="max-w-2xl"
      >
        <div className="space-y-6 mt-4">
          <div className="space-y-3 p-4 border border-border/50 rounded-lg bg-card">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Basic Sandbox Script (IP-Based)
            </h4>
            <p className="text-sm text-muted-foreground">
              A perfectly isolated script that hits the in-memory endpoint using your IP address. 
              {isSlidingWindow && " Watch how your capacity smoothly regenerates over the window overlap."}
              {isFixedWindow && " Watch how requests are hard-blocked until the exact moment the window resets."}
              {!isFixedWindow && !isSlidingWindow && " Watch how your tokens are steadily refilled second by second."}
              Ideal for running simple local tests.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => downloadScript('node', 'basic')}>Node.js</Button>
              <Button variant="outline" className="flex-1" onClick={() => downloadScript('python', 'basic')}>Python</Button>
              <Button variant="outline" className="flex-1" onClick={() => downloadScript('bash', 'basic')}>Bash</Button>
            </div>
          </div>

          <div className="space-y-3 p-4 border border-primary/20 rounded-lg bg-primary/5">
            <h4 className="font-semibold text-primary flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Advanced Multi-Client Script (Simulated Users)
            </h4>
            <p className="text-sm text-muted-foreground">
              A high-performance script that injects unique <code className="text-xs bg-background px-1 py-0.5 rounded border">x-client-id</code> headers 
              to simulate hundreds of <strong>completely distinct users</strong> hammering the {isSlidingWindow ? 'Sliding Window' : isFixedWindow ? 'Fixed Window' : 'Token Bucket'} 
              algorithm at the exact same time. Essential for testing concurrent system isolation.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="default" className="flex-1" onClick={() => downloadScript('node', 'advanced')}>Node.js</Button>
              <Button variant="default" className="flex-1" onClick={() => downloadScript('python', 'advanced')}>Python</Button>
              <Button variant="default" className="flex-1" onClick={() => downloadScript('bash', 'advanced')}>Bash</Button>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default ClientDetailsPage;
