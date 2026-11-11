/* Spot Champ — WebAudio synth sound effects, a music loop per theme and ambience per place.
   Everything starts on the first user gesture (iOS rule). */
(function (root) {
  'use strict';
  const SC = root.SC;
  const A = (SC.audio = {});
  let ctx = null, master = null, sfxG = null, musG = null, ambG = null, noiseBuf = null, ambSrc = null;
  A.sound = true; A.music = true; A.paused = false;
  let musicTimer = null, nextT = 0, step = 0;

  A.unlock = function () {
    try {
      if (!ctx) {
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
        sfxG = ctx.createGain(); sfxG.connect(master);
        musG = ctx.createGain(); musG.gain.value = 0; musG.connect(master);
        ambG = ctx.createGain(); ambG.gain.value = 0; ambG.connect(master);
        // a small generated room reverb, shared by music and effects, so nothing sounds bone dry
        try {
          const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
          for (let ch = 0; ch < 2; ch++) { const d2 = ir.getChannelData(ch); for (let i = 0; i < len; i++) d2[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 80 ? i / 80 : 1); }
          const verb = ctx.createConvolver(); verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.22; verb.connect(wet); wet.connect(master);
          const ms = ctx.createGain(); ms.gain.value = 0.55; musG.connect(ms); ms.connect(verb);
          const ss = ctx.createGain(); ss.gain.value = 0.35; sfxG.connect(ss); ss.connect(verb);
        } catch (e) {}
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0); let b = 0;
        for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 4 + (Math.random() * 2 - 1) * 0.15; }
      }
      if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); }
      A.apply();
    } catch (e) {}
  };
  A.suspend = function () { try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) {} };
  A.resume = function () { try { if (ctx && ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } } catch (e) {} };
  const ok = () => ctx && A.sound && ctx.state !== 'closed';

  function osc(type, f0, f1, t0, dur, vol, dest, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const at = attack || 0.005;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + at); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxG); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, vol, type, freq, q, f1, dest) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.setValueAtTime(freq, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxG); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.02);
  }
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

  A.find = function (n, combo) { // n = found so far, combo = quick finds in a row: both raise the pitch
    if (!ok()) return; const t = ctx.currentTime, base = 72 + Math.min(n, 8) * 2 + Math.min(combo || 0, 6);
    A.duck();
    [0, 4, 7, 12].forEach((iv, i) => { osc('triangle', NOTE(base + iv), 0, t + i * 0.055, 0.28, 0.18); osc('sine', NOTE(base + iv + 12), 0, t + i * 0.055, 0.18, 0.06); });
    noise(t, 0.12, 0.08, 'highpass', 5000, 0.7);
    osc('sine', 180, 520, t, 0.09, 0.15); // pop
  };
  A.champ = function () { // Champ gets a little fanfare of its own
    if (!ok()) return; const t = ctx.currentTime + 0.25;
    [[67, 0], [72, 0.11], [76, 0.22], [79, 0.33], [84, 0.5]].forEach(([n, d]) => { osc('triangle', NOTE(n), 0, t + d, 0.35, 0.14); osc('square', NOTE(n), 0, t + d, 0.1, 0.025); });
    osc('sine', 300, 900, t + 0.5, 0.35, 0.06);
  };
  A.combo = function (c) { if (!ok()) return; const t = ctx.currentTime + 0.2; for (let i = 0; i < Math.min(c, 6); i++) osc('sine', NOTE(84 + i * 2), 0, t + i * 0.045, 0.12, 0.05); };
  A.leaf = function () { if (!ok()) return; const t = ctx.currentTime; A.duck(); [88, 91, 95, 100, 103].forEach((n, i) => osc('sine', NOTE(n), 0, t + i * 0.06, 0.6, 0.08)); noise(t, 0.6, 0.05, 'highpass', 7000, 1); };
  A.nope = function () { if (!ok()) return; const t = ctx.currentTime; osc('sine', 260, 200, t, 0.11, 0.22); osc('sine', 210, 150, t + 0.12, 0.14, 0.2); osc('triangle', 130, 100, t, 0.22, 0.06); };
  A.hint = function () { if (!ok()) return; const t = ctx.currentTime; noise(t, 0.6, 0.12, 'bandpass', 600, 2, 4000); [0, 5, 9, 14].forEach((iv, i) => osc('sine', NOTE(76 + iv), 0, t + 0.08 * i, 0.4, 0.07)); };
  A.zoom = function (inward) { if (!ok()) return; const t = ctx.currentTime; osc('sine', inward ? 300 : 600, inward ? 640 : 280, t, 0.12, 0.08); noise(t, 0.08, 0.04, 'bandpass', inward ? 1800 : 900, 1.5); };
  A.click = function () { if (!ok()) return; const t = ctx.currentTime; osc('triangle', 880, 660, t, 0.06, 0.1); };
  A.tick = function () { if (!ok()) return; const t = ctx.currentTime; osc('sine', 1320, 0, t, 0.04, 0.05); };
  A.final = function () {
    if (!ok()) return; const t = ctx.currentTime; A.duck();
    const seq = [72, 76, 79, 84, 79, 84, 88];
    seq.forEach((n, i) => { osc('triangle', NOTE(n), 0, t + i * 0.09, 0.4, 0.17); osc('square', NOTE(n - 12), 0, t + i * 0.09, 0.14, 0.03); });
    [72, 76, 79, 84].forEach(n => osc('sawtooth', NOTE(n), 0, t + 0.7, 1.2, 0.05, null, 0.02));
    for (let i = 0; i < 14; i++) noise(t + 0.6 + i * 0.06 + Math.random() * 0.04, 0.05, 0.12, 'highpass', 4000 + Math.random() * 3000, 1);
  };
  A.start = function () { if (!ok()) return; const t = ctx.currentTime; [67, 72, 76].forEach((n, i) => osc('triangle', NOTE(n), 0, t + i * 0.07, 0.25, 0.12)); };

  // ---- music: a real loop per theme — chord progression, A / A' / B / A sections, melody, bass, pads, drums, theme instrument
  const THEMES = {
    festival: { bpm: 112, key: 60, prog: [[0, 1], [7, 1], [9, 0], [5, 1]], lead: 'pluck', perc: 'pop', seed: 11 },
    market: { bpm: 100, key: 62, prog: [[0, 1], [5, 1], [7, 1], [0, 1]], lead: 'fiddle', perc: 'shaker', seed: 23 },
    beach: { bpm: 92, key: 65, prog: [[0, 1], [9, 0], [5, 1], [7, 1]], lead: 'marimba', perc: 'conga', seed: 37 },
    marathon: { bpm: 126, key: 57, prog: [[0, 1], [7, 1], [9, 0], [5, 1]], lead: 'square', perc: 'drive', seed: 41 },
    winter: { bpm: 84, key: 63, prog: [[0, 1], [9, 0], [5, 1], [7, 1]], lead: 'bell', perc: 'sleigh', seed: 53 },
    title: { bpm: 104, key: 60, prog: [[0, 1], [5, 1], [9, 0], [7, 1]], lead: 'pluck', perc: 'pop', seed: 7 },
  };
  const MAJ = [0, 2, 4, 5, 7, 9, 11];
  let song = null, theme = 'title', bar = 0;
  // melody writer: a one-bar rhythm motif, stepwise lines, strong beats land on chord tones, phrases cadence home
  const RHY = [[1, 0, 1, 1, 0, 1, 1, 0], [1, 1, 0, 1, 1, 0, 1, 0], [1, 0, 0, 1, 1, 1, 0, 1], [1, 0, 1, 0, 1, 1, 1, 0]];
  const SEMI2DEG = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
  function makeSong(th, mix) {
    const T = THEMES[th] || THEMES.title, r = SC.rng((T.seed ^ (mix || 0)) >>> 0);
    const chordDeg = (b) => SEMI2DEG[T.prog[b % 4][0]] || 0;
    const nearestChordTone = (d, cd) => { let best = d, bd = 99; for (let o = -14; o <= 14; o++) { const x = cd + o; const m = ((o % 7) + 7) % 7; if (m !== 0 && m !== 2 && m !== 4) continue; if (Math.abs(x - d) < bd) { bd = Math.abs(x - d); best = x; } } return best; };
    const phrase = (rh, start, lift, cadence) => {
      const bars = []; let d = start;
      for (let b = 0; b < 4; b++) {
        const cd = chordDeg(b), notes = [], pat = b === 2 ? RHY[(RHY.indexOf(rh) + 1) % RHY.length] : rh;
        for (let i = 0; i < 8; i++) {
          if (!pat[i]) { notes.push(null); continue; }
          const ctr = start + 1; // lines are pulled back toward the phrase's register, so a 'lifted' B section stays lifted
          const up = d < ctr - 2 ? 2.2 : d > ctr + 3 ? 0.45 : 1;
          const step = r.weighted([[1, 4 * up], [-1, 4 / up], [2, 1.5 * up], [-2, 1.5 / up], [0, 0.6]]);
          d = Math.max(-2 + lift, Math.min(9 + lift, d + step));
          if (i % 4 === 0) d = nearestChordTone(d, cd);
          notes.push(d);
        }
        if (b === 3 && cadence) { // walk home by steps (never a big drop), landing on the tonic in the nearest octave
          const home = Math.round(d / 7) * 7; for (const i of [4, 5, 6]) { d += Math.max(-2, Math.min(2, home - d)); notes[i] = i === 5 && d !== home ? d : i === 5 ? null : d; } notes[6] = home; notes[7] = null; d = home + 2; }
        bars.push(notes);
      }
      return bars;
    };
    const rh = r.pick(RHY);
    const A1 = phrase(rh, 4, 0, true), A2 = A1.map((b, bi) => bi < 2 ? b.slice() : bi === 2 ? b.map((n, i) => (n != null && i % 4 === 2 ? n + 1 : n)) : b.slice()), // A' = A with a twist
      _ = 0, B1 = phrase(r.pick(RHY), 6, 2, false), B2 = phrase(rh, 7, 2, true);
    // A A' B B' A, then a 4-bar break (no drums, arpeggios) before it loops
    const brk = A2.map((b, bi) => b.map((n, i) => (bi >= 2 ? null : i % 2 ? null : n))); // the break thins out to arpeggios
    const bars = [].concat(A1, A2, B1, B2, A1, brk);
    const flags = bars.map((_, i) => ({ arp: i >= 8 && i < 16, brk: i >= 20 }));
    return { T, bars, flags, len: bars.length };
  }
  const degToSemi = (d) => MAJ[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  function lead(kind, f, t, dur, v) {
    const g = musG;
    if (kind === 'pluck') { osc('triangle', f, 0, t, dur * 0.9, v, g, 0.004); osc('sine', f * 2, 0, t, dur * 0.4, v * 0.35, g); }
    else if (kind === 'fiddle') { const o = ctx.createOscillator(), lf = ctx.createOscillator(), lg = ctx.createGain(), fl = ctx.createBiquadFilter(), gg = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; lf.frequency.value = 5.5; lg.gain.value = f * 0.012; lf.connect(lg); lg.connect(o.frequency); fl.type = 'lowpass'; fl.frequency.value = 1900; gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(v * 0.5, t + 0.05); gg.gain.setValueAtTime(v * 0.45, t + dur * 0.7); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.1); o.connect(fl); fl.connect(gg); gg.connect(g); o.start(t); lf.start(t); o.stop(t + dur * 1.2); lf.stop(t + dur * 1.2); }
    else if (kind === 'marimba') { osc('sine', f, 0, t, 0.35, v, g, 0.002); osc('sine', f * 4, 0, t, 0.06, v * 0.3, g, 0.001); }
    else if (kind === 'square') { osc('square', f, 0, t, dur * 0.6, v * 0.28, g, 0.003); osc('triangle', f, 0, t, dur * 0.8, v * 0.5, g); }
    else if (kind === 'bell') { osc('sine', f * 2, 0, t, 1.1, v * 0.6, g, 0.002); osc('sine', f * 2 * 2.76, 0, t, 0.4, v * 0.18, g, 0.001); osc('sine', f, 0, t, 0.8, v * 0.3, g); }
  }
  function drums(kind, t, st) {
    const g = musG, beat = st % 4 === 0, off = st % 2 === 1;
    if (kind === 'pop' || kind === 'drive') {
      if (beat) osc('sine', 120, 45, t, 0.16, kind === 'drive' ? 0.32 : 0.22, g, 0.002);
      if (st % 8 === 4) noise(t, 0.12, 0.13, 'bandpass', 1800, 0.9, 0, g);
      if (off || kind === 'drive') noise(t, 0.035, 0.05, 'highpass', 7000, 1, 0, g);
      if (kind === 'pop' && st % 16 === 14) noise(t, 0.08, 0.08, 'bandpass', 1200, 2, 0, g);
    } else if (kind === 'shaker') { noise(t, 0.05, off ? 0.05 : 0.03, 'highpass', 5000, 1, 0, g); if (beat) osc('sine', 90, 50, t, 0.18, 0.14, g); }
    else if (kind === 'conga') { noise(t, 0.04, 0.035, 'highpass', 6000, 1, 0, g); if (st % 8 === 3 || st % 8 === 6) osc('sine', 220, 170, t, 0.14, 0.12, g); if (beat) osc('sine', 85, 50, t, 0.2, 0.13, g); }
    else if (kind === 'sleigh') { if (off) for (let i = 0; i < 3; i++) noise(t + i * 0.012, 0.05, 0.035, 'highpass', 8000, 3, 0, g); if (st % 8 === 0) osc('sine', 90, 55, t, 0.25, 0.1, g); }
  }
  function schedule() {
    if (!ctx || !song) return;
    const T = song.T, spb = 60 / T.bpm / 2; // eighth notes
    while (nextT < ctx.currentTime + 0.3) {
      const b = bar % song.len, st = step % 8, ch = T.prog[b % 4];
      const root = T.key + ch[0], third = ch[1] ? 4 : 3, swing = (step % 2) && T.lead !== 'square' ? spb * 0.1 : 0;
      const d = song.bars[b][st], fl = song.flags[b];
      if (d != null) lead(T.lead, NOTE(T.key + 12 + degToSemi(d)), nextT + swing, spb * 1.6, fl.brk ? 0.06 : 0.085);
      if (st === 0 || st === 4 || (T.perc === 'drive' && st % 2 === 0 && !fl.brk)) osc('triangle', NOTE(root - 24 + (st === 4 ? 7 : 0)), 0, nextT, spb * 1.8, fl.brk ? 0.1 : 0.16, musG, 0.006);
      if (st === 0) [0, third, 7].forEach(iv => osc('sine', NOTE(root + iv), 0, nextT, spb * 7.5, fl.brk ? 0.04 : 0.028, musG, 0.25));
      if (fl.arp || fl.brk) { const iv = [0, third, 7, 12][st % 4]; osc('sine', NOTE(root + 12 + iv), 0, nextT + spb * 0.5, spb * 0.9, 0.022, musG, 0.003); }
      if (!fl.brk) drums(T.perc, nextT, step % 16); else if (st === 0) noise(nextT, 0.3, 0.03, 'highpass', 6000, 1, 0, musG);
      nextT += spb; step++; if (step % 8 === 0) bar++;
    }
  }
  A.setTheme = function (th, mix) { if (theme === th && song && song.mix === (mix || 0)) return; theme = th; song = makeSong(th, mix); song.mix = mix || 0; bar = 0; step = 0; if (ctx) { nextT = ctx.currentTime + 0.15; setAmbience(); } };
  A.setKey = function () {};
  A._song = (th) => makeSong(th); // test hook: inspect the generated melody
  A.duck = function () { if (!ctx) return; const t = ctx.currentTime, on = A.music && A.sound && !A.paused; musG.gain.cancelScheduledValues(t); musG.gain.setValueAtTime(musG.gain.value, t); musG.gain.linearRampToValueAtTime(on ? 0.16 : 0, t + 0.05); musG.gain.setTargetAtTime(on ? 0.55 : 0, t + 0.6, 0.3); };

  // ---- ambience per place: murmur, waves + gulls at the beach, wind + bells at night, birds at the market, cheers at the race
  let ambTimer = null, ambSrcs = [];
  function loopNoise(type, freq, q, vol, lfoHz, lfoAmt) {
    const s2 = ctx.createBufferSource(); s2.buffer = noiseBuf; s2.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    if (lfoHz) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoHz; lg.gain.value = lfoAmt; l.connect(lg); lg.connect(g.gain); l.start(); ambSrcs.push(l); }
    s2.connect(f); f.connect(g); g.connect(ambG); s2.start(0, Math.random() * 1.5); ambSrcs.push(s2);
  }
  function setAmbience() {
    if (!ctx || !noiseBuf) return;
    for (const n of ambSrcs) { try { n.stop(); } catch (e) {} }
    ambSrcs = [];
    if (theme !== 'winter') { loopNoise('bandpass', 420, 2.2, 0.55, 0.23, 0.3); loopNoise('bandpass', 1050, 2.8, 0.3, 0.37, 0.22); loopNoise('lowpass', 260, 0.7, 0.25, 0.11, 0.12); }
    if (theme === 'beach') loopNoise('lowpass', 700, 0.5, 0.45, 0.12, 0.42);
    if (theme === 'winter') { loopNoise('lowpass', 380, 0.6, 0.5, 0.08, 0.4); loopNoise('bandpass', 520, 0.8, 0.35, 0.2, 0.15); }
    if (theme === 'marathon') loopNoise('bandpass', 800, 0.6, 0.5, 0.31, 0.3);
  }
  function ambEvent() {
    if (!ctx || !A.sound || A.paused || !A.amb) return;
    const t = ctx.currentTime + 0.05, R = Math.random;
    if (theme === 'beach') { const f = 1500 + R() * 600; osc('sine', f, f * 0.7, t, 0.18, 0.025, ambG); osc('sine', f * 1.05, f * 0.72, t + 0.22, 0.2, 0.022, ambG); }
    else if (theme === 'market' || theme === 'festival') { const f = 2600 + R() * 1200; for (let i = 0; i < 3; i++) osc('sine', f, f * 1.3, t + i * 0.09, 0.06, 0.012, ambG); }
    else if (theme === 'winter') [88, 91, 95].forEach((n, i) => osc('sine', NOTE(n), 0, t + i * 0.18, 0.9, 0.012, ambG));
    else if (theme === 'marathon') { noise(t, 1.4, 0.05, 'bandpass', 900, 0.5, 1400, ambG); osc('square', 700, 0, t + 0.2, 0.12, 0.012, ambG); osc('square', 700, 0, t + 0.45, 0.12, 0.012, ambG); }
  }
  A.apply = function () {
    if (!ctx) return;
    const t = ctx.currentTime, musicOn = A.music && A.sound && !A.paused;
    musG.gain.cancelScheduledValues(t); musG.gain.setTargetAtTime(musicOn ? 0.55 : 0, t, 0.3);
    ambG.gain.cancelScheduledValues(t); ambG.gain.setTargetAtTime(A.sound && !A.paused && A.amb ? 0.09 : 0, t, 0.5);
    if (!song) song = makeSong(theme);
    if (musicOn && !musicTimer) { nextT = ctx.currentTime + 0.1; musicTimer = setInterval(schedule, 90); }
    if (!musicOn && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (!ambSrc && noiseBuf) { ambSrc = true; setAmbience(); }
    if (!ambTimer) ambTimer = setInterval(() => { if (Math.random() < 0.35) ambEvent(); }, 2600);
  };
  A.amb = false;
})(window);
