/* Geometria do meio-campo FIBA, em decímetros: 150 × 140, cesto a 1,575 m da linha de fundo. */
export const BX = 75, BY = 15.75, R3 = 67.5, CORNER_Y = 29.9;

export function zone(x, y) {
  if (y <= CORNER_Y && (x < 9 || x > 141)) return 'c3';
  if (Math.hypot(x - BX, y - BY) > R3) return 'a3';
  if (x >= 50.5 && x <= 99.5 && y <= 58) return 'paint';
  return 'mid';
}
export const ZONES = { paint: 'Garrafão', mid: 'Média distância', c3: 'Triplo de canto', a3: 'Triplo frontal/lateral' };
export const isThree = z => z === 'c3' || z === 'a3';

export function courtLines() {
  return `<rect class="floor" x="0" y="0" width="150" height="140"/>
  <rect class="paintz" x="50.5" y="0" width="49" height="58"/>
  <rect class="ln" x="0" y="0" width="150" height="140"/>
  <rect class="ln" x="50.5" y="0" width="49" height="58"/>
  <path class="ln" d="M9 0 V29.9 A67.5 67.5 0 0 0 141 29.9 V0"/>
  <path class="ln" d="M57 58 A18 18 0 0 0 93 58"/>
  <path class="ln dash" d="M57 58 A18 18 0 0 1 93 58"/>
  <path class="ln" d="M62.5 15.75 A12.5 12.5 0 0 0 87.5 15.75"/>
  <path class="ln" d="M57 140 A18 18 0 0 1 93 140"/>
  <line class="ln" x1="66" y1="12" x2="84" y2="12" style="stroke-width:.9"/>
  <circle class="hoop" cx="75" cy="15.75" r="2.25"/>`;
}

export function mark(e, cls) {
  if (e.made) return `<circle class="mk-made ${cls || ''}" cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="2.6"/>`;
  const s = 2.1, x = e.x, y = e.y;
  return `<g class="mk-miss ${cls || ''}"><line x1="${x - s}" y1="${y - s}" x2="${x + s}" y2="${y + s}"/><line x1="${x - s}" y1="${y + s}" x2="${x + s}" y2="${y - s}"/></g>`;
}

/* posições de treino */
export const POS = [
  { id: 'c3e', label: 'Canto esq.', kind: '3P', x: 6, y: 10 },
  { id: 'a3e', label: '45º esq.', kind: '3P', x: 22, y: 66 },
  { id: 'f3', label: 'Frente', kind: '3P', x: 75, y: 91 },
  { id: 'a3d', label: '45º dir.', kind: '3P', x: 128, y: 66 },
  { id: 'c3d', label: 'Canto dir.', kind: '3P', x: 144, y: 10 },
  { id: 'b2e', label: 'Fundo esq.', kind: '2P', x: 30, y: 12 },
  { id: 'k2e', label: 'Cotovelo esq.', kind: '2P', x: 47, y: 56 },
  { id: 'll', label: 'Lance livre', kind: 'LL', x: 75, y: 62 },
  { id: 'k2d', label: 'Cotovelo dir.', kind: '2P', x: 103, y: 56 },
  { id: 'b2d', label: 'Fundo dir.', kind: '2P', x: 120, y: 12 }
];
export const PS = Object.fromEntries(POS.map(p => [p.id, p]));

export function posCourt(selected, stats) {
  let g = courtLines();
  POS.forEach(p => {
    if (stats) {
      const st = stats[p.id], op = st ? .25 + .75 * st.p : 0;
      g += `<g><circle cx="${p.x}" cy="${p.y}" r="8" class="spot" ${st ? `style="fill:rgba(242,165,65,${op.toFixed(2)})"` : ''}/>
        <text x="${p.x}" y="${p.y + 2.4}" text-anchor="middle" class="spott ${st && st.p > .55 ? 'dark' : ''}">${st ? Math.round(st.p * 100) : '–'}</text></g>`;
    } else {
      const on = selected === p.id;
      g += `<g data-t="pos" data-v="${p.id}" class="spotbtn"><circle cx="${p.x}" cy="${p.y}" r="10" fill="transparent"/><circle cx="${p.x}" cy="${p.y}" r="7.5" class="spot ${on ? 'on' : ''}"/>
        <text x="${p.x}" y="${p.y + 2.3}" text-anchor="middle" class="spott ${on ? 'dark' : ''}">${p.kind === 'LL' ? 'LL' : p.kind === '3P' ? '3' : '2'}</text></g>`;
    }
  });
  return `<svg class="poscourt" viewBox="-4 -2 158 106" aria-label="Posições de lançamento">${g}</svg>`;
}
