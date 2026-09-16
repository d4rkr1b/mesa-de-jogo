import { db, P, UI, app, save, refreshP, activeR, short, replaceAll, flush } from '../state.js';
import { $, esc, uid, toast, fmtDate, wdDate, ageOf, pc, pp, avgP, trendOf, uniq, sumS, sgn, pmCls, today, confirmTap, isConfirming, shareFile } from '../util.js';
import { POS, PS, posCourt } from '../court.js';
import { chart, attachTips } from '../chart.js';
import { compute, efg, playedIn, blank } from '../stats.js';
import { defaultExercises } from '../sample.js';
import * as sync from '../sync.js';

const POSITIONS = ['Base', 'Base/Extremo', 'Extremo', 'Extremo/Poste', 'Poste'];
const STATUS = { 'Disponível': 'good', 'Condicionada': 'warn', 'Lesionada': 'bad', 'Indisponível': 'warn' };
const pill = st => `<span class="pill ${STATUS[st] || ''}">${esc(st || 'Disponível')}</span>`;
const T = () => db.training;

function trainDates(pid) {
  const ds = [];
  T().series.forEach(e => { if (!pid || e.p === pid) ds.push(e.date); });
  Object.keys(T().goals).forEach(k => { const s = k.split('|'); if (!pid || s[2] === pid) ds.push(s[0]); });
  if (!pid) Object.keys(T().team).forEach(k => ds.push(k.split('|')[0]));
  return uniq(ds);
}

export function render() {
  const A = UI.atl;
  const subs = [['plantel', 'Plantel e fichas'], ['treinos', 'Treinos realizados'], ['dados', 'Conta e dados']];
  const seg = `<div class="rowline" style="margin:0"><div class="seg big-seg">${subs.map(([k, v]) => `<button data-a="sub" data-v="${k}" aria-pressed="${A.sub === k}">${v}</button>`).join('')}</div></div>`;
  $('v-atl').innerHTML = seg + (A.sub === 'plantel' ? plantelView() : A.sub === 'treinos' ? treinosView() : dadosView());
}

function plantelView() {
  const A = UI.atl, act = activeR().slice().sort((a, b) => a.num - b.num), old = db.roster.filter(p => p.active === false);
  if (!A.editing && !P[A.sel]) A.sel = act[0] && act[0].id;
  if (!act.length && !A.editing) A.editing = 'new';
  const row = p => `<button class="arow ${A.sel === p.id && !A.editing ? 'on' : ''} ${p.active === false ? 'old' : ''}" data-a="sel" data-v="${p.id}">
      <span class="num">${p.num}</span><span style="min-width:0"><span class="nm" style="display:block">${esc(p.name)}</span><span class="sub">${esc(p.pos)}${p.selecao ? ' · ' + esc(p.selecao) : ''}</span></span>${p.active === false ? '<span class="pill">Saiu</span>' : pill(p.status)}</button>`;
  const list = `<div class="card alist">
      <div class="rowline"><h2>Plantel · ${act.length}</h2><button class="btn-sm go" data-a="new">+ Adicionar atleta</button></div>
      <div class="stack" style="gap:4px">${act.map(row).join('') || '<p class="hint">Ainda sem atletas. Preenche a ficha ao lado para adicionar a primeira.</p>'}</div>
      ${old.length ? `<div class="label" style="margin:14px 0 6px">Já não estão no plantel</div><div class="stack" style="gap:4px">${old.map(row).join('')}</div>` : ''}
    </div>`;
  return `<div class="atlayout">${list}<div class="stack">${A.editing ? formView() : fichaView(P[A.sel])}</div></div>`;
}

function formView() {
  const A = UI.atl, isNew = A.editing === 'new', p = isNew ? { num: '', name: '', pos: 'Extremo', status: 'Disponível', hand: 'Direita' } : P[A.editing];
  const opt = (arr, v) => arr.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('');
  const del = 'remove:' + A.editing;
  return `<div class="card">
    <h2>${isNew ? 'Nova atleta' : 'Editar · #' + p.num + ' ' + esc(p.name)}</h2>
    <div class="fform">
      <label class="field"><span class="label">Número</span><input id="fnum" type="number" min="0" max="99" inputmode="numeric" value="${esc(p.num)}"></label>
      <label class="field span2"><span class="label">Nome</span><input id="fname" type="text" value="${esc(p.name)}" placeholder="Nome e apelido" autocomplete="off"></label>
      <label class="field"><span class="label">Posição</span><select id="fpos">${opt(POSITIONS, p.pos)}</select></label>
      <label class="field"><span class="label">Estado</span><select id="fstatus">${opt(Object.keys(STATUS), p.status || 'Disponível')}</select></label>
      <label class="field"><span class="label">Mão dominante</span><select id="fhand">${opt(['Direita', 'Esquerda'], p.hand || 'Direita')}</select></label>
      <label class="field"><span class="label">Data de nascimento</span><input id="fbirth" type="date" value="${esc(p.birth)}"></label>
      <label class="field"><span class="label">Altura (cm)</span><input id="fheight" type="number" min="140" max="215" inputmode="numeric" value="${esc(p.height)}"></label>
      <label class="field"><span class="label">Seleção</span><input id="fsel" type="text" value="${esc(p.selecao)}" placeholder="ex.: Seleção Sub20"></label>
      <label class="field span3"><span class="label">Notas (lesões, objetivos, pontos a trabalhar…)</span><textarea id="fnotes" rows="4">${esc(p.notes)}</textarea></label>
    </div>
    <div class="rowline" style="margin:14px 0 0">
      <span style="display:flex;gap:6px"><button class="btn-sm go" data-a="save">${isNew ? 'Adicionar ao plantel' : 'Guardar alterações'}</button>${activeR().length ? '<button class="btn-sm" data-a="cancel">Cancelar</button>' : ''}</span>
      ${isNew ? '' : `<button class="btn-ghost ${isConfirming(del) ? 'confirm' : ''}" data-a="remove">${isConfirming(del) ? 'Confirmar: tirar do plantel?' : 'Tirar do plantel'}</button>`}
    </div>
    ${isNew ? '' : '<p class="legend">Tirar do plantel não apaga nada: as estatísticas antigas ficam guardadas e podes voltar a pô-la no plantel.</p>'}
  </div>`;
}

function fichaView(p) {
  if (!p) return `<div class="card"><p class="hint">Escolhe uma atleta.</p></div>`;
  const age = ageOf(p.birth);
  const facts = [p.pos, age != null ? `${age} anos` : null, p.height ? `${p.height} cm` : null, p.hand ? `mão ${p.hand.toLowerCase()}` : null].filter(Boolean).join(' · ');
  const head = `<div class="card ficha-head">
      <span class="bignum">${p.num}</span>
      <div style="min-width:0;flex:1"><div class="rowline" style="margin:0 0 4px;justify-content:flex-start"><h2 style="margin:0">${esc(p.name)}</h2>${p.active === false ? '<span class="pill">Saiu do plantel</span>' : pill(p.status)}</div>
        <div class="hint" style="font-size:14px">${esc(facts)}</div>
        ${p.selecao ? `<div style="margin-top:6px"><span class="pill accent">${esc(p.selecao)}</span></div>` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <button class="btn-sm" data-a="edit" data-v="${p.id}">Editar ficha</button>
        ${p.active === false ? `<button class="btn-sm go" data-a="reactivate" data-v="${p.id}">Voltar ao plantel</button>` : ''}
      </div>
    </div>
    ${p.notes ? `<div class="card"><div class="label" style="margin-bottom:6px">Notas</div><p style="margin:0;white-space:pre-wrap;line-height:1.5;max-width:75ch">${esc(p.notes)}</p></div>` : ''}`;
  return head + trainingCard(p) + gamesCard(p);
}

function trainingCard(p) {
  const seriesIds = T().exercises.filter(e => e.type === 'series').map(e => e.id);
  const all = T().series.filter(e => seriesIds.includes(e.ex));
  const dates = uniq(all.map(e => e.date));
  const mine = dates.map(d => sumS(all.filter(e => e.date === d && e.p === p.id)));
  const team = dates.map(d => sumS(all.filter(e => e.date === d)));
  const done = mine.filter(Boolean);
  const posStats = {}; POS.forEach(ps => { const s = sumS(all.filter(e => e.p === p.id && e.pos === ps.id)); if (s) posStats[ps.id] = s; });
  const ranked = Object.entries(posStats).filter(([, s]) => s.a >= 20).sort((a, b) => b[1].p - a[1].p);
  const bestPos = ranked[0], worstPos = ranked[ranked.length - 1];
  const goalBlocks = T().exercises.filter(e => e.type === 'goal').map(ex => {
    const keys = Object.keys(T().goals).filter(k => { const s = k.split('|'); return s[1] === ex.id && s[2] === p.id; }).sort();
    if (!keys.length) return '';
    return `<div class="goalline"><b>${esc(ex.name)}</b>${ex.parts.map(pt => {
      const v = keys.filter(k => k.endsWith('|' + pt.id)).map(k => T().goals[k]), ok = v.filter(Boolean).length;
      return `<span class="gp"><span class="hint">${esc(pt.label)}</span> <b>${ok}/${v.length}</b> <span class="strip">${v.slice(-8).map(x => `<i class="${x ? 'ok' : 'ko'}"></i>`).join('')}</span></span>`;
    }).join('')}</div>`;
  }).join('');
  if (!done.length && !goalBlocks) return `<div class="card"><h2>Treino</h2><p class="hint">Ainda sem registos de treino.</p></div>`;
  return `<div class="card">
      <div class="rowline"><h2>Treino</h2></div>
      <div class="tiles">
        <div class="tile"><div class="v">${trainDates(p.id).length}<span class="hint" style="font-size:16px">/${trainDates().length}</span></div><div class="k">Treinos com registos</div></div>
        <div class="tile"><div class="v">${pc(avgP(done.slice(-5)))}</div><div class="k">Séries · últimos 5 treinos</div></div>
        <div class="tile"><div class="v" style="font-size:26px">${pp(trendOf(mine))}</div><div class="k">Séries · início → agora</div></div>
        <div class="tile"><div class="v">${done.reduce((s, x) => s + x.a, 0)}</div><div class="k">Lançamentos em séries</div></div>
      </div>
      ${done.length ? `<div class="lg"><span><i></i>#${p.num} ${esc(short(p))}</span><span><i class="ref"></i>Média da equipa</span></div>
      ${chart(dates.map(date => ({ date })), mine, team, '#' + p.num + ' ' + short(p))}
      <div class="posgrid" style="margin-top:12px">
        <div><div class="label" style="margin-bottom:6px">Acerto por posição (todas as séries)</div>${posCourt(null, posStats)}</div>
        ${bestPos && worstPos && bestPos !== worstPos ? `<ul class="insights"><li class="good">Melhor posição: ${PS[bestPos[0]].label} (${PS[bestPos[0]].kind}), ${bestPos[1].m}/${bestPos[1].a} · ${pc(bestPos[1].p)}.</li><li class="warn">A trabalhar: ${PS[worstPos[0]].label} (${PS[worstPos[0]].kind}), ${worstPos[1].m}/${worstPos[1].a} · ${pc(worstPos[1].p)}.</li></ul>` : ''}
      </div>` : ''}
      ${goalBlocks ? `<div class="label" style="margin:14px 0 6px">Desafios</div>${goalBlocks}` : ''}
    </div>`;
}

function gamesCard(p) {
  const gs = db.games.filter(g => playedIn(g, p.id)).sort((a, b) => a.date.localeCompare(b.date));
  if (!gs.length) return `<div class="card"><h2>Jogos</h2><p class="hint">Ainda não jogou nenhum jogo registado.</p></div>`;
  const lines = gs.map(g => ({ g, s: compute(g.events).pl[p.id] || blank() }));
  const tot = blank(); lines.forEach(({ s }) => Object.keys(tot).forEach(k => { tot[k] += s[k]; }));
  const n = gs.length, avg = v => (v / n).toFixed(1);
  const rows = lines.slice().reverse().map(({ g, s }) => `<tr class="click" data-a="open-game" data-v="${g.id}"><td>${fmtDate(g.date)}</td><td style="text-align:left">${esc(g.opponent)} <span class="hint">${esc(g.comp)}</span></td><td>${s.pts}</td><td>${s.fgm}/${s.fga}</td><td>${s.tpm}/${s.tpa}</td><td>${s.ftm}/${s.fta}</td><td>${s.orb + s.drb}</td><td>${s.ast}</td><td>${s.tov}</td><td class="${pmCls(s.pm)}">${sgn(s.pm)}</td></tr>`).join('');
  return `<div class="card"><div class="rowline"><h2>Jogos · ${n}</h2><span class="hint">médias por jogo</span></div>
    <div class="tiles">
      <div class="tile"><div class="v">${avg(tot.pts)}</div><div class="k">Pontos</div></div>
      <div class="tile"><div class="v">${avg(tot.orb + tot.drb)}</div><div class="k">Ressaltos</div></div>
      <div class="tile"><div class="v">${avg(tot.ast)}</div><div class="k">Assistências</div></div>
      <div class="tile"><div class="v">${pc(tot.fga ? tot.fgm / tot.fga : null)}</div><div class="k">Lanç. campo (${tot.fgm}/${tot.fga})</div></div>
      <div class="tile"><div class="v">${pc(tot.tpa ? tot.tpm / tot.tpa : null)}</div><div class="k">Triplos (${tot.tpm}/${tot.tpa})</div></div>
      <div class="tile"><div class="v">${pc(tot.fta ? tot.ftm / tot.fta : null)}</div><div class="k">Lances livres (${tot.ftm}/${tot.fta})</div></div>
      <div class="tile"><div class="v">${efg(tot)}</div><div class="k">eFG% da época</div></div>
      <div class="tile"><div class="v ${pmCls(tot.pm)}">${sgn(tot.pm)}</div><div class="k">+/− total</div></div>
    </div>
    <div class="tablewrap" style="margin-top:12px"><table>
      <thead><tr><th>Data</th><th style="text-align:left">Adversário</th><th>PTS</th><th>LC</th><th>3P</th><th>LL</th><th>RT</th><th>AST</th><th>PB</th><th>+/−</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p class="legend">Toca num jogo para abrir a ficha desse jogo.</p></div>`;
}

function treinosView() {
  const A = UI.atl, dates = trainDates().slice().reverse();
  const exName = id => { const e = T().exercises.find(x => x.id === id); return e ? e.name : '?'; };
  const athletesOn = d => uniq([...T().series.filter(e => e.date === d).map(e => e.p), ...Object.keys(T().goals).filter(k => k.startsWith(d + '|')).map(k => k.split('|')[2])]);
  const exOn = d => uniq([...T().series.filter(e => e.date === d).map(e => e.ex), ...Object.keys(T().goals).filter(k => k.startsWith(d + '|')).map(k => k.split('|')[1]), ...Object.keys(T().team).filter(k => k.startsWith(d + '|')).map(k => k.split('|')[1])]);
  const last5 = dates.slice(0, 5), s5 = sumS(T().series.filter(e => last5.includes(e.date)));
  const avgAth = dates.length ? Math.round(dates.reduce((s, d) => s + athletesOn(d).length, 0) / dates.length) : 0;
  const rows = dates.map(d => {
    const ex = exOn(d), ath = athletesOn(d), ss = sumS(T().series.filter(e => e.date === d)), open = A.openDate === d;
    let detail = '';
    if (open) {
      const exs = ex.map(id => T().exercises.find(x => x.id === id)).filter(Boolean);
      const teamLines = exs.filter(e => e.type === 'team').map(e => {
        const t = T().team[`${d}|${e.id}`];
        return `<div class="goalline"><b>${esc(e.name)}</b>${e.parts.map(pt => `<span class="gp">${esc(pt.label)} <b class="${t.parts[pt.id] === true ? 'up' : t.parts[pt.id] === false ? 'down' : ''}">${t.parts[pt.id] === true ? '✓' : t.parts[pt.id] === false ? '✗' : '–'}</b></span>`).join('')}${t.note ? `<span class="hint">${esc(t.note)}</span>` : ''}<button class="btn-sm" data-a="goto" data-ex="${e.id}" data-date="${d}">Editar</button></div>`;
      }).join('');
      const indiv = exs.filter(e => e.type !== 'team');
      const tbl = indiv.length ? `<div class="tablewrap"><table><thead><tr><th>Atleta</th>${indiv.map(e => `<th>${esc(e.name)} <button class="btn-sm" data-a="goto" data-ex="${e.id}" data-date="${d}">Editar</button></th>`).join('')}</tr></thead><tbody>
        ${ath.map(pid => P[pid]).filter(Boolean).sort((a, b) => a.num - b.num).map(p => `<tr class="click" data-a="open-ficha" data-v="${p.id}"><td><span class="nn">${p.num}</span>${esc(short(p))}</td>${indiv.map(e => {
          if (e.type === 'series') { const l = T().series.filter(x => x.date === d && x.ex === e.id && x.p === p.id), t = sumS(l); return `<td>${t ? `${t.m}/${t.a} <span class="hint">${pc(t.p)} · ${l.length}×</span>` : '–'}</td>`; }
          return `<td>${e.parts.map(pt => { const v = T().goals[`${d}|${e.id}|${p.id}|${pt.id}`]; return `<span class="${v === true ? 'up' : v === false ? 'down' : 'hint'}" title="${esc(pt.label)}">${v === true ? '✓' : v === false ? '✗' : '·'}</span>`; }).join(' ')}</td>`;
        }).join('')}</tr>`).join('')}
      </tbody></table></div>` : '';
      detail = `<tr class="detail"><td colspan="5"><div class="stack" style="gap:8px;padding:6px 0 10px">${teamLines}${tbl}</div></td></tr>`;
    }
    return `<tr class="click ${open ? 'on' : ''}" data-a="openday" data-v="${d}"><td><b>${wdDate(d)}</b></td><td style="text-align:left;white-space:normal">${ex.map(id => `<span class="tag">${esc(exName(id))}</span>`).join(' ')}</td><td>${ath.length}</td><td>${ss ? `${ss.m}/${ss.a}` : '–'}</td><td>${ss ? pc(ss.p) : '–'} <span class="hint">${open ? '▴' : '▾'}</span></td></tr>${detail}`;
  }).join('');
  return `<div class="card"><div class="rowline"><h2>Treinos realizados</h2></div>
      <div class="tiles">
        <div class="tile"><div class="v">${dates.length}</div><div class="k">Treinos com registos</div></div>
        <div class="tile"><div class="v">${avgAth}</div><div class="k">Atletas por treino (média)</div></div>
        <div class="tile"><div class="v">${pc(s5 && s5.p)}</div><div class="k">Séries · últimos 5 treinos</div></div>
        <div class="tile"><div class="v">${T().series.reduce((s, e) => s + e.att, 0)}</div><div class="k">Lançamentos registados</div></div>
      </div></div>
    <div class="card"><div class="tablewrap"><table class="days">
      <thead><tr><th>Treino</th><th style="text-align:left">Exercícios</th><th>Atletas</th><th>Séries</th><th>%</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">Ainda sem treinos registados.</td></tr>'}</tbody></table></div>
      <p class="legend">Toca num treino para ver o detalhe por atleta. "Editar" abre esse exercício e essa data no separador Treino. Toca numa atleta para abrir a ficha dela.</p></div>`;
}

function syncCard() {
  if (!sync.configured) return '';
  const s = sync.status;
  if (s.state === 'signedout') {
    return `<div class="card datacard"><h2>Sincronização</h2>
      <p>Entra com a tua conta para guardar tudo na nuvem e teres os mesmos dados no iPad e no PC. A app continua a funcionar sem internet e envia as alterações quando houver ligação.</p>
      <div class="loginform">
        <label class="field"><span class="label">Email</span><input id="semail" type="email" autocomplete="username" autocapitalize="off" inputmode="email"></label>
        <label class="field"><span class="label">Palavra-passe</span><input id="spass" type="password" autocomplete="current-password"></label>
        <button class="btn-sm go" data-a="login" style="height:46px">Entrar</button>
      </div></div>`;
  }
  const when = s.lastOk ? new Date(s.lastOk).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'ainda não';
  const line = { ok: 'Tudo sincronizado.', syncing: 'A sincronizar…', offline: 'Sem internet. As alterações ficam guardadas aqui e são enviadas quando voltar a ligação.', error: 'Houve um erro na última tentativa. A app volta a tentar sozinha.' }[s.state] || '';
  return `<div class="card datacard"><h2>Sincronização</h2>
    <p>Sessão iniciada como <b>${esc(s.email)}</b>. ${line}</p>
    <p class="hint">Última sincronização: ${when}${s.state === 'error' && s.message ? ` · ${esc(s.message)}` : ''}</p>
    <div class="btnrow"><button class="btn-sm go" data-a="syncnow">Sincronizar agora</button>
    <button class="btn-ghost ${isConfirming('logout') ? 'confirm' : ''}" data-a="logout">${isConfirming('logout') ? 'Confirmar: terminar sessão?' : 'Terminar sessão'}</button></div></div>`;
}

function dadosView() {
  const counts = `${db.roster.length} atletas · ${db.games.length} jogos · ${T().series.length} séries de treino`;
  const signedIn = sync.configured && sync.status.state !== 'signedout';
  return syncCard() + `<div class="card datacard"><h2>Cópia de segurança</h2>
      <p>${signedIn ? 'Os dados estão neste dispositivo e na nuvem.' : 'Tudo o que registas fica guardado <b>neste dispositivo</b> e funciona sem internet.'} Podes também exportar uma cópia para um ficheiro (por exemplo, no fim da época) e guardá-la no iCloud Drive ou no email.</p>
      <p class="hint">${counts}</p>
      <div class="btnrow"><button class="btn-sm go" data-a="export">Exportar cópia (.json)</button>
      <label class="btn-sm" style="cursor:pointer">Importar cópia…<input id="importFile" type="file" accept="application/json,.json" hidden></label></div>
    </div>
    ${db.meta.sample ? `<div class="card datacard"><h2>Dados de exemplo</h2><p>A app tem dados inventados para experimentares. Quando quiseres usar a sério, apaga-os e começa com o teu plantel.</p>
      <button class="btn-ghost ${isConfirming('clearSample') ? 'confirm' : ''}" data-a="clearSample">${isConfirming('clearSample') ? 'Confirmar: apagar exemplos?' : 'Apagar exemplos e começar do zero'}</button></div>` : ''}
    <div class="card datacard"><h2>Apagar tudo</h2><p>Apaga atletas, jogos e treinos deste dispositivo${signedIn ? ' <b>e da nuvem</b>, porque a sincronização está ligada' : ''}. Exporta uma cópia antes, se precisares.</p>
      <button class="btn-ghost ${isConfirming('wipe') ? 'confirm' : ''}" data-a="wipe">${isConfirming('wipe') ? 'Confirmar: apagar tudo?' : 'Apagar tudo'}</button></div>`;
}

export function startEmpty() {
  replaceAll({
    roster: [], games: [],
    training: { exercises: defaultExercises(), series: [], goals: {}, team: {} },
    meta: { started: true, sample: false, currentGameId: null }
  });
  Object.assign(UI.atl, { sub: 'plantel', sel: null, editing: 'new' });
}

export function init() {
  const va = $('v-atl');
  va.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const A = UI.atl, a = b.dataset.a, v = b.dataset.v;
    if (a === 'sub') A.sub = v;
    else if (a === 'sel') { A.sel = v; A.editing = null; }
    else if (a === 'new') A.editing = 'new';
    else if (a === 'edit') A.editing = v;
    else if (a === 'cancel') A.editing = null;
    else if (a === 'save') {
      const num = parseInt($('fnum').value, 10), name = $('fname').value.trim().replace(/\s+/g, ' ');
      if (!name) { toast('Escreve o nome da atleta'); return; }
      if (isNaN(num) || num < 0 || num > 99) { toast('O número tem de estar entre 0 e 99'); return; }
      const clash = activeR().find(p => p.num === num && p.id !== A.editing);
      if (clash) { toast(`O número ${num} já é da ${clash.name}`); return; }
      const data = { num, name, pos: $('fpos').value, status: $('fstatus').value, hand: $('fhand').value, birth: $('fbirth').value, height: parseInt($('fheight').value, 10) || null, selecao: $('fsel').value.trim(), notes: $('fnotes').value.trim() };
      if (A.editing === 'new') {
        const p = Object.assign({ id: uid('p'), active: true }, data);
        db.roster.push(p); A.sel = p.id; toast(`#${num} ${name} adicionada ao plantel`);
      } else { Object.assign(P[A.editing], data); A.sel = A.editing; toast('Ficha guardada'); }
      refreshP(); save('roster'); A.editing = null;
    }
    else if (a === 'remove') {
      const id = A.editing;
      if (db.games.some(g => g.status === 'live' && g.onCourt.includes(id))) { toast('Está em campo num jogo a decorrer. Faz a substituição primeiro.'); return; }
      if (!confirmTap('remove:' + id, app.render)) return;
      P[id].active = false; save('roster'); A.editing = null; A.sel = id; toast(`${P[id].name} saiu do plantel`);
    }
    else if (a === 'reactivate') {
      const p = P[v], clash = activeR().find(x => x.num === p.num);
      if (clash) { toast(`O número ${p.num} já é da ${clash.name}. Muda o número primeiro.`); A.editing = v; }
      else { p.active = true; save('roster'); toast(`${p.name} voltou ao plantel`); }
    }
    else if (a === 'openday') A.openDate = A.openDate === v ? null : v;
    else if (a === 'goto') { e.stopPropagation(); UI.view = 'train'; Object.assign(UI.train, { ex: b.dataset.ex, date: b.dataset.date, creating: false, player: null }); }
    else if (a === 'open-ficha') { A.sub = 'plantel'; A.sel = v; A.editing = null; }
    else if (a === 'open-game') { db.meta.currentGameId = v; save('meta'); UI.view = 'box'; }
    else if (a === 'export') { exportBackup(); return; }
    else if (a === 'login') {
      const email = $('semail').value, pass = $('spass').value;
      if (!email || !pass) { toast('Escreve o email e a palavra-passe'); return; }
      b.disabled = true; b.textContent = 'A entrar…';
      sync.login(email, pass).then(err => {
        if (err) { toast(err); b.disabled = false; b.textContent = 'Entrar'; return; }
        toast('Sessão iniciada. A sincronizar…'); app.render();
      });
      return;
    }
    else if (a === 'syncnow') { sync.syncNow(); return; }
    else if (a === 'logout') { if (!confirmTap('logout', app.render)) return; sync.logout().then(() => { toast('Sessão terminada. Os dados continuam neste dispositivo.'); app.render(); }); return; }
    else if (a === 'clearSample') { if (!confirmTap('clearSample', app.render)) return; startEmpty(); toast('Exemplos apagados. Começa por adicionar o plantel.'); }
    else if (a === 'wipe') { if (!confirmTap('wipe', app.render)) return; startEmpty(); toast('Dados apagados'); }
    else return;
    app.render();
  });
  va.addEventListener('change', async e => {
    if (e.target.id !== 'importFile' || !e.target.files[0]) return;
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.roster) || !Array.isArray(data.games) || !data.training) throw new Error('formato');
      replaceAll({ roster: data.roster, games: data.games, training: data.training, meta: Object.assign({ started: true, sample: false, currentGameId: null }, data.meta) });
      await flush();
      toast(`Cópia importada: ${data.roster.length} atletas, ${data.games.length} jogos`);
      app.render();
    } catch (err) {
      toast('Não consegui ler esse ficheiro. Escolhe uma cópia exportada pela Mesa de Jogo.');
    }
    e.target.value = '';
  });
  attachTips(va);
}

function exportBackup() {
  const data = { app: 'mesa-de-jogo', version: 1, exportedAt: new Date().toISOString(), roster: db.roster, games: db.games, training: db.training, meta: db.meta };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  shareFile(blob, `mesa-de-jogo-${today()}.json`, 'Cópia exportada');
}
