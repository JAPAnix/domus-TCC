import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { formatMoney } from '../utils/format';
import { copyText } from '../utils/clipboard';
import { paymentStatus } from '../utils/status';
import PaymentNotice from './PaymentNotice';
import AsaasCheckout from './AsaasCheckout';
import PixQrCode from './PixQrCode';
import StatusBadge from './StatusBadge';
import { Button, Card, ConfirmDialog, ErrorState, Modal, SkeletonList, Textarea, useToast } from './ui';

const when = (value) => (value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const EVENT_LABELS = {
  created: 'Cobrança criada', method_changed: 'Forma de pagamento alterada', report: 'Cliente informou o pagamento', confirm: 'Recebimento confirmado',
  reject: 'Profissional não encontrou o pagamento', cancel: 'Cobrança cancelada', refund: 'Estorno registrado', order_closed: 'Pedido encerrado',
  amount_updated: 'Valor atualizado', webhook: 'Atualização do provedor', charge_failed: 'Falha ao gerar a cobrança',
};

function CopyField({ label, value }) {
  const toast = useToast();
  async function copy() {
    if (await copyText(value)) toast.success(`${label} copiado.`);
    else toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
  }
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="mt-1 flex items-stretch gap-2">
        <input readOnly aria-label={label} value={value} onFocus={(event) => event.target.select()} className="min-h-control min-w-0 flex-1 rounded-control border border-line bg-surface-muted px-3 text-sm" />
        <Button variant="secondary" onClick={copy}>Copiar</Button>
      </div>
    </div>
  );
}

function RejectModal({ onClose, onSubmit, busy }) {
  const [note, setNote] = useState('');
  return (
    <Modal open title="Não recebi o pagamento" onClose={() => !busy && onClose()}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(note); }} className="space-y-4">
        <p className="text-sm leading-6 text-ink-soft">O cliente será avisado e poderá informar o pagamento de novo. Se quiser, explique o que você viu.</p>
        <Textarea label="Mensagem (opcional)" optional value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} rows={3} />
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button><Button type="submit" loading={busy}>Enviar</Button></div>
      </form>
    </Modal>
  );
}

const CONFIRMS = {
  cancel: { title: 'Cancelar a cobrança', label: 'Cancelar cobrança', text: 'Ninguém será cobrado por esta tentativa. Se precisar, é possível gerar outra.', success: 'Cobrança cancelada.' },
  refund: { title: 'Registrar estorno', label: 'Registrar estorno', text: 'Use depois de devolver o dinheiro ao cliente. O Dommos só registra: a devolução acontece direto entre vocês.', success: 'Estorno registrado.' },
  confirm: { title: 'Confirmar recebimento', label: 'Confirmar recebimento', text: 'Confirme só depois de ver o valor na sua conta ou receber o dinheiro. Isso libera o recibo para as duas partes.', success: 'Recebimento confirmado. O recibo está disponível.' },
};

export default function OrderPayment({ orderUuid }) {
  const toast = useToast();
  const resource = useApiResource(`/payments/order/${orderUuid}`, undefined, { keepPrevious: true });
  const state = resource.data;
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const payment = state?.payment;
  const open = payment && ['pending', 'reported'].includes(payment.status);

  // Atualiza sozinho enquanto há algo em aberto, para a outra parte ver a mudança sem recarregar.
  const { retry } = resource;
  useEffect(() => {
    if (!open) return undefined;
    const timer = setInterval(() => { if (!document.hidden) retry(); }, 12000);
    return () => clearInterval(timer);
  }, [open, retry]);

  async function run(label, request, success) {
    setBusy(label);
    try {
      await request();
      toast.success(success);
      resource.retry();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível concluir.'));
    } finally {
      setBusy('');
      setConfirming(null);
      setRejecting(false);
    }
  }
  const act = (action, body, success) => run(action, () => api.post(`/payments/${payment.uuid}/${action}`, body ?? {}), success);

  if (!state && resource.loading) return <Card><SkeletonList count={2} label="Carregando pagamento" itemClassName="h-16" /></Card>;
  if (resource.error && !state) return <Card><ErrorState title="Não foi possível carregar o pagamento" message={apiError(resource.error)} onRetry={resource.retry} /></Card>;

  if (state.provider === 'asaas') return <AsaasCheckout orderUuid={orderUuid} state={state} onRefresh={resource.retry} />;

  const chosen = method || state.methods[0]?.value || '';
  const has = (action) => payment?.actions.includes(action);
  const isClient = payment ? payment.role === 'client' : state.canStart;

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Pagamento</h2>
        {payment && <StatusBadge status={payment.status} map={paymentStatus} />}
      </div>

      {!payment && (
        state.canStart ? (
          <form onSubmit={(event) => { event.preventDefault(); run('start', () => api.post(`/payments/order/${orderUuid}`, { method: chosen }), 'Cobrança criada.'); }} className="space-y-4">
            <p className="text-sm text-ink-soft">Valor a pagar: <strong className="text-lg text-ink">{formatMoney(state.amountDue)}</strong></p>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Como você vai pagar?</legend>
              <div className="space-y-2">
                {state.methods.map((item) => (
                  <label key={item.value} className="flex min-h-control cursor-pointer items-center gap-3 rounded-control border border-line px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                    <input type="radio" name="method" value={item.value} checked={chosen === item.value} onChange={() => setMethod(item.value)} />{item.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" loading={busy === 'start'}>Ver como pagar</Button>
          </form>
        ) : (
          <p className="text-sm leading-6 text-ink-soft">
            {state.blockedReason ?? (state.amountDue != null ? 'O cliente ainda não iniciou o pagamento.' : '')}
            {!isClient && state.methods.length === 0 && <> <Link to="/configuracoes/pagamentos" className="font-medium text-primary-strong underline">Configure como você recebe</Link>.</>}
          </p>
        )
      )}

      {payment && (
        <>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-ink-muted">Valor</dt><dd className="text-xl font-bold">{formatMoney(payment.amount)}</dd></div>
            <div><dt className="text-sm text-ink-muted">Forma de pagamento</dt><dd className="font-medium">{payment.methodLabel}</dd></div>
          </dl>

          {payment.pix && (
            <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
              {payment.role === 'client' && <div className="mx-auto"><PixQrCode payload={payment.pix.payload} /></div>}
              <div className="min-w-0 space-y-3">
                {payment.role === 'client' ? (
                  <>
                    {payment.pix.key && <CopyField label="Chave Pix" value={payment.pix.key} />}
                    <CopyField label="Pix copia e cola" value={payment.pix.payload} />
                    <p className="text-xs leading-5 text-ink-muted">Abra o app do seu banco, escolha pagar com Pix, leia o QR Code ou cole o código. Confira o nome do recebedor e o valor antes de confirmar.</p>
                  </>
                ) : <p className="text-sm text-ink-soft">O cliente vai pagar para a chave {payment.pix.key}. Quando o valor entrar na sua conta, confirme o recebimento.</p>}
              </div>
            </div>
          )}
          {payment.method !== 'pix' && open && <p className="rounded-control bg-surface-muted p-3 text-sm leading-6 text-ink-soft">{payment.role === 'client' ? 'Pague direto ao profissional, no dia do serviço, pela forma escolhida.' : 'O cliente pagará direto a você. Confirme quando receber.'}</p>}
          {payment.status === 'reported' && payment.role === 'client' && <p className="text-sm text-ink-soft">Você avisou que pagou. Agora é só aguardar o profissional confirmar o recebimento.</p>}
          {payment.note && <p className="rounded-control bg-surface-muted p-3 text-sm text-ink-soft">Mensagem registrada: {payment.note}</p>}

          <div className="flex flex-wrap gap-3">
            {has('report') && <Button onClick={() => act('report', null, 'Pagamento informado. O profissional foi avisado.')} loading={busy === 'report'}>Já paguei</Button>}
            {has('confirm') && <Button onClick={() => setConfirming('confirm')}>Confirmar recebimento</Button>}
            {has('reject') && <Button variant="secondary" onClick={() => setRejecting(true)}>Não recebi</Button>}
            {has('cancel') && <Button variant="ghost" onClick={() => setConfirming('cancel')}>Cancelar cobrança</Button>}
            {has('refund') && <Button variant="dangerOutline" onClick={() => setConfirming('refund')}>Registrar estorno</Button>}
            {payment.receiptNumber && <Button variant="secondary" to={`/pagamentos/${payment.uuid}/recibo`}>Ver recibo</Button>}
          </div>

          {payment.events?.length > 0 && (
            <details className="border-t border-line pt-4">
              <summary className="cursor-pointer text-sm font-medium">Histórico do pagamento</summary>
              <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
                {state.payment.events.map((item) => <li key={`${item.type}-${item.at}`} className="text-sm"><span className="font-medium">{EVENT_LABELS[item.type] ?? item.type}</span><span className="block text-xs text-ink-muted">{when(item.at)}{item.byMe ? ' · por você' : ''}</span></li>)}
              </ol>
            </details>
          )}
        </>
      )}

      <PaymentNotice compact={!!payment && !open} />

      <ConfirmDialog
        open={!!confirming}
        busy={!!busy}
        danger={confirming === 'refund' || confirming === 'cancel'}
        title={confirming ? CONFIRMS[confirming].title : ''}
        confirmLabel={confirming ? CONFIRMS[confirming].label : ''}
        message={confirming ? CONFIRMS[confirming].text : ''}
        onConfirm={() => act(confirming, null, CONFIRMS[confirming].success)}
        onCancel={() => setConfirming(null)}
      />
      {rejecting && <RejectModal busy={busy === 'reject'} onClose={() => setRejecting(false)} onSubmit={(note) => act('reject', { note }, 'O cliente foi avisado.')} />}
    </Card>
  );
}
