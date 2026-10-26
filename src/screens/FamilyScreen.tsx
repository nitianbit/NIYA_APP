import { UsersRound } from 'lucide-react';
import { Detail, Empty, initials, PageHeading } from '../components/ui';
import { dateLabel } from '../lib/api';
import { useSession } from '../lib/session';

export default function FamilyScreen() {
  const { overview } = useSession();
  if (!overview) return null;
  const self = { ...overview.profile, relation: 'Self' };
  return <>
    <PageHeading title="Your family" description="The people on your company roster." back />
    <p className="info-note">This is your family roster. <a href="#/cover">Your cover</a> shows who is covered by each policy.</p>
    <div className="family-list">{[self, ...overview.family].map((member, index) => <section className="member-card" key={member.id ?? index}>
      <div className="member-heading"><span className={`avatar ${index === 0 ? 'avatar-peach' : ''}`} aria-hidden="true">{initials(member.fullName)}</span><div><h2>{member.fullName}</h2><p>{member.relation || 'Relation not on file'}</p></div></div>
      <dl className="member-details"><Detail label="Date of birth" value={dateLabel(member.dateOfBirth)} /><Detail label="Gender" value={member.gender} /></dl>
    </section>)}</div>
    {!overview.family.length ? <Empty title="No dependents on your roster">Your P&amp;C team can help if an eligible family member is missing.</Empty> : null}
    <aside className="support-note"><UsersRound size={23} aria-hidden="true" /><div><strong>Keep your family details up to date</strong><p>Contact your P&amp;C team to request a correction.</p></div></aside>
  </>;
}
