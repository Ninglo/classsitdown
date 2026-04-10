const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs/promises');
const os = require('os');
const { spawn } = require('child_process');
const EducationSystemScraper = require('./scraper/scraper');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const SESSION_COOKIE = 'amber_sid';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const CNF_BASE_URL = process.env.CNFADMIN_BASE_URL || 'https://cnfadmin.cnfschool.net';
const sessions = new Map();

function getTraceId(req) {
  const raw = String(req.headers['x-login-trace-id'] || '').trim();
  return raw || crypto.randomUUID();
}

function logTrace(traceId, stage, payload = {}) {
  console.log('[login-trace]', JSON.stringify({ traceId, stage, ...payload }));
}

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
    const {
      className = '',
      reportMode = 'standard',
      studentFile,
      checkinFile,
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
      ? path.resolve(os.homedir(), '.remotelab/instances/trial23/scripts/class_daily_report_detail.py')
      : path.resolve(os.homedir(), '.remotelab/instances/trial23/scripts/class_daily_report.py');

    const args = normalizedMode === 'detail'
      ? [checkinPath, studentPath]
      : (hasCheckinFile ? [studentPath, checkinPath] : [studentPath]);
    const inferredClassName = inferClassNameFromFilename(student.name);
    const trimmedClassName = inferredClassName || String(className || '').trim();
    if (trimmedClassName) {
      args.push(trimmedClassName);
    }

    const outputPath = await runPythonReport(scriptPath, args, tempDir);
    if (!hasCheckinFile) {
      await cleanupNoCheckinWorkbook(outputPath, normalizedMode);
    }
    const fileBuffer = await fs.readFile(outputPath);
    const downloadName = path.basename(outputPath);

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

app.get('/api/health', (req, res) => {
  const { session } = ensureSession(req, res);
  res.json({ status: 'ok', loggedIn: !!session.scraper, loginInProgress: session.loginInProgress });
});

// 托管前端静态文件
const distDir = path.join(__dirname, '../frontend/dist');
app.use('/assets', express.static(path.join(distDir, 'assets'), {
  index: false,
  maxAge: '1y',
  immutable: true,
}));
app.use(express.static(distDir, {
  index: 'index.html',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
// SPA fallback — 兼容 Express 5
app.use((_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(distDir, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Amber server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, sessions };
