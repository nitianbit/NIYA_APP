import { ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { Empty, initials, RouteLink } from '../components/ui';
import { dateLabel, rupees } from '../lib/api';
import { useSession } from '../lib/session';

export default function HomeScreen() {
  const { overview } = useSession();
  if (!overview) return null;
  const { profile, covers, family } = overview;
  const primary = covers.find((cover) => cover.type !== 'topup') ?? covers[0];
  const firstName = profile.fullName.trim().split(/\s+/)[0];
  return <>
    <div className="welcome-row">
      <div><p className="eyebrow">{profile.corporateName || 'Your health cover'}</p><h1 id="page-title" tabIndex={-1}>{firstName ? `Hi, ${firstName}` : 'Welcome back'}</h1><p className="muted">A little clarity for your everyday peace of mind.</p></div>
      <a className="avatar avatar-large" href="#/profile" aria-label="View your profile">{initials(profile.fullName)}</a>
    </div>
    {primary ? <section className="home-cover" aria-labelledby="home-cover-title">
      <div className="cover-top"><span className="eyebrow">{primary.type === 'topup' ? 'Top-up cover' : 'Base cover'}</span><span className="cover-symbol" aria-hidden="true"><ShieldCheck size={27} strokeWidth={1.7} /></span></div>
      <h2 id="home-cover-title">{primary.name}</h2>
      <p className="home-cover-amount">{rupees(primary.sumInsured)}</p>
      <p className="floater-label">Shared family cover</p>
      {primary.parentCoverLimit !== null && primary.parentCoverLimit > 0 && primary.parentCoverLimit < primary.sumInsured ? <p className="home-limit">Parents or in-laws share a lower limit of {rupees(primary.parentCoverLimit)} within this cover.</p> : null}
      <p className="cover-period">{dateLabel(primary.periodStart)} – {dateLabel(primary.periodEnd)}</p>
      <div className="home-cover-bottom"><span>{primary.members.length} covered {primary.members.length === 1 ? 'member' : 'members'}</span><RouteLink href="#/cover">View cover</RouteLink></div>
    </section> : <Empty title="No current cover to show">Your P&amp;C team can help if you expected a policy here.</Empty>}
    {overview.claims?.enabled ? <section className="plain-section"><h2>Claims</h2><p className="muted">Tell us about a hospital admission and see your family’s intimation history.</p><RouteLink href="#/claims">View claims</RouteLink></section> : null}
    <div className="home-shortcuts">
      <a className="shortcut shortcut-sky" href="#/family"><UsersRound aria-hidden="true" size={25} /><h2>Your family</h2><p>{family.length} {family.length === 1 ? 'dependent' : 'dependents'} on your roster</p><span>View family <span aria-hidden="true">→</span></span></a>
      <a className="shortcut shortcut-peach" href="#/profile"><UserRound aria-hidden="true" size={25} /><h2>Your profile</h2><p>Your contact and employee details</p><span>View profile <span aria-hidden="true">→</span></span></a>
    </div>
    {covers.length > 1 ? <section className="plain-section"><h2>Your policies</h2><p className="muted">You have {covers.length} current covers. Each policy has its own shared family sum insured.</p><RouteLink href="#/cover">See all covers</RouteLink></section> : null}
    <aside className="support-note"><ShieldCheck size={22} aria-hidden="true" /><div><strong>Need a detail corrected?</strong><p>Your P&amp;C team can help with your profile, family and cover.</p></div></aside>
  </>;
}
