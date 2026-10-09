# IL Letipescettario

Sito di ricette statico (solo HTML, CSS e JavaScript) pubblicato su GitHub Pages.
Account, preferiti e area admin usano **Firebase** (piano gratuito Spark, senza carta di credito).

## Struttura

```
index.html          Home: ricetta in evidenza, portate, carosello, ricerca
ricette.html        Tutte le ricette divise per portata (?cat=dessert, ?q=pomodoro)
ricetta.html        Pagina della singola ricetta (?id=spaghetti-alla-carbonara)
preferiti.html      Le ricette salvate dall'utente collegato
login.html          Accesso e registrazione
aggiungi.html       Editor riservato all'admin (?edit=<id> per modificare)
about.html          Chi siamo
css/style.css       Tutto lo stile
js/firebase-config.js  ← configurazione Firebase da compilare
js/firebase.js      Avvio di Firebase (o modalità sola lettura se non configurato)
js/auth.js          Login, registrazione, preferiti
js/store.js         Lettura/scrittura di ricette e foto
js/data.js          Categorie, difficoltà, formattazione
js/ui.js            Header, footer, card, componenti condivisi
js/pages/*.js       Logica di ciascuna pagina
firestore.rules     Regole di sicurezza (chi può leggere/scrivere cosa)
data/recipes.json   Ricette di esempio (importabili dall'area admin)
assets/icons/       Icone delle portate
```

## Come funzionano account e permessi

- Chiunque può leggere le ricette.
- Chi si registra (nome utente + password) può salvare le ricette preferite con il cuore e ritrovarle su ogni dispositivo.
- Solo l'account **`letipesce`** può aggiungere, modificare ed eliminare ricette e foto.
- Il controllo è fatto dalle regole di Firestore ([firestore.rules](firestore.rules)), non dal codice del sito: nessuna password è scritta nei file, e anche chi modifica il JavaScript non può scrivere ricette.
- Firebase vuole un'email, quindi il nome utente diventa `nome@letipescettario.example.com`. Nessuna email viene inviata: per questo **la password non si può reimpostare dal sito**.

Finché `js/firebase-config.js` è vuoto il sito funziona in sola lettura con le ricette di `data/recipes.json` (senza login né preferiti).

## Configurare Firebase (una volta sola, ~10 minuti)

1. Vai su <https://console.firebase.google.com> → **Crea un progetto** (es. `letipescettario`). Google Analytics non serve.
2. **Build → Authentication → Inizia → Metodo di accesso**: abilita **Email/password** (solo il primo interruttore) e salva.
3. **Build → Firestore Database → Crea database**: scegli una località in Europa (es. `eur3`), modalità **produzione**.
4. **Firestore → Regole**: sostituisci tutto con il contenuto di [firestore.rules](firestore.rules) e premi **Pubblica**.
5. **Impostazioni progetto** (ingranaggio) → **Le tue app** → icona **Web `</>`** → registra l'app (Firebase Hosting non serve) e copia i valori di `firebaseConfig` in [js/firebase-config.js](js/firebase-config.js).
6. **Prima di pubblicare il sito**, crea l'account admin: avvia il sito in locale (vedi sotto), vai su *Accedi → Registrati* e crea l'utente `letipesce` con una password robusta. Va fatto per primo, così nessun altro può prendersi quel nome utente.
7. Entra come `letipesce` → **Aggiungi** → *Strumenti* → **Importa ricette di esempio** (facoltativo).
8. Carica tutto su GitHub.

Se cambi nome utente admin, aggiornalo sia in `js/firebase-config.js` sia in `firestore.rules`.

## Aggiungere o modificare una ricetta

Entra come `letipesce`:

- **Aggiungi** (nel menu): compila il modulo, scegli le foto e premi *Pubblica*. Le foto vengono ridimensionate e compresse automaticamente.
- In ogni ricetta trovi **Modifica** ed **Elimina**.
- *Strumenti → Scarica copia di sicurezza* salva i testi di tutte le ricette in un file JSON.

## Provarlo sul computer

Il browser non permette di leggere i dati se apri `index.html` con un doppio clic. Avvia un piccolo server dalla cartella del progetto:

```bash
python -m http.server 8000
```

e apri <http://localhost:8000>. In VS Code va bene anche l'estensione *Live Server*.

### Sviluppo con gli emulatori di Firebase (facoltativo)

Per provare login e salvataggi senza toccare il progetto vero:

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-letipescettario
```

poi, nella console del browser su `localhost:8000`, esegui `localStorage.setItem('letipescettario:emulators', '1')` e ricarica. Per tornare al progetto vero: `localStorage.removeItem('letipescettario:emulators')`.

## Pubblicare su GitHub Pages

1. Crea un repository e carica tutti i file.
2. *Settings → Pages → Build and deployment*: Source **Deploy from a branch**, branch `main`, cartella `/ (root)`.
3. Il sito sarà su `https://<utente>.github.io/<nome-repository>/`.

## Formato di una ricetta

| Campo | Note |
|---|---|
| `title` | Nome della ricetta. L'`id` (indirizzo `ricetta.html?id=…`) viene creato dal nome alla prima pubblicazione e non cambia più. |
| `category` | `appetizer`, `first_dish`, `second_dish`, `side_dish`, `dessert` |
| `date` | `AAAA-MM-GG`. La home sceglie a caso tra le 5 ricette più recenti. |
| `photoIds` / `thumbId` | Foto salvate in Firestore (la prima è la copertina) e miniatura per le card. |
| `prepTime` / `cookTime` / `restTime` | Minuti. `restTime` (riposo) è facoltativo. |
| `difficulty` | `easy`, `medium`, `hard` |
| `servings` | Persone per cui valgono le dosi. |
| `ingredients` | `{ "name", "qty", "unit" }`: `qty` è un numero o `null` per "q.b."; le dosi si ricalcolano cambiando il numero di persone. Le unità si scrivono al singolare (`cucchiaio`, `spicchio`…), il plurale è automatico. |
| `steps`, `notes`, `tags` | Passaggi, consigli, parole chiave per la ricerca. |
