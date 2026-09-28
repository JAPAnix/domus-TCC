import { NavLink, Outlet, useLocation, useNavigate, useMatch } from 'react-router-dom';
import { settingsSections } from './settingsSections';

export default function SettingsLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const identityPage = useMatch('/configuracoes/pessoais/verificacao-identidade');
  const selectedSection = settingsSections.find(({ path }) => (pathname === `/configuracoes/${path}` || pathname.startsWith(`/configuracoes/${path}/`)));

  if (identityPage) return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12"><Outlet /></main>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-8 sm:mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">Configurações da conta</h1>
        <p className="mt-2 text-sm text-[#6B7280] sm:text-base">Seu espaço para cuidar da sua conta DOMMOS.</p>
      </header>

      <div className="mb-6 md:hidden">
        <label htmlFor="settings-section" className="mb-2 block text-sm font-medium text-[#374151]">Seção da conta</label>
        <select
          id="settings-section"
          value={selectedSection?.path ?? 'pessoais'}
          onChange={(event) => navigate(`/configuracoes/${event.target.value}`)}
          className="min-h-12 w-full rounded-xl border border-[#C4B5FD] bg-white px-3 text-sm text-[#5B21B6] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
        >
          <optgroup label="Sua conta">
            {settingsSections.filter((section) => !section.professional).map(({ path, title }) => <option key={path} value={path}>{title}</option>)}
          </optgroup>
          <optgroup label="Área profissional">
            {settingsSections.filter((section) => section.professional).map(({ path, title }) => <option key={path} value={path}>{title}</option>)}
          </optgroup>
        </select>
      </div>

      <div className="grid items-start gap-8 md:grid-cols-[250px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Configurações da conta" className="hidden border-r border-[#E5E7EB] pr-5 md:block lg:pr-7">
          <ul className="space-y-2">
            {settingsSections.map(({ path, title, icon, professional }) => (
              <li key={path} className={professional ? 'mt-6 border-t border-[#E5E7EB] pt-6' : undefined}>
                <NavLink
                  to={`/configuracoes/${path}`}
                  className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] ${isActive ? 'bg-[#F5F3FF] font-semibold text-[#5B21B6]' : 'text-[#374151] hover:bg-[#F5F3FF] hover:text-[#6D28D9]'}`}
                >
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
                  {title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="settings-page-title" className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-8 lg:p-10">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
