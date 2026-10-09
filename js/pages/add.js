import { CATEGORIES, slugify } from '../data.js';
import { accountsEnabled } from '../firebase.js';
import { session, whenSessionReady, onSessionChange, loginUrl } from '../auth.js';
import {
  loadRecipes, saveRecipe, deleteRecipe, compressImage, importSampleRecipes, exportRecipesJson,
} from '../store.js';
import { mountLayout, escapeHtml, gateMessage, ICONS } from '../ui.js';

const DRAFT_KEY = 'letipescettario:bozza';

mountLayout('add');

const gate = document.querySelector('#gate');
const editor = document.querySelector('#editor');
const form = document.querySelector('#recipe-form');
const fields = form.elements;
const ingredientsList = document.querySelector('#ingredients');
const stepsList = document.querySelector('#steps');
const statusEl = document.querySelector('#status');
const toolsStatus = document.querySelector('#tools-status');
const idPreview = document.querySelector('#id-preview');
const photosInput = document.querySelector('#photos');
const photoPreviews = document.querySelector('#photo-previews');
const saveButton = document.querySelector('#save');
const deleteButton = document.querySelector('#delete');
const resetButton = document.querySelector('#reset');
const viewLink = document.querySelector('#view-link');

const editId = new URLSearchParams(location.search).get('edit');
let original = null;  // la ricetta che si sta modificando (null se nuova)
let photos = [];      // foto in ordine: { id } se già salvate, { url } se appena scelte
let recipes = [];
let busy = false;

fields.category.innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.singular}</option>`).join('');

if (!accountsEnabled) {
  gate.innerHTML = gateMessage({
    title: 'L’area riservata non è ancora attiva.',
    text: 'Per aggiungere ricette dal sito bisogna collegarlo a Firebase: trovi le istruzioni nel README.',
  });
} else {
  await whenSessionReady();
  updateGate();
  onSessionChange(() => { if (!busy) updateGate(); });
  await init();
}

function updateGate() {
  editor.hidden = !session.isAdmin;
  if (session.isAdmin) {
    gate.innerHTML = '';
  } else if (session.user) {
    gate.innerHTML = gateMessage({
      title: 'Quest’area è riservata.',
      text: 'Solo l’account amministratore può aggiungere, modificare o eliminare ricette.',
      action: '<a class="btn btn--primary" href="ricette.html">Torna alle ricette</a>',
    });
  } else {
    gate.innerHTML = gateMessage({
      title: 'Area riservata.',
      text: 'Accedi con l’account amministratore per aggiungere o modificare le ricette.',
      action: `<a class="btn btn--primary" href="${loginUrl()}">Accedi</a>`,
    });
  }
}

async function init() {
  try {
    recipes = await loadRecipes();
  } catch (error) {
    setStatus('error', `Non riesco a leggere le ricette esistenti: ${error.message}`);
  }

  original = editId ? recipes.find((r) => r.id === editId) ?? null : null;
  if (editId && !original) setStatus('error', 'La ricetta da modificare non esiste più: ne stai creando una nuova.');

  if (original) {
    document.title = `Modifica “${original.title}” · ${document.title.split(' · ').pop()}`;
    document.querySelector('#editor-title').textContent = 'Modifica la ricetta';
    document.querySelector('#editor-intro').textContent = 'Le modifiche diventano visibili a tutti quando premi “Salva le modifiche”.';
    document.querySelector('#publish-help').textContent = 'L’indirizzo della pagina resta lo stesso anche se cambi il nome.';
    saveButton.textContent = 'Salva le modifiche';
    viewLink.href = `ricetta.html?id=${encodeURIComponent(original.id)}`;
    viewLink.hidden = false;
    deleteButton.hidden = false;
    resetButton.hidden = true;
    fillForm(original);
    photos = (original.photoIds ?? []).map((id) => ({ id }));
  } else {
    fillForm(readDraft() ?? {});
  }
  renderPhotos();
  updateIdPreview();
}

// ---------- Eventi ----------

form.addEventListener('input', () => {
  updateIdPreview();
  saveDraft();
});
form.addEventListener('submit', (event) => event.preventDefault());

form.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    remove.parentElement.remove();
    renumberSteps();
    saveDraft();
  }
});

ingredientsList.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.target.tagName !== 'INPUT') return;
  event.preventDefault();
  addIngredientRow().querySelector('input').focus();
});

document.querySelector('#add-ingredient').addEventListener('click', () => {
  addIngredientRow().querySelector('input').focus();
});
document.querySelector('#add-step').addEventListener('click', () => {
  addStepRow().querySelector('textarea').focus();
});

photosInput.addEventListener('change', async () => {
  const files = [...photosInput.files];
  photosInput.value = '';
  if (!files.length) return;

  setStatus('', files.length === 1 ? 'Preparo la foto…' : `Preparo ${files.length} foto…`);
  const failed = [];
  for (const file of files) {
    try {
      photos.push({ url: await compressImage(file) });
      renderPhotos();
    } catch (error) {
      console.warn(error);
      failed.push(file.name);
    }
  }
  setStatus(failed.length ? 'error' : '', failed.length ? `Non riesco a leggere: ${failed.join(', ')}. Prova con una foto JPG o PNG.` : '');
});

photoPreviews.addEventListener('click', (event) => {
  const cover = event.target.closest('[data-cover]');
  const remove = event.target.closest('[data-remove-photo]');
  if (cover) {
    const [photo] = photos.splice(Number(cover.dataset.cover), 1);
    photos.unshift(photo);
  } else if (remove) {
    photos.splice(Number(remove.dataset.removePhoto), 1);
  } else {
    return;
  }
  renderPhotos();
});

saveButton.addEventListener('click', async () => {
  const data = buildRecipe();
  if (!validate(data)) return;
  const id = original?.id ?? uniqueId(slugify(data.title) || 'ricetta');

  setBusy(true);
  try {
    await saveRecipe({ id, data, photos, original, onProgress: (message) => setStatus('', message) });
    if (!original) clearDraft();
    setStatus('ok', 'Fatto! Ti porto alla ricetta…');
    location.href = `ricetta.html?id=${encodeURIComponent(id)}`;
  } catch (error) {
    console.error(error);
    setStatus('error', error.code === 'permission-denied'
      ? 'Permesso negato: solo l’account amministratore può salvare le ricette.'
      : `Salvataggio non riuscito: ${error.message}`);
    setBusy(false);
  }
});

deleteButton.addEventListener('click', async () => {
  if (!original || !confirm(`Eliminare definitivamente “${original.title}”? Verranno cancellate anche le sue foto.`)) return;
  setBusy(true);
  try {
    await deleteRecipe(original);
    location.href = 'ricette.html';
  } catch (error) {
    console.error(error);
    setStatus('error', `Eliminazione non riuscita: ${error.message}`);
    setBusy(false);
  }
});

resetButton.addEventListener('click', () => {
  if (!confirm('Vuoi davvero svuotare il modulo? La bozza verrà cancellata.')) return;
  clearDraft();
  photos = [];
  fillForm({});
  renderPhotos();
  updateIdPreview();
  setStatus('', '');
});

document.querySelector('#import-samples').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (!confirm('Aggiungere al sito le ricette di esempio che non ci sono ancora?')) return;
  button.disabled = true;
  try {
    const count = await importSampleRecipes();
    toolsStatus.className = 'status status--ok';
    toolsStatus.textContent = count ? `Importate ${count} ricette.` : 'Erano già tutte presenti.';
    recipes = await loadRecipes();
  } catch (error) {
    console.error(error);
    toolsStatus.className = 'status status--error';
    toolsStatus.textContent = `Importazione non riuscita: ${error.message}`;
  }
  button.disabled = false;
});

document.querySelector('#backup').addEventListener('click', async () => {
  try {
    const json = await exportRecipesJson();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    link.download = `letipescettario-ricette-${today()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (error) {
    console.error(error);
    toolsStatus.className = 'status status--error';
    toolsStatus.textContent = `Copia non riuscita: ${error.message}`;
  }
});

// ---------- Righe dinamiche e foto ----------

function addIngredientRow({ name = '', qty = null, unit = '' } = {}) {
  const row = document.createElement('div');
  row.className = 'ing-row';
  row.innerHTML = `
    <input class="input" data-field="name" placeholder="Ingrediente" aria-label="Ingrediente" value="${escapeHtml(name)}">
    <input class="input" data-field="qty" inputmode="decimal" placeholder="Q.tà" aria-label="Quantità" value="${qty == null ? '' : String(qty).replace('.', ',')}">
    <input class="input" data-field="unit" list="units" placeholder="Unità" aria-label="Unità di misura" value="${escapeHtml(unit)}">
    <button type="button" class="icon-btn" data-remove aria-label="Rimuovi ingrediente">${ICONS.close}</button>`;
  ingredientsList.append(row);
  return row;
}

function addStepRow(text = '') {
  const row = document.createElement('div');
  row.className = 'step-row';
  row.innerHTML = `
    <span class="step-row__num" aria-hidden="true"></span>
    <textarea class="input" rows="2" placeholder="Descrivi il passaggio…" aria-label="Passaggio">${escapeHtml(text)}</textarea>
    <button type="button" class="icon-btn" data-remove aria-label="Rimuovi passaggio">${ICONS.close}</button>`;
  stepsList.append(row);
  renumberSteps();
  return row;
}

function renumberSteps() {
  stepsList.querySelectorAll('.step-row__num').forEach((el, i) => { el.textContent = i + 1; });
}

function renderPhotos() {
  photoPreviews.innerHTML = photos.map((photo, i) => `
    <figure class="photo-item">
      ${photo.id ? `<img data-photo="${escapeHtml(photo.id)}" data-eager alt="">` : `<img src="${photo.url}" alt="">`}
      <figcaption>${i === 0 ? 'Copertina' : `Foto ${i + 1}`}</figcaption>
      <div class="photo-item__actions">
        ${i > 0 ? `<button type="button" class="icon-btn" data-cover="${i}" aria-label="Usa la foto ${i + 1} come copertina" title="Usa come copertina">${ICONS.star}</button>` : ''}
        <button type="button" class="icon-btn" data-remove-photo="${i}" aria-label="Rimuovi la foto ${i + 1}" title="Rimuovi">${ICONS.close}</button>
      </div>
    </figure>`).join('');
}

// ---------- Modulo ⇄ ricetta ----------

function parseNumber(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function uniqueId(base) {
  const taken = new Set(recipes.map((r) => r.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

function updateIdPreview() {
  const title = fields.title.value.trim();
  const id = original?.id ?? uniqueId(slugify(title) || 'ricetta');
  idPreview.textContent = title ? `Indirizzo della pagina: ricetta.html?id=${id}` : '';
}

/** I dati della ricetta come vengono salvati (id e foto a parte). */
function buildRecipe() {
  const restTime = parseNumber(fields.restTime.value) ?? 0;
  const read = (row, field) => row.querySelector(`[data-field="${field}"]`).value.trim();

  return {
    title: fields.title.value.trim(),
    category: fields.category.value,
    date: fields.date.value || today(),
    description: fields.description.value.trim(),
    prepTime: parseNumber(fields.prepTime.value) ?? 0,
    cookTime: parseNumber(fields.cookTime.value) ?? 0,
    ...(restTime > 0 && { restTime }),
    difficulty: fields.difficulty.value,
    servings: Math.max(1, Math.round(parseNumber(fields.servings.value) ?? 4)),
    ingredients: [...ingredientsList.children]
      .map((row) => ({ name: read(row, 'name'), qty: parseNumber(read(row, 'qty')), unit: read(row, 'unit') }))
      .filter((ingredient) => ingredient.name),
    steps: [...stepsList.querySelectorAll('textarea')]
      .map((textarea) => textarea.value.trim())
      .filter(Boolean),
    notes: fields.notes.value.trim(),
    tags: fields.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean),
    // Foto con indirizzo fisso delle ricette importate: si conservano.
    ...(original?.images?.length && { images: original.images }),
  };
}

function fillForm(recipe) {
  fields.title.value = recipe.title ?? '';
  fields.category.value = recipe.category ?? CATEGORIES[0].id;
  fields.date.value = recipe.date ?? today();
  fields.description.value = recipe.description ?? '';
  fields.servings.value = recipe.servings ?? 4;
  fields.prepTime.value = recipe.prepTime || '';
  fields.cookTime.value = recipe.cookTime || '';
  fields.restTime.value = recipe.restTime || '';
  fields.difficulty.value = recipe.difficulty ?? 'easy';
  fields.notes.value = recipe.notes ?? '';
  fields.tags.value = (recipe.tags ?? []).join(', ');

  ingredientsList.replaceChildren();
  (recipe.ingredients?.length ? recipe.ingredients : [{}, {}, {}]).forEach((ing) => addIngredientRow(ing));

  stepsList.replaceChildren();
  (recipe.steps?.length ? recipe.steps : ['', '']).forEach((step) => addStepRow(step));
}

function validate(recipe) {
  const missing = [];
  if (!recipe.title) missing.push('il nome');
  if (!recipe.ingredients.length) missing.push('almeno un ingrediente');
  if (!recipe.steps.length) missing.push('almeno un passaggio');
  if (missing.length) {
    setStatus('error', `Manca ${missing.join(', ')}.`);
    return false;
  }
  return true;
}

// ---------- Bozza (solo per le ricette nuove, foto escluse) ----------

function saveDraft() {
  if (original) return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(buildRecipe())); } catch { /* storage non disponibile */ }
}

function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage non disponibile */ }
}

// ---------- Stato ----------

function setBusy(value) {
  busy = value;
  [saveButton, deleteButton, resetButton].forEach((button) => { button.disabled = value; });
}

function setStatus(kind, message) {
  statusEl.className = `status${kind ? ` status--${kind}` : ''}`;
  statusEl.textContent = message;
}
