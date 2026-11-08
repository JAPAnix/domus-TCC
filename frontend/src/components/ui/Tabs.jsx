import { useRef } from 'react';
import { NavLink } from 'react-router-dom';

const tabBase = 'inline-flex min-h-control items-center whitespace-nowrap border-b-2 px-1 text-sm transition-colors';
const tabClass = (active) => `${tabBase} ${active ? 'border-primary font-semibold text-primary-strong' : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink'}`;

/** Abas que trocam de página (cada aba é um link). */
export function TabNav({ tabs, label }) {
  return (
    <nav aria-label={label} className="mb-8 border-b border-line">
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map(({ to, label: text, end, badge }) => (
          <li key={to}><NavLink to={to} end={end} className={({ isActive }) => tabClass(isActive)}>{text}{badge > 0 && <span className="ml-2 rounded-full bg-primary px-2 text-xs font-semibold text-white" aria-label={`, ${badge} novos`}>{badge > 99 ? '99+' : badge}</span>}</NavLink></li>
        ))}
      </ul>
    </nav>
  );
}

/** Abas na mesma página (botões). O conteúdo de cada aba fica por conta de quem usa. */
export function Tabs({ tabs, value, onChange, label }) {
  const refs = useRef([]);
  function onKeyDown(event, index) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="mb-6 flex gap-6 overflow-x-auto border-b border-line">
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          ref={(element) => { refs.current[index] = element; }}
          type="button"
          role="tab"
          id={`tab-${tab.value}`}
          aria-selected={value === tab.value}
          aria-controls={`panel-${tab.value}`}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={`-mb-px ${tabClass(value === tab.value)}`}
        >
          {tab.label}{tab.count != null && <span className={`ml-2 rounded-full px-2 text-xs font-semibold ${tab.alert && tab.count > 0 ? 'bg-primary text-white' : 'bg-surface-muted text-ink-soft'}`} aria-label={`, ${tab.count}`}>{tab.count > 99 ? '99+' : tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
