// Inizializza Firebase, se configurato. Senza configurazione (o se l'SDK non si carica)
// il sito resta utilizzabile in sola lettura: ricette da data/recipes.json, niente account.
import { firebaseConfig } from './firebase-config.js';

const SDK_URL = 'https://www.gstatic.com/firebasejs/12.19.0';

// Per lo sviluppo: con localStorage['letipescettario:emulators'] = '1' su localhost
// il sito usa gli emulatori locali di Firebase invece del progetto vero.
const EMULATOR_FLAG = 'letipescettario:emulators';
const EMULATOR_CONFIG = { apiKey: 'demo-key', projectId: 'demo-letipescettario', authDomain: 'localhost' };

let useEmulators = false;
try {
  useEmulators = ['localhost', '127.0.0.1'].includes(location.hostname)
    && localStorage.getItem(EMULATOR_FLAG) === '1';
} catch { /* storage non disponibile */ }

const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export let auth = null;     // istanza di Firebase Auth
export let db = null;       // istanza di Firestore
export let authSdk = null;  // funzioni del modulo firebase-auth
export let fs = null;       // funzioni del modulo firebase-firestore

if (hasConfig || useEmulators) {
  try {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`${SDK_URL}/firebase-app.js`),
      import(`${SDK_URL}/firebase-auth.js`),
      import(`${SDK_URL}/firebase-firestore.js`),
    ]);
    const app = appModule.initializeApp(useEmulators ? EMULATOR_CONFIG : firebaseConfig);

    authSdk = authModule;
    fs = firestoreModule;
    auth = authModule.getAuth(app);
    db = firestoreModule.initializeFirestore(app, {
      // Cache nel browser: le foto (che non cambiano mai) si scaricano una volta sola.
      localCache: firestoreModule.persistentLocalCache({
        tabManager: firestoreModule.persistentMultipleTabManager(),
      }),
    });

    if (useEmulators) {
      authModule.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      firestoreModule.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
  } catch (error) {
    console.error('Firebase non disponibile, il sito passa in sola lettura.', error);
    auth = db = authSdk = fs = null;
  }
}

/** true quando login, preferiti e area admin sono attivi. */
export const accountsEnabled = Boolean(db);
