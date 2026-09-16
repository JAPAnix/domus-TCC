import { NavLink, Outlet } from 'react-router-dom';

const sections = [
  { path: 'sobre', label: 'Sobre mim', icon: 'M20 21v-2a8 8 0 0 0-16 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8' },
  { path: 'avaliacoes', label: 'Avaliações', icon: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z' },
  { path: 'resumo-profissional', label: 'Perfil profissional', icon: 'M3 7h18v14H3V7ZM8 7V3h8v4M3 12a20 20 0 0 0 18 0M12 11v4' },
];

export default function Profile() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-[#111827]">Perfil</h1>
      <div className="grid items-start gap-8 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Seções do perfil" className="min-w-0 border-b border-[#E5E7EB] pb-4 md:border-r md:border-b-0 md:pr-6 md:pb-0">
          <ul className="flex gap-2 overflow-x-auto p-1 md:flex-col">
            {sections.map(({ path, label, icon }) => (
              <li key={path} className="shrink-0">
                <NavLink to={`/perfil/${path}`} end className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] ${isActive ? 'bg-[#F5F3FF] font-semibold text-[#5B21B6]' : 'text-[#374151] hover:bg-[#F5F3FF] hover:text-[#6D28D9]'}`}>
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="profile-section-title" className="min-w-0"><Outlet /></section>
      </div>
    </main>
  );
}
