import { useRef, useState } from 'react';
import api, { apiError, apiFieldErrors } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { Breadcrumb, Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Modal, Select, SkeletonList, Textarea, useToast } from '../../components/ui';

const VARIABLES = [['{nome_do_cliente}', 'Nome do cliente'], ['{servico}', 'Serviço'], ['{data}', 'Data do serviço'], ['{nome_do_profissional}', 'Seu nome']];
const SCHEDULES = { none: 'Não programar (uso manual)', before_service: 'Enviar antes do serviço', after_service: 'Enviar depois do serviço', review_request: 'Enviar pedindo avaliação' };

function ReplyForm({ initial, listings, onClose, onSaved }) {
  const toast = useToast();
  const body = useRef(null);
  const [form, setForm] = useState({
    title: initial?.title ?? '', body: initial?.body ?? '', listing_uuid: initial?.listingUuid ?? '', schedule: initial?.schedule ?? 'none', offset_hours: String(initial?.offsetHours ?? 24),
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (name, value) => { setForm((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: undefined })); };

  function insert(variable) {
    const element = body.current;
    const start = element?.selectionStart ?? form.body.length;
    const end = element?.selectionEnd ?? form.body.length;
    set('body', form.body.slice(0, start) + variable + form.body.slice(end));
    requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(start + variable.length, start + variable.length); });
  }
  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!form.title.trim()) found.title = 'Dê um nome ao modelo.';
    if (!form.body.trim()) found.body = 'Escreva o texto do modelo.';
    const hours = Number(form.offset_hours);
    if (form.schedule !== 'none' && !(Number.isInteger(hours) && hours >= 1 && hours <= 168)) found.offset_hours = 'Use entre 1 e 168 horas.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const payload = { title: form.title, body: form.body, listing_uuid: form.listing_uuid || null, schedule: form.schedule, ...(form.schedule !== 'none' && { offset_hours: hours }) };
    try {
      if (initial) await api.put(`/quick-replies/${initial.id}`, payload); else await api.post('/quick-replies', payload);
      toast.success('Resposta rápida salva.');
      onSaved();
    } catch (err) {
      setErrors(apiFieldErrors(err));
      toast.error(apiError(err, 'Não foi possível salvar.'));
      setBusy(false);
    }
  }
  const offsetLabel = form.schedule === 'before_service' ? 'Quantas horas antes do serviço?' : 'Quantas horas depois da conclusão?';
  return (
    <Modal open title={initial ? 'Editar resposta rápida' : 'Nova resposta rápida'} onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Input label="Nome do modelo" value={form.title} onChange={(event) => set('title', event.target.value)} error={errors.title} maxLength={60} autoFocus />
        <div>
          <Textarea ref={body} label="Texto" value={form.body} onChange={(event) => set('body', event.target.value)} error={errors.body} maxLength={1000} rows={5} />
          <p className="mt-2 text-xs text-ink-muted">Clique para inserir uma variável:</p>
          <div className="mt-1 flex flex-wrap gap-2">{VARIABLES.map(([variable, label]) => <button key={variable} type="button" onClick={() => insert(variable)} title={label} className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-surface-muted">{variable}</button>)}</div>
        </div>
        {listings.length > 0 && (
          <Select label="Usar em" value={form.listing_uuid} onChange={(event) => set('listing_uuid', event.target.value)}>
            <option value="">Todas as conversas</option>
            {listings.map((item) => <option key={item.uuid} value={item.uuid}>{item.title}</option>)}
          </Select>
        )}
        <Select label="Envio programado" value={form.schedule} onChange={(event) => set('schedule', event.target.value)}>
          {Object.entries(SCHEDULES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        {form.schedule !== 'none' && <Input label={offsetLabel} type="number" min="1" max="168" inputMode="numeric" value={form.offset_hours} onChange={(event) => set('offset_hours', event.target.value)} error={errors.offset_hours} hint="A mensagem sai sozinha, uma vez por pedido, em nome do profissional." />}
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" loading={busy}>Salvar</Button></div>
      </form>
    </Modal>
  );
}

export default function QuickReplies() {
  const toast = useToast();
  const resource = useApiResource('/quick-replies', undefined, { keepPrevious: true });
  const mine = useApiResource('/pro/listings');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const listings = (mine.data ?? []).filter((item) => item.status === 'published');
  const crumbs = [{ label: 'Mensagens', to: '/mensagens' }, { label: 'Respostas rápidas' }];

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/quick-replies/${removing.id}`);
      toast.success('Resposta apagada.');
      resource.retry();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível apagar.'));
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  }

  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={crumbs} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Respostas rápidas</h1>
        <Button onClick={() => setEditing({})}>Nova resposta</Button>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Modelos de mensagem para usar nas conversas com um clique. Use variáveis como {'{nome_do_cliente}'} e {'{servico}'}; elas são preenchidas na hora. Você também pode programar o envio para antes ou depois do serviço.</p>
      <div className="mt-8">
        {!resource.data && resource.loading ? <SkeletonList count={3} label="Carregando respostas" itemClassName="h-24" />
          : resource.error && !resource.data ? <ErrorState title="Não foi possível carregar as respostas" message={apiError(resource.error)} onRetry={resource.retry} />
            : resource.data.length === 0 ? <EmptyState icon="chat" title="Nenhuma resposta rápida ainda" description="Crie modelos para as perguntas mais comuns, como preço, horários e endereço." action={<Button onClick={() => setEditing({})}>Criar a primeira</Button>} />
              : (
                <ul className="space-y-3">
                  {resource.data.map((reply) => (
                    <li key={reply.id}>
                      <Card className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="font-semibold">{reply.title}</h2>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-soft">{reply.body}</p>
                          <p className="mt-2 text-xs text-ink-muted">
                            {reply.listingTitle ? `Só no anúncio “${reply.listingTitle}”` : 'Em todas as conversas'}
                            {reply.schedule !== 'none' && ` · ${SCHEDULES[reply.schedule]} (${reply.offsetHours} h)`}
                          </p>
                        </div>
                        <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setEditing(reply)}>Editar</Button><Button size="sm" variant="dangerOutline" onClick={() => setRemoving(reply)}>Excluir</Button></div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
      </div>
      {editing && <ReplyForm key={editing.id ?? 'new'} initial={editing.id ? editing : null} listings={listings} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); resource.retry(); }} />}
      <ConfirmDialog open={!!removing} danger busy={busy} title="Excluir resposta" confirmLabel="Excluir" message={removing ? `“${removing.title}” será apagada. Mensagens já enviadas não mudam.` : ''} onConfirm={remove} onCancel={() => setRemoving(null)} />
    </main>
  );
}
