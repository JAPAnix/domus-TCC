import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
export default function CreateReview() {
  const { uuid } = useParams();
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    let active=true;
    api.get('/services/'+uuid+'/review-context').then(({data}) => { if(active) setContext(data); }).catch(err => {if(active)setError(err.response?.data?.message || 'Não foi possível carregar a avaliação.');});
    return () => {active=false;};
  },[uuid]);
  async function submit(event) {
    event.preventDefault();setSaving(true);setError('');
    try { await api.post('/services/'+uuid+'/reviews',{rating, ...(comment.trim() && {comment:comment.trim()})});setSuccess(true); }
    catch(err){setError(err.response?.data?.errors?.map(item=>item.message).join(' ') || err.response?.data?.message || 'Não foi possível enviar a avaliação.');}
    finally{setSaving(false);}
  }
  return <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
    <h1 className="text-2xl font-bold">Avaliar experiência</h1>
    {error && <p role="alert" className="my-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {!context && !error && <p role="status">Carregando...</p>}
    {context && <><p className="mt-3 text-slate-500">{context.title}</p><h2 className="my-4 text-lg">Sua avaliação de {context.target.name}</h2>
      {success || context.alreadyReviewed ? <p role="status" className="rounded-xl bg-emerald-50 p-5 text-emerald-700">{success?'Avaliação enviada com sucesso.':'Você já avaliou este serviço.'}</p>
      : context.canReview ? <form onSubmit={submit} className="space-y-5 rounded-xl border p-6">
        <fieldset><legend className="mb-3 font-semibold">Nota</legend><div className="flex flex-wrap gap-3">{[1,2,3,4,5].map(value=><label key={value} className="cursor-pointer rounded-lg border p-3"><input type="radio" name="rating" value={value} checked={rating===value} onChange={()=>setRating(value)} /> {value} ★</label>)}</div></fieldset>
        <label className="block">Comentário (opcional, mínimo de 10 caracteres)<textarea value={comment} onChange={event=>setComment(event.target.value)} minLength={10} maxLength={5000} rows={4} className="mt-2 w-full rounded-lg border p-3" /></label>
        <button disabled={saving} className="rounded-lg bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving?'Enviando...':'Enviar avaliação'}</button>
      </form> : <p className="rounded-xl bg-slate-50 p-4">A avaliação estará disponível quando o cliente concluir o serviço.</p>}
    </>}
    <Link to={'/servicos/'+uuid} className="mt-5 inline-block text-violet-700">Voltar ao serviço</Link>
  </main>;
}
