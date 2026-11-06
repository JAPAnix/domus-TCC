import { useState } from 'react';
import api, { apiError, apiFieldErrors } from '../services/api';
import { formatMoney } from '../utils/format';
import { Button, ConfirmDialog, Input, Modal, useToast } from './ui';

const CONFIRM = {
  decline: { title: 'Recusar pedido', label: 'Recusar', danger: true, text: 'O cliente será avisado de que você não pode atender.', success: 'Pedido recusado.' },
  cancel: { title: 'Cancelar pedido', label: 'Cancelar pedido', danger: true, text: 'A outra pessoa será avisada. Essa ação não pode ser desfeita.', success: 'Pedido cancelado.' },
};
const DIRECT = {
  accept: { label: 'Aceitar', success: 'Pedido aceito. O cliente foi avisado.' },
  start: { label: 'Iniciar serviço', success: 'Serviço iniciado.' },
};

function CompleteModal({ order, onClose, onDone }) {
  const toast = useToast();
  const suggested = order.total != null ? String(order.total) : '';
  const [amount, setAmount] = useState(suggested);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const value = Number(amount);
    if (!amount || !(value > 0)) { setError('Informe um valor maior que zero.'); return; }
    setBusy(true);
    try {
      await api.post(`/orders/${order.uuid}/complete`, { final_amount: value });
      toast.success('Serviço concluído. Cliente e profissional já podem se avaliar.');
      onDone();
    } catch (err) {
      setError(apiFieldErrors(err).final_amount ?? apiError(err, 'Não foi possível concluir.'));
      setBusy(false);
    }
  }

  const feeText = order.platformFeePercent > 0 ? `A taxa da plataforma é de ${order.platformFeePercent}%.` : 'A taxa da plataforma é 0%: você recebe o valor integral.';
  return (
    <Modal open title="Concluir serviço" onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm leading-6 text-ink-soft">Informe o valor final combinado com o cliente. Ele fica registrado em Ganhos. {feeText}</p>
        <Input label="Valor final (R$)" type="number" min="0.01" step="0.01" inputMode="decimal" required autoFocus value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} error={error} hint={suggested ? `Valor do pedido: ${formatMoney(Number(suggested))}.` : 'Por hora, por diária ou sob consulta, o total é definido por você.'} />
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button><Button type="submit" loading={busy}>Concluir serviço</Button></div>
      </form>
    </Modal>
  );
}

/** Botões do pedido conforme o papel e o status (a lista de ações vem do servidor). */
export default function OrderActions({ order, onChanged, size = 'sm' }) {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [completing, setCompleting] = useState(false);

  async function run(action) {
    setBusy(action);
    try {
      await api.post(`/orders/${order.uuid}/${action}`);
      toast.success((DIRECT[action] ?? CONFIRM[action]).success);
      setConfirming(null);
      onChanged();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível atualizar o pedido.'));
      setConfirming(null);
      onChanged();
    } finally {
      setBusy('');
    }
  }

  if (!order.actions.length) return null;
  const has = (action) => order.actions.includes(action);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {has('accept') && <Button size={size} onClick={() => run('accept')} loading={busy === 'accept'}>Aceitar</Button>}
        {has('start') && <Button size={size} onClick={() => run('start')} loading={busy === 'start'}>Iniciar serviço</Button>}
        {has('complete') && <Button size={size} onClick={() => setCompleting(true)}>Concluir serviço</Button>}
        {has('decline') && <Button size={size} variant="dangerOutline" onClick={() => setConfirming('decline')}>Recusar</Button>}
        {has('cancel') && <Button size={size} variant="secondary" onClick={() => setConfirming('cancel')}>Cancelar pedido</Button>}
      </div>
      <ConfirmDialog open={!!confirming} danger busy={!!busy} title={confirming && CONFIRM[confirming].title} confirmLabel={confirming && CONFIRM[confirming].label} message={confirming && `${CONFIRM[confirming].text}`} onConfirm={() => run(confirming)} onCancel={() => setConfirming(null)} />
      {completing && <CompleteModal order={order} onClose={() => setCompleting(false)} onDone={() => { setCompleting(false); onChanged(); }} />}
    </>
  );
}
