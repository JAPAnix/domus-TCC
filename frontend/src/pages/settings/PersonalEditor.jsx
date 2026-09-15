import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import api from '../../services/api';
import UnsavedChangesDialog from '../../components/UnsavedChangesDialog';
import { sections, initialForm, formPayload, inputClass, primaryClass, linkClass, maskEmail, maskPhone } from './personalFields';

export function PersonalEditor() {
  const { section } = useParams();
  const { person } = useOutletContext();
  if (!sections[section]) return <Navigate to="/configuracoes/pessoais" replace />;
  return <EditForm key={section} section={section} person={person} />;
}

function EditForm({ section, person }) {
  const { update } = useOutletContext();
  const navigate = useNavigate();
  const [initial] = useState(() => initialForm(section, person));
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const submitting = useRef(false);
  const allowLeave = useRef(false);
  const dirty = JSON.stringify(formPayload(section, form)) !== JSON.stringify(formPayload(section, initial));
  const verification = ['email', 'phone'].includes(section);
  function change(event) {
    const { name, value, checked, type } = event.target;
    setForm((old) => ({ ...old, [name]: type === 'checkbox' ? checked : value }));
    setErrors((old) => ({ ...old, [name]: '' }));
  }
  async function save(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(''); setErrors({});
    try {
      const payload = formPayload(section, form);
      if (verification) {
        const response = await api.post(`/users/me/contact/${section}/solicitar`, payload);
        const { data } = await api.get('/auth/me');
        update(data, response.data.delivery === 'development-console' ? 'Modo de desenvolvimento: nenhum SMS foi enviado. Consulte o código no terminal do backend.' : 'Código solicitado. Confira as mensagens do destino informado.');
        allowLeave.current = true;
        navigate(`/configuracoes/pessoais/${section}/confirmar`, { replace: true });
      } else {
        const { data } = await api.patch(`/users/me/personal/${section}`, payload);
        update(data, 'Informações salvas com sucesso.');
        allowLeave.current = true;
        navigate('/configuracoes/pessoais');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível salvar as alterações.');
      setErrors(Object.fromEntries((err.response?.data?.errors || []).map((item) => [item.field.replace('address.', ''), item.message])));
    } finally { submitting.current = false; setBusy(false); }
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="settings-page-title" className="text-2xl font-semibold">{sections[section].title}</h2><Link to="/servicos" className={linkClass}>Concluir</Link></div>
      <p className="mt-3 text-sm leading-6 text-[#6B7280]">{verification ? 'Confirme o novo contato com um código. O dado atual permanece até a confirmação.' : 'Confira suas informações da conta antes de salvar.'}</p>
      <form onSubmit={save} className="mt-6 space-y-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-[#DC2626]">{error}</p>}
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {['residencial', 'postal'].includes(section) && <p className="text-sm text-[#6B7280]">País/Região: Brasil. Preencha o endereço manualmente.</p>}
          {section === 'postal' && <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="same_as_home" checked={form.same_as_home} onChange={change} className="h-5 w-5 accent-[#7C3AED]" />Usar o mesmo endereço residencial</label>}
          {section === 'phone' && <label className="block text-sm font-medium" htmlFor="country">País<select id="country" name="country" value={form.country} onChange={change} className={inputClass}><option value="+55">Brasil (+55)</option><option value="+351">Portugal (+351)</option><option value="+1">Estados Unidos/Canadá (+1)</option><option value="+54">Argentina (+54)</option><option value="+56">Chile (+56)</option><option value="+598">Uruguai (+598)</option></select></label>}
          {!(section === 'postal' && form.same_as_home) && sections[section].fields.map(([name, label, max, optional, type = 'text']) => (
            <div key={name}>
              <label htmlFor={`personal-${name}`} className="block text-sm font-medium">{label}{optional && <span className="ml-1 font-normal text-[#6B7280]">(opcional)</span>}</label>
              {name === 'relationship' ? <select id={`personal-${name}`} name={name} value={form[name]} onChange={change} className={inputClass} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined}>{['Familiar', 'Responsável', 'Amigo', 'Outro'].map((v) => <option key={v}>{v}</option>)}</select> : <input
                id={`personal-${name}`} name={name} type={type} value={form[name] || ''} onChange={change} maxLength={max} required={!optional}
                max={type === 'date' ? new Date().toLocaleDateString('en-CA') : undefined}
                pattern={name === 'zip_code' ? '[0-9]{5}-?[0-9]{3}' : name === 'state' ? '[A-Za-z]{2}' : undefined}
                inputMode={type === 'tel' ? 'tel' : name === 'zip_code' ? 'numeric' : undefined}
                autoComplete={name === 'first_name' ? 'given-name' : name === 'last_name' ? 'family-name' : type === 'email' ? 'email' : type === 'date' ? 'bday' : 'off'}
                className={inputClass} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined}
              />}
              {errors[name] && <p id={`error-${name}`} className="mt-1 text-sm text-[#DC2626]">{errors[name]}</p>}
            </div>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-6"><Link to="/configuracoes/pessoais" className={linkClass}>Voltar</Link><button disabled={busy || (!dirty && !verification)} className={primaryClass}>{busy ? (verification ? 'Enviando...' : 'Salvando...') : verification ? 'Enviar código' : 'Salvar'}</button></div>
      </form>
      <UnsavedChangesDialog dirty={dirty} busy={busy} allowLeave={allowLeave} />
    </>
  );
}

export function ContactConfirmation() {
  const { section } = useParams();
  if (!['email', 'phone'].includes(section)) return <Navigate to="/configuracoes/pessoais" replace />;
  return <ConfirmationForm key={section} section={section} />;
}

function ConfirmationForm({ section }) {
  const { person, update } = useOutletContext();
  const pending = person.pending?.[section];
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const allowLeave = useRef(false);
  const submitting = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((new Date(pending?.resendAt).getTime() - now) / 1000)) || 0;
  const expired = pending && new Date(pending.expiresAt).getTime() <= now;
  async function run(action) {
    if (submitting.current) return;
    submitting.current = true; setBusy(action); setError('');
    try {
      const response = await api.post(`/users/me/contact/${section}/${action}`, action === 'confirmar' ? { code } : action === 'solicitar' ? { target: pending.target } : {});
      if (action === 'solicitar') {
        const { data } = await api.get('/auth/me');
        update(data, response.data.delivery === 'development-console' ? 'Modo local: nenhum SMS foi enviado. Consulte o código no terminal do backend.' : 'Novo código solicitado. Confira suas mensagens.');
        setCode('');
      } else {
        allowLeave.current = true;
        update(response.data, action === 'confirmar' ? 'Contato confirmado e atualizado.' : 'Alteração pendente cancelada.');
        navigate('/configuracoes/pessoais', { replace: true });
      }
    } catch (err) { setError(err.response?.data?.message || 'Não foi possível concluir a confirmação.'); }
    finally { submitting.current = false; setBusy(''); }
  }
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="settings-page-title" className="text-2xl font-semibold">Confirme seu {section === 'email' ? 'email' : 'telefone'}</h2><Link to="/servicos" className={linkClass}>Concluir</Link></div>
    {!pending ? <div className="mt-6"><p>Não há confirmação pendente.</p><Link to={`/configuracoes/pessoais/${section}`} className={`${linkClass} mt-3`}>Informar {section === 'email' ? 'email' : 'telefone'}</Link></div> : <>
      <p className="mt-4 break-words text-sm text-[#6B7280]">Digite o código de 6 dígitos para {section === 'email' ? maskEmail(pending.target) : maskPhone(pending.target)}.</p>
      <p className="mt-2 text-sm text-[#6B7280]">O código vale por 10 minutos. O contato atual só será substituído após a confirmação.</p>
      {expired && <p role="status" className="mt-4 text-sm text-[#DC2626]">O código expirou. Solicite outro.</p>}
      {pending.attempts >= 5 && <p role="status" className="mt-4 text-sm text-[#DC2626]">Limite de tentativas atingido. Solicite outro código.</p>}
      <form onSubmit={(event) => { event.preventDefault(); run('confirmar'); }} className="mt-6 space-y-4">
        <label htmlFor="confirmation-code" className="block text-sm font-medium">Código de confirmação<input id="confirmation-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={!!busy} aria-invalid={!!error} aria-describedby={error ? 'code-error' : undefined} className={`${inputClass} text-center text-2xl tracking-[0.4em]`} /></label>
        {error && <p id="code-error" role="alert" className="text-sm text-[#DC2626]">{error}</p>}
        <button disabled={!!busy || expired || pending.attempts >= 5} className={primaryClass}>{busy === 'confirmar' ? 'Confirmando...' : 'Confirmar'}</button>
      </form>
      <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => run('solicitar')} disabled={!!busy || seconds > 0} className={linkClass}>{busy === 'solicitar' ? 'Enviando...' : seconds ? `Reenviar em ${seconds}s` : 'Reenviar código'}</button><Link to={`/configuracoes/pessoais/${section}`} className={linkClass}>{section === 'email' ? 'Trocar email' : 'Alterar número'}</Link><button disabled={!!busy} onClick={() => run('cancelar')} className={linkClass}>{busy === 'cancelar' ? 'Cancelando...' : 'Cancelar alteração'}</button></div>
    </>}
    <Link to="/configuracoes/pessoais" className={`${linkClass} mt-6`}>Voltar</Link>
    <UnsavedChangesDialog dirty={!!code} busy={!!busy} allowLeave={allowLeave} />
  </>;
}
