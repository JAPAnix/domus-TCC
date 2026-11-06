import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import api, { apiError } from '../services/api';
import { Breadcrumb, Button, Card, EmptyState, ErrorState, SkeletonList, Textarea, useToast } from '../components/ui';

export default function CreateReview() {
  const { uuid } = useParams();
  const toast = useToast();
  const resource = useApiResource(`/services/${uuid}/review-context`);
  const context = resource.data;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (comment.trim() && comment.trim().length < 10) {
      setError('O comentário precisa ter pelo menos 10 caracteres, ou deixe o campo em branco.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/services/${uuid}/reviews`, { rating, ...(comment.trim() && { comment: comment.trim() }) });
      toast.success('Avaliação enviada. Obrigado!');
      setSent(true);
    } catch (err) {
      setError(apiError(err, 'Não foi possível enviar a avaliação.'));
    } finally {
      setSaving(false);
    }
  }

  const backToService = <Button to={`/servicos/${uuid}`} variant="secondary">Voltar ao pedido</Button>;

  return (
    <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Pedidos e contratações', to: '/meus-servicos' }, { label: context?.title ?? 'Pedido', to: `/servicos/${uuid}` }, { label: 'Avaliar' }]} />
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Avaliar experiência</h1>

      {resource.loading ? (
        <SkeletonList count={1} label="Carregando avaliação" itemClassName="h-72" />
      ) : resource.error ? (
        <ErrorState title="Não foi possível abrir a avaliação" message={apiError(resource.error)} onRetry={resource.retry} action={backToService} />
      ) : sent || context.alreadyReviewed ? (
        <EmptyState icon="star" title={sent ? 'Avaliação enviada' : 'Você já avaliou este serviço'} description={`Sua avaliação de ${context.target.name} foi registrada.`} action={backToService} />
      ) : !context.canReview ? (
        <EmptyState icon="star" title="Avaliação ainda não disponível" description="A avaliação é liberada quando o cliente conclui o serviço." action={backToService} />
      ) : (
        <Card as="form" onSubmit={submit} className="space-y-5">
          <p className="text-sm text-ink-muted">{context.title}</p>
          <h2 className="text-lg font-semibold">Como foi a experiência com {context.target.name}?</h2>
          {error && <p role="alert" className="rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{error}</p>}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Nota</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className={`flex min-h-control cursor-pointer items-center gap-2 rounded-control border px-3 text-sm ${rating === value ? 'border-primary bg-primary-soft font-semibold text-primary-strong' : 'border-line-strong'}`}>
                  <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} />
                  {value} <span aria-hidden="true" className="text-rating">★</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Textarea label="Comentário" optional value={comment} onChange={(event) => setComment(event.target.value)} maxLength={5000} hint="Se escrever, use pelo menos 10 caracteres." />
          <div className="flex flex-wrap justify-end gap-3">
            {backToService}
            <Button type="submit" loading={saving}>{saving ? 'Enviando...' : 'Enviar avaliação'}</Button>
          </div>
        </Card>
      )}
    </main>
  );
}
