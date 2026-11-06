import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import api, { apiError } from '../../../services/api';
import { useAuth } from '../../../context/useAuth';
import { useMode } from '../../../context/useMode';
import { useApiResource } from '../../../hooks/useApiResource';
import UnsavedChangesDialog from '../../../components/UnsavedChangesDialog';
import { Breadcrumb, Button, EmptyState, ErrorState, SkeletonList, useToast } from '../../../components/ui';
import { validateStep } from '../../../utils/listingRules';
import { STEPS, allPayload, formFromListing, ruleData, stepPayload } from './formModel';
import { StepAvailability, StepCategory, StepIncluded, StepLocation, StepModes, StepPhotos, StepPrice, StepReview, StepText, StepVerification } from './steps';

const FIRST_FIELD = { categoryId: 'categoryId', serviceModes: 'serviceModes', city: 'city', title: 'title', price: 'price' };

function Wizard({ listing, config }) {
  const { uuid, step: stepParam } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, token, login } = useAuth();
  const { setMode } = useMode();
  const step = Math.min(10, Math.max(1, Number.parseInt(stepParam, 10) || 1));
  const info = STEPS[step - 1];
  const [form, setForm] = useState(() => formFromListing(listing));
  const [errors, setErrors] = useState({});
  const [serverErrors, setServerErrors] = useState(null);
  const [saved, setSaved] = useState(() => JSON.stringify(allPayload(formFromListing(listing))));
  const [busy, setBusy] = useState('');
  const [uploading, setUploading] = useState(false);
  const allowLeave = useRef(false);
  const heading = useRef(null);
  const dirty = JSON.stringify(allPayload(form)) !== saved;
  const isPublished = listing.status !== 'draft';

  useEffect(() => { heading.current?.focus(); window.scrollTo({ top: 0 }); }, [step]);

  const set = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined, ...(field === 'availability' ? { availability: undefined, leadTimeHours: undefined } : {}) })); };

  // Navegação pelos botões do passo a passo não deve acionar o aviso de "alterações não salvas".
  function go(path) {
    allowLeave.current = true;
    navigate(path);
    allowLeave.current = false;
  }
  const goToStep = (n) => go(`/pro/anuncio/${uuid}/etapa/${n}`);

  function showErrors(found) {
    setErrors(found);
    const field = Object.keys(found)[0];
    if (field) document.querySelector(`[name="${FIRST_FIELD[field] ?? field}"], #${field}`)?.focus?.();
  }

  async function saveVerification() {
    if (!form.document.trim()) return;
    await api.put('/pro/verification', { legal_name: form.legalName.trim(), document_type: form.documentType, document: form.document });
    setForm((current) => ({ ...current, document: '', documentSaved: true }));
  }

  async function next() {
    const found = validateStep(step, ruleData(form));
    if (Object.keys(found).length) { showErrors(found); toast.error('Confira os campos destacados.'); return; }
    setBusy('next');
    try {
      if (step === 9) await saveVerification();
      await api.patch(`/pro/listings/${uuid}`, { ...(step <= 8 ? { ...stepPayload(step, form), validate_step: step } : {}), wizard_step: step + 1 });
      setSaved(JSON.stringify(allPayload(form)));
      goToStep(step + 1);
    } catch (err) {
      const fields = err.response?.data?.errors;
      if (Array.isArray(fields)) showErrors(Object.fromEntries(fields.map((item) => [item.field, item.message])));
      toast.error(apiError(err, 'Não foi possível salvar esta etapa.'));
    } finally {
      setBusy('');
    }
  }

  async function saveAndExit() {
    setBusy('exit');
    try {
      if (step === 9) await saveVerification().catch(() => {});
      await api.patch(`/pro/listings/${uuid}`, { ...(step <= 8 ? stepPayload(step, form) : {}), wizard_step: step });
      toast.success('Rascunho salvo. Você continua de onde parou.');
      go('/pro/servicos');
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível salvar o rascunho.'));
      setBusy('');
    }
  }

  async function publish() {
    setBusy('publish');
    setServerErrors(null);
    try {
      await saveVerification();
      await api.patch(`/pro/listings/${uuid}`, { ...allPayload(form), wizard_step: 10 });
      await api.post(`/pro/listings/${uuid}/publish`);
      // O papel "profissional" nasce ao publicar: atualiza a sessão e liga o modo profissional.
      const { data } = await api.get('/auth/me');
      login(token, { ...user, roles: data.roles, profilePictureUrl: data.profilePictureUrl });
      setMode('professional');
      toast.success(isPublished ? 'Alterações publicadas.' : 'Anúncio publicado. Ele já aparece na busca.');
      go('/pro/servicos');
    } catch (err) {
      if (err.response?.status === 422 && Array.isArray(err.response.data.errors)) setServerErrors(err.response.data.errors);
      toast.error(apiError(err, 'Não foi possível publicar.'));
      setBusy('');
    }
  }

  const stepProps = { form, set, errors };
  const content = {
    1: <StepCategory {...stepProps} />, 2: <StepModes {...stepProps} />, 3: <StepLocation {...stepProps} />, 4: <StepText {...stepProps} />,
    5: <StepPhotos {...stepProps} onBusy={setUploading} />, 6: <StepIncluded {...stepProps} />, 7: <StepPrice {...stepProps} feePercent={config.platformFeePercent} />,
    8: <StepAvailability {...stepProps} />, 9: <StepVerification {...stepProps} />, 10: <StepReview form={form} user={user} goToStep={goToStep} serverErrors={serverErrors} />,
  }[step];

  const last = step === 10;
  return (
    <div className="pb-28">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-form px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">Etapa {step} de 10 · {info.short}</span><span className="text-ink-muted">{isPublished ? 'Editando anúncio' : 'Novo anúncio'}</span></div>
          <div role="progressbar" aria-label="Progresso do anúncio" aria-valuemin={1} aria-valuemax={10} aria-valuenow={step} className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-primary transition-[width]" style={{ width: `${(step / 10) * 100}%` }} /></div>
        </div>
      </div>

      <main className={`mx-auto px-4 py-8 sm:px-6 ${last ? 'max-w-page' : 'max-w-form'}`}>
        {step === 1 && <Breadcrumb items={[{ label: 'Meus serviços', to: '/pro/servicos' }, { label: 'Anúncio' }]} />}
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none sm:text-3xl">{info.title}</h1>
        <p className="mb-6 mt-2 text-ink-muted">{info.description}</p>
        <div className={last ? 'max-w-4xl' : ''}>{content}</div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-form flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => goToStep(step - 1)} disabled={step === 1 || !!busy}>Voltar</Button>
            <Button variant="ghost" onClick={saveAndExit} loading={busy === 'exit'} disabled={!!busy && busy !== 'exit'}>Salvar e sair</Button>
          </div>
          {last
            ? <Button onClick={publish} loading={busy === 'publish'} disabled={uploading || (!!busy && busy !== 'publish')}>{isPublished && listing.status === 'published' ? 'Salvar alterações' : 'Publicar anúncio'}</Button>
            : <Button onClick={next} loading={busy === 'next'} disabled={uploading || (!!busy && busy !== 'next')}>{uploading ? 'Aguarde o envio das fotos...' : 'Avançar'}</Button>}
        </div>
      </div>
      <UnsavedChangesDialog dirty={dirty} busy={!!busy} allowLeave={allowLeave} />
    </div>
  );
}

export default function ListingWizard() {
  const { uuid, step } = useParams();
  const resource = useApiResource(`/pro/listings/${uuid}`);
  const config = useApiResource('/listings/config');

  if (resource.loading || config.loading) return <main className="mx-auto max-w-form px-4 py-10"><SkeletonList count={3} label="Carregando anúncio" itemClassName="h-40" /></main>;
  if (resource.error) {
    return (
      <main className="mx-auto max-w-form px-4 py-10">
        {resource.error.response?.status === 404
          ? <EmptyState as="h1" icon="search" title="Anúncio não encontrado" description="Ele pode ter sido excluído, ou não é seu." action={<Button to="/pro/servicos">Meus serviços</Button>} />
          : <ErrorState title="Não foi possível abrir o anúncio" message={apiError(resource.error)} onRetry={resource.retry} />}
      </main>
    );
  }
  if (config.error) return <main className="mx-auto max-w-form px-4 py-10"><ErrorState title="Não foi possível carregar as configurações" message={apiError(config.error)} onRetry={config.retry} /></main>;
  if (!step) return <Navigate to={`/pro/anuncio/${uuid}/etapa/${resource.data.status === 'draft' ? resource.data.wizardStep : 10}`} replace />;
  return <Wizard key={uuid} listing={resource.data} config={config.data} />;
}
