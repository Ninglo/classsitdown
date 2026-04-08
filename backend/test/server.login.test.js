const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return index === -1 ? [part, ''] : [part.slice(0, index), part.slice(index + 1)];
      })
  );
}

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

test('backend login API returns classes and preserves session cookie', async () => {
  const upstream = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/admin/auth/login') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': [
          'XSRF-TOKEN=api-xsrf%3Dvalue; Path=/',
          'laravel_session=api-prelogin; Path=/; HttpOnly',
        ],
      });
      res.end('<script>window.__STATE__ = { _token: "server-csrf-001" };</script>');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/auth/login') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const form = new URLSearchParams(body);
        const ok =
          form.get('username') === 'teacher'
          && form.get('password') === 'secret'
          && form.get('_token') === 'server-csrf-001';

        res.writeHead(ok ? 200 : 400, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': ['laravel_session=api-logged-in; Path=/; HttpOnly'],
        });
        res.end(JSON.stringify(
          ok
            ? { code: '1', msg: '登陆成功', url: `http://${req.headers.host}/admin` }
            : { code: '0', msg: 'bad login' }
        ));
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin') {
      const cookies = parseCookies(req.headers.cookie || '');
      if (cookies.laravel_session !== 'api-logged-in') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><title>C&F School教务管理系统 | 登录</title></html>');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div class="small-box">
          <div>AA100 早课班</div>
          <a href="/admin/squad_console?id=900&type=offline">进入</a>
        </div>
      `);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  const upstreamAddress = await listen(upstream);
  process.env.CNFADMIN_BASE_URL = `http://${upstreamAddress.address}:${upstreamAddress.port}`;

  delete require.cache[require.resolve('../server')];
  const { app } = require('../server');
  const backend = http.createServer(app);
  const backendAddress = await listen(backend);
  const baseUrl = `http://${backendAddress.address}:${backendAddress.port}`;

  try {
    const loginResponse = await fetch(`${baseUrl}/api/scraper/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: 'teacher',
        password: 'secret',
      }),
    });

    assert.equal(loginResponse.status, 200);
    const sessionCookie = loginResponse.headers.get('set-cookie');
    assert.ok(sessionCookie?.includes('amber_sid='));

    const loginJson = await loginResponse.json();
    assert.equal(loginJson.status, 'success');
    assert.deepEqual(loginJson.classes, [
      { id: 'AA100', name: 'AA100', squadId: '900' },
    ]);

    const classesResponse = await fetch(`${baseUrl}/api/scraper/get-classes`, {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
      },
    });

    assert.equal(classesResponse.status, 200);
    const classesJson = await classesResponse.json();
    assert.equal(classesJson.status, 'success');
    assert.deepEqual(classesJson.data, [
      { id: 'AA100', name: 'AA100', squadId: '900' },
    ]);
  } finally {
    await close(backend);
    await close(upstream);
    delete process.env.CNFADMIN_BASE_URL;
  }
});
