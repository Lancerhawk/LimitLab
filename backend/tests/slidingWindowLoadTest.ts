import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });


const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ENDPOINT = `${API_BASE_URL}/api/v1/rate-limit/sliding-window/memory`;
const CLIENT_ID = 'SW-Client-A';

async function sendRequest(reqNum: number) {
  const start = Date.now();
  try {
    const res = await axios.post(
      ENDPOINT,
      {},
      {
        headers: { 'x-client-id': CLIENT_ID },
        validateStatus: () => true,
      }
    );
    return { req: reqNum, status: res.status, decision: res.data.decision, remaining: res.data.remainingTokens, capacity: res.data.capacity, windowMs: res.data.windowMs, latency: Date.now() - start };
  } catch (err) {
    return { req: reqNum, status: 0, decision: 'ERROR', remaining: 0, capacity: 0, windowMs: 0, latency: Date.now() - start };
  }
}

async function runSimultaneous(count: number) {
  const promises = [];
  for (let i = 1; i <= count; i++) {
    promises.push(sendRequest(i));
  }
  return Promise.all(promises);
}

function printResults(name: string, results: { decision: string }[], expectedAllow: number | number[], expectedDeny: number | number[]) {
  const allowed = results.filter((r) => r.decision === 'ALLOW').length;
  const denied = results.filter((r) => r.decision === 'DENY').length;

  const allowedPassed = Array.isArray(expectedAllow) ? expectedAllow.includes(allowed) : allowed === expectedAllow;
  const deniedPassed = Array.isArray(expectedDeny) ? expectedDeny.includes(denied) : denied === expectedDeny;
  const passed = allowedPassed && deniedPassed;

  console.log(`\n--- ${name} ---`);
  console.log(`Allowed: ${allowed} (Expected: ${Array.isArray(expectedAllow) ? expectedAllow.join(' or ') : expectedAllow})`);
  console.log(`Denied:  ${denied} (Expected: ${Array.isArray(expectedDeny) ? expectedDeny.join(' or ') : expectedDeny})`);
  console.log(`Status:  ${passed ? 'PASS ✅' : 'FAIL ❌'}`);

  return passed;
}

async function waitForNextWindow(windowDurationMs: number = 60000, offsetMs: number = 1500) {
  // Wait until the next window boundary, plus a small offset
  const now = Date.now();
  const currentWindowEnd = (Math.floor(now / windowDurationMs) + 1) * windowDurationMs;
  const waitMs = Math.max(0, currentWindowEnd - now) + offsetMs;

  process.stdout.write(`\nWaiting ${Math.ceil(waitMs / 1000)}s for next window boundary...`);
  await new Promise(r => setTimeout(r, waitMs));
  console.log(' Ready');
}

async function runTests() {
  console.log('Probing endpoint to discover client configuration...');
  const probe = await sendRequest(0);

  if (probe.status !== 200) {
    console.error(`\n❌ ERROR: Probe request failed with status ${probe.status}.`);
    console.error(`The backend refused to process this API key. Are you sure it's configured for the Sliding Window algorithm?`);
    process.exit(1);
  }

  const LIMIT = probe.capacity || 10;
  const WINDOW_DURATION_MS = probe.windowMs || 60000;

  console.log(`\nStarting Sliding Window Load Tests...`);
  console.log(`Target: ${ENDPOINT}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Discovered Config → Limit: ${LIMIT} requests, Window: ${WINDOW_DURATION_MS / 1000}s\n`);

  let allPassed = true;

  // TEST 1: 10 simultaneous requests
  await waitForNextWindow(WINDOW_DURATION_MS);
  const results1 = await runSimultaneous(LIMIT);
  allPassed = printResults(`TEST 1: ${LIMIT} simultaneous requests`, results1, LIMIT, 0) && allPassed;

  // TEST 2: 11 simultaneous requests
  await waitForNextWindow(WINDOW_DURATION_MS);
  const results2 = await runSimultaneous(LIMIT + 1);
  allPassed = printResults(`TEST 2: ${LIMIT + 1} simultaneous requests`, results2, LIMIT, 1) && allPassed;

  // TEST 3: Wait until exactly halfway into the next real-world window
  console.log('\nAligning with real-world wall-clock to test exact 50% overlap weight...');

  // First wait for the start of the next window to get a clean slate
  await waitForNextWindow(WINDOW_DURATION_MS, 0);

  // Exhaust the new window so previousWindowCount = LIMIT
  await runSimultaneous(LIMIT);
  console.log(`Exhausted current window. Waiting for EXACTLY halfway into the next window...`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const elapsed = Date.now() % WINDOW_DURATION_MS;
    // We must cross into a new window, AND reach exactly halfway into it
    if (elapsed >= (WINDOW_DURATION_MS / 2)) {
      break;
    }
    await new Promise(r => setTimeout(r, 100)); // check every 100ms
  }

  // At 50% overlap, previous window weight is 50%, so effectiveCount = 0.5 * LIMIT + current
  // Therefore, only 0.5 * LIMIT tokens should be allowed
  const results3 = await runSimultaneous(LIMIT * 2);
  const expectedHalf = Math.floor(LIMIT / 2);

  // Because real-world time keeps ticking during the 1-2ms it takes for the HTTP request to reach the server,
  // the overlap drops slightly below 50.000%, which mathematically frees up a tiny fraction of a token,
  // sometimes allowing a 6th request to pass the < 10 threshold (when LIMIT = 10).
  allPassed = printResults(`TEST 3: ${LIMIT * 2} simultaneous requests at half-window`, results3, [expectedHalf, expectedHalf + 1], [(LIMIT * 2) - expectedHalf, (LIMIT * 2) - expectedHalf - 1]) && allPassed;

  console.log('\n========================================');
  console.log(`OVERALL STATUS: ${allPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('========================================\n');

  process.exit(allPassed ? 0 : 1);
}

runTests().catch(console.error);
