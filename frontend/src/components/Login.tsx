import { useState, useEffect } from 'react';
import type { ClassInfo } from '../types';
import './Login.css';

interface Props {
  onLogin: (teacherName: string, classes: ClassInfo[]) => void;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('amber_username');
    if (savedUser) setUsername(savedUser);
    localStorage.removeItem('amber_password');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请填写账号和密码');
      return;
    }
    setError('');
    setLoading(true);
    setLoadingMsg('正在启动浏览器，连接教务系统（约15秒）...');

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 40000);

      const loginRes = await fetch('/api/scraper/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      let loginData: Record<string, unknown> = {};
      try {
        loginData = await loginRes.json();
      } catch {
        throw new Error('服务器响应异常，请确认后端正在运行（cd backend && node server.js）');
      }

      if (!loginRes.ok) {
        if (loginRes.status === 429) throw new Error('正在登录中，请稍等再试');
        throw new Error((loginData.error as string) || '登录失败，请检查账号密码');
      }

      const classes: ClassInfo[] = ((loginData.classes as ClassInfo[]) || []).map((c) => ({
        id: c.id || c.name,
        name: c.name,
        squadId: c.squadId,
      }));

      setLoadingMsg(`登录成功，已获取 ${classes.length} 个班级`);
      localStorage.setItem('amber_username', username.trim());
      setTimeout(() => onLogin(username.trim(), classes), 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '连接失败';
      if (msg.includes('abort')) {
        setError('连接超时（>40秒），请确认后端服务已启动：cd backend && node server.js');
      } else {
        setError(msg);
      }
      setLoading(false);
      setLoadingMsg('');
    }
  }

  function handleSkip() {
    onLogin(username.trim() || '老师', []);
  }

  return (
    <div className="login-wrap">
      <div className="login-box card fade-in">
        <div className="login-logo">
          <div className="logo-leaf">🌿</div>
          <div className="login-brand">
            <span className="brand-main">Super Amber is here!</span>
            <span className="brand-sub">I will help you</span>
          </div>
        </div>

        <div className="login-title-block">
          <h2 className="login-title">连接教务系统</h2>
          <p className="login-desc">绑定账号后，自动加载你的班级列表</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">账号名</label>
            <input
              className="input-field"
              type="text"
              placeholder="请输入教务系统账号"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              className="input-field"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg login-btn" disabled={loading}>
            {loading
              ? <><span className="spinner" /> {loadingMsg}</>
              : '连接教务系统 →'}
          </button>
        </form>

        <button className="skip-btn" onClick={handleSkip} disabled={loading}>
          暂时跳过，手动操作
        </button>

        <p className="login-footer">C&F School 教务管理系统</p>
      </div>
    </div>
  );
}
