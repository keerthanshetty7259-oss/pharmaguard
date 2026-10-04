import React, { useState } from 'react';
import { api } from '../api.js';
import { useAsync, Loading, ErrorBox, EmptyState, SeverityBadge } from '../components/ui.jsx';
import MemberDetail from './MemberDetail.jsx';

function Flag({ label, count, tone }) {
  const bad = count > 0;
  return (
    <div className={`flag ${bad ? `flag-${tone}` : 'flag-ok'}`} title={label}>
      <div className="flag-count">{bad ? count : '✓'}</div>
      <div className="flag-label">{label}</div>
    </div>
  );
}

export default function Overview({ refreshKey, go }) {
  const [selected, setSelected] = useState(null);
  const { data, error, loading, reload } = useAsync(() => api.get('/dashboard/overview'), [refreshKey]);

  if (selected) {
    return <MemberDetail memberId={selected} refreshKey={refreshKey} onBack={() => setSelected(null)} go={go} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Family overview</h2>
          <p className="muted">Everyone's active medicines and safety flags at a glance. Click a person for details.</p>
        </div>
        <button className="btn btn-primary" onClick={() => go('add')}>
          + Add prescription / medicine
        </button>
      </div>

      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />

      {data && data.members.length === 0 && (
        <EmptyState icon="👨‍👩‍👧" title="No family members yet">
          <button className="btn btn-primary" onClick={() => go('manage')}>
            Add your first family member
          </button>
        </EmptyState>
      )}

      {data && data.members.length > 0 && (
        <div className="card-grid">
          {data.members.map((m) => {
            const total = m.flags.interactions + m.flags.duplicates + m.flags.familyInteractions;
            return (
              <button key={m.id} className={`member-card ${total > 0 ? 'has-issues' : ''}`} onClick={() => setSelected(m.id)}>
                <div className="member-top">
                  <div className="avatar">{m.name.slice(0, 1).toUpperCase()}</div>
                  <div className="member-id">
                    <div className="member-name">{m.name}</div>
                    <div className="muted small">
                      {m.age} years · {m.gender}
                    </div>
                  </div>
                  {m.flags.highestSeverity && <SeverityBadge severity={m.flags.highestSeverity} />}
                </div>

                <div className="chip-title">Active medicines</div>
                {m.activeMedicines.length === 0 ? (
                  <div className="muted small">None</div>
                ) : (
                  <div className="chips">
                    {m.activeMedicines.map((x) => (
                      <span className="chip" key={x.id}>
                        {x.name}
                        {x.dosage ? ` ${x.dosage}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flags">
                  <Flag label="Interactions" count={m.flags.interactions} tone="danger" />
                  <Flag label="Duplicates" count={m.flags.duplicates} tone="warn" />
                  <Flag label="Family interactions" count={m.flags.familyInteractions} tone="danger" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
