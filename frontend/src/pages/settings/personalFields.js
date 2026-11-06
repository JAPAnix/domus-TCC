import { buttonClass, controlClass } from '../../components/ui/styles';

export const inputClass = `mt-2 ${controlClass()}`;
export const primaryClass = buttonClass();
export const linkClass = 'inline-flex min-h-control items-center rounded-control px-2 text-sm font-semibold text-primary-strong hover:bg-primary-softer disabled:opacity-50';
export const addressFields = [
  ['zip_code', 'CEP', 9], ['street', 'Endereço', 255], ['number', 'Número', 20], ['complement', 'Complemento', 100, true], ['neighborhood', 'Bairro', 100], ['city', 'Cidade', 100], ['state', 'Estado (UF)', 2],
];
export const sections = {
  nome: { title: 'Nome legal', fields: [['first_name', 'Nome', 100], ['last_name', 'Sobrenome', 100]] },
  preferencia: { title: 'Nome de exibição', fields: [['preferred_name', 'Nome de exibição', 100, true]] },
  email: { title: 'Endereço de email', fields: [['target', 'Novo email', 255, false, 'email']] },
  phone: { title: 'Número de telefone', fields: [['target', 'Telefone com DDD', 25, false, 'tel']] },
  nascimento: { title: 'Data de nascimento', fields: [['birth_date', 'Data de nascimento', 10, true, 'date']] },
  residencial: { title: 'Endereço residencial', fields: addressFields },
  postal: { title: 'Endereço postal', fields: addressFields },
  emergencia: { title: 'Contato de emergência', fields: [['name', 'Nome', 100], ['relationship', 'Relação', 30], ['phone', 'Telefone com código do país', 30, false, 'tel']] },
};
export function homeAddress(user) { return Object.fromEntries(addressFields.map(([key]) => [key, user[key === 'zip_code' ? 'zipCode' : key] || ''])); }
export function initialForm(section, user) {
  if (section === 'nome') return { first_name: user.firstName || '', last_name: user.lastName || '' };
  if (section === 'preferencia') return { preferred_name: user.preferredName || '' };
  if (section === 'nascimento') return { birth_date: user.birthDate || '' };
  if (section === 'residencial') return homeAddress(user);
  if (section === 'postal') return { same_as_home: user.postalSameAsHome, ...(user.postalAddress || Object.fromEntries(addressFields.map(([k]) => [k, '']))) };
  if (section === 'emergencia') return user.emergencyContact || { name: '', relationship: 'Familiar', phone: '+55 ' };
  return { target: '', country: '+55' };
}
export function formPayload(section, form) {
  const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
  if (section === 'email') return { target: clean.target.toLowerCase() };
  if (section === 'phone') return { target: clean.country + clean.target.replace(/\D/g, '') };
  if (section === 'postal') { const { same_as_home, ...address } = clean; return same_as_home ? { same_as_home: true } : { same_as_home: false, address }; }
  return clean;
}
export function maskEmail(value) { if (!value) return 'Não informado'; const [name, domain] = value.split('@'); return `${name[0]}***@${domain}`; }
export function maskPhone(value) { return value ? `${value.startsWith('+55') || !value.startsWith('+') ? '+55 ' : '+'}** *****-${value.replace(/\D/g, '').slice(-4)}` : 'Não informado'; }
export function formatZip(value) { return (value || '').replace(/^(\d{5})(\d{3})$/, '$1-$2'); }
export function addressSummary(value) { return value ? [value.street, value.number, value.complement, value.neighborhood, value.city, value.state, formatZip(value.zip_code || value.zipCode)].filter(Boolean).join(', ') || 'Não informado' : 'Não informado'; }
