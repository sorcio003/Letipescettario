// Configurazione di Firebase: incolla qui i valori del tuo progetto
// (Console Firebase → Impostazioni progetto → Le tue app → App web → Configurazione SDK).
// Questi valori NON sono segreti: chi può leggere o scrivere cosa lo decidono le regole in firestore.rules.
// Finché restano vuoti il sito funziona in sola lettura con le ricette di data/recipes.json.
export const firebaseConfig = {
  apiKey: "AIzaSyB7O07P3cDe01reBL9ND8_WnxGR7PsdJeI",
  authDomain: "il-letipescettario.firebaseapp.com",
  projectId: "il-letipescettario",
  storageBucket: "il-letipescettario.firebasestorage.app",
  messagingSenderId: "1067898080164",
  appId: "1:1067898080164:web:c51246c31a6b6b8aaf0f31",
  measurementId: "G-841SHCW1WY"
};

// Nome utente dell'amministratrice: l'unica che può aggiungere, modificare ed eliminare ricette.
// Se lo cambi, aggiorna anche l'email in firestore.rules.
export const ADMIN_USERNAME = 'letipesce';

// Firebase vuole un'email, quindi ogni nome utente diventa "<nome>@<questo dominio>".
// Nessuna email viene mai inviata: è solo un identificativo.
export const USERNAME_EMAIL_DOMAIN = 'letipescettario.example.com';
