import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { PageHeading, Empty } from '../components/ui';
import { api, ApiError, dateLabel } from '../lib/api';
import { type ClaimSummary, type ClaimDetails, type ClaimOptions,
  type ClaimList, type ClaimDetailResponse, type ClaimHistory } from '../lib/claim-cases';
import { ReimbursementFields, ClaimDocuments, emptyReimbursement } from '../components/ClaimDocuments';
import { claimStateLabel, providerLabel } from '../lib/claim-cases';
import { useSession } from '../lib/session';

const base = '/api/employee/app/claims';
const isoDate = (date: number) => String(date).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
const today = () => new Date().toLocaleDateString('en-CA');
const historyLabel: Record<string, string> = { created: 'Draft created', draft_updated: 'Draft updated',
  submitted: 'Intimation submitted', provider_result: 'Delivery status updated', document_added: 'Document added', document_removed: 'Document removed', status_synced: 'Provider status refreshed', provider_linked: 'Provider identifiers confirmed', document_delivered: 'Document link fetched' };

export default function ClaimsScreen() {
  const { token, overview, signOut } = useSession();
  const [rows, setRows] = useState<ClaimSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ClaimDetails | null>(null);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const key = useRef(crypto.randomUUID());
  const epoch = useRef(0);
  const locked = useRef(false);
  const enabled = overview?.claims?.enabled;

  const handleError = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { void signOut().catch(error => setError(error.message)); return; }
    setError(cause instanceof Error ? cause.message : 'Could not load claims. Please try again.');
  }, [signOut]);
  const load = useCallback(async () => {
    const request = ++epoch.current;
    setLoading(true); setError('');
    try {
      const data = await api<ClaimList>(base, { token: token!, query: { page, limit: 20 } });
      if (request !== epoch.current) return;
      if (!data.availability.enabled) throw new Error('Claims are not available right now. Please contact your P&C team.');
      setRows(data.cases); setTotal(data.total);
    } catch (cause) { if (request === epoch.current) handleError(cause); }
    finally { if (request === epoch.current) setLoading(false); }
  }, [token, page, handleError]);
  useEffect(() => {
    if (!enabled) return;
    const requests = epoch;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { clearTimeout(timer); requests.current++; };
  }, [enabled, load]);

  async function open(id: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const data = await api<ClaimDetailResponse>(`${base}/${id}`, { token: token! });
      setSelected(data.claim); setHistory(data.history); setEditing(false); setAgreed(false);
      key.current = crypto.randomUUID();
    } catch (cause) { handleError(cause); }
    finally { locked.current = false; setBusy(false); }
  }
  async function submit() {
    if (!selected || !agreed || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      await api(`${base}/${selected.id}/${selected.state === 'accepted' ? 'document-response' : selected.claimType === 'reimbursement' ? 'reimburse' : 'intimate'}`, { token: token!, method: 'POST', body: {
        expectedVersion: selected.version, declaration: true, idempotencyKey: key.current,
      } });
      const data = await api<ClaimDetailResponse>(`${base}/${selected.id}`, { token: token! });
      setSelected(data.claim); setHistory(data.history); setAgreed(false);
    } catch (cause) { handleError(cause); }
    finally { locked.current = false; setBusy(false); }
  }
  async function sync() {
    if (!selected || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const data = await api<ClaimDetailResponse>(`${base}/${selected.id}/sync`, { token: token!, method: 'POST' });
      setSelected(data.claim); setHistory(data.history); key.current = crypto.randomUUID();
    } catch (cause) { handleError(cause); }
    finally { locked.current = false; setBusy(false); }
  }
  function back() { setSelected(null); setHistory([]); setEditing(false); setError(''); void load(); }

  if (!enabled) return <><PageHeading title="Claims" back /><Empty title="Claims are not available yet">Please contact your P&amp;C team for help.</Empty></>;
  return <>
    <PageHeading title="Claims" description="Your claims, hospital admission intimations and family history." back />
    <p className="info-note">{overview?.claims?.mode === 'mediassist_uat' ? <><strong>Medi Assist provider UAT.</strong> Submissions go to the configured provider account. Use approved UAT information and test documents only. Provider receipt is not approval, cashless authorisation or payment.</> : <><strong>Test environment.</strong> These records do not go to an insurer. A test receipt is not approval, cashless authorisation or payment. {overview?.claims?.reimbursement ? 'Use synthetic information and test documents only. All approvals and payments shown here are simulated.' : 'Documents and reimbursement are not available yet.'}</>}</p>
    {error && (!selected || editing) ? <p className="error-message" role="alert">{error}</p> : null}
    {editing ? <ClaimForm reimbursementEnabled={Boolean(overview?.claims?.reimbursement) && (!selected || ['demo', 'mediassist_uat'].includes(selected.mode ?? ''))} token={token!} existing={selected} onCancel={() => { setEditing(false); setError(''); }} onSaved={(id) => { void open(id); }} onError={handleError} />
      : selected ? <section className="claim-detail" aria-label={selected.claimType === 'reimbursement' ? 'Reimbursement claim details' : 'Intimation details'}>
        <button className="text-button" onClick={back} disabled={busy}>Back to claims</button>
        <div className="claim-title"><h2>{selected.memberName}</h2><span>{claimStateLabel(selected)}</span></div>
        <p className="muted">{selected.claimType === 'reimbursement' ? 'Reimbursement claim · ' : ''}{selected.relation} · {selected.policyName}</p>
        <dl className="claim-facts"><div><dt>Admission date</dt><dd>{dateLabel(selected.treatmentDate)}</dd></div><div><dt>Hospital</dt><dd>{selected.details.hospitalName}, {selected.details.hospitalCity}</dd></div><div><dt>Admission</dt><dd>{selected.details.admissionType === 'planned' ? 'Planned' : 'Emergency'}</dd></div><div><dt>Reason</dt><dd>{selected.details.reason}</dd></div>{selected.providerReference ? <div><dt>{selected.mode === 'mediassist_uat' ? 'Provider reference (UAT)' : 'Test reference'}</dt><dd>{selected.providerReference}</dd></div> : null}</dl>
        {selected.reimbursement && <dl className="claim-facts"><div><dt>Discharge date</dt><dd>{dateLabel(selected.reimbursement.dischargeDate)}</dd></div><div><dt>Diagnosis</dt><dd>{selected.reimbursement.diagnosis}</dd></div><div><dt>Claimed amount</dt><dd>₹{selected.reimbursement.claimedAmount.toLocaleString('en-IN')}</dd></div><div><dt>Hospital address</dt><dd>{selected.reimbursement.hospitalAddress}</dd></div><div><dt>Contact</dt><dd>{selected.reimbursement.contactEmail} · {selected.reimbursement.contactPhone}</dd></div></dl>}
        {selected.insuranceStatus && <section className="plain-section" aria-label={selected.mode === 'mediassist_uat' ? 'Medi Assist provider status' : 'Demo provider status'}><h3>{providerLabel(selected)}</h3><p>Approved: {selected.approvedAmount == null ? 'Not reported' : `₹${selected.approvedAmount.toLocaleString('en-IN')}`} · Paid: {selected.paidAmount == null ? 'Not reported' : `₹${selected.paidAmount.toLocaleString('en-IN')}`}</p>{selected.lastSyncedAt && <p className="muted">Last checked: {new Date(selected.lastSyncedAt).toLocaleString('en-IN')}</p>}</section>}
        {overview?.claims?.documentHandlingEnabled && ['demo', 'mediassist_uat'].includes(selected.mode ?? '') && selected.claimType === 'reimbursement' && <ClaimDocuments claim={selected} token={token!} onUpdated={() => open(selected.id)} onError={handleError} />}
        {selected.mode === 'mediassist_uat' && !selected.providerReady && <p className="info-note">Broker Admin must verify the Medi Assist policy and covered beneficiary before this claim can be submitted.</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {(selected.state === 'draft' || selected.state === 'accepted' && selected.insuranceStatus === 'documents_required') ? <div className="claim-actions">
          {selected.state === 'draft' && <button className="button button-secondary" disabled={busy} onClick={() => setEditing(true)}>Edit draft</button>}
          <label className="claim-declaration"><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} disabled={busy} />{selected.claimType === 'reimbursement' ? 'I confirm these details and documents are accurate and authorise this claim submission.' : 'I confirm these details are accurate and authorise this admission intimation.'}</label>
          <button className="button button-primary" disabled={!agreed || busy || selected.mode === 'mediassist_uat' && !selected.providerReady} onClick={() => { void submit(); }}>{busy ? 'Submitting…' : selected.mode === 'mediassist_uat' ? (selected.state === 'accepted' ? 'Send documents to Medi Assist (UAT)' : 'Submit to Medi Assist (UAT)') : selected.state === 'accepted' ? 'Submit test document response' : selected.claimType === 'reimbursement' ? 'Submit test claim' : 'Submit test intimation'}</button>
        </div> : <button className="button button-secondary" disabled={busy} onClick={() => { void open(selected.id); }}>Refresh status</button>}
        {selected.state === 'accepted' && ['demo', 'mediassist_uat'].includes(selected.mode ?? '') && selected.claimType === 'reimbursement' && overview?.claims?.reimbursement && <button className="button button-secondary" disabled={busy} onClick={() => { void sync(); }}>{selected.mode === 'mediassist_uat' ? 'Refresh provider status' : 'Refresh demo status'}</button>}
        <section className="plain-section"><h3>History</h3><ol className="claim-history">{history.map(item => <li key={item.id}><strong>{item.kind === 'submitted' && item.payload?.operationKind === 'documents' ? 'Document response submitted' : item.kind === 'submitted' && selected.claimType === 'reimbursement' ? 'Claim submitted' : historyLabel[item.kind] ?? 'Record updated'}</strong><span>Version {item.version} · {new Date(item.createdAt).toLocaleString('en-IN')}</span></li>)}</ol></section>
      </section> : <>
        <div className="claim-toolbar"><p className="muted">{error && !rows.length ? 'Records unavailable' : `${total} ${total === 1 ? 'record' : 'records'}`}</p><button className="button button-primary" onClick={() => { setSelected(null); setEditing(true); setError(''); }}>{overview?.claims?.reimbursement ? 'New claim' : 'New intimation'}</button></div>
        {loading ? <p role="status">Loading claims…</p> : error && !rows.length ? null : !rows.length ? <Empty title="No intimations yet">Start a draft when you need to tell us about a hospital admission.</Empty> : <ul className="claim-list">{rows.map(row => <li key={row.id}><button disabled={busy} onClick={() => { void open(row.id); }}><span><strong>{row.memberName}</strong><small>{row.claimType === 'reimbursement' ? 'Reimbursement · ' : ''}{row.hospitalName} · {dateLabel(row.treatmentDate)}</small></span><span>{row.insuranceStatus ? providerLabel(row) : claimStateLabel(row)}</span></button></li>)}</ul>}
        <div className="claim-toolbar"><button className="text-button" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}</span><button className="text-button" disabled={loading || page * 20 >= total} onClick={() => setPage(value => value + 1)}>Next</button><button className="text-button" disabled={loading} onClick={() => { void load(); }}>Refresh</button></div>
      </>}
  </>;
}

function ClaimForm({ token, existing, onCancel, onSaved, onError, reimbursementEnabled }: {
  reimbursementEnabled: boolean; token: string; existing: ClaimDetails | null; onCancel: () => void;
  onSaved: (id: string) => void; onError: (cause: unknown) => void;
}) {
  const [claimType, setClaimType] = useState(existing?.claimType ?? 'intimation');
  const [reimbursement, setReimbursement] = useState(existing?.reimbursement ?? emptyReimbursement());
  const [date, setDate] = useState(existing ? isoDate(existing.treatmentDate) : today());
  const [policyId, setPolicyId] = useState(existing?.policyId ?? '');
  const [memberId, setMemberId] = useState(existing?.memberId ?? '');
  const [hospital, setHospital] = useState(existing?.details.hospitalName ?? '');
  const [city, setCity] = useState(existing?.details.hospitalCity ?? '');
  const [admission, setAdmission] = useState(existing?.details.admissionType ?? 'planned');
  const [reason, setReason] = useState(existing?.details.reason ?? '');
  const [contactPhone, setContactPhone] = useState(existing?.details.contactPhone ?? '');
  const [options, setOptions] = useState<ClaimOptions | null>(null);
  const [optionsRetry, setOptionsRetry] = useState(0);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const creationKey = useRef(crypto.randomUUID());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    const request = ++epoch.current;
    const requests = epoch;
    const timer = window.setTimeout(async () => {
      setOptions(null); setOptionsLoading(true); setError('');
      try {
        const data = await api<ClaimOptions>(`${base}/options`, { token, query: { on: Number(date.replaceAll('-', '')) } });
        if (request !== epoch.current) return;
        if (!data.availability.enabled) throw new Error('Intimations are unavailable right now.');
        setOptions(data);
      } catch (cause) { if (request === epoch.current) { setError((cause as Error).message); if (cause instanceof ApiError && cause.status === 401) onError(cause); } }
      finally { if (request === epoch.current) setOptionsLoading(false); }
    }, 0);
    return () => { clearTimeout(timer); requests.current++; };
  }, [date, token, onError, optionsRetry]);
  const policies = options?.policies ?? [];
  const policy = policies.find(item => item.id === policyId);
  const members = policy?.members ?? [];
  async function save(event: FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const data = await api<{ claim: ClaimSummary }>(existing ? `${base}/${existing.id}` : base, {
        token, method: existing ? 'PATCH' : 'POST', ...(existing ? {} : { idempotencyKey: creationKey.current }), body: {
          ...(existing ? { expectedVersion: existing.version } : {}), policyId, memberId,
          claimType, reimbursement: claimType === 'reimbursement' ? reimbursement : null,
          treatmentDate: Number(date.replaceAll('-', '')), hospitalName: hospital,
          hospitalCity: city, admissionType: admission, reason, contactPhone,
        },
      });
      onSaved(data.claim.id);
    } catch (cause) { setError((cause as Error).message); if (cause instanceof ApiError && cause.status === 401) onError(cause); }
    finally { locked.current = false; setBusy(false); }
  }
  return <form className="claim-form" onSubmit={event => { void save(event); }} aria-label={claimType === 'reimbursement' ? 'Reimbursement draft' : 'Intimation draft'} aria-busy={optionsLoading || busy}>
    <h2>{existing ? 'Edit draft' : claimType === 'reimbursement' ? 'New reimbursement claim' : 'New intimation'}</h2>
    <p className="muted">Choose the cover and family member for the admission date.</p>
    {optionsLoading ? <p className="field-help" role="status">Loading eligible cover and family members…</p> : null}
    <fieldset disabled={busy}>
      {reimbursementEnabled && <label>Claim journey<select value={claimType} onChange={event => setClaimType(event.target.value as 'intimation' | 'reimbursement')}><option value="intimation">Hospital admission / cashless intimation</option><option value="reimbursement">Reimbursement for paid expenses</option></select></label>}
      <label>Admission date<input type="date" value={date} required onChange={event => { setDate(event.target.value); setPolicyId(''); setMemberId(''); setOptions(null); }} /></label>
      <label><span id="claim-policy-label">Policy</span><select aria-labelledby="claim-policy-label" disabled={optionsLoading || !options} value={policy?.id ?? ''} required onChange={event => { setPolicyId(event.target.value); setMemberId(''); }}><option value="">Select policy</option>{policies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {options && !policies.length ? <p className="field-help">No eligible cover on this date. Your P&amp;C team can help check the policy record.</p> : null}
      <label><span id="claim-member-label">Covered family member</span><select aria-labelledby="claim-member-label" disabled={optionsLoading || !options} value={members.some(item => (item.memberId ?? item.id) === memberId) ? memberId : ''} required onChange={event => setMemberId(event.target.value)}><option value="">Select member</option>{members.map(item => <option key={item.memberId ?? item.id} value={item.memberId ?? item.id}>{item.fullName} ({item.relation})</option>)}</select></label>
      <label>Hospital name<input value={hospital} minLength={2} maxLength={200} required onChange={event => setHospital(event.target.value)} /></label>
      <label>Hospital city<input value={city} minLength={2} maxLength={100} required onChange={event => setCity(event.target.value)} /></label>
      <label><span id="claim-admission-label">Admission type</span><select aria-labelledby="claim-admission-label" value={admission} onChange={event => setAdmission(event.target.value as 'planned' | 'emergency')}><option value="planned">Planned</option><option value="emergency">Emergency</option></select></label>
      <label className="claim-wide">Reason for admission<textarea value={reason} minLength={3} maxLength={2000} rows={4} required onChange={event => setReason(event.target.value)} /></label>
      {claimType === 'intimation' && options?.availability.mode === 'mediassist_uat' && <label>Contact phone<input type="tel" required pattern="\+?[0-9]{10,15}" value={contactPhone} onChange={event => setContactPhone(event.target.value)} /></label>}
      {claimType === 'reimbursement' && <ReimbursementFields value={reimbursement} onChange={setReimbursement} />}
    </fieldset>
    {error ? <div className="error-message" role="alert"><p>{error}</p>{!options ? <button type="button" className="text-button" disabled={busy} onClick={() => setOptionsRetry(value => value + 1)}>Retry cover options</button> : null}</div> : null}
    <div className="claim-toolbar"><button type="button" className="button button-secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={busy || !options || !policy || !memberId}>{busy ? 'Saving…' : 'Save draft'}</button></div>
  </form>;
}
