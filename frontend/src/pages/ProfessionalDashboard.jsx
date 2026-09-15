import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const proposalLabels = { pending: 'Pendente', accepted: 'Aceita', rejected: 'Rejeitada', withdrawn: 'Retirada' };
const serviceLabels = { draft: 'Rascunho', open: 'Aberto', in_progress: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado' };
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function DashboardList({ view, page, onPageChange }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/professionals/dashboard', { params: { view, page }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) { setResult(data); setError(''); } })
      .catch(err => {
        if (!controller.signal.aborted) setError(
          err.response?.status === 403 ? 'Esta área é exclusiva para profissionais.' :
          err.response?.status === 401 ? 'Sua sessão expirou. Entre novamente.' :
          'Não foi possível carregar seu painel.'
        );
      });
    return () => controller.abort();
  }, [view, page, retry]);

  if (error) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6">
    <p>{error}</p>
    <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 mr-4 font-semibold text-violet-700">Tentar novamente</button>
    <Link to="/login" className="text-violet-700">Entrar novamente</Link>
  </div>;
  if (!result) return <p role="status" className="py-12 text-center text-slate-500">Carregando painel...</p>;

  return <>
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {[
        ['Propostas enviadas', result.summary.sent],
        ['Propostas pendentes', result.summary.pending],
        ['Serviços em andamento', result.summary.active]
      ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-violet-700">{value}</p>
      </div>)}
    </div>
    {!result.data.length ? <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{view === 'services' ? 'Nenhum serviço em andamento' : 'Você ainda não enviou propostas'}</h2>
      <p className="mt-2 text-sm text-slate-500">{view === 'services' ? 'Os serviços aparecem aqui quando sua proposta é aceita e o trabalho está em andamento.' : 'Encontre um serviço e envie sua primeira proposta.'}</p>
      <Link to="/servicos" className="mt-5 inline-block font-semibold text-violet-700">Explorar serviços</Link>
    </div> : <ul className="space-y-4">
      {result.data.map(proposal => <li key={proposal.uuid} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to={'/servicos/' + proposal.service.uuid} className="text-lg font-semibold hover:text-violet-700">{proposal.service.title}</Link>
            <p className="mt-1 text-sm text-slate-500">Cliente: {proposal.service.client.firstName} {proposal.service.client.lastName}</p>
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">{proposalLabels[proposal.status]}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          <span>Valor proposto: {currency.format(Number(proposal.proposedPrice))}</span>
          {proposal.deliveryTimeDays != null && <span>Prazo: {proposal.deliveryTimeDays} dia(s)</span>}
          <span>Serviço: {serviceLabels[proposal.service.status]}</span>
          <span>Enviada em {new Date(proposal.createdAt).toLocaleDateString('pt-BR')}</span>
        </div>
        <Link to={'/servicos/' + proposal.service.uuid} className="mt-4 inline-block text-sm font-semibold text-violet-700">Ver serviço →</Link>
      </li>)}
    </ul>}
    {result.meta.pages > 1 && <nav aria-label="Paginação do painel" className="mt-6 flex items-center justify-center gap-4">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Anterior</button>
      <span className="text-sm">Página {page} de {result.meta.pages}</span>
      <button type="button" disabled={page >= result.meta.pages} onClick={() => onPageChange(page + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Próxima</button>
    </nav>}
  </>;
}

export default function ProfessionalDashboard() {
  const [view, setView] = useState('proposals');
  const [page, setPage] = useState(1);
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold sm:text-3xl">Meu painel profissional</h1>
          <p className="mt-2 text-slate-500">Acompanhe suas propostas e os serviços em andamento.</p></div>
        <Link to="/perfil/profissional" className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">Gerenciar perfil</Link>
      </header>
      <div className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar painel">
        {[['proposals', 'Propostas enviadas'], ['services', 'Serviços em andamento']].map(([value, label]) =>
          <button key={value} type="button" aria-pressed={view === value} onClick={() => { setView(value); setPage(1); }}
            className={'rounded-xl px-4 py-3 text-sm font-semibold ' + (view === value ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600')}>{label}</button>)}
      </div>
      <DashboardList key={view + ':' + page} view={view} page={page} onPageChange={setPage} />
    </div>
  </main>;
}
