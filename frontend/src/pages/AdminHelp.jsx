import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { apiError } from '../services/api';
import { formatDay } from '../utils/format';
import { helpArticleBySlug } from '../content/help/articles';
import { Breadcrumb, Card, EmptyState, ErrorState, Select, SkeletonList } from '../components/ui';

const PERIODS = [['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias']];

function Stat({ label, value, note }) {
  return <Card><p className="text-sm text-ink-muted">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>{note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}</Card>;
}

/** O que as pessoas perguntaram ao assistente de ajuda: sem resposta (artigos a criar) e como cada artigo foi avaliado. */
export default function AdminHelp() {
  const [days, setDays] = useState('30');
  const resource = useApiResource('/admin/help-assistant', { days }, { keepPrevious: true });
  const data = resource.data;
  const rated = data ? data.helpful + data.notHelpful : 0;

  return (
    <main className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: 'Administração', to: '/admin/pagamentos' }, { label: 'Assistente de ajuda' }]} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Assistente de ajuda</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">Perguntas feitas no botão “Ajuda”. As que ficaram sem resposta mostram quais artigos vale criar. Nenhuma pessoa é identificada: e-mails, telefones e documentos são removidos antes de gravar.</p>
        </div>
        <Select label="Período" value={days} onChange={(event) => setDays(event.target.value)} wrapperClassName="w-48">
          {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>

      <div className="mt-8">
        {!data && resource.loading ? <SkeletonList count={3} label="Carregando o relatório" itemClassName="h-28" />
          : resource.error ? <ErrorState title="Não foi possível carregar o relatório" message={apiError(resource.error)} onRetry={resource.retry} />
            : data.total === 0 ? <EmptyState icon="chat" title="Ninguém perguntou ainda" description="Quando alguém usar o assistente de ajuda, as perguntas aparecem aqui." />
              : (
                <div className="space-y-10">
                  <section aria-label="Resumo" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Perguntas" value={data.total} />
                    <Stat label="Com resposta" value={data.answered} note={`${Math.round((data.answered / data.total) * 100)}% do total`} />
                    <Stat label="Sem resposta" value={data.unansweredTotal} note="Artigos a criar" />
                    <Stat label="Ajudou" value={rated ? `${Math.round((data.helpful / rated) * 100)}%` : '—'} note={rated ? `${data.helpful} sim, ${data.notHelpful} não` : 'Ainda sem avaliações'} />
                  </section>

                  <section aria-labelledby="sem-resposta">
                    <h2 id="sem-resposta" className="mb-1 text-xl font-semibold">Perguntas sem resposta</h2>
                    <p className="mb-4 text-sm text-ink-muted">As mais repetidas primeiro. Cada uma é um assunto que a Central de Ajuda ainda não cobre.</p>
                    {data.unanswered.length === 0 ? <EmptyState icon="list" title="Nenhuma pergunta sem resposta" description="Tudo o que perguntaram tinha um artigo." /> : (
                      <div className="overflow-x-auto rounded-card border border-line">
                        <table className="w-full min-w-[30rem] text-left text-sm">
                          <thead className="bg-surface-muted text-ink-soft"><tr><th scope="col" className="p-3 font-medium">Pergunta</th><th scope="col" className="p-3 font-medium">Vezes</th><th scope="col" className="p-3 font-medium">Última vez</th></tr></thead>
                          <tbody>{data.unanswered.map((row) => <tr key={row.question} className="border-t border-line"><td className="break-words p-3">{row.question}</td><td className="p-3 font-semibold">{row.count}</td><td className="p-3 text-ink-muted">{formatDay(row.lastAt)}</td></tr>)}</tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section aria-labelledby="artigos">
                    <h2 id="artigos" className="mb-1 text-xl font-semibold">Artigos mais mostrados</h2>
                    <p className="mb-4 text-sm text-ink-muted">Os que mais receberam “Não” aparecem primeiro: vale revisar o texto.</p>
                    {data.articles.length === 0 ? <EmptyState icon="list" title="Nenhum artigo mostrado no período" description="Os artigos aparecem aqui depois que o assistente responder com eles." /> : (
                      <div className="overflow-x-auto rounded-card border border-line">
                        <table className="w-full min-w-[34rem] text-left text-sm">
                          <thead className="bg-surface-muted text-ink-soft"><tr><th scope="col" className="p-3 font-medium">Artigo</th><th scope="col" className="p-3 font-medium">Mostrado</th><th scope="col" className="p-3 font-medium">Sim</th><th scope="col" className="p-3 font-medium">Não</th></tr></thead>
                          <tbody>{data.articles.map((row) => <tr key={row.slug} className="border-t border-line"><td className="p-3">{helpArticleBySlug[row.slug] ? <Link to={`/ajuda/artigo/${row.slug}`} className="font-medium text-primary-strong underline-offset-2 hover:underline">{helpArticleBySlug[row.slug].title}</Link> : row.slug}</td><td className="p-3">{row.asked}</td><td className="p-3 text-success">{row.helpful}</td><td className="p-3 text-danger">{row.notHelpful}</td></tr>)}</tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}
      </div>
    </main>
  );
}
