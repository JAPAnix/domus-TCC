import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { apiError } from '../../services/api';
import { helpCategories } from '../../content/help/categories';
import { helpArticleBySlug } from '../../content/help/articles';
import { Breadcrumb, Button, Card, EmptyState, useToast } from '../../components/ui';
import { ArticleLink } from './HelpHome';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

function Blocks({ blocks }) {
  return blocks.map(([type, content, path], index) => {
    if (type === 'p') return <p key={index} className="leading-7 text-ink-soft">{content}</p>;
    if (type === 'h') return <h2 key={index} className="pt-2 text-lg font-semibold">{content}</h2>;
    if (type === 'ul') return <ul key={index} className="list-disc space-y-1.5 pl-6 leading-7 text-ink-soft">{content.map((item) => <li key={item}>{item}</li>)}</ul>;
    if (type === 'ol') return <ol key={index} className="list-decimal space-y-1.5 pl-6 leading-7 text-ink-soft">{content.map((item) => <li key={item}>{item}</li>)}</ol>;
    if (type === 'tip') return <p key={index} className="rounded-control border border-primary-line bg-primary-softer p-4 text-sm leading-6 text-ink-soft"><strong className="text-primary-strong">Dica: </strong>{content}</p>;
    if (type === 'link') return <p key={index}><Button to={path} variant="secondary">{content}</Button></p>;
    return null;
  });
}

const storageKey = (slug) => `dommos:ajuda:util:${slug}`;
function readAnswer(slug) {
  try { return sessionStorage.getItem(storageKey(slug)); } catch { return null; }
}

function Feedback({ slug }) {
  const toast = useToast();
  const [answer, setAnswer] = useState(() => readAnswer(slug));
  const [busy, setBusy] = useState(false);

  async function send(helpful) {
    setBusy(true);
    try {
      await api.post('/help/feedback', { slug, helpful });
      try { sessionStorage.setItem(storageKey(slug), helpful ? 'sim' : 'nao'); } catch { /* sem armazenamento: só não lembra */ }
      setAnswer(helpful ? 'sim' : 'nao');
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível registrar sua resposta.'));
    } finally {
      setBusy(false);
    }
  }

  if (answer) {
    return (
      <p role="status" className="text-sm text-ink-soft">
        {answer === 'sim' ? 'Obrigado pela resposta! Ficamos felizes em ajudar.' : <>Obrigado por avisar. Se quiser, <Link to="/ajuda/contato" className="font-semibold text-primary-strong underline underline-offset-2">fale com o suporte</Link> para que a gente ajude.</>}
      </p>
    );
  }
  return (
    <div role="group" aria-labelledby="util" className="flex flex-wrap items-center gap-3">
      <p id="util" className="font-medium">Isso foi útil?</p>
      <Button variant="secondary" size="sm" onClick={() => send(true)} disabled={busy}>Sim</Button>
      <Button variant="secondary" size="sm" onClick={() => send(false)} disabled={busy}>Não</Button>
    </div>
  );
}

export default function HelpArticle() {
  const { slug } = useParams();
  const article = helpArticleBySlug[slug];
  useDocumentMeta({ title: article ? article.title : 'Artigo não encontrado', description: article?.summary });
  if (!article) {
    return <main className="mx-auto max-w-content px-4 py-10 sm:px-6"><Breadcrumb items={[{ label: 'Central de Ajuda', to: '/ajuda' }, { label: 'Artigo' }]} /><EmptyState icon="search" title="Artigo não encontrado" description="Ele pode ter mudado de lugar. Tente buscar pelo assunto." action={<Button to="/ajuda">Buscar na Central de Ajuda</Button>} /></main>;
  }
  const category = helpCategories.find((item) => item.slug === article.category);
  const related = (article.related ?? []).map((relatedSlug) => helpArticleBySlug[relatedSlug]).filter(Boolean);
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Central de Ajuda', to: '/ajuda' }, { label: category.title, to: `/ajuda/categoria/${category.slug}` }, { label: article.title }]} />
      <article className="max-w-3xl">
        <h1 className="text-2xl font-bold sm:text-3xl">{article.title}</h1>
        <p className="mt-2 text-lg text-ink-muted">{article.summary}</p>
        <div className="mt-6 space-y-4"><Blocks blocks={article.body} /></div>
      </article>

      <div className="mt-10 max-w-3xl border-t border-line pt-6"><Feedback key={slug} slug={slug} /></div>

      {related.length > 0 && (
        <section aria-labelledby="relacionados" className="mt-10 max-w-3xl">
          <h2 id="relacionados" className="mb-3 text-lg font-semibold">Artigos relacionados</h2>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">{related.map((item) => <li key={item.slug}><ArticleLink article={item} /></li>)}</ul>
        </section>
      )}

      <Card className="mt-10 flex max-w-3xl flex-wrap items-center justify-between gap-4 bg-primary-softer">
        <p className="font-medium">Ainda com dúvida?</p>
        <Button to={`/ajuda/contato?assunto=${article.category}`}>Falar com o suporte</Button>
      </Card>
    </main>
  );
}
