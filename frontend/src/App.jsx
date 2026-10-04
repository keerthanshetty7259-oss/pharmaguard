import React, { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import FamilySafety from './pages/FamilySafety.jsx';
import Manage from './pages/Manage.jsx';
import AddMedicine from './pages/AddMedicine.jsx';
import Chatbot from './pages/Chatbot.jsx';

const NAV = [
  { id: 'overview', label: 'Family overview', icon: '🏠' },
  { id: 'safety', label: 'Family safety', icon: '🛡️' },
  { id: 'manage', label: 'Family & medicines', icon: '👨‍👩‍👧' },
  { id: 'add', label: 'Add prescription', icon: '📋' },
  { id: 'chat', label: 'AI assistant', icon: '💬' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(getToken()));
  const [page, setPage] = useState('overview');
  const [addMemberId, setAddMemberId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState(null);

  // restore the session
  useEffect(() => {
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, []);

  // auto logout when the token expires
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('pharmaguard:logout', onLogout);
    return () => window.removeEventListener('pharmaguard:logout', onLogout);
  }, []);

  useEffect(() => {
    if (user) api.get('/status').then(setStatus).catch(() => {});
  }, [user]);

  // any change (member / medicine added, removed, stopped) refreshes every dashboard
  const onChanged = useCallback(() => setRefreshKey((k) => k + 1), []);

  const go = useCallback((target, memberId = null) => {
    setPage(target);
    if (target === 'add') setAddMemberId(memberId);
    window.scrollTo(0, 0);
  }, []);

  function logout() {
    setToken(null);
    setUser(null);
    setPage('overview');
  }

  if (booting) return <Loading text="Starting PharmaGuard…" />;
  if (!user) return <Login onLoggedIn={setUser} />;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">💊</span> PharmaGuard
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="muted small">Signed in as</div>
          <div className="who">{user.username}</div>
          <button className="btn btn-small btn-block" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        {status && !status.fullInteractionData && (
          <div className="alert alert-warn">
            Only a small starter set of drug-interaction data is loaded ({status.interactionPairs} pairs), so many real interactions will not be detected. To load the full DDInter database, see the README (step “Load full interaction data”).
          </div>
        )}

        {page === 'overview' && <Overview refreshKey={refreshKey} go={go} />}
        {page === 'safety' && <FamilySafety refreshKey={refreshKey} />}
        {page === 'manage' && <Manage refreshKey={refreshKey} onChanged={onChanged} go={go} />}
        {page === 'add' && <AddMedicine initialMemberId={addMemberId} onChanged={onChanged} go={go} />}
        {page === 'chat' && <Chatbot />}
      </main>
    </div>
  );
}
