import type { ReactNode } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export function Brand() {
  return <span className="brand"><span className="brand-mark" aria-hidden="true"><ShieldCheck size={24} strokeWidth={1.8} /></span><span>NIYA</span></span>;
}

export function PageHeading({ title, description, back }: {
  title: string; description?: string; back?: boolean;
}) {
  return <div className="page-heading">
    {back ? <a className="back-link" href="#/home">← Home</a> : null}
    <h1 id="page-title" tabIndex={-1}>{title}</h1>
    {description ? <p>{description}</p> : null}
  </div>;
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <section className="empty-state"><ShieldCheck size={30} aria-hidden="true" /><h2>{title}</h2><p>{children}</p></section>;
}

export function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div className="detail"><dt>{label}</dt><dd>{value?.trim() || 'Not on file'}</dd></div>;
}

export function RouteLink({ href, children, className = '' }: {
  href: string; children: ReactNode; className?: string;
}) {
  return <a className={`route-link ${className}`} href={href}>{children}<ArrowRight size={19} aria-hidden="true" /></a>;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'N';
}
