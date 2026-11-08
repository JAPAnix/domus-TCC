import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { useAuth } from '../context/useAuth';
import api, { apiError } from '../services/api';
import { formatMoney, fullName } from '../utils/format';
import { timeLeftLabel } from '../utils/orderText';
import MessageButton from '../components/MessageButton';
import ReportRequestDialog from '../components/ReportRequestDialog';
import { proposalStatus } from '../utils/status';
import StatusBadge from '../components/StatusBadge';
import { Avatar, Breadcrumb, Button, Card, ConfirmDialog, EmptyState, ErrorState, SkeletonList, useToast } from '../components/ui';

const actions = {
  accepted: { title: 'Aceitar proposta', confirmLabel: 'Aceitar proposta', danger: false, success: 'Proposta aceita. Agora faça o pagamento para garantir o serviço.', message: (name) => `Ao aceitar a proposta de ${name}, as outras propostas pendentes serão recusadas e o serviço ficará em andamento.` },
  rejected: { title: 'Recusar proposta', confirmLabel: 'Recusar proposta', danger: true, success: 'Proposta recusada.', message: (name) => `A proposta de ${name} será recusada. Essa ação não pode ser desfeita.` },
};

/** Lado a lado: valor, prazo e nota de cada profissional, com a menor oferta destacada. */
function Comparison({ rows, onDecide, serviceUuid }) {
  const cheapest = Math.min(...rows.map((row) => Number(row.proposal.proposedPrice)));
  return (
    <section aria-labelledby="comparar" className="mb-8">
      <h2 id="comparar" className="mb-3 text-lg font-semibold">Comparar propostas</h2>
      <div className="relative overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Comparação de valor, prazo e nota dos profissionais</caption>
          <thead className="bg-surface-muted text-ink-soft"><tr><th scope="col" className="p-3 font-medium">Profissional</th><th scope="col" className="p-3 font-medium">Valor</th><th scope="col" className="p-3 font-medium">Prazo</th><th scope="col" className="p-3 font-medium">Incluso</th><th scope="col" className="p-3 font-medium">Válida por</th><th scope="col" className="p-3 font-medium">Nota</th><th scope="col" className="p-3 font-medium"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>
            {rows.map(({ proposal, name, canDecide }) => {
              const rating = proposal.professional?.totalReviews ? `★ ${Number(proposal.professional.averageRating).toFixed(1)} (${proposal.professional.totalReviews})` : 'Sem avaliações';
              return (
                <tr key={proposal.uuid} className="border-t border-line">
                  <th scope="row" className="p-3 font-medium">{name}</th>
                  <td className="p-3 font-semibold">{formatMoney(proposal.proposedPrice)}{rows.length > 1 && Number(proposal.proposedPrice) === cheapest && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Menor valor</span>}</td>
                  <td className="p-3">{proposal.deliveryTimeDays != null ? `${proposal.deliveryTimeDays} ${proposal.deliveryTimeDays === 1 ? 'dia' : 'dias'}` : 'A combinar'}</td>
                  <td className="max-w-[14rem] p-3 text-ink-soft">{proposal.included || '—'}</td>
                  <td className="p-3 text-ink-soft">{proposal.validUntil ? timeLeftLabel(proposal.validUntil) : '—'}</td>
                  <td className="p-3">{rating}{proposal.professional?.isVerified && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Verificado</span>}</td>
                  <td className="p-3">{canDecide && <div className="flex gap-2"><Button size="sm" onClick={() => onDecide(proposal, 'accepted', name)}>Aceitar</Button><Button size="sm" variant="dangerOutline" onClick={() => onDecide(proposal, 'rejected', name)}>Recusar</Button><MessageButton size="sm" serviceUuid={serviceUuid} professionalUuid={proposal.professional?.user?.uuid}>Conversar</MessageButton></div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ServiceProposals() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const proposalsResource = useApiResource(`/services/${uuid}/proposals`, undefined, { keepPrevious: true });
  const serviceResource = useApiResource(`/services/${uuid}`, undefined, { keepPrevious: true });
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(null);

  const proposals = proposalsResource.data;
  const service = serviceResource.data;
  const error = proposalsResource.error ?? serviceResource.error;
  const loading = !error && (!proposals || !service);

  async function confirmDecision() {
    const { proposal, status } = pending;
    setBusy(true);
    try {
      const { data } = await api.patch(`/proposals/${proposal.uuid}/status`, { status });
      toast.success(actions[status].success);
      // Aceitou: a contratação já existe. Vai direto para ela, onde o cliente paga.
      if (status === 'accepted' && data.orderUuid) { navigate(`/contratacoes/${data.orderUuid}#pagamento`); return; }
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível atualizar a proposta.'));
    } finally {
      setBusy(false);
      setPending(null);
      proposalsResource.retry();
      serviceResource.retry();
    }
  }

  const action = pending && actions[pending.status];

  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={[
        { label: 'Pedidos e contratações', to: '/meus-servicos' },
        { label: service?.title ?? 'Pedido', to: `/servicos/${uuid}` },
        { label: 'Propostas' },
      ]} />
      <h1 className="mb-8 text-2xl font-bold sm:text-3xl">Propostas recebidas</h1>

      {loading ? (
        <SkeletonList count={3} label="Carregando propostas" itemClassName="h-40" />
      ) : error ? (
        <ErrorState
          title={error.response?.status === 403 ? 'Este pedido não é seu' : 'Não foi possível carregar as propostas'}
          message={error.response?.status === 403 ? 'Só quem publicou o pedido pode ver as propostas.' : apiError(error)}
          onRetry={error.response?.status === 403 ? undefined : () => { proposalsResource.retry(); serviceResource.retry(); }}
          action={<Button to="/meus-servicos" variant="secondary">Ver meus pedidos</Button>}
        />
      ) : proposals.length === 0 ? (
        <EmptyState icon="list" title="Nenhuma proposta ainda" description="As propostas dos profissionais aparecerão aqui. Avisaremos você nas notificações." action={<Button to={`/servicos/${uuid}`} variant="secondary">Ver o pedido</Button>} />
      ) : (
        <>
        {proposals.filter((proposal) => proposal.status === 'pending').length > 1 && (
          <Comparison
            serviceUuid={uuid}
            rows={proposals.filter((proposal) => proposal.status === 'pending').map((proposal) => ({ proposal, name: proposal.professional?.displayName || fullName(proposal.professional?.user), canDecide: service.status === 'open' && service.client?.uuid === user?.uuid }))}
            onDecide={(proposal, status, name) => setPending({ proposal, status, name })}
          />
        )}
        <ul className="space-y-4">
          {proposals.map((proposal) => {
            const professional = proposal.professional?.user;
            const name = proposal.professional?.displayName || fullName(professional);
            const canDecide = proposal.status === 'pending' && service.status === 'open' && service.client?.uuid === user?.uuid;
            return (
              <li key={proposal.uuid}>
                <Card as="article">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={proposal.professional?.publicPhotoUrl ?? professional?.profilePictureUrl} name={name} decorative />
                      <div className="min-w-0">
                        <Link to={`/usuarios/${professional?.uuid}`} className="font-semibold text-primary-strong underline-offset-2 hover:underline">{name}</Link>
                        {proposal.professional?.headline && <p className="truncate text-sm text-ink-muted">{proposal.professional.headline}</p>}
                      </div>
                    </div>
                    <StatusBadge status={proposal.status} map={proposalStatus} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-control bg-surface-muted p-3"><dt className="text-xs text-ink-muted">Valor proposto</dt><dd className="mt-0.5 text-sm font-semibold">{formatMoney(proposal.proposedPrice)}</dd></div>
                    <div className="rounded-control bg-surface-muted p-3"><dt className="text-xs text-ink-muted">Prazo</dt><dd className="mt-0.5 text-sm font-semibold">{proposal.deliveryTimeDays != null ? `${proposal.deliveryTimeDays} ${proposal.deliveryTimeDays === 1 ? 'dia' : 'dias'}` : 'A combinar'}</dd></div>
                  </dl>
                  {proposal.included && <p className="mt-4 text-sm leading-6 text-ink-soft"><strong className="text-ink">Incluso:</strong> {proposal.included}</p>}
                  {proposal.coverLetter && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{proposal.coverLetter}</p>}
                  {proposal.status === 'pending' && proposal.validUntil && <p className="mt-3 text-xs text-ink-muted">Esta proposta vale por mais {timeLeftLabel(proposal.validUntil)}{proposal.editedAt ? ' · atualizada pelo profissional' : ''}.</p>}
                  {canDecide && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button onClick={() => setPending({ proposal, status: 'accepted', name })}>Aceitar</Button>
                      <Button variant="dangerOutline" onClick={() => setPending({ proposal, status: 'rejected', name })}>Recusar</Button>
                      <MessageButton serviceUuid={uuid} professionalUuid={professional?.uuid}>Conversar</MessageButton>
                    </div>
                  )}
                  {proposal.status === 'pending' && <button type="button" onClick={() => setReporting(proposal.uuid)} className="mt-4 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-ink">Denunciar esta proposta</button>}
                </Card>
              </li>
            );
          })}
        </ul>
        </>
      )}

      <ReportRequestDialog serviceUuid={uuid} proposalUuid={reporting} open={!!reporting} onClose={() => setReporting(null)} />
      <ConfirmDialog
        open={!!pending}
        busy={busy}
        danger={action?.danger}
        title={action?.title}
        confirmLabel={action?.confirmLabel}
        message={action?.message(pending?.name)}
        onConfirm={confirmDecision}
        onCancel={() => setPending(null)}
      />
    </main>
  );
}
