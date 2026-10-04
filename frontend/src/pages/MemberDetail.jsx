import React from 'react';
import { api } from '../api.js';
import { useAsync, Loading, ErrorBox, EmptyState, InteractionCard, DuplicateCard, formatDate } from '../components/ui.jsx';

function Section({ title, count, children }) {
  return (
    <section className="section">
      <h3>
        {title} {count !== undefined && <span className="count">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

export default function MemberDetail({ memberId, refreshKey, onBack, go }) {
  const { data, error, loading, reload } = useAsync(() => api.get(`/members/${memberId}`), [memberId, refreshKey]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;

  const { member, medicines, safety } = data;
  const active = medicines.filter((m) => m.status === 'active');
  const history = medicines.filter((m) => m.status !== 'active');

  return (
    <div>
      <button className="btn btn-small" onClick={onBack}>
        ← Back to family overview
      </button>

      <div className="detail-head">
        <div className="avatar avatar-lg">{member.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h2>{member.name}</h2>
          <div className="muted">
            {member.age} years · {member.gender}
          </div>
        </div>
        <button className="btn btn-primary push-right" onClick={() => go('add', member.id)}>
          + Add medicine
        </button>
      </div>

      <Section title="Active medicines" count={active.length}>
        {active.length === 0 ? (
          <EmptyState icon="💊" title="No active medicines">
            Add a prescription or a medicine to start safety checking.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Medicine (as entered)</th>
                  <th>Standardized (RxNorm)</th>
                  <th>Active ingredient(s)</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {active.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.originalName}</strong>
                    </td>
                    <td>
                      {m.standardizedName} <span className="muted small">RxCUI {m.rxcui}</span>
                    </td>
                    <td>{m.ingredients.join(', ')}</td>
                    <td>{m.dosage || '—'}</td>
                    <td>{m.frequency || '—'}</td>
                    <td>{formatDate(m.addedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Drug interactions (this person's medicines)" count={safety.interactions.length}>
        {safety.interactions.length === 0 ? (
          <div className="ok-note">✓ No documented interactions between this person's active medicines.</div>
        ) : (
          <div className="issue-list">
            {safety.interactions.map((i) => (
              <InteractionCard key={i.id} item={i} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Duplicate medicines (this person)" count={safety.duplicates.length}>
        {safety.duplicates.length === 0 ? (
          <div className="ok-note">✓ No duplicate medicines.</div>
        ) : (
          <div className="issue-list">
            {safety.duplicates.map((d) => (
              <DuplicateCard key={d.id} item={d} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Interactions with other family members' medicines" count={safety.familyInteractions.length}>
        {safety.familyInteractions.length === 0 ? (
          <div className="ok-note">✓ No documented interactions with other family members' active medicines.</div>
        ) : (
          <div className="issue-list">
            {safety.familyInteractions.map((i) => (
              <InteractionCard key={i.id} item={i} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Duplicates with other family members" count={safety.familyDuplicates.length}>
        {safety.familyDuplicates.length === 0 ? (
          <div className="ok-note">✓ No duplicate medicines with other family members.</div>
        ) : (
          <div className="issue-list">
            {safety.familyDuplicates.map((d) => (
              <DuplicateCard key={d.id} item={d} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Medicine history" count={history.length}>
        {history.length === 0 ? (
          <p className="muted">Consumed or stopped medicines will appear here.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Standardized</th>
                  <th>Dosage</th>
                  <th>Status</th>
                  <th>Ended</th>
                </tr>
              </thead>
              <tbody>
                {history.map((m) => (
                  <tr key={m.id}>
                    <td>{m.originalName}</td>
                    <td>{m.standardizedName}</td>
                    <td>{m.dosage || '—'}</td>
                    <td>
                      <span className={`status status-${m.status}`}>{m.status}</span>
                    </td>
                    <td>{formatDate(m.endedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
