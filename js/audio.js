'use strict';
// ---------------------------------------------------------------------------
// Szintetizált hangok (WebAudio) – nincs szükség külső hangfájlokra.
// ---------------------------------------------------------------------------

const SFX = (() => {
  let ctx = null, master = null, musicGain = null, noiseBuf = null, musicNodes = null;
  let volume = 0.6, musicOn = true;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (musicOn) startMusic();
    return ctx;
  }

  function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  function noise(dur, filterType, f0, f1, peak, q = 1) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    env(g, t, 0.01, peak, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random()); src.stop(t + dur + 0.1);
  }

  function tone(type, f0, f1, dur, peak, delay = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    env(g, t, 0.005, peak, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const sfx = {
    laser(kind = 0) {
      const base = [1400, 1100, 900, 1700][kind % 4];
      tone('sawtooth', base, 160, 0.22, 0.12);
      tone('square', base * 1.5, 300, 0.12, 0.04);
    },
    beam() {
      tone('sawtooth', 220, 180, 0.6, 0.09);
      tone('sine', 880, 600, 0.6, 0.07);
      noise(0.5, 'bandpass', 3000, 1200, 0.08, 4);
    },
    plasma() { tone('sine', 300, 70, 0.6, 0.18); noise(0.5, 'lowpass', 1200, 200, 0.18); },
    missile() { noise(0.9, 'bandpass', 800, 3000, 0.16, 3); tone('sawtooth', 200, 500, 0.6, 0.04); },
    hit() { noise(0.25, 'lowpass', 3000, 300, 0.35); tone('sine', 140, 50, 0.25, 0.25); },
    miss() { tone('sine', 900, 1400, 0.15, 0.05); },
    shieldHit() { tone('sine', 500, 900, 0.3, 0.12); noise(0.3, 'highpass', 4000, 2000, 0.06); },
    explosion(big = false) {
      noise(big ? 2.2 : 1.1, 'lowpass', big ? 2200 : 1600, 40, big ? 0.9 : 0.6);
      tone('sine', big ? 90 : 120, 25, big ? 2 : 0.9, big ? 0.6 : 0.4);
    },
    jump() { noise(1.6, 'bandpass', 200, 2400, 0.25, 2); tone('sawtooth', 60, 240, 1.5, 0.08); },
    click() { tone('sine', 1200, 900, 0.06, 0.06); },
    select() { tone('triangle', 700, 1050, 0.08, 0.07); },
    capture() { [0, 0.09, 0.18].forEach((d, i) => tone('triangle', 520 * (1 + i * 0.26), 520 * (1 + i * 0.26), 0.18, 0.09, d)); },
    coin() { tone('square', 1300, 1300, 0.06, 0.04); tone('square', 1950, 1950, 0.12, 0.04, 0.06); },
    alarm() { [0, 0.35].forEach(d => tone('sawtooth', 600, 420, 0.3, 0.07, d)); },
    victory() { [0, 0.12, 0.24, 0.42].forEach((d, i) => tone('triangle', [523, 659, 784, 1046][i], [523, 659, 784, 1046][i], 0.35, 0.1, d)); },
    error() { tone('square', 200, 150, 0.15, 0.06); },
  };

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
    unlock,
    play(name, ...args) { try { if (ensure() && sfx[name]) sfx[name](...args); } catch (e) { /* hang nélkül is megy */ } },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    setMusic(on) { musicOn = on; if (!ctx) return; on ? startMusic() : stopMusic(); },
  };
})();
