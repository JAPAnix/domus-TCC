import { isValidCnpj, isValidCpf } from '../../settings/identityValidation';

export const STEPS = [
  { n: 1, short: 'Serviço', title: 'Qual serviço você oferece?', description: 'Escolha a categoria e o tipo de serviço. É assim que os clientes encontram você.' },
  { n: 2, short: 'Atendimento', title: 'Como você atende?', description: 'Marque todas as formas que você oferece.' },
  { n: 3, short: 'Local', title: 'Onde você atende?', description: 'Informe a cidade e até onde você vai.' },
  { n: 4, short: 'Título e descrição', title: 'Conte sobre o serviço', description: 'Um bom título e uma descrição clara fazem diferença.' },
  { n: 5, short: 'Fotos', title: 'Mostre o seu trabalho', description: 'Adicione pelo menos 3 fotos. A primeira é a capa.' },
  { n: 6, short: 'Incluso', title: 'O que está incluso?', description: 'Deixe claro o que o cliente recebe e o que fica de fora.' },
  { n: 7, short: 'Preço', title: 'Quanto você cobra?', description: 'Escolha o modelo de preço e veja quanto você recebe.' },
  { n: 8, short: 'Agenda', title: 'Quando você atende?', description: 'Dias, horários, antecedência e política de cancelamento.' },
  { n: 9, short: 'Verificação', title: 'Verificação do profissional', description: 'Seus dados para a análise do selo “Verificado”.' },
  { n: 10, short: 'Revisão', title: 'Revise e publique', description: 'Veja como o cliente verá o seu anúncio.' },
];

export const DEFAULT_HOURS = { from: '08:00', to: '18:00' };

export function formFromListing(listing) {
  return {
    categoryId: listing.categoryId, catalogItemId: listing.catalogItemId, serviceModes: listing.serviceModes,
    city: listing.city ?? '', state: listing.state ?? '', radiusKm: listing.radiusKm ?? '',
    title: listing.title ?? '', description: listing.description ?? '', images: listing.images,
    included: listing.included, excluded: listing.excluded, requirements: listing.requirements ?? '', materials: listing.materials ?? '',
    pricingModel: listing.pricingModel ?? '', price: listing.price ?? '', travelFee: listing.travelFee ?? '',
    packages: listing.packages.map((item) => ({ name: item.name, price: item.price, description: item.description ?? '' })),
    availability: listing.availability ?? { weekdays: [], leadTimeHours: 24 }, cancellationPolicy: listing.cancellationPolicy ?? '',
    legalName: listing.legalName ?? '', documentType: 'cpf', document: '', documentSaved: !!listing.verificationOk,
  };
}

export const documentIsValid = (form) => (form.documentType === 'cpf' ? isValidCpf(form.document) : isValidCnpj(form.document));

/** Os campos no formato das regras compartilhadas (utils/listingRules). */
export function ruleData(form) {
  return {
    categoryId: form.categoryId, catalogItemId: form.catalogItemId, serviceModes: form.serviceModes, city: form.city, state: form.state, radiusKm: form.radiusKm,
    title: form.title, description: form.description, images: form.images, included: form.included, excluded: form.excluded, requirements: form.requirements, materials: form.materials,
    pricingModel: form.pricingModel || null, price: form.price, travelFee: form.travelFee, packages: form.packages, availability: form.availability,
    cancellationPolicy: form.cancellationPolicy || null,
    verification: { legalName: form.legalName, documentOk: form.document.trim() ? documentIsValid(form) : form.documentSaved },
  };
}

const num = (value) => (value === '' || value == null ? null : Number(value));

/** O que cada etapa envia ao servidor. */
export function stepPayload(step, form) {
  switch (step) {
    case 1: return { category_id: form.categoryId, catalog_item_id: form.catalogItemId };
    case 2: return { service_modes: form.serviceModes };
    case 3: return { city: form.city.trim(), state: form.state, radius_km: form.serviceModes.includes('client_place') ? num(form.radiusKm) : null };
    case 4: return { title: form.title.trim(), description: form.description.trim() };
    case 5: return { image_urls: form.images };
    case 6: return { included: form.included, excluded: form.excluded, requirements: form.requirements.trim(), materials: form.materials.trim() };
    case 7: return {
      pricing_model: form.pricingModel || null, price: form.pricingModel === 'quote' ? null : num(form.price),
      travel_fee: form.serviceModes.includes('client_place') ? num(form.travelFee) : null,
      packages: form.pricingModel === 'quote' ? [] : form.packages.map((item) => ({ name: item.name.trim(), price: Number(item.price), description: item.description.trim() })),
    };
    case 8: return { availability: { weekdays: form.availability.weekdays, lead_time_hours: Number(form.availability.leadTimeHours) }, cancellation_policy: form.cancellationPolicy || null };
    default: return {};
  }
}

export function allPayload(form) {
  return [1, 2, 3, 4, 5, 6, 7, 8].reduce((all, step) => ({ ...all, ...stepPayload(step, form) }), {});
}

/** Anúncio no formato da página pública, para a prévia antes de publicar. */
export function previewListing(form, { user, categories, items }) {
  const item = items?.find((entry) => entry.id === form.catalogItemId);
  const category = categories?.find((entry) => entry.id === form.categoryId) ?? item?.category;
  return {
    uuid: 'previa', isOwner: false, status: 'draft', images: form.images, title: form.title, description: form.description,
    category: category ? { id: category.id, name: category.name } : null, catalogItem: item ? { id: item.id, name: item.name } : null,
    serviceModes: form.serviceModes, city: form.city, state: form.state, radiusKm: num(form.radiusKm),
    included: form.included, excluded: form.excluded, requirements: form.requirements, materials: form.materials,
    pricingModel: form.pricingModel || null, price: form.pricingModel === 'quote' ? null : num(form.price), travelFee: form.serviceModes.includes('client_place') ? num(form.travelFee) : null,
    packages: form.pricingModel === 'quote' ? [] : form.packages.filter((entry) => entry.name.trim()).map((entry) => ({ name: entry.name, price: Number(entry.price) || 0, description: entry.description })),
    availability: { weekdays: form.availability.weekdays, leadTimeHours: Number(form.availability.leadTimeHours) || 0 },
    cancellationPolicy: form.cancellationPolicy || null,
    owner: { uuid: null, name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Você', profilePictureUrl: user?.profilePictureUrl ?? null, rating: 0, reviews: 0, verified: false },
    calendar: { earliest: '', blocked: [] },
  };
}
