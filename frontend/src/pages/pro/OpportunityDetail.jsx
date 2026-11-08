import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApiResource } from '../../hooks/useApiResource';
import api, { apiError } from '../../services/api';
import { NOTIFICATIONS_CHANGED } from '../../hooks/useUnreadNotifications';
import { formatBudget, formatDay } from '../../utils/format';
import { timeLeftLabel } from '../../utils/orderText';
import MessageButton from '../../components/MessageButton';
import ReportRequestDialog from '../../components/ReportRequestDialog';
import ServiceProposalActions from '../../components/ServiceProposalActions';
import { Avatar, Breadcrumb, Button, Card, ConfirmDialog, EmptyState, ErrorState, SkeletonList, useToast } from '../../components/ui';
import { MODE_LABELS } from '../../utils/listingText';

/** Detalhe de uma oportunidade: o pedido completo, quem pediu e o que fazer (proposta, pergunta, dispensar, denunciar). */
export default function OpportunityDetail() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const resource = useApiResource(`/pro/opportunities/${uuid}`);
  const item = resource.data;
  const [reporting, setReporting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const itemUuid = item?.uuid;

  // Abrir o pedido marca como visto: o contador de oportunidades novas diminui.
  useEffect(() => {
    if (!itemUuid) return;
    api.post(`/pro/opportunities/${itemUuid}/seen`).then(() => window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED))).catch(() => {});
  }, [itemUuid]);

  async function dismiss() {
    setBusy(true);
    try {
      await api.post(`/pro/opportunities/${uuid}/dismiss`);
      toast.success('Pedido dispensado. Ele não aparece mais na sua lista.');
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED));
      navigate('/pro/oportunidades');
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível dispensar agora.'));
      setBusy(false);
      setDismissing(false);
    }
  }

  const crumbs = [{ label: 'Oportunidades', to: '/pro/oportunidades' }, { label: item?.title ?? 'Pedido' }];
  if (!item && resource.loading) return <><Breadcrumb items={crumbs} /><SkeletonList count={3} label="Carregando o pedido" itemClassName="h-32" /></>;
  if (resource.error) {
    const missing = resource.error.response?.status === 404;
    return <><Breadcrumb items={crumbs} />{missing ? <EmptyState as="h1" icon="search" title="Pedido não encontrado" description="Ele foi removido ou não existe mais." action={<Button to="/pro/oportunidades">Ver oportunidades</Button>} /> : <ErrorState title="Não foi possível carregar o pedido" message={apiError(resource.error)} onRetry={resource.retry} />}</>;
  }

  const place = [item.neighborhood, item.city].filter(Boolean).join(', ');
  return (
    <>
      <Breadcrumb items={crumbs} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-softer px-3 py-1 text-xs font-semibold text-primary-strong">{item.category?.name ?? 'Sem categoria'}</span>
              {item.status !== 'open' && <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink-soft">{item.status === 'in_progress' ? 'Já contratado' : 'Encerrado'}</span>}
            </div>
            <h1 className="break-words text-2xl font-bold">{item.title}</h1>
            <p className="whitespace-pre-wrap break-words leading-7 text-ink-soft">{item.description}</p>
            {item.images?.length > 0 && <ul aria-label="Fotos do pedido" className="flex flex-wrap gap-2">{item.images.map((url, index) => <li key={url}><a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Foto ${index + 1} do pedido`} loading="lazy" className="h-24 w-24 rounded-control object-cover" /></a></li>)}</ul>}
            <dl className="grid gap-x-6 gap-y-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Onde</dt><dd className="font-medium">{place ? `${place}/${item.state}` : item.state ?? 'Não informado'}<span className="block text-xs font-normal text-ink-muted">O endereço completo só aparece depois que a sua proposta for aceita.</span></dd></div>
              <div><dt className="text-ink-muted">Quando</dt><dd className="font-medium">{item.deadline ? formatDay(item.deadline) : 'Flexível'}</dd></div>
              <div><dt className="text-ink-muted">Orçamento do cliente</dt><dd className="font-medium">{item.budgetMin == null && item.budgetMax == null ? 'A combinar' : formatBudget(Number(item.budgetMin), Number(item.budgetMax))}</dd></div>
              {item.modes?.length > 0 && <div><dt className="text-ink-muted">Atendimento</dt><dd className="font-medium">{item.modes.map((mode) => MODE_LABELS[mode] ?? mode).join(', ')}</dd></div>}
              {(item.onlyVerified || item.minRating) && <div><dt className="text-ink-muted">Preferência do cliente</dt><dd className="font-medium">{[item.onlyVerified && 'Profissional verificado', item.minRating && `Nota mínima ${Number(item.minRating).toFixed(1)}`].filter(Boolean).join(' · ')}</dd></div>}
              {item.expiresAt && item.status === 'open' && <div><dt className="text-ink-muted">Recebe propostas por</dt><dd className="font-medium">{timeLeftLabel(item.expiresAt)}</dd></div>}
              <div><dt className="text-ink-muted">Propostas recebidas</dt><dd className="font-medium">{item.proposalsCount} de {item.maxProposals}{item.proposalsCount >= item.maxProposals && ' (limite atingido)'}</dd></div>
            </dl>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Quem pediu</h2>
            <div className="flex items-center gap-3">
              <Avatar src={item.client?.profilePictureUrl} name={item.client?.preferredName || item.client?.firstName} decorative />
              <div>
                <p className="font-medium">{item.client?.preferredName?.trim() || item.client?.firstName}</p>
                <p className="text-sm text-ink-muted">{item.client?.reviews ? `★ ${item.client.rating} · ${item.client.reviews} ${item.client.reviews === 1 ? 'avaliação' : 'avaliações'}` : 'Ainda sem avaliações'}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="font-semibold">O que fazer agora</h2>
            <ServiceProposalActions uuid={uuid} status={item.status} />
            {item.status === 'open' && <MessageButton serviceUuid={uuid} block>Fazer uma pergunta</MessageButton>}
            {item.status === 'open' && <Button variant="secondary" onClick={() => setDismissing(true)} block>Dispensar</Button>}
            <p className="text-xs text-ink-muted">Perguntas ficam numa conversa privada. Contatos pessoais (telefone, e-mail, redes) não são mostrados antes do aceite.</p>
            <button type="button" onClick={() => setReporting(true)} className="text-sm font-semibold text-ink-muted underline underline-offset-2 hover:text-ink">Denunciar este pedido</button>
          </Card>
          <p className="text-sm text-ink-muted"><Link to="/ajuda/artigo/pedido-por-anuncio-e-pedido-aberto" className="font-semibold text-primary-strong underline underline-offset-2">Entenda a diferença</Link> entre pedido por anúncio e pedido aberto.</p>
        </div>
      </div>
      <ReportRequestDialog serviceUuid={uuid} open={reporting} onClose={() => setReporting(false)} />
      <ConfirmDialog open={dismissing} busy={busy} title="Dispensar pedido" confirmLabel="Dispensar" message="O pedido some da sua lista de oportunidades. O cliente não é avisado." onConfirm={dismiss} onCancel={() => setDismissing(false)} />
    </>
  );
}
