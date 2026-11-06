import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Spinner } from '../components/ui';

// "/sair?para=/" encerra a sessão e vai para o caminho indicado (só caminhos internos). Sem "para", vai ao login.
function safeDestination(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/login';
}

export default function Logout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const destination = safeDestination(params.get('para'));
  useEffect(() => {
    logout();
    navigate(destination, { replace: true });
  }, [logout, navigate, destination]);
  return <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted"><Spinner />Saindo...</p>;
}
