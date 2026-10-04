import React, { useCallback, useEffect, useRef, useState } from 'react';

// Load data from the API and expose { data, error, loading, reload }.
// "refreshKey" lets the app reload every dashboard after medicines or members change.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return loaderRef
      .current()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}

export function Loading({ text = 'Loading…' }) {
  return (
    <div className="loading">
      <span className="spinner" /> {text}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error">
      <div>{error.message || String(error)}</div>
      {onRetry && (
        <button className="btn btn-small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon = '🩺', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function SeverityBadge({ severity }) {
  const s = String(severity || 'Unknown').toLowerCase();
  const label = s === 'unknown' ? 'Unknown severity' : `${s[0].toUpperCase()}${s.slice(1)}`;
  return <span className={`badge badge-${['major', 'moderate', 'minor'].includes(s) ? s : 'unknown'}`}>{label}</span>;
}

export function InteractionCard({ item, showScope = false }) {
  const same = item.a.memberId === item.b.memberId;
  const ingredientsDiffer =
    item.drugA.toLowerCase() !== item.a.medicine.toLowerCase() || item.drugB.toLowerCase() !== item.b.medicine.toLowerCase();
  return (
    <div className={`issue issue-${String(item.severity).toLowerCase()}`}>
      <div className="issue-head">
        <SeverityBadge severity={item.severity} />
        {showScope && <span className="scope">{same ? 'Same person' : 'Between family members'}</span>}
      </div>
      <div className="pair">
        <div className="pair-side">
          <div className="pair-person">{item.a.memberName}</div>
          <div className="pair-med">{item.a.medicine}</div>
        </div>
        <div className="pair-arrow">⚠ interacts with</div>
        <div className="pair-side">
          <div className="pair-person">{item.b.memberName}</div>
          <div className="pair-med">{item.b.medicine}</div>
        </div>
      </div>
      {ingredientsDiffer && (
        <div className="muted small">
          Active ingredients involved: {item.drugA} + {item.drugB}
        </div>
      )}
      {item.evidence && <div className="evidence">{item.evidence}</div>}
      <div className="muted small">Source: {item.source}</div>
    </div>
  );
}

export function DuplicateCard({ item }) {
  const same = item.a.memberId === item.b.memberId;
  return (
    <div className="issue issue-duplicate">
      <div className="issue-head">
        <span className="badge badge-duplicate">Duplicate</span>
        <span className="scope">{same ? 'Same person' : 'Between family members'}</span>
      </div>
      <div className="pair">
        <div className="pair-side">
          <div className="pair-person">{item.a.memberName}</div>
          <div className="pair-med">{item.a.medicine}</div>
        </div>
        <div className="pair-arrow">= same ingredient</div>
        <div className="pair-side">
          <div className="pair-person">{item.b.memberName}</div>
          <div className="pair-med">{item.b.medicine}</div>
        </div>
      </div>
      <div className="evidence">
        Both contain <strong>{item.ingredient}</strong>.
      </div>
    </div>
  );
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
