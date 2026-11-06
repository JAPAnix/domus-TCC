import { LEGAL_NOTICE, legalDocuments } from '../../content/legal';
import { Breadcrumb } from '../../components/ui';

export default function LegalPage({ document }) {
  const doc = legalDocuments[document];
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: doc.title }]} />
      <article className="max-w-3xl">
        <h1 className="text-2xl font-bold sm:text-3xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">Última atualização: {doc.updated}</p>
        <p role="note" className="mt-4 rounded-control border border-warning-line bg-warning-soft p-4 text-sm leading-6 text-warning">{LEGAL_NOTICE}</p>
        <div className="mt-8 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.h}>
              <h2 className="text-lg font-semibold">{section.h}</h2>
              <div className="mt-2 space-y-3">{section.p.map((text) => <p key={text} className="leading-7 text-ink-soft">{text}</p>)}</div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
