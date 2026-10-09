// Lettura e scrittura di ricette e foto.
// Con Firebase attivo i dati stanno in Firestore; altrimenti si leggono da data/recipes.json.
import { db, fs, accountsEnabled } from './firebase.js';

const SAMPLE_RECIPES_URL = 'data/recipes.json';
const PHOTO_MAX_SIDE = 1600;
const THUMB_MAX_SIDE = 520;
const MAX_PHOTO_CHARS = 900_000; // un documento Firestore può pesare al massimo 1 MB

let recipesPromise;

/** Tutte le ricette, dalla più recente. Caricate una sola volta per pagina. */
export function loadRecipes() {
  recipesPromise ??= (accountsEnabled ? fetchFromFirestore() : fetchSampleRecipes())
    .then((list) => list.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
  return recipesPromise;
}

async function fetchFromFirestore() {
  const snapshot = await fs.getDocs(fs.collection(db, 'recipes'));
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
}

async function fetchSampleRecipes() {
  const res = await fetch(SAMPLE_RECIPES_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${SAMPLE_RECIPES_URL} → HTTP ${res.status}`);
  return res.json();
}

// ---------- Foto ----------

const photoCache = new Map();

/** Restituisce la foto (data URL). Le foto non cambiano mai, quindi la cache del browser va bene. */
export function getPhotoUrl(photoId) {
  if (!photoCache.has(photoId)) {
    photoCache.set(photoId, (async () => {
      const ref = fs.doc(db, 'photos', photoId);
      let snapshot = await fs.getDocFromCache(ref).catch(() => null);
      if (!snapshot?.exists()) snapshot = await fs.getDoc(ref);
      if (!snapshot.exists()) throw new Error(`Foto ${photoId} non trovata`);
      return snapshot.data().data;
    })());
  }
  return photoCache.get(photoId);
}

/** Ridimensiona e comprime un'immagine (File o data URL) in un JPEG che stia in un documento Firestore. */
export async function compressImage(source, maxSide = PHOTO_MAX_SIDE, quality = 0.82, maxChars = MAX_PHOTO_CHARS) {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));

  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      context.fillStyle = '#fff'; // le parti trasparenti dei PNG diventano bianche
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= maxChars) return dataUrl;
      quality = Math.max(0.55, quality - 0.08);
      scale *= 0.85;
    }
  } finally {
    bitmap.close();
  }
  throw new Error('Foto troppo pesante anche dopo la compressione');
}

async function addPhoto(dataUrl, recipeId, kind) {
  const ref = fs.doc(fs.collection(db, 'photos'));
  await fs.setDoc(ref, { data: dataUrl, recipeId, kind });
  photoCache.set(ref.id, Promise.resolve(dataUrl));
  return ref.id;
}

// ---------- Scrittura (solo admin: lo garantiscono le regole di Firestore) ----------

/**
 * Salva una ricetta nuova o modificata.
 * `photos` è la lista ordinata delle foto ({ id } se già salvate, { url } se nuove): la prima è la copertina.
 * `original` è la ricetta prima della modifica (null se nuova). `onProgress` riceve messaggi di stato.
 */
export async function saveRecipe({ id, data, photos, original = null, onProgress = () => {} }) {
  const newPhotos = photos.filter((photo) => !photo.id);
  for (const [index, photo] of newPhotos.entries()) {
    onProgress(`Carico la foto ${index + 1} di ${newPhotos.length}…`);
    photo.id = await addPhoto(photo.url, id, 'full');
  }
  const photoIds = photos.map((photo) => photo.id);

  // Miniatura della copertina, usata nelle card: si rigenera solo se cambia la copertina.
  let thumbId = original?.thumbId ?? null;
  if (!photoIds.length) {
    thumbId = null;
  } else if (!thumbId || photoIds[0] !== original?.photoIds?.[0]) {
    onProgress('Preparo la miniatura…');
    const coverUrl = photos[0].url ?? await getPhotoUrl(photos[0].id);
    thumbId = await addPhoto(await compressImage(coverUrl, THUMB_MAX_SIDE, 0.75, 200_000), id, 'thumb');
  }

  onProgress('Salvo la ricetta…');
  const now = fs.serverTimestamp();
  await fs.setDoc(fs.doc(db, 'recipes', id), {
    ...data,
    photoIds,
    thumbId,
    createdAt: original?.createdAt ?? now,
    updatedAt: now,
  });

  const obsolete = (original?.photoIds ?? []).filter((photoId) => !photoIds.includes(photoId));
  if (original?.thumbId && original.thumbId !== thumbId) obsolete.push(original.thumbId);
  if (obsolete.length) {
    const batch = fs.writeBatch(db);
    obsolete.forEach((photoId) => batch.delete(fs.doc(db, 'photos', photoId)));
    await batch.commit();
  }
  recipesPromise = undefined;
}

export async function deleteRecipe(recipe) {
  const batch = fs.writeBatch(db);
  batch.delete(fs.doc(db, 'recipes', recipe.id));
  [...(recipe.photoIds ?? []), recipe.thumbId]
    .filter(Boolean)
    .forEach((photoId) => batch.delete(fs.doc(db, 'photos', photoId)));
  await batch.commit();
  recipesPromise = undefined;
}

/** Copia in Firestore le ricette di esempio di data/recipes.json che non ci sono ancora. */
export async function importSampleRecipes() {
  const [samples, existing] = await Promise.all([fetchSampleRecipes(), fetchFromFirestore()]);
  const existingIds = new Set(existing.map((r) => r.id));
  const missing = samples.filter((r) => !existingIds.has(r.id));
  if (missing.length) {
    const batch = fs.writeBatch(db);
    const now = fs.serverTimestamp();
    missing.forEach(({ id, ...recipe }) => {
      batch.set(fs.doc(db, 'recipes', id), { ...recipe, photoIds: [], thumbId: null, createdAt: now, updatedAt: now });
    });
    await batch.commit();
  }
  recipesPromise = undefined;
  return missing.length;
}

/** Testo JSON con tutte le ricette (senza foto), da tenere come copia di sicurezza. */
export async function exportRecipesJson() {
  const recipes = await fetchFromFirestore();
  const clean = recipes.map(({ createdAt, updatedAt, ...recipe }) => recipe);
  return `${JSON.stringify(clean, null, 2)}\n`;
}
