import { useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useOutletContext } from 'react-router-dom';
import { addressFields, homeAddress, formatZip, inputClass, primaryClass, linkClass } from './personalFields';
import { isValidCpf } from './identityValidation';

const returnPath = '/configuracoes/pessoais';
const personalFields = [
  ['first_name', 'Nome', 100], ['last_name', 'Sobrenome', 100],
  ['preferred_name', 'Nome de preferência', 100, true],
  ['cpf', 'CPF', 14], ['birth_date', 'Data de nascimento', 10, false, 'date'],
];
const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export default function IdentityVerification() {
  const { person } = useOutletContext();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({
    first_name: person.firstName || '', last_name: person.lastName || '', preferred_name: person.preferredName || '',
    cpf: '', birth_date: person.birthDate || '', country: person.country || '',
    ...homeAddress(person), zip_code: formatZip(person.zipCode),
  }));
  const [errors, setErrors] = useState({});
  const [continued, setContinued] = useState(false);
  const [cepStatus, setCepStatus] = useState({ loading: false, message: '' });
  const cepRequest = useRef(null);
  const allowLeave = useRef(false);
  const heading = useRef(null);
  // This preparation step always asks before leaving, even when untouched.
  const blocker = useBlocker(() => !allowLeave.current);
  const confirmingExit = blocker.state === 'blocked';
  useEffect(() => { heading.current?.focus(); }, [confirmingExit]);
  useEffect(() => () => cepRequest.current?.abort(), []);

  async function lookupCep(value, snapshot) {
    const digits = value.replace(/\D/g, '');
    cepRequest.current?.abort();
    if (digits.length !== 8) { setCepStatus({ loading: false, message: '' }); return; }
    const controller = new AbortController();
    cepRequest.current = controller;
    setCepStatus({ loading: true, message: 'Buscando endereço pelo CEP...' });
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('lookup-failed');
      const data = await response.json();
      if (controller !== cepRequest.current || controller.signal.aborted) return;
      if (data.erro) {
        setCepStatus({ loading: false, message: 'CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.' });
        return;
      }
      if (typeof data.localidade !== 'string' || !data.localidade.trim() || !states.includes(data.uf)) throw new Error('invalid-address-response');
      const address = { street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf, country: 'BR' };
      setForm((previous) => {
        if (previous.zip_code.replace(/\D/g, '') !== digits) return previous;
        const next = { ...previous };
        // Preserve edits made while the lookup was in flight, plus number/complement.
        for (const [key, result] of Object.entries(address)) {
          if (typeof result === 'string' && result.trim() && previous[key] === snapshot[key]) next[key] = result.trim();
        }
        return next;
      });
      setContinued(false);
      setCepStatus({ loading: false, message: 'Consulta concluída. Confira o endereço e complete os campos que faltarem. Número e complemento devem ser informados por você.' });
    } catch {
      if (controller === cepRequest.current) setCepStatus({ loading: false, message: 'Não foi possível consultar o CEP. Você pode preencher o endereço manualmente ou tentar novamente.' });
    } finally { clearTimeout(timeout); }
  }

  function change(event) {
    const { name } = event.target;
    let { value } = event.target;
    if (name === 'cpf') value = value.replace(/\D/g, '').slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    if (name === 'zip_code') value = value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
    if (name === 'zip_code') {
      cepRequest.current?.abort();
      cepRequest.current = null;
      lookupCep(value, form);
    }
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
    setContinued(false);
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    for (const [name, , , optional] of [...personalFields, ...addressFields, ['country']]) {
      if (!optional && !form[name].trim()) nextErrors[name] = 'Preencha este campo.';
    }
    if (form.cpf && !isValidCpf(form.cpf)) nextErrors.cpf = 'CPF inválido. Confira os 11 dígitos informados.';
    if (form.zip_code && form.zip_code.replace(/\D/g, '').length !== 8) nextErrors.zip_code = 'Informe um CEP com 8 dígitos.';
    if (form.state && !states.includes(form.state.toUpperCase())) nextErrors.state = 'Informe uma UF válida.';
    if (form.birth_date) {
      const date = new Date(`${form.birth_date}T00:00:00`);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (Number.isNaN(date.getTime()) || date > today || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(form.birth_date)) nextErrors.birth_date = 'Informe uma data válida que não esteja no futuro.';
    }
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) { document.getElementById(`identity-${firstError}`)?.focus(); return; }
    setContinued(true);
  }

  function leave() {
    allowLeave.current = true;
    blocker.reset();
    navigate(returnPath, { replace: true });
  }

  function field([name, label, maxLength, optional, type = 'text']) {
    return <div key={name} className={['street', 'preferred_name'].includes(name) ? 'sm:col-span-2' : ''}>
      <label htmlFor={`identity-${name}`} className="block text-sm font-medium text-[#374151]">{label} <span className="font-normal text-[#6B7280]">{optional ? '(opcional)' : '*'}</span></label>
      <input id={`identity-${name}`} name={name} type={type} value={form[name]} onChange={change} required={!optional} maxLength={maxLength}
        autoComplete="off" inputMode={['cpf', 'zip_code'].includes(name) ? 'numeric' : undefined}
        aria-invalid={!!errors[name]} aria-describedby={[errors[name] && `identity-error-${name}`, name === 'zip_code' && 'identity-cep-status', name === 'cpf' && 'identity-cpf-help'].filter(Boolean).join(' ') || undefined}
        className={`${inputClass} ${errors[name] ? 'border-[#DC2626]' : ''}`} />
      {errors[name] && <p id={`identity-error-${name}`} className="mt-1 text-sm text-[#DC2626]">{errors[name]}</p>}
      {name === 'cpf' && <p id="identity-cpf-help" className="mt-2 text-xs leading-5 text-[#6B7280]">Conferimos apenas os dígitos do CPF, sem consultar seus dados pessoais. Isso não comprova que o CPF pertence a você.</p>}
      {name === 'zip_code' && <div><p id="identity-cep-status" role="status" className="mt-2 text-xs leading-5 text-[#6B7280]">{cepStatus.message || 'Ao completar o CEP, consultaremos rua, bairro, cidade e estado no ViaCEP. Você pode editar os campos.'}</p><button type="button" disabled={cepStatus.loading || form.zip_code.replace(/\D/g, '').length !== 8} onClick={() => lookupCep(form.zip_code, form)} className={linkClass}>{cepStatus.loading ? 'Buscando...' : 'Buscar endereço'}</button></div>}
    </div>;
  }

  if (confirmingExit) return <section aria-labelledby="identity-exit-title" className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-10">
    <p className="mb-4 text-sm font-medium text-[#5B21B6]">Verificação de identidade</p>
    <h1 ref={heading} tabIndex={-1} id="identity-exit-title" className="text-2xl font-semibold tracking-tight text-[#111827] outline-none sm:text-3xl">Tem certeza de que quer sair?</h1>
    <p className="mt-5 leading-7 text-[#374151]">A verificação de identidade ainda não foi concluída.</p>
    <p className="mt-3 text-sm leading-6 text-[#6B7280]">Você poderá voltar a esta etapa mais tarde. Ao sair, os dados digitados agora serão descartados.</p>
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E7EB] pt-6"><button type="button" onClick={() => blocker.reset()} className={linkClass}>Continuar agora</button><button type="button" onClick={leave} className={primaryClass}>Sair</button></div>
  </section>;

  return <section aria-labelledby="identity-title" className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-10">
    <p className="mb-4 text-sm font-medium text-[#5B21B6]">Verificação de identidade · Etapa inicial</p>
    <h1 ref={heading} tabIndex={-1} id="identity-title" className="text-2xl font-semibold tracking-tight text-[#111827] outline-none sm:text-3xl">Confirme as informações da sua conta</h1>
    <p className="mt-4 text-sm leading-7 text-[#6B7280]">Confira os dados que poderão ser necessários para uma futura verificação de identidade.</p>
    <p className="mt-4 rounded-xl bg-[#F5F3FF] p-4 text-sm leading-6 text-[#5B21B6]">A verificação de identidade ainda não está disponível. O formulário não é salvo nem enviado para análise. Apenas o CEP é consultado no ViaCEP para ajudar a preencher o endereço.</p>
    <p className="mt-5 inline-block rounded-full bg-[#F9FAFB] px-3 py-2 text-xs text-[#374151]">Identidade não verificada</p>
    <form noValidate onSubmit={submit} className="mt-8">
      <p className="mb-5 text-xs text-[#6B7280]">* Campos obrigatórios para continuar nesta etapa.</p>
      <fieldset className="min-w-0"><legend className="mb-5 text-lg font-semibold">Dados pessoais</legend><div className="grid gap-5 sm:grid-cols-2">{personalFields.map(field)}</div></fieldset>
      <fieldset className="mt-9 min-w-0 border-t border-[#E5E7EB] pt-7"><legend className="px-1 text-lg font-semibold">Endereço residencial</legend>
        <div className="mb-5"><label htmlFor="identity-country" className="block text-sm font-medium text-[#374151]">País/Região *</label><select id="identity-country" name="country" required value={form.country} onChange={change} aria-invalid={!!errors.country} aria-describedby={errors.country ? 'identity-error-country' : undefined} className={`${inputClass} ${errors.country ? 'border-[#DC2626]' : ''}`}><option value="">Selecione o país</option><option value="BR">Brasil</option></select>{errors.country && <p id="identity-error-country" className="mt-1 text-sm text-[#DC2626]">{errors.country}</p>}</div>
        <div className="grid gap-5 sm:grid-cols-2">{addressFields.map(field)}</div>
      </fieldset>
      <div aria-live="polite">{continued && <p className="mt-6 rounded-xl bg-[#F5F3FF] p-4 text-sm leading-6 text-[#5B21B6]">Conferência básica concluída: os campos obrigatórios e os dígitos do CPF passaram na validação. Isso não comprova sua identidade nem a titularidade do CPF. Nenhum dado foi enviado ou salvo para verificação. Sua identidade continua não verificada.</p>}</div>
      <div className="mt-8 flex items-center justify-between gap-4 border-t border-[#E5E7EB] pt-6"><button type="button" onClick={() => navigate(returnPath)} className={linkClass}>Voltar</button><button type="submit" className={primaryClass}>Continuar</button></div>
    </form>
  </section>;
}
