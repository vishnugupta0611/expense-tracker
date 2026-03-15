import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import api from '@services/api.js';
import './AuthPage.css';

const AuthPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  // Signup fields
  const [signupName, setSignupName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!signupName.trim()) return setError('Name is required');
    if (!signupUsername.trim()) return setError('Username is required');
    if (signupPassword.length < 4) return setError('Password must be at least 4 characters');
    if (signupPassword !== signupConfirm) return setError('Passwords do not match');

    try {
      setLoading(true);
      const res = await api.post('/auth/register', {
        username: signupUsername.trim(),
        name: signupName.trim(),
        password: signupPassword,
      });
      login(res.data.token, res.data.user);
      navigate('/expenses', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!loginUsername.trim()) return setError('Username is required');
    if (!loginPassword.trim()) return setError('Password is required');

    try {
      setLoading(true);
      const res = await api.post('/auth/login', {
        username: loginUsername.trim(),
        password: loginPassword,
      });
      login(res.data.token, res.data.user);
      navigate('/expenses', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" onClick={() => navigate('/')}>
          <span>💸</span>
          <span className="auth-logo-text">Spendly</span>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Sign Up
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label>Username</label>
              <input
                type="text"
                placeholder="your_username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSignup}>
            <div className="auth-field">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                autoComplete="name"
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label>Username</label>
              <input
                type="text"
                placeholder="choose_a_username"
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="auth-field">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={signupConfirm}
                onChange={(e) => setSignupConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        <p className="auth-switch">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => switchMode('signup')}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => switchMode('login')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
