import { db, P, UI, app, save, game, activeR, short, surname } from '../state.js';
import { $, uid, toast, fmtClock, qLabel } from '../util.js';
import { zone, ZONES, isThree, courtLines, mark } from '../court.js';

function push(o) {
  const g = game();
  const e = Object.assign({ id: uid('e'), q: g.q, clock: g.clock, on: g.onCourt.slice() }, o);
  g.events.push(e); save('games');
  return e;
}

export function render(st) {
  const g = game();
  renderRoster(g, st); renderCourt(g); renderPanel(g); renderLog(g);
}

function renderRoster(g, st) {
  const on = UI.subMode ? UI.draft : g.onCourt;
  const item = p => {
    const s = st.pl[p.id], inC = on.includes(p.id);
    const cls = ['pl', inC ? '' : 'bench', (!UI.subMode && UI.selected === p.id) ? 'sel' : '', (UI.subMode && inC) ? 'draft-in' : ''].join(' ');
    let fp = ''; for (let i = 1; i <= 5; i++) fp += `<i class="${i <= s.pf ? 'on' : ''}"></i>`;
    return `<button class="${cls}" data-id="${p.id}" aria-pressed="${UI.selected === p.id}">
      <span class="num">${p.num}</span>
      <span style="min-width:0"><span class="nm" style="display:block">${short(p)}</span><span class="sub">${p.pos}</span></span>
      <span><span class="pts" style="display:block">${s.pts}</span><span class="fp ${s.pf >= 4 ? 'danger' : ''}">${fp}</span></span>
    </button>`;
  };
  const inList = on.map(id => P[id]).filter(Boolean).sort((a, b) => a.num - b.num);
  const bench = activeR().filter(p => !on.includes(p.id)).sort((a, b) => a.num - b.num);
  $('roster').innerHTML = `<div class="rgroup">Em campo · ${inList.length}/5</div>${inList.map(item).join('')}<div class="rgroup">Banco</div>${bench.map(item).join('')}`;
  $('subCtl').innerHTML = UI.subMode
    ? `<span style="display:flex;gap:4px"><button class="btn-sm" data-sub="cancel">Cancelar</button><button class="btn-sm go" data-sub="ok" ${UI.draft.length === 5 ? '' : 'disabled'}>OK ${UI.draft.length}/5</button></span>`
    : `<button class="btn-sm" data-sub="start">⇄ Substituir</button>`;
}

function renderCourt(g) {
  const shots = g.events.filter(e => e.t === 'shot');
  let m = shots.map(e => mark(e, e.q === g.q ? '' : 'old')).join('');
  if (UI.pending) m += `<circle class="pendc" cx="${UI.pending.x}" cy="${UI.pending.y}" r="1.6"/><circle class="pend" cx="${UI.pending.x}" cy="${UI.pending.y}" r="3.6"/>`;
  $('court').innerHTML = courtLines() + m;
  $('courtHint').textContent = UI.subMode ? 'A fazer substituição…' : 'Toca onde foi o lançamento · período atual em destaque';
}

function chipsFor(ids, act, pressed) {
  return ids.filter(id => P[id]).map(id => `<button class="chip" data-act="${act}" data-v="${id}" aria-pressed="${pressed === id}"><b>${P[id].num}</b><small>${surname(P[id])}</small></button>`).join('');
}

function renderPanel(g) {
  const pn = UI.pending; let h = '';
  if (pn) {
    const zl = ZONES[pn.z], pts = pn.three ? 3 : 2;
    if (pn.step === 'result') {
      h = `<div class="flowtitle">Lançamento de ${pts} <span>· ${zl}</span></div>
        <div class="label">Quem lançou?</div>
        <div class="chips">${chipsFor(g.onCourt, 'shooter', pn.shooter)}</div>
        <div class="grid" style="grid-template-columns:1fr 1fr"><button class="big ok" data-act="made">Cesto</button><button class="big ko" data-act="miss">Falhado</button></div>
        <button class="btn-sm" data-act="cancel">Cancelar</button>`;
    } else if (pn.step === 'assist') {
      h = `<div class="flowtitle"><span class="ok-t">✓</span> ${pts} pts #${P[pn.shooter].num} <span>· assistência?</span></div>
        <div class="chips">${chipsFor(g.onCourt.filter(i => i !== pn.shooter), 'assist')}</div>
        <button class="chip wide" data-act="assist" data-v=""><b style="font-size:16px">Sem assistência</b></button>`;
    } else {
      h = `<div class="flowtitle"><span class="ko-t">✗</span> #${P[pn.shooter].num} falhou <span>· quem ressaltou?</span></div>
        <div class="label">Ressalto ofensivo</div>
        <div class="chips">${chipsFor(g.onCourt, 'reb')}</div>
        <div class="grid" style="grid-template-columns:1fr 1fr"><button class="chip wide" data-act="reb" data-v="opp"><b style="font-size:16px">Adversário</b></button><button class="chip wide" data-act="reb" data-v=""><b style="font-size:16px">Não registar</b></button></div>`;
    }
  } else {
    const sel = UI.selected && g.onCourt.includes(UI.selected) ? P[UI.selected] : null;
    h = `<div class="who ${sel ? '' : 'none'}">${sel ? `<span class="n">#${sel.num}</span><span class="t">${sel.name}</span>` : `<span class="t">Escolhe a jogadora no plantel, depois a ação</span>`}</div>
      <div class="grid">
        <button class="act ok" data-act="stat" data-v="ft1"><b>LL ✓</b><small>lance livre</small></button>
        <button class="act ko" data-act="stat" data-v="ft0"><b>LL ✗</b><small>lance livre</small></button>
        <button class="act" data-act="stat" data-v="ast"><b>AST</b><small>assistência</small></button>
        <button class="act" data-act="stat" data-v="orb"><b>RO</b><small>ress. ofensivo</small></button>
        <button class="act" data-act="stat" data-v="drb"><b>RD</b><small>ress. defensivo</small></button>
        <button class="act" data-act="stat" data-v="stl"><b>RB</b><small>roubo</small></button>
        <button class="act" data-act="stat" data-v="tov"><b>PB</b><small>perda de bola</small></button>
        <button class="act" data-act="stat" data-v="blk"><b>DS</b><small>desarme</small></button>
        <button class="act ko" data-act="stat" data-v="pf"><b>FALTA</b><small>pessoal</small></button>
      </div>
      <div class="label">Adversário</div>
      <div class="opp">
        <button class="act" data-act="opp" data-v="1"><b>+1</b></button>
        <button class="act" data-act="opp" data-v="2"><b>+2</b></button>
        <button class="act" data-act="opp" data-v="3"><b>+3</b></button>
        <button class="act" data-act="oppf"><b>F</b><small>falta</small></button>
      </div>`;
  }
  $('panel').innerHTML = h;
}

const LBL = { orb: 'Ress. ofensivo', drb: 'Ress. defensivo', ast: 'Assistência', stl: 'Roubo', blk: 'Desarme', tov: 'Perda de bola', pf: 'Falta pessoal', oppf: 'Falta adversário', sub: 'Substituição' };
const numOf = id => P[id] ? '#' + P[id].num : '?';

function renderLog(g) {
  const rows = g.events.slice(-40).reverse().map(e => {
    const who = e.p ? `<span class="ln2">${numOf(e.p)}</span>` : '<span></span>';
    let txt;
    if (e.t === 'shot') txt = `<span class="${e.made ? 'ok-t' : 'ko-t'}">${e.made ? '✓' : '✗'}</span> ${e.three ? 'Triplo' : 'Lançamento 2'} · ${ZONES[zone(e.x, e.y)]}`;
    else if (e.t === 'ft') txt = `<span class="${e.made ? 'ok-t' : 'ko-t'}">${e.made ? '✓' : '✗'}</span> Lance livre`;
    else if (e.t === 'opp') txt = `Adversário +${e.pts}`;
    else if (e.t === 'sub') txt = `Entra ${e.on.filter(i => !e.prev.includes(i)).map(numOf).join(' ')} · sai ${e.prev.filter(i => !e.on.includes(i)).map(numOf).join(' ')}`;
    else txt = LBL[e.t];
    const del = e.t === 'sub' ? '<span></span>' : `<button class="del" data-act="del" data-v="${e.id}" aria-label="Apagar registo">×</button>`;
    return `<div class="lr"><span class="lt">${qLabel(e.q)} ${fmtClock(e.clock)}</span>${who}<span>${txt}</span>${del}</div>`;
  }).join('');
  $('log').innerHTML = rows || '<p class="hint">Ainda sem registos. Toca no campo ou escolhe uma jogadora.</p>';
}

export function init() {
  $('roster').addEventListener('click', e => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    const g = game(), id = b.dataset.id;
    if (UI.subMode) {
      const i = UI.draft.indexOf(id);
      if (i >= 0) UI.draft.splice(i, 1); else if (UI.draft.length < 5) UI.draft.push(id); else toast('Já tens 5 em campo — tira uma primeiro');
      app.render(); return;
    }
    if (!g.onCourt.includes(id)) { toast('Está no banco. Usa "Substituir" para a pôr em campo.'); return; }
    UI.selected = UI.selected === id ? null : id;
    if (UI.pending && UI.pending.step === 'result') UI.pending.shooter = id;
    app.render();
  });

  $('subCtl').addEventListener('click', e => {
    const b = e.target.closest('[data-sub]'); if (!b) return;
    const g = game(), a = b.dataset.sub;
    if (a === 'start') { UI.subMode = true; UI.draft = g.onCourt.slice(); UI.pending = null; }
    else if (a === 'cancel') UI.subMode = false;
    else if (a === 'ok' && UI.draft.length === 5) {
      if (UI.draft.some(i => !g.onCourt.includes(i))) {
        push({ t: 'sub', prev: g.onCourt.slice(), on: UI.draft.slice() });
        g.onCourt = UI.draft.slice(); save('games'); toast('Substituição registada');
      }
      if (!g.onCourt.includes(UI.selected)) UI.selected = null;
      UI.subMode = false;
    }
    app.render();
  });

  $('court').addEventListener('pointerup', e => {
    const g = game();
    if (UI.subMode) { toast('Termina a substituição primeiro'); return; }
    if (g.onCourt.length < 5) { toast('Escolhe primeiro as 5 em campo com "Substituir"'); return; }
    const svg = $('court'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const x = Math.max(1, Math.min(149, p.x)), y = Math.max(1, Math.min(139, p.y)), z = zone(x, y);
    UI.pending = { x: +x.toFixed(1), y: +y.toFixed(1), z, three: isThree(z), step: 'result', shooter: g.onCourt.includes(UI.selected) ? UI.selected : null };
    app.render();
  });

  document.querySelector('.panel').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const g = game(), a = b.dataset.act, v = b.dataset.v, pn = UI.pending;
    if (a === 'undo') {
      const last = g.events.pop(); if (!last) { toast('Nada para desfazer'); return; }
      if (last.t === 'sub') g.onCourt = last.prev.slice();
      UI.pending = null; save('games'); app.render(); toast('Último registo desfeito'); return;
    }
    if (a === 'del') { g.events = g.events.filter(x => x.id !== v); save('games'); app.render(); return; }
    if (a === 'cancel') { UI.pending = null; app.render(); return; }
    if (a === 'shooter') { pn.shooter = v; UI.selected = v; app.render(); return; }
    if (a === 'made' || a === 'miss') {
      if (!pn.shooter) { toast('Escolhe quem lançou'); return; }
      push({ t: 'shot', p: pn.shooter, x: pn.x, y: pn.y, three: pn.three, made: a === 'made' });
      pn.step = a === 'made' ? 'assist' : 'rebound'; app.render(); return;
    }
    if (a === 'assist') { if (v) push({ t: 'ast', p: v }); UI.pending = null; app.render(); return; }
    if (a === 'reb') { if (v && v !== 'opp') push({ t: 'orb', p: v }); UI.pending = null; app.render(); return; }
    if (a === 'opp') { push({ t: 'opp', pts: +v }); app.render(); return; }
    if (a === 'oppf') { push({ t: 'oppf' }); app.render(); return; }
    if (a === 'stat') {
      if (!UI.selected || !g.onCourt.includes(UI.selected)) { toast('Escolhe primeiro a jogadora no plantel'); return; }
      if (v === 'ft1' || v === 'ft0') push({ t: 'ft', p: UI.selected, made: v === 'ft1' });
      else push({ t: v, p: UI.selected });
      app.render();
    }
  });
}
