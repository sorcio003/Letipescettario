// Pezzi di interfaccia condivisi da tutte le pagine: header, footer, card, icone, preferiti, foto.
import { SITE_NAME, DIFFICULTIES, getCategory, totalTime, formatMinutes } from './data.js';
import { accountsEnabled } from './firebase.js';
import { session, sessionHint, onSessionChange, toggleFavorite, logout, loginUrl } from './auth.js';
import { getPhotoUrl } from './store.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const svg = (paths) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M17.5 14.2c2.3.6 4 2.6 4 5.8"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  chevronLeft: svg('<path d="m15 18-6-6 6-6"/>'),
  chevronRight: svg('<path d="m9 18 6-6-6-6"/>'),
  arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  heart: svg('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>'),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>'),
  star: svg('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z"/>'),
};

// ---------- Header e footer ----------

const NAV_LINKS = [
  { key: 'recipes', href: 'ricette.html', label: 'Ricette' },
  { key: 'favorites', href: 'preferiti.html', label: 'Preferiti', accounts: true },
  { key: 'about', href: 'about.html', label: 'About' },
  { key: 'add', href: 'aggiungi.html', label: 'Aggiungi', cta: true, adminOnly: true },
];

/** Inserisce header e footer e attiva i comportamenti comuni. `activeKey` evidenzia la voce di menu corrente. */
export function mountLayout(activeKey) {
  if (!accountsEnabled) document.body.classList.add('accounts-off');

  const links = NAV_LINKS
    .filter((link) => accountsEnabled || !link.accounts)
    .map((link) => `
      <a href="${link.href}" class="${link.cta ? 'nav-cta' : ''}"
         ${link.key === activeKey ? 'aria-current="page"' : ''} ${link.adminOnly ? 'data-admin-only hidden' : ''}>
        ${link.cta ? ICONS.plus : ''}${link.label}
      </a>`).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <a class="skip-link" href="#main">Vai al contenuto</a>
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand" href="index.html">
          <img class="brand__logo" src="assets/icons/first_dish.png" alt="">
          <span class="brand__name">${escapeHtml(SITE_NAME)}</span>
        </a>
        <button class="icon-btn nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">
          ${ICONS.menu}
        </button>
        <nav class="site-nav" id="site-nav" aria-label="Menu principale">
          ${links}
          ${accountsEnabled ? '<div class="nav-account" id="nav-account"></div>' : ''}
        </nav>
      </div>
    </header>`);

  document.body.insertAdjacentHTML('beforeend', `
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <span>${escapeHtml(SITE_NAME)} · fatto con amore, in cucina</span>
        <span>© ${new Date().getFullYear()}</span>
      </div>
    </footer>`);

  setupMobileNav();
  renderAccount();
  applySession(document);

  onSessionChange(() => {
    renderAccount();
    applySession(document);
  });

  document.addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-fav]');
    if (favorite) {
      event.preventDefault();
      toggleFavorite(favorite.dataset.fav).catch((error) => {
        console.error(error);
        alert('Non è stato possibile salvare il preferito. Riprova tra poco.');
      });
    }
    if (event.target.closest('[data-logout]')) logout();
  });

  // Se una foto con indirizzo fisso non si carica, la togliamo: sotto resta il segnaposto della categoria.
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.classList.contains('media__photo')) img.remove();
  }, true);

  // Tutto ciò che le pagine aggiungono dopo (card, foto, pulsanti) viene sistemato in automatico.
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) applySession(node);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function setupMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#site-nav');
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open);
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header') || event.target.closest('.site-nav a, .site-nav button')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

function renderAccount() {
  const slot = document.querySelector('#nav-account');
  if (!slot) return;
  const state = session.ready ? session : (sessionHint() ?? {});
  slot.innerHTML = state.username
    ? `
      <a class="nav-user" href="preferiti.html" title="I miei preferiti">
        <span class="avatar" aria-hidden="true">${escapeHtml(state.username[0].toUpperCase())}</span>
        <span class="nav-user__name">${escapeHtml(state.username)}</span>
      </a>
      <button class="icon-btn nav-logout" type="button" data-logout aria-label="Esci" title="Esci">${ICONS.logout}</button>`
    : `<a class="nav-login" href="${loginUrl()}">Accedi</a>`;
}

/** Aggiorna cuori, elementi riservati all'admin e foto dentro `root`. */
function applySession(root) {
  const isAdmin = session.ready ? session.isAdmin : Boolean(sessionHint()?.isAdmin);
  const find = (selector) => [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];

  find('[data-admin-only]').forEach((el) => { el.hidden = !isAdmin; });

  find('[data-fav]').forEach((button) => {
    const on = session.favorites.has(button.dataset.fav);
    button.setAttribute('aria-pressed', on);
    const text = button.querySelector('.fav-btn__text');
    if (text) text.textContent = on ? 'Nei preferiti' : 'Salva nei preferiti';
    else button.setAttribute('aria-label', on ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti');
  });

  find('img[data-photo]:not([src])').forEach((img) => {
    if ('eager' in img.dataset) loadPhoto(img);
    else photoObserver.observe(img);
  });
}

// ---------- Foto salvate in Firestore: si caricano quando stanno per entrare nello schermo ----------

const photoObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    photoObserver.unobserve(entry.target);
    loadPhoto(entry.target);
  });
}, { rootMargin: '300px' });

async function loadPhoto(img) {
  if (img.dataset.loading) return;
  img.dataset.loading = 'true';
  try {
    img.src = await getPhotoUrl(img.dataset.photo);
    await img.decode();
    img.classList.add('is-loaded');
  } catch (error) {
    console.warn(error);
    img.remove();
  }
}

// ---------- Componenti ----------

/**
 * Immagine della ricetta con segnaposto colorato (icona della categoria) finché la foto non c'è.
 * Di default usa la copertina; `size: 'thumb'` usa la miniatura (per le card).
 */
export function recipeMedia(recipe, { photoId, image, size = 'full', eager = false } = {}) {
  const category = getCategory(recipe.category);
  const id = photoId ?? (image ? null : size === 'thumb' ? recipe.thumbId ?? recipe.photoIds?.[0] : recipe.photoIds?.[0]);
  const url = id ? null : image ?? recipe.images?.[0];
  const alt = escapeHtml(recipe.title);

  let photo = '';
  if (id) photo = `<img class="media__photo" data-photo="${escapeHtml(id)}" ${eager ? 'data-eager' : ''} alt="${alt}">`;
  else if (url) photo = `<img class="media__photo is-loaded" src="${escapeHtml(url)}" alt="${alt}" ${eager ? '' : 'loading="lazy"'}>`;

  return `
    <div class="media" style="--tint:${category.tint}">
      <img class="media__placeholder" src="${category.icon}" alt="">
      ${photo}
    </div>`;
}

/** Pulsante a cuore. Con `label: true` è un bottone con testo (pagina ricetta, home). */
export function favButton(recipeId, { label = false } = {}) {
  if (!accountsEnabled) return '';
  return label
    ? `<button type="button" class="btn btn--ghost fav-btn fav-btn--label" data-fav="${escapeHtml(recipeId)}" aria-pressed="false">
         ${ICONS.heart}<span class="fav-btn__text">Salva nei preferiti</span>
       </button>`
    : `<button type="button" class="fav-btn" data-fav="${escapeHtml(recipeId)}" aria-pressed="false" aria-label="Aggiungi ai preferiti">
         ${ICONS.heart}
       </button>`;
}

export function categoryBadge(categoryId) {
  const category = getCategory(categoryId);
  return `<span class="badge"><img src="${category.icon}" alt="">${escapeHtml(category.singular)}</span>`;
}

export function difficultyLabel(key) {
  const difficulty = DIFFICULTIES[key];
  if (!difficulty) return '—';
  const dots = [1, 2, 3].map((n) => `<span${n <= difficulty.level ? ' class="on"' : ''}></span>`).join('');
  return `<span class="difficulty"><span class="difficulty__dots" aria-hidden="true">${dots}</span>${difficulty.label}</span>`;
}

/** Riga con tempo totale, difficoltà e numero di persone. */
export function recipeMeta(recipe) {
  return `
    <ul class="meta">
      <li><span class="visually-hidden">Tempo totale:</span>${ICONS.clock}${formatMinutes(totalTime(recipe))}</li>
      <li><span class="visually-hidden">Difficoltà:</span>${difficultyLabel(recipe.difficulty)}</li>
      <li><span class="visually-hidden">Persone:</span>${ICONS.users}${recipe.servings} pers.</li>
    </ul>`;
}

export function recipeUrl(recipe) {
  return `ricetta.html?id=${encodeURIComponent(recipe.id)}`;
}

export function recipeCard(recipe) {
  return `
    <article class="card">
      ${recipeMedia(recipe, { size: 'thumb' })}
      <div class="card__body">
        ${categoryBadge(recipe.category)}
        <h3 class="card__title"><a class="card__link" href="${recipeUrl(recipe)}">${escapeHtml(recipe.title)}</a></h3>
        ${recipeMeta(recipe)}
      </div>
      ${favButton(recipe.id)}
    </article>`;
}

export function showLoadError(container, error) {
  const hint = location.protocol === 'file:'
    ? 'Hai aperto il file direttamente dal computer: il browser blocca la lettura dei dati. Avvia un piccolo server locale (vedi il README) oppure apri la versione pubblicata su GitHub Pages.'
    : accountsEnabled
      ? 'Controlla la connessione e la configurazione di Firebase (regole di Firestore pubblicate?).'
      : 'Controlla che <code>data/recipes.json</code> esista e sia un JSON valido (una virgola in più o in meno basta a romperlo).';
  container.innerHTML = `
    <div class="alert" role="alert">
      <strong>Non riesco a caricare le ricette.</strong>
      <p>${hint}</p>
      <p class="alert__detail">${escapeHtml(error.message)}</p>
    </div>`;
}

/** Riquadro "devi accedere / non hai i permessi / Firebase non configurato". */
export function gateMessage({ title, text, action = '' }) {
  return `
    <div class="empty gate">
      <img src="assets/icons/dessert.png" alt="">
      <p><strong>${title}</strong></p>
      <p>${text}</p>
      ${action}
    </div>`;
}
