import { CATEGORIES, getCategory, matchesQuery } from '../data.js';
import { loadRecipes } from '../store.js';
import { mountLayout, escapeHtml, recipeCard, showLoadError } from '../ui.js';

mountLayout('recipes');

const params = new URLSearchParams(location.search);
const state = {
  cat: CATEGORIES.some((c) => c.id === params.get('cat')) ? params.get('cat') : 'all',
  q: params.get('q') ?? '',
};

const chips = document.querySelector('#chips');
const input = document.querySelector('#filter-input');
const summary = document.querySelector('#summary');
const results = document.querySelector('#results');
let recipes = [];

input.value = state.q;
renderChips();

try {
  recipes = await loadRecipes();
  render();
} catch (error) {
  showLoadError(results, error);
}

chips.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-cat]');
  if (!chip) return;
  state.cat = chip.dataset.cat;
  renderChips();
  render();
});

input.addEventListener('input', () => {
  state.q = input.value;
  render();
});
document.querySelector('#filter-form').addEventListener('submit', (event) => event.preventDefault());

function renderChips() {
  const all = `<button type="button" class="chip chip--text" data-cat="all" aria-pressed="${state.cat === 'all'}">Tutte</button>`;
  chips.innerHTML = all + CATEGORIES.map((c) => `
    <button type="button" class="chip" data-cat="${c.id}" aria-pressed="${state.cat === c.id}">
      <img src="${c.icon}" alt="">${c.label}
    </button>`).join('');
}

function render() {
  const query = state.q.trim();
  const matches = recipes.filter((r) =>
    (state.cat === 'all' || r.category === state.cat) && matchesQuery(r, query));
  const categories = state.cat === 'all' ? CATEGORIES : [getCategory(state.cat)];

  const count = `${matches.length} ${matches.length === 1 ? 'ricetta' : 'ricette'}`;
  summary.textContent = query ? `${count} per “${query}”` : count;

  if (!matches.length && (query || state.cat === 'all')) {
    results.innerHTML = `
      <div class="empty section">
        <img src="${categories[0].icon}" alt="">
        <p><strong>Nessuna ricetta trovata${query ? ` per “${escapeHtml(query)}”` : ''}.</strong></p>
        <p>Prova con un'altra parola o <a href="aggiungi.html">aggiungi una nuova ricetta</a>.</p>
      </div>`;
  } else {
    results.innerHTML = categories.map((category) => {
      const list = matches.filter((r) => r.category === category.id);
      if (!list.length && query) return '';
      return `
        <section class="category-section" id="${category.id}" style="--tint:${category.tint}">
          <div class="category-section__head">
            <span class="category-section__icon"><img src="${category.icon}" alt=""></span>
            <div>
              <h2>${category.label}</h2>
              <span class="category-section__count">${list.length} ${list.length === 1 ? 'ricetta' : 'ricette'}</span>
            </div>
          </div>
          ${list.length
            ? `<div class="recipe-grid">${list.map(recipeCard).join('')}</div>`
            : `<p class="category-section__empty">Ancora nessuna ricetta qui. <a href="aggiungi.html">Aggiungine una!</a></p>`}
        </section>`;
    }).join('');
  }

  syncUrl();
}

function syncUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('cat');
  url.searchParams.delete('q');
  if (state.cat !== 'all') url.searchParams.set('cat', state.cat);
  if (state.q.trim()) url.searchParams.set('q', state.q.trim());
  history.replaceState(null, '', url);
}
