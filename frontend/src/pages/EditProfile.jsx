import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import { useAuth } from '../context/useAuth';
import { useApiResource } from '../hooks/useApiResource';
import { STATES } from '../utils/roles';
import { fullName } from '../utils/format';
import ImageUploader from '../components/ImageUploader';
import TagInput from '../components/TagInput';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import { Breadcrumb, Button, Card, ErrorState, Input, Select, SkeletonList, Textarea, useToast } from '../components/ui';

const LIMITS = { about: 1000, profession: 120, school: 120, fun_fact: 200, city: 100 };

function initialForm(profile) {
  return {
    profile_picture_url: profile.profilePictureUrl ?? null, city: profile.city ?? '', state: profile.state ?? '', profession: profile.profession ?? '',
    school: profile.school ?? '', languages: profile.languages, interests: profile.interests, skills: profile.skills, service_areas: profile.serviceAreas,
    years_experience: profile.yearsExperience ?? '', fun_fact: profile.funFact ?? '', about: profile.about ?? '',
  };
}

function toPayload(form) {
  return {
    profile_picture_url: form.profile_picture_url, city: form.city.trim(), state: form.state, profession: form.profession.trim(), school: form.school.trim(),
    languages: form.languages, interests: form.interests, skills: form.skills, service_areas: form.service_areas,
    years_experience: form.years_experience === '' ? null : Number(form.years_experience), fun_fact: form.fun_fact.trim(), about: form.about.trim(),
  };
}

function validate(form) {
  const errors = {};
  for (const [field, max] of Object.entries(LIMITS)) if (form[field].trim().length > max) errors[field] = `Use no máximo ${max} caracteres.`;
  if (form.years_experience !== '') {
    const years = Number(form.years_experience);
    if (!Number.isInteger(years) || years < 0 || years > 60) errors.years_experience = 'Informe um número inteiro de 0 a 60.';
  }
  return errors;
}

function EditForm({ profile }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, token, login } = useAuth();
  const [initial] = useState(() => toPayload(initialForm(profile)));
  const [form, setForm] = useState(() => initialForm(profile));
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const allowLeave = useRef(false);
  const dirty = JSON.stringify(toPayload(form)) !== JSON.stringify(initial);

  const set = (field) => (value) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); };
  const change = (event) => set(event.target.name)(event.target.value);

  async function submit(event) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) { event.currentTarget.elements[first]?.focus(); toast.error('Confira os campos destacados.'); return; }
    setBusy(true);
    try {
      const { data } = await api.patch('/profile/me', toPayload(form));
      login(token, { ...user, profilePictureUrl: data.profilePictureUrl });
      toast.success('Perfil atualizado.');
      allowLeave.current = true;
      navigate('/perfil/sobre');
    } catch (err) {
      setErrors(Object.fromEntries(Object.entries(apiFieldErrors(err)).map(([field, message]) => [field, message])));
      toast.error(apiError(err, 'Não foi possível salvar o perfil.'));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Perfil', to: '/perfil/sobre' }, { label: 'Meu perfil' }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">Meu perfil</h1>
      <p className="mb-6 mt-2 text-ink-muted">As informações abaixo aparecem no seu perfil público, de acordo com as suas configurações de privacidade.</p>

      <form onSubmit={submit} noValidate className="space-y-6">
        <Card className="space-y-5">
          <ImageUploader variant="avatar" purpose="avatar" label="Foto de perfil" name={fullName(profile)} value={form.profile_picture_url} onChange={set('profile_picture_url')} onBusyChange={setUploading} />
          <Textarea label="Sobre mim" name="about" optional rows={5} value={form.about} onChange={change} error={errors.about} hint={`${form.about.length}/${LIMITS.about} caracteres. Conte um pouco sobre você e como gosta de trabalhar.`} />
        </Card>

        <Card className="space-y-5">
          <h2 className="font-semibold">Informações</h2>
          <div className="grid grid-cols-3 gap-3">
            <Input wrapperClassName="col-span-2" label="Cidade onde moro" name="city" optional value={form.city} onChange={change} error={errors.city} autoComplete="address-level2" />
            <Select label="UF" name="state" optional value={form.state} onChange={change} error={errors.state}>
              <option value="">—</option>
              {STATES.map((uf) => <option key={uf}>{uf}</option>)}
            </Select>
          </div>
          <Input label="Meu trabalho ou profissão" name="profession" optional value={form.profession} onChange={change} error={errors.profession} placeholder="Ex.: Eletricista, designer, professora" />
          <Input label="Anos de experiência" name="years_experience" type="number" min="0" max="60" step="1" inputMode="numeric" optional value={form.years_experience} onChange={change} error={errors.years_experience} />
          <Input label="Onde estudei" name="school" optional value={form.school} onChange={change} error={errors.school} />
          <TagInput label="Idiomas que falo" value={form.languages} onChange={set('languages')} max={10} placeholder="Ex.: Português" />
          <TagInput label="Habilidades" value={form.skills} onChange={set('skills')} max={15} placeholder="Ex.: Instalação elétrica" />
          <TagInput label="Áreas de atuação" value={form.service_areas} onChange={set('service_areas')} max={10} maxLength={60} placeholder="Ex.: Zona sul de São Paulo" />
          <TagInput label="Interesses" value={form.interests} onChange={set('interests')} max={12} placeholder="Ex.: Reformas, jardinagem" />
          <Input label="Uma curiosidade sobre mim" name="fun_fact" optional value={form.fun_fact} onChange={change} error={errors.fun_fact} hint={`${form.fun_fact.length}/${LIMITS.fun_fact} caracteres.`} />
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <Button to="/perfil/sobre" variant="secondary">Cancelar</Button>
          <Button type="submit" loading={busy} disabled={uploading}>{uploading ? 'Aguarde o envio da foto...' : 'Concluído'}</Button>
        </div>
      </form>
      <UnsavedChangesDialog dirty={dirty} busy={busy} allowLeave={allowLeave} />
    </main>
  );
}

export default function EditProfile() {
  const resource = useApiResource('/profile/me');
  if (resource.loading) return <main className="mx-auto max-w-form px-4 py-10"><SkeletonList count={3} label="Carregando seu perfil" itemClassName="h-48" /></main>;
  if (resource.error) return <main className="mx-auto max-w-form px-4 py-10"><ErrorState title="Não foi possível abrir seu perfil" message={apiError(resource.error)} onRetry={resource.retry} /></main>;
  return <EditForm profile={resource.data} />;
}
