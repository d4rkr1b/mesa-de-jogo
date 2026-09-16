import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';

import { db, UI, app, save, load, game } from './state.js';
import { $, esc, toast, fmtClock, confirmTap, isConfirming } from './util.js';
import { compute } from './stats.js';
import * as live from './views/live.js';
import * as reports from './views/reports.js';
import * as games from './views/games.js';
import * as train from './views/train.js';
import * as athletes from './views/athletes.js';
import * as sync from './sync.js';

const SYNC_LABEL = { signedout: 'Sem sincronização', syncing: 'A sincronizar…', ok: 'Sincronizado', offline: 'Sem internet', error: 'Erro a sincronizar' };
function renderSyncChip(s) {
  const chip = $('syncChip');
  chip.hidden = s.state === 'off' || !db.meta.started;
  chip.className = 'syncchip ' + s.state;
  chip.innerHTML = `<i></i>${SYNC_LABEL[s.state] || ''}`;
}

const GAME_VIEWS = ['live', 'box', 'shots', 'lineups'];
const VIEWS = ['games', ...GAME_VIEWS, 'train', 'atl'];

function pips(n) {
  let h = '';
  for (let i = 1; i <= 5; i++) h += `<span class="pip ${i <= n ? 'on' : ''} ${n >= 4 && i <= n ? 'warn' : ''}"></span>`;
  return h;
}

function renderHeader(g, st) {
  const showBoard = !!g && GAME_VIEWS.includes(UI.view);
  document.querySelector('.board').hidden = !showBoard;
  if (showBoard) {
    $('sUs').textContent = st.team.pts; $('sThem').textContent = st.opp;
    $('usName').textContent = g.comp; $('themName').textContent = g.opponent;
    const fu = g.events.filter(e => e.t === 'pf' && e.q === g.q).length, ft = st.oppPf[g.q] || 0;
    $('fUs').innerHTML = pips(Math.min(fu, 5)); $('fThem').innerHTML = pips(Math.min(ft, 5));
    $('bUs').innerHTML = fu >= 4 ? '<span class="bonus">Adv. em bónus</span>' : 'Faltas equipa';
    $('bThem').innerHTML = ft >= 4 ? '<span class="bonus">Em bónus</span>' : 'Faltas equipa';
    $('qsel').innerHTML = [1, 2, 3, 4, 5].map(q => `<button data-q="${q}" aria-pressed="${q === g.q}">${q > 4 ? 'P' : q + '.º'}</button>`).join('');
    $('clockTxt').textContent = fmtClock(g.clock);
    $('clock').classList.toggle('run', UI.running);
  }
  document.querySelectorAll('#tabs .tab').forEach(t => {
    t.setAttribute('aria-selected', t.dataset.view === UI.view);
    if (GAME_VIEWS.includes(t.dataset.view)) t.hidden = !g;
  });
  $('sampleChip').hidden = !db.meta.sample;
  renderSyncChip(sync.status);
  $('tabs').hidden = !db.meta.started;
  const gc = $('gameChip');
  if (g && GAME_VIEWS.includes(UI.view)) {
    const fin = g.status === 'final';
    gc.innerHTML = `<b>vs ${esc(g.opponent)}</b>${fin
      ? '<span class="pill">Terminado</span><button class="btn-ghost" data-end="reopen">Reabrir</button>'
      : `<button class="btn-ghost ${isConfirming('end') ? 'confirm' : ''}" data-end="end">${isConfirming('end') ? 'Confirmar fim do jogo?' : 'Terminar jogo'}</button>`}`;
  } else gc.innerHTML = '';
  VIEWS.forEach(v => { $('v-' + v).hidden = v !== UI.view; });
}

function render() {
  if (!db.meta.started) UI.view = 'games';
  let g = game();
  if (GAME_VIEWS.includes(UI.view) && !g) UI.view = 'games';
  const st = g ? compute(g.events) : null;
  renderHeader(g, st);
  if (UI.view === 'games') games.render();
  else if (UI.view === 'live') live.render(st);
  else if (UI.view === 'box') reports.renderBox(st);
  else if (UI.view === 'shots') reports.renderShots();
  else if (UI.view === 'lineups') reports.renderLineups(st);
  else if (UI.view === 'train') train.render();
  else if (UI.view === 'atl') athletes.render();
}
app.render = render;

function initShell() {
  $('tabs').addEventListener('click', e => {
    const t = e.target.closest('[data-view]');
    if (t) { UI.view = t.dataset.view; UI.pending = null; render(); window.scrollTo(0, 0); return; }
    const end = e.target.closest('[data-end]'); if (!end) return;
    const g = game(); if (!g) return;
    if (end.dataset.end === 'end') {
      if (!confirmTap('end', render)) return;
      g.status = 'final'; UI.running = false; UI.pending = null; save('games');
      UI.view = 'box'; toast('Jogo terminado. Ficha de jogo pronta.');
    } else { g.status = 'live'; save('games'); UI.view = 'live'; toast('Jogo reaberto'); }
    render();
  });
  $('qsel').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); const g = game(); if (!b || !g) return;
    g.q = +b.dataset.q; g.clock = g.q > 4 ? 300 : 600; UI.running = false; save('games'); render();
  });
  $('clock').addEventListener('click', () => { if (game()) { UI.running = !UI.running; render(); } });
  $('syncChip').addEventListener('click', () => { UI.view = 'atl'; UI.atl.sub = 'dados'; render(); });
  sync.onStatus(s => {
    renderSyncChip(s);
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (UI.view === 'atl' && UI.atl.sub === 'dados' && !typing) athletes.render();
  });
  setInterval(() => {
    const g = game();
    if (!UI.running || !g) return;
    if (g.clock > 0) { g.clock--; save('games'); $('clockTxt').textContent = fmtClock(g.clock); }
    if (g.clock === 0) { UI.running = false; render(); toast('Fim do período'); }
  }, 1000);
}

async function start() {
  await load();
  if (db.meta.started) UI.view = game() && game().status === 'live' ? 'live' : 'games';
  initShell();
  live.init(); reports.init(); games.init(); train.init(); athletes.init();
  render();
  sync.init();
}
start();
