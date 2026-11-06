import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../../services/api';
import { useAuth } from '../../context/useAuth';
import { useApiResource } from '../../hooks/useApiResource';
import { helpCategories } from '../../content/help/categories';
import { formatDay } from '../../utils/format';
import { Breadcrumb, Button, Card, EmptyState, Input, Select, SkeletonList, Textarea, useToast } from '../../components/ui';

const SUBJECTS = [...helpCategories.map((category) => [category.slug, category.title]), ['outro', 'Outro assunto']];
const STATUS = { open: 'Recebido', answered: 'Respondido', closed: 'Encerrado' };

function MyTickets({ refreshKey }) {
  const resource = useApiResource('/help/tickets/mine', { refreshKey }, { keepPrevious: true });
  if (!resource.data && resource.loading) return <SkeletonList count={2} label="Carregando seus chamados" itemClassName="h-20" className="space-y-3" />;
  if (resource.error) return <p role="alert" className="text-sm text-danger">{apiError(resource.error, 'Não foi possível carregar seus chamados.')} <button type="button" onClick={resource.retry} className="font-semibold underline">Tentar novamente</button></p>;
  if (!resource.data.length) return <p className="text-sm text-ink-muted">Você ainda não enviou nenhum chamado.</p>;
  return (
    <ul className="space-y-3">
      {resource.data.map((ticket) => (
        <li key={ticket.id} className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">#{ticket.id} · {ticket.subject}</p>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-soft">{STATUS[ticket.status]}</span>
          </div>
          <p className="text-xs text-ink-muted">{SUBJECTS.find(([slug]) => slug === ticket.category)?.[1]} · {formatDay(ticket.createdAt)}</p>
          <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{ticket.message}</p>
        </li>
      ))}
    </ul>
  );
}

export default function HelpContact() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const initialSubject = SUBJECTS.some(([slug]) => slug === params.get('assunto')) ? params.get('assunto') : '';
  const [form, setForm] = useState({ category: initialSubject, subject: '', message: '', name: '', email: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const change = (event) => { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); setErrors((current) => ({ ...current, [event.target.name]: undefined })); };

  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!form.category) found.category = 'Escolha um assunto.';
    if (form.subject.trim().length < 5) found.subject = 'O título precisa ter pelo menos 5 caracteres.';
    if (form.message.trim().length < 20) found.message = 'Conte um pouco mais: a mensagem precisa ter pelo menos 20 caracteres.';
    if (!user && form.name.trim().length < 2) found.name = 'Informe seu nome.';
    if (!user && !/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = 'Informe um e-mail válido.';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) { event.currentTarget.elements[first]?.focus(); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/help/tickets', { category: form.category, subject: form.subject.trim(), message: form.message.trim(), ...(!user && { name: form.name.trim(), email: form.email.trim() }) });
      setSent(data);
      setForm({ category: '', subject: '', message: '', name: '', email: '' });
      setRefreshKey((value) => value + 1);
      toast.success('Mensagem enviada.');
    } catch (err) {
      setErrors(apiFieldErrors(err));
      toast.error(apiError(err, 'Não foi possível enviar sua mensagem.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Central de Ajuda', to: '/ajuda' }, { label: 'Falar com o suporte' }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">Falar com o suporte</h1>
      <p className="mb-6 mt-2 text-ink-muted">Antes de escrever, vale uma olhada nos artigos da <a href="/ajuda" className="font-semibold text-primary-strong underline underline-offset-2">Central de Ajuda</a>. Se não resolver, conte o que aconteceu.</p>

      {sent ? (
        <EmptyState icon="chat" title="Recebemos a sua mensagem" description={`Seu chamado é o número ${sent.id}. ${user ? 'Você acompanha o status logo abaixo.' : 'Guarde esse número.'} Cuidamos disso assim que possível.`} action={<Button variant="secondary" onClick={() => setSent(null)}>Enviar outra mensagem</Button>} />
      ) : (
        <Card as="form" onSubmit={submit} noValidate className="space-y-5">
          {!user && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Seu nome" name="name" required autoComplete="name" value={form.name} onChange={change} error={errors.name} />
              <Input label="Seu e-mail" name="email" type="email" required autoComplete="email" value={form.email} onChange={change} error={errors.email} />
            </div>
          )}
          <Select label="Assunto" name="category" required value={form.category} onChange={change} error={errors.category}>
            <option value="">Escolha um assunto</option>
            {SUBJECTS.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
          </Select>
          <Input label="Título" name="subject" required maxLength={150} value={form.subject} onChange={change} error={errors.subject} placeholder="Em poucas palavras, o que aconteceu?" />
          <Textarea label="Mensagem" name="message" required rows={6} maxLength={5000} value={form.message} onChange={change} error={errors.message} hint={user ? 'Vamos responder no e-mail da sua conta. Não envie senhas nem códigos.' : 'Vamos responder no e-mail informado. Não envie senhas nem códigos.'} />
          <Button type="submit" loading={busy}>Enviar mensagem</Button>
        </Card>
      )}

      {user && <section aria-labelledby="meus-chamados" className="mt-10"><h2 id="meus-chamados" className="mb-3 text-lg font-semibold">Meus chamados</h2><MyTickets refreshKey={refreshKey} /></section>}
    </main>
  );
}
