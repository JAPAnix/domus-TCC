import { useState } from 'react';
import api, { apiError, apiFieldErrors } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { Link } from 'react-router-dom';
import { PRO_START_PATH } from '../../utils/routes';
import { Button, ConfirmDialog, EmptyState, ErrorState, Input, SkeletonList, useToast } from '../../components/ui';
import { SettingsHeading } from './SettingsPages';
import { formatCnpj, formatCpf, isValidCnpj, isValidCpf } from './identityValidation';

const TYPE_LABELS = { cpf: 'CPF', cnpj: 'CNPJ' };

function TaxForm({ initialType, onDone, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ document_type: initialType ?? 'cpf', document: '', holder_name: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'document' ? (current.document_type === 'cpf' ? formatCpf(value) : formatCnpj(value)) : value, ...(name === 'document_type' ? { document: '' } : {}) }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!(form.document_type === 'cpf' ? isValidCpf(form.document) : isValidCnpj(form.document))) found.document = form.document_type === 'cpf' ? 'CPF inválido. Confira os 11 dígitos.' : 'CNPJ inválido. Confira os 14 dígitos.';
    if (form.holder_name.trim().length < 3) found.holder_name = 'Informe o nome completo ou a razão social.';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) { event.currentTarget.elements[first]?.focus(); return; }
    setBusy(true);
    try {
      await api.put('/settings/tax', form);
      toast.success('Dados salvos.');
      onDone();
    } catch (err) {
      setErrors(apiFieldErrors(err));
      toast.error(apiError(err, 'Não foi possível salvar os dados.'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-md space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tipo de documento</legend>
        <div className="flex gap-4">
          {Object.entries(TYPE_LABELS).map(([value, label]) => <label key={value} className="flex min-h-control cursor-pointer items-center gap-2 text-sm"><input type="radio" name="document_type" value={value} checked={form.document_type === value} onChange={change} />{label}</label>)}
        </div>
      </fieldset>
      <Input label={TYPE_LABELS[form.document_type]} name="document" required inputMode="numeric" autoComplete="off" value={form.document} onChange={change} error={errors.document} placeholder={form.document_type === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'} />
      <Input label={form.document_type === 'cpf' ? 'Nome completo' : 'Razão social'} name="holder_name" required value={form.holder_name} onChange={change} error={errors.holder_name} maxLength={150} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy}>Salvar</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Button>}
      </div>
    </form>
  );
}

export default function TaxSettings() {
  const toast = useToast();
  const resource = useApiResource('/settings', undefined, { keepPrevious: true });
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const settings = resource.data;

  async function remove() {
    setBusy(true);
    try {
      await api.delete('/settings/tax');
      toast.success('Dados removidos.');
      resource.retry();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível remover os dados.'));
    } finally {
      setBusy(false);
      setRemoving(false);
    }
  }

  if (!settings && resource.loading) return <><SettingsHeading title="Impostos" /><div className="mt-6"><SkeletonList count={2} label="Carregando" itemClassName="h-32" /></div></>;
  if (resource.error && !settings) return <><SettingsHeading title="Impostos" /><div className="mt-6"><ErrorState title="Não foi possível carregar esta página" message={apiError(resource.error)} onRetry={resource.retry} /></div></>;

  if (!settings.hasProfessionalProfile) {
    return (
      <>
        <SettingsHeading title="Impostos" />
        <div className="mt-6"><EmptyState icon="list" title="Disponível para profissionais" description="Esta seção guarda o CPF ou CNPJ e os dados de recebimento de quem oferece serviços." action={<Button to={PRO_START_PATH}>Começar a oferecer serviços</Button>} /></div>
      </>
    );
  }

  const { tax } = settings;
  const has = !!tax.documentType;
  return (
    <>
      <SettingsHeading title="Impostos">Informe o seu CPF ou CNPJ. Esses dados ficam protegidos, aparecem mascarados nesta página e nunca são exibidos no seu perfil público. O Dommos não emite notas fiscais: se for o seu caso, a nota do serviço é responsabilidade sua. Quando o pagamento é feito direto entre as partes, o recebimento é combinado com o cliente.</SettingsHeading>
      <div className="mt-8">
        {has && !editing ? (
          <>
            <dl className="divide-y divide-line rounded-card border border-line">
              <div className="p-4"><dt className="text-sm text-ink-muted">{TYPE_LABELS[tax.documentType]}</dt><dd className="mt-0.5 font-medium">{tax.documentMasked}</dd></div>
              <div className="p-4"><dt className="text-sm text-ink-muted">{tax.documentType === 'cpf' ? 'Nome completo' : 'Razão social'}</dt><dd className="mt-0.5 font-medium">{tax.holderName}</dd></div>
              <div className="p-4"><dt className="text-sm text-ink-muted">Chave Pix</dt><dd className="mt-0.5 font-medium">Gerenciada em <Link to="/configuracoes/pagamentos" className="text-primary-strong underline">Pagamentos</Link></dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setEditing(true)}>Alterar</Button>
              <Button variant="dangerOutline" onClick={() => setRemoving(true)}>Remover dados</Button>
            </div>
          </>
        ) : (
          <TaxForm initialType={tax.documentType} onDone={() => { setEditing(false); resource.retry(); }} onCancel={has ? () => setEditing(false) : undefined} />
        )}
      </div>
      <ConfirmDialog open={removing} danger busy={busy} title="Remover dados" confirmLabel="Remover" message="O CPF ou CNPJ serão apagados da sua conta. A chave Pix de recebimento não muda. Você pode informar de novo quando quiser." onConfirm={remove} onCancel={() => setRemoving(false)} />
    </>
  );
}
