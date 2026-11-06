import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useToast } from '../components/ui';

/** Cria um rascunho de anúncio e abre o passo a passo na primeira etapa. */
export function useCreateListing() {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const { data } = await api.post('/pro/listings');
      navigate(`/pro/anuncio/${data.uuid}/etapa/1`);
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível criar o anúncio.'));
      setBusy(false);
    }
  }
  return { create, busy };
}
