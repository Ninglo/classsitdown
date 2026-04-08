const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
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

app.post('/api/ai/daily-report', async (req, res) => {
  try {
    const { classCode, tables, note } = req.body || {};
    if (!classCode) return res.status(400).json({ error: '缺少班级代码' });
    if (!Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ error: '请至少上传一个数据表格' });
    }

    const tableText = tables
      .map((t) => `【${t.name}】\n${t.text}`)
      .join('\n\n');

    const systemPrompt = `你是一位英语培训机构的班主任助手，负责根据课程数据生成班级日报。
日报应简洁、清晰，适合发给家长或内部使用。
输出格式为 Markdown，使用中文。
日报包含以下内容（根据数据实际情况灵活调整）：
1. 本次课程总体情况（出席率、上课状态）
2. 积分/表现亮点（表现好的学生）
3. 需要关注的情况（如有缺席、积分异常等）
4. 老师寄语或本课重点
语气积极、专业，避免批评性语言。`;

    const userContent = `班级：${classCode}\n\n课程数据如下：\n\n${tableText}${note ? `\n\n老师补充说明：${note}` : ''}`;

    const report = await callAnthropicAPI(
      [{ role: 'user', content: userContent }],
      systemPrompt
    );

    res.json({ status: 'success', report });
  } catch (error) {
    console.error('❌ 日报生成失败:', error.message);
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
