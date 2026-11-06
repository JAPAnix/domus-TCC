import { CATEGORY_FAMILIES } from '../utils/categoryColors';
import { listingStatus, orderStatus, paymentStatus } from '../utils/status';
import StatusBadge from '../components/StatusBadge';
import { Avatar, Button, Card, EmptyState, Skeleton } from '../components/ui';

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const SCALES = ['primary', 'secondary', 'accent'];
const GRADIENTS = [['bg-gradient-primary', 'primary', 'text-white'], ['bg-gradient-accent', 'accent', 'text-white'], ['bg-gradient-hero', 'hero', 'text-white'], ['bg-gradient-soft', 'soft', 'text-ink'], ['bg-gradient-warm', 'warm', 'text-ink'], ['bg-gradient-cool', 'cool', 'text-ink']];
const NAMES = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Alves', 'Elisa Rocha', 'Fábio Nunes', 'Gabi Torres', 'Hugo Prado'];

function Section({ title, children, note }) {
  return <section className="border-t border-line py-8"><h2 className="text-xl font-semibold">{title}</h2>{note && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{note}</p>}<div className="mt-5">{children}</div></section>;
}

/** Guia de estilo: só existe no ambiente de desenvolvimento (a rota nem é registrada em produção). */
export default function Styleguide() {
  return (
    <main className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold">Guia de estilo</h1>
      <p className="mt-2 text-ink-muted">Escalas, degradês, cores de categoria e componentes, para validar a identidade visual de uma vez só.</p>

      <Section title="Escalas de cor" note="Primária (ações), secundária (apoio) e destaque (chamar atenção sem competir com a primária). Texto branco só do 600 em diante.">
        {SCALES.map((scale) => (
          <div key={scale} className="mb-4">
            <p className="mb-1 text-sm font-semibold capitalize">{scale}</p>
            <ul className="grid grid-cols-5 gap-1 sm:grid-cols-10">
              {SHADES.map((shade) => <li key={shade}><span className="block h-14 rounded-control border border-line" style={{ backgroundColor: `var(--color-${scale}-${shade})` }} /><span className="mt-1 block text-center text-xs text-ink-muted">{shade}</span></li>)}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Degradês" note="Fortes só em pontos de atenção (topo, botão principal, etapa atual). Os suaves servem de fundo de seção.">
        <ul className="grid gap-3 sm:grid-cols-3">
          {GRADIENTS.map(([cls, name, text]) => <li key={name} className={`flex h-24 items-end rounded-card border border-line p-3 text-sm font-semibold ${cls} ${text}`}>{name}</li>)}
        </ul>
      </Section>

      <Section title="Cores das categorias" note="Cada categoria tem uma cor para chips, ícones e fundos suaves. O texto usa a versão ink, que passa de 4,5:1 sobre o soft.">
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(CATEGORY_FAMILIES).map(([name, style]) => <li key={name} className={`flex items-center gap-2 rounded-card px-4 py-3 text-sm font-semibold ${style.chip}`}><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />{name}</li>)}
        </ul>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Principal</Button><Button variant="accent">Destaque</Button><Button variant="soft">Suave</Button><Button variant="secondary">Secundário</Button><Button variant="ghost">Fantasma</Button><Button variant="danger">Perigo</Button><Button disabled>Desativado</Button><Button loading>Carregando</Button>
        </div>
      </Section>

      <Section title="Status e avisos" note="O status nunca depende só da cor: sempre há texto.">
        <div className="flex flex-wrap gap-2">
          {Object.keys(orderStatus).map((key) => <StatusBadge key={key} status={key} map={orderStatus} />)}
          {Object.keys(paymentStatus).map((key) => <StatusBadge key={`p-${key}`} status={key} map={paymentStatus} />)}
          {Object.keys(listingStatus).map((key) => <StatusBadge key={`l-${key}`} status={key} map={listingStatus} />)}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[['success', 'Tudo certo', 'bg-success-soft text-success-strong border-success-line'], ['warning', 'Atenção', 'bg-warning-soft text-warning-strong border-warning-line'], ['danger', 'Algo deu errado', 'bg-danger-soft text-danger-strong border-danger-line'], ['info', 'Para saber', 'bg-info-soft text-info-strong border-info-line']].map(([key, label, cls]) => <p key={key} className={`rounded-control border p-3 text-sm ${cls}`}><strong>{label}.</strong> Texto de apoio com a versão forte da cor semântica.</p>)}
        </div>
      </Section>

      <Section title="Avatares sem foto" note="Degradê escolhido pelo nome: o mesmo nome sempre tem a mesma cor.">
        <ul className="flex flex-wrap gap-3">{NAMES.map((name) => <li key={name} className="flex flex-col items-center gap-1 text-xs text-ink-muted"><Avatar name={name} size="lg" decorative />{name}</li>)}</ul>
      </Section>

      <Section title="Carregando, vazio e progresso">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="space-y-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></Card>
          <EmptyState title="Nada por aqui ainda" description="Os estados vazios usam um círculo com degradê suave." />
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Exemplo de progresso" aria-valuemin={0} aria-valuemax={10} aria-valuenow={6}><div className="h-full w-3/5 rounded-full bg-gradient-primary" /></div>
      </Section>
    </main>
  );
}
