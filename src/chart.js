import { fmtDate, pc } from './util.js';

/* Linha de percentagem por treino/jogo, com série de referência opcional (média da equipa). */
export function chart(sessions, main, ref, mainName) {
  const W = 640, H = 240, ml = 40, mr = 46, mt = 16, mb = 30, n = sessions.length;
  const all = [...main, ...(ref || [])].filter(Boolean).map(v => v.p * 100);
  if (!all.length) return '<p class="hint">Ainda sem registos.</p>';
  const lo = Math.max(0, Math.floor((Math.min(...all) - 5) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...all) + 5) / 10) * 10);
  const x = i => ml + (n === 1 ? (W - ml - mr) / 2 : i * (W - ml - mr) / (n - 1));
  const y = v => mt + (hi - v) / Math.max(1, hi - lo) * (H - mt - mb);
  const step = hi - lo > 50 ? 20 : 10;
  let g = '';
  for (let v = lo; v <= hi; v += step) g += `<line class="gridl" x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${ml - 8}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`;
  const every = Math.max(1, Math.ceil(n / 6));
  sessions.forEach((s, i) => { if (i % every === 0 || i === n - 1) g += `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${s.label || fmtDate(s.date)}</text>`; });
  const path = ser => ser.map((v, i) => v ? [x(i), y(v.p * 100)] : null).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  if (ref) g += `<path d="${path(ref)}" fill="none" stroke="var(--mute)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
  g += `<path d="${path(main)}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
  let lastI = -1; main.forEach((v, i) => { if (v) lastI = i; });
  main.forEach((v, i) => { if (!v) return; g += `<circle cx="${x(i)}" cy="${y(v.p * 100)}" r="${i === lastI ? 5.5 : 4}" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"/>`; });
  if (lastI >= 0) g += `<text x="${x(lastI) + 10}" y="${y(main[lastI].p * 100) + 5}" fill="var(--ink)" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="17">${pc(main[lastI].p)}</text>`;
  sessions.forEach((s, i) => {
    const v = main[i], rv = ref && ref[i];
    const x0 = n === 1 ? ml : (i === 0 ? ml : (x(i - 1) + x(i)) / 2), x1 = n === 1 ? W - mr : (i === n - 1 ? W - mr : (x(i) + x(i + 1)) / 2);
    const tip = `${s.label || fmtDate(s.date)} · ${mainName}: ${v ? `${v.m}/${v.a} (${pc(v.p)})` : 'sem registo'}${rv ? ` · Equipa ${pc(rv.p)}` : ''}`;
    const ty = v ? y(v.p * 100) : (rv ? y(rv.p * 100) : mt);
    g += `<rect x="${x0}" y="${mt}" width="${Math.max(1, x1 - x0)}" height="${H - mt - mb}" fill="transparent" data-tip="${tip}" data-tx="${x(i) / W * 100}" data-ty="${ty / H * 100}"/>`;
  });
  return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução">${g}</svg><div class="tip" hidden></div></div>`;
}

export function attachTips(el) {
  const show = e => {
    const wrap = e.target.closest('.chartwrap'); if (!wrap) return;
    const hit = e.target.closest('[data-tip]'), tip = wrap.querySelector('.tip');
    if (!hit) { tip.hidden = true; return; }
    tip.textContent = hit.dataset.tip; tip.style.left = hit.dataset.tx + '%'; tip.style.top = hit.dataset.ty + '%'; tip.hidden = false;
  };
  el.addEventListener('pointerover', show);
  el.addEventListener('pointerdown', show);
  el.addEventListener('pointerleave', () => el.querySelectorAll('.tip').forEach(t => { t.hidden = true; }));
}
