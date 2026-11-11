/* Spot Champ — the five scene themes. Each theme has:
   gy0 (where the ground starts), plan(r,S) -> backdrop data, paint(c,plan,rect) -> draws backdrop+ground for a tile,
   layout(api,S,D) -> places props, zones, Champ/woodchuck hiding spots, crowd(r,S,zone) -> one crowd member. */
(function (root) {
  'use strict';
  const SC = root.SC;
  const { shade, mix, TAU } = SC;
  const { rr, ell, circ, paint, line, dot, leaf } = SC.ART;
  const OUT = SC.OUT;
  const W = 2000, H = 2400;

  const hit = (rect, x0, y0, x1, y1) => x0 < rect[2] && x1 > rect[0] && y0 < rect[3] && y1 > rect[1];
  function sky(c, rect, y1, top, bot) { if (!hit(rect, 0, 0, W, y1)) return; const g = c.createLinearGradient(0, 0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(rect[0], 0, rect[2] - rect[0], y1); }
  function clouds(c, rect, list, col) { c.fillStyle = col || 'rgba(255,255,255,0.9)'; for (const k of list) { if (!hit(rect, k.x - 90, k.y - 40, k.x + 90, k.y + 20)) continue; c.beginPath(); circ(c, k.x, k.y, 24 * k.s); circ(c, k.x + 26 * k.s, k.y + 6, 18 * k.s); circ(c, k.x - 26 * k.s, k.y + 6, 17 * k.s); ell(c, k.x, k.y + 10, 52 * k.s, 12 * k.s); c.fill(); } }
  function speckle(c, rect, seed, n, cols, size, mode) {
    // deterministic texture marks per 200-unit cell, only cells touching the rect
    const cs = 200;
    for (let cy = Math.floor(rect[1] / cs); cy <= Math.floor(rect[3] / cs); cy++) for (let cx = Math.floor(rect[0] / cs); cx <= Math.floor(rect[2] / cs); cx++) {
      const r = SC.rng(seed ^ (cx * 7919 + cy * 104729));
      for (let i = 0; i < n; i++) {
        const x = cx * cs + r() * cs, y = cy * cs + r() * cs, k = size * (0.6 + r() * 0.8);
        if (mode === 'grass') { c.strokeStyle = cols[i % cols.length]; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - k * 0.6, y - k); c.lineTo(x, y); c.lineTo(x + k * 0.6, y - k); c.moveTo(x, y); c.lineTo(x + 0.1, y - k * 1.2); c.stroke(); }
        else if (mode === 'pebble') { c.fillStyle = cols[i % cols.length]; c.beginPath(); c.ellipse(x, y, k * 0.6, k * 0.4, 0, 0, TAU); c.fill(); }
        else { c.fillStyle = cols[i % cols.length]; c.beginPath(); c.arc(x, y, k * 0.35, 0, TAU); c.fill(); }
      }
    }
  }
  function buildings(c, rect, list, night) {
    for (const b of list) {
      if (!hit(rect, b.x, b.top - 30, b.x + b.w, b.bot)) continue;
      paint(c, () => rr(c, b.x, b.top, b.w, b.bot - b.top + 4, 2), b.col, { k: 4, lw: 2 });
      c.fillStyle = shade(b.col, -0.2); c.fillRect(b.x - 4, b.top - 6, b.w + 8, 10); // cornice
      c.strokeStyle = OUT; c.lineWidth = 1.5; c.strokeRect(b.x - 4, b.top - 6, b.w + 8, 10);
      const cols = Math.max(2, Math.floor(b.w / 46)), rows = Math.max(1, Math.floor((b.bot - b.top - 110) / 70));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const wx = b.x + 14 + i * ((b.w - 28) / cols) + 6, wy = b.top + 24 + j * 70, ww = (b.w - 28) / cols - 12;
        const lit = night && ((i * 3 + j * 5 + b.x) % 7 < 4);
        paint(c, () => rr(c, wx, wy, ww, 40, 3), lit ? '#ffd98a' : (night ? '#2c3566' : '#9fd3f0'), { shade: false, lw: 1.4, detail: () => { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(wx + 3, wy + 3, ww * 0.35, 14); } });
        c.fillStyle = '#f5ede0'; c.fillRect(wx - 3, wy + 40, ww + 6, 4);
        if (b.boxes && !night && (i + j) % 2 === 0) { c.fillStyle = '#4f9d4a'; c.fillRect(wx, wy + 44, ww, 5); for (let k = 0; k < 4; k++) dot(c, wx + 3 + k * (ww - 6) / 3, wy + 44, 2.4, ['#ff7eb6', '#ffd23f', '#ff6f61'][k % 3]); }
      }
      // storefront + awning
      const sy = b.bot - 86;
      if (b.awn) {
        paint(c, () => rr(c, b.x + 10, sy + 34, b.w - 20, 52, 2), night ? '#3d4a7a' : '#bfe6f5', { shade: false, lw: 1.5 });
        paint(c, () => { c.moveTo(b.x + 4, sy); c.lineTo(b.x + b.w - 4, sy); c.lineTo(b.x + b.w + 6, sy + 28); c.lineTo(b.x - 6, sy + 28); c.closePath(); }, b.awn, { shade: false, lw: 1.5, detail: () => { c.fillStyle = 'rgba(255,255,255,0.75)'; for (let x = b.x - 6; x < b.x + b.w + 6; x += 24) c.fillRect(x, sy, 12, 28); } });
      }
    }
  }
  function steeple(c, rect, x, base, night) {
    if (!hit(rect, x - 80, 0, x + 80, base)) return;
    const col = night ? '#cdd3f0' : '#f7f3ea';
    paint(c, () => rr(c, x - 70, base - 220, 140, 220, 2), col, { k: 4, lw: 2 });
    paint(c, () => rr(c, x - 32, base - 330, 64, 112, 2), col, { k: 3, lw: 2 });
    paint(c, () => { c.moveTo(x - 36, base - 328); c.lineTo(x, base - 470); c.lineTo(x + 36, base - 328); c.closePath(); }, night ? '#5a6496' : '#7e8aa6', { k: 3, lw: 2 });
    paint(c, () => rr(c, x - 14, base - 300, 28, 50, 14), night ? '#ffd98a' : '#3f4b66', { shade: false, lw: 1.4 });
    paint(c, () => circ(c, x, base - 190, 22), '#ffffff', { shade: false, lw: 1.6 }); line(c, [x, base - 190, x, base - 205], 1.4); line(c, [x, base - 190, x + 10, base - 186], 1.4);
    paint(c, () => rr(c, x - 22, base - 90, 44, 90, 22), night ? '#6b4a8a' : '#7a5230', { shade: false, lw: 1.6 });
  }
  function bunting(c, rect, x0, y0, x1, y1, sag, cols) {
    if (!hit(rect, Math.min(x0, x1), Math.min(y0, y1) - 10, Math.max(x0, x1), Math.max(y0, y1) + sag + 30)) return;
    const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 26);
    c.strokeStyle = '#5a4a5a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); c.stroke();
    for (let i = 1; i < n; i++) {
      const t = i / n, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 + x1) / 2 + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + sag * 2) + t * t * y1;
      paint(c, () => { c.moveTo(x - 8, y); c.lineTo(x + 8, y); c.lineTo(x, y + 18); c.closePath(); }, cols[i % cols.length], { shade: false, lw: 1 });
    }
  }
  function stringLights(c, rect, x0, y0, x1, y1, sag, seed) {
    if (!hit(rect, Math.min(x0, x1), Math.min(y0, y1) - 10, Math.max(x0, x1), Math.max(y0, y1) + sag * 2 + 20)) return;
    c.strokeStyle = '#1b1b2b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); c.stroke();
    const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 30), cols = ['#ffd166', '#ff7eb6', '#9ad0ec', '#b5e48c', '#ff9f43'];
    for (let i = 1; i < n; i++) {
      const t = i / n, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 + x1) / 2 + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + sag * 2) + t * t * y1;
      const col = cols[(i + seed) % cols.length];
      c.fillStyle = col; c.globalAlpha = 0.25; c.beginPath(); circ(c, x, y + 4, 9); c.fill(); c.globalAlpha = 1;
      paint(c, () => ell(c, x, y + 4, 3, 4.2), col, { shade: false, lw: 0.8 });
    }
  }
  function mountains(c, rect, y, cols, seed) {
    cols.forEach((col, k) => {
      const base = y + k * 26;
      if (!hit(rect, 0, base - 140, W, base + 60)) return;
      const r = SC.rng(seed + k * 31);
      c.fillStyle = col; c.beginPath(); c.moveTo(0, base + 60);
      for (let x = 0; x <= W; x += 40) c.lineTo(x, base - 40 - Math.abs(Math.sin(x * 0.0021 + k * 2 + r() * 0.3)) * (90 - k * 22) - r() * 10);
      c.lineTo(W, base + 60); c.closePath(); c.fill();
    });
  }

  // common crowd member
  function commonPerson(r, theme, z, extra) {
    const roll = r();
    const banim = r.weighted([['breathe', 5], ['bob', 2.2], ['sway', 1.6], ['bounce', 0.7]]);
    if (roll < 0.06) { const p = SC.ART.randPerson(r, theme, { kid: false, with: 'dog', dog: SC.ART.randDog(r), hold: 'leash', armAnim: 'still', balloon: false }); return { kind: 'person', spec: p, banim: 'breathe', foot: [24, 8] }; }
    if (roll < 0.09) return { kind: 'person', spec: SC.ART.randPerson(r, theme, { kid: false, with: 'stroller', strc: r.pick(SC.PAL.tops), hold: 'none', armAnim: 'still' }), banim: 'breathe', foot: [24, 8] };
    if (roll < 0.11 && theme !== 'winter' && theme !== 'beach') return { kind: 'person', spec: SC.ART.randPerson(r, theme, { kid: false, with: 'bike', bikec: r.pick(SC.PAL.tops), basket: r.chance(0.4), hold: 'none', armAnim: 'still' }), banim: 'breathe', foot: [30, 8] };
    if (roll < 0.15 && theme !== 'winter') return { kind: 'person', spec: SC.ART.randPerson(r, theme, { kid: r.chance(0.7), balloon: true, balc: r.pick(['#ff6f61', '#ffd23f', '#4d96ff', '#c77dff', '#ff7eb6', '#7bd389']), hold: 'none', armAnim: 'still' }), banim, foot: [11, 7] };
    if (roll < 0.175) { const d = SC.ART.randDog(r); return { kind: 'dog', spec: d, banim: 'bob', foot: [13, 6] }; }
    return { kind: 'person', spec: SC.ART.randPerson(r, theme, extra), banim, foot: [11, 7] };
  }
  function chuckNear(api, e, side, front, pose) {
    const r = api.r, s = e.s, b = e.box;
    const x = side < 0 ? b[0] - 5 * s : b[2] + 5 * s;
    const y = e.y + (front ? 6 : -3) * s;
    return api.add('woodchuck', {}, x, y, { banim: 'chuck', flip: side > 0, role: 'target' });
  }
  function champOn(api, x, y, z, pose, water) {
    return api.add('champ', { pose, water: !!water && pose !== 'peek' }, x, y, { z, s: api.scale(y), role: 'target', flip: api.r.chance(0.5) });
  }

  const pushSpot = (S, kind, fn) => { fn.kind = kind; S.champSpots.push(fn); };
  const THEMES = {};

  // =========================================================== SUMMER STREET FEST (pedestrian mall)
  THEMES.festival = {
    name: 'Street Fest', ext: ['#7fd0ff', '#b98d77'], sub: 'Summer festival on the pedestrian mall', gy0: 560, frame: '#2e2340', icon: '#ff9f43',
    plan(r) {
      const b = []; let x = -20;
      const cols = ['#b5523b', '#c9693f', '#efd9b4', '#8fb8c9', '#d98e73', '#6f8f72', '#e7c27d', '#a35d6a'];
      while (x < W) { const w = r.range(170, 260); if (x + w > 860 && x < 1140) { x = 1140; continue; } b.push({ x, w, top: r.range(70, 210), bot: 572, col: r.pick(cols), awn: r.pick(['#2a9d8f', '#e76f51', '#4d96ff', '#7b6cf6', '#e9c46a']), boxes: r.chance(0.5) }); x += w + r.range(0, 8); }
      return { b, clouds: [{ x: 300, y: 70, s: 1 }, { x: 1500, y: 50, s: 1.2 }, { x: 1800, y: 110, s: 0.8 }], seed: r.int(1, 1e6) };
    },
    paint(c, P, rect) {
      sky(c, rect, 580, '#7fd0ff', '#d9f3ff');
      clouds(c, rect, P.clouds);
      steeple(c, rect, 1000, 572, false);
      buildings(c, rect, P.b, false);
      // pavers
      if (hit(rect, 0, 560, W, H)) {
        c.fillStyle = '#ddb39a'; c.fillRect(rect[0], Math.max(560, rect[1]), rect[2] - rect[0], rect[3] - Math.max(560, rect[1]));
        c.fillStyle = '#e8cbb5'; c.fillRect(Math.max(rect[0], 780), Math.max(560, rect[1]), Math.min(rect[2], 1220) - Math.max(rect[0], 780), rect[3] - Math.max(560, rect[1]));
        c.strokeStyle = 'rgba(150,90,70,0.35)'; c.lineWidth = 1.2;
        const y0 = Math.max(560, Math.floor(rect[1] / 16) * 16), y1 = rect[3];
        c.beginPath();
        for (let y = y0; y <= y1; y += 16) { c.moveTo(rect[0], y); c.lineTo(rect[2], y); const off = (Math.round(y / 16) % 2) * 16; for (let xx = Math.floor(rect[0] / 32) * 32 + off; xx < rect[2]; xx += 32) { c.moveTo(xx, y); c.lineTo(xx, y + 16); } }
        c.stroke();
        speckle(c, rect, P.seed, 8, ['rgba(255,255,255,0.22)', 'rgba(120,60,40,0.16)'], 8, 'pebble');
        c.fillStyle = 'rgba(0,0,0,0.08)'; if (hit(rect, 0, 560, W, 600)) c.fillRect(rect[0], 560, rect[2] - rect[0], 30);
      }
      bunting(c, rect, 0, 300, 1000, 330, 30, ['#ff6f61', '#ffd23f', '#4d96ff', '#7bd389', '#c77dff']);
      bunting(c, rect, 1000, 330, 2000, 290, 30, ['#ffd23f', '#ff7eb6', '#3ec1d3', '#ff9f43']);
    },
    layout(api, S, D) {
      const r = api.r;
      const signs = ['CREEMEES', 'TACOS', 'CRAFTS', 'MAPLE', 'LEMONADE', 'POTTERY', 'FRIES', 'PIES'];
      const goodsFor = { CREEMEES: 'creemee', TACOS: 'food', CRAFTS: 'craft', MAPLE: 'maple', LEMONADE: 'food', POTTERY: 'craft', FRIES: 'food', PIES: 'food' };
      const canopy = [['#ff9f43', '#fff4d6'], ['#3ec1d3', '#ffffff'], ['#7b6cf6', '#ffe8a3'], ['#7bd389', '#ffffff'], ['#ff7eb6', '#fff4d6'], ['#4d96ff', '#ffd23f']];
      r.shuffle(signs);
      // stalls along both sides
      let si = 0;
      for (const side of [0, 1]) for (let y = 720; y < 2300; y += r.range(300, 360)) {
        const x = side ? r.range(1760, 1840) : r.range(160, 240);
        const cc = r.pick(canopy), sign = signs[si++ % signs.length];
        api.stall(x, y, { w: r.range(62, 74), c1: cc[0], c2: cc[1], goods: goodsFor[sign], sign, cc: r.pick(['#a8743f', '#c49a6c', '#8d6e63']) }, SC.ART.randPerson(r, 'festival', { kid: false, pose: 'stand', armAnim: r.chance(0.4) ? 'wave' : 'sway', bag: 'none' }));
        const st = S.ents[S.ents.length - 1];
        pushSpot(S, 'stall', (pose) => champOn(api, st.x + r.range(-14, 14) * st.s, st.y - 20 * st.s, st.y + 0.5, 'peek'));
      }
      // fountain in the middle
      const fx = r.range(900, 1100), fy = r.range(1240, 1420), fs = api.scale(fy);
      api.add('prop', { p: 'fountainB' }, fx, fy, { z: fy - 30, s: fs, role: 'prop' });
      api.add('prop', { p: 'spray', anim: 'spray' }, fx, fy, { z: fy - 29, s: fs, role: 'prop', noHit: true });
      api.add('prop', { p: 'fountainF' }, fx, fy, { role: 'prop', foot: [56, 30] });
      S.waterSpots = [];
      for (const dx of [-30, 26]) S.waterSpots.push({ x: fx + dx * fs, y: fy - 22 * fs, z: fy - 2, s: fs * 0.9 });
      pushSpot(S, 'fountain', (pose) => pose === 'peek' ? champOn(api, fx + r.pick([-28, 30]) * fs, fy - 11 * fs, fy + 0.5, 'peek') : champOn(api, fx + r.pick([-24, 22]) * fs, fy - 21 * fs, fy - 1, 'neck', true));
      // kiddie pool with inflatables
      const px = r.chance(0.5) ? r.range(520, 700) : r.range(1300, 1480), py = r.range(1820, 2080), ps = api.scale(py);
      api.add('prop', { p: 'poolB' }, px, py, { z: py - 20, s: ps, role: 'prop' });
      api.add('prop', { p: 'poolF' }, px, py, { role: 'prop', foot: [48, 26] });
      for (const dx of [-22, 18, 0]) S.waterSpots.push({ x: px + dx * ps, y: py - (dx ? 16 : 22) * ps, z: py - 1 - (dx ? 0 : 3), s: ps * 0.85 });
      api.add('prop', { p: 'floatring', col: '#ffd23f', water: true }, px + 26 * ps, py - 20 * ps, { z: py - 18, s: ps * 0.8, role: 'prop', noHit: true });
      pushSpot(S, 'pool', (pose) => champOn(api, px + r.range(-12, 12) * ps, py - 17 * ps, py - 1.5, pose === 'peek' ? 'peek' : 'neck', true));
      // trees, planters, benches, lamps down the middle
      for (let y = 760; y < 2350; y += r.range(220, 280)) {
        if (Math.abs(y - fy) < 150) continue;
        const x = r.range(760, 1240), k = r.pick(['planter', 'bench', 'lamp', 'tree', 'planter', 'bin']);
        if (k === 'tree') api.prop('tree', x, y, { k: 0.9, grate: true }, { foot: [14, 8] });
        else if (k === 'bench') { const b = api.prop('bench', x, y, { col: '#a8743f' }, { foot: [25, 10] }); if (r.chance(0.6)) api.add('person', SC.ART.randPerson(r, 'festival', { pose: 'sit', kid: false, armAnim: 'sway' }), x + r.range(-10, 10) * b.s, y - 4 * b.s, { z: y - 4, banim: 'breathe', role: 'crowd' }); S.chuckSpots.push(() => chuckNear(api, b, r.pick([-1, 1]), true)); }
        else if (k === 'planter') { const p = api.prop('planter', x, y, {}, { foot: [24, 12] }); S.chuckSpots.push(() => chuckNear(api, p, r.pick([-1, 1]), r.chance(0.5))); }
        else if (k === 'lamp') api.prop('lamp', x, y, { basket: true, banner: r.pick(['#4d96ff', '#2a9d8f', '#e76f51']) }, { foot: [7, 5] });
        else api.prop('bin', x, y, {}, { foot: [8, 5] });
      }
      for (let i = 0; i < 2; i++) { const x = r.range(420, 1580), y = r.range(700, 2300); api.add('prop', { p: 'balloons' }, x, y, { role: 'prop', foot: [8, 5] }); }
      S.zones.push({ x0: 300, y0: 600, x1: 1700, y1: 2380, w: 1 });
      S.zones.push({ x0: 40, y0: 620, x1: 330, y1: 2380, w: 0.7 });
      S.zones.push({ x0: 1670, y0: 620, x1: 1960, y1: 2380, w: 0.7 });
    },
    crowd(r, S, z) { return commonPerson(r, 'festival', z); },
  };

  // =========================================================== FARMERS MARKET
  THEMES.market = {
    name: 'Farmers Market', ext: ['#86d4ff', '#7fb35d'], sub: 'Saturday market in the park', gy0: 540, frame: '#22331f', icon: '#7bd389',
    plan(r) {
      const trees = []; for (let x = -40; x < W + 60; x += r.range(70, 110)) trees.push({ x, y: r.range(420, 520), s: r.range(0.9, 1.4), col: r.pick(['#3f8f4a', '#4fa356', '#2f7a43', '#5cae4f']), au: r.chance(0.25) ? r.pick(['#f4a261', '#e76f51', '#e9c46a']) : null });
      return { trees, clouds: [{ x: 400, y: 80, s: 1.1 }, { x: 1300, y: 60, s: 0.9 }, { x: 1750, y: 120, s: 1 }], seed: r.int(1, 1e6) };
    },
    paint(c, P, rect) {
      sky(c, rect, 560, '#86d4ff', '#e3f6ff');
      clouds(c, rect, P.clouds);
      mountains(c, rect, 330, ['#9cc7b6', '#7fb29c'], 7);
      // gazebo
      if (hit(rect, 860, 200, 1140, 560)) {
        paint(c, () => rr(c, 900, 360, 200, 170, 2), '#fbf7ee', { k: 3, lw: 2, detail: () => { c.fillStyle = '#d9ecf2'; for (let i = 0; i < 4; i++) c.fillRect(915 + i * 47, 380, 30, 110); } });
        paint(c, () => { c.moveTo(880, 365); c.lineTo(1000, 260); c.lineTo(1120, 365); c.closePath(); }, '#5e8b7e', { k: 3, lw: 2 });
        paint(c, () => { c.moveTo(990, 262); c.lineTo(1000, 232); c.lineTo(1010, 262); c.closePath(); }, '#5e8b7e', { shade: false, lw: 1.5 });
      }
      if (hit(rect, 0, 400, W, 545)) { c.fillStyle = '#86c063'; c.fillRect(rect[0], Math.max(400, rect[1]), rect[2] - rect[0], Math.min(545, rect[3]) - Math.max(400, rect[1])); c.fillStyle = '#7ab35a'; c.fillRect(rect[0], Math.max(400, rect[1]), rect[2] - rect[0], Math.max(0, Math.min(430, rect[3]) - Math.max(400, rect[1]))); }
      for (const t of P.trees) {
        if (!hit(rect, t.x - 80, t.y - 160, t.x + 80, t.y + 10)) continue;
        paint(c, () => rr(c, t.x - 6 * t.s, t.y - 60 * t.s, 12 * t.s, 62 * t.s, 3), '#7a5230', { shade: false, lw: 1.5 });
        c.fillStyle = OUT; c.beginPath(); circ(c, t.x, t.y - 100 * t.s, 44 * t.s + 2); circ(c, t.x - 34 * t.s, t.y - 74 * t.s, 34 * t.s + 2); circ(c, t.x + 34 * t.s, t.y - 76 * t.s, 34 * t.s + 2); c.fill();
        paint(c, () => { circ(c, t.x, t.y - 100 * t.s, 44 * t.s); circ(c, t.x - 34 * t.s, t.y - 74 * t.s, 34 * t.s); circ(c, t.x + 34 * t.s, t.y - 76 * t.s, 34 * t.s); }, t.col, { k: 5, line: false, detail: () => { if (t.au) { c.fillStyle = t.au; c.beginPath(); circ(c, t.x + 20 * t.s, t.y - 110 * t.s, 26 * t.s); c.fill(); } } });
      }
      if (hit(rect, 0, 540, W, H)) {
        const y0 = Math.max(540, rect[1]);
        c.fillStyle = '#9fd477'; c.fillRect(rect[0], y0, rect[2] - rect[0], rect[3] - y0);
        c.fillStyle = '#93cb6b'; for (let x = Math.floor(rect[0] / 120) * 120; x < rect[2]; x += 120) c.fillRect(x, y0, 60, rect[3] - y0);
        speckle(c, rect, P.seed, 26, ['rgba(60,130,40,0.5)', 'rgba(70,140,50,0.45)', 'rgba(255,255,255,0.35)'], 6, 'grass');
        // gravel paths (on top of the grass texture, with soft rounded edges)
        c.fillStyle = '#ead9b0'; c.strokeStyle = 'rgba(150,120,70,0.35)'; c.lineWidth = 3;
        c.beginPath(); rr(c, 860, 520, 280, 1900, 40); rr(c, -40, 1420, W + 80, 160, 60); c.fill();
        c.beginPath(); rr(c, 860, 520, 280, 1900, 40); c.stroke(); c.beginPath(); rr(c, -40, 1420, W + 80, 160, 60); c.stroke();
        c.fillStyle = '#ead9b0'; c.fillRect(864, 1424, 272, 152);
        speckle(c, [Math.max(rect[0], 860), rect[1], Math.min(rect[2], 1140), rect[3]], P.seed + 1, 6, ['rgba(160,130,80,0.35)', 'rgba(255,255,255,0.4)'], 6, 'pebble');
        c.fillStyle = 'rgba(0,0,0,0.07)'; if (hit(rect, 0, 540, W, 580)) c.fillRect(rect[0], 540, rect[2] - rect[0], 26);
      }
    },
    layout(api, S, D) {
      const r = api.r;
      const signs = ['APPLES', 'CIDER', 'MAPLE', 'HONEY', 'FLOWERS', 'BREAD', 'CHEESE', 'VEGGIES', 'PIES', 'EGGS'];
      const goodsFor = { APPLES: 'produce', CIDER: 'food', MAPLE: 'maple', HONEY: 'maple', FLOWERS: 'flowers', BREAD: 'food', CHEESE: 'food', VEGGIES: 'produce', PIES: 'food', EGGS: 'food' };
      const canopy = [['#ffffff', '#7bd389'], ['#ffffff', '#4d96ff'], ['#ffe8a3', '#f4a261'], ['#ffffff', '#2a9d8f'], ['#fff4d6', '#c77dff']];
      r.shuffle(signs);
      let si = 0;
      const cols = [260, 640, 1360, 1740];
      for (const cx of cols) for (let y = 700; y < 2340; y += r.range(330, 400)) {
        if (Math.abs(y - 1500) < 110) y += 120;
        const x = cx + r.range(-40, 40), cc = r.pick(canopy), sign = signs[si++ % signs.length];
        api.stall(x, y, { w: r.range(64, 76), c1: cc[1], c2: cc[0], goods: goodsFor[sign], sign, cc: r.pick(['#c49a6c', '#a8743f']) }, SC.ART.randPerson(r, 'market', { kid: false, armAnim: r.chance(0.4) ? 'wave' : 'sway', bag: 'none', hold: 'none' }));
        const st = S.ents[S.ents.length - 1];
        pushSpot(S, 'stall', () => champOn(api, st.x + r.range(-14, 14) * st.s, st.y - 20 * st.s, st.y + 0.5, 'peek'));
        // something in front of the stall
        const fx = x + r.range(-50, 50), fy = y + r.range(46, 70), k = r.pick(['hay', 'pumpkins', 'crates', 'buckets', 'hay']);
        const p = api.prop(k, fx, fy, {}, { foot: [24, 10] });
        if (k === 'hay' || k === 'pumpkins') pushSpot(S, k, () => champOn(api, p.x + r.range(-8, 8) * p.s, p.y - (k === 'hay' ? 17 : 15) * p.s, p.y + 0.5, 'peek'));
        S.chuckSpots.push(() => chuckNear(api, p, r.pick([-1, 1]), r.chance(0.6)));
      }
      // apple-bobbing tub
      const tx = r.range(920, 1080), ty = r.range(1800, 2100), ts = api.scale(ty);
      api.add('prop', { p: 'tubB' }, tx, ty, { z: ty - 14, s: ts, role: 'prop' });
      api.add('prop', { p: 'tubF' }, tx, ty, { role: 'prop', foot: [24, 14] });
      S.waterSpots = [{ x: tx - 10 * ts, y: ty - 13 * ts, z: ty - 1, s: ts * 0.8 }];
      pushSpot(S, 'tub', (pose) => champOn(api, tx + r.range(-4, 4) * ts, ty - 13 * ts, ty - 0.5, pose === 'peek' ? 'peek' : 'neck', true));
      for (let i = 0; i < 4; i++) { const x = r.chance(0.5) ? r.range(60, 160) : r.range(1840, 1940), y = r.range(700, 2300); api.prop('tree', x, y, { k: 1.05, col: r.pick(['#4fa356', '#5cae4f']), autumn: r.chance(0.5) ? '#f4a261' : null }, { foot: [14, 8] }); }
      for (let i = 0; i < 3; i++) { const x = r.range(880, 1120), y = r.range(700, 1380); const b = api.prop('bench', x, y, { col: '#8d6e63' }, { foot: [25, 10] }); S.chuckSpots.push(() => chuckNear(api, b, r.pick([-1, 1]), true)); }
      S.zones.push({ x0: 40, y0: 600, x1: 1960, y1: 2380, w: 1 });
      S.zones.push({ x0: 840, y0: 600, x1: 1160, y1: 2380, w: 1.2 });
      S.zones.push({ x0: 40, y0: 1420, x1: 1960, y1: 1580, w: 1.2 });
    },
    crowd(r, S, z) { return commonPerson(r, 'market', z); },
  };

  // =========================================================== LAKESIDE BEACH DAY
  THEMES.beach = {
    name: 'Beach Day', ext: ['#6cc6ff', '#d9bf88'], sub: 'A hot afternoon by the lake', gy0: 600, frame: '#173a52', icon: '#3ec1d3',
    plan(r) {
      const boats = []; for (let i = 0; i < 6; i++) boats.push({ x: r.range(80, 1920), y: r.range(380, 520), s: r.range(0.6, 1.1), col: r.pick(['#ffffff', '#ffd23f', '#ff7eb6', '#9ad0ec']) });
      return { boats, clouds: [{ x: 250, y: 90, s: 1.2 }, { x: 900, y: 60, s: 0.9 }, { x: 1600, y: 100, s: 1.3 }], seed: r.int(1, 1e6) };
    },
    shore: 1060,
    paint(c, P, rect) {
      sky(c, rect, 330, '#6cc6ff', '#e6f7ff');
      clouds(c, rect, P.clouds);
      if (hit(rect, 1500, 40, 1680, 220)) { c.fillStyle = 'rgba(255,240,170,0.5)'; c.beginPath(); circ(c, 1590, 130, 70); c.fill(); dot(c, 1590, 130, 46, '#fff3b0'); }
      mountains(c, rect, 280, ['#8ea7d4', '#7590c4', '#6a86b8'], 3);
      // lake (continues into the swimming area), then the shore
      const sh = 1060;
      if (hit(rect, 0, 300, W, sh + 40)) {
        const g = c.createLinearGradient(0, 300, 0, sh); g.addColorStop(0, '#2f7fc1'); g.addColorStop(0.45, '#3fa7d6'); g.addColorStop(1, '#8fdcf2');
        c.fillStyle = g; c.fillRect(rect[0], Math.max(300, rect[1]), rect[2] - rect[0], Math.min(sh + 30, rect[3]) - Math.max(300, rect[1]));
        c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2;
        for (let y = 340; y < sh; y += 34) { if (y < rect[1] - 10 || y > rect[3] + 10) continue; c.beginPath(); for (let x = Math.floor(rect[0] / 60) * 60 + (y % 68 ? 30 : 0); x < rect[2]; x += 60) { c.moveTo(x, y); c.quadraticCurveTo(x + 10, y - 4, x + 20, y); } c.stroke(); }
        for (const b of P.boats) { if (!hit(rect, b.x - 40, b.y - 70, b.x + 40, b.y + 10)) continue; paint(c, () => { c.moveTo(b.x - 30 * b.s, b.y); c.lineTo(b.x + 30 * b.s, b.y); c.lineTo(b.x + 22 * b.s, b.y + 10 * b.s); c.lineTo(b.x - 22 * b.s, b.y + 10 * b.s); c.closePath(); }, b.col, { shade: false, lw: 1.4 }); line(c, [b.x, b.y, b.x, b.y - 60 * b.s], 1.4); paint(c, () => { c.moveTo(b.x + 2, b.y - 58 * b.s); c.lineTo(b.x + 26 * b.s, b.y - 6); c.lineTo(b.x + 2, b.y - 6); c.closePath(); }, '#ffffff', { shade: false, lw: 1.2 }); }
      }
      if (hit(rect, 0, sh - 20, W, H)) {
        const y0 = Math.max(sh, rect[1]);
        c.fillStyle = '#f3dca5'; c.fillRect(rect[0], y0, rect[2] - rect[0], rect[3] - y0);
        if (hit(rect, 0, sh, W, sh + 90)) { const g = c.createLinearGradient(0, sh, 0, sh + 90); g.addColorStop(0, '#d9bb7c'); g.addColorStop(1, 'rgba(243,220,165,0)'); c.fillStyle = g; c.fillRect(rect[0], sh, rect[2] - rect[0], 90); }
        // foam line
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(rect[0], sh + 6);
        for (let x = Math.floor(rect[0] / 40) * 40; x <= rect[2] + 40; x += 40) c.quadraticCurveTo(x + 20, sh + 16, x + 40, sh + 6);
        c.lineTo(rect[2] + 40, sh - 4); c.lineTo(rect[0], sh - 4); c.closePath(); c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
        speckle(c, rect, P.seed, 22, ['rgba(180,140,80,0.4)', 'rgba(255,255,255,0.55)', 'rgba(200,160,100,0.35)'], 5);
      }
    },
    layout(api, S, D) {
      const r = api.r, sh = 1060;
      S.waterSpots = [];
      // umbrellas, towels, chairs, coolers, castles
      for (let i = 0; i < 16; i++) {
        const x = r.range(80, 1920), y = r.range(1180, 2340), s = api.scale(y);
        if (!api.free(x, y, 40 * s, 20 * s)) continue;
        const cc = r.pick([['#17b3a3', '#ffe8a3'], ['#4d96ff', '#ffffff'], ['#ff9f43', '#fff4d6'], ['#7b6cf6', '#ffd23f'], ['#ff7eb6', '#ffffff']]);
        api.prop('towel', x + 6 * s, y + 10, { c1: r.pick(['#ff7eb6', '#4d96ff', '#ffd23f', '#7bd389', '#c77dff']), c2: '#ffffff' }, { z: y - 6, foot: [1, 1], noHit: true });
        if (r.chance(0.75)) api.prop('umbrella', x - 18 * s, y - 6, { c1: cc[0], c2: cc[1] }, { foot: [6, 4] });
        if (r.chance(0.5)) api.add('person', SC.ART.randPerson(r, 'beach', { pose: 'sit', kid: false }), x + 8 * s, y + 4, { banim: 'breathe', role: 'crowd' });
        else if (r.chance(0.5)) api.prop('chair', x + 22 * s, y + 8, { c1: cc[0] }, { foot: [12, 6] });
        if (r.chance(0.4)) { const co = api.prop('cooler', x - 26 * s, y + 14, { col: r.pick(['#e63946', '#4d96ff', '#2a9d8f']) }, { foot: [11, 6] }); S.chuckSpots.push(() => chuckNear(api, co, r.pick([-1, 1]), true)); }
        api.mark(x, y, 36 * s, 16 * s);
      }
      for (let i = 0; i < 4; i++) {
        const x = r.range(150, 1850), y = r.range(1160, 2300);
        if (!api.free(x, y, 24, 14)) continue;
        const sc = api.prop('sandcastle', x, y, { flag: r.pick(['#4d96ff', '#ff6f61', '#ffd23f']) }, { foot: [20, 10] });
        pushSpot(S, 'sandcastle', () => champOn(api, sc.x + r.range(-6, 6) * sc.s, sc.y - 12 * sc.s, sc.y + 0.5, 'peek'));
        S.chuckSpots.push(() => chuckNear(api, sc, r.pick([-1, 1]), r.chance(0.5)));
      }
      const nx = r.range(500, 1500), ny = r.range(1500, 2100); api.prop('net', nx, ny, {}, { foot: [56, 6] });
      api.prop('lifeguard', r.range(200, 1800), r.range(1120, 1200), {}, { foot: [16, 8] });
      // swimmers and floats in the shallows
      for (let i = 0; i < 6; i++) { const x = r.range(100, 1900), y = r.range(700, 1000); api.prop('floatring', x, y, { col: r.pick(['#ff7eb6', '#ffd23f', '#7bd389', '#ff9f43']), water: true }, { foot: [14, 6], noHit: true }); }
      for (let i = 0; i < 10; i++) { const x = r.range(120, 1880), y = r.range(680, 1010); S.waterSpots.push({ x, y, z: y, s: api.scale(y) }); }
      pushSpot(S, 'lake', (pose) => { for (let k = 0; k < 30; k++) { const x = r.range(150, 1850), y = r.range(700, 980), s = api.scale(y); if (api.free(x, y, 30 * s, 12 * s)) { api.mark(x, y, 30 * s, 12 * s); return champOn(api, x, y, y, pose === 'peek' ? 'peek' : 'neck', true); } } return champOn(api, 1000, 840, 840, 'neck', true); });
      S.zones.push({ x0: 60, y0: 660, x1: 1940, y1: 1010, w: 0.45, water: true, kind: 'water' });
      S.zones.push({ x0: 40, y0: 1110, x1: 1960, y1: 2380, w: 1 });
    },
    crowd(r, S, z) {
      if (z.kind === 'water') { const p = SC.ART.randPerson(r, 'beach', { pose: 'swim', hat: r.chance(0.2) ? 'cap' : 'none', hold: 'none', bag: 'none', balloon: false }); return { kind: 'person', spec: p, banim: 'swim', foot: [12, 6] }; }
      if (r.chance(0.05)) return { kind: 'prop', spec: { p: 'floatring', col: r.pick(['#ff7eb6', '#ffd23f', '#7bd389']) }, banim: null, foot: [14, 6] };
      return commonPerson(r, 'beach', z);
    },
  };

  // =========================================================== CITY MARATHON FINISH
  THEMES.marathon = {
    name: 'Marathon Finish', ext: ['#8bd0ff', '#7fb35f'], sub: 'Race day at the finish line', gy0: 600, frame: '#2b2f3f', icon: '#4d96ff',
    plan(r) {
      const b = []; let x = -20; const cols = ['#c9693f', '#efd9b4', '#8fb8c9', '#b5523b', '#9aa5b8', '#e7c27d', '#7c8cb0'];
      while (x < W) { const w = r.range(150, 240); b.push({ x, w, top: r.range(40, 220), bot: 612, col: r.pick(cols), boxes: false }); x += w + r.range(0, 10); }
      return { b, clouds: [{ x: 500, y: 60, s: 1 }, { x: 1400, y: 90, s: 1.1 }], seed: r.int(1, 1e6), clock: '2:' + ('0' + r.int(31, 58)).slice(-2) + ':' + ('0' + r.int(0, 59)).slice(-2) };
    },
    road: (y) => { const t = (y - 600) / 1800; return [760 - 180 * t, 1240 + 180 * t]; },
    paint(c, P, rect) {
      sky(c, rect, 620, '#8bd0ff', '#e3f5ff');
      clouds(c, rect, P.clouds);
      buildings(c, rect, P.b, false);
      if (hit(rect, 0, 600, W, H)) {
        const y0 = Math.max(600, rect[1]);
        c.fillStyle = '#93cf6e'; c.fillRect(rect[0], y0, rect[2] - rect[0], rect[3] - y0);
        // sidewalks + road (trapezoid)
        const road = THEMES.marathon.road;
        c.fillStyle = '#ddd5c6'; c.beginPath(); c.moveTo(road(600)[0] - 160, 600); c.lineTo(road(600)[1] + 160, 600); c.lineTo(road(2400)[1] + 200, 2400); c.lineTo(road(2400)[0] - 200, 2400); c.closePath(); c.fill();
        c.fillStyle = '#676c7a'; c.beginPath(); c.moveTo(road(600)[0], 600); c.lineTo(road(600)[1], 600); c.lineTo(road(2400)[1], 2400); c.lineTo(road(2400)[0], 2400); c.closePath(); c.fill();
        c.strokeStyle = '#4d96ff'; c.lineWidth = 8; c.beginPath(); c.moveTo(road(600)[0] + 40, 600); c.lineTo(road(2400)[0] + 50, 2400); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 5; c.setLineDash([40, 40]); c.beginPath(); c.moveTo(1000, 600); c.lineTo(1000, 2400); c.stroke(); c.setLineDash([]);
        speckle(c, rect, P.seed, 10, ['rgba(255,255,255,0.14)', 'rgba(0,0,0,0.1)'], 6, 'pebble');
        // checkered finish line
        if (hit(rect, 700, 640, 1300, 680)) { for (let x = road(650)[0], i = 0; x < road(650)[1]; x += 18, i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#1d1d24' : '#ffffff'; c.fillRect(x, 644 + j * 16, 18, 16); } }
      }
      // inflatable finish arch
      if (hit(rect, 600, 200, 1400, 680)) {
        const ac = '#4d96ff';
        paint(c, () => { c.moveTo(640, 660); c.lineTo(640, 360); c.quadraticCurveTo(640, 260, 760, 260); c.lineTo(1240, 260); c.quadraticCurveTo(1360, 260, 1360, 360); c.lineTo(1360, 660); c.lineTo(1290, 660); c.lineTo(1290, 360); c.quadraticCurveTo(1290, 330, 1250, 330); c.lineTo(750, 330); c.quadraticCurveTo(710, 330, 710, 360); c.lineTo(710, 660); c.closePath(); }, ac, { k: 6, lw: 2.4, detail: () => { c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(650, 280, 20, 380); c.fillRect(760, 268, 480, 12); } });
        paint(c, () => rr(c, 800, 270, 400, 52, 8), '#ffd23f', { shade: false, lw: 2 });
        c.fillStyle = '#1d2b5a'; c.font = '900 42px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FINISH', 1000, 298);
        paint(c, () => rr(c, 920, 200, 160, 56, 6), '#1d1d24', { shade: false, lw: 2 });
        c.fillStyle = '#ff5d5d'; c.font = '700 36px Courier New, monospace'; c.fillText(P.clock, 1000, 230);
      }
    },
    layout(api, S, D) {
      const r = api.r, road = THEMES.marathon.road;
      // barriers along both road edges
      for (let y = 760; y < 2380; y += 60) { const rd = road(y), s = api.scale(y); for (const side of [0, 1]) { const x = side ? rd[1] + 20 : rd[0] - 20; const banner = (Math.floor(y / 60) % 4 === 0) ? r.pick(['#e63946', '#2a9d8f', '#7b6cf6']) : null; api.prop('barrier', x, y, { w: 54, banner, text: r.pick(['GO GO GO', 'YOU GOT IT', 'ALMOST!', '26.2']) }, { foot: [27, 5] }); } }
      // water tables, porta-johns, tents, balloons on the sides
      for (const side of [0, 1]) {
        for (let y = 800; y < 2300; y += r.range(360, 460)) {
          const rd = road(y), x = side ? r.range(rd[1] + 160, 1900) : r.range(100, rd[0] - 160);
          const k = r.pick(['table', 'table', 'porta', 'tent', 'balloons']);
          if (k === 'table') { const t = api.add('prop', { p: 'table', w: 58, cloth: r.pick(['#4d96ff', '#2a9d8f', '#ff9f43']), goods: 'water' }, x, y, { role: 'prop', foot: [30, 10] }); api.add('person', SC.ART.randPerson(r, 'marathon', { kid: false, top: 'tee', tc: '#ffd23f', armAnim: 'wave' }), x + r.range(-12, 12) * t.s, y - 12 * t.s, { z: y - 12, banim: 'breathe', role: 'crowd' }).fixed = true; S.surfaces.push({ x0: x - 22 * t.s, x1: x + 22 * t.s, y: y - 16 * t.s, z: y + 0.4, s: t.s, used: false }); pushSpot(S, 'table', () => champOn(api, t.x + r.range(-12, 12) * t.s, t.y - 16 * t.s, t.y + 0.5, 'peek')); S.chuckSpots.push(() => chuckNear(api, t, r.pick([-1, 1]), true)); }
          else if (k === 'porta') { for (let i = 0; i < 3; i++) { const p = api.prop('portajohn', x + (i - 1) * 27 * api.scale(y), y, { col: r.pick(['#3e8ed0', '#3e8ed0', '#2a9d8f']) }, { foot: [13, 6] }); if (i === 1) pushSpot(S, 'portajohn', () => champOn(api, p.x, p.y - 49 * p.s, p.y + 0.5, 'peek')); } }
          else if (k === 'tent') api.stall(x, y, { w: 70, c1: r.pick(['#4d96ff', '#7b6cf6', '#2a9d8f']), c2: '#ffffff', goods: 'food', sign: r.pick(['MEDALS', 'BAGELS', 'BANANAS', 'INFO']) }, SC.ART.randPerson(r, 'marathon', { kid: false, armAnim: 'wave' }));
          else api.add('prop', { p: 'balloons', cols: ['#4d96ff', '#ffd23f', '#ffffff', '#ff6f61'] }, x, y, { role: 'prop', foot: [8, 5] });
        }
        for (let i = 0; i < 3; i++) { const y = r.range(800, 2300), rd = road(y), x = side ? r.range(rd[1] + 180, 1940) : r.range(60, rd[0] - 180); const tr = api.prop('tree', x, y, { k: 1 }, { foot: [14, 8] }); }
      }
      S.zones.push({ x0: 40, y0: 660, x1: 1960, y1: 2380, w: 1, kind: 'side', test: (x, y) => { const rd = road(y); return x < rd[0] - 40 || x > rd[1] + 40; } });
      S.zones.push({ x0: 600, y0: 700, x1: 1400, y1: 2380, w: 0.55, kind: 'road', road: true, test: (x, y) => { const rd = road(y); return x > rd[0] + 18 && x < rd[1] - 18; } });
    },
    crowd(r, S, z) {
      if (z.kind === 'road') {
        if (r.chance(0.6)) { const p = SC.ART.randPerson(r, 'marathon', { kid: false, pose: 'run', top: r.pick(['jersey', 'jersey', 'tank']), bottom: r.pick(['shorts', 'leggings']), hat: r.pick(['none', 'visor', 'band', 'cap']), hold: 'none', bag: 'none', balloon: false, with: null, num: r.int(100, 9999) }); return { kind: 'person', spec: p, banim: 'run', foot: [11, 7] }; }
        const p = SC.ART.randPerson(r, 'marathon', { kid: false, top: 'coat', tc: '#d4dce8', sleeve: 'long', medal: true, bottom: r.pick(['shorts', 'leggings']), hat: r.pick(['none', 'visor', 'band']), hold: r.pick(['none', 'cup']), armAnim: r.chance(0.5) ? 'wave' : 'sway', bag: 'none', balloon: false });
        return { kind: 'person', spec: p, banim: 'bob', foot: [11, 7] };
      }
      if (r.chance(0.28)) { const p = SC.ART.randPerson(r, 'marathon', { pose: 'sign', kid: false, text: r.pick(['GO!', 'RUN!', 'YAY!', 'WOO!', 'GO MOM', 'GO DAD', '26.2!', 'BTV!', 'HI!', 'GO GO']), signc: r.pick(['#ffffff', '#ffd23f', '#9ad0ec', '#ffb4a2']), signt: r.pick(['#e63946', '#1d2b5a', '#2a9d8f', '#7b6cf6']) }); return { kind: 'person', spec: p, banim: 'bounce', foot: [13, 7] }; }
      if (r.chance(0.2)) return { kind: 'person', spec: SC.ART.randPerson(r, 'marathon', { armAnim: 'wave', hold: r.chance(0.3) ? 'flag' : 'none', flagc: r.pick(['#4d96ff', '#ffd23f', '#7bd389']) }), banim: 'bounce', foot: [11, 7] };
      return commonPerson(r, 'marathon', z);
    },
  };

  // =========================================================== WINTER NIGHT PARADE
  THEMES.winter = {
    name: 'Night Parade', ext: ['#121842', '#8b99c2'], sub: 'A snowy winter night parade', gy0: 600, frame: '#0f1430', icon: '#9ad0ec', night: true,
    plan(r) {
      const b = []; let x = -20; const cols = ['#6b4a5a', '#4a5a7a', '#7a5a4a', '#5a6a5a', '#6a5a8a', '#3f4f6f'];
      while (x < W) { const w = r.range(170, 250); if (x + w > 880 && x < 1120) { x = 1120; continue; } b.push({ x, w, top: r.range(110, 250), bot: 612, col: r.pick(cols), awn: null }); x += w + r.range(0, 8); }
      const stars = []; for (let i = 0; i < 90; i++) stars.push({ x: r.range(0, W), y: r.range(0, 300), s: r.range(0.8, 2.4) });
      return { b, stars, seed: r.int(1, 1e6) };
    },
    road: (y) => [680, 1320],
    paint(c, P, rect) {
      sky(c, rect, 620, '#121842', '#3b3f86');
      if (hit(rect, 0, 0, W, 320)) for (const s of P.stars) dot(c, s.x, s.y, s.s, 'rgba(255,250,220,0.85)');
      if (hit(rect, 1600, 40, 1760, 200)) { c.fillStyle = 'rgba(255,250,220,0.18)'; c.beginPath(); circ(c, 1680, 120, 60); c.fill(); dot(c, 1680, 120, 34, '#fff8dc'); dot(c, 1692, 112, 30, '#3a3f80'); }
      steeple(c, rect, 1000, 612, true);
      buildings(c, rect, P.b, true);
      // snow caps on roofs
      for (const b of P.b) if (hit(rect, b.x - 10, b.top - 20, b.x + b.w + 10, b.top + 10)) { c.fillStyle = '#eef5ff'; c.beginPath(); c.moveTo(b.x - 6, b.top - 6); for (let x = b.x - 6; x <= b.x + b.w + 6; x += 12) c.quadraticCurveTo(x + 6, b.top - 14, x + 12, b.top - 6); c.lineTo(b.x + b.w + 6, b.top - 2); c.lineTo(b.x - 6, b.top - 2); c.fill(); }
      stringLights(c, rect, 0, 340, 1000, 380, 30, 0); stringLights(c, rect, 1000, 380, 2000, 330, 30, 2);
      stringLights(c, rect, 0, 460, 2000, 460, 24, 1);
      if (hit(rect, 0, 600, W, H)) {
        const y0 = Math.max(600, rect[1]);
        c.fillStyle = '#a7b6dc'; c.fillRect(rect[0], y0, rect[2] - rect[0], rect[3] - y0);
        c.fillStyle = '#8f9ecb'; c.fillRect(Math.max(rect[0], 680), y0, Math.max(0, Math.min(rect[2], 1320) - Math.max(rect[0], 680)), rect[3] - y0);
        c.strokeStyle = 'rgba(70,85,140,0.45)'; c.lineWidth = 6;
        for (const x of [820, 870, 1130, 1180]) if (x > rect[0] - 10 && x < rect[2] + 10) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, rect[3]); c.stroke(); }
        speckle(c, rect, P.seed, 18, ['rgba(255,255,255,0.75)', 'rgba(70,90,150,0.3)'], 5);
        c.fillStyle = 'rgba(20,20,60,0.15)'; if (hit(rect, 0, 600, W, 640)) c.fillRect(rect[0], 600, rect[2] - rect[0], 30);
      }
    },
    layout(api, S, D) {
      const r = api.r;
      // snowbanks lining the parade route
      for (let y = 700; y < 2380; y += r.range(130, 190)) for (const side of [0, 1]) {
        if (r.chance(0.25)) continue;
        const x = side ? r.range(1340, 1380) : r.range(620, 660);
        const sb = api.prop('snowbank', x, y, { w: r.range(64, 90) }, { foot: [36, 10] });
        pushSpot(S, 'snowbank', () => champOn(api, sb.x + r.range(-10, 10) * sb.s, sb.y - 17 * sb.s, sb.y + 0.5, 'peek'));
        S.chuckSpots.push(() => api.add('woodchuck', {}, sb.x + r.range(-12, 12) * sb.s, sb.y - 15 * sb.s, { z: sb.y + 0.6, banim: 'chuck', role: 'target', flip: r.chance(0.5) }));
      }
      // floats + band in the street
      const fl = r.shuffle(['mug', 'leaf', 'flake']);
      [930, 1500, 2080].forEach((y, i) => {
        const x = r.range(940, 1060), f = api.prop('float', x, y, { deco: fl[i], col: r.pick(['#7b6cf6', '#2a9d8f', '#e63946', '#1982c4']) }, { foot: [64, 26] });
        S.lights.push({ x, y: y - 50 * f.s, r: 120 * f.s, col: '#ffd9a0' });
        pushSpot(S, 'float', () => champOn(api, f.x + r.range(-40, 40) * f.s, f.y - 28 * f.s, f.y + 0.5, 'peek'));
        // a small band marching ahead of each float
        for (let k = 0; k < 6; k++) {
          const bx = x + (k % 3 - 1) * 40 * f.s, by = y + 70 + Math.floor(k / 3) * 46;
          const p = SC.ART.randPerson(r, 'winter', { kid: false, pose: k % 3 === 1 ? 'stand' : 'drum', top: 'band', tc: r.pick(['#e63946', '#1982c4', '#2a9d8f']), hat: 'shako', hatc: '#1d2b5a', hatc2: '#ffffff', bottom: 'pants', bc: '#1d1d24', scarf: null, hold: k % 3 === 1 ? 'flag' : 'none', flagc: '#ffd23f', armAnim: 'wave', drumc: '#ffffff', bag: 'none' });
          api.add('person', p, bx, by, { banim: 'bob', role: 'crowd', foot: [11, 7] }).fixed = true;
        }
      });
      // light trees, lamps, cocoa stands, yard inflatables on the sides
      for (const side of [0, 1]) {
        for (let y = 760; y < 2340; y += r.range(260, 340)) {
          const x = side ? r.range(1480, 1920) : r.range(80, 520), k = r.pick(['pine', 'lamp', 'stand', 'inflatables', 'pine', 'lamp']);
          if (k === 'pine') { const p = api.prop('pine', x, y, { k: r.range(0.9, 1.15) }, { foot: [24, 10] }); S.lights.push({ x, y: y - 50 * p.s, r: 70 * p.s, col: '#ffe0a0' }); S.chuckSpots.push(() => chuckNear(api, p, r.pick([-1, 1]), true)); }
          else if (k === 'lamp') { const l = api.prop('lamp', x, y, { night: true, wreath: true }, { foot: [7, 5] }); S.lights.push({ x, y: y - 100 * l.s, r: 90 * l.s, col: '#ffe9a6' }); }
          else if (k === 'stand') { const st = api.stall(x, y, { w: 66, c1: r.pick(['#2a9d8f', '#7b6cf6', '#1982c4', '#e9a23b']), c2: '#f2efe4', goods: 'cocoa', sign: r.pick(['COCOA', 'CIDER', 'DONUTS']) }, SC.ART.randPerson(r, 'winter', { kid: false, armAnim: 'wave', hold: 'none' })); S.lights.push({ x, y: y - 40 * st.s, r: 80 * st.s, col: '#ffd59a' }); pushSpot(S, 'stall', () => champOn(api, st.x + r.range(-14, 14) * st.s, st.y - 20 * st.s, st.y + 0.5, 'peek')); }
          else { const ks = ['snowman', 'penguin', 'tree']; for (let i = 0; i < 3; i++) { const ix = x + (i - 1) * 36 * api.scale(y), iy = y + (i % 2) * 10; const inf = api.prop('inflatable', ix, iy, { k: ks[i] }, { foot: [16, 8] }); if (i === 1) pushSpot(S, 'inflatables', () => champOn(api, inf.x + 26 * inf.s, inf.y - 0.5 * inf.s, inf.y + 0.5, 'peek')); } }
        }
      }
      S.zones.push({ x0: 40, y0: 660, x1: 600, y1: 2380, w: 1 });
      S.zones.push({ x0: 1400, y0: 660, x1: 1960, y1: 2380, w: 1 });
      S.zones.push({ x0: 700, y0: 660, x1: 1300, y1: 2380, w: 0.25, kind: 'road', road: true });
    },
    crowd(r, S, z) {
      if (z.kind === 'road') { const p = SC.ART.randPerson(r, 'winter', { kid: false, hold: 'lantern', armAnim: 'wave', with: null, balloon: false }); return { kind: 'person', spec: p, banim: 'bob', foot: [11, 7] }; }
      return commonPerson(r, 'winter', z);
    },
  };

  SC.THEMES = THEMES;
  SC.THEME_ORDER = ['festival', 'market', 'beach', 'marathon', 'winter'];
})(typeof window !== 'undefined' ? window : globalThis);
