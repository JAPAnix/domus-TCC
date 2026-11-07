import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../services/api';
import { buttonClass } from './ui';
const labels = { pending:'pendente', accepted:'aceita', rejected:'rejeitada', withdrawn:'retirada' };
export default function ServiceProposalActions({ uuid, status, children }) {
  const { user, loading } = useAuth();
  return <Participation key={uuid+':'+(user?.uuid ?? '')+':'+status} uuid={uuid} status={status} user={user} loading={loading}>{children}</Participation>;
}
function Participation({uuid,status,user,loading,children}) {
  const [context,setContext] = useState(null);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  useEffect(()=>{
    let active=true;
    if(user) api.get('/services/'+uuid+'/participation').then(({data})=>{if(active){setContext(data);setError('');}}).catch(err=>{if(active)setError(err.response?.data?.message || 'Não foi possível carregar as ações.');});
    return ()=>{active=false;};
  },[uuid,user,retry]);
  const button=buttonClass();
  if(loading) return <p role="status">Carregando acesso...</p>;
  if(!user) return status==='open' || !status ? <Link to="/login" state={{ from: `/servicos/${uuid}` }} className={button}>Entrar para participar</Link> : null;
  if(error) return <div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)} className="mt-2 font-semibold text-primary-strong underline">Tentar novamente</button></div>;
  if(!context) return <p role="status" className="text-sm text-ink-muted">Carregando ações...</p>;
  if(context.isOwner) return <div className="space-y-3"><p className="text-sm text-ink-muted">Você publicou este pedido.</p>{context.orderUuid && <Link to={'/contratacoes/'+context.orderUuid} className={button}>Ver contratação e pagamento</Link>}<Link to={'/servicos/'+uuid+'/propostas'} className={button}>{context.status==='open'?'Gerenciar propostas':'Consultar propostas recebidas'}</Link></div>;
  if(context.proposalStatus) return <div className="space-y-3"><p>Sua proposta está <strong>{labels[context.proposalStatus]}</strong>.</p>{context.orderUuid && <Link to={'/contratacoes/'+context.orderUuid} className={button}>Ver contratação e pagamento</Link>}<Link to="/pro/pedidos" className="text-sm font-semibold text-primary-strong">Acompanhar em Pedidos e agenda</Link></div>;
  if(context.status!=='open') return <p className="text-sm text-ink-muted">Este pedido não está recebendo novas propostas.</p>;
  if(!context.isProfessional) return <div><p className="mb-3 text-sm text-ink-muted">Para enviar propostas, publique o seu primeiro serviço e vire profissional.</p><Link to="/perfil/profissional" className={button}>Criar perfil profissional</Link></div>;
  return context.canSubmit ? children || <Link to={'/servicos/'+uuid+'/enviar-proposta'} className={button}>Enviar proposta</Link> : null;
}
