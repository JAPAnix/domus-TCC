import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { useMode } from '../context/useMode';
import { isRealtimeOpen, subscribe } from '../services/realtime';
import ConversationView from './messages/ConversationView';
import FeedbackModal from './messages/FeedbackModal';
import { Avatar, Button, Dropdown, EmptyState, ErrorState, Input, SkeletonList, useToast } from '../components/ui';

const short = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

function Row({ conversation, active }) {
  return (
    <li>
      <Link to={`/mensagens/${conversation.uuid}`} aria-current={active ? 'page' : undefined} className={`flex gap-3 border-b border-line p-3 hover:bg-surface-muted ${active ? 'bg-primary-soft' : ''}`}>
        <Avatar src={conversation.other.profilePictureUrl} name={conversation.other.name} decorative />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`truncate text-sm ${conversation.unread ? 'font-bold' : 'font-medium'}`}>{conversation.other.name}</p>
            <span className="shrink-0 text-xs text-ink-muted">{short(conversation.lastMessageAt ?? conversation.createdAt)}</span>
          </div>
          <p className="truncate text-xs text-ink-muted">{conversation.title}</p>
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm ${conversation.unread ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{conversation.preview || 'Sem mensagens ainda'}</p>
            {conversation.unread > 0 && <span className="shrink-0 rounded-full bg-primary px-2 text-xs font-semibold text-white" aria-label={`${conversation.unread} não lidas`}>{conversation.unread > 99 ? '99+' : conversation.unread}</span>}
          </div>
        </div>
      </Link>
    </li>
  );
}

export default function Messages() {
  const { uuid } = useParams();
  const toast = useToast();
  const { mode } = useMode();
  const [archived, setArchived] = useState(false);
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState(false);
  const list = useApiResource('/conversations', { ...(archived && { arquivadas: 1 }), ...(query && { q: query }) }, { keepPrevious: true });
  const prefs = useApiResource('/conversations/prefs', undefined, { keepPrevious: true });
  const { retry } = list;

  // Busca com pequena espera para não consultar a cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => subscribe((event) => { if (['message', 'read', 'unread'].includes(event.type)) retry(); }), [retry]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden && !isRealtimeOpen()) retry(); }, 6000);
    return () => clearInterval(timer);
  }, [retry]);

  const refresh = useCallback(() => retry(), [retry]);
  async function toggleSuggestions() {
    const next = !(prefs.data?.suggestions ?? true);
    try {
      await api.put('/conversations/prefs', { suggestions: next });
      toast.success(next ? 'Sugestões de resposta ligadas.' : 'Sugestões de resposta desligadas.');
      prefs.retry();
    } catch (err) { toast.error(apiError(err, 'Não foi possível salvar.')); }
  }

  const rows = list.data?.data ?? [];
  const menuItem = 'block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-surface-muted';
  return (
    <main className="mx-auto max-w-page px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{archived ? 'Conversas anteriores' : 'Mensagens'}</h1>
        <Dropdown trigger={({ open, toggle }) => <Button variant="secondary" size="sm" onClick={toggle} aria-expanded={open} aria-haspopup="menu">Configurações</Button>}>
          {({ close }) => (
            <div role="menu" className="space-y-1">
              <Link role="menuitem" to="/mensagens/respostas-rapidas" onClick={close} className={menuItem}>Gerenciar respostas rápidas</Link>
              <button type="button" role="menuitemcheckbox" aria-checked={prefs.data?.suggestions ?? true} onClick={() => { close(); toggleSuggestions(); }} className={menuItem}>Sugestões de respostas: {(prefs.data?.suggestions ?? true) ? 'ligadas' : 'desligadas'}</button>
              <button type="button" role="menuitem" onClick={() => { close(); setArchived((value) => !value); }} className={menuItem}>{archived ? 'Voltar às conversas ativas' : 'Conversas anteriores'}</button>
              <button type="button" role="menuitem" onClick={() => { close(); setFeedback(true); }} className={menuItem}>Dar feedback</button>
            </div>
          )}
        </Dropdown>
      </div>

      <div className="grid overflow-hidden rounded-card border border-line bg-surface lg:h-[calc(100dvh-14rem)] lg:min-h-[28rem] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className={`${uuid ? 'hidden lg:flex' : 'flex'} min-h-[24rem] min-w-0 flex-col border-line lg:border-r`}>
          <div className="border-b border-line p-3">
            <Input label="Buscar nas conversas" type="search" value={term} onChange={(event) => setTerm(event.target.value)} maxLength={60} placeholder="Nome, serviço ou mensagem" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!list.data && list.loading ? <div className="p-3"><SkeletonList count={5} label="Carregando conversas" itemClassName="h-16" /></div>
              : list.error && !list.data ? <div className="p-3"><ErrorState title="Não foi possível carregar as conversas" message={apiError(list.error)} onRetry={list.retry} /></div>
                : rows.length === 0 ? (
                  <div className="p-3">
                    {query ? <EmptyState icon="search" title="Nenhuma conversa encontrada" description="Tente outro nome ou outra palavra." />
                      : archived ? <EmptyState icon="chat" title="Nenhuma conversa anterior" description="As conversas que você arquivar aparecem aqui." action={<Button variant="secondary" onClick={() => setArchived(false)}>Voltar às conversas</Button>} />
                        : <EmptyState icon="chat" title="Não há nada para ver aqui" description="Quando você conversar com alguém sobre um serviço, a conversa aparece aqui." action={mode === 'professional' ? <Button to="/pro/pedidos">Ver pedidos</Button> : <Button to="/buscar">Buscar serviços</Button>} />}
                  </div>
                ) : <ul>{rows.map((conversation) => <Row key={conversation.uuid} conversation={conversation} active={conversation.uuid === uuid} />)}</ul>}
          </div>
        </div>

        <div className={`${uuid ? 'flex' : 'hidden lg:flex'} h-[calc(100dvh-13rem)] min-h-[24rem] min-w-0 flex-col lg:h-auto`}>
          {uuid ? <ConversationView key={uuid} uuid={uuid} onChanged={refresh} /> : (
            <div className="m-auto max-w-xs p-6 text-center">
              <p className="font-semibold">Selecione uma conversa</p>
              <p className="mt-1 text-sm text-ink-muted">Escolha uma conversa ao lado para ler e responder.</p>
            </div>
          )}
        </div>
      </div>
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </main>
  );
}
