import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isClient = user?.roles?.includes('client');

  const handleSearch = () => {
    navigate('/servicos');
    setActiveSearchField(null);
  };

  const handleSearchFieldClick = (field) => {
    setActiveSearchField(field);
  };

  const professionalPath = user ? '/perfil/profissional' : '/cadastro';

  return (
    <nav className="bg-white border-b border-[#E5E7EB] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 min-h-20">

          {/* Logo */}
          <Link to="/" className="text-xl font-bold tracking-tight text-[#7C3AED] flex-shrink-0">
            domus<span className="text-[#111827]">.</span>
          </Link>

          {/* Search */}
          <div className="hidden md:flex items-center flex-1 max-w-xl mx-auto">
            <div className="flex items-center w-full h-14 rounded-full border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow bg-white">
              <button type="button" onClick={() => handleSearchFieldClick('location')} aria-pressed={activeSearchField === 'location'} className={`flex-1 min-w-0 px-5 text-left rounded-l-full transition-colors ${activeSearchField === 'location' ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]'}`}>
                <span className="block text-[11px] font-semibold text-[#111827]">Qualquer lugar</span>
                <span className="block text-xs text-[#6B7280] mt-0.5 truncate">Onde você precisa?</span>
              </button>
              <span className="h-8 border-l border-[#E5E7EB]" aria-hidden="true" />
              <button type="button" onClick={() => handleSearchFieldClick('date')} aria-pressed={activeSearchField === 'date'} className={`flex-1 min-w-0 px-5 text-left transition-colors ${activeSearchField === 'date' ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]'}`}>
                <span className="block text-[11px] font-semibold text-[#111827]">Qualquer dia</span>
                <span className="block text-xs text-[#6B7280] mt-0.5 truncate">Escolha uma data</span>
              </button>
              <span className="h-8 border-l border-[#E5E7EB]" aria-hidden="true" />
              <button type="button" onClick={() => handleSearchFieldClick('service')} aria-pressed={activeSearchField === 'service'} className={`flex-1 min-w-0 px-5 text-left transition-colors ${activeSearchField === 'service' ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]'}`}>
                <span className="block text-[11px] font-semibold text-[#111827]">Tipo de serviço</span>
                <span className="block text-xs text-[#6B7280] mt-0.5 truncate">O que você procura?</span>
              </button>
              <button type="button" onClick={handleSearch} aria-label="Pesquisar serviços" className="flex-shrink-0 w-10 h-10 mr-2 rounded-full bg-[#7C3AED] text-white flex items-center justify-center hover:bg-[#6D28D9] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
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
            <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu" aria-expanded={menuOpen} className="w-10 h-10 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#374151] hover:shadow-sm transition-shadow">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            className="md:hidden w-10 h-10 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
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

        <div className="md:hidden pb-3">
          <div className="flex items-center h-11 rounded-full border border-[#E5E7EB] shadow-sm pl-4 pr-1 bg-white">
            <button type="button" onClick={() => handleSearchFieldClick('service')} className="flex-1 min-w-0 text-left text-sm text-[#6B7280] truncate">
              Qualquer lugar · Qualquer dia · Tipo de serviço
            </button>
            <button type="button" onClick={handleSearch} aria-label="Pesquisar serviços" className="w-9 h-9 rounded-full bg-[#7C3AED] text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
              </svg>
            </button>
          </div>
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
                  Meu perfil
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