import { useState } from 'react';
import api, { apiError, apiFieldErrors } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { Button, ErrorState, Input, Select, SkeletonList, useToast } from '../../components/ui';
import { SettingsBlock } from './SettingsPages';
import { useCepLookup } from '../../hooks/useCepLookup';
import { formatCnpj, formatCpf } from './identityValidation';

const STATUS = {
  not_started: { label: 'Não iniciado', tone: 'bg-surface-muted text-ink-soft' },
  pending: { label: 'Em análise', tone: 'bg-warning-soft text-warning-strong' },
  approved: { label: 'Aprovado', tone: 'bg-success-soft text-success-strong' },
  rejected: { label: 'Recusado', tone: 'bg-danger-soft text-danger-strong' },
};
const digits = (value) => value.replace(/\D/g, '');
const maskCep = (value) => { const d = digits(value).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const maskPhone = (value) => { const d = digits(value).slice(0, 11); return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d; };
const EMPTY = { name: '', email: '', cpf_cnpj: '', mobile_phone: '', birth_date: '', company_type: '', income_value: '', address: '', address_number: '', complement: '', province: '', postal_code: '' };

function CardNote({ text }) {
  return (
    <ul className="space-y-2 rounded-control bg-info-soft p-4 text-sm leading-6 text-info-strong">
      <li><strong>Pix:</strong> o valor cai na hora, depois de confirmado o serviço. É o jeito mais rápido de receber.</li>
      <li><strong>Cartão de crédito:</strong> {text ?? 'o repasse chega 32 dias corridos depois do pagamento (parcelado: uma parcela a cada 32 dias).'}</li>
      <li><strong>Boleto:</strong> o valor entra depois da compensação, em alguns dias úteis.</li>
    </ul>
  );
}

/** Dados que o usuário já informou no cadastro, para ele não digitar tudo de novo. */
function initialForm(prefill) {
  if (!prefill) return EMPTY;
  const address = prefill.address ?? {};
  const doc = prefill.document ?? '';
  return {
    ...EMPTY, name: prefill.holderName || prefill.name || '', email: prefill.email || '',
    cpf_cnpj: doc.length > 11 ? formatCnpj(doc) : doc ? formatCpf(doc) : '', mobile_phone: prefill.phone ? maskPhone(prefill.phone) : '',
    birth_date: prefill.birthDate || '', address: address.street || '', address_number: address.number || '', complement: address.complement || '',
    province: address.neighborhood || '', postal_code: address.postal_code ? maskCep(address.postal_code) : '',
  };
}

function Form({ onDone, prefill }) {
  const toast = useToast();
  const [form, setForm] = useState(() => initialForm(prefill));
  const filled = Object.keys(initialForm(prefill)).some((key) => initialForm(prefill)[key]);
  // Rua e bairro vêm do CEP, só se ainda estiverem vazios.
  const { status: cepStatus, lookup } = useCepLookup((found) => setForm((current) => ({ ...current, address: current.address || found.street, province: current.province || found.neighborhood })));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (name, value) => { setForm((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: undefined, form: undefined })); };
  const doc = digits(form.cpf_cnpj);
  const company = doc.length > 11;
  const field = (name, label, { mask, ...props } = {}) => <Input label={label} name={name} value={form[name]} onChange={(event) => { const next = mask ? mask(event.target.value) : event.target.value; set(name, next); if (name === 'postal_code') lookup(next); }} error={errors[name]} {...props} />;

  async function submit(event) {
    event.preventDefault();
    const found = {};
    const required = { name: 'Informe o nome completo ou a razão social.', email: 'Informe o e-mail.', mobile_phone: 'Informe o celular com DDD.', address: 'Informe a rua.', address_number: 'Informe o número.', province: 'Informe o bairro.' };
    Object.entries(required).forEach(([key, message]) => { if (!form[key].trim()) found[key] = message; });
    if (doc.length !== 11 && doc.length !== 14) found.cpf_cnpj = 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).';
    if (doc.length === 11 && !form.birth_date) found.birth_date = 'Informe a data de nascimento.';
    if (company && !form.company_type) found.company_type = 'Escolha o tipo da empresa.';
    if (digits(form.postal_code).length !== 8) found.postal_code = 'CEP com 8 dígitos.';
    if (!(Number(form.income_value) > 0)) found.income_value = 'Informe um valor maior que zero.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await api.post('/payments/receiving-account', {
        name: form.name.trim(), email: form.email.trim(), cpf_cnpj: doc, mobile_phone: digits(form.mobile_phone), income_value: Number(form.income_value),
        address: form.address.trim(), address_number: form.address_number.trim(), province: form.province.trim(), postal_code: digits(form.postal_code),
        ...(form.complement.trim() && { complement: form.complement.trim() }),
        ...(doc.length === 11 ? { birth_date: form.birth_date } : { company_type: form.company_type }),
      });
      toast.success('Cadastro enviado. Acompanhe a análise aqui.');
      onDone();
    } catch (err) {
      setErrors({ ...apiFieldErrors(err), form: apiError(err, 'Não foi possível enviar o cadastro.') });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-5">
      {filled && <p role="status" className="rounded-control bg-primary-softer p-3 text-sm text-primary-strong">Preenchemos com os dados do seu cadastro. Confira e complete o que faltar.</p>}
      <Input label="CPF ou CNPJ" name="cpf_cnpj" inputMode="numeric" autoComplete="off" value={form.cpf_cnpj} onChange={(event) => { const d = digits(event.target.value).slice(0, 14); set('cpf_cnpj', d.length > 11 ? formatCnpj(d) : formatCpf(d)); }} error={errors.cpf_cnpj} hint="CPF para pessoa física, CNPJ para empresa ou MEI. Os dígitos são conferidos antes do envio." />
      {field('name', company ? 'Razão social' : 'Nome completo', { autoComplete: 'name', maxLength: 150 })}
      {field('email', 'E-mail', { type: 'email', autoComplete: 'email', maxLength: 150, hint: 'O Asaas envia para este e-mail o link para ativar a conta e enviar os documentos.' })}
      {field('mobile_phone', 'Celular', { mask: maskPhone, inputMode: 'tel', autoComplete: 'tel' })}
      {doc.length === 11 && field('birth_date', 'Data de nascimento', { type: 'date' })}
      {company && (
        <Select label="Tipo da empresa" name="company_type" value={form.company_type} onChange={(event) => set('company_type', event.target.value)} error={errors.company_type}>
          <option value="">Escolha</option><option value="MEI">MEI</option><option value="LIMITED">Empresa limitada (LTDA)</option><option value="INDIVIDUAL">Empresário individual</option><option value="ASSOCIATION">Associação</option>
        </Select>
      )}
      {field('income_value', company ? 'Faturamento mensal (R$)' : 'Renda mensal (R$)', { type: 'number', min: 0, step: '0.01', inputMode: 'decimal', hint: 'Valor aproximado. É exigido pelo Asaas na abertura da conta.' })}
      <div className="grid gap-5 sm:grid-cols-2">
        {field('postal_code', 'CEP', { mask: maskCep, inputMode: 'numeric', autoComplete: 'postal-code', hint: cepStatus || 'Preenchemos a rua e o bairro pelo CEP.' })}
        {field('province', 'Bairro')}
      </div>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
        {field('address', 'Rua', { autoComplete: 'address-line1' })}
        {field('address_number', 'Número')}
      </div>
      {field('complement', 'Complemento (opcional)')}
      {errors.form && <p role="alert" className="rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{errors.form}</p>}
      <Button type="submit" loading={busy}>Enviar cadastro</Button>
    </form>
  );
}

/** "Como recebo" pela plataforma: cadastro guiado e acompanhamento da análise da conta no Asaas. */
export default function PayoutAccount() {
  const toast = useToast();
  const resource = useApiResource('/payments/receiving-account', undefined, { keepPrevious: true });
  const [busy, setBusy] = useState(false);
  const prefill = useApiResource('/account/prefill');
  const state = resource.data;
  if ((!state && resource.loading) || (state?.status === 'not_started' && prefill.loading)) return <SkeletonList count={2} label="Carregando" itemClassName="h-24" />;
  if (resource.error && !state) return <ErrorState title="Não foi possível carregar o seu recebimento" message={apiError(resource.error)} onRetry={resource.retry} />;
  const status = STATUS[state.status] ?? STATUS.not_started;

  async function approveTest() {
    setBusy(true);
    try { await api.post('/payments/receiving-account/sandbox-approve'); toast.success('Conta aprovada no sandbox.'); resource.retry(); } catch (err) { toast.error(apiError(err, 'Não foi possível aprovar agora.')); } finally { setBusy(false); }
  }

  async function refresh() {
    setBusy(true);
    try { await api.post('/payments/receiving-account/refresh'); toast.success('Status atualizado.'); resource.retry(); } catch (err) { toast.error(apiError(err, 'Não foi possível atualizar agora.')); } finally { setBusy(false); }
  }

  return (
    <SettingsBlock title="Como você recebe" description="Os clientes pagam pelo Dommos e o valor é repassado à sua conta de recebimento, já descontada a comissão. Você precisa de uma conta aprovada para receber pedidos pagos pela plataforma.">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
          {state.status !== 'not_started' && <Button variant="secondary" size="sm" onClick={refresh} loading={busy}>Atualizar status</Button>}
          {state.sandbox && state.status === 'pending' && <Button variant="soft" size="sm" onClick={approveTest} loading={busy}>Aprovar conta de teste (sandbox)</Button>}
        </div>
        {state.status === 'approved' && <p className="rounded-control bg-success-soft p-3 text-sm text-success-strong">Tudo certo: os clientes já podem pagar os seus pedidos pela plataforma.</p>}
        {state.status === 'pending' && <p role="status" className="rounded-control bg-warning-soft p-3 text-sm text-warning-strong">{state.nextStep}{state.detail ? ` Situação atual: ${state.detail}.` : ''} Enquanto a conta não for aprovada, os clientes não conseguem pagar pelo Dommos.</p>}
        {state.status === 'rejected' && <p role="alert" className="rounded-control bg-danger-soft p-3 text-sm text-danger-strong">A análise não foi aprovada{state.rejectionReason ? `: ${state.rejectionReason}` : '.'} Corrija o que foi pedido no e-mail do Asaas e use “Atualizar status”.</p>}
        <CardNote text={state.cardNote} />
        {state.status === 'not_started' && (state.enabled ? <Form onDone={resource.retry} prefill={prefill.data} /> : <p className="text-sm text-ink-soft">O recebimento pela plataforma ainda não está ativado. Por enquanto, o pagamento é combinado direto entre as partes.</p>)}
      </div>
    </SettingsBlock>
  );
}
