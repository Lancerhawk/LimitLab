import axios from 'axios';


const ENDPOINT = 'http://localhost:3001/api/v1/rate-limit/sliding-log/memory';
const CLIENT_ID = 'test-client-' + Math.random().toString(36).substring(7);

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
    return { req: reqNum, status: res.status, decision: res.data.decision, remaining: res.data.remainingRequests, limit: res.data.limit, windowMs: res.data.windowMs, latency: Date.now() - start };
  } catch (err) {
    return { req: reqNum, status: 0, decision: 'ERROR', remaining: 0, limit: 0, windowMs: 0, latency: Date.now() - start };
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

async function runTests() {
  // Step 1: Probe request to discover the client's real config
  console.log('Probing endpoint to discover client configuration...');
  const probe = await sendRequest(0);

  if (probe.status !== 200) {
    console.error(`\n❌ ERROR: Probe request failed with status ${probe.status}.`);
    console.error(`The backend refused to process this API key. Are you sure it's configured for the Sliding Log algorithm?`);
    process.exit(1);
  }

  const LIMIT = probe.limit || 10;
  const WINDOW_DURATION_S = probe.windowMs ? probe.windowMs / 1000 : 60;

  console.log(`\nStarting Sliding Log Load Tests...`);
  console.log(`Target: ${ENDPOINT}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Discovered Config → Limit: ${LIMIT} requests, Window: ${WINDOW_DURATION_S}s\n`);

  let allPassed = true;

  // The probe request consumed 1 token. We must wait for it to clear from the log.
  console.log(`\nWaiting ${WINDOW_DURATION_S + 1}s for probe request to clear from log...`);
  await new Promise(r => setTimeout(r, (WINDOW_DURATION_S + 1) * 1000));

  // TEST 1: Send exactly LIMIT requests
  const results1 = await runSimultaneous(LIMIT);
  allPassed = printResults(`TEST 1: ${LIMIT} simultaneous requests`, results1, LIMIT, 0) && allPassed;

  // Wait for full window reset
  console.log(`\nWaiting ${WINDOW_DURATION_S + 1}s for window to fully reset...`);
  await new Promise(r => setTimeout(r, (WINDOW_DURATION_S + 1) * 1000));

  // TEST 2: Send LIMIT+1 requests
  const results2 = await runSimultaneous(LIMIT + 1);
  allPassed = printResults(`TEST 2: ${LIMIT + 1} simultaneous requests`, results2, LIMIT, 1) && allPassed;

  // Wait for full window reset
  console.log(`\nWaiting ${WINDOW_DURATION_S + 1}s for window to fully reset...`);
  await new Promise(r => setTimeout(r, (WINDOW_DURATION_S + 1) * 1000));

  // TEST 3: Send LIMIT*2 requests
  const results3 = await runSimultaneous(LIMIT * 2);
  allPassed = printResults(`TEST 3: ${LIMIT * 2} simultaneous requests`, results3, LIMIT, LIMIT) && allPassed;

  // Wait for full window reset
  console.log(`\nWaiting ${WINDOW_DURATION_S + 1}s for window to fully reset...`);
  await new Promise(r => setTimeout(r, (WINDOW_DURATION_S + 1) * 1000));

  // TEST 4: Send LIMIT+5 sequential requests (100ms delay)
  const seqCount = LIMIT + 5;
  const seqResults = [];
  for (let i = 1; i <= seqCount; i++) {
    seqResults.push(await sendRequest(i));
    if (i < seqCount) await new Promise(r => setTimeout(r, 100));
  }
  allPassed = printResults(`TEST 4: ${seqCount} sequential requests (100ms delay)`, seqResults, LIMIT, 5) && allPassed;

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
