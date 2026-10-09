import { SITE_NAME, getCategory, totalTime, formatMinutes, formatQuantity } from '../data.js';
import { loadRecipes, deleteRecipe } from '../store.js';
import {
  mountLayout, escapeHtml, recipeMedia, recipeCard, categoryBadge, difficultyLabel, favButton, showLoadError, ICONS,
} from '../ui.js';

const MAX_SERVINGS = 50;

mountLayout('recipes');

const root = document.querySelector('#recipe');
const id = new URLSearchParams(location.search).get('id');

try {
  const recipes = await loadRecipes();
  const recipe = recipes.find((r) => r.id === id);
  if (recipe) render(recipe, recipes);
  else renderNotFound();
} catch (error) {
  showLoadError(root, error);
}
root.removeAttribute('aria-busy');

function paragraphs(text) {
  return String(text ?? '')
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
}

function fact(label, value, valueId = '') {
  return `<div class="fact"><dt>${label}</dt><dd${valueId ? ` id="${valueId}"` : ''}>${value}</dd></div>`;
}

/** Foto della ricetta: da Firestore (photoIds) oppure indirizzi fissi (images). */
function gallerySources(recipe) {
  if (recipe.photoIds?.length) return recipe.photoIds.map((photoId) => ({ photoId }));
  return (recipe.images ?? []).map((image) => ({ image }));
}

function render(recipe, recipes) {
  const category = getCategory(recipe.category);
  const sources = gallerySources(recipe);
  document.title = `${recipe.title} · ${SITE_NAME}`;

  const thumbs = sources.length > 1 ? `
    <div class="gallery__thumbs">
      ${sources.map((source, i) => `
        <button type="button" data-index="${i}" aria-label="Foto ${i + 1}" aria-current="${i === 0}">
          ${recipeMedia(recipe, source)}
        </button>`).join('')}
    </div>` : '';

  const related = recipes
    .filter((r) => r.category === recipe.category && r.id !== recipe.id)
    .slice(0, 3);

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Percorso">
      <a href="ricette.html">Ricette</a><span aria-hidden="true">›</span>
      <a href="ricette.html?cat=${category.id}">${category.label}</a><span aria-hidden="true">›</span>
      <span aria-current="page">${escapeHtml(recipe.title)}</span>
    </nav>

    <section class="recipe-hero">
      <div class="gallery">
        <div class="gallery__main">${recipeMedia(recipe, { ...sources[0], eager: true })}</div>
        ${thumbs}
      </div>

      <div class="recipe-head">
        ${categoryBadge(recipe.category)}
        <h1>${escapeHtml(recipe.title)}</h1>
        <div class="recipe-head__desc">${paragraphs(recipe.description)}</div>
        <dl class="facts">
          ${fact('Preparazione', formatMinutes(recipe.prepTime))}
          ${recipe.cookTime ? fact('Cottura', formatMinutes(recipe.cookTime)) : ''}
          ${recipe.restTime ? fact('Riposo', formatMinutes(recipe.restTime)) : ''}
          ${fact('Totale', formatMinutes(totalTime(recipe)))}
          ${fact('Difficoltà', difficultyLabel(recipe.difficulty))}
          ${fact('Persone', recipe.servings, 'servings-fact')}
        </dl>
        ${recipe.tags?.length ? `
          <ul class="tags" aria-label="Tag">
            ${recipe.tags.map((t) => `<li><a class="tag" href="ricette.html?q=${encodeURIComponent(t)}">#${escapeHtml(t)}</a></li>`).join('')}
          </ul>` : ''}
        <div class="actions">
          ${favButton(recipe.id, { label: true })}
          <a class="btn btn--ghost" href="aggiungi.html?edit=${encodeURIComponent(recipe.id)}" data-admin-only hidden>${ICONS.pencil} Modifica</a>
          <button type="button" class="btn btn--danger" id="delete-recipe" data-admin-only hidden>${ICONS.trash} Elimina</button>
        </div>
      </div>
    </section>

    <section class="recipe-body">
      <aside class="panel ingredients" aria-labelledby="ingredients-title">
        <h2 id="ingredients-title">Ingredienti</h2>
        <div class="servings">
          <button type="button" class="icon-btn" data-delta="-1" aria-label="Una persona in meno">${ICONS.minus}</button>
          <span class="servings__value"><output id="servings" aria-live="polite">${recipe.servings}</output> ${recipe.servings === 1 ? 'persona' : 'persone'}</span>
          <button type="button" class="icon-btn" data-delta="1" aria-label="Una persona in più">${ICONS.plus}</button>
        </div>
        <ul class="ing-list">
          ${recipe.ingredients.map((ing, i) => `
            <li>
              <label>
                <input type="checkbox">
                <span class="ing__name">${escapeHtml(ing.name)}</span>
                <span class="ing__qty" data-index="${i}">${escapeHtml(formatQuantity(ing))}</span>
              </label>
            </li>`).join('')}
        </ul>
        <p class="ing-hint">Spunta gli ingredienti man mano che li prepari. Cambiando il numero di persone le dosi si aggiornano.</p>
      </aside>

      <div class="method">
        <h2>Procedimento</h2>
        <ol class="steps">
          ${recipe.steps.map((step, i) => `
            <li class="step">
              <button type="button" class="step__num" aria-pressed="false" aria-label="Passaggio ${i + 1}: segna come fatto">${i + 1}</button>
              <p>${escapeHtml(step)}</p>
            </li>`).join('')}
        </ol>
        ${recipe.notes ? `
          <div class="notes">
            <h3>Consiglio</h3>
            ${paragraphs(recipe.notes)}
          </div>` : ''}
      </div>
    </section>

    ${related.length ? `
      <section class="section" aria-labelledby="related-title">
        <div class="section-head">
          <h2 id="related-title">Altri ${category.label.toLowerCase()}</h2>
          <a class="btn btn--ghost" href="ricette.html?cat=${category.id}">Vedi tutti ${ICONS.arrowRight}</a>
        </div>
        <div class="recipe-grid">${related.map(recipeCard).join('')}</div>
      </section>` : ''}`;

  setupGallery(recipe, sources);
  setupServings(recipe);
  setupSteps();
  setupDelete(recipe);
}

function setupGallery(recipe, sources) {
  const main = root.querySelector('.gallery__main');
  root.querySelector('.gallery__thumbs')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    main.innerHTML = recipeMedia(recipe, { ...sources[button.dataset.index], eager: true });
    root.querySelectorAll('.gallery__thumbs button').forEach((b) => b.setAttribute('aria-current', b === button));
  });
}

function setupServings(recipe) {
  let servings = recipe.servings;
  const output = root.querySelector('#servings');
  const label = output.parentElement;
  const fact = root.querySelector('#servings-fact');
  const [minus, plus] = root.querySelectorAll('.servings .icon-btn');
  const quantities = root.querySelectorAll('.ing__qty');

  const update = () => {
    output.textContent = servings;
    label.lastChild.textContent = servings === 1 ? ' persona' : ' persone';
    fact.textContent = servings;
    minus.disabled = servings <= 1;
    plus.disabled = servings >= MAX_SERVINGS;
    const scale = servings / recipe.servings;
    quantities.forEach((el) => {
      el.textContent = formatQuantity(recipe.ingredients[el.dataset.index], scale);
    });
  };

  root.querySelector('.servings').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delta]');
    if (!button) return;
    servings = Math.min(MAX_SERVINGS, Math.max(1, servings + Number(button.dataset.delta)));
    update();
  });
  update();
}

function setupSteps() {
  root.querySelector('.steps').addEventListener('click', (event) => {
    const button = event.target.closest('.step__num');
    if (!button) return;
    const done = button.closest('.step').classList.toggle('is-done');
    button.setAttribute('aria-pressed', done);
  });
}

function setupDelete(recipe) {
  const button = root.querySelector('#delete-recipe');
  button.addEventListener('click', async () => {
    if (!confirm(`Eliminare definitivamente “${recipe.title}”? Verranno cancellate anche le sue foto.`)) return;
    button.disabled = true;
    try {
      await deleteRecipe(recipe);
      location.href = 'ricette.html';
    } catch (error) {
      console.error(error);
      button.disabled = false;
      alert('Eliminazione non riuscita: controlla di essere entrata come amministratrice e riprova.');
    }
  });
}

function renderNotFound() {
  root.innerHTML = `
    <div class="empty section">
      <img src="assets/icons/first_dish.png" alt="">
      <p><strong>Ricetta non trovata.</strong></p>
      <p>Forse è stata rinominata o non esiste più. <a href="ricette.html">Torna a tutte le ricette</a>.</p>
    </div>`;
}
