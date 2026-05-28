/*import { useState, useEffect } from 'react';
import ReviewDashboard from './ReviewDashboard';
import FileUploader from './FileUploader';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) throw new Error("Invalid username or password");

      const data = await res.json();
      
      localStorage.setItem('auth_token', data.token); 
      onLogin();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md border border-gray-200 text-center w-96">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">Breathe ESG</h2>
        <p className="text-gray-600 mb-6 text-sm">Analyst Audit Portal</p>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Username (e.g., admin)" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 rounded text-left"
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded text-left"
            required
          />
          {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
          <button 
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition-colors"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0); 

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('auth_token'));
  }, []);

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800">Data Normalization Pipeline</h1>
        <button 
          onClick={() => {
            localStorage.removeItem('auth_token');
            setIsLoggedIn(false);
          }}
          className="text-sm text-red-600 hover:underline font-semibold"
        >
          Sign Out
        </button>
      </div>
      
      <div className="max-w-6xl mx-auto">
        {/* Pass the state updater so the uploader can tell the dashboard to refresh *//*
        <FileUploader onUploadSuccess={() => setRefreshTrigger(prev => prev + 1)} />
        
        /* Pass the trigger variable down to the dashboard *//*
        <ReviewDashboard refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
  */
import { useState, useEffect } from 'react';
import ReviewDashboard from './ReviewDashboard';
import FileUploader from './FileUploader';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Hit the endpoint you defined in urls.py
      const res = await fetch('http://localhost:8000/api/v1/auth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) throw new Error("Invalid username or password");

      const data = await res.json();
      
      // Save the dynamically generated real token to the browser
      localStorage.setItem('auth_token', data.token); 
      onLogin();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md border border-gray-200 text-center w-96">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">Breathe ESG</h2>
        <p className="text-gray-600 mb-6 text-sm">Analyst Audit Portal</p>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Username (e.g., admin)" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 rounded text-left"
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded text-left"
            required
          />
          {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
          <button 
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition-colors"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // This state exists purely to trigger a refresh in the dashboard
  const [refreshTrigger, setRefreshTrigger] = useState(0); 

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('auth_token'));
  }, []);

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800">Data Normalization Pipeline</h1>
        <button 
          onClick={() => {
            localStorage.removeItem('auth_token');
            setIsLoggedIn(false);
          }}
          className="text-sm text-red-600 hover:underline font-semibold"
        >
          Sign Out
        </button>
      </div>
      
      <div className="max-w-6xl mx-auto">
        {/* Pass the state updater so the uploader can tell the dashboard to refresh */}
        <FileUploader onUploadSuccess={() => setRefreshTrigger(prev => prev + 1)} />
        
        {/* Pass the trigger variable down to the dashboard */}
        <ReviewDashboard refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}