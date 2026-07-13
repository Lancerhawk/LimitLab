import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { getClientById, type Client } from '../api/clients';
import { evaluateRateLimit, evaluateFixedWindowRateLimit, evaluateSlidingWindowRateLimit, evaluateSlidingLogRateLimit, evaluateLeakyBucketRateLimit } from '../api/rateLimit';
import { ArrowLeft, Copy, Check, Clock, Cpu, Activity, Play, RefreshCw, Zap, ShieldAlert, Terminal, Download, Code, Timer, AlertTriangle } from 'lucide-react';
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

  const [requestCount, setRequestCount] = useState<number | string>(1);
  const [delayMs, setDelayMs] = useState<number | string>(600);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [sessionStats, setSessionStats] = useState({ total: 0, allowed: 0, denied: 0 });
  const [, setAnimationTick] = useState(0);
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
  }, [id]);

  const isFixedWindow = client?.configuration?.algorithm === 'FIXED_WINDOW';
  const isSlidingWindow = client?.configuration?.algorithm === 'SLIDING_WINDOW';
  const isSlidingLog = client?.configuration?.algorithm === 'SLIDING_LOG';
  const isLeakyBucket = client?.configuration?.algorithm === 'LEAKY_BUCKET';

  useEffect(() => {
    if (!client?.configuration) return;

    if (isSlidingLog) {
      const interval = setInterval(() => {
        setAnimationTick(prev => prev + 1);
      }, 50);
      return () => clearInterval(interval);
    }

    if (isLeakyBucket) {
      if (!client?.leakyBucketState) return;
      const calculateLeakyBucketQueue = () => {
        const leakRate = client.configuration!.leakRate ?? 1;
        const queueLength = client.leakyBucketState!.queueLength;
        const lastLeakTime = new Date(client.leakyBucketState!.lastLeakTime);

        const elapsedMs = Math.max(0, Date.now() - lastLeakTime.getTime());
        const elapsedSeconds = elapsedMs / 1000;

        return Math.max(0, queueLength - (elapsedSeconds * leakRate));
      };

      setLiveTokens(calculateLeakyBucketQueue());
      const interval = setInterval(() => {
        setLiveTokens(calculateLeakyBucketQueue());
      }, 50);
      return () => clearInterval(interval);
    }

    if (isFixedWindow) {
      const limit = client.configuration!.requestsPerSecond ?? 10;

      const calculateFixedWindowTokens = () => {
        if (!client.windowState?.resetTime) return limit;

        const resetTimeMs = new Date(client.windowState.resetTime).getTime();
        if (Date.now() >= resetTimeMs) {
          return limit;
        }

        return Math.max(0, limit - (client.windowState.requestCount ?? 0));
      };

      setLiveTokens(calculateFixedWindowTokens());

      const interval = setInterval(() => {
        setLiveTokens(calculateFixedWindowTokens());
      }, 1000);

      return () => clearInterval(interval);
    }

    if (isSlidingWindow) {
      const limit = client.configuration!.requestsPerSecond ?? 10;

      const calculateSlidingWindowTokens = () => {
        if (!client.slidingWindowState?.resetTime) return limit;

        const now = Date.now();
        const durationMs = client.configuration!.windowDurationMs ?? 60000;
        const currentWindow = Math.floor(now / durationMs);

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

  const downloadScript = (language: 'node' | 'python' | 'bash', variant: 'ip' | 'client' | 'advanced') => {
    if (!client) return;

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

    const endpoint = isFixedWindow
      ? `${baseUrl}/rate-limit/fixed-window/memory`
      : isSlidingWindow
        ? `${baseUrl}/rate-limit/sliding-window/memory`
        : isSlidingLog
          ? `${baseUrl}/rate-limit/sliding-log/memory`
          : isLeakyBucket
            ? `${baseUrl}/rate-limit/leaky-bucket/memory`
            : `${baseUrl}/rate-limit/memory`;

    const limit = variant === 'client'
      ? (client.configuration?.burstSize ?? client.configuration?.requestsPerSecond ?? client.configuration?.queueCapacity ?? 10)
      : 10;

    const windowDurationS = variant === 'client'
      ? (client.configuration?.windowDurationMs ? client.configuration.windowDurationMs / 1000 : 60)
      : 60;

    const leakRate = variant === 'client' ? (client.configuration?.leakRate ?? 1) : 1;
    const refillRate = variant === 'client' ? (client.configuration?.refillRate ?? 1) : 1;

    const waitS = isFixedWindow || isSlidingWindow || isSlidingLog ? windowDurationS + 1 : isLeakyBucket ? Math.ceil(limit / Math.max(0.1, leakRate)) + 2 : Math.ceil(limit / Math.max(0.1, refillRate)) + 2;
    const waitMsg = isFixedWindow || isSlidingWindow || isSlidingLog ? 'for window to reset' : isLeakyBucket ? 'for queue to drain' : 'for refill';

    let content = '';
    let filename = '';
    const fileSuffix = variant === 'advanced' ? '_advanced' : variant === 'client' ? '_targeted' : '_basic_ip';

    if (language === 'node') {
      filename = `load_test${fileSuffix}.js`;
      const headerCode = variant === 'advanced' ? `, {\n      headers: { 'x-client-id': 'simulated-user-' + requestNumber },\n      validateStatus: () => true\n    }` : variant === 'client' ? `, {\n      headers: { 'x-client-id': '${client.apiKey}' },\n      validateStatus: () => true\n    }` : `, {\n      validateStatus: () => true\n    }`;
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

function printResults(name, results, expectedAllowed) {
  console.log(\`\n--- \${name} ---\`);
  const allowed = results.filter(r => r.decision === 'ALLOW').length;
  const denied = results.filter(r => r.decision === 'DENY').length;
  const expectedDenied = results.length - expectedAllowed;
  const pass = allowed === expectedAllowed && denied === expectedDenied;
  console.log(\`Allowed: \${allowed} (Expected: \${expectedAllowed})\`);
  console.log(\`Denied:  \${denied} (Expected: \${expectedDenied})\`);
  console.log(\`Status:  \${pass ? 'PASS ✅' : 'FAIL ❌'}\`);
  return pass;
}

async function run() {
  console.log(\`Starting tests against \${ENDPOINT}...\n\`);
  const results = [];

  results.push(printResults("TEST 1: ${limit} Simultaneous", await runSimultaneous(${limit}), ${limit}));
  console.log("Waiting ${waitS}s ${waitMsg}...");
  await new Promise(r => setTimeout(r, ${waitS * 1000}));

  results.push(printResults("TEST 2: ${limit + 1} Simultaneous", await runSimultaneous(${limit + 1}), ${limit}));
  console.log("Waiting ${waitS}s ${waitMsg}...");
  await new Promise(r => setTimeout(r, ${waitS * 1000}));

  results.push(printResults("TEST 3: ${limit * 2} Simultaneous", await runSimultaneous(${limit * 2}), ${limit}));
  console.log("Waiting ${waitS}s ${waitMsg}...");
  await new Promise(r => setTimeout(r, ${waitS * 1000}));

  results.push(printResults("TEST 4: ${limit + 5} Sequential (100ms delay)", await runSequential(${limit + 5}, 100), ${limit}));

  console.log('\n======================================');
  if (results.every(r => r)) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY 🎉');
  } else {
    console.log('💥 SOME TESTS FAILED 💥');
  }
}

run();
`;
    } else if (language === 'python') {
      filename = `load_test${fileSuffix}.py`;
      const headerCode = variant === 'advanced' ? `headers={'x-client-id': f'simulated-user-{i}'}` : variant === 'client' ? `headers={'x-client-id': '${client.apiKey}'}` : ``;
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

def print_results(name, results, expected_allowed):
    print(f"\\n--- {name} ---")
    allowed = results.count('ALLOW')
    denied = results.count('DENY')
    expected_denied = len(results) - expected_allowed
    passed = allowed == expected_allowed and denied == expected_denied
    print(f"Allowed: {allowed} (Expected: {expected_allowed})")
    print(f"Denied:  {denied} (Expected: {expected_denied})")
    print(f"Status:  {'PASS ✅' if passed else 'FAIL ❌'}")
    return passed

print(f"Starting tests against {ENDPOINT}...\\n")
test_results = []

test_results.append(print_results("TEST 1: ${limit} Simultaneous", run_simultaneous(${limit}), ${limit}))
print("Waiting ${waitS}s ${waitMsg}...")
time.sleep(${waitS})

test_results.append(print_results("TEST 2: ${limit + 1} Simultaneous", run_simultaneous(${limit + 1}), ${limit}))
print("Waiting ${waitS}s ${waitMsg}...")
time.sleep(${waitS})

test_results.append(print_results("TEST 3: ${limit * 2} Simultaneous", run_simultaneous(${limit * 2}), ${limit}))
print("Waiting ${waitS}s ${waitMsg}...")
time.sleep(${waitS})

test_results.append(print_results("TEST 4: ${limit + 5} Sequential (100ms delay)", run_sequential(${limit + 5}, 100), ${limit}))

print("\\n======================================")
if all(test_results):
    print("🎉 ALL TESTS PASSED SUCCESSFULLY 🎉")
else:
    print("💥 SOME TESTS FAILED 💥")
`;
    } else if (language === 'bash') {
      filename = `load_test${fileSuffix}.sh`;
      const headerCode = variant === 'advanced' ? ` -H "x-client-id: simulated-user-$i"` : variant === 'client' ? ` -H "x-client-id: ${client.apiKey}"` : ``;
      content = `#!/bin/bash
ENDPOINT="${endpoint}"

echo "Starting tests against $ENDPOINT..."

PASS_COUNT=0
TOTAL_TESTS=4

run_simultaneous() {
  local count=$1
  local expected_allowed=$2
  local test_name=$3
  echo -e "\\n--- $test_name ---"
  local allowed=0
  local denied=0
  local tmpdir=$(mktemp -d)
  for i in $(seq 1 $count); do
    (curl -s -X POST "$ENDPOINT"${headerCode} | grep -o '"decision":"[A-Z]*"' > "$tmpdir/r$i") &
  done
  wait
  for f in "$tmpdir"/r*; do
    if grep -q 'ALLOW' "$f" 2>/dev/null; then allowed=$((allowed+1)); else denied=$((denied+1)); fi
  done
  rm -rf "$tmpdir"
  local expected_denied=$((count - expected_allowed))
  echo "Allowed: $allowed (Expected: $expected_allowed)"
  echo "Denied:  $denied (Expected: $expected_denied)"
  if [ "$allowed" -eq "$expected_allowed" ] && [ "$denied" -eq "$expected_denied" ]; then
    echo "Status:  PASS ✅"
    PASS_COUNT=$((PASS_COUNT+1))
  else
    echo "Status:  FAIL ❌"
  fi
}

run_sequential() {
  local count=$1
  local expected_allowed=$2
  echo -e "\\n--- TEST 4: $count Sequential (100ms delay) ---"
  local allowed=0
  local denied=0
  for i in $(seq 1 $count); do
    result=$(curl -s -X POST "$ENDPOINT"${headerCode})
    if echo "$result" | grep -q '"decision":"ALLOW"'; then allowed=$((allowed+1)); else denied=$((denied+1)); fi
    sleep 0.1
  done
  local expected_denied=$((count - expected_allowed))
  echo "Allowed: $allowed (Expected: $expected_allowed)"
  echo "Denied:  $denied (Expected: $expected_denied)"
  if [ "$allowed" -eq "$expected_allowed" ] && [ "$denied" -eq "$expected_denied" ]; then
    echo "Status:  PASS ✅"
    PASS_COUNT=$((PASS_COUNT+1))
  else
    echo "Status:  FAIL ❌"
  fi
}

run_simultaneous ${limit} ${limit} "TEST 1: ${limit} Simultaneous"
echo -e "\\nWaiting ${waitS}s ${waitMsg}..."
sleep ${waitS}

run_simultaneous ${limit + 1} ${limit} "TEST 2: ${limit + 1} Simultaneous"
echo -e "\\nWaiting ${waitS}s ${waitMsg}..."
sleep ${waitS}

run_simultaneous ${limit * 2} ${limit} "TEST 3: ${limit * 2} Simultaneous"
echo -e "\\nWaiting ${waitS}s ${waitMsg}..."
sleep ${waitS}

run_sequential ${limit + 5} ${limit}

echo -e "\\n======================================"
if [ "$PASS_COUNT" -eq "$TOTAL_TESTS" ]; then
  echo "🎉 ALL TESTS PASSED SUCCESSFULLY 🎉"
else
  echo "💥 SOME TESTS FAILED 💥"
fi
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
        if (safeDelay > 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, safeDelay * i));
        }

        try {
          const evaluator = isFixedWindow
            ? evaluateFixedWindowRateLimit
            : isSlidingWindow
              ? evaluateSlidingWindowRateLimit
              : isSlidingLog
                ? evaluateSlidingLogRateLimit
                : isLeakyBucket
                  ? evaluateLeakyBucketRateLimit
                  : evaluateRateLimit;
          const response = await evaluator(client.apiKey, safeCount, safeDelay);

          const logEntry: RequestLog = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date(),
            decision: response.decision,
            remainingTokens: response.remainingTokens ?? response.remainingRequests ?? 0,
            retryAfter: response.retryAfter,
            status: response.decision === 'ALLOW' ? 200 : 429
          };

          setLogs(prev => {
            const newLogs = [logEntry, ...prev];
            return newLogs.slice(0, 1000);
          });

          setSessionStats(prev => ({
            total: prev.total + 1,
            allowed: prev.allowed + (response.decision === 'ALLOW' ? 1 : 0),
            denied: prev.denied + (response.decision === 'DENY' ? 1 : 0)
          }));

          setClient(prev => {
            if (!prev) return prev;

            if (isFixedWindow) {
              const limit = prev.configuration?.requestsPerSecond ?? 10;
              const durationMs = prev.configuration?.windowDurationMs ?? 60000;

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

            if (isSlidingLog) {
              const remaining = response.remainingRequests ?? 0;
              setLiveTokens(remaining);
              return prev;
            }

            if (isLeakyBucket) {
              const capacity = prev.configuration?.queueCapacity ?? 10;
              const leakRate = prev.configuration?.leakRate ?? 1;
              const queueLength = response.queueLength ?? 0;

              return {
                ...prev,
                leakyBucketState: {
                  ...prev.leakyBucketState,
                  capacity,
                  leakRate,
                  queueLength,
                  lastLeakTime: new Date().toISOString()
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
            return newLogs.slice(0, 1000);
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
    fetchClient();
  };

  if (loading || !client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  const capacity = isLeakyBucket
    ? (client.configuration?.queueCapacity || 10)
    : (isFixedWindow || isSlidingWindow || isSlidingLog)
      ? (client.configuration?.requestsPerSecond || 10)
      : (client.configuration?.burstSize || 10);
  let currentTokens = Math.floor(liveTokens);

  if (isSlidingLog) {
    const windowMs = client.configuration?.windowDurationMs ?? 60000;
    const limit = client.configuration?.requestsPerSecond ?? 10;
    const activeLogs = logs.filter(l => l.decision === 'ALLOW' && Date.now() - l.timestamp.getTime() < windowMs);
    currentTokens = Math.max(0, limit - activeLogs.length);
  } else if (isLeakyBucket) {
    currentTokens = Math.max(0, capacity - Math.floor(liveTokens));
  }
  const percentFull = Math.max(0, Math.min(100, (currentTokens / capacity) * 100));

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
                {(isFixedWindow || isSlidingWindow || isSlidingLog) ? (
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
                ) : isLeakyBucket ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2"><Cpu className="h-4 w-4" /> Queue Capacity</p>
                      <p className="font-semibold">{capacity} requests</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2"><Activity className="h-4 w-4" /> Leak Rate</p>
                      <p className="font-semibold">{client.configuration?.leakRate} / sec</p>
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

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-500 mb-2 flex items-center gap-2">
              About Request Timing
            </h4>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                This playground sends <strong>real HTTP requests</strong> to the backend. Each request travels through your browser, operating system, network stack, Node.js event loop, and database, all of which process work asynchronously. As a result, requests are never guaranteed to arrive at the backend at the exact same instant, regardless of the configured delay.
              </p>
              <p>
                To produce consistent, understandable results while manually testing the {isFixedWindow ? 'Fixed Window' : isSlidingWindow ? 'Sliding Window' : isSlidingLog ? 'Sliding Log' : isLeakyBucket ? 'Leaky Bucket' : 'Token Bucket'} algorithm, extremely small delays are intentionally restricted. This is <strong>not</strong> a limitation of the rate limiter itself. The implementation is fully correct. It is simply the nature of testing real HTTP requests over a real network stack.
              </p>
              <p className="text-blue-500/80 italic">
                A dedicated Traffic Simulator will be introduced in a future phase to demonstrate mathematically perfect traffic bursts, ideal algorithm behavior, and side-by-side algorithm comparisons without browser, network, or database timing effects.
              </p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-amber-500 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Public Sandbox Restrictions
            </h4>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                To prevent abuse, this deployed instance has strict global limits active:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Sandbox Burst Ceiling:</strong> The in-memory algorithms tested here are capped at an absolute maximum of <strong>500 requests per second</strong>.</li>
                <li><strong>Sandbox Sustained Limit:</strong> You may only perform a maximum of <strong>3,000 sandbox test requests per 15 minutes</strong> per IP address.</li>
                <li><strong>Global API Limit:</strong> All other backend interactions (creating clients, loading dashboards) are limited to <strong>100 requests per 15 minutes</strong> per IP address.</li>
              </ul>
              <p>
                If you exceed the ceiling during a burst test, your browser will receive a 429 Too Many Requests response from the global defender before the request even reaches your client's specific algorithm bucket.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            <div className="space-y-6">
              <div className="space-y-4 p-5 rounded-xl border border-border/50 bg-muted/10">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endpoint target</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-muted text-muted-foreground text-sm font-semibold">
                      POST
                    </span>
                    <code className="flex-1 px-3 py-2 rounded-none rounded-r-md border border-border bg-background text-sm text-muted-foreground">
                      {isFixedWindow ? '/api/v1/rate-limit/fixed-window' : isSlidingWindow ? '/api/v1/rate-limit/sliding-window' : isSlidingLog ? '/api/v1/rate-limit/sliding-log' : isLeakyBucket ? '/api/v1/rate-limit/leaky-bucket' : '/api/v1/rate-limit'}
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
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {isFixedWindow ? 'Fixed Window Capacity' : isSlidingWindow ? 'Sliding Window Allowance' : isSlidingLog ? 'Sliding Log Capacity' : isLeakyBucket ? 'Leaky Bucket Queue Space' : 'Live Bucket State'}
                  </h3>
                  <div className="text-xl font-bold font-mono">
                    {currentTokens} <span className="text-sm text-muted-foreground font-normal">/ {capacity}</span>
                  </div>
                </div>

                {isSlidingLog ? (
                  <div className="relative w-full h-16 bg-[#0a0a0a] rounded-xl border border-border overflow-hidden shadow-inner flex flex-col justify-center">
                    {/* Background Grid for Timeline */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10%, var(--border) 10%, var(--border) 10.5%)' }} />

                    {/* Time markers */}
                    <div className="absolute top-1 right-2 text-[9px] text-teal-500/70 font-mono tracking-widest font-bold z-20">NOW</div>
                    <div className="absolute top-1 left-2 text-[9px] text-destructive/70 font-mono tracking-widest font-bold z-20">EXPIRE</div>

                    {/* Expiration Edge */}
                    <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-destructive/20 to-transparent z-10 pointer-events-none" />

                    {/* Entry Edge */}
                    <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-teal-500/10 to-transparent z-10 pointer-events-none" />

                    {/* Sliding Logs */}
                    <div className="absolute inset-0 top-5 bottom-3 px-1">
                      {logs.filter(l => l.decision === 'ALLOW').map((log) => {
                        const ageMs = Date.now() - log.timestamp.getTime();
                        const windowMs = client.configuration?.windowDurationMs ?? 60000;
                        if (ageMs > windowMs) return null;

                        const rightPercent = (ageMs / windowMs) * 100;

                        return (
                          <div
                            key={log.id}
                            className="absolute inset-y-0 flex items-center justify-center bg-teal-500/20 border border-teal-500 rounded shadow-[0_0_12px_rgba(20,184,166,0.4)] transition-all ease-linear"
                            style={{
                              right: `${rightPercent}%`,
                              width: 'clamp(8px, 3%, 24px)',
                              transitionDuration: '50ms'
                            }}
                          >
                            <div className="h-1/2 w-0.5 bg-teal-300 rounded-full opacity-50" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : isFixedWindow ? (
                  <div className="flex w-full h-8 bg-muted/50 rounded-lg border border-border overflow-hidden relative shadow-inner">
                    {Array.from({ length: Math.min(capacity, 50) }).map((_, i) => (
                      <div key={i} className={`flex-1 border-r border-border/50 last:border-0 transition-colors duration-200 ${i < currentTokens ? 'bg-amber-500' : 'bg-transparent'}`} />
                    ))}
                  </div>
                ) : isSlidingWindow ? (
                  <div className="h-8 w-full bg-muted/50 rounded-lg border border-border overflow-hidden relative shadow-inner">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300"
                      style={{ width: `${percentFull}%` }}
                    />
                  </div>
                ) : isLeakyBucket ? (
                  <div className="flex w-full h-12 bg-[#0a0a0a] rounded-lg border border-border overflow-hidden relative shadow-inner p-1 gap-1 items-end justify-start rotate-180">
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(0deg, var(--border) 1px, transparent 1px)', backgroundSize: '100% 8px' }} />
                    <div className="absolute top-0 right-0 p-1 text-[8px] text-muted-foreground font-mono rotate-180 z-20">OUT (LEAK)</div>
                    <div className="absolute bottom-0 right-0 p-1 text-[8px] text-muted-foreground font-mono rotate-180 z-20">IN</div>

                    {Array.from({ length: Math.min(capacity, 50) }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm transition-all duration-300 ${i < Math.ceil(liveTokens) ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)] h-[90%]' : 'bg-muted/30 border border-border/50 h-[30%]'}`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="h-8 w-full bg-muted/50 rounded-lg border border-border overflow-hidden relative shadow-inner">
                    <div
                      className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${percentFull}%` }}
                    />
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-right">
                  {isFixedWindow ? 'Visualization represents remaining requests before the rigid window resets.' : isSlidingWindow ? 'Visualization represents remaining requests based on overlapping window estimation.' : isSlidingLog ? 'Visualization represents exact available spots in the sliding time window.' : isLeakyBucket ? 'Visualization represents requests in the queue waiting to leak out at a constant rate.' : 'Visualization represents currently available tokens in the bucket.'}
                </p>
                {isSlidingLog && (
                  <p className="text-[10px] text-amber-500/70 text-right mt-1 font-medium">
                    Note: This visualizer uses local browser history to animate at 60fps. Reloading the page clears the animation, but the backend database limit remains fully active!
                  </p>
                )}
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
                    {isFixedWindow ? '/api/v1/rate-limit/fixed-window/memory' : isSlidingWindow ? '/api/v1/rate-limit/sliding-window/memory' : isSlidingLog ? '/api/v1/rate-limit/sliding-log/memory' : isLeakyBucket ? '/api/v1/rate-limit/leaky-bucket/memory' : '/api/v1/rate-limit/memory'}
                  </code>
                </div>
                {isFixedWindow || isSlidingWindow || isSlidingLog ? (
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
        title={`Download ${isFixedWindow ? 'Fixed Window' : isSlidingWindow ? 'Sliding Window' : isSlidingLog ? 'Sliding Log' : isLeakyBucket ? 'Leaky Bucket' : 'Token Bucket'} Scripts`}
        description="Choose a pre-configured load testing script. You can run these from your local terminal to see the rate limiter in action."
        className="max-w-2xl"
      >
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 mt-2">
          <p className="text-xs text-amber-600 font-medium flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span><strong>Sandbox Limits:</strong> All downloaded scripts hit the /memory endpoints which are protected by a global <strong>500 req/sec burst limit</strong> and a <strong>3,000 req/15min sustained limit</strong>. If you run multiple scripts simultaneously and exceed 500 requests within a single second, the global sandbox defender will instantly block the excess traffic.</span>
          </p>
        </div>

        <div className="space-y-6 mt-2">
          <div className="space-y-3 p-4 border border-border/50 rounded-lg bg-card">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Basic Sandbox Script (IP-Based)
            </h4>
            <p className="text-sm text-muted-foreground">
              A standalone test script that hits the in-memory endpoint using your local IP address. <strong>No client headers are sent.</strong>
              {isLeakyBucket && " Watch how requests queue up and smoothly leak out."}
              Use this script to safely verify global rate-limiting behavior without affecting this specific client's bucket state.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => downloadScript('node', 'ip')}>Node.js</Button>
              <Button variant="outline" className="flex-1" onClick={() => downloadScript('python', 'ip')}>Python</Button>
              <Button variant="outline" className="flex-1" onClick={() => downloadScript('bash', 'ip')}>Bash</Button>
            </div>
          </div>

          <div className="space-y-3 p-4 border border-border/50 rounded-lg bg-card">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Targeted Sandbox Script (Client ID)
            </h4>
            <p className="text-sm text-muted-foreground">
              This targeted script automatically injects <code className="text-xs bg-background px-1 py-0.5 rounded border">x-client-id: {client.id}</code> into every request.
              Use this script to precisely validate the exact configuration, capacity limits, and refill/leak behavior assigned to this specific client.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => downloadScript('node', 'client')}>Node.js</Button>
              <Button variant="outline" className="flex-1" onClick={() => downloadScript('python', 'client')}>Python</Button>
              <Button variant="outline" className="flex-1" onClick={() => downloadScript('bash', 'client')}>Bash</Button>
            </div>
          </div>

          <div className="space-y-3 p-4 border border-primary/20 rounded-lg bg-primary/5">
            <h4 className="font-semibold text-primary flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Advanced Multi-Client Script (Simulated Users)
            </h4>
            <p className="text-sm text-muted-foreground">
              A high-concurrency simulation that dynamically injects unique <code className="text-xs bg-background px-1 py-0.5 rounded border">x-client-id</code> headers per request.
              This simulates hundreds of <strong>completely distinct users</strong> hitting the {isSlidingLog ? 'Sliding Log' : isSlidingWindow ? 'Sliding Window' : isFixedWindow ? 'Fixed Window' : isLeakyBucket ? 'Leaky Bucket' : 'Token Bucket'} algorithm simultaneously.
              Essential for verifying memory isolation and concurrency safety under heavy load. Note: This script respects the global 500 req/sec sandbox ceiling.
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
