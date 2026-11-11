/* Spot Champ — scene generator. A scene is a list of entities placed by code, so the game always knows
   exactly where every target is. Same seed + theme + difficulty => same scene (works in node for tests). */
(function (root) {
  'use strict';
  const SC = root.SC;
  const { rng, hashStr, clamp } = SC;
  const W = 2000, H = 2400;

  const DIFF = {
    easy: { crowd: 185, cover: 0.2, peepDecoys: 2, champDecoys: 1, chuckDecoys: 1, peek: 0, label: 'Easy' },
    normal: { crowd: 360, cover: 0.3, peepDecoys: 3, champDecoys: 2, chuckDecoys: 2, peek: 0.3, label: 'Normal' },
    hard: { crowd: 440, cover: 0.4, peepDecoys: 5, champDecoys: 3, chuckDecoys: 3, peek: 0.8, label: 'Hard' },
  };

  // what the player hunts for
  const TARGETS = {
    champ: { name: 'Champ', blurb: 'The lake’s friendliest monster. Loves to pop up somewhere sneaky.' },
    woodchuck: { name: 'Woodchuck', blurb: 'Chubby, brown, standing up tall to see the fun.' },
    peeper: { name: 'Lost leaf peeper', blurb: 'Orange vest, teal bucket hat, camera, map held up high. Very lost.' },
    jug: { name: 'Maple syrup jug', blurb: 'Somebody left their syrup behind.' },
    duck: { name: 'Rubber duck', blurb: 'A tiny yellow duck on an adventure.' },
    mitten: { name: 'Purple mitten', blurb: 'One lonely purple mitten with white dots.' },
    kite: { name: 'Lost kite', blurb: 'A rainbow kite that came down to rest.' },
    skateboard: { name: 'Pink skateboard', blurb: 'Rolled away from its rider.' },
    snowman: { name: 'Tiny snowman', blurb: 'Small, round, wearing a teal scarf.' },
    pumpkin: { name: 'Jack-o’-lantern', blurb: 'The only pumpkin with a smile carved in.' },
    flamingo: { name: 'Lawn flamingo', blurb: 'A pink plastic flamingo, far from any lawn.' },
    trophy: { name: 'Gold trophy', blurb: 'Somebody’s prize, set down and forgotten.' },
    juggler: { name: 'Juggler', blurb: 'Three balls in the air, never drops one.' },
    cow: { name: 'Cow costume', blurb: 'A person in a black-and-white cow suit. Moo.' },
    unicycle: { name: 'Unicyclist', blurb: 'Wobbling along on one wheel.' },
    shades: { name: 'Dog in sunglasses', blurb: 'The coolest dog in town.' },
    banjo: { name: 'Banjo busker', blurb: 'Strumming a tune for the crowd.' },
    catpack: { name: 'Cat in a backpack', blurb: 'An orange cat riding along, peeking over a shoulder.' },
  };
  const EXTRAS = {
    festival: ['jug', 'duck', 'juggler', 'cow', 'unicycle', 'shades', 'banjo', 'skateboard', 'flamingo', 'catpack', 'kite'],
    market: ['jug', 'mitten', 'juggler', 'cow', 'shades', 'banjo', 'pumpkin', 'catpack', 'duck'],
    beach: ['duck', 'shades', 'kite', 'skateboard', 'flamingo', 'catpack', 'juggler', 'unicycle'],
    marathon: ['cow', 'unicycle', 'shades', 'skateboard', 'catpack', 'jug', 'duck', 'trophy'],
    winter: ['mitten', 'snowman', 'cow', 'shades', 'catpack', 'jug', 'juggler', 'banjo'],
  };

  // ---------------------------------------------------------------- entity helpers
  function scaleAt(S, y) { return 0.8 + 0.42 * clamp((y - S.gy0) / (H - S.gy0), 0, 1.1); }

  function partsOf(e) { return SC.KINDS[e.kind].parts(e.spec); }
  function computeBox(e) {
    const f = e.flip ? -1 : 1;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of e.parts) {
      const ox = p.off ? 0 : 0;
      const a = e.x + f * p.b[0] * e.s, b = e.x + f * p.b[2] * e.s;
      x0 = Math.min(x0, a, b); x1 = Math.max(x1, a, b);
      y0 = Math.min(y0, e.y + p.b[1] * e.s); y1 = Math.max(y1, e.y + p.b[3] * e.s);
    }
    e.box = [x0, y0, x1, y1];
  }
  function worldShapes(e) {
    if (e.ws) return e.ws;
    const f = e.flip ? -1 : 1, s = e.s, out = [];
    for (const q of SC.KINDS[e.kind].shape(e.spec)) {
      if (q.t === 'e') out.push({ t: 'e', x: e.x + f * q.x * s, y: e.y + q.y * s, rx: q.rx * s, ry: q.ry * s });
      else { const a = e.x + f * q.x0 * s, b = e.x + f * q.x1 * s; out.push({ t: 'r', x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y + q.y0 * s, y1: e.y + q.y1 * s }); }
    }
    return (e.ws = out);
  }
  function inShape(q, x, y, pad) {
    pad = pad || 0;
    if (q.t === 'e') { const dx = (x - q.x) / (q.rx + pad), dy = (y - q.y) / (q.ry + pad); return dx * dx + dy * dy <= 1; }
    return x >= q.x0 - pad && x <= q.x1 + pad && y >= q.y0 - pad && y <= q.y1 + pad;
  }
  function inShapes(e, x, y, pad) { for (const q of worldShapes(e)) if (inShape(q, x, y, pad)) return true; return false; }
  function shapesBox(e) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of worldShapes(e)) {
      if (q.t === 'e') { x0 = Math.min(x0, q.x - q.rx); x1 = Math.max(x1, q.x + q.rx); y0 = Math.min(y0, q.y - q.ry); y1 = Math.max(y1, q.y + q.ry); }
      else { x0 = Math.min(x0, q.x0); x1 = Math.max(x1, q.x1); y0 = Math.min(y0, q.y0); y1 = Math.max(y1, q.y1); }
    }
    return [x0, y0, x1, y1];
  }
  const after = (a, b) => a.z > b.z || (a.z === b.z && a.id > b.id); // a is drawn after b
  const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

  // fraction of the target's own shape covered by things drawn in front of it
  function coverage(S, t, detail) {
    const bx = shapesBox(t), step = Math.max(0.6, Math.min(bx[2] - bx[0], bx[3] - bx[1]) / 16);
    const occ = [];
    for (const e of S.ents) if (!e.dead && e !== t && after(e, t) && !e.noHit && overlap(e.box, bx)) occ.push(e);
    let tot = 0, cov = 0; const by = new Map();
    for (let y = bx[1] + step / 2; y < bx[3]; y += step) for (let x = bx[0] + step / 2; x < bx[2]; x += step) {
      if (!inShapes(t, x, y)) continue;
      tot++;
      for (const o of occ) if (inShapes(o, x, y, 2 * o.s)) { cov++; if (detail) by.set(o, (by.get(o) || 0) + 1); break; }
    }
    const f = tot ? cov / tot : 1;
    return detail ? { f, by, tot } : f;
  }

  // remove the crowd members covering a target most, until it's covered no more than `limit`.
  // Which occluders cover each sample point is worked out once, so each removal is cheap.
  function clearAround(S, t, limit) {
    const bx = shapesBox(t), step = Math.max(0.6, Math.min(bx[2] - bx[0], bx[3] - bx[1]) / 16);
    const occ = [];
    for (const e of S.ents) if (!e.dead && e !== t && after(e, t) && !e.noHit && overlap(e.box, bx)) occ.push(e);
    const pts = [];
    for (let y = bx[1] + step / 2; y < bx[3]; y += step) for (let x = bx[0] + step / 2; x < bx[2]; x += step) {
      if (!inShapes(t, x, y)) continue;
      const L = []; for (let i = 0; i < occ.length; i++) if (inShapes(occ[i], x, y, 2 * occ[i].s)) L.push(i);
      pts.push(L);
    }
    if (!pts.length || !occ.length) return;
    const alive = occ.map(() => true), cnt = new Int32Array(occ.length);
    for (let k = 0; k < 60; k++) {
      cnt.fill(0); let cov = 0;
      for (const L of pts) { let hit = false; for (const i of L) if (alive[i]) { hit = true; cnt[i]++; } if (hit) cov++; }
      if (cov / pts.length <= limit) return;
      let best = -1;
      for (let i = 0; i < occ.length; i++) { const o = occ[i]; if (alive[i] && (o.role === 'crowd' || o.role === 'decoy') && !o.fixed && (best < 0 || cnt[i] > cnt[best])) best = i; }
      if (best < 0 || !cnt[best]) return;
      alive[best] = false; occ[best].dead = true;
    }
  }

  // ---------------------------------------------------------------- builder
  function Builder(S, r) {
    const G = 10, gw = Math.ceil(W / G), gh = Math.ceil(H / G), grid = new Uint8Array(gw * gh);
    let nextId = 1;
    const api = {
      r, S,
      scale: (y) => scaleAt(S, y),
      add(kind, spec, x, y, o) {
        o = o || {};
        const hasText = spec && (spec.text || spec.top === 'jersey' || spec.pose === 'sign');
        const e = { id: nextId++, kind, spec, x, y, z: o.z != null ? o.z : y, s: o.s != null ? o.s : scaleAt(S, y), flip: !!o.flip && !hasText, ph: r() * 6.28, banim: o.banim || null, role: o.role || 'crowd', tid: o.tid || null, noHit: !!o.noHit, tint: o.tint };
        if (kind === 'item') e.s *= 1.45; // small things are scaled up so they stay findable
        e.parts = partsOf(e); computeBox(e);
        S.ents.push(e);
        if (o.foot) api.mark(x, y, o.foot[0] * e.s, o.foot[1] * e.s);
        return e;
      },
      free(x, y, hw, hd) {
        if (x - hw < 20 || x + hw > W - 20 || y - hd < S.gy0 || y + hd > H - 12) return false;
        const a = Math.floor((x - hw) / G), b = Math.floor((x + hw) / G), c = Math.floor((y - hd) / G), d = Math.floor((y + hd * 0.6) / G);
        for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) if (grid[j * gw + i]) return false;
        return true;
      },
      mark(x, y, hw, hd) {
        const a = clamp(Math.floor((x - hw) / G), 0, gw - 1), b = clamp(Math.floor((x + hw) / G), 0, gw - 1), c = clamp(Math.floor((y - hd) / G), 0, gh - 1), d = clamp(Math.floor((y + hd * 0.6) / G), 0, gh - 1);
        for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) grid[j * gw + i] = 1;
      },
      // find a free standing spot inside a zone
      spot(zone, hw, hd, tries) {
        for (let k = 0; k < (tries || 40); k++) {
          const x = r.range(zone.x0, zone.x1), y = r.range(zone.y0, zone.y1);
          if (zone.test && !zone.test(x, y)) continue;
          const s = scaleAt(S, y);
          if (api.free(x, y, hw * s, hd * s)) return [x, y];
        }
        return null;
      },
      pickZone(filter) {
        if (!filter) { if (!S._zw || S._zw.n !== S.zones.length) { S._zw = S.zones.map(z => [z, (z.x1 - z.x0) * (z.y1 - z.y0) * (z.w || 1)]); S._zw.n = S.zones.length; } return r.weighted(S._zw); }
        const zs = S.zones.filter(z => filter(z));
        return r.weighted(zs.map(z => [z, (z.x1 - z.x0) * (z.y1 - z.y0) * (z.w || 1)]));
      },
      // a full stall: back wall, vendor, counter
      stall(x, y, spec, vendor) {
        api.add('prop', Object.assign({ p: 'stallback' }, spec), x, y - 26, { z: y - 26, s: scaleAt(S, y), role: 'prop' });
        if (vendor) api.add('person', vendor, x + r.range(-8, 8), y - 12, { z: y - 12, s: scaleAt(S, y), banim: 'breathe', role: 'crowd', flip: r.chance(0.5), noRemove: true }).fixed = true;
        const f = api.add('prop', Object.assign({ p: 'stall' }, spec), x, y, { role: 'prop', foot: [(spec.w || 64) / 2 + 6, 30] });
        S.surfaces.push({ x0: x - (spec.w || 64) * 0.36 * f.s, x1: x + (spec.w || 64) * 0.36 * f.s, y: y - 20 * f.s, z: y + 0.4, s: f.s, used: false });
        return f;
      },
      prop(p, x, y, spec, o) {
        o = o || {};
        return api.add('prop', Object.assign({ p }, spec || {}), x, y, Object.assign({ role: 'prop', foot: o.foot || [20, 10] }, o));
      },
    };
    return api;
  }

  // ---------------------------------------------------------------- targets + decoys
  function makeTargetSpec(id, r, theme) {
    const P = SC.PEEP;
    switch (id) {
      case 'peeper': return { kind: 'person', spec: SC.ART.randPerson(r, null, { kid: false, pose: 'map', top: 'plaidvest', tc: P.vest, tc2: P.shirt, bottom: 'shorts', bc: P.shorts, socks: '#ffffff', shoe: '#6e4122', hat: 'bucket', hatc: P.hat, leafpin: true, camera: true, w: 1.12, h: 1, shades: false, glasses: true, bag: 'none', beard: false, hair: 'short', scarf: null, mapTilt: -0.14 }), banim: 'peep', foot: [11, 7] };
      case 'woodchuck': return { kind: 'woodchuck', spec: {}, banim: 'chuck', foot: [8, 6] };
      case 'shades': { const d = SC.ART.randDog(r); d.shades = true; d.col = r.pick(['#e0b25c', '#c48a4a', '#f3ead8']); d.size = 1.05; return { kind: 'dog', spec: d, banim: 'bob', foot: [12, 6] }; }
      case 'juggler': return { kind: 'person', spec: SC.ART.randPerson(r, theme, { kid: false, pose: 'juggle', hold: 'none', hat: 'none', top: 'two', tc: '#7b6cf6', tc2: '#ffd23f', bottom: 'pants', bc: '#2f3e57', scarf: null }), banim: 'bob', foot: [11, 7] };
      case 'cow': return { kind: 'person', spec: SC.ART.randPerson(r, theme, { kid: false, top: 'cow', bottom: 'cow', bc: '#ffffff', hat: 'cow', sleeve: 'long', mitts: null, scarf: null, hold: 'none', bag: 'none', armAnim: 'wave', shoe: '#2b2b33' }), banim: 'bounce', foot: [11, 7] };
      case 'unicycle': return { kind: 'person', spec: SC.ART.randPerson(r, theme, { kid: false, pose: 'unicycle', hold: 'none', bag: 'none', hat: 'cap', hatc: '#ff6f61', armAnim: 'still' }), banim: 'wobble', foot: [11, 7] };
      case 'banjo': return { kind: 'person', spec: SC.ART.randPerson(r, theme, { kid: false, pose: 'banjo', hold: 'none', bag: 'none', hat: theme === 'winter' ? 'beanie' : 'sun', hatc: '#e9c46a', armAnim: 'strum', beard: true }), banim: 'sway', foot: [11, 7] };
      case 'catpack': return { kind: 'person', spec: SC.ART.randPerson(r, theme, { kid: false, catpack: true, bag: 'none', hair: 'short', hat: theme === 'winter' ? 'beanie' : 'none', pose: 'stand' }), banim: 'breathe', foot: [11, 7] };
      default: { // small objects
        const spec = { item: id };
        if (id === 'pumpkin') spec.face = true;
        if (id === 'snowman') spec.col = '#17b3a3';
        return { kind: 'item', spec, banim: null, foot: [9, 5] };
      }
    }
  }
  function decoySpecs(id, r, theme, n) {
    const out = [];
    const P = SC.PEEP;
    for (let i = 0; i < n; i++) {
      let d = null;
      if (id === 'peeper') {
        const type = ['mapBlue', 'tealHat', 'orangeCam', 'mapOrange', 'mapYellow'][i % 5];
        const base = SC.ART.randPerson(r, theme, { kid: false });
        if (type === 'mapBlue') Object.assign(base, { pose: 'map', top: 'vest', tc: '#4d96ff', tc2: r.pick(['#ffffff', '#ffd23f']), hat: 'cap', hatc: '#e63946', camera: false });
        if (type === 'tealHat') Object.assign(base, { pose: 'stand', hat: 'bucket', hatc: P.hat, camera: true, top: 'tee', tc: r.pick(['#ffd23f', '#ffffff', '#c77dff']) });
        if (type === 'orangeCam') Object.assign(base, { pose: 'stand', top: 'vest', tc: P.vest, tc2: '#ffffff', camera: true, hat: 'sun', hatc: '#f2efe4', bottom: 'pants' });
        if (type === 'mapOrange') Object.assign(base, { pose: 'map', top: 'vest', tc: P.vest, tc2: '#4d96ff', hat: 'cap', hatc: '#6b705c', camera: false, bottom: 'pants' });
        if (type === 'mapYellow') Object.assign(base, { pose: 'map', top: 'coat', tc: '#ffd23f', hat: 'bucket', hatc: '#ffd23f', camera: true, sleeve: 'long' });
        d = { kind: 'person', spec: base, banim: 'breathe', foot: [11, 7] };
      } else if (id === 'champ') {
        if (i % 2 === 0 && (theme === 'festival' || theme === 'beach' || theme === 'market')) d = { kind: 'floaty', spec: { col: r.pick(['#5cc96b', '#3fb27f', '#4caf50']) }, banim: null, foot: [20, 8], placeWater: true };
        else d = { kind: 'person', spec: SC.ART.randPerson(r, theme, { kid: true, hat: 'dino', top: 'hoodie', tc: '#4caf50', sleeve: 'long', hold: 'none' }), banim: 'bounce', foot: [9, 6] };
      } else if (id === 'woodchuck') {
        d = i % 2 === 0 ? { kind: 'squirrel', spec: { col: r.pick(['#8e8e98', '#9a6b4a']) }, banim: 'chuck', foot: [8, 5] } : { kind: 'teddy', spec: { col: r.pick(['#a8743f', '#c48a4a']) }, banim: null, foot: [8, 5] };
      } else if (id === 'mitten') d = { kind: 'item', spec: { item: 'mitten', col: r.pick(['#4d96ff', '#e63946', '#2a9d8f']) }, foot: [8, 5] };
      else if (id === 'skateboard') d = { kind: 'item', spec: { item: 'skateboard', col: r.pick(['#4d96ff', '#7bd389']) }, foot: [12, 5] };
      else if (id === 'pumpkin') d = { kind: 'item', spec: { item: 'pumpkin' }, foot: [9, 5] };
      else if (id === 'duck') d = { kind: 'item', spec: { item: 'duck', col: '#ff9fc5' }, foot: [8, 5] };
      else if (id === 'snowman') d = { kind: 'item', spec: { item: 'snowman', col: '#e63946' }, foot: [9, 5] };
      if (d) out.push(d);
    }
    return out;
  }

  function clusterZone(c) {
    if (c.cz) return c.cz;
    const z = c.zone, R = c.R;
    return c.cz = { x0: Math.max(z.x0, c.x - R), x1: Math.min(z.x1, c.x + R), y0: Math.max(z.y0, c.y - R * 0.7), y1: Math.min(z.y1, c.y + R * 0.7), test: z.test, water: z.water, road: z.road, kind: z.kind };
  }
  function placeLoose(api, S, t, zoneFilter, avoid) {
    const r = api.r;
    for (let k = 0; k < 60; k++) {
      let z;
      const cl = S.clusters.filter(c => !zoneFilter || zoneFilter(c.zone));
      if (cl.length && k < 40 && r.chance(0.8)) z = clusterZone(r.pick(cl)); else z = api.pickZone(zoneFilter);
      if (!z) return null;
      const p = api.spot(z, t.foot[0] + 4, t.foot[1] + 6, 30);
      if (!p) continue;
      if (avoid && avoid.some(a => Math.hypot(a.x - p[0], a.y - p[1]) < 170)) continue;
      return p;
    }
    return null;
  }

  // ---------------------------------------------------------------- main
  // try a few deterministic variations until the scene passes every fairness check
  function make(opts) {
    let S = null;
    for (let a = 0; a < 8; a++) { S = makeOnce(opts, a); S.attempt = a; S.issues = check(S); if (!S.issues.length) break; }
    return S;
  }
  function makeOnce(opts, attempt) {
    const theme = opts.theme, diff = opts.diff || 'normal', seed = opts.seed >>> 0;
    const D = DIFF[diff], T = SC.THEMES[theme];
    const r = rng((seed ^ hashStr(theme + '/' + diff)) + attempt * 7919);
    const S = { bonus: null, theme, diff, seed, W, H, gy0: T.gy0, ents: [], zones: [], surfaces: [], champSpots: [], chuckSpots: [], lights: [], targets: [], night: !!T.night };
    const api = Builder(S, r);
    S.bg = T.plan(r, S);
    T.layout(api, S, D);
    // crowd knots: groups gather around spots, leaving some open ground between
    S.clusters = [];
    const nCl = 14 + Math.round(D.crowd / 22);
    for (let i = 0; i < nCl; i++) {
      const z = api.pickZone();
      for (let k = 0; k < 20; k++) { const x = r.range(z.x0, z.x1), y = r.range(z.y0, z.y1); if (z.test && !z.test(x, y)) continue; S.clusters.push({ x, y, R: r.range(55, 115), zone: z }); break; }
    }

    // --- choose this scene's list: Champ, woodchuck, peeper + 5 rotating extras
    const extras = r.shuffle(EXTRAS[theme].slice()).slice(0, 5);
    const list = ['champ', 'woodchuck', 'peeper'].concat(extras);
    const placed = [];

    // Champ: always at a themed hiding spot (fountain, pool, behind a counter, over a snowbank...)
    {
      // pick a kind of hiding place first (so rare ones like the pool or a parade float come up), then one of that kind
      const kinds = Array.from(new Set(S.champSpots.map(f => f.kind)));
      const kind = r.pick(kinds), spot = r.pick(S.champSpots.filter(f => f.kind === kind));
      const e = spot(r.chance(D.peek) ? 'peek' : 'neck');
      e.role = 'target'; e.tid = 'champ'; e.spotKind = spot.kind || 'stall'; placed.push(e);
    }
    // woodchuck: near a prop
    {
      let e = null;
      if (S.chuckSpots.length && r.chance(0.7)) e = r.pick(S.chuckSpots)();
      if (!e) { const t = makeTargetSpec('woodchuck', r, theme); const p = placeLoose(api, S, t, z => !z.water, placed); e = api.add(t.kind, t.spec, p[0], p[1], { banim: t.banim, foot: t.foot }); }
      e.role = 'target'; e.tid = 'woodchuck'; placed.push(e);
    }
    for (const id of list.slice(2)) {
      const t = makeTargetSpec(id, r, theme);
      let e = null;
      if (t.kind === 'item' && id !== 'flamingo' && id !== 'snowman') {
        // small things: sometimes on a counter / table, sometimes in the water (duck), else on the ground
        const surf = S.surfaces.filter(s => !s.used);
        if (id === 'duck' && S.waterSpots && S.waterSpots.length && r.chance(0.7)) { const w = S.waterSpots.splice(r.int(0, S.waterSpots.length - 1), 1)[0]; e = api.add('item', t.spec, w.x, w.y, { z: w.z, s: w.s, banim: null }); e.parts[0].anim = 'float'; }
        else if (surf.length && r.chance(0.35)) { const s = r.pick(surf); s.used = true; e = api.add('item', t.spec, r.range(s.x0, s.x1), s.y, { z: s.z, s: s.s }); }
      }
      if (!e) { const p = placeLoose(api, S, t, z => !z.water && !z.road, placed); if (!p) continue; e = api.add(t.kind, t.spec, p[0], p[1], { banim: t.banim, foot: t.foot, flip: r.chance(0.5) }); }
      e.role = 'target'; e.tid = id; placed.push(e);
    }
    // --- the Daily's bonus: a golden maple leaf tucked into the crowd (optional, not on the list)
    if (opts.bonus) {
      const t = { kind: 'item', spec: { item: 'goldleaf', anim: 'sparkle' }, foot: [9, 5] };
      const p = placeLoose(api, S, t, z => !z.water && !z.road, placed);
      if (p) { const e = api.add('item', t.spec, p[0], p[1], { foot: t.foot, role: 'bonus' }); e.tid = 'goldleaf'; S.bonus = e; placed.push(e); }
    }
    // --- decoys
    const decoys = [];
    const nDec = { peeper: D.peepDecoys, champ: D.champDecoys, woodchuck: D.chuckDecoys };
    for (const id of list) {
      const n = nDec[id] != null ? nDec[id] : (['mitten', 'skateboard', 'pumpkin', 'snowman', 'duck'].includes(id) ? (diff === 'easy' ? 0 : 1) : 0);
      for (const d of decoySpecs(id, r, theme, n)) {
        const tgt = placed.find(p => p.tid === id);
        let p = null;
        if (d.placeWater && S.waterSpots && S.waterSpots.length) { const w = S.waterSpots.splice(r.int(0, S.waterSpots.length - 1), 1)[0]; const e = api.add(d.kind, d.spec, w.x, w.y, { z: w.z, s: w.s, banim: d.banim, role: 'decoy', flip: r.chance(0.5) }); e.decoyOf = id; decoys.push(e); continue; }
        p = placeLoose(api, S, d, z => !z.water, tgt ? [tgt] : []);
        if (!p) continue;
        const e = api.add(d.kind, d.spec, p[0], p[1], { banim: d.banim, foot: d.foot, role: 'decoy', flip: r.chance(0.5) });
        e.decoyOf = id; decoys.push(e);
      }
    }
    // --- crowd
    const want = D.crowd;
    let made = 0, fails = 0;
    while (made < want && fails < want * 4) {
      let z = api.pickZone();
      if (S.clusters.length && r.chance(0.8)) { const c = r.pick(S.clusters); z = clusterZone(c); }
      // find room first (cheap), then dress the person; wide ones (dogs, strollers, bikes) re-check their footprint
      const p = api.spot(z, 11, 7, 8);
      if (!p) { fails++; continue; }
      const m = T.crowd(r, S, z);
      if ((m.foot[0] > 11 || m.foot[1] > 7) && !api.free(p[0], p[1], m.foot[0] * api.scale(p[1]), m.foot[1] * api.scale(p[1]))) { fails++; continue; }
      api.add(m.kind, m.spec, p[0], p[1], { banim: m.banim, foot: m.foot, flip: m.flip != null ? m.flip : r.chance(0.5), role: 'crowd' });
      made++;
    }
    S.crowdCount = made;

    // --- fairness: keep every target mostly visible by moving crowd members out of the way
    const limit = D.cover - 0.07; // aim under the rule: hit shapes are an approximation of the drawn pixels
    for (const t of placed) clearAround(S, t, limit);
    // decoys must not sit right on top of their target (taps stay unambiguous)
    for (const d of decoys) { const t = placed.find(p => p.tid === d.decoyOf); if (t && Math.hypot(t.x - d.x, t.y - d.y) < 90) d.dead = true; }
    // other targets must not overlap each other heavily
    S.ents = S.ents.filter(e => !e.dead);
    S.ents.sort((a, b) => a.z - b.z || a.id - b.id);
    S.order = S.ents;
    S.targets = list.map(id => { const e = placed.find(p => p.tid === id); return e ? { id, name: TARGETS[id].name, blurb: TARGETS[id].blurb, e, found: false } : null; }).filter(Boolean);
    S.decoys = decoys.filter(d => !d.dead);
    for (const e of S.ents) if (e.spec && e.spec.hold === 'lantern' && S.night) S.lights.push({ x: e.x + (e.flip ? -1 : 1) * 8 * e.s, y: e.y - 18 * e.s, r: 34 * e.s, col: e.spec.lanc || '#ffd166', ent: e });
    return S;
  }

  // fairness report for tests: bounds, visibility (shape coverage), separation, tappable size
  function check(S) {
    const issues = [];
    const D = DIFF[S.diff];
    for (const t of S.targets) {
      const e = t.e, b = shapesBox(e);
      if (b[0] < 20 || b[2] > W - 20 || b[1] < 20 || b[3] > H - 5) issues.push(t.id + ': outside bounds ' + b.map(v => v | 0).join(','));
      const cov = coverage(S, e);
      if (cov > D.cover + 0.02) issues.push(t.id + ': covered ' + Math.round(cov * 100) + '%');
      const size = Math.max(b[2] - b[0], b[3] - b[1]);
      if (size < 12) issues.push(t.id + ': too small ' + size.toFixed(1));
      for (const u of S.targets) if (u !== t && Math.hypot(u.e.x - e.x, u.e.y - e.y) < 30) issues.push(t.id + ': overlaps ' + u.id);
      for (const d of S.decoys) if (d.decoyOf === t.id && Math.hypot(d.x - e.x, d.y - e.y) < 90) issues.push(t.id + ': decoy too close');
    }
    if (S.targets.length !== 8) issues.push('target count ' + S.targets.length);
    if (S.bonus) { const cov = coverage(S, S.bonus); if (cov > D.cover + 0.02) issues.push('goldleaf: covered ' + Math.round(cov * 100) + '%'); }
    return issues;
  }

  const SPOTS = { stall: 'Peeking over a stall counter', fountain: 'Splashing in the fountain', pool: 'Among the pool floats', hay: 'Behind a hay bale', pumpkins: 'Behind the pumpkin pile', tub: 'In the apple-bobbing tub', lake: 'Swimming with the swimmers', sandcastle: 'Behind a sandcastle', table: 'Behind a water table', portajohn: 'On top of the porta-johns', snowbank: 'Over a snowbank', float: 'Riding a parade float', inflatables: 'Hiding with the yard inflatables' };
  SC.SCENE = { SPOTS, make, check, coverage, worldShapes, inShapes, shapesBox, scaleAt, W, H, DIFF, TARGETS, EXTRAS, makeTargetSpec };
})(typeof window !== 'undefined' ? window : globalThis);
