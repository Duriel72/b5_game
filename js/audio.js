'use strict';
// ---------------------------------------------------------------------------
// Szintetizált hangok (WebAudio) – nincs szükség külső hangfájlokra.
// A hangkép a sorozatot idézi: a földi fegyverek retrós, „csipogós”
// impulzusok és zúgó nehézlézerek, a Minbari fegyverek rezonáns, felfelé
// szálló fúziós sugarak, a Narn lézerek mély morgások, a Centauri ionágyúk
// recsegő lövedékek, az Árny hajók pedig vibráló, sikolyszerű hangot adnak.
// Az ugrópont mély, felfutó dübörgés.
// ---------------------------------------------------------------------------

const SFX = (() => {
  let ctx = null, master = null, bus = null, revSend = null, musicGain = null, noiseBuf = null, musicNodes = null;
  let volume = 0.6, musicOn = true, hidden = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    // kompresszor, hogy a sok egyszerre szóló hang se torzuljon
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    bus = ctx.createGain(); bus.connect(master);
    // „űrbeli” visszhang: generált lecsengő impulzusválasz
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    conv.buffer = ir;
    revSend = ctx.createGain(); revSend.gain.value = 0.28;
    revSend.connect(conv); conv.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    if (musicOn) startMusic();
    return ctx;
  }

  function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended' && !hidden) ctx.resume();
  }

  // ha az alkalmazás háttérbe kerül, az egész hangmotor szünetel (különben a zene „beragadhat”)
  function suspend() { hidden = true; if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
  function resume() { hidden = false; if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }

  // a jelet a fő buszra és (opcionálisan) a visszhangra küldi
  function out(node, rev = 0.5) {
    node.connect(bus);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s); s.connect(revSend); }
  }

  function distortion(amount) {
    const ws = ctx.createWaveShaper();
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; curve[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); }
    ws.curve = curve;
    return ws;
  }

  // Oszcillátor-hang: frekvenciaív, vibrató, szűrő, torzítás, burkoló
  function osc(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.2;
    const v = ctx.createOscillator();
    v.type = o.type || 'sine';
    v.frequency.setValueAtTime(o.f0, t);
    if (o.fMid) {
      v.frequency.exponentialRampToValueAtTime(o.fMid, t + dur * 0.4);
      v.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 || o.fMid), t + dur);
    } else if (o.f1) v.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    if (o.detune) v.detune.value = o.detune;
    let node = v;
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
      l.connect(lg); lg.connect(v.frequency); l.start(t); l.stop(t + dur + 0.1);
    }
    if (o.dist) { const d = distortion(o.dist); node.connect(d); node = d; }
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter[0]; f.frequency.setValueAtTime(o.filter[1], t);
      if (o.filter[2]) f.frequency.exponentialRampToValueAtTime(o.filter[2], t + dur);
      f.Q.value = o.filter[3] || 1;
      node.connect(f); node = f;
    }
    const g = ctx.createGain();
    const a = o.attack || 0.005, peak = o.peak || 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (o.trem) {
      const l = ctx.createOscillator(), lg = ctx.createGain(), tg = ctx.createGain();
      l.frequency.value = o.trem[0]; lg.gain.value = o.trem[1]; tg.gain.value = 1 - o.trem[1];
      l.connect(lg); lg.connect(tg.gain); l.start(t); l.stop(t + dur + 0.1);
      node.connect(tg); tg.connect(g);
    } else node.connect(g);
    out(g, o.rev ?? 0.4);
    v.start(t); v.stop(t + dur + 0.05);
  }

  // Zaj-hang szűrőívvel
  function nz(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.3;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 || o.f0), t + dur);
    const g = ctx.createGain();
    const a = o.attack || 0.01, peak = o.peak || 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); out(g, o.rev ?? 0.4);
    src.start(t, Math.random()); src.stop(t + dur + 0.1);
  }

  // ------------------------------------------------------------ fegyverek
  const FAMILY = {
    earth: 'ef', hyperion: 'ef', nova: 'ef', starfury: 'ef', station: 'ef',
    whitestar: 'mb', minbari: 'mb', narn: 'narn', drazi: 'dr', raider: 'rd',
    raidergunship: 'rd', raiderinterceptor: 'rd', raiderwagon: 'rd',
    centauri: 'cen', vorchan: 'cen', altarian: 'cen', centcarrier: 'cen',
    shadow: 'sh', shadowscout: 'sh',
  };

  const pulseVoice = {
    // földi impulzusfegyverek: retrós, négyszögjeles „csipogás”
    ef: d => { osc({ type: 'square', f0: 900, f1: 380, dur: 0.09, peak: 0.07, delay: d, filter: ['lowpass', 3200], rev: 0.25 }); nz({ type: 'highpass', f0: 5000, dur: 0.03, peak: 0.04, delay: d, rev: 0 }); },
    // Minbari / Fehércsillag: fényes, csilingelő energiaimpulzus
    mb: d => { osc({ type: 'sine', f0: 1900, f1: 1150, dur: 0.16, peak: 0.07, delay: d, vib: [38, 70], rev: 0.6 }); osc({ type: 'triangle', f0: 3800, f1: 2300, dur: 0.1, peak: 0.025, delay: d, rev: 0.5 }); },
    // Narn: darabos, mélyebb impulzus
    narn: d => { osc({ type: 'square', f0: 520, f1: 180, dur: 0.12, peak: 0.07, delay: d, filter: ['lowpass', 1800] }); osc({ type: 'sawtooth', f0: 260, f1: 90, dur: 0.12, peak: 0.05, delay: d, dist: 4 }); },
    dr: d => { osc({ type: 'sawtooth', f0: 1300, f1: 560, dur: 0.09, peak: 0.06, delay: d, filter: ['bandpass', 1400, 900, 2] }); },
    rd: d => { osc({ type: 'square', f0: 1600, f1: 700, dur: 0.07, peak: 0.05, delay: d, filter: ['lowpass', 4000] }); },
    cen: d => { nz({ type: 'bandpass', f0: 2600, f1: 1400, q: 7, dur: 0.12, peak: 0.12, delay: d }); osc({ type: 'sine', f0: 950, f1: 300, dur: 0.14, peak: 0.06, delay: d }); },
    // Árny felderítő tüskesorozata: apró sikolyok
    sh: d => { osc({ type: 'sawtooth', f0: 2100, fMid: 2700, f1: 1800, dur: 0.14, peak: 0.04, delay: d, vib: [30, 160], filter: ['bandpass', 2400, 2400, 4], rev: 0.6 }); },
  };

  const beamVoice = {
    // földi nehézlézer: mély, zúgó, „bwaaah” – lebegő, tremolós fűrészjel
    ef: (big) => {
      const dur = big ? 0.95 : 0.7;
      osc({ type: 'sawtooth', f0: 92, f1: 86, dur, peak: 0.11, attack: 0.02, hold: dur * 0.5, filter: ['lowpass', 1400, 500, 3], trem: [17, 0.35], dist: 2 });
      osc({ type: 'sawtooth', f0: 94.5, f1: 88, dur, peak: 0.08, attack: 0.02, hold: dur * 0.5, filter: ['lowpass', 1100, 400] });
      osc({ type: 'square', f0: 186, f1: 172, dur, peak: 0.035, attack: 0.02, hold: dur * 0.4, filter: ['lowpass', 1600] });
      nz({ type: 'bandpass', f0: 900, f1: 500, q: 2, dur: dur * 0.8, peak: 0.05 });
    },
    // Minbari fúziós sugár: felfelé szálló, rezonáns kvint-akkord csillámló zajjal
    mb: (big) => {
      const dur = big ? 1.15 : 0.85, b = big ? 180 : 240;
      osc({ type: 'sine', f0: b, f1: b * 3, dur, peak: 0.1, attack: 0.03, hold: dur * 0.45, vib: [6, 9], rev: 0.8 });
      osc({ type: 'sine', f0: b * 1.5, f1: b * 4.5, dur, peak: 0.07, attack: 0.03, hold: dur * 0.45, vib: [6.5, 12], detune: 8, rev: 0.8 });
      osc({ type: 'triangle', f0: b * 2, f1: b * 6, dur: dur * 0.9, peak: 0.04, attack: 0.05, rev: 0.8 });
      nz({ type: 'highpass', f0: 5000, f1: 8000, q: 1, dur, peak: 0.035, rev: 0.9 });
    },
    // Narn nehézlézer: mély, torzított morgás
    narn: (big) => {
      const dur = big ? 0.9 : 0.7;
      osc({ type: 'sawtooth', f0: 72, f1: 58, dur, peak: 0.12, attack: 0.015, hold: dur * 0.5, dist: 8, filter: ['lowpass', 900, 350, 2] });
      osc({ type: 'square', f0: 144, f1: 116, dur, peak: 0.04, hold: dur * 0.4, filter: ['lowpass', 1200] });
      nz({ type: 'lowpass', f0: 700, f1: 200, dur, peak: 0.08 });
    },
    dr: (big) => {
      const dur = big ? 0.8 : 0.6;
      osc({ type: 'sawtooth', f0: 300, f1: 460, dur, peak: 0.07, hold: dur * 0.4, filter: ['bandpass', 1200, 1600, 2] });
      nz({ type: 'bandpass', f0: 1500, f1: 2200, q: 3, dur, peak: 0.06 });
    },
    // Árny szeletelő sugár: vibráló, sikolyszerű hang mély morgással
    sh: (big) => scream(big ? 1.35 : 0.95, big ? 1 : 0.75),
  };

  function scream(dur = 1.2, amp = 1) {
    osc({ type: 'sawtooth', f0: 1500, fMid: 2650, f1: 1350, dur, peak: 0.07 * amp, attack: 0.05, vib: [27, 210], filter: ['bandpass', 2200, 2000, 3], rev: 0.9 });
    osc({ type: 'sawtooth', f0: 1580, fMid: 2900, f1: 1250, dur: dur * 0.95, peak: 0.05 * amp, attack: 0.06, vib: [33, 260], filter: ['bandpass', 2600, 2100, 3], detune: 25, rev: 0.9 });
    osc({ type: 'triangle', f0: 3100, fMid: 4200, f1: 2800, dur: dur * 0.8, peak: 0.02 * amp, attack: 0.08, vib: [19, 300], rev: 0.9 });
    osc({ type: 'sawtooth', f0: 55, f1: 48, dur, peak: 0.07 * amp, attack: 0.05, dist: 6, filter: ['lowpass', 400] });
  }

  function weapon(type, kind, special, shots) {
    const fam = FAMILY[type] || 'ef';
    const sp = 1 / Math.max(0.5, (typeof R !== 'undefined' && R.speed) || 1);
    switch (kind) {
      case 'pulse': {
        const n = Math.min(shots || 3, 6);
        const v = pulseVoice[fam] || pulseVoice.ef;
        for (let i = 0; i < n; i++) v(i * 0.075 * sp);
        break;
      }
      case 'beam': (beamVoice[fam] || beamVoice.ef)(!!special); break;
      case 'bolt': {
        const n = Math.min(shots || 1, 3);
        for (let i = 0; i < n; i++) {
          const d = i * 0.13 * sp;
          nz({ type: 'bandpass', f0: special ? 1800 : 2800, f1: special ? 600 : 1300, q: 6, dur: special ? 0.4 : 0.18, peak: special ? 0.18 : 0.12, delay: d });
          osc({ type: 'sine', f0: special ? 600 : 950, f1: special ? 120 : 280, dur: special ? 0.45 : 0.18, peak: special ? 0.12 : 0.06, delay: d, dist: special ? 3 : 0 });
        }
        break;
      }
      case 'plasma':
        osc({ type: 'sine', f0: 320, f1: 60, dur: 0.7, peak: 0.16, attack: 0.01 });
        osc({ type: 'sawtooth', f0: 160, f1: 50, dur: 0.6, peak: 0.05, dist: 5, filter: ['lowpass', 800, 200] });
        nz({ type: 'lowpass', f0: 1400, f1: 150, dur: 0.6, peak: 0.12 });
        break;
      case 'missile':
        for (let i = 0; i < Math.min(shots || 2, 3); i++) {
          nz({ type: 'bandpass', f0: 500, f1: 3200, q: 3, dur: 0.8, peak: 0.13, delay: i * 0.12 * sp });
          osc({ type: 'square', f0: 1600, f1: 1600, dur: 0.05, peak: 0.03, delay: i * 0.12 * sp, rev: 0.2 });
        }
        break;
      case 'swarm':
        for (let i = 0; i < 6; i++) osc({ type: 'square', f0: 1300 + i * 90, f1: 700, dur: 0.07, peak: 0.035, delay: i * 0.07 * sp, filter: ['lowpass', 3000], rev: 0.3 });
        break;
      default:
        (pulseVoice[fam] || pulseVoice.ef)(0);
    }
  }

  // ------------------------------------------------------------ egyéb effektek
  const sfx = {
    weapon,
    scream: () => scream(1.6, 1),
    laser: () => pulseVoice.ef(0),
    beam: () => beamVoice.mb(false),
    plasma: () => weapon('vorchan', 'plasma'),
    missile: () => weapon('starfury', 'missile', false, 2),
    hit() {
      nz({ type: 'lowpass', f0: 2600, f1: 180, dur: 0.32, peak: 0.3, rev: 0.3 });
      osc({ type: 'sine', f0: 130, f1: 45, dur: 0.3, peak: 0.22, rev: 0.2 });
      nz({ type: 'highpass', f0: 3000, dur: 0.05, peak: 0.06, delay: 0.02, rev: 0 });
    },
    miss() { osc({ type: 'sine', f0: 700, f1: 1300, dur: 0.18, peak: 0.035, rev: 0.6 }); },
    shieldHit() {
      osc({ type: 'sine', f0: 380, f1: 720, dur: 0.45, peak: 0.1, vib: [9, 25], rev: 0.8 });
      osc({ type: 'triangle', f0: 760, f1: 1440, dur: 0.3, peak: 0.03, rev: 0.8 });
      nz({ type: 'highpass', f0: 4500, f1: 2500, dur: 0.3, peak: 0.05, rev: 0.6 });
    },
    explosion(big = false) {
      const d = big ? 2.6 : 1.4;
      nz({ type: 'lowpass', f0: big ? 3200 : 2400, f1: 45, dur: d, peak: big ? 0.85 : 0.55, attack: 0.005, rev: 0.6 });
      osc({ type: 'sine', f0: big ? 75 : 95, f1: 24, dur: d, peak: big ? 0.6 : 0.4, attack: 0.005, rev: 0.3 });
      // utórecsegés
      for (let i = 0; i < (big ? 6 : 3); i++) nz({ type: 'bandpass', f0: 1800 + Math.random() * 1500, q: 4, dur: 0.08, peak: 0.07, delay: 0.12 + Math.random() * d * 0.5, rev: 0.4 });
    },
    // ugrópont: mély, felfutó dübörgés és örvénylő zúgás (a kék szövetséges kapu kicsit fényesebb)
    jump(blue = false) {
      nz({ type: 'lowpass', f0: 90, f1: 900, dur: 1.8, peak: 0.32, attack: 0.5, rev: 0.7 });
      osc({ type: 'sine', f0: 42, f1: 110, dur: 1.7, peak: 0.25, attack: 0.4, rev: 0.4 });
      osc({ type: 'sawtooth', f0: 55, f1: 160, dur: 1.5, peak: 0.04, attack: 0.4, filter: ['lowpass', 600, 1200] });
      nz({ type: 'bandpass', f0: 300, f1: blue ? 2600 : 1800, q: 3, dur: 1.6, peak: 0.08, attack: 0.5, rev: 0.8 });
    },
    // javítás: fémes kattogás és emelkedő zümmögés
    repair() {
      for (let i = 0; i < 3; i++) nz({ type: 'bandpass', f0: 2400, q: 8, dur: 0.05, peak: 0.08, delay: i * 0.09, rev: 0.2 });
      osc({ type: 'triangle', f0: 300, f1: 620, dur: 0.45, peak: 0.06, delay: 0.1, rev: 0.4 });
    },
    click() { osc({ type: 'sine', f0: 1250, f1: 950, dur: 0.06, peak: 0.05, rev: 0.1 }); },
    select() { osc({ type: 'triangle', f0: 720, f1: 1080, dur: 0.08, peak: 0.06, rev: 0.2 }); },
    capture() { [0, 0.09, 0.18].forEach((d, i) => osc({ type: 'triangle', f0: 520 * (1 + i * 0.26), dur: 0.22, peak: 0.08, delay: d, rev: 0.5 })); },
    coin() { osc({ type: 'square', f0: 1320, dur: 0.06, peak: 0.035, rev: 0.2 }); osc({ type: 'square', f0: 1980, dur: 0.14, peak: 0.035, delay: 0.06, rev: 0.3 }); },
    // két hangú riasztó klaxon
    alarm() {
      for (let i = 0; i < 3; i++) {
        osc({ type: 'square', f0: 700, dur: 0.2, peak: 0.05, hold: 0.15, delay: i * 0.42, filter: ['lowpass', 2200], rev: 0.4 });
        osc({ type: 'square', f0: 560, dur: 0.2, peak: 0.05, hold: 0.15, delay: i * 0.42 + 0.21, filter: ['lowpass', 2200], rev: 0.4 });
      }
    },
    victory() { [523, 659, 784, 1046].forEach((f, i) => osc({ type: 'triangle', f0: f, dur: 0.4, peak: 0.09, delay: [0, 0.12, 0.24, 0.42][i], rev: 0.6 })); },
    error() { osc({ type: 'square', f0: 200, f1: 150, dur: 0.15, peak: 0.05, rev: 0 }); },
  };

  // ------------------------------------------------------------ háttérzene
  function startMusic() {
    if (!ctx || musicNodes) return;
    const nodes = [];
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 520; filt.Q.value = 3;
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.05; lfoG.gain.value = 260;
    lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start();
    filt.connect(musicGain);
    // Lassú, sötét pad – D-moll akkordfelbontás
    [73.4, 110, 146.8, 174.6, 220.0].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 14;
      const g = ctx.createGain();
      g.gain.value = 0.05 / (1 + i * 0.4);
      o.connect(g); g.connect(filt); o.start();
      nodes.push(o);
    });
    nodes.push(lfo);
    musicNodes = nodes;
    musicGain.gain.setTargetAtTime(0.55, ctx.currentTime, 2);
  }

  function stopMusic() {
    if (!ctx || !musicNodes) return;
    musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    const nodes = musicNodes; musicNodes = null;
    setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch (e) { /* már leállt */ } }), 1500);
  }

  return {
    unlock, suspend, resume,
    play(name, ...args) { try { if (ensure() && sfx[name]) sfx[name](...args); } catch (e) { if (window.__sfxDebug) throw e; /* hang nélkül is megy */ } },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    setMusic(on) { musicOn = on; if (!ctx) return; on ? startMusic() : stopMusic(); },
  };
})();
