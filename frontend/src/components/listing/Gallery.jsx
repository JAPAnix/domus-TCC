import { useEffect, useRef, useState } from 'react';

/** Visualizador de fotos em tela cheia: setas do teclado, Esc, zoom por clique e contador. */
function PhotoViewer({ images, title, start, onClose }) {
  const dialog = useRef(null);
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const last = images.length - 1;
  const go = (step) => { setZoomed(false); setIndex((current) => (current + step + images.length) % images.length); };

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  function onKeyDown(event) {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    if (event.key === 'Home') { event.preventDefault(); setIndex(0); }
    if (event.key === 'End') { event.preventDefault(); setIndex(last); }
  }

  const control = 'flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-xl text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white';
  return (
    <dialog ref={dialog} onClose={onClose} onKeyDown={onKeyDown} aria-label={`Fotos de ${title}`} className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-3">
          <p className="text-sm" aria-live="polite">{index + 1} / {images.length}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setZoomed((value) => !value)} aria-pressed={zoomed} className="rounded-full bg-black/60 px-4 py-2 text-sm hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white">{zoomed ? 'Reduzir' : 'Ampliar'}</button>
            <button type="button" onClick={onClose} aria-label="Fechar fotos" className={control}>✕</button>
          </div>
        </div>
        <div className={`relative flex min-h-0 flex-1 items-center justify-center ${zoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
          <img
            src={images[index]} alt={`Foto ${index + 1} de ${images.length}: ${title}`} onClick={() => setZoomed((value) => !value)}
            className={zoomed ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'} style={zoomed ? { width: '180%' } : undefined}
          />
          {images.length > 1 && !zoomed && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className={`${control} absolute left-3 top-1/2 -translate-y-1/2`}>‹</button>
              <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className={`${control} absolute right-3 top-1/2 -translate-y-1/2`}>›</button>
            </>
          )}
        </div>
        <ul className="flex gap-2 overflow-x-auto p-3" aria-label="Miniaturas">
          {images.map((url, position) => (
            <li key={url}>
              <button type="button" onClick={() => { setZoomed(false); setIndex(position); }} aria-label={`Ver foto ${position + 1}`} aria-current={position === index} className={`h-14 w-20 overflow-hidden rounded-control border-2 ${position === index ? 'border-white' : 'border-transparent opacity-60'}`}>
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}

/** Desktop: 1 foto grande e 4 menores. Celular: carrossel com deslizar e contador. */
export default function Gallery({ images, title }) {
  const [viewer, setViewer] = useState(null);
  const [slide, setSlide] = useState(0);
  const track = useRef(null);
  if (!images.length) return <div id="fotos" className="flex aspect-[16/9] items-center justify-center rounded-card bg-primary-soft text-sm text-ink-muted">Sem fotos</div>;
  const side = images.slice(1, 5);
  const open = (position) => setViewer(position);

  return (
    <div id="fotos" className="scroll-mt-32">
      {/* Celular */}
      <div className="relative sm:hidden">
        <div ref={track} onScroll={(event) => setSlide(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))} className="flex snap-x snap-mandatory overflow-x-auto rounded-card [scrollbar-width:none]" tabIndex={0} aria-label="Fotos do serviço, deslize para ver mais">
          {images.map((url, position) => (
            <button key={url} type="button" onClick={() => open(position)} aria-label={`Ampliar foto ${position + 1} de ${images.length}`} className="w-full shrink-0 snap-center">
              <img src={url} alt={`Foto ${position + 1}: ${title}`} loading={position === 0 ? 'eager' : 'lazy'} className="aspect-[4/3] w-full object-cover" />
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">{slide + 1} / {images.length}</span>
      </div>

      {/* Desktop */}
      <div className={`relative hidden gap-2 overflow-hidden rounded-card sm:grid ${side.length ? 'grid-cols-2 sm:h-[26rem]' : 'grid-cols-1'}`}>
        <button type="button" onClick={() => open(0)} aria-label="Ampliar a foto de capa" className="h-full overflow-hidden">
          <img src={images[0]} alt={`Foto de capa: ${title}`} className="h-full w-full object-cover transition-transform hover:scale-[1.02]" />
        </button>
        {side.length > 0 && (
          <div className={`grid gap-2 ${side.length > 1 ? 'grid-cols-2 grid-rows-2' : ''}`}>
            {side.map((url, position) => (
              <button key={url} type="button" onClick={() => open(position + 1)} aria-label={`Ampliar foto ${position + 2}`} className="overflow-hidden">
                <img src={url} alt={`Foto ${position + 2}: ${title}`} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-[1.03]" />
              </button>
            ))}
          </div>
        )}
        {images.length > 1 && <button type="button" onClick={() => open(0)} className="absolute bottom-4 right-4 rounded-control border border-line-strong bg-surface px-4 py-2 text-sm font-semibold shadow-raised hover:bg-surface-muted">Mostrar todas as {images.length} fotos</button>}
      </div>
      {viewer !== null && <PhotoViewer images={images} title={title} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
