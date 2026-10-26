import { CalendarDays, ShieldCheck, UserRound } from 'lucide-react';
import { Empty, PageHeading } from '../components/ui';
import { dateLabel, rupees } from '../lib/api';
import { useSession } from '../lib/session';

export default function CoverScreen() {
  const { overview } = useSession();
  const covers = overview?.covers ?? [];
  return <>
    <PageHeading title="Your cover" description="Your current policies and the people covered by each one." />
    {covers.length ? <div className="cover-list">{covers.map((cover) => {
      const hasLimit = cover.parentCoverLimit !== null && cover.parentCoverLimit > 0 && cover.parentCoverLimit < cover.sumInsured;
      return <section className="policy-card" key={cover.id} aria-labelledby={`cover-${cover.id}`}>
        <div className="policy-heading"><span className="policy-icon" aria-hidden="true"><ShieldCheck size={24} /></span><div><p className="eyebrow">{cover.type === 'topup' ? 'Top-up cover' : 'Base cover'}</p><h2 id={`cover-${cover.id}`}>{cover.name}</h2></div></div>
        <div className="policy-amount"><span>Shared family sum insured</span><strong>{rupees(cover.sumInsured)}</strong><p>One amount shared by all covered members, rather than a separate amount for each person.</p></div>
        {hasLimit ? <div className="limit-note"><strong>Lower limit for parents or in-laws: {rupees(cover.parentCoverLimit!)}</strong><p>Covered parents or in-laws share this limit together within the family sum insured above. It is not extra cover or an amount per parent.</p></div> : null}
        <p className="policy-period"><CalendarDays size={16} aria-hidden="true" /><span>{dateLabel(cover.periodStart)} – {dateLabel(cover.periodEnd)}</span></p>
        <div className="policy-members"><h3>Covered members <span className="count-badge">{cover.members.length}</span></h3>
          {cover.members.length ? <ul>{cover.members.map((member, index) => <li key={member.memberId ?? member.id ?? index}><span className="member-icon" aria-hidden="true"><UserRound size={18} /></span><div><strong>{member.fullName}</strong><span>{member.relation || 'Relation not on file'}</span></div></li>)}</ul> : <p className="muted">No members currently covered.</p>}
        </div>
      </section>;
    })}</div> : <Empty title="No current cover to show">If your policy has started, please ask your P&amp;C team to check your enrolment.</Empty>}
    <p className="page-note">Cover and member details reflect completed policy changes. Contact your P&amp;C team for corrections.</p>
  </>;
}
