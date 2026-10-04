import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAsync, Loading, ErrorBox, EmptyState, InteractionCard, DuplicateCard } from '../components/ui.jsx';

// ---------- result shown after a medicine was added and checked ----------
function SafetyResult({ result, onAnother }) {
  const nothing = result.interactions.length === 0 && result.duplicates.length === 0;
  const toCard = (i, idx) => ({
    id: idx,
    severity: i.severity,
    drugA: i.drugA,
    drugB: i.drugB,
    evidence: i.evidence,
    source: i.source,
    a: { medicine: i.medicineA.name, memberId: i.medicineA.memberId, memberName: i.medicineA.memberName },
    b: { medicine: i.medicineB.name, memberId: i.medicineB.memberId, memberName: i.medicineB.memberName },
  });
  const dupCard = (d, idx) => ({
    id: idx,
    ingredient: d.ingredient,
    a: { medicine: d.medicineA.name, memberId: d.medicineA.memberId, memberName: d.medicineA.memberName },
    b: { medicine: d.medicineB.name, memberId: d.medicineB.memberId, memberName: d.medicineB.memberName },
  });

  return (
    <div className="panel result">
      <h3>✅ Saved &amp; checked</h3>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>You entered</th>
              <th>Standardized (RxNorm)</th>
              <th>RxCUI</th>
              <th>Active ingredient(s)</th>
              <th>Dosage</th>
              <th>Frequency</th>
            </tr>
          </thead>
          <tbody>
            {result.added.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.originalName}</strong>
                </td>
                <td>{m.standardizedName}</td>
                <td>{m.rxcui}</td>
                <td>{m.ingredients.join(', ')}</td>
                <td>{m.dosage || '—'}</td>
                <td>{m.frequency || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.notFound.length > 0 && (
        <div className="alert alert-warn">Not recognised and not saved: {result.notFound.join(', ')}</div>
      )}

      {nothing ? (
        <div className="ok-note">
          ✓ No documented interactions or duplicates were found against this person's or the other family members' active medicines.
          <div className="muted small">
            "Nothing found" does not guarantee a combination is safe — please still check with a doctor or pharmacist.
          </div>
        </div>
      ) : (
        <>
          {result.interactions.length > 0 && (
            <>
              <h4>⚠ Drug interactions found ({result.interactions.length})</h4>
              <div className="issue-list">
                {result.interactions.map((i, idx) => (
                  <InteractionCard key={idx} item={toCard(i, idx)} showScope />
                ))}
              </div>
            </>
          )}
          {result.duplicates.length > 0 && (
            <>
              <h4>⚠ Duplicate medicines found ({result.duplicates.length})</h4>
              <div className="issue-list">
                {result.duplicates.map((d, idx) => (
                  <DuplicateCard key={idx} item={dupCard(d, idx)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <button className="btn btn-primary" onClick={onAnother}>
        Add another
      </button>
    </div>
  );
}

// ---------- upload a prescription image ----------
let rowCounter = 0;
const newRow = (r = {}) => ({ key: ++rowCounter, include: true, name: '', dosage: '', frequency: '', match: null, ...r });

function UploadFlow({ memberId, onResult }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [review, setReview] = useState(null); // { text, filename, rows }

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function readImage() {
    setError(null);
    setReading(true);
    setReview(null);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('memberId', memberId);
      const res = await api.upload('/prescriptions/ocr', form);
      setReview({
        text: res.text,
        filename: res.filename,
        rows: res.items.map((it) => newRow({ include: Boolean(it.match), name: it.name, dosage: it.dosage || '', frequency: it.frequency || '', match: it.match })),
      });
    } catch (err) {
      setError(err);
    } finally {
      setReading(false);
    }
  }

  const updateRow = (key, patch) =>
    setReview((r) => ({
      ...r,
      rows: r.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));

  async function save() {
    setError(null);
    const items = review.rows
      .filter((r) => r.include && r.name.trim())
      .map((r) => ({ name: r.name.trim(), dosage: r.dosage.trim() || null, frequency: r.frequency.trim() || null }));
    if (!items.length) {
      setError(new Error('Select at least one medicine to save.'));
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`/members/${memberId}/medicines`, {
        source: 'image',
        items,
        ocrText: review.text,
        filename: review.filename,
      });
      onResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <h3>1. Upload the prescription</h3>
        <p className="muted small">Works best with a clear, typed (computer-printed) prescription — PNG or JPG, up to 10&nbsp;MB.</p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/bmp,image/webp"
          onChange={(e) => {
            setFile(e.target.files[0] || null);
            setReview(null);
            setError(null);
          }}
        />
        {preview && <img className="preview" src={preview} alt="Prescription preview" />}
        <div>
          <button className="btn btn-primary" disabled={!file || reading} onClick={readImage}>
            {reading ? 'Reading prescription…' : 'Read prescription'}
          </button>
        </div>
        {reading && (
          <p className="muted small">
            <span className="spinner" /> Running OCR and looking up each medicine in RxNorm. The very first time can take a minute while the OCR language data downloads.
          </p>
        )}
      </div>

      {review && (
        <div className="panel">
          <h3>2. Check the medicines found</h3>
          <p className="muted small">
            Fix any mistakes from the scan, untick anything that is not a medicine, or add a missing one. Nothing is saved until you press the button below.
          </p>

          {review.rows.length === 0 && (
            <div className="alert alert-warn">No medicine lines were detected. You can add medicines manually below or try a clearer image.</div>
          )}

          <div className="review-rows">
            {review.rows.map((r) => (
              <div className={`review-row ${r.include ? '' : 'excluded'}`} key={r.key}>
                <input type="checkbox" checked={r.include} onChange={(e) => updateRow(r.key, { include: e.target.checked })} aria-label="Include" />
                <div className="review-fields">
                  <input
                    placeholder="Medicine name"
                    value={r.name}
                    onChange={(e) => updateRow(r.key, { name: e.target.value, match: null })}
                  />
                  <input placeholder="Dosage" value={r.dosage} onChange={(e) => updateRow(r.key, { dosage: e.target.value })} />
                  <input placeholder="Frequency" value={r.frequency} onChange={(e) => updateRow(r.key, { frequency: e.target.value })} />
                </div>
                <div className="review-match">
                  {r.match ? (
                    <span className={r.match.type === 'approximate' ? 'match match-approx' : 'match match-ok'}>
                      {r.match.type === 'approximate' ? '≈ Closest match: ' : '✓ '}
                      {r.match.name} <span className="muted small">RxCUI {r.match.rxcui}</span>
                    </span>
                  ) : (
                    <span className="match match-none">Not recognised yet — will be checked on save</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="row-actions">
            <button className="btn btn-small" onClick={() => setReview((r) => ({ ...r, rows: [...r.rows, newRow()] }))}>
              + Add a row
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={save}>
              {saving ? 'Saving & checking…' : 'Save & check safety'}
            </button>
          </div>

          <details className="ocr-text">
            <summary>Show the raw text read from the image</summary>
            <pre>{review.text}</pre>
          </details>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error.message}
          {error.data?.notFound?.length > 0 && <div className="small">Not recognised: {error.data.notFound.join(', ')}</div>}
        </div>
      )}
    </div>
  );
}

// ---------- manual entry ----------
function ManualFlow({ memberId, onResult }) {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // suggestion needing confirmation

  async function submit(confirmApproximate) {
    setError(null);
    setBusy(true);
    try {
      const res = await api.post(`/members/${memberId}/medicines`, {
        source: 'manual',
        items: [{ name, dosage: dosage || null, frequency: frequency || null, confirmApproximate }],
      });
      setConfirm(null);
      onResult(res);
    } catch (err) {
      if (err.status === 409 && err.data?.needsConfirmation?.length) setConfirm(err.data.needsConfirmation[0]);
      else {
        setConfirm(null);
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <h3>Enter a medicine</h3>
      <div className="form-grid form-grid-3">
        <label>
          Medicine name
          <input value={name} onChange={(e) => { setName(e.target.value); setConfirm(null); }} placeholder="e.g. Warfarin" required />
        </label>
        <label>
          Dosage (optional)
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 5 mg" />
        </label>
        <label>
          Frequency (optional)
          <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. once daily" />
        </label>
      </div>

      {confirm && (
        <div className="alert alert-warn">
          <div>
            “{confirm.input}” was not an exact match. Did you mean <strong>{confirm.suggestion.name}</strong> (RxCUI {confirm.suggestion.rxcui})?
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-small btn-primary" disabled={busy} onClick={() => submit(true)}>
              Yes, use this
            </button>
            <button type="button" className="btn btn-small" onClick={() => setConfirm(null)}>
              No, let me edit
            </button>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error.message}</div>}

      <button className="btn btn-primary" disabled={busy || !name.trim()}>
        {busy ? 'Checking…' : 'Add & check safety'}
      </button>
    </form>
  );
}

// ---------- page ----------
export default function AddMedicine({ initialMemberId, onChanged, go }) {
  const { data, error, loading, reload } = useAsync(() => api.get('/members'), []);
  const [memberId, setMemberId] = useState(initialMemberId || null);
  const [tab, setTab] = useState('upload');
  const [result, setResult] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  const members = data ? data.members : [];
  useEffect(() => {
    if (data && !members.find((m) => m.id === memberId)) setMemberId(members.length ? members[0].id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const member = members.find((m) => m.id === memberId);

  function handleResult(res) {
    setResult(res);
    onChanged(); // every dashboard reloads with the new results
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Prescription / medicine input</h2>
          <p className="muted">
            Upload a prescription once. PharmaGuard standardizes each medicine and automatically checks it against this person's and the rest of the family's active medicines.
          </p>
        </div>
      </div>

      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />

      {data && members.length === 0 && (
        <EmptyState icon="👨‍👩‍👧" title="Add a family member first">
          <button className="btn btn-primary" onClick={() => go('manage')}>
            Go to Family &amp; medicines
          </button>
        </EmptyState>
      )}

      {data && members.length > 0 && (
        <>
          <div className="panel">
            <label>
              This medicine is for
              <select
                value={memberId || ''}
                onChange={(e) => {
                  setMemberId(Number(e.target.value));
                  setResult(null);
                }}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.age}, {m.gender})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {result ? (
            <SafetyResult
              result={result}
              onAnother={() => {
                setResult(null);
                setResetKey((k) => k + 1);
              }}
            />
          ) : (
            <>
              <div className="tabs">
                <button className={tab === 'upload' ? 'tab active' : 'tab'} onClick={() => setTab('upload')}>
                  📷 Upload prescription
                </button>
                <button className={tab === 'manual' ? 'tab active' : 'tab'} onClick={() => setTab('manual')}>
                  ⌨ Manual entry
                </button>
              </div>
              {member &&
                (tab === 'upload' ? (
                  <UploadFlow key={`u-${memberId}-${resetKey}`} memberId={memberId} onResult={handleResult} />
                ) : (
                  <ManualFlow key={`m-${memberId}-${resetKey}`} memberId={memberId} onResult={handleResult} />
                ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
