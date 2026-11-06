import { useEffect, useState } from 'react';
import { Button } from '../ui';

const ANCHORS = [['fotos', 'Fotos'], ['inclui', 'O que inclui'], ['avaliacoes', 'Avaliações'], ['localizacao', 'Localização']];

/**
 * Barra fixa que aparece ao rolar além da galeria. Destaca a seção visível e mostra preço, nota e o botão de solicitar.
 * No celular, a ação fica na barra fixa de baixo (ver MobileBookingBar).
 */
export default function InnerNav({ price, rating, reviews, onRequest, disabled }) {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState('fotos');

  useEffect(() => {
    const gallery = document.getElementById('fotos');
    if (!gallery) return undefined;
    const showObserver = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    showObserver.observe(gallery);
    const sections = ANCHORS.map(([id]) => document.getElementById(id)).filter(Boolean);
    const spy = new IntersectionObserver((entries) => {
      const inView = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (inView) setActive(inView.target.id);
    }, { rootMargin: '-120px 0px -60% 0px', threshold: 0 });
    sections.forEach((section) => spy.observe(section));
    return () => { showObserver.disconnect(); spy.disconnect(); };
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 top-[var(--spacing-header,4.5rem)] z-30 hidden border-b border-line bg-surface/95 shadow-card backdrop-blur md:block">
      <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <nav aria-label="Seções do anúncio">
          <ul className="flex gap-6">
            {ANCHORS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} aria-current={active === id ? 'true' : undefined} className={`inline-flex min-h-control items-center border-b-2 text-sm ${active === id ? 'border-primary font-semibold text-primary-strong' : 'border-transparent text-ink-muted hover:text-ink'}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-4 py-2">
          <div className="text-right text-sm"><p className="font-semibold">{price}</p>{reviews > 0 && <p className="text-xs text-ink-muted"><span aria-hidden="true" className="text-rating">★</span> {Number(rating).toFixed(1)} · {reviews}</p>}</div>
          <Button size="sm" onClick={onRequest} disabled={disabled}>Solicitar</Button>
        </div>
      </div>
    </div>
  );
}

/** Barra fixa no rodapé do celular: preço e botão. Fica acima do menu inferior. */
export function MobileBookingBar({ price, hint, onRequest, disabled, label = 'Solicitar' }) {
  return (
    <div className="fixed inset-x-0 bottom-[var(--spacing-bottom-nav)] z-30 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 shadow-overlay md:hidden">
      <div className="min-w-0"><p className="truncate text-base font-bold">{price}</p>{hint && <p className="truncate text-xs text-ink-muted">{hint}</p>}</div>
      <Button onClick={onRequest} disabled={disabled}>{label}</Button>
    </div>
  );
}
