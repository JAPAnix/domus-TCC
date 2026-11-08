import { useState } from 'react';
import api, { apiError } from '../services/api';
import { Button, Modal, Select, Textarea, useToast } from './ui';

const REASONS = [
  ['contact', 'Tenta levar a conversa para fora da plataforma'],
  ['scam', 'Parece golpe ou cobrança indevida'],
  ['prohibited', 'Serviço ou conteúdo proibido'],
  ['offensive', 'Conteúdo ofensivo'],
  ['spam', 'Spam ou propaganda'],
  ['other', 'Outro motivo'],
];

/** Denúncia de um pedido aberto (ou de uma proposta, com `proposalUuid`). Vai para a fila de moderação do administrador. */
export default function ReportRequestDialog({ serviceUuid, proposalUuid, open, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!reason) { setError('Escolha o motivo da denúncia.'); return; }
    setBusy(true);
    try {
      await api.post(`/services/${serviceUuid}/report`, { reason, ...(details.trim() && { details: details.trim() }), ...(proposalUuid && { proposal_uuid: proposalUuid }) });
      toast.success('Denúncia enviada. A nossa moderação vai analisar.');
      setReason(''); setDetails(''); setError('');
      onClose();
    } catch (err) {
      setError(apiError(err, 'Não foi possível enviar a denúncia.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={proposalUuid ? 'Denunciar proposta' : 'Denunciar pedido'} onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm leading-6 text-ink-soft">Conte o que há de errado. Quem foi denunciado não vê quem denunciou.</p>
        <Select label="Motivo" name="reason" required value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} error={error && !reason ? error : undefined}>
          <option value="">Escolha um motivo</option>
          {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Textarea label="Detalhes" name="details" optional rows={3} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} />
        {error && reason && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button><Button type="submit" variant="danger" loading={busy}>Enviar denúncia</Button></div>
      </form>
    </Modal>
  );
}
