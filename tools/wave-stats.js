// Fejlesztői segéd: hullámerő-statisztika (node serve.js után, a játék oldalán, a böngésző konzoljában):
//   (0, eval)(await (await fetch("tools/wave-stats.js")).text())  → eredmény: window.__waveStats
// Mintavételezi a buildWave-et, és hullámonként, témánként kiírja az átlagos hajószámot, össz-életerőt,
// össz-tűzerőt és az ellenség átlagos találati esélyét egy alap Fehércsillag ellen.
(async () => {
  const src = await (await fetch('js/game.js?x=' + Date.now())).text();
  const mod = src.replace(/const Game = \(/, 'window.__G = (').replace('return {\n    hooks,', 'return { buildWave, get S() { return S; }, set S(v) { S = v; },\n    hooks,');
  (0, eval)(mod);
  const G = window.__G;
  const base = {
    version: 2, name: 'T', diff: 'normal', wave: 0, round: 0, score: 0, credits: 0, waveCredits: 0, phase: 'battle', nextId: 1, nameCount: {},
    station: { hull: 1200, maxHull: 1200, shield: 160, maxShield: 160, grid: 14, armorLvl: 0, shieldLvl: 0, gridLvl: 0 },
    player: [], enemies: [], stats: {}, shadowSeen: true, minbariDone: true,
  };
  G.S = JSON.parse(JSON.stringify(base));
  const ws = { type: 'whitestar', side: 'player', hull: 120, maxHull: 120, sys: { weapons: 45, sensors: 45, engines: 45, reactor: 45 }, maxSys: { weapons: 45, sensors: 45, engines: 45, reactor: 45 }, firepower: 25, level: 1 };
  const out = {};
  for (const n of [1, 4, 9, 12, 14, 17, 19, 22, 26]) {
    const acc = {};
    for (let i = 0; i < 600; i++) {
      G.S = JSON.parse(JSON.stringify(base)); G.S.player = [ws]; G.S.lastShadowWave = n - 1;
      const list = G.buildWave(n).filter(s => s.side === 'enemy');
      const th = G.S.waveTheme || '?';
      const a = acc[th] || (acc[th] = { k: 0, cnt: 0, hull: 0, fp: 0, hit: 0 });
      a.k++; a.cnt += list.length;
      for (const s of list) { a.hull += s.maxHull; a.fp += s.firepower; a.hit += Game.hitChance(s, ws); }
    }
    out[n] = Object.fromEntries(Object.entries(acc).map(([th, a]) => [th, `${Math.round(a.k / 6)}% · ${(a.cnt / a.k).toFixed(1)} hajó, HP ${Math.round(a.hull / a.k)}, tűzerő ${Math.round(a.fp / a.k)}, találat ${Math.round(a.hit / a.cnt * 100)}%`]));
  }
  window.__waveStats = out;
  console.table(out);
})();
