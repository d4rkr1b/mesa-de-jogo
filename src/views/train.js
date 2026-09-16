import { db, P, UI, app, save, activeR, short, surname } from '../state.js';
import { $, esc, uid, toast, fmtDate, pc, pp, avgP, trendOf, uniq, sumS } from '../util.js';
import { POS, PS, posCourt } from '../court.js';
import { chart, attachTips } from '../chart.js';

const TYPES = { series: 'Séries', goal: 'Desafio individual', team: 'Objetivo de equipa' };
const T = () => db.training;
const touched = () => { if (db.meta.sample) { db.meta.sample = false; save('meta'); } save('training'); };

const playerChips = (act, sel, sub) => activeR().slice().sort((a, b) => a.num - b.num).map(p => { const s = sub(p); return `<button class="chip ${s.done ? 'done' : ''}" data-t="${act}" data-v="${p.id}" aria-pressed="${sel === p.id}"><b>${p.num}</b><small>${s.txt}</small></button>`; }).join('');
const dateField = d => `<label class="hint" style="display:flex;gap:8px;align-items:center" for="tdate">Treino de <input type="date" id="tdate" value="${d}"></label>`;
const nameOf = sel => sel === 'team' || !P[sel] ? 'Equipa' : '#' + P[sel].num + ' ' + short(P[sel]);
const noPlayers = '<p class="hint">Ainda não há atletas no plantel. Adiciona-as no separador Atletas.</p>';

export function render() {
  const tu = UI.train;
  if (!T().exercises.find(e => e.id === tu.ex)) tu.ex = T().exercises[0] && T().exercises[0].id;
  if (tu.prog !== 'team' && !P[tu.prog]) tu.prog = 'team';
  const ex = T().exercises.find(e => e.id === tu.ex);
  const exChips = T().exercises.map(e => `<button class="chip wide" data-t="ex" data-v="${e.id}" aria-pressed="${e.id === tu.ex && !tu.creating}"><b>${esc(e.name)}</b><small>${e.type === 'series' ? `Séries de ${e.per}` : TYPES[e.type]}</small></button>`).join('')
    + `<button class="chip wide addex" data-t="newex" aria-pressed="${tu.creating}"><b>+ Novo exercício</b><small>dás o nome e o formato</small></button>`;

  let top = '';
  if (tu.creating) {
    const dr = tu.draft;
    top = `<div class="newex">
      <label class="field"><span class="label">Nome</span><input id="exname" type="text" placeholder="ex.: Séries após bloqueio direto" value="${esc(dr.name)}"></label>
      <div class="field"><span class="label">Formato</span><div class="seg big-seg">${Object.entries(TYPES).map(([k, v]) => `<button data-t="dtype" data-v="${k}" aria-pressed="${dr.type === k}">${v}</button>`).join('')}</div></div>
      ${dr.type === 'series'
        ? `<label class="field"><span class="label">Lançamentos por série</span><input id="exper" type="number" min="1" max="50" inputmode="numeric" value="${esc(dr.per)}"></label>
           <p class="hint">Cada registo é: jogadora + posição + quantos cestos marcou.</p>`
        : `<label class="field"><span class="label">${dr.type === 'goal' ? 'Partes do desafio' : 'Objetivos da equipa'} (separados por vírgula)</span><input id="exparts" type="text" placeholder="${dr.type === 'goal' ? 'LL · 10 em 12, 2P · 10 em 13, 3P · 10 em 14' : '8 de 2P, 6 de 3P'}" value="${esc(dr.parts)}"></label>
           <p class="hint">${dr.type === 'goal' ? 'Cada jogadora fica com ✓ conseguiu ou ✗ não conseguiu em cada parte.' : 'A equipa fica com ✓ ou ✗ em cada objetivo, mais uma nota (tempo, tentativas…).'}</p>`}
      <div style="display:flex;gap:6px"><button class="btn-sm go" data-t="create">Criar exercício</button><button class="btn-sm" data-t="cancelnew">Cancelar</button></div>
    </div>`;
  }

  let rec = '', prog = '';
  if (ex && !tu.creating) {
    if (ex.type === 'series') [rec, prog] = seriesViews(ex);
    else if (ex.type === 'goal') [rec, prog] = goalViews(ex);
    else [rec, prog] = teamViews(ex);
  }

  $('v-train').innerHTML = `
    <div class="card"><div class="rowline"><h2>Exercícios de lançamento</h2>${db.meta.sample ? '<span class="chip-sample">Dados de exemplo</span>' : ''}</div>
      <div class="chips drillchips">${exChips}</div>${top}</div>
    ${ex && !tu.creating ? `<div class="trainlayout"><div class="card stack">${rec}</div><div class="stack">${prog}</div></div>` : ''}`;
}

function seriesViews(ex) {
  const tu = UI.train;
  const todays = T().series.filter(e => e.ex === ex.id && e.date === tu.date);
  if (tu.player && !P[tu.player]) tu.player = null;
  const chips = playerChips('rp', tu.player, p => { const l = todays.filter(e => e.p === p.id); return l.length ? { done: true, txt: `${l.length}× · ${pc(sumS(l).p)}` } : { done: false, txt: surname(p) }; });
  let nums = '<p class="hint">Escolhe a jogadora e a posição, depois toca no número de cestos.</p>';
  if (tu.player && tu.pos) {
    let b = ''; for (let k = 0; k <= ex.per; k++) b += `<button data-t="snum" data-v="${k}">${k}</button>`;
    nums = `<div class="spotrow" style="border:0;padding:0"><div class="sh"><span><b>#${P[tu.player].num} ${short(P[tu.player])}</b> · ${PS[tu.pos].label} <span class="hint">(${PS[tu.pos].kind})</span></span><span class="hint">cestos em ${ex.per}</span></div><div class="nums">${b}</div></div>`;
  }
  const list = todays.slice().reverse().map(e => `<div class="lr" style="grid-template-columns:34px 1fr auto auto"><span class="ln2">#${P[e.p] ? P[e.p].num : '?'}</span><span>${PS[e.pos].label}</span><span class="ln2">${e.made}/${e.att}</span><button class="del" data-t="sdel" data-v="${e.id}" aria-label="Apagar série">×</button></div>`).join('');
  const rec = `<div class="rowline" style="margin:0"><h2>Registar</h2>${dateField(tu.date)}</div>
    ${activeR().length ? `<div class="chips">${chips}</div>` : noPlayers}
    ${posCourt(tu.pos)}
    ${nums}
    <div><div class="label" style="margin-bottom:4px">Séries deste treino · ${todays.length}</div>${list || '<p class="hint">Ainda nenhuma.</p>'}</div>`;

  const sel = tu.prog;
  const all = T().series.filter(e => e.ex === ex.id);
  const dates = uniq(all.map(e => e.date));
  const byDate = who => dates.map(d => sumS(all.filter(e => e.date === d && (who === 'team' || e.p === who))));
  const team = byDate('team'), main = sel === 'team' ? team : byDate(sel);
  const done = main.filter(Boolean), last = done[done.length - 1];
  const seriesIds = T().exercises.filter(e => e.type === 'series').map(e => e.id);
  const mine = T().series.filter(e => seriesIds.includes(e.ex) && (sel === 'team' || e.p === sel));
  const posStats = {}; let posRows = '';
  POS.forEach(p => {
    const l = mine.filter(e => e.pos === p.id); const tot = sumS(l); if (!tot) return;
    posStats[p.id] = tot;
    const recentD = uniq(l.map(e => e.date)).slice(-3);
    const rec3 = sumS(l.filter(e => recentD.includes(e.date))), before = sumS(l.filter(e => !recentD.includes(e.date)));
    posRows += `<tr><td>${p.label}</td><td>${p.kind}</td><td>${tot.m}/${tot.a}</td><td>${pc(tot.p)}</td><td>${pc(rec3 && rec3.p)}</td><td>${rec3 && before ? pp(rec3.p - before.p) : '–'}</td></tr>`;
  });
  const rank = db.roster.map(p => { const v = byDate(p.id), d = v.filter(Boolean); return { p, n: d.length, last: d[d.length - 1], avg: avgP(d.slice(-5)), tr: trendOf(v) }; }).filter(x => x.n).sort((a, b) => b.avg - a.avg);
  const name = nameOf(sel);
  const prog = `<div class="card">
      <h2>Progresso · ${esc(name)}</h2>
      <div class="tiles">
        <div class="tile"><div class="v">${pc(last && last.p)}</div><div class="k">Último treino${last ? ` (${last.m}/${last.a})` : ''}</div></div>
        <div class="tile"><div class="v">${pc(avgP(done.slice(-5)))}</div><div class="k">Média últimos 5 treinos</div></div>
        <div class="tile"><div class="v" style="font-size:26px">${pp(trendOf(main))}</div><div class="k">Início → agora</div></div>
        <div class="tile"><div class="v">${done.reduce((s, x) => s + x.a, 0)}</div><div class="k">Lançamentos neste exercício</div></div>
      </div>
      <div class="lg">${sel === 'team' ? '<span><i></i>Equipa</span>' : `<span><i></i>${esc(name)}</span><span><i class="ref"></i>Média da equipa</span>`}</div>
      ${chart(dates.map(date => ({ date })), main, sel === 'team' ? null : team, name)}
    </div>
    <div class="card"><h2>Por posição · ${esc(name)}</h2><p class="hint" style="margin:-4px 0 10px">Junta todos os exercícios de séries. Percentagem de acerto em cada posição.</p>
      <div class="posgrid">${posCourt(null, posStats)}
      <div class="tablewrap"><table><thead><tr><th>Posição</th><th>Tipo</th><th>Conv./Tent.</th><th>%</th><th>Últ. 3 treinos</th><th>Evolução</th></tr></thead><tbody>${posRows || '<tr><td colspan="6">Sem dados.</td></tr>'}</tbody></table></div></div>
    </div>
    <div class="card"><h2>Ranking · ${esc(ex.name)}</h2><div class="tablewrap"><table>
      <thead><tr><th>Jogadora</th><th>Treinos</th><th>Último</th><th>Média últ. 5</th><th>Evolução</th></tr></thead>
      <tbody><tr class="click ${sel === 'team' ? 'on' : ''}" data-t="pp" data-v="team"><td><span class="nn">—</span>Equipa</td><td>${team.filter(Boolean).length}</td><td>${pc(team.filter(Boolean).slice(-1)[0]?.p)}</td><td>${pc(avgP(team.filter(Boolean).slice(-5)))}</td><td>${pp(trendOf(team))}</td></tr>
      ${rank.map(x => `<tr class="click ${sel === x.p.id ? 'on' : ''}" data-t="pp" data-v="${x.p.id}"><td><span class="nn">${x.p.num}</span>${esc(x.p.name)}</td><td>${x.n}</td><td>${pc(x.last && x.last.p)}</td><td>${pc(x.avg)}</td><td>${pp(x.tr)}</td></tr>`).join('')}</tbody>
    </table></div><p class="legend">Toca numa linha para ver essa jogadora. "Evolução" compara os 3 primeiros treinos com os 3 mais recentes, em pontos percentuais (pp).</p></div>`;
  return [rec, prog];
}

function goalViews(ex) {
  const tu = UI.train, G = T().goals;
  const key = (d, p, part) => `${d}|${ex.id}|${p}|${part}`;
  const rows = activeR().slice().sort((a, b) => a.num - b.num).map(p => `<tr><td><span class="nn">${p.num}</span>${esc(short(p))}</td>${ex.parts.map(pt => {
    const v = G[key(tu.date, p.id, pt.id)];
    return `<td class="c"><button class="gc ${v === true ? 'ok' : v === false ? 'ko' : ''}" data-t="gcell" data-p="${p.id}" data-part="${pt.id}" aria-label="${esc(p.name)} · ${esc(pt.label)}">${v === true ? '✓' : v === false ? '✗' : '·'}</button></td>`;
  }).join('')}</tr>`).join('');
  const rec = `<div class="rowline" style="margin:0"><h2>Registar</h2>${dateField(tu.date)}</div>
    <p class="hint" style="margin:0">Toca uma vez para ✓ conseguiu, outra para ✗ não conseguiu, outra para limpar. Jogadoras sem registo contam como ausentes.</p>
    ${rows ? `<div class="tablewrap"><table class="goalt"><thead><tr><th>Jogadora</th>${ex.parts.map(pt => `<th class="c">${esc(pt.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : noPlayers}`;

  const dates = uniq(Object.keys(G).filter(k => k.split('|')[1] === ex.id).map(k => k.split('|')[0]));
  const sel = tu.prog;
  const rate = (who, d, part) => { let m = 0, a = 0; (who === 'team' ? db.roster.map(p => p.id) : [who]).forEach(pid => (part ? [part] : ex.parts.map(x => x.id)).forEach(pt => { const v = G[key(d, pid, pt)]; if (v !== undefined) { a++; if (v) m++; } })); return a ? { m, a, p: m / a } : null; };
  const main = dates.map(d => rate(sel, d)), team = dates.map(d => rate('team', d));
  const name = nameOf(sel);
  const partTiles = ex.parts.map(pt => { const v = dates.map(d => rate(sel, d, pt.id)); return `<div class="tile"><div class="v">${pc(avgP(v))}</div><div class="k">${esc(pt.label)}<br>últimos 5: ${pc(avgP(v.filter(Boolean).slice(-5)))}</div></div>`; }).join('');
  const strip = (pid, pt) => dates.map(d => G[key(d, pid, pt)]).filter(v => v !== undefined).slice(-8).map(v => `<i class="${v ? 'ok' : 'ko'}"></i>`).join('');
  const pRows = activeR().slice().sort((a, b) => a.num - b.num).map(p => {
    const cells = ex.parts.map(pt => {
      const vals = dates.map(d => G[key(d, p.id, pt.id)]).filter(v => v !== undefined), ok = vals.filter(Boolean).length;
      return vals.length ? `<td>${ok}/${vals.length} <span class="hint">${pc(ok / vals.length)}</span><span class="strip">${strip(p.id, pt.id)}</span></td>` : '<td>–</td>';
    }).join('');
    return `<tr class="click ${sel === p.id ? 'on' : ''}" data-t="pp" data-v="${p.id}"><td><span class="nn">${p.num}</span>${esc(short(p))}</td>${cells}</tr>`;
  }).join('');
  const prog = `<div class="card"><h2>Taxa de sucesso · ${esc(name)}</h2>
      <div class="tiles">${partTiles}</div>
      <div class="lg">${sel === 'team' ? '<span><i></i>Equipa · todas as partes</span>' : `<span><i></i>${esc(name)}</span><span><i class="ref"></i>Equipa</span>`}</div>
      ${chart(dates.map(date => ({ date })), main, sel === 'team' ? null : team, name)}
    </div>
    <div class="card"><h2>Por jogadora</h2><div class="tablewrap"><table>
      <thead><tr><th>Jogadora</th>${ex.parts.map(pt => `<th>${esc(pt.label)}</th>`).join('')}</tr></thead>
      <tbody><tr class="click ${sel === 'team' ? 'on' : ''}" data-t="pp" data-v="team"><td><span class="nn">—</span>Equipa</td>${ex.parts.map(() => '<td></td>').join('')}</tr>${pRows}</tbody>
    </table></div><p class="legend">Conseguiu / vezes que fez o desafio. As barrinhas mostram os últimos 8 treinos: verde conseguiu, vermelho não conseguiu.</p></div>`;
  return [rec, prog];
}

function teamViews(ex) {
  const tu = UI.train, cur = T().team[`${tu.date}|${ex.id}`] || { parts: {}, note: '' };
  const rec = `<div class="rowline" style="margin:0"><h2>Registar</h2>${dateField(tu.date)}</div>
    ${ex.parts.map(pt => { const v = cur.parts[pt.id]; return `<div class="spotrow"><div class="sh"><span class="flowtitle">${esc(pt.label)}</span></div>
      <div class="grid" style="grid-template-columns:1fr 1fr"><button class="act ok" data-t="tpart" data-part="${pt.id}" data-v="1" aria-pressed="${v === true}"><b>✓ Conseguiram</b></button><button class="act ko" data-t="tpart" data-part="${pt.id}" data-v="0" aria-pressed="${v === false}"><b>✗ Não</b></button></div></div>`; }).join('')}
    <label class="field"><span class="label">Nota (tempo, tentativas, quem falhou…)</span><input id="tnote" type="text" value="${esc(cur.note)}" placeholder="ex.: 4:30, 3.ª tentativa"></label>`;
  const keys = Object.keys(T().team).filter(x => x.split('|')[1] === ex.id).sort().reverse();
  const tiles = ex.parts.map(pt => {
    const v = keys.map(x => T().team[x].parts[pt.id]).filter(x => x !== undefined), ok = v.filter(Boolean).length, r5 = v.slice(0, 5), ok5 = r5.filter(Boolean).length;
    return `<div class="tile"><div class="v">${v.length ? `${ok}/${v.length}` : '–'}</div><div class="k">${esc(pt.label)} · ${v.length ? pc(ok / v.length) : '–'}<br>últimos 5: ${r5.length ? `${ok5}/${r5.length}` : '–'}</div></div>`;
  }).join('');
  const hist = keys.map(x => { const t = T().team[x]; return `<tr><td>${fmtDate(x.split('|')[0])}</td>${ex.parts.map(pt => { const v = t.parts[pt.id]; return `<td class="c ${v === true ? 'up' : v === false ? 'down' : ''}">${v === true ? '✓' : v === false ? '✗' : '–'}</td>`; }).join('')}<td style="text-align:left;white-space:normal">${esc(t.note)}</td></tr>`; }).join('');
  const prog = `<div class="card"><h2>Histórico · ${esc(ex.name)}</h2><div class="tiles" style="margin-bottom:12px">${tiles}</div>
    <div class="tablewrap"><table><thead><tr><th>Treino</th>${ex.parts.map(pt => `<th class="c">${esc(pt.label)}</th>`).join('')}<th style="text-align:left">Nota</th></tr></thead><tbody>${hist || '<tr><td colspan="9">Ainda sem registos.</td></tr>'}</tbody></table></div></div>`;
  return [rec, prog];
}

export function init() {
  const vt = $('v-train');
  vt.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const tu = UI.train, a = b.dataset.t, v = b.dataset.v;
    const ex = T().exercises.find(x => x.id === tu.ex);
    if (a === 'ex') { tu.ex = v; tu.creating = false; tu.prog = 'team'; }
    else if (a === 'newex') tu.creating = !tu.creating;
    else if (a === 'cancelnew') tu.creating = false;
    else if (a === 'dtype') tu.draft.type = v;
    else if (a === 'create') {
      const d = tu.draft, name = d.name.trim();
      if (!name) { toast('Dá um nome ao exercício'); return; }
      const nx = { id: uid('x'), name, type: d.type };
      if (d.type === 'series') nx.per = Math.max(1, Math.min(50, parseInt(d.per, 10) || 10));
      else {
        nx.parts = d.parts.split(',').map(s => s.trim()).filter(Boolean).map((label, i) => ({ id: 'q' + i, label }));
        if (!nx.parts.length) { toast('Escreve pelo menos uma parte'); return; }
      }
      T().exercises.push(nx); save('training');
      Object.assign(tu, { ex: nx.id, creating: false, prog: 'team', draft: { name: '', type: 'series', per: 10, parts: '' } });
      toast(`Exercício "${name}" criado`);
    }
    else if (a === 'rp') tu.player = tu.player === v ? null : v;
    else if (a === 'pos') tu.pos = v;
    else if (a === 'pp') tu.prog = v;
    else if (a === 'snum') {
      T().series.push({ id: uid('s'), date: tu.date, ex: ex.id, p: tu.player, pos: tu.pos, made: +v, att: ex.per });
      touched(); toast(`#${P[tu.player].num} · ${PS[tu.pos].label}: ${v}/${ex.per} guardado`);
    }
    else if (a === 'sdel') { T().series = T().series.filter(x => x.id !== v); touched(); }
    else if (a === 'gcell') {
      const k = `${tu.date}|${ex.id}|${b.dataset.p}|${b.dataset.part}`, cur = T().goals[k];
      if (cur === undefined) T().goals[k] = true; else if (cur === true) T().goals[k] = false; else delete T().goals[k];
      touched();
    }
    else if (a === 'tpart') {
      const k = `${tu.date}|${ex.id}`, cur = T().team[k] = T().team[k] || { parts: {}, note: '' }, val = v === '1';
      if (cur.parts[b.dataset.part] === val) delete cur.parts[b.dataset.part]; else cur.parts[b.dataset.part] = val;
      if (!Object.keys(cur.parts).length && !cur.note) delete T().team[k];
      touched();
    }
    else return;
    app.render();
  });
  vt.addEventListener('input', e => {
    const d = UI.train.draft;
    if (e.target.id === 'exname') d.name = e.target.value;
    if (e.target.id === 'exper') d.per = e.target.value;
    if (e.target.id === 'exparts') d.parts = e.target.value;
  });
  vt.addEventListener('change', e => {
    const tu = UI.train;
    if (e.target.id === 'tdate' && e.target.value) { tu.date = e.target.value; app.render(); }
    if (e.target.id === 'tnote') {
      const k = `${tu.date}|${tu.ex}`, cur = T().team[k] = T().team[k] || { parts: {}, note: '' };
      cur.note = e.target.value; touched(); app.render();
    }
  });
  attachTips(vt);
}
