import { useState, useEffect } from 'react';
import ReviewDashboard from './ReviewDashboard';
import FileUploader from './FileUploader';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error('Invalid username or password');
      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '36px 32px', width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, background: '#eff6ff', borderRadius: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>🌿</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0 }}>Breathe ESG</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>Analyst Audit Portal</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Username</label>
            <input type="text" placeholder="admin" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required />
          </div>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            marginTop: 4, padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 700,
            color: '#fff', background: loading ? '#94a3b8' : '#2563eb', border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
          }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [refreshTrigger, setRefresh]    = useState(0);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('auth_token'));
  }, []);

  if (!isLoggedIn) return <Login onLogin={() => setIsLoggedIn(true)} />;

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🌿</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>Breathe ESG</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>/ Data Pipeline</span>
        </div>
        <button
          onClick={() => { localStorage.removeItem('auth_token'); setIsLoggedIn(false); }}
          style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Sign Out
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        <FileUploader onUploadSuccess={() => setRefresh(p => p + 1)} />
        <ReviewDashboard refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}