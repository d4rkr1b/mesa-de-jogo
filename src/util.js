export const $ = id => document.getElementById(id);
export const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const uid = (prefix = '') => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* datas */
export const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export const fmtDate = s => { const [, m, d] = s.split('-'); return `${+d} ${MES[+m - 1]}`; };
export const wdDate = s => { const d = new Date(s + 'T00:00'); return `${WD[d.getDay()]}, ${fmtDate(s)}`; };
export const ageOf = b => {
  if (!b) return null;
  const d = new Date(b + 'T00:00'), n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a;
};
export const fmtClock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
export const qLabel = q => q > 4 ? 'P' + (q - 4) : q + '.º';

/* números */
export const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '–';
export const sgn = n => n > 0 ? '+' + n : String(n);
export const pmCls = n => n > 0 ? 'pos' : n < 0 ? 'neg' : '';
export const clamp = v => Math.max(.03, Math.min(.97, v));
export const uniq = a => [...new Set(a)].sort();
export const pc = v => v == null ? '–' : Math.round(v * 100) + '%';
export const pp = v => v == null ? '–' : `<span class="${v > 0.005 ? 'up' : v < -0.005 ? 'down' : ''}">${v > 0.005 ? '▲' : v < -0.005 ? '▼' : '='} ${Math.abs(Math.round(v * 100))} pp</span>`;
export const sumS = list => { let m = 0, a = 0; list.forEach(e => { m += e.made; a += e.att; }); return a ? { m, a, p: m / a } : null; };
export const avgP = arr => {
  const v = arr.filter(Boolean); if (!v.length) return null;
  const m = v.reduce((s, x) => s + x.m, 0), a = v.reduce((s, x) => s + x.a, 0);
  return a ? m / a : null;
};
export function trendOf(vals) {
  const v = vals.filter(Boolean); if (v.length < 4) return null;
  const n = Math.min(3, Math.floor(v.length / 2));
  return avgP(v.slice(-n)) - avgP(v.slice(0, n));
}

let toastT;
export function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2000);
}

/* confirmação com dois toques, sem diálogos do sistema */
const pending = {};
export function confirmTap(key, rerender) {
  if (pending[key]) { clearTimeout(pending[key]); delete pending[key]; return true; }
  pending[key] = setTimeout(() => { delete pending[key]; rerender(); }, 3000);
  rerender();
  return false;
}
export const isConfirming = key => !!pending[key];
