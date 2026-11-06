export default function StatusBadge({ status, map }) {
  const entry = map[status] ?? { label: status, tone: 'bg-surface-muted text-ink-soft' };
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${entry.tone}`}>{entry.label}</span>;
}
