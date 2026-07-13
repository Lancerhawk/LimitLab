import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });


const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ENDPOINT = `${API_BASE_URL}/api/v1/rate-limit/fixed-window/memory`;
const CLIENT_ID = 'FW-Client-A';

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

function printResults(name: string, results: { decision: string }[], expectedAllow: number, expectedDeny: number) {
  const allowed = results.filter((r) => r.decision === 'ALLOW').length;
  const denied = results.filter((r) => r.decision === 'DENY').length;
  const passed = allowed === expectedAllow && denied === expectedDeny;

  console.log(`\n--- ${name} ---`);
  console.log(`Allowed: ${allowed} (Expected: ${expectedAllow})`);
  console.log(`Denied:  ${denied} (Expected: ${expectedDeny})`);
  console.log(`Status:  ${passed ? 'PASS ✅' : 'FAIL ❌'}`);

  return passed;
}

async function waitForNextWindow(windowDurationMs: number = 60000) {
  // Fixed window resets at the next boundary (wall-clock aligned)
  const now = Date.now();
  const currentWindowEnd = (Math.floor(now / windowDurationMs) + 1) * windowDurationMs;
  const waitMs = Math.max(0, currentWindowEnd - now) + 1500;

  process.stdout.write(`\nWaiting ${Math.ceil(waitMs / 1000)}s for next window boundary...`);
  await new Promise(r => setTimeout(r, waitMs));
  console.log(' Ready');
}

async function runTests() {
  // Step 1: Probe request to discover the client's real config
  console.log('Probing endpoint to discover client configuration...');
  const probe = await sendRequest(0);

  if (probe.status !== 200) {
    console.error(`\n❌ ERROR: Probe request failed with status ${probe.status}.`);
    console.error(`The backend refused to process this API key. Are you sure it's configured for the Fixed Window algorithm?`);
    process.exit(1);
  }

  const LIMIT = probe.capacity || 10;
  const WINDOW_DURATION_MS = probe.windowMs || 60000;

  console.log(`\nStarting Fixed Window Load Tests...`);
  console.log(`Target: ${ENDPOINT}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Discovered Config → Limit: ${LIMIT} requests, Window: ${WINDOW_DURATION_MS / 1000}s\n`);

  let allPassed = true;

  // TEST 1: Send exactly LIMIT requests
  await waitForNextWindow(WINDOW_DURATION_MS);
  const results1 = await runSimultaneous(LIMIT);
  allPassed = printResults(`TEST 1: ${LIMIT} simultaneous requests`, results1, LIMIT, 0) && allPassed;

  // TEST 2: Send LIMIT+1 requests
  await waitForNextWindow(WINDOW_DURATION_MS);
  const results2 = await runSimultaneous(LIMIT + 1);
  allPassed = printResults(`TEST 2: ${LIMIT + 1} simultaneous requests`, results2, LIMIT, 1) && allPassed;

  // TEST 3: Send LIMIT*2 requests
  await waitForNextWindow(WINDOW_DURATION_MS);
  const results3 = await runSimultaneous(LIMIT * 2);
  allPassed = printResults(`TEST 3: ${LIMIT * 2} simultaneous requests`, results3, LIMIT, LIMIT) && allPassed;

  // TEST 4: Window reset verification — send LIMIT, wait for new window, send LIMIT again
  await waitForNextWindow(WINDOW_DURATION_MS);
  const results4a = await runSimultaneous(LIMIT);
  await waitForNextWindow(WINDOW_DURATION_MS);
  const results4b = await runSimultaneous(LIMIT);
  const allResults4 = [...results4a, ...results4b];
  allPassed = printResults(`TEST 4: ${LIMIT} + wait + ${LIMIT} (window reset)`, allResults4, LIMIT * 2, 0) && allPassed;

  // TEST 5: Sequential requests within a single window
  await waitForNextWindow(WINDOW_DURATION_MS);
  const seqCount = LIMIT + 5;
  const seqResults = [];
  for (let i = 1; i <= seqCount; i++) {
    seqResults.push(await sendRequest(i));
    if (i < seqCount) await new Promise(r => setTimeout(r, 100));
  }
  allPassed = printResults(`TEST 5: ${seqCount} sequential requests (100ms delay)`, seqResults, LIMIT, 5) && allPassed;

  console.log(`\n======================================`);
  if (allPassed) {
    console.log(`🎉 ALL TESTS PASSED SUCCESSFULLY 🎉`);
    process.exit(0);
  } else {
    console.log(`💥 SOME TESTS FAILED 💥`);
    process.exit(1);
  }
}

runTests().catch(console.error);
