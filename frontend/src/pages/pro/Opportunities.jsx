import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../../hooks/useApiResource';
import { useCategories } from '../../hooks/useCategories';
import { useFeatures } from '../../hooks/useFeatures';
import { apiError } from '../../services/api';
import { formatBudget, formatDay } from '../../utils/format';
import { timeLeftLabel } from '../../utils/orderText';
import Pagination from '../../components/Pagination';
import { Button, Card, EmptyState, ErrorState, Input, Select, SkeletonList } from '../../components/ui';

const ORDERS = [['recent', 'Mais recentes'], ['expiring', 'Perto de vencer'], ['budget', 'Maior orçamento']];

function OpportunityCard({ item }) {
  const place = [item.neighborhood, item.city].filter(Boolean).join(', ');
  return (
    <Card as="article" padded={false} className="flex flex-col overflow-hidden sm:flex-row">
      {item.cover && <img src={item.cover} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover sm:aspect-auto sm:w-40" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {item.isNew && <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">Nova</span>}
          <span className="rounded-full bg-primary-softer px-2.5 py-0.5 text-xs font-semibold text-primary-strong">{item.category?.name ?? 'Sem categoria'}</span>
          {item.limitReached && <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-soft">Limite de propostas atingido</span>}
          {item.myProposalStatus === 'pending' && <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-medium text-info">Você já enviou proposta</span>}
        </div>
        <h3 className="break-words font-semibold"><Link to={`/pro/oportunidades/${item.uuid}`} className="hover:text-primary-strong">{item.title}</Link></h3>
        <p className="line-clamp-2 text-sm text-ink-soft">{item.description}</p>
        <p className="text-sm text-ink-muted">
          {place ? `${place}/${item.state}` : item.state ?? 'Local não informado'}
          {item.deadline ? ` · para ${formatDay(item.deadline)}` : ''} · {item.budgetMin == null && item.budgetMax == null ? 'Orçamento a combinar' : formatBudget(item.budgetMin, item.budgetMax)}
        </p>
        <p className="text-xs text-ink-muted">
          {item.proposalsCount} de {item.maxProposals} propostas{item.hoursLeft != null ? ` · vence em ${timeLeftLabel(item.expiresAt)}` : ''}
        </p>
        <div className="mt-1"><Button size="sm" to={`/pro/oportunidades/${item.uuid}`}>Ver o pedido</Button></div>
      </div>
    </Card>
  );
}

/** Pedidos abertos de clientes que combinam com os serviços do profissional. Diferente de "Pedidos recebidos" (contratações de anúncios). */
export default function Opportunities() {
  const { openRequests } = useFeatures();
  const { categories } = useCategories();
  const [filters, setFilters] = useState({ category_id: '', city: '', budget_min: '', budget_max: '', date_until: '', urgency: false, only_new: false, order: 'recent' });
  const [page, setPage] = useState(1);
  const params = { page, limit: 12, order: filters.order, ...(filters.category_id && { category_id: filters.category_id }), ...(filters.city.trim() && { city: filters.city.trim() }), ...(filters.budget_min && { budget_min: filters.budget_min }), ...(filters.budget_max && { budget_max: filters.budget_max }), ...(filters.date_until && { date_until: filters.date_until }), ...(filters.urgency && { urgency: 'soon' }), ...(filters.only_new && { only_new: 'true' }) };
  const resource = useApiResource(openRequests ? '/pro/opportunities' : null, params, { keepPrevious: true });
  const data = resource.data;
  const set = (name) => (event) => { setFilters((current) => ({ ...current, [name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })); setPage(1); };

  if (!openRequests) return <EmptyState icon="list" title="Oportunidades indisponíveis" description="No momento os pedidos abertos estão desativados. Seus pedidos por anúncio continuam em Pedidos e agenda." action={<Button to="/pro/pedidos">Ver pedidos recebidos</Button>} />;

  return (
    <section aria-labelledby="oportunidades">
      <h2 id="oportunidades" className="text-xl font-semibold">Oportunidades</h2>
      <p className="mb-5 mt-1 max-w-2xl text-sm text-ink-muted">Pedidos abertos de clientes que combinam com os seus serviços. Envie uma proposta com valor e prazo e o cliente escolhe. Já os <Link to="/pro/pedidos" className="font-semibold text-primary-strong underline underline-offset-2">pedidos recebidos</Link> são contratações dos seus anúncios.</p>

      {data?.needsListing && <p role="status" className="mb-4 rounded-control border border-warning-line bg-warning-soft p-3 text-sm text-ink-soft">Você ainda não tem um serviço publicado, então mostramos todos os pedidos. <Link to="/pro/servicos" className="font-semibold text-primary-strong underline underline-offset-2">Crie um serviço</Link> para ver só o que combina com você.</p>}
      {data?.blockers?.length > 0 && <div role="status" className="mb-4 rounded-control border border-warning-line bg-warning-soft p-3 text-sm text-ink-soft"><p className="font-semibold text-ink">Para enviar propostas:</p><ul className="mt-1 list-disc pl-5">{data.blockers.map((item) => <li key={item}>{item}</li>)}</ul></div>}

      <Card className="mb-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Categoria" value={filters.category_id} onChange={set('category_id')}><option value="">Todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Input label="Cidade" value={filters.city} onChange={set('city')} autoComplete="off" />
          <Input label="Orçamento mínimo (R$)" type="number" min="0" inputMode="decimal" value={filters.budget_min} onChange={set('budget_min')} />
          <Input label="Orçamento máximo (R$)" type="number" min="0" inputMode="decimal" value={filters.budget_max} onChange={set('budget_max')} />
          <Input label="Data até" type="date" value={filters.date_until} onChange={set('date_until')} />
          <Select label="Ordenar por" value={filters.order} onChange={set('order')}>{ORDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex min-h-control items-center gap-2"><input type="checkbox" checked={filters.only_new} onChange={set('only_new')} />Só as novas</label>
          <label className="flex min-h-control items-center gap-2"><input type="checkbox" checked={filters.urgency} onChange={set('urgency')} />Vencem em até 48 horas</label>
        </div>
      </Card>

      {!data && resource.loading ? <SkeletonList count={3} label="Carregando oportunidades" itemClassName="h-40" />
        : resource.error ? <ErrorState title="Não foi possível carregar as oportunidades" message={apiError(resource.error)} onRetry={resource.retry} />
          : !data.data.length ? (
            <EmptyState icon="list" title="Nenhuma oportunidade agora" description="Quando um cliente publicar um pedido que combina com os seus serviços, ele aparece aqui e você recebe um aviso."
              action={<div className="flex flex-wrap justify-center gap-2"><Button variant="secondary" to="/perfil">Completar o perfil</Button><Button variant="secondary" to="/pro/servicos">Adicionar serviços</Button><Button variant="secondary" to="/configuracoes/notificacoes">Ativar notificações</Button></div>} />
          ) : (
            <>
              <div className="space-y-4">{data.data.map((item) => <OpportunityCard key={item.uuid} item={item} />)}</div>
              <Pagination page={page} pages={data.meta.pages} onChange={setPage} label="Páginas de oportunidades" />
            </>
          )}
    </section>
  );
}
