import { useState } from 'react';
import api, { apiError } from '../services/api';
import { Button, ConfirmDialog, Modal, Select, useToast } from './ui';

const DAYS = [[3, '3 dias'], [7, '7 dias'], [15, '15 dias'], [30, '30 dias']];

/** Ações do dono de um pedido aberto: editar, renovar a validade e cancelar. Só aparecem quando fazem sentido. */
export default function RequestOwnerActions({ service, onChanged }) {
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const canRenew = ['open', 'expired'].includes(service.status);
  const canEdit = ['draft', 'open'].includes(service.status);
  const canCancel = ['draft', 'open', 'expired'].includes(service.status);
  if (!canRenew && !canEdit && !canCancel) return null;

  async function run(work, success) {
    setBusy(true);
    try { await work(); toast.success(success); setCancelling(false); setRenewing(false); onChanged(); } catch (err) { toast.error(apiError(err, 'Não foi possível concluir agora.')); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canEdit && <Button size="sm" variant="secondary" to={`/servicos/${service.uuid}/editar`}>Editar pedido</Button>}
        {canRenew && <Button size="sm" variant="secondary" onClick={() => setRenewing(true)}>{service.status === 'expired' ? 'Reabrir pedido' : 'Renovar validade'}</Button>}
        {canCancel && <Button size="sm" variant="dangerOutline" onClick={() => setCancelling(true)}>Cancelar pedido</Button>}
      </div>
      <ConfirmDialog open={cancelling} danger busy={busy} title="Cancelar pedido" confirmLabel="Cancelar pedido" message="Os profissionais que enviaram proposta serão avisados e o pedido deixa de receber propostas. Essa ação não pode ser desfeita." onConfirm={() => run(() => api.patch(`/services/${service.uuid}/status`, { status: 'cancelled' }), 'Pedido cancelado.')} onCancel={() => setCancelling(false)} />
      <Modal open={renewing} title={service.status === 'expired' ? 'Reabrir pedido' : 'Renovar validade'} onClose={() => !busy && setRenewing(false)}>
        <form onSubmit={(event) => { event.preventDefault(); run(() => api.post(`/services/${service.uuid}/renew`, { days: Number(days) }), 'Validade renovada.'); }} className="space-y-4">
          <p className="text-sm leading-6 text-ink-soft">O pedido volta a receber propostas e a validade passa a contar a partir de agora.</p>
          <Select label="Receber propostas por" name="days" value={days} onChange={(event) => setDays(event.target.value)}>{DAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setRenewing(false)} disabled={busy}>Voltar</Button><Button type="submit" loading={busy}>Renovar</Button></div>
        </form>
      </Modal>
    </>
  );
}
