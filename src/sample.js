import { rng, iso, clamp, uid } from './util.js';
import { zone, POS } from './court.js';

/* Exercícios que já existem na equipa; entram também quando se começa do zero. */
export function defaultExercises() {
  return [
    { id: 'e1', name: '12/13/14', type: 'goal', parts: [{ id: 'll', label: 'LL · 10 em 12' }, { id: 'p2', label: '2P · 10 em 13' }, { id: 'p3', label: '3P · 10 em 14' }] },
    { id: 'e2', name: 'Séries de 10', type: 'series', per: 10 },
    { id: 'e4', name: '8+6', type: 'team', parts: [{ id: 'p2', label: '8 de 2P' }, { id: 'p3', label: '6 de 3P' }] }
  ];
}

export function sampleRoster() {
  return [
    { id: 'p4', num: 4, name: 'Inês Costa', pos: 'Base', birth: '2005-03-12', height: 171, hand: 'Direita', selecao: 'Seleção Sub20' },
    { id: 'p7', num: 7, name: 'Mariana Lopes', pos: 'Extremo', birth: '2004-11-02', height: 178, hand: 'Direita', selecao: 'Seleção Sub20', notes: 'Objetivo da época: subir % de triplo de 45º acima de 38%.\nTrabalhar lançamento após drible para a esquerda.' },
    { id: 'p10', num: 10, name: 'Beatriz Sousa', pos: 'Extremo', birth: '2006-06-21', height: 176, hand: 'Esquerda', selecao: 'Seleção Sub18' },
    { id: 'p12', num: 12, name: 'Carolina Reis', pos: 'Poste', birth: '2005-01-30', height: 188, hand: 'Direita', selecao: 'Seleção Sub20' },
    { id: 'p15', num: 15, name: 'Leonor Matos', pos: 'Poste', birth: '2007-09-08', height: 185, hand: 'Direita', selecao: 'Seleção Sub18' },
    { id: 'p5', num: 5, name: 'Rita Almeida', pos: 'Base', birth: '2008-02-14', height: 165, hand: 'Direita', selecao: 'Seleção Sub18' },
    { id: 'p6', num: 6, name: 'Diana Vaz', pos: 'Base', birth: '2008-10-19', height: 168, hand: 'Direita' },
    { id: 'p8', num: 8, name: 'Joana Pires', pos: 'Extremo', birth: '2006-04-03', height: 174, hand: 'Direita', selecao: 'Seleção Sub18' },
    { id: 'p9', num: 9, name: 'Sofia Rocha', pos: 'Base', birth: '2007-12-27', height: 167, hand: 'Direita', status: 'Condicionada', notes: 'Dor no joelho direito: sem saltos em 2 treinos por semana.' },
    { id: 'p11', num: 11, name: 'Marta Neves', pos: 'Extremo/Poste', birth: '2005-07-15', height: 182, hand: 'Direita', selecao: 'Seleção Sub20' },
    { id: 'p13', num: 13, name: 'Catarina Dias', pos: 'Poste', birth: '2006-08-11', height: 186, hand: 'Direita', status: 'Lesionada', notes: 'Entorse no tornozelo esquerdo. Regresso previsto a 28 set.' },
    { id: 'p14', num: 14, name: 'Ana Faria', pos: 'Extremo', birth: '2008-05-05', height: 175, hand: 'Esquerda' }
  ].map(p => Object.assign({ active: true, status: 'Disponível', selecao: '', notes: '' }, p));
}

/* Gera um jogo plausível. lastQ/lastI permitem parar a meio (jogo a decorrer). */
function genGame(seed, lastQ = 4, lastI = 23) {
  const r = rng(seed), ev = [];
  const W = { p7: 3, p10: 2.4, p4: 2, p12: 2, p15: 1.5, p11: 1.3 };
  const pick = (arr, w) => { const ws = arr.map(id => w ? (W[id] || 1) : 1); let t = r() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { t -= ws[i]; if (t <= 0) return arr[i]; } return arr[0]; };
  const pt = z => { for (let k = 0; k < 400; k++) { const x = 2 + r() * 146, y = 2 + r() * (z === 'paint' ? 55 : z === 'mid' ? 78 : z === 'c3' ? 27 : 118); if (zone(x, y) === z) return { x: +x.toFixed(1), y: +y.toFixed(1) }; } return { x: 75, y: 10 }; };
  const L = { 1: ['p4', 'p7', 'p10', 'p12', 'p15'], 2: ['p5', 'p7', 'p8', 'p12', 'p13'], 3: ['p4', 'p7', 'p10', 'p11', 'p15'], 4: ['p4', 'p9', 'p10', 'p12', 'p15'] };
  let on = L[1]; const N = 24; let clock = 600;
  for (let q = 1; q <= lastQ; q++) {
    if (q > 1) { ev.push({ id: uid('e'), t: 'sub', q, clock: 600, prev: on.slice(), on: L[q].slice() }); on = L[q]; }
    const last = q === lastQ ? lastI : N - 1;
    for (let i = 0; i <= last; i++) {
      clock = Math.round(600 - (i + .5) * 600 / N);
      const add = o => ev.push(Object.assign({ id: uid('e'), q, clock, on: on.slice() }, o));
      const x = r();
      if (x < .40) {
        const p = pick(on, true), zr = r();
        const z = zr < .4 ? 'paint' : zr < .6 ? 'mid' : zr < .88 ? 'a3' : 'c3';
        const loc = pt(z), made = r() < ({ paint: .55, mid: .38, a3: .32, c3: .40 })[z];
        add({ t: 'shot', p, x: loc.x, y: loc.y, three: z === 'a3' || z === 'c3', made });
        if (made && r() < .6) add({ t: 'ast', p: pick(on.filter(o => o !== p)) });
        if (!made && r() < .3) add({ t: 'orb', p: pick(on) });
      } else if (x < .47) { const p = pick(on, true); add({ t: 'ft', p, made: r() < .74 }); add({ t: 'ft', p, made: r() < .74 }); }
      else if (x < .54) add({ t: 'tov', p: pick(on) });
      else if (x < .59) add({ t: 'stl', p: pick(on) });
      else if (x < .62) add({ t: 'blk', p: pick(on) });
      else if (x < .69) add({ t: 'pf', p: pick(on) });
      else if (x < .72) add({ t: 'oppf' });
      else if (x < .83) add({ t: 'drb', p: pick(on) });
      else { const y = r(); add({ t: 'opp', pts: y < .12 ? 1 : y < .78 ? 2 : 3 }); }
    }
  }
  return { events: ev, q: lastQ, clock: lastQ === 4 && lastI === N - 1 ? 0 : clock, onCourt: on.slice() };
}

export function sampleGames() {
  const mk = (id, date, opponent, comp, home, seed, live) => Object.assign(
    { id, date, opponent, comp, home, status: live ? 'live' : 'final' },
    live ? genGame(seed, 3, 13) : genGame(seed)
  );
  return [
    mk('g1', '2026-09-05', 'Exemplo A', 'Sub22', true, 11),
    mk('g2', '2026-09-12', 'Exemplo B', 'Sub18', false, 29),
    mk('g3', '2026-09-16', 'Exemplo C', 'Sub22', true, 18, true)
  ];
}

export function sampleTraining() {
  const r = rng(7);
  const exercises = [
    ...defaultExercises().slice(0, 2),
    { id: 'e3', name: 'Triplos após passe', type: 'series', per: 10 },
    defaultExercises()[2]
  ];
  const ids = sampleRoster().map(p => p.id);
  const skill = {}, trend = {};
  ids.forEach(id => { skill[id] = { '3P': .30 + r() * .14, '2P': .40 + r() * .14, 'LL': .68 + r() * .16 }; trend[id] = -.002 + r() * .009; });
  trend.p7 = .011; trend.p9 = .009; trend.p15 = -.003;
  const adj = { c3e: .04, c3d: .04, f3: -.02, b2e: .02, b2d: .02 };
  const series = [], goals = {}, team = {}; let k = 0, n = 1;
  const shoot = (pr, max) => { let m = 0; for (let i = 0; i < max; i++) if (r() < pr) m++; return m; };
  const sim = (pr, max) => { let m = 0; for (let i = 0; i < max; i++) { if (r() < pr) m++; if (m >= 10) return true; } return false; };
  for (let d = new Date(2026, 7, 3); d <= new Date(2026, 8, 15); d.setDate(d.getDate() + 1)) {
    const wd = d.getDay(); if (![1, 3, 5].includes(wd)) continue;
    k++; const date = iso(d), present = ids.filter(() => r() < .9);
    const pr = (id, kind, pos) => clamp(skill[id][kind] + trend[id] * k + (adj[pos] || 0));
    present.forEach(id => {
      for (let s = 0; s < 3; s++) { const pos = POS[Math.floor(r() * POS.length)]; series.push({ id: 's' + (n++), date, ex: 'e2', p: id, pos: pos.id, made: shoot(pr(id, pos.kind, pos.id), 10), att: 10 }); }
      if (wd === 5) ['c3e', 'c3d'].forEach(pid => series.push({ id: 's' + (n++), date, ex: 'e3', p: id, pos: pid, made: shoot(pr(id, '3P', pid) - .03, 10), att: 10 }));
      if (wd !== 5) {
        goals[`${date}|e1|${id}|ll`] = sim(clamp(pr(id, 'LL', 'll') + .06), 12);
        goals[`${date}|e1|${id}|p2`] = sim(clamp(pr(id, '2P', 'k2e') + .28), 13);
        goals[`${date}|e1|${id}|p3`] = sim(clamp(pr(id, '3P', 'f3') + .36), 14);
      }
    });
    if (wd === 5) team[`${date}|e4`] = { parts: { p2: r() < .45 + k * .025, p3: r() < .25 + k * .03 }, note: '' };
  }
  return { exercises, series, goals, team };
}
