import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { db, P, short } from './state.js';
import { compute, efg, ts, poss, insights, playedIn } from './stats.js';
import { zone, ZONES } from './court.js';
import { pct, sgn, qLabel } from './util.js';

/* Relatório de jogo em A4, desenhado em vetorial (texto e campo nítidos em qualquer zoom). */

const C = {
  ink: [23, 27, 33], mute: [112, 120, 132], line: [222, 225, 230], soft: [245, 244, 241],
  accent: [214, 138, 30], made: [35, 150, 95], miss: [206, 68, 68], white: [255, 255, 255], court: [150, 156, 166]
};
const W = 210, H = 297, M = 14;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// Helvetica do PDF usa WinAnsi: troca os poucos símbolos que lá não existem
const clean = s => String(s).replace(/−/g, '-').replace(/→/g, '->').replace(/[✓✗]/g, '');
const longDate = s => { const [y, m, d] = s.split('-'); return `${+d} de ${MESES[+m - 1]} de ${y}`; };
const num = id => P[id] ? P[id].num : '?';

export function buildReport(g) {
  const st = compute(g.events), t = st.team;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `Relatório · ${g.comp} vs ${g.opponent} · ${g.date}`, creator: 'Mesa de Jogo' });
  const fill = c => doc.setFillColor(...c), stroke = c => doc.setDrawColor(...c), color = c => doc.setTextColor(...c);
  const text = (s, x, y, o = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size || 10); color(o.color || C.ink);
    doc.text(clean(s), x, y, { align: o.align || 'left', baseline: o.baseline || 'alphabetic', maxWidth: o.maxWidth });
  };
  const section = (title, y) => { text(title.toUpperCase(), M, y, { size: 8.5, bold: true, color: C.mute }); stroke(C.line); doc.setLineWidth(.3); doc.line(M, y + 2, W - M, y + 2); return y + 7; };
  const tableBase = {
    theme: 'plain', margin: { left: M, right: M },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.6, bottom: 1.6, left: 1.4, right: 1.4 }, textColor: C.ink, lineColor: C.line, halign: 'right' },
    headStyles: { fontStyle: 'bold', textColor: C.mute, fontSize: 7, lineWidth: { bottom: .3 } },
    bodyStyles: { lineWidth: { bottom: .15 } },
    footStyles: { fontStyle: 'bold', lineWidth: { top: .4 }, textColor: C.ink }
  };

  // colunas de texto (índices em leftCols) alinhadas à esquerda, também no cabeçalho
  const table = (opts, leftCols = [0]) => {
    const inner = opts.didParseCell;
    autoTable(doc, { ...opts, didParseCell: d => { if (leftCols.includes(d.column.index)) d.cell.styles.halign = 'left'; if (inner) inner(d); } });
  };

  /* ---------- página 1 ---------- */
  const us = t.pts, them = st.opp, fin = g.status === 'final';
  const result = !fin ? 'Jogo a decorrer' : us > them ? 'Vitória' : us < them ? 'Derrota' : 'Empate';
  fill(C.ink); doc.rect(0, 0, W, 40, 'F');
  text('RELATÓRIO DE JOGO', M, 11, { size: 8, bold: true, color: C.accent });
  text(`${longDate(g.date)} · ${g.home ? 'Casa' : 'Fora'} · ${g.comp}`, W - M, 11, { size: 8, color: [190, 195, 204], align: 'right' });
  text(g.comp, M, 27, { size: 20, bold: true, color: C.white });
  text(`${us} – ${them}`, W / 2, 28, { size: 26, bold: true, color: C.white, align: 'center' });
  text(g.opponent, W - M, 27, { size: 20, bold: true, color: C.white, align: 'right', maxWidth: 70 });
  text(result, W / 2, 35, { size: 9, bold: true, color: !fin ? C.accent : us >= them ? [110, 210, 150] : [240, 120, 120], align: 'center' });

  let y = 50;
  y = section('Parciais', y);
  const qs = Object.keys(st.qs).map(Number).sort((a, b) => a - b);
  table({
    ...tableBase, startY: y, tableWidth: 26 + 16 * (qs.length + 1),
    head: [['', ...qs.map(qLabel), 'Total']],
    body: [[g.comp, ...qs.map(q => st.qs[q].us), us], [clean(g.opponent), ...qs.map(q => st.qs[q].them), them]],
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 26 } }
  });
  y = doc.lastAutoTable.finalY + 8;

  y = section('Equipa', y);
  const P0 = poss(t);
  const tiles = [
    [efg(t), 'eFG%'], [ts(t), 'TS%'], [String(Math.round(P0)), 'Posses (est.)'], [P0 > 0 ? (t.pts / P0).toFixed(2) : '–', 'Pontos por posse'], [String(t.tov), 'Perdas de bola'],
    [`${t.fgm}/${t.fga}`, `Lanç. campo · ${pct(t.fgm, t.fga)}`], [`${t.tpm}/${t.tpa}`, `Triplos · ${pct(t.tpm, t.tpa)}`], [`${t.ftm}/${t.fta}`, `Lances livres · ${pct(t.ftm, t.fta)}`], [`${t.orb + t.drb}`, `Ressaltos (${t.orb} of. · ${t.drb} def.)`], [`${t.ast} · ${t.stl}`, 'Assistências · roubos']
  ];
  const tw = (W - 2 * M - 4 * 3) / 5, th = 15;
  tiles.forEach(([v, k], i) => {
    const x = M + (i % 5) * (tw + 3), yy = y + Math.floor(i / 5) * (th + 3);
    fill(C.soft); doc.roundedRect(x, yy, tw, th, 1.5, 1.5, 'F');
    text(v, x + 3, yy + 7.5, { size: 13, bold: true });
    text(k, x + 3, yy + 12, { size: 6.8, color: C.mute, maxWidth: tw - 5 });
  });
  y += 2 * (th + 3) + 6;

  const ins = insights(st);
  if (ins.length) {
    y = section('Leitura automática', y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    ins.forEach(i => {
      const lines = doc.splitTextToSize(clean(i.t), W - 2 * M - 6);
      fill(i.c === 'good' ? C.made : i.c === 'bad' ? C.miss : i.c === 'warn' ? C.accent : C.court);
      doc.circle(M + 1.2, y - 1.1, 1, 'F');
      color(C.ink); doc.text(lines, M + 5, y);
      y += lines.length * 4.2 + 1.2;
    });
    y += 4;
  }

  y = section('Ficha de jogo', y);
  const players = db.roster.filter(p => playedIn(g, p.id) || Object.values(st.pl[p.id] || {}).some(v => v)).sort((a, b) => a.num - b.num);
  const line = s => [s.pts, `${s.fgm}/${s.fga}`, pct(s.fgm, s.fga), `${s.tpm}/${s.tpa}`, `${s.ftm}/${s.fta}`, s.orb, s.drb, s.orb + s.drb, s.ast, s.stl, s.blk, s.tov, s.pf];
  table({
    ...tableBase, startY: y,
    head: [['#', 'Jogadora', 'PTS', 'LC', 'LC%', '3P', 'LL', 'RO', 'RD', 'RT', 'AST', 'RB', 'DS', 'PB', 'FP', '+/-', 'eFG%']],
    body: players.map(p => { const s = st.pl[p.id]; return [p.num, clean(p.name), ...line(s), sgn(s.pm), efg(s)]; }),
    foot: [['', 'Equipa', ...line(t), '', efg(t)]],
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 7 }, 1: { halign: 'left', cellWidth: 36 }, 2: { fontStyle: 'bold' } },
    didParseCell: d => {
      if (d.section === 'body' && d.column.index === 15) { const v = +String(d.cell.raw).replace('+', ''); d.cell.styles.textColor = v > 0 ? C.made : v < 0 ? C.miss : C.ink; }
      if (d.section === 'body' && d.row.index % 2 === 1) d.cell.styles.fillColor = C.soft;
    }
  }, [0, 1]);
  y = doc.lastAutoTable.finalY + 4;
  text('LC lançamentos de campo · 3P triplos · LL lances livres · RO/RD/RT ressaltos · AST assistências · RB roubos · DS desarmes · PB perdas de bola · FP faltas pessoais · +/- saldo em campo · eFG% = (LC + 0,5×3P) / LCT · TS% = PTS / (2×(LCT + 0,44×LLT))', M, y + 2, { size: 6.5, color: C.mute, maxWidth: W - 2 * M });

  /* ---------- página 2 ---------- */
  doc.addPage();
  y = 18;
  text('Lançamentos e quintetos', M, y, { size: 16, bold: true });
  text(`${g.comp} vs ${g.opponent} · ${longDate(g.date)}`, W - M, y, { size: 8.5, color: C.mute, align: 'right' });
  y += 8;
  y = section('Mapa de lançamentos', y);

  const shots = g.events.filter(e => e.t === 'shot');
  const cw = 92, s = cw / 150, ox = M, oy = y;
  const X = x => ox + x * s, Y = v => oy + v * s;
  const arc = (cx, cy, r, a0, a1, n = 40) => { for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n; doc.line(X(cx + r * Math.cos(t0)), Y(cy + r * Math.sin(t0)), X(cx + r * Math.cos(t1)), Y(cy + r * Math.sin(t1))); } };
  const rad = d => d * Math.PI / 180;
  fill(C.soft); doc.rect(X(0), Y(0), 150 * s, 140 * s, 'F');
  fill([236, 233, 226]); doc.rect(X(50.5), Y(0), 49 * s, 58 * s, 'F');
  stroke(C.court); doc.setLineWidth(.3);
  doc.rect(X(0), Y(0), 150 * s, 140 * s, 'S');
  doc.rect(X(50.5), Y(0), 49 * s, 58 * s, 'S');
  doc.line(X(9), Y(0), X(9), Y(29.9)); doc.line(X(141), Y(0), X(141), Y(29.9));
  const a3 = Math.atan2(29.9 - 15.75, 9 - 75), b3 = Math.atan2(29.9 - 15.75, 141 - 75);
  arc(75, 15.75, 67.5, a3, b3, 60);
  arc(75, 58, 18, rad(180), 0);
  doc.setLineDashPattern([.8, .8], 0); arc(75, 58, 18, rad(180), rad(360)); doc.setLineDashPattern([], 0);
  arc(75, 15.75, 12.5, rad(180), 0);
  arc(75, 140, 18, rad(180), rad(360));
  doc.setLineWidth(.5); doc.line(X(66), Y(12), X(84), Y(12));
  stroke(C.accent); doc.circle(X(75), Y(15.75), 2.25 * s, 'S');
  shots.forEach(e => {
    if (e.made) { fill(C.made); stroke(C.white); doc.setLineWidth(.2); doc.circle(X(e.x), Y(e.y), 1.1, 'FD'); }
    else { stroke(C.miss); doc.setLineWidth(.35); const d = .9; doc.line(X(e.x) - d, Y(e.y) - d, X(e.x) + d, Y(e.y) + d); doc.line(X(e.x) - d, Y(e.y) + d, X(e.x) + d, Y(e.y) - d); }
  });
  const courtBottom = Y(140);
  fill(C.made); doc.circle(ox + 1, courtBottom + 3.6, 1, 'F');
  text('cesto', ox + 3, courtBottom + 4.5, { size: 7, color: C.mute });
  text('×', ox + 13, courtBottom + 4.6, { size: 9, bold: true, color: C.miss });
  text('falhado', ox + 16, courtBottom + 4.5, { size: 7, color: C.mute });

  const zs = {}; Object.keys(ZONES).forEach(k => { zs[k] = { m: 0, a: 0 }; });
  shots.forEach(e => { const k = zone(e.x, e.y); zs[k].a++; if (e.made) zs[k].m++; });
  table({
    ...tableBase, startY: y, margin: { left: M + cw + 8, right: M },
    head: [['Zona', 'Conv./Tent.', '%', 'Pts/lanç.']],
    body: Object.keys(ZONES).map(k => { const v = zs[k], pv = k === 'c3' || k === 'a3' ? 3 : 2; return [ZONES[k], `${v.m}/${v.a}`, pct(v.m, v.a), v.a ? (v.m * pv / v.a).toFixed(2) : '–']; }),
    foot: [['Total', `${t.fgm}/${t.fga}`, pct(t.fgm, t.fga), t.fga ? ((t.pts - t.ftm) / t.fga).toFixed(2) : '–']],
    columnStyles: { 0: { halign: 'left' } }
  });
  const zy = doc.lastAutoTable.finalY + 5;
  text('Pts/lanç. compara zonas com valores diferentes: um triplo a 33% vale o mesmo que um lançamento de 2 a 50%.', M + cw + 8, zy, { size: 7, color: C.mute, maxWidth: W - 2 * M - cw - 8 });

  y = Math.max(courtBottom + 10, zy + 12);
  y = section('Lançamentos por jogadora', y);
  const zcell = (list, k) => { const l = list.filter(e => zone(e.x, e.y) === k), m = l.filter(e => e.made).length; return l.length ? `${m}/${l.length}` : '–'; };
  const shooters = players.filter(p => shots.some(e => e.p === p.id));
  table({
    ...tableBase, startY: y,
    head: [['#', 'Jogadora', 'Garrafão', 'Média dist.', 'Triplo canto', 'Triplo front./lat.', 'Total', '%']],
    body: shooters.map(p => { const l = shots.filter(e => e.p === p.id), m = l.filter(e => e.made).length; return [p.num, clean(short(p)), zcell(l, 'paint'), zcell(l, 'mid'), zcell(l, 'c3'), zcell(l, 'a3'), `${m}/${l.length}`, pct(m, l.length)]; }),
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 7 }, 1: { halign: 'left' } },
    didParseCell: d => { if (d.section === 'body' && d.row.index % 2 === 1) d.cell.styles.fillColor = C.soft; }
  }, [0, 1]);
  y = doc.lastAutoTable.finalY + 8;

  const lu = st.lineups.filter(l => l.for || l.against || l.poss > 0).sort((a, b) => (b.for - b.against) - (a.for - a.against));
  if (lu.length) {
    if (y > H - 50) { doc.addPage(); y = 18; }
    y = section('Quintetos', y);
    table({
      ...tableBase, startY: y,
      head: [['Quinteto', 'Jogadoras', 'Marcados', 'Sofridos', '+/-', 'Posses (est.)', 'Pts/posse']],
      body: lu.slice(0, 10).map(l => { const d = l.for - l.against; return [l.on.map(num).join(' · '), clean(l.on.map(i => P[i] ? short(P[i]).split(' ').pop() : '').join(', ')), l.for, l.against, sgn(d), Math.max(0, Math.round(l.poss)), l.poss >= 1 ? (l.for / l.poss).toFixed(2) : '–']; }),
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'left', textColor: C.mute } },
      didParseCell: d => { if (d.section === 'body' && d.column.index === 4) { const v = +String(d.cell.raw).replace('+', ''); d.cell.styles.textColor = v > 0 ? C.made : v < 0 ? C.miss : C.ink; } }
    }, [0, 1]);
  }

  /* rodapé */
  const pages = doc.getNumberOfPages(), stamp = new Date().toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    text(`Mesa de Jogo · gerado em ${stamp}`, M, H - 8, { size: 7, color: C.mute });
    text(`${i}/${pages}`, W - M, H - 8, { size: 7, color: C.mute, align: 'right' });
  }

  const slug = g.opponent.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { blob: doc.output('blob'), name: `relatorio-${g.date}-${g.comp.toLowerCase()}-vs-${slug || 'adversario'}.pdf` };
}
