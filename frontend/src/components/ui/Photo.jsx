import { useState } from 'react';

/** Imagem com plano B: se a foto não carregar (arquivo removido, rede), mostra um aviso no mesmo espaço em vez do ícone quebrado. */
export default function Photo({ src, alt = '', className = '', ...props }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) {
    return (
      <span role={alt ? 'img' : undefined} aria-label={alt ? `${alt} (foto indisponível)` : undefined} aria-hidden={alt ? undefined : true} className={`${className} flex items-center justify-center bg-surface-muted p-2 text-center text-xs text-ink-muted`}>
        Foto indisponível
      </span>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} {...props} />;
}
