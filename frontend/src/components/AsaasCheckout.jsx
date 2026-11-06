import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import { copyText } from '../utils/clipboard';
import { formatDay, formatMoney } from '../utils/format';
import { paymentStatus } from '../utils/status';
import { formatCnpj, formatCpf } from '../pages/settings/identityValidation';
import PixQrCode from './PixQrCode';
import StatusBadge from './StatusBadge';
import { Button, Card, ConfirmDialog, Input, Modal, Select, Textarea, buttonClass, useToast } from './ui';

const cents = (value) => formatMoney((value ?? 0) / 100);
const PAYOUT_PRO = { held: 'Aguardando a confirmação do cliente', released: 'Repassado ao seu recebimento', refunded: 'Estornado ao cliente', none: '' };
const METHOD_TEXT = {
  pix: ['Pix', 'Confirmação na hora, com QR Code ou “copia e cola”.'],
  credit_card: ['Cartão de crédito', 'Você paga no site seguro do Asaas. O Dommos nunca recebe os dados do cartão.'],
  boleto: ['Boleto', 'Pago no site seguro do Asaas. A compensação pode levar alguns dias úteis.'],
};

function Countdown({ until }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  if (!until || !now) return null;
  const left = Math.max(0, new Date(until).getTime() - now);
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return <p className="text-sm text-ink-soft" role="timer" aria-live="off">{left > 0 ? <>Este Pix expira em <strong>{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</strong>.</> : 'Este Pix expirou. Gere um novo.'}</p>;
}

function CopyCode({ value }) {
  const toast = useToast();
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">Pix copia e cola</p>
      <div className="mt-1 flex items-stretch gap-2">
        <input readOnly aria-label="Pix copia e cola" value={value} onFocus={(event) => event.target.select()} className="min-h-control min-w-0 flex-1 rounded-control border border-line bg-surface-muted px-3 text-sm" />
        <Button variant="secondary" onClick={async () => (await copyText(value) ? toast.success('Código copiado.') : toast.error('Não foi possível copiar. Selecione e copie manualmente.'))}>Copiar</Button>
      </div>
    </div>
  );
}

function DisputeModal({ uuid, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (reason.trim().length < 10) { setError('Conte o que aconteceu, de 10 a 500 caracteres.'); return; }
    setBusy(true);
    try {
      await api.post(`/payments/${uuid}/dispute`, { reason });
      toast.success('Reclamação aberta. Vamos analisar.');
      onDone();
    } catch (err) { setError(apiFieldErrors(err).reason ?? apiError(err, 'Não foi possível abrir a reclamação.')); setBusy(false); }
  }
  return (
    <Modal open title="Abrir reclamação" onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm leading-6 text-ink-soft">Use isto se o serviço não foi feito como combinado. O pagamento fica em análise e o nosso time decide entre liberar ao profissional ou estornar a você.</p>
        <Textarea label="O que aconteceu?" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} error={error} rows={4} maxLength={500} />
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button><Button type="submit" loading={busy}>Enviar reclamação</Button></div>
      </form>
    </Modal>
  );
}

/** Pagamento pela plataforma (Asaas), visto pelo cliente e pelo profissional. */
export default function AsaasCheckout({ orderUuid, state, onRefresh }) {
  const toast = useToast();
  const payment = state.payment;
  const isClient = payment ? payment.role === 'client' : state.canStart || !state.proPreview;
  const [method, setMethod] = useState('pix');
  const [installments, setInstallments] = useState(1);
  const [payerDoc, setPayerDoc] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const [dispute, setDispute] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pending = payment?.status === 'pending';

  // Atualiza sozinho enquanto espera o pagamento (Pix confirma em segundos).
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(() => { if (!document.hidden) onRefresh(); }, 4000);
    return () => clearInterval(timer);
  }, [pending, onRefresh]);

  async function start(event) {
    event.preventDefault();
    const found = {};
    const digits = payerDoc.replace(/\D/g, '');
    if (state.needsDocument && digits.length !== 11 && digits.length !== 14) found.cpf_cnpj = 'Informe o CPF ou CNPJ de quem paga.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy('start');
    try {
      await api.post(`/payments/order/${orderUuid}`, { method, ...(method === 'credit_card' && { installments: Number(installments) }), ...(state.needsDocument && { cpf_cnpj: digits }) });
      onRefresh();
    } catch (err) {
      setErrors({ ...apiFieldErrors(err), form: apiError(err, 'Não foi possível gerar o pagamento.') });
    } finally { setBusy(''); }
  }
  async function run(label, request, success) {
    setBusy(label);
    try { await request(); toast.success(success); onRefresh(); } catch (err) { toast.error(apiError(err, 'Não foi possível concluir.')); } finally { setBusy(''); setConfirming(false); setDispute(false); }
  }

  const showForm = state.canStart;
  const retry = payment && ['expired', 'refused'].includes(payment.status);
  const total = state.amountDueCents ?? payment?.amountCents;
  const fee = state.breakdown?.clientFeeCents ?? payment?.clientFeeCents ?? 0;
  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Pagamento</h2>
        {payment && <StatusBadge status={payment.status} map={paymentStatus} />}
      </div>

      {/* Profissional: quanto recebe */}
      {!isClient && (state.proPreview || payment) && (
        <dl className="space-y-1.5 rounded-control bg-surface-muted p-4 text-sm">
          {payment ? (
            <>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Pago pelo cliente (sem taxa do Dommos)</dt><dd>{cents(payment.serviceCents)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Comissão do Dommos</dt><dd>− {cents(payment.commissionCents)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-line pt-2 font-semibold"><dt>Você recebe (após a taxa do meio de pagamento)</dt><dd>{cents(payment.proShareCents)}</dd></div>
              {PAYOUT_PRO[payment.payoutStatus] && <p className="pt-1 text-xs text-ink-muted">{PAYOUT_PRO[payment.payoutStatus]}.</p>}
              {payment.method === 'credit_card' && <p className="pt-1 text-xs text-ink-muted">No cartão, o repasse chega em 32 dias corridos (parcelado: uma parcela a cada 32 dias). No Pix é na hora.</p>}
            </>
          ) : (
            <>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Valor do serviço</dt><dd>{cents(state.proPreview.proGrossCents + state.proPreview.commissionCents)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Comissão do Dommos</dt><dd>− {cents(state.proPreview.commissionCents)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-line pt-2 font-semibold"><dt>Você recebe, até</dt><dd>{cents(state.proPreview.proGrossCents)}</dd></div>
              <p className="pt-1 text-xs text-ink-muted">{state.proPreview.gatewayFeePayer === 'professional' ? 'A taxa do meio de pagamento (Pix, cartão ou boleto) é descontada da sua parte.' : 'A taxa do meio de pagamento fica por conta do Dommos.'}</p>
            </>
          )}
        </dl>
      )}
      {!isClient && !payment && <p className="text-sm text-ink-soft">{state.blockedReason ?? 'O cliente ainda não iniciou o pagamento.'}</p>}

      {/* Cliente: aviso e formulário */}
      {isClient && retry && <p role="status" className="rounded-control bg-warning-soft p-3 text-sm text-warning-strong">{payment.status === 'expired' ? 'O pagamento anterior expirou. Gere um novo para continuar.' : 'O pagamento foi recusado. Tente outro meio de pagamento.'}</p>}
      {isClient && showForm && (
        <form onSubmit={start} noValidate className="space-y-4">
          <p className="text-sm text-ink-soft">Total a pagar: <strong className="text-lg text-ink">{cents(total)}</strong>{fee > 0 && <span className="text-ink-muted"> (inclui {cents(fee)} de taxa de serviço)</span>}</p>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Como você quer pagar?</legend>
            <div className="space-y-2">
              {state.methods.map((item) => (
                <label key={item.value} className="flex cursor-pointer items-start gap-3 rounded-control border border-line p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="radio" className="mt-1" name="method" value={item.value} checked={method === item.value} onChange={() => setMethod(item.value)} />
                  <span><strong>{METHOD_TEXT[item.value][0]}</strong><span className="block text-ink-muted">{METHOD_TEXT[item.value][1]}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          {method === 'credit_card' && state.installments.length > 1 && (
            <Select label="Parcelas" value={installments} onChange={(event) => setInstallments(event.target.value)} hint="O Dommos não soma juros: o total é o mesmo em qualquer número de parcelas.">
              {state.installments.map((option) => <option key={option.count} value={option.count}>{option.count === 1 ? `À vista, ${cents(total)}` : `${option.count}x de ${cents(option.valueCents)}`}</option>)}
            </Select>
          )}
          {state.needsDocument && <Input label="CPF ou CNPJ de quem paga" name="cpf_cnpj" inputMode="numeric" autoComplete="off" value={payerDoc} onChange={(event) => { const digits = event.target.value.replace(/\D/g, ''); setPayerDoc(digits.length > 11 ? formatCnpj(digits) : formatCpf(digits)); setErrors({}); }} error={errors.cpf_cnpj} hint="Exigido pelo processador de pagamento. Fica guardado só para os próximos pagamentos." />}
          {errors.form && <p role="alert" className="rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{errors.form}</p>}
          <Button type="submit" loading={busy === 'start'}>{method === 'pix' ? 'Gerar Pix' : 'Continuar para o pagamento'}</Button>
        </form>
      )}
      {isClient && !showForm && !payment && <p className="text-sm text-ink-soft">{state.blockedReason}</p>}

      {/* Cobrança em aberto */}
      {isClient && pending && payment.method === 'pix' && payment.pix && (
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="mx-auto"><PixQrCode payload={payment.pix.payload} /></div>
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-ink-soft">Valor: <strong className="text-ink">{cents(payment.amountCents)}</strong></p>
            <Countdown until={payment.expiresAt} />
            <CopyCode value={payment.pix.payload} />
            <p className="text-xs leading-5 text-ink-muted">Abra o app do seu banco, pague com Pix e pronto: esta tela atualiza sozinha em segundos, sem precisar recarregar.</p>
          </div>
        </div>
      )}
      {isClient && pending && payment.method !== 'pix' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">{payment.method === 'credit_card' ? `Pague ${cents(payment.amountCents)}${payment.installments > 1 ? ` em ${payment.installments}x` : ''} no site seguro do Asaas.` : `Gere e pague o boleto de ${cents(payment.amountCents)} no site seguro do Asaas.`} Quando o pagamento for confirmado, esta tela atualiza sozinha.</p>
          {payment.invoiceUrl && <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({})}>{payment.method === 'credit_card' ? 'Pagar com cartão' : 'Abrir boleto'}</a>}
        </div>
      )}

      {/* Pago */}
      {payment?.status === 'confirmed' && isClient && (
        <div className="space-y-3">
          <p className="rounded-control bg-success-soft p-3 text-sm text-success-strong">Pagamento confirmado: {cents(payment.amountCents)}. {payment.serviceConfirmed ? 'Você confirmou o serviço.' : 'Se algo não sair como combinado, abra uma reclamação antes de confirmar o serviço.'}</p>
          {payment.autoConfirmAt && !payment.serviceConfirmed && <p className="text-sm text-ink-soft">Se você não responder até <strong>{formatDay(payment.autoConfirmAt, { day: 'numeric', month: 'long' })}</strong>, o serviço é confirmado automaticamente e o valor é liberado.</p>}
          <div className="flex flex-wrap gap-3">
            {payment.canConfirmService && <Button onClick={() => setConfirming(true)} loading={busy === 'confirm'}>Confirmar serviço</Button>}
            {payment.canDispute && <Button variant="secondary" onClick={() => setDispute(true)}>Abrir reclamação</Button>}
          </div>
        </div>
      )}
      {payment?.status === 'disputed' && <p role="status" className="rounded-control bg-info-soft p-3 text-sm text-info-strong">Reclamação em análise. O nosso time vai decidir entre liberar ao profissional ou estornar ao cliente, e as duas partes serão avisadas.</p>}
      {payment?.status === 'chargeback' && <p role="status" className="rounded-control bg-danger-soft p-3 text-sm text-danger-strong">O pagamento foi contestado no cartão e está sendo analisado.</p>}
      {payment?.status === 'refunded' && <p className="rounded-control bg-surface-muted p-3 text-sm text-ink-soft">Pagamento estornado ({cents(payment.refundedCents || payment.amountCents)}).</p>}
      {payment?.status === 'confirmed' && payment.refundedCents > 0 && <p className="rounded-control bg-surface-muted p-3 text-sm text-ink-soft">Estorno parcial de {cents(payment.refundedCents)}, conforme a política de cancelamento.</p>}

      <div className="flex flex-wrap gap-3">
        {isClient && pending && <Button variant="ghost" onClick={() => run('cancel', () => api.post(`/payments/${payment.uuid}/cancel`), 'Cobrança cancelada.')} loading={busy === 'cancel'}>Cancelar cobrança</Button>}
        {payment?.receiptNumber && <Button variant="secondary" to={`/pagamentos/${payment.uuid}/recibo`}>Ver recibo</Button>}
      </div>

      {payment?.events?.length > 0 && (
        <details className="border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-medium">Histórico do pagamento</summary>
          <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
            {payment.events.filter((item) => !item.type.startsWith('alert:')).map((item) => <li key={`${item.type}-${item.at}`} className="text-sm"><span className="font-medium">{EVENT_LABELS[item.type] ?? item.type}</span><span className="block text-xs text-ink-muted">{new Date(item.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></li>)}
          </ol>
        </details>
      )}

      <p className="rounded-control border border-info-line bg-info-soft p-3 text-xs leading-5 text-info-strong">Pagamento processado pelo Asaas. O Dommos nunca recebe nem guarda dados de cartão. Pague só por aqui e desconfie de quem pedir pagamento fora do pedido. <Link to="/politica-de-cancelamento" className="font-medium underline">Política de cancelamento</Link></p>

      <ConfirmDialog open={confirming} busy={busy === 'confirm'} title="Confirmar serviço" confirmLabel="Confirmar e liberar" message="Ao confirmar, o valor é liberado ao profissional e não será mais possível abrir uma reclamação sobre este pagamento." onConfirm={() => run('confirm', () => api.post(`/payments/${payment.uuid}/confirm-service`), 'Serviço confirmado. O valor foi liberado.')} onCancel={() => setConfirming(false)} />
      {dispute && <DisputeModal uuid={payment.uuid} onClose={() => setDispute(false)} onDone={() => { setDispute(false); onRefresh(); }} />}
    </Card>
  );
}

const EVENT_LABELS = {
  created: 'Cobrança criada', webhook: 'Atualização do gateway', reconcile: 'Conferido no gateway', cancel: 'Cobrança cancelada', service_confirmed: 'Cliente confirmou o serviço',
  service_auto_confirmed: 'Confirmação automática do serviço', dispute_opened: 'Reclamação aberta', dispute_refunded: 'Reclamação resolvida: estorno ao cliente', dispute_released: 'Reclamação resolvida: valor liberado',
  refunded_on_cancel: 'Estorno por cancelamento', partially_refunded_on_cancel: 'Estorno parcial por cancelamento', no_refund: 'Cancelamento sem reembolso (política)', order_closed: 'Pedido encerrado', charge_failed: 'Falha ao gerar a cobrança',
};
