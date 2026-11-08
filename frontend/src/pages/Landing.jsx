import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useCategories } from '../hooks/useCategories';
import { PRO_START_PATH } from '../utils/routes';
import { categoryStyle } from '../utils/categoryColors';
import { Button, Card, SkeletonList } from '../components/ui';

const clientSteps = [
  { title: 'Encontre ou peça', description: 'Busque profissionais por cidade e data, ou publique um pedido com o que você precisa.' },
  { title: 'Compare propostas', description: 'Veja preço, prazo e o perfil de quem respondeu antes de decidir.' },
  { title: 'Contrate e avalie', description: 'Aceite a melhor proposta e, ao final, avalie o trabalho.' },
];

const professionalSteps = [
  { title: 'Crie seu perfil', description: 'Informe seus serviços, região de atendimento, preços, datas e fotos dos seus trabalhos.' },
  { title: 'Encontre pedidos', description: 'Veja os pedidos abertos e envie suas propostas.' },
  { title: 'Construa sua reputação', description: 'Faça um bom trabalho e receba avaliações dos clientes.' },
];

function Steps({ steps }) {
  return (
    <ol className="grid gap-6 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title}>
          <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary font-bold text-white">{index + 1}</span>
          <h3 className="font-semibold">{step.title}</h3>
          <p className="mt-1 text-sm leading-6 text-ink-muted">{step.description}</p>
        </li>
      ))}
    </ol>
  );
}

function CategoryCard({ category }) {
  const style = categoryStyle(category);
  return (
    <Link to={`/buscar?categoria=${category.id}`} className={`flex h-full min-h-20 flex-col items-center justify-center gap-2 rounded-card border border-transparent p-3 text-center text-sm font-semibold shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${style.chip} ${style.hover}`}>
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
      {category.name}
    </Link>
  );
}

function CategoryGrid() {
  const { categories, failed } = useCategories();
  if (failed) return <p className="text-sm text-ink-muted">Não foi possível carregar as categorias agora. <Link to="/buscar" className="font-semibold text-primary-strong underline">Ver todos os profissionais</Link></p>;
  if (!categories.length) return <SkeletonList count={6} label="Carregando categorias" itemClassName="h-20" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" />;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => (
        <li key={category.id}>
          <CategoryCard category={category} />
        </li>
      ))}
    </ul>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const professionalPath = user ? PRO_START_PATH : '/cadastro?tipo=profissional';
  const isProfessional = user?.roles?.includes('professional');

  return (
    <div className="bg-canvas">
      <section className="bg-gradient-hero px-4 py-14 text-white sm:py-20">
        <div className="mx-auto max-w-content text-center">
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">O profissional certo para cada serviço do seu dia a dia</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white sm:text-lg">Encontre quem faz o que você precisa, compare propostas e contrate. Ou ofereça seus serviços e receba novos pedidos.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button to="/buscar" variant="inverse">Buscar profissionais</Button>
            <Button to="/servicos/novo" variant="secondary" className="border-white bg-transparent text-white hover:bg-primary-800">Publicar um pedido</Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="categorias" className="mx-auto max-w-page px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="categorias" className="mb-6 text-2xl font-bold">Explore por categoria</h2>
        <CategoryGrid />
      </section>

      <section aria-labelledby="como-contratar" className="border-y border-line bg-gradient-cool px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-page lg:px-2">
          <p className="text-sm font-semibold text-secondary">Vou contratar</p>
          <h2 id="como-contratar" className="mb-8 mt-1 text-2xl font-bold">Como contratar um profissional</h2>
          <Steps steps={clientSteps} />
        </div>
      </section>

      <section aria-labelledby="como-trabalhar" className="bg-gradient-warm px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-page lg:px-2">
          <p className="text-sm font-semibold text-secondary">Vou trabalhar</p>
          <h2 id="como-trabalhar" className="mb-8 mt-1 text-2xl font-bold">Como começar a oferecer seus serviços</h2>
          <Steps steps={professionalSteps} />
          <Card className="mt-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold">{isProfessional ? 'Veja o que há de novo' : 'Pronto para receber pedidos?'}</h3>
              <p className="mt-1 text-sm text-ink-muted">{isProfessional ? 'Confira os pedidos abertos e envie suas propostas.' : 'Anuncie seus serviços com a mesma conta.'}</p>
            </div>
            {isProfessional ? <Button to="/pro/oportunidades">Ver oportunidades</Button> : <Button to={professionalPath}>Oferecer meus serviços</Button>}
          </Card>
        </div>
      </section>

    </div>
  );
}
