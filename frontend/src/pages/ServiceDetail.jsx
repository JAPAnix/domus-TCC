import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ServiceWorkflowActions from '../components/ServiceWorkflowActions';
import ServiceProposalActions from '../components/ServiceProposalActions';

const states = {
  draft: ['Rascunho', 'Este serviço ainda não foi publicado.', 'bg-slate-100 text-slate-600'],
  open: ['Recebendo propostas', 'Profissionais podem apresentar propostas para este serviço.', 'bg-blue-50 text-blue-700'],
  in_progress: ['Em andamento', 'Uma proposta já foi aceita. Ao final do trabalho, o cliente poderá concluir o serviço.', 'bg-amber-50 text-amber-700'],
  completed: ['Concluído', 'O trabalho foi concluído. Cliente e profissional podem avaliar a experiência.', 'bg-emerald-50 text-emerald-700'],
  cancelled: ['Cancelado', 'Este serviço foi encerrado e não recebe propostas.', 'bg-slate-100 text-slate-600']
};
const money = value => value == null ? 'Não informado' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value));
function date(value) {
  if(!value) return 'Não informado';
  const result = new Date(String(value).slice(0,10)+'T12:00:00');
  return Number.isNaN(result.getTime())?'Não informado':result.toLocaleDateString('pt-BR');
}
export default function ServiceDetail() {
  const {uuid}=useParams();
  return <ServiceContent key={uuid} uuid={uuid} />;
}
function ServiceContent({uuid}) {
  const {user}=useAuth();
  const [service,setService]=useState(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    async function load(){
      try {const {data}=await api.get('/services/'+uuid);if(active){setService(data);setError('');}}
      catch(err){if(active){setService(null);setError(err.response?.status===404?'Este serviço não foi encontrado ou foi removido.':'Não foi possível carregar o serviço.');}}
    }
    load();window.addEventListener('focus',load);
    return ()=>{active=false;window.removeEventListener('focus',load);};
  },[uuid,retry]);
  const [label,description,color]=states[service?.status] ?? ['Serviço','','bg-slate-100'];
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-4xl">
      <Link to="/servicos" className="text-sm text-violet-700">← Todos os serviços</Link>
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"><p>{error}</p><button onClick={()=>setRetry(value=>value+1)} className="mt-3 font-semibold text-violet-700">Tentar novamente</button></div>}
      {!service && !error && <p role="status" className="py-16 text-center">Carregando serviço...</p>}
      {service && <article className="mt-6 space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap gap-2"><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{service.category?.name ?? 'Sem categoria'}</span><span className={'rounded-full px-3 py-1 text-xs font-semibold '+color}>{label}</span></div>
          <h1 className="break-words text-2xl font-bold sm:text-3xl">{service.title}</h1>
          <p className="mt-3 text-sm text-slate-500">{description}</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-3">
          {[['Orçamento mínimo',money(service.budgetMin)],['Orçamento máximo',money(service.budgetMax)],['Prazo solicitado',date(service.deadline)]].map(([title,value])=><div key={title} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{title}</p><p className="mt-2 break-words font-semibold">{value}</p></div>)}
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="mb-3 font-semibold">Sobre o serviço</h2><p className="whitespace-pre-wrap break-words leading-relaxed text-slate-600">{service.description}</p></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="mb-4 text-sm font-semibold">Publicado por</h2><div className="flex items-center gap-3">
          {service.client?.profilePictureUrl?<img src={service.client.profilePictureUrl} alt="" className="h-11 w-11 rounded-full object-cover" />:<span className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700">{service.client?.firstName?.[0] ?? '?'}</span>}
          <p>{service.client?.firstName} {service.client?.lastName}{user?.uuid===service.client?.uuid && <span className="ml-2 text-sm text-violet-700">(você)</span>}</p>
        </div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-semibold">{service.status==='open'?'Participação no serviço':'Acompanhamento do serviço'}</h2>
          <ServiceProposalActions uuid={uuid} status={service.status} />
          {user && ['in_progress','completed'].includes(service.status) && <ServiceWorkflowActions key={uuid+':'+user.uuid+':'+service.status} uuid={uuid} onCompleted={()=>setService(previous=>({...previous,status:'completed'}))} />}
        </section>
      </article>}
    </div>
  </main>;
}
