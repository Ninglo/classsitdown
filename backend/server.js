const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs/promises');
const os = require('os');
const { spawn } = require('child_process');
const compression = require('compression');
const EducationSystemScraper = require('./scraper/scraper');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const SESSION_COOKIE = 'amber_sid';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const CNF_BASE_URL = process.env.CNFADMIN_BASE_URL || 'https://cnfadmin.cnfschool.net';
const DEFAULT_REPORT_SCRIPT_DIR = path.resolve(os.homedir(), '.remotelab/instances/trial23/scripts');
const REPORT_SCRIPT_DIR = process.env.CLASS_DAILY_REPORT_SCRIPT_DIR || DEFAULT_REPORT_SCRIPT_DIR;
const DEFAULT_USAGE_LOG_PATH = path.resolve(os.homedir(), '.remotelab/instances/trial23/data/classsitdown-usage-events.jsonl');
const USAGE_LOG_PATH = process.env.CLASSSITDOWN_USAGE_LOG_PATH || DEFAULT_USAGE_LOG_PATH;
const sessions = new Map();

function getTraceId(req) {
  const raw = String(req.headers['x-login-trace-id'] || '').trim();
  return raw || crypto.randomUUID();
}

function logTrace(traceId, stage, payload = {}) {
  console.log('[login-trace]', JSON.stringify({ traceId, stage, ...payload }));
}

function sanitizeText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').trim();
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return sanitizeText(req.socket?.remoteAddress || '', 64);
}

async function appendUsageEvent(event) {
  const line = `${JSON.stringify(event)}\n`;
  await fs.mkdir(path.dirname(USAGE_LOG_PATH), { recursive: true });
  await fs.appendFile(USAGE_LOG_PATH, line, 'utf8');
}

async function readUsageEvents(days = 30) {
  try {
    const raw = await fs.readFile(USAGE_LOG_PATH, 'utf8');
    const minTime = Date.now() - (Math.max(1, Number(days) || 30) * 24 * 60 * 60 * 1000);
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((item) => {
        const ts = Date.parse(String(item.ts || ''));
        return Number.isFinite(ts) && ts >= minTime;
      });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function toSortedEntries(record, keyName, valueName = 'count') {
  return Object.entries(record)
    .map(([key, count]) => ({ [keyName]: key, [valueName]: count }))
    .sort((a, b) => (
      Number(b[valueName]) - Number(a[valueName])
      || String(a[keyName]).localeCompare(String(b[keyName]), 'zh-Hans-CN')
    ));
}

function summarizeUsageEvents(events) {
  const totalByEvent = {};
  const totalByUser = {};
  const totalByModule = {};
  const totalByDay = {};
  const activeUsersByDay = {};

  for (const event of events) {
    const eventName = sanitizeText(event.event || 'unknown');
    const teacherName = sanitizeText(event.teacherName || '匿名老师');
    const moduleName = sanitizeText(event.module || 'unknown');
    const day = String(event.ts || '').slice(0, 10);

    totalByEvent[eventName] = (totalByEvent[eventName] || 0) + 1;
    totalByUser[teacherName] = (totalByUser[teacherName] || 0) + 1;
    totalByModule[moduleName] = (totalByModule[moduleName] || 0) + 1;
    if (day) {
      totalByDay[day] = (totalByDay[day] || 0) + 1;
      activeUsersByDay[day] = activeUsersByDay[day] || new Set();
      activeUsersByDay[day].add(teacherName);
    }
  }

  const daily = Object.keys(totalByDay)
    .sort()
    .map((day) => ({
      day,
      events: totalByDay[day],
      activeUsers: activeUsersByDay[day]?.size || 0,
    }));

  return {
    totalEvents: events.length,
    uniqueUsers: Object.keys(totalByUser).length,
    byEvent: toSortedEntries(totalByEvent, 'event'),
    byUser: toSortedEntries(totalByUser, 'teacherName'),
    byModule: toSortedEntries(totalByModule, 'module'),
    daily,
    recentEvents: events.slice(-20).reverse(),
  };
}

function buildUsageEvent(req, session, payload = {}) {
  return {
    ts: new Date().toISOString(),
    event: sanitizeText(payload.event || 'unknown'),
    module: sanitizeText(payload.module || 'unknown'),
    teacherName: sanitizeText(session?.username || payload.teacherName || '匿名老师'),
    className: sanitizeText(payload.className || ''),
    screen: sanitizeText(payload.screen || ''),
    detail: sanitizeText(payload.detail || '', 240),
    sid: sanitizeText(payload.sid || '', 80),
    sessionId: sanitizeText(parseCookies(req.headers.cookie || '')[SESSION_COOKIE] || '', 80),
    ip: getClientIp(req),
    userAgent: sanitizeText(req.headers['user-agent'] || '', 240),
    env: sanitizeText(process.env.APP_ENV || process.env.NODE_ENV || 'production', 40),
  };
}

app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));

process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
});

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sid, session] of sessions.entries()) {
    if (now - session.lastSeenAt < SESSION_TTL_MS) continue;
    session.scraper?.close?.().catch(() => {});
    sessions.delete(sid);
  }
}

function ensureSession(req, res) {
  cleanupExpiredSessions();
  const cookies = parseCookies(req.headers.cookie);
  const currentSid = cookies[SESSION_COOKIE];
  if (currentSid && sessions.has(currentSid)) {
    const existing = sessions.get(currentSid);
    existing.lastSeenAt = Date.now();
    return { sid: currentSid, session: existing };
  }

  const sid = crypto.randomUUID();
  const session = { scraper: null, username: '', loginInProgress: false, lastSeenAt: Date.now() };
  sessions.set(sid, session);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  return { sid, session };
}

function requireLoggedInSession(req, res) {
  const { session } = ensureSession(req, res);
  if (!session.scraper) {
    res.status(401).json({ error: '未登录，请先登录' });
    return null;
  }
  return session;
}

function getSetCookieLines(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const lines = headers.getSetCookie();
    if (Array.isArray(lines) && lines.length > 0) return lines;
  }
  const raw = headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map((line) => line.trim()).filter(Boolean);
}

function mergeCookies(jar, headers) {
  for (const line of getSetCookieLines(headers)) {
    const pair = line.split(';', 1)[0] || '';
    const sep = pair.indexOf('=');
    if (sep <= 0) continue;
    const name = pair.slice(0, sep).trim();
    const value = pair.slice(sep + 1).trim();
    if (name) jar[name] = value;
  }
}

function buildCookieHeader(jar) {
  return Object.entries(jar).map(([name, value]) => `${name}=${value}`).join('; ');
}

async function fetchWithJar(url, options = {}, jar = {}) {
  const headers = new Headers(options.headers || {});
  const cookieHeader = buildCookieHeader(jar);
  if (cookieHeader) headers.set('Cookie', cookieHeader);
  const response = await fetch(url, { ...options, headers, redirect: 'manual' });
  mergeCookies(jar, response.headers);
  return response;
}

async function loginCNF(username, password) {
  const jar = {};
  const pageResp = await fetchWithJar(`${CNF_BASE_URL}/admin/auth/login`, { method: 'GET' }, jar);
  const pageHtml = await pageResp.text();
  const token = pageHtml.match(/_token:\s*"([^"]+)"/)?.[1]?.trim();
  if (!token) throw new Error('未能解析教务系统登录 token');

  const body = new URLSearchParams({ username, password, _token: token, remember: 'false' });
  const loginResp = await fetchWithJar(`${CNF_BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json, text/plain, */*',
    },
    body: body.toString(),
  }, jar);

  if (loginResp.status >= 300 && loginResp.status < 400) {
    return jar;
  }

  const data = await loginResp.json().catch(() => ({}));
  if (String(data?.code) !== '1') {
    throw new Error(String(data?.msg || '账号或密码错误'));
  }
  return jar;
}

function parseMySquadHtml(html) {
  const classes = [];
  const rowPattern = /<tr\s*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowPattern.exec(html)) !== null) {
    const content = match[1];
    const idMatch = content.match(/data-id="(\d+)"/);
    const linkMatch = content.match(/squad_console\?type=(\w+)&id=(\d+)/);
    const nameMatch = content.match(/column-name[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+)/);
    const sectionMatch = content.match(/column-section[^>]*>\s*([\s\S]*?)\s*<\/td>/);
    const groupMatch = content.match(/column-group[^>]*>\s*([\s\S]*?)\s*<\/td>/);
    const teacherMatch = content.match(/column-class_teacher[^>]*>\s*([\s\S]*?)\s*<\/td>/);
    if (idMatch && nameMatch) {
      classes.push({
        id: Number(idMatch[1]),
        type: linkMatch?.[1] || 'offline',
        name: nameMatch[1].trim(),
        section: (sectionMatch?.[1] || '').replace(/<[^>]+>/g, '').trim(),
        group: (groupMatch?.[1] || '').replace(/<[^>]+>/g, '').trim(),
        tutor: (teacherMatch?.[1] || '').replace(/<[^>]+>/g, '').trim(),
      });
    }
  }
  return classes;
}

app.post('/api/scraper/login', async (req, res) => {
  const { session } = ensureSession(req, res);
  const traceId = getTraceId(req);
  res.setHeader('X-Login-Trace-Id', traceId);

  if (session.loginInProgress) {
    return res.status(429).json({ error: '正在登录中，请稍等...', traceId });
  }

  try {
    const startedAt = performance.now();
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '缺少用户名或密码' });
    }

    session.loginInProgress = true;
    logTrace(traceId, 'login_request_started', {
      username,
      hadExistingSession: Boolean(session.scraper),
    });

    if (session.scraper) {
      try { await session.scraper.close(); } catch {}
      session.scraper = null;
    }

    const scraper = new EducationSystemScraper({
      baseUrl: CNF_BASE_URL,
      username,
      password,
    });

    await scraper.login();
    const loginFinishedAt = performance.now();
    logTrace(traceId, 'scraper_login_completed', {
      timings: scraper.lastLoginTiming,
    });
    console.log(`✅ 登录成功: ${username}`);

    const classMap = await scraper.getClassMap();
    const classesFinishedAt = performance.now();
    const classes = classMap.map((item) => ({
      id: item.classCode,
      name: item.classCode,
      squadId: item.squadId,
    }));
    console.log(`✅ 获取到 ${classes.length} 个班级: ${classes.map(c => c.name).join(', ')}`);

    session.scraper = scraper;
    session.username = username;
    session.lastSeenAt = Date.now();

    await appendUsageEvent(buildUsageEvent(req, session, {
      event: 'login_success',
      module: 'auth',
      detail: `classes=${classes.length}`,
    }));

    const responseTimings = {
      routeMs: Number((classesFinishedAt - startedAt).toFixed(1)),
      scraperLogin: scraper.lastLoginTiming,
      classMap: scraper.lastClassMapTiming,
      routePhases: {
        loginMs: Number((loginFinishedAt - startedAt).toFixed(1)),
        classMapMs: Number((classesFinishedAt - loginFinishedAt).toFixed(1)),
      },
    };
    logTrace(traceId, 'login_request_completed', {
      classCount: classes.length,
      timings: responseTimings,
    });

    res.json({
      status: 'success',
      message: '登录成功',
      traceId,
      classes,
      classCount: classes.length,
      timings: responseTimings,
    });
  } catch (error) {
    logTrace(traceId, 'login_request_failed', {
      error: error.message,
    });
    console.error('❌ 登录失败:', error.message);
    res.status(500).json({ error: error.message, traceId });
  } finally {
    session.loginInProgress = false;
  }
});

app.post('/api/traces/login-client', (req, res) => {
  const traceId = String(req.body?.traceId || '').trim() || crypto.randomUUID();
  console.log('[login-client-trace]', JSON.stringify({
    traceId,
    totalMs: req.body?.totalMs,
    requestMs: req.body?.requestMs,
    responseParseMs: req.body?.responseParseMs,
    handoffMs: req.body?.handoffMs,
    renderMs: req.body?.renderMs,
    location: req.body?.location,
    userAgent: req.body?.userAgent,
  }));
  res.json({ status: 'ok', traceId });
});

app.post('/api/usage-events', async (req, res) => {
  try {
    const { session } = ensureSession(req, res);
    const event = buildUsageEvent(req, session, req.body || {});
    if (!event.event || event.event === 'unknown') {
      return res.status(400).json({ error: '缺少 event' });
    }
    await appendUsageEvent(event);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ 使用统计写入失败:', error.message);
    res.status(500).json({ error: '使用统计写入失败' });
  }
});

app.get('/api/admin/usage-summary', async (req, res) => {
  try {
    const days = Math.min(180, Math.max(1, Number(req.query.days) || 30));
    const events = await readUsageEvents(days);
    res.json({
      status: 'success',
      days,
      logPath: USAGE_LOG_PATH,
      summary: summarizeUsageEvents(events),
    });
  } catch (error) {
    console.error('❌ 使用统计汇总失败:', error.message);
    res.status(500).json({ error: '使用统计汇总失败' });
  }
});

app.post('/api/scraper/get-classes', async (req, res) => {
  try {
    const session = requireLoggedInSession(req, res);
    if (!session) return;

    const classMap = await session.scraper.getClassMap(true);
    const classes = classMap.map((item) => ({
      id: item.classCode,
      name: item.classCode,
      squadId: item.squadId,
    }));
    console.log(`✅ 刷新班级: ${classes.length} 个`);
    res.json({ status: 'success', data: classes, count: classes.length });
  } catch (error) {
    console.error('❌ 获取班级失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scraper/get-student-list', async (req, res) => {
  try {
    const session = requireLoggedInSession(req, res);
    if (!session) return;

    const { classId } = req.body || {};
    if (!classId) {
      return res.status(400).json({ error: '缺少班级ID' });
    }

    const { squadId } = await session.scraper.resolveSquadId(classId);
    const response = await session.scraper.request(
      `/admin/squad/cop_mip/getStudentList?squad_id=${encodeURIComponent(squadId)}&squad_type=offline`,
      { headers: { accept: 'application/json' } }
    );
    const data = await response.json().catch(() => ({}));
    if (!Array.isArray(data?.data)) {
      throw new Error(String(data?.msg || `学生名单获取失败: ${response.status}`));
    }

    const students = data.data.map((item) => ({
      no: String(item?.no || '').trim(),
      chName: String(item?.ch_name || '').trim(),
      enName: String(item?.en_name || '').trim(),
    }));

    console.log(`✅ 获取班级 ${classId} (squad=${squadId}) 学生名单: ${students.length} 人`);
    res.json({ status: 'success', data: students, count: students.length, squadId });
  } catch (error) {
    console.error('❌ 获取学生名单失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scraper/batch-student-list', async (req, res) => {
  try {
    const session = requireLoggedInSession(req, res);
    if (!session) return;

    const { classIds } = req.body || {};
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ error: '缺少班级列表' });
    }

    const startedAt = performance.now();

    // Resolve all squad IDs first (uses cached class map)
    const resolved = [];
    for (const classId of classIds) {
      try {
        const { squadId } = await session.scraper.resolveSquadId(classId);
        resolved.push({ classId, squadId });
      } catch (err) {
        console.warn(`⚠️ 无法解析班级 ${classId}: ${err.message}`);
      }
    }

    // Fetch all student lists in parallel
    const results = await Promise.allSettled(
      resolved.map(async ({ classId, squadId }) => {
        const response = await session.scraper.request(
          `/admin/squad/cop_mip/getStudentList?squad_id=${encodeURIComponent(squadId)}&squad_type=offline`,
          { headers: { accept: 'application/json' } }
        );
        const data = await response.json().catch(() => ({}));
        if (!Array.isArray(data?.data)) {
          throw new Error(String(data?.msg || `HTTP ${response.status}`));
        }
        return {
          classId,
          squadId,
          students: data.data.map((item) => ({
            no: String(item?.no || '').trim(),
            chName: String(item?.ch_name || '').trim(),
            enName: String(item?.en_name || '').trim(),
          })),
        };
      })
    );

    const classes = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        classes.push(result.value);
      }
    }

    const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);
    const totalMs = Number((performance.now() - startedAt).toFixed(1));
    console.log(`✅ 批量抓取 ${classes.length}/${classIds.length} 个班级，共 ${totalStudents} 人，耗时 ${totalMs}ms`);
    res.json({ status: 'success', classes, totalMs });
  } catch (error) {
    console.error('❌ 批量抓取失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cnf-roster', async (req, res) => {
  try {
    const action = String(req.body?.action || '').trim();
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const squadId = String(req.body?.squadId || '').trim();
    const squadType = String(req.body?.squadType || 'offline').trim() || 'offline';

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: '缺少教务账号或密码' });
    }

    if (action === 'listSquads') {
      const jar = await loginCNF(username, password);
      const myResp = await fetchWithJar(`${CNF_BASE_URL}/admin/my_squad`, {
        method: 'GET',
        headers: { Accept: 'text/html' },
      }, jar);
      if (myResp.status >= 300 && myResp.status < 400) {
        throw new Error('登录态失效，请重新登录');
      }
      const myHtml = await myResp.text();
      const squads = parseMySquadHtml(myHtml);
      return res.json({ ok: true, squads, total: squads.length });
    }

    if (action === 'fetchRoster') {
      if (!/^\d+$/.test(squadId)) {
        return res.status(400).json({ ok: false, error: '缺少有效的班级 ID' });
      }

      const jar = await loginCNF(username, password);
      const infoResp = await fetchWithJar(
        `${CNF_BASE_URL}/admin/squad_console/getSquadInfo?squad_id=${encodeURIComponent(squadId)}`,
        { method: 'GET', headers: { Accept: 'application/json' } },
        jar
      );
      const infoData = await infoResp.json().catch(() => ({}));

      const listResp = await fetchWithJar(
        `${CNF_BASE_URL}/admin/squad/cop_mip/getStudentList?squad_id=${encodeURIComponent(squadId)}&squad_type=${encodeURIComponent(squadType)}`,
        { method: 'GET', headers: { Accept: 'application/json' } },
        jar
      );
      const listData = await listResp.json().catch(() => ({}));
      if (!Array.isArray(listData?.data)) {
        throw new Error(String(listData?.msg || `学生名单获取失败: ${listResp.status}`));
      }

      const students = listData.data.map((item) => {
        const enName = String(item?.en_name || '').trim();
        const chName = String(item?.ch_name || '').trim();
        return {
          id: Number(item?.id) || 0,
          no: String(item?.no || '').trim(),
          enName,
          chName,
          displayName: enName || chName || String(item?.no || '').trim(),
        };
      });

      const squad = infoData?.data || {};
      return res.json({
        ok: true,
        squad: {
          id: Number(squad?.id) || Number(squadId),
          name: String(squad?.name || '').trim(),
          fullName: String(squad?.full_name || '').trim(),
          type: squadType,
        },
        students,
        total: students.length,
      });
    }

    return res.status(400).json({ ok: false, error: 'action 必须为 listSquads 或 fetchRoster' });
  } catch (error) {
    console.error('❌ CNF名单同步失败:', error.message);
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : '教务名单同步失败' });
  }
});

// ── 探测 cop_mip 发放接口（临时调试用）────────────────────────────────────────
app.post('/api/debug/probe-copmip', async (req, res) => {
  try {
    const session = requireLoggedInSession(req, res);
    if (!session) return;
    const { classId } = req.body || {};
    const { squadId } = await session.scraper.resolveSquadId(String(classId || 'J342'));
    const results = {};

    // 1. 抓取 squad_console 页面找 cop_mip 相关链接和表单
    const { text: consoleHtml } = await session.scraper.requestText(
      `/admin/squad_console?id=${squadId}&type=offline`,
      { headers: { accept: 'text/html' } }
    );
    const copMipUrls = [...new Set((consoleHtml.match(/cop_mip[^"'\s)}<]*/g) || []))];
    const formActions = [...new Set((consoleHtml.match(/action="([^"]+)"/g) || []))];
    const ajaxUrls = [...new Set((consoleHtml.match(/['"]\/admin\/[^'"]*cop_mip[^'"]*['"]/g) || []))];
    results.consolePageUrls = { copMipUrls, formActions, ajaxUrls };

    // 2. 找 JS 文件中的 cop_mip 接口
    const scriptSrcs = consoleHtml.match(/src="([^"]*\.js[^"]*)"/g) || [];
    results.scriptCount = scriptSrcs.length;

    // 3. 尝试获取 cop_mip 页面（如果有独立页面）
    const copMipPages = [
      `/admin/squad/cop_mip?squad_id=${squadId}`,
      `/admin/squad/cop_mip/index?squad_id=${squadId}`,
      `/admin/squad/cop_mip/manage?squad_id=${squadId}&squad_type=offline`,
      `/admin/squad/cop_mip/create?squad_id=${squadId}`,
      `/admin/squad/cop_mip/sendMip`,
    ];
    results.pageProbes = {};
    for (const page of copMipPages) {
      try {
        const resp = await session.scraper.request(page, {
          headers: { accept: 'text/html,application/json' },
          redirect: 'manual',
        });
        const status = resp.status;
        const body = await resp.text().catch(() => '');
        const hasForm = body.includes('<form') || body.includes('store');
        const inputs = (body.match(/<input[^>]*name="([^"]+)"/g) || []).slice(0, 10);
        const storeUrls = [...new Set((body.match(/store[^"'\s)}<]*/g) || []).slice(0, 5))];
        results.pageProbes[page] = { status, hasForm, inputs, storeUrls, bodyLen: body.length, preview: body.slice(0, 300) };
      } catch (e) {
        results.pageProbes[page] = { error: e.message };
      }
    }

    // 4. 尝试 cop_mip POST 接口
    const xsrfCookie = session.scraper.getDecodedCookieValue('XSRF-TOKEN');
    const csrfToken = session.scraper.extractLoginToken(consoleHtml);
    const postEndpoints = [
      { url: '/admin/squad/cop_mip/sendMip', data: { squad_id: squadId, student_no: '20240001', amount: 0, _token: csrfToken } },
      { url: '/admin/squad/cop_mip/store', data: { squad_id: squadId, _token: csrfToken } },
      { url: '/admin/squad/cop_mip/send', data: { squad_id: squadId, _token: csrfToken } },
    ];
    results.postProbes = {};
    for (const { url, data } of postEndpoints) {
      try {
        const resp = await session.scraper.request(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json, text/html',
            ...(xsrfCookie ? { 'x-xsrf-token': xsrfCookie } : {}),
          },
          body: new URLSearchParams(data).toString(),
          redirect: 'manual',
        });
        const status = resp.status;
        const body = await resp.text().catch(() => '');
        if (status !== 404) {
          results.postProbes[url] = { status, preview: body.slice(0, 500) };
        }
      } catch (e) {
        results.postProbes[url] = { error: e.message };
      }
    }

    res.json({ ok: true, squadId, ...results });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ── MP 余额查询 ─────────────────────────────────────────────────────────────
app.post('/api/mp/balance', async (req, res) => {
  try {
    const session = requireLoggedInSession(req, res);
    if (!session) return;
    const { classId } = req.body || {};
    if (!classId) return res.status(400).json({ error: '缺少班级ID' });
    const balance = await session.scraper.getMinipinBalance(String(classId));
    res.json({ status: 'success', ...balance });
  } catch (error) {
    console.error('❌ 查询MP余额失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── MP 直接发放 ──────────────────────────────────────────────────────────────
app.post('/api/scraper/submit-minipin', async (req, res) => {
  try {
    const session = requireLoggedInSession(req, res);
    if (!session) return;

    const { classId, rewards } = req.body || {};
    if (!classId || !Array.isArray(rewards) || rewards.length === 0) {
      return res.status(400).json({ error: '缺少班级ID或奖励数据' });
    }

    const normalizedRewards = rewards
      .map((reward) => ({
        studentId: String(reward.studentId || '').trim(),
        studentName: String(reward.studentName || '').trim(),
        chineseName: String(reward.chineseName || '').trim(),
        aliases: Array.isArray(reward.aliases)
          ? reward.aliases.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
        amount: Number(reward.amount) || 0,
      }))
      .filter((reward) => reward.studentName && reward.amount > 0);

    if (normalizedRewards.length === 0) {
      return res.status(400).json({ error: '没有可发放的奖励' });
    }

    const result = await session.scraper.submitMinipinDirect(String(classId), normalizedRewards);
    res.json({ status: 'success', ...result });
  } catch (error) {
    console.error('❌ 发放奖励失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── AI 日报生成 ──────────────────────────────────────────────────────────────
function callAnthropicAPI(messages, systemPrompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      reject(new Error('ANTHROPIC_API_KEY 未配置，请在后端环境中设置该变量'));
      return;
    }

    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            } else {
              resolve(parsed.content?.[0]?.text ?? '');
            }
          } catch (e) {
            reject(new Error('API 响应解析失败: ' + data.slice(0, 200)));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callCodexFallback(messages, systemPrompt) {
  return new Promise((resolve, reject) => {
    const prompt = [
      systemPrompt,
      '',
      '请严格只输出最终日报正文，不要添加解释、前言、后记或代码块围栏。',
      '',
      ...messages.map((message) => {
        const role = message.role === 'user' ? '用户' : '助手';
        return `${role}：${message.content}`;
      }),
    ].join('\n');

    const child = spawn(
      'codex',
      [
        'exec',
        '--json',
        '--skip-git-repo-check',
        '--dangerously-bypass-approvals-and-sandbox',
        '-m',
        'gpt-5.4-mini',
        prompt,
      ],
      {
        cwd: path.join(__dirname, '..'),
        env: process.env,
      }
    );

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('日报生成超时，请稍后再试'));
    }, 120000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(stderr.trim() || `日报生成失败（退出码 ${code}）`));
        return;
      }

      const lines = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed?.type === 'item.completed' && parsed?.item?.type === 'agent_message') {
            const text = String(parsed.item.text || '').trim();
            if (text) {
              resolve(text);
              return;
            }
          }
        } catch {
          // ignore non-JSON lines
        }
      }

      reject(new Error('日报生成失败，未获取到可用内容'));
    });
  });
}

function generateDailyReport(messages, systemPrompt) {
  if (process.env.ANTHROPIC_API_KEY) {
    return callAnthropicAPI(messages, systemPrompt);
  }
  return callCodexFallback(messages, systemPrompt);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'AmberClass/1.0',
          Accept: 'application/json, text/plain, */*',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`JSON 解析失败: ${data.slice(0, 120)}`));
          }
        });
      }
    );
    req.on('error', reject);
  });
}

async function translateWordToChinese(text) {
  const safeText = String(text || '').trim();
  if (!safeText) return '';

  try {
    const googlePayload = await requestJson(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(safeText)}`
    );
    const rows = Array.isArray(googlePayload?.[0]) ? googlePayload[0] : [];
    const translated = rows
      .map((row) => (Array.isArray(row) ? String(row[0] || '') : ''))
      .join('')
      .trim();
    if (translated) return translated;
  } catch (error) {
    console.warn('translate google failed:', error.message);
  }

  try {
    const memoryPayload = await requestJson(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(safeText)}&langpair=en|zh-CN`
    );
    const translated = String(memoryPayload?.responseData?.translatedText || '').trim();
    if (translated) return translated;
  } catch (error) {
    console.warn('translate mymemory failed:', error.message);
  }

  return '';
}

function buildDailyReportPrompt(mode, customPrompt) {
  const basePrompt = `你是一位英语培训机构的班主任助手，负责根据课程数据生成班级日报。
输出格式为 Markdown，使用中文。
语气积极、专业，避免批评性语言。`;

  if (mode === 'detailed') {
    return `${basePrompt}

请生成详细版班级日报，内容尽量完整、信息密度更高。
优先包含以下内容（根据数据实际情况灵活调整）：
1. 本次课程整体情况与课堂状态
2. 出勤、完成度、积分或表现亮点
3. 每个重点学生的具体表现或进步点
4. 需要后续关注的情况
5. 本课重点与老师建议`;
  }

  if (mode === 'custom') {
    return `${basePrompt}

请按照用户给出的自定义要求生成日报。
如果用户要求与原始数据冲突，以原始数据为准。
用户的自定义要求如下：
${String(customPrompt || '').trim()}`;
  }

  return `${basePrompt}

请生成常规版班级日报，简洁清晰，适合直接发送。
优先包含以下内容（根据数据实际情况灵活调整）：
1. 本次课程总体情况
2. 积分或表现亮点
3. 需要关注的情况
  4. 老师寄语或本课重点`;
}

function parseMarkdownTableRows(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith('|') && line.endsWith('|'));

  return lines
    .filter((line) => !/^\|\s*(---\s*\|)+\s*$/.test(line))
    .map((line) => line
      .slice(1, -1)
      .split('|')
      .map((cell) => String(cell || '').trim()));
}

function parseCompletedValue(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (['进行中', '未完成', '否', '0', '×'].includes(text)) return false;
  if (['已完成', '完成', '是', '1', '√'].includes(text)) return true;
  return null;
}

function parseScoreValue(value) {
  const text = String(value || '').trim().replace('%', '');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeTablesForReport(tables, fallbackClassCode) {
  const studentMap = new Map();

  for (const table of tables) {
    const name = String(table?.name || '');
    const rows = parseMarkdownTableRows(table?.text);
    if (rows.length < 4) continue;

    const row1 = rows[1] || [];
    const row2 = rows[2] || [];
    const resourceBlocks = [];
    let currentBlock = null;

    for (let ci = 0; ci < row1.length; ci += 1) {
      const cell = String(row1[ci] || '').trim();
      if (cell.includes('[')) {
        if (currentBlock) {
          currentBlock.endCol = ci - 1;
          resourceBlocks.push(currentBlock);
        }
        currentBlock = { startCol: ci, endCol: ci, subCols: [] };
      }
      if (currentBlock && row2[ci] !== undefined) {
        currentBlock.subCols.push(String(row2[ci] || '').trim());
      }
    }
    if (currentBlock) {
      currentBlock.endCol = row1.length - 1;
      resourceBlocks.push(currentBlock);
    }

    for (let ri = 3; ri < rows.length; ri += 1) {
      const row = rows[ri] || [];
      const studentId = String(row[1] || '').trim();
      if (!studentId || studentId === '学号') continue;

      const chineseName = String(row[2] || '').trim();
      const englishName = String(row[3] || '').trim();
      const studentName = englishName || chineseName || studentId;
      const existing = studentMap.get(studentName) || {
        name: studentName,
        completedTasks: 0,
        totalTrackedTasks: 0,
        scoreSum: 0,
        scoreCount: 0,
      };

      for (const block of resourceBlocks) {
        let colIdx = block.startCol;
        for (const subCol of block.subCols) {
          const rawVal = row[colIdx] ?? '';
          if (subCol.includes('是否完成')) {
            const completed = parseCompletedValue(rawVal);
            if (completed !== null) {
              existing.totalTrackedTasks += 1;
              if (completed) existing.completedTasks += 1;
            }
          }
          if (
            subCol.includes('分数') ||
            subCol.includes('平均分') ||
            subCol.includes('正确率')
          ) {
            const score = parseScoreValue(rawVal);
            if (score !== null) {
              existing.scoreSum += score;
              existing.scoreCount += 1;
            }
          }
          colIdx += 1;
        }
      }

      studentMap.set(studentName, existing);
    }

    if (rows.length > 1 && studentMap.size === 0) {
      for (let ri = 1; ri < rows.length; ri += 1) {
        const row = rows[ri] || [];
        const studentName = String(row[3] || row[2] || row[1] || row[0] || '').trim();
        if (!studentName) continue;
        if (!studentMap.has(studentName)) {
          studentMap.set(studentName, {
            name: studentName,
            completedTasks: 0,
            totalTrackedTasks: 0,
            scoreSum: 0,
            scoreCount: 0,
          });
        }
      }
    }

    const classMatch = name.match(/([A-Z]\d{2,4})/i);
    if (!fallbackClassCode && classMatch) fallbackClassCode = classMatch[1].toUpperCase();
  }

  return {
    classCode: fallbackClassCode,
    students: Array.from(studentMap.values()),
  };
}

function averageScore(student) {
  return student.scoreCount > 0 ? student.scoreSum / student.scoreCount : null;
}

function buildFastDailyReport({ classCode, tables, note, mode, customPrompt }) {
  const summary = summarizeTablesForReport(tables, classCode);
  const studentCount = summary.students.length;
  const trackedStudents = summary.students.filter((student) => student.totalTrackedTasks > 0);
  const overallCompletion = trackedStudents.length > 0
    ? trackedStudents.reduce((sum, student) => sum + (student.completedTasks / Math.max(student.totalTrackedTasks, 1)), 0) / trackedStudents.length * 100
    : null;
  const scoredStudents = summary.students.filter((student) => student.scoreCount > 0);
  const overallScore = scoredStudents.length > 0
    ? scoredStudents.reduce((sum, student) => sum + (averageScore(student) || 0), 0) / scoredStudents.length
    : null;

  const ranked = [...summary.students].sort((a, b) => {
    const aCompletion = a.totalTrackedTasks > 0 ? a.completedTasks / a.totalTrackedTasks : 0;
    const bCompletion = b.totalTrackedTasks > 0 ? b.completedTasks / b.totalTrackedTasks : 0;
    const aScore = averageScore(a) || 0;
    const bScore = averageScore(b) || 0;
    return (bCompletion * 100 + bScore) - (aCompletion * 100 + aScore);
  });

  const topStudents = ranked.slice(0, Math.min(3, ranked.length));
  const attentionStudents = ranked
    .filter((student) => student.totalTrackedTasks > 0 && student.completedTasks / Math.max(student.totalTrackedTasks, 1) < 0.7)
    .slice(0, 2);

  const focusLine = mode === 'custom' && String(customPrompt || '').trim()
    ? `本次重点：${String(customPrompt).trim()}`
    : '';
  const noteBlock = String(note || '').trim()
    ? `\n## 补充说明\n${String(note).trim()}`
    : '';
  const highlightLines = topStudents.length > 0
    ? topStudents.map((student) => {
        const completion = student.totalTrackedTasks > 0
          ? `${student.completedTasks}/${student.totalTrackedTasks}`
          : '已导入学习数据';
        const score = averageScore(student);
        return `- ${student.name}：完成情况 ${completion}${score !== null ? `，表现分约 ${Math.round(score)}` : ''}`;
      }).join('\n')
    : '- 本次已成功导入学生数据。';
  const attentionLines = attentionStudents.length > 0
    ? attentionStudents.map((student) => `- ${student.name}：后续可重点关注完成进度和课堂跟进。`).join('\n')
    : '- 暂无明显异常，整体状态稳定。';

  if (mode === 'detailed' || /详细|展开|具体/.test(String(customPrompt || ''))) {
    const studentBlocks = topStudents.map((student) => {
      const completionRate = student.totalTrackedTasks > 0
        ? Math.round((student.completedTasks / student.totalTrackedTasks) * 100)
        : null;
      const score = averageScore(student);
      return `### ${student.name}
- 完成度：${student.totalTrackedTasks > 0 ? `${student.completedTasks}/${student.totalTrackedTasks}（${completionRate}%）` : '已导入数据'}
${score !== null ? `- 表现分：约 ${Math.round(score)}` : '- 表现分：暂无可直接量化分数'}
- 整体表现：本次课堂状态稳定，建议继续保持当前节奏。`;
    }).join('\n\n');

    return `# ${summary.classCode || classCode} 班级日报详细版

${focusLine ? `${focusLine}\n\n` : ''}## 整体情况
- 学生人数：${studentCount}
${overallCompletion !== null ? `- 整体完成度：${Math.round(overallCompletion)}%` : '- 整体完成度：暂无可直接量化数据'}
${overallScore !== null ? `- 整体表现分：约 ${Math.round(overallScore)}` : '- 整体表现分：暂无可直接量化分数'}
- 整体判断：课堂状态总体稳定，数据已成功汇总。

## 亮点学生
${highlightLines}

## 重点学生情况
${studentBlocks || '- 本次暂无可展开的重点学生明细。'}

## 需要关注
${attentionLines}${noteBlock}`;
  }

  return `# ${summary.classCode || classCode} 班级日报

${focusLine ? `${focusLine}\n\n` : ''}## 本次课程总体情况
- 学生人数：${studentCount}
${overallCompletion !== null ? `- 整体完成度：${Math.round(overallCompletion)}%` : '- 已成功读取本次学习数据'}
${overallScore !== null ? `- 整体表现分：约 ${Math.round(overallScore)}` : '- 整体课堂状态稳定，可直接用于日报整理'}

## 表现亮点
${highlightLines}

## 需要关注
${attentionLines}${noteBlock}`;
}

app.post('/api/ai/daily-report', async (req, res) => {
  try {
    const { classCode, tables, note, mode = 'standard', customPrompt = '' } = req.body || {};
    if (!classCode) return res.status(400).json({ error: '缺少班级代码' });
    if (!Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ error: '请至少上传一个数据表格' });
    }
    if (mode === 'custom' && !String(customPrompt).trim()) {
      return res.status(400).json({ error: '缺少自定义提示' });
    }

    const fastReport = buildFastDailyReport({
      classCode,
      tables,
      note,
      mode,
      customPrompt,
    });
    if (fastReport) {
      return res.json({ status: 'success', report: fastReport, source: 'local-fast' });
    }

    const tableText = tables
      .map((t) => `【${t.name}】\n${t.text}`)
      .join('\n\n');

    const modeLabel = mode === 'detailed' ? '详细版' : mode === 'custom' ? '自定义' : '常规版';
    const systemPrompt = buildDailyReportPrompt(mode, customPrompt);

    const userContent = `班级：${classCode}
模式：${modeLabel}

课程数据如下：

${tableText}${note ? `\n\n老师补充说明：${note}` : ''}${mode === 'custom' ? `\n\n自定义要求：${String(customPrompt).trim()}` : ''}`;

    const report = await generateDailyReport(
      [{ role: 'user', content: userContent }],
      systemPrompt
    );

    res.json({ status: 'success', report });
  } catch (error) {
    console.error('❌ 日报生成失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

function decodeBase64File(payload, label) {
  const name = String(payload?.name || '').trim();
  const content = String(payload?.content || '').trim();
  if (!name || !content) {
    throw new Error(`${label}文件缺失`);
  }
  return {
    name,
    buffer: Buffer.from(content, 'base64'),
  };
}

function inferClassNameFromFilename(filename) {
  const match = String(filename || '').match(/([A-Za-z]\d{3,})/);
  return match ? `${match[1].toUpperCase()}班` : '';
}

function createEmptyCheckinWorkbook(filePath) {
  return new Promise((resolve, reject) => {
    const script = `
import sys
from openpyxl import Workbook

target = sys.argv[1]
wb = Workbook()
ws = wb.active
ws.title = "data"
headers = ["学号", "姓名", "周一", "周二", "周三", "周四", "周五", "周六", "周日", "备注", "总打卡", "正常打卡", "补卡"]
ws.append(headers)
wb.save(target)
`;

    const child = spawn('python3', ['-c', script, filePath], { env: process.env });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || '空白打卡表创建失败'));
        return;
      }
      resolve();
    });
  });
}

function cleanupNoCheckinWorkbook(workbookPath, reportMode) {
  return new Promise((resolve, reject) => {
    const script = `
import sys
from openpyxl import load_workbook

path = sys.argv[1]
mode = sys.argv[2]
wb = load_workbook(path)

if mode == "detail":
    ws = wb[wb.sheetnames[0]]
    ws.delete_cols(3, 1)
else:
    ws_analysis = wb["质量分析"]
    header_row = 1
    target_col = None
    for col in range(1, ws_analysis.max_column + 1):
        value = ws_analysis.cell(header_row, col).value
        if str(value).strip() == "打卡":
            target_col = col
            break
    if target_col:
        ws_analysis.delete_cols(target_col, 1)

for ws in wb.worksheets:
    for row in ws.iter_rows():
        for cell in row:
            if isinstance(cell.value, str) and "打卡" in cell.value:
                cell.value = cell.value.replace("质量/打卡", "质量")

wb.save(path)
`;

    const child = spawn('python3', ['-c', script, workbookPath, reportMode], { env: process.env });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || '清理打卡列失败'));
        return;
      }
      resolve();
    });
  });
}

function runPythonReport(scriptPath, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [scriptPath, ...args], { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('日报生成超时，请稍后再试'));
    }, 120000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(stderr.trim() || `日报生成失败（退出码 ${code}）`));
        return;
      }

      const outputPath = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);

      if (!outputPath) {
        reject(new Error('日报生成失败，未拿到输出文件'));
        return;
      }

      resolve(outputPath);
    });
  });
}

app.post('/api/reports/class-daily-report', async (req, res) => {
  let tempDir = '';

  try {
    const { session } = ensureSession(req, res);
    const {
      className = '',
      reportMode = 'standard',
      studentFile,
      checkinFile,
      minCheckinDays,
    } = req.body || {};

    const normalizedMode = reportMode === 'detail' ? 'detail' : 'standard';
    const student = decodeBase64File(studentFile, '学生个人数据');

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'class-daily-report-'));
    const studentPath = path.join(tempDir, student.name);
    const checkinPath = path.join(tempDir, String(checkinFile?.name || 'optional-checkin.xlsx'));
    await fs.writeFile(studentPath, student.buffer);
    const hasCheckinFile = !!(checkinFile?.name && checkinFile?.content);
    if (hasCheckinFile) {
      const checkin = decodeBase64File(checkinFile, '打卡情况');
      await fs.writeFile(checkinPath, checkin.buffer);
    } else {
      await createEmptyCheckinWorkbook(checkinPath);
    }

    const scriptPath = normalizedMode === 'detail'
      ? path.resolve(REPORT_SCRIPT_DIR, 'class_daily_report_detail.py')
      : path.resolve(REPORT_SCRIPT_DIR, 'class_daily_report.py');

    const args = [checkinPath, studentPath];
    const inferredClassName = inferClassNameFromFilename(student.name);
    const trimmedClassName = inferredClassName || String(className || '').trim();
    if (trimmedClassName) {
      args.push(trimmedClassName);
    }
    if (!hasCheckinFile) {
      args.push('--no-checkin');
    }
    const parsedMinCheckin = parseInt(minCheckinDays, 10);
    if (!isNaN(parsedMinCheckin) && parsedMinCheckin >= 0) {
      args.push('--min-checkin', String(parsedMinCheckin));
    }

    const outputPath = await runPythonReport(scriptPath, args, tempDir);
    if (!hasCheckinFile) {
      await cleanupNoCheckinWorkbook(outputPath, normalizedMode);
    }
    const fileBuffer = await fs.readFile(outputPath);
    const downloadName = path.basename(outputPath);

    await appendUsageEvent(buildUsageEvent(req, session, {
      event: 'report_exported',
      module: 'daily-report',
      className: trimmedClassName,
      detail: normalizedMode,
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    res.send(fileBuffer);
  } catch (error) {
    console.error('❌ 班级日报文件生成失败:', error.message);
    res.status(500).json({ error: error.message || '班级日报生成失败' });
  } finally {
    if (tempDir) {
      fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

app.get('/api/translate/en-zh', async (req, res) => {
  try {
    const text = String(req.query.text || '').trim();
    if (!text) return res.status(400).json({ error: '缺少 text' });
    const translated = await translateWordToChinese(text);
    res.json({ status: 'success', translated });
  } catch (error) {
    console.error('❌ 翻译失败:', error.message);
    res.status(500).json({ error: error.message || '翻译失败' });
  }
});

// Tencent Cloud OCR proxy
const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID || '';
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY || '';

function tencentSign(secretKey, date, service, stringToSign) {
  const kDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const kService = crypto.createHmac('sha256', kDate).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  return crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
}

const TENCENT_OCR_ACTIONS = {
  Auto: 'GeneralAccurateOCR',
  GeneralAccurateOCR: 'GeneralAccurateOCR',
  GeneralBasicOCR: 'GeneralBasicOCR',
  ExtractDocMulti: 'RecognizeGeneralTextImageWarn',
};

app.post('/api/tencent-ocr', async (req, res) => {
  try {
    const { imageBase64, action = 'Auto', region = 'ap-guangzhou' } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: '缺少图片数据' });
    }

    const ocrAction = TENCENT_OCR_ACTIONS[action] || 'GeneralAccurateOCR';
    const service = 'ocr';
    const host = 'ocr.tencentcloudapi.com';
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    const payload = JSON.stringify({ ImageBase64: imageBase64 });
    const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');

    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${ocrAction.toLowerCase()}\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;

    const credentialScope = `${date}/${service}/tc3_request`;
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    const signature = tencentSign(TENCENT_SECRET_KEY, date, service, stringToSign);
    const authorization = `TC3-HMAC-SHA256 Credential=${TENCENT_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const ocrRes = await fetch(`https://${host}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'X-TC-Action': ocrAction,
        'X-TC-Version': '2018-11-19',
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': region,
        'Authorization': authorization,
      },
      body: payload,
    });

    const ocrRawText = await ocrRes.text();
    let ocrData;
    try { ocrData = JSON.parse(ocrRawText); } catch { ocrData = {}; }
    console.log('🔍 腾讯OCR HTTP状态:', ocrRes.status, '响应长度:', ocrRawText.length);
    const response = ocrData.Response || {};

    if (response.Error) {
      console.error('❌ 腾讯OCR错误:', response.Error.Code, response.Error.Message);
      return res.status(502).json({ error: `OCR错误: ${response.Error.Message} (${response.Error.Code})` });
    }

    const textDetections = response.TextDetections || [];
    const rawText = textDetections.map(d => d.DetectedText || '').join('\n');
    const words = textDetections.map(d => {
      const coords = d.ItemPolygon || {};
      return {
        text: d.DetectedText || '',
        confidence: d.Confidence || 90,
        x0: coords.X || 0,
        y0: coords.Y || 0,
        x1: (coords.X || 0) + (coords.Width || 0),
        y1: (coords.Y || 0) + (coords.Height || 0),
      };
    });

    res.json({ rawText, words, action: ocrAction });
  } catch (error) {
    console.error('❌ OCR代理失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  const { session } = ensureSession(req, res);
  res.json({
    status: 'ok',
    loggedIn: !!session.scraper,
    loginInProgress: session.loginInProgress,
    username: session.username || '',
  });
});

// ── 前端版本检查 ────────────────────────────────────────────────────────────
const BUILD_VERSION = (() => {
  try {
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    const content = require('fs').readFileSync(indexPath, 'utf8');
    const match = content.match(/index-([^.]+)\.js/);
    return match ? match[1] : Date.now().toString(36);
  } catch {
    return Date.now().toString(36);
  }
})();

app.get('/api/version', (_req, res) => {
  res.json({ version: BUILD_VERSION });
});

// 托管前端静态文件
const distDir = path.join(__dirname, '../frontend/dist');
app.use('/assets', express.static(path.join(distDir, 'assets'), {
  index: false,
  maxAge: '1y',
  immutable: true,
}));
app.use('/assets', (_req, res) => {
  res.status(404).type('text/plain').send('Asset not found');
});
app.use(express.static(distDir, {
  index: 'index.html',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));
// SPA fallback — 兼容 Express 5
app.use((_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(distDir, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Amber server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, sessions };
