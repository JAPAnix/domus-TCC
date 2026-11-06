import { useParams } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { useFavoriteItems } from '../hooks/useFavoriteStatus';
import { apiError } from '../services/api';
import ProfessionalMiniCard from '../components/ProfessionalMiniCard';
import { Breadcrumb, Button, EmptyState, ErrorState, SkeletonList } from '../components/ui';

export default function FavoriteList() {
  const { id } = useParams();
  const resource = useApiResource(`/favorites/lists/${id}`, undefined, { keepPrevious: true });
  const items = resource.data?.items ?? [];
  const status = useFavoriteItems(items);
  const crumbs = [{ label: 'Favoritos', to: '/favoritos' }, { label: resource.data?.name ?? 'Lista' }];

  return (
    <main className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumb items={crumbs} />
      {!resource.data && resource.loading ? (
        <SkeletonList count={4} label="Carregando lista" itemClassName="h-56" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" />
      ) : resource.error ? (
        resource.error.response?.status === 404
          ? <EmptyState as="h1" icon="search" title="Lista não encontrada" description="Ela pode ter sido excluída." action={<Button to="/favoritos">Voltar aos favoritos</Button>} />
          : <ErrorState title="Não foi possível carregar a lista" message={apiError(resource.error)} onRetry={resource.retry} />
      ) : (
        <>
          <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{resource.data.name}</h1>
          {items.length === 0 ? (
            <EmptyState icon="heart" title="Esta lista está vazia" description="Toque no coração de um serviço ou profissional e escolha esta lista para salvá-lo aqui." action={<Button to="/buscar">Explorar serviços</Button>} />
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => <li key={`${item.type}-${item.uuid}`}><ProfessionalMiniCard item={item} saved={status.isSaved(item)} onSavedChange={(value) => { status.mark(item, value); resource.retry(); }} /></li>)}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
