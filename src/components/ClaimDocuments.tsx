import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { documentCategories, type Reimbursement, type ClaimDetails } from '../lib/claim-cases';
import { ecardGeneration, openEcardFile } from '../lib/ecards';
import { useSession } from '../lib/session';
const base = '/api/employee/app/claims';
export const emptyReimbursement = (): Reimbursement => ({ dischargeDate: 0, hospitalAddress: '', diagnosis: '', claimedAmount: 0, contactPhone: '', contactEmail: '' });
const dateInput = (value: number) => value ? String(value).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') : '';

export function ReimbursementFields({ value, onChange }: { value: Reimbursement; onChange: (value: Reimbursement) => void }) {
  const { token } = useSession();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function form() {
    setBusy(true); setError(''); const generation = ecardGeneration();
    try {
      const blob = await api<Blob>(`${base}/form`, { token: token!, response: 'blob' });
      await openEcardFile(blob, generation, () => live.current, { maxBytes: 10 * 1024 * 1024, fileName: 'Medi-Assist-claim-form.pdf' });
    } catch (cause) { if (live.current) setError((cause as Error).message); }
    finally { if (live.current) setBusy(false); }
  }
  return <>
    <label>Discharge date<input type="date" required value={dateInput(value.dischargeDate)} onChange={event => onChange({ ...value, dischargeDate: Number(event.target.value.replaceAll('-', '')) })} /></label>
    <label>Claim amount (₹)<input type="number" required min="0.01" max="100000000" step="0.01" value={value.claimedAmount || ''} onChange={event => onChange({ ...value, claimedAmount: Number(event.target.value) })} /></label>
    <label>Hospital address<textarea required minLength={5} maxLength={1000} rows={3} value={value.hospitalAddress} onChange={event => onChange({ ...value, hospitalAddress: event.target.value })} /></label>
    <label>Diagnosis / disease<textarea required minLength={3} maxLength={1000} rows={3} value={value.diagnosis} onChange={event => onChange({ ...value, diagnosis: event.target.value })} /></label>
    <label>Contact phone<input type="tel" required pattern="\+?[0-9]{10,15}" value={value.contactPhone} onChange={event => onChange({ ...value, contactPhone: event.target.value })} /></label>
    <label>Contact email<input type="email" required maxLength={254} value={value.contactEmail} onChange={event => onChange({ ...value, contactEmail: event.target.value })} /></label>
    <div className="claim-wide"><p>After saving your draft, attach the signed claim form, discharge summary, hospital bill and payment receipt. You can review everything before submitting.</p><button type="button" className="button button-secondary" disabled={busy} onClick={() => { void form(); }}>Download blank claim form</button>{error && <p className="error-message" role="alert">{error}</p>}</div>
  </>;
}

export function ClaimDocuments({ claim, token, onUpdated, onError }: { claim: ClaimDetails; token: string; onUpdated: () => Promise<void>; onError: (error: unknown) => void }) {
  const [category, setCategory] = useState('claim_form');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const lock = useRef(false); const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const documents = claim.documents ?? [];
  const editable = claim.state === 'draft' || claim.state === 'accepted' && claim.insuranceStatus === 'documents_required';
  async function work(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (cause) { if (live.current) { setError((cause as Error).message); if (cause instanceof ApiError && cause.status === 401) onError(cause); } }
    finally { lock.current = false; if (live.current) setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    await work(async () => {
      const form = new FormData(); form.append('file', file); form.append('category', category); form.append('expectedVersion', String(claim.version));
      await api(`${base}/${claim.id}/documents`, { token, method: 'POST', formData: form });
      if (live.current) await onUpdated();
    });
  }
  return <section className="plain-section" aria-label="Claim documents">
    <h3>Documents</h3>
    {claim.claimType === 'reimbursement' && <ul className="claim-checklist">{['claim_form', 'discharge_summary', 'hospital_bill', 'receipt'].map(key => <li key={key}>{documents.some(file => file.category === key) ? '✓ Attached: ' : 'Required: '}{documentCategories[key as keyof typeof documentCategories]}</li>)}</ul>}
    {documents.length ? <ul className="claim-document-list">{documents.map(file => <li key={file.id}><span><strong>{file.name}</strong><small>{documentCategories[file.category as keyof typeof documentCategories] ?? file.category} · {Math.ceil(file.bytes / 1024)} KB</small></span><div><button type="button" className="text-button" disabled={busy} onClick={() => { void work(async () => {
      const generation = ecardGeneration(); const blob = await api<Blob>(`${base}/${claim.id}/documents/${file.id}`, { token, response: 'blob' });
      await openEcardFile(blob, generation, () => live.current, { fileName: file.name, maxBytes: 10 * 1024 * 1024 });
    }); }}>Open</button>{claim.state === 'draft' && <button type="button" className="text-button" disabled={busy} onClick={() => { void work(async () => {
      await api(`${base}/${claim.id}/documents/${file.id}`, { token, method: 'DELETE', body: { expectedVersion: claim.version } });
      if (live.current) await onUpdated();
    }); }}>Remove</button>}</div></li>)}</ul> : <p className="muted">No documents attached.</p>}
    {editable && <div className="claim-doc-upload"><label>Document category<select disabled={busy} value={category} onChange={event => setCategory(event.target.value)}>{Object.entries(documentCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Add document<input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} /></label><p className="muted">PDF, PNG or JPEG. Up to 10 MB per file; 10 files and 20 MB per claim. {claim.mode === 'mediassist_uat' ? 'Provider UAT: use approved test files only.' : 'Demo: use test files only.'}</p></div>}
    {busy && <p role="status">Updating documents…</p>}{error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
