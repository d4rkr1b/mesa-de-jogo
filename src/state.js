import { get, set } from 'idb-keyval';
import { today } from './util.js';

/* Todos os dados vivem aqui e são guardados no dispositivo (IndexedDB). */
export const db = {
  roster: [],
  games: [],
  training: { exercises: [], series: [], goals: {}, team: {} },
  meta: { started: false, sample: false, currentGameId: null }
};
const KEYS = ['roster', 'games', 'training', 'meta'];

export const P = {};
export function refreshP() { Object.keys(P).forEach(k => delete P[k]); db.roster.forEach(p => { P[p.id] = p; }); }
export const activeR = () => db.roster.filter(p => p.active !== false);
export const short = p => { const s = p.name.split(' '); return s.length > 1 ? s[0][0] + '. ' + s[s.length - 1] : s[0]; };
export const surname = p => short(p).split(' ').pop();

export const game = () => db.games.find(g => g.id === db.meta.currentGameId) || null;

export const UI = {
  view: 'games',
  selected: null, pending: null, subMode: false, draft: null, running: false, shotFilter: 'team',
  games: { creating: false, filter: 'Todos', draft: null },
  train: { ex: null, date: today(), player: null, pos: null, prog: 'team', creating: false, draft: { name: '', type: 'series', per: 10, parts: '' } },
  atl: { sub: 'plantel', sel: null, editing: null, openDate: null }
};

/* o render é definido no main.js; as vistas chamam app.render() depois de mudar algo */
export const app = { render: () => {} };

/* a sincronização regista-se aqui para saber quando e o quê mudou */
export const changes = { at: {}, listeners: [] };

const timers = {};
export function save(key) {
  changes.at[key] = Date.now();
  changes.listeners.forEach(fn => fn(key));
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => write(key), 250);
}
function write(key) {
  delete timers[key];
  return set(key, db[key]).catch(err => console.error('Erro a guardar', key, err));
}
export function flush() { return Promise.all(Object.keys(timers).map(k => { clearTimeout(timers[k]); return write(k); })); }
export function saveAll() { KEYS.forEach(save); }

export async function load() {
  const vals = await Promise.all(KEYS.map(k => get(k)));
  KEYS.forEach((k, i) => { if (vals[i] !== undefined) db[k] = vals[i]; });
  refreshP();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

export function replaceAll(data) {
  KEYS.forEach(k => { if (data[k] !== undefined) db[k] = data[k]; });
  refreshP();
  saveAll();
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', flush);
