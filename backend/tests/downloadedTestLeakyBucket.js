const axios = require('axios');

const ENDPOINT = 'http://localhost:3001/api/v1/rate-limit/leaky-bucket/memory';

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

function printResults(name, results) {
  console.log(`\n--- ${name} ---`);
  const allowed = results.filter(r => r.decision === 'ALLOW').length;
  const denied = results.filter(r => r.decision === 'DENY').length;
  console.log(`Allowed: ${allowed}, Denied: ${denied}`);
}

async function run() {
  console.log(`Starting tests against ${ENDPOINT}...\n`);

  printResults("TEST 1: 10 Simultaneous", await runSimultaneous(10));
  console.log("Waiting 15s for queue to drain...");
  await new Promise(r => setTimeout(r, 15000));

  printResults("TEST 2: 11 Simultaneous", await runSimultaneous(11));
  console.log("Waiting 15s for queue to drain...");
  await new Promise(r => setTimeout(r, 15000));

  printResults("TEST 3: 20 Simultaneous", await runSimultaneous(20));
  console.log("Waiting 15s for queue to drain...");
  await new Promise(r => setTimeout(r, 15000));

  printResults("TEST 4: 15 Sequential (100ms delay)", await runSequential(15, 100));
}

run();
