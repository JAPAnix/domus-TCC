import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { useCategories } from '../hooks/useCategories';
import { apiError } from '../services/api';
import { formatBudget, fullName } from '../utils/format';
import Pagination from '../components/Pagination';
import { Avatar, Button, EmptyState, ErrorState, Input, Select, SkeletonList } from '../components/ui';

function RequestCard({ service }) {
  return (
    <Link to={`/servicos/${service.uuid}`} className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors hover:border-primary">
      {service.images?.[0] && <img src={service.images[0]} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <span className="self-start rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-strong">{service.category?.name ?? 'Sem categoria'}</span>
        <h2 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary-strong">{service.title}</h2>
        <p className="line-clamp-2 flex-1 text-sm text-ink-muted">{service.description}</p>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Avatar src={service.client?.profilePictureUrl} name={fullName(service.client)} size="xs" decorative />
          {fullName(service.client)}
        </div>
        <div className="border-t border-line pt-3">
          <p className="text-xs text-ink-muted">Orçamento</p>
          <p className="text-sm font-semibold">{formatBudget(service.budgetMin, service.budgetMax)}</p>
        </div>
      </div>
    </Link>
  );
}

/** Pedidos publicados por clientes: é aqui que o profissional encontra trabalho. */
export default function Home() {
  const { categories } = useCategories();
  const [categoryId, setCategoryId] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [page, setPage] = useState(1);

  const hasFilters = !!(categoryId || budgetMin || budgetMax);
  const resource = useApiResource('/services', {
    page,
    limit: 12,
    ...(categoryId && { category_id: categoryId }),
    ...(budgetMin && { budget_min: budgetMin }),
    ...(budgetMax && { budget_max: budgetMax }),
  });
  const services = resource.data?.data ?? [];

  function filter(setter) {
    return (event) => { setter(event.target.value); setPage(1); };
  }

  function clearFilters() {
    setCategoryId('');
    setBudgetMin('');
    setBudgetMax('');
    setPage(1);
  }

  return (
    <main className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Pedidos abertos</h1>
          <p className="mt-2 text-ink-muted">Clientes que precisam de um serviço e estão recebendo propostas.</p>
        </div>
        <Button to="/servicos/novo" variant="secondary">Publicar um pedido</Button>
      </div>

      <form onSubmit={(event) => event.preventDefault()} aria-label="Filtrar pedidos" className="mt-6 grid gap-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Select label="Categoria" value={categoryId} onChange={filter(setCategoryId)}>
          <option value="">Todas as categorias</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </Select>
        <Input label="Orçamento a partir de (R$)" type="number" min="0" inputMode="decimal" value={budgetMin} onChange={filter(setBudgetMin)} />
        <Input label="Orçamento até (R$)" type="number" min="0" inputMode="decimal" value={budgetMax} onChange={filter(setBudgetMax)} />
        <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters}>Limpar</Button>
      </form>

      <div className="mt-8">
        {resource.loading ? (
          <SkeletonList count={6} label="Carregando pedidos" itemClassName="h-56" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" />
        ) : resource.error ? (
          <ErrorState title="Não foi possível carregar os pedidos" message={apiError(resource.error)} onRetry={resource.retry} />
        ) : services.length === 0 ? (
          <EmptyState
            icon="search"
            title={hasFilters ? 'Nenhum pedido com esses filtros' : 'Ainda não há pedidos abertos'}
            description={hasFilters ? 'Tente ampliar a faixa de orçamento ou escolher outra categoria.' : 'Quando um cliente publicar um pedido, ele aparecerá aqui.'}
            action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button> : <Button to="/servicos/novo">Publicar um pedido</Button>}
          />
        ) : (
          <>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => <li key={service.uuid} className="flex"><RequestCard service={service} /></li>)}
            </ul>
            <Pagination page={page} pages={resource.data?.meta?.pages} onChange={setPage} label="Páginas de pedidos" />
          </>
        )}
      </div>
    </main>
  );
}
