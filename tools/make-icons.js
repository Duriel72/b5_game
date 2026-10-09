// Alkalmazásikonok (PNG) előállítása függőség nélkül: `node tools/make-icons.js`
// Az ikon: sötét űr, Epsilon III bolygó, előtte a Babylon 5 állomás sziluettje.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 1) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = px[i] * (1 - a) + r * a; px[i + 1] = px[i + 1] * (1 - a) + g * a; px[i + 2] = px[i + 2] * (1 - a) + b * a; px[i + 3] = 255;
  };
  const S = size / 64;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const t = (x + y) / (2 * size);
    set(x, y, 6 + 14 * t, 8 + 6 * t, 24 + 20 * t);
    // köd
    const dn = Math.hypot(x / size - 0.8, y / size - 0.25);
    if (dn < 0.45) set(x, y, 90, 60, 200, 0.25 * (1 - dn / 0.45));
  }
  // csillagok
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) set(Math.floor(rnd() * size), Math.floor(rnd() * size), 230, 235, 255, 0.4 + 0.6 * rnd());
  // bolygó
  const pcx = size * 0.3, pcy = size * 0.62, pr = size * 0.42;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - pcx) / pr, dy = (y - pcy) / pr, d2 = dx * dx + dy * dy;
    if (d2 > 1) continue;
    const z = Math.sqrt(1 - d2);
    const light = Math.max(0.08, -0.6 * dx - 0.4 * dy + 0.7 * z);
    const n = 0.85 + 0.15 * Math.sin(x * 0.35 / S + Math.sin(y * 0.2 / S) * 2);
    set(x, y, 190 * light * n, 120 * light * n, 72 * light * n);
  }
  // állomás (enyhén döntve)
  const ang = -0.12, ca = Math.cos(ang), sa = Math.sin(ang), cx = size * 0.52, cy = size * 0.5;
  const fill = (x0, y0, x1, y1, col, ell) => {
    for (let y = -size; y < size; y++) for (let x = -size; x < size; x++) {
      const lx = x / S, ly = y / S;
      if (ell ? ((lx - (x0 + x1) / 2) ** 2) / (((x1 - x0) / 2) ** 2) + ((ly - (y0 + y1) / 2) ** 2) / (((y1 - y0) / 2) ** 2) > 1 : (lx < x0 || lx > x1 || ly < y0 || ly > y1)) continue;
      const shade = ell ? 1 : 0.75 + 0.35 * (1 - Math.abs(ly - (y0 + y1) / 2) / ((y1 - y0) / 2 + 0.01));
      set(Math.round(cx + x * ca - y * sa), Math.round(cy + x * sa + y * ca), col[0] * shade, col[1] * shade, col[2] * shade);
    }
  };
  for (const k of [-17, -14.5, -12]) { fill(k - 0.8, -12, k + 0.8, -2.5, [80, 140, 230]); fill(k - 0.8, 2.5, k + 0.8, 12, [80, 140, 230]); }
  fill(-22, -0.9, 0, 0.9, [150, 156, 165]);
  fill(-24, -2.2, -20, 2.2, [200, 205, 212], true);
  fill(-6, -4.2, 13, 4.2, [222, 214, 192]);
  for (const k of [-5.5, -1, 3.5, 8, 12.5]) fill(k - 0.5, -4.8, k + 0.5, 4.8, [170, 162, 140]);
  fill(13, -2.3, 16, 2.3, [180, 186, 194]);
  fill(15, -3.4, 21.5, 3.4, [205, 200, 188], true);
  fill(21, -1.6, 25, 1.6, [160, 166, 174]);
  fill(25, -0.35, 29, 0.35, [180, 186, 194]);
  fill(28.3, -0.9, 29.9, 0.9, [120, 200, 255], true);
  return png(size, size, px);
}

const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const s of [180, 192, 512]) fs.writeFileSync(path.join(out, `icon-${s}.png`), draw(s));
console.log('Ikonok elkészültek:', out);
