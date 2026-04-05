const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const EducationSystemScraper = require('./scraper/scraper');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const SESSION_COOKIE = 'amber_sid';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const sessions = new Map();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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

app.post('/api/scraper/login', async (req, res) => {
  const { session } = ensureSession(req, res);

  if (session.loginInProgress) {
    return res.status(429).json({ error: '正在登录中，请稍等...' });
  }

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '缺少用户名或密码' });
    }

    session.loginInProgress = true;

    if (session.scraper) {
      try { await session.scraper.close(); } catch {}
      session.scraper = null;
    }

    const scraper = new EducationSystemScraper({
      baseUrl: 'https://cnfadmin.cnfschool.net',
      username,
      password,
    });

    await scraper.initBrowser();
    await scraper.login();
    console.log(`✅ 登录成功: ${username}`);

    const classMap = await scraper.getClassMap();
    const classes = classMap.map((item) => ({
      id: item.classCode,
      name: item.classCode,
      squadId: item.squadId,
    }));
    console.log(`✅ 获取到 ${classes.length} 个班级: ${classes.map(c => c.name).join(', ')}`);

    session.scraper = scraper;
    session.username = username;
    session.lastSeenAt = Date.now();

    res.json({
      status: 'success',
      message: '登录成功',
      classes,
      classCount: classes.length,
    });
  } catch (error) {
    console.error('❌ 登录失败:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    session.loginInProgress = false;
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
        studentName: String(reward.studentName || '').trim(),
        aliases: Array.isArray(reward.aliases)
          ? reward.aliases.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
        amount: Number(reward.amount) || 0,
      }))
      .filter((reward) => reward.studentName && reward.amount > 0);

    if (normalizedRewards.length === 0) {
      return res.status(400).json({ error: '没有可发放的奖励' });
    }

    const result = await session.scraper.submitMinipinRewards(String(classId), normalizedRewards);
    res.json({ status: 'success', ...result });
  } catch (error) {
    console.error('❌ 发放奖励失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  const { session } = ensureSession(req, res);
  res.json({ status: 'ok', loggedIn: !!session.scraper, loginInProgress: session.loginInProgress });
});

// 托管前端静态文件
const distDir = path.join(__dirname, '../frontend/dist');
app.use(express.static(distDir, { index: 'index.html' }));
// SPA fallback — 兼容 Express 5
app.use((_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Amber server running at http://localhost:${PORT}`);
});
