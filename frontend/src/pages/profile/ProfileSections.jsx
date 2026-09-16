import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const buttonStyle = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]';

// Tie each response to its request and account, including navigation and retries.
function useProfileResource(url) {
  const { user } = useAuth();
  const uuid = user?.uuid;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api.get(url, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ url, uuid, attempt, data });
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ url, uuid, attempt, error });
    });
    return () => controller.abort();
  }, [url, uuid, attempt]);
  const current = result?.url === url && result?.uuid === uuid && result?.attempt === attempt;
  return { data: current ? result.data : null, error: current ? result.error : null, loading: !current, retry: () => setAttempt((value) => value + 1) };
}

function ResourceStatus({ resource }) {
  if (resource.loading) return <p role="status" className="py-10 text-sm text-[#6B7280]">Carregando informações...</p>;
  if (resource.error) return (
    <div role="alert" className="my-6 rounded-xl border border-[#E5E7EB] bg-white p-6">
      <p className="text-sm text-[#374151]">Não foi possível carregar estas informações.</p>
      <button type="button" onClick={resource.retry} className={`${buttonStyle} mt-4`}>Tentar novamente</button>
    </div>
  );
  return null;
}

function Avatar({ person }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
  const initials = [person.firstName, person.lastName].filter(Boolean).map((part) => part.trim()[0]).join('').toUpperCase() || '?';
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EDE9FE] text-3xl font-semibold text-[#7C3AED]">
      {person.profilePictureUrl && person.profilePictureUrl !== failedUrl ? (
        <img src={person.profilePictureUrl} alt={`Foto de ${name || 'perfil'}`} onError={() => setFailedUrl(person.profilePictureUrl)} className="h-full w-full object-cover" />
      ) : <span aria-label={`Iniciais de ${name || 'perfil'}`}>{initials}</span>}
    </div>
  );
}

function InformationList({ fields }) {
  return <dl className="grid gap-x-8 sm:grid-cols-2">{fields.map(([label, value]) => (
    <div key={label} className="border-b border-[#E5E7EB] py-5">
      <dt className="text-sm text-[#6B7280]">{label}</dt>
      <dd className="mt-2 break-words text-sm font-medium text-[#111827]">{value ?? 'Não informado'}</dd>
    </div>
  ))}</dl>;
}

function formatDate(value, options) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleDateString('pt-BR', options);
}

export function ProfileAbout() {
  const resource = useProfileResource('/auth/me');
  const person = resource.data;
  const isClient = person?.roles?.includes('client');
  const isProfessional = person?.roles?.includes('professional');
  const role = isClient && isProfessional ? 'Cliente e profissional' : isProfessional ? 'Profissional' : isClient ? 'Cliente' : null;
  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2 id="profile-section-title" className="text-2xl font-semibold text-[#111827]">Sobre mim</h2>
        <Link to="/configuracoes/pessoais" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#7C3AED] hover:bg-[#EDE9FE] focus-visible:outline-2 focus-visible:outline-[#7C3AED]">Editar</Link>
      </div>
      <ResourceStatus resource={resource} />
      {person && (
        <>
          <div className="grid gap-8 xl:grid-cols-2">
            <div className="flex min-w-0 flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-6 py-10 text-center shadow-sm">
              <Avatar person={person} />
              <h3 className="mt-5 max-w-full break-words text-xl font-semibold text-[#111827]">{[person.firstName, person.lastName].filter(Boolean).join(' ') || 'Nome não informado'}</h3>
              {role && <p className="mt-2 text-sm text-[#6B7280]">{role}</p>}
            </div>
            <div className="flex flex-col items-start justify-center py-3">
              <h3 className="text-xl font-semibold text-[#111827]">Complete seu perfil</h3>
              <p className="mt-3 text-sm leading-7 text-[#6B7280]">Complete seu perfil para ajudar profissionais e clientes a conhecerem você melhor.</p>
              <Link to="/configuracoes/pessoais" className={`${buttonStyle} mt-6`}>Completar perfil</Link>
            </div>
          </div>
          <div className="mt-10">
            <h3 className="text-lg font-semibold text-[#111827]">Informações</h3>
            <InformationList fields={[
              ['Cidade', [person.city, person.state].filter(Boolean).join(', ') || null],
              ['Telefone', person.phoneNumber || null],
              ['Membro desde', formatDate(person.createdAt, { month: 'long', year: 'numeric' })],
            ]} />
          </div>
        </>
      )}
    </>
  );
}

export function ProfileReviews() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPage = Number(searchParams.get('pagina') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const resource = useProfileResource(`/users/${user.uuid}/reviews?page=${page}&limit=10`);
  const reviews = resource.data?.data ?? [];
  const meta = resource.data?.meta;
  return (
    <>
      <h2 id="profile-section-title" className="text-2xl font-semibold text-[#111827]">Avaliações</h2>
      <p className="mt-2 text-sm text-[#6B7280]">Experiências de quem já contou com você no DOMMOS.</p>
      <ResourceStatus resource={resource} />
      {resource.data && (
        <>
          {reviews.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-[#E5E7EB] bg-white p-8 text-sm text-[#6B7280]">{Number(meta?.total) > 0 ? 'Nenhuma avaliação nesta página.' : 'Você ainda não possui avaliações.'}</p>
          ) : (
            <div className="mt-8 divide-y divide-[#E5E7EB]">
              {reviews.map((review) => (
                <article key={review.id} className="py-6 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="break-words font-semibold text-[#111827]">{[review.reviewer?.firstName, review.reviewer?.lastName].filter(Boolean).join(' ') || 'Nome não informado'}</h3>
                    <span className="text-sm font-semibold text-[#5B21B6]" aria-label={`Nota ${review.rating} de 5`}>★ {review.rating}/5</span>
                  </div>
                  <p className="mt-1 text-xs text-[#6B7280]">{formatDate(review.createdAt)}</p>
                  {review.comment && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#374151]">{review.comment}</p>}
                </article>
              ))}
            </div>
          )}
          {(page > 1 || meta?.pages > 1) && (
            <nav aria-label="Páginas de avaliações" className="mt-6 flex flex-wrap items-center gap-4 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setSearchParams({ pagina: String(page - 1) })} className="min-h-11 rounded-lg border border-[#E5E7EB] px-4 text-[#5B21B6] disabled:opacity-40">Anterior</button>
              <span className="text-[#6B7280]">Página {page}</span>
              <button type="button" disabled={page >= (meta?.pages ?? 1)} onClick={() => setSearchParams({ pagina: String(page + 1) })} className="min-h-11 rounded-lg border border-[#E5E7EB] px-4 text-[#5B21B6] disabled:opacity-40">Próxima</button>
            </nav>
          )}
        </>
      )}
    </>
  );
}

export function ProfessionalProfileSummary() {
  const { user } = useAuth();
  const resource = useProfileResource(`/professionals/${user.uuid}`);
  const profile = resource.data;
  const missing = resource.error?.response?.status === 404;
  const currency = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? 'Não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
  return (
    <>
      <h2 id="profile-section-title" className="text-2xl font-semibold text-[#111827]">Perfil profissional</h2>
      {missing ? (
        <div className="mt-8 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8">
          <p className="text-sm text-[#6B7280]">Você ainda não possui um perfil profissional.</p>
          <Link to="/perfil/profissional" className={`${buttonStyle} mt-6`}>Oferecer meus serviços</Link>
        </div>
      ) : <ResourceStatus resource={resource} />}
      {profile && (
        <div className="mt-8">
          <h3 className="break-words text-xl font-semibold text-[#111827]">{profile.headline || 'Título profissional não informado'}</h3>
          {profile.bio && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#6B7280]">{profile.bio}</p>}
          <InformationList fields={[
            ['Serviços', profile.catalogServices?.map((item) => item.catalogItem?.name).filter(Boolean).join(', ') || null],
            ['Avaliação', Number(profile.totalReviews) > 0 && profile.averageRating != null ? `${Number(profile.averageRating).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/5 · ${profile.totalReviews} avaliações` : 'Sem avaliações'],
            ['Preço por hora', currency(profile.hourlyRate)],
            ['Preço por dia', currency(profile.dailyRate)],
            ['Localização', [profile.city, profile.state].filter(Boolean).join(', ') || null],
            ['Status do perfil', profile.isPublished === true ? 'Publicado' : profile.isPublished === false ? 'Não publicado' : null],
          ]} />
          <Link to="/perfil/profissional" className={`${buttonStyle} mt-8`}>Editar perfil profissional</Link>
        </div>
      )}
    </>
  );
}
