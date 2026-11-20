/* =====================================================================
 * Barista de Bolsillo — CUENTAS, SINCRONIZACIÓN Y COMUNIDAD
 * ---------------------------------------------------------------------
 * - Cuenta con email + contraseña (Supabase Auth).
 * - Local primero: la app sigue guardando todo en el dispositivo y
 *   funciona sin internet. Con sesión iniciada, recetas, bitácora y catas
 *   se sincronizan solas con la nube (BL.planSync decide qué sube/baja).
 * - Comunidad: publicar recetas de "Mi café ideal", explorarlas, darles
 *   ❤️, guardarlas y prepararlas. Link público: ?receta=<id>
 * La librería de Supabase (js/vendor/supabase.js) se carga recién cuando
 * hace falta, así no frena el arranque de la app.
 * Depende de: BDB_CONFIG (config.js), BL, app.js, wheel.js, features.js
 * ===================================================================== */

const Cloud = {
  client: null, user: null, profile: null,
  state: 'idle',          // idle | syncing | ok | error | offline
  lastSync: null, syncing: false, pending: false, timer: null, applying: false,
  authMode: 'login', recovery: false, notice: null,
  feed: { sort: 'popular', brewer: 'all', q: '', page: 0, items: [], liked: new Set(), done: false, loading: false, error: null }
};
const PAGE_SIZE = 20;

function cloudConfig() { return window.BDB_CONFIG_OVERRIDE || (typeof BDB_CONFIG !== 'undefined' ? BDB_CONFIG : {}); }
function cloudConfigured() { const c = cloudConfig(); return !!(c.supabaseUrl && c.supabaseAnonKey); }
function siteUrl() { return cloudConfig().siteUrl || (location.origin + location.pathname); }

function loadSupabaseLib() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './js/vendor/supabase.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initCloud() {
  syncCloudVisibility();
  if (!cloudConfigured()) return;
  hookPersistence();
  try { await loadSupabaseLib(); } catch (e) { Cloud.state = 'offline'; renderAccountButton(); return; }
  const c = cloudConfig();
  Cloud.client = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'baristaAuth' }
  });
  // Recomendación de Supabase: no esperar llamadas a Supabase dentro de este callback
  Cloud.client.auth.onAuthStateChange((event, session) => { setTimeout(() => onAuthChange(event, session), 0); });
  try {
    const { data } = await Cloud.client.auth.getSession();
    await onAuthChange('INITIAL', data && data.session);
  } catch (e) { /* sin red: se reintenta al volver la conexión */ }
  checkPublicRecipeParam();
  window.addEventListener('online', () => { Cloud.state = 'idle'; scheduleSync(500); renderSyncStatus(); });
  window.addEventListener('offline', () => { Cloud.state = 'offline'; renderSyncStatus(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(1000); });
}

async function onAuthChange(event, session) {
  if (event === 'PASSWORD_RECOVERY') { Cloud.recovery = true; goToAccount(); }
  const prevId = Cloud.user && Cloud.user.id;
  Cloud.user = session ? session.user : null;
  if (Cloud.user && Cloud.user.id !== prevId) {
    await loadProfile();
    scheduleSync(0);
  }
  if (!Cloud.user) { Cloud.profile = null; Cloud.feed.liked = new Set(); }
  renderAccountButton();
  refreshCloudScreens();
}

function refreshCloudScreens() {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  if (active.id === 'screen-account') renderAccount();
  if (active.id === 'screen-saved') renderSavedRecipes();
  if (active.id === 'screen-community') renderCommunity();
}

async function loadProfile() {
  if (!Cloud.user) return;
  const { data } = await Cloud.client.from('profiles').select('id, username, display_name').eq('id', Cloud.user.id).maybeSingle();
  Cloud.profile = data || { id: Cloud.user.id, username: null };
}

/* ---------------- Botón de cuenta y accesos ---------------- */
function syncCloudVisibility() {
  const on = cloudConfigured();
  document.querySelectorAll('[data-cloud-only]').forEach(el => { el.hidden = !on; });
  renderAccountButton();
}
function userLabel() {
  if (!Cloud.user) return '';
  return (Cloud.profile && Cloud.profile.username) ? '@' + Cloud.profile.username : (Cloud.user.email || '');
}
function renderAccountButton() {
  const b = document.getElementById('account-btn');
  if (!b) return;
  b.hidden = !cloudConfigured();
  if (Cloud.user) {
    const name = (Cloud.profile && Cloud.profile.username) || Cloud.user.email || '?';
    b.textContent = name.charAt(0).toUpperCase();
    b.classList.add('in');
    b.setAttribute('aria-label', t('accountBtnIn', { name: userLabel() }));
  } else {
    b.textContent = '👤';
    b.classList.remove('in');
    b.setAttribute('aria-label', t('accountBtnOut'));
  }
}

/* ---------------- Pantalla Mi cuenta ---------------- */
function goToAccount() { renderAccount(); showScreen('screen-account'); }

function renderAccount() {
  const box = document.getElementById('account-body');
  if (!box) return;
  if (!cloudConfigured()) { box.innerHTML = `<div class="free-card"><p class="muted">${esc(t('cloudNotConfigured'))}</p></div>`; return; }
  if (!Cloud.client) { box.innerHTML = `<div class="free-card"><p class="muted">${esc(t('cloudLoading'))}</p></div>`; return; }
  if (Cloud.recovery && Cloud.user) { box.innerHTML = recoveryFormHtml(); return; }
  box.innerHTML = Cloud.user ? accountHtml() : authFormHtml();
  if (Cloud.user) renderSyncStatus();
}

function authFormHtml() {
  const signup = Cloud.authMode === 'signup';
  return `
    <div class="free-card">
      <div class="seg" role="tablist" aria-label="${esc(t('accountTitle'))}">
        <button type="button" class="seg-btn" role="tab" aria-selected="${!signup}" onclick="setAuthMode('login')">${esc(t('authLogin'))}</button>
        <button type="button" class="seg-btn" role="tab" aria-selected="${signup}" onclick="setAuthMode('signup')">${esc(t('authSignup'))}</button>
      </div>
      <form class="form-grid auth-form" onsubmit="submitAuth(event)" novalidate>
        <label class="field"><span>${esc(t('authEmail'))}</span>
          <input type="email" id="auth-email" autocomplete="email" inputmode="email" required maxlength="200"></label>
        <label class="field"><span>${esc(t('authPassword'))}</span>
          <input type="password" id="auth-password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="8" maxlength="72"></label>
        ${signup ? `<label class="field"><span>${esc(t('authUsername'))}</span>
          <input type="text" id="auth-username" autocomplete="username" required maxlength="24" pattern="[a-zA-Z0-9_.]{3,24}" placeholder="${esc(t('authUsernamePh'))}">
          <small class="muted">${esc(t('authUsernameHint'))}</small></label>` : ''}
        <div class="auth-msg" id="auth-msg" role="alert">${Cloud.notice ? esc(Cloud.notice) : ''}</div>
        <button type="submit" class="next-btn enabled" id="auth-submit">${esc(t(signup ? 'authSignupBtn' : 'authLoginBtn'))}</button>
      </form>
      ${signup ? '' : `<button type="button" class="link-btn" onclick="forgotPassword()">${esc(t('authForgot'))}</button>`}
    </div>
    <div class="free-card benefits">
      <div class="free-card-title">${esc(t('accountWhyTitle'))}</div>
      <ul class="benefit-list">
        <li>☁️ ${esc(t('accountWhy1'))}</li>
        <li>🌍 ${esc(t('accountWhy2'))}</li>
        <li>🔒 ${esc(t('accountWhy3'))}</li>
      </ul>
    </div>`;
}

function recoveryFormHtml() {
  return `<div class="free-card">
    <div class="free-card-title">${esc(t('authNewPassTitle'))}</div>
    <form class="form-grid" onsubmit="submitNewPassword(event)">
      <label class="field"><span>${esc(t('authNewPass'))}</span>
        <input type="password" id="auth-newpass" autocomplete="new-password" required minlength="8" maxlength="72"></label>
      <div class="auth-msg" id="auth-msg" role="alert"></div>
      <button type="submit" class="next-btn enabled">${esc(t('authNewPassBtn'))}</button>
    </form></div>`;
}

function accountHtml() {
  const p = Cloud.profile || {};
  const initial = ((p.username || Cloud.user.email || '?').charAt(0) || '?').toUpperCase();
  const counts = t('accountCounts', { r: savedRecipes.length, l: brewLog.length, c: catas.length });
  return `
    <div class="free-card account-card">
      <div class="account-head">
        <div class="avatar" aria-hidden="true">${esc(initial)}</div>
        <div><div class="account-name">${p.username ? '@' + esc(p.username) : esc(t('accountNoUsername'))}</div>
          <div class="muted small">${esc(Cloud.user.email || '')}</div></div>
      </div>
      <form class="username-row" onsubmit="saveUsername(event)">
        <label class="field"><span>${esc(t('authUsername'))}</span>
          <input type="text" id="acc-username" value="${esc(p.username || '')}" maxlength="24" pattern="[a-zA-Z0-9_.]{3,24}" autocomplete="username"></label>
        <button type="submit" class="go-free-btn small">${esc(t('accountSaveUsername'))}</button>
      </form>
      <div class="auth-msg" id="auth-msg" role="alert"></div>
    </div>
    <div class="free-card">
      <div class="free-card-title">${esc(t('syncTitle'))}</div>
      <p class="sync-status" id="sync-status" aria-live="polite"></p>
      <p class="muted small">${esc(counts)}</p>
      <button type="button" class="next-btn enabled" onclick="syncNow(true)">${esc(t('syncNow'))}</button>
    </div>
    <button type="button" class="tool-btn" onclick="goToCommunity()"><span class="tool-ico" aria-hidden="true">🌍</span><span>${esc(t('toolCommunity'))}</span></button>
    <div class="account-actions">
      <button type="button" class="go-free-btn" onclick="signOut(false)">${esc(t('authLogout'))}</button>
      <button type="button" class="link-btn" onclick="signOut(true)">${esc(t('authLogoutClear'))}</button>
      <button type="button" class="link-btn danger-link" onclick="armDelete(this, deleteAccount)">${esc(t('accountDelete'))}</button>
      <p class="muted small">${esc(t('accountDeleteHint'))}</p>
    </div>`;
}

function setAuthMode(m) { Cloud.authMode = m; Cloud.notice = null; renderAccount(); const e = document.getElementById('auth-email'); if (e) e.focus(); }

function authMsg(text, ok) {
  const el = document.getElementById('auth-msg');
  if (!el) { toast(text); return; }
  el.textContent = text || '';
  el.classList.toggle('ok', !!ok);
}

// Traduce los errores de Supabase a mensajes claros
function friendlyAuthError(err) {
  const m = String((err && (err.message || err.error_description)) || err || '').toLowerCase();
  const code = err && (err.code || err.status);
  if (!navigator.onLine || m.includes('failed to fetch') || m.includes('network')) return t('errNetwork');
  if (m.includes('invalid login credentials')) return t('errInvalidLogin');
  if (m.includes('email not confirmed')) return t('errNotConfirmed');
  if (m.includes('already registered') || m.includes('already been registered')) return t('errUserExists');
  if (m.includes('password should be') || m.includes('weak')) return t('errWeakPassword');
  if (m.includes('rate limit') || code === 429 || m.includes('too many')) return t('errRateLimit');
  if (m.includes('invalid') && m.includes('email')) return t('errBadEmail');
  if (code === '23505' || m.includes('duplicate')) return t('errUsernameTaken');
  return t('errGeneric');
}

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,24}$/;

async function submitAuth(ev) {
  ev.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const btn = document.getElementById('auth-submit');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { authMsg(t('errBadEmail')); return; }
  if (password.length < 8) { authMsg(t('errWeakPassword')); return; }
  btn.disabled = true;
  try {
    if (Cloud.authMode === 'signup') {
      const username = document.getElementById('auth-username').value.trim();
      if (!USERNAME_RE.test(username)) { authMsg(t('authUsernameHint')); return; }
      const { data: taken } = await Cloud.client.from('profiles').select('id').eq('username', username).maybeSingle();
      if (taken) { authMsg(t('errUsernameTaken')); return; }
      const { data, error } = await Cloud.client.auth.signUp({
        email, password, options: { data: { username, display_name: username }, emailRedirectTo: siteUrl() }
      });
      if (error) { authMsg(friendlyAuthError(error)); return; }
      if (!data.session) {
        Cloud.authMode = 'login';
        Cloud.notice = t('authCheckEmail', { email });
        renderAccount();
        document.getElementById('auth-email').value = email;
        document.getElementById('auth-password').value = password;   // para ingresar apenas confirme
        document.getElementById('auth-msg').classList.add('ok');
        return;
      }
      toast(t('authWelcome'));
    } else {
      const { error } = await Cloud.client.auth.signInWithPassword({ email, password });
      if (error) { authMsg(friendlyAuthError(error)); return; }
      Cloud.notice = null;
      toast(t('authLoggedIn'));
    }
  } catch (e) {
    authMsg(friendlyAuthError(e));
  } finally {
    if (document.body.contains(btn)) btn.disabled = false;
  }
}

async function forgotPassword() {
  const email = (document.getElementById('auth-email').value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { authMsg(t('authForgotNeedEmail')); document.getElementById('auth-email').focus(); return; }
  const { error } = await Cloud.client.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
  if (error) { authMsg(friendlyAuthError(error)); return; }
  authMsg(t('authForgotSent', { email }), true);
}

async function submitNewPassword(ev) {
  ev.preventDefault();
  const pass = document.getElementById('auth-newpass').value;
  if (pass.length < 8) { authMsg(t('errWeakPassword')); return; }
  const { error } = await Cloud.client.auth.updateUser({ password: pass });
  if (error) { authMsg(friendlyAuthError(error)); return; }
  Cloud.recovery = false;
  toast(t('authPassChanged'));
  renderAccount();
}

async function saveUsername(ev) {
  ev.preventDefault();
  const username = document.getElementById('acc-username').value.trim();
  if (!USERNAME_RE.test(username)) { authMsg(t('authUsernameHint')); return; }
  const { error } = await Cloud.client.from('profiles').update({ username, display_name: username }).eq('id', Cloud.user.id);
  if (error) { authMsg(friendlyAuthError(error)); return; }
  Cloud.profile = Object.assign({}, Cloud.profile, { username });
  renderAccountButton();
  renderAccount();
  toast(t('accountUsernameSaved'));
}

async function signOut(clearLocal) {
  if (Cloud.syncing) await new Promise(r => setTimeout(r, 800));
  else if (Cloud.user && navigator.onLine) await syncNow(false);
  const uid = Cloud.user && Cloud.user.id;
  try { await Cloud.client.auth.signOut(); } catch (e) {}
  if (clearLocal) {
    savedRecipes = []; brewLog = []; catas = [];
    Cloud.applying = true;
    persistSavedRecipes(); persistLog(); persistCatas();
    Cloud.applying = false;
    if (uid) Store.remove('baristaSync:' + uid);
    renderSavedRecipes();
  }
  Cloud.user = null; Cloud.profile = null;
  renderAccountButton();
  renderAccount();
  toast(t(clearLocal ? 'authLoggedOutCleared' : 'authLoggedOut'));
}

async function deleteAccount() {
  if (!window.confirm(t('accountDeleteConfirm'))) return;
  const uid = Cloud.user.id;
  const { error } = await Cloud.client.rpc('delete_my_account');
  if (error) { toast(friendlyAuthError(error)); return; }
  // Lo publicado se borró en cascada: se limpian las marcas locales
  savedRecipes.forEach(r => { delete r.publicId; });
  Cloud.applying = true; persistSavedRecipes(); Cloud.applying = false;
  Store.remove('baristaSync:' + uid);
  try { await Cloud.client.auth.signOut(); } catch (e) {}
  Cloud.user = null; Cloud.profile = null;
  renderAccountButton();
  renderAccount();
  toast(t('accountDeleted'));
}

/* ---------------- Sincronización ---------------- */
const SYNC_KINDS = {
  recipe: { get: () => savedRecipes, set: (v) => { savedRecipes = v; }, persist: () => persistSavedRecipes(), sanitize: (x) => BL.sanitizeRecipe(x) },
  log: { get: () => brewLog, set: (v) => { brewLog = v; }, persist: () => persistLog(), sanitize: (x) => BL.sanitizeLogEntry(x) },
  cata: { get: () => catas, set: (v) => { catas = v; }, persist: () => persistCatas(), sanitize: (x) => BL.sanitizeCata(x) }
};

// Cada vez que la app guarda algo, se programa una sincronización (sin tocar el resto del código)
function hookPersistence() {
  ['persistSavedRecipes', 'persistLog', 'persistCatas'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__cloudHooked) return;
    const wrapped = function () {
      const r = orig.apply(this, arguments);
      if (!Cloud.applying) scheduleSync();
      return r;
    };
    wrapped.__cloudHooked = true;
    window[name] = wrapped;
  });
}

function scheduleSync(delay) {
  if (!Cloud.user || !Cloud.client) return;
  clearTimeout(Cloud.timer);
  Cloud.timer = setTimeout(() => syncNow(false), delay === undefined ? 2500 : delay);
}

async function fetchAllRemote() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await Cloud.client.from('user_items')
      .select('kind, client_id, data, deleted, updated_at')
      .order('client_id', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function syncNow(manual) {
  if (!Cloud.user || !Cloud.client) return;
  if (Cloud.syncing) { Cloud.pending = true; return; }
  if (!navigator.onLine) { Cloud.state = 'offline'; renderSyncStatus(); if (manual) toast(t('syncOfflineToast')); return; }
  Cloud.syncing = true; Cloud.state = 'syncing'; renderSyncStatus();
  const uid = Cloud.user.id;
  const lastKey = 'baristaSync:' + uid;
  try {
    const remoteRows = await fetchAllRemote();
    const remote = {};
    remoteRows.forEach(r => { remote[r.kind + ':' + r.client_id] = r; });
    const local = {};
    Object.keys(SYNC_KINDS).forEach(kind => {
      SYNC_KINDS[kind].get().forEach(item => {
        const clean = SYNC_KINDS[kind].sanitize(item);
        if (clean) local[kind + ':' + clean.id] = clean;
      });
    });
    const last = Store.read(lastKey, {}) || {};
    const plan = BL.planSync(local, remote, last);
    const now = new Date().toISOString();
    const split = (key) => { const i = key.indexOf(':'); return [key.slice(0, i), Number(key.slice(i + 1))]; };

    const upserts = [];
    plan.push.forEach(key => { const [kind, id] = split(key); upserts.push({ user_id: uid, kind, client_id: id, data: local[key], deleted: false, updated_at: now }); });
    plan.pushDelete.forEach(key => { const [kind, id] = split(key); upserts.push({ user_id: uid, kind, client_id: id, data: {}, deleted: true, updated_at: now }); });
    for (let i = 0; i < upserts.length; i += 200) {
      const { error } = await Cloud.client.from('user_items').upsert(upserts.slice(i, i + 200), { onConflict: 'user_id,kind,client_id' });
      if (error) throw error;
    }

    // Recetas publicadas que cambiaron: se actualiza también su versión pública
    for (const key of plan.push) {
      const [kind] = split(key);
      const rec = local[key];
      if (kind === 'recipe' && rec.publicId) {
        await Cloud.client.from('public_recipes').update({
          title: publicTitle(rec), brewer: rec.brewer, data: publicData(rec), updated_at: now
        }).eq('id', rec.publicId);
      }
    }

    // Aplicar cambios que vinieron de otros dispositivos
    const newLast = Object.assign({}, plan.keep);
    plan.push.forEach(key => { newLast[key] = { h: BL.hashData(local[key]), u: now }; });
    const touched = new Set();
    plan.pull.forEach(key => {
      const [kind, id] = split(key);
      const clean = SYNC_KINDS[kind].sanitize(Object.assign({}, remote[key].data, { id }));
      if (!clean) return;
      const arr = SYNC_KINDS[kind].get();
      const idx = arr.findIndex(x => Number(x.id) === id);
      if (idx >= 0) arr[idx] = clean; else arr.push(clean);
      newLast[key] = { h: BL.hashData(clean), u: remote[key].updated_at };
      touched.add(kind);
    });
    plan.removeLocal.forEach(key => {
      const [kind, id] = split(key);
      SYNC_KINDS[kind].set(SYNC_KINDS[kind].get().filter(x => Number(x.id) !== id));
      touched.add(kind);
    });
    if (touched.size) {
      Cloud.applying = true;
      touched.forEach(kind => SYNC_KINDS[kind].persist());
      Cloud.applying = false;
    }
    Store.write(lastKey, newLast);
    Cloud.state = 'ok';
    Cloud.lastSync = Date.now();
    if (touched.size) refreshDataScreens();
    if (manual) toast(t('syncDone'));
  } catch (e) {
    Cloud.state = navigator.onLine ? 'error' : 'offline';
    if (manual) toast(navigator.onLine ? t('syncError') : t('syncOfflineToast'));
  } finally {
    Cloud.syncing = false;
    renderSyncStatus();
    if (Cloud.pending) { Cloud.pending = false; scheduleSync(800); }
  }
}

function refreshDataScreens() {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  if (active.id === 'screen-saved') renderSavedRecipes();
  if (active.id === 'screen-log') renderLog();
  if (active.id === 'screen-wheel') renderCataList();
  if (active.id === 'screen-account') renderAccount();
}

function renderSyncStatus() {
  const el = document.getElementById('sync-status');
  if (!el) return;
  let txt;
  if (Cloud.state === 'syncing') txt = '🔄 ' + t('syncSyncing');
  else if (Cloud.state === 'offline') txt = '📴 ' + t('syncOffline');
  else if (Cloud.state === 'error') txt = '⚠️ ' + t('syncErrorStatus');
  else if (Cloud.lastSync) txt = '✅ ' + t('syncOk', { time: new Date(Cloud.lastSync).toLocaleTimeString(currentLang === 'en' ? 'en-US' : currentLang === 'pt' ? 'pt-BR' : 'es-AR', { hour: '2-digit', minute: '2-digit' }) });
  else txt = t('syncPending');
  el.textContent = txt;
}

/* ---------------- Publicar recetas ---------------- */
function publicTitle(rec) { return (rec.coffeeName || BREWER_LABELS[rec.brewer] || rec.brewer || 'Receta').slice(0, 120); }
function publicData(rec) { const d = BL.sanitizeRecipe(rec) || {}; delete d.publicId; delete d.personalNote; return d; }

// Botón que se agrega a cada receta de "Mi café ideal"
function cloudPublishButton(recipe) {
  if (!cloudConfigured()) return '';
  const id = Number(recipe.id) || 0;
  if (recipe.publicId) {
    return `<button type="button" class="mini-btn published" onclick="unpublishRecipe(${id})" aria-pressed="true">🌍 ${esc(t('publishedTag'))}</button>`;
  }
  return `<button type="button" class="mini-btn" onclick="publishRecipe(${id})" aria-pressed="false">🌍 ${esc(t('publishBtn'))}</button>`;
}

function requireLogin(reasonKey) {
  if (Cloud.user) return true;
  toast(t(reasonKey), { action: { label: t('authLogin'), fn: goToAccount } });
  return false;
}

async function publishRecipe(id) {
  if (!requireLogin('loginToPublish')) return;
  const rec = savedRecipes.find(r => r.id === id);
  if (!rec) return;
  if (!Cloud.profile || !Cloud.profile.username) { toast(t('publishNeedUsername'), { action: { label: t('accountTitle'), fn: goToAccount } }); return; }
  const { data, error } = await Cloud.client.from('public_recipes')
    .insert({ user_id: Cloud.user.id, client_id: id, title: publicTitle(rec), brewer: rec.brewer, data: publicData(rec) })
    .select('id').single();
  if (error) {
    // Ya estaba publicada (p. ej. desde otro dispositivo): se recupera su id
    const { data: existing } = await Cloud.client.from('public_recipes').select('id').eq('user_id', Cloud.user.id).eq('client_id', id).maybeSingle();
    if (!existing) { toast(friendlyAuthError(error)); return; }
    rec.publicId = existing.id;
  } else {
    rec.publicId = data.id;
  }
  persistSavedRecipes();
  renderSavedRecipes();
  toast(t('publishDone'), { action: { label: t('shareRecipe'), fn: () => shareRecipe(id) } });
}

async function unpublishRecipe(id) {
  const rec = savedRecipes.find(r => r.id === id);
  if (!rec || !rec.publicId) return;
  if (!requireLogin('loginToPublish')) return;
  if (!window.confirm(t('unpublishConfirm'))) return;
  const { error } = await Cloud.client.from('public_recipes').delete().eq('id', rec.publicId);
  if (error) { toast(friendlyAuthError(error)); return; }
  delete rec.publicId;
  persistSavedRecipes();
  renderSavedRecipes();
  toast(t('unpublishDone'));
}

function publicRecipeUrl(publicId) { return siteUrl().replace(/\/?$/, '/') + '?receta=' + publicId; }

// Abrir un link público ?receta=<id>
async function checkPublicRecipeParam() {
  const params = new URLSearchParams(location.search);
  const pid = params.get('receta');
  if (!pid || !/^[0-9a-f-]{36}$/.test(pid)) return;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
  if (!Cloud.client) return;
  const { data, error } = await Cloud.client.from('public_recipes').select('id, title, brewer, data, profiles(username)').eq('id', pid).maybeSingle();
  if (error || !data) { toast(t('shareInvalid')); return; }
  const clean = BL.sanitizeRecipe(Object.assign({}, data.data, { id: Date.now() }));
  if (!clean) { toast(t('shareInvalid')); return; }
  delete clean.publicId;
  presentIncomingRecipe(clean, data.profiles && data.profiles.username);
}

/* ---------------- Comunidad ---------------- */
function goToCommunity() {
  showScreen('screen-community');
  renderCommunityControls();
  loadCommunity(true);
}

function renderCommunityControls() {
  const f = Cloud.feed;
  document.querySelectorAll('#community-sort [data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === f.sort)));
  const chips = document.getElementById('community-filters');
  chips.innerHTML = ['all'].concat(Object.keys(BDATA.METHODS)).map(k =>
    `<button type="button" class="chip" aria-pressed="${f.brewer === k}" onclick="setCommunityFilter('${k}')">${esc(k === 'all' ? t('logAll') : BREWER_LABELS[k])}</button>`).join('');
}
function setCommunitySort(s) { Cloud.feed.sort = s; renderCommunityControls(); loadCommunity(true); }
function setCommunityFilter(b) { Cloud.feed.brewer = b; renderCommunityControls(); loadCommunity(true); }
let communitySearchTimer = null;
function onCommunitySearch(v) {
  clearTimeout(communitySearchTimer);
  communitySearchTimer = setTimeout(() => { Cloud.feed.q = v.trim(); loadCommunity(true); }, 350);
}

async function loadCommunity(reset) {
  const f = Cloud.feed;
  if (reset) { f.page = 0; f.items = []; f.done = false; f.error = null; }
  if (!cloudConfigured()) { f.error = 'config'; renderCommunity(); return; }
  if (!Cloud.client) { f.error = 'loading'; renderCommunity(); return; }
  if (!navigator.onLine) { f.error = 'offline'; renderCommunity(); return; }
  f.loading = true; renderCommunity();
  try {
    let q = Cloud.client.from('public_recipes').select('id, user_id, title, brewer, data, likes_count, created_at, profiles(username)');
    if (f.brewer !== 'all') q = q.eq('brewer', f.brewer);
    if (f.q) q = q.ilike('title', '%' + f.q.replace(/[%_\\]/g, (c) => '\\' + c) + '%');
    q = f.sort === 'popular'
      ? q.order('likes_count', { ascending: false }).order('created_at', { ascending: false })
      : q.order('created_at', { ascending: false });
    const from = f.page * PAGE_SIZE;
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    f.items = f.items.concat(data);
    f.done = data.length < PAGE_SIZE;
    f.page += 1;
    if (Cloud.user && data.length) {
      const { data: likes } = await Cloud.client.from('recipe_likes').select('recipe_id').in('recipe_id', data.map(d => d.id));
      (likes || []).forEach(l => f.liked.add(l.recipe_id));
    }
  } catch (e) {
    f.error = navigator.onLine ? 'error' : 'offline';
  } finally {
    f.loading = false;
    renderCommunity();
  }
}

function renderCommunity() {
  const f = Cloud.feed;
  const list = document.getElementById('community-list');
  const status = document.getElementById('community-status');
  const more = document.getElementById('community-more');
  if (!list) return;
  const msgs = { config: 'cloudNotConfigured', loading: 'cloudLoading', offline: 'communityOffline', error: 'communityError' };
  status.textContent = f.error ? t(msgs[f.error]) : (f.loading ? t('communityLoading') : (!f.items.length ? t('communityEmpty') : ''));
  status.hidden = !status.textContent;
  more.hidden = f.done || f.loading || !!f.error || !f.items.length;
  list.innerHTML = f.items.map(item => {
    const r = BL.sanitizeRecipe(Object.assign({}, item.data, { id: 1 }));
    if (!r) return '';
    const author = item.profiles && item.profiles.username ? '@' + item.profiles.username : t('communityAnon');
    const mine = Cloud.user && item.user_id === Cloud.user.id;
    const liked = f.liked.has(item.id);
    const pts = (r.points || []).slice().sort((a, b) => (a.min * 60 + a.sec) - (b.min * 60 + b.sec))
      .map(p => `${BL.fmtClock(p.min * 60 + p.sec)} → ${p.ml} ml`).join(' · ');
    const meta = [esc(BREWER_LABELS[r.brewer] || r.brewer), r.grind ? esc(r.grind) : '', r.grams ? fmtNum(r.grams) + ' g' : '', r.ratio ? '1:' + fmtNum(r.ratio) : ''].filter(Boolean).join(' · ');
    return `<article class="log-entry community-card">
      <div class="log-head">
        <div><div class="log-method">${esc(item.title)}${mine ? ` <span class="tag mine-tag">${esc(t('communityMine'))}</span>` : ''}</div>
          <div class="log-date">${esc(author)} · ${fmtDate(item.created_at)}</div></div>
        <button type="button" class="like-btn${liked ? ' on' : ''}" aria-pressed="${liked}" onclick="toggleLike('${item.id}')"
          aria-label="${esc(t(liked ? 'ariaUnlike' : 'ariaLike', { n: item.likes_count }))}">${liked ? '❤️' : '🤍'} <span>${item.likes_count}</span></button>
      </div>
      <div class="log-params">${meta}</div>
      ${pts ? `<div class="log-params">${esc(pts)}</div>` : ''}
      ${r.origin ? `<div class="log-params">📍 ${esc(r.origin)}</div>` : ''}
      ${r.notas ? `<p class="log-notes">${esc(r.notas)}</p>` : ''}
      <div class="log-actions">
        <button type="button" class="mini-btn" onclick="prepareCommunityRecipe('${item.id}')">▶ ${esc(t('communityBrew'))}</button>
        <button type="button" class="mini-btn" onclick="saveCommunityRecipe('${item.id}')">★ ${esc(t('communitySave'))}</button>
        <button type="button" class="mini-btn" onclick="shareCommunityRecipe('${item.id}')">↗ ${esc(t('shareRecipe'))}</button>
      </div>
    </article>`;
  }).join('');
}

function communityItem(id) { return Cloud.feed.items.find(i => i.id === id); }
function communityRecipeCopy(item) {
  const r = BL.sanitizeRecipe(Object.assign({}, item.data, { id: Date.now() }));
  if (r) delete r.publicId;
  return r;
}

async function toggleLike(id) {
  if (!requireLogin('loginToLike')) return;
  const item = communityItem(id);
  if (!item) return;
  const f = Cloud.feed;
  const liked = f.liked.has(id);
  // Actualización optimista
  if (liked) { f.liked.delete(id); item.likes_count = Math.max(0, item.likes_count - 1); }
  else { f.liked.add(id); item.likes_count += 1; }
  renderCommunity();
  const { error } = liked
    ? await Cloud.client.from('recipe_likes').delete().eq('recipe_id', id).eq('user_id', Cloud.user.id)
    : await Cloud.client.from('recipe_likes').insert({ user_id: Cloud.user.id, recipe_id: id });
  if (error && !(String(error.code) === '23505')) {
    if (liked) { f.liked.add(id); item.likes_count += 1; } else { f.liked.delete(id); item.likes_count = Math.max(0, item.likes_count - 1); }
    renderCommunity();
    toast(friendlyAuthError(error));
  }
}

function saveCommunityRecipe(id) {
  const item = communityItem(id);
  const r = item && communityRecipeCopy(item);
  if (!r) return;
  savedRecipes.push(r);
  persistSavedRecipes();
  toast(t('shareImported'), { action: { label: t('logSee'), fn: goToSavedScreen } });
}

function prepareCommunityRecipe(id) {
  const item = communityItem(id);
  const r = item && communityRecipeCopy(item);
  if (!r) return;
  const maxMl = (r.points || []).reduce((m, p) => Math.max(m, p.ml || 0), 0);
  loadRecipeIntoFlow({ method: r.brewer, dose: r.grams, water: maxMl, ratio: r.ratio, roast: r.roast, coffeeName: r.coffeeName, origin: r.origin });
}

function shareCommunityRecipe(id) {
  const item = communityItem(id);
  if (!item) return;
  shareUrl(publicRecipeUrl(id), 'Barista de Bolsillo · ' + item.title);
}
