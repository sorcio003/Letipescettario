// Sessione utente: login, registrazione, logout e ricette preferite.
import { auth, db, authSdk, fs, accountsEnabled } from './firebase.js';
import { ADMIN_USERNAME, USERNAME_EMAIL_DOMAIN } from './firebase-config.js';

const HINT_KEY = 'letipescettario:session';

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/;

export const session = {
  ready: false,
  user: null,
  username: null,
  isAdmin: false,
  favorites: new Set(),
  favoritesLoaded: false,
};

const listeners = new Set();
let resolveReady;
const ready = new Promise((resolve) => { resolveReady = resolve; });
let stopProfileWatch = null;

/** Si risolve quando Firebase ha deciso se c'è un utente collegato. */
export function whenSessionReady() {
  return ready;
}

export function onSessionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener(session));
}

/** Utente dell'ultima visita: serve a disegnare subito l'header senza aspettare Firebase. */
export function sessionHint() {
  try { return JSON.parse(localStorage.getItem(HINT_KEY)); } catch { return null; }
}

function saveHint() {
  try {
    if (session.user) localStorage.setItem(HINT_KEY, JSON.stringify({ username: session.username, isAdmin: session.isAdmin }));
    else localStorage.removeItem(HINT_KEY);
  } catch { /* storage non disponibile */ }
}

export const normalizeUsername = (username) => String(username ?? '').trim().toLowerCase();
const emailOf = (username) => `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
const usernameOf = (user) => user.email?.split('@')[0] ?? '';

if (accountsEnabled) {
  authSdk.onAuthStateChanged(auth, (user) => {
    stopProfileWatch?.();
    stopProfileWatch = null;

    session.user = user;
    session.username = user ? usernameOf(user) : null;
    session.isAdmin = session.username === ADMIN_USERNAME;
    session.favorites = new Set();
    session.favoritesLoaded = false;
    saveHint();
    if (user) watchProfile(user);

    session.ready = true;
    resolveReady(session);
    notify();
  });
} else {
  session.ready = true;
  resolveReady(session);
}

function watchProfile(user) {
  const ref = fs.doc(db, 'users', user.uid);
  stopProfileWatch = fs.onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      // Primo accesso (o account creato dalla console): creiamo il profilo.
      // Solo se il server conferma che non esiste, per non sovrascrivere i preferiti.
      if (!snapshot.metadata.fromCache) {
        fs.setDoc(ref, { username: usernameOf(user), favorites: [], createdAt: fs.serverTimestamp() })
          .catch((error) => console.error('Impossibile creare il profilo', error));
      }
      return;
    }
    session.favorites = new Set(snapshot.data().favorites ?? []);
    session.favoritesLoaded = true;
    notify();
  }, (error) => console.error('Impossibile leggere il profilo', error));
}

export async function login(username, password) {
  await authSdk.signInWithEmailAndPassword(auth, emailOf(username), password);
}

export async function register(username, password) {
  if (!USERNAME_PATTERN.test(normalizeUsername(username))) {
    throw Object.assign(new Error('Nome utente non valido'), { code: 'app/invalid-username' });
  }
  await authSdk.createUserWithEmailAndPassword(auth, emailOf(username), password);
}

export function logout() {
  return authSdk.signOut(auth);
}

/** Indirizzo della pagina di login che, dopo l'accesso, riporta alla pagina corrente. */
export function loginUrl() {
  const here = (location.pathname.split('/').pop() || 'index.html') + location.search;
  if (here.startsWith('login.html')) return here;
  return `login.html?next=${encodeURIComponent(here)}`;
}

export async function toggleFavorite(recipeId) {
  if (!session.user) {
    location.href = loginUrl();
    return;
  }
  const wasFavorite = session.favorites.has(recipeId);
  // Aggiorniamo subito l'interfaccia; se il salvataggio fallisce torniamo indietro.
  if (wasFavorite) session.favorites.delete(recipeId);
  else session.favorites.add(recipeId);
  notify();

  try {
    await fs.updateDoc(fs.doc(db, 'users', session.user.uid), {
      favorites: wasFavorite ? fs.arrayRemove(recipeId) : fs.arrayUnion(recipeId),
    });
  } catch (error) {
    if (wasFavorite) session.favorites.add(recipeId);
    else session.favorites.delete(recipeId);
    notify();
    throw error;
  }
}

export function authErrorMessage(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Nome utente o password non corretti.';
    case 'auth/email-already-in-use':
      return 'Questo nome utente è già preso: scegline un altro.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'La password deve avere almeno 6 caratteri.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi: riprova tra qualche minuto.';
    case 'auth/network-request-failed':
      return 'Problema di connessione: controlla internet e riprova.';
    case 'app/invalid-username':
      return 'Il nome utente deve avere 3-20 caratteri: lettere minuscole, numeri, punto, trattino o underscore.';
    default:
      return 'Qualcosa è andato storto, riprova.';
  }
}
