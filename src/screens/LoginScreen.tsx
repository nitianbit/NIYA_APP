import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle, LockKeyhole } from 'lucide-react';
import { Brand } from '../components/ui';
import { useSession } from '../lib/session';

export default function LoginScreen() {
  const { requestCode, verifyCode, error: sessionError } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'identifier' | 'code'>('identifier');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [lastRequestedIdentifier, setLastRequestedIdentifier] = useState('');
  const [clock, setClock] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);
  const identifierInput = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef(false);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  const shownError = error || sessionError;

  useEffect(() => {
    if (!resendAt) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);
  useEffect(() => { if (step === 'code') codeInput.current?.focus(); }, [step]);

  async function request() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      if (identifier.trim().toLowerCase() === lastRequestedIdentifier && Date.now() < resendAt) {
        setStep('code');
        setNotice('Use the code already requested for this email or number.');
        return;
      }
      const cooldown = await requestCode(identifier.trim());
      setResendAt(Date.now() + cooldown * 1000);
      setLastRequestedIdentifier(identifier.trim().toLowerCase());
      setClock(Date.now()); setCode(''); setStep('code');
      setNotice('If your details match an active employee record, a code is on its way.');
    } catch (cause) { setError((cause as Error).message); }
    finally { requestInFlight.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 'identifier') { await request(); return; }
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true); setError('');
    try { await verifyCode(identifier.trim(), code.trim()); }
    catch (cause) { setError((cause as Error).message); }
    finally { requestInFlight.current = false; setBusy(false); }
  }

  function changeDetails() {
    setStep('identifier'); setCode(''); setError(''); setNotice('');
    window.setTimeout(() => identifierInput.current?.focus(), 0);
  }

  return <main className="login-page">
    <div className="login-content">
      <a href="#/home" className="login-brand" aria-label="NIYA home"><Brand /></a>
      <section className="login-panel" aria-labelledby="login-title">
        <span className="login-icon" aria-hidden="true"><LockKeyhole size={25} /></span>
        <h1 id="login-title">{step === 'identifier' ? 'Your cover. Your family.' : 'Check your email or phone'}</h1>
        <p className="login-intro">{step === 'identifier'
          ? 'Sign in to see your health cover and family details, all in one place.'
          : 'Enter the verification code to securely open your account.'}</p>
        <form onSubmit={(event) => { void submit(event); }} aria-busy={busy}>
          <label htmlFor="identifier">Email or mobile number</label>
          <input id="identifier" ref={identifierInput} name="username" value={identifier}
            onChange={(event) => { setIdentifier(event.target.value); setError(''); }}
            autoComplete="username" autoCapitalize="none" spellCheck={false}
            readOnly={step === 'code'} disabled={busy} required
            placeholder="Your work email or mobile number"
            aria-describedby="roster-help" />
          <p className="field-help" id="roster-help">Use the contact details on your company roster.</p>
          {step === 'code' ? <div className="code-field">
            <label htmlFor="verification-code">Verification code</label>
            <input id="verification-code" ref={codeInput} name="one-time-code" value={code}
              onChange={(event) => { setCode(event.target.value.replace(/\D/g, '')); setError(''); }}
              inputMode="numeric" autoComplete="one-time-code" maxLength={10} required disabled={busy}
              placeholder="Enter code" aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
          </div> : null}
          {notice ? <p className="notice" role="status">{notice}</p> : null}
          {shownError ? <p className="error-message" role="alert" id="login-error">{shownError}</p> : null}
          <button className="button button-primary login-submit" type="submit"
            disabled={busy || (step === 'identifier' ? !identifier.trim() : !code.trim())}>
            {busy ? <LoaderCircle className="spin" size={19} aria-hidden="true" /> : null}
            {busy ? (step === 'identifier' ? 'Requesting code…' : 'Signing in…') : (step === 'identifier' ? 'Send verification code' : 'Sign in')}
            {!busy ? <ArrowRight size={18} aria-hidden="true" /> : null}
          </button>
          {step === 'code' ? <div className="login-actions">
            <button className="text-button" type="button" disabled={busy} onClick={changeDetails}><ArrowLeft size={16} aria-hidden="true" />Change details</button>
            <button className="text-button" type="button" disabled={busy || secondsLeft > 0}
              onClick={() => { void request(); }}>{secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}</button>
          </div> : null}
        </form>
      </section>
      <p className="login-help">Need to update your email or mobile number?<br />Please contact your P&amp;C team.</p>
    </div>
  </main>;
}
