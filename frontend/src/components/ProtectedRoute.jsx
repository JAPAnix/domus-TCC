import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { PRO_START_PATH } from '../utils/routes';
import { Button, EmptyState } from './ui';

const ProtectedRoute = ({ children, roles }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    if (location.pathname === PRO_START_PATH) return <Navigate to="/cadastro?tipo=profissional" replace />;
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles && !roles.some((role) => user.roles?.includes(role))) {
    const needsProfessional = roles.includes('professional');
    return (
      <main className="mx-auto max-w-form px-4 py-12">
        <EmptyState
          icon="alert"
          title={needsProfessional ? 'Esta área é para profissionais' : 'Você não tem acesso a esta página'}
          description={needsProfessional ? 'Publique o seu primeiro serviço para receber pedidos e usar o painel.' : 'Sua conta não tem permissão para abrir este conteúdo.'}
          action={needsProfessional ? <Button to={PRO_START_PATH}>Começar a oferecer serviços</Button> : <Button to="/">Voltar ao início</Button>}
        />
      </main>
    );
  }

  return children;
};

export default ProtectedRoute;
