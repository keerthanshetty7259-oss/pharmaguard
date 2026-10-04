import React from 'react';
import { api } from '../api.js';
import { useAsync, Loading, ErrorBox, InteractionCard, DuplicateCard } from '../components/ui.jsx';

export default function FamilySafety({ refreshKey }) {
  const { data, error, loading, reload } = useAsync(() => api.get('/dashboard/family-safety'), [refreshKey]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Family safety</h2>
          <p className="muted">
            Medicines of one family member that may interact with, or duplicate, another member's currently active medicines.
          </p>
        </div>
      </div>

      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />

      {data && (
        <>
          <div className="summary-row">
            <div className={`summary ${data.interactions.length ? 'summary-danger' : 'summary-ok'}`}>
              <div className="summary-num">{data.interactions.length}</div>
              <div>Cross-family interaction{data.interactions.length === 1 ? '' : 's'}</div>
            </div>
            <div className={`summary ${data.duplicates.length ? 'summary-warn' : 'summary-ok'}`}>
              <div className="summary-num">{data.duplicates.length}</div>
              <div>Cross-family duplicate{data.duplicates.length === 1 ? '' : 's'}</div>
            </div>
          </div>

          <section className="section">
            <h3>Potential drug interactions between family members</h3>
            {data.interactions.length === 0 ? (
              <div className="ok-note">✓ No documented interactions between different family members' active medicines.</div>
            ) : (
              <div className="issue-list">
                {data.interactions.map((i) => (
                  <InteractionCard key={i.id} item={i} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h3>Duplicate medicines across family members</h3>
            {data.duplicates.length === 0 ? (
              <div className="ok-note">✓ No medicine ingredient is being taken by more than one family member.</div>
            ) : (
              <div className="issue-list">
                {data.duplicates.map((d) => (
                  <DuplicateCard key={d.id} item={d} />
                ))}
              </div>
            )}
          </section>

          <p className="muted small">
            Results are produced when a medicine is added. Only active medicines are shown; if a medicine is marked consumed or stopped, its warnings disappear.
            No warning does not guarantee that a combination is safe — always ask a doctor or pharmacist.
          </p>
        </>
      )}
    </div>
  );
}
