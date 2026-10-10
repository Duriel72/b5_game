'use strict';
// ---------------------------------------------------------------------------
// Renderelő: háttér, állomás, procedurális hajók, lövések, robbanások,
// ugrópontok és az állomás pusztulásának „videója”.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const BEAM_STYLE = {
  whitestar: 'beam', minbari: 'beam', narn: 'beam', shadow: 'beam',
  centauri: 'bolt', earth: 'bolt', raider: 'bolt', drazi: 'bolt', station: 'bolt',
  vorchan: 'beam', altarian: 'bolt', centcarrier: 'beam', nova: 'bolt', hyperion: 'beam', starfury: 'bolt',
};

const R = (() => {
  let canvas, ctx, W = 0, H = 0, DPR = 1;
  let bg = null, bgTimer = null, planet = null;
  let stars = [];
  let insetTop = 0, insetBottom = 0;
  let time = 0;
  let mode = 'menu';
  let speed = 1;
  let shakeAmt = 0, shakeOn = true;
  let flashA = 0, flashColor = '255,255,255';
  const visuals = new Map();
  const effects = [];
  const particles = [];
  let layout = null;
  let hoverId = null;
  let cine = null;      // állomáspusztulás állapota
  let stationGone = false;
  const menuShips = [
    { type: 'whitestar', a: 0, r: 1, sp: 0.18 },
    { type: 'whitestar', a: 2.4, r: 1.2, sp: 0.14 },
    { type: 'earth', a: 4.1, r: 1.45, sp: 0.09 },
  ];

  // ---------------------------------------------------------------- setup
  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', resize);
    resize();
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    clearTimeout(bgTimer);
    if (!bg || !bg.width) buildBackground(); else bgTimer = setTimeout(buildBackground, 150);
    stars = [];
    for (let i = 0; i < 220; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, z: rand(0.2, 1), tw: rand(0, TAU) });
    }
  }

  function setInsets(top, bottom) { insetTop = top; insetBottom = bottom; }

  function buildBackground() {
    if (W < 2 || H < 2) return;   // rejtett / 0 méretű ablaknál nincs mit rajzolni
    bg = document.createElement('canvas');
    bg.width = Math.floor(W * DPR); bg.height = Math.floor(H * DPR);
    const b = bg.getContext('2d');
    b.scale(DPR, DPR);
    const g = b.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#04050d'); g.addColorStop(0.5, '#070a1a'); g.addColorStop(1, '#0a0614');
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    // köd
    const blobs = [
      [0.75, 0.25, 0.45, '120,60,200', 0.13], [0.9, 0.7, 0.35, '70,90,230', 0.14], [0.82, 0.42, 0.3, '120,70,220', 0.12],
      [0.2, 0.15, 0.4, '40,120,200', 0.10], [0.55, 0.55, 0.3, '60,200,190', 0.05],
      [0.4, 0.9, 0.35, '90,40,160', 0.08],
    ];
    for (const [x, y, r, c, a] of blobs) {
      const rg = b.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * Math.max(W, H));
      rg.addColorStop(0, `rgba(${c},${a})`); rg.addColorStop(1, `rgba(${c},0)`);
      b.fillStyle = rg; b.fillRect(0, 0, W, H);
    }
    // apró csillagpor
    for (let i = 0; i < 900; i++) {
      b.fillStyle = `rgba(255,255,255,${rand(0.05, 0.35)})`;
      b.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    // Epsilon III bolygó – procedurális gömb (lásd renderPlanet)
    const pr = Math.min(H * 0.5, W * 0.32);
    planet = { x: W * 0.2, y: H * 0.5, r: pr * 1.02 };
    drawPlanet(b, planet.x, planet.y, pr);
  }

  // ---------------------------------------------------------------- bolygó
  // 3D értékzaj a gömbfelületre (nincs varrat), több oktávval
  function makeNoise(seed) {
    const perm = new Uint8Array(512);
    let s = seed;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = new Float32Array(256).map(() => rnd());
    const h = (x, y, z) => val[perm[(perm[(perm[x & 255] + y) & 511] + z) & 511]];
    const fade = q => q * q * (3 - 2 * q);
    const noise = (x, y, z) => {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
      const l = (a, b, k) => a + (b - a) * k;
      return l(
        l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
        l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf),
        zf);
    };
    return (x, y, z, oct) => {
      let a = 0, amp = 0.5, f = 1, norm = 0;
      for (let o = 0; o < oct; o++) { a += amp * noise(x * f, y * f, z * f); norm += amp; amp *= 0.5; f *= 2.03; }
      return a / norm;
    };
  }

  function drawPlanet(b, cx, cy, r) {
    // a felbontást korlátozzuk, hogy gyors maradjon; a kép felskálázva kerül a háttérre
    const size = Math.max(64, Math.min(Math.round(2 * r * DPR), 1000));
    const pc = document.createElement('canvas');
    pc.width = pc.height = size;
    const pctx = pc.getContext('2d');
    const img = pctx.createImageData(size, size);
    const d = img.data;
    const fbm = makeNoise(1977);
    const L = [-0.62, -0.38, 0.69];                       // fény balról-elölről
    const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    const half = size / 2;
    for (let py = 0; py < size; py++) {
      const ny = (py + 0.5 - half) / half;
      for (let px = 0; px < size; px++) {
        const nx = (px + 0.5 - half) / half;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        // forgatott koordináták, hogy a minta ne a középpontra legyen „ragasztva”
        const sx = nx * 0.9 + nz * 0.43, sy = ny, sz = -nx * 0.43 + nz * 0.9;
        const cont = fbm(sx * 2.1 + 5, sy * 2.1 + 3, sz * 2.1 + 1, 5);       // nagy foltok
        const det = fbm(sx * 9 + 11, sy * 9 + 7, sz * 9 + 2, 3);             // finom részlet
        const crat = fbm(sx * 22 + 3, sy * 22 + 9, sz * 22 + 6, 2);          // „kráteres” érdesség
        let k = Math.min(1, Math.max(0, (cont - 0.36) / 0.32));
        k = k * k * (3 - 2 * k);
        // okker – barna paletta
        let cr = 86 + (204 - 86) * k, cg = 50 + (142 - 50) * k, cb = 32 + (92 - 32) * k;
        const m = 0.78 + 0.42 * det - (crat > 0.62 ? (crat - 0.62) * 1.6 : 0);
        cr *= m; cg *= m; cb *= m;
        // megvilágítás: diffúz + perem-sötétedés
        const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        const light = 0.05 + 1.05 * Math.pow(diff, 0.9);
        // a köd felőli (jobb) peremen halvány kékes visszfény
        const rim = Math.pow(1 - nz, 3) * Math.max(0, nx) * 0.55;
        const i = (py * size + px) * 4;
        const edge = Math.min(1, (1 - Math.sqrt(d2)) * size * 0.5);      // élsimítás
        d[i] = Math.min(255, cr * light + 40 * rim);
        d[i + 1] = Math.min(255, cg * light + 60 * rim);
        d[i + 2] = Math.min(255, cb * light + 140 * rim);
        d[i + 3] = 255 * edge * 0.92;
      }
    }
    pctx.putImageData(img, 0, 0);
    // légkör: narancsos pára a megvilágított oldalon
    b.save();
    const atm = b.createRadialGradient(cx, cy, r * 0.97, cx, cy, r * 1.07);
    atm.addColorStop(0, 'rgba(255,175,110,0.32)'); atm.addColorStop(1, 'rgba(255,140,80,0)');
    b.fillStyle = atm;
    b.beginPath(); b.arc(cx, cy, r * 1.07, 0, TAU); b.fill();
    b.restore();
    b.imageSmoothingEnabled = true;
    b.drawImage(pc, cx - r, cy - r, 2 * r, 2 * r);
    // a légkör a megvilágított peremen a korong fölött is látszik
    b.save();
    b.beginPath(); b.arc(cx, cy, r, 0, TAU); b.clip();
    const haze = b.createRadialGradient(cx + r * 0.25, cy + r * 0.15, r * 0.8, cx, cy, r * 1.01);
    haze.addColorStop(0, 'rgba(255,180,120,0)'); haze.addColorStop(1, 'rgba(255,190,140,0.18)');
    b.fillStyle = haze; b.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    b.restore();
  }

  // ---------------------------------------------------------------- layout
  function computeLayout(game) {
    const top = insetTop + 8, bottom = H - insetBottom - 8;
    const fh = Math.max(120, bottom - top);
    const cy = top + fh * 0.5;
    const unit = clamp(Math.min(W / 1500, fh / 560), 0.3, 1.35);
    const L = { top, bottom, fh, cy, unit, slots: new Map() };
    if (mode === 'menu') {
      const u = clamp(Math.min(W / 1100, H / 700), 0.5, 1.6);
      L.station = { x: W * 0.5, y: H * 0.66, s: u * 1.1, rot: -0.12 };
      L.unit = u;
      return L;
    }
    L.station = { x: W * 0.175, y: cy + fh * 0.04, s: unit * 1.08, rot: -0.07 };
    if (!game) return L;
    // a hajók középpontjai ebben a sávban maradnak: fölöttük a „elfoglalható” felirat,
    // alattuk az életcsík és a név is kifér, így semmi nem csúszik a pult alá
    const lo = top + 42 * unit + 14, hi = bottom - 52 * unit - 20;
    const bandH = Math.max(30, hi - lo), bc = (lo + hi) / 2;
    const pl = game.player;
    const n = pl.length;
    const cols = n > 3 ? 2 : 1;
    const perCol = Math.ceil(n / cols);
    pl.forEach((s, i) => {
      const c = cols === 1 ? 0 : i % 2;
      const k = cols === 1 ? i : Math.floor(i / 2);
      const cnt = cols === 1 ? n : (c === 0 ? Math.ceil(n / 2) : Math.floor(n / 2));
      const step = Math.min(bandH / Math.max(1, perCol - 0.5), 135 * unit);
      const x = W * (cols === 1 ? 0.4 : (c === 0 ? 0.36 : 0.44));
      const y = bc + (k - (cnt - 1) / 2) * step + (c === 1 ? step * 0.25 : 0);
      L.slots.set(s.id, { x, y, face: 1 });
    });
    const allies = [...game.enemies.filter(s => s.side === 'ally'), ...(game.visitors || [])];
    allies.forEach((s, i) => {
      const p = allyPoint(L, i);
      L.slots.set(s.id, { x: p.x, y: p.y, face: 1 });
    });
    const en = game.enemies.filter(s => s.side !== 'ally');
    const m = en.length;
    const rows = m <= 3 ? m : m <= 8 ? 4 : 5;
    const ecols = Math.max(1, Math.ceil(m / Math.max(1, rows)));
    en.forEach((s, i) => {
      const c = Math.floor(i / rows), k = i % rows;
      const cnt = Math.min(rows, m - c * rows);
      const step = Math.min(bandH / Math.max(1, rows - 0.4), 125 * unit);
      const xStep = Math.min(W * 0.085, 135 * unit);
      const x = W * 0.86 - (ecols - 1 - c) * xStep - (c % 2) * 0 - (ecols > 1 ? 0 : W * 0.04);
      const y = bc + (k - (cnt - 1) / 2) * step + (c % 2 ? step * 0.3 : 0);
      L.slots.set(s.id, { x: x - c * 0, y, face: -1 });
    });
    return L;
  }

  // A szövetséges ugrópont / várakozóhely az állomás felett
  function allyPoint(L, i = 0) {
    L = L || layout;
    return { x: W * 0.13 + i * Math.min(W * 0.07, 105 * L.unit), y: L.top + L.fh * 0.2 + (i % 2) * 22 * L.unit };
  }

  function visualFor(ship) {
    let v = visuals.get(ship.id);
    if (!v) {
      const slot = layout && layout.slots.get(ship.id);
      v = { id: ship.id, x: slot ? slot.x : W * 0.5, y: slot ? slot.y : H * 0.5, face: slot ? slot.face : 1, spawn: 1, rot: 0, alpha: 1, seed: Math.random() * 100, leaving: false };
      visuals.set(ship.id, v);
    }
    return v;
  }

  function spawnFrom(ship, x, y, face = -1) {
    const v = visualFor(ship);
    v.x = x; v.y = y; v.spawn = 0.05; v.face = face;
  }

  function sync(game) {
    if (!game) { visuals.clear(); return; }
    const ids = new Set([...game.player, ...game.enemies, ...(game.visitors || [])].map(s => s.id));
    for (const id of visuals.keys()) if (!ids.has(id) && !visuals.get(id).leaving) visuals.delete(id);
  }

  // ---------------------------------------------------------------- drawing helpers
  function vgrad(c1, c2, h) {
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c1);
    return g;
  }

  function glow(x, y, r, color, a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
    g.addColorStop(0.25, hexA(color, 0.8 * a));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function hexA(hex, a) {
    if (hex.startsWith('rgba')) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function path(pts, close = true) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    if (close) ctx.closePath();
  }

  // ---------------------------------------------------------------- ships
  // Determinisztikus „véletlen” minták (foltok, sejtek, tüskék) hajótípusonként
  const patternCache = {};
  function pattern(key, n, gen) {
    if (!patternCache[key]) {
      let s = 0;
      for (const ch of key) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
      s = s || 1;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      patternCache[key] = Array.from({ length: n }, (_, i) => gen(rnd, i));
    }
    return patternCache[key];
  }

  // A sorozatbeli hajók oldal-/felülnézeti sziluettjei (orr = +x irány)
  function drawShipShape(type, t, opt = {}) {
    const eng = opt.engines !== false;
    const seed = opt.seed || 0;
    const flick = 0.8 + 0.2 * Math.sin(t * 30 + seed);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    switch (type) {
      // ---------------------------------------------------------------- Fehércsillag
      case 'whitestar': {
        // Fehércsillag felülnézetben (a hivatalos tervrajz alapján):
        // hosszú, karcsú hajó – hegyes „fej” elöl, keskeny törzs, hátul
        // farokpengék és két tüske; a törzs közepéből két sarló alakú kar ível ki
        // (a kar és a törzs között nyílással), a karok végén a törzzsel
        // párhuzamos gondolák elöl ikercsövekkel. Ezüstfehér, lila-kék márványozás.
        const marble = (p, key, n) => {
          ctx.save(); ctx.clip(p);
          ctx.fillStyle = 'rgba(88,52,220,0.6)';
          for (const c of pattern(key, n * 8, r => ({ x: -52 + r() * 104, y: -24 + r() * 48, rx: 0.6 + r() * 1.8, ry: 0.3 + r() * 0.6, a: (r() - 0.5) * 0.8 }))) {
            ctx.strokeStyle = c.a > 0.2 ? 'rgba(30,20,110,0.55)' : 'rgba(225,220,250,0.5)'; ctx.lineWidth = 0.25 + c.ry * 0.7;
            ctx.beginPath(); ctx.moveTo(c.x - c.rx * 1.6, c.y); ctx.bezierCurveTo(c.x - c.rx * 0.5, c.y - c.ry * 2.5, c.x + c.rx * 0.5, c.y + c.ry * 2.5 + c.a, c.x + c.rx * 1.6, c.y + c.a); ctx.stroke();
          }
          ctx.restore();
        };
        const silver = (h) => vgrad('#3d2a9a', '#8a72e6', h);   // lila márvány alapszín
        // farokpengék
        for (const sy of [-1, 1]) {
          const blade = new Path2D();
          blade.moveTo(-12, 3.5 * sy); blade.lineTo(-30, 7.5 * sy); blade.lineTo(-52, 6.5 * sy); blade.lineTo(-30, 4 * sy); blade.closePath();
          ctx.fillStyle = silver(8); ctx.fill(blade); marble(blade, 'wsb' + sy, 10);
        }
        // sarlókarok (elülső ív a gondoláig, hátsó ív vissza a törzshöz – köztük nyílás)
        for (const sy of [-1, 1]) {
          const arm = new Path2D();
          arm.moveTo(24, 4 * sy);
          arm.bezierCurveTo(14, 7 * sy, 10, 14 * sy, 6, 20 * sy);
          arm.lineTo(-8, 21 * sy);
          arm.bezierCurveTo(-10, 14 * sy, -16, 8 * sy, -28, 3.5 * sy);
          arm.lineTo(-14, 3 * sy);
          arm.bezierCurveTo(-9, 6 * sy, -5, 10 * sy, -2, 13 * sy);   // a nyílás hátsó pereme
          arm.bezierCurveTo(0, 9 * sy, 3, 6 * sy, 8, 3.5 * sy);       // a nyílás elülső pereme
          arm.closePath();
          ctx.fillStyle = silver(22); ctx.fill(arm, 'evenodd');
          marble(arm, 'wsa' + sy, 22);
          ctx.strokeStyle = 'rgba(255,240,180,0.85)'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(-2, 13 * sy); ctx.bezierCurveTo(0, 9 * sy, 3, 6 * sy, 8, 3.5 * sy); ctx.stroke();
          // gondola ikercsövekkel
          const pod = new Path2D();
          pod.moveTo(12, 19.5 * sy); pod.lineTo(12, 22.5 * sy); pod.lineTo(-6, 23 * sy); pod.lineTo(-22, 21 * sy); pod.lineTo(-6, 19 * sy); pod.closePath();
          ctx.fillStyle = silver(23); ctx.fill(pod); marble(pod, 'wsp' + sy, 8);
          ctx.strokeStyle = '#4a4e5c'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(12, 20.4 * sy); ctx.lineTo(16, 20.4 * sy); ctx.moveTo(12, 21.8 * sy); ctx.lineTo(16, 21.8 * sy); ctx.stroke();
        }
        // törzs és hegyes fej
        const body = new Path2D();
        body.moveTo(52, 0);
        body.bezierCurveTo(44, -3, 34, -5.5, 22, -5.5);
        body.bezierCurveTo(16, -5, 14, -3.5, 8, -3.5);
        body.lineTo(-30, -2.8); body.lineTo(-36, 0); body.lineTo(-30, 2.8);
        body.lineTo(8, 3.5);
        body.bezierCurveTo(14, 4, 18, 6.5, 26, 6.5);
        body.bezierCurveTo(36, 6, 44, 3, 52, 0);
        ctx.fillStyle = silver(7); ctx.fill(body);
        marble(body, 'wst', 28);
        ctx.strokeStyle = 'rgba(60,64,80,0.8)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(36, -2); ctx.lineTo(22, -2.5); ctx.stroke();
        ctx.fillStyle = 'rgba(60,63,76,0.7)'; ctx.fillRect(-2, -0.6, 16, 1.2);
        ctx.strokeStyle = 'rgba(255,240,180,0.9)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(30, 4.6); ctx.lineTo(20, 4.4); ctx.stroke();
        break;
      }
      // ---------------------------------------------------------------- Sharlin
      case 'minbari': {
        // A tervrajzon a lövegtüskés, lekerekített vég az orr, a hegyes tüske a farok,
        // az uszonyok hátrafelé hajlanak – ezért tükrözve rajzoljuk.
        ctx.save(); ctx.scale(-1, 1);
        // Sharlin hadicirkáló oldalnézetben (a kapott tervrajz alapján):
        // hegyes orr, nagy, lekerekített, bordázott törzs; a háti és a hasi
        // uszony előre hajló, ívelt pengében végződik; hátul lövegtüskék,
        // alul kis gondola. Kékes-ibolya, irizáló burkolat, fényes ablaksorok.
        const hue = 238 + Math.sin(t * 0.6 + seed) * 8;
        const skin = h => {
          const g = ctx.createLinearGradient(0, -h, 0, h);
          g.addColorStop(0, `hsl(${hue + 10},45%,22%)`); g.addColorStop(0.4, `hsl(${hue},50%,52%)`);
          g.addColorStop(0.6, `hsl(${hue - 8},45%,42%)`); g.addColorStop(1, `hsl(${hue + 15},45%,18%)`);
          return g;
        };
        // hátsó lövegtüskék
        ctx.strokeStyle = `hsl(${hue},30%,55%)`; ctx.lineWidth = 0.9;
        for (const y of [-9, -4, 1, 6, 11]) {
          ctx.beginPath(); ctx.moveTo(-32, y); ctx.lineTo(-48 - Math.abs(y) * 0.4, y); ctx.stroke();
          ctx.fillStyle = `hsl(${hue},40%,60%)`; ctx.beginPath(); ctx.arc(-40, y, 1, 0, TAU); ctx.fill();
        }
        // háti uszony – előre hajló penge
        const fin1 = new Path2D();
        fin1.moveTo(-30, -13);
        fin1.quadraticCurveTo(-20, -36, -2, -38);
        fin1.quadraticCurveTo(4, -55, 16, -64);
        fin1.quadraticCurveTo(10, -50, 12, -38);
        fin1.quadraticCurveTo(10, -26, 8, -16);
        fin1.closePath();
        // hasi uszony
        const fin2 = new Path2D();
        fin2.moveTo(-22, 14);
        fin2.quadraticCurveTo(-4, 30, 14, 50);
        fin2.lineTo(24, 61);
        fin2.quadraticCurveTo(18, 46, 13, 30);
        fin2.quadraticCurveTo(11, 21, 10, 14);
        fin2.closePath();
        for (const [f, h] of [[fin1, 64], [fin2, 61]]) {
          ctx.fillStyle = skin(h); ctx.fill(f);
          ctx.save(); ctx.clip(f);
          ctx.strokeStyle = `hsla(${hue + 10},40%,15%,0.45)`; ctx.lineWidth = 0.8;
          for (let k = -60; k < 60; k += 5) { ctx.beginPath(); ctx.moveTo(-30, k); ctx.lineTo(20, k + 6); ctx.stroke(); }
          ctx.fillStyle = 'rgba(235,240,255,0.75)';
          for (let k = 0; k < 7; k++) ctx.fillRect(-12 + k * 2.2, (f === fin1 ? -24 : 22) + k * (f === fin1 ? -1.2 : 1.2), 1, 0.8);
          ctx.restore();
        }
        // törzs
        const body = new Path2D();
        body.moveTo(48, 0.5);
        body.quadraticCurveTo(36, -6, 28, -9.4);
        body.quadraticCurveTo(20, -16, 10, -18);
        body.quadraticCurveTo(-6, -20, -14, -18.8);
        body.quadraticCurveTo(-30, -16, -33, -11.8);
        body.quadraticCurveTo(-38, 0, -33, 11.8);
        body.quadraticCurveTo(-28, 18, -12, 18.8);
        body.quadraticCurveTo(8, 18, 14, 14);
        body.quadraticCurveTo(24, 10, 30.6, 8.2);
        body.quadraticCurveTo(40, 4, 48, 0.5);
        ctx.fillStyle = skin(20); ctx.fill(body);
        ctx.save(); ctx.clip(body);
        // bordák
        ctx.strokeStyle = `hsla(${hue + 15},45%,12%,0.6)`; ctx.lineWidth = 1.4;
        for (let x = -30; x < 24; x += 4.2) { ctx.beginPath(); ctx.moveTo(x + 1.5, -20); ctx.quadraticCurveTo(x - 2.5, 0, x + 1.5, 20); ctx.stroke(); }
        ctx.strokeStyle = `hsla(${hue - 10},70%,80%,0.25)`; ctx.lineWidth = 0.8;
        for (let x = -29; x < 24; x += 4.2) { ctx.beginPath(); ctx.moveTo(x + 1.5, -18); ctx.quadraticCurveTo(x - 2, -6, x, 0); ctx.stroke(); }
        ctx.restore();
        // alsó gondola
        ctx.fillStyle = skin(4);
        ctx.beginPath(); ctx.ellipse(-6, 17, 7, 2.8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `hsl(${hue},30%,55%)`; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(1, 17); ctx.lineTo(8, 17); ctx.stroke();
        for (const [x, y] of [[36, -1], [20, -6], [2, -8], [-16, -7]]) glow(x, y, 2.5, '#cfe2ff', 0.5 + 0.3 * Math.sin(t * 2 + x));
        ctx.restore();
        break;
      }
      // ---------------------------------------------------------------- G'Quan
      case 'narn': {
        // G'Quan nehézcirkáló felülnézetben (a kapott kép alapján): elöl két
        // hegyes villa a lövegcsatornával, nagy nyílhegy alakú test zöld sávval,
        // X alakú karok a két hajtóműgondolához, hátul két hosszú szárnyhegy,
        // középen hajtóműblokk. Élénkvörös burkolat sötét narn törzsi mintával.
        const sym = (pts, sy) => pts.flatMap((v, i) => (i % 2 ? v * sy : v));
        const tribal = (clipPath, key) => {
          ctx.save(); ctx.clip(clipPath);
ctx.fillStyle = 'rgba(52,26,24,0.9)';
          for (const z of pattern(key, 34, r => ({ x: -52 + r() * 104, y: -30 + r() * 60, d: r() < 0.5 ? 1 : -1, l: 3 + r() * 6, h: 1.6 + r() * 2.2 }))) {
            // szögletes, ferdén megtört „törzsi” folt
            ctx.beginPath();
            ctx.moveTo(z.x, z.y); ctx.lineTo(z.x + z.l, z.y); ctx.lineTo(z.x + z.l + z.h, z.y + z.h * z.d);
            ctx.lineTo(z.x + z.l + z.h, z.y + (z.h + 3) * z.d); ctx.lineTo(z.x + z.l, z.y + (z.h + 3) * z.d);
            ctx.lineTo(z.x + z.l, z.y + z.h * z.d); ctx.lineTo(z.x + 1, z.y + z.h * z.d);
            ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        };
        const red = vgrad('#9a1611', '#e3342b', 28);
        const edge = 'rgba(228,222,216,0.9)';
        // hátsó szárnyhegyek
        for (const sy of [-1, 1]) {
          const wing = new Path2D();
          const p = sym([-7.6, 16.5, -24.8, 27, -50, 6.6, -7.6, 6.2], sy);
          wing.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) wing.lineTo(p[i], p[i + 1]); wing.closePath();
          ctx.fillStyle = red; ctx.fill(wing); tribal(wing, 'nw' + sy);
          ctx.strokeStyle = edge; ctx.lineWidth = 0.9; ctx.stroke(wing);
        }
        // fő test (elöl villa a csatornával)
        const hull = new Path2D();
        [[50, -5.2], [42, -4.8], [42, 4.8], [50, 5.2], [10.9, 16.8], [-6.3, 16.8], [-7.6, 6.2], [-7.6, -6.2], [-6.3, -16.8], [10.9, -16.8]]
          .forEach(([x, y], i) => (i ? hull.lineTo(x, y) : hull.moveTo(x, y)));
        hull.closePath();
        ctx.fillStyle = red; ctx.fill(hull); tribal(hull, 'nh');
        // zöld sáv vörös pöttyökkel
        ctx.save(); ctx.clip(hull);
        ctx.fillStyle = '#1f9a3c'; ctx.fillRect(3.6, -17, 5.3, 34);
        ctx.fillStyle = '#e3342b';
        for (const y of [-12, -7.5, 7.5, 12]) { ctx.beginPath(); ctx.arc(6.2, y, 1.1, 0, TAU); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = edge; ctx.lineWidth = 0.9; ctx.stroke(hull);
        // lövegcsatorna és reaktor
        ctx.fillStyle = '#3b3537'; ctx.fillRect(21, -4.6, 21, 9.2);
        ctx.strokeStyle = 'rgba(200,60,50,0.9)'; ctx.lineWidth = 0.7;
        for (let x = 23; x < 42; x += 2.6) { ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x, 4); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(190,190,195,0.7)';
        ctx.beginPath(); ctx.moveTo(21, -1.4); ctx.lineTo(42, -1.4); ctx.moveTo(21, 1.4); ctx.lineTo(42, 1.4); ctx.stroke();
        const rg = ctx.createRadialGradient(15, -1, 0.5, 16, 0, 4.5);
        rg.addColorStop(0, '#a9a4a6'); rg.addColorStop(1, '#2a2527');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(16, 0, 4.2, 0, TAU); ctx.fill();
        // X karok és hajtóműgondolák antennákkal
        for (const sy of [-1, 1]) {
          ctx.strokeStyle = edge; ctx.lineWidth = 4.6;
          ctx.beginPath(); ctx.moveTo(4, 4 * sy); ctx.lineTo(-21, 27.6 * sy); ctx.stroke();
          ctx.strokeStyle = '#d42d25'; ctx.lineWidth = 3.4;
          ctx.beginPath(); ctx.moveTo(4, 4 * sy); ctx.lineTo(-21, 27.6 * sy); ctx.stroke();
          ctx.strokeStyle = '#5a5254'; ctx.lineWidth = 0.6;
          for (const dy of [-1.6, -0.6, 0.4, 1.4]) { ctx.beginPath(); ctx.moveTo(-14.2, (27.6 + dy) * sy); ctx.lineTo(-5 + dy * 1.5, (27.6 + dy) * sy); ctx.stroke(); }
          ctx.fillStyle = vgrad('#7d120e', '#e0332a', 3);
          ctx.beginPath(); ctx.ellipse(-20.8, 27.6 * sy, 7, 2.7, 0, 0, TAU); ctx.fill();
          if (eng) glow(-28.5, 27.6 * sy, 6 * flick, '#ff9a3d');
        }
        // hajtóműblokk
        ctx.fillStyle = vgrad('#2c2729', '#77706f', 6);
        ctx.fillRect(-41, -6, 33.4, 12);
        ctx.strokeStyle = 'rgba(200,50,40,0.85)'; ctx.lineWidth = 0.6;
        for (let x = -36; x < -10; x += 2) { ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x, 5); ctx.stroke(); }
        ctx.fillStyle = '#1d1a1b'; ctx.beginPath(); ctx.ellipse(-40, 0, 3, 5.6, 0, 0, TAU); ctx.fill();
        if (eng) glow(-44, 0, 13 * flick, '#ffb070');
        break;
      }
      // ---------------------------------------------------------------- Centauri közös
      case 'centauri': {
        // Primus csatacirkáló felülnézetben: hosszú, szegmentált, keskeny test,
        // elöl lövegtüskék, középen púp háti éllel, hátul hajtóművek.
        const cg = vgrad('#4f4562', '#c2b6d4', 7);
        ctx.strokeStyle = '#9d93ad'; ctx.lineWidth = 0.8;
        for (const y of [-1.8, 0, 1.8]) { ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(55, y); ctx.stroke(); }
        const body = new Path2D();
        [[50, 0], [43, -3.4], [36, -5.8], [-3, -5.8], [-4, -6.6], [-24, -6.6], [-25, -5.5], [-49.5, -5.5],
          [-49.5, 5.5], [-25, 5.5], [-24, 6.6], [-4, 6.6], [-3, 5.8], [36, 5.8], [43, 3.4]]
          .forEach(([x, y], i) => (i ? body.lineTo(x, y) : body.moveTo(x, y)));
        body.closePath();
        ctx.fillStyle = '#6e6382'; path([-3, -6.6, -6, -10, -10, -10, -9, -6.6]); ctx.fill();
        ctx.fillStyle = cg; ctx.fill(body);
        ctx.save(); ctx.clip(body);
        ctx.strokeStyle = 'rgba(40,32,55,0.55)'; ctx.lineWidth = 0.7;
        for (let x = -46; x < 40; x += 4.6) { ctx.beginPath(); ctx.moveTo(x, -7); ctx.lineTo(x, 7); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-50, -2.6); ctx.lineTo(40, -2.6); ctx.moveTo(-50, 2.6); ctx.lineTo(40, 2.6); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = '#d6b25e'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(44, 0); ctx.lineTo(-46, 0); ctx.stroke();
        ctx.fillStyle = '#3b3349';
        for (const x of [24, 6, -14, -34]) { ctx.beginPath(); ctx.arc(x, 0, 1.6, 0, TAU); ctx.fill(); }
        if (eng) { glow(-50, -3, 6 * flick, '#c77dff'); glow(-50, 3, 6 * flick, '#c77dff'); }
        break;
      }
      case 'vorchan': {
        // Vorchan: lándzsa alakú test, hátul nagy, előre görbülő félhold-szárny.
        const cres = new Path2D();
        cres.moveTo(20, -50); cres.quadraticCurveTo(-60, 0, 20, 50);
        cres.quadraticCurveTo(-36, 0, 20, -50);
        cres.closePath();
        ctx.fillStyle = vgrad('#4b4160', '#b9adcc', 50); ctx.fill(cres);
        ctx.save(); ctx.clip(cres);
        ctx.strokeStyle = 'rgba(40,32,55,0.5)'; ctx.lineWidth = 0.8;
        for (let y = -44; y <= 44; y += 7) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(20, y * 1.05); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = '#d6b25e'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(18, -46); ctx.quadraticCurveTo(-50, 0, 18, 46); ctx.stroke();
        const sp = new Path2D();
        [[38, 0], [26, -2.4], [10, -3], [10, -5.5], [-2, -5.5], [-2, -3], [-32, -2.6], [-32, 2.6], [-2, 3], [-2, 5.5], [10, 5.5], [10, 3], [26, 2.4]]
          .forEach(([x, y], i) => (i ? sp.lineTo(x, y) : sp.moveTo(x, y)));
        sp.closePath();
        ctx.fillStyle = vgrad('#5a4f6e', '#d6cce4', 5); ctx.fill(sp);
        ctx.strokeStyle = 'rgba(40,32,55,0.6)'; ctx.lineWidth = 0.6;
        for (let x = 0; x < 9; x += 2.2) { ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x, 5); ctx.stroke(); }
        glow(36, 0, 4, '#ffd27a', 0.6 + 0.3 * flick);
        if (eng) glow(-33, 0, 8 * flick, '#c77dff');
        break;
      }
      case 'altarian': {
        // Altarian romboló: keskeny elülső test lövegtüskékkel, hátul széles kereszt-blokk.
        ctx.strokeStyle = '#a69bb6'; ctx.lineWidth = 0.9;
        for (const y of [-3.5, 0, 3.5]) { ctx.beginPath(); ctx.moveTo(36, y); ctx.lineTo(50, y); ctx.stroke(); }
        const g = vgrad('#4f4562', '#c8bcd9', 12);
        ctx.fillStyle = g;
        path([37, -7, 30, -11, -12, -11, -12, 11, 30, 11, 37, 7]); ctx.fill();
        ctx.fillStyle = vgrad('#3e3550', '#a69bb6', 6); ctx.fillRect(-18, -6, 7, 12);
        ctx.fillStyle = vgrad('#4a4060', '#c2b6d4', 26);
        path([-17, -22, -20, -26, -34, -26, -37, -22, -37, 22, -34, 26, -20, 26, -17, 22]); ctx.fill();
        ctx.fillStyle = vgrad('#3e3550', '#a69bb6', 8); ctx.fillRect(-50, -8, 13, 16);
        ctx.strokeStyle = 'rgba(40,32,55,0.55)'; ctx.lineWidth = 0.7;
        for (let x = -8; x < 30; x += 4.2) { ctx.beginPath(); ctx.moveTo(x, -11); ctx.lineTo(x, 11); ctx.stroke(); }
        for (let y = -22; y <= 22; y += 5.5) { ctx.beginPath(); ctx.moveTo(-36, y); ctx.lineTo(-18, y); ctx.stroke(); }
        ctx.strokeStyle = '#d6b25e'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(-48, 0); ctx.stroke();
        if (eng) { glow(-51, -4, 7 * flick, '#c77dff'); glow(-51, 4, 7 * flick, '#c77dff'); }
        break;
      }
      case 'centcarrier': {
        // Centauri csatahordozó: széles törzs elöl hangárnyílással, oldalt két
        // nagy, előre ívelő félhold-szárny, hátul három hosszú lövegcső.
        for (const sy of [-1, 1]) {
          const w = new Path2D();
          w.moveTo(-21, 17 * sy); w.quadraticCurveTo(-28, 48 * sy, -2, 58 * sy);
          w.quadraticCurveTo(-4, 34 * sy, 0, 17 * sy); w.closePath();
          ctx.fillStyle = vgrad('#4a4060', '#c2b6d4', 52); ctx.fill(w);
          ctx.save(); ctx.clip(w);
          ctx.strokeStyle = 'rgba(40,32,55,0.5)'; ctx.lineWidth = 0.7;
          for (let k = 20; k < 52; k += 5) { ctx.beginPath(); ctx.moveTo(-26, k * sy); ctx.lineTo(0, (k - 2) * sy); ctx.stroke(); }
          ctx.restore();
          ctx.fillStyle = '#3b3349';
          for (const k of [28, 40]) { ctx.beginPath(); ctx.arc(-10, k * sy, 1.6, 0, TAU); ctx.fill(); }
        }
        ctx.fillStyle = '#8f85a0';
        for (const y of [-17, 0, 17]) ctx.fillRect(-46 + (y ? 6 : 0), y - 1.4, 26 - (y ? 6 : 0), 2.8);
        const body = new Path2D();
        [[43, -9], [36, -9], [36, -21], [-22, -21], [-22, 21], [36, 21], [36, 9], [43, 9]]
          .forEach(([x, y], i) => (i ? body.lineTo(x, y) : body.moveTo(x, y)));
        body.closePath();
        ctx.fillStyle = vgrad('#4f4562', '#c8bcd9', 21); ctx.fill(body);
        ctx.save(); ctx.clip(body);
        ctx.strokeStyle = 'rgba(40,32,55,0.5)'; ctx.lineWidth = 0.7;
        for (let x = -20; x < 42; x += 4) { ctx.beginPath(); ctx.moveTo(x, -21); ctx.lineTo(x, 21); ctx.stroke(); }
        for (const y of [-14, -7, 7, 14]) { ctx.beginPath(); ctx.moveTo(-22, y); ctx.lineTo(42, y); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = '#2a2433'; ctx.fillRect(38, -7, 5, 14);
        ctx.strokeStyle = '#a69bb6'; ctx.lineWidth = 0.7;
        for (const y of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(43, y); ctx.lineTo(52, y); ctx.stroke(); }
        ctx.fillStyle = '#3b3349';
        for (const [x, y] of [[24, -14], [24, 14], [6, -14], [6, 14], [-10, 0], [12, 0]]) { ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#d6b25e'; ctx.lineWidth = 0.8; ctx.stroke(body);
        glow(30, 0, 5, '#d070ff', 0.7);
        if (eng) for (const y of [-12, 0, 12]) glow(-23, y, 6 * flick, '#c77dff');
        break;
      }
      // ---------------------------------------------------------------- Földi Szövetség
      case 'earth': {
        // Omega romboló oldalnézetben (a kapott tervrajz alapján): elöl ötszögű
        // parancsnoki blokk antennákkal, vékony gerinc, középen a hatalmas forgó
        // dob, hátul kiszélesedő hajtóműblokk két fúvókával.
        const steel = h => vgrad('#2e3238', '#8f969e', h);
        ctx.strokeStyle = '#8f969e'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(44, -9.8); ctx.lineTo(44, -18); ctx.moveTo(40, -9.8); ctx.lineTo(40, -16); ctx.moveTo(43, 15); ctx.lineTo(43, 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(49.5, -2.5); ctx.lineTo(55, -2.5); ctx.moveTo(49.5, 3.5); ctx.lineTo(54, 3.5); ctx.stroke();
        // gerinc
        ctx.fillStyle = steel(3); ctx.fillRect(-22, -2.5, 58.4, 5);
        ctx.fillStyle = '#41464d'; ctx.fillRect(-12, -4, 14, 8);
        ctx.fillStyle = '#c0392b';
        for (let x = -11; x < 1; x += 2.2) { ctx.fillRect(x, -3, 1, 1.2); ctx.fillRect(x, 1.8, 1, 1.2); }
        // forgó rész – a sorozatban szögletes, panelezett téglatest (nem henger)
        const dx0 = 3.8, dx1 = 23.4, dy = 15.8;
        ctx.fillStyle = '#4b5057'; ctx.fillRect(2, -4.5, 23.2, 9);                   // csatlakozó gyűrűk helye
        const bx = ctx.createLinearGradient(dx0, 0, dx1, 0);
        bx.addColorStop(0, '#3c4047'); bx.addColorStop(0.5, '#5d636b'); bx.addColorStop(1, '#3c4047');
        ctx.fillStyle = bx; ctx.fillRect(dx0, -dy, dx1 - dx0, dy * 2);
        // zárólemezek alul-felül
        ctx.fillStyle = '#2b2e33'; ctx.fillRect(dx0 - 0.6, -dy - 1.2, dx1 - dx0 + 1.2, 2.4); ctx.fillRect(dx0 - 0.6, dy - 1.2, dx1 - dx0 + 1.2, 2.4);
        // panelrács és X merevítések
        ctx.strokeStyle = 'rgba(18,20,24,0.85)'; ctx.lineWidth = 0.55;
        const cols = 4, rows = 8, cw = (dx1 - dx0) / cols, rh = (dy * 2 - 4) / rows;
        for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(dx0 + i * cw, -dy + 1.2); ctx.lineTo(dx0 + i * cw, dy - 1.2); ctx.stroke(); }
        for (let j = 0; j <= rows; j++) { const y = -dy + 2 + j * rh; ctx.beginPath(); ctx.moveTo(dx0, y); ctx.lineTo(dx1, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(150,158,168,0.35)'; ctx.lineWidth = 0.45;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          if ((i + j) % 2) continue;
          const x = dx0 + i * cw, y = -dy + 2 + j * rh;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw, y + rh); ctx.moveTo(x + cw, y); ctx.lineTo(x, y + rh); ctx.stroke();
        }
        // középső agy ablakfényekkel
        ctx.fillStyle = '#8e959e'; ctx.fillRect(dx0 + 2, -2.4, dx1 - dx0 - 4, 4.8);
        ctx.fillStyle = 'rgba(210,60,50,0.85)';
        for (let x = dx0 + 3; x < dx1 - 2.5; x += 2.4) { ctx.fillRect(x, -1.6, 1, 1); ctx.fillRect(x, 0.6, 1, 1); }
        // csatlakozó gyűrűk
        ctx.fillStyle = '#6b7179'; ctx.fillRect(dx0 - 2, -4.2, 1.6, 8.4); ctx.fillRect(dx1 + 0.4, -4.2, 1.6, 8.4);
        // elülső blokk
        const front = new Path2D();
        [[49.5, -7.6], [47.5, -9.8], [36.4, -9.8], [36.4, 15], [41.5, 15], [49.5, 6.8]].forEach(([x, y], i) => (i ? front.lineTo(x, y) : front.moveTo(x, y)));
        front.closePath();
        ctx.fillStyle = steel(13); ctx.fill(front);
        ctx.strokeStyle = 'rgba(15,17,20,0.7)'; ctx.lineWidth = 0.6; ctx.stroke(front);
        ctx.fillStyle = '#d7dbe0'; ctx.fillRect(38.5, -7.5, 8, 2.2);
        ctx.fillStyle = '#28509e'; ctx.fillRect(41, 4, 3.4, 3.4);
        ctx.fillStyle = '#d6b25e'; ctx.fillRect(41.8, 4.8, 1.8, 1.8);
        // hajtóműblokk
        const rear = new Path2D();
        [[-22, -2.5], [-30.5, -8.5], [-49, -8.5], [-49, 8.5], [-30.5, 8.5], [-22, 2.5]].forEach(([x, y], i) => (i ? rear.lineTo(x, y) : rear.moveTo(x, y)));
        rear.closePath();
        ctx.fillStyle = steel(9); ctx.fill(rear);
        ctx.fillStyle = '#5a3a3a'; ctx.fillRect(-40, -7, 10, 14);
        ctx.fillStyle = '#3b3f9a'; ctx.fillRect(-49, -6.5, 8, 5); ctx.fillRect(-49, 1.5, 8, 5);
        if (eng) { glow(-50, -4, 7 * flick, '#8fa8ff'); glow(-50, 4, 7 * flick, '#8fa8ff'); }
        if (Math.sin(t * 5 + seed) > 0.5) { glow(55, -2.5, 3, '#ff3b3b', 1); glow(54, 3.5, 3, '#ff3b3b', 1); glow(44, -18, 3, '#ff3b3b', 1); }
        break;
      }
      case 'nova': {
        // Nova csatahajó oldalnézetben: ötszögű elülső blokk, hosszú törzs
        // sok ikercsövű lövegtoronnyal fent és lent, hátsó hajtóműblokk.
        const steel = h => vgrad('#2e3238', '#8f969e', h);
        ctx.strokeStyle = '#8f969e'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(30, -12); ctx.lineTo(30, -21); ctx.moveTo(34, -12); ctx.lineTo(34, -18); ctx.moveTo(32, 16); ctx.lineTo(32, 24); ctx.stroke();
        ctx.fillStyle = steel(6); ctx.fillRect(-44, -6, 66, 12);
        ctx.save(); ctx.beginPath(); ctx.rect(-44, -6, 66, 12); ctx.clip();
        ctx.strokeStyle = 'rgba(15,17,20,0.6)'; ctx.lineWidth = 0.6;
        for (let x = -42; x < 22; x += 4) { ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x, 6); ctx.stroke(); }
        ctx.restore();
        for (const x of [-36, -24, -12, 0, 12]) {
          for (const sy of [-1, 1]) {
            ctx.fillStyle = '#4a4f56'; ctx.fillRect(x - 3, sy > 0 ? 6 : -9, 7, 3);
            ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 0.9;
            ctx.beginPath(); ctx.moveTo(x + 4, (sy > 0 ? 7 : -8)); ctx.lineTo(x + 10, (sy > 0 ? 7 : -8)); ctx.moveTo(x + 4, (sy > 0 ? 8.5 : -6.5)); ctx.lineTo(x + 10, (sy > 0 ? 8.5 : -6.5)); ctx.stroke();
          }
        }
        ctx.fillStyle = '#c0392b';
        for (let x = -40; x < 20; x += 6) ctx.fillRect(x, -1, 1.4, 1.2);
        const front = new Path2D();
        [[50, -8], [47, -12], [22, -12], [22, 16], [36, 16], [50, 6]].forEach(([x, y], i) => (i ? front.lineTo(x, y) : front.moveTo(x, y)));
        front.closePath();
        ctx.fillStyle = steel(14); ctx.fill(front);
        ctx.strokeStyle = 'rgba(15,17,20,0.7)'; ctx.lineWidth = 0.6; ctx.stroke(front);
        ctx.fillStyle = '#d7dbe0'; ctx.fillRect(26, -9.5, 14, 2.6);
        ctx.fillStyle = '#c9a54a'; ctx.fillRect(30, 7, 5, 5);
        ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 1.1;
        for (const y of [-3, 1]) { ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(58, y); ctx.stroke(); }
        ctx.fillStyle = steel(9); ctx.fillRect(-52, -9, 9, 18);
        if (eng) { glow(-53, -4, 7 * flick, '#8fa8ff'); glow(-53, 4, 7 * flick, '#8fa8ff'); }
        break;
      }
      case 'hyperion': {
        // Hyperion nehézcirkáló oldalnézetben: lekerekített, bézs elülső törzs kék
        // sávokkal, középen felépítmény, rácsos összekötő váz, hátsó hajtóműrész.
        const hull = h => vgrad('#5d594f', '#d8d3c4', h);
        ctx.strokeStyle = '#a7a294'; ctx.lineWidth = 0.7;
        for (const y of [-2, 2]) { ctx.beginPath(); ctx.moveTo(48, y); ctx.lineTo(56, y); ctx.stroke(); }
        // rácsos váz
        ctx.strokeStyle = '#8c887c'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(-22, -4); ctx.moveTo(4, 4); ctx.lineTo(-22, 4);
        for (let x = 4; x > -22; x -= 6.5) { ctx.moveTo(x, -4); ctx.lineTo(x - 6.5, 4); ctx.moveTo(x, 4); ctx.lineTo(x - 6.5, -4); }
        ctx.stroke();
        ctx.fillStyle = hull(5); ctx.fillRect(-16, -5, 8, 10);
        ctx.fillStyle = '#2b2a27'; for (let y = -3.5; y < 4; y += 2.4) ctx.fillRect(-14.5, y, 5, 1.2);
        // hátsó rész
        ctx.fillStyle = hull(9);
        ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(-44, -8); ctx.quadraticCurveTo(-50, -8, -50, 0); ctx.quadraticCurveTo(-50, 8, -44, 8); ctx.lineTo(-22, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#26251f'; for (let y = -6; y < 6; y += 3) ctx.fillRect(-46, y, 5, 1.8);
        ctx.fillStyle = '#3a3830'; ctx.fillRect(-34, -9.5, 8, 19);
        // elülső törzs
        ctx.fillStyle = hull(9);
        ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(42, -8); ctx.quadraticCurveTo(49, -8, 49, -1); ctx.lineTo(49, 3); ctx.quadraticCurveTo(48, 8, 40, 9); ctx.lineTo(4, 9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3557b0'; ctx.fillRect(38, -8, 5, 17); ctx.fillRect(18, -8, 3, 17);
        ctx.fillStyle = '#1f1e1b'; ctx.font = 'bold 6px sans-serif'; ctx.fillText('21', 26, 2);
        // felépítmény
        ctx.fillStyle = hull(12); ctx.fillRect(4, -13, 10, 25);
        ctx.fillStyle = '#3557b0'; ctx.fillRect(4, -4, 10, 4);
        ctx.fillStyle = '#d9c05a'; ctx.beginPath(); ctx.ellipse(9, -13, 3.5, 1.3, 0, 0, TAU); ctx.fill();
        if (eng) glow(-51, 0, 9 * flick, '#8fa8ff');
        if (Math.sin(t * 5 + seed) > 0.5) glow(56, -2, 3, '#ff3b3b', 1);
        break;
      }
      case 'starfury': {
        // Starfury felülnézetben: rövid törzs pilótafülkével, két oldalra
        // kinyúló szárnyak, a szárnyvégeken hosszú hajtóműgondolák.
        for (const sy of [-1, 1]) {
          ctx.fillStyle = vgrad('#5a6068', '#bcc3cb', 16);
          path([6, 2.5 * sy, -4, 16 * sy, -10, 16 * sy, -6, 2.5 * sy]); ctx.fill();
          ctx.fillStyle = vgrad('#3c4047', '#a4abb4', 3);
          path([8, 16 * sy, 4, 18.2 * sy, -16, 18.2 * sy, -16, 13.8 * sy, 4, 13.8 * sy]); ctx.fill();
          if (eng) glow(-17, 16 * sy, 6 * flick, '#ffb070');
        }
        ctx.fillStyle = vgrad('#4d525a', '#d3d8de', 4);
        path([26, 0, 20, -3, -12, -3.2, -12, 3.2, 20, 3]); ctx.fill();
        ctx.fillStyle = '#1d2b3a'; ctx.beginPath(); ctx.ellipse(15, 0, 4, 1.8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c0392b'; ctx.fillRect(-4, -0.6, 6, 1.2);
        if (eng) glow(-13, 0, 5 * flick, '#ffb070');
        break;
      }
      // ---------------------------------------------------------------- kereskedő teherhajó
      case 'merchant': {
        // Civil teherhajó: hosszú gerinc konténersorral, elöl pilótafülke, hátul hajtómű.
        if (eng) { glow(-46, -3, 8 * flick, '#9fd0ff'); glow(-46, 3, 8 * flick, '#9fd0ff'); }
        ctx.fillStyle = vgrad('#3d4148', '#9aa1a9', 4);
        ctx.fillRect(-44, -3, 80, 6);
        const cols = ['#c0782a', '#7d8b3a', '#3b6fa0', '#a8432f', '#c9a23a', '#5e6b75'];
        for (let i = 0; i < 6; i++) {
          for (const sy of [-1, 1]) {
            ctx.fillStyle = cols[(i * 2 + (sy > 0 ? 1 : 0)) % cols.length];
            ctx.fillRect(-32 + i * 10, sy < 0 ? -11 : 3, 9, 8);
            ctx.strokeStyle = 'rgba(20,20,20,0.5)'; ctx.lineWidth = 0.6;
            ctx.strokeRect(-32 + i * 10, sy < 0 ? -11 : 3, 9, 8);
          }
        }
        ctx.fillStyle = vgrad('#4b5058', '#c9ced5', 8);
        path([36, -6, 46, -4, 50, 0, 46, 4, 36, 6]); ctx.fill();
        ctx.fillStyle = '#9fd0ff'; ctx.fillRect(42, -2, 4, 4);
        ctx.fillStyle = vgrad('#3a3e45', '#8d949c', 7);
        ctx.fillRect(-48, -7, 8, 14);
        if (Math.sin(t * 4 + seed) > 0.4) glow(50, 0, 3, '#ffe08a', 1);
        break;
      }
      // ---------------------------------------------------------------- kalóz elfogó
      case 'raiderinterceptor': {
        // Ikertörzsű, V alakú vadász: két előre nyúló törzsgerenda, középen pilótafülke.
        if (eng) { glow(-18, -9, 7 * flick, '#ff6b5a'); glow(-18, 9, 7 * flick, '#ff6b5a'); }
        for (const sy of [-1, 1]) {
          ctx.fillStyle = vgrad('#2a1416', '#9c2f3a', 4);
          path([32, 9 * sy, 26, 6 * sy, -16, 7 * sy, -18, 11 * sy, -16, 13 * sy, 20, 12 * sy]); ctx.fill();
          ctx.strokeStyle = 'rgba(255,140,120,0.45)'; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(28, 9.5 * sy); ctx.lineTo(-14, 10 * sy); ctx.stroke();
        }
        ctx.fillStyle = vgrad('#1d1416', '#6d2a30', 7);
        path([10, 0, 0, -7, -14, -7, -10, 0, -14, 7, 0, 7]); ctx.fill();
        ctx.fillStyle = '#ffcf9a'; ctx.beginPath(); ctx.ellipse(2, 0, 3, 1.6, 0, 0, TAU); ctx.fill();
        break;
      }
      // ---------------------------------------------------------------- kalóz ágyúnaszád
      case 'raidergunship': {
        // Felfegyverzett teherhajó: tömbös raktérmodulok eltérő színű lemezekkel,
        // ráhegesztett lövegtornyok és rakétasínek, rozsdafoltok.
        if (eng) { glow(-40, -4, 9 * flick, '#ffb070'); glow(-40, 4, 9 * flick, '#ffb070'); }
        const plates = ['#6b5a46', '#7d4a32', '#545a5f', '#8a6a3c'];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = vgrad('#2e2822', plates[i], 9);
          ctx.fillRect(-30 + i * 13, -8 - (i % 2), 12, 16 + (i % 2) * 2);
        }
        ctx.fillStyle = vgrad('#3a332b', '#a08a6a', 6);
        path([36, -3, 30, -6, 22, -6, 22, 6, 30, 6, 36, 3]); ctx.fill();
        ctx.fillStyle = '#3b3530'; ctx.fillRect(-38, -6, 8, 12);
        // rozsda és hegesztési varratok
        ctx.fillStyle = 'rgba(150,70,30,0.55)';
        for (const p of pattern('rgrust', 10, q => ({ x: -28 + q() * 50, y: -7 + q() * 14, r: 0.8 + q() * 1.8 }))) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = 'rgba(20,16,12,0.7)'; ctx.lineWidth = 0.6;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-30 + i * 13, -9); ctx.lineTo(-30 + i * 13, 9); ctx.stroke(); }
        // lövegtornyok és rakétasínek
        ctx.fillStyle = '#2b2622';
        for (const sy of [-1, 1]) {
          ctx.beginPath(); ctx.arc(14, 8 * sy, 2.4, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(14, 8 * sy); ctx.lineTo(24, 8 * sy); ctx.stroke();
          ctx.fillStyle = '#9a9184'; ctx.fillRect(4, 9.5 * sy - (sy < 0 ? 2 : 0), 12, 2); ctx.fillStyle = '#2b2622';
        }
        ctx.fillStyle = '#ffcf7a'; ctx.fillRect(28, -1, 3, 2);
        break;
      }
      // ---------------------------------------------------------------- kalóz csatahordozó
      case 'raiderwagon': {
        // „Battlewagon”: nagy, szögletes, rozsdás anyahajó; elöl sötét hangárszáj,
        // oldalt hajtóműgondolák, tetején antennák és lövegtornyok.
        if (eng) for (const y of [-14, -5, 5, 14]) glow(-50, y, 8 * flick, '#ffb070');
        for (const sy of [-1, 1]) {
          ctx.fillStyle = vgrad('#3a3229', '#8a7458', 6);
          ctx.fillRect(-48, 9 * sy - 6 + (sy > 0 ? 0 : 0), 30, 12);
        }
        const hull = new Path2D();
        [[46, -9], [40, -14], [10, -16], [-6, -12], [-40, -12], [-44, -8], [-44, 8], [-40, 12], [-6, 12], [10, 16], [40, 14], [46, 9]]
          .forEach(([x, y], i) => (i ? hull.lineTo(x, y) : hull.moveTo(x, y)));
        hull.closePath();
        ctx.fillStyle = vgrad('#3d352c', '#9a8466', 16); ctx.fill(hull);
        ctx.save(); ctx.clip(hull);
        ctx.strokeStyle = 'rgba(25,20,16,0.7)'; ctx.lineWidth = 0.7;
        for (let x = -40; x < 46; x += 7) { ctx.beginPath(); ctx.moveTo(x, -16); ctx.lineTo(x, 16); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-44, -5); ctx.lineTo(46, -5); ctx.moveTo(-44, 5); ctx.lineTo(46, 5); ctx.stroke();
        ctx.fillStyle = 'rgba(140,60,25,0.5)';
        for (const p of pattern('rwrust', 18, q => ({ x: -40 + q() * 84, y: -14 + q() * 28, r: 1 + q() * 2.5 }))) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
        ctx.restore();
        // hangárszáj elöl
        ctx.fillStyle = '#120e0b'; ctx.fillRect(36, -6, 10, 12);
        ctx.fillStyle = 'rgba(255,150,80,0.35)'; ctx.fillRect(36, -6, 2, 12);
        // lövegtornyok, antennák
        ctx.fillStyle = '#2a241f';
        for (const [x, y] of [[20, -10], [20, 10], [-2, -9], [-2, 9], [-24, 0]]) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#8a8070'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(-18, -22); ctx.moveTo(-20, 12); ctx.lineTo(-24, 21); ctx.stroke();
        if (Math.sin(t * 4 + seed) > 0.5) glow(-18, -22, 3, '#ff3b3b', 1);
        break;
      }
      // ---------------------------------------------------------------- kalóz Delta-V
      case 'raider': {
        // Kalóz delta-vadász: lapos, homokszínű háromszög sötét sávokkal.
        if (eng) { glow(-15, -6, 9 * flick, '#ff6b5a'); glow(-15, 6, 9 * flick, '#ff6b5a'); }
        const body = new Path2D();
        body.moveTo(32, 0); body.lineTo(-16, -22); body.lineTo(-10, 0); body.lineTo(-16, 22); body.closePath();
        ctx.fillStyle = vgrad('#6b5d45', '#dccca5', 22);
        ctx.fill(body);
        ctx.save(); ctx.clip(body);
        ctx.strokeStyle = 'rgba(50,38,26,0.75)'; ctx.lineWidth = 1.4;
        for (const k of [0.35, 0.6, 0.8]) {
          ctx.beginPath(); ctx.moveTo(32 - 48 * k, -22 * k); ctx.lineTo(32 - 48 * k, 22 * k); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(60,45,30,0.8)'; ctx.lineWidth = 1; ctx.stroke(body);
        ctx.fillStyle = '#2a2219'; ctx.beginPath(); ctx.ellipse(10, 0, 5, 2.4, 0, 0, TAU); ctx.fill();
        break;
      }
      // ---------------------------------------------------------------- Drazi napsólyom
      case 'drazi': {
        // Napsólyom: szürke felső test hosszú gémekkel, alatta vörösen izzó,
        // sejtmintás „tojás”.
        ctx.strokeStyle = '#7d828a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(44, -6); ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(42, -6); ctx.lineTo(50, -10); ctx.moveTo(42, -6); ctx.lineTo(50, -2); ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(-40, -6); ctx.stroke();
        ctx.fillStyle = vgrad('#4d5259', '#a8aeb6', 10);
        path([-24, -6, -42, 8, -36, -2]); ctx.fill();
        path([-24, -7, -40, -18, -34, -8]); ctx.fill();
        ctx.fillStyle = '#b3313a'; ctx.fillRect(-44, -9, 6, 6);
        if (eng) glow(-46, -6, 9 * flick, '#ffb3a0');
        // tojás
        const egg = new Path2D();
        egg.ellipse(-2, 5, 19, 10, 0, 0, TAU);
        const eg = ctx.createRadialGradient(-6, 2, 2, -2, 5, 20);
        eg.addColorStop(0, '#ffb07a'); eg.addColorStop(0.6, '#e8452c'); eg.addColorStop(1, '#8c1a10');
        ctx.fillStyle = eg; ctx.fill(egg);
        ctx.save(); ctx.clip(egg);
        ctx.strokeStyle = 'rgba(110,20,12,0.85)'; ctx.lineWidth = 1.1;
        for (const c of pattern('drazi', 22, r => ({ x: -20 + r() * 38, y: -5 + r() * 20, r: 2 + r() * 2.5 }))) {
          ctx.beginPath();
          for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; const px = c.x + Math.cos(a) * c.r, py = c.y + Math.sin(a) * c.r * 0.8; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.closePath(); ctx.stroke();
        }
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(-2, 5, 16, '#ff6a3a', 0.25 + 0.15 * Math.sin(t * 2.5 + seed));
        ctx.restore();
        // felső test
        ctx.fillStyle = vgrad('#555a61', '#c3c8cf', 9);
        ctx.beginPath();
        ctx.moveTo(30, -6); ctx.bezierCurveTo(14, -15, -12, -15, -26, -8);
        ctx.lineTo(-24, -3); ctx.bezierCurveTo(-8, -1, 12, -1, 30, -4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c9a85a'; ctx.fillRect(-2, -12, 8, 4);
        break;
      }
      // ---------------------------------------------------------------- Árny felderítő
      case 'shadowscout': {
        // Árny felderítő felülnézetben (a kapott kép alapján): tojásdad,
        // sejtmintás test; elöl előre-kifelé legyező tüskék, hátul két kifelé
        // görbülő kampó és hosszú, vékony farok. Fekete, lilás sejthálóval.
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.9 + seed);
        glow(0, 0, 46, '#5a1a7a', 0.1 + 0.08 * pulse);
        const spike = (bx, by, tx, ty, cx, cy, w) => {
          const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy) || 1;
          w *= 1.9;
          const nx = -dy / len * w, ny = dx / len * w;
          const g = ctx.createLinearGradient(bx, by, tx, ty);
          g.addColorStop(0, '#8a6f9c'); g.addColorStop(0.6, '#5a4569'); g.addColorStop(1, '#2a1e34');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(bx + nx, by + ny);
          ctx.quadraticCurveTo(cx + nx * 0.5, cy + ny * 0.5, tx, ty);
          ctx.quadraticCurveTo(cx - nx * 0.5, cy - ny * 0.5, bx - nx, by - ny);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(12,8,16,0.8)'; ctx.lineWidth = w * 0.45;
          ctx.setLineDash([1.1, 1.3]);
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(cx, cy, tx, ty); ctx.stroke();
          ctx.setLineDash([]);
        };
        const sway = Math.sin(t * 1.2 + seed) * 0.8;
        // farok és hátsó kampók
        spike(-20, 0, -52, sway, -36, -2, 1.6);
        for (const sy of [-1, 1]) {
          spike(-14, 6 * sy, -44, (19 + sway) * sy, -34, 3 * sy, 2.2);
          spike(-8, 8 * sy, -30, (24 + sway) * sy, -22, 10 * sy, 1.6);
        }
        // elülső tüskelegyező
        for (const sy of [-1, 1]) {
          for (let i = 0; i < 5; i++) {
            const bx = -2 + i * 5, by = (8 - i * 0.8) * sy;
            const a = (0.75 - i * 0.13) * sy;
            const L = 24 + i * 3 + (i % 2) * 4;
            const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L + sway * sy * 0.5;
            spike(bx, by, tx, ty, bx + Math.cos(a * 1.25) * L * 0.5, by + Math.sin(a * 1.25) * L * 0.5, 1.8);
          }
          spike(20, 2.5 * sy, 40, 4 * sy, 30, 3.5 * sy, 1.4);
        }
        // test
        const body = new Path2D();
        body.moveTo(25, 0);
        body.bezierCurveTo(22, -9, 6, -12, -10, -10);
        body.bezierCurveTo(-20, -8, -24, -3, -24, 0);
        body.bezierCurveTo(-24, 3, -20, 8, -10, 10);
        body.bezierCurveTo(6, 12, 22, 9, 25, 0);
        const bgr = ctx.createRadialGradient(2, -3, 1, 0, 0, 24);
        bgr.addColorStop(0, '#a58bb8'); bgr.addColorStop(0.55, '#6d5480'); bgr.addColorStop(1, '#241a2e');
        ctx.fillStyle = bgr; ctx.fill(body);
        ctx.save(); ctx.clip(body);
        ctx.strokeStyle = 'rgba(10,6,14,0.9)'; ctx.lineWidth = 0.9;
        for (const c of pattern('scoutcells2', 150, r => ({ x: -24 + r() * 50, y: -12 + r() * 24, r: 1 + r() * 1.5, k: 5 + Math.floor(r() * 3) }))) {
          ctx.beginPath();
          for (let q = 0; q < c.k; q++) {
            const a = q / c.k * TAU;
            const px = c.x + Math.cos(a) * c.r, py = c.y + Math.sin(a) * c.r * 0.8;
            q ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.closePath(); ctx.stroke();
        }
        ctx.fillStyle = `rgba(170,90,220,${0.05 + 0.12 * pulse})`; ctx.fill(body);
        ctx.restore();
        glow(22, 0, 3.5 + 1.5 * pulse, '#e080ff', 0.5 + 0.4 * pulse);
        break;
      }
      // ---------------------------------------------------------------- Árny cirkáló
      case 'shadow': {
        // Árny cirkáló felülnézetben (a sorozat tervrajza alapján): kompakt,
        // denevér/szív alakú fekete test két hátsó „vállal” és elöl fejdudorral;
        // mindkét vállból egy-egy legyezőnyi hosszú, szinte egyenes tüske indul –
        // a hátsók majdnem oldalra, a belsők egyre inkább előre mutatnak.
        // Burkolat: fekete, szürkésfehér sejtes mintázattal.
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.7 + seed);
        glow(4, 0, 70, '#4a1a6a', 0.1 + 0.08 * pulse);
        const legs = [
          // [alap x, alap y, csúcs x, csúcs y, vastagság]
          [-14, 10, -17, 58, 2.6], [-12, 11, -6, 60, 2.6],
          [-9, 10, 4, 32, 2.0], [-7, 10, 8, 39, 2.0],
          [-3, 9, 30, 22, 2.2], [-1, 8, 41, 36, 2.4],
          [1, 7, 34, 15, 1.8], [3, 6, 43, 26, 2.0],
        ];
        for (const sy of [-1, 1]) {
          legs.forEach(([bx, by, tx, ty, w], i) => {
            const sway = 0.6 * Math.sin(t * 1.1 + i + (sy > 0 ? 2 : 0));
            const ex = tx + sway, ey = (ty + sway) * sy, y0 = by * sy;
            const dx = ex - bx, dy = ey - y0, len = Math.hypot(dx, dy);
            const nx = -dy / len, ny = dx / len;
            // enyhe ív kifelé
            const bow = 0.08 * len * (sy > 0 ? -1 : 1);
            const cx = (bx + ex) / 2 + nx * bow, cy = (y0 + ey) / 2 + ny * bow;
            const g = ctx.createLinearGradient(bx, y0, ex, ey);
            g.addColorStop(0, '#2a282e'); g.addColorStop(1, '#0c0b0e');
            ctx.fillStyle = g;
            ctx.beginPath();
            const W2 = w * 1.7;
            ctx.moveTo(bx + nx * W2, y0 + ny * W2);
            ctx.quadraticCurveTo(cx + nx * W2 * 0.55, cy + ny * W2 * 0.55, ex, ey);
            ctx.quadraticCurveTo(cx - nx * W2 * 0.55, cy - ny * W2 * 0.55, bx - nx * W2, y0 - ny * W2);
            ctx.closePath(); ctx.fill();
            // sejtes mintázat a tüskén
            ctx.strokeStyle = 'rgba(200,200,212,0.32)'; ctx.lineWidth = 0.6;
            ctx.setLineDash([0.8, 1.6]);
            ctx.beginPath(); ctx.moveTo(bx, y0); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
            ctx.setLineDash([]);
          });
        }
        // test
        const body = new Path2D();
        body.moveTo(-11, 0);
        body.quadraticCurveTo(-18, -3, -18, -10);
        body.quadraticCurveTo(-17, -16, -10, -14);
        body.bezierCurveTo(-4, -12, 2, -8, 7, -4);
        body.quadraticCurveTo(13, -2, 12, 0);
        body.quadraticCurveTo(13, 2, 7, 4);
        body.bezierCurveTo(2, 8, -4, 12, -10, 14);
        body.quadraticCurveTo(-17, 16, -18, 10);
        body.quadraticCurveTo(-18, 3, -11, 0);
        const bg2 = ctx.createRadialGradient(-6, -2, 1, -4, 0, 18);
        bg2.addColorStop(0, '#2c2a31'); bg2.addColorStop(1, '#060508');
        ctx.fillStyle = bg2; ctx.fill(body);
        ctx.save(); ctx.clip(body);
        ctx.strokeStyle = 'rgba(205,205,215,0.22)'; ctx.lineWidth = 0.4;
        for (const c of pattern('shadowcells3', 110, r => ({ x: -19 + r() * 32, y: -16 + r() * 32, r: 0.4 + r() * 0.9 }))) {
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.stroke();
        }
        // időnként lilán felizzó bőr
        ctx.fillStyle = `rgba(150,60,200,${0.02 + 0.08 * pulse})`;
        ctx.fill(body);
        ctx.restore();
        glow(11, 0, 4 + 2 * pulse, '#d070ff', 0.45 + 0.4 * pulse);
        break;
      }
    }
  }

  function shipScale(ship, unit) {
    const T = SHIP_TYPES[ship.type];
    return CLASSES[T.cls].size * (T.scale || 1) * unit;
  }

  function drawShip(ship, v, game) {
    const unit = layout.unit;
    const s = shipScale(ship, unit) * v.spawn;
    if (s < 0.01) return;
    const disabled = Game.isDisabled(ship);
    const bob = Math.sin(time * 0.8 + v.seed) * 4 * unit;
    ctx.save();
    ctx.translate(v.x, v.y + bob);
    ctx.globalAlpha = v.alpha * (disabled ? 0.7 : 1);

    // kijelölő gyűrűk
    const sel = game && (game.selPlayer === ship.id || game.selEnemy === ship.id);
    const hov = hoverId === ship.id;
    if (game && (sel || hov) && mode === 'battle') {
      const r = 52 * s;
      const col = ship.side === 'player' ? '90,200,255' : ship.side === 'ally' ? '110,255,160' : '255,90,90';
      ctx.strokeStyle = `rgba(${col},${sel ? 0.9 : 0.4})`;
      ctx.lineWidth = sel ? 2 : 1.2;
      ctx.setLineDash([10 * s, 6 * s]);
      ctx.lineDashOffset = -time * 30;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.72, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      if (sel) {
        ctx.fillStyle = `rgba(${col},0.07)`;
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.72, 0, 0, TAU); ctx.fill();
      }
    }

    ctx.save();
    if (disabled) ctx.rotate(Math.sin(time * 0.3 + v.seed) * 0.25);
    ctx.scale(v.face * s, s);
    drawShipShape(ship.type, time, { engines: !disabled && ship.sys.engines > 0, seed: v.seed });
    // sérülés vörös felvillanás
    if (v.hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glow(0, 0, 50, '#ff6644', v.hitFlash * 0.6);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (disabled && Math.sin(time * 6 + v.seed) > 0.3) glow(0, -6, 6, '#ff3333', 0.9);
    ctx.restore();

    // címkék a csatatéren
    if (mode === 'battle' && game) {
      const w = 54 * unit, y0 = 40 * s + 10 * unit;
      const hr = ship.hull / ship.maxHull;
      ctx.globalAlpha = v.alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-w / 2 - 1, y0 - 1, w + 2, 6);
      ctx.fillStyle = hr > 0.6 ? '#4ade80' : hr > 0.3 ? '#facc15' : '#f87171';
      ctx.fillRect(-w / 2, y0, w * clamp(hr, 0, 1), 4);
      ctx.font = `600 ${Math.round(clamp(11 * unit + 2, 10, 14))}px Rajdhani, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      let label = NM(ship.name);
      let col = ship.side === 'player' ? '#bfe6ff' : ship.side === 'ally' ? '#a7f3c0' : '#ffc2c2';
      if (ship.side === 'player') label = (Game.canTakeAction(ship) && !ship.acted ? '✓ ' : '· ') + label;
      ctx.fillStyle = col;
      ctx.fillText(label, 0, y0 + 18);
      const cap = Game.capturable(ship);
      if (ship.side !== 'player' && cap) {
        ctx.fillStyle = ship.side === 'ally' ? '#4ade80' : '#fbbf24';
        ctx.fillText(ship.side === 'ally' ? t('r.allyTake') : t('r.capt'), 0, -40 * s - 6);
      }
      if (ship.evade) {
        ctx.fillStyle = '#93c5fd'; ctx.fillText(t('r.evade'), 0, -40 * s - (cap ? 22 : 6));
      }
    }
    ctx.restore();

    // füst, szikra sérült hajóknál
    const hr = ship.hull / ship.maxHull;
    if (hr < 0.55 && Math.random() < (0.6 - hr) * 0.5) {
      particles.push({ x: v.x + rand(-20, 20) * s, y: v.y + bob + rand(-10, 10) * s, vx: rand(-10, 10), vy: rand(-25, -5), life: rand(0.8, 1.6), max: 1.6, size: rand(3, 8) * unit, color: '90,90,100', kind: 'smoke' });
    }
    if (disabled && Math.random() < 0.08) {
      particles.push({ x: v.x + rand(-15, 15) * s, y: v.y + bob + rand(-8, 8) * s, vx: rand(-60, 60), vy: rand(-60, 60), life: 0.4, max: 0.4, size: 2, color: '255,220,120', kind: 'spark' });
    }
  }

  // ---------------------------------------------------------------- station
  function drawStation(st, game) {
    if (stationGone) return;
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.rotate(st.rot);
    ctx.scale(st.s, st.s);
    drawStationBody(game, null);
    ctx.restore();
  }

  function drawStationBody(game, part) {
    // Babylon 5 oldalnézetben a kapott tervrajz alapján (orr = +x, kb. 400 egység hosszú):
    // hátul sötét bronz reaktorblokk, vékony gerinc karimával, rácsos szakasz, kúpos átmenet;
    // a fő henger hátsó részén alul-felül 3-3 keskeny kék napelem; kékes-levendula,
    // szegmentált fő henger világos középsávval és vörösesbarna konténersorral a tetején;
    // elöl nagyobb dob, parancsnoki gömb, keskeny nyak, dokkolóvilla, hegyes orr és hosszú antenna.
    // part: null = egész, 'front' / 'rear' a pusztulási jelenethez (vágás x = 20-nál)
    const t = time;
    const SPLIT = 20;
    const rear = part !== 'front', front = part !== 'rear';
    const hullG = (h, a = '#363955', b = '#8f93c4', c = '#c9ccd9') => {
      const g = ctx.createLinearGradient(0, -h, 0, h);
      g.addColorStop(0, a); g.addColorStop(0.32, b); g.addColorStop(0.5, c); g.addColorStop(0.68, b); g.addColorStop(1, a);
      return g;
    };
    if (rear) {
      // napelemek (a henger hátsó részén, alul-felül 3-3 keskeny rombusz)
      for (const px of [-42, -27, -13]) {
        for (const sy of [-1, 1]) {
          ctx.strokeStyle = '#8b8fa3'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(px, 17 * sy); ctx.lineTo(px, 21 * sy); ctx.stroke();
          const pg = ctx.createLinearGradient(px - 5, 0, px + 5, 0);
          pg.addColorStop(0, '#14295c'); pg.addColorStop(0.5, '#3b6ed6'); pg.addColorStop(1, '#14295c');
          ctx.fillStyle = pg;
          path([px - 1.6, 21 * sy, px - 4.6, 36 * sy, px - 2, 53 * sy, px + 2, 53 * sy, px + 4.6, 36 * sy, px + 1.6, 21 * sy]);
          ctx.fill();
          ctx.strokeStyle = 'rgba(15,25,60,0.8)'; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(px, 22 * sy); ctx.lineTo(px, 52 * sy); ctx.stroke();
          for (let k = 26; k < 52; k += 5) { ctx.beginPath(); ctx.moveTo(px - 4, k * sy); ctx.lineTo(px + 4, k * sy); ctx.stroke(); }
        }
      }
      // reaktorblokk (bronz) és hátsó gerinc karimával
      ctx.fillStyle = vgrad('#2a2018', '#8a6a44', 9); ctx.fillRect(-200, -9, 22, 18);
      ctx.fillStyle = '#5b4630'; for (let x = -198; x < -180; x += 4) ctx.fillRect(x, -9, 1.2, 18);
      ctx.fillStyle = vgrad('#2a2c35', '#7d8193', 4.5); ctx.fillRect(-178, -4.5, 33, 9);
      ctx.fillStyle = vgrad('#2f313c', '#9a9eb2', 11); ctx.fillRect(-147, -11, 7, 22);
      // rácsos szakasz
      ctx.fillStyle = vgrad('#1e2028', '#555a6c', 9); ctx.fillRect(-140, -9, 53, 18);
      ctx.strokeStyle = 'rgba(150,155,175,0.45)'; ctx.lineWidth = 0.6;
      for (let x = -140; x < -87; x += 7) { ctx.beginPath(); ctx.moveTo(x, -9); ctx.lineTo(x + 7, 9); ctx.moveTo(x, 9); ctx.lineTo(x + 7, -9); ctx.stroke(); }
      // kúpos átmenet a fő hengerbe
      ctx.fillStyle = vgrad('#15161c', '#4a4d5e', 20);
      path([-87, -9, -44, -20, -44, 20, -87, 9]); ctx.fill();
      ctx.strokeStyle = 'rgba(200,205,220,0.35)'; ctx.lineWidth = 0.8;
      for (const f of [0.3, 0.6]) { const x = -87 + 43 * f, h = 9 + 11 * f; ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x, h); ctx.stroke(); }
      ctx.fillStyle = '#2d5bb8'; ctx.fillRect(-45, -20, 1.5, 40);
    }
    // fő henger (szegmentált, kékes-levendula, világos középsáv), forgó panelvonalakkal
    const x0 = part === 'front' ? SPLIT : -44, x1 = part === 'rear' ? SPLIT : 87, R0 = 17.5;
    ctx.fillStyle = hullG(R0);
    ctx.fillRect(x0, -R0, x1 - x0, R0 * 2);
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, -R0, x1 - x0, R0 * 2); ctx.clip();
    for (let k = 0; k < 12; k++) {
      const ph = k / 12 * TAU + t * 0.25;
      const c = Math.cos(ph);
      if (c < 0) continue;
      const y = Math.sin(ph) * R0;
      ctx.strokeStyle = `rgba(30,32,50,${0.15 + 0.35 * c})`; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = `rgba(255,225,160,${0.45 * c})`;
      for (let x = x0 + 3; x < x1; x += 8) if (((x * 7 + k * 13) | 0) % 4 === 0) ctx.fillRect(x, y - 0.5, 2, 1);
    }
    ctx.strokeStyle = 'rgba(40,42,60,0.5)'; ctx.lineWidth = 0.6;
    for (let x = -40; x < 87; x += 6) { ctx.beginPath(); ctx.moveTo(x, -R0); ctx.lineTo(x, R0); ctx.stroke(); }
    ctx.restore();
    // szegmensgyűrűk
    for (const x of [-44, -6, 30, 62, 87]) {
      if (x < x0 - 3 || x > x1 + 3) continue;
      ctx.fillStyle = hullG(R0 + 2, '#2c2e44', '#7c80ad', '#b9bcca');
      ctx.fillRect(x - 2.5, -R0 - 2, 5, R0 * 2 + 4);
    }
    // konténersor a tetején
    for (let x = -7; x < 69; x += 12.5) {
      if (x + 8 < x0 || x > x1) continue;
      ctx.fillStyle = vgrad('#4a2219', '#9a4a36', 3); ctx.fillRect(x, -R0 - 5, 8, 5);
    }
    if (front) {
      // elülső dob (minden változatban azonos)
      ctx.fillStyle = hullG(18.5); ctx.fillRect(87, -18.5, 29, 37);
      ctx.strokeStyle = 'rgba(40,42,60,0.55)'; ctx.lineWidth = 0.6;
      for (let x = 92; x < 116; x += 6) { ctx.beginPath(); ctx.moveTo(x, -18.5); ctx.lineTo(x, 18.5); ctx.stroke(); }
      drawStationFront(t);
    }
    // pajzs: vékony réteg az állomás körvonala mentén; minél gyengébb, annál több helyen szakad meg
    if (game && !part && game.station.shield > 0) drawShieldLayer(game.station.shield / game.station.maxShield, 1, null);
  }

  // ---------------------------------------------------------------- állomás orra
  // A tervrajz szerint elöl gömb van (nem hegyes orr): parancsnoki gömb → vörös fényes nyak →
  // kis elülső gömb dokkológyűrűvel; felül hosszú villa nyúlik előre, már a dob tetejétől indulva.
  function sphere(x, y, rx, ry, light = '#eceef6') {
    const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.4, 1, x, y, Math.max(rx, ry));
    g.addColorStop(0, light); g.addColorStop(0.55, '#8f93c4'); g.addColorStop(1, '#2c2e44');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  }
  // villa: lapos gerenda, a végén két ág (oldalnézetben egymás fölött), kék jelzőfénnyel
  function fork(x0, x1, y, th = 3, tine = 14, spread = 5) {
    ctx.fillStyle = vgrad('#3a3c4a', '#b4b8c8', th);
    ctx.fillRect(x0, y - th / 2, x1 - x0, th);
    ctx.strokeStyle = '#2a2c36'; ctx.lineWidth = 0.5;
    for (let x = x0 + 6; x < x1; x += 8) { ctx.beginPath(); ctx.moveTo(x, y - th / 2); ctx.lineTo(x, y + th / 2); ctx.stroke(); }
    ctx.fillStyle = vgrad('#3a3c4a', '#c4c7d6', 2);
    path([x1, y - th / 2, x1 + tine, y - spread / 2 - 0.8, x1 + tine, y - spread / 2 + 0.6, x1 + 2, y]); ctx.fill();
    path([x1, y + th / 2, x1 + tine, y + spread / 2 + 0.8, x1 + tine, y + spread / 2 - 0.6, x1 + 2, y]); ctx.fill();
    glow(x1 + tine, y - spread / 2, 3, '#66ccff', Math.sin(time * 4) > 0.6 ? 1 : 0.15);
  }
  function drawStationFront(t) {
    const blink = Math.sin(t * 1.3) * 0.5 + 0.5;
    // villa a dob tetejétől, tartókkal
    ctx.strokeStyle = '#8c90a4'; ctx.lineWidth = 1.6;
    for (const x of [100, 118, 140]) { ctx.beginPath(); ctx.moveTo(x, x < 116 ? -18.5 : -10); ctx.lineTo(x + 2, -20.5); ctx.stroke(); }
    fork(96, 198, -21.5, 2.8, 15, 6);
    // parancsnoki gömb, nyak vörös fénypontokkal, kis elülső gömb dokkológyűrűvel
    sphere(124, 0, 12, 14);
    ctx.fillStyle = vgrad('#2a2c38', '#9a9eb2', 6); ctx.fillRect(135, -6, 18, 12);
    ctx.fillStyle = '#b8424a'; for (let x = 137; x < 152; x += 4) ctx.fillRect(x, -1.5, 2, 1.2);
    sphere(162, 0, 10, 10);
    ctx.fillStyle = vgrad('#22242e', '#9a9eb2', 11); ctx.fillRect(171, -11, 3, 22);
    ctx.fillStyle = `rgba(255,230,160,${0.4 + 0.5 * blink})`; ctx.fillRect(171.5, -3, 2, 6);
  }

  // ---------------------------------------------------------------- pajzsréteg
  // Az állomás sziluettjét követő zárt körvonal (helyi koordinátákban), lekerekítve
  // és egyenletes szakaszokra bontva. Minden szakasznak van egy „tartóssága”:
  // a pajzs arányánál gyengébb szakaszok kialszanak – így a sérülés csomós lyukakként látszik.
  let shieldSegs = null;
  function shieldOutline() {
    if (shieldSegs) return shieldSegs;
    const top = [[180, 0], [179, -14], [170, -15], [158, -12], [150, -9], [137, -16], [124, -18], [118, -22], [88, -23], [-6, -23],
      [-7, -57], [-48, -57], [-50, -24], [-88, -14], [-139, -14], [-140, -15], [-149, -15], [-151, -9], [-177, -9], [-179, -13], [-203, -13], [-209, 0]];
    let poly = [...top, ...top.slice(1, -1).reverse().map(([x, y]) => [x, -y])];
    for (let it = 0; it < 3; it++) {                       // Chaikin-lekerekítés
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
        out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
      poly = out;
    }
    // egyenletes újramintavételezés ívhossz szerint
    const N = 180, pts = [];
    let total = 0;
    const lens = poly.map((p, i) => { const q = poly[(i + 1) % poly.length]; const l = Math.hypot(q[0] - p[0], q[1] - p[1]); total += l; return l; });
    let seg = 0, acc = 0;
    for (let k = 0; k < N; k++) {
      const target = k / N * total;
      while (acc + lens[seg] < target) { acc += lens[seg]; seg++; }
      const f = (target - acc) / lens[seg], p = poly[seg], q = poly[(seg + 1) % poly.length];
      pts.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
    }
    // tartósság: lassan változó „zaj”, hogy a lyukak csoportosan nyíljanak
    const hold = pts.map((_, i) => {
      const v = 0.5 + 0.28 * Math.sin(i * 0.23 + 1.1) + 0.17 * Math.sin(i * 0.61 + 2.7) + 0.05 * Math.sin(i * 1.9);
      return Math.min(0.985, Math.max(0.02, v));
    });
    shieldSegs = { pts, hold };
    return shieldSegs;
  }

  // ratio: pajzs aránya, boost: fényerő-szorzó, impact: becsapódás helyi koordinátában (vagy null)
  function drawShieldLayer(ratio, boost, impact) {
    const { pts, hold } = shieldOutline();
    const n = pts.length, sc = Math.max(0.2, (layout && layout.station.s) || 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = (pass ? 1.1 : 3.4) / sc;
      for (let i = 0; i < n; i++) {
        if (hold[i] >= ratio) continue;
        const p = pts[i], q = pts[(i + 1) % n];
        let a = (pass ? 0.42 : 0.1) * (0.72 + 0.28 * Math.sin(i * 0.45 - time * 2.6)) * boost;
        if (impact) {
          const d = Math.hypot(p[0] - impact[0], p[1] - impact[1]);
          a = (pass ? 0.08 : 0.03) * boost + Math.max(0, 1 - d / 70) * (pass ? 1 : 0.45) * boost;
        }
        if (a < 0.01) continue;
        ctx.strokeStyle = `rgba(120,210,255,${Math.min(1, a)})`;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function stationPoint(random = true) {
    const st = layout.station;
    const lx = random ? rand(-190, 170) : 176;
    const ly = random ? rand(-14, 14) : 0;
    const c = Math.cos(st.rot), s = Math.sin(st.rot);
    return { x: st.x + (lx * c - ly * s) * st.s, y: st.y + (lx * s + ly * c) * st.s };
  }

  function shipPoint(ship, front = false) {
    const v = visuals.get(ship.id);
    if (!v) return { x: W / 2, y: H / 2 };
    const s = shipScale(ship, layout.unit);
    const bob = Math.sin(time * 0.8 + v.seed) * 4 * layout.unit;
    return { x: v.x + (front ? 34 * s * v.face : rand(-14, 14) * s), y: v.y + bob + (front ? 0 : rand(-8, 8) * s) };
  }

  // ---------------------------------------------------------------- effects
  function addEffect(e) { effects.push(e); return e; }

  // Egyetlen lövedék (impulzus, ionlövedék, plazmagömb, rakéta, vadász) – ívelt pályán is
  function projectile(from, to, o) {
    return new Promise(resolve => {
      const dist = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
      const dur = Math.max(0.1, dist / o.speed);
      const nx = -(to.y - from.y) / dist, ny = (to.x - from.x) / dist;
      const cx = (from.x + to.x) / 2 + nx * dist * (o.curve || 0), cy = (from.y + to.y) / 2 + ny * dist * (o.curve || 0);
      const pos = k => ({
        x: (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * cx + k * k * to.x,
        y: (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * cy + k * k * to.y,
      });
      addEffect({
        t: -(o.delay || 0), resolved: false,
        update(dt) {
          this.t += dt;
          if (!this.resolved && this.t >= dur) { this.resolved = true; resolve(); }
          if (o.trail && this.t > 0 && this.t < dur && Math.random() < 0.8) {
            const p = pos(this.t / dur);
            particles.push({ x: p.x, y: p.y, vx: rand(-8, 8), vy: rand(-8, 8), life: 0.6, max: 0.6, size: 2.5 * layout.unit, color: '200,200,210', kind: 'smoke' });
          }
          return this.t < dur;
        },
        draw() {
          if (this.t < 0) return;
          const k = clamp(this.t / dur, 0, 1);
          const p = pos(k), q = pos(clamp(k - o.len / dist, 0, 1));
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'round';
          ctx.strokeStyle = hexA(o.color, 0.85); ctx.lineWidth = o.width;
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = o.width * 0.4; ctx.stroke();
          glow(p.x, p.y, o.glowR, o.color, 0.9);
          ctx.globalCompositeOperation = 'source-over';
        },
      });
    });
  }

  // Fegyver tüzelése a fegyver fajtájának megfelelő látvánnyal.
  // Promise: az utolsó találat pillanatában teljesül.
  function fire(def, origins, to, hit) {
    const u = layout.unit;
    const n = def.shots || 1;
    const jit = () => ({ x: to.x + rand(-5, 5) * u, y: to.y + rand(-5, 5) * u });
    const many = (count, opt) => Promise.all(Array.from({ length: count }, (_, i) =>
      projectile(origins[i % origins.length], count > 1 ? jit() : to, { ...opt(i), delay: (opt(i).delay || 0) })));
    switch (def.kind) {
      case 'beam':
        return shot(origins[0], to, def.color, 'beam', hit, { width: def.wide ? 1.9 : def.mult ? 1.3 : 1, dur: def.wide ? 0.95 : def.mult ? 0.8 : 0.55 });
      case 'pulse':
        return many(n, i => ({ color: def.color, speed: 1800, width: 2.6 * u, len: 20 * u, glowR: 6 * u, delay: i * 0.075 }));
      case 'bolt':
        return many(n, i => ({ color: def.color, speed: def.big ? 1000 : 1400, width: (def.big ? 7 : 4) * u, len: (def.big ? 26 : 30) * u, glowR: (def.big ? 18 : 9) * u, delay: i * 0.13 }));
      case 'plasma':
        return many(n, i => ({ color: def.color, speed: 800, width: 8 * u, len: 14 * u, glowR: 20 * u, delay: i * 0.18 }));
      case 'missile':
        return many(n, i => ({ color: def.color, speed: 650, width: 2.2 * u, len: 8 * u, glowR: 5 * u, curve: i % 2 ? 0.28 : -0.28, trail: true, delay: i * 0.12 }));
      case 'swarm':
        return many(6, i => ({ color: def.color, speed: 900, width: 2.4 * u, len: 10 * u, glowR: 5 * u, curve: rand(-0.4, 0.4), delay: i * 0.07 }));
      default:
        return shot(origins[0], to, def.color, 'bolt', hit);
    }
  }

  // A fegyver kiindulópontjai világkoordinátában
  function weaponOrigins(ship, def) {
    const v = visuals.get(ship.id);
    if (!v) return [{ x: W / 2, y: H / 2 }];
    const s = shipScale(ship, layout.unit);
    const bob = Math.sin(time * 0.8 + v.seed) * 4 * layout.unit;
    return (def.origins || [[34, 0]]).map(([lx, ly]) => ({ x: v.x + lx * s * v.face, y: v.y + bob + ly * s }));
  }

  function shot(from, to, color, style, hit, bo = {}) {
    // Promise: a becsapódás pillanatában teljesül
    return new Promise(resolve => {
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      if (style === 'beam') {
        addEffect({
          t: 0, dur: bo.dur || 0.55, grow: 0.14, from, to, color, resolved: false, bw: bo.width || 1,
          update(dt) {
            this.t += dt;
            if (!this.resolved && this.t >= this.grow) { this.resolved = true; resolve(); }
            return this.t < this.dur;
          },
          draw() {
            const k = clamp(this.t / this.grow, 0, 1);
            const fade = this.t > this.grow ? 1 - (this.t - this.grow) / (this.dur - this.grow) : 1;
            const ex = lerp(this.from.x, this.to.x, k), ey = lerp(this.from.y, this.to.y, k);
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';
            ctx.strokeStyle = hexA(this.color, 0.35 * fade); ctx.lineWidth = 9 * layout.unit * this.bw;
            ctx.beginPath(); ctx.moveTo(this.from.x, this.from.y); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.strokeStyle = hexA(this.color, 0.9 * fade); ctx.lineWidth = 3.5 * layout.unit * this.bw;
            ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${0.9 * fade})`; ctx.lineWidth = 1.2 * layout.unit * this.bw;
            ctx.stroke();
            glow(this.from.x, this.from.y, 12 * layout.unit, this.color, fade);
            if (k >= 1 && hit) glow(ex, ey, (14 + 6 * Math.random()) * layout.unit, this.color, fade);
            ctx.globalCompositeOperation = 'source-over';
          },
        });
      } else {
        const sp = 1500;
        const dur = Math.max(0.12, dist / sp);
        addEffect({
          t: 0, dur, from, to, color, resolved: false,
          update(dt) {
            this.t += dt;
            if (!this.resolved && this.t >= this.dur) { this.resolved = true; resolve(); }
            return this.t < this.dur;
          },
          draw() {
            const k = clamp(this.t / this.dur, 0, 1);
            const x = lerp(this.from.x, this.to.x, k), y = lerp(this.from.y, this.to.y, k);
            const tk = clamp(k - 0.08, 0, 1);
            const tx = lerp(this.from.x, this.to.x, tk), ty = lerp(this.from.y, this.to.y, tk);
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';
            ctx.strokeStyle = hexA(this.color, 0.85); ctx.lineWidth = 4 * layout.unit;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5 * layout.unit; ctx.stroke();
            glow(x, y, 9 * layout.unit, this.color, 0.8);
            ctx.globalCompositeOperation = 'source-over';
          },
        });
      }
    });
  }

  function burst(x, y, size = 1, color = '255,170,80') {
    const u = layout ? layout.unit : 1;
    const n = Math.floor(14 * size);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(40, 220) * size;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.8), max: 0.8, size: rand(1.5, 3) * u, color, kind: 'spark' });
    }
    addEffect({
      t: 0, dur: 0.35, update(dt) { this.t += dt; return this.t < this.dur; },
      draw() { ctx.globalCompositeOperation = 'lighter'; glow(x, y, (18 + 50 * this.t) * size * u, '#ffaa55', 1 - this.t / this.dur); ctx.globalCompositeOperation = 'source-over'; },
    });
  }

  function explosion(x, y, size = 1) {
    const u = layout ? layout.unit : 1;
    shake(10 * size);
    for (let i = 0; i < 50 * size; i++) {
      const a = rand(0, TAU), sp = rand(30, 320) * size;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.5, 1.4), max: 1.4, size: rand(1.5, 4) * u, color: Math.random() < 0.5 ? '255,200,120' : '255,120,60', kind: 'spark' });
    }
    for (let i = 0; i < 18 * size; i++) {
      const a = rand(0, TAU), sp = rand(10, 90) * size;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(1, 2.4), max: 2.4, size: rand(6, 16) * u * size, color: '70,70,80', kind: 'smoke' });
    }
    for (let i = 0; i < 8 * size; i++) {
      const a = rand(0, TAU), sp = rand(30, 120) * size;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(1.5, 3), max: 3, size: rand(2, 5) * u, color: '150,150,160', kind: 'debris', rot: rand(0, TAU), vr: rand(-6, 6) });
    }
    addEffect({
      t: 0, dur: 0.9, update(dt) { this.t += dt; return this.t < this.dur; },
      draw() {
        const k = this.t / this.dur;
        ctx.globalCompositeOperation = 'lighter';
        glow(x, y, (30 + 90 * easeOut(k)) * size * u, '#ff9944', 1 - k);
        ctx.strokeStyle = `rgba(255,220,180,${0.6 * (1 - k)})`;
        ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(x, y, (20 + 140 * easeOut(k)) * size * u, 0, TAU); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      },
    });
  }

  // Pajzstalálat: a réteg a becsapódás környékén felvillan, apró fényfolttal
  function shieldFlash(p, ratio = 1) {
    const st = layout.station;
    const dx = (p.x - st.x) / st.s, dy = (p.y - st.y) / st.s, c = Math.cos(-st.rot), s = Math.sin(-st.rot);
    const local = [dx * c - dy * s, dx * s + dy * c];
    addEffect({
      t: 0, dur: 0.55, update(dt) { this.t += dt; return this.t < this.dur; },
      draw() {
        const k = this.t / this.dur;
        ctx.save();
        ctx.translate(st.x, st.y); ctx.rotate(st.rot); ctx.scale(st.s, st.s);
        drawShieldLayer(Math.max(ratio, 0.02), 1 - k, local);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        glow(p.x, p.y, 14 * layout.unit, '#8cdcff', 0.8 * (1 - k));
        ctx.globalCompositeOperation = 'source-over';
      },
    });
  }

  function floatText(x, y, text, color = '#fff', big = false) {
    addEffect({
      t: 0, dur: 1.4, update(dt) { this.t += dt; return this.t < this.dur; },
      draw() {
        const k = this.t / this.dur;
        ctx.globalAlpha = 1 - k * k;
        ctx.font = `700 ${big ? 26 : 18}px Rajdhani, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        const yy = y - 40 * easeOut(k) - 10;
        const hw = ctx.measureText(text).width / 2 + 6;
        const xx = clamp(x, hw, W - hw);
        ctx.strokeText(text, xx, yy);
        ctx.fillStyle = color; ctx.fillText(text, xx, yy);
        ctx.globalAlpha = 1;
      },
    });
  }

  function jumpPoint(x, y, holdFor = 1.6, blue = false) {
    SFX.play('jump', blue);
    return new Promise(resolve => {
      addEffect({
        t: 0, open: 0.6, hold: holdFor, close: 0.6, resolved: false,
        update(dt) {
          this.t += dt;
          if (!this.resolved && this.t >= this.open) { this.resolved = true; resolve(); }
          return this.t < this.open + this.hold + this.close;
        },
        draw() {
          const u = layout.unit;
          let k = this.t < this.open ? easeOut(this.t / this.open) : this.t < this.open + this.hold ? 1 : 1 - easeInOut((this.t - this.open - this.hold) / this.close);
          const r = 95 * u * k;
          if (r < 1) return;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(0.55, 1);
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          if (blue) {
            g.addColorStop(0, 'rgba(230,245,255,0.9)'); g.addColorStop(0.3, 'rgba(90,170,255,0.6)');
            g.addColorStop(0.7, 'rgba(30,80,230,0.35)'); g.addColorStop(1, 'rgba(10,20,120,0)');
          } else {
            g.addColorStop(0, 'rgba(255,255,220,0.9)'); g.addColorStop(0.3, 'rgba(255,170,60,0.6)');
            g.addColorStop(0.7, 'rgba(220,60,30,0.35)'); g.addColorStop(1, 'rgba(120,20,10,0)');
          }
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
          for (let arm = 0; arm < 4; arm++) {
            ctx.strokeStyle = blue ? `rgba(${90 + arm * 25},${180 + arm * 15},255,${0.55 * k})` : `rgba(255,${150 + arm * 20},80,${0.55 * k})`;
            ctx.lineWidth = 3 * u;
            ctx.beginPath();
            for (let i = 0; i <= 40; i++) {
              const p = i / 40;
              const a = arm / 4 * TAU + p * 5 + time * 3;
              const rr = r * (1 - p);
              const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
              i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.stroke();
          }
          ctx.restore();
          ctx.globalCompositeOperation = 'source-over';
        },
      });
    });
  }

  function shake(a) { if (shakeOn) shakeAmt = Math.max(shakeAmt, a); }
  function flash(a = 0.8, color = '255,255,255') { flashA = Math.max(flashA, a); flashColor = color; }

  function hitFlash(ship) { const v = visuals.get(ship.id); if (v) v.hitFlash = 1; }

  function setLeaving(ship) {
    const v = visuals.get(ship.id);
    if (!v) return Promise.resolve();
    v.leaving = true;
    return new Promise(resolve => { v.onGone = resolve; });
  }

  // ---------------------------------------------------------------- station destruction cinematic
  function playStationDestruction() {
    return new Promise(resolve => {
      cine = { t: 0, dur: 8.5, resolve, booms: 0, done: false };
      stationGone = false;
      SFX.play('alarm');
    });
  }
  function skipCinematic() { if (cine && !cine.done) { cine.done = true; const r = cine.resolve; cine = null; stationGone = true; r(); } }

  function updateCinematic(dt) {
    if (!cine) return;
    cine.t += dt;
    const st = layout.station;
    const t = cine.t;
    // kisebb robbanások a testen
    if (t < 4.2 && Math.random() < dt * (3 + t * 2.5)) {
      const p = stationPoint(true);
      explosion(p.x, p.y, rand(0.35, 0.8));
      if (Math.random() < 0.5) SFX.play('explosion');
    }
    if (t >= 4.2 && !cine.big) {
      cine.big = true;
      flash(1, '255,240,220');
      SFX.play('explosion', true);
      shake(35);
      for (let i = 0; i < 6; i++) explosion(st.x + rand(-120, 120) * st.s, st.y + rand(-30, 30) * st.s, rand(1, 1.8));
      addEffect({
        t: 0, dur: 3.5, update(dt) { this.t += dt; return this.t < this.dur; },
        draw() {
          const k = this.t / this.dur;
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(180,220,255,${0.8 * (1 - k)})`;
          ctx.lineWidth = 6 * (1 - k) + 1;
          ctx.beginPath(); ctx.ellipse(st.x, st.y, 900 * easeOut(k) * st.s, 260 * easeOut(k) * st.s, st.rot, 0, TAU); ctx.stroke();
          glow(st.x, st.y, 260 * st.s * (1 - k * 0.5), '#ffcc88', 1 - k);
          ctx.globalCompositeOperation = 'source-over';
        },
      });
    }
    if (t >= 4.3) stationGone = true;
    if (t >= cine.dur && !cine.done) { cine.done = true; const r = cine.resolve; cine = null; r(); }
  }

  function drawStationBreaking() {
    const st = layout.station;
    const t = cine.t;
    const k = clamp((t - 2.8) / 1.4, 0, 1);
    if (k <= 0) { drawStation(st, null); return; }
    for (const part of ['rear', 'front']) {
      const dir = part === 'front' ? 1 : -1;
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.rot);
      ctx.scale(st.s, st.s);
      ctx.translate(dir * 30 * easeOut(k), dir * -8 * k);
      ctx.rotate(dir * 0.25 * k);
      drawStationBody(null, part);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    glow(st.x - 20 * st.s, st.y, (60 + 80 * k) * st.s, '#ff8844', 0.8);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- main frame
  function frame(dtRaw, game) {
    const dt = Math.min(dtRaw, 0.05) * speed;
    time += dt;
    layout = computeLayout(game);

    // effektek és részecskék frissítése
    for (let i = effects.length - 1; i >= 0; i--) if (!effects[i].update(dt)) effects.splice(i, 1);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const drag = p.kind === 'smoke' ? 0.97 : 0.985;
      p.vx *= drag; p.vy *= drag;
      if (p.rot !== undefined) p.rot += p.vr * dt;
    }
    if (particles.length > 1400) particles.splice(0, particles.length - 1400);
    updateCinematic(dt);

    // vizuális pozíciók
    if (game && mode === 'battle') {
      for (const s of [...game.player, ...game.enemies, ...(game.visitors || [])]) {
        const v = visualFor(s);
        const slot = layout.slots.get(s.id);
        if (!slot) continue;
        const k = 1 - Math.pow(0.04, dt);
        v.x = lerp(v.x, slot.x, k * 0.9);
        v.y = lerp(v.y, slot.y, k * 0.9);
        v.face = lerp(v.face, slot.face, 1 - Math.pow(0.02, dt));
        v.spawn = lerp(v.spawn, 1, 1 - Math.pow(0.05, dt));
        if (v.hitFlash) v.hitFlash = Math.max(0, v.hitFlash - dt * 3);
      }
      for (const [id, v] of visuals) {
        if (!v.leaving) continue;
        v.x += 700 * dt; v.alpha -= dt * 0.8;
        if (v.alpha <= 0 || v.x > W + 200) { visuals.delete(id); if (v.onGone) v.onGone(); }
      }
    }

    // --- rajzolás
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (bg && bg.width > 0 && bg.height > 0) ctx.drawImage(bg, 0, 0, W, H);
    else { ctx.fillStyle = '#04050d'; ctx.fillRect(0, 0, W, H); }
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(time * 2 + s.tw);
      s.x -= s.z * 3 * dt;
      if (s.x < 0) s.x += W;
      if (planet && (s.x - planet.x) ** 2 + (s.y - planet.y) ** 2 < planet.r * planet.r) continue;   // a bolygó takarja
      ctx.fillStyle = `rgba(220,230,255,${0.25 + 0.6 * s.z * tw})`;
      const sz = s.z > 0.85 ? 2 : 1;
      ctx.fillRect(s.x, s.y, sz, sz);
    }

    ctx.save();
    if (shakeAmt > 0.3) {
      ctx.translate(rand(-shakeAmt, shakeAmt), rand(-shakeAmt, shakeAmt));
      shakeAmt *= Math.pow(0.02, dt);
    } else shakeAmt = 0;

    // kamera a pusztulási jelenethez
    if (cine) {
      const st = layout.station;
      const z = 1 + 0.6 * easeInOut(clamp(cine.t / 3, 0, 1));
      ctx.translate(st.x, st.y); ctx.scale(z, z); ctx.translate(-st.x, -st.y);
      ctx.translate((W * 0.5 - st.x) * 0.5 * easeInOut(clamp(cine.t / 3, 0, 1)) / z, 0);
    }

    if (mode === 'menu') {
      drawStation(layout.station, null);
      const st = layout.station;
      for (const m of menuShips) {
        m.a += m.sp * dt;
        const x = st.x + Math.cos(m.a) * 260 * m.r * st.s;
        const y = st.y + Math.sin(m.a) * 70 * m.r * st.s - 10 * st.s;
        const behind = Math.sin(m.a) < 0;
        m._p = { x, y, behind, face: -Math.sin(m.a) > 0 ? 1 : -1 };
      }
      // a távoli hajókat az állomás mögé rajzoljuk – egyszerűsítve: kisebb méret
      for (const m of menuShips) {
        const p = m._p;
        ctx.save(); ctx.translate(p.x, p.y);
        const sc = st.s * 0.5 * (p.behind ? 0.75 : 1.05);
        ctx.globalAlpha = p.behind ? 0.6 : 1;
        ctx.scale(p.face * sc, sc);
        drawShipShape(m.type, time, { seed: m.r * 10 });
        ctx.restore();
      }
    } else {
      if (cine) drawStationBreaking(); else drawStation(layout.station, game);
      if (game) {
        const all = [...game.player, ...game.enemies, ...(game.visitors || [])];
        for (const s of all) { const v = visuals.get(s.id); if (v) drawShip(s, v, game); }
        // távozó (nem a játékban lévő) hajók
        for (const v of visuals.values()) {
          if (!v.leaving || !v.ghost) continue;
          drawShip(v.ghost, v, null);
        }
      }
    }

    // részecskék
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(${p.color},${0.35 * a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2 - a), 0, TAU); ctx.fill();
      } else if (p.kind === 'debris') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = `rgba(${p.color},${a})`; ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${p.color},${a})`;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    for (const e of effects) e.draw();
    ctx.restore();

    if (flashA > 0.01) {
      ctx.fillStyle = `rgba(${flashColor},${flashA})`;
      ctx.fillRect(0, 0, W, H);
      flashA *= Math.pow(0.15, dt);
    }
    // vignetta
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------- picking
  function pick(x, y, game) {
    if (!game || !layout || mode !== 'battle') return null;
    let best = null, bd = Infinity;
    for (const s of [...game.player, ...game.enemies]) {
      const v = visuals.get(s.id);
      if (!v) continue;
      const r = 50 * shipScale(s, layout.unit);
      const d = Math.hypot(x - v.x, (y - v.y) * 1.3);
      if (d < r && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // Bolt előnézet: egy hajó kirajzolása egy kis vászonra
  function renderPreview(cv, type, face = 1) {
    const c = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
    cv.width = w * dpr; cv.height = h * dpr;
    const old = ctx; ctx = c;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    const s = Math.min(w / 140, h / 100) * (type === 'shadow' ? 0.8 : type === 'centcarrier' ? 0.85 : 1);
    ctx.scale(face * s, s);
    drawShipShape(type, time, { seed: 1 });
    ctx = old;
  }

  return {
    init, resize, setInsets, frame, pick, sync,
    get mode() { return mode; }, set mode(m) { mode = m; stationGone = false; },
    setSpeed(s) { speed = s; }, get speed() { return speed; },
    setShake(on) { shakeOn = on; },
    setHover(id) { hoverId = id; },
    visualFor, spawnFrom, allyPoint, shot, fire, weaponOrigins, burst, explosion, shieldFlash, floatText, jumpPoint,
    shake, flash, hitFlash, setLeaving, stationPoint, shipPoint,
    playStationDestruction, skipCinematic, renderPreview,
    get layout() { return layout; },
    get W() { return W; }, get H() { return H; },
    get inCinematic() { return !!cine; },
    clearFx() { effects.length = 0; particles.length = 0; },
    ghostLeave(ship) {
      // a játékból már eltávolított hajó elrepül a képernyőről
      const v = visuals.get(ship.id);
      if (!v) return Promise.resolve();
      v.ghost = ship; v.leaving = true;
      return new Promise(resolve => { v.onGone = resolve; });
    },
  };
})();
