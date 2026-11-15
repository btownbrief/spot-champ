/* Spot Champ — renderer.
   Speed plan: nothing is drawn with paths per frame. Every entity part is rasterised once into a small
   offscreen sprite at a "zoom bucket" resolution (0.5 / 1 / 2 / 3 / 4.5 / 6 device px per world unit),
   and the static backdrop is cut into 512px tiles per bucket. Frames are just drawImage calls.
   Sprites/tiles for the zoom you're at are built a few per frame (time-budgeted) and old ones are
   evicted LRU, so memory stays bounded on phones. */
(function (root) {
  'use strict';
  const SC = root.SC;
  const BUCKETS = [0.5, 0.75, 1, 1.5, 2, 3, 4.5, 6]; // close steps: drawing a sprite much bigger than shown is costly
  const BASE = 0.5;
  const TS = 512;
  const R = {};
  let S = null, frame = 0;
  let spritePx = 0, tilePx = 0;
  const SPRITE_BUDGET = 18e6, TILE_BUDGET = 12e6;
  const dyn = new Set();       // non-base sprites, for LRU
  const tiles = new Map();     // key -> {cv, used, px}
  let baseBg = null;           // whole backdrop at low res
  let glow = null;
  R.stats = { built: 0, tilesBuilt: 0, drawn: 0, lastMs: 0, buildMs: 0, pending: 0 };
  // Champ ducking: up 2.6 s, 0.3 s down, 1.2 s low, 0.3 s up. Returns 0 (up) .. DUCK_MAX (as low as he goes).
  // He never vanishes: at his lowest his eyes and antennae still show over the edge (see R.sinkDy).
  const DUCK = [2.6, 0.3, 1.2, 0.3], DUCK_T = 4.4, DUCK_MAX = 0.65;
  R.sink = function (e, t) {
    if (!e.duck) return 0;
    let u = t - e.duck.t0; if (u < 0) return 0; u %= DUCK_T;
    const ease = (v) => v * v * (3 - 2 * v);
    if (u < DUCK[0]) return 0; u -= DUCK[0];
    if (u < DUCK[1]) return DUCK_MAX * ease(u / DUCK[1]); u -= DUCK[1];
    if (u < DUCK[2]) return DUCK_MAX; u -= DUCK[2];
    return DUCK_MAX * (1 - ease(u / DUCK[3]));
  };
  // how far down (local units) he has slipped: at DUCK_MAX the peek pose drops 6.5 units, leaving antennae + eyes
  R.sinkDy = (e, t) => R.sink(e, t) * (e.spec.pose === 'peek' ? 10 : 48);

  function mk(w, h) {
    if (typeof OffscreenCanvas !== 'undefined' && R.useOffscreen) return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function bucketFor(need) { for (const b of BUCKETS) if (b >= need * 0.9) return b; return BUCKETS[BUCKETS.length - 1]; }
  R.bucketFor = bucketFor;

  function assetKey(e, p) {
    if (e.kind === 'champ') return 'champ_' + e.spec.pose;
    if (e.kind === 'woodchuck') return 'woodchuck';
    if (e.kind === 'item') return 'item_' + e.spec.item;
    if (e.kind === 'floaty') return 'decoy_float';
    if (e.tid === 'peeper' && p.name === 'body') return 'peeper';
    return null;
  }
  function buildSprite(e, pi, b) {
    const p = e.parts[pi], sc = e.s * b;
    const w = (p.b[2] - p.b[0]) * sc, h = (p.b[3] - p.b[1]) * sc;
    let k = 1; const MAX = 2048; if (w > MAX || h > MAX) k = MAX / Math.max(w, h);
    const cw = Math.max(2, Math.ceil(w * k) + 2), ch = Math.max(2, Math.ceil(h * k) + 2);
    const cv = mk(cw, ch), c = cv.getContext('2d');
    const u = sc * k;
    c.setTransform(u, 0, 0, u, -p.b[0] * u + 1, -p.b[1] * u + 1);
    const ak = assetKey(e, p), img = ak && SC.ASSETS[ak];
    if (img && img.complete && img.naturalWidth) c.drawImage(img, p.b[0], p.b[1], p.b[2] - p.b[0], p.b[3] - p.b[1]);
    else SC.KINDS[e.kind].draw(c, e.spec, p.name);
    if (S && S.night) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = e.kind === 'prop' && (e.spec.p === 'pine' || e.spec.p === 'lamp' || e.spec.p === 'float') ? 'rgba(30,30,90,0.24)' : 'rgba(22,26,90,0.38)'; c.fillRect(0, 0, cw, ch); c.globalCompositeOperation = 'source-over'; }
    const spr = { cv, b, lx: p.b[0] - 1 / u, ly: p.b[1] - 1 / u, lw: cw / u, lh: ch / u, px: cw * ch, used: frame, e, pi };
    R.stats.built++;
    return spr;
  }
  function getSprite(e, pi, b, allowBuild) {
    const m = e.spr[pi];
    let s = m[b];
    if (s) { s.used = frame; return s; }
    if (allowBuild) {
      s = m[b] = buildSprite(e, pi, b);
      if (b !== BASE) { dyn.add(s); spritePx += s.px; }
      return s;
    }
    // fall back to the closest resolution we already have
    let best = null, bd = 1e9;
    for (const k in m) { const d = Math.abs(Math.log(+k / b)); if (d < bd) { bd = d; best = m[k]; } }
    if (best) best.used = frame;
    return best;
  }
  function evict() {
    if (spritePx > SPRITE_BUDGET) {
      const arr = Array.from(dyn).sort((a, b) => a.used - b.used);
      let n = 0; // free a few at a time so the browser never has to clean up hundreds of canvases in one frame
      for (const s of arr) { if (spritePx < SPRITE_BUDGET * 0.85 || n++ > 90) break; if (s.used === frame) continue; dyn.delete(s); spritePx -= s.px; delete s.e.spr[s.pi][s.b]; s.cv.width = s.cv.height = 0; }
    }
    if (tilePx > TILE_BUDGET) {
      const arr = Array.from(tiles.entries()).sort((a, b) => a[1].used - b[1].used);
      let n = 0;
      for (const [k, t] of arr) { if (tilePx < TILE_BUDGET * 0.85 || n++ > 16) break; if (t.used === frame) continue; tiles.delete(k); tilePx -= t.px; t.cv.width = t.cv.height = 0; }
    }
  }
  function buildTile(b, i, j) {
    const tw = TS / b, x0 = i * tw, y0 = j * tw;
    const cw = Math.min(TS, Math.ceil((S.W - x0) * b)), ch = Math.min(TS, Math.ceil((S.H - y0) * b));
    const cv = mk(Math.max(1, cw), Math.max(1, ch)), c = cv.getContext('2d');
    c.setTransform(b, 0, 0, b, -x0 * b, -y0 * b);
    SC.THEMES[S.theme].paint(c, S.bg, [x0, y0, x0 + tw, y0 + tw]);
    R.stats.tilesBuilt++;
    return { cv, used: frame, px: cw * ch, cw, ch };
  }

  // ---------------------------------------------------------------- scene setup
  R.setScene = function (scene) {
    // free old caches
    for (const s of dyn) s.cv.width = s.cv.height = 0;
    dyn.clear(); spritePx = 0;
    for (const t of tiles.values()) t.cv.width = t.cv.height = 0;
    tiles.clear(); tilePx = 0;
    if (S) for (const e of S.ents) if (e.spr) for (const m of e.spr) for (const k in m) m[k].cv.width = 0;
    S = scene;
    const t0 = performance.now();
    for (const e of S.ents) { e.spr = e.parts.map(() => ({})); for (let i = 0; i < e.parts.length; i++) getSprite(e, i, BASE, true); }
    // low-res whole backdrop (also the fallback under missing tiles)
    baseBg = mk(Math.ceil(S.W * BASE), Math.ceil(S.H * BASE));
    const c = baseBg.getContext('2d'); c.setTransform(BASE, 0, 0, BASE, 0, 0);
    SC.THEMES[S.theme].paint(c, S.bg, [0, 0, S.W, S.H]);
    if (!glow) {
      glow = mk(128, 128); const g = glow.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,220,150,0.9)'); gr.addColorStop(0.4, 'rgba(255,200,120,0.35)'); gr.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    R.stats.setupMs = performance.now() - t0;
  };

  // ---------------------------------------------------------------- frame
  // cam: {x, y, z}; view: {w, h, dpr}; opts: {settled, t, budget}
  R.draw = function (ctx, cam, view, opts) {
    frame++;
    const t0 = performance.now();
    const dpr = view.dpr, k = cam.z * dpr, cx = view.w / 2, cy = view.h / 2;
    const T = SC.THEMES[S.theme];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = T.frame; ctx.fillRect(0, 0, view.w * dpr, view.h * dpr);
    // letterbox: let the sky and ground bleed softly past the scene edges
    if (T.ext) {
      const sy0 = (cy - cam.y * cam.z) * dpr, sy1 = sy0 + S.H * k, sx0 = Math.max(0, (cx - cam.x * cam.z) * dpr), sx1 = Math.min(view.w * dpr, sx0 + S.W * k);
      if (sy0 > 0) { const g = ctx.createLinearGradient(0, sy0, 0, Math.max(0, sy0 - 160 * dpr)); g.addColorStop(0, T.ext[0]); g.addColorStop(1, T.frame); ctx.fillStyle = g; ctx.fillRect(sx0, 0, sx1 - sx0, sy0 + 1); }
      if (sy1 < view.h * dpr) { const g = ctx.createLinearGradient(0, sy1, 0, sy1 + 160 * dpr); g.addColorStop(0, T.ext[1]); g.addColorStop(1, T.frame); ctx.fillStyle = g; ctx.fillRect(sx0, sy1 - 1, sx1 - sx0, view.h * dpr - sy1 + 1); }
      // sides (landscape / desktop): sky beside the sky, ground beside the ground, fading out
      const rx0 = (cx - cam.x * cam.z) * dpr, rx1 = rx0 + S.W * k, hy = Math.max(sy0, Math.min(sy1, sy0 + S.gy0 * k));
      const side = (xa, xb, dir) => {
        if (xb - xa < 1) return;
        const gs = ctx.createLinearGradient(dir > 0 ? xa : xb, 0, dir > 0 ? Math.min(xb, xa + 240 * dpr) : Math.max(xa, xb - 240 * dpr), 0);
        gs.addColorStop(0, T.ext[0]); gs.addColorStop(1, T.frame); ctx.fillStyle = gs; ctx.fillRect(xa, Math.max(0, sy0), xb - xa, Math.max(0, hy - Math.max(0, sy0)));
        const gg = ctx.createLinearGradient(dir > 0 ? xa : xb, 0, dir > 0 ? Math.min(xb, xa + 240 * dpr) : Math.max(xa, xb - 240 * dpr), 0);
        gg.addColorStop(0, T.ext[1]); gg.addColorStop(1, T.frame); ctx.fillStyle = gg; ctx.fillRect(xa, hy, xb - xa, Math.min(view.h * dpr, sy1) - hy);
      };
      if (rx0 > 0) side(0, rx0 + 1, -1);
      if (rx1 < view.w * dpr) side(rx1 - 1, view.w * dpr, 1);
    }
    const vx0 = cam.x - cx / cam.z, vy0 = cam.y - cy / cam.z, vx1 = cam.x + cx / cam.z, vy1 = cam.y + cy / cam.z;
    const ox = (cx - cam.x * cam.z) * dpr, oy = (cy - cam.y * cam.z) * dpr; // device px offset of world origin
    const want = bucketFor(k * (opts.sharp || 1)), twant = Math.min(want, 3);
    // Chrome/Safari rasterise canvas drawing lazily, so build *time* is not measurable here.
    // Instead each build spends an estimated cost (measured: ~0.12ms + 4ms per megapixel).
    let cost = opts.budget != null ? opts.budget : 5;
    const canBuild = () => opts.settled && cost > 0;
    const spend = (px) => { cost -= 0.12 + px * 4e-6; };
    let pending = 0;

    // backdrop: low-res base everywhere, sharp tiles on top where ready
    ctx.imageSmoothingEnabled = true;
    const tw = TS / twant;
    const i0 = Math.max(0, Math.floor(vx0 / tw)), i1 = Math.min(Math.ceil(S.W / tw) - 1, Math.floor(vx1 / tw));
    const j0 = Math.max(0, Math.floor(vy0 / tw)), j1 = Math.min(Math.ceil(S.H / tw) - 1, Math.floor(vy1 / tw));
    let allTiles = twant > BASE;
    if (allTiles) for (let j = j0; j <= j1 && allTiles; j++) for (let i = i0; i <= i1; i++) if (!tiles.has(twant + ':' + i + ':' + j)) { allTiles = false; break; }
    if (!allTiles) { ctx.setTransform(k / BASE, 0, 0, k / BASE, ox, oy); ctx.drawImage(baseBg, 0, 0); }
    if (twant > BASE) {
      const sc = k / twant;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const key = twant + ':' + i + ':' + j;
        let tl = tiles.get(key);
        if (!tl) { if (canBuild()) { tl = buildTile(twant, i, j); tiles.set(key, tl); tilePx += tl.px; spend(tl.px); } else { pending++; continue; } }
        tl.used = frame;
        const dx = ox + i * tw * k, dy = oy + j * tw * k;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(tl.cv, 0, 0, tl.cw, tl.ch, Math.floor(dx), Math.floor(dy), Math.ceil(tl.cw * sc + (dx - Math.floor(dx))) + 1, Math.ceil(tl.ch * sc + (dy - Math.floor(dy))) + 1);
      }
    }

    // entities, back to front
    const t = opts.t, A = SC.ART;
    let drawn = 0;
    const m = 8;
    for (const e of S.order) {
      const bx = e.box;
      if (bx[2] < vx0 - m || bx[0] > vx1 + m || bx[3] < vy0 - m || bx[1] > vy1 + m) continue;
      if (e.hidden) continue;
      const ba = e.banim ? A.bodyAnim(e.banim, t, e.ph) : null;
      let cel = null;
      if (e.cel != null) { const u = (t - e.cel) / 0.9; if (u >= 0 && u < 1) cel = u; }
      const f = e.flip ? -1 : 1, s = e.s;
      // entity base transform: world (e.x,e.y) -> device, scaled by s*k, flipped
      let ex = ox + e.x * k, ey = oy + e.y * k;
      let clipped = false;
      if (e.duck) { // sink below the spot's edge (clipped there), so he slips behind his prop / under the water
        const dy = R.sinkDy(e, t);
        if (dy > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(0, 0, view.w * dpr, ey + 1.2 * s * k); ctx.clip(); clipped = true; ey += dy * s * k; }
      }
      let rot = 0, sx = 1, sy = 1;
      if (ba) { ex += ba[0] * s * k * f; ey += ba[1] * s * k; rot = ba[2] * f; sx = ba[3]; sy = ba[4]; }
      if (cel != null) { const hop = Math.sin(Math.PI * Math.min(1, cel * 1.6)) * 16; ey -= hop * s * k; const sq = cel < 0.62 ? 1 + 0.12 * Math.sin(cel / 0.62 * Math.PI * 2) : 1; sy *= sq; sx /= sq; rot += f * 0.25 * Math.sin(cel * Math.PI * 2) * (1 - cel); }
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const a0 = f * s * k * sx * cr, b0 = f * s * k * sx * sr, c0 = -s * k * sy * sr, d0 = s * k * sy * cr;
      for (let pi = 0; pi < e.parts.length; pi++) {
        const p = e.parts[pi];
        const spr = getSprite(e, pi, want, false) || null;
        let use = spr;
        if (!spr || spr.b !== want) { if (canBuild()) { use = getSprite(e, pi, want, true); spend(use.px); } else pending++; }
        if (!use) continue;
        if (p.anim) {
          const q = A.anim(p.anim, t, e.ph + pi);
          // part transform around its pivot (local units)
          const px = p.pv[0], py = p.pv[1];
          const qc = Math.cos(q[2]), qs = Math.sin(q[2]);
          // local -> local: translate(px+dx,py+dy) * rotate * scale * translate(-px,-py)
          const la = qc * q[3], lb = qs * q[3], lc = -qs * q[4], ld = qc * q[4];
          const le = px + q[0] - (la * px + lc * py), lf = py + q[1] - (lb * px + ld * py);
          ctx.setTransform(a0 * la + c0 * lb, b0 * la + d0 * lb, a0 * lc + c0 * ld, b0 * lc + d0 * ld, a0 * le + c0 * lf + ex, b0 * le + d0 * lf + ey);
        } else ctx.setTransform(a0, b0, c0, d0, ex, ey);
        ctx.drawImage(use.cv, use.lx, use.ly, use.lw, use.lh);
        drawn++;
      }
      if (clipped) ctx.restore();
    }
    // night glow
    if (S.night && S.lights.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const L of S.lights) {
        if (L.x + L.r < vx0 || L.x - L.r > vx1 || L.y + L.r < vy0 || L.y - L.r > vy1) continue;
        // lamp posts keep their full glow; other lights are smaller and dimmer; a carried lantern is just a small warm dot
        const fl = (0.36 + 0.05 * Math.sin(t * 3 + L.x)) * (L.kind === 'lamp' ? 1 : L.kind === 'lantern' ? 1.6 : 0.5);
        ctx.globalAlpha = Math.min(1, fl); ctx.setTransform(1, 0, 0, 1, 0, 0);
        const rr = L.r * k * (L.kind === 'lamp' ? 1 : L.kind === 'lantern' ? 0.2 : 0.6);
        ctx.drawImage(glow, ox + L.x * k - rr, oy + L.y * k - rr, rr * 2, rr * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (frame % 10 === 0) { const te = performance.now(); evict(); R.stats.evictMs = Math.max(R.stats.evictMs || 0, performance.now() - te); }
    R.stats.drawn = drawn; R.stats.pending = pending; R.stats.lastMs = performance.now() - t0; R.stats.bucket = want;
    R.stats.spriteMB = Math.round((spritePx * 4) / 1e6); R.stats.tileMB = Math.round((tilePx * 4) / 1e6);
    return pending;
  };
  // world -> CSS px
  R.toScreen = (cam, view, wx, wy) => [(wx - cam.x) * cam.z + view.w / 2, (wy - cam.y) * cam.z + view.h / 2];
  R.toWorld = (cam, view, sx, sy) => [(sx - view.w / 2) / cam.z + cam.x, (sy - view.h / 2) / cam.z + cam.y];
  // render one entity into a fresh canvas (for HUD icons)
  R.icon = function (e, size, pad) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of e.parts) { x0 = Math.min(x0, p.b[0]); y0 = Math.min(y0, p.b[1]); x1 = Math.max(x1, p.b[2]); y1 = Math.max(y1, p.b[3]); }
    const sh = SC.KINDS[e.kind].shape(e.spec); // fit to the hit shape so the thing fills the icon
    let a0 = 1e9, b0 = 1e9, a1 = -1e9, b1 = -1e9;
    for (const q of sh) { if (q.t === 'e') { a0 = Math.min(a0, q.x - q.rx); a1 = Math.max(a1, q.x + q.rx); b0 = Math.min(b0, q.y - q.ry); b1 = Math.max(b1, q.y + q.ry); } else { a0 = Math.min(a0, q.x0); a1 = Math.max(a1, q.x1); b0 = Math.min(b0, q.y0); b1 = Math.max(b1, q.y1); } }
    a0 = Math.max(a0 - 2, x0); a1 = Math.min(a1 + 2, x1); b0 = Math.max(b0 - 3, y0); b1 = Math.min(b1 + 2, y1);
    const sc = (size - (pad || 4) * 2) / Math.max(a1 - a0, b1 - b0);
    const f = e.flip ? -1 : 1;
    for (let i = 0; i < e.parts.length; i++) {
      const p = e.parts[i];
      g.setTransform(sc * f, 0, 0, sc, size / 2 - f * (a0 + a1) / 2 * sc, size / 2 - (b0 + b1) / 2 * sc);
      SC.KINDS[e.kind].draw(g, e.spec, p.name);
    }
    return c;
  };
  SC.R = R;
})(window);
