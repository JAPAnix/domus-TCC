import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import { assistantEngine, quickQuestions, supportLink } from '../content/help/assistant';
import { buttonClass } from './ui';

// Telas em que o botão não aparece: pagamento e contratação (não distrair), conversas, login e telas de fluxo.
const HIDDEN = [/^\/mensagens/, /^\/pro\/mensagens/, /^\/anuncios\/[^/]+\/solicitar/, /^\/contratacoes/, /^\/pagamentos/, /^\/login/, /^\/cadastro/, /^\/forgot-password/, /^\/reset-password/, /^\/pro\/anuncio\//, /^\/admin/, /^\/configuracoes\/pessoais\/verificacao-identidade/, /^\/ajuda\/contato/];

// Grava a pergunta (já sem dados pessoais no servidor) e a avaliação. Se falhar, o assistente segue funcionando.
async function logQuestion(question, slug, answered) {
  try { return (await api.post('/help/assistant/questions', { question, slug: slug ?? null, answered })).data.uuid ?? null; } catch { return null; }
}
async function logRating(uuid, helpful) {
  if (!uuid) return;
  try { await api.post(`/help/assistant/questions/${uuid}/rating`, { helpful }); } catch { /* sem registro, sem problema */ }
}

function Bubble({ from, children }) {
  return <div className={`max-w-[90%] rounded-card px-3 py-2 text-sm leading-6 ${from === 'user' ? 'ml-auto bg-primary text-white' : 'bg-surface-muted text-ink'}`}>{children}</div>;
}

function Answer({ message, onRate, onClose }) {
  const { result, question } = message;
  if (result.kind === 'none') {
    return (
      <Bubble from="bot">
        <p>Não encontrei uma resposta confiável para isso na Central de Ajuda. Prefiro não chutar.</p>
        <p className="mt-2">Você pode falar com o nosso suporte: já deixo a sua pergunta preenchida.</p>
        <Link to={supportLink(question, result.category)} onClick={onClose} className={`${buttonClass({ size: 'sm' })} mt-3`}>Falar com o suporte</Link>
      </Bubble>
    );
  }
  const { article, related } = result;
  return (
    <Bubble from="bot">
      <p className="font-semibold">{article.title}</p>
      <p className="mt-1">{article.summary}</p>
      <Link to={`/ajuda/artigo/${article.slug}`} onClick={onClose} className="mt-2 inline-block font-semibold text-primary-strong underline underline-offset-2">Ler o artigo completo</Link>
      {related.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <p className="text-xs text-ink-muted">Veja também</p>
          <ul className="mt-1 space-y-1">{related.map((item) => <li key={item.slug}><Link to={`/ajuda/artigo/${item.slug}`} onClick={onClose} className="text-primary-strong underline underline-offset-2">{item.title}</Link></li>)}</ul>
        </div>
      )}
      <div className="mt-3 border-t border-line pt-2" role="group" aria-label="Isso ajudou?">
        {message.rated == null ? (
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-ink-muted">Isso ajudou?</span>
            <button type="button" onClick={() => onRate(message, true)} className="min-h-control-sm rounded-full border border-line-strong bg-surface px-3 text-xs font-medium hover:bg-surface-muted">Sim</button>
            <button type="button" onClick={() => onRate(message, false)} className="min-h-control-sm rounded-full border border-line-strong bg-surface px-3 text-xs font-medium hover:bg-surface-muted">Não</button>
          </div>
        ) : message.rated ? <p className="text-xs text-success">Que bom! Obrigado pelo retorno.</p> : (
          <p className="text-xs text-ink-soft">Obrigado por avisar. Se quiser, <Link to={supportLink(question, article.category)} onClick={onClose} className="font-semibold text-primary-strong underline underline-offset-2">fale com o suporte</Link>: a sua pergunta já vai preenchida.</p>
        )}
      </div>
    </Bubble>
  );
}

function Panel({ onClose }) {
  const titleId = useId();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const nextId = useRef(1);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages, busy]);

  async function ask(question, quickSlug) {
    const clean = question.trim();
    if (!clean || busy) return;
    const id = nextId.current++;
    setMessages((list) => [...list, { id: `u${id}`, from: 'user', text: clean }]);
    setText('');
    setBusy(true);
    const result = quickSlug ? assistantEngine.quick(quickSlug) : await assistantEngine.answer(clean);
    const uuid = await logQuestion(clean, result.kind === 'answer' ? result.article.slug : null, result.kind === 'answer');
    setMessages((list) => [...list, { id: `b${id}`, from: 'bot', question: clean, result, uuid, rated: null }]);
    setBusy(false);
    inputRef.current?.focus();
  }

  function rate(message, helpful) {
    setMessages((list) => list.map((item) => (item.id === message.id ? { ...item, rated: helpful } : item)));
    logRating(message.uuid, helpful);
  }

  return (
    <section role="dialog" aria-modal="false" aria-labelledby={titleId} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
      className="fixed inset-x-3 bottom-[calc(var(--spacing-bottom-nav)+0.75rem)] z-[60] flex max-h-[min(34rem,calc(100dvh-var(--spacing-bottom-nav)-5rem))] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-raised md:inset-x-auto md:bottom-6 md:right-6 md:w-96 md:max-h-[min(36rem,calc(100dvh-3rem))]">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div><h2 id={titleId} className="font-semibold">Assistente de ajuda</h2><p className="text-xs text-ink-muted">Responde com os artigos da Central de Ajuda</p></div>
        <button type="button" onClick={onClose} aria-label="Fechar o assistente" className="grid h-control-sm w-control-sm place-items-center rounded-full text-ink-soft hover:bg-surface-muted">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div role="log" aria-live="polite" aria-label="Conversa com o assistente" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <Bubble from="bot">
          <p>Oi! Eu respondo dúvidas com base na Central de Ajuda. Escolha uma pergunta ou escreva a sua.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickQuestions.map((item) => <button key={item.slug} type="button" onClick={() => ask(item.label, item.slug)} className="min-h-control-sm rounded-full border border-primary-line bg-surface px-3 text-xs font-medium text-primary-strong hover:bg-primary-softer">{item.label}</button>)}
          </div>
        </Bubble>
        {messages.map((message) => (message.from === 'user' ? <Bubble key={message.id} from="user">{message.text}</Bubble> : <Answer key={message.id} message={message} onRate={rate} onClose={onClose} />))}
        {busy && <p role="status" className="text-xs text-ink-muted">Procurando nos artigos…</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); ask(text); }} className="flex gap-2 border-t border-line p-3">
        <label htmlFor={`${titleId}-q`} className="sr-only">Escreva a sua dúvida</label>
        <input id={`${titleId}-q`} ref={inputRef} value={text} onChange={(event) => setText(event.target.value)} maxLength={300} autoComplete="off" placeholder="Escreva a sua dúvida" className="min-h-control min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-3 text-sm" />
        <button type="submit" disabled={busy || !text.trim()} className={buttonClass({ size: 'md' })}>Enviar</button>
      </form>
      <p className="px-4 pb-3 text-xs text-ink-muted">Não escreva dados pessoais. Para falar com uma pessoa, use o <Link to="/ajuda/contato" onClick={onClose} className="font-semibold text-primary-strong underline underline-offset-2">suporte</Link>.</p>
    </section>
  );
}

/** Botão flutuante "Ajuda" que abre o assistente. Some nas telas de pagamento, contratação e mensagens. */
export default function HelpAssistant() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const hidden = HIDDEN.some((pattern) => pattern.test(pathname));

  function close() {
    setOpen(false);
    // Devolve o foco ao botão para quem usa teclado ou leitor de tela.
    setTimeout(() => buttonRef.current?.focus(), 0);
  }

  if (hidden) return null;
  return (
    <>
      {open && <Panel onClose={close} />}
      {!open && (
        <button ref={buttonRef} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded="false"
          className="fixed bottom-[calc(var(--spacing-bottom-nav)+0.75rem)] right-4 z-[45] flex min-h-control items-center gap-2 rounded-full bg-gradient-primary px-4 text-sm font-semibold text-white shadow-raised hover:bg-gradient-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 md:bottom-6 md:right-6">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.4A8 8 0 1 1 21 12Z" /></svg>
          Ajuda
        </button>
      )}
    </>
  );
}
