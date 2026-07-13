import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });


const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ENDPOINT = `${API_BASE_URL}/api/v1/rate-limit/leaky-bucket/memory`;
const CLIENT_ID = 'LB-Client-A';

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
    return { req: reqNum, status: res.status, decision: res.data.decision, queueLength: res.data.queueLength, capacity: res.data.capacity, leakRate: res.data.leakRate, latency: Date.now() - start };
  } catch (err) {
    return { req: reqNum, status: 0, decision: 'ERROR', queueLength: 0, capacity: 0, leakRate: 0, latency: Date.now() - start };
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

async function waitForDrain(capacity: number, leakRate: number) {
  // Wait until the queue is fully drained based on capacity and leakRate
  const waitS = Math.ceil(capacity / Math.max(0.1, leakRate)) + 2; // +2s buffer
  process.stdout.write(`\nWaiting ${waitS}s for queue to fully drain...`);
  for (let i = 0; i < waitS; i++) {
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  console.log(' Ready');
}

async function runTests() {
  console.log('Probing endpoint to discover client configuration...');
  const probe = await sendRequest(0);

  if (probe.status !== 200) {
    console.error(`\n❌ ERROR: Probe request failed with status ${probe.status}.`);
    console.error(`The backend refused to process this API key. Are you sure it's configured for the Leaky Bucket algorithm?`);
    process.exit(1);
  }

  const CAPACITY = probe.capacity || 10;
  const LEAK_RATE = probe.leakRate || 1;

  console.log(`\nStarting Leaky Bucket Load Tests...`);
  console.log(`Target: ${ENDPOINT}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Discovered Config → Queue Capacity: ${CAPACITY}, Leak Rate: ${LEAK_RATE} req/s\n`);

  let allPassed = true;

  // TEST 1: Fill queue
  await waitForDrain(CAPACITY, LEAK_RATE);
  const results1 = await runSimultaneous(CAPACITY);
  allPassed = printResults(`TEST 1: ${CAPACITY} simultaneous requests (fill queue)`, results1, CAPACITY, 0) && allPassed;

  // TEST 2: Queue full, next request denied
  const results2 = await runSimultaneous(1);
  allPassed = printResults('TEST 2: 1 immediate request (queue full)', results2, 0, 1) && allPassed;

  // TEST 3: Wait for a specific amount to leak
  const leakSeconds = 3;
  console.log(`\nWaiting ${leakSeconds} seconds for queue to leak...`);
  await new Promise(resolve => setTimeout(resolve, leakSeconds * 1000));

  const leakedAmount = Math.floor(leakSeconds * LEAK_RATE);
  const expectedAllow = Math.min(leakedAmount, CAPACITY); // Max we can fit is CAPACITY

  const results3 = await runSimultaneous(expectedAllow + 1);
  allPassed = printResults(`TEST 3: ${expectedAllow + 1} requests after ${leakSeconds}s leak`, results3, expectedAllow, 1) && allPassed;

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
