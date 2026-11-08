import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { apiError } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { useMarkConversationRead } from '../../hooks/useMarkConversationRead';
import { isRealtimeOpen, notifyMessagesChanged, signalTyping, subscribe } from '../../services/realtime';
import ImageUploader from '../../components/ImageUploader';
import { Avatar, Button, ConfirmDialog, Dropdown, ErrorState, Modal, Select, SkeletonList, Textarea, useToast } from '../../components/ui';

const REASONS = { spam: 'Spam ou propaganda', abuse: 'Ofensas ou assédio', scam: 'Tentativa de golpe', inappropriate: 'Conteúdo impróprio', other: 'Outro motivo' };
const time = (value) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (value) => new Date(value).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

function ReportModal({ uuid, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!reason) { setError('Escolha o motivo da denúncia.'); return; }
    setBusy(true);
    try {
      await api.post(`/conversations/${uuid}/report`, { reason, details });
      toast.success('Denúncia enviada. Obrigado por avisar.');
      onClose();
    } catch (err) {
      setError(apiError(err, 'Não foi possível enviar a denúncia.'));
      setBusy(false);
    }
  }
  return (
    <Modal open title="Denunciar esta pessoa" onClose={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Select label="Motivo" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} error={error}>
          <option value="">Escolha</option>
          {Object.entries(REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Textarea label="Detalhes (opcional)" optional value={details} onChange={(event) => setDetails(event.target.value)} maxLength={500} rows={3} />
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button><Button type="submit" loading={busy}>Enviar denúncia</Button></div>
      </form>
    </Modal>
  );
}

function Composer({ uuid, canSend, replies, onSent }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState([]);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  function change(value) {
    setText(value);
    if (value) signalTyping(uuid);
  }
  async function send() {
    if (busy || uploading || (!text.trim() && !photo[0])) return;
    setBusy(true);
    const sentText = text;
    try {
      await api.post(`/conversations/${uuid}/messages`, { body: text, image_url: photo[0] ?? null });
      // Se a pessoa já começou a digitar a próxima mensagem enquanto esta ia, o que ela digitou não pode ser apagado.
      setText((current) => (current === sentText ? '' : current));
      setPhoto([]);
      setPhotoOpen(false);
      onSent();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível enviar a mensagem.'));
    } finally {
      setBusy(false);
    }
  }

  if (!canSend) return <p role="status" className="border-t border-line bg-surface-muted p-4 text-center text-sm text-ink-soft">Não é possível enviar mensagens nesta conversa.</p>;
  return (
    <div className="border-t border-line p-3">
      {replies?.suggestions?.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2" aria-label="Sugestões de resposta">
          {replies.suggestions.map((item) => <button key={item.text} type="button" onClick={() => change(item.text)} className="max-w-full truncate rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft hover:bg-surface-muted" title={item.text}>{item.text}</button>)}
        </div>
      )}
      {photoOpen && <div className="mb-3"><ImageUploader variant="gallery" purpose="message" max={1} value={photo} onChange={setPhoto} label="Foto da mensagem" onBusyChange={setUploading} /></div>}
      <form onSubmit={(event) => { event.preventDefault(); send(); }} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="message-text" className="sr-only">Mensagem</label>
          <textarea
            id="message-text" rows={2} maxLength={2000} value={text} onChange={(event) => change(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
            placeholder="Escreva sua mensagem" className="block w-full resize-none rounded-control border border-line-strong bg-surface p-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
          />
        </div>
        <Button type="submit" loading={busy} disabled={uploading || (!text.trim() && !photo[0])}>Enviar</Button>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setPhotoOpen((value) => !value)} aria-expanded={photoOpen}>Foto</Button>
        <Dropdown align="left" direction="up" panelClassName="w-80" trigger={({ open, toggle }) => <Button size="sm" variant="ghost" onClick={toggle} aria-expanded={open}>Respostas rápidas</Button>}>
          {({ close }) => (
            <div className="space-y-1">
              {replies?.quickReplies?.length ? replies.quickReplies.map((item) => (
                <button key={item.id} type="button" onClick={() => { change(item.text); close(); }} className="block w-full rounded-control px-3 py-2 text-left hover:bg-surface-muted">
                  <span className="block text-sm font-medium">{item.title}</span><span className="line-clamp-2 text-xs text-ink-muted">{item.text}</span>
                </button>
              )) : <p className="px-3 py-2 text-sm text-ink-muted">Você ainda não criou respostas rápidas.</p>}
              <Link to="/mensagens/respostas-rapidas" onClick={close} className="block rounded-control px-3 py-2 text-sm font-medium text-primary-strong hover:bg-surface-muted">Gerenciar respostas rápidas</Link>
            </div>
          )}
        </Dropdown>
        <span className="ml-auto text-xs text-ink-muted" aria-live="polite">{text.length > 1800 ? `${text.length}/2000` : ''}</span>
      </div>
    </div>
  );
}

export default function ConversationView({ uuid, onChanged }) {
  const toast = useToast();
  const navigate = useNavigate();
  const resource = useApiResource(`/conversations/${uuid}`, undefined, { keepPrevious: true });
  const repliesResource = useApiResource(`/conversations/${uuid}/replies`, undefined, { keepPrevious: true });
  const [older, setOlder] = useState([]);
  const [moreBusy, setMoreBusy] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(null);
  const [typingAt, setTypingAt] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const scroller = useRef(null);
  const data = resource.data;
  const lastUuid = data?.messages.at(-1)?.uuid;
  const lastIncomingUuid = data?.messages.findLast((message) => !message.mine)?.uuid;
  const { retry } = resource;
  const { retry: retryReplies } = repliesResource;

  // Tempo real: atualiza quando chega mensagem, leitura ou "digitando" desta conversa.
  useEffect(() => subscribe((event) => {
    if (event.conversation !== uuid) return;
    if (event.type === 'message' || event.type === 'read') { retry(); retryReplies(); onChanged?.(); }
    if (event.type === 'typing') { setTypingAt(Date.now()); setTimeout(() => setTypingAt(0), 5000); }
  }), [uuid, retry, retryReplies, onChanged]);

  // Sem tempo real, consulta a API a cada poucos segundos.
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden && !isRealtimeOpen()) { retry(); onChanged?.(); } }, 5000);
    return () => clearInterval(timer);
  }, [retry, onChanged]);

  // Marca como lida ao abrir, quando chega mensagem nova e ao voltar para a aba, com nova tentativa se a rede falhar.
  useMarkConversationRead(uuid, lastIncomingUuid, () => { notifyMessagesChanged(); onChanged?.(); });

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [lastUuid]);

  const loadOlder = useCallback(async () => {
    const first = older[0] ?? data.messages[0];
    setMoreBusy(true);
    try {
      const { data: page } = await api.get(`/conversations/${uuid}`, { params: { antes: first.uuid } });
      setOlder((current) => [...page.messages, ...current]);
      setHasMoreOlder(page.hasMore);
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível carregar mensagens anteriores.'));
    } finally {
      setMoreBusy(false);
    }
  }, [older, data, uuid, toast]);
  async function archive() {
    try {
      await api.post(`/conversations/${uuid}/${data.archived ? 'unarchive' : 'archive'}`);
      toast.success(data.archived ? 'Conversa desarquivada.' : 'Conversa arquivada.');
      onChanged?.();
      notifyMessagesChanged();
      if (!data.archived) navigate('/mensagens');
      else retry();
    } catch (err) { toast.error(apiError(err, 'Não foi possível concluir.')); }
  }
  async function block() {
    try {
      await api.post('/blocks', { user_uuid: data.other.uuid });
      toast.success('Pessoa bloqueada. Você pode desbloquear em Privacidade.');
      retry();
    } catch (err) { toast.error(apiError(err, 'Não foi possível bloquear.')); } finally { setBlocking(false); }
  }

  if (!data && resource.loading) return <div className="p-4"><SkeletonList count={4} label="Carregando conversa" itemClassName="h-14" /></div>;
  if (resource.error && !data) {
    return <div className="p-4">{resource.error.response?.status === 404
      ? <ErrorState title="Conversa não encontrada" message="Ela não existe ou você não participa dela." action={<Button to="/mensagens">Voltar às mensagens</Button>} />
      : <ErrorState title="Não foi possível carregar a conversa" message={apiError(resource.error)} onRetry={resource.retry} />}</div>;
  }

  const messages = [...older, ...data.messages];
  const showMore = hasMoreOlder === null ? data.hasMore : hasMoreOlder;
  const typing = data.typing || (typingAt > 0);
  const lastMine = [...messages].reverse().find((item) => item.mine);
  return (
    <section aria-label={`Conversa com ${data.other.name}`} className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line p-3">
        <Link to="/mensagens" aria-label="Voltar às conversas" className="rounded-control p-2 text-ink-soft hover:bg-surface-muted lg:hidden">←</Link>
        <Avatar src={data.other.profilePictureUrl} name={data.other.name} decorative />
        <div className="min-w-0 flex-1">
          <Link to={`/usuarios/${data.other.uuid}`} className="block truncate font-semibold hover:underline">{data.other.name}</Link>
          {data.listingUuid ? <Link to={`/anuncios/${data.listingUuid}`} className="block truncate text-xs text-ink-muted hover:underline">{data.title}</Link> : <span className="block truncate text-xs text-ink-muted">{data.title}</span>}
        </div>
        <Dropdown trigger={({ open, toggle }) => <Button variant="ghost" size="sm" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label="Opções da conversa">⋯</Button>}>
          {({ close }) => (
            <div role="menu" className="space-y-1">
              <button type="button" role="menuitem" onClick={() => { close(); archive(); }} className="block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-surface-muted">{data.archived ? 'Desarquivar conversa' : 'Arquivar conversa'}</button>
              <button type="button" role="menuitem" onClick={() => { close(); setReporting(true); }} className="block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-surface-muted">Denunciar</button>
              {!data.blocked && <button type="button" role="menuitem" onClick={() => { close(); setBlocking(true); }} className="block w-full rounded-control px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft">Bloquear</button>}
            </div>
          )}
        </Dropdown>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions">
        <p className="mb-3 rounded-control bg-surface-muted p-3 text-xs leading-5 text-ink-muted">Combine o serviço e o pagamento pelo pedido no Dommos. Desconfie de quem pede dinheiro adiantado ou quer conversar fora da plataforma.</p>
        {showMore && <div className="text-center"><Button size="sm" variant="secondary" onClick={loadOlder} loading={moreBusy}>Ver mensagens anteriores</Button></div>}
        {messages.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">Nenhuma mensagem ainda. Diga olá!</p>}
        {messages.map((message, index) => (
          <div key={message.uuid}>
            {(index === 0 || !sameDay(messages[index - 1].createdAt, message.createdAt)) && <p className="my-3 text-center text-xs text-ink-muted">{dayLabel(message.createdAt)}</p>}
            <div className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-card px-3 py-2 text-sm ${message.mine ? 'bg-primary text-white' : 'bg-surface-muted text-ink'}`}>
                {message.imageUrl && <a href={message.imageUrl} target="_blank" rel="noreferrer"><img src={message.imageUrl} alt="Foto enviada na conversa" loading="lazy" className="mb-1 max-h-64 rounded-control" /></a>}
                {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                <p className={`mt-1 text-right text-[11px] ${message.mine ? 'text-white/80' : 'text-ink-muted'}`}>{time(message.createdAt)}{message === lastMine && message.read ? ' · Visto' : ''}</p>
              </div>
            </div>
          </div>
        ))}
        {typing && <p className="pt-1 text-xs text-ink-muted" role="status">{data.other.name.split(' ')[0]} está digitando…</p>}
      </div>

      <Composer uuid={uuid} canSend={data.canSend} replies={repliesResource.data} onSent={() => { setOlder([]); setHasMoreOlder(null); retry(); retryReplies(); onChanged?.(); }} />
      {reporting && <ReportModal uuid={uuid} onClose={() => setReporting(false)} />}
      <ConfirmDialog open={blocking} danger title="Bloquear esta pessoa" confirmLabel="Bloquear" message={`${data.other.name} não poderá mais enviar mensagens para você nem ver o seu perfil. Você pode desbloquear quando quiser, em Privacidade.`} onConfirm={block} onCancel={() => setBlocking(false)} />
    </section>
  );
}
