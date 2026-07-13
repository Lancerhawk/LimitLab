const axios = require('axios');

const ENDPOINT = 'http://localhost:3001/api/v1/rate-limit/sliding-window/memory';

async function sendRequest(requestNumber) {
  const start = Date.now();
  try {
    const res = await axios.post(ENDPOINT, {}, {
      validateStatus: () => true
    });
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
  console.log(`\n--- ${name} ---`);
  const allowed = results.filter(r => r.decision === 'ALLOW').length;
  const denied = results.filter(r => r.decision === 'DENY').length;
  const expectedDenied = results.length - expectedAllowed;
  const pass = allowed === expectedAllowed && denied === expectedDenied;
  console.log(`Allowed: ${allowed} (Expected: ${expectedAllowed})`);
  console.log(`Denied:  ${denied} (Expected: ${expectedDenied})`);
  console.log(`Status:  ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  return pass;
}

async function run() {
  console.log(`Starting tests against ${ENDPOINT}...\n`);
  const results = [];

  results.push(printResults("TEST 1: 10 Simultaneous", await runSimultaneous(10), 10));
  console.log("Waiting 61s for window to reset...");
  await new Promise(r => setTimeout(r, 61000));

  results.push(printResults("TEST 2: 11 Simultaneous", await runSimultaneous(11), 10));
  console.log("Waiting 61s for window to reset...");
  await new Promise(r => setTimeout(r, 61000));

  results.push(printResults("TEST 3: 20 Simultaneous", await runSimultaneous(20), 10));
  console.log("Waiting 61s for window to reset...");
  await new Promise(r => setTimeout(r, 61000));

  results.push(printResults("TEST 4: 15 Sequential (100ms delay)", await runSequential(15, 100), 10));

  console.log('\n======================================');
  if (results.every(r => r)) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY 🎉');
  } else {
    console.log('💥 SOME TESTS FAILED 💥');
  }
}

run();
