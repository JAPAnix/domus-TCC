import { Link } from 'react-router-dom';

/** items: [{ label, to? }]. O último item é a página atual. */
export default function Breadcrumb({ items, className = 'mb-6' }) {
  return (
    <nav aria-label="Você está em" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={item.label} className="flex min-w-0 items-center gap-2">
              {item.to && !last
                ? <Link to={item.to} className="font-medium text-primary-strong underline-offset-2 hover:underline">{item.label}</Link>
                : <span aria-current={last ? 'page' : undefined} className="max-w-[16rem] truncate">{item.label}</span>}
              {!last && <span aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
