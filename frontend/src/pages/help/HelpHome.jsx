import { useState } from 'react';
import { Link } from 'react-router-dom';
import { helpCategories } from '../../content/help/categories';
import { helpArticleBySlug, helpArticles } from '../../content/help/articles';
import { searchArticles } from '../../content/help/search';
import { CATEGORY_FAMILIES } from '../../utils/categoryColors';
import { Button, Card, controlClass } from '../../components/ui';

const HELP_COLORS = Object.values(CATEGORY_FAMILIES);

const POPULAR = ['criar-conta', 'solicitar-um-servico', 'comecar-a-oferecer-servicos', 'como-funciona-o-pagamento', 'esqueci-minha-senha', 'cancelar-um-pedido-ou-contratacao'];

export function ArticleLink({ article, showCategory = false }) {
  const category = helpCategories.find((item) => item.slug === article.category);
  return (
    <Link to={`/ajuda/artigo/${article.slug}`} className="block rounded-control p-3 hover:bg-surface-muted">
      <span className="block font-medium text-primary-strong">{article.title}</span>
      <span className="mt-0.5 block text-sm text-ink-muted">{article.summary}</span>
      {showCategory && <span className="mt-1 block text-xs text-ink-muted">{category?.title}</span>}
    </Link>
  );
}

export default function HelpHome() {
  const [query, setQuery] = useState('');
  const results = searchArticles(query);
  const searching = query.trim().length > 1;

  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Central de Ajuda</h1>
      <p className="mt-2 text-ink-muted">Respostas para as dúvidas mais comuns sobre o Dommos.</p>

      <form role="search" onSubmit={(event) => event.preventDefault()} className="mt-6">
        <label htmlFor="busca-ajuda" className="sr-only">Buscar na Central de Ajuda</label>
        <input id="busca-ajuda" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque por um assunto, como “cancelar” ou “senha”" className={`${controlClass()} !min-h-14 !rounded-full px-5 text-base`} autoComplete="off" />
      </form>

      {searching ? (
        <section aria-live="polite" aria-labelledby="resultados" className="mt-8">
          <h2 id="resultados" className="mb-3 text-lg font-semibold">{results.length ? `${results.length} ${results.length === 1 ? 'artigo encontrado' : 'artigos encontrados'}` : 'Nenhum artigo encontrado'}</h2>
          {results.length > 0 ? (
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">{results.map((article) => <li key={article.slug}><ArticleLink article={article} showCategory /></li>)}</ul>
          ) : (
            <Card className="text-sm text-ink-soft">Tente outras palavras ou escolha uma categoria. Se não achar o que precisa, <Link to="/ajuda/contato" className="font-semibold text-primary-strong underline underline-offset-2">fale com o suporte</Link>.</Card>
          )}
        </section>
      ) : (
        <>
          <section aria-labelledby="categorias" className="mt-10">
            <h2 id="categorias" className="mb-4 text-xl font-semibold">Categorias</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {helpCategories.map((category, index) => {
                const color = HELP_COLORS[index % HELP_COLORS.length];
                return (
                <li key={category.slug}>
                  <Link to={`/ajuda/categoria/${category.slug}`} className={`flex h-full items-start gap-4 rounded-card border border-line bg-surface p-5 shadow-card transition-colors ${color.hover}`}>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${color.chip}`}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={category.icon} /></svg></span>
                    <span><span className="block font-semibold">{category.title}</span><span className="mt-0.5 block text-sm text-ink-muted">{category.description}</span><span className="mt-1 block text-xs text-ink-muted">{helpArticles.filter((article) => article.category === category.slug).length} artigos</span></span>
                  </Link>
                </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="populares" className="mt-10">
            <h2 id="populares" className="mb-3 text-xl font-semibold">Artigos populares</h2>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {POPULAR.map((slug) => <li key={slug}><ArticleLink article={helpArticleBySlug[slug]} /></li>)}
            </ul>
          </section>
        </>
      )}

      <Card className="mt-10 flex flex-wrap items-center justify-between gap-4 bg-primary-softer">
        <div><h2 className="font-semibold">Não encontrou o que procurava?</h2><p className="mt-1 text-sm text-ink-soft">Conte o que aconteceu e a gente responde.</p></div>
        <Button to="/ajuda/contato">Falar com o suporte</Button>
      </Card>
    </main>
  );
}
