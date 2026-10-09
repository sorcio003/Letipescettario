// Configurazione del sito e funzioni di utilità per leggere e formattare le ricette.

export const SITE_NAME = 'IL Letipescettario';

export const CATEGORIES = [
  { id: 'appetizer',   label: 'Antipasti',      singular: 'Antipasto',      icon: 'assets/icons/appetizer.png',   tint: '#FFE6D5' },
  { id: 'first_dish',  label: 'Primi piatti',   singular: 'Primo piatto',   icon: 'assets/icons/first_dish.png',  tint: '#FFF0C4' },
  { id: 'second_dish', label: 'Secondi piatti', singular: 'Secondo piatto', icon: 'assets/icons/second_dish.png', tint: '#FFDDDD' },
  { id: 'side_dish',   label: 'Contorni',       singular: 'Contorno',       icon: 'assets/icons/side_dish.png',   tint: '#DDF2D6' },
  { id: 'dessert',     label: 'Dolci',          singular: 'Dolce',          icon: 'assets/icons/dessert.png',     tint: '#FBE0F0' },
];

export const DIFFICULTIES = {
  easy:   { label: 'Facile',    level: 1 },
  medium: { label: 'Media',     level: 2 },
  hard:   { label: 'Difficile', level: 3 },
};

// Le unità si scrivono al singolare nel JSON: il plurale viene scelto in base alla quantità.
const UNIT_PLURALS = {
  cucchiaio: 'cucchiai',
  cucchiaino: 'cucchiaini',
  spicchio: 'spicchi',
  fetta: 'fette',
  rametto: 'rametti',
  costa: 'coste',
  foglia: 'foglie',
  pizzico: 'pizzichi',
  bustina: 'bustine',
  bicchiere: 'bicchieri',
  tazza: 'tazze',
  vasetto: 'vasetti',
  ciuffo: 'ciuffi',
  mazzetto: 'mazzetti',
};
const UNIT_SINGULARS = Object.fromEntries(Object.entries(UNIT_PLURALS).map(([s, p]) => [p, s]));

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id)
    ?? { id, label: id, singular: id, icon: CATEGORIES[0].icon, tint: '#EEE' };
}

export function totalTime(recipe) {
  return (recipe.prepTime || 0) + (recipe.cookTime || 0) + (recipe.restTime || 0);
}

export function formatMinutes(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "320 g", "2 cucchiai", "q.b." — `scale` serve a ricalcolare le dosi per un altro numero di persone. */
export function formatQuantity(ingredient, scale = 1) {
  const unit = ingredient.unit?.trim() ?? '';
  if (ingredient.qty == null || ingredient.qty === '') return unit;

  const qty = ingredient.qty * scale;
  const digits = qty >= 10 ? 0 : qty >= 0.1 ? 1 : 2;
  const number = qty.toLocaleString('it-IT', { maximumFractionDigits: digits });

  const rounded = Number(qty.toFixed(digits));
  const unitLabel = rounded > 1 ? (UNIT_PLURALS[unit] ?? unit) : (UNIT_SINGULARS[unit] ?? unit);
  return unitLabel ? `${number} ${unitLabel}` : number;
}

export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Ogni parola cercata deve comparire nel titolo, nella descrizione, nella categoria, nei tag o negli ingredienti. */
export function matchesQuery(recipe, query) {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const category = getCategory(recipe.category);
  const haystack = normalizeText([
    recipe.title,
    recipe.description,
    category.label,
    category.singular,
    ...(recipe.tags ?? []),
    ...(recipe.ingredients ?? []).map((i) => i.name),
  ].join(' '));
  return terms.every((term) => haystack.includes(term));
}

export function slugify(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
