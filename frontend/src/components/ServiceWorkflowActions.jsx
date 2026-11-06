import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api, { apiError } from '../services/api';
import { Button, buttonClass, useToast } from './ui';
export default function ServiceWorkflowActions({ uuid, onCompleted }) {
  const { user } = useAuth();
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  useEffect(() => {
    let active = true;
    if (user) api.get('/services/'+uuid+'/review-context').then(({data}) => { if (active) setContext(data); }).catch(err => { if (active && ![403,404,409].includes(err.response?.status)) setError('Não foi possível carregar as ações do serviço.'); });
    return () => { active=false; };
  }, [uuid, user]);
  async function complete() {
    setSaving(true); setError('');
    try {
      await api.patch('/services/'+uuid+'/status', { status:'completed' });
      setContext(previous => ({...previous,status:'completed',canReview:true}));
      setConfirm(false); onCompleted(); window.dispatchEvent(new Event('notifications-read')); toast.success('Serviço concluído. Agora vocês podem se avaliar.');
    } catch(err) { setError(apiError(err, 'Não foi possível concluir o serviço.')); }
    finally { setSaving(false); }
  }
  if (!user) return null;
  return <section className="my-4 space-y-3">
    {error && <p role="alert" className="text-danger">{error}</p>}
    {context?.isClient && context.status==='in_progress' && (confirm ? <div className="rounded-control border border-line p-4"><p className="text-sm">Confirmar que o serviço foi realizado? A conclusão libera a avaliação para vocês dois.</p><div className="mt-3 flex flex-wrap gap-3"><Button loading={saving} onClick={complete}>{saving?'Concluindo...':'Confirmar conclusão'}</Button><Button variant="secondary" disabled={saving} onClick={() => setConfirm(false)}>Voltar</Button></div></div> : <Button onClick={() => setConfirm(true)}>Concluir serviço</Button>)}
    {context?.canReview && <Link to={'/servicos/'+uuid+'/avaliar'} className={buttonClass()}>Avaliar {context.target.name}</Link>}
    {context?.alreadyReviewed && <p className="text-success">Você já avaliou este serviço.</p>}
  </section>;
}
