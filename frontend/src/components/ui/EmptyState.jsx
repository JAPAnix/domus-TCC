import Button from './Button';

const icons = {
  search: 'm21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  heart: 'M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9c0 6.1-8 11-8 11Z',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.4A8 8 0 1 1 21 12Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  alert: 'M12 8v5m0 3.5h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5-4-2.5 5.5L8 16l2.5-5.5L16 8Z',
};

export default function EmptyState({ icon = 'list', title, description, action, className = '', as: Heading = 'h2' }) {
  return (
    <div className={`flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-14 text-center ${className}`}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-soft text-primary ring-1 ring-primary-line">
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[icon]} /></svg>
      </span>
      <Heading className="text-lg font-semibold text-ink">{title}</Heading>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Algo deu errado', message, onRetry, action, as }) {
  return (
    <div role="alert">
      <EmptyState icon="alert" as={as} title={title} description={message} action={<>
        {onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}
        {action}
      </>} />
    </div>
  );
}
