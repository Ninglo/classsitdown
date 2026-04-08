/**
 * 爬虫主模块
 * 用于爬取教务系统数据
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const cheerio = require('cheerio');

class EducationSystemScraper {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://cnfadmin.cnfschool.net';
    this.username = options.username;
    this.password = options.password;
    this.browser = null;
    this.page = null;
    this.cookies = [];
    this.cookieJar = new Map();
    this.browserSessionReady = false;
    this.classMapCache = [];
    this.classMapCacheAt = 0;
  }

  /**
   * 初始化浏览器
   */
  async initBrowser() {
    try {
      const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
        || (fs.existsSync(macChromePath) ? macChromePath : undefined);
      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.browserSessionReady = false;
      console.log('✅ Puppeteer浏览器已启动');
      return this.browser;
    } catch (error) {
      console.error('❌ 浏览器启动失败:', error);
      throw error;
    }
  }

  /**
   * 确保 page 可用（处理 detached frame / page closed）
   */
  async ensurePageReady() {
    if (!this.browser) {
      await this.initBrowser();
    }

    let needsHydration = false;

    if (!this.page || this.page.isClosed()) {
      this.page = await this.browser.newPage();
      needsHydration = true;
    } else {
      try {
        await this.page.evaluate(() => 1);
      } catch (error) {
        this.page = await this.browser.newPage();
        needsHydration = true;
      }
    }

    if (needsHydration) {
      this.browserSessionReady = false;
    }

    if (!this.browserSessionReady) {
      await this.hydrateBrowserSession();
    }
  }

  async sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  getCookieHeader() {
    return Array.from(this.cookieJar.values())
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  splitSetCookieHeader(value = '') {
    return String(value)
      .split(/,(?=\s*[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  parseSetCookie(header = '') {
    const parts = String(header).split(';').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    const firstEquals = parts[0].indexOf('=');
    if (firstEquals <= 0) return null;

    const hostname = new URL(this.baseUrl).hostname;
    const cookie = {
      name: parts[0].slice(0, firstEquals),
      value: parts[0].slice(firstEquals + 1),
      domain: hostname,
      path: '/',
      secure: this.baseUrl.startsWith('https://'),
      httpOnly: false,
    };

    for (const attr of parts.slice(1)) {
      const eqIndex = attr.indexOf('=');
      const rawKey = (eqIndex === -1 ? attr : attr.slice(0, eqIndex)).trim().toLowerCase();
      const rawValue = eqIndex === -1 ? '' : attr.slice(eqIndex + 1).trim();

      if (rawKey === 'path' && rawValue) {
        cookie.path = rawValue;
      } else if (rawKey === 'domain' && rawValue) {
        cookie.domain = rawValue.replace(/^\./, '');
      } else if (rawKey === 'expires' && rawValue) {
        const expiresAt = Date.parse(rawValue);
        if (!Number.isNaN(expiresAt)) {
          cookie.expires = expiresAt;
        }
      } else if (rawKey === 'max-age' && rawValue) {
        const seconds = Number(rawValue);
        if (Number.isFinite(seconds)) {
          cookie.expires = Date.now() + seconds * 1000;
        }
      } else if (rawKey === 'secure') {
        cookie.secure = true;
      } else if (rawKey === 'httponly') {
        cookie.httpOnly = true;
      } else if (rawKey === 'samesite' && rawValue) {
        cookie.sameSite = rawValue[0].toUpperCase() + rawValue.slice(1).toLowerCase();
      }
    }

    return cookie;
  }

  updateCookiesFromHeaders(headers) {
    const rawSetCookies =
      typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : this.splitSetCookieHeader(headers.get('set-cookie') || '');

    for (const rawCookie of rawSetCookies) {
      const parsed = this.parseSetCookie(rawCookie);
      if (!parsed) continue;

      if (parsed.expires && parsed.expires <= Date.now()) {
        this.cookieJar.delete(parsed.name);
        continue;
      }

      this.cookieJar.set(parsed.name, parsed);
    }

    this.cookies = Array.from(this.cookieJar.values()).map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      ...(cookie.sameSite ? { sameSite: cookie.sameSite } : {}),
      ...(cookie.expires ? { expires: Math.floor(cookie.expires / 1000) } : {}),
    }));
  }

  getDecodedCookieValue(name) {
    const value = this.cookieJar.get(name)?.value || '';
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  async request(path, options = {}) {
    const url = /^https?:\/\//i.test(path) ? path : new URL(path, this.baseUrl).toString();
    const headers = { ...(options.headers || {}) };
    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers.cookie = cookieHeader;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      redirect: options.redirect || 'follow',
    });

    this.updateCookiesFromHeaders(response.headers);
    return response;
  }

  async requestText(path, options = {}) {
    const response = await this.request(path, options);
    const text = await response.text();
    return { response, text };
  }

  extractLoginToken(html = '') {
    const hiddenInputMatch = html.match(/name=["']_token["'][^>]*value=["']([^"']+)["']/i);
    if (hiddenInputMatch?.[1]) {
      return hiddenInputMatch[1];
    }

    const inlineTokenMatch = html.match(/_token:\s*"([^"]+)"/);
    if (inlineTokenMatch?.[1]) {
      return inlineTokenMatch[1];
    }

    return '';
  }

  isLoginPage(html = '', url = '') {
    const text = String(html);
    return (
      String(url).includes('/admin/auth/login')
      || text.includes('submitLoginForm')
      || text.includes('C&F School教务管理系统 | 登录')
    );
  }

  extractClassMapFromHtml(html = '') {
    const $ = cheerio.load(html);
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const codePattern = /\b([A-Z]{1,3}\d{2,4})\b/i;
    const selectors = [
      '.small-box',
      '.box',
      '.panel',
      '.col-md-3',
      '.col-sm-3',
      '.col-xs-6',
      'li',
      'tr',
    ];

    const entries = [];
    $('a[href*="/admin/squad_console?id="]').each((_, link) => {
      const href = $(link).attr('href') || '';
      const idMatch = href.match(/[?&]id=(\d+)/);
      if (!idMatch) return;

      const squadId = idMatch[1];
      const candidates = [];
      for (const selector of selectors) {
        const node = $(link).closest(selector);
        if (node.length > 0) {
          candidates.push(normalize(node.text()));
        }
      }
      candidates.push(normalize($(link).parent().text()));
      candidates.push(normalize($(link).text()));

      let classCode = '';
      for (const candidate of candidates) {
        const hit = candidate.match(codePattern);
        if (hit?.[1]) {
          classCode = hit[1].toUpperCase();
          break;
        }
      }

      if (classCode) {
        entries.push({ classCode, squadId });
      }
    });

    const seen = new Set();
    const unique = [];
    for (const entry of entries) {
      const key = `${entry.classCode}_${entry.squadId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(entry);
    }

    return unique;
  }

  getPuppeteerCookies() {
    const hostname = new URL(this.baseUrl).hostname;
    return Array.from(this.cookieJar.values()).map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: (cookie.domain || hostname).replace(/^\./, ''),
      path: cookie.path || '/',
      secure: Boolean(cookie.secure),
      httpOnly: Boolean(cookie.httpOnly),
      ...(cookie.sameSite ? { sameSite: cookie.sameSite } : {}),
      ...(cookie.expires ? { expires: Math.floor(cookie.expires / 1000) } : {}),
    }));
  }

  async hydrateBrowserSession() {
    if (!this.page || this.page.isClosed()) {
      throw new Error('浏览器页面不可用，无法恢复登录态');
    }

    const cookies = this.getPuppeteerCookies();
    if (cookies.length === 0) {
      throw new Error('当前没有可用的登录会话，请先调用login()');
    }

    await this.page.setCookie(...cookies);
    await this.page.goto(`${this.baseUrl}/admin`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const html = await this.page.content();
    if (this.isLoginPage(html, this.page.url())) {
      throw new Error('登录状态已失效，请重新登录');
    }

    this.browserSessionReady = true;
  }

  async getClassMap(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.classMapCache.length > 0 && now - this.classMapCacheAt < 2 * 60 * 1000) {
      return this.classMapCache;
    }

    const { response, text } = await this.requestText('/admin', {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`获取班级页失败 (HTTP ${response.status})`);
    }

    if (this.isLoginPage(text, response.url)) {
      throw new Error('登录状态已失效，请重新登录');
    }

    const map = this.extractClassMapFromHtml(text);

    this.classMapCache = map;
    this.classMapCacheAt = Date.now();
    return map;
  }

  async resolveSquadId(classId) {
    const raw = String(classId || '').trim();
    if (!raw) {
      throw new Error('班级ID为空');
    }

    if (/^\d+$/.test(raw)) {
      return { classCode: '', squadId: raw };
    }

    const targetCode = raw.toUpperCase();
    let map = await this.getClassMap(false);
    let hit = map.find((item) => item.classCode === targetCode);

    if (!hit) {
      map = await this.getClassMap(true);
      hit = map.find((item) => item.classCode === targetCode);
    }

    if (!hit) {
      throw new Error(`未找到班级 ${targetCode} 对应的系统ID`);
    }

    return { classCode: hit.classCode, squadId: hit.squadId };
  }

  async gotoSquadConsole(classId) {
    await this.ensurePageReady();
    const { classCode, squadId } = await this.resolveSquadId(classId);
    const url = `${this.baseUrl}/admin/squad_console?id=${squadId}&type=offline`;
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await this.sleep(1200);
    return { classCode, squadId, url };
  }

  async openTaskDropdown() {
    const opened = await this.page.evaluate(() => {
      const isVisible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0);
      };

      const input = Array.from(document.querySelectorAll('input')).find(
        (el) => isVisible(el) && (el.placeholder || '').includes('请选择任务')
      );
      if (!input) return false;

      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      input.click();
      return true;
    });

    if (opened) {
      await this.sleep(700);
    }
    return opened;
  }

  async readTaskDropdownOptions() {
    return this.page.evaluate(() => {
      const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();

      const rawItems = Array.from(
        document.querySelectorAll('.el-select-dropdown__item, .el-option, .el-tree-node__label, li')
      )
        .map((el) => normalize(el.textContent))
        .filter(Boolean);

      const currentTask =
        Array.from(document.querySelectorAll('input'))
          .find((el) => (el.placeholder || '').includes('请选择任务'))
          ?.value || '';

      const dedup = [];
      const seen = new Set();
      for (const item of rawItems) {
        if (seen.has(item)) continue;
        seen.add(item);
        dedup.push(item);
      }

      return { currentTask: normalize(currentTask), options: dedup };
    });
  }

  async selectTaskOption(taskText) {
    const target = String(taskText || '').trim();
    if (!target) return false;

    const opened = await this.openTaskDropdown();
    if (!opened) return false;

    const clicked = await this.page.evaluate((wanted) => {
      const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
      const wantedNorm = normalize(wanted);
      const isVisible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0);
      };

      const items = Array.from(document.querySelectorAll('.el-select-dropdown__item, .el-option')).filter((el) =>
        isVisible(el)
      );
      const exact =
        items.find((el) => normalize(el.textContent) === wantedNorm) ||
        items.find((el) => normalize(el.textContent).includes(wantedNorm)) ||
        items.find((el) => wantedNorm.includes(normalize(el.textContent)));

      if (!exact) return false;
      exact.click();
      return true;
    }, target);

    if (clicked) {
      await this.sleep(1500);
    }
    return clicked;
  }

  async openStudentPersonDialog(preferredYear = '2025', preferredSemester = '') {
    const selectedSemester = preferredSemester || `${preferredYear}学年秋季学期`;

    const activated = await this.page.evaluate(() => {
      const normalize = (text) => (text || '').replace(/\s+/g, '').trim();
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };

      const menu = Array.from(document.querySelectorAll('.menu-item-btn')).find(
        (el) => isVisible(el) && normalize(el.textContent || '').includes('学生个人数据')
      );
      if (!menu) return false;
      menu.click();
      return true;
    });
    if (!activated) {
      throw new Error('未找到“学生个人数据”入口');
    }

    await this.sleep(900);

    const openedDialog = await this.page.evaluate(() => {
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const btn = Array.from(document.querySelectorAll('button.screen-query')).find((el) => isVisible(el));
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!openedDialog) {
      throw new Error('未找到“选择指标”按钮');
    }

    await this.sleep(1000);

    await this.page.evaluate(() => {
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const input = Array.from(document.querySelectorAll('.el-dialog input')).find(
        (el) => isVisible(el) && (((el.value || '').includes('学期')) || ((el.placeholder || '').includes('请选择')))
      );
      if (input) input.click();
    });
    await this.sleep(500);

    const semesterHit = await this.page.evaluate((semesterText, yearText) => {
      const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const options = Array.from(document.querySelectorAll('.el-select-dropdown__item, .el-option')).filter((el) =>
        isVisible(el)
      );
      const target =
        options.find((el) => normalize(el.textContent).includes(semesterText)) ||
        options.find((el) => normalize(el.textContent).includes(`${yearText}学年秋季学期`)) ||
        options.find((el) => normalize(el.textContent).includes(`${yearText}学年春季学期`));
      if (!target) return '';
      const text = normalize(target.textContent);
      target.click();
      return text;
    }, selectedSemester, preferredYear);

    await this.sleep(1000);

    await this.page.evaluate(() => {
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const sw = Array.from(document.querySelectorAll('.el-dialog .el-switch')).find((el) => isVisible(el));
      if (sw && !sw.className.includes('is-checked')) {
        sw.click();
      }
    });

    await this.sleep(1000);

    for (let i = 0; i < 6; i += 1) {
      const collapsedCount = await this.page.evaluate(() => {
        const isVisible = (el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const icons = Array.from(document.querySelectorAll('.el-dialog .el-tree-node__expand-icon')).filter(
          (el) => isVisible(el) && !el.className.includes('is-leaf') && !el.className.includes('expanded')
        );
        icons.slice(0, 100).forEach((icon) => icon.click());
        return icons.length;
      });
      await this.sleep(450);
      if (collapsedCount === 0) break;
    }

    return semesterHit || selectedSemester;
  }

  async readStudentPersonDialogTasks() {
    return this.page.evaluate(() => {
      const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
      const labels = Array.from(document.querySelectorAll('.el-dialog .el-tree-node__label'))
        .map((el) => normalize(el.textContent))
        .filter(Boolean);

      return [...new Set(
        labels
          .filter((line) => line.includes('任务时间:'))
          .map((line) => line.replace(/\s*添加人:.*/, '').trim())
          .filter(Boolean)
      )];
    });
  }

  async applySelectedTasksFromDialog(selectedTasks) {
    const wanted = Array.isArray(selectedTasks)
      ? [...new Set(selectedTasks.map((task) => String(task || '').trim()).filter(Boolean))]
      : [];

    if (wanted.length === 0) {
      return { matched: [], missing: [] };
    }

    const result = await this.page.evaluate((targets) => {
      const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };

      const nodes = Array.from(document.querySelectorAll('.el-dialog .el-tree-node')).filter((node) => isVisible(node));

      // Clear all current checked nodes first to make the selection deterministic.
      nodes.forEach((node) => {
        const checkbox = node.querySelector('.el-checkbox');
        if (checkbox?.className.includes('is-checked')) {
          checkbox.click();
        }
      });

      const matched = [];
      const missing = [];
      const normalizedNodes = nodes.map((node) => ({
        node,
        text: normalize(node.querySelector('.el-tree-node__label')?.textContent || ''),
      }));

      targets.forEach((target) => {
        const hit = normalizedNodes.find((item) => item.text === target)
          || normalizedNodes.find((item) => item.text.includes(target))
          || normalizedNodes.find((item) => target.includes(item.text));

        if (!hit) {
          missing.push(target);
          return;
        }

        const checkbox = hit.node.querySelector('.el-checkbox');
        if (!checkbox) {
          missing.push(target);
          return;
        }

        if (!checkbox.className.includes('is-checked')) {
          checkbox.click();
        }
        matched.push(hit.text);
      });

      return { matched, missing };
    }, wanted);

    await this.sleep(500);
    return result;
  }

  async confirmStudentPersonDialog() {
    const confirmed = await this.page.evaluate(() => {
      const normalize = (text) => (text || '').replace(/\s+/g, '').trim();
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };

      const btn = Array.from(document.querySelectorAll('.el-dialog button')).find(
        (el) => isVisible(el) && normalize(el.textContent || '').includes('确定')
      );
      if (!btn) return false;
      btn.click();
      return true;
    });

    if (!confirmed) {
      throw new Error('未找到指标弹窗的“确定”按钮');
    }

    await this.sleep(2000);
    return true;
  }

  /**
   * 登录到教务系统
   */
  async login() {
    try {
      if (!this.username || !this.password) {
        throw new Error('缺少用户名或密码');
      }

      this.cookieJar.clear();
      this.cookies = [];
      this.classMapCache = [];
      this.classMapCacheAt = 0;
      this.browserSessionReady = false;

      console.log('🔄 正在通过HTTP登录教务系统...');

      const { response: loginPageResponse, text: loginPageHtml } = await this.requestText('/admin/auth/login', {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!loginPageResponse.ok) {
        throw new Error(`加载登录页失败 (HTTP ${loginPageResponse.status})`);
      }

      const csrfToken = this.extractLoginToken(loginPageHtml);
      if (!csrfToken) {
        throw new Error('无法从登录页提取 CSRF Token');
      }

      const xsrfToken = this.getDecodedCookieValue('XSRF-TOKEN');
      const loginResponse = await this.request('/admin/auth/login', {
        method: 'POST',
        headers: {
          accept: 'application/json, text/javascript, */*; q=0.01',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          origin: this.baseUrl,
          referer: `${this.baseUrl}/admin/auth/login`,
          'x-requested-with': 'XMLHttpRequest',
          ...(xsrfToken ? { 'x-xsrf-token': xsrfToken } : {}),
        },
        body: new URLSearchParams({
          username: this.username,
          password: this.password,
          remember: 'false',
          _token: csrfToken,
        }).toString(),
      });

      const raw = await loginResponse.text();
      let result;
      try {
        result = JSON.parse(raw);
      } catch (parseError) {
        throw new Error(`登录接口返回异常: ${raw.slice(0, 200)}`);
      }

      if (!loginResponse.ok) {
        throw new Error(result.msg || `登录请求失败 (HTTP ${loginResponse.status})`);
      }

      if (String(result.code) === '0') {
        throw new Error(result.msg || '登录失败');
      }

      console.log('✅ HTTP登录成功，已保存会话cookies');

      return this.cookies;
    } catch (error) {
      console.error('❌ 登录失败:', error);
      throw error;
    }
  }

  /**
   * 爬取班级学生名单
   */
  async scrapeStudentList(classId) {
    try {
      await this.ensurePageReady();

      const url = `${this.baseUrl}/admin/st_manage/index?squad_id=${classId}&squad_name=temp`;
      console.log(`🔄 正在爬取班级${classId}的学生名单...`);

      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });

      // 提取学生数据
      const students = await this.page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        return rows.map(row => {
          const cells = row.querySelectorAll('td');
          return {
            studentId: cells[0]?.textContent?.trim(),
            name: cells[1]?.textContent?.trim(),
            status: cells[2]?.textContent?.trim() || 'active',
            enrollmentDate: cells[3]?.textContent?.trim()
          };
        }).filter(s => s.name); // 过滤空行
      });

      console.log(`✅ 成功爬取${students.length}名学生`);
      return students;
    } catch (error) {
      console.error('❌ 爬取学生名单失败:', error);
      throw error;
    }
  }

  /**
   * 爬取班级考勤数据
   */
  async scrapeAttendanceData(classId) {
    try {
      await this.ensurePageReady();

      const { classCode, squadId } = await this.resolveSquadId(classId);
      const url = `${this.baseUrl}/admin/squad_console?id=${squadId}&type=offline`;
      console.log(`🔄 正在爬取班级${classCode || classId}(id=${squadId})的考勤数据...`);

      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

      // 点击考勤标签页
      await this.page.click('a[href*="考勤"]');
      await this.page.waitForTimeout(1000);

      // 提取考勤数据
      const attendanceData = await this.page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        return rows.map(row => {
          const cells = row.querySelectorAll('td');
          return {
            name: cells[0]?.textContent?.trim(),
            absenceCount: parseInt(cells[1]?.textContent || 0),
            lateCount: parseInt(cells[2]?.textContent || 0),
            attendanceRate: parseFloat(cells[3]?.textContent || 1)
          };
        }).filter(d => d.name);
      });

      console.log(`✅ 成功爬取${attendanceData.length}条考勤记录`);
      return attendanceData;
    } catch (error) {
      console.error('❌ 爬取考勤数据失败:', error);
      throw error;
    }
  }

  /**
   * 爬取班级作业完成情况
   */
  async scrapeHomeworkData(classId) {
    try {
      await this.ensurePageReady();

      const { classCode, squadId } = await this.resolveSquadId(classId);
      const url = `${this.baseUrl}/admin/squad_console?id=${squadId}&type=offline`;
      console.log(`🔄 正在爬取班级${classCode || classId}(id=${squadId})的作业数据...`);

      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

      // 点击作业标签页
      await this.page.click('a[href*="作业"]');
      await this.page.waitForTimeout(1000);

      // 提取作业数据
      const homeworkData = await this.page.evaluate(() => {
        const assignments = Array.from(document.querySelectorAll('.assignment-item'));
        return assignments.map(item => {
          return {
            homeworkName: item.querySelector('.title')?.textContent?.trim(),
            completionRate: parseFloat(item.querySelector('.completion')?.textContent || 0),
            dueDate: item.querySelector('.due-date')?.textContent?.trim()
          };
        }).filter(h => h.homeworkName);
      });

      console.log(`✅ 成功爬取${homeworkData.length}条作业数据`);
      return homeworkData;
    } catch (error) {
      console.error('❌ 爬取作业数据失败:', error);
      throw error;
    }
  }

  /**
   * 爬取作业公示导出表（用于自动生成榜单）
   */
  async scrapePublicityExportData(classId, options = {}) {
    try {
      await this.ensurePageReady();

      const { classCode, squadId } = await this.resolveSquadId(classId);
      const url = `${this.baseUrl}/admin/squad_console?id=${squadId}&type=offline`;
      console.log(`🔄 正在抓取班级${classCode || classId}(id=${squadId})公示导出表...`);
      const selectedTasks = Array.isArray(options.selectedTasks)
        ? options.selectedTasks.filter(Boolean)
        : [];

      const getTargetTabs = () => {
        if (selectedTasks.length === 0) {
          return ['学生个人数据', '学生中心任务统计', '小挑战'];
        }

        const tabs = [];
        const joined = selectedTasks.join('|');
        if (joined.includes('My Week') || joined.includes('词王')) tabs.push('学生中心任务统计');
        if (joined.includes('挑战')) tabs.push('小挑战');
        if (joined.includes('周一') || joined.includes('周三') || joined.includes('周四') || joined.includes('周五')) {
          tabs.push('作业');
        }
        tabs.push('学生个人数据');
        return [...new Set(tabs)];
      };

      const isReadyPublicityTable = (best) => {
        if (!best || best.studentLikeRowCount <= 0 || best.rowCount < 4) {
          return false;
        }
        const header = String(best.header || '');
        const hasBaseHeader =
          header.includes('学号') &&
          (header.includes('中文') || header.includes('中文名')) &&
          (header.includes('英文') || header.includes('英文名'));
        return hasBaseHeader || String(best.index).includes('+');
      };

      const parseBestTable = async () => {
        return this.page.evaluate(() => {
          const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
          const bodyText = document.body.innerText || '';
          const weekMatch = bodyText.match(/第\s*(\d{1,2})\s*周/);
          const title = document.title || '';
          const hasErrorPage =
            title.includes('Whoops') ||
            bodyText.includes('UnexpectedValueException') ||
            bodyText.includes('Permission denied');

          const tables = Array.from(document.querySelectorAll('table'));
          const parsedTables = tables
            .map((table, index) => {
              const rowEls = Array.from(table.querySelectorAll('tr'));
              const rows = rowEls
                .map((tr) => Array.from(tr.querySelectorAll('th,td')).map((cell) => normalize(cell.innerText)))
                .filter((row) => row.some(Boolean));

              if (rows.length < 2) return null;

              const width = Math.max(...rows.map((r) => r.length), 0);
              const paddedRows = rows.map((r) => {
                const copy = [...r];
                while (copy.length < width) copy.push('');
                return copy;
              });

              const header = paddedRows[0].join('|');
              const studentLikeRowCount = paddedRows.filter((row) => /^\d{4,}$/.test(row[0] || '') && /^\d{6,}$/.test(row[1] || '')).length;
              let score = 0;
              if (header.includes('中文')) score += 4;
              if (header.includes('英文')) score += 3;
              if (header.includes('My Week') || header.includes('词王')) score += 4;
              if (header.includes('周一') || header.includes('周末')) score += 2;
              if (header.includes('Key|Value')) score -= 100;
              if (studentLikeRowCount > 0) score += 8;
              if (paddedRows.length <= 3 && studentLikeRowCount === 0) score -= 6;
              score += Math.min(paddedRows.length, 40) / 10;

              return {
                index,
                rows: paddedRows,
                rowCount: paddedRows.length,
                colCount: width,
                header,
                studentLikeRowCount,
              };
            })
            .filter(Boolean);

          const candidates = parsedTables
            .map((table) => {
              let score = 0;
              if (table.header.includes('中文')) score += 4;
              if (table.header.includes('英文')) score += 3;
              if (table.header.includes('My Week') || table.header.includes('词王')) score += 4;
              if (table.header.includes('周一') || table.header.includes('周末')) score += 2;
              if (table.header.includes('Key|Value')) score -= 100;
              if (table.studentLikeRowCount > 0) score += 8;
              if (table.rowCount <= 3 && table.studentLikeRowCount === 0) score -= 6;
              score += Math.min(table.rowCount, 40) / 10;
              return {
                ...table,
                score,
              };
            });

          // 有些任务会把表头和学生明细拆成两张连续的 table，这里自动拼接。
          for (let i = 0; i < parsedTables.length - 1; i += 1) {
            const head = parsedTables[i];
            const body = parsedTables[i + 1];
            const headRow0 = head.rows[0] || [];
            const splitHeaderLike =
              head.rowCount >= 3 &&
              headRow0.includes('学号') &&
              (headRow0.includes('中文') || headRow0.includes('中文名')) &&
              (headRow0.includes('英文') || headRow0.includes('英文名'));
            const bodyLooksLikeStudentRows =
              body.rowCount >= 8 &&
              /^\d{4,}$/.test(body.rows[0]?.[0] || '') &&
              /^\d{6,}$/.test(body.rows[0]?.[1] || '');

            if (!splitHeaderLike || !bodyLooksLikeStudentRows) continue;

            const mergedWidth = Math.max(head.colCount, body.colCount);
            const pad = (row) => {
              const copy = [...row];
              while (copy.length < mergedWidth) copy.push('');
              return copy;
            };

            const mergedRows = [...head.rows.map(pad), ...body.rows.map(pad)];
            const mergedHeader = mergedRows[0].join('|');

            candidates.push({
              index: `${head.index}+${body.index}`,
              score: 30 + Math.min(body.rowCount, 40) / 5,
              rows: mergedRows,
              rowCount: mergedRows.length,
              colCount: mergedWidth,
              header: mergedHeader,
              studentLikeRowCount: body.rowCount,
            });
          }

          candidates.sort((a, b) => b.score - a.score);

          return {
            title,
            hasErrorPage,
            week: weekMatch ? Number(weekMatch[1]) : null,
            best: candidates[0] || null,
            candidateCount: candidates.length,
          };
        });
      };

      const clickTabIfExists = async (keyword) => {
        const clicked = await this.page.evaluate((kw) => {
          const norm = (s) => (s || '').replace(/\s+/g, '').trim();
          const target = norm(kw);
          const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], .btn, .tab, li, span'));
          const hit = nodes.find((node) => {
            const text = norm(node.textContent || '');
            if (!text || !text.includes(target)) return false;
            const tag = node.tagName.toLowerCase();
            return tag === 'button' || tag === 'a' || node.hasAttribute('role') || node.className?.toString();
          });
          if (hit) {
            hit.click();
            return true;
          }
          return false;
        }, keyword);

        if (clicked) {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
        return clicked;
      };

      let gotoOk = false;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          await this.ensurePageReady();
          await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
          gotoOk = true;
          break;
        } catch (error) {
          const message = error?.message || '';
          if (!message.includes('detached Frame') || attempt === 2) {
            throw error;
          }
          this.page = await this.browser.newPage();
        }
      }
      if (!gotoOk) {
        throw new Error('页面打开失败');
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));

      let selectedTaskResult = { matched: [], missing: [] };
      if (selectedTasks.length > 0) {
        await this.openStudentPersonDialog(String(options.preferredYear || '2025'));
        selectedTaskResult = await this.applySelectedTasksFromDialog(selectedTasks);
        console.log(`ℹ️ 定向任务匹配: ${selectedTaskResult.matched.length} 命中, ${selectedTaskResult.missing.length} 未命中`);
        if (selectedTaskResult.matched.length === 0) {
          throw new Error('未匹配到你勾选的任务，未执行定向抓取');
        }
        await this.confirmStudentPersonDialog();
      } else if (options.preferredYear) {
        const preferredYear = String(options.preferredYear);
        const opened = await this.openTaskDropdown();
        if (opened) {
          const dropdown = await this.readTaskDropdownOptions();
          const candidate = dropdown.options.find((task) => task.includes(preferredYear));
          if (candidate) {
            await this.selectTaskOption(candidate);
          }
        }
      }

      let parsed = await parseBestTable();
      if (selectedTasks.length > 0) {
        for (let attempt = 0; attempt < 7; attempt += 1) {
          const best = parsed.best;
          if (isReadyPublicityTable(best)) break;
          await this.sleep(1000);
          parsed = await parseBestTable();
        }
      }
      if (!parsed.best || parsed.best.score < 3) {
        for (const keyword of getTargetTabs()) {
          await clickTabIfExists(keyword);
          parsed = await parseBestTable();
          if (selectedTasks.length > 0) {
            for (let attempt = 0; attempt < 5; attempt += 1) {
              const best = parsed.best;
              if (isReadyPublicityTable(best)) break;
              await this.sleep(1000);
              parsed = await parseBestTable();
            }
          }
          if (parsed.best && parsed.best.score >= 3) {
            break;
          }
        }
      }

      if (parsed.hasErrorPage) {
        throw new Error('系统页面异常（错误页），请稍后重试');
      }

      if (!parsed.best || !parsed.best.rows || parsed.best.rows.length < 2) {
        throw new Error('未在页面上识别到可用的导出表格');
      }

      const headerText = (parsed.best.rows[0] || []).join('|');
      const looksLikePublicityTable = ['中文', '英文', 'My Week', '词王', '周一', '周末'].some((k) =>
        headerText.includes(k)
      );
      if (!looksLikePublicityTable) {
        throw new Error('未识别到公示导出表，请确认系统页面可正常打开');
      }

      console.log(
        `✅ 公示表抓取成功: table#${parsed.best.index}, ${parsed.best.rowCount}行 x ${parsed.best.colCount}列`
      );

      return {
        classId: classCode || classId,
        squadId,
        week: parsed.week,
        tableRows: parsed.best.rows,
        selectedTaskResult,
        meta: {
          tableIndex: parsed.best.index,
          rowCount: parsed.best.rowCount,
          colCount: parsed.best.colCount,
          candidateCount: parsed.candidateCount,
        },
      };
    } catch (error) {
      console.error('❌ 抓取公示导出表失败:', error);
      throw error;
    }
  }

  /**
   * 抓取班级任务列表（先让老师勾选任务）
   */
  async scrapePublicityTaskList(classId, options = {}) {
    try {
      await this.ensurePageReady();

      const { classCode, squadId } = await this.resolveSquadId(classId);
      const url = `${this.baseUrl}/admin/squad_console?id=${squadId}&type=offline`;
      console.log(`🔄 正在抓取班级${classCode || classId}(id=${squadId})任务列表...`);
      let gotoOk = false;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          await this.ensurePageReady();
          await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
          gotoOk = true;
          break;
        } catch (error) {
          const message = error?.message || '';
          if (!message.includes('detached Frame') || attempt === 2) {
            throw error;
          }
          this.page = await this.browser.newPage();
        }
      }
      if (!gotoOk) {
        throw new Error('页面打开失败');
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const pageState = await this.page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const hasErrorPage =
          document.title.includes('Whoops') ||
          bodyText.includes('UnexpectedValueException') ||
          bodyText.includes('Permission denied');
        return { hasErrorPage };
      });

      if (pageState.hasErrorPage) {
        throw new Error('系统页面异常（错误页），请稍后重试');
      }

      const preferredYear = String(options.preferredYear || '2025');
      const preferredSemester = options.preferredSemester || `${preferredYear}学年秋季学期`;
      let selectedSemester = preferredSemester;
      let allTasks = [];

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (attempt > 1) {
          await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.sleep(1800);
        }

        selectedSemester = await this.openStudentPersonDialog(preferredYear, preferredSemester);
        allTasks = await this.readStudentPersonDialogTasks();
        if (allTasks.length > 0) {
          break;
        }

        await this.sleep(1200);
        allTasks = await this.readStudentPersonDialogTasks();
        if (allTasks.length > 0) {
          break;
        }
      }

      if (allTasks.length === 0) {
        throw new Error('未从任务树读取到准确任务列表，已停止返回兜底列表，请重试');
      }

      const unique = [...new Set(allTasks)];
      console.log(`✅ 任务列表抓取完成: ${unique.length}项（优先${selectedSemester || preferredSemester}）`);

      return {
        classId: classCode || classId,
        squadId,
        preferredYear,
        preferredSemester: selectedSemester || preferredSemester,
        currentTask: '',
        tasks: unique,
      };
    } catch (error) {
      console.error('❌ 抓取任务列表失败:', error);
      throw error;
    }
  }

  /**
   * 关闭浏览器
   */
  /**
   * 爬取班级列表（教务系统中该用户管理的所有班级）
   */
  async scrapeClassList() {
    try {
      const mapped = await this.getClassMap(false);
      if (mapped.length > 0) {
        const normalized = mapped.map((item) => ({
          id: item.classCode,
          name: item.classCode,
          squadId: item.squadId,
        }));
        console.log(`✅ 成功提取${normalized.length}个班级: ${normalized.map((c) => c.name).join(', ')}`);
        return normalized;
      }

      // 访问首页，获取班级选择器
      const adminUrl = `${this.baseUrl}/admin`;
      console.log(`🔄 访问首页: ${adminUrl}`);

      await this.page.goto(adminUrl, { waitUntil: 'networkidle2', timeout: 8000 });

      const title = await this.page.title();
      console.log(`   页面标题: ${title}`);

      // 尝试提取班级列表
      const classes = await this.page.evaluate(() => {
        const results = [];

        // 策略1: 查找"我的班级列表"下的班级
        const allText = document.body.innerText;
        const classListMatch = allText.indexOf('我的班级列表');

        if (classListMatch !== -1) {
          // 获取"我的班级列表"后面的文本
          const afterClassList = allText.substring(classListMatch);

          // 查找接下来的班级号（字母前缀 + 数字，例如 K328 / BB102）
          const classPattern = /([A-Za-z]{1,3}\d{2,4})/g;
          const matches = afterClassList.match(classPattern);

          if (matches) {
            const uniqueMatches = [...new Set(matches)];
            for (const className of uniqueMatches) {
              results.push({
                id: className.toUpperCase(),
                name: className.toUpperCase()
              });
            }
          }
        }

        // 如果仍未找到，尝试从整个页面中提取班级号
        if (results.length === 0) {
          // 查找所有可能是班级号的文本（大写字母+数字）
          const allClassPattern = /([A-Za-z]{1,3}\d{2,4})/g;
          const allMatches = allText.match(allClassPattern);

          if (allMatches) {
            const uniqueMatches = [...new Set(allMatches)];
            for (const className of uniqueMatches.slice(0, 20)) {  // 限制到前20个，防止过多
              results.push({
                id: className.toUpperCase(),
                name: className.toUpperCase()
              });
            }
          }
        }

        // 也尝试从链接中获取班级ID和名称的对应关系
        const links = document.querySelectorAll('a[href*="squad_id"]');
        const classMap = new Map();

        for (const link of links) {
          const href = link.href;
          const urlParams = new URLSearchParams(new URL(href).search);
          const squadId = urlParams.get('squad_id');
          const text = link.textContent?.trim();

          if (squadId && text && text.match(/^[A-Za-z]{1,3}\d{2,4}$/)) {
            classMap.set(text.toUpperCase(), squadId);
          }
        }

        // 如果有链接中的班级ID对应关系，使用更准确的信息
        if (classMap.size > 0) {
          return Array.from(classMap.entries()).map(([name, id]) => ({ id, name }));
        }

        return results;
      });

      if (classes && classes.length > 0) {
        // 去重
        const uniqueClasses = Array.from(new Map(classes.map(c => [c.name, c])).values());
        console.log(`✅ 成功提取${uniqueClasses.length}个班级: ${uniqueClasses.map(c => c.name).join(', ')}`);
        return uniqueClasses;
      }

      // 如果上述方法都失败，保存页面用于调试
      console.warn('⚠️ 无法提取班级列表，保存页面用于调试...');
      const pageHTML = await this.page.content();
      const fs = require('fs');
      fs.writeFileSync('/tmp/class_debug.html', pageHTML);

      const pageText = await this.page.evaluate(() => document.body.innerText);
      fs.writeFileSync('/tmp/class_debug.txt', pageText);

      await this.page.screenshot({ path: '/tmp/class_debug.png' });

      console.log('💾 已保存调试信息到 /tmp/class_debug.*');
      console.log('📄 页面内容前2000字符:');
      console.log(pageText.substring(0, 2000));

      return [];
    } catch (error) {
      console.error('❌ 爬取班级列表失败:', error.message);
      throw error;
    }
  }

  /**
   * 抓取周度资料上传页面的表单内容
   */
  async scrapeMaterialsPages(classId) {
    await this.gotoSquadConsole(classId);
    await this.sleep(1000);

    try {
      const pages = await this.page.evaluate(() => {
        const result = [];
        // 查找资料上传相关的 tab 或链接
        const allLinks = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        const materialLinks = allLinks.filter(el =>
          el.textContent && (
            el.textContent.includes('资料') ||
            el.textContent.includes('上传') ||
            el.textContent.includes('材料')
          )
        );

        for (const link of materialLinks.slice(0, 2)) {
          const title = link.textContent.trim();
          const fields = [];
          const container = link.closest('form') || link.closest('.panel') || link.closest('.card') || link.parentElement;
          if (container) {
            const inputs = Array.from(container.querySelectorAll('input, textarea, select'));
            inputs.forEach((el, idx) => {
              const label = container.querySelector(`label[for="${el.id}"]`)?.textContent ||
                el.placeholder || el.name || `字段${idx + 1}`;
              fields.push({
                fieldId: el.id || el.name || `field_${idx}`,
                label: label.trim(),
                type: el.tagName === 'TEXTAREA' ? 'textarea' : el.tagName === 'SELECT' ? 'select' : 'text',
                value: el.value || '',
                options: el.tagName === 'SELECT' ? Array.from(el.options).map(o => o.value) : [],
              });
            });
          }
          result.push({ pageTitle: title, fields });
        }
        return result;
      });

      return { pages: pages.length > 0 ? pages : [
        { pageTitle: '本周资料上传', fields: [
          { fieldId: 'content', label: '上传内容说明', type: 'textarea', value: '', options: [] },
          { fieldId: 'link', label: '资料链接', type: 'text', value: '', options: [] },
        ]}
      ]};
    } catch (error) {
      console.error('抓取资料页面失败:', error.message);
      return { pages: [], error: error.message };
    }
  }

  /**
   * 提交资料上传表单
   */
  async submitMaterialsPages(classId, formData) {
    await this.gotoSquadConsole(classId);
    await this.sleep(1000);

    const results = [];
    for (const page of formData) {
      try {
        for (const field of page.fields) {
          const selector = `#${field.fieldId}, [name="${field.fieldId}"]`;
          const el = await this.page.$(selector);
          if (el) {
            const tag = await el.evaluate(n => n.tagName);
            if (tag === 'SELECT') {
              await this.page.select(selector, field.value);
            } else {
              await el.click({ clickCount: 3 });
              await el.type(field.value);
            }
          }
        }
        // 查找提交按钮
        const submitBtn = await this.page.$('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          await submitBtn.click();
          await this.sleep(1200);
        }
        results.push({ page: page.pageTitle, status: 'success' });
      } catch (e) {
        results.push({ page: page.pageTitle, status: 'failed', error: e.message });
      }
    }
    return { results, success: results.filter(r => r.status === 'success').length };
  }

  /**
   * 发放 Minipin 奖励
   * @param {string} classId
   * @param {Array<{studentName: string, amount: number}>} rewards
   */
  async submitMinipinRewards(classId, rewards) {
    await this.gotoSquadConsole(classId);
    await this.sleep(1200);

    // 找到 coupon-minipin 管理入口
    const minipinLink = await this.page.$('a[href*="minipin"], a[href*="coupon"]');
    if (!minipinLink) {
      // 尝试通过文字找
      const links = await this.page.$$('a');
      let found = null;
      for (const link of links) {
        const text = await link.evaluate(el => el.textContent);
        if (text && (text.includes('minipin') || text.includes('Minipin') || text.includes('coupon') || text.includes('货币'))) {
          found = link;
          break;
        }
      }
      if (!found) {
        throw new Error('未找到 Minipin 管理入口，请检查页面结构');
      }
      await found.click();
    } else {
      await minipinLink.click();
    }
    await this.sleep(1500);

    const successList = [];
    const failedList = [];

    for (const reward of rewards) {
      try {
        // 在页面中查找学生行
        const rows = await this.page.$$('tr, .student-row, .list-item');
        let targetRow = null;
        const aliases = [reward.studentName, ...(reward.aliases || [])].filter(Boolean);
        for (const row of rows) {
          const text = await row.evaluate(el => el.textContent);
          if (text && aliases.some((name) => text.includes(name))) {
            targetRow = row;
            break;
          }
        }

        if (!targetRow) {
          failedList.push({ name: reward.studentName, error: '未找到学生' });
          continue;
        }

        // 找金额输入框
        const amountInput = await targetRow.$('input[type="number"], input[type="text"]');
        if (amountInput) {
          await amountInput.click({ clickCount: 3 });
          await amountInput.type(String(reward.amount));
        }

        // 找发放按钮
        const grantBtn = await targetRow.$('button');
        if (grantBtn) {
          await grantBtn.click();
          await this.sleep(600);
        }

        successList.push(reward.studentName);
      } catch (e) {
        failedList.push({ name: reward.studentName, error: e.message });
      }
    }

    return {
      success: successList.length,
      failed: failedList.length,
      successList,
      failedList,
    };
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('✅ 浏览器已关闭');
      }
      this.browser = null;
      this.page = null;
      this.browserSessionReady = false;
    } catch (error) {
      console.error('❌ 关闭浏览器失败:', error);
    }
  }
}

module.exports = EducationSystemScraper;
