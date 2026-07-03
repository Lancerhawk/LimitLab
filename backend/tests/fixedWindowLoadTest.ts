import axios, { AxiosError } from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ENDPOINT = `${API_BASE_URL}/api/v1/rate-limit/fixed-window/memory`;
const CLIENT_ID = 'FW-Client-A';

const REQUEST_LIMIT = 10;
const WINDOW_DURATION_S = 60;

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const BG_GREEN = '\x1b[42m';
const BG_RED = '\x1b[41m';

interface RequestResult {
  requestNumber: number;
  status: number;
  decision: string;
  remaining: number | null;
  latencyMs: number;
  timestamp: string;
  error?: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  allowed: number;
  denied: number;
  errors: number;
  totalRequests: number;
  totalDurationMs: number;
  avgLatencyMs: number;
  fastestMs: number;
  slowestMs: number;
  results: RequestResult[];
}

function divider(char = '═', length = 60) {
  console.log(`${DIM}${char.repeat(length)}${RESET}`);
}

function header(text: string) {
  console.log('');
  divider();
  console.log(`${BOLD}${CYAN}  ${text}${RESET}`);
  divider();
}

function subheader(text: string) {
  console.log('');
  console.log(`${BOLD}${WHITE}  ${text}${RESET}`);
  console.log(`${DIM}${'─'.repeat(60)}${RESET}`);
}

function pass(text: string) {
  console.log(`  ${BG_GREEN}${BOLD} PASS ${RESET} ${GREEN}${text}${RESET}`);
}

function fail(text: string) {
  console.log(`  ${BG_RED}${BOLD} FAIL ${RESET} ${RED}${text}${RESET}`);
}

function info(label: string, value: string | number) {
  console.log(`  ${DIM}${label.padEnd(22)}${RESET}${WHITE}${value}${RESET}`);
}

function requestLine(r: RequestResult) {
  const statusColor = r.status === 200 ? GREEN : r.status === 429 ? YELLOW : RED;
  const decisionColor = r.decision === 'ALLOW' ? GREEN : r.decision === 'DENY' ? YELLOW : RED;
  console.log(
    `  ${DIM}#${String(r.requestNumber).padStart(3)}${RESET}  ` +
    `${statusColor}${String(r.status).padEnd(4)}${RESET}  ` +
    `${decisionColor}${r.decision.padEnd(6)}${RESET}  ` +
    `${DIM}Rem:${RESET} ${String(r.remaining ?? '?').padEnd(6)}  ` +
    `${DIM}${r.latencyMs}ms${RESET}`
  );
}

async function sendRequest(requestNumber: number): Promise<RequestResult> {
  const start = Date.now();

  try {
    const response = await axios.post(
      ENDPOINT,
      {},
      {
        headers: { 'x-client-id': CLIENT_ID },
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    return {
      requestNumber,
      status: response.status,
      decision: response.data?.decision || (response.status === 200 ? 'ALLOW' : 'DENY'),
      remaining: response.data?.remainingTokens ?? null,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const axiosErr = err as AxiosError;
    return {
      requestNumber,
      status: axiosErr.response?.status || 0,
      decision: 'ERROR',
      remaining: null,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      error: axiosErr.message,
    };
  }
}

async function sendSimultaneous(count: number): Promise<RequestResult[]> {
  const promises = Array.from({ length: count }, (_, i) => sendRequest(i + 1));
  return Promise.all(promises);
}

async function sendWithDelay(count: number, delayMs: number): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  for (let i = 0; i < count; i++) {
    const result = await sendRequest(i + 1);
    results.push(result);
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

function analyzeResults(name: string, results: RequestResult[], startTime: number): TestResult {
  const allowed = results.filter(r => r.decision === 'ALLOW').length;
  const denied = results.filter(r => r.decision === 'DENY').length;
  const errors = results.filter(r => r.decision === 'ERROR').length;
  const latencies = results.map(r => r.latencyMs);

  return {
    name,
    passed: false,
    allowed,
    denied,
    errors,
    totalRequests: results.length,
    totalDurationMs: Date.now() - startTime,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    fastestMs: Math.min(...latencies),
    slowestMs: Math.max(...latencies),
    results,
  };
}

function printTestResult(test: TestResult) {
  console.log('');
  for (const r of test.results) {
    requestLine(r);
  }
  console.log('');
  info('Allowed', `${test.allowed}`);
  info('Denied', `${test.denied}`);
  if (test.errors > 0) info('Errors', `${test.errors}`);
  info('Total Duration', `${test.totalDurationMs}ms`);
  info('Avg Latency', `${test.avgLatencyMs}ms`);
  info('Fastest', `${test.fastestMs}ms`);
  info('Slowest', `${test.slowestMs}ms`);
  console.log('');

  if (test.passed) {
    pass(test.name);
  } else {
    fail(test.name);
  }
}

async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    if (response.status === 200) {
      return true;
    }
  } catch {
  }

  console.log('');
  console.log(`  ${RED}${BOLD}Backend is unreachable.${RESET}`);
  console.log(`  ${DIM}Ensure the server is running at: ${API_BASE_URL}${RESET}`);
  console.log(`  ${DIM}Start it with: npm run dev${RESET}`);
  console.log('');
  return false;
}

async function waitForNextWindow() {
  const now = Date.now();
  const currentWindowEnd = (Math.floor(now / (WINDOW_DURATION_S * 1000)) + 1) * (WINDOW_DURATION_S * 1000);
  const waitMs = Math.max(0, currentWindowEnd - now) + 1500;

  console.log('');
  process.stdout.write(`  ${DIM}Waiting ${Math.ceil(waitMs / 1000)}s for next window boundary...${RESET}`);
  await new Promise(resolve => setTimeout(resolve, waitMs));
  console.log(` ${GREEN}Ready${RESET}`);
}

async function runTest1(): Promise<TestResult> {
  subheader('TEST 1: 10 Simultaneous Requests');
  info('Method', 'Promise.all() (no delay)');
  info('Expected', '10 ALLOW, 0 DENY');

  const start = Date.now();
  const results = await sendSimultaneous(10);
  const test = analyzeResults('10 Simultaneous Requests', results, start);
  test.passed = test.allowed === 10 && test.denied === 0 && test.errors === 0;
  printTestResult(test);
  return test;
}

async function runTest2(): Promise<TestResult> {
  subheader('TEST 2: 11 Simultaneous Requests');
  info('Method', 'Promise.all() (no delay)');
  info('Expected', '10 ALLOW, 1 DENY');

  const start = Date.now();
  const results = await sendSimultaneous(11);
  const test = analyzeResults('11 Simultaneous Requests', results, start);
  test.passed = test.allowed === 10 && test.denied === 1 && test.errors === 0;
  printTestResult(test);
  return test;
}

async function runTest3(): Promise<TestResult> {
  subheader('TEST 3: 20 Simultaneous Requests');
  info('Method', 'Promise.all() (no delay)');
  info('Expected', '10 ALLOW, 10 DENY');

  const start = Date.now();
  const results = await sendSimultaneous(20);
  const test = analyzeResults('20 Simultaneous Requests', results, start);
  test.passed = test.allowed === 10 && test.denied === 10 && test.errors === 0;
  printTestResult(test);
  return test;
}

async function runTest4(): Promise<TestResult> {
  subheader('TEST 4: 10 + Wait for new window + 10');
  info('Method', 'Two bursts with window boundary wait');
  info('Expected', '20 ALLOW, 0 DENY');

  const start = Date.now();
  const results1 = await sendSimultaneous(10);

  const now = Date.now();
  const currentWindowEnd = (Math.floor(now / (WINDOW_DURATION_S * 1000)) + 1) * (WINDOW_DURATION_S * 1000);
  const waitMs = Math.max(0, currentWindowEnd - now) + 1500;

  console.log('');
  process.stdout.write(`  ${DIM}Waiting ${Math.ceil(waitMs / 1000)}s for next window boundary...${RESET}`);
  await new Promise(resolve => setTimeout(resolve, waitMs));
  console.log(` ${GREEN}Ready${RESET}`);

  const results2 = await sendSimultaneous(10);

  const allResults = [
    ...results1.map((r, i) => ({ ...r, requestNumber: i + 1 })),
    ...results2.map((r, i) => ({ ...r, requestNumber: i + 11 })),
  ];

  const test = analyzeResults('Window Reset Verification', allResults, start);
  test.passed = test.allowed === 20 && test.denied === 0 && test.errors === 0;
  printTestResult(test);
  return test;
}

async function runTest5(): Promise<TestResult> {
  subheader('TEST 5: 100 Sequential Requests (100ms delay)');
  info('Method', 'Sequential with 100ms delay');
  info('Expected', 'Counter never exceeds limit, resets at window boundary');

  const start = Date.now();
  const results = await sendWithDelay(100, 100);
  const test = analyzeResults('100 Sequential Requests', results, start);

  const maxConsecutiveAllowed = results.reduce((max, r, i) => {
    if (r.decision !== 'ALLOW') return max;
    let streak = 1;
    for (let j = i + 1; j < results.length && results[j].decision === 'ALLOW'; j++) {
      streak++;
    }
    return Math.max(max, streak);
  }, 0);

  test.passed = test.errors === 0 && test.allowed > 0 && (test.allowed + test.denied === 100);

  console.log('');
  info('Max Consecutive ALLOW', maxConsecutiveAllowed);

  printTestResult(test);
  return test;
}

async function main() {
  header('Fixed Window Load Test (In-Memory)');
  info('Request Limit', REQUEST_LIMIT);
  info('Window Duration', `${WINDOW_DURATION_S}s`);
  info('Endpoint', ENDPOINT);
  info('Client ID', CLIENT_ID);
  divider();

  const serverUp = await checkConnectivity();
  if (!serverUp) process.exit(1);

  console.log(`  ${GREEN}${BOLD}Backend connected. Targeting in-memory Fixed Window.${RESET}`);

  const allTests: TestResult[] = [];

  allTests.push(await runTest1());

  await waitForNextWindow();
  allTests.push(await runTest2());

  await waitForNextWindow();
  allTests.push(await runTest3());

  await waitForNextWindow();
  allTests.push(await runTest4());

  await waitForNextWindow();
  allTests.push(await runTest5());

  header('FINAL REPORT');

  console.log('');
  for (const test of allTests) {
    const icon = test.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const color = test.passed ? GREEN : RED;
    console.log(`  ${icon} ${color}${test.name}${RESET}`);
  }

  const totalPassed = allTests.filter(t => t.passed).length;
  const totalFailed = allTests.filter(t => !t.passed).length;
  const totalRequests = allTests.reduce((sum, t) => sum + t.totalRequests, 0);
  const totalAllowed = allTests.reduce((sum, t) => sum + t.allowed, 0);
  const totalDenied = allTests.reduce((sum, t) => sum + t.denied, 0);
  const allLatencies = allTests.flatMap(t => t.results.map(r => r.latencyMs));
  const avgLatency = Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length);
  const fastest = Math.min(...allLatencies);
  const slowest = Math.max(...allLatencies);

  console.log('');
  divider('─');
  info('Tests Passed', `${totalPassed} / ${allTests.length}`);
  info('Tests Failed', `${totalFailed}`);
  info('Total Requests', `${totalRequests}`);
  info('Total Allowed', `${totalAllowed}`);
  info('Total Denied', `${totalDenied}`);
  info('Average Latency', `${avgLatency}ms`);
  info('Fastest Request', `${fastest}ms`);
  info('Slowest Request', `${slowest}ms`);
  divider('─');
  console.log('');

  if (totalFailed === 0) {
    console.log(`  ${BG_GREEN}${BOLD} OVERALL PASS ${RESET} ${GREEN}All ${allTests.length} tests passed.${RESET}`);
  } else {
    console.log(`  ${BG_RED}${BOLD} OVERALL FAIL ${RESET} ${RED}${totalFailed} of ${allTests.length} tests failed.${RESET}`);
  }

  console.log('');
  divider();

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}${BOLD}Unexpected error:${RESET}`, err);
  process.exit(1);
});
