import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../../hooks/useApiResource';
import { apiError } from '../../services/api';
import { formatDay, formatMoney } from '../../utils/format';
import Pagination from '../../components/Pagination';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui';
import AsaasEarnings from './AsaasEarnings';

const monthName = (key) => new Date(`${key}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

export default function ProEarnings() {
  const config = useApiResource('/payments/config', undefined, { keepPrevious: true });
  if (config.data?.provider === 'asaas') return <AsaasEarnings />;
  return <LegacyEarnings loadingConfig={!config.data && config.loading} />;
}

function LegacyEarnings({ loadingConfig }) {
  const [page, setPage] = useState(1);
  const resource = useApiResource('/pro/earnings', { page }, { keepPrevious: true });
  const data = resource.data;

  if (loadingConfig || (!data && resource.loading)) return <SkeletonList count={3} label="Carregando ganhos" itemClassName="h-32" />;
  if (resource.error && !data) return <ErrorState title="Não foi possível carregar os ganhos" message={apiError(resource.error)} onRetry={resource.retry} />;

  const max = Math.max(1, ...data.months.map((month) => month.net));
  const current = data.months.at(-1);
  return (
    <div className="space-y-8">
      <p role="note" className="rounded-control border border-info-line bg-info-soft p-4 text-sm leading-6 text-info">Estes valores são os que você informou ao concluir cada serviço. O Dommos ainda não processa pagamentos, então aqui não aparece dinheiro recebido pela plataforma, e sim o registro dos seus serviços concluídos.</p>

      <section aria-labelledby="mensal">
        <h2 id="mensal" className="mb-1 text-xl font-semibold">Últimos 6 meses</h2>
        <p className="mb-4 text-sm text-ink-muted">Este mês: <strong className="text-ink">{formatMoney(current.net)}</strong> em {current.count} {current.count === 1 ? 'serviço' : 'serviços'}.</p>
        <ul className="space-y-2" aria-label="Valor por mês">
          {data.months.map((month) => (
            <li key={month.month} className="grid grid-cols-[4rem_1fr_7rem] items-center gap-3 text-sm">
              <span className="capitalize text-ink-muted">{monthName(month.month)}</span>
              <span className="h-3 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(month.net / max) * 100}%` }} /></span>
              <span className="text-right font-medium">{formatMoney(month.net)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">Valores já descontada a taxa da plataforma (hoje 0%).</p>
      </section>

      <section aria-labelledby="historico">
        <h2 id="historico" className="mb-3 text-xl font-semibold">Serviços concluídos</h2>
        {data.data.length === 0 ? (
          <EmptyState icon="list" title="Nenhum serviço concluído ainda" description="Quando você concluir um pedido e informar o valor final, ele aparece aqui." />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {data.data.map((order) => (
                <li key={order.uuid} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <span className="min-w-0"><Link to={`/contratacoes/${order.uuid}`} className="block truncate font-medium hover:text-primary-strong">{order.title}</Link><span className="text-sm text-ink-muted">{order.client.name} · concluído em {formatDay(order.completedAt)}</span></span>
                  <span className="text-right"><span className="block font-semibold">{formatMoney(order.netAmount)}</span>{order.platformFeePercent > 0 && <span className="text-xs text-ink-muted">de {formatMoney(order.finalAmount)}, com taxa de {order.platformFeePercent}%</span>}</span>
                </li>
              ))}
            </ul>
            <Pagination page={page} pages={data.meta.pages} onChange={setPage} label="Páginas de serviços concluídos" />
          </>
        )}
      </section>
    </div>
  );
}
