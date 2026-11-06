import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { formatMoney } from '../../utils/format';
import { paymentStatus } from '../../utils/status';
import StatusBadge from '../../components/StatusBadge';
import { Button, EmptyState, ErrorState, Input, SkeletonList, useToast } from '../../components/ui';

const cents = (value) => formatMoney((value ?? 0) / 100);
const METHOD = { pix: 'Pix', credit_card: 'Cartão', boleto: 'Boleto' };
const PAYOUT = { held: 'A liberar', released: 'Liberado', refunded: 'Estornado', none: '' };

/** Ganhos do profissional com pagamento pela plataforma: totais, filtro por período e exportação em CSV. */
export default function AsaasEarnings() {
  const toast = useToast();
  const [range, setRange] = useState({ de: '', ate: '' });
  const [busy, setBusy] = useState(false);
  const params = { ...(range.de && { de: range.de }), ...(range.ate && { ate: range.ate }) };
  const resource = useApiResource('/payments/earnings', params, { keepPrevious: true });
  const data = resource.data;

  async function exportCsv() {
    setBusy(true);
    try {
      const response = await api.get('/payments/earnings', { params: { ...params, formato: 'csv' }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ganhos-dommos.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(apiError(err, 'Não foi possível exportar.')); } finally { setBusy(false); }
  }

  const totals = data?.totals;
  const cards = totals && [
    ['A liberar', totals.toReleaseCents, 'Pagos pelo cliente, aguardando a confirmação do serviço.'],
    ['Liberado', totals.releasedCents, 'Já repassado à sua conta de recebimento.'],
    ['Comissão do Dommos', totals.commissionCents, 'Descontada dos pagamentos não estornados.'],
    ['Estornado', totals.refundedCents, 'Devolvido a clientes.'],
  ];
  return (
    <div className="space-y-8">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => event.preventDefault()} aria-label="Filtrar por período">
        <Input label="De" type="date" value={range.de} max={range.ate || undefined} onChange={(event) => setRange({ ...range, de: event.target.value })} />
        <Input label="Até" type="date" value={range.ate} min={range.de || undefined} onChange={(event) => setRange({ ...range, ate: event.target.value })} />
        {(range.de || range.ate) && <Button variant="ghost" onClick={() => setRange({ de: '', ate: '' })}>Limpar</Button>}
        <Button variant="secondary" onClick={exportCsv} loading={busy} disabled={!data?.data.length}>Exportar CSV</Button>
      </form>

      {!data && resource.loading && <SkeletonList count={3} label="Carregando ganhos" itemClassName="h-24" />}
      {resource.error && !data && <ErrorState title="Não foi possível carregar os ganhos" message={apiError(resource.error)} onRetry={resource.retry} />}

      {data && (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(([label, value, hint]) => (
              <div key={label} className="rounded-card border border-line bg-surface p-4">
                <dt className="text-sm text-ink-muted">{label}</dt>
                <dd className="mt-1 text-2xl font-bold">{cents(value)}</dd>
                <dd className="mt-1 text-xs leading-5 text-ink-muted">{hint}</dd>
              </div>
            ))}
          </dl>

          {data.data.length === 0 ? (
            <EmptyState icon="list" title="Nenhum pagamento no período" description="Quando um cliente pagar um pedido seu pela plataforma, ele aparece aqui, com a comissão e o valor líquido." />
          ) : (
            <section aria-labelledby="movimentos">
              <h2 id="movimentos" className="mb-3 text-xl font-semibold">Pagamentos</h2>
              <div className="overflow-x-auto rounded-card border border-line bg-surface">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
                    <tr><th scope="col" className="p-3">Serviço</th><th scope="col" className="p-3">Meio</th><th scope="col" className="p-3 text-right">Pago</th><th scope="col" className="p-3 text-right">Comissão</th><th scope="col" className="p-3 text-right">Taxa do gateway</th><th scope="col" className="p-3 text-right">Líquido</th><th scope="col" className="p-3">Situação</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.data.map((row) => (
                      <tr key={row.uuid}>
                        <td className="p-3"><Link to={`/contratacoes/${row.orderUuid}`} className="font-medium text-primary-strong hover:underline">{row.service}</Link><span className="block text-xs text-ink-muted">{row.client} · {new Date(row.confirmedAt ?? row.createdAt).toLocaleDateString('pt-BR')}</span></td>
                        <td className="p-3">{METHOD[row.method] ?? row.method}{row.installments > 1 ? ` ${row.installments}x` : ''}</td>
                        <td className="p-3 text-right">{cents(row.paidCents)}</td>
                        <td className="p-3 text-right">− {cents(row.commissionCents)}</td>
                        <td className="p-3 text-right">− {cents(row.gatewayFeeCents)}</td>
                        <td className="p-3 text-right font-semibold">{cents(row.netCents)}</td>
                        <td className="p-3"><StatusBadge status={row.status} map={paymentStatus} />{PAYOUT[row.payoutStatus] && <span className="mt-1 block text-xs text-ink-muted">{PAYOUT[row.payoutStatus]}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-ink-muted">Pagamentos no cartão são repassados 32 dias depois; no Pix, assim que o serviço é confirmado. Mostramos até 500 pagamentos por consulta.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
