import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import api, { apiError } from '../services/api';
import { formatDay } from '../utils/format';
import Pagination from '../components/Pagination';
import { Breadcrumb, Button, Card, EmptyState, ErrorState, Modal, SkeletonList, Tabs, Textarea, useToast } from '../components/ui';

const TABS = [['open', 'Abertas'], ['removed', 'Removidas'], ['dismissed', 'Ignoradas']];

function DecisionModal({ report, action, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const remove = action === 'remove';

  async function submit(event) {
    event.preventDefault();
    if (note.trim().length < 5) { setError('Escreva uma justificativa curta (mínimo 5 caracteres).'); return; }
    setBusy(true);
    try {
      await api.post(`/admin/moderation/${report.id}/resolve`, { action, note: note.trim() });
      toast.success(remove ? 'Conteúdo removido. A pessoa foi avisada.' : 'Denúncia ignorada.');
      onDone();
    } catch (err) {
      setError(apiError(err, 'Não foi possível concluir agora.'));
      setBusy(false);
    }
  }

  return (
    <Modal open title={remove ? (report.kind === 'proposal' ? 'Remover proposta' : 'Remover pedido') : 'Ignorar denúncia'} onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm leading-6 text-ink-soft">{remove ? 'O conteúdo sai do ar e quem o criou recebe um aviso. Essa decisão fica registrada na auditoria.' : 'A denúncia é encerrada e o conteúdo continua no ar. A decisão fica registrada na auditoria.'}</p>
        <Textarea label="Justificativa" name="note" required rows={3} maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setError(''); }} error={error} hint="De 5 a 500 caracteres. Só a equipe vê." />
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button><Button type="submit" variant={remove ? 'danger' : 'primary'} loading={busy}>{remove ? 'Remover' : 'Ignorar denúncia'}</Button></div>
      </form>
    </Modal>
  );
}

function ReportCard({ report, onDecide }) {
  return (
    <Card as="article" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{report.kind === 'proposal' ? 'Proposta denunciada' : 'Pedido denunciado'} · {report.reasonLabel}</p>
        <span className="text-xs text-ink-muted">{formatDay(report.createdAt)} · por {report.reporter}</span>
      </div>
      {report.details && <p className="text-sm text-ink-soft"><strong>O que foi relatado:</strong> {report.details}</p>}
      <div className="rounded-control bg-surface-muted p-3 text-sm">
        <p className="font-medium">{report.service.title} <span className="font-normal text-ink-muted">(de {report.service.client})</span></p>
        <p className="mt-1 whitespace-pre-wrap break-words text-ink-soft">{report.service.description}</p>
        {report.proposal && <div className="mt-3 border-t border-line pt-3"><p className="font-medium">Proposta de {report.proposal.professional}: R$ {report.proposal.amount.toFixed(2).replace('.', ',')}</p>{report.proposal.included && <p className="text-ink-soft">Incluso: {report.proposal.included}</p>}{report.proposal.text && <p className="whitespace-pre-wrap break-words text-ink-soft">{report.proposal.text}</p>}</div>}
      </div>
      {report.status === 'open' ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="danger" onClick={() => onDecide(report, 'remove')}>{report.kind === 'proposal' ? 'Remover proposta' : 'Remover pedido'}</Button>
          <Button size="sm" variant="secondary" onClick={() => onDecide(report, 'dismiss')}>Ignorar denúncia</Button>
          <Link to={`/servicos/${report.service.uuid}`} className="self-center text-sm font-semibold text-primary-strong underline underline-offset-2">Abrir o pedido</Link>
        </div>
      ) : <p className="text-sm text-ink-muted">{report.status === 'removed' ? 'Removido' : 'Ignorada'}{report.resolvedAt ? ` em ${formatDay(report.resolvedAt)}` : ''}. {report.resolutionNote}</p>}
    </Card>
  );
}

/** Fila de moderação: pedidos abertos e propostas denunciados por usuários. */
export default function AdminModeration() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState(null);
  const resource = useApiResource('/admin/moderation', { status, page }, { keepPrevious: true });
  const data = resource.data;

  return (
    <main className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: 'Administração', to: '/admin/pagamentos' }, { label: 'Moderação' }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">Moderação de pedidos e propostas</h1>
      <div className="mt-3 max-w-2xl space-y-1 text-sm text-ink-soft">
        <p><strong>O que é:</strong> pedidos abertos e propostas que usuários denunciaram por golpe, contato por fora, conteúdo proibido ou ofensivo.</p>
        <p><strong>O que fazer:</strong> leia o conteúdo e decida. "Remover" tira do ar e avisa a pessoa; "Ignorar" encerra a denúncia sem mexer em nada. Toda decisão pede uma justificativa e fica na auditoria.</p>
      </div>
      <div className="mt-6">
        <Tabs label="Filtrar denúncias" value={status} onChange={(value) => { setStatus(value); setPage(1); }} tabs={TABS.map(([value, label]) => ({ value, label, count: value === status ? data?.meta?.total : undefined, alert: value === 'open' }))} />
        <div role="tabpanel" id={`panel-${status}`} aria-labelledby={`tab-${status}`}>
          {!data && resource.loading ? <SkeletonList count={3} label="Carregando denúncias" itemClassName="h-40" />
            : resource.error ? <ErrorState title="Não foi possível carregar a fila" message={apiError(resource.error)} onRetry={resource.retry} />
              : !data.data.length ? <EmptyState icon="list" title={status === 'open' ? 'Nenhuma denúncia aberta' : 'Nada por aqui'} description={status === 'open' ? 'Quando alguém denunciar um pedido ou uma proposta, ele aparece aqui.' : 'As decisões anteriores aparecem nesta lista.'} />
                : (
                  <>
                    <div className="space-y-4">{data.data.map((report) => <ReportCard key={report.id} report={report} onDecide={(item, action) => setDeciding({ report: item, action })} />)}</div>
                    <Pagination page={page} pages={data.meta.pages} onChange={setPage} label="Páginas de denúncias" />
                  </>
                )}
        </div>
      </div>
      {deciding && <DecisionModal report={deciding.report} action={deciding.action} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); resource.retry(); }} />}
    </main>
  );
}
