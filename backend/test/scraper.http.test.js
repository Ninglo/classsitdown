const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const EducationSystemScraper = require('../scraper/scraper');

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

test('HTTP login and class-map fetch work without launching browser', async () => {
  const requests = [];
  const upstream = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    requests.push({
      method: req.method,
      path: url.pathname,
      cookie: req.headers.cookie || '',
      xsrf: req.headers['x-xsrf-token'] || '',
    });

    if (req.method === 'GET' && url.pathname === '/admin/auth/login') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': [
          'XSRF-TOKEN=test-xsrf%3Dvalue; Path=/',
          'laravel_session=guest-session; Path=/; HttpOnly',
        ],
      });
      res.end(`
        <html>
          <head><title>C&F School教务管理系统 | 登录</title></head>
          <body>
            <script>
              window.__STATE__ = { _token: "csrf-token-123" };
            </script>
          </body>
        </html>
      `);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/auth/login') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const form = new URLSearchParams(body);
        const cookies = parseCookies(req.headers.cookie || '');
        const isValid =
          form.get('username') === 'amber'
          && form.get('password') === 'secret'
          && form.get('_token') === 'csrf-token-123'
          && form.get('remember') === 'false'
          && cookies['XSRF-TOKEN'] === 'test-xsrf%3Dvalue'
          && cookies.laravel_session === 'guest-session'
          && req.headers['x-xsrf-token'] === 'test-xsrf=value';

        res.writeHead(isValid ? 200 : 400, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': ['laravel_session=logged-in-session; Path=/; HttpOnly'],
        });
        res.end(JSON.stringify(
          isValid
            ? { code: '1', msg: '登陆成功', url: `http://${req.headers.host}/admin` }
            : { code: '0', msg: '登录参数不正确' }
        ));
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin') {
      const cookies = parseCookies(req.headers.cookie || '');
      if (cookies.laravel_session !== 'logged-in-session') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><title>C&F School教务管理系统 | 登录</title></html>');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div class="small-box">
          <div>K328 我的班级列表</div>
          <a href="/admin/squad_console?id=101&type=offline">进入班级</a>
        </div>
        <div class="panel">
          <span>BB102 晚辅班</span>
          <a href="/admin/squad_console?id=202&type=offline">查看详情</a>
        </div>
      `);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  const address = await listen(upstream);
  const scraper = new EducationSystemScraper({
    baseUrl: `http://${address.address}:${address.port}`,
    username: 'amber',
    password: 'secret',
  });

  try {
    await scraper.login();
    const firstFetch = await scraper.getClassMap();
    const secondFetch = await scraper.getClassMap();

    assert.deepEqual(firstFetch, [
      { classCode: 'K328', squadId: '101' },
      { classCode: 'BB102', squadId: '202' },
    ]);
    assert.deepEqual(secondFetch, firstFetch);
    assert.equal(scraper.browser, null);
    assert.equal(requests.filter((item) => item.path === '/admin').length, 1);
  } finally {
    await scraper.close();
    await close(upstream);
  }
});
