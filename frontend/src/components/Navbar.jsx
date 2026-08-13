import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isClient = user?.roles?.includes('client');
  const isProfessional = user?.roles?.includes('professional');

  return (
    <nav className="bg-white border-b border-[#E5E7EB] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="text-xl font-bold text-[#7C3AED]">
            domus
          </Link>

          {/* Desktop menu */}
          <div className="hidden sm:flex items-center gap-6">
            <Link to="/servicos" className="text-sm text-[#6B7280] hover:text-[#7C3AED] transition-colors">
              Serviços
            </Link> 

            {isClient && (
              <>
                <Link to="/servicos/novo" className="text-sm text-[#6B7280] hover:text-[#7C3AED] transition-colors">
                  Publicar serviço
                </Link>
                <Link to="/meus-servicos" className="text-sm text-[#6B7280] hover:text-[#7C3AED] transition-colors">
                  Meus serviços
                </Link>
              </>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/perfil" className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#7C3AED] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] font-bold text-xs">
                    {user.firstName?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  {user.firstName}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm border border-[#E5E7EB] text-[#6B7280] hover:border-[#7C3AED] hover:text-[#7C3AED] rounded-lg px-3 py-1.5 transition-colors"
                >
                  Sair
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm text-[#6B7280] hover:text-[#7C3AED] transition-colors">
                  Entrar
                </Link>
                <Link to="/cadastro" className="text-sm bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-lg px-4 py-1.5 transition-colors">
                  Cadastrar
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-2 rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
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
          <div className="sm:hidden border-t border-[#E5E7EB] py-4 space-y-3">
            <Link to="/servicos" onClick={() => setMenuOpen(false)} className="block text-sm text-[#6B7280] hover:text-[#7C3AED] py-1">
              Serviços
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