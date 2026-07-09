import axios from 'axios';

// Add this to prevent TypeScript from complaining about process.exit
declare var process: any;

const ENDPOINT = 'http://localhost:3001/api/v1/rate-limit/sliding-window/memory';
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
  console.log(`Starting Sliding Window Counter Load Tests...`);
  console.log(`Target: ${ENDPOINT}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Default Window: 60s, Limit: 10\n`);

  let allPassed = true;

  // TEST 1: 10 simultaneous requests
  const results1 = await runSimultaneous(10);
  allPassed = printResults('TEST 1: 10 simultaneous requests', results1, 10, 0) && allPassed;

  // TEST 2: 11 simultaneous requests (immediately after)
  const results2 = await runSimultaneous(11);
  allPassed = printResults('TEST 2: 11 simultaneous requests', results2, 0, 11) && allPassed;

  // TEST 3: Wait 30 seconds (Half window)
  console.log('\nWaiting 30 seconds to test overlapping weight...');
  await new Promise(r => setTimeout(r, 30000));
  
  const results3 = await runSimultaneous(20);
  allPassed = printResults('TEST 3: 20 simultaneous requests at half-window', results3, 5, 15) && allPassed;
  
  console.log('\n========================================');
  console.log(`OVERALL STATUS: ${allPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('========================================\n');
  
  process.exit(allPassed ? 0 : 1);
}

runTests();
