const express = require('express');
const cors = require('cors');
const path = require('path');
const EducationSystemScraper = require('./scraper/scraper');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
});

let scraperSession = null;
let loginInProgress = false;

app.post('/api/scraper/login', async (req, res) => {
  if (loginInProgress) {
    return res.status(429).json({ error: '正在登录中，请稍等...' });
  }

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '缺少用户名或密码' });
    }

    loginInProgress = true;

    if (scraperSession?.scraper) {
      try { await scraperSession.scraper.close(); } catch {}
      scraperSession = null;
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

    scraperSession = { username, password, scraper };

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
    loginInProgress = false;
  }
});

app.post('/api/scraper/get-classes', async (req, res) => {
  try {
    if (!scraperSession) {
      return res.status(401).json({ error: '未登录，请先登录' });
    }
    const classMap = await scraperSession.scraper.getClassMap(true);
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', loggedIn: !!scraperSession, loginInProgress });
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
