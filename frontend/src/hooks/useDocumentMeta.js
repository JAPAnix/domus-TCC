import { useEffect } from 'react';

export const SITE_NAME = 'Dommos';
export const buildTitle = (title) => (title ? `${title} · ${SITE_NAME}` : SITE_NAME);

function setMeta(attribute, key, content) {
  if (!content) return () => {};
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  const created = !element;
  const previous = element?.getAttribute('content') ?? null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
  return () => {
    if (created) element.remove();
    else if (previous !== null) element.setAttribute('content', previous);
  };
}

/**
 * Título, descrição, imagem para compartilhamento e dados estruturados (JSON-LD) da página aberta.
 * Tudo volta ao normal quando a página sai de cena. Os buscadores que executam JavaScript leem estes dados.
 */
export function useDocumentMeta({ title, description, image, jsonLd }) {
  const structured = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    if (!title) return undefined;
    const previousTitle = document.title;
    document.title = buildTitle(title);
    const restores = [
      setMeta('name', 'description', description),
      setMeta('property', 'og:title', title),
      setMeta('property', 'og:description', description),
      setMeta('property', 'og:image', image),
      setMeta('property', 'og:type', 'website'),
    ];
    let script = null;
    if (structured) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = structured;
      document.head.appendChild(script);
    }
    return () => {
      document.title = previousTitle;
      restores.forEach((restore) => restore());
      script?.remove();
    };
  }, [title, description, image, structured]);
}
