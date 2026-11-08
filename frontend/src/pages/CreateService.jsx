import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import { useCategories } from '../hooks/useCategories';
import { useApiResource } from '../hooks/useApiResource';
import { useCepLookup } from '../hooks/useCepLookup';
import { useFeatures } from '../hooks/useFeatures';
import { maskCep } from '../utils/cep';
import { maskContacts } from '../utils/contactMask';
import { formatBudget, formatDay } from '../utils/format';
import { STATES } from '../utils/roles';
import ImageUploader from '../components/ImageUploader';
import { Breadcrumb, Button, Card, EmptyState, ErrorState, Input, Select, SkeletonList, Textarea, useToast } from '../components/ui';

const MIN_DESCRIPTION = 30;
const MODES = [['client_place', 'No meu endereço'], ['remote', 'Online'], ['pro_place', 'No local do profissional']];
const EMPTY = { category_id: '', catalog: '', title: '', description: '', city: '', state: '', neighborhood: '', deadline: '', modes: ['client_place'], flexible_budget: true, budget_min: '', budget_max: '', only_verified: false, min_rating: '', valid_days: '' };
const STEPS = [
  ['servico', 'O que você precisa'], ['descricao', 'Descrição'], ['fotos', 'Fotos'], ['local', 'Onde e quando'],
  ['orcamento', 'Orçamento'], ['preferencias', 'Preferências'], ['validade', 'Validade'], ['revisao', 'Revisão'],
];

function todayKey() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

/** Confere só a etapa atual. Devolve { campo: mensagem }. */
function validateStep(key, form) {
  const errors = {};
  if (key === 'servico') {
    if (!form.category_id) errors.category_id = 'Escolha uma categoria.';
    if (form.title.trim().length < 5) errors.title = 'O título precisa ter pelo menos 5 caracteres.';
  }
  if (key === 'descricao' && form.description.trim().length < MIN_DESCRIPTION) errors.description = `Conte um pouco mais: a descrição precisa ter pelo menos ${MIN_DESCRIPTION} caracteres.`;
  if (key === 'local') {
    if (form.city.trim().length < 2) errors.city = 'Informe a cidade onde o serviço será feito.';
    if (!/^[A-Za-z]{2}$/.test(form.state.trim())) errors.state = 'Escolha o estado.';
    if (form.deadline && form.deadline < todayKey()) errors.deadline = 'A data não pode estar no passado.';
    if (!form.modes.length) errors.modes = 'Escolha pelo menos uma forma de atendimento.';
  }
  if (key === 'orcamento' && !form.flexible_budget) {
    if (!(Number(form.budget_min) > 0)) errors.budget_min = 'Informe um valor maior que zero, ou marque "a combinar".';
    if (!(Number(form.budget_max) > 0)) errors.budget_max = 'Informe um valor maior que zero, ou marque "a combinar".';
    if (Number(form.budget_min) > Number(form.budget_max) && Number(form.budget_max) > 0) errors.budget_min = 'O valor mínimo não pode ser maior que o máximo.';
  }
  return errors;
}

function Progress({ index, steps }) {
  return (
    <nav aria-label="Etapas do pedido" className="mb-6">
      <p className="text-sm font-medium text-ink-soft">Etapa {index + 1} de {steps.length}: <span className="text-ink">{steps[index][1]}</span></p>
      <ol className="mt-3 flex gap-1.5" aria-hidden="true">{steps.map(([key], position) => <li key={key} className={`h-1.5 flex-1 rounded-full ${position <= index ? 'bg-primary' : 'bg-line'}`} />)}</ol>
    </nav>
  );
}

function Wizard({ prefill, edit, initial, draft }) {
  const navigate = useNavigate();
  const toast = useToast();
  const features = useFeatures();
  const { categories, failed: categoriesFailed } = useCategories();
  const catalog = useApiResource('/service-catalog');
  const saved = prefill?.address ?? {};
  const steps = edit ? STEPS.filter(([key]) => key !== 'validade') : STEPS;
  const defaults = features.openRequestDefaults;
  const [form, setForm] = useState(() => ({ ...EMPTY, city: saved.city || '', state: saved.state || '', neighborhood: saved.neighborhood || '', valid_days: String(defaults.defaultDays), ...initial?.form }));
  const [images, setImages] = useState(initial?.images ?? []);
  const [step, setStep] = useState(Math.min(initial?.step ?? 0, steps.length - 1));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cep, setCep] = useState('');
  const [search, setSearch] = useState('');
  const [resumed, setResumed] = useState(!!draft);
  const headingRef = useRef(null);
  const { status: cepStatus, lookup } = useCepLookup((found) => setForm((current) => ({ ...current, city: found.city, state: found.state, neighborhood: found.neighborhood || current.neighborhood })));
  const key = steps[step][0];

  // Rascunho: salva sozinho (a cada pausa na digitação) para a pessoa poder voltar depois.
  useEffect(() => {
    if (edit) return undefined;
    const timer = setTimeout(() => { api.put('/services/draft', { data: { form, images, step } }).catch(() => {}); }, 900);
    return () => clearTimeout(timer);
  }, [edit, form, images, step]);

  // Ao trocar de etapa, o foco vai para o título dela (teclado e leitor de tela).
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'state' ? value.toUpperCase() : value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };
  const toggleMode = (mode) => { setForm((current) => ({ ...current, modes: current.modes.includes(mode) ? current.modes.filter((item) => item !== mode) : [...current.modes, mode] })); setErrors((current) => ({ ...current, modes: undefined })); };

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2 || !catalog.data) return [];
    return catalog.data.filter((item) => item.name.toLowerCase().includes(term)).slice(0, 6);
  }, [search, catalog.data]);

  function pick(item) {
    setForm((current) => ({ ...current, category_id: String(item.category.id), catalog: item.name, title: current.title.trim() ? current.title : item.name }));
    setSearch(item.name);
    setErrors({});
  }

  const masked = maskContacts(`${form.title} ${form.description}`).masked;

  function next() {
    const found = validateStep(key, form);
    setErrors(found);
    if (Object.keys(found).length) { document.querySelector(`[name="${Object.keys(found)[0]}"]`)?.focus(); return; }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function publish() {
    for (const [stepKey] of steps) {
      const found = validateStep(stepKey, form);
      if (Object.keys(found).length) { setErrors(found); setStep(steps.findIndex(([item]) => item === stepKey)); return; }
    }
    setSubmitting(true);
    setSubmitError('');
    const body = {
      title: form.title.trim(), description: form.description.trim(), category_id: Number(form.category_id),
      city: form.city.trim(), state: form.state.trim().toUpperCase(),
      ...(form.neighborhood.trim() && { neighborhood: form.neighborhood.trim() }),
      ...(form.deadline && { deadline: form.deadline }),
      ...(!form.flexible_budget && { budget_min: Number(form.budget_min), budget_max: Number(form.budget_max) }),
      image_urls: images,
    };
    try {
      if (edit) {
        await api.patch(`/services/${edit}`, body);
        toast.success('Pedido atualizado.');
        navigate(`/servicos/${edit}`);
      } else {
        const { data } = await api.post('/services', { ...body, valid_days: Number(form.valid_days), modes: form.modes, only_verified: form.only_verified, ...(form.min_rating && { min_rating: Number(form.min_rating) }) });
        toast.success(data.masked ? 'Pedido publicado. Removemos formas de contato do texto: combine tudo pela plataforma.' : 'Pedido publicado. Agora é só aguardar as propostas.');
        navigate(`/servicos/${data.uuid}`);
      }
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setSubmitError(apiError(err, 'Não foi possível publicar o pedido.'));
      setSubmitting(false);
    }
  }

  async function restart() {
    await api.delete('/services/draft').catch(() => {});
    setForm({ ...EMPTY, city: saved.city || '', state: saved.state || '', neighborhood: saved.neighborhood || '', valid_days: String(defaults.defaultDays) });
    setImages([]); setStep(0); setResumed(false); setErrors({});
  }

  const category = categories.find((item) => String(item.id) === String(form.category_id));
  const modeLabels = form.modes.map((mode) => MODES.find(([value]) => value === mode)?.[1]).filter(Boolean).join(', ');

  return (
    <>
      {resumed && !edit && <p role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-control bg-primary-softer p-3 text-sm text-primary-strong">Continuamos de onde você parou. <button type="button" onClick={restart} className="font-semibold underline underline-offset-2">Começar de novo</button></p>}
      <div className="mt-6"><Progress index={step} steps={steps} /></div>
      {submitError && <p role="alert" className="mb-4 rounded-control border border-danger-line bg-danger-soft p-4 text-sm text-danger">{submitError}</p>}

      <Card as="section" aria-labelledby="etapa" className="space-y-5">
        <h2 id="etapa" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">{steps[step][1]}</h2>

        {key === 'servico' && (
          <>
            <p className="text-sm text-ink-muted">Diga que tipo de serviço procura. Quanto mais claro, melhores as propostas.</p>
            <div className="relative">
              <Input label="Buscar o tipo de serviço" optional value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: eletricista, pintura, diarista" autoComplete="off" hint="Escolha uma sugestão para preencher a categoria e o título." />
              {suggestions.length > 0 && <ul aria-label="Sugestões de serviço" className="mt-2 divide-y divide-line overflow-hidden rounded-control border border-line bg-surface">{suggestions.map((item) => <li key={item.id}><button type="button" onClick={() => pick(item)} className="flex min-h-control w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-muted"><span>{item.name}</span><span className="text-xs text-ink-muted">{item.category.name}</span></button></li>)}</ul>}
            </div>
            <Select label="Categoria" name="category_id" required value={form.category_id} onChange={change} error={errors.category_id ?? (categoriesFailed ? 'Não foi possível carregar as categorias. Recarregue a página.' : undefined)} disabled={!categories.length}>
              <option value="">{categories.length ? 'Selecione uma categoria' : 'Carregando categorias...'}</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <Input label="Título do pedido" name="title" required value={form.title} onChange={change} error={errors.title} maxLength={255} placeholder="Ex.: Instalar um chuveiro elétrico" />
          </>
        )}

        {key === 'descricao' && (
          <>
            <Textarea label="Descreva o que precisa ser feito" name="description" required rows={8} value={form.description} onChange={change} error={errors.description} hint={`${form.description.trim().length} caracteres (mínimo ${MIN_DESCRIPTION}).`} />
            {masked && <p role="status" className="rounded-control border border-warning-line bg-warning-soft p-3 text-sm text-ink-soft">Para a sua segurança, telefone, e-mail, links e redes sociais serão removidos do texto. Combine tudo pela plataforma.</p>}
            <div className="rounded-control bg-surface-muted p-4 text-sm leading-6 text-ink-soft">
              <p className="font-semibold text-ink">Uma boa descrição diz:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5"><li>o que precisa ser feito e qual o estado de hoje;</li><li>o tamanho ou a quantidade (ex.: 20 m², 3 tomadas);</li><li>se precisa de material e quem fornece;</li><li>se tem urgência ou horário preferido.</li></ul>
              <p className="mt-3 text-xs text-ink-muted">Exemplo: “Pintar sala de 20 m² e um quarto de 12 m², duas demãos, parede com pequenas manchas. Tinta fica por conta do profissional. Prefiro começar no fim de semana.”</p>
            </div>
          </>
        )}

        {key === 'fotos' && (
          <>
            <p className="text-sm text-ink-muted">Mostre o local ou o que precisa ser feito. Pedidos com fotos recebem propostas mais precisas. É opcional.</p>
            <ImageUploader label="Fotos de referência" hint="A primeira foto é a capa. JPG, PNG ou WebP, com até 5 MB." purpose="service" value={images} onChange={setImages} max={6} showCover onBusyChange={setUploading} />
          </>
        )}

        {key === 'local' && (
          <>
            <p className="text-sm text-ink-muted">Os profissionais veem só a cidade e o bairro. O endereço completo só é combinado com quem você contratar.</p>
            {saved.city && saved.state && <p role="status" className="rounded-control bg-primary-softer p-3 text-sm text-primary-strong">Preenchemos com a cidade do seu cadastro. Mude se o serviço for em outro lugar.</p>}
            <Input label="CEP" optional inputMode="numeric" autoComplete="postal-code" value={cep} onChange={(event) => { const masked2 = maskCep(event.target.value); setCep(masked2); lookup(masked2); }} hint={cepStatus || 'Digite o CEP e preenchemos a cidade, o estado e o bairro.'} />
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <Input label="Cidade" name="city" required autoComplete="address-level2" value={form.city} onChange={change} error={errors.city} maxLength={100} />
              <Select label="Estado" name="state" required autoComplete="address-level1" value={form.state} onChange={change} error={errors.state}><option value="">UF</option>{STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</Select>
            </div>
            <Input label="Bairro" optional name="neighborhood" autoComplete="off" value={form.neighborhood} onChange={change} maxLength={100} />
            <Input label="Para quando você precisa" name="deadline" type="date" optional min={todayKey()} value={form.deadline} onChange={change} error={errors.deadline} hint="Data limite ou desejada. Deixe em branco se for flexível." />
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Como pode ser atendido</legend>
              <div className="flex flex-wrap gap-4 text-sm">{MODES.map(([value, label]) => <label key={value} className="flex min-h-control items-center gap-2"><input type="checkbox" name="modes" checked={form.modes.includes(value)} onChange={() => toggleMode(value)} />{label}</label>)}</div>
              {errors.modes && <p role="alert" className="mt-1 text-sm text-danger">{errors.modes}</p>}
            </fieldset>
          </>
        )}

        {key === 'orcamento' && (
          <>
            <p className="text-sm text-ink-muted">O valor é só uma referência: cada profissional propõe o próprio preço.</p>
            <label className="flex min-h-control items-center gap-2 text-sm"><input type="checkbox" checked={form.flexible_budget} onChange={(event) => { setForm((current) => ({ ...current, flexible_budget: event.target.checked })); setErrors({}); }} />Não sei, prefiro receber propostas (a combinar)</label>
            {!form.flexible_budget && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Mínimo (R$)" name="budget_min" type="number" min="0" step="0.01" inputMode="decimal" required value={form.budget_min} onChange={change} error={errors.budget_min} />
                <Input label="Máximo (R$)" name="budget_max" type="number" min="0" step="0.01" inputMode="decimal" required value={form.budget_max} onChange={change} error={errors.budget_max} />
              </div>
            )}
          </>
        )}

        {key === 'preferencias' && (
          <>
            <p className="text-sm text-ink-muted">Opcional. Quanto mais exigente o filtro, menos profissionais podem responder.</p>
            <label className="flex min-h-control items-center gap-2 text-sm"><input type="checkbox" checked={form.only_verified} onChange={(event) => setForm((current) => ({ ...current, only_verified: event.target.checked }))} />Só profissionais verificados</label>
            <Select label="Nota mínima do profissional" name="min_rating" value={form.min_rating} onChange={change}>
              <option value="">Sem nota mínima</option><option value="3">3,0 ou mais</option><option value="4">4,0 ou mais</option><option value="4.5">4,5 ou mais</option>
            </Select>
          </>
        )}

        {key === 'validade' && (
          <>
            <p className="text-sm text-ink-muted">Por quanto tempo o pedido recebe propostas. Você pode renovar depois. Cada pedido aceita até {defaults.maxProposals} propostas.</p>
            <Select label="Receber propostas por" name="valid_days" value={form.valid_days} onChange={change}>{defaults.validityDays.map((days) => <option key={days} value={days}>{days} dias{days === defaults.defaultDays ? ' (recomendado)' : ''}</option>)}</Select>
          </>
        )}

        {key === 'revisao' && (
          <>
            <p className="text-sm text-ink-muted">É assim que os profissionais vão ver o seu pedido. Confira antes de publicar.</p>
            <article className="space-y-3 rounded-card border border-line p-5">
              <p className="text-xs font-semibold text-primary-strong">{category?.name ?? 'Sem categoria'}</p>
              <h3 className="break-words text-lg font-bold">{form.title.trim()}</h3>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{maskContacts(form.description.trim()).text}</p>
              {images.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="Fotos">{images.map((url, index) => <li key={url}><img src={url} alt={`Foto ${index + 1}`} className="h-16 w-16 rounded-control object-cover" /></li>)}</ul>}
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-ink-muted">Onde</dt><dd className="font-medium">{[form.neighborhood, form.city].filter(Boolean).join(', ')}/{form.state}</dd></div>
                <div><dt className="text-ink-muted">Quando</dt><dd className="font-medium">{form.deadline ? formatDay(form.deadline) : 'Flexível'}</dd></div>
                <div><dt className="text-ink-muted">Atendimento</dt><dd className="font-medium">{modeLabels || '—'}</dd></div>
                <div><dt className="text-ink-muted">Orçamento</dt><dd className="font-medium">{form.flexible_budget ? 'A combinar' : formatBudget(Number(form.budget_min), Number(form.budget_max))}</dd></div>
                {!edit && <div><dt className="text-ink-muted">Validade</dt><dd className="font-medium">{form.valid_days} dias</dd></div>}
                {(form.only_verified || form.min_rating) && <div><dt className="text-ink-muted">Preferências</dt><dd className="font-medium">{[form.only_verified && 'Verificados', form.min_rating && `Nota ${form.min_rating}+`].filter(Boolean).join(' · ')}</dd></div>}
              </dl>
            </article>
          </>
        )}

        <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={() => (step === 0 ? navigate(-1) : setStep((current) => current - 1))} disabled={submitting}>{step === 0 ? 'Cancelar' : 'Voltar'}</Button>
          {key === 'revisao'
            ? <Button onClick={publish} loading={submitting} disabled={uploading}>{uploading ? 'Aguarde o envio das fotos...' : submitting ? 'Publicando...' : edit ? 'Salvar alterações' : 'Publicar pedido'}</Button>
            : <Button onClick={next} disabled={uploading}>{uploading ? 'Aguarde o envio das fotos...' : 'Continuar'}</Button>}
        </div>
      </Card>
      {!edit && <p className="mt-3 text-xs text-ink-muted">Seu progresso é salvo sozinho. Pode sair e voltar depois.</p>}
    </>
  );
}

/** Carrega o que precisa antes de abrir o passo a passo: dados do cadastro, rascunho ou o pedido a editar. */
export default function CreateService() {
  const { uuid } = useParams();
  const features = useFeatures();
  const prefill = useApiResource('/account/prefill');
  const draft = useApiResource(uuid ? null : '/services/draft');
  const existing = useApiResource(uuid ? `/services/${uuid}` : null);
  const loading = prefill.loading || (uuid ? existing.loading : draft.loading);

  const initial = useMemo(() => {
    if (uuid && existing.data) {
      const s = existing.data;
      return {
        form: { ...EMPTY, category_id: String(s.categoryId ?? ''), title: s.title, description: s.description, city: s.city ?? '', state: s.state ?? '', neighborhood: s.neighborhood ?? '', deadline: s.deadline ? String(s.deadline).slice(0, 10) : '', flexible_budget: s.budgetMin == null && s.budgetMax == null, budget_min: s.budgetMin ?? '', budget_max: s.budgetMax ?? '', modes: s.modes ?? ['client_place'] },
        images: s.images ?? [], step: 0,
      };
    }
    return draft.data?.data ?? null;
  }, [uuid, existing.data, draft.data]);

  return (
    <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Pedidos e contratações', to: '/meus-servicos?aba=pedidos' }, { label: uuid ? 'Editar pedido' : 'Publicar um pedido' }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">{uuid ? 'Editar pedido' : 'Publicar um pedido'}</h1>
      <p className="mt-2 text-ink-muted">Descreva o que você precisa e receba propostas de profissionais. Você escolhe a que preferir.</p>
      {!features.openRequests ? <div className="mt-6"><EmptyState icon="list" title="Pedidos abertos indisponíveis" description="No momento não estamos recebendo novos pedidos abertos. Você ainda pode contratar direto pelos anúncios." action={<Button to="/buscar">Buscar serviços</Button>} /></div>
        : loading ? <div className="mt-6"><SkeletonList count={3} label="Carregando o formulário" itemClassName="h-24" /></div>
          : uuid && existing.error ? <div className="mt-6"><ErrorState title="Não foi possível abrir o pedido" message={apiError(existing.error)} onRetry={existing.retry} /></div>
            : <Wizard key={uuid ?? 'novo'} prefill={prefill.data} edit={uuid} initial={initial} draft={!uuid && !!draft.data?.data} />}
    </main>
  );
}
