import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { formatDay } from '../../utils/format';
import { Avatar, Button, ErrorState, Input, Modal, Select, SkeletonList, Textarea, useToast } from '../ui';

const Stars = ({ value }) => <span role="img" aria-label={`Nota ${value} de 5`} className="text-sm text-rating"><span aria-hidden="true">{'★'.repeat(value)}<span className="text-line-strong">{'★'.repeat(5 - value)}</span></span></span>;
const since = (value) => (value ? `Na plataforma desde ${formatDay(value, { month: 'long', year: 'numeric' })}` : '');

function ReplyForm({ review, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (text.trim().length < 2) { setError('Escreva uma resposta.'); return; }
    setBusy(true);
    try {
      await api.post(`/reviews/${review.id}/reply`, { reply: text });
      toast.success('Resposta publicada.');
      onSaved();
    } catch (err) { setError(apiError(err, 'Não foi possível responder.')); setBusy(false); }
  }
  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-2">
      <Textarea label="Responder a esta avaliação" value={text} onChange={(event) => { setText(event.target.value); setError(''); }} error={error} rows={3} maxLength={500} />
      <Button type="submit" size="sm" loading={busy}>Publicar resposta</Button>
    </form>
  );
}

function ReviewItem({ review, canReply, onChanged }) {
  const [more, setMore] = useState(false);
  const long = (review.comment ?? '').length > 220;
  return (
    <li className="min-w-0 py-4">
      <div className="flex items-center gap-3">
        <Avatar src={review.reviewer.profilePictureUrl} name={review.reviewer.name} decorative />
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{review.reviewer.name}</p><p className="truncate text-xs text-ink-muted">{since(review.reviewer.memberSince)}</p></div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted"><Stars value={review.rating} /><span>{formatDay(review.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</span>{review.serviceTitle && <span>· {review.serviceTitle}{review.packageName ? ` (${review.packageName})` : ''}</span>}</p>
      {review.comment && <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft ${long && !more ? 'line-clamp-4' : ''}`}>{review.comment}</p>}
      {long && <button type="button" onClick={() => setMore((value) => !value)} className="mt-1 text-sm font-semibold underline underline-offset-2">{more ? 'Mostrar menos' : 'Mostrar mais'}</button>}
      {review.reply && <div className="mt-3 rounded-control bg-surface-muted p-3 text-sm"><p className="text-xs font-semibold text-ink-muted">Resposta do profissional · {formatDay(review.repliedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</p><p className="mt-1 whitespace-pre-wrap break-words leading-6 text-ink-soft">{review.reply}</p></div>}
      {canReply && !review.reply && <ReplyForm review={review} onSaved={onChanged} />}
    </li>
  );
}

function AllReviewsModal({ uuid, count, canReply, onClose, onChanged }) {
  const [sort, setSort] = useState('recent');
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const resource = useApiResource(`/listings/${uuid}/reviews`, { ordem: sort, q: query, page, limit: 8 }, { keepPrevious: true });
  const rows = resource.data?.data ?? [];
  return (
    <Modal open title={`${count} ${count === 1 ? 'avaliação' : 'avaliações'}`} onClose={onClose} placement="sheet" closeLabel="Fechar avaliações">
      <form onSubmit={(event) => { event.preventDefault(); setQuery(term.trim()); setPage(1); }} className="grid gap-3 sm:grid-cols-[1fr_auto]" role="search">
        <Input label="Buscar nas avaliações" type="search" value={term} onChange={(event) => setTerm(event.target.value)} maxLength={60} placeholder="Digite uma palavra e tecle Enter" />
        <Select label="Ordenar por" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
          <option value="recent">Mais recentes</option><option value="best">Melhores</option><option value="worst">Piores</option>
        </Select>
      </form>
      <div className="mt-4">
        {!resource.data && resource.loading ? <SkeletonList count={3} label="Carregando avaliações" itemClassName="h-20" />
          : resource.error && !resource.data ? <ErrorState title="Não foi possível carregar as avaliações" message={apiError(resource.error)} onRetry={resource.retry} />
            : rows.length === 0 ? <p className="py-8 text-center text-sm text-ink-muted">Nenhuma avaliação encontrada.</p>
              : <ul className="divide-y divide-line">{rows.map((review) => <ReviewItem key={review.id} review={review} canReply={canReply} onChanged={() => { resource.retry(); onChanged(); }} />)}</ul>}
      </div>
      {resource.data?.meta.pages > 1 && (
        <nav aria-label="Páginas de avaliações" className="mt-4 flex items-center justify-center gap-4">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-sm text-ink-muted">Página {page} de {resource.data.meta.pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= resource.data.meta.pages} onClick={() => setPage(page + 1)}>Próxima</Button>
        </nav>
      )}
    </Modal>
  );
}

export default function Reviews({ uuid, isOwner, ownerUuid }) {
  const resource = useApiResource(`/listings/${uuid}/reviews`, { limit: 6 }, { keepPrevious: true });
  const [all, setAll] = useState(false);
  const data = resource.data;
  if (!data && resource.loading) return <SkeletonList count={2} label="Carregando avaliações" itemClassName="h-20" />;
  if (resource.error && !data) return <ErrorState title="Não foi possível carregar as avaliações" message={apiError(resource.error)} onRetry={resource.retry} />;
  const { summary } = data;
  if (!summary.count) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-primary-softer p-6 text-center">
        <p className="text-3xl" aria-hidden="true">☆</p>
        <p className="mt-2 font-semibold">Este serviço ainda não tem avaliações</p>
        <p className="mt-1 text-sm text-ink-muted">Só quem conclui um serviço pode avaliar, por isso toda nota é de um cliente real. {ownerUuid && <>Veja o <Link to={`/usuarios/${ownerUuid}`} className="font-medium text-primary-strong underline">perfil do profissional</Link>.</>}</p>
      </div>
    );
  }
  const maxCount = Math.max(...Object.values(summary.histogram), 1);
  return (
    <div>
      <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
        <div>
          <p className="text-5xl font-bold">{summary.average.toFixed(1).replace('.', ',')}</p>
          <Stars value={Math.round(summary.average)} />
          <p className="mt-2 text-sm text-ink-muted">{summary.count} {summary.count === 1 ? 'avaliação' : 'avaliações'}</p>
          <p className="mt-3 text-xs leading-5 text-ink-muted">Só quem concluiu o serviço pelo Dommos pode avaliar. <Link to="/ajuda/artigo/avaliacoes-honestas" className="font-medium text-primary-strong underline">Como funcionam as avaliações</Link></p>
        </div>
        <ol className="space-y-1.5" aria-label="Avaliações por nota">
          {[5, 4, 3, 2, 1].map((star) => (
            <li key={star} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 text-ink-soft">{star} <span aria-hidden="true" className="text-rating">★</span></span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true"><span className="block h-full rounded-full bg-rating" style={{ width: `${(summary.histogram[star] / maxCount) * 100}%` }} /></span>
              <span className="w-8 shrink-0 text-right text-ink-muted">{summary.histogram[star]}<span className="sr-only"> avaliações com {star} estrelas</span></span>
            </li>
          ))}
        </ol>
      </div>
      {summary.topics.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Os clientes mencionam</h3>
          <ul className="flex flex-wrap gap-2">{summary.topics.map((topic) => <li key={topic.label} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-soft">{topic.label} <span className="text-ink-muted">· {topic.count}</span></li>)}</ul>
        </div>
      )}
      <ul className="mt-4 grid gap-x-10 divide-y divide-line md:grid-cols-2 md:divide-y-0">{data.data.map((review) => <ReviewItem key={review.id} review={review} canReply={isOwner} onChanged={resource.retry} />)}</ul>
      {summary.count > data.data.length && <Button variant="secondary" className="mt-4" onClick={() => setAll(true)}>Mostrar todas as {summary.count} avaliações</Button>}
      {all && <AllReviewsModal uuid={uuid} count={summary.count} canReply={isOwner} onClose={() => setAll(false)} onChanged={resource.retry} />}
    </div>
  );
}
