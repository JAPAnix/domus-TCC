import { Outlet } from 'react-router-dom';
import { TabNav } from '../components/ui';

export default function Profile() {
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Perfil</h1>
      <TabNav label="Seções do perfil" tabs={[{ to: '/perfil/sobre', label: 'Sobre mim' }, { to: '/perfil/conexoes', label: 'Conexões' }]} />
      <Outlet />
    </main>
  );
}
