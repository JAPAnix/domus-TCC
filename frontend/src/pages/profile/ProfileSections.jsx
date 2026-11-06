import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useApiResource } from '../../hooks/useApiResource';
import { apiError } from '../../services/api';
import { formatDay, fullName } from '../../utils/format';
import { roleLabel } from '../../utils/roles';
import Pagination from '../../components/Pagination';
import { Avatar, Breadcrumb, Button, Card, EmptyState, ErrorState, SkeletonList } from '../../components/ui';

function Chips({ items }) {
  return <ul className="mt-1 flex flex-wrap gap-2">{items.map((item) => <li key={item} className="rounded-full bg-primary-soft px-3 py-1 text-sm text-primary-strong">{item}</li>)}</ul>;
}

function Details({ profile }) {
  const rows = [
    ['Cidade onde moro', [profile.city, profile.state].filter(Boolean).join(', ')],
    ['Meu trabalho', profile.profession],
    ['Anos de experiência', profile.yearsExperience != null ? `${profile.yearsExperience} ${profile.yearsExperience === 1 ? 'ano' : 'anos'}` : ''],
    ['Onde estudei', profile.school],
    ['Curiosidade sobre mim', profile.funFact],
    ['Idiomas que falo', profile.languages],
    ['Habilidades', profile.skills],
    ['Áreas de atuação', profile.serviceAreas],
    ['Interesses', profile.interests],
  ].filter(([, value]) => (Array.isArray(value) ? value.length : value));
  if (!rows.length) return null;
  return (
    <dl className="divide-y divide-line">
      {rows.map(([label, value]) => (
        <div key={label} className="py-4">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium">{Array.isArray(value) ? <Chips items={value} /> : value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileAbout() {
  const resource = useApiResource('/profile/me', undefined, { keepPrevious: true });
  const profile = resource.data;

  if (!profile && resource.loading) return <SkeletonList count={2} label="Carregando perfil" itemClassName="h-48" />;
  if (resource.error) return <ErrorState title="Não foi possível carregar seu perfil" message={apiError(resource.error)} onRetry={resource.retry} />;

  const name = fullName(profile);
  const { completion } = profile;
  const isProfessional = profile.roles.includes('professional');
  return (
    <div className="grid gap-8 md:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card className="text-center">
          <Avatar src={profile.profilePictureUrl} name={name} size="xl" className="mx-auto" />
          <h2 className="mt-4 break-words text-xl font-semibold">{name}</h2>
          <p className="mt-1 text-sm text-ink-muted">{roleLabel(profile.roles)}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Button to="/perfil/editar">Editar</Button>
            <Button to={`/usuarios/${profile.uuid}`} variant="secondary">Ver como os outros veem</Button>
          </div>
        </Card>

        {completion.done < completion.total && (
          <Card as="section" aria-labelledby="preencha">
            <h2 id="preencha" className="font-semibold">Preencha seu perfil</h2>
            <p className="mt-1 text-sm text-ink-muted">Um perfil completo ajuda profissionais e clientes a conhecerem você.</p>
            <div role="progressbar" aria-label="Perfil preenchido" aria-valuemin={0} aria-valuemax={completion.total} aria-valuenow={completion.done} className="mt-4 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(completion.done / completion.total) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-muted">{completion.done} de {completion.total} itens · falta: {completion.missing.join(', ')}</p>
            <Button to="/perfil/editar" variant="secondary" className="mt-4" block>Preencher agora</Button>
          </Card>
        )}

        <Card as="nav" aria-label="Avaliações" className="space-y-1 !p-3">
          <Link to="/perfil/avaliacoes-escritas" className="flex min-h-control items-center rounded-control px-3 text-sm font-medium text-primary-strong hover:bg-primary-soft">Mostrar avaliações que escrevi</Link>
          {isProfessional && <Link to="/perfil/avaliacoes" className="flex min-h-control items-center rounded-control px-3 text-sm font-medium text-primary-strong hover:bg-primary-soft">Avaliações que recebi</Link>}
        </Card>
      </div>

      <section aria-labelledby="sobre-mim">
        <h2 id="sobre-mim" className="mb-3 text-xl font-semibold">Sobre mim</h2>
        {profile.about
          ? <p className="mb-6 whitespace-pre-line break-words leading-7 text-ink-soft">{profile.about}</p>
          : <p className="mb-6 rounded-card border border-dashed border-line-strong bg-surface p-5 text-sm text-ink-muted">Conte um pouco sobre você, sua rotina e o que você valoriza. <Link to="/perfil/editar" className="font-semibold text-primary-strong underline underline-offset-2">Escrever introdução</Link></p>}
        <Details profile={profile} />
        <p className="mt-6 text-sm text-ink-muted">Membro desde {formatDay(profile.createdAt, { month: 'long', year: 'numeric' })}. Seu e-mail e telefone ficam em <Link to="/configuracoes/pessoais" className="font-semibold text-primary-strong underline underline-offset-2">Configurações da conta</Link> e não aparecem no perfil público.</p>
      </section>
    </div>
  );
}

export function ProfileConnections() {
  const resource = useApiResource('/profile/me/connections');
  if (resource.loading) return <SkeletonList count={3} label="Carregando conexões" itemClassName="h-24" className="grid gap-4 sm:grid-cols-2" />;
  if (resource.error) return <ErrorState title="Não foi possível carregar suas conexões" message={apiError(resource.error)} onRetry={resource.retry} />;
  if (!resource.data.length) {
    return <EmptyState icon="chat" title="Você ainda não tem conexões" description="Elas aparecem aqui quando você contrata alguém, ou é contratado, e o serviço é aceito." action={<Button to="/buscar">Explorar serviços</Button>} />;
  }
  return (
    <>
      <p className="mb-4 text-sm text-ink-muted">Pessoas com quem você já fechou negócio.</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {resource.data.map((person) => (
          <li key={person.uuid}>
            <Link to={`/usuarios/${person.uuid}`} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-primary">
              <Avatar src={person.profilePictureUrl} name={person.name} size="lg" decorative />
              <div className="min-w-0">
                <p className="truncate font-semibold">{person.name}</p>
                <p className="text-sm text-ink-muted">{person.isProfessional ? 'Profissional' : 'Cliente'}{person.location ? ` · ${person.location}` : ''}</p>
                <p className="text-xs text-ink-muted">{person.count} {person.count === 1 ? 'serviço' : 'serviços'} juntos · último em {formatDay(person.lastAt)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function usePageParam() {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('pagina') || 1);
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  return [page, (next) => setParams({ pagina: String(next) })];
}

function ReviewsPage({ crumb, title, resource, page, setPage, personOf, emptyIcon = 'star', emptyTitle, emptyText, emptyAction }) {
  const reviews = resource.data?.data ?? [];
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Perfil', to: '/perfil/sobre' }, { label: crumb }]} />
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{title}</h1>
      {resource.loading ? <SkeletonList count={3} label="Carregando avaliações" itemClassName="h-24" />
        : resource.error ? <ErrorState title="Não foi possível carregar as avaliações" message={apiError(resource.error)} onRetry={resource.retry} />
          : !reviews.length ? <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyText} action={emptyAction} />
            : (
              <>
                <ul className="divide-y divide-line rounded-card border border-line bg-surface">
                  {reviews.map((review) => {
                    const person = personOf(review);
                    return (
                      <li key={review.id} className="p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {person.to ? <Link to={person.to} className="font-semibold text-primary-strong underline-offset-2 hover:underline">{person.name}</Link> : <p className="font-semibold">{person.name}</p>}
                          <span className="text-sm font-semibold" aria-label={`Nota ${review.rating} de 5`}><span aria-hidden="true" className="text-rating">★</span> {review.rating}/5</span>
                        </div>
                        <p className="text-xs text-ink-muted">{formatDay(review.createdAt)}{review.context ? ` · ${review.context}` : ''}</p>
                        {review.comment && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{review.comment}</p>}
                      </li>
                    );
                  })}
                </ul>
                <Pagination page={page} pages={resource.data.meta.pages} onChange={setPage} label="Páginas de avaliações" />
              </>
            )}
    </main>
  );
}

/** Avaliações que o usuário recebeu (quando é profissional). */
export function ReceivedReviews() {
  const { user } = useAuth();
  const [page, setPage] = usePageParam();
  const resource = useApiResource(`/users/${user.uuid}/reviews`, { page, limit: 10 });
  return (
    <ReviewsPage
      crumb="Avaliações que recebi" title="Avaliações que recebi" resource={resource} page={page} setPage={setPage}
      personOf={(review) => ({ name: fullName(review.reviewer) || 'Nome não informado' })}
      emptyTitle="Você ainda não recebeu avaliações" emptyText="Elas aparecem depois que um serviço é concluído e o cliente avalia."
    />
  );
}

/** Avaliações que o usuário escreveu. */
export function WrittenReviews() {
  const [page, setPage] = usePageParam();
  const resource = useApiResource('/profile/me/reviews-written', { page, limit: 10 });
  return (
    <ReviewsPage
      crumb="Avaliações que escrevi" title="Avaliações que escrevi" resource={resource} page={page} setPage={setPage}
      personOf={(review) => ({ name: review.reviewed.name, to: `/usuarios/${review.reviewed.uuid}` })}
      emptyTitle="Você ainda não escreveu avaliações" emptyText="Depois que um serviço for concluído, você pode avaliar a outra pessoa."
      emptyAction={<Button to="/meus-servicos">Ver meus pedidos</Button>}
    />
  );
}
