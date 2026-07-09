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

function printResults(name: string, results: any[], expectedAllow: number | number[], expectedDeny: number | number[]) {
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

async function runTests() {
  console.log(`Starting Sliding Window Counter Load Tests...`);
  console.log(`Target: ${ENDPOINT}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Default Window: 60s, Limit: 10\n`);

  let allPassed = true;

  // Track the window we start in
  const startWindow = Math.floor(Date.now() / 60000);

  // TEST 1: 10 simultaneous requests
  const results1 = await runSimultaneous(10);
  allPassed = printResults('TEST 1: 10 simultaneous requests', results1, 10, 0) && allPassed;

  // TEST 2: 11 simultaneous requests (immediately after)
  const results2 = await runSimultaneous(11);
  allPassed = printResults('TEST 2: 11 simultaneous requests', results2, 0, 11) && allPassed;

  // TEST 3: Wait until exactly halfway into the next real-world window
  console.log('\nAligning with real-world wall-clock to test exact 50% overlap weight...');
  console.log('Waiting until exactly 30 seconds into the NEXT minute (may take 30-90s depending on current clock time)...');
  
  while (true) {
    const currentWindow = Math.floor(Date.now() / 60000);
    const elapsed = Date.now() % 60000;
    
    // We must cross into a new window, AND reach exactly 30s into it
    if (currentWindow > startWindow && elapsed >= 30000) {
      break;
    }
    await new Promise(r => setTimeout(r, 100)); // check every 100ms
  }
  
  const results3 = await runSimultaneous(20);
  // Because real-world time keeps ticking during the 1-2ms it takes for the HTTP request to reach the server,
  // the overlap drops slightly below 50.000%, which mathematically frees up a tiny fraction of a token,
  // sometimes allowing a 6th request to pass the < 10 threshold.
  allPassed = printResults('TEST 3: 20 simultaneous requests at half-window', results3, [5, 6], [14, 15]) && allPassed;
  
  console.log('\n========================================');
  console.log(`OVERALL STATUS: ${allPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('========================================\n');
  
  process.exit(allPassed ? 0 : 1);
}

runTests();
