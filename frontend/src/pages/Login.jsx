import React, { useState } from 'react';
import { api, setToken } from '../api.js';

export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data =
        mode === 'login'
          ? await api.post('/auth/login', { identifier, password })
          : await api.post('/auth/register', { username, email, password });
      setToken(data.token);
      onLoggedIn(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">💊</div>
        <h1>PharmaGuard</h1>
        <p className="muted">Family medicine safety, in one place.</p>

        {mode === 'login' ? (
          <label>
            Username or email
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus required autoComplete="username" />
          </label>
        ) : (
          <>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required minLength={3} maxLength={50} autoComplete="username" />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
          </>
        )}
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 6 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>

        <div className="login-switch">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button type="button" className="link" onClick={() => { setMode('register'); setError(''); }}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="link" onClick={() => { setMode('login'); setError(''); }}>
                Log in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
