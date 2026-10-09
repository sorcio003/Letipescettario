import { accountsEnabled } from '../firebase.js';
import { session, whenSessionReady, onSessionChange, loginUrl } from '../auth.js';
import { loadRecipes } from '../store.js';
import { mountLayout, recipeCard, showLoadError, gateMessage, ICONS } from '../ui.js';

mountLayout('favorites');

const container = document.querySelector('#favorites');
let recipes = null;

if (!accountsEnabled) {
  container.innerHTML = gateMessage({
    title: 'I preferiti non sono ancora attivi.',
    text: 'Per salvarli bisogna collegare il sito a Firebase: trovi le istruzioni nel README.',
  });
} else {
  await whenSessionReady();
  try {
    recipes = await loadRecipes();
    render();
    onSessionChange(render);
  } catch (error) {
    showLoadError(container, error);
  }
}

function render() {
  if (!session.user) {
    container.innerHTML = gateMessage({
      title: 'Accedi per vedere i tuoi preferiti.',
      text: 'Con un account puoi salvare le ricette che ami e ritrovarle su ogni dispositivo.',
      action: `<a class="btn btn--primary" href="${loginUrl()}">Accedi o registrati</a>`,
    });
    return;
  }

  if (!session.favoritesLoaded) {
    container.innerHTML = '<p class="results-summary">Carico i tuoi preferiti…</p>';
    return;
  }

  const favorites = recipes.filter((recipe) => session.favorites.has(recipe.id));
  container.innerHTML = favorites.length
    ? `<div class="recipe-grid">${favorites.map(recipeCard).join('')}</div>`
    : gateMessage({
      title: 'Ancora nessun preferito.',
      text: `Tocca il cuore ${ICONS.heart} su una ricetta per salvarla qui.`,
      action: '<a class="btn btn--primary" href="ricette.html">Sfoglia le ricette</a>',
    });
}
