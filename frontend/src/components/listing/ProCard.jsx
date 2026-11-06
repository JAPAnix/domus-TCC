import { Link } from 'react-router-dom';
import { formatDay } from '../../utils/format';
import { Avatar, Card } from '../ui';
import MessageButton from '../MessageButton';

const yearsSince = (value) => {
  if (!value) return null;
  const years = (Date.now() - new Date(value).getTime()) / (365.25 * 24 * 3600 * 1000);
  return years >= 1 ? `${Math.floor(years)} ${Math.floor(years) === 1 ? 'ano' : 'anos'}` : 'Menos de 1 ano';
};
const waiting = (minutes) => (minutes == null ? null : minutes < 60 ? `${Math.max(1, minutes)} min` : minutes < 1440 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} dias`);

/** Selo de destaque (calculado no servidor pelos critérios de utils/highlightRules.js). */
export function HighlightBadge({ owner }) {
  if (!owner.badge) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-gradient-to-r from-primary-softer to-surface p-4">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-2xl">🏅</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{owner.badge.label}</p>
        <p className="text-sm text-ink-muted">{owner.badge.text}</p>
      </div>
      <p className="text-right text-sm"><span className="text-xl font-bold"><span aria-hidden="true" className="text-rating">★</span> {Number(owner.rating).toFixed(1)}</span><span className="block text-xs text-ink-muted">{owner.reviews} avaliações</span></p>
    </div>
  );
}

/** Linha compacta: avatar, nome, verificado, tempo na plataforma e resposta. */
export function OwnerLine({ owner, preview }) {
  const years = yearsSince(owner.memberSince);
  const reply = waiting(owner.responseMinutes);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar src={owner.profilePictureUrl} name={owner.name} size="lg" decorative />
      <div className="min-w-0">
        <p className="text-lg font-semibold">Profissional: {preview ? owner.name : <Link to={`/usuarios/${owner.uuid}`} className="text-primary-strong underline-offset-2 hover:underline">{owner.name}</Link>}{owner.verified && <span className="ml-2 rounded-full bg-info-soft px-2.5 py-0.5 align-middle text-xs font-semibold text-info">Verificado</span>}</p>
        <p className="text-sm text-ink-muted">{[years && `${years} na plataforma`, reply && `responde em cerca de ${reply}`].filter(Boolean).join(' · ') || 'Novo na plataforma'}</p>
      </div>
    </div>
  );
}

/** "Conheça seu profissional". Taxa e tempo de resposta só aparecem com dados suficientes. */
export default function ProCard({ owner, listingUuid, isOwner, preview }) {
  const years = yearsSince(owner.memberSince);
  const facts = [
    owner.reviews > 0 && [`${owner.reviews}`, owner.reviews === 1 ? 'avaliação' : 'avaliações'],
    owner.reviews > 0 && [Number(owner.rating).toFixed(1), 'nota média'],
    years && [years, 'na plataforma'],
  ].filter(Boolean);
  const stats = [owner.responseRate != null && `Taxa de resposta: ${owner.responseRate}%`, owner.responseMinutes != null && `Tempo médio de resposta: ${waiting(owner.responseMinutes)}`, owner.memberSince && `Membro desde ${formatDay(owner.memberSince, { month: 'long', year: 'numeric' })}`].filter(Boolean);
  return (
    <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
      <Card className="text-center">
        <Avatar src={owner.profilePictureUrl} name={owner.name} size="xl" decorative />
        <p className="mt-3 text-xl font-bold">{owner.name}</p>
        {owner.verified && <p className="mt-1 inline-block rounded-full bg-info-soft px-3 py-0.5 text-xs font-semibold text-info">Verificado</p>}
        {owner.badge && <p className="mt-2 text-sm font-medium text-primary-strong">{owner.badge.label}</p>}
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
          {facts.map(([value, label]) => <div key={label}><dt className="text-xs text-ink-muted">{label}</dt><dd className="font-bold">{value}</dd></div>)}
        </dl>
      </Card>
      <div>
        {stats.length > 0 && <ul className="space-y-1 text-sm text-ink-soft">{stats.map((item) => <li key={item}>{item}</li>)}</ul>}
        {!preview && !isOwner && <div className="mt-4 max-w-xs"><MessageButton listingUuid={listingUuid}>Enviar mensagem ao profissional</MessageButton></div>}
        {!preview && <p className="mt-4 text-sm"><Link to={`/usuarios/${owner.uuid}`} className="font-medium text-primary-strong underline">Ver perfil completo</Link></p>}
        <p className="mt-6 flex gap-2 rounded-control bg-surface-muted p-3 text-xs leading-5 text-ink-muted"><span aria-hidden="true">🔒</span>Para se proteger, sempre use o Dommos para combinar o pagamento e conversar com o profissional. Nunca pague fora do pedido.</p>
      </div>
    </div>
  );
}
