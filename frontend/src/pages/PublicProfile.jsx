import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useAuth } from '../context/useAuth';
import { useApiResource } from '../hooks/useApiResource';
import { useFavoriteStatus } from '../hooks/useFavoriteStatus';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { formatDay } from '../utils/format';
import { roleLabel } from '../utils/roles';
import FavoriteButton from '../components/FavoriteButton';
import ListingCard from '../components/ListingCard';
import { Avatar, Breadcrumb, Button, Card, ConfirmDialog, EmptyState, ErrorState, Skeleton, SkeletonList, useToast } from '../components/ui';

function Section({ title, children }) {
  return <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">{title}</h2>{children}</section>;
}

function Chips({ items }) {
  return <ul className="flex flex-wrap gap-2">{items.map((item) => <li key={item} className="rounded-full bg-primary-soft px-3 py-1 text-sm text-primary-strong">{item}</li>)}</ul>;
}

function OwnerListings({ uuid }) {
  const resource = useApiResource('/listings/search', { ownerUuid: uuid, limit: 12 });
  const items = resource.data?.data ?? [];
  const favorites = useFavoriteStatus('listing', items.map((item) => item.uuid));
  if (resource.loading) return <SkeletonList count={3} label="Carregando serviços" itemClassName="h-64" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />;
  if (resource.error) return <ErrorState title="Não foi possível carregar os serviços" message={apiError(resource.error)} onRetry={resource.retry} />;
  if (!items.length) return <p className="rounded-card border border-dashed border-line-strong bg-surface p-5 text-sm text-ink-muted">Este profissional não tem serviços publicados no momento.</p>;
  return <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <li key={item.uuid}><ListingCard listing={item} saved={favorites.isSaved(item.uuid)} onSavedChange={(value) => favorites.mark(item.uuid, value)} /></li>)}</ul>;
}

function ReviewList({ url, empty }) {
  const resource = useApiResource(url, { page: 1, limit: 5 });
  if (resource.loading) return <SkeletonList count={2} label="Carregando avaliações" itemClassName="h-16" className="space-y-3" />;
  if (resource.error) return <p role="alert" className="text-sm text-danger">{apiError(resource.error, 'Não foi possível carregar as avaliações.')} <button type="button" onClick={resource.retry} className="font-semibold underline">Tentar novamente</button></p>;
  const reviews = resource.data.data;
  if (!reviews.length) return <p className="text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {reviews.map((review) => {
        const person = review.reviewer ?? review.reviewed;
        const name = person.name ?? [person.firstName, person.lastName].filter(Boolean).join(' ');
        return (
          <li key={review.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{name}</p>
              <span className="text-sm font-semibold" aria-label={`Nota ${review.rating} de 5`}><span aria-hidden="true" className="text-rating">★</span> {review.rating}/5</span>
            </div>
            <p className="text-xs text-ink-muted">{formatDay(review.createdAt)}</p>
            {review.comment && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{review.comment}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export default function PublicProfile() {
  const { uuid } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const resource = useApiResource(`/profile/${uuid}`, undefined, { keepPrevious: false });
  const profile = resource.data;
  useDocumentMeta({ title: profile?.name ?? (resource.error ? 'Perfil não encontrado' : 'Perfil'), description: profile && !profile.restricted ? profile.about?.slice(0, 150) || `Perfil de ${profile.name} no Dommos.` : undefined });
  const [showWritten, setShowWritten] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const isProfessional = !!profile?.isProfessional;
  const status = useFavoriteStatus('professional', isProfessional && !profile.isSelf ? [uuid] : []);

  // Registra a visita para a lista automática "Vistos recentemente".
  useEffect(() => {
    if (user && isProfessional && !profile.isSelf) api.post('/favorites/recent', { type: 'professional', uuid }).catch(() => {});
  }, [user, isProfessional, profile?.isSelf, uuid]);

  async function toggleBlock() {
    setBusy(true);
    try {
      if (profile.viewerBlocked) await api.delete(`/blocks/${uuid}`);
      else await api.post('/blocks', { user_uuid: uuid });
      toast.success(profile.viewerBlocked ? 'Usuário desbloqueado.' : 'Usuário bloqueado.');
      resource.retry();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível concluir.'));
    } finally {
      setBusy(false);
      setConfirmBlock(false);
    }
  }

  const crumbs = [{ label: 'Início', to: '/' }, { label: profile?.name ?? 'Perfil' }];
  if (resource.loading) {
    return <main className="mx-auto max-w-content px-4 py-10 sm:px-6"><Breadcrumb items={crumbs} /><div role="status" aria-label="Carregando perfil" className="space-y-4"><Skeleton className="h-40 w-full rounded-card" /><Skeleton className="h-32 w-full rounded-card" /></div></main>;
  }
  if (resource.error) {
    const missing = resource.error.response?.status === 404;
    return (
      <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
        <Breadcrumb items={crumbs} />
        {missing ? <EmptyState as="h1" icon="search" title="Perfil não encontrado" description="Esta pessoa não existe ou o perfil não está disponível." action={<Button to="/buscar">Buscar profissionais</Button>} />
          : <ErrorState title="Não foi possível carregar o perfil" message={apiError(resource.error)} onRetry={resource.retry} />}
      </main>
    );
  }

  const roles = [...(isProfessional ? ['professional'] : []), 'client'];
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const details = [['Meu trabalho', profile.profession], ['Anos de experiência', profile.yearsExperience != null ? `${profile.yearsExperience} ${profile.yearsExperience === 1 ? 'ano' : 'anos'}` : ''], ['Onde estudei', profile.school], ['Curiosidade', profile.funFact]].filter(([, value]) => value);

  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={crumbs} />
      <Card as="header">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar src={profile.profilePictureUrl} name={profile.name} size="xl" decorative />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-bold">{profile.name}</h1>
            {!profile.restricted && <p className="mt-1 text-sm text-ink-muted">{roleLabel(roles)}{location ? ` · ${location}` : ''}</p>}
            {!profile.restricted && <p className="text-sm text-ink-muted">Membro desde {formatDay(profile.memberSince, { month: 'long', year: 'numeric' })}</p>}
            {isProfessional && profile.professional && (
              <p className="mt-2 text-sm font-medium">
                {profile.professional.totalReviews ? <><span aria-hidden="true" className="text-rating">★</span> {profile.professional.averageRating.toFixed(1)} <span className="font-normal text-ink-muted">· {profile.professional.totalReviews} {profile.professional.totalReviews === 1 ? 'avaliação' : 'avaliações'}</span></> : <span className="text-ink-muted">Ainda sem avaliações</span>}
                {profile.professional.isVerified && <span className="ml-2 rounded-full bg-info-soft px-2.5 py-1 text-xs font-semibold text-info">Verificado</span>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile.isSelf && <Button to="/perfil/editar" variant="secondary">Editar meu perfil</Button>}
            {isProfessional && !profile.isSelf && !profile.restricted && <FavoriteButton uuid={uuid} name={profile.name} saved={status.isSaved(uuid)} onChange={(value) => status.mark(uuid, value)} className="border border-line" />}
          </div>
        </div>
      </Card>

      {profile.restricted ? (
        <div className="mt-6">
          <EmptyState icon="alert" title="Este perfil é restrito" description={profile.restrictedReason} action={!user && <Button onClick={() => navigate('/login', { state: { from: `/usuarios/${uuid}` } })}>Entrar</Button>} />
        </div>
      ) : (
        <>
          {profile.about && <Section title="Sobre"><p className="whitespace-pre-line break-words leading-7 text-ink-soft">{profile.about}</p></Section>}
          {details.length > 0 && (
            <Section title="Informações">
              <dl className="divide-y divide-line rounded-card border border-line bg-surface">
                {details.map(([label, value]) => <div key={label} className="flex flex-wrap gap-x-4 px-4 py-3"><dt className="w-44 text-sm text-ink-muted">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>)}
              </dl>
            </Section>
          )}
          {profile.languages.length > 0 && <Section title="Idiomas"><Chips items={profile.languages} /></Section>}
          {profile.skills.length > 0 && <Section title="Habilidades"><Chips items={profile.skills} /></Section>}
          {profile.serviceAreas.length > 0 && <Section title="Áreas de atuação"><Chips items={profile.serviceAreas} /></Section>}
          {profile.interests.length > 0 && <Section title="Interesses"><Chips items={profile.interests} /></Section>}

          {isProfessional && (
            <Section title="Serviços">
              {profile.professional.headline && <p className="mb-3 text-sm text-ink-soft">{profile.professional.headline}</p>}
              <OwnerListings uuid={uuid} />
              <div className="mt-4"><h3 className="mb-2 text-sm font-semibold">Avaliações recebidas</h3><ReviewList url={`/users/${uuid}/reviews`} empty="Ainda não há avaliações." /></div>
            </Section>
          )}

          {profile.showsWrittenReviews && (
            <Section title="Avaliações que escreveu">
              {showWritten ? <ReviewList url={`/profile/${uuid}/reviews-written`} empty="Esta pessoa ainda não escreveu avaliações." /> : <Button variant="secondary" onClick={() => setShowWritten(true)}>Mostrar avaliações que {profile.isSelf ? 'escrevi' : 'esta pessoa escreveu'}</Button>}
            </Section>
          )}
        </>
      )}

      {user && !profile.isSelf && (
        <div className="mt-10 border-t border-line pt-6">
          <Button variant="ghost" onClick={() => (profile.viewerBlocked ? toggleBlock() : setConfirmBlock(true))} loading={busy && profile.viewerBlocked}>{profile.viewerBlocked ? 'Desbloquear esta pessoa' : 'Bloquear esta pessoa'}</Button>
          <p className="mt-1 text-xs text-ink-muted">Pessoas bloqueadas não veem o seu perfil nem enviam propostas aos seus pedidos. Você gerencia a lista em <Link to="/configuracoes/privacidade" className="underline">Privacidade</Link>.</p>
        </div>
      )}
      <ConfirmDialog open={confirmBlock} danger busy={busy} title="Bloquear esta pessoa" confirmLabel="Bloquear" message={`${profile.name} deixará de ver o seu perfil e não poderá enviar propostas aos seus pedidos. Você pode desbloquear quando quiser.`} onConfirm={toggleBlock} onCancel={() => setConfirmBlock(false)} />
    </main>
  );
}
