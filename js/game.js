/* Spot Champ — game: camera + gestures, finding, hints, modes, HUD, saves, test hooks (window.__T). */
(function () {
  'use strict';
  // if a script failed to download (flaky network), retry the page once instead of showing a dead screen
  const W0 = window.SC;
  if (!W0 || !W0.SCENE || !W0.R || !W0.audio || !W0.THEMES) {
    let n = 9; try { n = +(sessionStorage.getItem('spotchamp.retry') || 0); sessionStorage.setItem('spotchamp.retry', String(n + 1)); } catch (e) {}
    if (n < 2) setTimeout(() => location.reload(), 300 + n * 700);
    return;
  }
  try { sessionStorage.removeItem('spotchamp.retry'); } catch (e) {}
  const SC = window.SC, R = SC.R, A = SC.audio, SCN = SC.SCENE;
  const { clamp, lerp, easeOut, easeInOut, easeOutBack, fmtTime, TAU } = SC;
  const $ = (id) => document.getElementById(id);
  const canvas = $('c'), ctx = canvas.getContext('2d');
  const W = SCN.W, H = SCN.H;

  // ------------------------------------------------------------------ saves
  const SAVE_KEY = 'spotchamp.v1';
  const save = { sound: true, music: true, diff: 'normal', theme: 'festival', bests: {}, daily: {}, streak: { last: null, n: 0 }, coached: false, played: 0, found: 0, xp: 0, leaves: 0, album: { spots: {}, items: {} } };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
  if (!save.album || !save.album.spots) save.album = { spots: {}, items: {} };
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
  A.sound = save.sound; A.music = save.music;
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

  // ------------------------------------------------------------------ layout
  const view = { w: 390, h: 844, dpr: 1 };
  let maxDpr = 2, dprSet = false, slowT = 0, fastT = 0;
  // adaptive resolution: a slow phone drops to a lower pixel ratio instead of dropping frames, and climbs back when there's headroom
  function adaptDpr(dt) {
    // the win / Explore reveal: full resolution whenever the map is still (a dropped pixel ratio there reads as blocky
    // sprites); while you pan it in Explore it may drop like play does, and it comes back once you stop
    if (G.mode === 'won' && !ptrs.size && !camAnim && Math.hypot(vel.x, vel.y) < 5) {
      if (view.dpr < maxDpr && settleT > 0.3) { view.dpr = maxDpr; canvas.width = Math.round(view.w * maxDpr); canvas.height = Math.round(view.h * maxDpr); slowT = fastT = 0; }
      return;
    }
    if (G.mode !== 'play' && G.mode !== 'won' && G.mode !== 'title') { slowT = fastT = 0; return; }
    if (dt > 0.021) { slowT += dt; fastT = 0; } else if (dt < 0.0135) { fastT += dt; slowT = Math.max(0, slowT - dt); }
    let nd = view.dpr;
    if (slowT > 1.2 && view.dpr > 1.25) nd = view.dpr > 1.5 ? 1.5 : 1.25;
    else if (fastT > 6 && view.dpr < maxDpr) nd = Math.min(maxDpr, view.dpr + 0.25);
    if (nd !== view.dpr) { view.dpr = nd; canvas.width = Math.round(view.w * nd); canvas.height = Math.round(view.h * nd); slowT = fastT = 0; }
  }
  let insets = { t: 0, r: 0, b: 0, l: 0 }, safe = { l: 0, t: 0, r: 390, b: 844 };
  let lastW = 0, lastH = 0;
  function readInsets() { const cs = getComputedStyle($('probe')); insets = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 }; }
  function layout() {
    readInsets();
    lastW = window.innerWidth; lastH = window.innerHeight;
    view.w = Math.max(280, lastW); view.h = Math.max(300, lastH); maxDpr = Math.min(window.devicePixelRatio || 1, 2); view.dpr = Math.min(maxDpr, view.dpr > 0.9 && dprSet ? view.dpr : maxDpr); dprSet = true;
    const st = $('stage'); st.style.width = view.w + 'px'; st.style.height = view.h + 'px';
    canvas.width = Math.round(view.w * view.dpr); canvas.height = Math.round(view.h * view.dpr);
    const wasFit = !!G.S && cam.z <= fitCam().z * 1.03;
    computeSafe();
    // after a rotation keep the overview framed (and the win reveal above the card)
    if (G.S && (G.mode === 'won' || wasFit) && !ptrs.size) { const f = fitCam(); camAnim = null; cam.x = f.x; cam.y = f.y; cam.z = f.z; }
  }
  function computeSafe() {
    const playing = G.mode === 'play' || G.mode === 'paused' || G.mode === 'won' || G.mode === 'intro';
    const tray = $('tray');
    const trayH = playing ? (tray.offsetHeight || 70) : 0;
    document.documentElement.style.setProperty('--trayH', (trayH + 10) + 'px');
    safe = playing ? { l: insets.l, r: view.w - insets.r, t: insets.t + 60, b: view.h - trayH } : { l: 0, r: view.w, t: 0, b: view.h };
    if (G.mode === 'won' && G.winFrame) { // leave room for the results card
      const land = view.w > view.h * 1.1;
      if (land) safe.r = Math.max(safe.l + 200, view.w - Math.min(400, view.w * 0.5) - insets.r);
      else safe.b = Math.max(safe.t + 160, view.h - Math.min(G.cardH || 480, view.h * 0.66));
    }
    zMin = Math.min((safe.r - safe.l) / W, (safe.b - safe.t) / H);
    zMax = Math.max(Z_MAX, zMin * 4); // past ~2.4 you only see a handful of people: no use for searching
    if (cam.z < zMin) cam.z = zMin;
    clampCam(true);
  }
  function onResize() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const flip = (window.innerWidth > window.innerHeight) !== (lastW > lastH);
    // on phones ignore the Safari toolbar showing/hiding (height-only changes)
    if (coarse) { if (flip || Math.abs(window.innerWidth - lastW) > 8) { layout(); setTimeout(layout, 300); } }
    else { clearTimeout(onResize.t); onResize.t = setTimeout(layout, 60); }
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(layout, 350));

  // ------------------------------------------------------------------ camera
  const cam = { x: W / 2, y: H / 2, z: 0.2 };
  const Z_MAX = 2.4, OPEN_Z = 0.55, MISS_Z = 0.9; // max zoom; the scan zoom a game opens at; below MISS_Z a wrong tap is free (it zooms in)
  let zMin = 0.2, zMax = Z_MAX;
  const vel = { x: 0, y: 0 };
  let camAnim = null;
  function limits(z) {
    const sw = safe.r - safe.l, sh = safe.b - safe.t, L = {};
    if (W * z <= sw) L.x0 = L.x1 = W / 2 - ((safe.l + safe.r) / 2 - view.w / 2) / z;
    else { L.x0 = (view.w / 2 - safe.l) / z; L.x1 = W - (safe.r - view.w / 2) / z; }
    if (H * z <= sh) L.y0 = L.y1 = H / 2 - ((safe.t + safe.b) / 2 - view.h / 2) / z;
    else { L.y0 = (view.h / 2 - safe.t) / z; L.y1 = H - (safe.b - view.h / 2) / z; }
    // zoomed in, don't let the view drift up into a screenful of sky and buildings: at most 150 px of backdrop above the ground line
    if (G.S && z >= 0.4 && G.mode !== 'title' && G.mode !== 'boot') { const yTop = G.S.gy0 + (view.h / 2 - safe.t - 150) / z; if (yTop > L.y0) L.y0 = Math.min(yTop, L.y1); }
    return L;
  }
  function clampCam(hard) {
    if (hard) cam.z = clamp(cam.z, zMin, zMax);
    const L = limits(cam.z);
    if (hard) { cam.x = clamp(cam.x, L.x0, L.x1); cam.y = clamp(cam.y, L.y0, L.y1); }
  }
  const toWorld = (sx, sy) => [(sx - view.w / 2) / cam.z + cam.x, (sy - view.h / 2) / cam.z + cam.y];
  const toScreen = (wx, wy) => [(wx - cam.x) * cam.z + view.w / 2, (wy - cam.y) * cam.z + view.h / 2];
  function camFor(wx, wy, z, sx, sy) { // camera that puts world (wx,wy) at screen (sx,sy) with zoom z, clamped
    const c = { x: wx - (sx - view.w / 2) / z, y: wy - (sy - view.h / 2) / z, z };
    const L = limits(z); c.x = clamp(c.x, L.x0, L.x1); c.y = clamp(c.y, L.y0, L.y1);
    return c;
  }
  function fitCam() {
    // frame from a little above the horizon down, so a portrait phone doesn't spend a quarter of the screen on sky
    const top = G.S ? Math.max(0, G.S.gy0 - 260) : 0, zf = Math.min((safe.r - safe.l) / W, (safe.b - safe.t) / (H - top));
    return camFor(W / 2, (top + H) / 2, Math.max(zMin, zf), (safe.l + safe.r) / 2, (safe.t + safe.b) / 2);
  }
  function animateCam(to, dur, ease) { camAnim = { from: { x: cam.x, y: cam.y, z: cam.z }, to, t: 0, dur: dur || 0.45, ease: ease || easeInOut }; vel.x = vel.y = 0; }
  // the scan view a game opens on: zoom 0.55 over the busiest crowd knot near the middle
  function openCam() {
    const S = G.S, cx = W / 2, cy = (S.gy0 + H) / 2;
    let best = null, bn = -1;
    for (const c of S.clusters || []) {
      if (Math.hypot(c.x - cx, c.y - cy) > 500) continue;
      let n = 0; for (const e of S.ents) if (e.role === 'crowd' && Math.abs(e.x - c.x) < c.R && Math.abs(e.y - c.y) < c.R * 0.7) n++;
      if (n > bn) { bn = n; best = c; }
    }
    return camFor(best ? best.x : cx, best ? best.y - 30 : cy, Math.max(zMin, OPEN_Z), (safe.l + safe.r) / 2, (safe.t + safe.b) / 2);
  }
  // automatic camera moves wait until no finger is down and the last touch was 1.5 s ago
  let camQ = null, lastTouchT = -9;
  function queueCam(to, dur, still) { camQ = { to, dur, still }; }
  function zoomAt(sx, sy, z) { const w = toWorld(sx, sy); cam.z = z; cam.x = w[0] - (sx - view.w / 2) / z; cam.y = w[1] - (sy - view.h / 2) / z; }

  // ------------------------------------------------------------------ game state
  const G = {
    mode: 'boot', S: null, kind: 'free', theme: save.theme, diff: save.diff, seed: 1,
    t: 0, elapsed: 0, penalty: 0, misses: 0, hints: 0, foundN: 0, sel: -1,
    hint: null, hintCd: 0, circles: [], parts: [], marks: [], confetti: [], pops: [], combo: 0, bestCombo: 0, comboSaved: 0, lastFindAt: null, leafFound: false, wonAt: 0, settledFor: 0,
    attract: null, introT: 0,
  };
  window.__G = G;

  // ------------------------------------------------------------------ input
  const ptrs = new Map();
  let gest = null; // {start:{x,y,t}, moved, multi, stopper, pinch:{d0,z0,wx,wy}}
  let lastMultiEnd = -1, lastTap = null, pendingMiss = null, lastFind = null;
  let samples = [];
  const nowS = () => performance.now() / 1000;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    A.unlock();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    hideCoach();
    lastTouchT = nowS();
    if (G.mode === 'title' || G.mode === 'boot') return;
    G.clockOn = true; G.touched = true;
    if (ptrs.size === 1) {
      const speed = Math.hypot(vel.x, vel.y);
      // a touch that stops a fast-moving camera (> 120 px/s) isn't a tap; once the camera has slowed down
      // a tap counts, however recently you flicked. A tap during a zoom animation still can (double-tap twice)
      // cam0/anim0: where the camera was at touch-down, so a tap whose finger rolled a few px can undo its tiny pan
      gest = { sx: e.clientX, sy: e.clientY, t: nowS(), moved: false, multi: false, stopper: speed > 120, lx: e.clientX, ly: e.clientY, maxD: 0, cam0: { x: cam.x, y: cam.y, z: cam.z }, anim0: camAnim };
      // second finger-down of a possible double-tap: hold the first tap's miss until this gesture resolves
      if (pendingMiss && nowS() - pendingMiss.t < 0.5 && Math.hypot(e.clientX - pendingMiss.sx, e.clientY - pendingMiss.sy) < 45) { clearTimeout(pendingMiss.timer); gest.dbl = pendingMiss; }
      // tap, then touch again and drag: one-thumb zoom (down = in, up = out), like map apps
      if (gest.dbl || nowS() - lastZoomTap < 0.45) { const w = toWorld(e.clientX, e.clientY); gest.dz = { y0: e.clientY, z0: cam.z, wx: w[0], wy: w[1], sx: e.clientX, sy: e.clientY }; }
      G.lastDown = { speed: Math.round(speed), stopper: gest.stopper }; // test hook: what the camera was doing at touch-down
      vel.x = vel.y = 0; samples = [];
      canvas.classList.add('dragging');
    } else if (ptrs.size === 2 && gest) {
      gest.multi = true; startPinch();
    }
  }, { passive: false });
  function startPinch() {
    const p = Array.from(ptrs.values());
    const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
    const w = toWorld(mx, my);
    gest.pinch = { d0: Math.max(20, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)), z0: cam.z, wx: w[0], wy: w[1] };
    camAnim = null;
  }
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    p.x = e.clientX; p.y = e.clientY;
    if (!gest || G.mode === 'title') return;
    if (ptrs.size >= 2 && gest.pinch) {
      const q = Array.from(ptrs.values());
      const mx = (q[0].x + q[1].x) / 2, my = (q[0].y + q[1].y) / 2, d = Math.max(20, Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y));
      let z = gest.pinch.z0 * d / gest.pinch.d0;
      // soft limits while pinching
      if (z > zMax) z = zMax * Math.pow(z / zMax, 0.3); if (z < zMin) z = zMin * Math.pow(z / zMin, 0.3);
      cam.z = z; cam.x = gest.pinch.wx - (mx - view.w / 2) / z; cam.y = gest.pinch.wy - (my - view.h / 2) / z;
      gest.moved = true;
      return;
    }
    if (ptrs.size === 1 && gest.dz && (gest.zooming || Math.abs(e.clientY - gest.dz.y0) > 12)) {
      if (!gest.zooming) { gest.zooming = true; gest.moved = true; camAnim = null; if (pendingMiss && gest.dbl === pendingMiss) dropPending(); }
      const z = clamp(gest.dz.z0 * Math.exp((e.clientY - gest.dz.y0) * 0.0062), zMin * 0.85, zMax * 1.1);
      cam.z = z; cam.x = gest.dz.wx - (gest.dz.sx - view.w / 2) / z; cam.y = gest.dz.wy - (gest.dz.sy - view.h / 2) / z;
      return;
    }
    if (ptrs.size === 1) {
      gest.maxD = Math.max(gest.maxD, Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy));
      if (!gest.moved && Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 9) { gest.moved = true; gest.lx = e.clientX; gest.ly = e.clientY; camAnim = null; }
      if (gest.moved) {
        const dx = e.clientX - gest.lx, dy = e.clientY - gest.ly;
        gest.lx = e.clientX; gest.ly = e.clientY;
        const L = limits(cam.z);
        const rx = (cam.x < L.x0 && dx > 0) || (cam.x > L.x1 && dx < 0) ? 0.35 : 1;
        const ry = (cam.y < L.y0 && dy > 0) || (cam.y > L.y1 && dy < 0) ? 0.35 : 1;
        cam.x -= dx * rx / cam.z; cam.y -= dy * ry / cam.z;
        samples.push({ t: nowS(), x: e.clientX, y: e.clientY }); if (samples.length > 8) samples.shift();
      }
    }
  }, { passive: false });
  function endPointer(e) {
    if (!ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (!gest) { if (!ptrs.size) canvas.classList.remove('dragging'); return; }
    if (gest.multi) {
      if (ptrs.size === 1) { // keep panning with the remaining finger
        const q = Array.from(ptrs.values())[0];
        gest.pinch = null; gest.lx = q.x; gest.ly = q.y; gest.moved = true; samples = [];
      }
      if (!ptrs.size) { lastMultiEnd = nowS(); gest = null; canvas.classList.remove('dragging'); }
      return;
    }
    if (ptrs.size) return;
    canvas.classList.remove('dragging');
    const g = gest; gest = null;
    const dur = nowS() - g.t;
    lastTouchT = nowS();
    if (g.zooming) { lastZoomTap = -9; return; }
    const clean = !g.stopper && nowS() - lastMultiEnd > 0.25 && e.type !== 'pointercancel';
    // a quick tap whose finger rolled a little (< 16 px) is still a tap: undo the tiny pan and tap where the finger landed
    if (g.moved && clean && g.maxD < 16 && dur < 0.35) {
      cam.x = g.cam0.x; cam.y = g.cam0.y; cam.z = g.cam0.z; vel.x = vel.y = 0;
      camAnim = g.anim0 && g.anim0.t < g.anim0.dur ? g.anim0 : null;
      handleTap(g.sx, g.sy, g); return;
    }
    if (g.moved) {
      // momentum from the last ~100ms of movement
      const tn = nowS(), recent = samples.filter(s => tn - s.t < 0.1);
      if (recent.length >= 2 && e.type !== 'pointercancel') {
        const a = recent[0], b = recent[recent.length - 1], dt = Math.max(0.016, b.t - a.t);
        vel.x = clamp((b.x - a.x) / dt, -4000, 4000); vel.y = clamp((b.y - a.y) / dt, -4000, 4000);
        if (tn - b.t > 0.06) vel.x = vel.y = 0; // finger stopped before lifting
      }
      if (g.dbl && pendingMiss === g.dbl) dropPending();
      return;
    }
    if (e.type === 'pointercancel') { if (g.dbl && pendingMiss === g.dbl) dropPending(); return; }
    // a clean tap: one finger that never moved, held up to 1.5 s (thumbs rest), not stopping a fling, not right after a pinch
    if (clean && dur < 1.5) handleTap(p.x, p.y, g);
    else if (g.dbl && pendingMiss === g.dbl) dropPending(); // not a clean second tap: forgive the first
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (G.mode !== 'play' && G.mode !== 'won') return;
    camAnim = null;
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.2 && !e.shiftKey) {
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018));
      zoomAt(e.clientX, e.clientY, clamp(cam.z * f, zMin, zMax));
    } else { cam.x += e.deltaX / cam.z; cam.y += e.deltaY / cam.z; }
    clampCam(true);
  }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // ------------------------------------------------------------------ tapping
  let lastZoomTap = -9;
  // a wrong tap shows its X and "nope" at once; the time is only charged 300 ms later, so a double-tap can still cancel it
  function dropPending() {
    if (!pendingMiss) return;
    clearTimeout(pendingMiss.timer);
    if (pendingMiss.mark) G.marks = G.marks.filter(m => m !== pendingMiss.mark);
    pendingMiss = null;
  }
  const isSmall = (t) => { const b = SCN.shapesBox(t.e); return Math.max(b[2] - b[0], b[3] - b[1]) < 26 || (t.id === 'champ' && t.e.spec.pose === 'peek'); };
  // tap pad in world units: 24 css px around the hit shape (30 px for small things and peeking Champ)
  const tapPad = (t) => clamp((t && isSmall(t) ? 30 : 24) / cam.z, 4, 45);
  function handleTap(sx, sy, g) {
    if (G.mode !== 'play' && G.mode !== 'won') return;
    const w = toWorld(sx, sy), tn = nowS(), S = G.S;
    if (tn - lastZoomTap < 0.45) { // second tap of a double-tap that already zoomed: no miss, but it can start the next double-tap
      dropPending();
      pendingMiss = { sx, sy, wx: 0, wy: 0, t: tn, free: true, timer: 0 }; lastZoomTap = -9; return;
    }
    if (G.mode === 'play') {
      // ignore the second tap of a double-tap on something just found
      if (lastFind && tn - lastFind.t < 0.45 && Math.hypot(sx - lastFind.sx, sy - lastFind.sy) < 45) return;
      const far = cam.z < zMin * 2.2; // at the full overview everything is a speck: taps only zoom
      if (!far && S.bonus && !G.leafFound && SCN.inShapes(S.bonus, w[0], w[1], clamp(30 / cam.z, 4, 45))) { findLeaf(sx, sy); return; }
      let best = null, bd = 1e9;
      for (const t of far ? [] : S.targets) {
        // a ducking Champ is tested where he is drawn right now (lower), so tapping his eyes over the edge counts
        const sdy = t.e.duck && !t.found ? R.sinkDy(t.e, G.t) * t.e.s : 0;
        if (!SCN.inShapes(t.e, w[0], w[1] - sdy, tapPad(t)) && !(sdy && SCN.inShapes(t.e, w[0], w[1], tapPad(t)))) continue;
        const b = SCN.shapesBox(t.e), d = Math.hypot((b[0] + b[2]) / 2 - w[0], (b[1] + b[3]) / 2 - w[1]);
        if (d < bd) { bd = d; best = t; }
      }
      if (best) {
        dropPending();
        if (best.found) { const c = G.circles.find(c => c.t === best); if (c) c.wig = G.t; A.tick(); return; }
        // tapped where he was, above where he is now: no penalty, just a word
        if (best.e.duck && R.sink(best.e, G.t) >= 0.3 && !SCN.inShapes(best.e, w[0], w[1] - R.sinkDy(best.e, G.t) * best.e.s, tapPad(best))) { ducked(best); return; }
        find(best, sx, sy); return;
      }
    }
    // double tap => zoom (cancels the pending miss). Generous window: real double-taps are often slow.
    if (pendingMiss && ((g && g.dbl === pendingMiss) || (tn - pendingMiss.t < 0.5 && Math.hypot(sx - pendingMiss.sx, sy - pendingMiss.sy) < 45))) {
      dropPending(); lastZoomTap = tn;
      const zin = cam.z < 1.0;
      animateCam(camFor(w[0], w[1], zin ? Math.min(zMax, 1.3) : Math.max(zMin, OPEN_Z), sx, sy), 0.4);
      A.zoom(zin);
      return;
    }
    if (pendingMiss) { const pm = pendingMiss; clearTimeout(pm.timer); pendingMiss = null; if (!pm.free) applyMiss(pm); }
    if (G.mode === 'play' && cam.z < MISS_Z) {
      // zoomed out, a wrong tap is never charged (lookalikes differ by a few pixels here): it just takes a closer look
      lastZoomTap = tn;
      const far = cam.z < zMin * 2.2;
      animateCam(camFor(w[0], w[1], far ? Math.min(zMax, Math.max(OPEN_Z, zMin * 3)) : Math.min(zMax, 1.2), sx, sy), far ? 0.4 : 0.3, easeOut);
      A.zoom(true);
      if (far && !G.zoomTipShown && !save.zoomTip) { G.zoomTipShown = true; save.zoomTip = true; persist(); toast('Zoom in, then tap what you spot'); }
      return;
    }
    const pm = { sx, sy, wx: w[0], wy: w[1], t: tn, free: G.mode !== 'play' };
    if (!pm.free) { pm.mark = { x: w[0], y: w[1], t: G.t }; G.marks.push(pm.mark); A.nope(); }
    pm.timer = setTimeout(() => { if (pendingMiss === pm) { pendingMiss = null; if (!pm.free) applyMiss(pm); } }, 400); // X shows now; the charge waits so a slowish double-tap still cancels it
    pendingMiss = pm;
  }
  // Champ ducked under just as you tapped: ripples, a word, no penalty
  function ducked(t) {
    const b = SCN.shapesBox(t.e);
    G.ripples.push({ x: t.e.x, y: t.e.y, w: (b[2] - b[0]) * 0.6, t0: G.t });
    toast('He ducked! Wait for him…'); A.tick(); buzz(8);
  }
  const DECOY_JOKES = { champ: ['Just a pool toy!', 'Only a kid in a dino hood!', 'Not a lake monster!'], woodchuck: ['That’s a squirrel!', 'A lost teddy bear!'], peeper: ['Wrong tourist!', 'Not lost enough!', 'Close, but no camera hat!'] };
  function applyMiss(pm) {
    if (G.mode !== 'play') return;
    G.combo = 0; G.lastFindAt = null;
    if (!save.played && G.kind !== 'rush' && (G.freeMisses || 0) < 2) { G.freeMisses = (G.freeMisses || 0) + 1; toast('Not that one (free this time)', true); return; }
    G.penalty += 5000; G.misses++;
    // a decoy? tell a little joke
    let joke = null;
    for (const d of G.S.decoys) if (SCN.inShapes(d, pm.wx, pm.wy, clamp(10 / cam.z, 2, 20))) { joke = d.kind === 'floaty' ? 'Just a pool toy!' : d.kind === 'squirrel' ? 'That\u2019s a squirrel!' : d.kind === 'teddy' ? 'A lost teddy bear!' : d.spec && d.spec.hat === 'dino' ? 'Only a kid in a dino hood!' : d.decoyOf === 'peeper' ? (d.spec.pose === 'map' ? 'Wrong tourist \u2014 check the hat!' : 'No map, not lost!') : 'Not that one!'; break; }
    if (G.kind === 'rush') { G.penalty -= 5000; G.rush.left = Math.max(0, G.rush.left - SCN.RUSH.miss); }
    toast((joke ? joke : 'Nope!') + (G.kind === 'rush' ? '  \u2212' + SCN.RUSH.miss / 1000 + 's' : '  +5s'), true);
    const tm = $('timer'); tm.classList.remove('pen'); void tm.offsetWidth; tm.classList.add('pen'); clearTimeout(applyMiss.t); applyMiss.t = setTimeout(() => tm.classList.remove('pen'), 900);
    buzz([12, 40, 12]);
  }
  const RUSH = SCN.RUSH;
  // Daily / Free Play: the clock is the real search time plus penalties. Rush: the time left.
  const shownTime = () => G.kind === 'rush' && G.rush ? G.rush.left : Math.max(0, G.elapsed + G.penalty);
  function find(t, sx, sy) {
    t.found = true; G.foundN++; save.found++;
    t.e.cel = G.t; t.e.duck = null; // found: Champ stops ducking so his circle shows him
    lastFind = { t: nowS(), sx, sy };
    const b = SCN.shapesBox(t.e);
    G.circles.push({ t, b, t0: G.t, wig: -9 });
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * TAU, sp = (90 + Math.random() * 200) / cam.z;
      G.parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 / cam.z, life: 0, max: 0.55 + Math.random() * 0.45, col: ['#ffd23f', '#ff5d73', '#ffffff', '#17b3a3'][i % 4], size: 3 + Math.random() * 3.5, star: i % 3 === 0 });
    }
    if (G.hint && G.hint.t === t) G.hint = null;
    const card = G.cards[G.S.targets.indexOf(t)];
    if (card) { card.classList.add('found'); card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse'); }
    if (G.sel === G.S.targets.indexOf(t)) selectCard(-1);
    if (!G.firstId) G.firstId = t.id;
    if (G.kind === 'rush') {
      // quick finds in a row build a combo: +1 s per step on top of the scene's gain, capped
      G.combo = G.lastFindAt != null && G.elapsed - G.lastFindAt < RUSH.comboWindow ? G.combo + 1 : 1;
      G.lastFindAt = G.elapsed;
      G.bestCombo = Math.max(G.bestCombo, G.combo);
      const add = G.rush.lv.gain + Math.min(G.rush.lv.cap, (G.combo - 1) * RUSH.comboStep);
      G.rush.left += add; G.rush.finds++;
      // a small "+4s" that floats up from just above the find ring, never over the thing you found (below it if there's no room)
      const tc = toScreen((b[0] + b[2]) / 2, (b[1] + b[3]) / 2), ry = Math.max(16, ((b[3] - b[1]) / 2 + 6) * cam.z);
      const above = tc[1] - ry - 14 > safe.t + 40;
      G.pops.push({ x: clamp(tc[0], 40, view.w - 40), y: above ? tc[1] - ry - 14 : tc[1] + ry + 16, dir: above ? -1 : 1, mini: true, t0: G.t, text: '+' + (add / 1000) + 's', big: G.combo >= 3 });
      if (G.combo >= 2) { const cb = $('combo'); cb.classList.remove('hot'); void cb.offsetWidth; cb.classList.add('hot'); }
    }
    A.find(G.foundN, G.kind === 'rush' ? G.combo : 1); if (G.kind === 'rush' && G.combo >= 2) A.combo(G.combo); if (t.id === 'champ') A.champ();
    buzz(G.combo >= 3 ? [18, 30, 18] : 18);
    if (t.id === 'champ') toast('You found Champ!'); // the title character gets a word; every other find is just ring + hop + chime
    updateHud();
    if (G.foundN >= G.S.targets.length) { if (G.kind === 'rush') rushClear(); else win(); }
  }
  function rushClear() {
    const clr = G.rush.lv.clear; G.rush.scenes++; G.rush.left += clr; A.final(); buzz([20, 50, 30]);
    G.mode = 'intro'; G.introT = -9; // clock stops until the next scene is up
    G.pops.push({ x: view.w / 2, y: (safe.t + safe.b) / 2, t0: G.t, text: '+' + clr / 1000 + 's', sub: 'SCENE CLEAR', big: true });
    const i = SC.THEME_ORDER.indexOf(G.theme);
    setTimeout(() => { if (G.kind === 'rush' && G.mode === 'intro') { G.rush.n++; startGame('rush', SC.THEME_ORDER[(i + 1) % 5], 'normal', (Math.random() * 1e9) >>> 0, true); } }, 1000);
  }

  function findLeaf(sx, sy) {
    if (pendingMiss) { clearTimeout(pendingMiss.timer); pendingMiss = null; }
    G.leafFound = true; save.leaves = (save.leaves || 0) + 1; persist();
    const e = G.S.bonus; e.cel = G.t; lastFind = { t: nowS(), sx, sy };
    G.circles.push({ t: { e, gold: true }, b: SCN.shapesBox(e), t0: G.t, wig: -9, gold: true });
    for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, sp = (120 + Math.random() * 240) / cam.z; const b = SCN.shapesBox(e); G.parts.push({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80 / cam.z, life: 0, max: 0.8 + Math.random() * 0.5, col: ['#ffd23f', '#fff6b0', '#f5b81a'][i % 3], size: 3 + Math.random() * 4, star: true }); }
    G.pops.push({ x: clamp(sx, 80, view.w - 80), y: clamp(sy - 24, safe.t + 40, view.h - 120), t0: G.t, text: '\u2605', sub: 'GOLDEN LEAF', big: true });
    A.leaf(); buzz([15, 40, 15, 40, 25]); updateHud();
  }

  // ------------------------------------------------------------------ hint: a circle that slowly closes in
  function onScreen(x, y, m) { const p = toScreen(x, y); m = m || 0; return p[0] > safe.l + m && p[0] < safe.r - m && p[1] > safe.t + m && p[1] < safe.b - m; }
  // a circle closes in on one thing you haven't found. It never takes the camera away: if the thing is on screen
  // nothing moves; if it's off screen the view pans (same zoom) once your finger has been off the glass for 1.5 s.
  function useHint(free) {
    if (G.mode !== 'play' || (G.hintCd > 0 && !free)) return;
    const S = G.S;
    let t = G.sel >= 0 && !S.targets[G.sel].found ? S.targets[G.sel] : null;
    if (!t) { t = S.targets.find(x => !x.found); if (!t) return; }
    const b = SCN.shapesBox(t.e), tx = (b[0] + b[2]) / 2, ty = (b[1] + b[3]) / 2, k = cam.z;
    $('callout').hidden = true;
    const R1 = Math.max(38 / k, Math.max(b[2] - b[0], b[3] - b[1]) * 0.8), R0 = Math.max(R1 * 1.6, 150 / k);
    const vis = onScreen(tx, ty, 12);
    // offset the start a little (<= 50 px) toward the middle of the view, so the circle stays on screen
    const sc = vis ? toScreen(tx, ty) : [0, 0], a = vis ? Math.atan2((safe.t + safe.b) / 2 - sc[1], (safe.l + safe.r) / 2 - sc[0]) + (Math.random() - 0.5) * 0.6 : Math.random() * TAU;
    const off = Math.min(50 / k, (R0 - R1) * 0.5);
    G.hint = { t, tx, ty, R0, R1, ox: Math.cos(a) * off, oy: Math.sin(a) * off, t0: G.t, dur: 5.5 };
    if (!vis) queueCam(camFor(tx, ty, cam.z, (safe.l + safe.r) / 2, (safe.t + safe.b) / 2), 0.5, () => !onScreen(tx, ty, 12));
    if (free) { G.freeHint = true; toast('Free hint! ' + t.name + ' is in the circle'); }
    else {
      G.hints++; G.hintCd = 15;
      if (G.kind === 'rush') G.rush.left = Math.max(1000, G.rush.left - RUSH.hint); else G.penalty += 10000;
      toast('Hint: ' + t.name + (G.kind === 'rush' ? '  −' + RUSH.hint / 1000 + 's' : '  +10s'));
    }
    A.hint(); buzz(10);
  }
  function hintCircle() {
    const h = G.hint; if (!h) return null;
    const u = clamp((G.t - h.t0) / h.dur, 0, 1), e = easeInOut(u);
    const r = lerp(h.R0, h.R1, e), k = (r - h.R1) / (h.R0 - h.R1);
    return { x: h.tx + h.ox * k, y: h.ty + h.oy * k, r, u };
  }

  // ------------------------------------------------------------------ HUD
  function toast(msg, bad) {
    const el = $('toast'); el.textContent = msg; el.classList.toggle('bad', !!bad);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1500);
  }
  function updateHud() {
    $('hudCount').textContent = G.kind === 'rush' ? 'Scene ' + G.rush.n + ' \u00b7 ' + G.rush.finds + ' found' : (G.kind === 'daily' ? 'Daily · ' : SCN.DIFF[G.diff].label + ' · ') + G.foundN + ' / ' + G.S.targets.length + ' found';
    $('timer').classList.toggle('low', G.kind === 'rush' && G.rush.left < 10000);
    $('timer').textContent = fmtTime(shownTime());
    const hb = $('btnHint');
    hb.classList.toggle('cool', G.hintCd > 0);
    $('hintCd').textContent = G.hintCd > 0 ? Math.ceil(G.hintCd) : '';
  }
  function buildTray() {
    const tray = $('tray'); tray.innerHTML = ''; G.cards = [];
    G.S.targets.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'tcard'; b.setAttribute('aria-label', 'Find: ' + t.name);
      const ic = R.icon(t.e, 112, 6); b.appendChild(ic);
      const ck = document.createElement('span'); ck.className = 'ck'; ck.textContent = '✓'; b.appendChild(ck);
      b.addEventListener('click', () => { A.unlock(); A.click(); hideCoach(); G.clockOn = true; selectCard(G.sel === i ? -1 : i, true); });
      tray.appendChild(b); G.cards.push(b);
      t.icon = ic;
    });
  }
  function selectCard(i, show) {
    G.sel = i;
    G.cards.forEach((c, k) => c.classList.toggle('sel', k === i));
    if (i >= 0 && show) showCallout(G.S.targets[i], 3200);
    else if (i < 0) $('callout').hidden = true;
  }
  function showCallout(t, ms) {
    const co = $('callout'), g = $('calloutIcon').getContext('2d');
    g.clearRect(0, 0, 112, 112); g.drawImage(t.icon, 0, 0);
    $('calloutName').textContent = (t.found ? '✓ ' : 'Find: ') + t.name;
    $('calloutBlurb').textContent = t.blurb;
    co.hidden = false; co.style.animation = 'none'; void co.offsetWidth; co.style.animation = '';
    clearTimeout(showCallout.t); showCallout.t = setTimeout(() => { co.hidden = true; }, ms || 3000);
  }
  let coachTimer = 0;
  function showCoach() { $('coach').hidden = false; coachTimer = setTimeout(hideCoach, 5200); }
  function hideCoach() { if ($('coach').hidden) return; $('coach').hidden = true; clearTimeout(coachTimer); if (!save.coached) { save.coached = true; persist(); } }

  // ------------------------------------------------------------------ flow
  function show(id, on) { $(id).hidden = !on; if (id === 'done') document.body.classList.toggle('results', !!on); } // the tray and side buttons hide under the results card
  function setPlayUI(on) { ['hud', 'tray', 'btnHint', 'btnFit'].forEach(id => show(id, on)); }
  function dailyInfo() {
    const key = SC.todayKey(), d = SC.hashStr('spotchamp-daily-' + key);
    return { key, seed: d, theme: SC.THEME_ORDER[d % SC.THEME_ORDER.length], diff: 'normal' };
  }
  function bestKey() { return G.kind === 'daily' ? 'daily' : G.theme + '/' + G.diff; }
  function startGame(kind, theme, diff, seed, keepRush) {
    if (G.mode === 'loading') return;
    if (kind === 'rush' && !keepRush) G.rush = { left: RUSH.start, finds: 0, scenes: 0, n: 1 };
    let extras = 5;
    if (kind === 'rush') { const L = G.rush.lv = RUSH.level(G.rush.n); diff = L.diff; extras = L.n - 3; } // the Rush ladder: longer lists, busier crowds
    G.dailyKey = kind === 'daily' ? dailyInfo().key : null;
    G.kind = kind; G.theme = theme; G.diff = diff; G.seed = seed >>> 0;
    if (kind === 'free') { save.theme = theme; save.diff = diff; persist(); }
    ['title', 'picker', 'pause', 'done', 'album'].forEach(id => show(id, false));
    const card = kind === 'rush' && keepRush; // between Rush scenes: a short "Scene 3" card over a cross-fade
    $('veilText').textContent = card ? '' : ['Gathering the crowd…', 'Setting up the stalls…', 'Hiding Champ…', 'Losing a leaf peeper…'][seed % 4];
    $('veilHead').textContent = card ? 'SCENE ' + G.rush.n : '';
    $('veilSub').textContent = card ? (extras + 3) + ' to find \u00b7 ' + { easy: 'light crowd', normal: 'busy crowd', hard: 'packed crowd' }[diff] + (G.rush.n >= 4 ? ' \u00b7 Champ ducks!' : '') : '';
    $('veil').classList.toggle('scenecard', card);
    $('veil').classList.remove('off');
    G.mode = 'loading';
    setTimeout(() => {
      const S = SCN.make({ theme, diff, seed: G.seed, bonus: kind === 'daily', extras });
      loadScene(S);
      G.mode = 'intro'; G.introT = 0; G.introLen = card ? 1.0 : 0.6; G.clockOn = false; G.playT0 = G.t; G.touched = false; camQ = null;
      if (kind === 'rush' && keepRush) G.clockOn = true;
      // Champ ducks behind his prop on later Rush scenes and Hard Free Play
      const ch = S.targets.find(t => t.id === 'champ');
      if (ch && ((kind === 'rush' && G.rush.n >= 4) || (kind === 'free' && diff === 'hard'))) ch.e.duck = { t0: G.t + 1.2 + Math.random() * 2 };
      G.elapsed = 0; G.penalty = 0; if (!(kind === 'rush' && keepRush)) { G.misses = 0; G.hints = 0; } G.foundN = 0; G.hint = null; G.hintCd = 0;
      G.circles = []; G.parts = []; G.marks = []; G.confetti = []; G.pops = []; G.ripples = []; G.firstId = null; G.combo = 0; if (!(kind === 'rush' && keepRush)) G.bestCombo = 0; G.comboSaved = 0; G.lastFindAt = null; G.leafFound = false; G.sel = -1; G.freeHint = false; G.freeMisses = 0; G.winFrame = false; G.zoomTipShown = false; G.nudged = false; $('timer').classList.remove('pen'); $('btnPause').classList.remove('res');
      lastFind = null; pendingMiss = null;
      $('hudTheme').textContent = SC.THEMES[theme].name;
      setPlayUI(true); buildTray(); computeSafe();
      // open on the overview for a beat, then ease in to the scan zoom (Rush's next scenes open already zoomed)
      const f = card ? openCam() : fitCam(); camAnim = null; cam.x = f.x; cam.y = f.y; cam.z = f.z;
      G.openAt = card ? 0 : G.t + 0.3;
      updateHud();
      setTimeout(() => $('veil').classList.add('off'), card ? 600 : 0);
      A.amb = true; A.setTheme(theme, SC.hashStr(SC.todayKey() + theme) ^ (G.seed & 0xffff)); A.apply(); A.start();
      G.cards.forEach((c, i) => setTimeout(() => c.classList.add('in'), 120 + i * 70));
      setTimeout(() => { if ((G.mode === 'intro' || G.mode === 'play') && G.sel < 0 && G.foundN === 0 && save.coached && G.kind !== 'rush') showCallout(G.S.targets[0], 2800); }, 1400);
      if (!save.coached) setTimeout(showCoach, 700);
    }, card ? 380 : 40); // the Rush card: build the next scene only once the veil is fully up, so it never shows through
  }
  function loadScene(S) {
    G.S = S;
    for (const e of S.ents) e.cel = null;
    R.setScene(S);
    snow = S.night ? Array.from({ length: 28 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 0.8, v: 0.03 + Math.random() * 0.04, w: Math.random() * 6 })) : null;
  }
  function win() {
    G.mode = 'won'; G.wonAt = G.t;
    if (G.hint) G.hint = null;
    const total = shownTime();
    const bk = bestKey(), dkey = G.dailyKey || dailyInfo().key, prev = G.kind === 'daily' ? save.daily[dkey] : save.bests[bk];
    const isBest = G.kind === 'daily' ? !prev : (!prev || total < prev); G.practice = false;
    if (G.kind === 'daily') {
      const key = dkey;
      if (prev) G.practice = true; else save.daily[key] = total;
      if (save.streak.last !== key) {
        const y = new Date(key + 'T12:00:00'); y.setDate(y.getDate() - 1);
        save.streak.n = save.streak.last === SC.todayKey(y) ? save.streak.n + 1 : 1; save.streak.last = key;
      }
    } else if (isBest) save.bests[bk] = total;
    save.played++; persist();
    toast('All found!'); hideCoach(); $('callout').hidden = true; $('btnPause').classList.add('res');
    A.final(); buzz([20, 50, 30]);
    G.winFrame = true; computeSafe(); camAnim = null;
    setTimeout(() => { if (G.mode === 'won') animateCam(fitCam(), 1.5); }, 350);
    for (let i = 0; i < 160; i++) G.confetti.push({ x: Math.random() * view.w, y: -20 - Math.random() * view.h * 0.6, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, col: ['#ffd23f', '#ff5d73', '#17b3a3', '#4d96ff', '#ffffff', '#c77dff'][i % 6], w: 6 + Math.random() * 6 });
    // results card: heading, stars, the time, one line, the ribbons you earned, buttons. Nothing else unless something unlocked.
    const thr = STAR_T[G.diff];
    const sec = total / 1000, stars = sec <= thr[0] ? 3 : sec <= thr[1] ? 2 : 1;
    $('doneStars').innerHTML = starHtml(stars);
    $('doneTime').innerHTML = fmtTime(total) + (G.kind === 'daily' && save.streak.n > 1 ? '<small class="streak">Day ' + save.streak.n + ' 🔥</small>' : '');
    // one plain line: how you did against your best, and what the next star needs ("3 stars: under 1:15")
    const goal = stars === 3 ? '' : (stars + 1) + ' stars: under ' + fmtTime(thr[stars === 2 ? 0 : 1] * 1000);
    const head = G.practice ? 'Practice · today’s score ' + fmtTime(prev) : isBest && prev ? 'New best! (was ' + fmtTime(prev) + ')' : isBest ? (goal ? '' : 'First clear') : 'Best ' + fmtTime(prev);
    $('doneBest').textContent = [head, goal].filter(Boolean).join(' · ');
    $('doneStats').innerHTML = ''; $('doneStats').hidden = true;
    // album stickers, XP and rank
    const newSt = [];
    const champT = G.S.targets.find(t => t.id === 'champ'), sk = champT && champT.e.spotKind;
    if (sk && !save.album.spots[sk]) { save.album.spots[sk] = 1; newSt.push('Champ ' + SCN.SPOTS[sk].toLowerCase()); }
    for (const t of G.S.targets) if (!CORE.includes(t.id) && !save.album.items[t.id]) { save.album.items[t.id] = 1; newSt.push(t.name); }
    const r0 = rankOf(save.xp);
    const ribs = RIBBONS.filter(rb => rb[2]()); save.ribbons = save.ribbons || {}; for (const rb of ribs) save.ribbons[rb[0]] = (save.ribbons[rb[0]] || 0) + 1;
    const xp = G.S.targets.length * 10 + stars * 15 + (G.leafFound ? 25 : 0) + newSt.length * 10 + ribs.length * 20;
    save.xp += xp; const r1 = rankOf(save.xp); persist();
    const earned = (G.leafFound ? ['★ Golden leaf'] : []).concat(ribs.map(rb => '✓ ' + rb[1])).slice(0, 3);
    const foot = [];
    if (r1.i > r0.i) foot.push('New rank: <b>' + r1.name + '</b>');
    if (newSt.length) foot.push(newSt.length === 1 ? 'New sticker: <b>' + newSt[0] + '</b>' : '<b>' + newSt.length + '</b> new stickers');
    $('doneExtra').innerHTML = (earned.length ? '<div class="ribs">' + earned.map(t => '<span class="rib on">' + t + '</span>').join('') + '</div>' : '') + (foot.length ? '<div class="foot">' + foot.join(' · ') + '</div>' : '');
    $('doneHead').textContent = G.kind === 'daily' ? 'DAILY CLEARED!' : 'SCENE CLEARED!';
    $('btnNext').textContent = G.kind === 'daily' ? 'PLAY RUSH' : 'NEXT SCENE';
    { const d = $('done'); d.style.visibility = 'hidden'; d.hidden = false; G.cardH = d.querySelector('.card').offsetHeight + 30; d.hidden = true; d.style.visibility = ''; computeSafe(); }
    setTimeout(() => { if (G.mode === 'won') show('done', true); }, 2600);
  }
  const STAR_T = { easy: [45, 90], normal: [75, 150], hard: [120, 240] }; // seconds for 3 / 2 stars
  const starHtml = (n) => [0, 1, 2].map(i => '<i class="' + (i < n ? 'on' : '') + '" style="animation-delay:' + (0.3 + i * 0.18) + 's">★</i>').join('');
  function endRush() {
    const R2 = G.rush; G.mode = 'won'; G.wonAt = G.t; G.hint = null; camQ = null;
    const prev = save.rushBest || 0, isBest = R2.finds > prev; if (isBest) save.rushBest = R2.finds;
    for (const t of G.S.targets) if (t.found) { if (t.id === 'champ' && t.e.spotKind) save.album.spots[t.e.spotKind] = 1; else if (!CORE.includes(t.id)) save.album.items[t.id] = 1; }
    const xp = R2.finds * 8 + R2.scenes * 30; const r0 = rankOf(save.xp); save.xp += xp; const r1 = rankOf(save.xp); save.rushes = (save.rushes || 0) + 1; persist();
    toast('Time’s up!'); A.final(); buzz([30, 60, 30]); hideCoach(); $('callout').hidden = true; $('btnPause').classList.add('res'); $('combo').hidden = true; document.body.classList.remove('combo');
    const stars = R2.finds >= 30 ? 3 : R2.finds >= 15 ? 2 : R2.finds >= 5 ? 1 : 0;
    $('doneHead').textContent = 'TIME’S UP!';
    $('doneStars').innerHTML = starHtml(stars);
    $('doneTime').textContent = R2.finds + (R2.finds === 1 ? ' find' : ' finds');
    const nx = stars < 3 ? ' · ' + (stars + 1) + (stars ? ' stars' : ' star') + ' at ' + [5, 15, 30][stars] + ' finds' : '';
    $('doneBest').textContent = !R2.finds ? 'Zoom in and tap what you spot!' : 'Reached scene ' + R2.n + ' · ' + (isBest ? (prev ? 'New best!' : 'First Rush!') : 'Best ' + prev) + nx;
    $('doneStats').innerHTML = ''; $('doneStats').hidden = true;
    $('doneExtra').innerHTML = r1.i > r0.i ? '<div class="foot">New rank: <b>' + r1.name + '</b></div>' : '';
    $('btnNext').textContent = 'RUSH AGAIN';
    G.winFrame = true; { const d = $('done'); d.style.visibility = 'hidden'; d.hidden = false; G.cardH = d.querySelector('.card').offsetHeight + 30; d.hidden = true; d.style.visibility = ''; } computeSafe();
    setTimeout(() => { if (G.mode === 'won') animateCam(fitCam(), 1.2); }, 300);
    setTimeout(() => { if (G.mode === 'won') show('done', true); }, 1500);
  }
  function pauseGame() {
    if (G.mode !== 'play' && G.mode !== 'intro') return;
    hideCoach();
    G.prevMode = G.mode; G.mode = 'paused';
    $('pauseInfo').innerHTML = G.kind === 'rush' ? 'Scene ' + G.rush.n + ' \u00b7 ' + G.rush.finds + ' found \u00b7 ' + fmtTime(shownTime()) + ' left' : G.foundN + ' of ' + G.S.targets.length + ' found · ' + fmtTime(shownTime()) + (ribbonHtml() ? '<div class="ribs">' + ribbonHtml() + '</div>' : '');
    $('btnRestart').hidden = G.kind === 'daily';
    show('pause', true); A.paused = true; A.apply();
  }
  function resumeGame() { if (G.mode !== 'paused') return; G.mode = G.prevMode || 'play'; show('pause', false); A.paused = false; A.apply(); }
  function toTitle() {
    ['pause', 'done', 'picker', 'album'].forEach(id => show(id, false));
    setPlayUI(false); $('callout').hidden = true; hideCoach();
    G.circles = []; G.confetti = []; G.pops = []; G.marks = []; G.parts = []; G.ripples = []; G.hint = null; camQ = null; $('combo').hidden = true; document.body.classList.remove('combo');
    G.mode = 'title'; A.amb = false; A.paused = false; A.setTheme('title'); A.apply();
    computeSafe();
    startAttract();
    show('title', true); refreshTitle();
  }
  function startAttract() {
    const d = dailyInfo();
    if (!G.attract || G.attract.key !== d.key) {
      const S = SCN.make({ theme: d.theme, diff: 'normal', seed: d.seed ^ 77 });
      G.attract = { key: d.key, S };
    }
    loadScene(G.attract.S);
    G.attractT = 0;
  }
  const CORE = ['champ', 'woodchuck', 'peeper'];
  // optional goals for every scene: earn ribbons (and XP) for playing sharp
  // a free (first-game) hint or free miss still voids its ribbon
  const RIBBONS = [['champ', 'Champ first', () => G.firstId === 'champ'], ['clean', 'No misses', () => G.misses === 0 && !G.freeMisses], ['nohint', 'No hints', () => G.hints === 0 && !G.freeHint]];
  const ribbonLost = (id) => (id === 'nohint' && (G.hints > 0 || G.freeHint)) || (id === 'clean' && (G.misses > 0 || G.freeMisses)) || (id === 'champ' && G.firstId && G.firstId !== 'champ');
  // pause panel: only the ribbons you can still earn (none once they're all gone); never a list of what you lost
  const ribbonHtml = () => RIBBONS.filter(rb => !ribbonLost(rb[0])).map(rb => '<span class="rib">' + rb[1] + '</span>').join('');
  const RANKS = [[0, 'Rookie Spotter'], [150, 'Keen Eye'], [400, 'Sharp Spotter'], [900, 'Eagle Eye'], [1800, 'Champ Whisperer'], [3500, 'Lake Legend']];
  function rankOf(xp) { let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++; return { i, name: RANKS[i][1], lo: RANKS[i][0], hi: RANKS[i + 1] ? RANKS[i + 1][0] : null }; }
  const ALL_ITEMS = Object.keys(SCN.TARGETS).filter(id => !CORE.includes(id));
  function albumCounts() { return { s: Object.keys(save.album.spots).length, sn: Object.keys(SCN.SPOTS).length, i: Object.keys(save.album.items).length, in: ALL_ITEMS.length }; }
  const iconCache = {};
  function stickerIcon(key, build) { if (!iconCache[key]) { const e = build(); e.parts = SC.KINDS[e.kind].parts(e.spec); e.flip = false; iconCache[key] = R.icon(e, 108, 6); } return iconCache[key]; }
  // a sticker picture for each hiding spot: the spot's prop with Champ in it
  const SPOT_ART = { stall: [['stallback', 'stall'], { w: 64, c1: '#ff9f43', c2: '#fff4d6', goods: 'creemee', sign: 'CREEMEES' }, -20, 'peek'], fountain: [['fountainB', '*', 'fountainF'], {}, -22, 'neck'], pool: [['poolB', '*', 'poolF'], {}, -17, 'neck'], hay: [['hay'], {}, -17, 'peek'], pumpkins: [['pumpkins'], {}, -15, 'peek'], tub: [['tubB', '*', 'tubF'], {}, -13, 'neck'], sandcastle: [['sandcastle'], {}, -12, 'peek'], table: [['table'], { w: 50, goods: 'water', cloth: '#4d96ff' }, -16, 'peek'], portajohn: [['portajohn'], {}, -49, 'peek'], snowbank: [['snowbank'], { w: 70 }, -17, 'peek'], float: [['float'], { deco: 'flake', col: '#7b6cf6' }, -28, 'peek'], inflatables: [['inflatable'], { k: 'snowman' }, 0, 'peek', 24], lake: [[], {}, 0, 'neck'] };
  function spotIcon(kind) {
    if (iconCache['spot:' + kind]) return iconCache['spot:' + kind];
    const N = 108, c = document.createElement('canvas'); c.width = c.height = N; const g2 = c.getContext('2d');
    const A2 = SPOT_ART[kind] || SPOT_ART.stall, parts = A2[0], spec = A2[1];
    let bw = 60, bh = 70; for (const pp of parts) if (pp !== '*') { const b = SC.PROPS[pp].b(Object.assign({ p: pp }, spec)); bw = Math.max(bw, b[2] - b[0]); bh = Math.max(bh, b[3] - b[1] + 30); }
    const sc = (N - 10) / Math.max(bw, bh), ox = N / 2, oy = N - 8;
    const champ = () => { g2.setTransform(sc, 0, 0, sc, ox + (A2[4] || 0) * sc, oy + A2[2] * sc); SC.KINDS.champ.draw(g2, { pose: A2[3], water: A2[3] === 'neck' }, 'body'); };
    if (kind === 'lake') { g2.setTransform(sc, 0, 0, sc, ox, oy); g2.fillStyle = '#5ec4e8'; g2.beginPath(); g2.ellipse(0, -2, 48, 12, 0, 0, Math.PI * 2); g2.fill(); champ(); }
    for (const pp of parts) { if (pp === '*') { champ(); continue; } g2.setTransform(sc, 0, 0, sc, ox, oy); SC.KINDS.prop.draw(g2, Object.assign({ p: pp }, spec), 'body'); }
    if (!parts.includes('*') && kind !== 'lake') champ();
    return (iconCache['spot:' + kind] = c);
  }
  function buildAlbum() {
    const ac = albumCounts();
    $('albumInfo').textContent = ac.s + ' / ' + ac.sn + ' hiding spots \u00b7 ' + ac.i + ' / ' + ac.in + ' finds \u00b7 ' + (save.leaves || 0) + ' golden leaves';
    const mk = (box, got, label, icon) => { const d = document.createElement('div'); d.className = 'stick' + (got ? '' : ' miss'); const c = document.createElement('canvas'); c.width = c.height = 108; c.getContext('2d').drawImage(icon, 0, 0); d.appendChild(c); d.appendChild(document.createTextNode(got ? label : '???')); box.appendChild(d); };
    const sp = $('stickSpots'); sp.innerHTML = '';
    Object.keys(SCN.SPOTS).forEach((k) => mk(sp, save.album.spots[k], SCN.SPOTS[k], spotIcon(k)));
    const it = $('stickItems'); it.innerHTML = '';
    for (const id of ALL_ITEMS) mk(it, save.album.items[id], SCN.TARGETS[id].name, stickerIcon(id, () => { const t = SCN.makeTargetSpec(id, SC.rng(SC.hashStr(id)), 'festival'); return { kind: t.kind, spec: t.spec }; }));
  }
  function streakAlive() {
    if (!save.streak.n || !save.streak.last) return false;
    const y = new Date(); y.setDate(y.getDate() - 1);
    return save.streak.last === SC.todayKey() || save.streak.last === SC.todayKey(y);
  }
  function refreshTitle() {
    const d = dailyInfo(), best = save.daily[d.key];
    const rk = rankOf(save.xp), ac = albumCounts();
    $('rankName').textContent = rk.name; $('rankXp').textContent = save.xp + ' XP' + (rk.hi ? ' / ' + rk.hi : '');
    $('rankBar').style.width = (rk.hi ? Math.round(100 * (save.xp - rk.lo) / (rk.hi - rk.lo)) : 100) + '%';
    $('albumCount').textContent = (ac.s + ac.i) + ' / ' + (ac.sn + ac.in);
    $('rushBest').textContent = save.rushBest ? 'best ' + save.rushBest + ' finds' : 'beat the clock';
    $('dailyInfo').textContent = SC.THEMES[d.theme].name + (best ? ' · best ' + fmtTime(best) : ' · new today') + (streakAlive() ? ' · \ud83d\udd25 ' + save.streak.n + '-day streak' : '');
  }

  // ------------------------------------------------------------------ menus
  function toggles(elId) {
    const el = $(elId); el.innerHTML = '';
    const mk = (label, key) => {
      const b = document.createElement('button'); b.className = 'tog' + (save[key] ? '' : ' off'); b.textContent = label;
      b.addEventListener('click', () => { A.unlock(); save[key] = !save[key]; A[key] = save[key]; persist(); A.apply(); b.classList.toggle('off', !save[key]); A.click(); });
      el.appendChild(b);
    };
    mk('Sound', 'sound'); mk('Music', 'music');
  }
  function buildPicker() {
    const th = $('themes'); th.innerHTML = '';
    for (const id of SC.THEME_ORDER) {
      const T = SC.THEMES[id], b = document.createElement('button'); b.className = 'theme' + (id === G.theme ? ' sel' : '');
      const c = document.createElement('canvas'); c.width = 260; c.height = 180;
      const g = c.getContext('2d'), sc = 260 / 1100;
      g.setTransform(sc, 0, 0, sc, -450 * sc, -60 * sc);
      try { const plan = T.plan(SC.rng(SC.hashStr(id)), { gy0: T.gy0 }); T.paint(g, plan, [450, 60, 1550, 820]); } catch (e) {}
      b.appendChild(c);
      const best = save.bests[id + '/' + G.diff];
      b.insertAdjacentHTML('beforeend', '<span>' + T.name + '</span>' + (best ? '<em>' + fmtTime(best) + '</em>' : ''));
      b.addEventListener('click', () => { A.click(); G.theme = id; buildPicker(); });
      th.appendChild(b);
    }
    const ds = $('diffs'); ds.innerHTML = '';
    for (const id of ['easy', 'normal', 'hard']) {
      const b = document.createElement('button'); b.className = 'chip' + (id === G.diff ? ' sel' : '');
      b.innerHTML = SCN.DIFF[id].label + '<small>' + { easy: 'light crowd', normal: 'busy', hard: 'packed' }[id] + '</small>';
      b.addEventListener('click', () => { A.click(); G.diff = id; buildPicker(); });
      ds.appendChild(b);
    }
  }
  $('btnDaily').addEventListener('click', () => { A.unlock(); A.click(); const d = dailyInfo(); startGame('daily', d.theme, d.diff, d.seed); });
  $('btnFree').addEventListener('click', () => { A.unlock(); A.click(); G.theme = save.theme; G.diff = save.diff; buildPicker(); show('title', false); show('picker', true); });
  const startRush = () => startGame('rush', SC.THEME_ORDER[(Math.random() * 5) | 0], 'easy', (Math.random() * 1e9) >>> 0);
  $('btnRush').addEventListener('click', () => { A.unlock(); A.click(); startRush(); });
  $('btnAlbum').addEventListener('click', () => { A.unlock(); A.click(); buildAlbum(); show('title', false); show('album', true); $('album').scrollTop = 0; const ac = document.querySelector('.albumcard'); if (ac) ac.scrollTop = 0; });
  $('btnAlbumX').addEventListener('click', () => { A.click(); show('album', false); show('title', true); refreshTitle(); });
  $('btnAlbumBack').addEventListener('click', () => { A.click(); show('album', false); show('title', true); refreshTitle(); });
  $('btnBack').addEventListener('click', () => { A.click(); show('picker', false); show('title', true); });
  $('btnGo').addEventListener('click', () => { A.unlock(); A.click(); startGame('free', G.theme, G.diff, (Math.random() * 1e9) >>> 0); });
  $('btnPause').addEventListener('click', () => { A.unlock(); A.click(); if (G.mode === 'won') { show('done', true); G.winFrame = true; computeSafe(); animateCam(fitCam(), 0.6); return; } pauseGame(); });
  $('btnResume').addEventListener('click', () => { A.click(); resumeGame(); });
  $('btnRestart').addEventListener('click', () => { A.click(); show('pause', false); startGame(G.kind === 'daily' ? 'free' : G.kind, G.theme, G.diff, (Math.random() * 1e9) >>> 0); });
  $('btnQuit').addEventListener('click', () => { A.click(); toTitle(); });
  $('btnMenu').addEventListener('click', () => { A.click(); toTitle(); });
  $('btnLook').addEventListener('click', () => { A.click(); show('done', false); G.winFrame = false; computeSafe(); });
  $('btnNext').addEventListener('click', () => {
    A.click();
    if (G.kind === 'rush' || G.kind === 'daily') { startRush(); return; } // after the Daily, the next thing to play is Rush
    const i = SC.THEME_ORDER.indexOf(G.theme);
    startGame('free', SC.THEME_ORDER[(i + 1) % SC.THEME_ORDER.length], G.diff, (Math.random() * 1e9) >>> 0);
  });
  $('btnHint').addEventListener('click', () => { A.unlock(); useHint(); });
  $('btnFit').addEventListener('click', () => { A.unlock(); A.zoom(false); animateCam(fitCam(), 0.5); });
  document.addEventListener('keydown', (e) => {
    if (G.mode !== 'play' && G.mode !== 'won' && G.mode !== 'paused') return;
    const k = e.key;
    if (k === 'p' || k === 'P' || k === 'Escape') { if (G.mode === 'paused') resumeGame(); else pauseGame(); return; }
    if (k === 'm' || k === 'M') { save.sound = !save.sound; A.sound = save.sound; A.apply(); persist(); return; }
    if (G.mode === 'paused') return;
    const step = 90 / cam.z;
    if (k === 'ArrowLeft') cam.x -= step; else if (k === 'ArrowRight') cam.x += step; else if (k === 'ArrowUp') cam.y -= step; else if (k === 'ArrowDown') cam.y += step;
    else if (k === '+' || k === '=') animateCam(camFor(...toWorld(view.w / 2, view.h / 2), Math.min(zMax, cam.z * 1.6), view.w / 2, view.h / 2), 0.25);
    else if (k === '-' || k === '_') animateCam(camFor(...toWorld(view.w / 2, view.h / 2), Math.max(zMin, cam.z / 1.6), view.w / 2, view.h / 2), 0.25);
    else if (k === '0') animateCam(fitCam(), 0.4);
    else if (k === 'h' || k === 'H') useHint();
    else return;
    e.preventDefault(); clampCam(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (!window.__T.noPause) pauseGame(); A.suspend(); }
    else A.resume();
  });
  window.addEventListener('blur', () => { if (!window.__T.noPause) pauseGame(); });

  // ------------------------------------------------------------------ update
  let snow = null;
  function update(dt) {
    G.t += dt;
    if (G.mode === 'intro') { G.introT += dt; if (G.introT > (G.introLen || 0.6)) G.mode = 'play'; }
    // opening: after a beat on the overview, ease in to the scan zoom (unless the player already took over)
    if (G.openAt && G.t >= G.openAt) { G.openAt = 0; if (!G.touched && !ptrs.size && (G.mode === 'intro' || G.mode === 'play')) animateCam(openCam(), 0.75, easeOut); }
    // queued automatic camera moves (hint pans) wait for the finger to be gone for 1.5 s
    if (camQ && !ptrs.size && nowS() - lastTouchT > 1.5 && G.mode === 'play') { const q = camQ; camQ = null; if (!q.still || q.still()) animateCam(q.to, q.dur); }
    if (G.mode === 'play' && !G.clockOn && (G.t - G.playT0 > 6)) G.clockOn = true;
    if (G.mode === 'play' && G.clockOn && G.kind === 'rush') { G.rush.left -= dt * 1000; if (G.rush.left <= 0) { G.rush.left = 0; endRush(); } else if (G.rush.left < 10000 && Math.floor(G.rush.left / 1000) !== G.rush.tick) { G.rush.tick = Math.floor(G.rush.left / 1000); A.tick(); } }
    if (G.mode === 'play' && G.clockOn) { G.elapsed += dt * 1000; if (G.hintCd > 0) G.hintCd = Math.max(0, G.hintCd - dt); }
    // a brand-new player who hasn't spotted anything in 25 s gets one free hint (the Hint button pulses for 3 s first)
    if (G.mode === 'play' && !save.played && !G.freeHint && G.foundN === 0 && G.clockOn && !G.hint && G.kind !== 'rush') {
      if (G.elapsed > 22000 && !G.nudged) { G.nudged = true; const hb = $('btnHint'); hb.classList.remove('nudge'); void hb.offsetWidth; hb.classList.add('nudge'); setTimeout(() => hb.classList.remove('nudge'), 3000); }
      if (G.elapsed > 25000) useHint(true);
    }
    // camera
    if (camAnim) {
      camAnim.t += dt;
      const u = clamp(camAnim.t / camAnim.dur, 0, 1), e = (camAnim.ease || easeInOut)(u), f = camAnim.from, to = camAnim.to;
      cam.z = Math.exp(lerp(Math.log(f.z), Math.log(to.z), e));
      // keep the path natural: interpolate the screen-centre world point
      cam.x = lerp(f.x, to.x, e); cam.y = lerp(f.y, to.y, e);
      if (u >= 1) camAnim = null;
    } else if (G.mode === 'title' || G.mode === 'boot') {
      G.attractT = (G.attractT || 0) + dt;
      const a = G.attractT * 0.05;
      cam.z = Math.max(zMin * 2.4, zMin);
      const L = limits(cam.z);
      cam.x = lerp(L.x0, L.x1, 0.5 + 0.45 * Math.sin(a)); cam.y = lerp(L.y0, L.y1, 0.55 + 0.4 * Math.sin(a * 0.7 + 1));
    } else if (!ptrs.size) {
      // momentum + soft edges
      cam.x -= vel.x * dt / cam.z; cam.y -= vel.y * dt / cam.z;
      const damp = Math.exp(-4.2 * dt); vel.x *= damp; vel.y *= damp;
      if (Math.hypot(vel.x, vel.y) < 12) vel.x = vel.y = 0;
      // zoom springs back inside its range
      if (cam.z > zMax * 1.001 || cam.z < zMin * 0.999) { const tz = clamp(cam.z, zMin, zMax), c = toWorld(view.w / 2, view.h / 2); cam.z = lerp(cam.z, tz, 1 - Math.exp(-dt * 14)); if (Math.abs(cam.z - tz) < tz * 0.002) cam.z = tz; cam.x = c[0]; cam.y = c[1]; }
      const L = limits(cam.z), kk = 1 - Math.exp(-dt * 14);
      if (cam.x < L.x0) { cam.x += (L.x0 - cam.x) * kk; if (vel.x > 0) vel.x = 0; } else if (cam.x > L.x1) { cam.x += (L.x1 - cam.x) * kk; if (vel.x < 0) vel.x = 0; }
      if (cam.y < L.y0) { cam.y += (L.y0 - cam.y) * kk; if (vel.y > 0) vel.y = 0; } else if (cam.y > L.y1) { cam.y += (L.y1 - cam.y) * kk; if (vel.y < 0) vel.y = 0; }
    }
    // particles
    for (const p of G.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 / cam.z * dt; p.vx *= 0.97; }
    G.parts = G.parts.filter(p => p.life < p.max);
    G.marks = G.marks.filter(m => G.t - m.t < 0.9);
    for (const c of G.confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; c.vx += Math.sin(G.t * 3 + c.w) * 30 * dt; }
    G.confetti = G.confetti.filter(c => c.y < view.h + 30);
    if (G.mode === 'play' || G.mode === 'won') { $('timer').textContent = fmtTime(shownTime()); const low = G.kind === 'rush' && G.mode === 'play' && G.rush.left < 10000; if ($('timer').classList.contains('low') !== low) $('timer').classList.toggle('low', low); }
    { // Rush only: the combo pill appears from x2, its bar draining over the combo window
      const cb = $('combo'), left = G.kind === 'rush' && G.lastFindAt != null && G.mode === 'play' && G.combo >= 2 ? RUSH.comboWindow - (G.elapsed - G.lastFindAt) : -1;
      const on = left > 0;
      if (cb.hidden === on) { cb.hidden = !on; document.body.classList.toggle('combo', on); } // toasts drop below the pill
      if (on) { const txt = 'COMBO \u00d7' + G.combo; if ($('comboText').textContent !== txt) $('comboText').textContent = txt; $('comboBar').style.transform = 'scaleX(' + (left / RUSH.comboWindow).toFixed(3) + ')'; }
    }
    G.pops = G.pops.filter(q => G.t - q.t0 < 1.3);
    G.ripples = (G.ripples || []).filter(q => G.t - q.t0 < 1);
    if (G.mode === 'play') { const hb = $('btnHint'); hb.classList.toggle('cool', G.hintCd > 0); const cd = G.hintCd > 0 ? '' + Math.ceil(G.hintCd) : ''; if ($('hintCd').textContent !== cd) $('hintCd').textContent = cd; }
  }

  // ------------------------------------------------------------------ draw
  let settleT = 0, snap = null;
  function render(dt) {
    if (!G.S) return;
    const moving = !!camAnim || ptrs.size > 0 || Math.hypot(vel.x, vel.y) > 5;
    const pinching = (gest && gest.pinch) || (camAnim && Math.abs(camAnim.from.z - camAnim.to.z) > 1e-3);
    settleT = moving ? 0 : settleT + dt;
    const title = G.mode === 'title';
    const budget = pinching ? 0 : moving ? 2.5 : 6;
    // the still reveal map (won, camera at rest): draw the world once at full resolution and reuse that frame, so a slow
    // phone keeps its frame rate for the confetti without dropping resolution. Anything that moves the camera redraws.
    const key = G.mode === 'won' && !moving && settleT > 0.4 ? [cam.x, cam.y, cam.z, view.dpr, canvas.width, canvas.height, G.S.seed].join() : null;
    if (key && snap && snap.key === key) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(snap.cv, 0, 0); }
    else {
      const pend = R.draw(ctx, cam, view, { t: G.t, settled: !pinching, budget: title ? 4 : budget, sharp: G.mode === 'won' ? (cam.z < 0.4 ? 1.7 : 1.12) : 1 }); // the reveal / Explore map: sprites at or above on-screen size, scaled down smoothly
      if (key && !pend) { if (!snap) snap = { cv: document.createElement('canvas') }; snap.cv.width = canvas.width; snap.cv.height = canvas.height; snap.cv.getContext('2d').drawImage(canvas, 0, 0); snap.key = key; }
      else if (!key && snap) { snap.key = null; }
    }
    drawOverlay();
  }
  function drawOverlay() {
    const d = view.dpr, k = cam.z;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    // snow (night parade)
    if (snow) { // light snow, and none over the field once you're zoomed in to search
      const gyS = cam.z >= 0.9 && G.S ? toScreen(0, G.S.gy0)[1] : 1e9;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (const f of snow) { f.y += f.v * 0.016; if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); } const x = (f.x + Math.sin(G.t * 0.8 + f.w) * 0.01) * view.w, y = f.y * view.h; if (y > gyS) continue; ctx.beginPath(); ctx.arc(x, y, f.s, 0, TAU); ctx.fill(); }
    }
    // ripples where Champ ducked under
    for (const q of G.ripples || []) {
      const u = (G.t - q.t0), p = toScreen(q.x, q.y);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * (1 - u)).toFixed(3) + ')'; ctx.lineWidth = 2;
      for (const d of [0, 0.25]) { const v = clamp(u - d, 0, 1); if (v <= 0) continue; ctx.beginPath(); ctx.ellipse(p[0], p[1], (q.w * 0.5 + 30 * v) * k / Math.max(k, 0.6), (q.w * 0.15 + 8 * v) * k / Math.max(k, 0.6), 0, 0, TAU); ctx.stroke(); }
    }
    // hint circle: dim outside, ring closing in
    const hc = hintCircle();
    if (hc && G.mode === 'play') {
      const s = toScreen(hc.x, hc.y), r = hc.r * k;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, view.w, view.h); ctx.arc(s[0], s[1], r, 0, TAU, true);
      ctx.fillStyle = 'rgba(24,16,40,' + (0.5 + 0.12 * hc.u).toFixed(3) + ')'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,248,230,0.9)'; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -G.t * 30;
      ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      // arrow when it is off screen
      if (s[0] < safe.l || s[0] > safe.r || s[1] < safe.t || s[1] > safe.b) {
        const cx = clamp(s[0], safe.l + 30, safe.r - 30), cy = clamp(s[1], safe.t + 30, safe.b - 30), a = Math.atan2(s[1] - cy, s[0] - cx);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.fillStyle = '#17b3a3'; ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    // found circles
    for (const c of G.circles) {
      const u = clamp((G.t - c.t0) / 0.38, 0, 1);
      const b = c.b, s = toScreen((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
      let rx = Math.max(16, ((b[2] - b[0]) / 2 + 6) * k), ry = Math.max(16, ((b[3] - b[1]) / 2 + 6) * k);
      const pop = u < 1 ? lerp(1.5, 1, easeOutBack(u)) : 1;
      const wig = G.t - c.wig < 0.4 ? Math.sin((G.t - c.wig) * 40) * 0.08 * (1 - (G.t - c.wig) / 0.4) : 0;
      ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(-0.12 + wig); ctx.scale(pop, pop);
      const end = -Math.PI / 2 + (TAU + 0.5) * easeOut(u);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, -Math.PI / 2, end); ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,248,230,0.95)'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, -Math.PI / 2, end); ctx.lineWidth = 3.6; ctx.strokeStyle = c.gold ? '#f5b81a' : '#ff3d6e'; ctx.stroke();
      ctx.restore();
      if (G.mode === 'won' && !c.gold) { // little numbered badge for the final reveal
        const i = G.S.targets.indexOf(c.t) + 1, bx = s[0] + rx * 0.75, by = s[1] - ry * 0.85;
        ctx.fillStyle = '#ff3d6e'; ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, 9, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '12px "Luckiest Guy", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i, bx, by + 1);
      }
    }
    // floating "-3s COMBO x3" popups
    for (const q of G.pops) {
      const u = (G.t - q.t0) / 1.3, y = q.y + (q.mini ? 26 * (q.dir || -1) : -46) * easeOut(u), sc = (u < 0.15 ? easeOutBack(u / 0.15) : 1) * (q.mini ? 0.6 : 1);
      ctx.save(); ctx.globalAlpha = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25; ctx.translate(q.x, y); ctx.scale(sc, sc);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.font = (q.big ? 30 : 24) + 'px "Luckiest Guy", "Arial Black", sans-serif';
      { const pw = Math.max(q.sub ? 118 : 64, ctx.measureText(q.text).width + 26), ph = q.sub ? 54 : 34, py = q.sub ? -18 : -17; ctx.fillStyle = '#2b2140'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-pw / 2, py, pw, ph, 14) : ctx.rect(-pw / 2, py, pw, ph); ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.lineWidth = 6; ctx.strokeStyle = '#2b2140'; ctx.strokeText(q.text, 0, 0); ctx.fillStyle = q.text[0] === '+' ? '#7bd389' : '#ffd23f'; ctx.fillText(q.text, 0, 0);
      if (q.sub) { ctx.font = '15px "Luckiest Guy", "Arial Black", sans-serif'; ctx.lineWidth = 5; ctx.strokeText(q.sub, 0, 24); ctx.fillStyle = '#fff8e6'; ctx.fillText(q.sub, 0, 24); }
      ctx.restore();
    }
    // nope marks
    for (const m of G.marks) {
      const u = (G.t - m.t) / 0.9, s = toScreen(m.x, m.y), wig = Math.sin(u * 40) * 7 * (1 - u);
      ctx.save(); ctx.globalAlpha = 1 - easeInOut(u); ctx.translate(s[0] + wig, s[1]);
      ctx.fillStyle = 'rgba(255,93,115,0.9)'; ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke();
      ctx.restore();
    }
    // find bursts
    for (const p of G.parts) {
      const s = toScreen(p.x, p.y), a = 1 - p.life / p.max;
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      if (p.star) { ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(p.life * 6); ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? p.size * 0.45 : p.size * 1.3, an = i * Math.PI / 5; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(s[0], s[1], p.size * a, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (const c of G.confetti) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.col; ctx.fillRect(-c.w / 2, -c.w * 0.3, c.w, c.w * 0.6); ctx.restore(); }
  }

  // ------------------------------------------------------------------ loop
  let last = performance.now(), frameTimes = [];
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frameTimes.push(dt); if (frameTimes.length > 240) frameTimes.shift();
    if (!window.__T.manual) { update(dt); render(dt); if (!document.hidden) adaptDpr(dt); }
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ test hooks
  function rasterCoverage(S, t) {
    // exact pixel check: draw the target, then punch out everything drawn in front of it
    const e = t.e, b = e.box, sc = 2, pad = 2;
    const w = Math.ceil((b[2] - b[0]) * sc) + pad * 2, h = Math.ceil((b[3] - b[1]) * sc) + pad * 2;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
    const put = (o) => { const f = o.flip ? -1 : 1; for (const p of o.parts) { g.setTransform(sc * o.s * f, 0, 0, sc * o.s, (o.x - b[0]) * sc + pad, (o.y - b[1]) * sc + pad); SC.KINDS[o.kind].draw(g, o.spec, p.name); } };
    put(e);
    const count = () => { const d = g.getImageData(0, 0, w, h).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 60) n++; return n; };
    const before = count();
    g.globalCompositeOperation = 'destination-out';
    for (const o of S.ents) { if (o === e || o.noHit) continue; if (!(o.z > e.z || (o.z === e.z && o.id > e.id))) continue; const ob = o.box; if (ob[0] > b[2] || ob[2] < b[0] || ob[1] > b[3] || ob[3] < b[1]) continue; put(o); }
    g.globalCompositeOperation = 'source-over';
    const after = count();
    return before ? 1 - after / before : 1;
  }
  window.__T = {
    noPause: false, manual: false,
    start(o) { o = o || {}; startGame(o.kind || 'free', o.theme || 'festival', o.diff || 'normal', o.seed != null ? o.seed : 12345); },
    step(ms) { const n = Math.ceil(ms / 16.67); for (let i = 0; i < n; i++) update(1 / 60); render(1 / 60); return this.state(); },
    state() { return { mode: G.mode, theme: G.theme, diff: G.diff, found: G.foundN, total: G.S ? G.S.targets.length : 0, elapsed: Math.round(G.elapsed), penalty: G.penalty, misses: G.misses, hints: G.hints, cam: { x: Math.round(cam.x), y: Math.round(cam.y), z: +cam.z.toFixed(3) }, zMin: +zMin.toFixed(3), zMax, ents: G.S ? G.S.ents.length : 0, targets: G.S ? G.S.targets.map(t => ({ id: t.id, x: Math.round(t.e.x), y: Math.round(t.e.y), found: t.found })) : [] }; },
    scene: () => G.S, cam: () => ({ ...cam }), view: () => ({ ...view, safe }),
    setCam(x, y, z) { camAnim = null; camQ = null; G.openAt = 0; vel.x = vel.y = 0; cam.x = x; cam.y = y; cam.z = z; },
    rush: () => G.rush ? { left: Math.round(G.rush.left), n: G.rush.n, finds: G.rush.finds, scenes: G.rush.scenes, lv: G.rush.lv } : null,
    sink: () => { const t = G.S.targets.find(t => t.id === 'champ'); return t && t.e.duck ? R.sink(t.e, G.t) : 0; },
    camAnim: () => !!camAnim,
    lastDown: () => G.lastDown || null,
    // where a target is on screen right now (CSS px)
    screenOf(id) { const t = G.S.targets.find(t => t.id === id); const b = SCN.shapesBox(t.e); return toScreen((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); },
    focus(id, z) { const t = G.S.targets.find(t => t.id === id); const b = SCN.shapesBox(t.e); const c = camFor((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, z || 2, view.w / 2, (safe.t + safe.b) / 2); this.setCam(c.x, c.y, c.z); return toScreen((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); },
    tap(sx, sy, clean) { if (clean) { lastFind = null; lastZoomTap = -9; } handleTap(sx, sy); }, // clean: ignore the double-tap guards (scripted players)
    findAll() { for (const t of G.S.targets) if (!t.found) { lastFind = null; lastZoomTap = -9; t.e.duck = null; const p = this.focus(t.id, 2); handleTap(p[0], p[1]); } return this.state(); },
    hint: () => useHint(),
    leaf() { const e = G.S.bonus; if (!e) return null; const b = SCN.shapesBox(e); const c = camFor((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 2, view.w / 2, (safe.t + safe.b) / 2); this.setCam(c.x, c.y, c.z); return toScreen((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); },
    // test-only: rebuild a play state between separate driver runs (found ids, time, camera)
    restore(o) {
      for (const id of o.found || []) { const t = G.S.targets.find(x => x.id === id); if (t && !t.found) { t.found = true; G.foundN++; G.circles.push({ t, b: SCN.shapesBox(t.e), t0: G.t - 1, wig: -9 }); const c = G.cards[G.S.targets.indexOf(t)]; if (c) c.classList.add('found'); } }
      if (o.elapsed != null) G.elapsed = o.elapsed; if (o.penalty != null) G.penalty = o.penalty; if (o.misses != null) G.misses = o.misses;
      if (o.cam) this.setCam(o.cam.x, o.cam.y, o.cam.z);
      updateHud(); return this.state();
    },
    stats: () => ({ ...R.stats, dpr: view.dpr, fps: Math.round(frameTimes.length / frameTimes.reduce((a, b) => a + b, 0)) }),
    // fairness over many seeds: analytic + pixel coverage, bounds, decoy distance
    fairness(n, diffs, base) {
      const out = { scenes: 0, issues: [], maxRaster: {}, maxShape: {}, meanRaster: {} }, sum = {};
      for (const theme of SC.THEME_ORDER) for (const diff of (diffs || ['easy', 'normal', 'hard'])) for (let i = 0; i < (n || 3); i++) {
        const S = SCN.make({ theme, diff, seed: (base || 500) + i * 101 });
        out.scenes++;
        for (const s of SCN.check(S)) out.issues.push(theme + '/' + diff + '/' + i + ' ' + s);
        for (const t of S.targets) {
          const rc = rasterCoverage(S, t), sc = SCN.coverage(S, t.e);
          out.maxRaster[t.id] = Math.max(out.maxRaster[t.id] || 0, +rc.toFixed(2));
          out.maxShape[t.id] = Math.max(out.maxShape[t.id] || 0, +sc.toFixed(2));
          const m = sum[diff] || (sum[diff] = [0, 0]); m[0] += rc; m[1]++; out.meanRaster[diff] = +(m[0] / m[1]).toFixed(3);
          if (rc > SCN.DIFF[diff].cover + 0.03) out.issues.push(theme + '/' + diff + '/' + i + ' ' + t.id + ' pixel-covered ' + Math.round(rc * 100) + '%');
        }
      }
      return out;
    },
    rasterCoverage: (id) => rasterCoverage(G.S, G.S.targets.find(t => t.id === id)),
    // measure draw cost at a zoom level for `frames` frames (manual stepping, so it works in a hidden pane too)
    perf(z, frames, pan) {
      const was = this.manual; this.manual = true;
      const c0 = { ...cam }; camAnim = null; vel.x = vel.y = 0;
      cam.z = z || zMin; clampCam(true);
      const L = limits(cam.z);
      for (let i = 0; i < 40; i++) { update(1 / 60); R.draw(ctx, cam, view, { t: G.t, settled: true, budget: 50 }); } // warm caches
      ctx.getImageData(0, 0, 1, 1); // the first pixel read-back is a one-time browser cost; keep it out of the numbers
      const ms = [];
      for (let i = 0; i < (frames || 120); i++) {
        if (pan) { cam.x = lerp(L.x0, L.x1, 0.5 + 0.5 * Math.sin(i * 0.05)); cam.y = lerp(L.y0, L.y1, 0.5 + 0.5 * Math.cos(i * 0.04)); }
        update(1 / 60);
        const t0 = performance.now(); R.draw(ctx, cam, view, { t: G.t, settled: true, budget: pan ? 2.5 : 6 }); drawOverlay(); ctx.getImageData(0, 0, 1, 1); ms.push(performance.now() - t0);
      }
      const zz = cam.z; Object.assign(cam, c0); this.manual = was;
      ms.sort((a, b) => a - b);
      return { z: +zz.toFixed(2), avg: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2), p95: +ms[Math.floor(ms.length * 0.95)].toFixed(2), max: +ms[ms.length - 1].toFixed(2), drawn: R.stats.drawn, ents: G.S.ents.length, spriteMB: R.stats.spriteMB, tileMB: R.stats.tileMB };
    },
  };

  // ------------------------------------------------------------------ boot
  layout();
  toggles('togglesTitle'); toggles('togglesPause');
  // logo Champ
  {
    const c = $('logoChamp'), g = c.getContext('2d'), e = { kind: 'champ', spec: { pose: 'peek' }, parts: SC.KINDS.champ.parts({ pose: 'peek' }), flip: false };
    g.drawImage(R.icon(e, 160, 4), 0, 0);
  }
  G.mode = 'title';
  startAttract();
  computeSafe();
  refreshTitle();
  window.__booted = true;
  setTimeout(() => $('veil').classList.add('off'), 60);
  requestAnimationFrame((t) => { last = t; loop(t); });
})();
