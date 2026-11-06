import { useParams } from 'react-router-dom';
import { helpCategories } from '../../content/help/categories';
import { helpArticles } from '../../content/help/articles';
import { Breadcrumb, Button, EmptyState } from '../../components/ui';
import { ArticleLink } from './HelpHome';

export default function HelpCategory() {
  const { slug } = useParams();
  const category = helpCategories.find((item) => item.slug === slug);
  if (!category) {
    return <main className="mx-auto max-w-content px-4 py-10 sm:px-6"><Breadcrumb items={[{ label: 'Central de Ajuda', to: '/ajuda' }, { label: 'Categoria' }]} /><EmptyState icon="search" title="Categoria não encontrada" action={<Button to="/ajuda">Voltar à Central de Ajuda</Button>} /></main>;
  }
  const articles = helpArticles.filter((article) => article.category === slug);
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Central de Ajuda', to: '/ajuda' }, { label: category.title }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">{category.title}</h1>
      <p className="mb-6 mt-2 text-ink-muted">{category.description}</p>
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">{articles.map((article) => <li key={article.slug}><ArticleLink article={article} /></li>)}</ul>
    </main>
  );
}
