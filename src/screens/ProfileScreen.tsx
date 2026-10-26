import { LogOut, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Detail, initials, PageHeading, RouteLink } from '../components/ui';
import { dateLabel } from '../lib/api';
import { useSession } from '../lib/session';

export default function ProfileScreen() {
  const { overview, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!overview) return null;
  const { profile } = overview;

  async function leave() {
    setBusy(true); setError('');
    try { await signOut(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title="Your profile" description="Your employee and contact details." />
    <section className="profile-card"><span className="avatar avatar-profile" aria-hidden="true">{initials(profile.fullName)}</span><h2>{profile.fullName}</h2><p>{profile.corporateName || 'Company not on file'}</p><span className="employee-id">Employee ID · {profile.employeeCode || 'Not on file'}</span></section>
    <section className="details-card" aria-label="Employee details"><dl>
      <Detail label="Email ID" value={profile.email} />
      <Detail label="Mobile number" value={profile.phone} />
      <Detail label="Date of birth" value={dateLabel(profile.dateOfBirth)} />
      <Detail label="Gender" value={profile.gender} />
      <Detail label="Department" value={profile.department} />
      <Detail label="Date of joining" value={dateLabel(profile.dateOfJoining)} />
    </dl></section>
    <div className="profile-family-link"><UsersRound size={21} aria-hidden="true" /><RouteLink href="#/family">Your family</RouteLink></div>
    <p className="page-note">To correct your roster details, contact your P&amp;C team.</p>
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    <button className="button button-secondary signout-button" disabled={busy} onClick={() => { void leave(); }}><LogOut size={18} aria-hidden="true" />{busy ? 'Signing out…' : 'Sign out'}</button>
  </>;
}
