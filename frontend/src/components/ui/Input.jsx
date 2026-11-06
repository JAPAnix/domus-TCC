import { useId } from 'react';
import { controlClass } from './styles';

/** Rótulo, ajuda e erro ligados ao campo por id e aria-describedby. */
function FieldShell({ id, label, required, optional, hint, error, className = '', render }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {required && <span className="text-danger" aria-hidden="true"> *</span>}
          {optional && <span className="font-normal text-ink-muted"> (opcional)</span>}
        </label>
      )}
      {render({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && <p id={hintId} className="mt-1.5 text-xs leading-5 text-ink-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

export default function Input({ label, hint, error, required, optional, wrapperClassName, className = '', id, ...props }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional} className={wrapperClassName}
      render={(aria) => <input {...props} {...aria} className={`${controlClass(!!error)} ${className}`.trim()} />} />
  );
}

export function Textarea({ label, hint, error, required, optional, wrapperClassName, className = '', id, rows = 4, ...props }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional} className={wrapperClassName}
      render={(aria) => <textarea rows={rows} {...props} {...aria} className={`${controlClass(!!error)} ${className}`.trim()} />} />
  );
}

export function Select({ label, hint, error, required, optional, wrapperClassName, className = '', id, children, ...props }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional} className={wrapperClassName}
      render={(aria) => <select {...props} {...aria} className={`${controlClass(!!error)} ${className}`.trim()}>{children}</select>} />
  );
}
