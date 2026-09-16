import { P, UI, app, game, db, surname } from '../state.js';
import { $, pct, sgn, pmCls } from '../util.js';
import { zone, ZONES, courtLines, mark } from '../court.js';
import { efg, ts, poss, insights, playedIn } from '../stats.js';

export function renderBox(st) {
  const g = game(), t = st.team, P0 = poss(t);
  const row = (label, s, dim, cls) => `<tr class="${dim ? 'dim' : ''} ${cls || ''}"><td>${label}</td><td>${s.pts}</td><td>${s.fgm}/${s.fga}</td><td>${pct(s.fgm, s.fga)}</td><td>${s.tpm}/${s.tpa}</td><td>${s.ftm}/${s.fta}</td><td>${s.orb}</td><td>${s.drb}</td><td>${s.orb + s.drb}</td><td>${s.ast}</td><td>${s.stl}</td><td>${s.blk}</td><td>${s.tov}</td><td>${s.pf}</td><td class="${cls ? '' : pmCls(s.pm)}">${cls ? '' : sgn(s.pm)}</td><td>${efg(s)}</td><td>${ts(s)}</td></tr>`;
  const rows = db.roster.slice().sort((a, b) => a.num - b.num).map(p => {
    const s = st.pl[p.id]; const any = Object.values(s).some(v => v) || playedIn(g, p.id);
    if (!any) return '';
    return row(`<span class="nn">${p.num}</span>${p.name}`, s, false);
  }).join('');
  const ins = insights(st);
  $('v-box').innerHTML = `
    <div class="card"><h2>Resumo · ${g.opponent ? 'vs ' + g.opponent : 'Jogo'}</h2><div class="tiles">
      <div class="tile"><div class="v">${t.pts}–${st.opp}</div><div class="k">Resultado</div></div>
      <div class="tile"><div class="v">${efg(t)}</div><div class="k">eFG% (lançamento efetivo)</div></div>
      <div class="tile"><div class="v">${ts(t)}</div><div class="k">TS% (eficiência real)</div></div>
      <div class="tile"><div class="v">${Math.round(P0)}</div><div class="k">Posses (estimativa)</div></div>
      <div class="tile"><div class="v">${P0 > 0 ? (t.pts / P0).toFixed(2) : '–'}</div><div class="k">Pontos por posse</div></div>
      <div class="tile"><div class="v">${t.tov}</div><div class="k">Perdas de bola</div></div>
    </div></div>
    <div class="card"><h2>Leitura automática</h2>${ins.length ? `<ul class="insights">${ins.map(i => `<li class="${i.c}">${i.t}</li>`).join('')}</ul>` : '<p class="hint">Aparece quando houver registos.</p>'}</div>
    <div class="card"><h2>Ficha de jogo</h2><div class="tablewrap"><table>
      <thead><tr><th>Jogadora</th><th>PTS</th><th>LC</th><th>LC%</th><th>3P</th><th>LL</th><th>RO</th><th>RD</th><th>RT</th><th>AST</th><th>RB</th><th>DS</th><th>PB</th><th>FP</th><th>+/−</th><th>eFG%</th><th>TS%</th></tr></thead>
      <tbody>${rows}${row('Equipa', t, false, 'tot')}</tbody></table></div>
      <p class="legend">LC lançamentos de campo · 3P triplos · LL lances livres · RO/RD/RT ressaltos ofensivos/defensivos/total · AST assistências · RB roubos · DS desarmes · PB perdas de bola · FP faltas pessoais · +/− saldo com a jogadora em campo · eFG% = (LC + 0,5×3P) / LCT · TS% = PTS / (2×(LCT + 0,44×LLT))</p>
    </div>`;
}

export function renderShots() {
  const g = game();
  const all = g.events.filter(e => e.t === 'shot');
  const shooters = db.roster.filter(p => all.some(e => e.p === p.id)).sort((a, b) => a.num - b.num);
  if (UI.shotFilter !== 'team' && !shooters.some(p => p.id === UI.shotFilter)) UI.shotFilter = 'team';
  const f = UI.shotFilter, shots = f === 'team' ? all : all.filter(e => e.p === f);
  const z = {}; Object.keys(ZONES).forEach(k => { z[k] = { m: 0, a: 0 }; });
  shots.forEach(e => { const k = zone(e.x, e.y); z[k].a++; if (e.made) z[k].m++; });
  const m = shots.filter(e => e.made).length;
  $('v-shots').innerHTML = `
    <div class="card"><div class="chips" style="margin-bottom:12px">
      <button class="chip" data-shot="team" aria-pressed="${f === 'team'}"><b style="font-size:16px">Equipa</b><small>${all.length} lanç.</small></button>
      ${shooters.map(p => `<button class="chip" data-shot="${p.id}" aria-pressed="${f === p.id}"><b>${p.num}</b><small>${surname(p)}</small></button>`).join('')}
    </div>
    <div class="shotlayout">
      <svg viewBox="-2 -2 154 144" aria-label="Mapa de lançamentos">${courtLines()}${shots.map(e => mark(e)).join('')}</svg>
      <div>
        <h2>${f === 'team' ? 'Equipa' : '#' + P[f].num + ' ' + P[f].name}</h2>
        <div class="tiles" style="margin-bottom:12px"><div class="tile"><div class="v">${m}/${shots.length}</div><div class="k">Lançamentos de campo · ${pct(m, shots.length)}</div></div></div>
        <table><thead><tr><th>Zona</th><th>Conv./Tent.</th><th>%</th><th>Pts/lanç.</th></tr></thead><tbody>
          ${Object.keys(ZONES).map(k => { const v = z[k], pv = (k === 'c3' || k === 'a3') ? 3 : 2; return `<tr><td>${ZONES[k]}</td><td>${v.m}/${v.a}</td><td>${pct(v.m, v.a)}</td><td>${v.a ? (v.m * pv / v.a).toFixed(2) : '–'}</td></tr>`; }).join('')}
        </tbody></table>
        <p class="legend">● cesto · ✕ falhado. "Pts/lanç." compara zonas com valores diferentes: um triplo a 33% vale o mesmo que um lançamento de 2 a 50%.</p>
      </div>
    </div></div>`;
}

export function renderLineups(st) {
  const lu = st.lineups.filter(l => l.for || l.against || l.poss > 0).sort((a, b) => (b.for - b.against) - (a.for - a.against));
  const num = i => P[i] ? P[i].num : '?';
  $('v-lineups').innerHTML = `<div class="card"><h2>Quintetos</h2><div class="tablewrap"><table>
    <thead><tr><th>Quinteto</th><th>Marcados</th><th>Sofridos</th><th>+/−</th><th>Posses (est.)</th><th>Pts/posse</th></tr></thead>
    <tbody>${lu.map(l => { const d = l.for - l.against; return `<tr><td><span class="nn">${l.on.map(num).join(' · ')}</span><span class="hint">${l.on.map(i => P[i] ? surname(P[i]) : '').join(', ')}</span></td><td>${l.for}</td><td>${l.against}</td><td class="${pmCls(d)}">${sgn(d)}</td><td>${Math.max(0, Math.round(l.poss))}</td><td>${l.poss >= 1 ? (l.for / l.poss).toFixed(2) : '–'}</td></tr>`; }).join('') || '<tr><td colspan="6">Sem dados ainda.</td></tr>'}</tbody>
  </table></div><p class="legend">Cada registo guarda quem estava em campo, por isso o saldo de cada quinteto é calculado automaticamente, sem trabalho extra durante o jogo.</p></div>`;
}

export function init() {
  $('v-shots').addEventListener('click', e => {
    const b = e.target.closest('[data-shot]'); if (!b) return;
    UI.shotFilter = b.dataset.shot; app.render();
  });
}
