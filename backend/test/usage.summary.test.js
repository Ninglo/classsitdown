const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('usage events can be recorded and summarized', async () => {
  const usageLogPath = path.join(os.tmpdir(), `classsitdown-usage-${Date.now()}.jsonl`);
  process.env.CLASSSITDOWN_USAGE_LOG_PATH = usageLogPath;

  delete require.cache[require.resolve('../server')];
  const { app } = require('../server');
  const backend = http.createServer(app);
  const backendAddress = await listen(backend);
  const baseUrl = `http://${backendAddress.address}:${backendAddress.port}`;

  try {
    const firstResponse = await fetch(`${baseUrl}/api/usage-events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        event: 'screen_view',
        module: 'daily-report',
        teacherName: 'Amber',
        className: 'K123',
        screen: 'daily-report',
      }),
    });
    assert.equal(firstResponse.status, 200);

    const secondResponse = await fetch(`${baseUrl}/api/usage-events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        event: 'screen_view',
        module: 'overview',
        teacherName: 'Amber',
        className: 'K123',
        screen: 'overview',
      }),
    });
    assert.equal(secondResponse.status, 200);

    const summaryResponse = await fetch(`${baseUrl}/api/admin/usage-summary?days=30`);
    assert.equal(summaryResponse.status, 200);
    const summaryJson = await summaryResponse.json();

    assert.equal(summaryJson.status, 'success');
    assert.equal(summaryJson.summary.totalEvents, 2);
    assert.equal(summaryJson.summary.uniqueUsers, 1);
    assert.deepEqual(summaryJson.summary.byUser, [
      { teacherName: 'Amber', count: 2 },
    ]);
    assert.deepEqual(summaryJson.summary.byModule, [
      { module: 'daily-report', count: 1 },
      { module: 'overview', count: 1 },
    ]);
  } finally {
    await close(backend);
    await fs.rm(usageLogPath, { force: true }).catch(() => {});
    delete process.env.CLASSSITDOWN_USAGE_LOG_PATH;
  }
});
