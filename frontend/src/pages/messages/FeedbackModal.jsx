import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import api, { apiError } from '../../services/api';
import { Button, Modal, Textarea, useToast } from '../../components/ui';

export default function FeedbackModal({ onClose }) {
  const toast = useToast();
  const { pathname } = useLocation();
  const [kind, setKind] = useState('idea');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (message.trim().length < 10) { setError('Conte um pouco mais (mínimo de 10 caracteres).'); return; }
    setBusy(true);
    try {
      await api.post('/feedback', { kind, message, page: pathname });
      toast.success('Obrigado! Recebemos o seu feedback.');
      onClose();
    } catch (err) {
      setError(apiError(err, 'Não foi possível enviar o feedback.'));
      setBusy(false);
    }
  }
  return (
    <Modal open title="Dar feedback" onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Sobre o que é?</legend>
          <div className="space-y-2">
            <label className="flex min-h-control cursor-pointer items-center gap-3 text-sm"><input type="radio" name="kind" value="idea" checked={kind === 'idea'} onChange={() => setKind('idea')} />Tenho uma ideia ou sugestão</label>
            <label className="flex min-h-control cursor-pointer items-center gap-3 text-sm"><input type="radio" name="kind" value="bug" checked={kind === 'bug'} onChange={() => setKind('bug')} />Estou relatando uma falha</label>
          </div>
        </fieldset>
        <Textarea label="Conte para nós" value={message} onChange={(event) => { setMessage(event.target.value); setError(''); }} error={error} maxLength={2000} rows={5} />
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" loading={busy}>Enviar</Button></div>
      </form>
    </Modal>
  );
}
