import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

const links = [
  ['Central de Ajuda', '/ajuda'],
  ['Termos de uso', '/termos-de-uso'],
  ['Política de privacidade', '/politica-de-privacidade'],
  ['Política de cancelamento', '/politica-de-cancelamento'],
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-gradient-soft">
      <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <BrandLogo />
          <p className="mt-2 text-sm text-ink-muted">© 2026 Dommos. Serviços de confiança, perto de você.</p>
        </div>
        <nav aria-label="Ajuda e documentos legais">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map(([label, to]) => <li key={to}><Link to={to} className="text-sm font-medium text-ink-soft underline-offset-2 hover:text-primary-strong hover:underline">{label}</Link></li>)}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
