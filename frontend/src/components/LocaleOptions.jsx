import { currencies, defaults, locales } from '../i18n/config';

function Group({ legend, options, selected }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <ul className="space-y-1">
        {Object.entries(options).map(([code, option]) => (
          <li key={code}>
            <label className="flex min-h-control items-center gap-3 rounded-control border border-line px-3 text-sm">
              <input type="radio" name={legend} checked={code === selected} readOnly />
              {option.label}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** Idioma e moeda atuais. Hoje cada um tem uma única opção; a lista cresce quando houver mais em i18n/config.js. */
export default function LocaleOptions() {
  return (
    <div className="space-y-6">
      <Group legend="Idioma" options={locales} selected={defaults.language} />
      <Group legend="Moeda" options={currencies} selected={defaults.currency} />
      <p className="text-sm leading-6 text-ink-muted">O Dommos funciona hoje em português do Brasil e com preços em reais. Quando houver outras opções, elas aparecerão aqui.</p>
    </div>
  );
}
