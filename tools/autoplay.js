// Fejlesztői segéd: automata játékos – a valódi játékot játssza végig gyorsítva, és közben ellenőrzi az
// állapotot (NaN, határokon kívüli értékek, JS-hibák). Futtatás (node serve.js után, a játék oldalán, a konzolban):
//   window.__autoCfg = { diffs: ['easy', 'normal', 'hard', 'nightmare'], games: 2, maxWave: 30, speed: 25 };
//   (0, eval)(await (await fetch("tools/autoplay.js")).text())
// Állapot: window.__auto (futás közben is frissül), eredmény: window.__auto.done === true után window.__auto.results.
(async () => {
  const cfg = Object.assign({ diffs: ['easy', 'normal', 'hard', 'nightmare'], games: 2, maxWave: 30, speed: 25 }, window.__autoCfg || {});
  const A = window.__auto = { done: false, results: [], errors: [], issues: [], current: '' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const onErr = e => A.errors.push(String((e.error && e.error.stack) || e.message || e.reason || e).slice(0, 300));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', e => onErr({ message: 'unhandled: ' + ((e.reason && e.reason.stack) || e.reason) }));
  R.setSpeed(cfg.speed);
  try { SFX.setVolume(0); SFX.setMusic(false); } catch (e) { /* nincs hang */ }

  // ---------------------------------------------------------------- állapot-ellenőrzés
  function check(S, where) {
    const bad = (m) => { if (A.issues.length < 60) A.issues.push(`${A.current} h${S.wave}: ${where}: ${m}`); };
    const walk = (o, path) => {
      if (typeof o === 'number' && !Number.isFinite(o)) bad(`nem véges szám: ${path}`);
      else if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], path + '.' + k);
    };
    walk({ player: S.player, enemies: S.enemies, station: S.station, credits: S.credits, score: S.score }, 'S');
    if (S.credits < 0) bad('negatív kredit ' + S.credits);
    const st = S.station;
    if (st.hull > st.maxHull + 0.5 || st.shield > st.maxShield + 0.5 || st.shield < -0.5) bad(`állomás határon kívül ${st.hull}/${st.maxHull} ${st.shield}/${st.maxShield}`);
    for (const s of [...S.player, ...S.enemies]) {
      if (s.hull > s.maxHull + 0.5 || s.hull < 0) bad(`${s.type} test ${s.hull}/${s.maxHull}`);
      for (const k of SYS_KEYS) if (s.sys[k] > s.maxSys[k] + 0.5 || s.sys[k] < 0) bad(`${s.type} ${k} ${s.sys[k]}/${s.maxSys[k]}`);
      if (!(s.firepower > 0) && !SHIP_TYPES[s.type].civilian) bad(`${s.type} tűzerő ${s.firepower}`);
      if (!SHIP_TYPES[s.type]) bad('ismeretlen típus ' + s.type);
    }
    if (S.enemies.some(s => s.side === 'ally' && s.hull < s.maxHull && S.round <= 1)) { /* érkezéskor teljes */ }
    const ids = [...S.player, ...S.enemies].map(s => s.id);
    if (new Set(ids).size !== ids.length) bad('ismétlődő hajóazonosító');
  }

  // ---------------------------------------------------------------- bolt (ésszerű, egyszerű stratégia)
  function shopPolicy(S, log) {
    const st = S.station, sh = Game.shop;
    const buyStation = key => { const before = S.credits; sh.station(key); if (S.credits < before) log[key] = (log[key] || 0) + 1; return S.credits < before; };
    const afford = c => S.credits - c >= 0;
    if (st.hull < st.maxHull * 0.6) buyStation('repair');
    for (const s of S.player) { const c = Game.repairCost(s, true); if (c > 0 && afford(c)) sh.repair(s.id, true); }
    if (st.hull < st.maxHull * 0.8) buyStation('repair');
    // flotta bővítés
    if (S.player.length < Math.min(4, Game.fleetCap())) {
      const want = ['centauri', 'narn', 'hyperion', 'earth'].find(k => afford(SHIP_TYPES[k].price + 100));
      if (want) { sh.buy(want); log.ships = (log.ships || 0) + 1; }
    }
    // aknák: a 4. hullámtól, ha telik
    if (S.wave >= 4 && (st.mineLvl || 0) < 2 && afford(500)) buyStation('minelayer');
    if ((st.mineLvl || 0) > 0 && (st.minePow || 0) < (st.mineLvl || 0) && afford(400)) buyStation('minepower');
    if ((st.mineLvl || 0) > 0 && MINES.deployCost(st) > 0 && afford(MINES.deployCost(st) + 100)) buyStation('mines');
    // állomásfejlesztések körbe, amíg van pénz (tartalék: 150)
    let guard = 0;
    while (guard++ < 12) {
      const opts = ['shield', 'armor', 'grid'].map(k => STATION_UPGRADES.find(u => u.key === k))
        .filter(u => !(u.max && u.lvl(st) >= u.max)).sort((a, b) => a.cost(st) - b.cost(st));
      const ship = S.player.filter(s => s.level < MAX_SHIP_LEVEL).sort((a, b) => Game.upgradeCost(a) - Game.upgradeCost(b))[0];
      const uc = ship ? Game.upgradeCost(ship) : Infinity;
      const u = opts[0];
      if (u && u.cost(st) <= uc && afford(u.cost(st) + 150)) { buyStation(u.key); continue; }
      if (ship && afford(uc + 150)) { sh.upgrade(ship.id); log.levels = (log.levels || 0) + 1; continue; }
      break;
    }
  }

  // ---------------------------------------------------------------- csata: egy döntés
  async function act(S) {
    // szövetséges átvétele (nem használ akciót)
    const ally = S.enemies.find(s => s.side === 'ally' && Game.capturable(s));
    if (ally && S.player.length < Game.fleetCap()) { Game.select(ally); await Game.capture(); return true; }
    const ready = S.player.filter(s => !s.acted && Game.canTakeAction(s));
    if (!ready.length) { await Game.passRound(); return true; }
    const a = ready.find(s => Game.canAct(s)) || ready[0];
    Game.select(a);
    const hostiles = S.enemies.filter(s => s.side === 'enemy' && s.hull > 0);
    // elfoglalás, ha van béna ellenség és hely a flottában
    const cap = hostiles.find(s => Game.capturable(s) && !Game.captureBlocked(s));
    if (cap && Game.canAct(a) && S.player.length < Game.fleetCap()) { Game.select(cap); await Game.capture(); return true; }
    if (!Game.canAct(a)) {
      const k = ['weapons', 'reactor', 'engines', 'sensors', 'hull'].find(k => Game.damaged(a, k));
      if (Game.canManualRepair(a) && k) { await Game.playerRepair(k); return true; }
      a.acted = true; return true;   // nem tud mit tenni
    }
    // célpont: a legsérültebb, fegyveres ellenség; Fehércsillag a reaktort, más a testet lövi
    const tgt = hostiles.filter(s => !Game.isDisabled(s)).sort((x, y) => x.hull / x.maxHull - y.hull / y.maxHull)[0] || hostiles[0];
    if (!tgt) { await Game.passRound(); return true; }
    Game.select(tgt);
    const sub = a.type === 'whitestar' && tgt.sys.reactor > 0 ? 'reactor' : 'hull';
    const useSpecial = Game.specialReady(a);
    const useAbility = !useSpecial && a.cd <= 0 && Math.random() < 0.5;
    await Game.playerAttack(sub, useAbility, useSpecial);
    return true;
  }

  // ---------------------------------------------------------------- egy játék
  async function playGame(diff, gi) {
    A.current = `${diff}#${gi + 1}`;
    const log = { diff, game: gi + 1 };
    const t0 = performance.now();
    R.mode = 'battle';
    await Game.newGame('Robot', diff);
    let lastWave = 0, stall = 0, lastSig = '';
    const credits = [];
    while (true) {
      const S = Game.state;
      if (!S) break;
      if (S.phase === 'over') break;
      if (S.wave > cfg.maxWave) { log.stoppedAt = S.wave; break; }
      if (Game.busy) { await sleep(20); continue; }
      check(S, S.phase);
      if (S.phase === 'shop' || S.phase === 'event') {
        // bolt (hullám végén vagy konvoj után)
        if (S.phase === 'event') { await sleep(30); continue; }
        if (S.wave !== lastWave) { credits.push(Math.round(S.credits)); lastWave = S.wave; }
        shopPolicy(S, log);
        check(S, 'bolt után');
        try { UI.close('scr-shop'); } catch (e) { /* nincs nyitva */ }
        await Game.startWave();
        continue;
      }
      if (S.phase === 'battle') {
        const sig = `${S.wave}:${S.round}:${S.player.map(s => s.acted ? 1 : 0).join('')}:${S.enemies.length}`;
        if (sig === lastSig) { if (++stall > 60) { A.issues.push(`${A.current} h${S.wave}: elakadt (${sig})`); await Game.passRound(); stall = 0; } }
        else { stall = 0; lastSig = sig; }
        await act(S);
        continue;
      }
      await sleep(20);
    }
    const S = Game.state;
    Object.assign(log, {
      wave: S.wave, over: S.phase === 'over', score: S.score, fleet: S.player.map(s => s.type + '★' + s.level).join(' '),
      station: `${Math.round(S.station.hull)}/${S.station.maxHull}`, upgrades: `p${S.station.armorLvl} s${S.station.shieldLvl} r${S.station.gridLvl} a${S.station.mineLvl || 0}/${S.station.minePow || 0}`,
      creditsAtShops: credits.join(','), destroyed: S.stats.destroyed, captured: S.stats.captured, lost: S.stats.lost,
      secs: Math.round((performance.now() - t0) / 1000),
    });
    A.results.push(log);
    try { UI.back(); UI.back(); } catch (e) { /* */ }
  }

  for (const d of cfg.diffs) for (let g = 0; g < cfg.games; g++) {
    try { await playGame(d, g); } catch (e) { A.errors.push(`${d}#${g + 1}: ${e && e.stack ? e.stack.slice(0, 300) : e}`); }
  }
  R.setSpeed(1);
  A.done = true;
})();
