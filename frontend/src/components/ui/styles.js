const buttonBase = 'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const buttonVariants = {
  primary: 'bg-gradient-primary text-white shadow-card hover:bg-gradient-primary-hover active:brightness-95',
  soft: 'bg-primary-soft text-primary-strong hover:bg-primary-200 active:bg-primary-300',
  accent: 'bg-gradient-accent text-white shadow-card hover:bg-gradient-accent-hover active:brightness-95',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-primary-strong hover:bg-primary-soft',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  dangerOutline: 'border border-danger text-danger hover:bg-danger-soft',
  inverse: 'bg-white text-primary-strong hover:bg-primary-soft',
};

const buttonSizes = {
  md: 'min-h-control px-5 py-2.5 text-sm',
  sm: 'min-h-control-sm px-3 py-1.5 text-sm',
};

export function buttonClass({ variant = 'primary', size = 'md', block = false } = {}) {
  return [buttonBase, buttonVariants[variant], buttonSizes[size], block && 'w-full'].filter(Boolean).join(' ');
}

export function controlClass(invalid = false) {
  return [
    'min-h-control w-full min-w-0 rounded-control border bg-surface px-3 py-2 text-sm text-ink transition-colors',
    'focus:outline-2 focus:outline-offset-0 focus:outline-primary disabled:bg-surface-muted disabled:text-ink-muted',
    invalid ? 'border-danger' : 'border-line-strong',
  ].join(' ');
}

export const cardClass = 'rounded-card border border-line bg-surface shadow-card';
