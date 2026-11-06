import { useEffect, useRef, useState } from 'react';

// Mapa gratuito (OpenStreetMap + Leaflet). Mostra só o centro da cidade e a região de atendimento, nunca um endereço exato.
const zoomFor = (radiusKm) => (radiusKm > 60 ? 8 : radiusKm > 30 ? 9 : radiusKm > 15 ? 10 : radiusKm > 6 ? 11 : 12);

async function geocode(city, state) {
  const cacheKey = `dommos:geo:${city}|${state}`;
  try { const cached = sessionStorage.getItem(cacheKey); if (cached) return JSON.parse(cached); } catch { /* sem armazenamento */ }
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'br', city, ...(state && { state }) });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('geocode');
  const [first] = await response.json();
  if (!first) throw new Error('geocode-empty');
  const place = { lat: Number(first.lat), lon: Number(first.lon) };
  try { sessionStorage.setItem(cacheKey, JSON.stringify(place)); } catch { /* sem armazenamento */ }
  return place;
}

export default function ListingMap({ city, state, radiusKm, label }) {
  const element = useRef(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!city || !element.current) return undefined;
    let cancelled = false;
    let map = null;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setStatus('loading');
      try {
        const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
        const place = await geocode(city, state);
        if (cancelled || !element.current) return;
        const color = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'currentColor';
        map = L.map(element.current, { scrollWheelZoom: false, attributionControl: true }).setView([place.lat, place.lon], zoomFor(radiusKm ?? 5));
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
        L.circle([place.lat, place.lon], { radius: (radiusKm ?? 5) * 1000, color, fillColor: color, fillOpacity: 0.15, weight: 2 }).addTo(map);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }, { rootMargin: '300px' });
    observer.observe(element.current);
    return () => { cancelled = true; observer.disconnect(); map?.remove(); };
  }, [city, state, radiusKm]);

  return (
    <div>
      <div className="relative">
        <div ref={element} role="region" aria-label={`Mapa da região de atendimento: ${label}`} className="h-72 w-full overflow-hidden rounded-card bg-primary-softer" />
        {status !== 'ready' && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-muted" role="status">
            {status === 'error' ? 'Não foi possível carregar o mapa agora. A região de atendimento está descrita acima.' : 'Carregando o mapa...'}
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-muted">O mapa mostra a região aproximada. O endereço exato do profissional não é divulgado.</p>
    </div>
  );
}
