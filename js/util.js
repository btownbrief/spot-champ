/* Spot Champ — shared helpers (works in the browser and in node for tests). */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});

  // mulberry32: small, fast, deterministic
  function rng(seed) {
    let a = seed >>> 0;
    const r = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)); // inclusive
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    r.weighted = (pairs) => { // [[item, weight], ...]
      let s = 0; for (const p of pairs) s += p[1];
      let x = r() * s; for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    };
    return r;
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return h >>> 0;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const TAU = Math.PI * 2;

  // color: '#rrggbb' -> shaded '#rrggbb' (k<0 darker, k>0 lighter)
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    const h = (v) => ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2);
    return '#' + h(r) + h(g) + h(b);
  }
  function mix(a, b, t) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const h = (v) => ('0' + Math.round(v).toString(16)).slice(-2);
    return '#' + h(lerp((x >> 16) & 255, (y >> 16) & 255, t)) + h(lerp((x >> 8) & 255, (y >> 8) & 255, t)) + h(lerp(x & 255, y & 255, t));
  }
  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  Object.assign(SC, { rng, hashStr, clamp, lerp, easeOut, easeInOut, easeOutBack, TAU, shade, mix, todayKey, fmtTime });
})(typeof window !== 'undefined' ? window : globalThis);
