import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';

export default function Navbar({ simplified = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    navigate('/sair');
  };

  const isProfessional = user?.roles?.includes('professional');
  const isClient = user?.roles?.includes('client');

  const professionalPath = user ? '/perfil/profissional' : '/cadastro?tipo=profissional';

  if (simplified) return (
    <header className="border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/configuracoes/pessoais" aria-label="Voltar às informações pessoais" className="inline-flex rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7C3AED]"><BrandLogo /></Link>
      </div>
    </header>
  );

  return (
    <nav className="bg-white border-b border-[#E5E7EB] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-4 py-4 md:flex-nowrap md:gap-6">

          {/* Logo */}
          <Link to="/" aria-label="Página inicial" className="flex-shrink-0">
            <BrandLogo />
          </Link>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0 ml-auto">
            <Link to={professionalPath} className="text-sm font-medium text-[#374151] hover:text-[#7C3AED] transition-colors whitespace-nowrap">
              Ofereça seus serviços
            </Link>
            {user ? (
              <div className="flex items-center gap-2">
                <Link to="/perfil" aria-label="Abrir perfil" className="w-9 h-9 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] font-bold text-xs hover:ring-2 hover:ring-[#C4B5FD] transition-all">
                  {user.firstName?.[0]?.toUpperCase() ?? '?'}
                </Link>
                <button onClick={handleLogout} className="text-xs text-[#6B7280] hover:text-[#7C3AED] transition-colors" type="button">
                  Sair
                </button>
              </div>
            ) : (
              <Link to="/login" className="text-sm font-medium text-[#374151] hover:text-[#7C3AED] transition-colors whitespace-nowrap">
                Entrar
              </Link>
            )}
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu" aria-expanded={menuOpen} className="w-10 h-10 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#374151] hover:shadow-sm transition-shadow">
                {menuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18 18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-60 rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_16px_45px_rgba(17,24,39,0.16)]">
                  <Link to="/servicos" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-[#374151] transition-colors hover:bg-[#F5F3FF] hover:text-[#7C3AED]">Serviços</Link>
                  <Link to={professionalPath} onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-[#374151] transition-colors hover:bg-[#F5F3FF] hover:text-[#7C3AED]">Ofereça seus serviços</Link>
                  {isProfessional && <Link to="/painel-profissional" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50">Meu painel profissional</Link>}
                  {isClient && (
                    <>
                      <Link to="/servicos/novo" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-[#374151] transition-colors hover:bg-[#F5F3FF] hover:text-[#7C3AED]">Publicar serviço</Link>
                      <Link to="/meus-servicos" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-[#374151] transition-colors hover:bg-[#F5F3FF] hover:text-[#7C3AED]">Meus serviços</Link>
                    </>
                  )}
                  <div className="my-1 border-t border-[#E5E7EB]" />
                  {user ? (
                    <>
                      <Link to="/perfil" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-[#374151] transition-colors hover:bg-[#F5F3FF] hover:text-[#7C3AED]">Perfil</Link>
                      <Link to="/configuracoes" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-[#374151] transition-colors hover:bg-[#F5F3FF] hover:text-[#7C3AED]">Configurações da conta</Link>
                      <button type="button" onClick={() => { handleLogout(); setMenuOpen(false); }} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-red-500 transition-colors hover:bg-red-50">Sair</button>
                    </>
                  ) : (
                    <>
                      <Link to="/login" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-[#374151] transition-colors hover:bg-[#F5F3FF] hover:text-[#7C3AED]">Entrar</Link>
                      <Link to="/cadastro" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-[#7C3AED] transition-colors hover:bg-[#F5F3FF]">Cadastrar</Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            className="md:hidden w-10 h-10 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] transition-colors ml-auto"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-[#E5E7EB] py-4 space-y-3">
            <Link to="/servicos" onClick={() => setMenuOpen(false)} className="block text-sm text-[#6B7280] hover:text-[#7C3AED] py-1">
              Serviços
            </Link>

            <Link to={professionalPath} onClick={() => setMenuOpen(false)} className="block text-sm text-[#6B7280] hover:text-[#7C3AED] py-1">
              Ofereça seus serviços
            </Link>

            {isProfessional && <Link to="/painel-profissional" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50">Meu painel profissional</Link>}
                  {isClient && (
              <>
                <Link to="/servicos/novo" onClick={() => setMenuOpen(false)} className="block text-sm text-[#6B7280] hover:text-[#7C3AED] py-1">
                  Publicar serviço
                </Link>
                <Link to="/meus-servicos" onClick={() => setMenuOpen(false)} className="block text-sm text-[#6B7280] hover:text-[#7C3AED] py-1">
                  Meus serviços
                </Link>
              </>
            )}

            {user ? (
              <>
                <Link to="/perfil" onClick={() => setMenuOpen(false)} className="block text-sm text-[#6B7280] hover:text-[#7C3AED] py-1">
                  Perfil
                </Link>
                <Link to="/configuracoes" onClick={() => setMenuOpen(false)} className="block text-sm text-[#6B7280] hover:text-[#7C3AED] py-1">
                  Configurações da conta
                </Link>
                {!user.hasProfessionalProfile && (
                  <Link to="/perfil/profissional" onClick={() => setMenuOpen(false)} className="block text-sm text-[#6B7280] hover:text-[#7C3AED] py-1">
                    Criar perfil profissional
                  </Link>
                )}
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false); }}
                  className="block text-sm text-red-500 hover:text-red-600 py-1"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-sm text-[#6B7280] hover:text-[#7C3AED] py-1">
                  Entrar
                </Link>
                <Link to="/cadastro" onClick={() => setMenuOpen(false)} className="block text-sm text-[#7C3AED] font-semibold py-1">
                  Cadastrar
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
