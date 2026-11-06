import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/useAuth';
import ServiceWorkflowActions from '../components/ServiceWorkflowActions';
import ServiceProposalActions from '../components/ServiceProposalActions';
import { Avatar, Breadcrumb, EmptyState, ErrorState, Button, Skeleton } from '../components/ui';
import { fullName } from '../utils/format';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const states = {
  draft: ['Rascunho', 'Este pedido ainda não foi publicado.', 'bg-surface-muted text-ink-soft'],
  open: ['Recebendo propostas', 'Profissionais podem enviar propostas para este pedido.', 'bg-info-soft text-info'],
  in_progress: ['Em andamento', 'Uma proposta já foi aceita. Ao final do trabalho, o cliente poderá concluir o serviço.', 'bg-warning-soft text-warning'],
  completed: ['Concluído', 'O trabalho foi concluído. Cliente e profissional podem avaliar a experiência.', 'bg-success-soft text-success'],
  cancelled: ['Cancelado', 'Este pedido foi encerrado e não recebe propostas.', 'bg-surface-muted text-ink-soft']
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
  const [error,setError]=useState(null);
  useDocumentMeta({ title: service?.title ?? (error ? 'Pedido não encontrado' : 'Pedido') });
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    async function load(){
      try {const {data}=await api.get('/services/'+uuid);if(active){setService(data);setError(null);}}
      catch(err){if(active){setService(null);setError(err.response?.status===404?'missing':'failed');}}
    }
    load();window.addEventListener('focus',load);
    return ()=>{active=false;window.removeEventListener('focus',load);};
  },[uuid,retry]);
  const [label,description,color]=states[service?.status] ?? ['Serviço','','bg-surface-muted'];
  const crumbs=[{label:'Pedidos abertos',to:'/servicos'},{label:service?.title ?? 'Pedido'}];
  return <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
    <Breadcrumb items={crumbs} />
    {error==='missing' && <EmptyState as="h1" icon="search" title="Pedido não encontrado" description="Este pedido não existe ou foi removido." action={<Button to="/servicos">Ver pedidos abertos</Button>} />}
    {error==='failed' && <ErrorState title="Não foi possível carregar o pedido" message="Verifique sua conexão e tente novamente." onRetry={()=>setRetry(value=>value+1)} />}
    {!service && !error && <div role="status" aria-label="Carregando pedido" className="space-y-5"><Skeleton className="h-40 w-full rounded-card" /><Skeleton className="h-24 w-full rounded-card" /><Skeleton className="h-40 w-full rounded-card" /></div>}
    <div>
      {service && <article className="space-y-5">
        {service.images?.length>0 && <ul aria-label="Fotos do pedido" className="grid gap-2 sm:grid-cols-4">{service.images.map((url,index)=><li key={url} className={index===0?'sm:col-span-4':''}><img src={url} alt={'Foto '+(index+1)+' do pedido'} loading={index===0?'eager':'lazy'} className={'w-full rounded-card object-cover '+(index===0?'max-h-96':'aspect-square')} /></li>)}</ul>}
        <header className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-4 flex flex-wrap gap-2"><span className="rounded-full bg-primary-softer px-3 py-1 text-xs font-semibold text-primary-strong">{service.category?.name ?? 'Sem categoria'}</span><span className={'rounded-full px-3 py-1 text-xs font-semibold '+color}>{label}</span></div>
          <h1 className="break-words text-2xl font-bold sm:text-3xl">{service.title}</h1>
          <p className="mt-3 text-sm text-ink-muted">{description}</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-3">
          {[['Orçamento mínimo',money(service.budgetMin)],['Orçamento máximo',money(service.budgetMax)],['Prazo solicitado',date(service.deadline)]].map(([title,value])=><div key={title} className="rounded-control border border-line bg-white p-5"><p className="text-xs text-ink-muted">{title}</p><p className="mt-2 break-words font-semibold">{value}</p></div>)}
        </div>
        <section className="rounded-card border border-line bg-white p-6"><h2 className="mb-3 font-semibold">Sobre o pedido</h2><p className="whitespace-pre-wrap break-words leading-relaxed text-ink-soft">{service.description}</p></section>
        <section className="rounded-card border border-line bg-white p-6"><h2 className="mb-4 font-semibold">Publicado por</h2><div className="flex items-center gap-3">
          <Avatar src={service.client?.profilePictureUrl} name={fullName(service.client)} decorative />
          <p>{service.client?.firstName} {service.client?.lastName}{user?.uuid===service.client?.uuid && <span className="ml-2 text-sm text-primary-strong">(você)</span>}</p>
        </div></section>
        <section className="rounded-card border border-line bg-white p-6">
          <h2 className="mb-4 font-semibold">{service.status==='open'?'Participar deste pedido':'Acompanhamento'}</h2>
          <ServiceProposalActions uuid={uuid} status={service.status} />
          {user && ['in_progress','completed'].includes(service.status) && <ServiceWorkflowActions key={uuid+':'+user.uuid+':'+service.status} uuid={uuid} onCompleted={()=>setService(previous=>({...previous,status:'completed'}))} />}
        </section>
      </article>}
    </div>
  </main>;
}
