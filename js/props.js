/* Spot Champ — code-drawn props: stalls, fountain, trees, umbrellas, snowbanks, floats...
   Same conventions as art.js (origin = front-bottom centre of the prop, y up negative). */
(function (root) {
  'use strict';
  const SC = root.SC;
  const { TAU, shade } = SC;
  const { rr, ell, circ, paint, shadow, line, dot, leaf } = SC.ART;
  const OUT = SC.OUT;

  function stripes(c, x0, x1, y0, y1, n, c1, c2) {
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? c2 : c1; c.fillRect(x0 + i * w, y0, w + 0.3, y1 - y0); }
  }
  function goods(c, kind, w, y, r) {
    const n = Math.floor(w / 9);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 5 + i * ((w - 10) / Math.max(1, n - 1));
      if (kind === 'produce') { const col = ['#e63946', '#7bd389', '#ff9f43', '#ffd23f', '#9b5de5'][i % 5]; paint(c, () => rr(c, x - 4, y - 3, 8, 3.2, 0.6), '#b98a52', { shade: false, lw: 0.7 }); paint(c, () => { circ(c, x - 2, y - 4, 1.8); circ(c, x + 1.8, y - 4.2, 1.8); circ(c, x, y - 6, 1.8); }, col, { shade: false, lw: 0.6 }); }
      else if (kind === 'maple') { paint(c, () => rr(c, x - 2.2, y - 7, 4.4, 7, 1), '#d98a2b', { shade: false, lw: 0.6, detail: () => { c.fillStyle = '#f7f1e3'; c.fillRect(x - 2.2, y - 4.6, 4.4, 2.4); } }); }
      else if (kind === 'food') { paint(c, () => ell(c, x, y - 1.6, 3.4, 1.8), ['#ffd23f', '#ff9f43', '#f3d9a4'][i % 3], { shade: false, lw: 0.6 }); }
      else if (kind === 'creemee') { paint(c, () => { c.moveTo(x - 1.8, y - 4); c.lineTo(x + 1.8, y - 4); c.lineTo(x, y); c.closePath(); }, '#e0a35c', { shade: false, lw: 0.5 }); paint(c, () => { ell(c, x, y - 5, 2, 1.5); ell(c, x, y - 6.6, 1.3, 1.1); }, ['#f3d9a4', '#fff6e8', '#ffb4c8'][i % 3], { shade: false, lw: 0.5 }); }
      else if (kind === 'craft') { const col = ['#4d96ff', '#ff7eb6', '#7bd389', '#ffd23f', '#c77dff'][i % 5]; paint(c, () => rr(c, x - 2.6, y - 6, 5.2, 6, 1.6), col, { shade: false, lw: 0.6 }); }
      else if (kind === 'flowers') { paint(c, () => rr(c, x - 2.4, y - 4, 4.8, 4, 0.6), '#7d8597', { shade: false, lw: 0.6 }); paint(c, () => { circ(c, x - 1.6, y - 6, 1.5); circ(c, x + 1.6, y - 6.3, 1.5); circ(c, x, y - 7.8, 1.5); }, ['#ff7eb6', '#ffd23f', '#c77dff', '#ff6f61'][i % 4], { shade: false, lw: 0.5 }); }
      else if (kind === 'cocoa') { paint(c, () => rr(c, x - 2, y - 5, 4, 5, 0.8), '#ffffff', { shade: false, lw: 0.6 }); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(x - 0.4, y - 9, 0.8, 3); }
      else if (kind === 'water') { paint(c, () => { c.moveTo(x - 2, y - 5); c.lineTo(x + 2, y - 5); c.lineTo(x + 1.5, y); c.lineTo(x - 1.5, y); c.closePath(); }, '#ffffff', { shade: false, lw: 0.5 }); c.fillStyle = '#8cd3f0'; c.fillRect(x - 1.6, y - 4, 3.2, 1.5); }
    }
  }

  const P = {};
  // ---- market / festival stall, front piece (counter, posts, canopy edge) and back piece (fabric wall)
  P.stall = {
    b: (s) => [-(s.w || 64) / 2 - 7, -72, (s.w || 64) / 2 + 7, 4],
    sh: (s) => { const w = s.w || 64; return [{ t: 'r', x0: -w / 2, y0: -18, x1: w / 2, y1: 0 }, { t: 'r', x0: -w / 2 - 5, y0: -68, x1: w / 2 + 5, y1: -46 }, { t: 'r', x0: -w / 2, y0: -46, x1: -w / 2 + 2.5, y1: -18 }, { t: 'r', x0: w / 2 - 2.5, y0: -46, x1: w / 2, y1: -18 }]; },
    draw(c, s) {
      const w = s.w || 64, c1 = s.c1 || '#ff9f43', c2 = s.c2 || '#fff4d6';
      shadow(c, w / 2 + 6, 4);
      for (const x of [-w / 2 + 1, w / 2 - 1]) paint(c, () => rr(c, x - 1.3, -52, 2.6, 52, 1), '#efe6d2', { shade: false, lw: 1 });
      // counter
      paint(c, () => rr(c, -w / 2, -18, w, 18, 1.5), s.cc || '#a8743f', { k: 1, detail: () => { c.strokeStyle = 'rgba(60,30,10,0.3)'; c.lineWidth = 0.8; for (let y = -13; y < 0; y += 4.5) { c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke(); } } });
      paint(c, () => rr(c, -w / 2 - 2, -20, w + 4, 3, 1), shade(s.cc || '#a8743f', 0.2), { shade: false, lw: 1 });
      goods(c, s.goods || 'craft', w, -20);
      if (s.sign) { paint(c, () => rr(c, -w * 0.32, -15, w * 0.64, 9, 1.5), '#fff8e6', { shade: false, lw: 0.9 }); c.fillStyle = shade(c1, -0.35); c.font = '900 6.4px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.sign, 0, -10.3); }
      // canopy roof + scalloped valance
      paint(c, () => { c.moveTo(-w / 2 - 5, -52); c.lineTo(-w / 2 + 4, -68); c.lineTo(w / 2 - 4, -68); c.lineTo(w / 2 + 5, -52); c.closePath(); }, c2, { k: 1.2, detail: () => { const n = 7; for (let i = 0; i < n; i += 2) { const a = -w / 2 - 5 + i * (w + 10) / n, b = a + (w + 10) / n; c.fillStyle = c1; c.beginPath(); c.moveTo(a, -52); c.lineTo(a + (b - a) * 0.4 + (i - 3) * 1.3, -68); c.lineTo(b - (b - a) * 0.4 + (i - 2) * 1.3, -68); c.lineTo(b, -52); c.fill(); } } });
      paint(c, () => { c.moveTo(-w / 2 - 5, -52.5); const n = 7, sw = (w + 10) / n; for (let i = 0; i < n; i++) { const a = -w / 2 - 5 + i * sw; c.quadraticCurveTo(a + sw / 2, -42, a + sw, -52.5); } c.closePath(); }, c1, { k: 0.6, detail: () => { c.fillStyle = c2; const n = 7, sw = (w + 10) / n; for (let i = 1; i < n; i += 2) c.fillRect(-w / 2 - 5 + i * sw, -54, sw, 14); } });
    },
  };
  P.stallback = {
    b: (s) => [-(s.w || 64) / 2 - 2, -56, (s.w || 64) / 2 + 2, 2],
    sh: (s) => [{ t: 'r', x0: -(s.w || 64) / 2, y0: -52, x1: (s.w || 64) / 2, y1: 0 }],
    draw(c, s) {
      const w = s.w || 64, c1 = shade(s.c1 || '#ff9f43', -0.35), c2 = shade(s.c2 || '#fff4d6', -0.3);
      paint(c, () => rr(c, -w / 2, -52, w, 52, 1), c2, { shade: false, lw: 1, detail: () => stripes(c, -w / 2, w / 2, -52, 0, 7, c1, c2) });
      c.fillStyle = 'rgba(30,20,50,0.25)'; c.fillRect(-w / 2, -52, w, 52);
    },
  };
  // ---- planter box with flowers
  P.planter = {
    b: () => [-24, -28, 24, 3], sh: () => [{ t: 'r', x0: -22, y0: -14, x1: 22, y1: 0 }, { t: 'e', x: 0, y: -16, rx: 22, ry: 9 }],
    draw(c, s) {
      shadow(c, 24, 3.5);
      paint(c, () => { for (let i = 0; i < 9; i++) circ(c, -18 + i * 4.5, -17 - (i % 2) * 3, 5); }, '#4f9d4a', { k: 0.6 });
      const fl = s.fl || ['#ff7eb6', '#ffd23f', '#ffffff', '#c77dff'];
      for (let i = 0; i < 10; i++) { const x = -18 + i * 4, y = -19 - ((i * 7) % 5); c.fillStyle = fl[i % fl.length]; c.beginPath(); for (let k = 0; k < 5; k++) circ(c, x + Math.cos(k * 1.26) * 1.4, y + Math.sin(k * 1.26) * 1.4, 1.1); c.fill(); dot(c, x, y, 0.7, '#ffcf3f'); }
      paint(c, () => rr(c, -22, -14, 44, 14, 1.5), s.box || '#9c6532', { k: 1, detail: () => { c.strokeStyle = 'rgba(40,20,0,0.3)'; c.lineWidth = 0.7; for (let x = -22; x < 22; x += 7.3) { c.beginPath(); c.moveTo(x, -14); c.lineTo(x, 0); c.stroke(); } } });
    },
  };
  // ---- tree (big canopy; occludes plenty)
  P.tree = {
    b: (s) => { const k = s.k || 1; return [-36 * k, -104 * k, 36 * k, 4]; },
    sh: (s) => { const k = s.k || 1; return [{ t: 'r', x0: -4.5 * k, y0: -50 * k, x1: 4.5 * k, y1: 0 }].concat([[0, -78, 24], [-18, -66, 18], [18, -64, 19], [-8, -52, 16], [10, -50, 15], [0, -92, 15], [-22, -82, 13], [22, -84, 13]].map(b => ({ t: 'e', x: b[0] * k, y: b[1] * k, rx: b[2] * k + 1.5, ry: b[2] * k + 1.5 }))); },
    draw(c, s) {
      const k = s.k || 1, g = s.col || '#5bb35a', autumn = s.autumn;
      shadow(c, 22 * k, 5 * k);
      if (s.grate) paint(c, () => ell(c, 0, -1, 14 * k, 4 * k), '#6b705c', { shade: false, lw: 0.8 });
      paint(c, () => { c.moveTo(-4 * k, 0); c.lineTo(-3 * k, -52 * k); c.lineTo(3 * k, -52 * k); c.lineTo(4.5 * k, 0); c.closePath(); }, '#7a5230', { k: 0.6 });
      const blobs = [[0, -78, 24], [-18, -66, 18], [18, -64, 19], [-8, -52, 16], [10, -50, 15], [0, -92, 15], [-22, -82, 13], [22, -84, 13]];
      c.fillStyle = OUT; c.beginPath(); for (const b of blobs) circ(c, b[0] * k, b[1] * k, b[2] * k + 1.3); c.fill();
      paint(c, () => { for (const b of blobs) circ(c, b[0] * k, b[1] * k, b[2] * k); }, g, { k: 2.6 * k, line: false, detail: () => { if (autumn) { c.fillStyle = autumn; c.beginPath(); for (const b of blobs.slice(2, 6)) circ(c, b[0] * k + 4, b[1] * k - 3, b[2] * k * 0.6); c.fill(); } } });
      if (s.lights) { for (let i = 0; i < 16; i++) { const a = i * 2.4, rr2 = 10 + (i * 13) % 20; dot(c, Math.cos(a) * rr2 * k, (-72 + Math.sin(a) * rr2 * 0.9) * k, 1.4, ['#ffd166', '#ff7eb6', '#9ad0ec', '#b5e48c'][i % 4]); } }
    },
  };
  // ---- evergreen with lights (winter)
  P.pine = {
    b: (s) => { const k = s.k || 1; return [-30 * k, -100 * k, 30 * k, 4]; },
    sh: (s) => { const k = s.k || 1; return [{ t: 'r', x0: -26 * k, y0: -24 * k, x1: 26 * k, y1: -4 * k }, { t: 'r', x0: -16 * k, y0: -60 * k, x1: 16 * k, y1: -24 * k }, { t: 'r', x0: -8 * k, y0: -90 * k, x1: 8 * k, y1: -60 * k }]; },
    draw(c, s) {
      const k = s.k || 1;
      shadow(c, 22 * k, 5 * k);
      paint(c, () => rr(c, -3.5 * k, -12 * k, 7 * k, 12 * k, 1), '#6e4122', { shade: false });
      paint(c, () => { const L = [[-28, -8, -16, -40], [-22, -34, -11, -62], [-15, -56, -6, -86]]; for (const l of L) { c.moveTo(l[0] * k, l[1] * k); c.lineTo(0, (l[3] - 6) * k); c.lineTo(-l[0] * k, l[1] * k); c.quadraticCurveTo(0, (l[1] + 5) * k, l[0] * k, l[1] * k); c.closePath(); } }, '#2f7d4f', { k: 1.6 * k, detail: () => { c.fillStyle = 'rgba(240,248,255,0.85)'; c.beginPath(); ell(c, -8 * k, -38 * k, 7 * k, 2 * k); ell(c, 6 * k, -62 * k, 5 * k, 1.6 * k); ell(c, -12 * k, -12 * k, 9 * k, 2.4 * k); c.fill(); } });
      const cols = ['#ffd166', '#ff7eb6', '#9ad0ec', '#b5e48c', '#ff6f61'];
      for (let i = 0; i < 18; i++) { const t = i / 18, y = (-12 - t * 72) * k, half = (26 - t * 20) * k, x = Math.sin(i * 2.7) * half * 0.8; dot(c, x, y, 1.5 * k, cols[i % 5]); }
      paint(c, () => { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.2 : 5; (i ? c.lineTo : c.moveTo).call(c, Math.cos(a) * r * k, (-93 + Math.sin(a) * r) * k); } c.closePath(); }, '#ffd23f', { shade: false, lw: 0.8 });
    },
  };
  P.bench = {
    b: () => [-25, -22, 25, 3], sh: () => [{ t: 'r', x0: -23, y0: -20, x1: 23, y1: -8 }],
    draw(c, s) {
      shadow(c, 24, 3);
      for (const x of [-19, 19]) paint(c, () => rr(c, x - 1.6, -10, 3.2, 10, 0.8), '#3b3b46', { shade: false, lw: 0.8 });
      paint(c, () => rr(c, -23, -21, 46, 6, 1.5), s.col || '#a8743f', { k: 0.6 });
      paint(c, () => rr(c, -24, -12, 48, 4, 1.2), shade(s.col || '#a8743f', 0.15), { k: 0.4 });
    },
  };
  P.lamp = {
    b: () => [-12, -108, 12, 3], sh: () => [{ t: 'r', x0: -2.2, y0: -95, x1: 2.2, y1: 0 }, { t: 'e', x: 0, y: -98, rx: 7, ry: 8 }],
    draw(c, s) {
      shadow(c, 7, 2);
      paint(c, () => { rr(c, -2, -96, 4, 96, 1.5); rr(c, -4.2, -6, 8.4, 6, 1.5); }, '#2f3a4a', { k: 0.5 });
      paint(c, () => { c.moveTo(-6, -96); c.lineTo(6, -96); c.lineTo(4.2, -104); c.lineTo(-4.2, -104); c.closePath(); }, '#2f3a4a', { shade: false });
      paint(c, () => rr(c, -4.6, -96, 9.2, 8, 2), s.night ? '#ffe9a6' : '#fff7d6', { shade: false, lw: 0.9 });
      if (s.basket) { line(c, [0, -84, -9, -78], 0.8, '#2f3a4a'); paint(c, () => { circ(c, -9, -74, 5.2); }, '#4f9d4a', { k: 0.4 }); dot(c, -11, -75, 1.4, '#ff7eb6'); dot(c, -7.6, -72.6, 1.4, '#ffd23f'); dot(c, -9.4, -77.6, 1.3, '#c77dff'); }
      if (s.wreath) { c.strokeStyle = OUT; c.lineWidth = 4.4; c.beginPath(); circ(c, 0, -76, 5); c.stroke(); c.strokeStyle = '#2f7d4f'; c.lineWidth = 3; c.stroke(); dot(c, 0, -71, 1.6, '#e63946'); }
      if (s.banner) { paint(c, () => rr(c, 2, -88, 11, 22, 1), s.banner, { k: 0.6, detail: () => leaf(c, 7.5, -77, 3, '#fff4d6') }); }
    },
  };
  P.bin = {
    b: () => [-8, -20, 8, 2], sh: () => [{ t: 'r', x0: -7, y0: -18, x1: 7, y1: 0 }],
    draw(c, s) { shadow(c, 8, 2); paint(c, () => { c.moveTo(-6, 0); c.lineTo(-7, -16); c.lineTo(7, -16); c.lineTo(6, 0); c.closePath(); }, s.col || '#2a9d8f', { k: 0.6 }); paint(c, () => ell(c, 0, -16, 7.4, 2.2), shade(s.col || '#2a9d8f', -0.2), { shade: false }); },
  };
  // ---- fountain: back (rim + water + spout) and front (front rim)
  P.fountainB = {
    b: () => [-56, -80, 56, 2], sh: () => [{ t: 'r', x0: -4, y0: -62, x1: 4, y1: -22 }],
    draw(c, s) {
      paint(c, () => ell(c, 0, -24, 52, 16), '#d8cfc0', { k: 1 });
      paint(c, () => ell(c, 0, -23, 45, 12.5), '#5ec4e8', { shade: false, lw: 1, detail: () => { c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); ell(c, -14, -27, 14, 2); ell(c, 18, -20, 10, 1.6); c.fill(); } });
      paint(c, () => { rr(c, -3.5, -48, 7, 26, 2); }, '#d8cfc0', { k: 0.6 });
      paint(c, () => { c.moveTo(-16, -50); c.quadraticCurveTo(0, -42, 16, -50); c.quadraticCurveTo(0, -54, -16, -50); c.closePath(); }, '#d8cfc0', { k: 0.6 });
    },
  };
  P.spray = {
    b: () => [-22, -78, 22, -40], sh: () => [], noHit: true,
    draw(c) {
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6; c.lineCap = 'round';
      for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(0, -60); c.quadraticCurveTo(sx * 12, -74, sx * 17, -50); c.stroke(); }
      c.beginPath(); c.moveTo(0, -52); c.lineTo(0, -72); c.stroke();
      c.fillStyle = 'rgba(200,240,255,0.9)'; for (let i = 0; i < 8; i++) dot(c, Math.cos(i) * 14, -50 - (i % 3) * 3, 1, 'rgba(220,245,255,0.9)');
    },
  };
  P.fountainF = {
    b: () => [-56, -26, 56, 4], sh: () => [{ t: 'r', x0: -52, y0: -16, x1: 52, y1: 0 }],
    draw(c) {
      shadow(c, 56, 6);
      paint(c, () => { c.moveTo(-52, -24); c.ellipse(0, -24, 52, 16, 0, Math.PI, 0, true); c.lineTo(52, -14); c.ellipse(0, -14, 52, 15, 0, 0, Math.PI, false); c.closePath(); }, '#cfc5b4', { k: 1.2, detail: () => { c.strokeStyle = 'rgba(90,70,50,0.25)'; c.lineWidth = 0.8; for (let a = 0.2; a < Math.PI; a += 0.32) { c.beginPath(); c.moveTo(Math.cos(a) * 52, -24 + Math.sin(a) * 16); c.lineTo(Math.cos(a) * 52, -14 + Math.sin(a) * 15); c.stroke(); } } });
      paint(c, () => { c.moveTo(-52, -24); c.ellipse(0, -24, 52, 16, 0, Math.PI, 0, true); c.lineTo(45, -23); c.ellipse(0, -23, 45, 12.5, 0, 0, Math.PI, false); c.closePath(); }, '#e8e0d2', { shade: false, lw: 1 });
    },
  };
  // ---- inflatable kiddie pool: back and front
  P.poolB = {
    b: () => [-48, -36, 48, 2], sh: () => [],
    draw(c) { paint(c, () => ell(c, 0, -18, 44, 15), '#4d96ff', { k: 1.4 }); paint(c, () => ell(c, 0, -18, 36, 10.5), '#7fd3f5', { shade: false, lw: 1, detail: () => { c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); ell(c, -10, -21, 12, 1.8); c.fill(); } }); },
  };
  P.poolF = {
    b: () => [-48, -22, 48, 4], sh: () => [{ t: 'r', x0: -44, y0: -12, x1: 44, y1: 0 }],
    draw(c) {
      shadow(c, 48, 5);
      paint(c, () => { c.moveTo(-44, -18); c.ellipse(0, -18, 44, 15, 0, Math.PI, 0, true); c.lineTo(44, -12); c.ellipse(0, -12, 44, 13, 0, 0, Math.PI, false); c.closePath(); }, '#ffd23f', { k: 1.2, detail: () => { c.fillStyle = '#ff7eb6'; c.beginPath(); c.ellipse(0, -15, 44, 13, 0, 0, Math.PI); c.lineTo(-44, -12); c.ellipse(0, -11, 44, 12, 0, Math.PI, 0, true); c.fill(); } });
    },
  };
  // ---- beach things
  P.umbrella = {
    b: () => [-36, -66, 36, 3], sh: () => [{ t: 'e', x: 0, y: -52, rx: 34, ry: 12 }, { t: 'r', x0: -1.5, y0: -50, x1: 1.5, y1: 0 }],
    draw(c, s) {
      const c1 = s.c1 || '#17b3a3', c2 = s.c2 || '#ffe8a3';
      c.fillStyle = 'rgba(30,18,50,0.16)'; c.beginPath(); ell(c, 8, -1, 32, 8); c.fill();
      paint(c, () => rr(c, -1.1, -56, 2.2, 56, 1), '#f2efe4', { shade: false, lw: 0.8 });
      paint(c, () => { c.moveTo(-34, -48); c.quadraticCurveTo(0, -78, 34, -48); c.quadraticCurveTo(0, -54, -34, -48); c.closePath(); }, c1, { k: 1.4, detail: () => { c.fillStyle = c2; for (let i = -3; i <= 3; i += 2) { c.beginPath(); c.moveTo(0, -64); c.lineTo(i * 9.7 - 4.8, -46); c.lineTo(i * 9.7 + 4.8, -46); c.closePath(); c.fill(); } } });
      dot(c, 0, -64.5, 1.6, c2);
    },
  };
  P.towel = {
    flat: true, b: () => [-20, -16, 20, 2], sh: () => [],
    draw(c, s) {
      paint(c, () => { c.moveTo(-18, 0); c.lineTo(-14, -14); c.lineTo(16, -14); c.lineTo(19, 0); c.closePath(); }, s.c1 || '#ff7eb6', { shade: false, lw: 1, detail: () => { c.fillStyle = s.c2 || '#ffffff'; for (let x = -20; x < 22; x += 8) c.fillRect(x, -15, 3.4, 16); } });
    },
  };
  P.chair = {
    b: () => [-14, -22, 14, 2], sh: () => [{ t: 'r', x0: -11, y0: -20, x1: 11, y1: -4 }],
    draw(c, s) {
      shadow(c, 12, 2.4);
      line(c, [-10, 0, -9, -10], 1.2, '#cfcac2'); line(c, [10, 0, 9, -10], 1.2, '#cfcac2');
      paint(c, () => { c.moveTo(-11, -9); c.lineTo(-9, -21); c.lineTo(9, -21); c.lineTo(11, -9); c.closePath(); }, s.c1 || '#4d96ff', { k: 0.5, detail: () => { c.fillStyle = s.c2 || '#ffffff'; c.fillRect(-4, -22, 3, 14); c.fillRect(3, -22, 3, 14); } });
      paint(c, () => rr(c, -12, -10, 24, 4, 1), shade(s.c1 || '#4d96ff', -0.15), { shade: false, lw: 0.9 });
    },
  };
  P.cooler = {
    b: () => [-11, -18, 11, 2], sh: () => [{ t: 'r', x0: -10, y0: -16, x1: 10, y1: 0 }],
    draw(c, s) { shadow(c, 11, 2.4); paint(c, () => rr(c, -10, -13, 20, 13, 1.5), s.col || '#e63946', { k: 0.7 }); paint(c, () => rr(c, -10.6, -16, 21.2, 4, 1.2), '#ffffff', { shade: false, lw: 0.9 }); line(c, [-4, -16.5, 4, -16.5], 1.2, '#666'); },
  };
  P.sandcastle = {
    b: () => [-20, -36, 20, 2], sh: () => [{ t: 'r', x0: -18, y0: -24, x1: 18, y1: 0 }],
    draw(c, s) {
      shadow(c, 20, 3);
      const sand = '#e8c98a';
      paint(c, () => { rr(c, -18, -12, 36, 12, 1); rr(c, -16, -22, 8, 12, 0.5); rr(c, 8, -22, 8, 12, 0.5); rr(c, -5, -26, 10, 16, 0.5); }, sand, { k: 0.9, detail: () => { c.fillStyle = '#c9a463'; c.fillRect(-2, -6, 4, 6); } });
      line(c, [0, -26, 0, -35], 0.6, '#6e4122'); paint(c, () => { c.moveTo(0, -35); c.lineTo(6, -33); c.lineTo(0, -31); c.closePath(); }, s.flag || '#4d96ff', { shade: false, lw: 0.5 });
      paint(c, () => { c.moveTo(14, 0); c.lineTo(15, -7); c.lineTo(20, -7); c.lineTo(21, 0); c.closePath(); }, '#ff6f61', { shade: false, lw: 0.7 });
    },
  };
  P.net = {
    b: () => [-56, -44, 56, 3], sh: () => [{ t: 'r', x0: -54, y0: -42, x1: -50, y1: 0 }, { t: 'r', x0: 50, y0: -42, x1: 54, y1: 0 }],
    draw(c) {
      for (const x of [-52, 52]) { shadow(c, 4, 1.4, x); paint(c, () => rr(c, x - 1.5, -42, 3, 42, 1), '#f2efe4', { shade: false }); }
      c.strokeStyle = 'rgba(40,40,50,0.6)'; c.lineWidth = 0.5; c.beginPath();
      for (let x = -50; x <= 50; x += 4) { c.moveTo(x, -38); c.lineTo(x, -28); } for (let y = -38; y <= -28; y += 3.3) { c.moveTo(-50, y); c.lineTo(50, y); } c.stroke();
      line(c, [-50, -38, 50, -38], 1.4, '#f2efe4');
    },
  };
  P.lifeguard = {
    b: () => [-18, -78, 18, 3], sh: () => [{ t: 'r', x0: -14, y0: -54, x1: 14, y1: -36 }, { t: 'r', x0: -15, y0: -36, x1: 15, y1: 0 }],
    draw(c) {
      shadow(c, 18, 3);
      for (const x of [-13, 13]) line(c, [x, 0, x * 0.7, -40], 2.4, '#f2efe4');
      line(c, [-12, -12, 12, -12], 1.6, '#f2efe4'); line(c, [-11, -26, 11, -26], 1.6, '#f2efe4');
      paint(c, () => rr(c, -12, -54, 24, 16, 1.5), '#ffffff', { k: 0.6, detail: () => { c.fillStyle = '#e63946'; c.fillRect(-12, -48, 24, 4); } });
      line(c, [10, -54, 10, -76], 0.8, '#888'); paint(c, () => { c.moveTo(-6, -70); c.quadraticCurveTo(10, -84, 26, -70); c.closePath(); }, '#ffd23f', { shade: false, lw: 0.8 });
    },
  };
  P.floatring = {
    flat: true, b: () => [-14, -12, 14, 2], sh: () => [],
    draw(c, s) { paint(c, () => { ell(c, 0, -5, 12, 5); }, s.col || '#ff7eb6', { k: 0.6, detail: () => { c.fillStyle = '#ffffff'; for (let a = 0; a < TAU; a += TAU / 4) { c.beginPath(); c.moveTo(0, -5); c.arc(0, -5, 14, a, a + 0.5); c.fill(); } } }); paint(c, () => ell(c, 0, -5.5, 5, 2), s.water ? '#5ec4e8' : '#e8c98a', { shade: false, lw: 0.8 }); },
  };
  // ---- marathon things
  P.barrier = {
    b: (s) => [-(s.w || 48) / 2 - 2, -24, (s.w || 48) / 2 + 2, 3], sh: (s) => [{ t: 'r', x0: -(s.w || 48) / 2, y0: -22, x1: (s.w || 48) / 2, y1: -18 }],
    draw(c, s) {
      const w = s.w || 48;
      for (const x of [-w / 2 + 2, w / 2 - 2]) { line(c, [x, -22, x, 0], 1.6, '#9aa3ad'); line(c, [x - 3, 0, x + 3, 0], 1.4, '#9aa3ad'); }
      c.strokeStyle = '#b8c0c8'; c.lineWidth = 0.7; c.beginPath(); for (let x = -w / 2 + 4; x < w / 2 - 2; x += 3.2) { c.moveTo(x, -20); c.lineTo(x, -5); } c.stroke();
      line(c, [-w / 2 + 2, -21, w / 2 - 2, -21], 1.8, '#9aa3ad'); line(c, [-w / 2 + 2, -5, w / 2 - 2, -5], 1.4, '#9aa3ad');
      if (s.banner) { paint(c, () => rr(c, -w / 2 + 4, -19, w - 8, 9, 1), s.banner, { shade: false, lw: 0.8 }); c.fillStyle = '#fff'; c.font = '900 6px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.text || 'GO GO GO', 0, -14.4); }
    },
  };
  P.table = {
    b: (s) => [-(s.w || 50) / 2 - 2, -24, (s.w || 50) / 2 + 2, 3], sh: (s) => [{ t: 'r', x0: -(s.w || 50) / 2, y0: -16, x1: (s.w || 50) / 2, y1: 0 }],
    draw(c, s) {
      const w = s.w || 50;
      shadow(c, w / 2 + 3, 3);
      paint(c, () => rr(c, -w / 2, -16, w, 16, 1), s.cloth || '#4d96ff', { k: 0.8, detail: () => { c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(-w / 2, -16, w, 3); } });
      goods(c, s.goods || 'water', w, -16);
    },
  };
  P.portajohn = {
    b: () => [-13, -50, 13, 3], sh: () => [{ t: 'r', x0: -12, y0: -48, x1: 12, y1: 0 }],
    draw(c, s) {
      shadow(c, 13, 2.6);
      paint(c, () => { rr(c, -12, -44, 24, 44, 1.5); }, s.col || '#3e8ed0', { k: 1, detail: () => { c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(-9, -40, 18, 38); dot(c, 6, -22, 1.2, '#e63946'); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-4, -38, 8, 1.4); } });
      paint(c, () => { c.moveTo(-13, -43); c.quadraticCurveTo(0, -52, 13, -43); c.closePath(); }, '#f2efe4', { shade: false });
    },
  };
  P.balloons = {
    b: () => [-20, -96, 20, 3], sh: () => [{ t: 'e', x: 0, y: -74, rx: 18, ry: 18 }],
    parts: () => [{ name: 'post', b: [-11, -50, 11, 3], pv: [0, 0] }, { name: 'bunch', b: [-22, -98, 22, -44], pv: [0, -46], anim: 'balloon' }],
    draw(c, s, part) {
      if (part === 'post') { shadow(c, 9, 2.2); paint(c, () => rr(c, -1.4, -46, 2.8, 44, 1), '#9c6532', { shade: false, lw: 0.9 }); paint(c, () => rr(c, -6, -7, 12, 7, 2), '#7d8597', { k: 0.5 }); paint(c, () => rr(c, -9, -12, 18, 6, 2), '#ff6f61', { shade: false, lw: 0.9, detail: () => { c.fillStyle = '#fff'; c.fillRect(-5, -12, 3, 6); c.fillRect(2, -12, 3, 6); } }); return; }
      const cols = s.cols || ['#ff6f61', '#ffd23f', '#4d96ff', '#7bd389', '#c77dff', '#ff7eb6'];
      const pts = [[-12, -80], [0, -88], [12, -80], [-6, -70], [7, -69], [0, -78], [-14, -66], [14, -67]];
      c.strokeStyle = '#666'; c.lineWidth = 0.4; c.beginPath(); for (const p of pts) { c.moveTo(0, -46); c.lineTo(p[0], p[1] + 7); } c.stroke();
      pts.forEach((p, i) => { paint(c, () => ell(c, p[0], p[1], 6, 7.2), cols[i % cols.length], { k: 0.6, lw: 0.9 }); dot(c, p[0] - 2, p[1] - 3, 1.1, 'rgba(255,255,255,0.7)'); });
    },
  };
  // ---- market things
  P.hay = {
    b: () => [-22, -20, 22, 3], sh: () => [{ t: 'r', x0: -20, y0: -17, x1: 20, y1: 0 }],
    draw(c) {
      shadow(c, 22, 3);
      paint(c, () => rr(c, -20, -17, 40, 17, 3), '#e8c35e', { k: 1, detail: () => { c.strokeStyle = 'rgba(150,100,20,0.45)'; c.lineWidth = 0.6; for (let i = 0; i < 30; i++) { const x = -19 + (i * 7.3) % 38, y = -16 + (i * 5.1) % 15; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y + 0.8); c.stroke(); } } });
      line(c, [-8, -17, -8, 0], 0.9, '#a0522d'); line(c, [8, -17, 8, 0], 0.9, '#a0522d');
    },
  };
  P.pumpkins = {
    b: () => [-26, -22, 26, 3], sh: () => [{ t: 'r', x0: -24, y0: -18, x1: 24, y1: 0 }],
    draw(c, s) {
      shadow(c, 26, 3.5);
      const P2 = [[-16, -2, 1], [0, -1, 1.15], [15, -2, 0.95], [-8, -12, 0.85], [8, -11, 0.9]];
      for (const p of P2) { c.save(); c.translate(p[0], p[1]); c.scale(p[2], p[2]); SC.ITEMS.pumpkin.draw(c, { col: p[2] > 1 ? '#ff9f1a' : '#f57c00' }); c.restore(); }
    },
  };
  P.crates = {
    b: () => [-20, -32, 20, 3], sh: () => [{ t: 'r', x0: -19, y0: -30, x1: 19, y1: 0 }],
    draw(c, s) {
      shadow(c, 20, 3);
      const crate = (x, y, col) => { paint(c, () => rr(c, x - 9, y - 12, 18, 12, 1), '#c8a066', { k: 0.6, detail: () => { c.strokeStyle = 'rgba(80,50,10,0.35)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - 9, y - 6); c.lineTo(x + 9, y - 6); c.stroke(); } }); paint(c, () => { for (let i = 0; i < 4; i++) circ(c, x - 6 + i * 4, y - 13, 2.2); }, col, { shade: false, lw: 0.6 }); };
      crate(-9.5, 0, '#e63946'); crate(9.5, 0, '#7bd389'); crate(0, -14, s.col || '#ffd23f');
    },
  };
  P.buckets = {
    b: () => [-22, -28, 22, 3], sh: () => [{ t: 'r', x0: -20, y0: -24, x1: 20, y1: 0 }],
    draw(c) {
      shadow(c, 22, 3);
      const cols = ['#ff7eb6', '#ffd23f', '#c77dff', '#ff6f61', '#ffffff', '#ff9f43'];
      for (let i = 0; i < 4; i++) { const x = -15 + i * 10; c.fillStyle = '#4f9d4a'; for (let k = 0; k < 3; k++) c.fillRect(x - 3 + k * 2.6, -20, 0.8, 9); paint(c, () => { for (let k = 0; k < 4; k++) circ(c, x - 3 + k * 2.2, -21 - (k % 2) * 2.4, 2.2); }, cols[i % cols.length], { shade: false, lw: 0.6 }); paint(c, () => { c.moveTo(x - 4.6, -12); c.lineTo(x + 4.6, -12); c.lineTo(x + 3.6, 0); c.lineTo(x - 3.6, 0); c.closePath(); }, '#9aa3ad', { k: 0.5, lw: 1 }); }
    },
  };
  P.tubB = {
    b: () => [-24, -20, 24, 2], sh: () => [],
    draw(c) { paint(c, () => ell(c, 0, -14, 22, 6), '#b8c0c8', { shade: false }); paint(c, () => ell(c, 0, -13.5, 19, 4.6), '#6fc6e8', { shade: false, lw: 0.8 }); for (const [x, y, col] of [[-9, -14, '#e63946'], [7, -12.5, '#7bd389'], [12, -15, '#e63946']]) paint(c, () => circ(c, x, y, 2.4), col, { shade: false, lw: 0.6 }); },
  };
  P.tubF = {
    b: () => [-24, -16, 24, 3], sh: () => [{ t: 'r', x0: -22, y0: -12, x1: 22, y1: 0 }],
    draw(c) {
      shadow(c, 24, 3);
      paint(c, () => { c.moveTo(-22, -14); c.ellipse(0, -14, 22, 6, 0, Math.PI, 0, true); c.lineTo(19, -1); c.ellipse(0, -1, 19, 4, 0, 0, Math.PI, false); c.closePath(); }, '#aab3bd', { k: 1, detail: () => { c.strokeStyle = 'rgba(80,90,100,0.4)'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -8, 21, 5.5, 0, 0, Math.PI); c.stroke(); } });
    },
  };
  // ---- winter things
  P.snowbank = {
    b: (s) => [-(s.w || 70) / 2 - 2, -24, (s.w || 70) / 2 + 2, 3], sh: (s) => [{ t: 'e', x: 0, y: -6, rx: (s.w || 70) / 2, ry: 12 }],
    draw(c, s) {
      const w = s.w || 70;
      c.fillStyle = 'rgba(60,70,120,0.25)'; c.beginPath(); ell(c, 0, 0, w / 2 + 2, 4); c.fill();
      paint(c, () => { c.moveTo(-w / 2, 0); c.bezierCurveTo(-w / 2, -14, -w / 4, -19, 0, -18); c.bezierCurveTo(w / 4, -19, w / 2, -14, w / 2, 0); c.closePath(); }, '#eef5ff', { k: 2, detail: () => { c.fillStyle = 'rgba(160,190,230,0.45)'; c.beginPath(); ell(c, w * 0.15, -3, w * 0.3, 4); c.fill(); dot(c, -w * 0.2, -12, 1, '#ffffff'); } });
    },
  };
  P.inflatable = {
    b: () => [-18, -50, 18, 3], sh: () => [{ t: 'e', x: 0, y: -14, rx: 14, ry: 14 }, { t: 'e', x: 0, y: -36, rx: 10, ry: 10 }],
    parts: () => [{ name: 'body', b: [-18, -50, 18, 3], pv: [0, 0], anim: 'inflate' }],
    draw(c, s) {
      const kind = s.k || 'snowman';
      shadow(c, 15, 3);
      if (kind === 'snowman') { paint(c, () => ell(c, 0, -14, 14, 14), '#f8fbff', { k: 1.6 }); paint(c, () => circ(c, 0, -36, 10), '#f8fbff', { k: 1.4 }); paint(c, () => rr(c, -10, -31, 20, 4, 2), '#e63946', { shade: false, lw: 1 }); dot(c, -3.5, -38, 1.2, '#222'); dot(c, 3.5, -38, 1.2, '#222'); paint(c, () => { c.moveTo(0, -35.5); c.lineTo(7, -34); c.lineTo(0, -33); c.closePath(); }, '#ff8c1a', { shade: false, lw: 0.6 }); paint(c, () => { rr(c, -7, -50, 14, 6, 1); rr(c, -10, -45, 20, 2.6, 1); }, '#2b2b33', { shade: false, lw: 0.6 }); }
      else if (kind === 'penguin') { paint(c, () => ell(c, 0, -22, 14, 22), '#2b2f45', { k: 1.4 }); paint(c, () => ell(c, 0, -19, 9.5, 17), '#ffffff', { shade: false, lw: 0.8 }); dot(c, -3.5, -34, 1.3, '#222'); dot(c, 3.5, -34, 1.3, '#222'); paint(c, () => { c.moveTo(-2.5, -31); c.lineTo(2.5, -31); c.lineTo(0, -27.5); c.closePath(); }, '#ffb020', { shade: false, lw: 0.6 }); paint(c, () => rr(c, -12, -45, 24, 6, 3), '#7bd389', { shade: false, lw: 0.8 }); }
      else { paint(c, () => { c.moveTo(0, -48); c.lineTo(11, -26); c.lineTo(5, -26); c.lineTo(14, -6); c.lineTo(-14, -6); c.lineTo(-5, -26); c.lineTo(-11, -26); c.closePath(); }, '#3fae5a', { k: 1.2 }); paint(c, () => rr(c, -3, -6, 6, 6, 1), '#6e4122', { shade: false }); dot(c, -4, -18, 1.8, '#ffd23f'); dot(c, 5, -12, 1.8, '#ff6f61'); dot(c, 2, -32, 1.6, '#4d96ff'); }
      c.globalAlpha = 0.5; dot(c, -6, -20, 2.4, '#ffffff'); c.globalAlpha = 1;
    },
  };
  P.float = { // parade float: a decorated wagon
    b: (s) => [-66, -84, 66, 4], sh: () => [{ t: 'r', x0: -62, y0: -28, x1: 62, y1: 0 }, { t: 'e', x: 0, y: -50, rx: 30, ry: 26 }],
    draw(c, s) {
      const col = s.col || '#7b6cf6';
      shadow(c, 64, 6);
      for (const x of [-46, 46]) paint(c, () => circ(c, x, -5, 6), '#2b2b33', { shade: false });
      paint(c, () => rr(c, -62, -28, 124, 22, 3), col, { k: 1.4, detail: () => { c.fillStyle = 'rgba(255,255,255,0.85)'; for (let x = -60; x < 62; x += 10) { c.beginPath(); c.arc(x + 5, -6, 5, 0, Math.PI); c.fill(); } } });
      for (let i = 0; i < 14; i++) dot(c, -58 + i * 8.9, -26, 1.6, ['#ffd166', '#ff7eb6', '#9ad0ec', '#b5e48c'][i % 4]);
      if (s.deco === 'mug') {
        paint(c, () => rr(c, -22, -76, 44, 48, 6), '#f2efe4', { k: 2, detail: () => { c.fillStyle = '#e63946'; c.fillRect(-22, -60, 44, 8); } });
        c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.arc(24, -54, 10, -1.2, 1.2); c.stroke(); c.strokeStyle = '#f2efe4'; c.lineWidth = 3.6; c.stroke();
        paint(c, () => ell(c, 0, -76, 22, 5), '#7a4b2e', { shade: false });
        paint(c, () => { circ(c, -6, -79, 4); circ(c, 4, -80, 4.4); circ(c, 0, -83, 3.6); }, '#ffffff', { k: 0.6 });
      } else if (s.deco === 'leaf') {
        c.save(); c.translate(0, -54); leaf(c, 0, 0, 28, '#ff6f1a'); c.restore();
      } else {
        // big snowflake
        c.save(); c.translate(0, -54);
        for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * Math.PI / 3); line(c, [0, 0, 0, -26], 6.4, OUT); line(c, [0, 0, 0, -26], 4, '#dff3ff'); line(c, [0, -15, -7, -21], 4.2, OUT); line(c, [0, -15, -7, -21], 2.4, '#dff3ff'); line(c, [0, -15, 7, -21], 4.2, OUT); line(c, [0, -15, 7, -21], 2.4, '#dff3ff'); c.restore(); }
        c.restore();
      }
    },
  };

  // ---- generic prop kind
  const prop = {
    parts(s) { const d = P[s.p]; if (d.parts) return d.parts(s); return [{ name: 'body', b: d.b(s), pv: [0, 0], anim: s.anim || null }]; },
    draw(c, s, part) { P[s.p].draw(c, s, part); },
    shape(s) { return P[s.p].sh(s); },
  };
  SC.KINDS.prop = prop;
  SC.PROPS = P;
})(typeof window !== 'undefined' ? window : globalThis);
