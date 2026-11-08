import { useEffect, useState } from 'react';
import api, { apiError, apiFieldErrors } from '../services/api';
import { formatMoney } from '../utils/format';
import { Button, Input, Modal, Select, Textarea, useToast } from './ui';

const VALIDITY = [[24, '24 horas'], [48, '48 horas'], [72, '72 horas'], [168, '7 dias']];

/** Formulário de proposta do profissional para um pedido sob consulta, com a prévia do que ele recebe. */
export default function ProposalForm({ order, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ amount: '', mode: 'days', days: '', date: '', included: '', note: '', valid_hours: '48' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const set = (name) => (event) => { setForm((current) => ({ ...current, [name]: event.target.value })); setErrors((current) => ({ ...current, [name]: undefined })); };

  // Prévia dos ganhos: o servidor aplica a comissão e as taxas configuradas, a tela só mostra.
  const amountValue = Number(form.amount);
  useEffect(() => {
    if (!(amountValue > 0)) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      api.post('/orders/earnings-preview', { amount: amountValue }).then(({ data }) => { if (active) setPreview(data); }).catch(() => { if (active) setPreview(null); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [amountValue]);

  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!(amountValue > 0)) next.amount = 'Informe o valor da proposta, maior que zero.';
    if (form.mode === 'days' && !(Number(form.days) >= 1)) next.days = 'Informe em quantos dias você faz o serviço.';
    if (form.mode === 'date' && !form.date) next.date = 'Escolha a data de execução.';
    if (Object.keys(next).length) { setErrors(next); return; }
    setBusy(true);
    try {
      await api.post(`/orders/${order.uuid}/propose`, {
        amount: amountValue, valid_hours: Number(form.valid_hours), included: form.included, note: form.note,
        ...(form.mode === 'days' ? { days: Number(form.days) } : { date: form.date }),
      });
      toast.success('Proposta enviada. O cliente foi avisado.');
      onDone();
    } catch (err) {
      setErrors({ ...apiFieldErrors(err), form: apiError(err, 'Não foi possível enviar a proposta.') });
      setBusy(false);
    }
  }

  const fieldError = errors.amount || errors.days || errors.date;
  return (
    <Modal open title="Enviar proposta" onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm leading-6 text-ink-soft">Diga quanto cobra e em quanto tempo faz. O cliente compara as propostas e decide.</p>
        <Input label="Valor (R$)" name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required autoFocus value={form.amount} onChange={set('amount')} error={errors.amount} />
        {preview && (
          <p role="status" className="rounded-control bg-surface-muted p-3 text-sm leading-6 text-ink-soft">
            Você recebe <strong className="text-ink">{formatMoney(preview.earnings)}</strong>
            {preview.commissionPercent > 0 ? ` (comissão do Dommos de ${preview.commissionPercent}%: ${formatMoney(preview.commission)})` : ' (sem comissão do Dommos)'}.
            {preview.clientFeePercent > 0 && <> O cliente paga {formatMoney(preview.clientTotal)} com a taxa de serviço.</>}
            <span className="block text-xs text-ink-muted">A taxa do meio de pagamento, se houver, é descontada na hora do pagamento.</span>
          </p>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Quando você faz</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="mode" value="days" checked={form.mode === 'days'} onChange={set('mode')} />Prazo em dias</label>
            <label className="flex items-center gap-2"><input type="radio" name="mode" value="date" checked={form.mode === 'date'} onChange={set('mode')} />Data de execução</label>
          </div>
          {form.mode === 'days'
            ? <Input label="Prazo (dias)" name="days" type="number" min="1" max="365" inputMode="numeric" value={form.days} onChange={set('days')} error={errors.days} />
            : <Input label="Data de execução" name="date" type="date" value={form.date} onChange={set('date')} error={errors.date} />}
        </fieldset>
        <Textarea label="O que está incluso" name="included" rows={3} maxLength={500} optional value={form.included} onChange={set('included')} hint="Material, deslocamento, garantia…" error={errors.included} />
        <Textarea label="Observações" name="note" rows={3} maxLength={1000} optional value={form.note} onChange={set('note')} error={errors.note} />
        <Select label="A proposta vale por" name="valid_hours" value={form.valid_hours} onChange={set('valid_hours')} hint="Depois desse prazo ela vence e o cliente precisa pedir de novo.">
          {VALIDITY.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </Select>
        {errors.form && !fieldError && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button><Button type="submit" loading={busy}>Enviar proposta</Button></div>
      </form>
    </Modal>
  );
}
