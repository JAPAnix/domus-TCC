import { Link } from 'react-router-dom';
import { buttonClass } from './styles';

export function Spinner({ className = 'h-4 w-4' }) {
  return <span aria-hidden="true" className={`${className} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`} />;
}

/** Botão padrão. Com `to`, renderiza um link com a mesma aparência. */
export default function Button({ variant, size, block, loading = false, to, className = '', children, type = 'button', disabled, ...props }) {
  const classes = `${buttonClass({ variant, size, block })} ${className}`.trim();
  if (to) return <Link to={to} className={classes} {...props}>{children}</Link>;
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes} {...props}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
