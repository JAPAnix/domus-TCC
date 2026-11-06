import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { apiError } from '../services/api';
import OrderCard from '../components/OrderCard';
import Pagination from '../components/Pagination';
import { Button, EmptyState, ErrorState, SkeletonList, Tabs } from '../components/ui';
import OpenRequests from './client/OpenRequests';

const FILTERS = [['', 'Todos'], ['new', 'Aguardando'], ['active', 'Em andamento'], ['done', 'Concluídos'], ['closed', 'Encerrados']];

function Hirings() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const resource = useApiResource('/orders/mine', { page, limit: 10, ...(status && { status }) }, { keepPrevious: true });
  const orders = resource.data?.data;
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar contratações">
        {FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }} className={`min-h-control-sm rounded-full border px-4 text-sm font-medium ${status === value ? 'border-primary bg-primary-soft text-primary-strong' : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-muted'}`}>{label}</button>)}
      </div>
      {!orders && resource.loading ? <SkeletonList count={3} label="Carregando suas contratações" itemClassName="h-40" />
        : resource.error ? <ErrorState title="Não foi possível carregar suas contratações" message={apiError(resource.error)} onRetry={resource.retry} />
          : !orders.length ? (
            <EmptyState icon="list" title={status ? 'Nada neste filtro' : 'Você ainda não contratou nenhum serviço'} description={status ? 'Tente outro filtro.' : 'Encontre um profissional, escolha a data e solicite o serviço.'} action={<Button to="/buscar">Buscar profissionais</Button>} />
          ) : (
            <>
              <div className="space-y-4">{orders.map((order) => <OrderCard key={order.uuid} order={order} perspective="client" onChanged={resource.retry} />)}</div>
              <Pagination page={page} pages={resource.data.meta.pages} onChange={setPage} label="Páginas de contratações" />
            </>
          )}
    </>
  );
}

export default function MyServices() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('aba') === 'pedidos' ? 'pedidos' : 'contratacoes';
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Pedidos e contratações</h1>
        <p className="mt-2 text-ink-muted">Acompanhe o que você contratou e os pedidos abertos que você publicou.</p>
      </div>
      <Tabs label="Seções" value={tab} onChange={(value) => setParams(value === 'pedidos' ? { aba: 'pedidos' } : {})} tabs={[{ value: 'contratacoes', label: 'Contratações' }, { value: 'pedidos', label: 'Pedidos abertos' }]} />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>{tab === 'pedidos' ? <OpenRequests /> : <Hirings />}</div>
    </main>
  );
}
