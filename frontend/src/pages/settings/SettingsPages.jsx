import LocaleOptions from '../../components/LocaleOptions';

export function SettingsHeading({ title, children }) {
  return (
    <>
      <h2 id="settings-page-title" className="text-xl font-semibold sm:text-2xl">{title}</h2>
      {children && <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">{children}</p>}
    </>
  );
}

export function SettingsBlock({ title, description, children, tone }) {
  return (
    <section className={`mt-8 border-t pt-8 ${tone === 'danger' ? 'border-danger-line' : 'border-line'}`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function LanguageSettings() {
  return (
    <>
      <SettingsHeading title="Idioma e tradução">Escolha como o Dommos aparece para você.</SettingsHeading>
      <div className="mt-6 max-w-md"><LocaleOptions /></div>
    </>
  );
}

