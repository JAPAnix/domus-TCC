import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ProfessionalPrice from '../components/ProfessionalPrice';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500';
const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const empty = { display_name: '', public_photo_url: '', headline: '', bio: '', city: '', state: '', service_region: '', billing_mode: 'quote', hourly_rate: '', daily_rate: '', catalog_service_ids: [], availability_dates: [], certifications: '', portfolio_urls: '' };
function today() { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); }

export default function CreateProfessionalProfile() {
  const { user, token, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [{ data: items }, { data: me }] = await Promise.all([api.get('/service-catalog'), api.get('/auth/me')]);
        let profile = null;
        try { profile = (await api.get('/professionals/' + me.uuid)).data; }
        catch (err) { if (err.response?.status !== 404) throw err; }
        if (!active) return;
        setCatalog(items);
        setEditing(!!profile);
        setForm({
          ...empty, display_name: profile?.displayName || [me.firstName, me.lastName].join(' '),
          public_photo_url: profile ? profile.publicPhotoUrl ?? '' : me.profilePictureUrl ?? '',
          headline: profile?.headline ?? '', bio: profile?.bio ?? '',
          city: profile?.city ?? me.city ?? '', state: profile?.state ?? me.state ?? '',
          service_region: profile?.serviceRegion ?? '', billing_mode: profile?.billingMode ?? 'quote',
          hourly_rate: profile?.hourlyRate ?? '', daily_rate: profile?.dailyRate ?? '',
          catalog_service_ids: profile?.catalogServices?.map(item => item.catalogItemId) ?? [],
          availability_dates: profile?.availabilityEntries?.filter(item => item.isAvailable && String(item.date).slice(0,10) >= today()).map(item => String(item.date).slice(0,10)) ?? [],
          certifications: profile?.certifications ?? '',
          portfolio_urls: profile?.portfolioImages?.map(item => item.url).join('\n') ?? ''
        });
        setLoadError('');
        setReady(true);
      } catch { if (active) setLoadError('Não foi possível carregar seu cadastro. Tente novamente.'); }
    }
    load();
    return () => { active = false; };
  }, [user?.uuid, retry]);

  const change = event => { setForm(previous => ({ ...previous, [event.target.name]: event.target.value })); setPreview(false); };
  const selected = catalog.filter(item => form.catalog_service_ids.includes(item.id));
  const images = form.portfolio_urls.split('\n').map(url => url.trim()).filter(Boolean);
  const validImage = url => { try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; } };
  const toggleService = id => {
    setForm(previous => ({ ...previous, catalog_service_ids: previous.catalog_service_ids.includes(id) ? previous.catalog_service_ids.filter(value => value !== id) : [...previous.catalog_service_ids, id] }));
    setPreview(false);
  };

  function showPreview(event) {
    event.preventDefault();
    setError('');
    if (!form.display_name.trim() || !form.headline.trim() || !form.bio.trim() || !form.service_region.trim()) return setError('Preencha os campos obrigatórios.');
    if (!selected.length || selected.length > 30) return setError('Selecione entre 1 e 30 serviços.');
    if (!form.availability_dates.length) return setError('Adicione pelo menos uma data disponível.');
    if (images.length > 12 || images.some(url => !validImage(url))) return setError('Use até 12 links de imagens válidos, começando com http:// ou https://.');
    if (form.public_photo_url && !validImage(form.public_photo_url)) return setError('Informe um link válido para a foto.');
    setPreview(true);
  }

  async function publish() {
    setSaving(true); setError('');
    try {
      const payload = {
        ...form, public_photo_url: form.public_photo_url.trim(), portfolio_urls: images, publish: true,
        hourly_rate: form.billing_mode === 'hourly' ? Number(form.hourly_rate) : 0,
        daily_rate: form.billing_mode === 'daily' ? Number(form.daily_rate) : null
      };
      if (editing) await api.patch('/professionals/' + user.uuid, payload);
      else await api.post('/professionals', payload);
      setEditing(true);
      const { data } = await api.get('/auth/me');
      login(token, data);
      navigate('/painel-profissional');
    } catch (err) { setError(err.response?.data?.errors?.map(item => item.message).join(' ') || err.response?.data?.message || 'Não foi possível publicar seu perfil.'); }
    finally { setSaving(false); }
  }

  if (loadError) return <main className="mx-auto max-w-xl p-8"><p role="alert">{loadError}</p><button className="mt-4 text-violet-700" onClick={() => setRetry(value => value+1)}>Tentar novamente</button></main>;
  if (!ready) return <p role="status" className="p-12 text-center">Carregando seu cadastro...</p>;

  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
    <div className="mx-auto max-w-3xl">
      {!editing && <ol aria-label="Etapas do cadastro" className="mb-6 flex gap-3 text-sm"><li className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-700">1. Conta criada</li><li aria-current="step" className="rounded-full bg-violet-100 px-4 py-2 font-semibold text-violet-700">2. Perfil profissional</li></ol>}
      <h1 className="text-2xl font-bold">{editing ? 'Editar perfil profissional' : 'Crie seu perfil profissional'}</h1>
      <p className="mb-7 mt-2 text-slate-500">Conte o que você faz e onde atende. Revise a prévia antes de publicar.</p>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {preview ? <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="mb-5 text-sm font-semibold text-violet-700">Prévia do perfil público</p>
        <div className="flex items-center gap-4">{form.public_photo_url && <img src={form.public_photo_url} alt="" className="h-20 w-20 rounded-full object-cover" />}
          <div><h2 className="text-xl font-bold">{form.display_name}</h2><p>{form.headline}</p><p className="text-sm text-slate-500">{form.city} / {form.state}</p></div></div>
        <p className="mt-5 text-lg font-semibold text-violet-700"><ProfessionalPrice mode={form.billing_mode} hourly={form.hourly_rate} daily={form.daily_rate} /></p>
        <p className="mt-4 whitespace-pre-line">{form.bio}</p>
        <h3 className="mt-5 font-semibold">Região de atendimento</h3><p>{form.service_region}</p>
        <h3 className="mt-5 font-semibold">Serviços oferecidos</h3><p>{selected.map(item => item.name).join(', ')}</p>
        <h3 className="mt-5 font-semibold">Datas disponíveis</h3><p>{form.availability_dates.map(value => new Date(value+'T12:00:00').toLocaleDateString('pt-BR')).join(', ')}</p>
        {form.certifications && <><h3 className="mt-5 font-semibold">Cursos e certificações</h3><p className="whitespace-pre-line">{form.certifications}</p></>}
        {!!images.length && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{images.map((url, i) => <img key={i} src={url} alt="Trabalho realizado" className="aspect-square w-full rounded-xl object-cover" />)}</div>}
        <p className="mt-6 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Essas informações ficarão públicas. Seu e-mail, telefone e endereço residencial não são exibidos neste perfil.</p>
        <div className="mt-6 flex flex-wrap gap-3"><button disabled={saving} onClick={() => setPreview(false)} className="rounded-lg border px-5 py-3">Voltar e editar</button><button disabled={saving} onClick={publish} className="rounded-lg bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Publicando...' : editing ? 'Salvar e publicar alterações' : 'Publicar meu perfil profissional'}</button></div>
      </section> : <form onSubmit={showPreview} className="space-y-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-sm text-slate-500">Campos com * são obrigatórios.</p>
        <fieldset className="space-y-4"><legend className="mb-3 text-lg font-semibold">Apresentação</legend>
          <label className="block text-sm font-medium">Nome profissional *<input name="display_name" value={form.display_name} onChange={change} required minLength={2} maxLength={150} className={inputClass} /></label>
          <label className="block text-sm font-medium">Foto de perfil (opcional)<input type="url" name="public_photo_url" value={form.public_photo_url} onChange={change} maxLength={2048} placeholder="https://.../foto.jpg" className={inputClass} /><span className="text-xs text-slate-500">Informe o link de uma imagem já hospedada.</span></label>
          <label className="block text-sm font-medium">Título profissional *<input name="headline" value={form.headline} onChange={change} required maxLength={255} placeholder="Ex.: Eletricista residencial" className={inputClass} /></label>
          <label className="block text-sm font-medium">Apresentação *<textarea name="bio" value={form.bio} onChange={change} required maxLength={5000} rows={4} placeholder="Conte sua experiência e os tipos de trabalho que realiza." className={inputClass} /></label>
        </fieldset>
        <fieldset className="space-y-4"><legend className="mb-3 text-lg font-semibold">Onde você atende</legend>
          <div className="grid grid-cols-3 gap-3"><label className="col-span-2 text-sm font-medium">Cidade *<input name="city" value={form.city} onChange={change} required minLength={2} maxLength={100} className={inputClass} /></label>
            <label className="text-sm font-medium">UF *<select name="state" value={form.state} onChange={change} required className={inputClass}><option value="">Selecione</option>{states.map(uf => <option key={uf}>{uf}</option>)}</select></label></div>
          <label className="block text-sm font-medium">Região de atendimento *<textarea name="service_region" value={form.service_region} onChange={change} required minLength={2} maxLength={500} rows={2} placeholder="Bairros, cidades próximas ou atendimento remoto." className={inputClass} /></label>
        </fieldset>
        <fieldset><legend className="mb-3 text-lg font-semibold">Serviços oferecidos *</legend>
          <label className="text-sm">Buscar no catálogo<input type="search" value={search} onChange={event => setSearch(event.target.value)} className={inputClass} placeholder="Ex.: limpeza, elétrica..." /></label>
          <p className="my-2 text-xs text-slate-500">{form.catalog_service_ids.length} de 30 selecionados</p>
          <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {catalog.filter(item => (item.name+' '+item.category.name).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(item => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-violet-50"><input type="checkbox" className="mt-1 accent-violet-600" checked={form.catalog_service_ids.includes(item.id)} disabled={form.catalog_service_ids.length >= 30 && !form.catalog_service_ids.includes(item.id)} onChange={() => toggleService(item.id)} /><span className="text-sm">{item.name}<small className="block text-slate-500">{item.category.name}</small></span></label>)}
          </div>
        </fieldset>
        <fieldset className="space-y-4"><legend className="mb-3 text-lg font-semibold">Forma de cobrança *</legend>
          <div className="flex flex-wrap gap-4">{[['quote','Sob orçamento'],['hourly','Por hora'],['daily','Por diária']].map(([value,label]) => <label key={value} className="text-sm"><input type="radio" name="billing_mode" value={value} checked={form.billing_mode===value} onChange={change} className="accent-violet-600" /> {label}</label>)}</div>
          {form.billing_mode !== 'quote' ? <label className="block text-sm font-medium">{form.billing_mode === 'hourly' ? 'Valor por hora (R$) *' : 'Valor por diária (R$) *'}<input type="number" name={form.billing_mode === 'hourly' ? 'hourly_rate' : 'daily_rate'} value={form.billing_mode === 'hourly' ? form.hourly_rate : form.daily_rate} onChange={change} required min="0.01" max="99999999.99" step="0.01" className={inputClass} /></label> : <p className="text-sm text-slate-500">Você combina o preço depois de conhecer o serviço. Não será exibido um valor fixo.</p>}
        </fieldset>
        <fieldset><legend className="mb-3 text-lg font-semibold">Datas disponíveis *</legend>
          <p className="mb-2 text-sm text-slate-500">Você aparecerá na busca nas datas selecionadas. Atualize sua agenda quando necessário.</p>
          <div className="flex flex-wrap gap-2"><label className="min-w-0 flex-1 text-sm">Data<input type="date" value={date} min={today()} onChange={event => setDate(event.target.value)} className={inputClass} /></label><button type="button" disabled={!date || date < today() || form.availability_dates.length >= 180} onClick={() => { setForm(previous => ({...previous, availability_dates: [...new Set([...previous.availability_dates, date])].sort()})); setDate(''); }} className="self-end rounded-lg bg-violet-100 px-4 py-3 text-sm font-semibold text-violet-700 disabled:opacity-40">Adicionar</button></div>
          <div className="mt-3 flex flex-wrap gap-2">{form.availability_dates.map(value => <button type="button" key={value} aria-label={'Remover data '+value} onClick={() => setForm(previous => ({...previous, availability_dates: previous.availability_dates.filter(item => item !== value)}))} className="rounded-full bg-violet-50 px-3 py-2 text-sm text-violet-700">{new Date(value+'T12:00:00').toLocaleDateString('pt-BR')} ×</button>)}</div>
        </fieldset>
        <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">Trabalhos, cursos e certificações (opcional)</summary>
          <label className="mt-4 block text-sm">Fotos de trabalhos<textarea name="portfolio_urls" value={form.portfolio_urls} onChange={change} rows={3} placeholder="Um link de imagem por linha, até 12 fotos." className={inputClass} /></label>
          <label className="mt-4 block text-sm">Cursos e certificações<textarea name="certifications" value={form.certifications} onChange={change} rows={3} maxLength={5000} className={inputClass} /></label>
        </details>
        <div className="flex flex-wrap items-center gap-4"><Link to="/perfil" className="text-sm text-slate-600">Completar depois</Link><button type="submit" className="rounded-lg bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700">Revisar perfil antes de publicar</button></div>
      </form>}
    </div>
  </main>;
}
