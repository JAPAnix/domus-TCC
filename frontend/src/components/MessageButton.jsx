import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useAuth } from '../context/useAuth';
import { Button, useToast } from './ui';

/** Abre (ou cria) a conversa ligada a um anúncio ou a um pedido. Visitantes passam pelo login e voltam. */
export default function MessageButton({ listingUuid, orderUuid, serviceUuid, professionalUuid, children = 'Enviar mensagem', variant = 'secondary', block = false, size = 'md' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function open() {
    if (!user) { navigate('/login', { state: { from: location.pathname + location.search } }); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/conversations', serviceUuid ? { service_uuid: serviceUuid, ...(professionalUuid && { professional_uuid: professionalUuid }) } : orderUuid ? { order_uuid: orderUuid } : { listing_uuid: listingUuid });
      navigate(`/mensagens/${data.uuid}`);
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível abrir a conversa.'));
      setBusy(false);
    }
  }
  return <Button variant={variant} size={size} block={block} onClick={open} loading={busy}>{children}</Button>;
}
