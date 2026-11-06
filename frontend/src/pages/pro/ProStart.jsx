import { Link } from 'react-router-dom';
import { useApiResource } from '../../hooks/useApiResource';
import { useCreateListing } from '../../hooks/useCreateListing';
import { Breadcrumb, Button, Card } from '../../components/ui';

const STEPS = [
  ['Serviço e atendimento', 'Escolha o que você faz, onde atende e a área de cobertura.'],
  ['Título, descrição e fotos', 'Mostre o seu trabalho com pelo menos 3 fotos.'],
  ['Incluso, preço e agenda', 'Defina o que está incluso, quanto cobra e quando atende.'],
  ['Verificação e publicação', 'Informe seu CPF ou CNPJ, revise como o cliente verá e publique.'],
];

/** Boas-vindas do passo a passo. Mostra os rascunhos para continuar de onde parou. */
export default function ProStart() {
  const { create, busy } = useCreateListing();
  const resource = useApiResource('/pro/listings');
  const drafts = (resource.data ?? []).filter((listing) => listing.status === 'draft');
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Oferecer serviços' }]} />
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Comece a oferecer seus serviços no Dommos</h1>
          <p className="mt-3 text-lg text-ink-muted">Em quatro blocos você monta um anúncio completo. Pode parar quando quiser: o rascunho fica salvo e você continua de onde parou.</p>
          <ol className="mt-8 space-y-5">
            {STEPS.map(([title, text], index) => (
              <li key={title} className="flex gap-4">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-strong">{index + 1}</span>
                <div><h2 className="font-semibold">{title}</h2><p className="mt-0.5 text-sm text-ink-muted">{text}</p></div>
              </li>
            ))}
          </ol>
          <Button className="mt-8" size="md" onClick={create} loading={busy}>Começar</Button>
          <p className="mt-3 text-sm text-ink-muted">Criar anúncios é grátis. A taxa da plataforma hoje é 0%.</p>
        </div>
        {drafts.length > 0 && (
          <Card as="aside" aria-labelledby="rascunhos">
            <h2 id="rascunhos" className="font-semibold">Continue de onde parou</h2>
            <ul className="mt-3 divide-y divide-line">
              {drafts.map((draft) => (
                <li key={draft.uuid}><Link to={`/pro/anuncio/${draft.uuid}/etapa/${draft.wizardStep}`} className="block py-3 hover:text-primary-strong"><span className="block font-medium">{draft.title || 'Anúncio sem título'}</span><span className="text-sm text-ink-muted">Etapa {draft.wizardStep} de 10</span></Link></li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </main>
  );
}
