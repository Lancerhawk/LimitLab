import axios from 'axios';

declare var process: any;

const ENDPOINT = 'http://localhost:3001/api/v1/rate-limit/leaky-bucket/memory';
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
    return { req: reqNum, status: res.status, decision: res.data.decision, latency: Date.now() - start };
  } catch (err) {
    return { req: reqNum, status: 0, decision: 'ERROR', latency: Date.now() - start };
  }
}

async function runSimultaneous(count: number) {
  const promises = [];
  for (let i = 1; i <= count; i++) {
    promises.push(sendRequest(i));
  }
  return Promise.all(promises);
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

async function runTests() {
  console.log(`Starting Leaky Bucket Load Tests...`);
  console.log(`Target: ${ENDPOINT}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Default Queue Capacity: 10, Leak Rate: 1 req/s\n`);

  let allPassed = true;

  const results1 = await runSimultaneous(10);
  allPassed = printResults('TEST 1: 10 simultaneous requests (fill queue)', results1, 10, 0) && allPassed;

  const results2 = await runSimultaneous(1);
  allPassed = printResults('TEST 2: 1 immediate request (queue full)', results2, 0, 1) && allPassed;

  console.log('\n--- Waiting 2 seconds for queue to leak... ---');
  await new Promise(resolve => setTimeout(resolve, 2100));

  const results3 = await runSimultaneous(3);
  allPassed = printResults('TEST 3: 3 requests after 2s leak', results3, 2, 1) && allPassed;

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
