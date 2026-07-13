import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

declare var process: any;

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ENDPOINT = `${API_BASE_URL}/api/v1/rate-limit/memory`;
const CLIENT_ID = 'Client-A';

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
    return { req: reqNum, status: res.status, decision: res.data.decision, remaining: res.data.remainingTokens, capacity: res.data.capacity, refillRate: res.data.refillRate, latency: Date.now() - start };
  } catch (err) {
    return { req: reqNum, status: 0, decision: 'ERROR', remaining: 0, capacity: 0, refillRate: 0, latency: Date.now() - start };
  }
}

async function runSimultaneous(count: number) {
  const promises = [];
  for (let i = 1; i <= count; i++) {
    promises.push(sendRequest(i));
  }
  return Promise.all(promises);
}

async function runSequential(count: number, delayMs: number) {
  const results = [];
  for (let i = 1; i <= count; i++) {
    results.push(await sendRequest(i));
    if (i < count) await new Promise(r => setTimeout(r, delayMs));
  }
  return results;
}

function printResults(name: string, results: any[], expectedAllow: number, expectedDeny: number) {
  const allowed = results.filter((r) => r.decision === 'ALLOW').length;
  const denied = results.filter((r) => r.decision === 'DENY').length;
  const passed = allowed === expectedAllow && denied === expectedDeny;

  console.log(`\n--- ${name} ---`);
  console.log(`Allowed: ${allowed} (Expected: ${expectedAllow})`);
  console.log(`Denied:  ${denied} (Expected: ${expectedDeny})`);
  console.log(`Status:  ${passed ? 'PASS ✅' : 'FAIL ❌'}`);

  return passed;
}

async function waitForRefill(capacity: number, refillRate: number) {
  // Token bucket refills at refillRate tokens/sec.
  // To fully refill from 0 to capacity, we need capacity/refillRate seconds, plus 2 seconds for safety.
  const waitS = Math.ceil(capacity / Math.max(0.1, refillRate)) + 2;
  process.stdout.write(`\nWaiting ${waitS}s for bucket to fully refill...`);
  for (let i = 0; i < waitS; i++) {
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  console.log(' Ready');
}

async function runTests() {
  // Step 1: Probe request to discover the client's real config
  console.log('Probing endpoint to discover client configuration...');
  const probe = await sendRequest(0);

  if (probe.status !== 200) {
    console.error(`\n❌ ERROR: Probe request failed with status ${probe.status}.`);
    console.error(`The backend refused to process this API key. Are you sure it's configured for the Token Bucket algorithm?`);
    process.exit(1);
  }

  const CAPACITY = probe.capacity || 10;
  const REFILL_RATE = probe.refillRate || 1;

  console.log(`\nStarting Token Bucket Load Tests...`);
  console.log(`Target: ${ENDPOINT}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Discovered Config → Capacity: ${CAPACITY} tokens, Refill: ${REFILL_RATE} tokens/s\n`);

  let allPassed = true;

  // TEST 1: Send exactly CAPACITY requests
  await waitForRefill(CAPACITY, REFILL_RATE);
  const results1 = await runSimultaneous(CAPACITY);
  allPassed = printResults(`TEST 1: ${CAPACITY} simultaneous requests`, results1, CAPACITY, 0) && allPassed;

  // TEST 2: Send CAPACITY+1 requests
  await waitForRefill(CAPACITY, REFILL_RATE);
  const results2 = await runSimultaneous(CAPACITY + 1);
  allPassed = printResults(`TEST 2: ${CAPACITY + 1} simultaneous requests`, results2, CAPACITY, 1) && allPassed;

  // TEST 3: Send CAPACITY*2 requests
  await waitForRefill(CAPACITY, REFILL_RATE);
  const results3 = await runSimultaneous(CAPACITY * 2);
  allPassed = printResults(`TEST 3: ${CAPACITY * 2} simultaneous requests`, results3, CAPACITY, CAPACITY) && allPassed;

  // TEST 4: Sequential requests with 100ms delay (some refill during test)
  await waitForRefill(CAPACITY, REFILL_RATE);
  const seqCount = CAPACITY + 5;
  const seqResults = await runSequential(seqCount, 100);
  // With 100ms delay and refillRate=1/s, over ~1.5s we get ~1 extra token
  const seqAllowed = seqResults.filter(r => r.decision === 'ALLOW').length;
  const seqDenied = seqResults.filter(r => r.decision === 'DENY').length;
  // Accept a range since refill timing can vary slightly
  const seqPass = seqAllowed >= CAPACITY && seqAllowed <= CAPACITY + 2 && (seqAllowed + seqDenied === seqCount);
  console.log(`\n--- TEST 4: ${seqCount} sequential requests (100ms delay) ---`);
  console.log(`Allowed: ${seqAllowed} (Expected: ${CAPACITY} to ${CAPACITY + 2})`);
  console.log(`Denied:  ${seqDenied} (Expected: ${seqCount - CAPACITY - 2} to ${seqCount - CAPACITY})`);
  console.log(`Status:  ${seqPass ? 'PASS ✅' : 'FAIL ❌'}`);
  allPassed = seqPass && allPassed;

  // TEST 5: Sequential requests with 1000ms delay
  await waitForRefill(CAPACITY, REFILL_RATE);
  const slowResults = await runSequential(CAPACITY, 1000);
  allPassed = printResults(`TEST 5: ${CAPACITY} sequential requests (1000ms delay)`, slowResults, CAPACITY, 0) && allPassed;

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
