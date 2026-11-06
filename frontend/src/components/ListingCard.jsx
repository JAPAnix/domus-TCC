import { Link } from 'react-router-dom';
import { locationLabel, priceLabel } from '../utils/listingText';
import Avatar from './ui/Avatar';
import Photo from './ui/Photo';
import FavoriteButton from './FavoriteButton';
import { categoryStyle } from '../utils/categoryColors';

/** Cartão de anúncio com o coração de favoritos. `listing` é o formato dos resultados da busca. */
export default function ListingCard({ listing, saved, onSavedChange }) {
  const place = locationLabel(listing);
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <Link to={`/anuncios/${listing.uuid}`} className="flex flex-1 flex-col">
        <div className="aspect-[4/3] bg-primary-soft">
          {listing.cover
            ? <Photo src={listing.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center text-sm text-ink-muted">Sem foto</div>}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <p className="flex items-center gap-2 truncate text-xs text-ink-muted">{listing.category && <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${categoryStyle({ name: listing.category }).chip}`}>{listing.category}</span>}<span className="truncate">{place}</span></p>
          <h3 className="mt-1 line-clamp-2 font-semibold leading-snug group-hover:text-primary-strong">{listing.title}</h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
            <Avatar src={listing.owner.profilePictureUrl} name={listing.owner.name} size="xs" decorative />
            <span className="truncate">{listing.owner.name}</span>
            {listing.owner.verified && <span className="rounded-full bg-info-soft px-2 py-0.5 text-xs font-semibold text-info">Verificado</span>}
          </div>
          <p className="mt-auto pt-3 text-sm">
            <span className="font-semibold">{priceLabel(listing)}</span>
            <span className="float-right">
              {listing.owner.reviews
                ? <span className="rounded-full bg-warning-soft px-2 py-0.5 font-semibold text-rating"><span aria-hidden="true">★</span> {Number(listing.owner.rating).toFixed(1)} <span className="font-normal text-ink-muted">({listing.owner.reviews})</span></span>
                : <span className="text-ink-muted">Novo</span>}
            </span>
          </p>
        </div>
      </Link>
      <FavoriteButton type="listing" uuid={listing.uuid} name={listing.title} saved={saved} onChange={onSavedChange} className="absolute right-3 top-3" />
    </div>
  );
}
