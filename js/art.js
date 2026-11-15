/* Spot Champ — code-drawn art for characters, critters, targets and small items.
   Every drawable is a "kind": { parts(spec) -> [{name,b:[x0,y0,x1,y1],pv:[x,y],anim}], draw(ctx,spec,part), shape(spec) -> hit shapes }.
   Local units: origin at the feet / ground contact point, y up is negative. A grown-up is ~60 units tall.
   Painted art can replace any part later through SC.ASSETS (see IMAGE-PROMPTS.md). */
(function (root) {
  'use strict';
  const SC = root.SC;
  const { TAU, shade } = SC;

  const OUT = '#2b2140';
  const SHADE = 'rgba(43,25,70,0.22)';
  const HILITE = 'rgba(255,255,255,0.26)';
  const LW = 1.25;

  // ---------------------------------------------------------------- palettes
  const PAL = {
    skin: ['#fde0cb', '#f5c9a6', '#e7ae85', '#c98d62', '#a46a43', '#7a4b2e', '#5a3622'],
    hair: ['#2a1b14', '#47291a', '#6e4122', '#9c6532', '#d9a95a', '#ecd9a0', '#cfcac2', '#8a8a8a', '#1c1c22', '#a8452c'],
    tops: ['#ff6f61', '#ff9f43', '#ffd23f', '#7bd389', '#3ec1d3', '#4d96ff', '#7b6cf6', '#c77dff', '#ff7eb6', '#ffffff', '#3d3b4f', '#f2efe4', '#1fab89', '#e85d75', '#9ad0ec', '#ffb4a2', '#b5e48c', '#ffe8a3', '#5c6bc0', '#f4a261'],
    bottoms: ['#3d5a80', '#4a6fa5', '#2f3e57', '#c8b28a', '#a89070', '#3b3b46', '#6b705c', '#e9d8a6', '#7d8597', '#5e548e', '#22333b'],
    shoes: ['#2b2b33', '#f2f2f2', '#d64545', '#3d5a80', '#8d6e63', '#fdcb6e', '#7bd389', '#ffffff'],
    coats: ['#e63946', '#2a9d8f', '#264653', '#e9c46a', '#f4a261', '#6a4c93', '#1982c4', '#8ac926', '#ff595e', '#3d405b', '#ffca3a', '#ef476f', '#118ab2'],
    dogs: ['#c48a4a', '#3a2c26', '#f3ead8', '#e0b25c', '#8a5a35', '#6f6f78', '#d9c3a0'],
  };
  // signature colours reserved for the leaf peeper (decoys borrow some on purpose)
  const PEEP = { vest: '#ff7a1a', hat: '#17b3a3', shirt: '#2f8f4e', shorts: '#c8b28a' };
  const CH = { body: '#2fae9b', light: '#7fdcc0', belly: '#d2f0c8', fin: '#1d7f78', cheek: '#ff9fb2' };

  // ---------------------------------------------------------------- helpers
  function rr(c, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function ell(c, x, y, rx, ry, rot) { c.moveTo(x + rx * Math.cos(rot || 0), y + rx * Math.sin(rot || 0)); c.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), rot || 0, 0, TAU); }
  function circ(c, x, y, r) { c.moveTo(x + r, y); c.arc(x, y, Math.max(0.05, r), 0, TAU); }
  // fill a path, add a soft rim shade (bottom-right) and highlight (top-left), then outline
  function paint(c, path, fill, o) {
    o = o || {};
    c.beginPath(); path(); c.fillStyle = fill; c.fill();
    if (o.detail) { c.save(); c.beginPath(); path(); c.clip(); o.detail(); c.restore(); }
    if (o.shade !== false) {
      const k = o.k || 1;
      c.save(); c.beginPath(); path(); c.clip();
      c.beginPath(); c.save(); c.translate(-2.0 * k, -1.7 * k); path(); c.restore(); c.rect(-1e4, -1e4, 2e4, 2e4);
      c.fillStyle = SHADE; c.fill('evenodd');
      c.beginPath(); c.save(); c.translate(1.5 * k, 1.5 * k); path(); c.restore(); c.rect(-1e4, -1e4, 2e4, 2e4);
      c.fillStyle = HILITE; c.fill('evenodd');
      c.restore();
    }
    if (o.line !== false) { c.beginPath(); path(); c.lineWidth = o.lw || LW; c.strokeStyle = o.stroke || OUT; c.lineJoin = 'round'; c.stroke(); }
  }
  function shadow(c, rx, ry, x) { c.fillStyle = 'rgba(30,18,50,0.20)'; c.beginPath(); ell(c, x || 0, 0, rx, ry || rx * 0.3); c.fill(); }
  function line(c, pts, w, col, cap) {
    c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.lineWidth = w; c.strokeStyle = col || OUT; c.lineCap = cap || 'round'; c.lineJoin = 'round'; c.stroke();
  }
  function dot(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); circ(c, x, y, r); c.fill(); }

  // ================================================================ PEOPLE
  function pdims(p) {
    const k = p.kid ? 0.66 : 1, h = p.h || 1, w = p.w || 1;
    const legH = 24 * h * k, torsoH = 18 * h * k * (p.kid ? 1.06 : 1);
    let hipY = -legH, shY = -(legH + torsoH);
    const hr = p.kid ? 6.4 : 7.4;
    const tw = 7.4 * w * k + (p.kid ? 0.8 : 0), hw = tw * 0.93;
    const legW = (3.1 * Math.min(1.25, w) + 0.3) * k + 0.3, legGap = tw * 0.44;
    const lift = p.pose === 'sit' ? legH - 12 * k : p.pose === 'unicycle' ? -14 : 0; // sit lowers the body, unicycle raises it
    hipY += lift; shY += lift;
    const headY = shY - 1.6 - hr * 0.95;
    return { k, h, w, legH, torsoH, hipY, shY, hr, headY, tw, hw, legW, legGap, lift, armL: hipY + 1 - (shY + 2) };
  }
  function hatTop(p, d) {
    const hx = { cap: 1, bucket: 3, beanie: 3.6, sun: 1.5, band: 0, visor: 0, earmuffs: 1, cow: 4, dino: 5, shako: 13, none: 0 };
    let t = d.headY - d.hr - (hx[p.hat || 'none'] || 0);
    if (p.hair === 'bun' && (!p.hat || p.hat === 'none' || p.hat === 'band')) t -= 4;
    return t;
  }
  function sleeveCol(p) { return p.top === 'vest' ? p.tc2 : p.top === 'cow' ? '#ffffff' : p.top === 'swim' || p.top === 'tank' || p.top === 'jersey' ? null : p.tc; }

  function legs(c, p, d) {
    const L = d.legW, y0 = d.hipY + 1, y1 = -1.4;
    const full = p.bottom === 'pants' || p.bottom === 'snow' || p.bottom === 'cow';
    if (p.pose === 'sit') {
      // thighs toward the viewer + shins down
      for (const s of [-1, 1]) {
        const x = s * d.legGap;
        paint(c, () => rr(c, x - L, y0 - 1, 2 * L, y1 - y0 + 1, L * 0.8), full || p.bottom === 'leggings' ? p.bc : p.skin, { k: 0.6 });
        if (p.socks) { c.fillStyle = p.socks; c.fillRect(x - L + 0.4, y1 - 4.5, 2 * L - 0.8, 3.4); }
      }
      paint(c, () => rr(c, -d.hw - 0.5, y0 - 3.5, 2 * d.hw + 1, 6.5, 3), p.bottom === 'skirt' || p.bottom === 'dress' ? p.bc : (p.bottom === 'shorts' || p.bottom === 'trunks' ? p.bc : (full || p.bottom === 'leggings' ? p.bc : p.bc)), { k: 0.7 });
    } else {
      for (const s of [-1, 1]) {
        const x = s * d.legGap;
        let top = y0, bot = y1;
        if (p.pose === 'run' && s > 0) bot = y1 - 5;
        if (p.pose === 'unicycle') { bot = y1 - 4 + (s > 0 ? -3 : 0); }
        paint(c, () => rr(c, x - L, top, 2 * L, bot - top, L * 0.8), full ? p.bc : p.skin, { k: 0.6 });
        if (p.bottom === 'shorts' || p.bottom === 'trunks') { const f = p.bottom === 'trunks' ? 0.28 : 0.46; paint(c, () => rr(c, x - L - 0.4, top, 2 * L + 0.8, (bot - top) * f, 1.2), p.bc, { k: 0.6 }); }
        if (p.bottom === 'leggings') paint(c, () => rr(c, x - L, top, 2 * L, (bot - top) * 0.72, L * 0.8), p.bc, { k: 0.6 });
        if (p.bottom === 'cow') { dot(c, x + s * 0.5, top + (bot - top) * 0.5, 1.6, '#2b2b33'); }
        if (p.socks) { c.fillStyle = p.socks; c.fillRect(x - L + 0.3, bot - 6, 2 * L - 0.6, 4.6); c.strokeStyle = OUT; c.lineWidth = 0.6; c.strokeRect(x - L + 0.3, bot - 6, 2 * L - 0.6, 4.6); }
        paint(c, () => ell(c, x + s * 0.8, bot + 0.2, L + 1.4, 2.3), p.shoe, { k: 0.5 });
      }
    }
    if (p.bottom === 'skirt' || p.bottom === 'dress') {
      const yb = d.hipY + (y1 - y0) * (p.pose === 'sit' ? 0.2 : 0.5);
      paint(c, () => { c.moveTo(-d.hw + 0.5, d.hipY - 1); c.lineTo(d.hw - 0.5, d.hipY - 1); c.lineTo(d.hw + 3.2, yb); c.quadraticCurveTo(0, yb + 2, -d.hw - 3.2, yb); c.closePath(); }, p.bc, { k: 0.8 });
    }
  }
  function torsoPath(c, d) {
    const t = d.tw, h = d.hw, y0 = d.shY, y1 = d.hipY + 2.5;
    c.moveTo(-t + 2.4, y0); c.lineTo(t - 2.4, y0); c.quadraticCurveTo(t, y0, t, y0 + 2.6); c.lineTo(h, y1 - 2);
    c.quadraticCurveTo(h, y1, h - 2, y1); c.lineTo(-h + 2, y1); c.quadraticCurveTo(-h, y1, -h, y1 - 2); c.lineTo(-t, y0 + 2.6); c.quadraticCurveTo(-t, y0, -t + 2.4, y0); c.closePath();
  }
  function torso(c, p, d) {
    const st = p.top, y0 = d.shY, y1 = d.hipY + 2.5, t = d.tw;
    let base = p.tc;
    if (st === 'vest' || st === 'plaidvest') base = p.tc2;
    if (st === 'swim') base = p.skin;
    if (st === 'cow') base = '#ffffff';
    if (p.bottom === 'dress') base = p.bc;
    const detail = () => {
      if (st === 'stripe') { c.fillStyle = p.tc2; for (let y = y0 + 2; y < y1; y += 4.2) c.fillRect(-t - 1, y, 2 * t + 2, 1.9); }
      else if (st === 'two') { c.fillStyle = p.tc2; c.fillRect(-t - 1, (y0 + y1) / 2, 2 * t + 2, 30); }
      else if (st === 'plaid' || st === 'plaidvest') {
        c.strokeStyle = 'rgba(20,40,20,0.45)'; c.lineWidth = 0.9;
        for (let x = -t; x < t; x += 3.4) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); }
        for (let y = y0 + 1; y < y1; y += 3.4) { c.beginPath(); c.moveTo(-t, y); c.lineTo(t, y); c.stroke(); }
      } else if (st === 'coat') {
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.9;
        for (let y = y0 + 4; y < y1 - 1; y += 4) { c.beginPath(); c.moveTo(-t, y); c.quadraticCurveTo(0, y + 1.2, t, y); c.stroke(); }
        line(c, [0, y0 + 2, 0, y1], 0.8, 'rgba(40,30,60,0.5)');
      } else if (st === 'hoodie') {
        paint(c, () => rr(c, -t * 0.55, y1 - 7, t * 1.1, 4.5, 1.5), shade(p.tc, -0.12), { shade: false, lw: 0.7 });
        line(c, [-1.8, y0 + 1, -2.2, y0 + 7], 0.7, '#fff'); line(c, [1.8, y0 + 1, 2.2, y0 + 7], 0.7, '#fff');
      } else if (st === 'jersey') {
        c.fillStyle = '#ffffff'; c.fillRect(-t * 0.62, y0 + 5, t * 1.24, 7.5);
        c.strokeStyle = OUT; c.lineWidth = 0.6; c.strokeRect(-t * 0.62, y0 + 5, t * 1.24, 7.5);
        c.fillStyle = '#222'; c.font = '700 5.2px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(p.num || 7), 0, y0 + 8.9);
      } else if (st === 'swim' && p.swimTop) {
        c.fillStyle = p.swimTop; c.fillRect(-t, y0 + 4, 2 * t, 4.2);
      } else if (st === 'cow') {
        c.fillStyle = '#2b2b33'; ell(c, -3, y0 + 6, 3.2, 2.4, 0.4); c.fill(); c.beginPath(); ell(c, 4, y1 - 5, 3.4, 2.6, -0.3); c.fill();
        c.beginPath(); ell(c, t - 1, y0 + 3, 2, 1.6); c.fill();
      } else if (st === 'band') {
        line(c, [-t, y0 + 1, t, y1 - 2], 1.6, '#f8f1d8', 'butt'); line(c, [t, y0 + 1, -t, y1 - 2], 1.6, '#f8f1d8', 'butt');
        for (let i = 0; i < 3; i++) dot(c, 0, y0 + 4 + i * 4, 0.8, '#ffd23f');
      } else if (st === 'tank') {
        c.fillStyle = p.skin; c.beginPath(); c.moveTo(-t - 1, y0 - 1); c.lineTo(-t * 0.45, y0 - 1); c.lineTo(-t - 1, y0 + 6); c.fill();
        c.beginPath(); c.moveTo(t + 1, y0 - 1); c.lineTo(t * 0.45, y0 - 1); c.lineTo(t + 1, y0 + 6); c.fill();
      }
      if (st === 'vest' || st === 'plaidvest') {
        c.fillStyle = p.tc; c.fillRect(-t - 1, y0 - 1, t * 0.78 + 1, 40); c.fillRect(t * 0.22, y0 - 1, t * 0.78 + 1, 40);
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.8;
        for (let y = y0 + 4; y < y1; y += 4) { c.beginPath(); c.moveTo(-t, y); c.lineTo(-t * 0.22, y); c.moveTo(t * 0.22, y); c.lineTo(t, y); c.stroke(); }
        line(c, [-t * 0.22, y0, -t * 0.22, y1], 0.7, OUT); line(c, [t * 0.22, y0, t * 0.22, y1], 0.7, OUT);
      }
      // collar / neckline
      if (st !== 'swim' && st !== 'coat') { c.fillStyle = p.skin; c.beginPath(); c.moveTo(-2.6, y0 - 0.5); c.quadraticCurveTo(0, y0 + 3.4, 2.6, y0 - 0.5); c.fill(); }
      if (p.scarf) { paint(c, () => rr(c, -t + 0.5, y0 - 1.5, 2 * t - 1, 3.6, 1.5), p.scarf, { shade: false, lw: 0.8 }); paint(c, () => rr(c, t * 0.25, y0 + 1, 3, 9, 1.2), p.scarf, { shade: false, lw: 0.8 }); }
    };
    paint(c, () => torsoPath(c, d), base, { detail, k: 1.1 });
    if (p.medal) { line(c, [-2.6, y0, 0, y0 + 7, 2.6, y0], 1.1, '#4d96ff'); paint(c, () => circ(c, 0, y0 + 8.4, 2.2), '#f5c518', { shade: false, lw: 0.7 }); }
    if (p.camera) camera(c, 0, y0 + 9, p.kid ? 0.8 : 1);
  }
  function camera(c, x, y, k) {
    line(c, [x - 4.2 * k, y - 9 * k, x - 3.6 * k, y - 1], 0.8, '#1f1f26'); line(c, [x + 4.2 * k, y - 9 * k, x + 3.6 * k, y - 1], 0.8, '#1f1f26');
    paint(c, () => rr(c, x - 4.6 * k, y - 2.4 * k, 9.2 * k, 5.8 * k, 1.2), '#2a2a33', { k: 0.4, lw: 0.8 });
    paint(c, () => circ(c, x + 0.6 * k, y + 0.6 * k, 2.3 * k), '#5f6b7a', { k: 0.3, lw: 0.7 });
    dot(c, x + 0.1 * k, y + 0.1 * k, 0.8 * k, '#cfe3ff'); dot(c, x - 3.2 * k, y - 1.5 * k, 0.6 * k, '#ff6b6b');
  }
  // an arm hanging from (sx,sy), rotated by a (radians, 0 = straight down)
  function arm(c, p, d, sx, sy, a, len) {
    const sc = sleeveCol(p), w = p.kid ? 1.8 : 2.15 * Math.min(1.2, p.w || 1);
    len = len || d.armL;
    c.save(); c.translate(sx, sy); c.rotate(a);
    const sl = p.sleeve === 'long' || p.top === 'coat' || p.top === 'cow' || p.top === 'hoodie' || p.top === 'band' ? 0.95 : 0.42;
    paint(c, () => rr(c, -w, -1, 2 * w, len + 1, w), p.skin, { k: 0.5 });
    if (sc) paint(c, () => rr(c, -w - 0.4, -1.4, 2 * w + 0.8, len * sl + 1.2, w), sc, { k: 0.5 });
    paint(c, () => circ(c, 0, len, w + 0.2), p.mitts || p.skin, { k: 0.4, lw: 1 });
    c.restore();
  }
  function handPos(d, sx, sy, a, len) { len = len || d.armL; return [sx - Math.sin(a) * len, sy + Math.cos(a) * len]; }

  function hairBack(c, p, d) {
    const y = d.headY, r = d.hr;
    if (p.hair === 'long') paint(c, () => rr(c, -r - 1.6, y - r * 0.3, 2 * r + 3.2, r * 2.7, r), p.hc, { k: 0.6 });
    if (p.top === 'hoodie' && p.hat !== 'dino') paint(c, () => ell(c, 0, d.shY - 1, r + 3, 4), shade(p.tc, -0.15), { shade: false });
    if (p.catpack) { // cat peeking over the shoulder from the backpack
      const cx = -d.tw - 1.5, cy = d.shY - 3;
      const fur = '#f0a04b';
      paint(c, () => { c.moveTo(cx - 4.5, cy - 2); c.lineTo(cx - 4.2, cy - 8); c.lineTo(cx - 1.2, cy - 4.6); c.closePath(); c.moveTo(cx + 4.5, cy - 2); c.lineTo(cx + 4.2, cy - 8); c.lineTo(cx + 1.2, cy - 4.6); c.closePath(); }, fur, { shade: false, lw: 0.9 });
      paint(c, () => ell(c, cx, cy - 1.2, 5.2, 4.4), fur, { k: 0.6 });
      c.strokeStyle = '#c86b1c'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(cx - 1.5, cy - 5.4); c.lineTo(cx - 1.2, cy - 3.6); c.moveTo(cx + 1.5, cy - 5.4); c.lineTo(cx + 1.2, cy - 3.6); c.stroke();
      dot(c, cx - 1.9, cy - 1.4, 0.8, '#2b2140'); dot(c, cx + 1.9, cy - 1.4, 0.8, '#2b2140'); dot(c, cx, cy + 0.4, 0.6, '#ff8fa3');
      line(c, [cx - 3, cy + 0.5, cx - 6.5, cy - 0.3], 0.4, '#fff'); line(c, [cx + 3, cy + 0.5, cx + 6.5, cy - 0.3], 0.4, '#fff');
    }
  }
  function bagBack(c, p, d) {
    if (p.bag === 'backpack' || p.catpack) {
      const col = p.catpack ? '#3d5a80' : p.bagc;
      paint(c, () => rr(c, -d.tw - 2.6, d.shY + 1, 4, d.torsoH * 0.8, 1.5), col, { k: 0.5, lw: 1 });
    }
  }
  function bagFront(c, p, d) {
    const t = d.tw;
    if (p.bag === 'backpack' || p.catpack) { line(c, [-t * 0.55, d.shY, -t * 0.62, d.hipY + 1], 1.4, p.catpack ? '#2c4460' : shade(p.bagc, -0.25)); line(c, [t * 0.55, d.shY, t * 0.62, d.hipY + 1], 1.4, p.catpack ? '#2c4460' : shade(p.bagc, -0.25)); }
    if (p.bag === 'tote') { line(c, [t * 0.5, d.shY, -t - 1.5, d.hipY - 2], 0.9, shade(p.bagc, -0.3)); paint(c, () => rr(c, -t - 5.5, d.hipY - 3, 7, 7.5, 1), p.bagc, { k: 0.6, lw: 1 }); }
    if (p.bag === 'purse') { line(c, [-t * 0.4, d.shY, t + 1.5, d.hipY - 3], 0.7, OUT); paint(c, () => rr(c, t - 1, d.hipY - 4, 5.2, 4, 1.2), p.bagc, { k: 0.4, lw: 0.9 }); }
  }
  function head(c, p, d) {
    const y = d.headY, r = d.hr;
    c.fillStyle = shade(p.skin, -0.14); c.fillRect(-1.8, y + r * 0.6, 3.6, d.shY - (y + r * 0.6) + 1.4);
    paint(c, () => { ell(c, -r + 0.2, y + 0.8, 1.6, 2.1); ell(c, r - 0.2, y + 0.8, 1.6, 2.1); }, p.skin, { shade: false, lw: 1 });
    paint(c, () => circ(c, 0, y, r), p.skin, { k: 0.7 });
    if (p.beard) paint(c, () => { c.moveTo(-r + 0.6, y + 0.5); c.quadraticCurveTo(-r + 1, y + r + 1.5, 0, y + r + 1.4); c.quadraticCurveTo(r - 1, y + r + 1.5, r - 0.6, y + 0.5); c.quadraticCurveTo(0, y + 3.6, -r + 0.6, y + 0.5); c.closePath(); }, p.hc, { shade: false, lw: 0.9 });
    // face
    if (p.shades) { paint(c, () => { rr(c, -r + 1.2, y - 1, r - 1.6, 2.8, 1); rr(c, 0.4, y - 1, r - 1.6, 2.8, 1); }, '#1d1d28', { shade: false, lw: 0.6 }); line(c, [-0.5, y - 0.2, 0.5, y - 0.2], 0.6, '#1d1d28'); }
    else { dot(c, -2.5, y + 0.4, 0.95, '#2b2140'); dot(c, 2.5, y + 0.4, 0.95, '#2b2140'); dot(c, -2.2, y + 0.1, 0.32, '#fff'); dot(c, 2.8, y + 0.1, 0.32, '#fff'); }
    if (p.glasses && !p.shades) { c.strokeStyle = '#2b2140'; c.lineWidth = 0.6; c.beginPath(); circ(c, -2.5, y + 0.4, 1.7); circ(c, 2.5, y + 0.4, 1.7); c.stroke(); }
    if (!p.beard) { c.beginPath(); c.arc(0, y + 2.3, 1.9, 0.18 * Math.PI, 0.82 * Math.PI); c.lineWidth = 0.75; c.strokeStyle = '#2b2140'; c.lineCap = 'round'; c.stroke(); }
    c.globalAlpha = 0.35; dot(c, -4.3, y + 2.4, 1.3, '#ff7c8f'); dot(c, 4.3, y + 2.4, 1.3, '#ff7c8f'); c.globalAlpha = 1;
    hairFront(c, p, d); hat(c, p, d);
  }
  function hairFront(c, p, d) {
    const y = d.headY, r = d.hr, hs = p.hair;
    if (p.hat === 'cow' || p.hat === 'dino') return;
    if (hs === 'bald') { paint(c, () => { ell(c, -r + 1, y - 1, 1.5, 2.6); ell(c, r - 1, y - 1, 1.5, 2.6); }, p.hc, { shade: false, lw: 0.6 }); return; }
    const cap = () => { c.moveTo(-r - 0.5, y + 0.4); c.arc(0, y, r + 0.55, Math.PI * 1.02, Math.PI * 1.98); c.quadraticCurveTo(r * 0.3, y - r * 0.55, -r * 0.1, y - r * 0.4); c.quadraticCurveTo(-r * 0.6, y - r * 0.2, -r - 0.5, y + 0.4); c.closePath(); };
    if (hs === 'curly') { paint(c, () => { for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.0 + i / 6); circ(c, Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.9 - 0.4, r * 0.42); } }, p.hc, { k: 0.4 }); return; }
    if (hs === 'buzz') { paint(c, () => { c.moveTo(-r + 0.2, y - 1); c.arc(0, y, r + 0.1, Math.PI * 1.08, Math.PI * 1.92); c.quadraticCurveTo(0, y - r * 0.55, -r + 0.2, y - 1); c.closePath(); }, p.hc, { shade: false, lw: 0.8 }); return; }
    if (hs === 'pony') paint(c, () => ell(c, r + 1.6, y + 1.5, 1.9, 4.4, 0.25), p.hc, { k: 0.4 });
    if (hs === 'long') paint(c, () => { rr(c, -r - 1.3, y - 2, 2.6, r + 4, 1.2); rr(c, r - 1.3, y - 2, 2.6, r + 4, 1.2); }, p.hc, { shade: false, lw: 0.9 });
    paint(c, cap, p.hc, { k: 0.5 });
    if (hs === 'bun' && (!p.hat || p.hat === 'none' || p.hat === 'band')) paint(c, () => circ(c, 0, y - r - 1.5, 2.8), p.hc, { k: 0.4 });
  }
  function hat(c, p, d) {
    const y = d.headY, r = d.hr, hc = p.hatc, h = p.hat;
    if (!h || h === 'none') return;
    if (h === 'cap') { paint(c, () => { c.moveTo(-r - 0.6, y - 1.2); c.arc(0, y - 1.2, r + 0.6, Math.PI, TAU); c.closePath(); }, hc, { k: 0.6 }); paint(c, () => ell(c, 1, y - 1.3, r + 2.6, 1.7), shade(hc, -0.18), { shade: false, lw: 1 }); }
    else if (h === 'bucket') { paint(c, () => { c.moveTo(-r + 0.4, y - 2.2); c.lineTo(-r + 1.6, y - r - 2.8); c.quadraticCurveTo(0, y - r - 4, r - 1.6, y - r - 2.8); c.lineTo(r - 0.4, y - 2.2); c.closePath(); }, hc, { k: 0.6 }); paint(c, () => ell(c, 0, y - 2.2, r + 3.4, 2.3), shade(hc, -0.1), { k: 0.4 }); if (p.leafpin) { leaf(c, r - 2.6, y - 4.6, 1.6, '#e8572a'); } }
    else if (h === 'beanie') { paint(c, () => { c.moveTo(-r - 0.8, y - 1); c.arc(0, y - 1, r + 0.8, Math.PI, TAU); c.closePath(); }, hc, { k: 0.6 }); paint(c, () => rr(c, -r - 1, y - 2.6, 2 * r + 2, 3, 1.2), shade(hc, -0.15), { shade: false, lw: 1 }); if (p.pom) paint(c, () => circ(c, 0, y - r - 2.1, 2.1), p.pom, { k: 0.4, lw: 1 }); }
    else if (h === 'sun') { paint(c, () => ell(c, 0, y - 2.4, r + 6, 2.7), hc, { k: 0.5 }); paint(c, () => { c.moveTo(-r * 0.8, y - 2.6); c.arc(0, y - 2.6, r * 0.8, Math.PI, TAU); c.closePath(); }, hc, { k: 0.5 }); c.fillStyle = p.hatc2 || '#ff6f61'; c.fillRect(-r * 0.8, y - 4.4, r * 1.6, 1.6); }
    else if (h === 'band' || h === 'visor') { paint(c, () => rr(c, -r - 0.3, y - r * 0.62, 2 * r + 0.6, 2.2, 1), hc, { shade: false, lw: 0.8 }); if (h === 'visor') paint(c, () => ell(c, 0, y - r * 0.45, r + 1.5, 1.4), shade(hc, -0.15), { shade: false, lw: 0.8 }); }
    else if (h === 'earmuffs') { line(c, [-r, y - 1, -r * 0.5, y - r - 1.2, r * 0.5, y - r - 1.2, r, y - 1], 1.3, '#555'); paint(c, () => { circ(c, -r - 0.4, y + 0.6, 2.6); circ(c, r + 0.4, y + 0.6, 2.6); }, hc, { k: 0.4, lw: 1 }); }
    else if (h === 'cow') {
      paint(c, () => { c.moveTo(-r - 1.6, y + 3); c.arc(0, y - 0.5, r + 1.6, Math.PI * 0.93, Math.PI * 2.07); c.closePath(); }, '#ffffff', { k: 0.6, detail: () => { dot(c, -3, y - r + 1, 2.4, '#2b2b33'); dot(c, r, y - 2, 1.8, '#2b2b33'); } });
      paint(c, () => { ell(c, -r - 3.2, y - 2.5, 2.8, 1.4, -0.4); ell(c, r + 3.2, y - 2.5, 2.8, 1.4, 0.4); }, '#ffffff', { shade: false, lw: 0.9 });
      paint(c, () => { c.moveTo(-3.6, y - r - 0.6); c.lineTo(-4.6, y - r - 4); c.lineTo(-2.2, y - r - 1); c.closePath(); c.moveTo(3.6, y - r - 0.6); c.lineTo(4.6, y - r - 4); c.lineTo(2.2, y - r - 1); c.closePath(); }, '#f3dfb0', { shade: false, lw: 0.8 });
      // face opening
      paint(c, () => ell(c, 0, y + 1.2, r * 0.78, r * 0.7), p.skin, { shade: false, lw: 0.8 });
      dot(c, -2.3, y + 0.6, 0.9, '#2b2140'); dot(c, 2.3, y + 0.6, 0.9, '#2b2140');
      paint(c, () => ell(c, 0, y + 4.4, 3.4, 1.9), '#ffaec0', { shade: false, lw: 0.7 }); dot(c, -1.2, y + 4.4, 0.4, '#a0526a'); dot(c, 1.2, y + 4.4, 0.4, '#a0526a');
    } else if (h === 'dino') {
      const g = '#4caf50';
      paint(c, () => { for (let i = 0; i < 4; i++) { const x = -4.5 + i * 3; c.moveTo(x - 1.5, y - r + 0.6 - Math.abs(x) * 0.2); c.lineTo(x, y - r - 3.6 - Math.abs(x) * 0.1); c.lineTo(x + 1.5, y - r + 0.6 - Math.abs(x) * 0.2); c.closePath(); } }, '#ffd23f', { shade: false, lw: 0.8 });
      paint(c, () => { c.moveTo(-r - 1.6, y + 3); c.arc(0, y - 0.5, r + 1.6, Math.PI * 0.93, Math.PI * 2.07); c.closePath(); }, g, { k: 0.6 });
      paint(c, () => ell(c, 0, y + 1.4, r * 0.76, r * 0.66), p.skin, { shade: false, lw: 0.8 });
      c.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 2 - 0.9, y - r * 0.55 + 1.5); c.lineTo(i * 2, y - r * 0.55 + 3.3); c.lineTo(i * 2 + 0.9, y - r * 0.55 + 1.5); c.fill(); }
      dot(c, -2.3, y + 1, 0.9, '#2b2140'); dot(c, 2.3, y + 1, 0.9, '#2b2140');
      c.beginPath(); c.arc(0, y + 3.2, 1.6, 0.2 * Math.PI, 0.8 * Math.PI); c.strokeStyle = '#2b2140'; c.lineWidth = 0.7; c.stroke();
    } else if (h === 'shako') {
      paint(c, () => rr(c, -r + 0.6, y - r - 10, 2 * r - 1.2, 11.5, 1.5), hc, { k: 0.6, detail: () => { c.fillStyle = '#ffd23f'; c.fillRect(-r, y - r - 1.6, 2 * r, 1.4); } });
      paint(c, () => ell(c, 0, y - r - 12, 2, 3.4), p.hatc2 || '#fff', { shade: false, lw: 0.8 });
      paint(c, () => ell(c, 0, y - 0.6, r + 1.2, 1.4), '#222', { shade: false, lw: 0.6 });
    }
  }
  function leaf(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s / 4, s / 4);
    c.beginPath(); c.moveTo(0, -4); c.lineTo(1, -1.6); c.lineTo(3.6, -2.6); c.lineTo(2.6, 0); c.lineTo(4, 0.8); c.lineTo(1, 1.4); c.lineTo(0.6, 3.6); c.lineTo(0, 2.4); c.lineTo(-0.6, 3.6); c.lineTo(-1, 1.4); c.lineTo(-4, 0.8); c.lineTo(-2.6, 0); c.lineTo(-3.6, -2.6); c.lineTo(-1, -1.6); c.closePath();
    c.fillStyle = col; c.fill(); c.lineWidth = 0.5 * 4 / s; c.strokeStyle = OUT; c.stroke(); c.restore();
  }
  function heldItem(c, p, hx, hy) {
    const it = p.hold;
    if (it === 'phone') paint(c, () => rr(c, hx - 1.4, hy - 2.6, 2.8, 4.4, 0.6), '#22222b', { shade: false, lw: 0.6 });
    else if (it === 'creemee') { paint(c, () => { c.moveTo(hx - 2.4, hy - 2); c.lineTo(hx + 2.4, hy - 2); c.lineTo(hx, hy + 4.5); c.closePath(); }, '#e0a35c', { shade: false, lw: 0.7 }); paint(c, () => { ell(c, hx, hy - 3.2, 2.7, 1.9); ell(c, hx, hy - 5.2, 1.9, 1.5); ell(c, hx + 0.3, hy - 6.6, 1, 1); }, '#f3d9a4', { k: 0.3, lw: 0.7 }); }
    else if (it === 'cup') paint(c, () => rr(c, hx - 1.8, hy - 3, 3.6, 4.6, 0.8), p.cupc || '#ffffff', { shade: false, lw: 0.6, detail: () => { c.fillStyle = '#8d5a3b'; c.fillRect(hx - 2, hy - 1.6, 4, 1.4); } });
    else if (it === 'shopbag') { paint(c, () => rr(c, hx - 3.4, hy - 1, 6.8, 7.6, 0.8), '#d8b98a', { k: 0.4, lw: 0.8 }); dot(c, hx - 1.2, hy - 1.2, 1.4, '#e63946'); dot(c, hx + 1.2, hy - 1.5, 1.3, '#7bd389'); c.fillStyle = '#ffa94d'; c.fillRect(hx + 0.4, hy - 3.4, 0.8, 3); }
    else if (it === 'flag') { line(c, [hx, hy - 1, hx, hy + 14], 0.8, '#6e4122'); paint(c, () => { c.moveTo(hx, hy + 6); c.lineTo(hx + 7, hy + 9.5); c.lineTo(hx, hy + 13); c.closePath(); }, p.flagc || '#4d96ff', { shade: false, lw: 0.7 }); }
    else if (it === 'lantern') { line(c, [hx, hy - 1, hx, hy + 8], 0.8, '#3b3b46'); c.fillStyle = 'rgba(255,214,120,0.35)'; c.beginPath(); circ(c, hx, hy + 11, 5.5); c.fill(); paint(c, () => ell(c, hx, hy + 11, 3, 3.8), p.lanc || '#ffd166', { shade: false, lw: 0.7, detail: () => { dot(c, hx - 0.6, hy + 10, 1.4, '#fffbe0'); } }); }
    else if (it === 'leash') { /* drawn by the dog */ }
  }

  function personBody(c, p) {
    const d = pdims(p);
    shadow(c, 10 * (p.w || 1) * d.k + 1, 2.8);
    if (p.pose === 'unicycle') unicycleWheel(c, p, d);
    hairBack(c, p, d);
    bagBack(c, p, d);
    if (p.pose === 'swim') {
      const off = -(d.shY + 6.5);
      c.save(); c.beginPath(); c.rect(-40, -80, 80, 80.4); c.clip(); c.translate(0, off);
      if (p.hair === 'long') paint(c, () => rr(c, -d.hr - 1.6, d.headY - d.hr * 0.3, 2 * d.hr + 3.2, d.hr * 2.7, d.hr), p.hc, { k: 0.6 });
      torso(c, p, d); arm(c, p, d, -d.tw + 1, d.shY + 2, 0.5); arm(c, p, d, d.tw - 1, d.shY + 2, -0.5); head(c, p, d);
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); ell(c, 0, 0.2, 12, 2.6); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 0.9; c.beginPath(); ell(c, 0, 0.2, 12.5, 2.8); c.stroke();
      return;
    }
    legs(c, p, d);
    torso(c, p, d);
    bagFront(c, p, d);
    const sx = d.tw - 1, sy = d.shY + 2;
    switch (p.pose) {
      case 'map': {
        const my = d.headY + 2;
        arm(c, p, d, -sx, sy, 2.55, d.armL * 0.7); arm(c, p, d, sx, sy, -2.55, d.armL * 0.7);
        head(c, p, d);
        mapSheet(c, 0, my, p.kid ? 0.75 : 1, p.mapTilt || -0.1);
        break;
      }
      case 'sign': {
        arm(c, p, d, -sx, sy, 2.75, d.armL * 1.05); arm(c, p, d, sx, sy, -2.75, d.armL * 1.05);
        head(c, p, d);
        const sy2 = d.headY - d.hr - 14;
        paint(c, () => rr(c, -13, sy2 - 6, 26, 12, 1.5), p.signc || '#ffffff', { k: 0.5 });
        c.fillStyle = p.signt || '#e63946'; c.font = '900 7px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.text || 'GO!', 0, sy2 + 0.4);
        break;
      }
      case 'run': {
        arm(c, p, d, -sx, sy, 0.9, d.armL * 0.75); arm(c, p, d, sx, sy, -0.6, d.armL * 0.75);
        head(c, p, d); break;
      }
      case 'juggle': {
        arm(c, p, d, -sx, sy, 0.95, d.armL * 0.9); arm(c, p, d, sx, sy, -0.95, d.armL * 0.9);
        head(c, p, d); break;
      }
      case 'banjo': {
        arm(c, p, d, -sx, sy, 0.75, d.armL * 0.85);
        head(c, p, d);
        c.save(); c.translate(1, d.hipY - 3); c.rotate(-0.55);
        paint(c, () => rr(c, -1.2, -24, 2.4, 22, 1), '#8d5a3b', { shade: false, lw: 0.8 });
        paint(c, () => rr(c, -1.8, -27, 3.6, 4.5, 1), '#5b3a22', { shade: false, lw: 0.8 });
        paint(c, () => circ(c, 0, 0, 6.2), '#f5ecd2', { k: 0.6, detail: () => { c.strokeStyle = '#b08a52'; c.lineWidth = 1.2; c.beginPath(); circ(c, 0, 0, 5.6); c.stroke(); } });
        line(c, [-0.4, -24, -0.4, 4], 0.25, '#555'); line(c, [0.4, -24, 0.4, 4], 0.25, '#555');
        c.restore();
        break;
      }
      case 'unicycle': {
        arm(c, p, d, -sx, sy, 1.35); head(c, p, d); break;
      }
      case 'drum': {
        arm(c, p, d, -sx, sy, 0.5, d.armL * 0.8);
        head(c, p, d);
        const dy = d.hipY - 1;
        paint(c, () => rr(c, -8, dy - 4, 16, 9, 2), p.drumc || '#e63946', { k: 0.6, detail: () => { c.strokeStyle = '#fff4c2'; c.lineWidth = 0.8; c.beginPath(); for (let x = -8; x < 8; x += 4) { c.moveTo(x, dy - 4); c.lineTo(x + 2, dy + 5); c.lineTo(x + 4, dy - 4); } c.stroke(); } });
        paint(c, () => ell(c, 0, dy - 4, 8, 2), '#f5f0e6', { shade: false, lw: 0.9 });
        break;
      }
      default: {
        if (p.pose === 'sit') arm(c, p, d, -sx, sy, 0.25, d.armL * 0.85);
        else arm(c, p, d, -sx, sy, 0.12);
        head(c, p, d);
      }
    }
    if (p.with === 'stroller') stroller(c, p, d);
    if (p.with === 'bike') bike(c, p, d);
  }
  function mapSheet(c, x, y, k, tilt) {
    c.save(); c.translate(x, y); c.rotate(tilt); c.scale(k, k);
    const w = 22, h = 13;
    paint(c, () => { c.moveTo(-w / 2, -h / 2); c.lineTo(-w / 6, -h / 2 + 1); c.lineTo(w / 6, -h / 2); c.lineTo(w / 2, -h / 2 + 1); c.lineTo(w / 2, h / 2); c.lineTo(w / 6, h / 2 - 1); c.lineTo(-w / 6, h / 2); c.lineTo(-w / 2, h / 2 - 1); c.closePath(); }, '#f4e7c5', {
      k: 0.5, detail: () => {
        c.fillStyle = '#9fd39a'; c.beginPath(); ell(c, -5, -1, 5, 3.4); c.fill();
        c.fillStyle = '#8cc8f0'; c.beginPath(); ell(c, 6, 2, 4, 4.5); c.fill();
        c.setLineDash([1.2, 1]); line(c, [-9, 4, -4, 0, 1, 2, 5, -4], 0.7, '#e63946'); c.setLineDash([]);
        c.strokeStyle = 'rgba(80,60,40,0.35)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-w / 6, -h / 2); c.lineTo(-w / 6, h / 2); c.moveTo(w / 6, -h / 2); c.lineTo(w / 6, h / 2); c.stroke();
      }
    });
    c.restore();
  }
  function stroller(c, p, d) {
    const x = d.tw + 13, k = p.kid ? 0.8 : 1, col = p.strc || '#4d96ff';
    line(c, [d.tw + 2, d.hipY + 2, x - 6, d.hipY - 2, x - 2, -8], 1.2, '#3b3b46');
    paint(c, () => { c.moveTo(x - 8, -10); c.quadraticCurveTo(x - 8, -24, x + 5, -24); c.quadraticCurveTo(x + 9, -16, x + 9, -10); c.closePath(); }, col, { k: 0.8 });
    paint(c, () => circ(c, x - 1, -18, 3.8), PAL.skin[(p.num || 1) % PAL.skin.length], { k: 0.5, lw: 1 });
    dot(c, x - 2.3, -18, 0.6, '#2b2140'); dot(c, x + 0.3, -18, 0.6, '#2b2140');
    paint(c, () => { c.moveTo(x - 6, -24); c.quadraticCurveTo(x + 8, -27, x + 8, -14); c.lineTo(x + 3, -16); c.quadraticCurveTo(x + 1, -21, x - 6, -24); c.closePath(); }, shade(col, -0.2), { shade: false, lw: 1 });
    for (const wx of [x - 5, x + 6]) { paint(c, () => circ(c, wx, -3, 3), '#2b2b33', { shade: false, lw: 0.8 }); dot(c, wx, -3, 1, '#ccc'); }
  }
  function bike(c, p, d) {
    const x = d.tw + 16, col = p.bikec || '#ff6f61';
    for (const wx of [x - 10, x + 10]) { c.strokeStyle = OUT; c.lineWidth = 1.8; c.beginPath(); circ(c, wx, -7, 7); c.stroke(); c.strokeStyle = '#bbb'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(wx - 7, -7); c.lineTo(wx + 7, -7); c.moveTo(wx, -14); c.lineTo(wx, 0); c.stroke(); }
    line(c, [x - 10, -7, x - 2, -7, x + 6, -16, x - 5, -16, x - 2, -7], 1.6, col);
    line(c, [x + 10, -7, x + 6, -16, x + 5, -21], 1.4, col);
    line(c, [x + 2, -21, x + 8, -21], 1.3, '#2b2b33');
    paint(c, () => ell(c, x - 5, -18, 3.2, 1.2), '#2b2b33', { shade: false, lw: 0.6 });
    if (p.basket) { paint(c, () => rr(c, x + 6, -22, 7, 5, 1), '#c8a066', { shade: false, lw: 0.7 }); dot(c, x + 8, -22.5, 1.5, '#e63946'); dot(c, x + 11, -22.5, 1.5, '#7bd389'); }
  }
  function unicycleWheel(c, p, d) {
    line(c, [0, -9, 0, d.hipY + 2], 1.4, '#888');
    paint(c, () => ell(c, 0, d.hipY + 1, 4, 1.6), '#2b2b33', { shade: false, lw: 0.6 });
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); circ(c, 0, -8.5, 8.3); c.stroke();
    c.strokeStyle = '#c9c9c9'; c.lineWidth = 0.4; c.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; c.moveTo(Math.cos(a) * 8, -8.5 + Math.sin(a) * 8); c.lineTo(-Math.cos(a) * 8, -8.5 - Math.sin(a) * 8); } c.stroke();
  }
  function personArm(c, p) { // the right arm, animated separately (wave / sway / strum)
    const d = pdims(p), sx = d.tw - 1, sy = d.shY + 2;
    let a = -0.12;
    if (p.pose === 'unicycle') a = -1.35;
    if (p.pose === 'banjo') a = 0.35;
    if (p.pose === 'sit') a = -0.25;
    const len = p.pose === 'banjo' ? d.armL * 0.8 : d.armL;
    arm(c, p, d, sx, sy, a, len);
    const hp = handPos(d, sx, sy, a, len);
    heldItem(c, p, hp[0], hp[1]);
  }
  function hasArmPart(p) { return !p.pose || p.pose === 'stand' || p.pose === 'sit' || p.pose === 'unicycle' || p.pose === 'banjo'; }
  function personHand(p) { const d = pdims(p), sx = d.tw - 1, sy = d.shY + 2; return handPos(d, sx, sy, p.pose === 'sit' ? -0.25 : -0.12); }
  function balloon(c, p) {
    const h = personHand(p), bx = h[0] + 5, by = h[1] - 34;
    c.beginPath(); c.moveTo(h[0], h[1]); c.quadraticCurveTo(h[0] + 6, h[1] - 16, bx, by + 7.5); c.lineWidth = 0.5; c.strokeStyle = '#555'; c.stroke();
    paint(c, () => { c.moveTo(bx, by + 7.6); c.bezierCurveTo(bx - 7.5, by + 5, bx - 6.5, by - 8, bx, by - 8); c.bezierCurveTo(bx + 6.5, by - 8, bx + 7.5, by + 5, bx, by + 7.6); c.closePath(); }, p.balc || '#ff6f61', { k: 0.8, lw: 1 });
    dot(c, bx - 2.4, by - 3.2, 1.3, 'rgba(255,255,255,0.75)');
    paint(c, () => { c.moveTo(bx - 1.2, by + 9); c.lineTo(bx + 1.2, by + 9); c.lineTo(bx, by + 7.4); c.closePath(); }, p.balc || '#ff6f61', { shade: false, lw: 0.6 });
  }
  function jball(c, p, i) {
    const d = pdims(p), cols = ['#ff6f61', '#ffd23f', '#4d96ff'];
    paint(c, () => circ(c, 0, d.headY - d.hr - 6, 2.4), cols[i % 3], { k: 0.5, lw: 0.9 });
  }

  const person = {
    parts(p) {
      const d = pdims(p), top = hatTop(p, d);
      let x0 = -d.tw - 6, x1 = d.tw + 6, y0 = top - 2;
      if (p.pose === 'sign') y0 = Math.min(y0, d.headY - d.hr - 22);
      if (p.pose === 'map') { x0 = Math.min(x0, -13); x1 = Math.max(x1, 13); }
      if (p.pose === 'banjo') { x0 = -d.tw - 6; x1 = 18; y0 = Math.min(y0, d.hipY - 34); }
      if (p.pose === 'unicycle') { x0 = -d.tw - 18; }
      if (p.catpack) { x0 = Math.min(x0, -d.tw - 9); y0 = Math.min(y0, d.shY - 13); }
      if (p.with === 'stroller') x1 = d.tw + 24;
      if (p.with === 'bike') x1 = d.tw + 34;
      if (p.pose === 'swim') { y0 = top - (d.shY + 6.5) - 2; }
      x0 = Math.min(x0, p.pose === 'swim' ? -15 : -12); x1 = Math.max(x1, p.pose === 'swim' ? 15 : 12);
      const parts = [{ name: 'body', b: [x0, y0, x1, 4], pv: [0, 0] }];
      if (hasArmPart(p)) {
        const sx = d.tw - 1, sy = d.shY + 2;
        let ax0 = sx - 5, ax1 = sx + 7, ay0 = sy - 4, ay1 = d.hipY + 6;
        if (p.hold === 'flag') ay1 += 16;
        if (p.hold === 'lantern') { ay1 += 18; ax0 -= 4; ax1 += 4; }
        if (p.hold === 'creemee') ay0 = Math.min(ay0, d.hipY - 10);
        if (p.pose === 'unicycle') { ax1 = sx + d.armL + 6; ay0 = sy - 6; ay1 = sy + 8; }
        if (p.pose === 'banjo') { ax0 = sx - 8; }
        parts.push({ name: 'arm', b: [ax0, ay0, ax1, ay1], pv: [sx, sy], anim: p.armAnim || 'sway' });
      }
      if (p.balloon) { const h = personHand(p); parts.push({ name: 'balloon', b: [h[0] - 5, h[1] - 44, h[0] + 14, h[1] + 2], pv: h, anim: 'balloon' }); }
      if (p.pose === 'juggle') for (let i = 0; i < 3; i++) { const yy = d.headY - d.hr - 6; parts.push({ name: 'ball' + i, b: [-3, yy - 3, 3, yy + 3], pv: [0, yy], anim: 'juggle' + i }); }
      if (p.with === 'dog') {
        const dk = p.dog.size, dx = d.tw + 12 + 8 * dk, h = personHand(p);
        parts.push({ name: 'dog', b: [dx - 16 * dk, Math.min(-25 * dk, h[1] - 3), Math.max(dx + 20 * dk, h[0] + 2), 4], pv: [dx, 0], off: [dx, 0], anim: 'dogbob' });
        parts.push({ name: 'tail', b: [dx - 16 * dk, -22 * dk, dx - 6 * dk, -8 * dk], pv: [dx - 8.5 * dk, -11 * dk], anim: 'wag' });
      }
      return parts;
    },
    draw(c, p, part) {
      if (part === 'body') personBody(c, p);
      else if (part === 'arm') personArm(c, p);
      else if (part === 'balloon') balloon(c, p);
      else if (part.startsWith('ball')) jball(c, p, +part.slice(4));
      else if (part === 'dog') { const d = pdims(p), dk = p.dog.size, dx = d.tw + 12 + 8 * dk, h = personHand(p); c.save(); c.translate(dx, 0); dogBody(c, p.dog, [h[0] - dx, h[1]]); c.restore(); }
      else if (part === 'tail') { const d = pdims(p), dk = p.dog.size, dx = d.tw + 12 + 8 * dk; c.save(); c.translate(dx, 0); dogTail(c, p.dog); c.restore(); }
    },
    shape(p) {
      const d = pdims(p), s = [];
      if (p.pose === 'swim') { const hy = d.headY - (d.shY + 6.5); s.push({ t: 'e', x: 0, y: hy, rx: d.hr + 1.5, ry: d.hr + 1.5 }); s.push({ t: 'r', x0: -d.tw, y0: -6.5, x1: d.tw, y1: 0.5 }); return s; }
      s.push({ t: 'e', x: 0, y: d.headY, rx: d.hr + 0.8, ry: d.hr + 0.8 });
      s.push({ t: 'r', x0: -d.tw - 1.5, y0: d.shY, x1: d.tw + 1.5, y1: d.hipY + 2.5 });
      s.push({ t: 'r', x0: -d.legGap - d.legW - 1.6, y0: d.hipY + 1, x1: d.legGap + d.legW + 1.6, y1: 0.8 });
      if (p.bottom === 'skirt' || p.bottom === 'dress') s.push({ t: 'r', x0: -d.hw - 3.4, y0: d.hipY - 1, x1: d.hw + 3.4, y1: d.hipY + d.legH * 0.5 + 1 });
      if (p.hat === 'sun') s.push({ t: 'r', x0: -d.hr - 6.2, y0: d.headY - 5.2, x1: d.hr + 6.2, y1: d.headY + 0.4 });
      if (p.hat === 'bucket') s.push({ t: 'r', x0: -d.hr - 3.6, y0: d.headY - 4.6, x1: d.hr + 3.6, y1: d.headY });
      if (p.hat === 'cap') s.push({ t: 'r', x0: -d.hr - 1.8, y0: d.headY - 3.2, x1: d.hr + 3.8, y1: d.headY });
      if (p.balloon) { const h = personHand(p); s.push({ t: 'e', x: h[0] + 5, y: h[1] - 34, rx: 8, ry: 9 }); }
      if (p.catpack) s.push({ t: 'e', x: -d.tw - 1.5, y: d.shY - 4.5, rx: 6, ry: 6 });
      if (p.hair === 'long' || p.hair === 'pony') s.push({ t: 'r', x0: -d.hr - 2, y0: d.headY - 2, x1: d.hr + 3.8, y1: d.headY + d.hr + 3 });
      const top = hatTop(p, d);
      if (top < d.headY - d.hr - 1) s.push({ t: 'r', x0: -d.hr, y0: top, x1: d.hr, y1: d.headY - d.hr + 2 });
      if (p.pose === 'map') s.push({ t: 'r', x0: -11.5, y0: d.headY - 5, x1: 11.5, y1: d.headY + 9 });
      if (p.pose === 'sign') s.push({ t: 'r', x0: -13, y0: d.headY - d.hr - 20, x1: 13, y1: d.headY - d.hr - 8 });
      if (p.pose === 'banjo') s.push({ t: 'e', x: 2, y: d.hipY - 3, rx: 6.5, ry: 6.5 });
      if (p.pose === 'unicycle') s.push({ t: 'e', x: 0, y: -8.5, rx: 8.5, ry: 8.5 });
      if (p.with === 'stroller') s.push({ t: 'r', x0: d.tw + 4, y0: -25, x1: d.tw + 22, y1: 0 });
      if (p.with === 'bike') s.push({ t: 'r', x0: d.tw + 6, y0: -22, x1: d.tw + 33, y1: 0 });
      if (p.with === 'dog') { const dk = p.dog.size, dx = d.tw + 12 + 8 * dk; s.push({ t: 'e', x: dx + 2 * dk, y: -10 * dk, rx: 13 * dk, ry: 8 * dk }); }
      return s;
    },
  };

  // random person for a theme (r: rng)
  function randPerson(r, theme, o) {
    o = o || {};
    const kid = o.kid != null ? o.kid : r.chance(0.17);
    const p = {
      kid, skin: r.pick(PAL.skin), hc: r.pick(PAL.hair), hair: r.pick(['short', 'short', 'long', 'long', 'bun', 'pony', 'curly', 'bald', 'buzz']),
      w: kid ? r.range(0.9, 1.1) : r.range(0.82, 1.3), h: kid ? 1 : r.range(0.9, 1.08),
      tc: r.pick(PAL.tops), tc2: r.pick(PAL.tops), top: r.pick(['tee', 'tee', 'tee', 'stripe', 'two', 'tank', 'hoodie']),
      sleeve: r.pick(['short', 'short', 'long']), bc: r.pick(PAL.bottoms), bottom: r.pick(['pants', 'pants', 'shorts', 'shorts', 'skirt', 'dress']),
      shoe: r.pick(PAL.shoes), hat: r.weighted([['none', 6], ['cap', 2], ['sun', 1], ['bucket', 0.6], ['band', 0.6]]), hatc: r.pick(PAL.tops), hatc2: r.pick(PAL.tops),
      shades: r.chance(0.18), glasses: r.chance(0.12), beard: !kid && r.chance(0.12), bag: r.weighted([['none', 6], ['tote', 1.3], ['backpack', 1.3], ['purse', 1]]), bagc: r.pick(PAL.tops),
      hold: r.weighted([['none', 8], ['phone', 1.5], ['cup', 1.2], ['creemee', kid ? 2 : 0.8]]), armAnim: r.weighted([['sway', 6], ['wave', 1.2], ['still', 2]]),
      num: r.int(1, 999), pose: 'stand',
    };
    if (p.hair === 'bald' && (kid || r.chance(0.5))) p.hair = 'short';
    if (p.tc === p.tc2) p.tc2 = shade(p.tc, -0.25);
    // theme outfits
    if (theme === 'beach') {
      p.top = r.pick(['swim', 'swim', 'tank', 'tee']); p.bottom = r.pick(['trunks', 'trunks', 'shorts', 'skirt']);
      if (p.top === 'swim') { p.swimTop = r.chance(0.5) ? r.pick(PAL.tops) : null; }
      if (p.bottom === 'skirt') p.bottom = 'trunks';
      p.hat = r.weighted([['none', 4], ['sun', 2], ['cap', 1.5], ['bucket', 0.7]]); p.shoe = p.skin; p.bag = r.chance(0.12) ? 'tote' : 'none';
      p.shades = r.chance(0.35);
    } else if (theme === 'market') {
      p.sleeve = r.pick(['long', 'long', 'short']); p.top = r.pick(['tee', 'plaid', 'hoodie', 'two', 'stripe', 'tee']);
      p.bottom = r.pick(['pants', 'pants', 'pants', 'skirt', 'shorts']);
      if (r.chance(0.3)) p.hold = 'shopbag';
      if (r.chance(0.2)) p.bag = 'tote';
    } else if (theme === 'marathon') {
      p.top = r.pick(['tee', 'tee', 'two', 'tank', 'hoodie']); p.bottom = r.pick(['pants', 'shorts', 'shorts', 'leggings']);
    } else if (theme === 'winter') {
      p.top = 'coat'; p.sleeve = 'long'; p.tc = r.pick(PAL.coats); p.bottom = r.pick(['pants', 'pants', 'snow']); p.bc = r.pick(['#2f3e57', '#3b3b46', '#22333b', '#5e548e', '#4a6fa5']);
      p.hat = r.weighted([['beanie', 6], ['earmuffs', 1.2], ['none', 1.3]]); p.hatc = r.pick(PAL.coats); p.pom = r.chance(0.6) ? r.pick(['#ffffff', '#ffd23f', '#ff7eb6', '#7bd389']) : null;
      p.scarf = r.chance(0.6) ? r.pick(PAL.coats.concat(['#f2efe4'])) : null; if (p.scarf === p.tc) p.scarf = shade(p.tc, 0.35);
      p.mitts = r.pick(PAL.coats); p.shoe = r.pick(['#3b2a20', '#2b2b33', '#5a3e2b']); p.w *= 1.1;
      p.hold = r.weighted([['none', 5], ['cup', 2], ['lantern', 2.2], ['phone', 0.6]]); p.lanc = r.pick(['#ffd166', '#ff9f43', '#9ad0ec', '#ff7eb6', '#b5e48c']);
      p.shades = false; p.bag = r.chance(0.12) ? 'backpack' : 'none';
    }
    if (p.hold === 'creemee' && theme === 'winter') p.hold = 'cup';
    Object.assign(p, o);
    // never a red-and-white stripe (runs after theme outfits and overrides)
    const light = (c) => c === '#ffffff' || c === '#f2efe4' || c === '#ffe8a3' || c === '#ffb4a2';
    if (p.top === 'stripe' && (light(p.tc) || light(p.tc2))) { if (light(p.tc)) p.tc = '#4d96ff'; p.tc2 = shade(p.tc, -0.3); }
    return p;
  }

  // ================================================================ DOGS
  function dogBody(c, s, leashTo) {
    const k = s.size, col = s.col;
    shadow(c, 11 * k, 2.4 * k);
    const legC = shade(col, -0.12);
    for (const lx of [-6.5, -3.5]) paint(c, () => rr(c, lx * k - 1.3 * k, -7.5 * k, 2.6 * k, 7.5 * k, 1.2 * k), legC, { shade: false, lw: 1 });
    paint(c, () => ell(c, -0.5 * k, -10 * k, 9.5 * k, 5.2 * k), col, { k: 0.8 * k, detail: () => { if (s.col2) { c.fillStyle = s.col2; c.beginPath(); ell(c, -3 * k, -12 * k, 3.6 * k, 2.6 * k); ell(c, 4 * k, -8 * k, 2.4 * k, 2 * k); c.fill(); } } });
    for (const lx of [4.5, 7.5]) paint(c, () => rr(c, lx * k - 1.3 * k, -7.5 * k, 2.6 * k, 7.5 * k, 1.2 * k), col, { shade: false, lw: 1 });
    paint(c, () => circ(c, 9 * k, -15.5 * k, 4.8 * k), col, { k: 0.6 * k });
    paint(c, () => ell(c, 13.2 * k, -13.8 * k, 3.2 * k, 2.3 * k), shade(col, 0.15), { shade: false, lw: 1 });
    dot(c, 15.9 * k, -14.6 * k, 1.05 * k, '#1d1d24');
    if (s.ear === 'up') paint(c, () => { c.moveTo(6 * k, -18.5 * k); c.lineTo(7 * k, -24 * k); c.lineTo(10 * k, -19.5 * k); c.closePath(); }, shade(col, -0.15), { shade: false, lw: 0.9 });
    else paint(c, () => ell(c, 6.6 * k, -14.8 * k, 1.9 * k, 4 * k, 0.25), shade(col, -0.25), { shade: false, lw: 0.9 });
    if (s.shades) {
      paint(c, () => { rr(c, 8.6 * k, -18.4 * k, 5.4 * k, 3 * k, 1.2 * k); }, '#1b1b25', { shade: false, lw: 0.6 });
      line(c, [8.6 * k, -17.2 * k, 5.2 * k, -17.6 * k], 0.7 * k, '#1b1b25'); dot(c, 10.3 * k, -17.6 * k, 0.7 * k, 'rgba(255,255,255,0.8)');
    } else { dot(c, 10.5 * k, -16.6 * k, 0.95 * k, '#1d1d24'); dot(c, 10.8 * k, -16.9 * k, 0.32 * k, '#fff'); }
    c.beginPath(); c.arc(13.5 * k, -12.2 * k, 1.2 * k, 0.1 * Math.PI, 0.8 * Math.PI); c.lineWidth = 0.6; c.strokeStyle = OUT; c.stroke();
    if (s.collar) line(c, [5.6 * k, -12 * k, 7.6 * k, -10.6 * k, 10.5 * k, -11 * k], 1.4 * k, s.collar, 'butt');
    if (leashTo) { c.beginPath(); c.moveTo(7.6 * k, -10.8 * k); c.quadraticCurveTo((7.6 * k + leashTo[0]) / 2, Math.max(-10.8 * k, leashTo[1]) + 6, leashTo[0], leashTo[1]); c.lineWidth = 0.8; c.strokeStyle = s.leash || '#e63946'; c.stroke(); }
  }
  function dogTail(c, s) {
    const k = s.size;
    c.beginPath(); c.moveTo(-8.5 * k, -11 * k); c.quadraticCurveTo(-12.5 * k, -13 * k, -12.5 * k, -18.5 * k);
    c.lineWidth = 3.4 * k + 1.2; c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke();
    c.lineWidth = 3.4 * k - 0.6; c.strokeStyle = s.col; c.stroke();
  }
  const dog = {
    parts(s) { const k = s.size; return [{ name: 'body', b: [-12 * k, -25 * k, 19 * k, 4], pv: [0, 0] }, { name: 'tail', b: [-16 * k, -22 * k, -6 * k, -8 * k], pv: [-8.5 * k, -11 * k], anim: 'wag' }]; },
    draw(c, s, part) { if (part === 'body') dogBody(c, s); else dogTail(c, s); },
    shape(s) { const k = s.size; return [{ t: 'e', x: 0, y: -10 * k, rx: 10 * k, ry: 6 * k }, { t: 'e', x: 10 * k, y: -15 * k, rx: 5.5 * k, ry: 5 * k }, { t: 'r', x0: -8 * k, y0: -8 * k, x1: 9 * k, y1: 0 }]; },
  };
  function randDog(r) { return { size: r.range(0.7, 1.15), col: r.pick(PAL.dogs), col2: r.chance(0.35) ? r.pick(PAL.dogs) : null, ear: r.pick(['flop', 'up']), collar: r.pick(['#e63946', '#4d96ff', '#ffd23f', '#7bd389', '#c77dff']), leash: r.pick(['#e63946', '#4d96ff', '#2b2b33', '#7bd389']) }; }

  // ================================================================ WOODCHUCK (target) + SQUIRREL / TEDDY (decoys)
  const WC = { fur: '#8a5a35', dark: '#5e3a20', belly: '#dcb68a' };
  const woodchuck = {
    parts() { return [{ name: 'body', b: [-10, -30, 10, 3], pv: [0, 0] }]; },
    draw(c) {
      shadow(c, 8, 2);
      paint(c, () => ell(c, 5.6, -2.4, 4.2, 2, -0.35), WC.dark, { shade: false });
      paint(c, () => { c.moveTo(0, -18.5); c.bezierCurveTo(7.5, -18.5, 9, -4, 7.4, -1.5); c.quadraticCurveTo(0, 0.8, -7.4, -1.5); c.bezierCurveTo(-9, -4, -7.5, -18.5, 0, -18.5); c.closePath(); }, WC.fur, { k: 0.9 });
      paint(c, () => ell(c, 0, -7.5, 4.5, 6.2), WC.belly, { shade: false, lw: 0.8 });
      paint(c, () => { ell(c, -3.4, -0.9, 2.8, 1.5); ell(c, 3.4, -0.9, 2.8, 1.5); }, WC.dark, { shade: false, lw: 0.9 });
      paint(c, () => { circ(c, -4.2, -24.4, 1.7); circ(c, 4.2, -24.4, 1.7); }, WC.dark, { shade: false, lw: 0.9 });
      paint(c, () => ell(c, 0, -20.6, 5.8, 5), WC.fur, { k: 0.6 });
      paint(c, () => ell(c, 0, -18.4, 3.3, 2.4), WC.belly, { shade: false, lw: 0.7 });
      paint(c, () => rr(c, -1, -17.4, 2, 2.4, 0.4), '#ffffff', { shade: false, lw: 0.5 });
      paint(c, () => ell(c, 0, -19.7, 1.2, 0.85), '#2b1d16', { shade: false, lw: 0.4 });
      dot(c, -2.3, -22, 0.95, '#1d1d24'); dot(c, 2.3, -22, 0.95, '#1d1d24'); dot(c, -2.05, -22.3, 0.32, '#fff'); dot(c, 2.55, -22.3, 0.32, '#fff');
      paint(c, () => { ell(c, -2.5, -13.4, 1.5, 1.9, 0.3); ell(c, 2.5, -13.4, 1.5, 1.9, -0.3); }, WC.dark, { shade: false, lw: 0.7 });
    },
    shape() { return [{ t: 'e', x: 0, y: -9.5, rx: 8, ry: 9.5 }, { t: 'e', x: 0, y: -21, rx: 6.2, ry: 5.6 }]; },
  };
  const squirrel = {
    parts() { return [{ name: 'body', b: [-13, -26, 9, 3], pv: [0, 0] }]; },
    draw(c, s) {
      const f = s.col || '#8e8e98', l = shade(f, 0.45);
      shadow(c, 7, 1.8);
      paint(c, () => { c.moveTo(-3, -3); c.bezierCurveTo(-14, -2, -13, -16, -8, -22); c.bezierCurveTo(-4, -25, -1, -20, -4, -15); c.bezierCurveTo(-7, -11, -7, -6, -3, -3); c.closePath(); }, shade(f, 0.1), { k: 0.7 });
      paint(c, () => ell(c, 1, -6.5, 4.6, 6.2), f, { k: 0.6 });
      paint(c, () => ell(c, 1.5, -5.5, 2.6, 4), l, { shade: false, lw: 0.6 });
      paint(c, () => ell(c, 2.6, -14, 3.6, 3.2), f, { k: 0.5 });
      paint(c, () => { c.moveTo(0.5, -16); c.lineTo(0.8, -19.5); c.lineTo(2.4, -16.6); c.closePath(); }, f, { shade: false, lw: 0.6 });
      dot(c, 3.8, -14.6, 0.75, '#1d1d24'); dot(c, 6, -13.6, 0.6, '#3a2a2a');
      paint(c, () => ell(c, 3.8, -9.6, 1.6, 1.2), '#b07a3a', { shade: false, lw: 0.5 });
    },
    shape() { return [{ t: 'e', x: 1, y: -9, rx: 5.5, ry: 9 }, { t: 'e', x: -8, y: -13, rx: 5, ry: 9 }]; },
  };
  const teddy = {
    parts() { return [{ name: 'body', b: [-11, -24, 11, 3], pv: [0, 0] }]; },
    draw(c, s) {
      const f = s.col || '#a8743f';
      shadow(c, 8, 2);
      paint(c, () => { ell(c, -4.5, -2.4, 3.2, 2.4); ell(c, 4.5, -2.4, 3.2, 2.4); }, f, { k: 0.4 });
      paint(c, () => ell(c, 0, -8, 6.4, 6.6), f, { k: 0.7 });
      paint(c, () => { ell(c, -6.4, -9, 2, 3.2, 0.4); ell(c, 6.4, -9, 2, 3.2, -0.4); }, f, { k: 0.4, lw: 1 });
      paint(c, () => { circ(c, -4.5, -20.2, 2.2); circ(c, 4.5, -20.2, 2.2); }, f, { k: 0.4 });
      paint(c, () => circ(c, 0, -16.5, 5.6), f, { k: 0.6 });
      paint(c, () => ell(c, 0, -14.8, 2.6, 1.9), shade(f, 0.35), { shade: false, lw: 0.6 });
      dot(c, 0, -15.6, 0.8, '#2b1d16'); dot(c, -2, -17.6, 0.75, '#1d1d24'); dot(c, 2, -17.6, 0.75, '#1d1d24');
      line(c, [-3, -11.4, 3, -11.4], 1.2, s.bow || '#4d96ff');
    },
    shape() { return [{ t: 'e', x: 0, y: -8, rx: 7, ry: 7.5 }, { t: 'e', x: 0, y: -17, rx: 6, ry: 6 }]; },
  };

  // ================================================================ CHAMP (target) — always emerging from water or peeking over an edge
  function champNeck(c, s) {
    const P = [[-3, 8], [-9, -12], [9, -18], [5, -32]];
    const bz = (a, b, cc, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * cc + t * t * t * d; };
    const pts = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push([bz(P[0][0], P[1][0], P[2][0], P[3][0], t), bz(P[0][1], P[1][1], P[2][1], P[3][1], t), 6.6 - 2.2 * t]); }
    const hx = 6.5, hy = -34;
    const hump = [[-17, 4, 8.5, 7.5], [-29, 6, 6, 5]];
    const blobs = (grow, dx, dy, kk) => { c.beginPath(); for (const h of hump) ell(c, h[0] + dx, h[1] + dy, (h[2] + grow) * kk, (h[3] + grow) * kk); for (const q of pts) circ(c, q[0] + dx, q[1] + dy, (q[2] + grow) * kk); ell(c, hx + dx, hy + dy, (8.6 + grow) * kk, (6.8 + grow) * kk); ell(c, hx + 6.6 + dx, hy + 2.2 + dy, (5.4 + grow) * kk, (4.2 + grow) * kk); };
    // back scallops
    c.fillStyle = OUT; c.beginPath(); for (let i = 3; i < 16; i += 3) { const q = pts[i]; circ(c, q[0] - 5.2 - i * 0.05, q[1] - 1, 2.6); } for (const h of hump) circ(c, h[0], h[1] - h[3], 2.6); c.fill();
    c.fillStyle = CH.fin; c.beginPath(); for (let i = 3; i < 16; i += 3) { const q = pts[i]; circ(c, q[0] - 5.2 - i * 0.05, q[1] - 1, 1.7); } for (const h of hump) circ(c, h[0], h[1] - h[3], 1.7); c.fill();
    blobs(LW, 0, 0, 1); c.fillStyle = OUT; c.fill();
    blobs(0, 0, 0, 1); c.fillStyle = CH.body; c.fill();
    c.save(); blobs(0, 0, 0, 1); c.clip();
    c.fillStyle = 'rgba(20,60,70,0.22)'; blobs(0, 2.2, 1.6, 1); c.rect(-1e3, -1e3, 2e3, 2e3); c.fill('evenodd');
    c.fillStyle = CH.belly; c.beginPath(); for (const q of pts) circ(c, q[0] + 3.2, q[1] + 0.8, q[2] * 0.55); c.fill();
    c.fillStyle = CH.light; c.beginPath(); for (const q of pts) circ(c, q[0] - 2, q[1] - 1.6, q[2] * 0.35); ell(c, hx - 2, hy - 3.2, 4, 2.2); for (const h of hump) ell(c, h[0] - 1.5, h[1] - h[3] * 0.45, h[2] * 0.5, h[3] * 0.3); c.fill();
    c.restore();
    // horns
    paint(c, () => { rr(c, hx - 4.5, hy - 9.8, 2.6, 4.4, 1.3); rr(c, hx - 0.2, hy - 10.4, 2.6, 4.4, 1.3); }, '#f6e7a8', { shade: false, lw: 0.9 });
    champFace(c, hx, hy, 1);
  }
  function champFace(c, hx, hy, k) {
    paint(c, () => { ell(c, hx - 1.4 * k, hy - 1.8 * k, 2.7 * k, 3.1 * k); ell(c, hx + 3.6 * k, hy - 2.1 * k, 2.4 * k, 2.9 * k); }, '#ffffff', { shade: false, lw: 0.9 });
    dot(c, hx - 0.9 * k, hy - 1.4 * k, 1.45 * k, '#1d1d24'); dot(c, hx + 4 * k, hy - 1.7 * k, 1.35 * k, '#1d1d24');
    dot(c, hx - 0.4 * k, hy - 2 * k, 0.5 * k, '#fff'); dot(c, hx + 4.5 * k, hy - 2.3 * k, 0.45 * k, '#fff');
    c.globalAlpha = 0.6; dot(c, hx - 3.4 * k, hy + 2.2 * k, 1.6 * k, CH.cheek); dot(c, hx + 8 * k, hy + 1.8 * k, 1.4 * k, CH.cheek); c.globalAlpha = 1;
    c.beginPath(); c.arc(hx + 4.5 * k, hy + 2.2 * k, 3 * k, 0.15 * Math.PI, 0.75 * Math.PI); c.lineWidth = 0.8; c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke();
    dot(c, hx + 10.5 * k, hy + 0.6 * k, 0.5 * k, '#14504a'); dot(c, hx + 11.7 * k, hy + 0.9 * k, 0.5 * k, '#14504a');
  }
  function champPeek(c) {
    // head + flippers over an edge (edge at y=0)
    paint(c, () => { ell(c, -9.5, -0.6, 3.6, 2.2, -0.3); ell(c, 9.5, -0.6, 3.6, 2.2, 0.3); }, CH.body, { k: 0.4 });
    paint(c, () => { rr(c, -5.2, -16.5, 2.6, 4.2, 1.3); rr(c, 2.6, -16.5, 2.6, 4.2, 1.3); }, '#f6e7a8', { shade: false, lw: 0.9 });
    paint(c, () => { c.moveTo(-9.5, 1); c.bezierCurveTo(-10, -15, 10, -15, 9.5, 1); c.closePath(); }, CH.body, { k: 1, detail: () => { c.fillStyle = CH.light; c.beginPath(); ell(c, -3, -9.5, 4, 2); c.fill(); } });
    champFace(c, -0.8, -5.4, 0.92);
  }
  const champ = {
    parts(s) { return s.pose === 'peek' ? [{ name: 'body', b: [-15, -19, 15, 2], pv: [0, 0], anim: 'champ' }] : [{ name: 'body', b: [-38, -46, 22, 1.5], pv: [0, 0], anim: 'champ' }]; },
    draw(c, s) {
      c.save(); c.beginPath(); c.rect(-60, -80, 120, s.pose === 'peek' ? 81.2 : 80.6); c.clip();
      if (s.pose === 'peek') champPeek(c); else champNeck(c, s);
      c.restore();
      if (s.water) { c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1; c.beginPath(); ell(c, -2, 0.3, 11, 2.2); ell(c, -17, 0.6, 10, 2); c.stroke(); }
    },
    shape(s) { return s.pose === 'peek' ? [{ t: 'e', x: 0, y: -7, rx: 10, ry: 8 }, { t: 'r', x0: -13, y0: -3, x1: 13, y1: 0.5 }] : [{ t: 'e', x: 9, y: -33, rx: 12, ry: 8 }, { t: 'r', x0: -9, y0: -26, x1: 6, y1: 0 }, { t: 'e', x: -20, y: 0, rx: 13, ry: 7 }]; },
  };
  // decoy: green inflatable sea-serpent float (clearly a pool toy: shiny, ribbed, valve, no face)
  const floaty = {
    parts() { return [{ name: 'body', b: [-22, -32, 24, 4], pv: [0, 0], anim: 'float' }]; },
    draw(c, s) {
      const g = s.col || '#5cc96b', d = shade(g, -0.25);
      shadow(c, 18, 3.2);
      paint(c, () => ell(c, -2, -5, 19, 6.4), g, { k: 0.8, detail: () => { c.fillStyle = d; c.beginPath(); for (let x = -16; x < 18; x += 6) ell(c, x, -5, 1.2, 6.5); c.fill(); } });
      paint(c, () => ell(c, -2, -6, 11, 3), '#9fd3f0', { shade: false, lw: 0.8 });
      paint(c, () => { c.moveTo(12, -7); c.quadraticCurveTo(20, -14, 15, -24); c.quadraticCurveTo(14, -30, 19, -30); c.quadraticCurveTo(25, -29, 23, -22); c.quadraticCurveTo(26, -13, 17, -3); c.closePath(); }, g, { k: 0.8 });
      dot(c, 21, -27, 1.4, '#ffd23f'); dot(c, 19, -21, 1.2, '#ffd23f');
      c.globalAlpha = 0.8; dot(c, -8, -9, 1.8, '#ffffff'); dot(c, 16.5, -26, 1, '#ffffff'); c.globalAlpha = 1;
      paint(c, () => rr(c, -18, -8, 2.4, 3, 0.6), '#f2f2f2', { shade: false, lw: 0.5 });
    },
    shape() { return [{ t: 'e', x: -2, y: -5, rx: 19, ry: 6.5 }, { t: 'r', x0: 12, y0: -30, x1: 24, y1: -4 }]; },
  };

  // ================================================================ ITEMS (small objects)
  const ITEMS = {
    jug: { b: [-9, -19, 9, 2], sh: [{ t: 'r', x0: -6.5, y0: -17, x1: 6.5, y1: 0 }], draw(c, s) {
      shadow(c, 7, 1.8);
      paint(c, () => { c.moveTo(-6, 0); c.lineTo(-6, -10); c.quadraticCurveTo(-6, -13, -3, -13.5); c.lineTo(-1.5, -14); c.lineTo(-1.5, -16); c.lineTo(1.5, -16); c.lineTo(1.5, -14); c.lineTo(6, -13); c.lineTo(6, 0); c.closePath(); }, s.col || '#d98a2b', { k: 0.8, detail: () => { c.fillStyle = '#f7f1e3'; c.fillRect(-6, -9.5, 12, 7); c.fillStyle = s.col ? '#4d96ff' : '#4caf50'; c.beginPath(); c.moveTo(-6, -2.6); c.quadraticCurveTo(-1, -6.8, 6, -3.5); c.lineTo(6, -2.5); c.lineTo(-6, -2.5); c.fill(); leaf(c, 0.5, -7, 2, '#d64545'); } });
      c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.moveTo(2, -13.6); c.quadraticCurveTo(6.5, -18, 6, -12.2); c.stroke(); c.strokeStyle = '#f2e3c4'; c.lineWidth = 0.7; c.stroke();
      paint(c, () => rr(c, -2, -18, 4, 2.5, 0.6), '#c0392b', { shade: false, lw: 0.6 });
    } },
    duck: { b: [-9, -14, 10, 2], sh: [{ t: 'e', x: 0, y: -4.5, rx: 8, ry: 5 }, { t: 'e', x: 3, y: -10, rx: 4.5, ry: 4.5 }], draw(c, s) {
      shadow(c, 7, 1.6);
      paint(c, () => { c.moveTo(-7.5, -6); c.quadraticCurveTo(-8, 0, 0, 0); c.quadraticCurveTo(7.5, 0, 7, -5); c.quadraticCurveTo(4, -6, -7.5, -6); c.closePath(); }, s.col || '#ffd23f', { k: 0.6 });
      paint(c, () => ell(c, -1.5, -4.4, 3.6, 2, -0.2), shade(s.col || '#ffd23f', -0.12), { shade: false, lw: 0.6 });
      paint(c, () => circ(c, 2.8, -9.4, 4), s.col || '#ffd23f', { k: 0.5 });
      paint(c, () => ell(c, 7, -8.7, 2.6, 1.2), '#ff8c1a', { shade: false, lw: 0.7 });
      dot(c, 3.8, -10.4, 0.8, '#1d1d24');
    } },
    mitten: { b: [-8, -13, 8, 2], sh: [{ t: 'e', x: 0.5, y: -6.3, rx: 7.2, ry: 7.2 }], draw(c, s) {
      const col = s.col || '#8e5bd6';
      shadow(c, 6, 1.4);
      c.save(); c.rotate(0.3);
      paint(c, () => { c.moveTo(-4, -1); c.lineTo(-4.5, -8); c.quadraticCurveTo(-4.5, -12.5, 0, -12.5); c.quadraticCurveTo(4.4, -12.5, 4.2, -8); c.lineTo(4, -1); c.closePath(); c.moveTo(4.2, -6.5); c.quadraticCurveTo(7.4, -8, 7, -5); c.quadraticCurveTo(6.6, -3, 4, -3); c.closePath(); }, col, { k: 0.6, detail: () => { dot(c, -1, -8, 0.7, '#fff'); dot(c, 1.5, -6, 0.7, '#fff'); dot(c, -1.5, -4.5, 0.6, '#fff'); } });
      paint(c, () => rr(c, -4.6, -2.4, 9.2, 3.4, 1), '#f3f0e8', { shade: false, lw: 0.8 });
      c.restore();
    } },
    kite: { b: [-14, -16, 18, 4], sh: [{ t: 'r', x0: -10, y0: -11, x1: 10, y1: 1 }], draw(c, s) {
      shadow(c, 12, 1.8);
      c.save(); c.translate(0, -5); c.scale(1, 0.55); c.rotate(0.5);
      const P = [[0, -11], [8, 0], [0, 15], [-8, 0]], cols = s.cols || ['#ff6f61', '#ffd23f', '#4d96ff', '#7bd389'];
      for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; c.beginPath(); c.moveTo(0, 0); c.lineTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.closePath(); c.fillStyle = cols[i]; c.fill(); }
      c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 0); c.lineTo(0, 15); c.lineTo(-8, 0); c.closePath(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
      c.restore();
      c.beginPath(); c.moveTo(5, -1); c.quadraticCurveTo(10, 3, 16, 0); c.lineWidth = 0.6; c.strokeStyle = '#444'; c.stroke();
      for (const [x, y, col] of [[9.5, 1.1, '#ff7eb6'], [14, 0.9, '#4d96ff']]) paint(c, () => { c.moveTo(x - 1.6, y - 1.2); c.lineTo(x + 1.6, y + 1.2); c.lineTo(x + 1.6, y - 1.2); c.lineTo(x - 1.6, y + 1.2); c.closePath(); }, col, { shade: false, lw: 0.5 });
    } },
    skateboard: { b: [-15, -9, 15, 2], sh: [{ t: 'r', x0: -13.5, y0: -7, x1: 13.5, y1: 0 }], draw(c, s) {
      shadow(c, 13, 1.6);
      for (const x of [-8.5, 8.5]) paint(c, () => circ(c, x, -2, 2), '#ffd23f', { shade: false, lw: 0.8 });
      paint(c, () => { c.moveTo(-13, -6.5); c.quadraticCurveTo(-14, -4.4, -11, -4); c.lineTo(11, -4); c.quadraticCurveTo(14, -4.4, 13, -6.5); c.closePath(); rr(c, -11, -6.2, 22, 2.6, 1); }, s.col || '#ff5d8f', { k: 0.4, detail: () => { c.fillStyle = '#ffffff'; c.beginPath(); ell(c, 0, -5.2, 3, 0.9); c.fill(); } });
    } },
    snowman: { b: [-11, -30, 11, 2], sh: [{ t: 'e', x: 0, y: -6, rx: 7.5, ry: 6.5 }, { t: 'e', x: 0, y: -16, rx: 5.5, ry: 5 }, { t: 'r', x0: -4, y0: -28, x1: 4, y1: -19 }], draw(c, s) {
      shadow(c, 8, 1.8);
      line(c, [-4.5, -16, -10, -21], 0.9, '#6e4122'); line(c, [4.5, -16, 10, -20.5], 0.9, '#6e4122');
      paint(c, () => ell(c, 0, -6, 7.4, 6.4), '#f6fbff', { k: 0.7 });
      paint(c, () => ell(c, 0, -15.5, 5.6, 5), '#f6fbff', { k: 0.6 });
      paint(c, () => circ(c, 0, -22.6, 4.2), '#f6fbff', { k: 0.5 });
      paint(c, () => rr(c, -5.2, -19.6, 10.4, 2.4, 1), s.col || '#17b3a3', { shade: false, lw: 0.7 });
      paint(c, () => { rr(c, -3.2, -30, 6.4, 5.2, 0.6); rr(c, -4.6, -25.6, 9.2, 1.4, 0.5); }, '#2b2b33', { shade: false, lw: 0.5 });
      paint(c, () => { c.moveTo(0, -22.8); c.lineTo(4.4, -22); c.lineTo(0, -21.4); c.closePath(); }, '#ff8c1a', { shade: false, lw: 0.5 });
      dot(c, -1.5, -23.8, 0.6, '#222'); dot(c, 1.4, -23.8, 0.6, '#222'); dot(c, 0, -15.5, 0.6, '#222'); dot(c, 0, -13, 0.6, '#222');
    } },
    pumpkin: { b: [-10, -17, 10, 2], sh: [{ t: 'e', x: 0, y: -6.5, rx: 9, ry: 7 }], draw(c, s) {
      shadow(c, 9, 2);
      paint(c, () => ell(c, 0, -6.5, 9, 6.8), s.col || '#ff8c1a', { k: 0.8, detail: () => { c.strokeStyle = 'rgba(120,50,0,0.4)'; c.lineWidth = 0.8; c.beginPath(); ell(c, 0, -6.5, 3, 6.8); ell(c, 0, -6.5, 6.5, 6.8); c.stroke(); } });
      paint(c, () => rr(c, -1, -15.5, 2.2, 3.6, 0.6), '#5b7d2b', { shade: false, lw: 0.6 });
      if (s.face) { c.fillStyle = '#ffd34d'; c.beginPath(); c.moveTo(-5, -9); c.lineTo(-2.6, -9.6); c.lineTo(-3.4, -7.2); c.closePath(); c.moveTo(5, -9); c.lineTo(2.6, -9.6); c.lineTo(3.4, -7.2); c.closePath(); c.moveTo(-5.2, -4.8); c.quadraticCurveTo(0, -1, 5.2, -4.8); c.quadraticCurveTo(0, -3, -5.2, -4.8); c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.5; c.stroke(); }
    } },
    flamingo: { b: [-10, -34, 11, 2], sh: [{ t: 'e', x: 0, y: -18, rx: 7, ry: 5 }, { t: 'r', x0: 2, y0: -32, x1: 9, y1: -18 }, { t: 'r', x0: -2, y0: -14, x1: 2, y1: 0 }], draw(c, s) {
      shadow(c, 5, 1.2);
      line(c, [-1, 0, -1, -14], 0.9, '#d65a86'); line(c, [1.4, 0, 1.4, -11, 3.6, -13], 0.9, '#d65a86');
      paint(c, () => { c.moveTo(-8, -18); c.quadraticCurveTo(-5, -24, 4, -21); c.quadraticCurveTo(7, -16, 2, -14); c.quadraticCurveTo(-6, -13, -8, -18); c.closePath(); }, s.col || '#ff7eb6', { k: 0.6 });
      c.beginPath(); c.moveTo(4, -20); c.quadraticCurveTo(9, -26, 5, -30); c.lineWidth = 3.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2; c.strokeStyle = s.col || '#ff7eb6'; c.stroke();
      paint(c, () => circ(c, 6, -30.8, 2.4), s.col || '#ff7eb6', { shade: false, lw: 0.8 });
      paint(c, () => { c.moveTo(7.6, -31.5); c.lineTo(10.6, -29.4); c.lineTo(8, -29.2); c.closePath(); }, '#2b2b33', { shade: false, lw: 0.5 });
      dot(c, 6.4, -31.4, 0.5, '#1d1d24');
    } },
    trophy: { b: [-9, -21, 9, 2], sh: [{ t: 'r', x0: -6, y0: -19, x1: 6, y1: 0 }], draw(c, s) {
      shadow(c, 6, 1.4);
      c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath(); c.arc(-5.8, -14, 2.6, Math.PI * 0.5, Math.PI * 1.5); c.moveTo(5.8, -16.6); c.arc(5.8, -14, 2.6, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
      c.strokeStyle = s.col || '#f5c518'; c.lineWidth = 1.2; c.stroke();
      paint(c, () => { c.moveTo(-6, -19); c.lineTo(6, -19); c.quadraticCurveTo(6, -9, 1.2, -8); c.lineTo(1.2, -4); c.lineTo(-1.2, -4); c.lineTo(-1.2, -8); c.quadraticCurveTo(-6, -9, -6, -19); c.closePath(); }, s.col || '#f5c518', { k: 0.6 });
      paint(c, () => rr(c, -5, -4.5, 10, 4.5, 0.8), '#6e4122', { shade: false, lw: 0.8 });
      dot(c, -2.6, -16, 1, 'rgba(255,255,255,0.8)');
    } },
  };
  ITEMS.goldleaf = { b: [-12, -17, 12, 3], sh: [{ t: 'e', x: 0, y: -7, rx: 9, ry: 8 }], draw(c, s) {
    shadow(c, 8, 1.8);
    c.save(); c.translate(0, -7); c.rotate(-0.25);
    leaf(c, 0, 0, 8, '#e0a21a');
    c.strokeStyle = '#b5770b'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, 8); c.lineTo(0, -6); c.moveTo(0, 0); c.lineTo(-5, -3); c.moveTo(0, 0); c.lineTo(5, -3); c.stroke();
    c.restore();
    c.fillStyle = '#fffbe0'; for (const [x, y, r] of [[-6, -13, 1.1], [7, -10, 0.8]]) { c.beginPath(); for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4, rr2 = i % 2 ? r * 0.35 : r * 1.6; c.lineTo(x + Math.cos(an) * rr2, y + Math.sin(an) * rr2); } c.closePath(); c.fill(); }
  } };
  const item = {
    parts(s) { return [{ name: 'body', b: ITEMS[s.item].b, pv: [0, 0], anim: s.anim || null }]; },
    draw(c, s) { ITEMS[s.item].draw(c, s); },
    shape(s) { return ITEMS[s.item].sh; },
  };

  const KINDS = { person, dog, woodchuck, squirrel, teddy, champ, floaty, item };

  // ================================================================ ANIMATION (per part, per frame)
  // returns [dx, dy, rot, sx, sy] applied around the part pivot
  const A0 = [0, 0, 0, 1, 1];
  function anim(type, t, ph, e) {
    switch (type) {
      case 'wave': return [0, 0, -2.45 + 0.42 * Math.sin(t * 7 + ph), 1, 1];
      case 'sway': return [0, 0, 0.09 * Math.sin(t * 1.6 + ph), 1, 1];
      case 'wag': return [0, 0, 0.5 * Math.sin(t * 13 + ph), 1, 1];
      case 'balloon': return [0, 0, 0.09 * Math.sin(t * 1.2 + ph), 1, 1];
      case 'dogbob': return [0, -Math.abs(Math.sin(t * 3 + ph)) * 0.8, 0, 1, 1];
      case 'champ': return [0, Math.sin(t * 1.7 + ph) * 0.9, 0.05 * Math.sin(t * 1.3 + ph), 1, 1];
      case 'float': return [0, Math.sin(t * 1.5 + ph) * 0.6, 0.03 * Math.sin(t * 1.2 + ph), 1, 1];
      case 'still': return A0;
      case 'sparkle': { const u = 1 + 0.08 * Math.max(0, Math.sin(t * 3 + ph)); return [0, 0, 0.05 * Math.sin(t * 1.3 + ph), u, u]; }
      case 'strum': return [0, 0, 0.18 * Math.sin(t * 9 + ph), 1, 1];
      case 'inflate': return [0, 0, 0.03 * Math.sin(t * 1.1 + ph), 1 + 0.012 * Math.sin(t * 2.2 + ph), 1 + 0.02 * Math.sin(t * 2.2 + ph)];
      case 'spray': return [0, 0, 0, 1 + 0.04 * Math.sin(t * 9 + ph), 1 + 0.08 * Math.sin(t * 11 + ph)];
      default:
        if (type && type.startsWith('juggle')) {
          const i = +type.slice(6), u = ((t * 0.9 + i / 3) % 1);
          const x = Math.cos(u * TAU) * 9, y = -Math.abs(Math.sin(u * TAU)) * 10 + 8;
          return [x, y, 0, 1, 1];
        }
        return A0;
    }
  }
  // whole-entity idle motion
  function bodyAnim(type, t, ph) {
    switch (type) {
      case 'bob': return [0, -Math.abs(Math.sin(t * 2.2 + ph)) * 1.2, 0, 1, 1];
      case 'bounce': return [0, -Math.abs(Math.sin(t * 4.4 + ph)) * 2.6, 0, 1, 1];
      case 'run': return [0, -Math.abs(Math.sin(t * 6.5 + ph)) * 2.8, 0.03 * Math.sin(t * 6.5 + ph), 1, 1];
      case 'breathe': return [0, 0, 0, 1 - 0.008 * Math.sin(t * 2 + ph), 1 + 0.015 * Math.sin(t * 2 + ph)];
      case 'sway': return [0, 0, 0.035 * Math.sin(t * 1.4 + ph), 1, 1];
      case 'chuck': { const u = Math.max(0, Math.sin(t * 1.3 + ph)); return [0, 0, 0.04 * Math.sin(t * 0.7 + ph), 1 - 0.03 * u, 1 + 0.07 * u]; }
      case 'wobble': return [0, 0, 0.09 * Math.sin(t * 2.6 + ph), 1, 1];
      case 'swim': return [0, Math.sin(t * 1.8 + ph) * 0.9, 0, 1, 1];
      case 'peep': return [0, 0, 0.05 * Math.sin(t * 0.9 + ph), 1, 1];
      default: return A0;
    }
  }

  // ASSETS: drop painted PNGs here later (key -> Image). Each key falls back to the code-drawn version.
  const ASSETS = {};

  Object.assign(SC, { OUT, PAL, PEEP, CH, KINDS, ITEMS, ART: { rr, ell, circ, paint, shadow, line, dot, leaf, mapSheet, pdims, randPerson, randDog, anim, bodyAnim }, ASSETS });
})(typeof window !== 'undefined' ? window : globalThis);
