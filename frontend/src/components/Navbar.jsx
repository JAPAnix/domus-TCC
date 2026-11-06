import { useState } from 'react';
import { Link, NavLink, useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useMode } from '../context/useMode';
import { useTheme } from '../hooks/useTheme';
import { useCategories } from '../hooks/useCategories';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { categoryStyle } from '../utils/categoryColors';
import { fullName } from '../utils/format';
import { PRO_HOME_PATH, PRO_START_PATH } from '../utils/routes';
import BrandLogo from './BrandLogo';
import SearchBar from './SearchBar';
import LocaleModal from './LocaleModal';
import { Avatar, Button, Dropdown, Modal } from './ui';

const icons = {
  compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5-4-2.5 5.5L8 16l2.5-5.5L16 8Z',
  panel: 'M4 5h7v6H4V5Zm9 0h7v3h-7V5ZM4 13h7v6H4v-6Zm9-3h7v9h-7v-9Z',
  heart: 'M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9c0 6.1-8 11-8 11Z',
  orders: 'M9 5h6M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1ZM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12h6M9 16h6',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.4A8 8 0 1 1 21 12Z',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4h4V5h-4ZM6 15v4h4v-4H6Z',
  globe: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  menu: 'M4 7h16M4 12h16M4 17h16',
  login: 'M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M14 16l4-4-4-4M18 12H8',
  search: 'm21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
  briefcase: 'M3 7h18v14H3V7ZM8 7V3h8v4M3 12a20 20 0 0 0 18 0M12 11v4',
};

function Icon({ path, className = 'h-5 w-5' }) {
  return <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

function unreadLabel(count) {
  return count > 99 ? '99+' : String(count);
}

/** Interruptor do modo escuro, no fim do menu. */
function ThemeSwitch() {
  const { dark, toggle } = useTheme();
  return (
    <button type="button" role="switch" aria-checked={dark} onClick={toggle} className="flex min-h-control w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface-muted">
      <Icon path="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      <span className="flex-1">Modo escuro</span>
      <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${dark ? 'bg-primary' : 'bg-line-strong'}`}>
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-transform ${dark ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

/** Conteúdo do menu da conta, o mesmo no dropdown (desktop) e na gaveta (mobile). */
function AccountMenu({ onNavigate, unread, unreadMessages, onOpenLocale }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const itemClass = (active) => `flex min-h-control items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors ${active ? 'bg-primary-soft font-semibold text-primary-strong' : 'text-ink-soft hover:bg-surface-muted'}`;
  const settingsActive = pathname.startsWith('/configuracoes');

  const item = ({ to, label, icon, active, badge }) => {
    const isActive = active ?? (pathname === to || pathname.startsWith(`${to}/`));
    return (
      <Link key={to} to={to} onClick={onNavigate} aria-current={isActive ? 'page' : undefined} className={itemClass(isActive)}>
        <Icon path={icons[icon]} />
        <span className="flex-1">{label}</span>
        {badge > 0 && <span className="rounded-full bg-primary px-2 text-xs font-semibold text-white" aria-label={`${badge} não lidas`}>{unreadLabel(badge)}</span>}
      </Link>
    );
  };

  if (!user) {
    return (
      <nav aria-label="Menu da conta" className="space-y-1">
        {item({ to: '/login', label: 'Entrar', icon: 'login' })}
        {item({ to: '/cadastro', label: 'Criar conta', icon: 'user' })}
        <div className="my-2 border-t border-line" />
        {item({ to: '/ajuda', label: 'Central de Ajuda', icon: 'help' })}
        <div className="my-2 border-t border-line" />
        <ThemeSwitch />
      </nav>
    );
  }

  return (
    <nav aria-label="Menu da conta" className="space-y-1">
      {!user.roles?.includes('professional') && (
        <Link to={PRO_START_PATH} onClick={onNavigate} className="mb-2 block rounded-control border border-primary-line bg-primary-softer p-3 transition-colors hover:bg-primary-soft">
          <span className="flex items-center gap-2 text-sm font-semibold text-primary-strong"><Icon path={icons.briefcase} />Torne-se um profissional</span>
          <span className="mt-1 block text-xs leading-5 text-ink-soft">Crie seu perfil e comece a receber pedidos de clientes.</span>
        </Link>
      )}
      {item({ to: '/favoritos', label: 'Favoritos', icon: 'heart' })}
      {item({ to: '/meus-servicos', label: 'Pedidos e contratações', icon: 'orders' })}
      {item({ to: '/mensagens', label: 'Mensagens', icon: 'chat', badge: unreadMessages })}
      {item({ to: '/perfil', label: 'Perfil', icon: 'user', active: pathname.startsWith('/perfil') })}
      {item({ to: '/notificacoes', label: 'Notificações', icon: 'bell', badge: unread })}
      <div className="my-2 border-t border-line" />
      {user.roles?.includes('admin') && item({ to: '/admin/pagamentos', label: 'Administração', icon: 'settings' })}
      {item({ to: '/configuracoes', label: 'Configurações da conta', icon: 'settings', active: settingsActive })}
      <button type="button" onClick={() => { onNavigate?.(); onOpenLocale(); }} className={`${itemClass(false)} w-full text-left`}>
        <Icon path={icons.globe} />Idioma e moeda
      </button>
      {item({ to: '/ajuda', label: 'Central de Ajuda', icon: 'help' })}
      <div className="my-2 border-t border-line" />
      <button type="button" onClick={() => { onNavigate?.(); navigate('/sair'); }} className={`${itemClass(false)} w-full text-left`}>
        <Icon path={icons.logout} />Sair da conta
      </button>
      <div className="my-2 border-t border-line" />
      <ThemeSwitch />
    </nav>
  );
}

/** Alterna entre os modos. O rótulo mostra para onde o botão leva, não o modo atual. */
function ModeButton() {
  const { user } = useAuth();
  const { mode, setMode } = useMode();
  const navigate = useNavigate();
  const working = mode === 'professional';

  function toggle() {
    if (working) {
      setMode('client');
      navigate('/');
    } else if (!user) {
      navigate('/cadastro?tipo=profissional');
    } else if (!user.roles?.includes('professional')) {
      navigate(PRO_START_PATH);
    } else {
      setMode('professional');
      navigate(PRO_HOME_PATH);
    }
  }

  return <Button variant="secondary" size="sm" onClick={toggle} className="shrink-0 whitespace-nowrap">{working ? 'Vou contratar' : 'Vou trabalhar'}</Button>;
}

function CategoryTabs() {
  const { categories } = useCategories();
  const onSearch = !!useMatch('/buscar');
  const [params] = useSearchParams();
  if (!categories.length) return null;

  const active = onSearch ? params.get('categoria') ?? '' : null;
  const hrefFor = (id) => {
    const next = new URLSearchParams(onSearch ? params : undefined);
    next.delete('pagina');
    if (id) next.set('categoria', String(id)); else next.delete('categoria');
    const query = next.toString();
    return query ? `/buscar?${query}` : '/buscar';
  };
  const tabClass = (isActive) => `inline-flex min-h-control items-center whitespace-nowrap border-b-2 px-1 text-sm transition-colors ${isActive ? 'border-primary font-semibold text-primary-strong' : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink'}`;

  return (
    <nav aria-label="Categorias de serviço" className="border-t border-line">
      <ul className="mx-auto flex max-w-page gap-5 overflow-x-auto px-4 sm:px-6 lg:px-8">
        <li><Link to={hrefFor(null)} aria-current={active === '' ? 'page' : undefined} className={tabClass(active === '')}>Todos</Link></li>
        {categories.map((category) => {
          const isActive = active === String(category.id);
          const style = categoryStyle(category);
          return <li key={category.id}><Link to={hrefFor(category.id)} aria-current={isActive ? 'page' : undefined} className={tabClass(isActive).replace('border-primary', style.bar)}><span aria-hidden="true" className={`mr-1.5 h-2 w-2 rounded-full ${style.dot}`} />{category.name}</Link></li>;
        })}
      </ul>
    </nav>
  );
}

function BottomNav({ onOpenMenu, menuOpen, unread, unreadMessages }) {
  const { user } = useAuth();
  const { mode } = useMode();
  const links = !user
    ? [{ to: '/', label: 'Explorar', icon: 'compass', end: true }, { to: '/ajuda', label: 'Ajuda', icon: 'help' }, { to: '/login', label: 'Entrar', icon: 'login' }]
    : mode === 'professional'
      ? [
        { to: PRO_HOME_PATH, label: 'Painel', icon: 'panel', end: true },
        { to: '/pro/pedidos', label: 'Pedidos', icon: 'orders' },
        { to: '/pro/servicos', label: 'Serviços', icon: 'briefcase' },
        { to: '/pro/ganhos', label: 'Ganhos', icon: 'heart' },
      ]
      : [
        { to: '/', label: 'Explorar', icon: 'compass', end: true },
        { to: '/favoritos', label: 'Favoritos', icon: 'heart' },
        { to: '/meus-servicos', label: 'Pedidos', icon: 'orders' },
        { to: '/mensagens', label: 'Mensagens', icon: 'chat' },
      ];
  const itemClass = (active) => `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${active ? 'font-semibold text-primary-strong' : 'text-ink-muted'}`;
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--spacing-bottom-nav)] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {links.map(({ to, label, icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `${itemClass(isActive)} relative`}>
          <Icon path={icons[icon]} /><span className="truncate">{label}</span>
          {to === '/mensagens' && unreadMessages > 0 && <span role="status" aria-label={`${unreadMessages} mensagens não lidas`} className="absolute right-[calc(50%-1.25rem)] top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-white">{unreadLabel(unreadMessages)}</span>}
        </NavLink>
      ))}
      <button type="button" onClick={onOpenMenu} aria-label="Abrir menu" aria-expanded={menuOpen} className={`${itemClass(menuOpen)} relative`}>
        <Icon path={icons.menu} /><span>Menu</span>
        {(unread > 0 || (mode === 'professional' && unreadMessages > 0)) && <span aria-hidden="true" className="absolute right-[calc(50%-1rem)] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />}
      </button>
    </nav>
  );
}

export default function Navbar({ simplified = false }) {
  const { user } = useAuth();
  const { mode } = useMode();
  const { search, pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localeOpen, setLocaleOpen] = useState(false);
  const unread = useUnreadNotifications(!!user);
  const unreadMessages = useUnreadMessages(!!user);
  const homePath = mode === 'professional' ? PRO_HOME_PATH : user ? '/buscar' : '/';
  // A busca e as categorias só aparecem onde se procura serviço: a busca de profissionais e serviços e os pedidos abertos.
  const showSearch = ['/buscar', '/servicos'].includes(pathname);
  // A página inicial do visitante é limpa: só a marca e as opções de entrar e criar conta.
  const landing = !user && pathname === '/';
  // Entrar, cadastro e recuperação de senha não mostram "Vou trabalhar" nem o menu da conta.
  const authPage = ['/login', '/cadastro', '/forgot-password', '/reset-password', '/sair'].includes(pathname);
  const searchKey = pathname === '/buscar' ? search : '';

  if (simplified) return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto max-w-page px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/configuracoes/pessoais" aria-label="Voltar às informações pessoais" className="inline-flex rounded-control"><BrandLogo /></Link>
      </div>
    </header>
  );

  return (
    <>
      <header className="z-40 border-b border-line bg-surface md:sticky md:top-0">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
          <Link to={homePath} aria-label="Dommos, página inicial" className="shrink-0 rounded-control"><BrandLogo /></Link>

          {showSearch && (
            <div className="order-last hidden w-full min-w-0 md:block lg:order-none lg:mx-auto lg:w-auto lg:max-w-2xl lg:flex-1">
              <SearchBar key={searchKey} />
            </div>
          )}

          <div className={`ml-auto flex shrink-0 items-center gap-2 ${authPage ? 'hidden' : ''}`}>
            {landing && <div className="flex items-center gap-2"><Button to="/login" variant="ghost">Entrar</Button><Button to="/cadastro">Criar conta</Button></div>}
            {!landing && <ModeButton />}
            <div className={landing ? 'hidden' : 'hidden md:block'}>
              <Dropdown trigger={({ open, toggle }) => (
                <button type="button" onClick={toggle} aria-label="Abrir menu" aria-expanded={open} className="relative flex min-h-control items-center gap-2 rounded-full border border-line-strong bg-surface py-1 pl-3 pr-1.5 transition-shadow hover:shadow-card">
                  <Icon path={icons.menu} className="h-4 w-4 text-ink-soft" />
                  {user ? <Avatar src={user.profilePictureUrl} name={fullName(user)} size="sm" decorative /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-ink-soft"><Icon path={icons.user} className="h-4 w-4" /></span>}
                  {unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-xs font-semibold text-white" aria-label={`${unread} notificações não lidas`}>{unreadLabel(unread)}</span>}
                </button>
              )}>
                {({ close }) => <AccountMenu onNavigate={close} unread={unread} unreadMessages={unreadMessages} onOpenLocale={() => setLocaleOpen(true)} />}
              </Dropdown>
            </div>
          </div>

          {showSearch && (
            <button type="button" onClick={() => setSearchOpen(true)} className="flex min-h-control w-full items-center gap-3 rounded-full border border-line-strong bg-surface px-4 text-left text-sm text-ink-muted md:hidden">
              <Icon path={icons.search} className="h-4 w-4 text-primary" />
              Onde, quando e que tipo de serviço?
            </button>
          )}
        </div>
        {showSearch && <CategoryTabs />}
      </header>

      <BottomNav onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} unread={unread} unreadMessages={unreadMessages} />

      <Modal open={menuOpen} title={user ? fullName(user) || 'Sua conta' : 'Menu'} onClose={() => setMenuOpen(false)} placement="drawer" closeLabel="Fechar menu">
        <AccountMenu onNavigate={() => setMenuOpen(false)} unread={unread} unreadMessages={unreadMessages} onOpenLocale={() => setLocaleOpen(true)} />
      </Modal>

      <Modal open={searchOpen} title="Buscar profissionais" onClose={() => setSearchOpen(false)} placement="full" closeLabel="Fechar busca">
        <SearchBar key={searchKey} onSearched={() => setSearchOpen(false)} />
      </Modal>

      <LocaleModal open={localeOpen} onClose={() => setLocaleOpen(false)} />
    </>
  );
}
