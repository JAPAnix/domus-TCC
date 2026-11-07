import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import { useCategories } from '../hooks/useCategories';
import { useApiResource } from '../hooks/useApiResource';
import { useCepLookup } from '../hooks/useCepLookup';
import { maskCep } from '../utils/cep';
import { STATES } from '../utils/roles';
import ImageUploader from '../components/ImageUploader';
import { Breadcrumb, Button, Card, Input, Select, SkeletonList, Textarea, useToast } from '../components/ui';

const INITIAL_FORM = { title: '', description: '', category_id: '', budget_min: '', budget_max: '', deadline: '', city: '', state: '', neighborhood: '' };

function todayKey() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function validate(form) {
  const errors = {};
  if (form.title.trim().length < 5) errors.title = 'O título precisa ter pelo menos 5 caracteres.';
  if (form.description.trim().length < 20) errors.description = 'A descrição precisa ter pelo menos 20 caracteres.';
  if (!form.category_id) errors.category_id = 'Escolha uma categoria.';
  if (form.city.trim().length < 2) errors.city = 'Informe a cidade onde o serviço será feito.';
  if (!/^[A-Za-z]{2}$/.test(form.state.trim())) errors.state = 'Escolha o estado.';
  if (!(Number(form.budget_min) > 0)) errors.budget_min = 'Informe um valor maior que zero.';
  if (!(Number(form.budget_max) > 0)) errors.budget_max = 'Informe um valor maior que zero.';
  if (Number(form.budget_min) > Number(form.budget_max) && Number(form.budget_max) > 0) errors.budget_min = 'O valor mínimo não pode ser maior que o máximo.';
  if (!form.deadline) errors.deadline = 'Informe até quando você precisa do serviço.';
  else if (form.deadline < todayKey()) errors.deadline = 'O prazo não pode estar no passado.';
  return errors;
}

function Section({ title, hint, children }) {
  return (
    <section className="space-y-4 border-t border-line pt-6 first-of-type:border-t-0 first-of-type:pt-0">
      <div><h2 className="text-lg font-semibold">{title}</h2>{hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}</div>
      {children}
    </section>
  );
}

function ServiceForm({ prefill }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, failed: categoriesFailed } = useCategories();
  const saved = prefill?.address ?? {};
  // A cidade do cadastro já vem preenchida; o cliente só muda se o serviço for em outro lugar.
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, city: saved.city || '', state: saved.state || '', neighborhood: saved.neighborhood || '' }));
  const prefilledLocation = !!(saved.city && saved.state);
  const [cep, setCep] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // O CEP é só um atalho: preenche cidade, estado e bairro. O pedido guarda apenas a região, nunca o endereço.
  const { status: cepStatus, lookup } = useCepLookup((found) => setForm((current) => ({ ...current, city: found.city, state: found.state, neighborhood: found.neighborhood || current.neighborhood })));

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'state' ? value.toUpperCase() : value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setSubmitError('');
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      event.currentTarget.elements[firstInvalid]?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/services', {
        title: form.title.trim(),
        description: form.description.trim(),
        category_id: Number(form.category_id),
        budget_min: Number(form.budget_min),
        budget_max: Number(form.budget_max),
        deadline: form.deadline,
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        ...(form.neighborhood.trim() && { neighborhood: form.neighborhood.trim() }),
        image_urls: images,
      });
      toast.success('Pedido publicado. Agora é só aguardar as propostas.');
      navigate(`/servicos/${data.uuid}`);
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setSubmitError(apiError(err, 'Não foi possível publicar o pedido.'));
      setSubmitting(false);
    }
  }

  return (
    <>
      {submitError && <p role="alert" className="mt-6 rounded-control border border-danger-line bg-danger-soft p-4 text-sm text-danger">{submitError}</p>}

      <Card as="form" onSubmit={submit} noValidate className="mt-6 space-y-6">
        <p className="text-xs text-ink-muted"><span className="text-danger" aria-hidden="true">*</span> Campos obrigatórios</p>

        <Section title="O que você precisa" hint="Descreva com detalhes: isso ajuda o profissional a enviar uma proposta certeira.">
          <Input label="Título" name="title" required value={form.title} onChange={change} error={errors.title} maxLength={255} placeholder="Ex.: Instalar um chuveiro elétrico" />
          <Textarea label="Descrição" name="description" required value={form.description} onChange={change} error={errors.description} hint="Conte o que precisa ser feito, o estado atual e o que você já tem. Mínimo de 20 caracteres." />
          <Select label="Categoria" name="category_id" required value={form.category_id} onChange={change}
            error={errors.category_id ?? (categoriesFailed ? 'Não foi possível carregar as categorias. Recarregue a página.' : undefined)} disabled={!categories.length}>
            <option value="">{categories.length ? 'Selecione uma categoria' : 'Carregando categorias...'}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
        </Section>

        <Section title="Onde será o serviço" hint="Os profissionais veem só a cidade e o bairro. O endereço completo só é combinado com quem você contratar.">
          {prefilledLocation && <p role="status" className="rounded-control bg-primary-softer p-3 text-sm text-primary-strong">Preenchemos com a cidade do seu cadastro. Mude se o serviço for em outro lugar.</p>}
          <Input label="CEP" optional inputMode="numeric" autoComplete="postal-code" value={cep} onChange={(event) => { const masked = maskCep(event.target.value); setCep(masked); lookup(masked); }} hint={cepStatus || 'Digite o CEP e preenchemos a cidade, o estado e o bairro. O CEP não é guardado.'} />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Input label="Cidade" name="city" required autoComplete="address-level2" value={form.city} onChange={change} error={errors.city} maxLength={100} />
            <Select label="Estado" name="state" required autoComplete="address-level1" value={form.state} onChange={change} error={errors.state}>
              <option value="">UF</option>{STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </Select>
          </div>
          <Input label="Bairro" optional name="neighborhood" autoComplete="off" value={form.neighborhood} onChange={change} error={errors.neighborhood} maxLength={100} />
        </Section>

        <Section title="Quando e quanto" hint="O valor é uma faixa: cada profissional propõe o próprio preço dentro dela.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Orçamento mínimo (R$)" name="budget_min" type="number" min="0" step="0.01" inputMode="decimal" required value={form.budget_min} onChange={change} error={errors.budget_min} />
            <Input label="Orçamento máximo (R$)" name="budget_max" type="number" min="0" step="0.01" inputMode="decimal" required value={form.budget_max} onChange={change} error={errors.budget_max} />
          </div>
          <Input label="Prazo" name="deadline" type="date" min={todayKey()} required value={form.deadline} onChange={change} error={errors.deadline} hint="Até quando você precisa do serviço pronto." />
        </Section>

        <Section title="Fotos" hint="Mostre o local ou o que precisa ser feito. Pedidos com fotos recebem propostas mais precisas.">
          <ImageUploader label="Fotos (opcional)" hint="A primeira foto é a capa. JPG, PNG ou WebP, com até 5 MB." purpose="service" value={images} onChange={setImages} max={10} showCover onBusyChange={setUploading} />
        </Section>

        <Button type="submit" block loading={submitting} disabled={uploading}>{uploading ? 'Aguarde o envio das fotos...' : submitting ? 'Publicando...' : 'Publicar pedido'}</Button>
      </Card>
    </>
  );
}

export default function CreateService() {
  // Os dados do cadastro vêm antes do formulário abrir; se falharem, o formulário abre em branco.
  const prefill = useApiResource('/account/prefill');
  return (
    <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Pedidos e contratações', to: '/meus-servicos' }, { label: 'Publicar pedido' }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">Publicar pedido</h1>
      <p className="mt-2 text-ink-muted">Descreva o que você precisa e receba propostas de profissionais.</p>
      {prefill.loading ? <div className="mt-6"><SkeletonList count={3} label="Carregando o formulário" itemClassName="h-24" /></div> : <ServiceForm prefill={prefill.data} />}
    </main>
  );
}
