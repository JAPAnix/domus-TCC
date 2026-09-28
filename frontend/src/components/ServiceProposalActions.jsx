import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
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
  const button='inline-block rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white';
  if(loading) return <p role="status">Carregando acesso...</p>;
  if(!user) return status==='open' || !status ? <Link to="/login" className={button}>Entrar para participar</Link> : null;
  if(error) return <div role="alert"><p>{error}</p><button onClick={()=>setRetry(value=>value+1)} className="mt-2 text-violet-700">Tentar novamente</button></div>;
  if(!context) return <p role="status" className="text-sm text-slate-500">Carregando ações...</p>;
  if(context.isOwner) return <div className="space-y-3"><p className="text-sm text-slate-500">Você publicou este serviço.</p><Link to={'/servicos/'+uuid+'/propostas'} className={button}>{context.status==='open'?'Gerenciar propostas':'Consultar propostas recebidas'}</Link></div>;
  if(context.proposalStatus) return <div className="space-y-3"><p>Sua proposta está <strong>{labels[context.proposalStatus]}</strong>.</p><Link to="/painel-profissional" className="text-sm font-semibold text-violet-700">Acompanhar no painel profissional</Link></div>;
  if(context.status!=='open') return <p className="text-sm text-slate-500">Este serviço não está recebendo novas propostas.</p>;
  if(!context.isProfessional) return <div><p className="mb-3 text-sm text-slate-500">Ative seu perfil profissional para oferecer seus serviços.</p><Link to="/perfil/profissional" className={button}>Criar perfil profissional</Link></div>;
  return context.canSubmit ? children || <Link to={'/servicos/'+uuid+'/enviar-proposta'} className={button}>Enviar proposta</Link> : null;
}
