import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { formatMoney } from '../utils/format';
import { paymentStatus } from '../utils/status';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { Breadcrumb, Button, ConfirmDialog, EmptyState, ErrorState, SkeletonList, Tabs, Textarea, useToast } from '../components/ui';

const cents = (value) => formatMoney((value ?? 0) / 100);
const when = (value) => (value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const ALERTS = { split_problem: 'Problema na divisão do pagamento (split)', paid_after_close: 'Pagamento recebido depois de o pedido ser encerrado', chargeback: 'Contestação no cartão (chargeback)', release_failed: 'Falha ao liberar o valor', refund_failed: 'Falha ao estornar', transfer_failed: 'Falha no repasse', dispute: 'Reclamação aberta', payout_failed: 'Falha no repasse ao profissional' };

function List({ resource, label, children, empty }) {
  if (!resource.data && resource.loading) return <SkeletonList count={3} label={label} itemClassName="h-16" />;
  if (resource.error && !resource.data) return <ErrorState title="Não foi possível carregar" message={apiError(resource.error)} onRetry={resource.retry} />;
  const rows = Array.isArray(resource.data) ? resource.data : resource.data?.data ?? [];
  if (!rows.length) return <EmptyState icon="list" title={empty} />;
  return children(rows);
}

function Overview() {
  const resource = useApiResource('/admin/summary');
  if (!resource.data && resource.loading) return <SkeletonList count={2} label="Carregando resumo" itemClassName="h-24" />;
  if (resource.error && !resource.data) return <ErrorState title="Não foi possível carregar o resumo" message={apiError(resource.error)} onRetry={resource.retry} />;
  const d = resource.data;
  const cards = [['Volume pago', cents(d.volumeCents)], ['Comissão e taxas do Dommos', cents(d.commissionCollectedCents)], ['Aguardando pagamento', d.pendingPayments], ['Reclamações abertas', d.openDisputes], ['Alertas (30 dias)', d.alerts], ['Webhooks com falha', d.failedWebhooks]];
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(([label, value]) => <div key={label} className="rounded-card border border-line bg-surface p-4"><dt className="text-sm text-ink-muted">{label}</dt><dd className="mt-1 text-2xl font-bold">{value}</dd></div>)}
    </dl>
  );
}

function Payments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const resource = useApiResource('/admin/payments', { page, ...(status && { status }) }, { keepPrevious: true });
  const pages = resource.data?.meta?.pages ?? 1; // calculado fora da função filha: o compilador do React lê isto antes de os dados chegarem
  return (
    <>
      <label className="mb-4 flex items-center gap-2 text-sm">Situação
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="min-h-control rounded-control border border-line bg-surface px-3">
          <option value="">Todas</option>
          {Object.entries(paymentStatus).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
      </label>
      <List resource={resource} label="Carregando pagamentos" empty="Nenhum pagamento encontrado">
        {(rows) => (
          <>
            <div className="overflow-x-auto rounded-card border border-line bg-surface">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted"><tr><th scope="col" className="p-3">Pedido</th><th scope="col" className="p-3">Cliente → Profissional</th><th scope="col" className="p-3 text-right">Total</th><th scope="col" className="p-3 text-right">Comissão</th><th scope="col" className="p-3">Situação</th><th scope="col" className="p-3">Data</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <tr key={row.uuid}>
                      <td className="p-3"><Link to={`/contratacoes/${row.orderUuid}`} className="font-medium text-primary-strong hover:underline">{row.service}</Link></td>
                      <td className="p-3">{row.client} → {row.professional}</td>
                      <td className="p-3 text-right">{cents(row.amountCents)}{row.refundedCents > 0 && <span className="block text-xs text-ink-muted">estornado {cents(row.refundedCents)}</span>}</td>
                      <td className="p-3 text-right">{cents(row.commissionCents + row.clientFeeCents)}</td>
                      <td className="p-3"><StatusBadge status={row.status} map={paymentStatus} /></td>
                      <td className="p-3 text-ink-muted">{when(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onChange={setPage} label="Páginas de pagamentos" />
          </>
        )}
      </List>
    </>
  );
}

function Disputes() {
  const toast = useToast();
  const [filter, setFilter] = useState('open');
  const resource = useApiResource('/admin/disputes', { status: filter }, { keepPrevious: true });
  const [target, setTarget] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function resolve() {
    setBusy(true);
    try {
      await api.post(`/admin/disputes/${target.dispute.id}/resolve`, { decision: target.decision, ...(note.trim() && { note: note.trim() }) });
      toast.success(target.decision === 'refund' ? 'Estorno solicitado ao cliente.' : 'Valor liberado ao profissional.');
      setTarget(null); setNote(''); resource.retry();
    } catch (err) { toast.error(apiError(err, 'Não foi possível resolver.')); } finally { setBusy(false); }
  }
  return (
    <>
      <Tabs label="Situação da reclamação" value={filter} onChange={setFilter} tabs={[{ value: 'open', label: 'Abertas' }, { value: 'all', label: 'Todas' }]} />
      <List resource={resource} label="Carregando reclamações" empty={filter === 'open' ? 'Nenhuma reclamação aberta' : 'Nenhuma reclamação'}>
        {(rows) => (
          <ul className="space-y-3">
            {rows.map((dispute) => (
              <li key={dispute.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/contratacoes/${dispute.orderUuid}`} className="font-medium text-primary-strong hover:underline">{dispute.service}</Link>
                  <span className="text-sm font-semibold">{dispute.payment.formatted}</span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{dispute.client} (cliente) · {dispute.professional} (profissional) · aberta em {when(dispute.createdAt)}</p>
                <p className="mt-3 whitespace-pre-wrap break-words rounded-control bg-surface-muted p-3 text-sm">{dispute.reason}</p>
                {dispute.status === 'open' ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button onClick={() => setTarget({ dispute, decision: 'release' })}>Liberar ao profissional</Button>
                    <Button variant="danger" onClick={() => setTarget({ dispute, decision: 'refund' })}>Estornar ao cliente</Button>
                  </div>
                ) : <p className="mt-3 text-sm text-ink-soft">{dispute.status === 'resolved_refund' ? 'Resolvida com estorno ao cliente' : 'Resolvida com liberação ao profissional'}{dispute.resolution ? `: ${dispute.resolution}` : ''} · {when(dispute.resolvedAt)}</p>}
              </li>
            ))}
          </ul>
        )}
      </List>
      <ConfirmDialog open={!!target} busy={busy} danger={target?.decision === 'refund'} title={target?.decision === 'refund' ? 'Estornar ao cliente' : 'Liberar ao profissional'} confirmLabel="Confirmar decisão"
        message={target ? `${target.decision === 'refund' ? 'O valor total será devolvido ao cliente' : 'O valor será liberado ao profissional'} (${target.dispute.payment.formatted}). As duas partes serão avisadas. Esta decisão não pode ser desfeita.` : ''}
        onConfirm={resolve} onCancel={() => !busy && setTarget(null)} />
      {target && <div className="mt-4 max-w-xl"><Textarea label="Nota para as partes (opcional)" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} /></div>}
    </>
  );
}

function Alerts() {
  const resource = useApiResource('/admin/alerts');
  return (
    <List resource={resource} label="Carregando alertas" empty="Nenhum alerta">
      {(rows) => (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {rows.map((alert) => (
            <li key={alert.id} className="p-4">
              <p className="font-medium">{ALERTS[alert.kind] ?? alert.kind}</p>
              <p className="text-sm text-ink-muted">{alert.service} · {when(alert.createdAt)}</p>
              {alert.detail && <p className="mt-1 break-words text-sm text-ink-soft">{alert.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </List>
  );
}

function Webhooks() {
  const resource = useApiResource('/admin/webhook-events');
  return (
    <List resource={resource} label="Carregando eventos" empty="Nenhum evento recebido ainda">
      {(rows) => (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted"><tr><th scope="col" className="p-3">Evento</th><th scope="col" className="p-3">Referência</th><th scope="col" className="p-3">Situação</th><th scope="col" className="p-3">Quando</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => <tr key={row.id}><td className="p-3 font-medium">{row.event}</td><td className="p-3 break-all text-ink-muted">{row.reference}</td><td className="p-3">{row.status}{row.error && <span className="block text-xs text-danger">{row.error}</span>}</td><td className="p-3 text-ink-muted">{when(row.processedAt)}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </List>
  );
}

const TABS = [{ value: 'resumo', label: 'Resumo' }, { value: 'pagamentos', label: 'Pagamentos' }, { value: 'reclamacoes', label: 'Reclamações' }, { value: 'alertas', label: 'Alertas' }, { value: 'webhooks', label: 'Webhooks' }];
const PANELS = { resumo: Overview, pagamentos: Payments, reclamacoes: Disputes, alertas: Alerts, webhooks: Webhooks };

export default function AdminPayments() {
  const [tab, setTab] = useState('resumo');
  const Panel = PANELS[tab];
  return (
    <main className="mx-auto max-w-content px-4 py-8 sm:px-6">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Administração de pagamentos' }]} />
      <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Administração de pagamentos</h1>
      <p className="mt-1 text-sm text-ink-muted">Pagamentos pela plataforma, reclamações, alertas e eventos do gateway.</p>
      <div className="mt-6"><Tabs label="Seções" value={tab} onChange={setTab} tabs={TABS} /></div>
      <div role="tabpanel" aria-labelledby={`tab-${tab}`}><Panel /></div>
    </main>
  );
}
