// Regras do anúncio, sem dependências. Existe uma cópia idêntica em frontend/src/utils/listingRules.js
// (um teste confere que as duas dão o mesmo resultado). Se mudar aqui, mude lá.

export const LISTING_LIMITS = {
  title: [10, 120], description: [50, 3000], images: [3, 10], included: [1, 15], excluded: [0, 15],
  itemMax: 120, textMax: 1000, radiusMax: 500, packagesMax: 2, priceMax: 1000000, travelFeeMax: 10000, leadTimeMax: 720,
};

export const SERVICE_MODES = ['client_place', 'pro_place', 'remote'];
export const PRICING_MODELS = ['hourly', 'daily', 'fixed', 'quote'];
export const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict'];
export const STEP_COUNT = 10;

const HOUR = /^([01]\d|2[0-3]):[0-5]\d$/;
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const list = (value) => (Array.isArray(value) ? value : []);
const isNumber = (value) => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value));

function stepErrors(step, d) {
  const e = {};
  const L = LISTING_LIMITS;
  const modes = list(d.serviceModes);
  const physical = modes.includes('client_place') || modes.includes('pro_place');

  if (step === 1) {
    if (!d.categoryId) e.categoryId = 'Escolha uma categoria.';
    if (!d.catalogItemId) e.catalogItemId = 'Escolha o tipo de serviço.';
  }
  if (step === 2) {
    if (!modes.length || !modes.every((mode) => SERVICE_MODES.includes(mode))) e.serviceModes = 'Escolha pelo menos uma forma de atendimento.';
  }
  if (step === 3 && physical) {
    if (!text(d.city)) e.city = 'Informe a cidade.';
    else if (text(d.city).length > 100) e.city = 'Use no máximo 100 caracteres.';
    if (!/^[A-Za-z]{2}$/.test(text(d.state))) e.state = 'Escolha o estado.';
    if (modes.includes('client_place')) {
      const km = Number(d.radiusKm);
      if (!isNumber(d.radiusKm) || !Number.isInteger(km) || km < 1 || km > L.radiusMax) e.radiusKm = `Informe o raio de atendimento em km, de 1 a ${L.radiusMax}.`;
    }
  }
  if (step === 4) {
    const title = text(d.title).length;
    const description = text(d.description).length;
    if (title < L.title[0] || title > L.title[1]) e.title = `O título precisa ter de ${L.title[0]} a ${L.title[1]} caracteres.`;
    if (description < L.description[0] || description > L.description[1]) e.description = `A descrição precisa ter de ${L.description[0]} a ${L.description[1]} caracteres.`;
  }
  if (step === 5) {
    const count = list(d.images).length;
    if (count < L.images[0]) e.images = `Adicione pelo menos ${L.images[0]} fotos. Você tem ${count}.`;
    else if (count > L.images[1]) e.images = `Use no máximo ${L.images[1]} fotos.`;
  }
  if (step === 6) {
    const included = list(d.included).map(text).filter(Boolean);
    const excluded = list(d.excluded).map(text).filter(Boolean);
    if (included.length < L.included[0]) e.included = 'Liste pelo menos um item incluso no serviço.';
    else if (included.length > L.included[1] || included.some((item) => item.length > L.itemMax)) e.included = `Use até ${L.included[1]} itens, de até ${L.itemMax} caracteres.`;
    if (excluded.length > L.excluded[1] || excluded.some((item) => item.length > L.itemMax)) e.excluded = `Use até ${L.excluded[1]} itens, de até ${L.itemMax} caracteres.`;
    if (text(d.requirements).length > L.textMax) e.requirements = `Use no máximo ${L.textMax} caracteres.`;
    if (text(d.materials).length > L.textMax) e.materials = `Use no máximo ${L.textMax} caracteres.`;
  }
  if (step === 7) {
    if (!PRICING_MODELS.includes(d.pricingModel)) e.pricingModel = 'Escolha como você cobra.';
    else if (d.pricingModel !== 'quote') {
      const price = Number(d.price);
      if (!isNumber(d.price) || price <= 0 || price > L.priceMax) e.price = 'Informe um valor maior que zero.';
    }
    if (isNumber(d.travelFee) && (Number(d.travelFee) < 0 || Number(d.travelFee) > L.travelFeeMax)) e.travelFee = `A taxa de deslocamento pode ir de zero a ${L.travelFeeMax}.`;
    const packages = list(d.packages);
    if (d.pricingModel !== 'quote' && packages.length) {
      if (packages.length > L.packagesMax) e.packages = `Use no máximo ${L.packagesMax} pacotes.`;
      else if (packages.some((item) => !text(item.name) || text(item.name).length > 40 || !isNumber(item.price) || Number(item.price) <= 0 || text(item.description).length > 200)) {
        e.packages = 'Cada pacote precisa de nome (até 40 caracteres), valor maior que zero e descrição de até 200 caracteres.';
      }
    }
  }
  if (step === 8) {
    const days = list(d.availability?.weekdays);
    if (!days.length) e.availability = 'Escolha pelo menos um dia de atendimento.';
    else if (new Set(days.map((day) => day.day)).size !== days.length || days.some((day) => !Number.isInteger(day.day) || day.day < 0 || day.day > 6 || !HOUR.test(day.from ?? '') || !HOUR.test(day.to ?? '') || day.from >= day.to)) {
      e.availability = 'Confira os horários: o início precisa ser antes do fim.';
    }
    const lead = Number(d.availability?.leadTimeHours);
    if (!isNumber(d.availability?.leadTimeHours) || !Number.isInteger(lead) || lead < 0 || lead > L.leadTimeMax) e.leadTimeHours = `Informe a antecedência mínima em horas, de 0 a ${L.leadTimeMax}.`;
    if (!CANCELLATION_POLICIES.includes(d.cancellationPolicy)) e.cancellationPolicy = 'Escolha a política de cancelamento.';
  }
  if (step === 9) {
    if (text(d.verification?.legalName).length < 3) e.legalName = 'Informe o nome completo ou a razão social.';
    if (d.verification?.documentOk !== true) e.document = 'Informe um CPF ou CNPJ válido.';
  }
  return e;
}

/** Erros da etapa, no formato { campo: mensagem }. Vazio quando a etapa está completa. */
export function validateStep(step, data) {
  return stepErrors(step, data ?? {});
}

/** Erros de todas as etapas: [{ step, field, message }]. Publicar exige a lista vazia. */
export function validateAll(data) {
  const found = [];
  for (let step = 1; step < STEP_COUNT; step++) {
    for (const [field, message] of Object.entries(stepErrors(step, data ?? {}))) found.push({ step, field, message });
  }
  return found;
}

/** Quanto o profissional recebe de um valor, descontada a taxa da plataforma (em %). */
export function netAmount(amount, feePercent = 0) {
  if (!isNumber(amount)) return null;
  return Math.round(Number(amount) * (100 - Number(feePercent)) ) / 100;
}
