import { NavLink, Outlet, useLocation, useNavigate, useMatch } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { settingsSections } from './settingsSections';

export default function SettingsLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const identityPage = useMatch('/configuracoes/pessoais/verificacao-identidade');
  const isProfessional = !!user?.roles?.includes('professional');
  const sections = settingsSections.filter((section) => !section.professional || isProfessional);
  const selectedSection = sections.find(({ path }) => (pathname === `/configuracoes/${path}` || pathname.startsWith(`/configuracoes/${path}/`)));

  if (identityPage) return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12"><Outlet /></main>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-8 sm:mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Configurações da conta</h1>
        <p className="mt-2 text-sm text-ink-muted sm:text-base">Seu espaço para cuidar da sua conta Dommos.</p>
      </header>

      <div className="mb-6 md:hidden">
        <label htmlFor="settings-section" className="mb-2 block text-sm font-medium text-ink-soft">Seção da conta</label>
        <select
          id="settings-section"
          value={selectedSection?.path ?? 'pessoais'}
          onChange={(event) => navigate(`/configuracoes/${event.target.value}`)}
          className="min-h-control w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink"
        >
          {sections.map(({ path, title }) => <option key={path} value={path}>{title}</option>)}
        </select>
      </div>

      <div className="grid items-start gap-8 md:grid-cols-[250px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Configurações da conta" className="hidden border-r border-line pr-5 md:block lg:pr-7">
          <ul className="space-y-2">
            {sections.map(({ path, title, icon }) => (
              <li key={path}>
                <NavLink
                  to={`/configuracoes/${path}`}
                  className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-control px-3 py-3 text-sm transition-colors ${isActive ? 'bg-primary-softer font-semibold text-primary-strong' : 'text-ink-soft hover:bg-primary-softer hover:text-primary-hover'}`}
                >
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
                  {title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="settings-page-title" className="min-w-0 rounded-card border border-line bg-surface p-5 shadow-card sm:p-8 lg:p-10">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
