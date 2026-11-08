import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useMode } from '../../context/useMode';
import { TabNav } from '../../components/ui';
import { useOrderBadges } from '../../hooks/useOrderBadges';
import { useFeatures } from '../../hooks/useFeatures';

const TABS = [
  { to: '/pro', label: 'Painel', end: true },
  { to: '/pro/pedidos', label: 'Pedidos e agenda', badgeKey: 'proNew' },
  { to: '/pro/oportunidades', label: 'Oportunidades', badgeKey: 'opportunities', feature: 'openRequests' },
  { to: '/pro/servicos', label: 'Meus serviços' },
  { to: '/pro/ganhos', label: 'Ganhos' },
  { to: '/pro/mensagens', label: 'Mensagens' },
];

/** Área do modo "Vou trabalhar". Entrar aqui marca o modo profissional (o cabeçalho continua o mesmo). */
export default function ProLayout() {
  const { setMode } = useMode();
  useEffect(() => { setMode('professional'); }, [setMode]);
  const badges = useOrderBadges(true);
  const features = useFeatures();
  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Área do profissional</h1>
      <p className="mb-6 mt-2 text-ink-muted">Seus pedidos, sua agenda e seus serviços em um só lugar.</p>
      <TabNav label="Seções da área do profissional" tabs={TABS.filter((tab) => !tab.feature || features[tab.feature]).map((tab) => ({ ...tab, badge: tab.badgeKey ? badges[tab.badgeKey] : 0 }))} />
      <Outlet />
    </main>
  );
}
