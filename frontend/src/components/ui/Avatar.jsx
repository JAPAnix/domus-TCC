import { useState } from 'react';
import { avatarClass } from '../../utils/categoryColors';

const sizes = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-24 w-24 text-3xl',
};

function initialsOf(name) {
  return (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

/** Mostra a foto; sem foto, ou se ela falhar ao carregar, mostra as iniciais. */
export default function Avatar({ src, name, size = 'md', decorative = false, className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && src !== failedSrc;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${showImage ? 'bg-primary-soft text-primary-strong' : `${avatarClass(name)} text-white`} ${sizes[size]} ${className}`}>
      {showImage
        ? <img src={src} alt={decorative ? '' : `Foto de ${name || 'perfil'}`} onError={() => setFailedSrc(src)} className="h-full w-full object-cover" />
        : <span aria-hidden={decorative || undefined} aria-label={decorative ? undefined : `Iniciais de ${name || 'perfil'}`}>{initialsOf(name)}</span>}
    </span>
  );
}
