import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import ServiceProposalActions from '../components/ServiceProposalActions';
import { Breadcrumb, Button, Card, Input, Textarea, useToast } from '../components/ui';

function ProposalForm({ uuid }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ proposed_price: '', cover_letter: '', delivery_time_days: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitError('');
    const letter = form.cover_letter.trim();
    const nextErrors = {};
    if (!(Number(form.proposed_price) > 0)) nextErrors.proposed_price = 'Informe um valor maior que zero.';
    if (letter && letter.length < 20) nextErrors.cover_letter = 'A apresentação precisa ter pelo menos 20 caracteres, ou deixe o campo em branco.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.elements[Object.keys(nextErrors)[0]]?.focus();
      return;
    }
    setLoading(true);
    try {
      await api.post(`/services/${uuid}/proposals`, {
        proposed_price: Number(form.proposed_price),
        ...(letter && { cover_letter: letter }),
        ...(form.delivery_time_days && { delivery_time_days: Number(form.delivery_time_days) }),
      });
      toast.success('Proposta enviada. Avisaremos quando o cliente responder.');
      navigate('/pro/pedidos');
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setSubmitError(apiError(err, 'Não foi possível enviar a proposta.'));
      setLoading(false);
    }
  }

  return (
    <Card as="form" onSubmit={submit} noValidate className="space-y-5">
      {submitError && <p role="alert" className="rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{submitError}</p>}
      <Input label="Valor proposto (R$)" name="proposed_price" type="number" min="0.01" step="0.01" inputMode="decimal" required value={form.proposed_price} onChange={change} error={errors.proposed_price} />
      <Input label="Prazo de entrega (dias)" name="delivery_time_days" type="number" min="1" step="1" inputMode="numeric" optional value={form.delivery_time_days} onChange={change} error={errors.delivery_time_days} />
      <Textarea label="Apresentação" name="cover_letter" optional rows={6} value={form.cover_letter} onChange={change} error={errors.cover_letter} hint="Conte sua experiência e como pretende fazer o trabalho. Se escrever, use pelo menos 20 caracteres." />
      <div className="flex flex-wrap justify-end gap-3">
        <Button to={`/servicos/${uuid}`} variant="secondary">Cancelar</Button>
        <Button type="submit" loading={loading}>{loading ? 'Enviando...' : 'Enviar proposta'}</Button>
      </div>
    </Card>
  );
}

export default function SendProposal() {
  const { uuid } = useParams();
  return (
    <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Pedidos abertos', to: '/servicos' }, { label: 'Pedido', to: `/servicos/${uuid}` }, { label: 'Enviar proposta' }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">Enviar proposta</h1>
      <p className="mb-6 mt-2 text-ink-muted">Apresente sua proposta para este pedido.</p>
      <ServiceProposalActions uuid={uuid}><ProposalForm uuid={uuid} /></ServiceProposalActions>
    </main>
  );
}
