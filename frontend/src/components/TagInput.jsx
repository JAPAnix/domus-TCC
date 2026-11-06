import { useId, useState } from 'react';
import { controlClass } from './ui/styles';

/** Lista de etiquetas: digite e use Enter ou vírgula para adicionar; o "×" remove. */
export default function TagInput({ label, value, onChange, max, maxLength = 40, placeholder, hint, error }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState('');

  function add(raw) {
    const text = raw.trim().replace(/\s+/g, ' ');
    if (!text) return;
    if (text.length > maxLength) return setProblem(`Use no máximo ${maxLength} caracteres em cada item.`);
    if (value.some((item) => item.toLowerCase() === text.toLowerCase())) { setProblem('Este item já foi adicionado.'); return; }
    if (value.length >= max) return setProblem(`Você pode adicionar até ${max} itens.`);
    setProblem('');
    onChange([...value, text]);
    setDraft('');
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const message = error || problem;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {value.map((item) => (
            <li key={item} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1 text-sm text-primary-strong">
              {item}
              <button type="button" onClick={() => onChange(value.filter((entry) => entry !== item))} aria-label={`Remover ${item}`} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary-line">×</button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        onChange={(event) => { setDraft(event.target.value); setProblem(''); }}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        placeholder={value.length >= max ? `Limite de ${max} itens atingido` : placeholder}
        disabled={value.length >= max}
        aria-describedby={`${id}-hint`}
        aria-invalid={message ? true : undefined}
        className={controlClass(!!message)}
      />
      <p id={`${id}-hint`} className={`mt-1.5 text-xs leading-5 ${message ? 'text-danger' : 'text-ink-muted'}`}>{message || hint || `Pressione Enter para adicionar. Até ${max} itens.`}</p>
    </div>
  );
}
