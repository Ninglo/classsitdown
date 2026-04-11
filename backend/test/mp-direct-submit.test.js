const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const XLSX = require('xlsx');

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

/**
 * Collects full request body as Buffer
 */
function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

test('MP direct submit: full flow with study_mark/store', async () => {
  // Track what the mock cnfadmin received
  let studyMarkCalled = false;
  let studyMarkBody = null;
  let studyMarkContentType = '';

  const upstream = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Login page GET
    if (req.method === 'GET' && url.pathname === '/admin/auth/login') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': [
          'XSRF-TOKEN=test-xsrf-token; Path=/',
          'laravel_session=pre-login; Path=/; HttpOnly',
        ],
      });
      res.end('<script>window.__STATE__ = { _token: "csrf-token-001" };</script>');
      return;
    }

    // Login POST
    if (req.method === 'POST' && url.pathname === '/admin/auth/login') {
      const body = await collectBody(req);
      const form = new URLSearchParams(body.toString());
      const ok = form.get('username') === 'teacher' && form.get('password') === 'secret';
      res.writeHead(ok ? 200 : 400, {
        'Content-Type': 'application/json',
        'Set-Cookie': ['laravel_session=logged-in; Path=/; HttpOnly'],
      });
      res.end(JSON.stringify(ok ? { code: '1', msg: '登陆成功' } : { code: '0', msg: 'bad' }));
      return;
    }

    // Admin home (class map)
    if (req.method === 'GET' && url.pathname === '/admin') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div class="small-box">
          <div>J342 测试班</div>
          <a href="/admin/squad_console?id=1046&type=offline">进入</a>
        </div>
      `);
      return;
    }

    // Squad console page (for CSRF token extraction)
    if (req.method === 'GET' && url.pathname === '/admin/squad_console') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': ['XSRF-TOKEN=console-xsrf; Path=/'],
      });
      res.end(`
        <html>
        <body>
          <script>window.__STATE__ = { _token: "csrf-from-console" };</script>
          <div>当前可发放 Coupon: 5</div>
          <div>当前可发放 MiniPin: 658</div>
          <div>发放 MP: 401</div>
          <div>待发 MP: 7809</div>
        </body>
        </html>
      `);
      return;
    }

    // cop_mip/getStudentList
    if (req.method === 'GET' && url.pathname === '/admin/squad/cop_mip/getStudentList') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: [
          { id: 1, no: '20240001', en_name: 'Alice', ch_name: '张三' },
          { id: 2, no: '20240002', en_name: 'Bob', ch_name: '李四' },
          { id: 3, no: '20240003', en_name: 'Charlie', ch_name: '王五' },
          { id: 4, no: '20240004', en_name: 'Diana', ch_name: '赵六' },
          { id: 5, no: '20240005', en_name: 'Eve', ch_name: '孙七' },
        ],
      }));
      return;
    }

    // study_mark/store — the target endpoint
    if (req.method === 'POST' && url.pathname === '/admin/OnlineTest/study_mark/store') {
      studyMarkCalled = true;
      studyMarkContentType = req.headers['content-type'] || '';
      studyMarkBody = await collectBody(req);

      // Simulate success (302 redirect like Laravel)
      res.writeHead(302, {
        'Content-Type': 'text/html',
        'Location': '/admin/squad_console?id=1046&type=offline',
      });
      res.end('Redirecting...');
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  const upstreamAddress = await listen(upstream);
  process.env.CNFADMIN_BASE_URL = `http://${upstreamAddress.address}:${upstreamAddress.port}`;

  // Clear cached modules to pick up new CNFADMIN_BASE_URL
  delete require.cache[require.resolve('../server')];
  const { app } = require('../server');
  const backend = http.createServer(app);
  const backendAddress = await listen(backend);
  const baseUrl = `http://${backendAddress.address}:${backendAddress.port}`;

  try {
    // Step 1: Login
    const loginResp = await fetch(`${baseUrl}/api/scraper/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'teacher', password: 'secret' }),
    });
    assert.equal(loginResp.status, 200);
    const loginData = await loginResp.json();
    assert.equal(loginData.status, 'success');
    const cookie = loginResp.headers.get('set-cookie') || '';
    assert.ok(cookie.includes('amber_sid='), 'should set session cookie');
    const sid = cookie.match(/amber_sid=([^;]+)/)?.[1] || '';

    // Step 2: Test MP balance endpoint
    const balanceResp = await fetch(`${baseUrl}/api/mp/balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `amber_sid=${sid}`,
      },
      body: JSON.stringify({ classId: 'J342' }),
    });
    assert.equal(balanceResp.status, 200);
    const balanceData = await balanceResp.json();
    assert.equal(balanceData.status, 'success');
    assert.equal(balanceData.coupon, 5);
    assert.equal(balanceData.minipin, 658);
    assert.equal(balanceData.pending, 7809);
    console.log('   ✅ MP余额查询正常:', JSON.stringify(balanceData));

    // Step 3: Submit MP distribution
    const rewards = [
      { studentId: '20240001', studentName: 'Alice', chineseName: '张三', aliases: ['Alice', '张三'], amount: 1 },
      { studentId: '20240002', studentName: 'Bob', chineseName: '李四', aliases: ['Bob', '李四'], amount: 1 },
      { studentId: '20240003', studentName: 'Charlie', chineseName: '王五', aliases: ['Charlie', '王五'], amount: 1 },
    ];

    const submitResp = await fetch(`${baseUrl}/api/scraper/submit-minipin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `amber_sid=${sid}`,
      },
      body: JSON.stringify({
        classId: 'J342',
        rewards,
      }),
    });
    assert.equal(submitResp.status, 200);
    const submitData = await submitResp.json();
    console.log('   ✅ 发放结果:', JSON.stringify(submitData));

    assert.equal(submitData.status, 'success');
    assert.equal(submitData.success, 3, 'should submit 3 students');
    assert.equal(submitData.totalMP, 3, 'should sum to 3 MP');
    assert.equal(submitData.method, 'study_mark_excel', 'should use study_mark endpoint');

    // Verify study_mark/store was called
    assert.ok(studyMarkCalled, 'study_mark/store should have been called');
    assert.ok(studyMarkContentType.includes('multipart/form-data'), 'should use multipart/form-data');

    // Verify the uploaded Excel contains correct data
    const bodyStr = studyMarkBody.toString('utf8');
    assert.ok(bodyStr.includes('mp_distribution.xlsx'), 'should include filename');

    // Extract the Excel file from multipart body
    const boundaryMatch = studyMarkContentType.match(/boundary=([^\s;]+)/);
    assert.ok(boundaryMatch, 'should have boundary');
    const boundary = boundaryMatch[1];
    const parts = studyMarkBody.toString('binary').split(`--${boundary}`);

    let excelPart = null;
    for (const part of parts) {
      if (part.includes('mp_distribution.xlsx')) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          excelPart = Buffer.from(part.slice(headerEnd + 4), 'binary');
          // Trim trailing \r\n
          if (excelPart[excelPart.length - 2] === 0x0d && excelPart[excelPart.length - 1] === 0x0a) {
            excelPart = excelPart.subarray(0, excelPart.length - 2);
          }
        }
      }
    }
    assert.ok(excelPart, 'should contain Excel file data');

    // Parse the Excel and verify contents
    const wb = XLSX.read(excelPart, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    assert.equal(rows.length, 3, 'Excel should have 3 data rows');
    assert.equal(rows[0]['英文名'], 'Alice');
    assert.equal(rows[0]['中文名'], '张三');
    assert.equal(rows[0]['学号'], '20240001');
    assert.equal(rows[0]['发放MP数量'], 1);
    assert.equal(rows[1]['英文名'], 'Bob');
    assert.equal(rows[2]['英文名'], 'Charlie');
    console.log('   ✅ Excel内容验证通过:', rows.map(r => `${r['英文名']}=${r['发放MP数量']}MP`).join(', '));

    // Verify CSRF token was included
    const tokenPart = parts.find(p => p.includes('name="_token"'));
    assert.ok(tokenPart, 'should include CSRF token');
    assert.ok(tokenPart.includes('csrf-from-console'), 'should use CSRF from console page');

    // Verify squad_id was included
    const squadPart = parts.find(p => p.includes('name="squad_id"'));
    assert.ok(squadPart, 'should include squad_id');
    assert.ok(squadPart.includes('1046'), 'should use correct squad_id');

    console.log('   ✅ 全流程验证通过！');
  } finally {
    await close(backend);
    await close(upstream);
    delete process.env.CNFADMIN_BASE_URL;
    delete require.cache[require.resolve('../server')];
  }
});
