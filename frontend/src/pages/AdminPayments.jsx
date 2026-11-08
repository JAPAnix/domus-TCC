import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { formatMoney } from '../utils/format';
import { paymentStatus } from '../utils/status';
import { GLOSSARY, SECTIONS, SEVERITY } from '../content/adminHelp';
import StatusBadge from '../components/StatusBadge';
import { Breadcrumb, Button, EmptyState, ErrorState, Input, Modal, SkeletonList, Tabs, Textarea, useToast } from '../components/ui';

const cents = (value) => formatMoney((value ?? 0) / 100);
const when = (value) => (value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

/** "?" que abre uma explicação curta da seção. */
function HelpTip({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Ajuda sobre esta seção" className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-line-strong text-xs font-bold text-ink-soft hover:bg-surface-muted">?</button>
      {open && <span role="note" className="absolute left-0 top-8 z-20 block w-72 max-w-[80vw] rounded-card border border-line bg-surface p-3 text-sm font-normal leading-5 text-ink-soft shadow-raised">{children}</span>}
    </span>
  );
}

/** Abertura de cada seção: o que é, o que fazer e o "?" com a explicação curta. */
function Intro({ section }) {
  const info = SECTIONS[section];
  return (
    <header className="mb-5 space-y-1">
      <h2 className="text-xl font-semibold">{info.title}<HelpTip>{info.help}</HelpTip></h2>
      <p className="text-sm leading-6 text-ink-soft"><strong className="text-ink">O que é:</strong> {info.what}</p>
      <p className="text-sm leading-6 text-ink-soft"><strong className="text-ink">O que fazer:</strong> {info.todo}</p>
    </header>
  );
}

function Loaded({ resource, label, empty, children }) {
  if (!resource.data && resource.loading) return <SkeletonList count={3} label={label} itemClassName="h-20" />;
  if (resource.error && !resource.data) return <ErrorState title="Não foi possível carregar" message={apiError(resource.error)} onRetry={resource.retry} />;
  const rows = Array.isArray(resource.data) ? resource.data : resource.data?.rows ?? resource.data?.data ?? [];
  if (!rows.length) return empty;
  return children(rows);
}

async function downloadCsv(path, params, name) {
  const response = await api.get(path, { params: { ...params, formato: 'csv' }, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

// ---- Resumo ---------------------------------------------------------------------------------------------------------
function Overview({ go }) {
  const resource = useApiResource('/admin/summary');
  if (!resource.data && resource.loading) return <SkeletonList count={2} label="Carregando resumo" itemClassName="h-24" />;
  if (resource.error && !resource.data) return <ErrorState title="Não foi possível carregar o resumo" message={apiError(resource.error)} onRetry={resource.retry} />;
  const d = resource.data;
  const money = [['Volume pago', cents(d.volumeCents), 'Soma dos pagamentos confirmados pelo Dommos.'], ['Comissão e taxas do Dommos', cents(d.commissionCollectedCents), 'O que ficou para a plataforma nesses pagamentos.'], ['Aguardando pagamento', d.pendingPayments, 'Cobranças geradas que o cliente ainda não pagou.']];
  const attention = [['reclamacoes', 'Reclamações abertas', d.openDisputes, 'Clientes esperando uma decisão sua.'], ['alertas', 'Alertas dos últimos 30 dias', d.alerts, 'Problemas detectados nos pagamentos.'], ['webhooks', 'Avisos do gateway com falha', d.failedWebhooks, 'Pagamentos que podem estar desatualizados.']];
  return (
    <>
      <Intro section="resumo" />
      <dl className="grid gap-4 sm:grid-cols-3">
        {money.map(([label, value, hint]) => <div key={label} className="rounded-card border border-line bg-surface p-4"><dt className="text-sm text-ink-muted">{label}</dt><dd className="mt-1 text-2xl font-bold">{value}</dd><dd className="mt-1 text-xs leading-5 text-ink-muted">{hint}</dd></div>)}
      </dl>
      <h3 className="mb-3 mt-8 text-lg font-semibold">Precisa da sua atenção</h3>
      <ul className="grid gap-4 sm:grid-cols-3">
        {attention.map(([tab, label, value, hint]) => (
          <li key={tab}>
            <button type="button" onClick={() => go(tab)} className={`h-full w-full rounded-card border p-4 text-left transition-colors hover:border-primary ${value > 0 ? 'border-warning-line bg-warning-soft' : 'border-line bg-surface'}`}>
              <span className="block text-sm text-ink-soft">{label}</span>
              <span className="mt-1 block text-2xl font-bold">{value}</span>
              <span className="mt-1 block text-xs leading-5 text-ink-muted">{value > 0 ? hint : 'Nada pendente. Tudo em dia.'}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- Transações -----------------------------------------------------------------------------------------------------
function Transactions() {
  const toast = useToast();
  const [range, setRange] = useState({ de: '', ate: '' });
  const [busy, setBusy] = useState(false);
  const params = { ...(range.de && { de: range.de }), ...(range.ate && { ate: range.ate }) };
  const resource = useApiResource('/admin/transactions', params, { keepPrevious: true });
  const totals = resource.data?.totals;
  async function exportCsv() {
    setBusy(true);
    try { await downloadCsv('/admin/transactions', params, 'transacoes-dommos.csv'); } catch (err) { toast.error(apiError(err, 'Não foi possível exportar.')); } finally { setBusy(false); }
  }
  const cards = totals && [['Volume pago', cents(totals.paidCents)], ['Comissão arrecadada', cents(totals.commissionCents)], ['Estornado', cents(totals.refundedCents)], ['Pagamentos no período', totals.count]];
  return (
    <>
      <Intro section="transacoes" />
      <form className="mb-5 flex flex-wrap items-end gap-3" onSubmit={(event) => event.preventDefault()} aria-label="Filtrar por período">
        <Input label="De" type="date" value={range.de} max={range.ate || undefined} onChange={(event) => setRange({ ...range, de: event.target.value })} />
        <Input label="Até" type="date" value={range.ate} min={range.de || undefined} onChange={(event) => setRange({ ...range, ate: event.target.value })} />
        {(range.de || range.ate) && <Button variant="ghost" onClick={() => setRange({ de: '', ate: '' })}>Limpar</Button>}
        <Button variant="secondary" onClick={exportCsv} loading={busy} disabled={!resource.data?.rows?.length}>Exportar CSV</Button>
      </form>
      {totals && <dl className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-card border border-line bg-surface p-4"><dt className="text-sm text-ink-muted">{label}</dt><dd className="mt-1 text-2xl font-bold">{value}</dd></div>)}</dl>}
      <Loaded resource={resource} label="Carregando transações" empty={<EmptyState icon="list" title="Nenhum pagamento no período" description="Quando um cliente pagar um pedido pelo Dommos, ele aparece aqui, com a comissão e o valor estornado, se houver." />}>
        {(rows) => (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted"><tr><th scope="col" className="p-3">Serviço</th><th scope="col" className="p-3">Cliente → Profissional</th><th scope="col" className="p-3 text-right">Pago</th><th scope="col" className="p-3 text-right">Comissão</th><th scope="col" className="p-3">Situação</th><th scope="col" className="p-3">Data</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.uuid}>
                    <td className="p-3"><Link to={`/contratacoes/${row.orderUuid}`} className="font-medium text-primary-strong hover:underline">{row.service}</Link></td>
                    <td className="p-3">{row.client} → {row.professional}</td>
                    <td className="p-3 text-right">{cents(row.amountCents)}{row.refundedCents > 0 && <span className="block text-xs text-ink-muted">estornado {cents(row.refundedCents)}</span>}</td>
                    <td className="p-3 text-right">{cents(row.commissionCents)}</td>
                    <td className="p-3"><StatusBadge status={row.status} map={paymentStatus} /></td>
                    <td className="p-3 text-ink-muted">{when(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loaded>
    </>
  );
}

// ---- Reclamações ----------------------------------------------------------------------------------------------------
function DecisionModal({ target, onClose, onDone }) {
  const toast = useToast();
  const { dispute, decision } = target;
  const total = dispute.payment.amountCents;
  const [mode, setMode] = useState('total');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const refund = decision === 'refund';

  async function submit(event) {
    event.preventDefault();
    const found = {};
    const reais = Number(String(amount).replace(',', '.'));
    const refundCents = Math.round(reais * 100);
    if (note.trim().length < 10) found.note = 'Escreva a justificativa, de 10 a 500 caracteres. As duas partes vão ler.';
    if (refund && mode === 'partial') {
      if (!(reais > 0)) found.amount = 'Informe quanto será devolvido ao cliente.';
      else if (refundCents >= total) found.amount = 'Para devolver tudo, escolha "Reembolsar o valor total".';
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await api.post(`/admin/disputes/${dispute.id}/resolve`, { decision, note: note.trim(), ...(refund && mode === 'partial' && { refund_cents: refundCents }) });
      toast.success('Decisão registrada. O cliente e o profissional foram avisados.');
      onDone();
    } catch (err) {
      const fields = apiFieldErrors(err);
      setErrors({ note: fields.note, amount: fields.refund_cents, form: apiError(err, 'Não foi possível registrar a decisão.') });
      setBusy(false);
    }
  }

  const effect = !refund ? `O valor de ${dispute.payment.formatted} será liberado a ${dispute.professional}.`
    : mode === 'total' ? `${dispute.payment.formatted} serão devolvidos a ${dispute.client}.`
      : `O valor informado será devolvido a ${dispute.client} e o restante será liberado a ${dispute.professional}.`;
  return (
    <Modal open title={refund ? 'Reembolsar o cliente' : 'Manter o pagamento ao profissional'} onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="rounded-control bg-surface-muted p-3 text-sm leading-6">{effect} Esta decisão não pode ser desfeita. Fica registrada com o seu nome e a data.</p>
        {refund && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Quanto devolver?</legend>
            <label className="flex items-center gap-3 text-sm"><input type="radio" name="mode" checked={mode === 'total'} onChange={() => setMode('total')} /> Reembolsar o valor total ({dispute.payment.formatted})</label>
            <label className="flex items-center gap-3 text-sm"><input type="radio" name="mode" checked={mode === 'partial'} onChange={() => setMode('partial')} /> Reembolsar só uma parte</label>
            {mode === 'partial' && <Input label="Valor a devolver (R$)" name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setErrors({}); }} error={errors.amount} hint={`O pagamento foi de ${dispute.payment.formatted}.`} />}
          </fieldset>
        )}
        <Textarea label="Justificativa da decisão" name="note" required rows={4} maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setErrors({}); }} error={errors.note} hint="Obrigatória. O cliente e o profissional recebem este texto." />
        {errors.form && !errors.note && !errors.amount && <p role="alert" className="rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{errors.form}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button>
          <Button type="submit" variant={refund ? 'danger' : 'primary'} loading={busy}>{refund ? 'Confirmar reembolso' : 'Confirmar: manter pagamento'}</Button>
        </div>
      </form>
    </Modal>
  );
}

const DISPUTE_RESULT = { resolved_release: 'Pagamento mantido ao profissional', resolved_refund: 'Cliente reembolsado (total)', resolved_partial: 'Cliente reembolsado (parcial)' };

function Disputes() {
  const [filter, setFilter] = useState('open');
  const resource = useApiResource('/admin/disputes', { status: filter }, { keepPrevious: true });
  const [target, setTarget] = useState(null);
  return (
    <>
      <Intro section="reclamacoes" />
      <Tabs label="Situação da reclamação" value={filter} onChange={setFilter} tabs={[{ value: 'open', label: 'Abertas' }, { value: 'all', label: 'Todas' }]} />
      <Loaded resource={resource} label="Carregando reclamações" empty={<EmptyState icon="list" title={filter === 'open' ? 'Nenhuma reclamação aberta' : 'Nenhuma reclamação ainda'} description="Quando um cliente abrir uma reclamação sobre um serviço pago, ela aparece aqui para você decidir." />}>
        {(rows) => (
          <ul className="space-y-4">
            {rows.map((dispute) => (
              <li key={dispute.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/contratacoes/${dispute.orderUuid}`} className="font-medium text-primary-strong hover:underline">{dispute.service}</Link>
                  <span className="text-base font-semibold">{dispute.payment.formatted}</span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">Cliente: <strong className="text-ink">{dispute.client}</strong> · Profissional: <strong className="text-ink">{dispute.professional}</strong> · aberta por {dispute.opener} em {when(dispute.createdAt)}</p>
                {dispute.status === 'open' && <p className={`mt-1 text-sm font-medium ${dispute.daysOpen >= 3 ? 'text-danger' : 'text-ink-soft'}`}>Aberta há {dispute.daysOpen === 0 ? 'menos de 1 dia' : `${dispute.daysOpen} ${dispute.daysOpen === 1 ? 'dia' : 'dias'}`}{dispute.daysOpen >= 3 ? ': decida logo, os dois estão esperando.' : '.'}</p>}
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">O que o cliente relatou</p>
                <p className="mt-1 whitespace-pre-wrap break-words rounded-control bg-surface-muted p-3 text-sm">{dispute.reason}</p>
                {dispute.status === 'open' ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button variant="danger" onClick={() => setTarget({ dispute, decision: 'refund' })}>Reembolsar o cliente</Button>
                    <Button variant="secondary" onClick={() => setTarget({ dispute, decision: 'release' })}>Manter pagamento ao profissional</Button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-ink-soft"><strong className="text-ink">{DISPUTE_RESULT[dispute.status] ?? dispute.status}</strong>{dispute.status === 'resolved_partial' && dispute.refundedCents ? ` (${cents(dispute.refundedCents)} devolvidos)` : ''} em {when(dispute.resolvedAt)}.{dispute.resolution && <span className="mt-1 block">Justificativa: {dispute.resolution}</span>}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Loaded>
      {target && <DecisionModal target={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); resource.retry(); }} />}
    </>
  );
}

// ---- Alertas --------------------------------------------------------------------------------------------------------
function ResolveAlertModal({ alert, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (note.trim().length < 5) { setError('Escreva o que foi feito, de 5 a 500 caracteres.'); return; }
    setBusy(true);
    try {
      await api.post(`/admin/alerts/${alert.id}/resolve`, { note: note.trim() });
      toast.success('Alerta marcado como resolvido.');
      onDone();
    } catch (err) { setError(apiFieldErrors(err).note ?? apiError(err, 'Não foi possível marcar como resolvido.')); setBusy(false); }
  }
  return (
    <Modal open title="Marcar como resolvido" onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm leading-6 text-ink-soft"><strong className="text-ink">{alert.title}.</strong> Ele sai da lista de abertos e fica no histórico, com a sua nota e o seu nome.</p>
        <Textarea label="O que foi feito?" name="note" required rows={3} maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setError(''); }} error={error} />
        <div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button><Button type="submit" loading={busy}>Marcar como resolvido</Button></div>
      </form>
    </Modal>
  );
}

function Alerts({ go }) {
  const [filter, setFilter] = useState('open');
  const resource = useApiResource('/admin/alerts', { status: filter }, { keepPrevious: true });
  const [target, setTarget] = useState(null);
  return (
    <>
      <Intro section="alertas" />
      <Tabs label="Situação do alerta" value={filter} onChange={setFilter} tabs={[{ value: 'open', label: 'Abertos' }, { value: 'resolved', label: 'Resolvidos' }, { value: 'all', label: 'Todos' }]} />
      <Loaded resource={resource} label="Carregando alertas" empty={<EmptyState icon="bell" title={filter === 'resolved' ? 'Nenhum alerta resolvido ainda' : 'Nenhum alerta aberto'} description={filter === 'resolved' ? 'Os alertas que você marcar como resolvidos ficam guardados aqui.' : 'Tudo certo por enquanto. Quando o sistema detectar um problema nos pagamentos, ele aparece aqui, explicado e com a ação sugerida.'} />}>
        {(rows) => (
          <ul className="space-y-4">
            {rows.map((alert) => {
              const severity = SEVERITY[alert.severity];
              return (
                <li key={alert.id} className={`rounded-card border p-4 ${alert.resolvedAt ? 'border-line bg-surface-muted' : 'border-line bg-surface'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severity.tone}`}>{severity.label}</span>
                    <h3 className="font-semibold">{alert.title}</h3>
                    {alert.resolvedAt && <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-strong">Resolvido</span>}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{alert.service ? `${alert.service} · ` : ''}{when(alert.createdAt)}</p>
                  {alert.detail && <p className="mt-2 break-words rounded-control bg-surface-muted p-2 text-xs text-ink-soft"><span className="font-semibold">Detalhe técnico: </span>{alert.detail}</p>}
                  <dl className="mt-3 space-y-2 text-sm leading-6">
                    <div><dt className="inline font-semibold">O que significa: </dt><dd className="inline text-ink-soft">{alert.meaning}</dd></div>
                    <div><dt className="inline font-semibold">Por que importa: </dt><dd className="inline text-ink-soft">{alert.why}</dd></div>
                    <div><dt className="inline font-semibold">O que fazer: </dt><dd className="inline text-ink-soft">{alert.action}</dd></div>
                  </dl>
                  {alert.resolvedAt && <p className="mt-3 text-sm text-ink-soft">Resolvido em {when(alert.resolvedAt)}. Nota: {alert.resolutionNote}</p>}
                  {!alert.resolvedAt && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {alert.actionLabel && (alert.orderUuid ? <Button variant="secondary" to={`/contratacoes/${alert.orderUuid}`}>{alert.actionLabel}</Button> : alert.kind === 'webhook_failed' ? <Button variant="secondary" onClick={() => go('webhooks')}>{alert.actionLabel}</Button> : null)}
                      {alert.resolvable ? <Button onClick={() => setTarget(alert)}>Marcar como resolvido</Button> : <p className="self-center text-xs text-ink-muted">Some sozinho quando o problema acabar.</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Loaded>
      {target && <ResolveAlertModal alert={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); resource.retry(); }} />}
    </>
  );
}

// ---- Webhooks -------------------------------------------------------------------------------------------------------
const HOOK_STATUS = { done: ['Processado', 'bg-success-soft text-success-strong'], failed: ['Com falha', 'bg-danger-soft text-danger-strong'], ignored: ['Ignorado (sem efeito)', 'bg-surface-muted text-ink-soft'], processing: ['Processando', 'bg-info-soft text-info-strong'] };

function Webhooks() {
  const [filter, setFilter] = useState('');
  const resource = useApiResource('/admin/webhook-events', filter ? { status: filter } : undefined, { keepPrevious: true });
  return (
    <>
      <Intro section="webhooks" />
      <Tabs label="Situação do aviso" value={filter} onChange={setFilter} tabs={[{ value: '', label: 'Todos' }, { value: 'failed', label: 'Com falha' }, { value: 'done', label: 'Processados' }, { value: 'ignored', label: 'Ignorados' }]} />
      <Loaded resource={resource} label="Carregando avisos" empty={<EmptyState icon="list" title={filter === 'failed' ? 'Nenhum aviso com falha' : 'Nenhum aviso recebido ainda'} description={filter === 'failed' ? 'Ótimo: todos os avisos do gateway foram processados.' : 'Quando o Asaas avisar de um pagamento, o registro aparece aqui. Se nunca aparecer nada depois de um pagamento, confira o cadastro do webhook no Asaas.'} />}>
        {(rows) => (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted"><tr><th scope="col" className="p-3">Aviso</th><th scope="col" className="p-3">Pagamento</th><th scope="col" className="p-3">O que o sistema fez</th><th scope="col" className="p-3">Quando</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => {
                  const [label, tone] = HOOK_STATUS[row.status] ?? [row.status, 'bg-surface-muted text-ink-soft'];
                  return (
                    <tr key={row.id}>
                      <td className="p-3 font-medium">{row.event}</td>
                      <td className="break-all p-3 text-ink-muted">{row.reference}</td>
                      <td className="p-3"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>{row.note && <span className="mt-1 block text-xs leading-5 text-ink-muted">{row.note}</span>}{row.error && <span className="mt-1 block text-xs text-danger">{row.error}</span>}</td>
                      <td className="p-3 text-ink-muted">{when(row.processedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Loaded>
    </>
  );
}

// ---- Auditoria ------------------------------------------------------------------------------------------------------
function Audit() {
  const resource = useApiResource('/admin/audit');
  return (
    <>
      <Intro section="auditoria" />
      <Loaded resource={resource} label="Carregando auditoria" empty={<EmptyState icon="list" title="Nenhuma decisão registrada" description="Quando um administrador decidir uma reclamação ou resolver um alerta, o registro aparece aqui." />}>
        {(rows) => (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {rows.map((row) => (
              <li key={row.id} className="p-4">
                <p className="font-medium">{row.actionLabel}</p>
                <p className="text-sm text-ink-muted">{row.admin} · {when(row.createdAt)}</p>
                {row.detail && <p className="mt-1 break-words text-sm text-ink-soft">{row.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </Loaded>
    </>
  );
}

const TABS = [{ value: 'resumo', label: 'Resumo' }, { value: 'transacoes', label: 'Transações' }, { value: 'reclamacoes', label: 'Reclamações' }, { value: 'alertas', label: 'Alertas' }, { value: 'webhooks', label: 'Avisos do gateway' }, { value: 'auditoria', label: 'Auditoria' }];

export default function AdminPayments() {
  const [tab, setTab] = useState('resumo');
  const [glossary, setGlossary] = useState(false);
  return (
    <main className="mx-auto max-w-content px-4 py-8 sm:px-6">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Administração de pagamentos' }]} />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Administração de pagamentos</h1>
          <p className="mt-1 text-sm text-ink-muted">Acompanhe os pagamentos feitos pelo Dommos e resolva o que precisa de uma decisão sua.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setGlossary(true)}>Glossário</Button>
      </div>
      <div className="mt-6"><Tabs label="Seções" value={tab} onChange={setTab} tabs={TABS} /></div>
      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'resumo' && <Overview go={setTab} />}
        {tab === 'transacoes' && <Transactions />}
        {tab === 'reclamacoes' && <Disputes />}
        {tab === 'alertas' && <Alerts go={setTab} />}
        {tab === 'webhooks' && <Webhooks />}
        {tab === 'auditoria' && <Audit />}
      </div>
      <Modal open={glossary} title="Glossário do administrador" onClose={() => setGlossary(false)} footer={<Button onClick={() => setGlossary(false)}>Entendi</Button>}>
        <p className="mb-4 text-sm text-ink-muted">Os termos desta área, em linguagem simples.</p>
        <dl className="space-y-4">{GLOSSARY.map(([term, text]) => <div key={term}><dt className="font-semibold">{term}</dt><dd className="text-sm leading-6 text-ink-soft">{text}</dd></div>)}</dl>
      </Modal>
    </main>
  );
}
