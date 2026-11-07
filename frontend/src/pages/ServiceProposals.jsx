import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { useAuth } from '../context/useAuth';
import api, { apiError } from '../services/api';
import { formatMoney, fullName } from '../utils/format';
import { proposalStatus } from '../utils/status';
import StatusBadge from '../components/StatusBadge';
import { Avatar, Breadcrumb, Button, Card, ConfirmDialog, EmptyState, ErrorState, SkeletonList, useToast } from '../components/ui';

const actions = {
  accepted: { title: 'Aceitar proposta', confirmLabel: 'Aceitar proposta', danger: false, success: 'Proposta aceita. Agora faça o pagamento para garantir o serviço.', message: (name) => `Ao aceitar a proposta de ${name}, as outras propostas pendentes serão recusadas e o serviço ficará em andamento.` },
  rejected: { title: 'Recusar proposta', confirmLabel: 'Recusar proposta', danger: true, success: 'Proposta recusada.', message: (name) => `A proposta de ${name} será recusada. Essa ação não pode ser desfeita.` },
};

export default function ServiceProposals() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const proposalsResource = useApiResource(`/services/${uuid}/proposals`, undefined, { keepPrevious: true });
  const serviceResource = useApiResource(`/services/${uuid}`, undefined, { keepPrevious: true });
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

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
                  {proposal.coverLetter && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{proposal.coverLetter}</p>}
                  {canDecide && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button onClick={() => setPending({ proposal, status: 'accepted', name })}>Aceitar</Button>
                      <Button variant="dangerOutline" onClick={() => setPending({ proposal, status: 'rejected', name })}>Recusar</Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

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
