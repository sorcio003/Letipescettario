import { CATEGORIES, getCategory, matchesQuery, formatDate } from '../data.js';
import { loadRecipes } from '../store.js';
import {
  mountLayout, escapeHtml, recipeMedia, recipeMeta, recipeCard, recipeUrl, categoryBadge, favButton, showLoadError, ICONS,
} from '../ui.js';

const LATEST_POOL = 5;      // la ricetta in evidenza è scelta a caso tra le ultime N caricate
const PER_CATEGORY = 3;     // quante ricette per portata nel carosello
const MAX_SUGGESTIONS = 6;  // risultati mostrati nel menu a tendina della ricerca

mountLayout('home');

const hero = document.querySelector('#hero');
renderCategories();

try {
  const recipes = await loadRecipes();
  renderHero(recipes);
  renderCategories(recipes);
  renderCarousel(recipes);
  setupSearch(recipes);
} catch (error) {
  hero.classList.remove('hero--loading');
  hero.style.display = 'block';
  showLoadError(hero, error);
}

function renderHero(recipes) {
  hero.classList.remove('hero--loading');
  const pool = recipes.slice(0, LATEST_POOL);
  if (!pool.length) {
    hero.style.display = 'block';
    hero.innerHTML = `
      <div class="empty">
        <img src="assets/icons/first_dish.png" alt="">
        <p><strong>Il ricettario è ancora vuoto.</strong></p>
        <p data-admin-only hidden><a href="aggiungi.html">Aggiungi la prima ricetta</a> o importa quelle di esempio.</p>
      </div>`;
    return;
  }

  const recipe = pool[Math.floor(Math.random() * pool.length)];
  hero.innerHTML = `
    <a class="hero__media" href="${recipeUrl(recipe)}" tabindex="-1" aria-hidden="true">
      ${recipeMedia(recipe, { eager: true })}
    </a>
    <div class="hero__body">
      <p class="eyebrow">Novità · ${formatDate(recipe.date)}</p>
      ${categoryBadge(recipe.category)}
      <h2 class="hero__title"><a href="${recipeUrl(recipe)}">${escapeHtml(recipe.title)}</a></h2>
      <p class="hero__text">${escapeHtml(recipe.description)}</p>
      ${recipeMeta(recipe)}
      <div class="actions">
        <a class="btn btn--primary" href="${recipeUrl(recipe)}">Vai alla ricetta ${ICONS.arrowRight}</a>
        ${favButton(recipe.id, { label: true })}
      </div>
    </div>`;
}

function renderCategories(recipes) {
  document.querySelector('#categories').innerHTML = CATEGORIES.map((category) => {
    const count = recipes?.filter((r) => r.category === category.id).length;
    return `
      <li>
        <a class="category-tile" href="ricette.html?cat=${category.id}" style="--tint:${category.tint}">
          <span class="category-tile__icon"><img src="${category.icon}" alt=""></span>
          <span class="category-tile__label">${category.label}</span>
          ${count == null ? '' : `<span class="category-tile__count">${count} ${count === 1 ? 'ricetta' : 'ricette'}</span>`}
        </a>
      </li>`;
  }).join('');
}

/** Le ultime PER_CATEGORY ricette di ogni portata, alternate (antipasto, primo, secondo… e di nuovo). */
function pickCarouselRecipes(recipes) {
  const groups = CATEGORIES.map((c) => recipes.filter((r) => r.category === c.id).slice(0, PER_CATEGORY));
  const picked = [];
  for (let i = 0; i < PER_CATEGORY; i++) {
    for (const group of groups) if (group[i]) picked.push(group[i]);
  }
  return picked;
}

function renderCarousel(recipes) {
  const track = document.querySelector('#carousel-track');
  const buttons = document.querySelectorAll('.carousel__controls .icon-btn');
  track.innerHTML = pickCarouselRecipes(recipes).map(recipeCard).join('');

  const updateButtons = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    buttons[0].disabled = track.scrollLeft <= 2;
    buttons[1].disabled = track.scrollLeft >= max;
  };

  buttons.forEach((button) => button.addEventListener('click', () => {
    track.scrollBy({ left: Number(button.dataset.dir) * track.clientWidth * 0.9 });
  }));
  track.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('resize', updateButtons);
  updateButtons();
}

function setupSearch(recipes) {
  const form = document.querySelector('#search');
  const input = form.querySelector('input');
  const list = document.querySelector('#search-results');

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };

  const update = () => {
    const query = input.value.trim();
    if (query.length < 2) return close();

    const matches = recipes.filter((r) => matchesQuery(r, query));
    const items = matches.slice(0, MAX_SUGGESTIONS).map((recipe) => `
      <li>
        <a href="${recipeUrl(recipe)}">
          ${recipeMedia(recipe, { size: 'thumb' })}
          <span><strong>${escapeHtml(recipe.title)}</strong><small>${getCategory(recipe.category).singular}</small></span>
        </a>
      </li>`);
    if (matches.length > MAX_SUGGESTIONS) {
      items.push(`<li><a class="search__all" href="ricette.html?q=${encodeURIComponent(query)}">Vedi tutti i ${matches.length} risultati</a></li>`);
    }
    list.innerHTML = items.length
      ? items.join('')
      : `<li class="search__empty">Nessuna ricetta per “${escapeHtml(query)}”</li>`;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowDown' && !list.hidden) {
      event.preventDefault();
      list.querySelector('a')?.focus();
    }
  });
  list.addEventListener('keydown', (event) => {
    const links = [...list.querySelectorAll('a')];
    const index = links.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); links[index + 1]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); (links[index - 1] ?? input).focus(); }
    if (event.key === 'Escape') { close(); input.focus(); }
  });
  document.addEventListener('click', (event) => {
    if (!form.contains(event.target)) close();
  });
  form.addEventListener('submit', (event) => {
    if (!input.value.trim()) event.preventDefault();
  });
}
