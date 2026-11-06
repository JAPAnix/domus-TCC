// Cor de cada categoria de serviço. Classes escritas por extenso para o Tailwind encontrá-las.
export const CATEGORY_FAMILIES = {
  violet: { chip: 'bg-cat-violet-soft text-cat-violet-ink', dot: 'bg-cat-violet-solid', bar: 'border-cat-violet-solid', hover: 'hover:border-cat-violet-solid hover:bg-cat-violet-soft' },
  teal: { chip: 'bg-cat-teal-soft text-cat-teal-ink', dot: 'bg-cat-teal-solid', bar: 'border-cat-teal-solid', hover: 'hover:border-cat-teal-solid hover:bg-cat-teal-soft' },
  coral: { chip: 'bg-cat-coral-soft text-cat-coral-ink', dot: 'bg-cat-coral-solid', bar: 'border-cat-coral-solid', hover: 'hover:border-cat-coral-solid hover:bg-cat-coral-soft' },
  rose: { chip: 'bg-cat-rose-soft text-cat-rose-ink', dot: 'bg-cat-rose-solid', bar: 'border-cat-rose-solid', hover: 'hover:border-cat-rose-solid hover:bg-cat-rose-soft' },
  amber: { chip: 'bg-cat-amber-soft text-cat-amber-ink', dot: 'bg-cat-amber-solid', bar: 'border-cat-amber-solid', hover: 'hover:border-cat-amber-solid hover:bg-cat-amber-soft' },
  lime: { chip: 'bg-cat-lime-soft text-cat-lime-ink', dot: 'bg-cat-lime-solid', bar: 'border-cat-lime-solid', hover: 'hover:border-cat-lime-solid hover:bg-cat-lime-soft' },
  sky: { chip: 'bg-cat-sky-soft text-cat-sky-ink', dot: 'bg-cat-sky-solid', bar: 'border-cat-sky-solid', hover: 'hover:border-cat-sky-solid hover:bg-cat-sky-soft' },
  indigo: { chip: 'bg-cat-indigo-soft text-cat-indigo-ink', dot: 'bg-cat-indigo-solid', bar: 'border-cat-indigo-solid', hover: 'hover:border-cat-indigo-solid hover:bg-cat-indigo-soft' },
  fuchsia: { chip: 'bg-cat-fuchsia-soft text-cat-fuchsia-ink', dot: 'bg-cat-fuchsia-solid', bar: 'border-cat-fuchsia-solid', hover: 'hover:border-cat-fuchsia-solid hover:bg-cat-fuchsia-soft' },
  emerald: { chip: 'bg-cat-emerald-soft text-cat-emerald-ink', dot: 'bg-cat-emerald-solid', bar: 'border-cat-emerald-solid', hover: 'hover:border-cat-emerald-solid hover:bg-cat-emerald-soft' },
  cyan: { chip: 'bg-cat-cyan-soft text-cat-cyan-ink', dot: 'bg-cat-cyan-solid', bar: 'border-cat-cyan-solid', hover: 'hover:border-cat-cyan-solid hover:bg-cat-cyan-soft' },
  slate: { chip: 'bg-cat-slate-soft text-cat-slate-ink', dot: 'bg-cat-slate-solid', bar: 'border-cat-slate-solid', hover: 'hover:border-cat-slate-solid hover:bg-cat-slate-soft' },
};

const FAMILY_NAMES = Object.keys(CATEGORY_FAMILIES);

// Categorias conhecidas ganham uma cor que combina com o assunto; as demais usam o número da categoria.
const BY_KEYWORD = [
  [/el[eé]tric/i, 'amber'], [/hidr[aá]ulic|encanad/i, 'sky'], [/limpez/i, 'teal'], [/jardin|paisag/i, 'lime'], [/aula|ensino|curso/i, 'indigo'],
  [/autom[oó]vei|carro|mec[aâ]nic/i, 'slate'], [/cuidados|beleza|est[eé]tic|sa[uú]de/i, 'rose'], [/evento|festa/i, 'fuchsia'],
  [/inform[aá]tic|tecnolog/i, 'cyan'], [/eletrodom[eé]stic/i, 'coral'], [/ar-condicionado|climatiz/i, 'sky'], [/instala|reforma|constru/i, 'violet'],
  [/pet|animal/i, 'emerald'],
];

/** Família de cor ('violet', 'teal'...) de uma categoria, por nome e, se não houver regra, pelo id. */
export function categoryFamily(category) {
  const name = category?.name ?? '';
  for (const [pattern, family] of BY_KEYWORD) if (pattern.test(name)) return family;
  return FAMILY_NAMES[Math.abs(Number(category?.id) || 0) % FAMILY_NAMES.length];
}

export const categoryStyle = (category) => CATEGORY_FAMILIES[categoryFamily(category)];

const AVATAR_CLASSES = ['bg-avatar-0', 'bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4', 'bg-avatar-5', 'bg-avatar-6', 'bg-avatar-7'];

/** Degradê do avatar sem foto, sempre o mesmo para o mesmo nome. */
export function avatarClass(name) {
  let hash = 0;
  for (const char of String(name ?? '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_CLASSES[hash % AVATAR_CLASSES.length];
}
