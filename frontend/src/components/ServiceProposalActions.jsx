import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api, { apiError } from '../services/api';
import { timeLeftLabel } from '../utils/orderText';
import { buttonClass } from './ui';

const LABELS = { pending: 'pendente', accepted: 'aceita', rejected: 'recusada', withdrawn: 'retirada', expired: 'vencida' };

/** O que quem está logado pode fazer com um pedido aberto. `children` é o formulário de proposta (função recebe o contexto). */
export default function ServiceProposalActions({ uuid, status, edit = false, children }) {
  const { user, loading } = useAuth();
  return <Participation key={`${uuid}:${user?.uuid ?? ''}:${status}`} uuid={uuid} status={status} user={user} loading={loading} edit={edit}>{children}</Participation>;
}

function Participation({ uuid, status, user, loading, edit, children }) {
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    if (user) {
      api.get(`/services/${uuid}/participation`)
        .then(({ data }) => { if (active) { setContext(data); setError(''); } })
        .catch((err) => { if (active) setError(apiError(err, 'Não foi possível carregar as ações deste pedido.')); });
    }
    return () => { active = false; };
  }, [uuid, user, retry]);

  const button = buttonClass();
  if (loading) return <p role="status" className="text-sm text-ink-muted">Carregando acesso...</p>;
  if (!user) return status === 'open' || !status ? <Link to="/login" state={{ from: `/servicos/${uuid}` }} className={button}>Entrar para participar</Link> : null;
  if (error) return <div role="alert"><p className="text-sm text-danger">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 font-semibold text-primary-strong underline">Tentar novamente</button></div>;
  if (!context) return <p role="status" className="text-sm text-ink-muted">Carregando ações...</p>;

  if (context.isOwner) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">Você publicou este pedido.</p>
        {context.orderUuid && <Link to={`/contratacoes/${context.orderUuid}`} className={button}>Ver contratação e pagamento</Link>}
        <Link to={`/servicos/${uuid}/propostas`} className={button}>{context.status === 'open' ? 'Gerenciar propostas' : 'Consultar propostas recebidas'}</Link>
      </div>
    );
  }

  // Proposta pendente: o profissional pode editar enquanto o cliente não responde.
  if (context.proposalStatus === 'pending') {
    if (edit && context.status === 'open') return children?.({ ...context, editing: true }) ?? null;
    return (
      <div className="space-y-3">
        <p>Sua proposta está <strong>pendente</strong>. O cliente ainda vai responder.</p>
        {context.status === 'open' && <Link to={`/servicos/${uuid}/enviar-proposta?editar=1`} className={button}>Editar a minha proposta</Link>}
        <Link to="/pro/oportunidades" className="block text-sm font-semibold text-primary-strong underline underline-offset-2">Ver outras oportunidades</Link>
      </div>
    );
  }
  if (context.proposalStatus && !['expired', 'withdrawn'].includes(context.proposalStatus)) {
    return (
      <div className="space-y-3">
        <p>Sua proposta foi <strong>{LABELS[context.proposalStatus]}</strong>.</p>
        {context.orderUuid && <Link to={`/contratacoes/${context.orderUuid}`} className={button}>Ver contratação e pagamento</Link>}
        <Link to="/pro/oportunidades" className="block text-sm font-semibold text-primary-strong underline underline-offset-2">Ver outras oportunidades</Link>
      </div>
    );
  }

  if (context.status !== 'open') return <p className="text-sm text-ink-muted">Este pedido não está recebendo novas propostas.</p>;
  if (context.expiresAt && new Date(context.expiresAt) <= new Date()) return <p className="text-sm text-ink-muted">O prazo deste pedido acabou.</p>;
  if (!context.isProfessional) return <div><p className="mb-3 text-sm text-ink-muted">Para enviar propostas, publique o seu primeiro serviço e vire profissional.</p><Link to="/pro/comecar" className={button}>Criar perfil profissional</Link></div>;
  if (context.limitReached) return <p role="status" className="rounded-control border border-line bg-surface-muted p-3 text-sm text-ink-soft"><strong>Limite de propostas atingido.</strong> Este pedido já recebeu as {context.maxProposals} propostas que aceita. Se alguma vencer, a vaga volta a abrir.</p>;
  if (!context.preferencesOk) return <p role="status" className="rounded-control border border-line bg-surface-muted p-3 text-sm text-ink-soft">O cliente pediu um perfil que você ainda não tem (profissional verificado ou nota mínima). <Link to="/ajuda/artigo/verificacao-do-profissional" className="font-semibold text-primary-strong underline underline-offset-2">Saiba como se verificar</Link>.</p>;
  if (context.blockers?.length) {
    return (
      <div role="status" className="space-y-2 rounded-control border border-warning-line bg-warning-soft p-4 text-sm text-ink-soft">
        <p className="font-semibold text-ink">Antes de enviar uma proposta:</p>
        <ul className="list-disc space-y-1 pl-5">{context.blockers.map((item) => <li key={item}>{item}</li>)}</ul>
        <Link to="/configuracoes/pagamentos" className="inline-block font-semibold text-primary-strong underline underline-offset-2">Ir para Configurações</Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {context.expiresAt && <p className="text-sm text-ink-muted">Este pedido vence em {timeLeftLabel(context.expiresAt)} e aceita {context.maxProposals - context.proposalsCount} {context.maxProposals - context.proposalsCount === 1 ? 'proposta' : 'propostas'} ({context.proposalsCount} de {context.maxProposals} recebidas).</p>}
      {context.canSubmit ? (children?.(context) ?? <Link to={`/servicos/${uuid}/enviar-proposta`} className={button}>Enviar proposta</Link>) : null}
    </div>
  );
}
