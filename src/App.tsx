import { useEffect, useState } from 'react';
import { Home, LoaderCircle, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { Brand } from './components/ui';
import { SessionProvider, useSession } from './lib/session';
import ClaimsScreen from './screens/ClaimsScreen';
import CoverScreen from './screens/CoverScreen';
import FamilyScreen from './screens/FamilyScreen';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import './styles.css';

type Route = 'home' | 'cover' | 'family' | 'profile' | 'claims';
const routes: Route[] = ['home', 'cover', 'family', 'profile', 'claims'];
function readRoute(): Route {
  const route = window.location.hash.replace(/^#\/?/, '');
  return routes.includes(route as Route) ? route as Route : 'home';
}

function EmployeeApp() {
  const { token, overview, loading, error, refresh, signOut } = useSession();
  const [route, setRoute] = useState<Route>(readRoute);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState('');
  const hasOverview = Boolean(overview);

  useEffect(() => {
    const change = () => setRoute(readRoute());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (!token || !hasOverview) return;
    window.scrollTo({ top: 0 });
    document.getElementById('page-title')?.focus({ preventScroll: true });
  }, [route, token, hasOverview]);

  async function reload() {
    if (refreshing) return;
    setRefreshing(true); setActionError('');
    try { await refresh(); }
    catch (cause) { setActionError((cause as Error).message); }
    finally { setRefreshing(false); }
  }

  if (loading) return <main className="loading-page" role="status"><Brand /><LoaderCircle size={24} className="spin" aria-hidden="true" /><span>Opening your NIYA account…</span></main>;
  if (!token) return <LoginScreen />;

  const message = error || actionError;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <header className="app-header"><a href="#/home" aria-label="NIYA home"><Brand /></a><button className="icon-button" aria-label="Refresh your details" title="Refresh your details" disabled={refreshing} onClick={() => { void reload(); }}><RefreshCw className={refreshing ? 'spin' : ''} size={20} aria-hidden="true" /></button></header>
    <main className="app-main" id="main-content" tabIndex={-1}>
      {message ? <div className="load-error" role="alert"><p>{message}</p><button className="text-button" disabled={refreshing} onClick={() => { void reload(); }}>{refreshing ? 'Retrying…' : 'Try again'}</button></div> : null}
      {!overview ? <section className="empty-state"><h1 id="page-title">Unable to load your details</h1><p>Check your connection and try again.</p><button className="button button-primary" disabled={refreshing} onClick={() => { void reload(); }}>{refreshing ? 'Loading…' : 'Try again'}</button><button className="text-button" onClick={() => { void signOut().catch((cause: Error) => setActionError(cause.message)); }}>Sign out</button></section>
        : route === 'claims' ? <ClaimsScreen /> : route === 'cover' ? <CoverScreen /> : route === 'family' ? <FamilyScreen /> : route === 'profile' ? <ProfileScreen /> : <HomeScreen />}
    </main>
    {overview ? <nav className="bottom-nav" aria-label="Main navigation"><div>
      <a href="#/home" aria-current={route === 'home' ? 'page' : undefined}><Home size={22} aria-hidden="true" /><span>Home</span></a>
      <a href="#/cover" aria-current={route === 'cover' ? 'page' : undefined}><ShieldCheck size={22} aria-hidden="true" /><span>Cover</span></a>
      <a href="#/profile" aria-current={route === 'profile' || route === 'family' ? 'page' : undefined}><UserRound size={22} aria-hidden="true" /><span>Profile</span></a>
    </div></nav> : null}
  </div>;
}

export default function App() {
  return <SessionProvider><EmployeeApp /></SessionProvider>;
}
