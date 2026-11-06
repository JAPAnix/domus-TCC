import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { apiError } from '../../services/api';
import { useAuth } from '../../context/useAuth';
import { useApiResource } from '../../hooks/useApiResource';
import { Button, Modal, Textarea, useToast } from '../ui';

function ReportForm({ uuid, onClose }) {
  const toast = useToast();
  const reasons = useApiResource('/listings/report-reasons');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!reason) { setError('Escolha o motivo da denúncia.'); return; }
    setBusy(true);
    try {
      await api.post(`/listings/${uuid}/report`, { reason, details });
      toast.success('Denúncia enviada. Vamos analisar o anúncio.');
      onClose();
    } catch (err) {
      setError(apiError(err, 'Não foi possível enviar a denúncia.'));
      setBusy(false);
    }
  }
  return (
    <Modal open title="Denunciar este anúncio" onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Qual é o problema?</legend>
          <div className="space-y-1">
            {(reasons.data ?? []).map((item) => <label key={item.value} className="flex min-h-control cursor-pointer items-center gap-3 text-sm"><input type="radio" name="reason" value={item.value} checked={reason === item.value} onChange={() => { setReason(item.value); setError(''); }} />{item.label}</label>)}
          </div>
          {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
        </fieldset>
        <Textarea label="Detalhes (opcional)" optional value={details} onChange={(event) => setDetails(event.target.value)} maxLength={500} rows={3} />
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" loading={busy}>Enviar denúncia</Button></div>
      </form>
    </Modal>
  );
}

/** Link "Denunciar este anúncio". Quem não está logado passa pelo login e volta. */
export default function ReportListing({ uuid }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => (user ? setOpen(true) : navigate('/login', { state: { from: location.pathname } }))} className="text-sm font-medium underline underline-offset-2 hover:text-primary-strong">Denunciar este anúncio</button>
      {open && <ReportForm uuid={uuid} onClose={() => setOpen(false)} />}
    </>
  );
}
