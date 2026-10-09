import { accountsEnabled } from '../firebase.js';
import {
  session, whenSessionReady, onSessionChange, login, register, logout, authErrorMessage,
} from '../auth.js';
import { mountLayout, escapeHtml, gateMessage } from '../ui.js';

mountLayout('login');

const forms = document.querySelector('#auth-forms');
const message = document.querySelector('#auth-message');
const form = document.querySelector('#auth-form');
const title = document.querySelector('#auth-title');
const submit = document.querySelector('#auth-submit');
const errorEl = document.querySelector('#auth-error');
const confirmField = document.querySelector('#confirm-field');
const usernameHelp = document.querySelector('#username-help');
const tabs = document.querySelectorAll('.auth-tabs [role="tab"]');

let mode = 'login';
let busy = false;

// Dopo l'accesso torniamo alla pagina di prima (solo pagine di questo sito).
const next = new URLSearchParams(location.search).get('next');
const redirectTo = next && /^[a-z]+\.html(\?[^#]*)?$/.test(next) ? next : 'index.html';

if (!accountsEnabled) {
  message.innerHTML = gateMessage({
    title: 'Gli account non sono ancora attivi.',
    text: 'Per usare login e preferiti bisogna collegare il sito a Firebase: trovi le istruzioni nel README.',
  });
} else {
  await whenSessionReady();
  render();
  onSessionChange(() => { if (!busy) render(); });
}

function render() {
  if (session.user) {
    forms.hidden = true;
    message.innerHTML = `
      <div class="gate">
        <p><strong>Hai già effettuato l’accesso come ${escapeHtml(session.username)}.</strong></p>
        <div class="actions actions--center">
          <a class="btn btn--primary" href="preferiti.html">I miei preferiti</a>
          <button class="btn btn--ghost" type="button" id="logout">Esci</button>
        </div>
      </div>`;
    message.querySelector('#logout').addEventListener('click', () => logout());
  } else {
    message.innerHTML = '';
    forms.hidden = false;
  }
}

function setMode(newMode) {
  mode = newMode;
  const registering = mode === 'register';
  tabs.forEach((tab) => {
    const selected = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', selected);
    if (selected) form.setAttribute('aria-labelledby', tab.id);
  });
  title.textContent = registering ? 'Crea il tuo account' : 'Entra in cucina';
  submit.textContent = registering ? 'Crea account' : 'Accedi';
  confirmField.hidden = !registering;
  usernameHelp.hidden = !registering;
  form.password.autocomplete = registering ? 'new-password' : 'current-password';
  errorEl.textContent = '';
}

tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = form.username.value.trim();
  const password = form.password.value;
  errorEl.textContent = '';

  if (!username || !password) {
    errorEl.textContent = 'Inserisci nome utente e password.';
    return;
  }
  if (mode === 'register' && password !== form.password2.value) {
    errorEl.textContent = 'Le due password non coincidono.';
    return;
  }

  busy = true;
  submit.disabled = true;
  submit.textContent = mode === 'register' ? 'Creo l’account…' : 'Accesso in corso…';
  try {
    if (mode === 'register') await register(username, password);
    else await login(username, password);
    location.href = redirectTo;
  } catch (error) {
    console.warn(error);
    errorEl.textContent = authErrorMessage(error);
    busy = false;
    submit.disabled = false;
    submit.textContent = mode === 'register' ? 'Crea account' : 'Accedi';
  }
});
