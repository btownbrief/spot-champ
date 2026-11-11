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
    zMax = Math.max(3.6, zMin * 6);
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
  let zMin = 0.2, zMax = 3.6;
  const vel = { x: 0, y: 0 };
  let camAnim = null;
  function limits(z) {
    const sw = safe.r - safe.l, sh = safe.b - safe.t, L = {};
    if (W * z <= sw) L.x0 = L.x1 = W / 2 - ((safe.l + safe.r) / 2 - view.w / 2) / z;
    else { L.x0 = (view.w / 2 - safe.l) / z; L.x1 = W - (safe.r - view.w / 2) / z; }
    if (H * z <= sh) L.y0 = L.y1 = H / 2 - ((safe.t + safe.b) / 2 - view.h / 2) / z;
    else { L.y0 = (view.h / 2 - safe.t) / z; L.y1 = H - (safe.b - view.h / 2) / z; }
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
  function animateCam(to, dur) { camAnim = { from: { x: cam.x, y: cam.y, z: cam.z }, to, t: 0, dur: dur || 0.45 }; vel.x = vel.y = 0; }
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
    if (G.mode === 'title' || G.mode === 'boot') return;
    G.clockOn = true;
    if (ptrs.size === 1) {
      const speed = Math.hypot(vel.x, vel.y);
      // a touch that stops a fling never counts as a tap; a tap during a zoom animation still can (double-tap twice)
      gest = { sx: e.clientX, sy: e.clientY, t: nowS(), moved: false, multi: false, stopper: speed > 20 || nowS() - lastFling < 0.9, lx: e.clientX, ly: e.clientY };
      // second finger-down of a possible double-tap: hold the first tap's miss until this gesture resolves
      if (pendingMiss && nowS() - pendingMiss.t < 0.5 && Math.hypot(e.clientX - pendingMiss.sx, e.clientY - pendingMiss.sy) < 45) { clearTimeout(pendingMiss.timer); gest.dbl = pendingMiss; }
      // tap, then touch again and drag: one-thumb zoom (down = in, up = out), like map apps
      if (gest.dbl || nowS() - lastZoomTap < 0.45) { const w = toWorld(e.clientX, e.clientY); gest.dz = { y0: e.clientY, z0: cam.z, wx: w[0], wy: w[1], sx: e.clientX, sy: e.clientY }; }
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
      if (!gest.zooming) { gest.zooming = true; gest.moved = true; camAnim = null; if (pendingMiss && gest.dbl === pendingMiss) { clearTimeout(pendingMiss.timer); pendingMiss = null; } }
      const z = clamp(gest.dz.z0 * Math.exp((e.clientY - gest.dz.y0) * 0.0062), zMin * 0.85, zMax * 1.1);
      cam.z = z; cam.x = gest.dz.wx - (gest.dz.sx - view.w / 2) / z; cam.y = gest.dz.wy - (gest.dz.sy - view.h / 2) / z;
      return;
    }
    if (ptrs.size === 1) {
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
    if (g.zooming) { lastZoomTap = -9; return; }
    if (g.moved) {
      // momentum from the last ~100ms of movement
      const tn = nowS(), recent = samples.filter(s => tn - s.t < 0.1);
      if (recent.length >= 2 && e.type !== 'pointercancel') {
        const a = recent[0], b = recent[recent.length - 1], dt = Math.max(0.016, b.t - a.t);
        vel.x = clamp((b.x - a.x) / dt, -4000, 4000); vel.y = clamp((b.y - a.y) / dt, -4000, 4000);
        if (tn - b.t > 0.06) vel.x = vel.y = 0; // finger stopped before lifting
        if (Math.hypot(vel.x, vel.y) > 150) lastFling = tn;
      }
      if (g.dbl && pendingMiss === g.dbl) pendingMiss = null;
      return;
    }
    if (e.type === 'pointercancel') { if (g.dbl && pendingMiss === g.dbl) pendingMiss = null; return; }
    // a clean tap: one finger, no movement, short, not stopping a fling, not right after a pinch
    if (!g.stopper && dur < 0.5 && nowS() - lastMultiEnd > 0.25) handleTap(p.x, p.y, g);
    else if (g.dbl && pendingMiss === g.dbl) pendingMiss = null; // not a clean second tap: forgive the first
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
  let lastZoomTap = -9, lastFling = -9;
  function handleTap(sx, sy, g) {
    if (G.mode !== 'play' && G.mode !== 'won') return;
    const w = toWorld(sx, sy), tn = nowS(), S = G.S;
    if (tn - lastZoomTap < 0.45) { // second tap of a double-tap that already zoomed: no miss, but it can start the next double-tap
      if (pendingMiss) clearTimeout(pendingMiss.timer);
      pendingMiss = { sx, sy, wx: 0, wy: 0, t: tn, free: true, timer: 0 }; lastZoomTap = -9; return;
    }
    if (G.mode === 'play') {
      // ignore the second tap of a double-tap on something just found
      if (lastFind && tn - lastFind.t < 0.45 && Math.hypot(sx - lastFind.sx, sy - lastFind.sy) < 45) return;
      const far = cam.z < zMin * 2.2; // at the full overview everything is a speck: taps only zoom
      const pad = clamp(15 / cam.z, 3, 22);
      if (!far && S.bonus && !G.leafFound && SCN.inShapes(S.bonus, w[0], w[1], pad * 1.3)) { findLeaf(sx, sy); return; }
      let best = null, bd = 1e9;
      for (const t of far ? [] : S.targets) {
        const b0 = SCN.shapesBox(t.e), small = Math.max(b0[2] - b0[0], b0[3] - b0[1]) < 26;
        if (!SCN.inShapes(t.e, w[0], w[1], small ? clamp(20 / cam.z, 4, 26) : pad)) continue;
        const b = SCN.shapesBox(t.e), d = Math.hypot((b[0] + b[2]) / 2 - w[0], (b[1] + b[3]) / 2 - w[1]);
        if (d < bd) { bd = d; best = t; }
      }
      if (best) {
        if (pendingMiss) { clearTimeout(pendingMiss.timer); pendingMiss = null; }
        if (best.found) { const c = G.circles.find(c => c.t === best); if (c) c.wig = G.t; A.tick(); return; }
        find(best, sx, sy); return;
      }
    }
    // double tap => zoom (cancels the pending miss). Generous window: real double-taps are often slow.
    if (pendingMiss && ((g && g.dbl === pendingMiss) || (tn - pendingMiss.t < 0.5 && Math.hypot(sx - pendingMiss.sx, sy - pendingMiss.sy) < 45))) {
      clearTimeout(pendingMiss.timer); pendingMiss = null; lastZoomTap = tn;
      const zin = cam.z < zMax * 0.62;
      const z = zin ? Math.min(zMax, Math.max(cam.z * 2.4, zMin * 3)) : Math.max(zMin, cam.z / 3);
      animateCam(camFor(w[0], w[1], z, sx, sy), 0.4);
      A.zoom(zin);
      return;
    }
    if (pendingMiss) { clearTimeout(pendingMiss.timer); if (!pendingMiss.free) applyMiss(pendingMiss); pendingMiss = null; }
    // zoomed far out (things are only a few pixels): a tap just zooms in there, never a penalty
    if (G.mode === 'play' && cam.z < zMin * 2.2) {
      lastZoomTap = tn;
      animateCam(camFor(w[0], w[1], Math.min(zMax, Math.max(cam.z * 2.6, zMin * 3)), sx, sy), 0.4);
      A.zoom(true);
      if (!G.zoomTipShown && !save.zoomTip) { G.zoomTipShown = true; save.zoomTip = true; persist(); toast('Zoom in, then tap what you spot'); }
      return;
    }
    const pm = { sx, sy, wx: w[0], wy: w[1], t: tn, free: G.mode !== 'play' };
    // the miss is charged only once a second tap has had time to arrive
    pm.timer = setTimeout(() => { if (pendingMiss === pm) { pendingMiss = null; if (!pm.free) applyMiss(pm); } }, 460);
    pendingMiss = pm;
  }
  const DECOY_JOKES = { champ: ['Just a pool toy!', 'Only a kid in a dino hood!', 'Not a lake monster!'], woodchuck: ['That’s a squirrel!', 'A lost teddy bear!'], peeper: ['Wrong tourist!', 'Not lost enough!', 'Close, but no camera hat!'] };
  function applyMiss(pm) {
    if (G.mode !== 'play') return;
    G.combo = 0; G.lastFindAt = null;
    if (!save.played && G.kind !== 'rush' && (G.freeMisses || 0) < 2) { G.freeMisses = (G.freeMisses || 0) + 1; G.marks.push({ x: pm.wx, y: pm.wy, t: G.t }); toast('Not that one \u2014 no penalty in your first game', true); A.nope(); return; }
    G.penalty += 5000; G.misses++;
    G.marks.push({ x: pm.wx, y: pm.wy, t: G.t });
    // a decoy? tell a little joke
    let joke = null;
    for (const d of G.S.decoys) if (SCN.inShapes(d, pm.wx, pm.wy, 2)) { joke = d.kind === 'floaty' ? 'Just a pool toy!' : d.kind === 'squirrel' ? 'That\u2019s a squirrel!' : d.kind === 'teddy' ? 'A lost teddy bear!' : d.spec && d.spec.hat === 'dino' ? 'Only a kid in a dino hood!' : d.decoyOf === 'peeper' ? (d.spec.pose === 'map' ? 'Wrong tourist \u2014 check the hat!' : 'No map, not lost!') : 'Not that one!'; break; }
    if (G.kind === 'rush') { G.penalty -= 5000; G.rush.left = Math.max(0, G.rush.left - 4000); }
    toast((joke ? joke : 'Nope!') + (G.kind === 'rush' ? '  \u22124s' : '  +5s'), true);
    const tm = $('timer'); tm.classList.remove('pen'); void tm.offsetWidth; tm.classList.add('pen'); clearTimeout(applyMiss.t); applyMiss.t = setTimeout(() => tm.classList.remove('pen'), 900);
    A.nope(); buzz([12, 40, 12]);
  }
  const COMBO_MS = 15000;
  // time bonuses (combos, the golden leaf) can take at most half the search time off: no 0:00 clears
  const shownTime = () => G.kind === 'rush' && G.rush ? G.rush.left : Math.max(G.elapsed * 0.5, G.elapsed + G.penalty);
  const RUSH_MS = 90000;
  const CHEERS = ['Spotted', 'Gotcha', 'Nice eye', 'Found', 'There it is'];
  function find(t, sx, sy) {
    t.found = true; G.foundN++; save.found++;
    t.e.cel = G.t;
    lastFind = { t: nowS(), sx, sy };
    const b = SCN.shapesBox(t.e);
    G.circles.push({ t, b, t0: G.t, wig: -9 });
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * TAU, sp = (90 + Math.random() * 220) / cam.z;
      G.parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 / cam.z, life: 0, max: 0.6 + Math.random() * 0.5, col: ['#ffd23f', '#ff5d73', '#17b3a3', '#ffffff', '#4d96ff'][i % 5], size: 3 + Math.random() * 4, star: i % 3 === 0 });
    }
    if (G.hint && G.hint.t === t) G.hint = null;
    const card = G.cards[G.S.targets.indexOf(t)];
    if (card) { card.classList.add('found'); card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse'); }
    if (G.sel === G.S.targets.indexOf(t)) selectCard(-1);
    // quick finds in a row build a combo that knocks seconds off the clock
    G.combo = G.lastFindAt != null && G.elapsed - G.lastFindAt < COMBO_MS ? G.combo + 1 : 1;
    G.lastFindAt = G.elapsed;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    let bonus = 0;
    if (G.combo >= 2 && G.kind !== 'rush') { bonus = Math.min(G.combo, 6) * 1000; G.penalty -= bonus; G.comboSaved += bonus; }
    if (!G.firstId) G.firstId = t.id;
    const tb = toScreen((b[0] + b[2]) / 2, b[1]);
    G.pops.push({ x: clamp(tb[0], 70, view.w - 70), y: clamp(tb[1] - 40, safe.t + 70, view.h - 120), t0: G.t, text: bonus ? '\u2212' + bonus / 1000 + 's' : '\u2713', sub: G.combo >= 2 ? 'COMBO \u00d7' + G.combo : '', big: G.combo >= 3 });
    A.find(G.foundN, G.combo); if (G.combo >= 2) A.combo(G.combo); if (t.id === 'champ') A.champ();
    buzz(G.combo >= 3 ? [18, 30, 18] : 18);
    if (G.combo >= 2) { const cb = $('combo'); cb.classList.remove('hot'); void cb.offsetWidth; cb.classList.add('hot'); }
    updateHud();
    if (G.kind === 'rush') {
      const add = 4000 + Math.max(0, G.combo - 1) * 1000; G.rush.left += add; G.rush.finds++;
      G.pops[G.pops.length - 1].text = '+' + add / 1000 + 's';
      if (G.foundN >= G.S.targets.length) { G.rush.scenes++; G.rush.left += 15000; toast('Scene cleared! +15s'); A.final(); G.mode = 'intro'; const i = SC.THEME_ORDER.indexOf(G.theme); setTimeout(() => { if (G.kind === 'rush' && G.mode === 'intro') { G.mode = 'play'; startGame('rush', SC.THEME_ORDER[(i + 1) % 5], 'normal', (Math.random() * 1e9) >>> 0, true); } }, 1400); }
      else toast(t.id === 'champ' ? 'You found Champ!' : t.name + '!');
      updateHud(); return;
    }
    if (G.foundN >= G.S.targets.length) win();
    else toast(t.id === 'champ' ? 'You found Champ!' : CHEERS[(G.foundN + G.misses) % CHEERS.length] + ': ' + t.name + '!');
  }

  function findLeaf(sx, sy) {
    if (pendingMiss) { clearTimeout(pendingMiss.timer); pendingMiss = null; }
    G.leafFound = true; G.penalty -= 10000; save.leaves = (save.leaves || 0) + 1; persist();
    const e = G.S.bonus; e.cel = G.t; lastFind = { t: nowS(), sx, sy };
    G.circles.push({ t: { e, gold: true }, b: SCN.shapesBox(e), t0: G.t, wig: -9, gold: true });
    for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, sp = (120 + Math.random() * 240) / cam.z; const b = SCN.shapesBox(e); G.parts.push({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80 / cam.z, life: 0, max: 0.8 + Math.random() * 0.5, col: ['#ffd23f', '#fff6b0', '#f5b81a'][i % 3], size: 3 + Math.random() * 4, star: true }); }
    G.pops.push({ x: clamp(sx, 80, view.w - 80), y: clamp(sy - 24, safe.t + 40, view.h - 120), t0: G.t, text: '\u221210s', sub: 'GOLDEN LEAF', big: true });
    A.leaf(); buzz([15, 40, 15, 40, 25]); updateHud();
  }

  // ------------------------------------------------------------------ hint: a circle that slowly closes in
  function useHint() {
    if (G.mode !== 'play' || G.hintCd > 0) return;
    const S = G.S;
    let t = G.sel >= 0 && !S.targets[G.sel].found ? S.targets[G.sel] : null;
    if (!t) { t = S.targets.find(x => !x.found); if (!t) return; }
    const b = SCN.shapesBox(t.e), tx = (b[0] + b[2]) / 2, ty = (b[1] + b[3]) / 2;
    $('callout').hidden = true;
    const R0 = 440, R1 = Math.max(70, Math.max(b[2] - b[0], b[3] - b[1]) * 1.4);
    // offset the circle toward the middle of the scene so it never hangs off an edge
    const a = Math.atan2(H * 0.55 - ty, W / 2 - tx) + (Math.random() - 0.5) * 0.8, off = (R0 - R1) * 0.5;
    G.hint = { t, tx, ty, R0, R1, ox: Math.cos(a) * off, oy: Math.sin(a) * off, t0: G.t, dur: 5.5 };
    G.hints++; G.hintCd = 15; if (G.kind === 'rush') G.rush.left = Math.max(1000, G.rush.left - 8000); else G.penalty += 10000;
    toast('Hint: ' + t.name + (G.kind === 'rush' ? '  \u22128s' : '  +10s')); if (!G.hintTipShown && G.sel < 0) { G.hintTipShown = true; setTimeout(() => { if (G.hint) toast('Tip: tap a card to aim the hint'); }, 2600); }
    // pull back so the whole circle is in view
    const cx = tx + G.hint.ox, cy = ty + G.hint.oy;
    const zFit = Math.min((safe.r - safe.l) / (R0 * 2.2), (safe.b - safe.t) / (R0 * 2.2));
    animateCam(camFor(cx, cy, Math.max(zMin, Math.min(cam.z, zFit)), (safe.l + safe.r) / 2, (safe.t + safe.b) / 2), 0.6);
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
    $('hudCount').textContent = G.kind === 'rush' ? 'Rush \u00b7 ' + G.rush.finds + ' found' + (G.rush.scenes ? ' \u00b7 ' + G.rush.scenes + ' cleared' : '') : (G.kind === 'daily' ? 'Daily · ' : SCN.DIFF[G.diff].label + ' · ') + G.foundN + ' / ' + G.S.targets.length + ' found';
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
  function show(id, on) { $(id).hidden = !on; }
  function setPlayUI(on) { ['hud', 'tray', 'btnHint', 'btnFit'].forEach(id => show(id, on)); }
  function dailyInfo() {
    const key = SC.todayKey(), d = SC.hashStr('spotchamp-daily-' + key);
    return { key, seed: d, theme: SC.THEME_ORDER[d % SC.THEME_ORDER.length], diff: 'normal' };
  }
  function bestKey() { return G.kind === 'daily' ? 'daily' : G.theme + '/' + G.diff; }
  function startGame(kind, theme, diff, seed, keepRush) {
    if (G.mode === 'loading') return;
    if (kind === 'rush' && !keepRush) G.rush = { left: RUSH_MS, finds: 0, scenes: 0, best: 0 };
    G.dailyKey = kind === 'daily' ? dailyInfo().key : null;
    G.kind = kind; G.theme = theme; G.diff = diff; G.seed = seed >>> 0;
    if (kind === 'free') { save.theme = theme; save.diff = diff; persist(); }
    ['title', 'picker', 'pause', 'done', 'album'].forEach(id => show(id, false));
    $('veilText').textContent = ['Gathering the crowd…', 'Setting up the stalls…', 'Hiding Champ…', 'Losing a leaf peeper…'][seed % 4];
    $('veil').classList.remove('off');
    G.mode = 'loading';
    setTimeout(() => {
      const S = SCN.make({ theme, diff, seed: G.seed, bonus: kind === 'daily' });
      loadScene(S);
      G.mode = 'intro'; G.introT = 0; G.clockOn = false; G.playT0 = G.t;
      if (kind === 'rush' && keepRush) G.clockOn = true;
      G.elapsed = 0; G.penalty = 0; if (!(kind === 'rush' && keepRush)) { G.misses = 0; G.hints = 0; } G.foundN = 0; G.hint = null; G.hintCd = 0;
      G.circles = []; G.parts = []; G.marks = []; G.confetti = []; G.pops = []; G.firstId = null; G.combo = 0; if (!(kind === 'rush' && keepRush)) G.bestCombo = 0; G.comboSaved = 0; G.lastFindAt = null; G.leafFound = false; G.sel = -1; G.freeHint = false; G.freeMisses = 0; G.winFrame = false; G.zoomTipShown = false; G.hintTipShown = false; $('timer').classList.remove('pen'); $('btnPause').classList.remove('res');
      lastFind = null; pendingMiss = null;
      $('hudTheme').textContent = SC.THEMES[theme].name;
      setPlayUI(true); buildTray(); computeSafe();
      const f = fitCam(); cam.x = f.x; cam.y = f.y; cam.z = f.z;
      updateHud();
      $('veil').classList.add('off');
      A.amb = true; A.setTheme(theme, SC.hashStr(SC.todayKey() + theme) ^ (G.seed & 0xffff)); A.apply(); A.start();
      G.cards.forEach((c, i) => setTimeout(() => c.classList.add('in'), 120 + i * 70));
      setTimeout(() => { if ((G.mode === 'intro' || G.mode === 'play') && G.sel < 0 && G.foundN === 0 && save.coached && G.kind !== 'rush') showCallout(G.S.targets[0], 2800); }, 700);
      if (!save.coached) setTimeout(showCoach, 700);
    }, 40);
  }
  function loadScene(S) {
    G.S = S;
    for (const e of S.ents) e.cel = null;
    R.setScene(S);
    snow = S.night ? Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2.2, v: 0.03 + Math.random() * 0.05, w: Math.random() * 6 })) : null;
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
    // results card
    const thr = { easy: [90, 180], normal: [150, 300], hard: [240, 480] }[G.diff];
    const sec = total / 1000, stars = sec <= thr[0] ? 3 : sec <= thr[1] ? 2 : 1;
    $('doneStars').innerHTML = [0, 1, 2].map(i => '<i class="' + (i < stars ? 'on' : '') + '" style="animation-delay:' + (0.3 + i * 0.18) + 's">★</i>').join('');
    $('doneTime').textContent = fmtTime(total);
    const nextStar = stars === 3 ? '' : ' \u00b7 \u2605' + (stars + 1) + ' under ' + fmtTime(thr[stars === 2 ? 0 : 1] * 1000);
    $('doneBest').textContent = (G.practice ? 'Practice run \u00b7 today\u2019s score stays ' + fmtTime(prev) : isBest && prev ? 'New best! (was ' + fmtTime(prev) + ')' : isBest ? 'First clear!' : 'Best ' + fmtTime(prev)) + nextStar;
    const rows = [['Search', fmtTime(G.elapsed)], ['Misses', G.misses ? G.misses + ' (+' + G.misses * 5 + 's)' : '0'], ['Hints', G.hints ? G.hints + ' (+' + G.hints * 10 + 's)' : '0']];
    rows.push(['Best combo', G.bestCombo >= 2 ? '\u00d7' + G.bestCombo + ' (\u2212' + Math.round(G.comboSaved / 1000) + 's)' : '\u2013']);
    $('doneStats').innerHTML = rows.map(r => '<span>' + r[0] + '</span><b>' + r[1] + '</b>').join('');
    // album stickers, XP and rank
    const newSt = [];
    const champT = G.S.targets.find(t => t.id === 'champ'), sk = champT && champT.e.spotKind;
    if (sk && !save.album.spots[sk]) { save.album.spots[sk] = 1; newSt.push('Champ ' + SCN.SPOTS[sk].toLowerCase()); }
    for (const t of G.S.targets) if (!CORE.includes(t.id) && !save.album.items[t.id]) { save.album.items[t.id] = 1; newSt.push(t.name); }
    const r0 = rankOf(save.xp);
    const ribs = RIBBONS.filter(rb => rb[2]()); save.ribbons = save.ribbons || {}; for (const rb of ribs) save.ribbons[rb[0]] = (save.ribbons[rb[0]] || 0) + 1;
    const xp = G.S.targets.length * 10 + stars * 15 + Math.max(0, G.bestCombo - 1) * 5 + (G.leafFound ? 25 : 0) + newSt.length * 10 + ribs.length * 20;
    save.xp += xp; const r1 = rankOf(save.xp); persist();
    let ex = '+' + xp + ' XP' + (r1.i > r0.i ? ' \u00b7 new rank: <b>' + r1.name + '</b>!' : ' \u00b7 ' + r1.name);
    if (newSt.length) ex += '<br>New sticker' + (newSt.length > 1 ? 's' : '') + ': <b>' + newSt.slice(0, 2).join('</b>, <b>') + '</b>' + (newSt.length > 2 ? ' +' + (newSt.length - 2) + ' more' : '');
    if (G.kind === 'daily') ex += '<br>' + (G.leafFound ? 'Golden leaf found \u2713 (' + save.leaves + ' collected)' : 'You missed today\u2019s golden leaf');
    $('doneExtra').innerHTML = '<div class="ribs">' + ribbonHtml() + '</div>' + ex;
    $('doneHead').textContent = G.kind === 'daily' ? 'DAILY CLEARED!' : 'SCENE CLEARED!';
    $('btnNext').textContent = G.kind === 'daily' ? 'FREE PLAY' : 'NEXT SCENE';
    { const d = $('done'); d.style.visibility = 'hidden'; d.hidden = false; G.cardH = d.querySelector('.card').offsetHeight + 30; d.hidden = true; d.style.visibility = ''; computeSafe(); }
    setTimeout(() => { if (G.mode === 'won') show('done', true); }, 2600);
  }
  function endRush() {
    const R2 = G.rush; G.mode = 'won'; G.wonAt = G.t; G.hint = null;
    const prev = save.rushBest || 0, isBest = R2.finds > prev; if (isBest) save.rushBest = R2.finds;
    for (const t of G.S.targets) if (t.found) { if (t.id === 'champ' && t.e.spotKind) save.album.spots[t.e.spotKind] = 1; else if (!CORE.includes(t.id)) save.album.items[t.id] = 1; }
    const xp = R2.finds * 8 + R2.scenes * 30; const r0 = rankOf(save.xp); save.xp += xp; const r1 = rankOf(save.xp); save.rushes = (save.rushes || 0) + 1; persist();
    toast('Time\u2019s up!'); A.final(); buzz([30, 60, 30]); hideCoach(); $('callout').hidden = true; $('btnPause').classList.add('res'); $('combo').hidden = true;
    const stars = R2.finds >= 24 ? 3 : R2.finds >= 12 ? 2 : R2.finds >= 4 ? 1 : 0;
    $('doneHead').textContent = 'TIME\u2019S UP!';
    $('doneStars').innerHTML = [0, 1, 2].map(i => '<i class="' + (i < stars ? 'on' : '') + '" style="animation-delay:' + (0.3 + i * 0.18) + 's">\u2605</i>').join('');
    $('doneTime').textContent = R2.finds + (R2.finds === 1 ? ' find' : ' finds');
    $('doneBest').textContent = !R2.finds ? 'Zoom in and tap what you spot!' : isBest ? (prev ? 'New best! (was ' + prev + ')' : 'First Rush!') : 'Best ' + prev + ' finds';
    $('doneStats').innerHTML = [['Scenes cleared', R2.scenes], ['Best combo', G.bestCombo >= 2 ? '\u00d7' + G.bestCombo : '\u2013'], ['Misses', G.misses], ['Hints', G.hints]].map(r => '<span>' + r[0] + '</span><b>' + r[1] + '</b>').join('');
    $('doneExtra').innerHTML = '+' + xp + ' XP' + (r1.i > r0.i ? ' \u00b7 new rank: <b>' + r1.name + '</b>!' : ' \u00b7 ' + r1.name) + '<br>\u2605 at 12 and 24 finds';
    $('btnNext').textContent = 'RUSH AGAIN';
    G.winFrame = true; { const d = $('done'); d.style.visibility = 'hidden'; d.hidden = false; G.cardH = d.querySelector('.card').offsetHeight + 30; d.hidden = true; d.style.visibility = ''; } computeSafe();
    setTimeout(() => { if (G.mode === 'won') animateCam(fitCam(), 1.2); }, 300);
    setTimeout(() => { if (G.mode === 'won') show('done', true); }, 1500);
  }
  function pauseGame() {
    if (G.mode !== 'play' && G.mode !== 'intro') return;
    hideCoach();
    G.prevMode = G.mode; G.mode = 'paused';
    $('pauseInfo').innerHTML = G.foundN + ' of ' + G.S.targets.length + ' found · ' + fmtTime(shownTime()) + '<div class="ribs">' + ribbonHtml() + '</div>';
    $('btnRestart').hidden = G.kind === 'daily';
    show('pause', true); A.paused = true; A.apply();
  }
  function resumeGame() { if (G.mode !== 'paused') return; G.mode = G.prevMode || 'play'; show('pause', false); A.paused = false; A.apply(); }
  function toTitle() {
    ['pause', 'done', 'picker', 'album'].forEach(id => show(id, false));
    setPlayUI(false); $('callout').hidden = true; hideCoach();
    G.circles = []; G.confetti = []; G.pops = []; G.marks = []; G.parts = []; G.hint = null; $('combo').hidden = true;
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
  const RIBBONS = [['nohint', 'No hints', () => G.hints === 0], ['clean', 'No misses', () => G.misses === 0], ['champ', 'Champ first', () => G.firstId === 'champ'], ['combo', 'Combo \u00d74', () => G.bestCombo >= 4]];
  const ribbonLost = (id) => (id === 'nohint' && G.hints > 0) || (id === 'clean' && G.misses > 0) || (id === 'champ' && G.firstId && G.firstId !== 'champ');
  const ribbonHtml = () => RIBBONS.map(rb => '<span class="rib' + (rb[2]() ? ' on' : ribbonLost(rb[0]) ? ' lost' : '') + '">' + (rb[2]() ? '\u2713 ' : ribbonLost(rb[0]) ? '\u2715 ' : '') + rb[1] + '</span>').join('');
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
    $('rushBest').textContent = save.rushBest ? 'best ' + save.rushBest + ' finds' : '90 seconds';
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
  $('btnRush').addEventListener('click', () => { A.unlock(); A.click(); startGame('rush', SC.THEME_ORDER[(Math.random() * 5) | 0], 'normal', (Math.random() * 1e9) >>> 0); });
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
    if (G.kind === 'rush') { startGame('rush', SC.THEME_ORDER[(Math.random() * 5) | 0], 'normal', (Math.random() * 1e9) >>> 0); return; }
    if (G.kind === 'daily') { G.theme = save.theme; G.diff = save.diff; buildPicker(); show('done', false); show('picker', true); setPlayUI(false); G.mode = 'title'; computeSafe(); startAttract(); return; }
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
    if (G.mode === 'intro') { G.introT += dt; if (G.introT > 0.6) G.mode = 'play'; }
    if (G.mode === 'play' && !G.clockOn && (G.t - G.playT0 > 6)) G.clockOn = true;
    if (G.mode === 'play' && G.clockOn && G.kind === 'rush') { G.rush.left -= dt * 1000; if (G.rush.left <= 0) { G.rush.left = 0; endRush(); } else if (G.rush.left < 10000 && Math.floor(G.rush.left / 1000) !== G.rush.tick) { G.rush.tick = Math.floor(G.rush.left / 1000); A.tick(); } }
    if (G.mode === 'play' && G.clockOn) { G.elapsed += dt * 1000; if (G.hintCd > 0) G.hintCd = Math.max(0, G.hintCd - dt); }
    // a brand-new player who hasn't spotted anything yet gets one free hint, so the first game never stalls
    if (G.mode === 'play' && !save.played && !G.freeHint && G.foundN === 0 && G.clockOn && G.elapsed > 15000 && !G.hint && G.kind !== 'rush') {
      G.freeHint = true; G.hintTipShown = true; useHint();
      if (G.hint) { G.penalty -= 10000; G.hints--; G.hintCd = 0; toast('Free hint! ' + G.hint.t.name + ' is in the circle'); }
    }
    if (G.mode === 'play' && G.hint && !G.hint.zoomed && G.t - G.hint.t0 >= G.hint.dur && !ptrs.size) {
      G.hint.zoomed = true;
      const zf = Math.min(zMax, (safe.r - safe.l) / (G.hint.R1 * 2 * 1.7));
      if (cam.z < zf * 0.9) animateCam(camFor(G.hint.tx, G.hint.ty, zf, (safe.l + safe.r) / 2, (safe.t + safe.b) / 2), 0.8);
    }
    // camera
    if (camAnim) {
      camAnim.t += dt;
      const u = clamp(camAnim.t / camAnim.dur, 0, 1), e = easeInOut(u), f = camAnim.from, to = camAnim.to;
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
      if (cam.z > zMax * 1.001 || cam.z < zMin * 0.999) { const tz = clamp(cam.z, zMin, zMax), c = toWorld(view.w / 2, view.h / 2); cam.z = lerp(cam.z, tz, 1 - Math.exp(-dt * 14)); cam.x = c[0]; cam.y = c[1]; }
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
    {
      const cb = $('combo'), left = G.lastFindAt != null && G.mode === 'play' ? COMBO_MS - (G.elapsed - G.lastFindAt) : -1;
      const on = left > 0 && G.foundN > 0;
      if (cb.hidden === on) cb.hidden = !on;
      if (on) { const txt = G.combo >= 2 ? 'COMBO \u00d7' + G.combo : 'QUICK FIND = COMBO'; if ($('comboText').textContent !== txt) $('comboText').textContent = txt; $('comboBar').style.transform = 'scaleX(' + (left / COMBO_MS).toFixed(3) + ')'; }
    }
    G.pops = G.pops.filter(q => G.t - q.t0 < 1.3);
    if (G.mode === 'play') { const hb = $('btnHint'); hb.classList.toggle('cool', G.hintCd > 0); const cd = G.hintCd > 0 ? '' + Math.ceil(G.hintCd) : ''; if ($('hintCd').textContent !== cd) $('hintCd').textContent = cd; }
  }

  // ------------------------------------------------------------------ draw
  let settleT = 0;
  function render(dt) {
    if (!G.S) return;
    const moving = !!camAnim || ptrs.size > 0 || Math.hypot(vel.x, vel.y) > 5;
    const pinching = (gest && gest.pinch) || (camAnim && Math.abs(camAnim.from.z - camAnim.to.z) > 1e-3);
    settleT = moving ? 0 : settleT + dt;
    const title = G.mode === 'title';
    const budget = pinching ? 0 : moving ? 2.5 : 6;
    R.draw(ctx, cam, view, { t: G.t, settled: !pinching, budget: title ? 4 : budget });
    drawOverlay();
  }
  function drawOverlay() {
    const d = view.dpr, k = cam.z;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    // snow (night parade)
    if (snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const f of snow) { f.y += f.v * 0.016; if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); } const x = (f.x + Math.sin(G.t * 0.8 + f.w) * 0.01) * view.w, y = f.y * view.h; ctx.beginPath(); ctx.arc(x, y, f.s, 0, TAU); ctx.fill(); }
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
      const u = (G.t - q.t0) / 1.3, y = q.y - 46 * easeOut(u), sc = u < 0.15 ? easeOutBack(u / 0.15) : 1;
      ctx.save(); ctx.globalAlpha = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25; ctx.translate(q.x, y); ctx.scale(sc, sc);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      { const pw = q.sub ? 118 : 70, ph = q.sub ? 54 : 34, py = q.sub ? -18 : -17; ctx.fillStyle = '#2b2140'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-pw / 2, py, pw, ph, 14) : ctx.rect(-pw / 2, py, pw, ph); ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.font = (q.big ? 30 : 24) + 'px "Luckiest Guy", "Arial Black", sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#2b2140'; ctx.strokeText(q.text, 0, 0); ctx.fillStyle = q.text[0] === '\u2212' ? '#ffd23f' : '#7bd389'; ctx.fillText(q.text, 0, 0);
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
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
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
    setCam(x, y, z) { camAnim = null; vel.x = vel.y = 0; cam.x = x; cam.y = y; cam.z = z; },
    // where a target is on screen right now (CSS px)
    screenOf(id) { const t = G.S.targets.find(t => t.id === id); const b = SCN.shapesBox(t.e); return toScreen((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); },
    focus(id, z) { const t = G.S.targets.find(t => t.id === id); const b = SCN.shapesBox(t.e); const c = camFor((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, z || 2, view.w / 2, (safe.t + safe.b) / 2); this.setCam(c.x, c.y, c.z); return toScreen((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); },
    tap(sx, sy) { handleTap(sx, sy); },
    findAll() { for (const t of G.S.targets) if (!t.found) { lastFind = null; lastZoomTap = -9; const p = this.focus(t.id, 2); handleTap(p[0], p[1]); } return this.state(); },
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
      const out = { scenes: 0, issues: [], maxRaster: {}, maxShape: {} };
      for (const theme of SC.THEME_ORDER) for (const diff of (diffs || ['easy', 'normal', 'hard'])) for (let i = 0; i < (n || 3); i++) {
        const S = SCN.make({ theme, diff, seed: (base || 500) + i * 101 });
        out.scenes++;
        for (const s of SCN.check(S)) out.issues.push(theme + '/' + diff + '/' + i + ' ' + s);
        for (const t of S.targets) {
          const rc = rasterCoverage(S, t), sc = SCN.coverage(S, t.e);
          out.maxRaster[t.id] = Math.max(out.maxRaster[t.id] || 0, +rc.toFixed(2));
          out.maxShape[t.id] = Math.max(out.maxShape[t.id] || 0, +sc.toFixed(2));
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
