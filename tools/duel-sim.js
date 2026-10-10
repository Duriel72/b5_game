// Fejlesztői segéd: párbaj-szimuláció a célzási stratégiák összevetésére (node serve.js után, a játék oldalán,
// a böngésző konzoljában):  (0, eval)(await (await fetch("tools/duel-sim.js")).text())  → window.__duel
// Egy saját hajó mindig ugyanazt a részt lövi (test / egy alrendszer; ha az 0, a testet), az ellenfél visszalő,
// és ha a fegyverzete 0, javít (ha teheti). A párbaj addig tart, amíg az ellenfél megsemmisül vagy elfoglalhatóvá
// válik. Mérjük: hány kör kellett, és mennyi sebzést kapott közben a saját hajó.
// A reaktor találati nehézségét (SUBSYSTEMS reaktor mod) a REACTOR_MODS értékeivel végigpróbálja.
(() => {
  const REACTOR_MODS = window.__reactorMods || [0.08, 0.1, 0.12, 0.14, 0.16];
  const N = window.__duelN || 3000;
  const MATCHES = [['whitestar', 'narn'], ['whitestar', 'earth'], ['narn', 'centauri'], ['centauri', 'raidergunship']];
  const STRATS = ['hull', 'weapons', 'sensors', 'engines', 'reactor'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mk = (type, side) => {
    const T = SHIP_TYPES[type], m = Math.round(T.sys * SYS_HP_MUL);
    return { type, side, hull: T.hull, maxHull: T.hull, firepower: T.firepower, rcd: 0, evade: false,
      maxSys: { weapons: m, sensors: m, engines: m, reactor: m }, sys: { weapons: m, sensors: m, engines: m, reactor: m } };
  };
  const shoot = (a, t, sub) => {
    if (Math.random() >= Game.hitChance(a, t, sub)) return 0;
    const crit = Math.random() < Game.critChance(a);
    const dmg = Math.max(1, Math.round(Game.expectedDamage(a, 'hull') * rnd(0.85, 1.15) * (crit ? 1.5 : 1)));
    let hull, s = null, sd = 0;
    if (sub === 'hull') { hull = dmg; if (Math.random() < 0.3) { s = SYS_KEYS[Math.floor(Math.random() * 4)]; sd = Math.round(dmg * 0.25); } }
    else { s = sub; sd = Math.round(dmg * SUB_DMG); hull = Math.round(dmg * 0.3); }
    t.hull = Math.max(0, t.hull - hull);
    if (s) t.sys[s] = Math.max(0, t.sys[s] - sd);
    return hull;
  };
  const duel = (pType, eType, strat) => {
    const p = mk(pType, 'player'), e = mk(eType, 'enemy');
    let rounds = 0, taken = 0;
    while (rounds < 40) {
      rounds++;
      const sub = strat !== 'hull' && e.sys[strat] > 0 ? strat : 'hull';
      shoot(p, e, sub);
      if (e.hull <= 0 || Game.isDisabled(e)) break;
      if (e.rcd > 0) e.rcd--;
      if (e.sys.weapons <= 0 && Game.canManualRepair(e)) {
        e.sys.weapons = Math.min(e.maxSys.weapons, e.sys.weapons + Game.repairAmount(e, 'weapons'));
        e.rcd = Game.repairStats(e).cd;
      } else if (Game.canAct(e)) taken += shoot(e, p, 'hull');
    }
    return { rounds, taken };
  };
  const orig = SUB_BY_KEY.reactor.mod;
  const out = {};
  for (const mod of REACTOR_MODS) {
    SUB_BY_KEY.reactor.mod = mod;
    const res = {};
    for (const [pt, et] of MATCHES) {
      const row = {};
      for (const st of STRATS) {
        let r = 0, tk = 0;
        for (let i = 0; i < N; i++) { const d = duel(pt, et, st); r += d.rounds; tk += d.taken; }
        row[st] = `${(r / N).toFixed(1)} kör / ${Math.round(tk / N)} seb.`;
      }
      res[`${pt}→${et}`] = row;
    }
    out[`reaktor mod ${mod} (találat −${Math.round(mod * 300)}%)`] = res;
  }
  SUB_BY_KEY.reactor.mod = orig;
  window.__duel = out;
  console.log(out);
})();
