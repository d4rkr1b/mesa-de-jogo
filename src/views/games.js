import { db, P, UI, app, save, activeR, surname, replaceAll } from '../state.js';
import { $, esc, uid, toast, fmtDate, today, pct, confirmTap, isConfirming } from '../util.js';
import { compute, efg, ts } from '../stats.js';
import { sampleRoster, sampleGames, sampleTraining } from '../sample.js';
import { startEmpty } from './athletes.js';
import * as sync from '../sync.js';

const COMPS = ['Sub18', 'Sub22'];
const scoreOf = g => { const st = compute(g.events); return { us: st.team.pts, them: st.opp, st }; };

export function render() {
  if (!db.meta.started) { $('v-games').innerHTML = welcome(); return; }
  const G = UI.games;
  $('v-games').innerHTML = (G.creating ? newGameForm() : '') + season() + list();
}

function welcome() {
  return `<div class="welcome">
    <h1>Mesa de Jogo</h1>
    <p>Estatísticas de jogo ao vivo, exercícios de lançamento e fichas das atletas. Tudo fica guardado neste dispositivo e funciona sem internet no pavilhão.</p>
    <div class="choices">
      <button class="choice primary" data-g="start-empty"><b>Começar a sério</b><span>Começa vazia. Adicionas o plantel e ficam já criados os exercícios 12/13/14, Séries de 10 e 8+6.</span></button>
      <button class="choice" data-g="start-sample"><b>Experimentar com exemplos</b><span>Plantel, 3 jogos e 6 semanas de treinos inventados. Podes apagá-los depois em Atletas → Conta e dados.</span></button>
    </div>
    ${sync.configured ? '<button class="choice" data-g="start-login"><b>Já tenho conta</b><span>Entra com o teu email para trazer os dados que já estão na nuvem (por exemplo, os do iPad).</span></button>' : ''}
  </div>`;
}

function newGameForm() {
  const d = UI.games.draft;
  const players = activeR().slice().sort((a, b) => a.num - b.num);
  const chips = players.map(p => `<button class="chip" data-g="starter" data-v="${p.id}" aria-pressed="${d.starters.includes(p.id)}"><b>${p.num}</b><small>${esc(surname(p))}${p.status && p.status !== 'Disponível' ? ' · ' + esc(p.status.toLowerCase()) : ''}</small></button>`).join('');
  return `<div class="card">
    <div class="rowline"><h2>Novo jogo</h2><button class="btn-sm" data-g="cancel">Cancelar</button></div>
    <div class="fform">
      <label class="field span2"><span class="label">Adversário</span><input id="gopp" type="text" value="${esc(d.opponent)}" placeholder="Nome da equipa adversária" autocomplete="off"></label>
      <label class="field"><span class="label">Data</span><input id="gdate" type="date" value="${esc(d.date)}"></label>
      <div class="field"><span class="label">Competição</span><div class="seg big-seg">${COMPS.map(c => `<button data-g="comp" data-v="${c}" aria-pressed="${d.comp === c}">${c}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Local</span><div class="seg big-seg">${[['1', 'Casa'], ['0', 'Fora']].map(([v, l]) => `<button data-g="home" data-v="${v}" aria-pressed="${String(+d.home) === v}">${l}</button>`).join('')}</div></div>
    </div>
    <div class="label" style="margin:16px 0 6px">Cinco inicial · ${d.starters.length}/5</div>
    ${players.length ? `<div class="chips startgrid">${chips}</div>` : '<p class="hint">Ainda não há atletas. Adiciona o plantel no separador Atletas.</p>'}
    <div class="btnrow" style="margin-top:14px"><button class="btn-sm go" data-g="create" ${d.starters.length === 5 ? '' : 'disabled'}>Começar jogo</button></div>
  </div>`;
}

function season() {
  const G = UI.games;
  const gs = db.games.filter(g => G.filter === 'Todos' || g.comp === G.filter);
  const fin = gs.filter(g => g.status === 'final').map(g => ({ g, ...scoreOf(g) }));
  const w = fin.filter(x => x.us > x.them).length, l = fin.filter(x => x.us < x.them).length;
  const n = fin.length || 1;
  const team = fin.reduce((acc, x) => { Object.keys(acc).forEach(k => { acc[k] += x.st.team[k]; }); return acc; }, { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, tov: 0, orb: 0, pm: 0, drb: 0, ast: 0, stl: 0, blk: 0, pf: 0 });
  const against = fin.reduce((s, x) => s + x.them, 0);
  const scorers = {};
  fin.forEach(x => Object.entries(x.st.pl).forEach(([id, s]) => { if (s.pts) scorers[id] = (scorers[id] || 0) + s.pts; }));
  const top = Object.entries(scorers).filter(([id]) => P[id]).sort((a, b) => b[1] - a[1])[0];
  return `<div class="card">
    <div class="rowline"><h2>Época</h2>
      <span class="btnrow"><span class="seg">${['Todos', ...COMPS].map(c => `<button data-g="filter" data-v="${c}" aria-pressed="${G.filter === c}">${c}</button>`).join('')}</span>
      ${G.creating ? '' : '<button class="btn-sm go" data-g="new">+ Novo jogo</button>'}</span></div>
    ${fin.length ? `<div class="tiles">
      <div class="tile"><div class="v">${w}–${l}</div><div class="k">Vitórias–derrotas (${fin.length} jogos)</div></div>
      <div class="tile"><div class="v">${(team.pts / n).toFixed(1)}</div><div class="k">Pontos marcados por jogo</div></div>
      <div class="tile"><div class="v">${(against / n).toFixed(1)}</div><div class="k">Pontos sofridos por jogo</div></div>
      <div class="tile"><div class="v">${efg(team)}</div><div class="k">eFG% · TS% ${ts(team)}</div></div>
      <div class="tile"><div class="v">${pct(team.tpm, team.tpa)}</div><div class="k">Triplos (${team.tpm}/${team.tpa})</div></div>
      <div class="tile"><div class="v">${(team.tov / n).toFixed(1)}</div><div class="k">Perdas de bola por jogo</div></div>
      ${top ? `<div class="tile"><div class="v">${(top[1] / n).toFixed(1)}</div><div class="k">Melhor marcadora: #${P[top[0]].num} ${esc(surname(P[top[0]]))}</div></div>` : ''}
    </div>` : '<p class="hint">As médias da época aparecem quando terminares o primeiro jogo.</p>'}
  </div>`;
}

function list() {
  const G = UI.games;
  const gs = db.games.filter(g => G.filter === 'Todos' || g.comp === G.filter).slice().sort((a, b) => b.date.localeCompare(a.date));
  const rows = gs.map(g => {
    const { us, them } = scoreOf(g), fin = g.status === 'final', key = 'delgame:' + g.id;
    const res = fin ? `<span class="wl ${us > them ? 'w' : us < them ? 'l' : ''}">${us > them ? 'V' : us < them ? 'D' : 'E'}</span>` : '';
    return `<tr class="click ${g.id === db.meta.currentGameId ? 'on' : ''}" data-g="open" data-v="${g.id}">
      <td>${fmtDate(g.date)}</td>
      <td style="text-align:left"><b>${esc(g.opponent)}</b> <span class="hint">${g.home ? 'casa' : 'fora'}</span></td>
      <td>${esc(g.comp)}</td>
      <td>${res}<span class="result">${us}–${them}</span></td>
      <td>${fin ? '<span class="pill">Terminado</span>' : '<span class="pill warn">A decorrer</span>'}</td>
      <td><button class="btn-ghost ${isConfirming(key) ? 'confirm' : ''}" data-g="delete" data-v="${g.id}">${isConfirming(key) ? 'Apagar?' : '×'}</button></td>
    </tr>`;
  }).join('');
  return `<div class="card"><h2>Jogos</h2><div class="tablewrap"><table>
    <thead><tr><th>Data</th><th style="text-align:left">Adversário</th><th>Comp.</th><th>Resultado</th><th>Estado</th><th></th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">Ainda sem jogos. Toca em "+ Novo jogo" para começar.</td></tr>'}</tbody></table></div>
    <p class="legend">Toca num jogo para o abrir. Os jogos a decorrer abrem no Registo; os terminados, na Ficha de jogo.</p></div>`;
}

function openGame(id) {
  const g = db.games.find(x => x.id === id); if (!g) return;
  db.meta.currentGameId = id; save('meta');
  Object.assign(UI, { selected: null, pending: null, subMode: false, running: false, shotFilter: 'team' });
  UI.view = g.status === 'final' ? 'box' : 'live';
}

export function init() {
  const vg = $('v-games');
  vg.addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const G = UI.games, a = b.dataset.g, v = b.dataset.v;
    if (a === 'start-empty') { startEmpty(); UI.view = 'atl'; toast('Começa por adicionar as atletas do plantel'); }
    else if (a === 'start-login') { startEmpty(); UI.view = 'atl'; Object.assign(UI.atl, { sub: 'dados', editing: null }); }
    else if (a === 'start-sample') {
      replaceAll({ roster: sampleRoster(), games: sampleGames(), training: sampleTraining(), meta: { started: true, sample: true, currentGameId: 'g3' } });
    }
    else if (a === 'new') {
      if (!activeR().length) { UI.view = 'atl'; toast('Adiciona primeiro as atletas do plantel'); }
      else { G.creating = true; G.draft = { date: today(), opponent: '', comp: (db.games[db.games.length - 1] || {}).comp || 'Sub22', home: true, starters: [] }; }
    }
    else if (a === 'cancel') G.creating = false;
    else if (a === 'comp') G.draft.comp = v;
    else if (a === 'home') G.draft.home = v === '1';
    else if (a === 'starter') {
      const s = G.draft.starters, i = s.indexOf(v);
      if (i >= 0) s.splice(i, 1); else if (s.length < 5) s.push(v); else { toast('Já escolheste 5. Tira uma primeiro.'); return; }
    }
    else if (a === 'create') {
      const d = G.draft;
      if (!d.opponent.trim()) { toast('Escreve o nome do adversário'); $('gopp').focus(); return; }
      const g = { id: uid('g'), date: d.date || today(), opponent: d.opponent.trim(), comp: d.comp, home: d.home, status: 'live', events: [], q: 1, clock: 600, onCourt: d.starters.slice() };
      db.games.push(g); save('games'); G.creating = false;
      openGame(g.id); toast(`Jogo contra ${g.opponent} pronto. Bom jogo!`);
    }
    else if (a === 'filter') G.filter = v;
    else if (a === 'open') openGame(v);
    else if (a === 'delete') {
      e.stopPropagation();
      if (!confirmTap('delgame:' + v, app.render)) return;
      db.games = db.games.filter(g => g.id !== v);
      if (db.meta.currentGameId === v) { db.meta.currentGameId = null; save('meta'); }
      save('games'); toast('Jogo apagado');
    }
    else return;
    app.render();
  });
  vg.addEventListener('input', e => {
    const d = UI.games.draft; if (!d) return;
    if (e.target.id === 'gopp') d.opponent = e.target.value;
    if (e.target.id === 'gdate') d.date = e.target.value;
  });
}
