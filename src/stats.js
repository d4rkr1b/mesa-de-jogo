import { db, P, short } from './state.js';
import { pct, sgn, qLabel } from './util.js';

export const blank = () => ({ pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pm: 0 });

export function compute(events) {
  const pl = {};
  db.roster.forEach(p => { pl[p.id] = blank(); });
  const team = blank(); let opp = 0; const oppPf = {}, qs = {}, lu = {};
  const lkey = on => on.slice().sort((a, b) => (P[a] ? P[a].num : 0) - (P[b] ? P[b].num : 0)).join(',');
  const L = on => { const k = lkey(on); return lu[k] || (lu[k] = { on: k.split(','), for: 0, against: 0, poss: 0 }); };
  for (const e of events) {
    qs[e.q] = qs[e.q] || { us: 0, them: 0, tov: 0 };
    if (e.p && !pl[e.p]) pl[e.p] = blank();
    const s = e.p ? pl[e.p] : null;
    const add = (k, v = 1) => { s[k] += v; team[k] += v; };
    const scored = pts => {
      add('pts', pts); qs[e.q].us += pts;
      e.on.forEach(id => { if (pl[id]) pl[id].pm += pts; });
      team.pm += pts; L(e.on).for += pts;
    };
    switch (e.t) {
      case 'shot': add('fga'); L(e.on).poss += 1; if (e.three) add('tpa'); if (e.made) { add('fgm'); if (e.three) add('tpm'); scored(e.three ? 3 : 2); } break;
      case 'ft': add('fta'); L(e.on).poss += .44; if (e.made) { add('ftm'); scored(1); } break;
      case 'orb': add('orb'); L(e.on).poss -= 1; break;
      case 'tov': add('tov'); L(e.on).poss += 1; qs[e.q].tov++; break;
      case 'drb': case 'ast': case 'stl': case 'blk': case 'pf': add(e.t); break;
      case 'opp': opp += e.pts; qs[e.q].them += e.pts; e.on.forEach(id => { if (pl[id]) pl[id].pm -= e.pts; }); team.pm -= e.pts; L(e.on).against += e.pts; break;
      case 'oppf': oppPf[e.q] = (oppPf[e.q] || 0) + 1; break;
    }
  }
  return { pl, team, opp, qs, lineups: Object.values(lu), oppPf };
}

export const efg = s => s.fga ? Math.round(100 * (s.fgm + .5 * s.tpm) / s.fga) + '%' : '–';
export const ts = s => (s.fga + s.fta) ? Math.round(100 * s.pts / (2 * (s.fga + .44 * s.fta))) + '%' : '–';
export const poss = s => s.fga - s.orb + s.tov + .44 * s.fta;
export const playedIn = (g, pid) => g.events.some(e => e.on && e.on.includes(pid)) || g.onCourt.includes(pid);

export function insights(st) {
  const out = [], t = st.team;
  const qk = Object.keys(st.qs).map(Number).sort((a, b) => a - b);
  if (qk.length) {
    out.push({ c: '', t: 'Parciais: ' + qk.map(q => `${qLabel(q)} ${st.qs[q].us}–${st.qs[q].them}`).join(' · ') });
    const worst = qk.reduce((a, q) => (st.qs[q].us - st.qs[q].them) < (st.qs[a].us - st.qs[a].them) ? q : a, qk[0]);
    const d = st.qs[worst].us - st.qs[worst].them;
    if (d < 0) out.push({ c: 'bad', t: `O ${qLabel(worst)} período foi o pior (${sgn(d)}), com ${st.qs[worst].tov} perdas de bola nesse período.` });
  }
  if (t.fga) {
    const miss = t.fga - t.fgm;
    out.push({ c: t.tpa && t.tpm / t.tpa >= .35 ? 'good' : 'warn', t: `Triplos ${t.tpm}/${t.tpa} (${pct(t.tpm, t.tpa)}). eFG% da equipa: ${efg(t)}; TS%: ${ts(t)}.` });
    out.push({ c: miss && t.orb / miss >= .3 ? 'good' : 'warn', t: `Ressaltos ofensivos: ${t.orb} em ${miss} lançamentos falhados (${pct(t.orb, miss)} de segundas oportunidades).` });
  }
  const p0 = poss(t);
  if (p0 > 0) out.push({ c: t.tov / p0 > .18 ? 'bad' : '', t: `${t.tov} perdas de bola em ~${Math.round(p0)} posses (${pct(t.tov, p0)}). Pontos por posse: ${(t.pts / p0).toFixed(2)}.` });
  const top = db.roster.map(p => [p, st.pl[p.id]]).filter(x => x[1]).sort((a, b) => b[1].pts - a[1].pts)[0];
  if (top && top[1].pts) out.push({ c: 'good', t: `Melhor marcadora: #${top[0].num} ${top[0].name}, ${top[1].pts} pts (${top[1].fgm}/${top[1].fga} LC, TS% ${ts(top[1])}).` });
  const foul = db.roster.filter(p => st.pl[p.id] && st.pl[p.id].pf >= 3).map(p => `#${p.num} ${short(p)} (${st.pl[p.id].pf})`);
  if (foul.length) out.push({ c: 'warn', t: `Atenção às faltas: ${foul.join(', ')}.` });
  const lu = st.lineups.filter(l => l.poss >= 4).sort((a, b) => (b.for - b.against) - (a.for - a.against));
  const nums = l => l.on.map(i => P[i] ? P[i].num : '?').join('-');
  if (lu.length > 1) {
    const b = lu[0], w = lu[lu.length - 1];
    out.push({ c: 'good', t: `Quinteto mais eficaz: ${nums(b)} (${sgn(b.for - b.against)}, ${b.for}–${b.against}).` });
    if (w.for - w.against < 0) out.push({ c: 'bad', t: `Quinteto com pior saldo: ${nums(w)} (${sgn(w.for - w.against)}).` });
  }
  return out;
}
