const express = require('express');
const cors = require('cors');
const EducationSystemScraper = require('./scraper/scraper');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 防止未捕获的异常杀死进程
process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
});

let scraperSession = null;
let loginInProgress = false;

// 登录 + 抓班级 合并为原子操作，避免浏览器被中途关闭
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

    // 关闭旧会话
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

    // 登录后立即抓班级，保持同一浏览器会话
    const classes = await scraper.scrapeClassList();
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

// 保留此接口用于兼容，但登录时已经抓取了
app.post('/api/scraper/get-classes', async (req, res) => {
  try {
    if (!scraperSession) {
      return res.status(401).json({ error: '未登录，请先登录' });
    }
    const classes = await scraperSession.scraper.scrapeClassList();
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

app.listen(PORT, () => {
  console.log(`✅ Amber server running at http://localhost:${PORT}`);
});
