import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
export default function ServiceWorkflowActions({ uuid, onCompleted }) {
  const { user } = useAuth();
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
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
      setConfirm(false); onCompleted(); window.dispatchEvent(new Event('notifications-read'));
    } catch(err) { setError(err.response?.data?.message || 'Não foi possível concluir o serviço.'); }
    finally { setSaving(false); }
  }
  if (!user) return null;
  return <section className="my-4 space-y-3">
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {context?.isClient && context.status==='in_progress' && (confirm ? <div className="rounded-xl border p-4"><p>Confirmar que o serviço foi realizado? A conclusão libera a avaliação para vocês dois.</p><button disabled={saving} onClick={complete} className="mr-4 mt-3 rounded-lg bg-violet-600 px-4 py-2 text-white">{saving?'Concluindo...':'Confirmar conclusão'}</button><button disabled={saving} onClick={() => setConfirm(false)}>Voltar</button></div> : <button onClick={() => setConfirm(true)} className="rounded-lg bg-violet-600 px-4 py-3 font-semibold text-white">Concluir serviço</button>)}
    {context?.canReview && <Link to={'/servicos/'+uuid+'/avaliar'} className="inline-block rounded-lg bg-violet-600 px-4 py-3 font-semibold text-white">Avaliar {context.target.name}</Link>}
    {context?.alreadyReviewed && <p className="text-emerald-700">Você já avaliou este serviço.</p>}
  </section>;
}
