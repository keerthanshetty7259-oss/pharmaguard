import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAsync, Loading, ErrorBox, EmptyState, formatDate } from '../components/ui.jsx';

function AddMemberForm({ onAdded }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/members', { name, age: Number(age), gender });
      setName('');
      setAge('');
      onAdded(res.member);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form-row" onSubmit={submit}>
      <h3>Add a family member</h3>
      <div className="form-grid">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </label>
        <label>
          Age
          <input type="number" min="0" max="130" value={age} onChange={(e) => setAge(e.target.value)} required />
        </label>
        <label>
          Gender
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add member'}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
    </form>
  );
}

function MemberMedicines({ member, refreshKey, onChanged, go }) {
  const { data, error, loading, reload } = useAsync(() => api.get(`/members/${member.id}`), [member.id, refreshKey]);
  const [actionError, setActionError] = useState('');

  async function act(fn) {
    setActionError('');
    try {
      await fn();
      onChanged();
    } catch (err) {
      setActionError(err.message);
    }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;

  const active = data.medicines.filter((m) => m.status === 'active');
  const history = data.medicines.filter((m) => m.status !== 'active');

  return (
    <div>
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <div className="panel-head">
        <h3>Active medicines ({active.length})</h3>
        <button className="btn btn-small btn-primary" onClick={() => go('add', member.id)}>
          + Add medicine
        </button>
      </div>
      {active.length === 0 ? (
        <p className="muted">No active medicines.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Added</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.originalName}</strong>
                    <div className="muted small">{m.standardizedName}</div>
                  </td>
                  <td>{m.dosage || '—'}</td>
                  <td>{m.frequency || '—'}</td>
                  <td>{formatDate(m.addedAt)}</td>
                  <td className="right actions">
                    <button className="btn btn-small" onClick={() => act(() => api.patch(`/medicines/${m.id}`, { status: 'consumed' }))}>
                      Mark consumed
                    </button>
                    <button className="btn btn-small" onClick={() => act(() => api.patch(`/medicines/${m.id}`, { status: 'stopped' }))}>
                      Mark stopped
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => {
                        if (window.confirm(`Delete ${m.originalName}? This removes it completely.`)) act(() => api.del(`/medicines/${m.id}`));
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel-head">
        <h3>History ({history.length})</h3>
      </div>
      {history.length === 0 ? (
        <p className="muted">Consumed or stopped medicines are kept here as history and are not used for safety checks.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Status</th>
                <th>Ended</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.originalName}
                    <div className="muted small">{m.standardizedName}</div>
                  </td>
                  <td>
                    <span className={`status status-${m.status}`}>{m.status}</span>
                  </td>
                  <td>{formatDate(m.endedAt)}</td>
                  <td className="right actions">
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => {
                        if (window.confirm(`Delete ${m.originalName} from history?`)) act(() => api.del(`/medicines/${m.id}`));
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Manage({ refreshKey, onChanged, go }) {
  const { data, error, loading, reload } = useAsync(() => api.get('/members'), [refreshKey]);
  const [selectedId, setSelectedId] = useState(null);
  const [actionError, setActionError] = useState('');

  const members = data ? data.members : [];

  // keep a valid selection
  useEffect(() => {
    if (!data) return;
    if (!members.find((m) => m.id === selectedId)) setSelectedId(members.length ? members[0].id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const selected = members.find((m) => m.id === selectedId) || null;

  async function removeMember(m) {
    if (!window.confirm(`Remove ${m.name} and ALL of their medicines? This cannot be undone.`)) return;
    setActionError('');
    try {
      await api.del(`/members/${m.id}`);
      onChanged();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Family &amp; medicine management</h2>
          <p className="muted">Add or remove family members, and manage each person's medicines.</p>
        </div>
      </div>

      <AddMemberForm
        onAdded={(member) => {
          setSelectedId(member.id);
          onChanged();
        }}
      />

      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />
      {actionError && <div className="alert alert-error">{actionError}</div>}

      {data && members.length === 0 && (
        <EmptyState icon="👨‍👩‍👧" title="No family members yet">
          Use the form above to add the first one.
        </EmptyState>
      )}

      {data && members.length > 0 && (
        <div className="manage-layout">
          <div className="panel member-list">
            <h3>Family members</h3>
            {members.map((m) => (
              <div key={m.id} className={`member-row ${m.id === selectedId ? 'selected' : ''}`}>
                <button className="member-row-main" onClick={() => setSelectedId(m.id)}>
                  <div className="avatar avatar-sm">{m.name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <div className="member-name">{m.name}</div>
                    <div className="muted small">
                      {m.age} · {m.gender} · {m.active_count} active
                    </div>
                  </div>
                </button>
                <button className="icon-btn" title={`Remove ${m.name}`} onClick={() => removeMember(m)}>
                  🗑
                </button>
              </div>
            ))}
          </div>

          <div className="panel">
            {selected ? (
              <>
                <h2 className="panel-title">{selected.name}'s medicines</h2>
                <MemberMedicines member={selected} refreshKey={refreshKey} onChanged={onChanged} go={go} />
              </>
            ) : (
              <p className="muted">Select a family member.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
