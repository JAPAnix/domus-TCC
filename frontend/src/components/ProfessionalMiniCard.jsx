import { Link } from 'react-router-dom';
import { priceLabel } from '../utils/listingText';
import Avatar from './ui/Avatar';
import FavoriteButton from './FavoriteButton';

/** Cartão de favoritos e de "vistos recentemente". Serve para profissionais e para anúncios. */
export default function ProfessionalMiniCard({ item, saved, onSavedChange }) {
  const isListing = item.type === 'listing';
  return (
    <div className="group relative overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors hover:border-primary">
      <Link to={isListing ? `/anuncios/${item.uuid}` : `/usuarios/${item.uuid}`} className="block">
        <div className="relative aspect-[4/3] bg-primary-soft">
          {item.photo
            ? <img src={item.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center"><Avatar name={item.name} size="xl" decorative /></div>}
        </div>
        <div className="p-4">
          <p className="text-xs font-medium text-ink-muted">{isListing ? 'Serviço' : 'Profissional'}</p>
          <h3 className="truncate font-semibold group-hover:text-primary-strong">{item.name}</h3>
          {item.headline && <p className="mt-0.5 truncate text-sm text-ink-muted">{item.headline}</p>}
          <p className="mt-2 text-sm">
            {isListing && <span className="mr-2 font-semibold">{priceLabel(item)}</span>}
            {item.reviews ? <><span aria-hidden="true" className="text-rating">★</span> {Number(item.rating).toFixed(1)} <span className="text-ink-muted">({item.reviews})</span></> : <span className="text-ink-muted">Novo</span>}
            {item.location && <span className="text-ink-muted"> · {item.location}</span>}
          </p>
        </div>
      </Link>
      <FavoriteButton type={item.type} uuid={item.uuid} name={item.name} saved={saved} onChange={onSavedChange} className="absolute right-3 top-3" />
    </div>
  );
}
