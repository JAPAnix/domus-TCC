import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import { formatMoney } from '../utils/format';
import { maskContacts } from '../utils/contactMask';
import ServiceProposalActions from '../components/ServiceProposalActions';
import { Breadcrumb, Button, Card, Input, Select, Textarea, useToast } from '../components/ui';

const VALIDITY = [[24, '24 horas'], [48, '48 horas'], [72, '72 horas (padrão)'], [168, '7 dias']];

function ProposalForm({ uuid, context }) {
  const navigate = useNavigate();
  const toast = useToast();
  const editing = !!context.editing;
  const [form, setForm] = useState({ proposed_price: '', cover_letter: '', delivery_time_days: '', included: '', valid_hours: '72' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  // Editar: traz o que foi enviado antes.
  useEffect(() => {
    if (!editing || !context.proposalUuid) return undefined;
    let active = true;
    api.get(`/proposals/${context.proposalUuid}`).then(({ data }) => {
      if (!active) return;
      setForm({ proposed_price: String(Number(data.proposedPrice)), cover_letter: data.coverLetter ?? '', delivery_time_days: data.deliveryTimeDays ? String(data.deliveryTimeDays) : '', included: data.included ?? '', valid_hours: '72' });
    }).catch(() => {});
    return () => { active = false; };
  }, [editing, context.proposalUuid]);

  // Quanto o profissional recebe: o servidor aplica a comissão e as taxas configuradas, a tela só mostra.
  const price = Number(form.proposed_price);
  useEffect(() => {
    if (!(price > 0)) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      api.post('/orders/earnings-preview', { amount: price }).then(({ data }) => { if (active) setPreview(data); }).catch(() => { if (active) setPreview(null); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [price]);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  const masked = maskContacts(`${form.cover_letter} ${form.included}`).masked;

  async function submit(event) {
    event.preventDefault();
    setSubmitError('');
    const letter = form.cover_letter.trim();
    const nextErrors = {};
    if (!(price > 0)) nextErrors.proposed_price = 'Informe um valor maior que zero.';
    if (letter && letter.length < 20) nextErrors.cover_letter = 'A apresentação precisa ter pelo menos 20 caracteres, ou deixe o campo em branco.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.elements[Object.keys(nextErrors)[0]]?.focus();
      return;
    }
    setLoading(true);
    const body = {
      proposed_price: price, valid_hours: Number(form.valid_hours),
      ...(letter && { cover_letter: letter }),
      ...(form.included.trim() && { included: form.included.trim() }),
      ...(form.delivery_time_days && { delivery_time_days: Number(form.delivery_time_days) }),
    };
    try {
      if (editing) await api.put(`/proposals/${context.proposalUuid}`, body);
      else await api.post(`/services/${uuid}/proposals`, body);
      toast.success(editing ? 'Proposta atualizada. O cliente foi avisado.' : 'Proposta enviada. Avisaremos quando o cliente responder.');
      navigate('/pro/oportunidades');
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
      {preview && (
        <p role="status" className="rounded-control bg-surface-muted p-3 text-sm leading-6 text-ink-soft">
          Você recebe <strong className="text-ink">{formatMoney(preview.earnings)}</strong>
          {preview.commissionPercent > 0 ? ` (comissão do Dommos de ${preview.commissionPercent}%: ${formatMoney(preview.commission)})` : ' (sem comissão do Dommos)'}.
          <span className="block text-xs text-ink-muted">A taxa do meio de pagamento, se houver, é descontada na hora do pagamento.</span>
        </p>
      )}
      <Input label="Prazo de entrega (dias)" name="delivery_time_days" type="number" min="1" step="1" inputMode="numeric" optional value={form.delivery_time_days} onChange={change} error={errors.delivery_time_days} />
      <Textarea label="O que está incluso" name="included" optional rows={3} maxLength={500} value={form.included} onChange={change} error={errors.included} hint="Material, deslocamento, limpeza, garantia…" />
      <Textarea label="Apresentação" name="cover_letter" optional rows={6} value={form.cover_letter} onChange={change} error={errors.cover_letter} hint="Conte sua experiência e como pretende fazer o trabalho. Se escrever, use pelo menos 20 caracteres." />
      {masked && <p role="status" className="rounded-control border border-warning-line bg-warning-soft p-3 text-sm text-ink-soft">Para a sua segurança e a do cliente, telefone, e-mail, links e redes sociais serão removidos. Combine tudo pela plataforma.</p>}
      <Select label="A proposta vale por" name="valid_hours" value={form.valid_hours} onChange={change} hint="Depois desse prazo ela vence e o cliente não consegue mais aceitar.">
        {VALIDITY.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </Select>
      <div className="flex flex-wrap justify-end gap-3">
        <Button to={`/servicos/${uuid}`} variant="secondary">Cancelar</Button>
        <Button type="submit" loading={loading}>{loading ? 'Enviando...' : editing ? 'Salvar alterações' : 'Enviar proposta'}</Button>
      </div>
    </Card>
  );
}

export default function SendProposal() {
  const { uuid } = useParams();
  const [params] = useSearchParams();
  const edit = params.get('editar') === '1';
  return (
    <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Oportunidades', to: '/pro/oportunidades' }, { label: 'Pedido', to: `/servicos/${uuid}` }, { label: edit ? 'Editar proposta' : 'Enviar proposta' }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">{edit ? 'Editar proposta' : 'Enviar proposta'}</h1>
      <p className="mb-6 mt-2 text-ink-muted">{edit ? 'Você pode ajustar a proposta enquanto o cliente não responder.' : 'Apresente sua proposta para este pedido.'}</p>
      <ServiceProposalActions uuid={uuid} edit={edit}>{(context) => <ProposalForm uuid={uuid} context={context} />}</ServiceProposalActions>
    </main>
  );
}
