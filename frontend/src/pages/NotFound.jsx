import { Link, useRouteError } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-form px-4 py-16">
      <EmptyState
        as="h1"
        icon="compass"
        title="Página não encontrada"
        description="O endereço pode ter mudado ou não existir mais."
        action={<><Button to="/">Ir para o início</Button><Button to="/buscar" variant="secondary">Buscar profissionais</Button></>}
      />
    </main>
  );
}

/** Tela de falha inesperada. Fica fora dos provedores, por isso usa só links simples. */
export function RouteError() {
  const error = useRouteError();
  console.error(error);
  return (
    <main className="mx-auto max-w-form px-4 py-16">
      <EmptyState
        as="h1"
        icon="alert"
        title="Algo deu errado nesta página"
        description="Recarregue a página. Se o problema continuar, volte ao início e tente novamente."
        action={<Link to="/" reloadDocument className="font-semibold text-primary-strong underline">Voltar ao início</Link>}
      />
    </main>
  );
}
