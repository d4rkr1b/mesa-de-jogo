import { createClient } from '@supabase/supabase-js';
import { get, set, del } from 'idb-keyval';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { db, app, changes, refreshP, saveAll } from './state.js';

/*
 * Sincronização por documentos: 'roster', 'training' e um 'game:<id>' por jogo.
 * Guarda a impressão digital (hash) do último estado sincronizado de cada documento.
 * Diferente localmente = alteração local por enviar; diferente no servidor = alteração remota por aplicar.
 * Se os dois mudaram, ganha a alteração mais recente (hora local da gravação vs hora do servidor).
 * No primeiro acerto de um dispositivo, fica a versão com mais conteúdo.
 */

export const configured = !!(SUPABASE_URL && SUPABASE_KEY);
const client = configured ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

const SKEY = 'sync';
let S = { hashes: {}, lastPull: null, lastOk: null };
let session = null, running = false, again = false, timer = null;
export const status = { state: configured ? 'signedout' : 'off', message: '', email: null, lastOk: null };
const statusListeners = [];
export const onStatus = fn => statusListeners.push(fn);
function setStatus(state, message = '') {
  Object.assign(status, { state, message, email: session ? session.user.email : null, lastOk: S.lastOk });
  statusListeners.forEach(fn => fn(status));
}

/* JSON com chaves ordenadas: o Postgres reordena as chaves do jsonb */
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function hash(v) {
  const s = stable(v); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + ':' + s.length;
}

function localDocs() {
  const docs = { roster: db.roster, training: db.training };
  db.games.forEach(g => { docs['game:' + g.id] = g; });
  return docs;
}
const coarse = key => key.startsWith('game:') ? 'games' : key;

function apply(row) {
  if (row.key === 'roster') db.roster = row.data;
  else if (row.key === 'training') db.training = row.data;
  else if (row.key.startsWith('game:')) {
    const id = row.key.slice(5), i = db.games.findIndex(g => g.id === id);
    if (row.deleted) { if (i >= 0) db.games.splice(i, 1); }
    else if (i >= 0) db.games[i] = row.data; else db.games.push(row.data);
  }
}

export async function syncNow() {
  if (!client || !session) return;
  if (running) { again = true; return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  running = true; setStatus('syncing');
  try {
    // 1. receber
    let q = client.from('docs').select('key,data,deleted,updated_at');
    if (S.lastPull) q = q.gt('updated_at', S.lastPull);
    const { data: rows, error } = await q;
    if (error) throw error;
    const firstSync = !S.lastPull;
    let changed = false, maxAt = S.lastPull;

    if (db.meta.sample && rows.some(r => !r.deleted)) {
      // dados de exemplo neste dispositivo e dados reais na nuvem: ficam os da nuvem
      db.roster = []; db.games = []; db.training = { exercises: [], series: [], goals: {}, team: {} };
      Object.assign(db.meta, { sample: false, started: true, currentGameId: null });
      S.hashes = {}; changed = true;
    }
    const local = localDocs();
    for (const r of rows) {
      if (!maxAt || r.updated_at > maxAt) maxAt = r.updated_at;
      const remoteH = r.deleted ? 'deleted' : hash(r.data);
      const cur = local[r.key], curH = cur === undefined ? undefined : hash(cur), synced = S.hashes[r.key];
      if (curH === remoteH || (cur === undefined && remoteH === 'deleted')) { S.hashes[r.key] = remoteH; continue; }
      if (firstSync) {
        // primeiro acerto deste dispositivo: fica a versão com mais conteúdo (um plantel vazio nunca apaga um cheio)
        if (cur !== undefined && !r.deleted && stable(cur).length > stable(r.data).length) continue;
      } else {
        const localChanged = cur === undefined ? (synced && synced !== 'deleted') : curH !== synced;
        const remoteChanged = remoteH !== synced;
        if (localChanged && !remoteChanged) continue;
        if (localChanged && (changes.at[coarse(r.key)] || 0) > Date.parse(r.updated_at)) continue;
      }
      apply(r); S.hashes[r.key] = remoteH; changed = true;
    }
    S.lastPull = maxAt;
    if (changed) {
      refreshP();
      if (!db.meta.started && (db.roster.length || db.games.length)) db.meta.started = true;
      if (db.meta.currentGameId && !db.games.some(g => g.id === db.meta.currentGameId)) db.meta.currentGameId = null;
      saveAll();
    }

    // 2. enviar (nunca os dados de exemplo)
    if (!db.meta.sample && db.meta.started) {
      const now = localDocs(), ups = [];
      for (const [key, data] of Object.entries(now)) { const h = hash(data); if (S.hashes[key] !== h) ups.push({ key, data, deleted: false, h }); }
      for (const key of Object.keys(S.hashes)) if (key.startsWith('game:') && !now[key] && S.hashes[key] !== 'deleted') ups.push({ key, data: {}, deleted: true, h: 'deleted' });
      if (ups.length) {
        const uidv = session.user.id;
        const { error: upErr } = await client.from('docs').upsert(ups.map(u => ({ user_id: uidv, key: u.key, data: u.data, deleted: u.deleted })), { onConflict: 'user_id,key' });
        if (upErr) throw upErr;
        ups.forEach(u => { S.hashes[u.key] = u.h; });
      }
    }

    S.lastOk = new Date().toISOString();
    await set(SKEY, S);
    setStatus('ok');
    if (changed) {
      const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (!typing) app.render();
    }
  } catch (err) {
    console.error('Sincronização', err);
    setStatus(navigator.onLine ? 'error' : 'offline', err && err.message ? err.message : String(err));
  } finally {
    running = false;
    if (again) { again = false; schedule(1000); }
  }
}

function schedule(ms = 8000) {
  if (!session || timer) return;
  timer = setTimeout(() => { timer = null; syncNow(); }, ms);
}

export async function login(email, password) {
  if (!client) return 'A sincronização não está configurada.';
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return /invalid/i.test(error.message) ? 'Email ou palavra-passe errados.' : 'Não foi possível entrar: ' + error.message;
  return null;
}

export async function logout() {
  if (!client) return;
  await client.auth.signOut();
  S = { hashes: {}, lastPull: null, lastOk: null };
  await del(SKEY);
}

export async function init() {
  if (!client) { setStatus('off'); return; }
  S = Object.assign(S, await get(SKEY));
  changes.listeners.push(key => { if (key !== 'meta') schedule(); });
  client.auth.onAuthStateChange((event, s) => {
    const was = !!session; session = s;
    if (!s) { setStatus('signedout'); return; }
    setStatus(status.state === 'signedout' || status.state === 'off' ? 'ok' : status.state);
    if (!was) setTimeout(syncNow, 0);
  });
  const { data } = await client.auth.getSession();
  session = data.session;
  if (!session) setStatus('signedout');
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 30000);
}
