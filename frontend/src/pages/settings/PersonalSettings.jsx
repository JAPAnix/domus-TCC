import { useEffect, useState } from 'react';
import { Link, Outlet, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { sections, maskEmail, maskPhone, addressSummary, linkClass, primaryClass } from './personalFields';

export function PersonalSettingsLayout() {
  const { user, token, login } = useAuth();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const uuid = user?.uuid;
  useEffect(() => {
    const controller = new AbortController();
    api.get('/auth/me', { signal: controller.signal }).then(({ data }) => setResult({ data, uuid, attempt })).catch((error) => { if (!controller.signal.aborted) setResult({ error, uuid, attempt }); });
    return () => controller.abort();
  }, [uuid, attempt]);
  if (result?.uuid !== uuid || result?.attempt !== attempt) return <p role="status">Carregando informações pessoais...</p>;
  if (result.error) return <div role="alert"><p>Não foi possível carregar suas informações.</p><button className={`${primaryClass} mt-4`} onClick={() => setAttempt((v) => v + 1)}>Tentar novamente</button></div>;
  const update = (data, message = '') => {
    setResult({ data, uuid, attempt });
    // Keep the existing session shape; sensitive address and pending-code data stay in memory.
    login(token, { ...user, firstName: data.firstName, lastName: data.lastName, email: data.email, phoneNumber: data.phoneNumber, roles: data.roles, hasProfessionalProfile: data.hasProfessionalProfile });
    setNotice(message);
  };
  return <><div aria-live="polite">{notice && <p className="mb-5 rounded-xl bg-[#EDE9FE] p-4 text-sm text-[#5B21B6]">{notice}</p>}</div><Outlet context={{ person: result.data, update, setNotice }} /></>;
}

export function PersonalSettings() {
  const { person, update, setNotice } = useOutletContext();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const values = {
    nome: [person.firstName, person.lastName].filter(Boolean).join(' '), preferencia: person.preferredName,
    email: maskEmail(person.email), phone: maskPhone(person.phoneNumber),
    nascimento: person.birthDate ? person.birthDate.split('-').reverse().join('/') : null,
    residencial: addressSummary(person), postal: person.postalSameAsHome ? 'Mesmo endereço residencial' : addressSummary(person.postalAddress),
    emergencia: person.emergencyContact ? `${person.emergencyContact.name} · ${person.emergencyContact.relationship} · ${maskPhone(person.emergencyContact.phone)}` : null,
  };
  async function cancel(type) {
    if (busy) return;
    setBusy(type); setError('');
    try { const { data } = await api.post(`/users/me/contact/${type}/cancelar`); update(data, 'Alteração pendente cancelada.'); }
    catch (err) { setError(err.response?.data?.message || 'Não foi possível cancelar.'); }
    finally { setBusy(''); }
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="settings-page-title" className="text-2xl font-semibold">Informações pessoais</h2>
        <Link to="/servicos" className={primaryClass}>Concluir</Link>
      </div>
      <p className="mt-3 text-sm text-[#6B7280]">Mantenha os dados da sua conta atualizados.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      <dl className="mt-6 divide-y divide-[#E5E7EB]">
        {Object.entries(sections).map(([key, section]) => {
          const pending = person.pending?.[key];
          const missing = !values[key] || values[key] === 'Não informado';
          return <div key={key} className="py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><dt className="font-medium">{section.title}</dt><dd className="mt-2 break-words text-sm text-[#6B7280]">{values[key] || 'Não informado'}</dd>
                {['email', 'phone'].includes(key) && <p className="mt-1 text-xs text-[#6B7280]">{person[key === 'email' ? 'isEmailVerified' : 'isPhoneVerified'] ? 'Verificado' : 'Não verificado'}</p>}
              </div>
              <Link to={`/configuracoes/pessoais/${key}`} onClick={() => setNotice('')} className={`${linkClass} shrink-0`}>{missing ? 'Adicionar' : 'Editar'}</Link>
            </div>
            {pending && <div className="mt-3 rounded-xl bg-[#F5F3FF] p-3 text-sm text-[#5B21B6]">
              <p className="break-words">{key === 'email' ? maskEmail(pending.target) : maskPhone(pending.target)} · Confirmação pendente</p>
              <div className="mt-1 flex flex-wrap gap-2"><Link to={`/configuracoes/pessoais/${key}/confirmar`} className={linkClass}>Confirmar</Link><button disabled={!!busy} onClick={() => cancel(key)} className={linkClass}>{busy === key ? 'Cancelando...' : 'Cancelar alteração'}</button></div>
            </div>}
          </div>;
        })}
      </dl>
      <aside className="mt-8 space-y-5 rounded-2xl bg-[#F5F3FF] p-5 text-sm leading-6 text-[#374151]">
        <div><h3 className="font-semibold text-[#5B21B6]">Por que algumas informações ficam ocultas?</h3><p>Email e telefone aparecem parcialmente nesta tela para reduzir sua exposição.</p></div>
        <div><h3 className="font-semibold text-[#5B21B6]">O que posso editar?</h3><p>Atualize seus dados nas opções acima. Email e telefone só mudam após a confirmação do código.</p></div>
        <div><h3 className="font-semibold text-[#5B21B6]">Quais informações são compartilhadas?</h3><p>Dados sensíveis da conta não fazem parte do perfil público. O email completo e o telefone não são exibidos publicamente por padrão. Os dados pessoais apoiam o funcionamento e a segurança da conta.</p></div>
      </aside>
    </>
  );
}
