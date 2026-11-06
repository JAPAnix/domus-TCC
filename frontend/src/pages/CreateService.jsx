import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import { useCategories } from '../hooks/useCategories';
import ImageUploader from '../components/ImageUploader';
import { Breadcrumb, Button, Card, Input, Select, Textarea, useToast } from '../components/ui';

const INITIAL_FORM = { title: '', description: '', category_id: '', budget_min: '', budget_max: '', deadline: '' };

function todayKey() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function validate(form) {
  const errors = {};
  if (form.title.trim().length < 5) errors.title = 'O título precisa ter pelo menos 5 caracteres.';
  if (form.description.trim().length < 20) errors.description = 'A descrição precisa ter pelo menos 20 caracteres.';
  if (!form.category_id) errors.category_id = 'Escolha uma categoria.';
  if (!(Number(form.budget_min) > 0)) errors.budget_min = 'Informe um valor maior que zero.';
  if (!(Number(form.budget_max) > 0)) errors.budget_max = 'Informe um valor maior que zero.';
  if (Number(form.budget_min) > Number(form.budget_max) && Number(form.budget_max) > 0) errors.budget_min = 'O valor mínimo não pode ser maior que o máximo.';
  if (!form.deadline) errors.deadline = 'Informe até quando você precisa do serviço.';
  else if (form.deadline < todayKey()) errors.deadline = 'O prazo não pode estar no passado.';
  return errors;
}

export default function CreateService() {
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, failed: categoriesFailed } = useCategories();
  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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
    <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Pedidos e contratações', to: '/meus-servicos' }, { label: 'Publicar pedido' }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">Publicar pedido</h1>
      <p className="mt-2 text-ink-muted">Descreva o que você precisa e receba propostas de profissionais.</p>

      {submitError && <p role="alert" className="mt-6 rounded-control border border-danger-line bg-danger-soft p-4 text-sm text-danger">{submitError}</p>}

      <Card as="form" onSubmit={submit} noValidate className="mt-6 space-y-5">
        <p className="text-xs text-ink-muted"><span className="text-danger" aria-hidden="true">*</span> Campos obrigatórios</p>
        <Input label="O que você precisa?" name="title" required value={form.title} onChange={change} error={errors.title} maxLength={255} placeholder="Ex.: Instalar um chuveiro elétrico" />
        <Textarea label="Descrição" name="description" required value={form.description} onChange={change} error={errors.description} hint="Conte os detalhes que ajudam o profissional a fazer uma proposta. Mínimo de 20 caracteres." />
        <Select
          label="Categoria"
          name="category_id"
          required
          value={form.category_id}
          onChange={change}
          error={errors.category_id ?? (categoriesFailed ? 'Não foi possível carregar as categorias. Recarregue a página.' : undefined)}
          disabled={!categories.length}
        >
          <option value="">{categories.length ? 'Selecione uma categoria' : 'Carregando categorias...'}</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Orçamento mínimo (R$)" name="budget_min" type="number" min="0" step="0.01" inputMode="decimal" required value={form.budget_min} onChange={change} error={errors.budget_min} />
          <Input label="Orçamento máximo (R$)" name="budget_max" type="number" min="0" step="0.01" inputMode="decimal" required value={form.budget_max} onChange={change} error={errors.budget_max} />
        </div>
        <Input label="Prazo" name="deadline" type="date" min={todayKey()} required value={form.deadline} onChange={change} error={errors.deadline} />
        <ImageUploader
          label="Fotos (opcional)"
          hint="Mostre o local ou o que precisa ser feito. A primeira foto é a capa. JPG, PNG ou WebP, com até 5 MB."
          purpose="service"
          value={images}
          onChange={setImages}
          max={10}
          showCover
          onBusyChange={setUploading}
        />
        <Button type="submit" block loading={submitting} disabled={uploading}>{uploading ? 'Aguarde o envio das fotos...' : submitting ? 'Publicando...' : 'Publicar pedido'}</Button>
      </Card>
    </main>
  );
}
