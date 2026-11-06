import { useState } from 'react';
import ImageUploader from '../../../components/ImageUploader';
import ListingView from '../../../components/ListingView';
import TagInput from '../../../components/TagInput';
import { Button, Input, Select, Textarea, controlClass } from '../../../components/ui';
import { useApiResource } from '../../../hooks/useApiResource';
import { useCategories } from '../../../hooks/useCategories';
import { formatMoney } from '../../../utils/format';
import { CANCELLATION_POLICIES, LISTING_LIMITS, PRICING_MODELS, SERVICE_MODES, netAmount, validateAll } from '../../../utils/listingRules';
import { MODE_HELP, MODE_LABELS, POLICY_INFO, PRICING_HELP, PRICING_LABELS, WEEKDAY_NAMES, WEEKDAY_ORDER } from '../../../utils/listingText';
import { STATES } from '../../../utils/roles';
import { formatCnpj, formatCpf } from '../../settings/identityValidation';
import { DEFAULT_HOURS, STEPS, previewListing, ruleData } from './formModel';

const optionCard = (active) => `flex cursor-pointer items-start gap-3 rounded-card border p-4 transition-colors ${active ? 'border-primary bg-primary-softer' : 'border-line hover:bg-surface-muted'}`;

function Tips({ title = 'Dicas', children }) {
  return (
    <details className="mt-4 rounded-control border border-line bg-surface-muted p-4 text-sm">
      <summary className="font-medium">{title}</summary>
      <div className="mt-2 space-y-2 leading-6 text-ink-soft">{children}</div>
    </details>
  );
}

// ---- 1. Categoria e tipo de serviço (com busca) ----
export function StepCategory({ form, set, errors }) {
  const { categories } = useCategories();
  const catalog = useApiResource('/service-catalog');
  const [query, setQuery] = useState('');
  const items = catalog.data ?? [];
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const visible = items.filter((item) => (!form.categoryId || item.category.id === form.categoryId) && (!normalized || `${item.name} ${item.category.name}`.toLocaleLowerCase('pt-BR').includes(normalized)));
  return (
    <div className="space-y-5">
      <Select label="Categoria" value={form.categoryId ?? ''} onChange={(event) => { set('categoryId', event.target.value ? Number(event.target.value) : null); set('catalogItemId', null); }} error={errors.categoryId} required>
        <option value="">Escolha uma categoria</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </Select>
      <div>
        <Input label="Buscar o tipo de serviço" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: chuveiro, diarista, fotógrafo" hint={form.categoryId ? 'Mostrando só a categoria escolhida.' : 'Escolha uma categoria para filtrar, ou busque direto.'} />
        {catalog.loading ? <p role="status" className="mt-3 text-sm text-ink-muted">Carregando serviços...</p> : (
          <fieldset className="mt-3">
            <legend className="sr-only">Tipo de serviço</legend>
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-control border border-line p-2">
              {visible.slice(0, 80).map((item) => (
                <li key={item.id}>
                  <label className={`flex min-h-control cursor-pointer items-center gap-3 rounded-control px-3 text-sm ${form.catalogItemId === item.id ? 'bg-primary-soft font-semibold text-primary-strong' : 'hover:bg-surface-muted'}`}>
                    <input type="radio" name="catalogItem" checked={form.catalogItemId === item.id} onChange={() => { set('catalogItemId', item.id); set('categoryId', item.category.id); }} />
                    <span>{item.name}<span className="block text-xs font-normal text-ink-muted">{item.category.name}</span></span>
                  </label>
                </li>
              ))}
              {!visible.length && <li className="p-3 text-sm text-ink-muted">Nenhum serviço encontrado. Tente outra palavra.</li>}
            </ul>
          </fieldset>
        )}
        {errors.catalogItemId && <p role="alert" className="mt-2 text-sm text-danger">{errors.catalogItemId}</p>}
      </div>
    </div>
  );
}

// ---- 2. Como atende ----
export function StepModes({ form, set, errors }) {
  const toggle = (mode) => set('serviceModes', form.serviceModes.includes(mode) ? form.serviceModes.filter((item) => item !== mode) : [...form.serviceModes, mode]);
  return (
    <fieldset>
      <legend className="sr-only">Formas de atendimento</legend>
      <div className="space-y-3">
        {SERVICE_MODES.map((mode) => (
          <label key={mode} className={optionCard(form.serviceModes.includes(mode))}>
            <input type="checkbox" className="mt-1 h-5 w-5" checked={form.serviceModes.includes(mode)} onChange={() => toggle(mode)} />
            <span><span className="block font-medium">{MODE_LABELS[mode]}</span><span className="block text-sm text-ink-muted">{MODE_HELP[mode]}</span></span>
          </label>
        ))}
      </div>
      {errors.serviceModes && <p role="alert" className="mt-3 text-sm text-danger">{errors.serviceModes}</p>}
    </fieldset>
  );
}

// ---- 3. Localização e raio ----
export function StepLocation({ form, set, errors }) {
  const physical = form.serviceModes.includes('client_place') || form.serviceModes.includes('pro_place');
  if (!physical) return <p className="rounded-card border border-line bg-surface-muted p-5 text-sm leading-6 text-ink-soft">Você atende só online, então não precisa informar um local. Seu anúncio aparece nas buscas de qualquer cidade.</p>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Input wrapperClassName="col-span-2" label="Cidade" required value={form.city} onChange={(event) => set('city', event.target.value)} error={errors.city} maxLength={100} autoComplete="address-level2" />
        <Select label="UF" required value={form.state} onChange={(event) => set('state', event.target.value)} error={errors.state}><option value="">—</option>{STATES.map((uf) => <option key={uf}>{uf}</option>)}</Select>
      </div>
      {form.serviceModes.includes('client_place') && (
        <Input label="Raio de atendimento (km)" type="number" min="1" max={LISTING_LIMITS.radiusMax} step="1" inputMode="numeric" required value={form.radiusKm} onChange={(event) => set('radiusKm', event.target.value)} error={errors.radiusKm} hint="Até onde você vai a partir da cidade informada." />
      )}
      <p className="text-sm text-ink-muted">Os clientes veem a cidade e o raio, nunca o seu endereço.</p>
    </div>
  );
}

// ---- 4. Título e descrição ----
export function StepText({ form, set, errors }) {
  const [titleMin, titleMax] = LISTING_LIMITS.title;
  const [descMin, descMax] = LISTING_LIMITS.description;
  return (
    <div className="space-y-5">
      <Input label="Título" required value={form.title} onChange={(event) => set('title', event.target.value)} error={errors.title} maxLength={titleMax} hint={`${form.title.trim().length}/${titleMax} caracteres (mínimo de ${titleMin}).`} placeholder="Ex.: Instalação de chuveiro elétrico com garantia" />
      <Textarea label="Descrição" required rows={8} value={form.description} onChange={(event) => set('description', event.target.value)} error={errors.description} maxLength={descMax} hint={`${form.description.trim().length}/${descMax} caracteres (mínimo de ${descMin}).`} />
      <Tips title="Dicas e exemplos de bom texto">
        <p><strong>Título:</strong> diga o serviço e o diferencial. “Instalação de chuveiro elétrico com garantia de 90 dias” funciona melhor que “Serviços elétricos”.</p>
        <p><strong>Descrição:</strong> conte como é o seu trabalho, há quanto tempo você atua, o que o cliente precisa deixar pronto e como é o seu atendimento.</p>
        <p><strong>Exemplo:</strong> “Sou eletricista há 12 anos e instalo chuveiros, torneiras elétricas e ventiladores de teto. Levo as ferramentas, deixo o local limpo e dou 90 dias de garantia na instalação.”</p>
      </Tips>
    </div>
  );
}

// ---- 5. Fotos ----
export function StepPhotos({ form, set, errors, onBusy }) {
  return (
    <div>
      <ImageUploader purpose="service" label="Fotos do serviço" max={LISTING_LIMITS.images[1]} value={form.images} onChange={(urls) => set('images', urls)} showCover reorderable onBusyChange={onBusy} hint="JPG, PNG ou WebP, com até 5 MB. Arraste as fotos para reordenar, ou use as setas." />
      <p className={`mt-3 text-sm ${errors.images ? 'text-danger' : 'text-ink-muted'}`} role={errors.images ? 'alert' : undefined}>{errors.images ?? `${form.images.length} de ${LISTING_LIMITS.images[1]} fotos. Mínimo de ${LISTING_LIMITS.images[0]}.`}</p>
      <Tips title="Dicas para boas fotos"><p>Use luz natural, mostre trabalhos reais e escolha como capa a foto que melhor representa o serviço. Evite fotos de terceiros.</p></Tips>
    </div>
  );
}

// ---- 6. O que está incluso ----
export function StepIncluded({ form, set, errors }) {
  return (
    <div className="space-y-6">
      <div>
        <TagInput label="O que está incluso" value={form.included} onChange={(value) => set('included', value)} max={LISTING_LIMITS.included[1]} maxLength={LISTING_LIMITS.itemMax} placeholder="Ex.: Mão de obra" hint="Digite um item e pressione Enter." error={errors.included} />
      </div>
      <TagInput label="O que NÃO está incluso" value={form.excluded} onChange={(value) => set('excluded', value)} max={LISTING_LIMITS.excluded[1]} maxLength={LISTING_LIMITS.itemMax} placeholder="Ex.: Material de instalação" hint="Opcional. Evita mal-entendidos." error={errors.excluded} />
      <Textarea label="Requisitos" optional rows={3} value={form.requirements} onChange={(event) => set('requirements', event.target.value)} error={errors.requirements} maxLength={LISTING_LIMITS.textMax} hint="O que o cliente precisa providenciar. Ex.: acesso ao quadro de luz." />
      <Textarea label="Materiais" optional rows={3} value={form.materials} onChange={(event) => set('materials', event.target.value)} error={errors.materials} maxLength={LISTING_LIMITS.textMax} hint="Quem leva o quê. Ex.: levo ferramentas; o cliente compra o chuveiro." />
    </div>
  );
}

// ---- 7. Preço ----
export function StepPrice({ form, set, errors, feePercent }) {
  const priced = form.pricingModel && form.pricingModel !== 'quote';
  const setPackage = (index, field, value) => set('packages', form.packages.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  const net = netAmount(form.price, feePercent);
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="sr-only">Modelo de preço</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRICING_MODELS.map((model) => (
            <label key={model} className={optionCard(form.pricingModel === model)}>
              <input type="radio" name="pricing" className="mt-1" checked={form.pricingModel === model} onChange={() => set('pricingModel', model)} />
              <span><span className="block font-medium">{PRICING_LABELS[model]}</span><span className="block text-sm text-ink-muted">{PRICING_HELP[model]}</span></span>
            </label>
          ))}
        </div>
        {errors.pricingModel && <p role="alert" className="mt-2 text-sm text-danger">{errors.pricingModel}</p>}
      </fieldset>

      {priced && (
        <>
          <Input label={`Valor${form.pricingModel === 'hourly' ? ' por hora' : form.pricingModel === 'daily' ? ' por diária' : ''} (R$)`} type="number" min="0.01" step="0.01" inputMode="decimal" required value={form.price} onChange={(event) => set('price', event.target.value)} error={errors.price} />
          {net != null && form.price !== '' && (
            <dl className="rounded-control border border-line bg-surface-muted p-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink-soft">Valor para o cliente</dt><dd>{formatMoney(Number(form.price))}</dd></div>
              <div className="mt-1 flex justify-between"><dt className="text-ink-soft">Taxa da plataforma ({feePercent}%)</dt><dd>− {formatMoney(Number(form.price) - net)}</dd></div>
              <div className="mt-2 flex justify-between border-t border-line pt-2 font-semibold"><dt>Você recebe</dt><dd>{formatMoney(net)}</dd></div>
            </dl>
          )}
          {form.serviceModes.includes('client_place') && <Input label="Taxa de deslocamento (R$)" optional type="number" min="0" step="0.01" inputMode="decimal" value={form.travelFee} onChange={(event) => set('travelFee', event.target.value)} error={errors.travelFee} hint="Somada ao valor quando você vai até a casa do cliente." />}

          <section aria-labelledby="pacotes">
            <h3 id="pacotes" className="font-semibold">Pacotes <span className="font-normal text-ink-muted">(opcional, até {LISTING_LIMITS.packagesMax})</span></h3>
            <p className="text-sm text-ink-muted">Ofereça versões do serviço, como Básico e Completo.</p>
            <ul className="mt-3 space-y-3">
              {form.packages.map((item, index) => (
                <li key={index} className="space-y-3 rounded-card border border-line p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input label="Nome do pacote" value={item.name} maxLength={40} onChange={(event) => setPackage(index, 'name', event.target.value)} />
                    <Input label="Valor (R$)" type="number" min="0.01" step="0.01" inputMode="decimal" value={item.price} onChange={(event) => setPackage(index, 'price', event.target.value)} />
                  </div>
                  <Input label="Descrição" optional value={item.description} maxLength={200} onChange={(event) => setPackage(index, 'description', event.target.value)} />
                  <Button variant="dangerOutline" size="sm" onClick={() => set('packages', form.packages.filter((_, i) => i !== index))}>Remover pacote</Button>
                </li>
              ))}
            </ul>
            {errors.packages && <p role="alert" className="mt-2 text-sm text-danger">{errors.packages}</p>}
            {form.packages.length < LISTING_LIMITS.packagesMax && <Button className="mt-3" variant="secondary" size="sm" onClick={() => set('packages', [...form.packages, { name: form.packages.length ? 'Completo' : 'Básico', price: '', description: '' }])}>Adicionar pacote</Button>}
          </section>
        </>
      )}
      {form.pricingModel === 'quote' && <p className="rounded-card border border-line bg-surface-muted p-4 text-sm leading-6 text-ink-soft">Seu anúncio mostrará “Sob consulta”. O cliente pede o serviço e vocês combinam o valor; você informa o valor final ao concluir.</p>}
    </div>
  );
}

// ---- 8. Disponibilidade ----
export function StepAvailability({ form, set, errors }) {
  const { weekdays } = form.availability;
  const setAvailability = (changes) => set('availability', { ...form.availability, ...changes });
  const toggleDay = (day) => setAvailability({ weekdays: weekdays.some((entry) => entry.day === day) ? weekdays.filter((entry) => entry.day !== day) : [...weekdays, { day, ...DEFAULT_HOURS }] });
  const setHours = (day, field, value) => setAvailability({ weekdays: weekdays.map((entry) => (entry.day === day ? { ...entry, [field]: value } : entry)) });
  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 font-semibold">Dias e horários de atendimento</legend>
        <ul className="space-y-2">
          {WEEKDAY_ORDER.map((day) => {
            const entry = weekdays.find((item) => item.day === day);
            return (
              <li key={day} className="flex flex-wrap items-center gap-3 rounded-control border border-line p-3">
                <label className="flex min-h-control w-44 cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-5 w-5" checked={!!entry} onChange={() => toggleDay(day)} />{WEEKDAY_NAMES[day]}</label>
                {entry && (
                  <span className="flex items-center gap-2 text-sm">
                    <label className="sr-only" htmlFor={`from-${day}`}>Início, {WEEKDAY_NAMES[day]}</label><input id={`from-${day}`} type="time" value={entry.from} onChange={(event) => setHours(day, 'from', event.target.value)} className={`${controlClass()} !w-32`} />
                    <span aria-hidden="true">até</span>
                    <label className="sr-only" htmlFor={`to-${day}`}>Fim, {WEEKDAY_NAMES[day]}</label><input id={`to-${day}`} type="time" value={entry.to} onChange={(event) => setHours(day, 'to', event.target.value)} className={`${controlClass()} !w-32`} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {errors.availability && <p role="alert" className="mt-2 text-sm text-danger">{errors.availability}</p>}
        <Button className="mt-3" variant="secondary" size="sm" onClick={() => setAvailability({ weekdays: [1, 2, 3, 4, 5].map((day) => ({ day, ...DEFAULT_HOURS })) })}>Segunda a sexta, 8h às 18h</Button>
      </fieldset>

      <Input label="Antecedência mínima (horas)" type="number" min="0" max={LISTING_LIMITS.leadTimeMax} step="1" inputMode="numeric" required value={form.availability.leadTimeHours} onChange={(event) => setAvailability({ leadTimeHours: event.target.value })} error={errors.leadTimeHours} hint="Quanto tempo antes o cliente precisa pedir. 24 horas, por exemplo, impede pedidos para o mesmo dia." />

      <fieldset>
        <legend className="mb-3 font-semibold">Política de cancelamento</legend>
        <div className="space-y-3">
          {CANCELLATION_POLICIES.map((policy) => (
            <label key={policy} className={optionCard(form.cancellationPolicy === policy)}>
              <input type="radio" name="policy" className="mt-1" checked={form.cancellationPolicy === policy} onChange={() => set('cancellationPolicy', policy)} />
              <span><span className="block font-medium">{POLICY_INFO[policy].label}</span><span className="block text-sm text-ink-muted">{POLICY_INFO[policy].text}</span></span>
            </label>
          ))}
        </div>
        {errors.cancellationPolicy && <p role="alert" className="mt-2 text-sm text-danger">{errors.cancellationPolicy}</p>}
        <p className="mt-3 text-sm text-ink-muted">Como o pagamento é combinado direto com o cliente, a política orienta as partes; compensações são acertadas entre vocês.</p>
      </fieldset>
    </div>
  );
}

// ---- 9. Verificação ----
export function StepVerification({ form, set, errors }) {
  const format = form.documentType === 'cpf' ? formatCpf : formatCnpj;
  return (
    <div className="space-y-5">
      <Input label={form.documentType === 'cpf' ? 'Nome completo' : 'Razão social'} required value={form.legalName} onChange={(event) => set('legalName', event.target.value)} error={errors.legalName} maxLength={150} autoComplete="name" />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Documento</legend>
        <div className="flex gap-4">{[['cpf', 'CPF'], ['cnpj', 'CNPJ']].map(([value, label]) => <label key={value} className="flex min-h-control cursor-pointer items-center gap-2 text-sm"><input type="radio" name="documentType" checked={form.documentType === value} onChange={() => { set('documentType', value); set('document', ''); }} />{label}</label>)}</div>
      </fieldset>
      <Input label={form.documentType === 'cpf' ? 'CPF' : 'CNPJ'} name="document" inputMode="numeric" autoComplete="off" required={!form.documentSaved} value={form.document} onChange={(event) => set('document', format(event.target.value))} error={errors.document} placeholder={form.documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'} hint={form.documentSaved && !form.document ? 'Já temos um documento seu, guardado com segurança. Preencha só se quiser trocar.' : undefined} />
      <div role="note" className="rounded-control border border-info-line bg-info-soft p-4 text-sm leading-6 text-info">O selo “Verificado” aparece depois de uma análise manual dos seus dados. Você pode publicar o anúncio antes disso. O documento nunca aparece no seu perfil público. Por enquanto, não pedimos foto de documento.</div>
    </div>
  );
}

// ---- 10. Revisão ----
export function StepReview({ form, user, goToStep, serverErrors }) {
  const { categories } = useCategories();
  const catalog = useApiResource('/service-catalog');
  const problems = validateAll(ruleData(form));
  const shown = problems.length ? problems : serverErrors ?? [];
  return (
    <div className="space-y-8">
      {shown.length > 0 ? (
        <section role="alert" aria-labelledby="faltam" className="rounded-card border border-warning-line bg-warning-soft p-5">
          <h2 id="faltam" className="font-semibold text-warning">Falta completar para publicar</h2>
          <ul className="mt-3 space-y-2 text-sm">{shown.map((problem) => <li key={`${problem.step}-${problem.field}`}><button type="button" onClick={() => goToStep(problem.step)} className="text-left underline underline-offset-2"><strong>Etapa {problem.step} ({STEPS[problem.step - 1].short}):</strong> {problem.message}</button></li>)}</ul>
        </section>
      ) : <p role="status" className="rounded-card border border-success-line bg-success-soft p-4 text-sm font-medium text-success">Tudo certo. Confira a prévia abaixo e publique.</p>}

      <section aria-labelledby="etapas">
        <h2 id="etapas" className="mb-2 font-semibold">Editar uma etapa</h2>
        <ul className="flex flex-wrap gap-2">{STEPS.slice(0, 9).map((step) => <li key={step.n}><Button variant="secondary" size="sm" onClick={() => goToStep(step.n)}>{step.n}. {step.short}</Button></li>)}</ul>
      </section>

      <section aria-labelledby="previa">
        <h2 id="previa" className="mb-3 font-semibold">Prévia: assim o cliente vai ver</h2>
        <div className="rounded-panel border border-line bg-surface p-4 sm:p-6">
          <ListingView listing={previewListing(form, { user, categories, items: catalog.data })} preview />
        </div>
      </section>
    </div>
  );
}

