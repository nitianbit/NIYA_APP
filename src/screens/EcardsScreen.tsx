import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CreditCard, ExternalLink, FileDown } from 'lucide-react';
import { Empty, PageHeading } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { ecardGeneration, openEcardFile, validEcardLink, type Ecard } from '../lib/ecards';

export default function EcardsScreen() {
  const { token } = useSession();
  const [cards, setCards] = useState<Ecard[] | null>(null);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(false);
  const locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let active = true;
    void api<{ cards: Ecard[] }>('/api/employee/app/ecards', { token: token! })
      .then(result => { if (active) { setCards(result.cards); setError(''); } })
      .catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [token, retry]);
  async function open(card: Ecard) {
    if (locked.current) return;
    locked.current = true; setBusy(card.id); setFileError(null);
    const version = ecardGeneration();
    try {
      const blob = await api<Blob>(`/api/employee/app/ecards/${card.id}/file`, { token: token!, response: 'blob' });
      await openEcardFile(blob, version, () => mounted.current);
    } catch (cause) { if (mounted.current) setFileError({ id: card.id, message: (cause as Error).message }); }
    finally { locked.current = false; if (mounted.current) setBusy(null); }
  }
  return <>
    <PageHeading title="Your e-cards" description="Keep your health cards close at hand." back />
    {error ? <div className="load-error" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
      : !cards ? <p role="status">Loading your e-cards…</p>
        : !cards.length ? <Empty title="No e-cards yet">Your NIYA support team can add a card, even if you have not enrolled through NIYA.</Empty>
          : <div className="ecard-list">{cards.map(card => <section className="ecard-row" key={card.id}>
            <CreditCard size={26} aria-hidden="true" /><div><h2>{card.title}</h2><p className="muted">{card.source === 'link' ? 'Opens the insurer or TPA website' : card.contentType === 'application/pdf' ? 'PDF document' : 'Image file'}</p>
              {card.source === 'link' ? validEcardLink(card.url) ? <a className="route-link" href={card.url!} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open e-card <ExternalLink size={17} aria-hidden="true" /></a> : <p role="alert">This link is unavailable. Contact NIYA support.</p>
                : <button className="text-button ecard-open" disabled={busy !== null} onClick={() => { void open(card); }}><FileDown size={18} aria-hidden="true" />{busy === card.id ? 'Opening…' : Capacitor.isNativePlatform() ? 'Open e-card' : 'Download e-card'}</button>}
              {fileError?.id === card.id ? <p className="field-error" role="alert">{fileError.message}</p> : null}
            </div>
          </section>)}</div>}
    <p className="info-note">An e-card helps identify you to the insurer or TPA. Your policy terms determine cover. Need a card corrected? Contact NIYA support.</p>
  </>;
}
