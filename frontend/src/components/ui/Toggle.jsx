import { useId } from 'react';

/** Interruptor acessível (role="switch"). */
export default function Toggle({ checked, onChange, label, description, disabled = false }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        {description && <p id={`${id}-description`} className="mt-0.5 text-sm leading-5 text-ink-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-line-strong'}`}
      >
        <span aria-hidden="true" className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
