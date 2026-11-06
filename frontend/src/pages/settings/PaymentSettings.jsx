import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { formatMoney } from '../../utils/format';
import { PRO_START_PATH } from '../../utils/routes';
import { paymentStatus } from '../../utils/status';
import PaymentNotice from '../../components/PaymentNotice';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { Button, EmptyState, ErrorState, Input, Select, SkeletonList, Tabs, useToast } from '../../components/ui';
import { SettingsBlock, SettingsHeading } from './SettingsPages';
import PayoutAccount from './PayoutAccount';

const KEY_TYPES = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória' };
const METHODS = { pix: 'Pix', cash: 'Dinheiro', card_in_person: 'Cartão na maquininha, presencialmente' };
const when = (value) => new Date(value).toLocaleDateString('pt-BR');

function PaymentList({ role }) {
  const [page, setPage] = useState(1);
  const resource = useApiResource('/payments/mine', { role, page, limit: 10 }, { keepPrevious: true });
  const rows = resource.data?.data ?? [];
  if (!resource.data && resource.loading) return <SkeletonList count={3} label="Carregando pagamentos" itemClassName="h-20" />;
  if (resource.error && !resource.data) return <ErrorState title="Não foi possível carregar os pagamentos" message={apiError(resource.error)} onRetry={resource.retry} />;
  if (!rows.length) {
    return <EmptyState icon="list" title={role === 'client' ? 'Nenhum pagamento ainda' : 'Nenhum recebimento ainda'} description={role === 'client' ? 'Quando você contratar um serviço e iniciar o pagamento, ele aparece aqui, com o recibo depois da confirmação.' : 'Os pagamentos dos seus pedidos aparecem aqui, com o status e o recibo.'} action={role === 'client' ? <Button to="/buscar">Buscar serviços</Button> : <Button to="/pro/pedidos">Ver pedidos</Button>} />;
  }
  return (
    <>
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map((payment) => (
          <li key={payment.uuid} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <Link to={`/contratacoes/${payment.orderUuid}`} className="break-words font-medium text-primary-strong underline-offset-2 hover:underline">{payment.orderTitle}</Link>
              <p className="text-sm text-ink-muted">{payment.methodLabel} · {when(payment.createdAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{formatMoney(payment.amount)}</span>
              <StatusBadge status={payment.status} map={paymentStatus} />
              {payment.receiptNumber && <Link to={`/pagamentos/${payment.uuid}/recibo`} className="text-sm font-medium text-primary-strong underline">Recibo</Link>}
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={page} pages={resource.data.meta.pages} onChange={setPage} label="Páginas de pagamentos" />
    </>
  );
}

function ReceivingForm({ initial, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ pix_key_type: initial.pixKeyType ?? '', pix_key: initial.pixKey ?? '', methods: initial.methods });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const usesPix = form.methods.includes('pix');

  const toggle = (method) => setForm((current) => ({ ...current, methods: current.methods.includes(method) ? current.methods.filter((item) => item !== method) : [...current.methods, method] }));
  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!form.methods.length) found.methods = 'Escolha pelo menos uma forma de receber.';
    if (usesPix && !form.pix_key_type) found.pix_key_type = 'Escolha o tipo da chave Pix.';
    if (usesPix && !form.pix_key.trim()) found.pix_key = 'Para receber por Pix, informe a sua chave.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await api.put('/payments/receiving', { methods: form.methods, pix_key_type: form.pix_key_type || null, pix_key: form.pix_key.trim() || null });
      toast.success('Formas de recebimento salvas.');
      onSaved();
    } catch (err) {
      setErrors(apiFieldErrors(err));
      toast.error(apiError(err, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-md space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Formas que você aceita</legend>
        <div className="space-y-2">
          {Object.entries(METHODS).map(([value, label]) => <label key={value} className="flex min-h-control cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={form.methods.includes(value)} onChange={() => toggle(value)} />{label}</label>)}
        </div>
        {errors.methods && <p role="alert" className="mt-1 text-sm text-danger">{errors.methods}</p>}
      </fieldset>
      {usesPix && (
        <>
          <Select label="Tipo da chave Pix" name="pix_key_type" value={form.pix_key_type} onChange={(event) => setForm({ ...form, pix_key_type: event.target.value })} error={errors.pix_key_type}>
            <option value="">Escolha</option>
            {Object.entries(KEY_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Input label="Chave Pix" name="pix_key" autoComplete="off" value={form.pix_key} onChange={(event) => setForm({ ...form, pix_key: event.target.value })} error={errors.pix_key} maxLength={140} hint="O cliente vê esta chave só no pedido dele, para pagar. Ela não aparece no seu perfil." />
        </>
      )}
      <Button type="submit" loading={busy}>Salvar</Button>
    </form>
  );
}

function ReceivingTab() {
  const resource = useApiResource('/payments/receiving', undefined, { keepPrevious: true });
  const profile = useApiResource('/settings', undefined, { keepPrevious: true });
  const config = useApiResource('/payments/config', undefined, { keepPrevious: true });
  if ((!resource.data || !profile.data) && (resource.loading || profile.loading)) return <SkeletonList count={2} label="Carregando" itemClassName="h-24" />;
  if (resource.error || profile.error) return <ErrorState title="Não foi possível carregar esta aba" message={apiError(resource.error ?? profile.error)} onRetry={() => { resource.retry(); profile.retry(); }} />;
  if (!profile.data.hasProfessionalProfile) {
    return <EmptyState icon="list" title="Disponível para profissionais" description="Aqui você define como recebe dos clientes. Ative o modo profissional ao publicar o seu primeiro serviço." action={<Button to={PRO_START_PATH}>Começar a oferecer serviços</Button>} />;
  }
  if (config.data?.provider === 'asaas') {
    return (
      <>
        <PayoutAccount />
        <SettingsBlock title="Pagamentos recebidos"><PaymentList role="professional" /></SettingsBlock>
      </>
    );
  }
  return (
    <>
      <SettingsBlock title="Como você recebe" description="Estas são as opções que o cliente vê ao pagar um pedido seu. O dinheiro vai direto para você; o Dommos não intermedeia.">
        <ReceivingForm key={JSON.stringify(resource.data)} initial={resource.data} onSaved={resource.retry} />
      </SettingsBlock>
      <SettingsBlock title="Pagamentos recebidos"><PaymentList role="professional" /></SettingsBlock>
    </>
  );
}

function PayTab({ platform }) {
  if (platform) {
    return (
      <>
        <SettingsBlock title="Formas de pagamento" description="Você escolhe a forma ao contratar, direto no pedido. Não há nada para cadastrar aqui.">
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            <li className="p-4"><p className="font-medium">Pix</p><p className="text-sm text-ink-muted">QR Code e “copia e cola” gerados no pedido. A confirmação é automática, sem precisar avisar.</p></li>
            <li className="p-4"><p className="font-medium">Cartão de crédito</p><p className="text-sm text-ink-muted">Pago na página segura do Asaas, com parcelamento. O Dommos nunca recebe nem guarda dados de cartão.</p></li>
            <li className="p-4"><p className="font-medium">Boleto</p><p className="text-sm text-ink-muted">Pago na página segura do Asaas. A compensação pode levar alguns dias úteis.</p></li>
          </ul>
        </SettingsBlock>
        <SettingsBlock title="Seus pagamentos"><PaymentList role="client" /></SettingsBlock>
      </>
    );
  }
  return (
    <>
      <SettingsBlock title="Formas de pagamento disponíveis" description="Não há nada para cadastrar: em cada pedido você escolhe entre as formas que o profissional aceita.">
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          <li className="p-4"><p className="font-medium">Pix</p><p className="text-sm text-ink-muted">QR Code e “copia e cola” gerados no pedido. Você paga no app do seu banco e avisa com “Já paguei”.</p></li>
          <li className="p-4"><p className="font-medium">Dinheiro</p><p className="text-sm text-ink-muted">Pago direto ao profissional no dia do serviço.</p></li>
          <li className="p-4"><p className="font-medium">Cartão na maquininha, presencialmente</p><p className="text-sm text-ink-muted">Combinado com o profissional. O Dommos nunca recebe nem guarda dados de cartão.</p></li>
        </ul>
      </SettingsBlock>
      <SettingsBlock title="Seus pagamentos"><PaymentList role="client" /></SettingsBlock>
    </>
  );
}

export default function PaymentSettings() {
  const [tab, setTab] = useState('pago');
  const config = useApiResource('/payments/config', undefined, { keepPrevious: true });
  const platform = config.data?.provider === 'asaas';
  return (
    <>
      <SettingsHeading title="Pagamentos">Veja como pagar e como receber, os pagamentos de cada pedido e os recibos.</SettingsHeading>
      <div className="mt-6"><PaymentNotice platform={platform} /></div>
      <div className="mt-8">
        <Tabs label="Pagamentos" value={tab} onChange={setTab} tabs={[{ value: 'pago', label: 'Como pago' }, { value: 'recebo', label: 'Como recebo' }]} />
        <div role="tabpanel" aria-labelledby={`tab-${tab}`}>{tab === 'pago' ? <PayTab platform={platform} /> : <ReceivingTab />}</div>
      </div>
    </>
  );
}
