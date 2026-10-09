'use strict';
// ---------------------------------------------------------------------------
// Játéklogika: állapot, harc, MI, hullámok, bolt, mentés.
// ---------------------------------------------------------------------------

const wait = ms => new Promise(r => setTimeout(r, ms / R.speed));
const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];
const STATION = 'station';

const Game = (() => {
  let S = null;
  let busy = false;
  const hooks = { update() {}, log() {}, toast() {}, waveStart() {}, shop() {}, gameOver() {}, hint() {} };

  // ------------------------------------------------------------ segédek
  const DF = () => DIFFICULTIES[S.diff];
  const ratio = (s, k) => (s.maxSys[k] ? s.sys[k] / s.maxSys[k] : 0);
  const isDisabled = s => s.sys.reactor <= 0 || (s.sys.weapons <= 0 && s.sys.engines <= 0);
  const alive = s => s && s.hull > 0;
  const canAct = s => alive(s) && !isDisabled(s) && s.sys.weapons > 0;
  // javítás: önjavító (passzív) típusok, illetve kézi javítás – ehhez a reaktor kell
  const hasRegen = s => !!REGEN[s.type];
  const damaged = (s, k) => (k === 'hull' ? s.hull < s.maxHull : s.sys[k] < s.maxSys[k]);
  // kézi javítás: kell működő reaktor, és a javítás töltési ideje (rcd) le kell teljen
  const repairStats = s => REPAIR_BY_FACTION[SHIP_TYPES[s.type].faction] || REPAIR_DEFAULT;
  const canManualRepair = s => alive(s) && !hasRegen(s) && s.sys.reactor > 0 && !(s.rcd > 0) && (damaged(s, 'hull') || SYS_KEYS.some(k => damaged(s, k)));
  // a hajó összállapota (0..1): test és a négy alrendszer átlaga
  const condition = s => (s.hull / s.maxHull + SYS_KEYS.reduce((a, k) => a + s.sys[k] / s.maxSys[k], 0)) / 5;
  const repairEff = s => REPAIR_MIN_EFF + (1 - REPAIR_MIN_EFF) * condition(s);
  // a hajó tud-e valamit kezdeni ebben a körben (lőni vagy javítani)
  const canTakeAction = s => canAct(s) || canManualRepair(s);
  const capturable = s => {
    if (!alive(s)) return false;
    // az Árny hajókat soha nem lehet elfoglalni, a civil kereskedőket sem
    if (SHIP_TYPES[s.type].noCapture || SHIP_TYPES[s.type].civilian) return false;
    if (s.side === 'ally') return true;
    if (s.side !== 'enemy') return false;
    return isDisabled(s);
  };
  const captureChance = s => (s.side === 'ally' ? 1 : clamp(0.45 + 0.55 * (1 - s.hull / s.maxHull), 0.45, 0.95));
  // Sikertelen elfoglalás után ugyanaz a hajó abban a körben már nem próbálható újra
  const captureBlocked = s => s && s.side === 'enemy' && s.capFailWave === S.wave && s.capFailRound === S.round;
  const fleetCap = () => MAX_FLEET + ((S && S.station.cmdLvl) || 0);
  const scrapValue = s => Math.round((SHIP_TYPES[s.type].price || 400) * 0.35 * (s.hull / s.maxHull + 0.3) * (1 + (s.level - 1) * 0.25));
  const byId = id => S && ([...S.player, ...S.enemies].find(s => s.id === id) || null);
  const hostiles = () => S.enemies.filter(s => s.side === 'enemy');

  function uniqueName(type) {
    const T = SHIP_TYPES[type];
    S.nameCount[type] = (S.nameCount[type] || 0) + 1;
    const n = S.nameCount[type];
    const base = T.names[(n - 1) % T.names.length];
    return n > T.names.length ? `${base} ${Math.ceil(n / T.names.length)}.` : base;
  }

  function makeShip(type, side, opts = {}) {
    const T = SHIP_TYPES[type];
    const hpMul = opts.hpMul || 1, dmgMul = opts.dmgMul || 1;
    const maxSys = {};
    for (const k of SYS_KEYS) maxSys[k] = Math.round(T.sys * SYS_HP_MUL * hpMul);
    const ship = {
      id: S.nextId++, type, side, name: opts.name || uniqueName(type), level: 1,
      maxHull: Math.round(T.hull * hpMul), hull: 0,
      maxSys, sys: { ...maxSys },
      firepower: +(T.firepower * dmgMul).toFixed(1),
      acted: false, cd: 0, wcd: 0, evade: false,
    };
    ship.hull = ship.maxHull;
    return ship;
  }

  function levelUp(s) {
    s.level++;
    s.firepower = +(s.firepower * 1.12).toFixed(1);
    const nh = Math.round(s.maxHull * 1.1); s.hull += nh - s.maxHull; s.maxHull = nh;
    for (const k of SYS_KEYS) { const nm = Math.round(s.maxSys[k] * 1.1); s.sys[k] += nm - s.maxSys[k]; s.maxSys[k] = nm; }
  }

  // ------------------------------------------------------------ harci számítások
  function attStats(att) {
    if (att === STATION) return { sens: 1, fp: S.station.grid };
    return { sens: ratio(att, 'sensors'), fp: att.firepower * (0.4 + 0.6 * ratio(att, 'weapons')) };
  }

  function evasion(t) {
    return CLASSES[SHIP_TYPES[t.type].cls].evasion * (0.3 + 0.7 * ratio(t, 'engines')) + (t.evade ? 0.3 : 0);
  }

  function hitChance(att, tgt, subKey = 'hull') {
    const { sens } = attStats(att);
    if (tgt === STATION) return clamp(0.6 + 0.37 * sens, 0.3, 0.97);
    let c = 0.6 + 0.35 * sens - SUB_BY_KEY[subKey].mod * 3 - evasion(tgt);
    if (isDisabled(tgt)) c += 0.25;
    if (att === STATION) c = 0.85 - evasion(tgt) * 0.5;
    return clamp(c, 0.05, 0.97);
  }

  function weaponDef(att, which = 'primary') {
    if (att === STATION) return STATION_WEAPON;
    const w = WEAPON_DEFS[att.type] || {};
    return (which === 'special' && w.special) || w.primary || { name: 'Lövegek', kind: 'bolt', color: SHIP_TYPES[att.type].beam };
  }
  const specialReady = s => !!(WEAPON_DEFS[s.type] && WEAPON_DEFS[s.type].special) && !(s.wcd > 0);

  const critChance = att => 0.06 + 0.08 * attStats(att).sens;

  function expectedDamage(att, subKey = 'hull', mult = 1) {
    const fp = attStats(att).fp * mult;
    return subKey === 'hull' ? fp : fp * SUB_DMG;
  }

  // Sebzés alkalmazása hajóra; visszaadja, mi történt
  function damageShip(t, subKey, dmg) {
    const wasDisabled = isDisabled(t);
    const out = { hull: 0, sub: null, subDmg: 0 };
    if (subKey === 'hull') {
      out.hull = dmg;
      if (Math.random() < 0.3) {
        const k = pickRandom(SYS_KEYS);
        out.sub = k; out.subDmg = Math.round(dmg * 0.25);
      }
    } else {
      out.sub = subKey; out.subDmg = Math.round(dmg * SUB_DMG);
      out.hull = Math.round(dmg * 0.3);
    }
    t.hull = Math.max(0, t.hull - out.hull);
    if (out.sub) t.sys[out.sub] = Math.max(0, t.sys[out.sub] - out.subDmg);
    out.destroyed = t.hull <= 0;
    out.newlyDisabled = !out.destroyed && !wasDisabled && isDisabled(t);
    return out;
  }

  function damageStation(dmg) {
    const st = S.station;
    const absorbed = Math.min(st.shield, dmg);
    st.shield -= absorbed;
    st.hull = Math.max(0, st.hull - (dmg - absorbed));
    S.stats.dmgTaken += dmg;
    return { absorbed, hullDmg: dmg - absorbed };
  }

  // Egy lövés animációval és eredménnyel
  async function fireShot(att, tgt, subKey = 'hull', o = {}) {
    const which = o.weapon || 'primary';
    const def = weaponDef(att, which);
    const special = which === 'special' && def.mult;
    const origins = att === STATION ? [R.stationPoint(true), R.stationPoint(true), R.stationPoint(true)] : R.weaponOrigins(att, def);
    const from = origins[0];
    const hit = o.forceHit || Math.random() < hitChance(att, tgt, subKey);
    let to = tgt === STATION ? R.stationPoint(true) : R.shipPoint(tgt, false);
    if (!hit) {
      const ang = Math.atan2(to.y - from.y, to.x - from.x) + rand(-0.25, 0.25);
      const d = rand(70, 140) * (R.layout ? R.layout.unit : 1);
      to = { x: to.x + Math.cos(ang) * d, y: to.y + Math.sin(ang) * d };
    }
    SFX.play('weapon', att === STATION ? 'station' : att.type, def.kind, !!special, def.shots || 1);
    const playerSide = att !== STATION && att.side === 'player';
    if (playerSide) S.stats.shots++;
    if (special) {
      R.floatText(from.x, from.y - 26, D(def.name).toUpperCase(), playerSide ? '#86efac' : '#fca5a5', true);
      if (!o.quiet) hooks.log(`${NM(att.name)}: ${D(def.name)}!`, playerSide ? 'ability' : 'bad');
    }
    await R.fire(def, origins, to, hit);

    const attName = att === STATION ? t('g.station') : NM(att.name);
    const tgtName = tgt === STATION ? t('g.station') : NM(tgt.name);
    if (!hit) {
      SFX.play('miss');
      R.floatText(to.x, to.y, t('f.miss'), '#9ca3af');
      if (!o.quiet) hooks.log(t('g.miss', { a: attName }), 'miss');
      return { hit: false };
    }
    if (playerSide) S.stats.hits++;
    const crit = Math.random() < critChance(att);
    const dmg = Math.max(1, Math.round(attStats(att).fp * (o.mult || 1) * (special ? def.mult : 1) * rand(0.85, 1.15) * (crit ? 1.5 : 1)));
    if (crit && playerSide) S.stats.crits++;

    if (tgt === STATION) {
      const r = damageStation(dmg);
      if (r.absorbed > 0) { R.shieldFlash(to); SFX.play('shieldHit'); }
      if (r.hullDmg > 0) { R.burst(to.x, to.y, 0.8); SFX.play('hit'); R.shake(3); }
      R.floatText(to.x, to.y, `${crit ? t('f.crit') : ''}-${dmg}`, r.hullDmg > 0 ? '#fca5a5' : '#93c5fd', crit);
      if (!o.quiet) hooks.log(t('g.hitStation', { a: attName, d: dmg, s: r.absorbed ? t('g.shieldPart', { n: Math.round(r.absorbed) }) : '' }), 'bad');
      return { hit: true, dmg, crit };
    }
    const res = damageShip(tgt, subKey, dmg);
    if (playerSide) S.stats.dmgDealt += dmg;
    if (tgt.side === 'player') S.stats.dmgTaken += dmg;
    R.hitFlash(tgt);
    R.burst(to.x, to.y, crit ? 1.2 : 0.7);
    SFX.play('hit');
    const subTxt = subKey !== 'hull' ? ' ' + D(SUB_BY_KEY[subKey].short) : '';
    R.floatText(to.x, to.y, `${crit ? t('f.crit') : ''}-${dmg}${subTxt}`, crit ? '#fde047' : tgt.side === 'player' ? '#fca5a5' : '#fff', crit);
    if (!o.quiet) {
      const where = subKey === 'hull' ? '' : ` (${D(SUB_BY_KEY[subKey].label).toLowerCase()})`;
      const extra = res.sub && subKey === 'hull' && res.subDmg > 0 ? t('g.extra', { s: D(SUB_BY_KEY[res.sub].label).toLowerCase() }) : '';
      hooks.log(t('g.hit', { a: attName, t: tgtName, w: where, d: dmg, c: crit ? t('g.crit') : '', x: extra }), tgt.side === 'player' ? 'bad' : 'good');
    }
    if (res.newlyDisabled) {
      hooks.log(t('g.disabled', { t: tgtName }) + (tgt.side === 'enemy' && capturable(tgt) ? t('g.capturable') : ''), 'warn');
      if (tgt.side === 'enemy') R.floatText(to.x, to.y - 26, capturable(tgt) ? t('f.capturable') : t('f.disabled'), '#fbbf24', true);
    }
    hooks.update();
    return { hit: true, dmg, crit, ...res };
  }

  async function destroyShip(s) {
    const p = R.shipPoint(s, false);
    const big = SHIP_TYPES[s.type].cls === 'csatahajó' || SHIP_TYPES[s.type].cls === 'ősi';
    R.explosion(p.x, p.y, s.type === 'shadow' ? 2.2 : big ? 1.4 : 1);
    SFX.play('explosion', big);
    if (s.side === 'player') {
      S.player = S.player.filter(x => x !== s);
      S.stats.lost++;
      hooks.log(t('g.lost', { n: NM(s.name) }), 'bad');
      if (S.selPlayer === s.id) S.selPlayer = null;
    } else {
      S.enemies = S.enemies.filter(x => x !== s);
      if (s.side === 'enemy') {
        const pts = Math.round(SHIP_TYPES[s.type].points * DF().scoreMult);
        const cr = Math.round(ECON.kill(SHIP_TYPES[s.type].threat, S.wave) * DF().credMult);
        S.score += pts; S.credits += cr; S.waveCredits += cr;
        S.stats.destroyed++;
        R.floatText(p.x, p.y - 30, t('f.points', { p: pts }), '#86efac', true);
        hooks.log(t('g.killed', { n: NM(s.name), p: pts, c: cr }), 'good');
      }
      if (S.selEnemy === s.id) S.selEnemy = null;
    }
    await wait(450);
    autoSelect();
    hooks.update();
  }

  // ------------------------------------------------------------ kiválasztás
  function autoSelect() {
    if (!S) return;
    const sp = byId(S.selPlayer);
    if (!sp || sp.side !== 'player' || sp.acted || !canTakeAction(sp)) {
      const next = S.player.find(s => canAct(s) && !s.acted) || S.player.find(s => canTakeAction(s) && !s.acted) || S.player[0];
      S.selPlayer = next ? next.id : null;
    }
    const se = byId(S.selEnemy);
    if (!se || se.side === 'player') {
      const next = hostiles().find(s => !isDisabled(s)) || S.enemies[0];
      S.selEnemy = next ? next.id : null;
    }
  }

  function cycle(listName, dir) {
    if (!S || busy) return;
    const list = listName === 'player' ? S.player : S.enemies;
    if (!list.length) return;
    const key = listName === 'player' ? 'selPlayer' : 'selEnemy';
    let i = list.findIndex(s => s.id === S[key]);
    i = (i + dir + list.length) % list.length;
    S[key] = list[i].id;
    SFX.play('select');
    hooks.update();
  }

  function select(ship) {
    if (!S || !ship) return;
    if (ship.side === 'player') S.selPlayer = ship.id; else S.selEnemy = ship.id;
    SFX.play('select');
    hooks.update();
  }

  // ------------------------------------------------------------ játékos akciói
  function canPlayerAttack() {
    const a = byId(S.selPlayer), t = byId(S.selEnemy);
    return !busy && S.phase === 'battle' && a && a.side === 'player' && canAct(a) && !a.acted && t && t.side === 'enemy' && alive(t);
  }

  async function playerAttack(subKey, useAbility = false, useSpecial = false) {
    if (!canPlayerAttack()) { SFX.play('error'); return; }
    const a = byId(S.selPlayer), t = byId(S.selEnemy);
    const ab = SHIP_TYPES[a.type].ability;
    if (useAbility && a.cd > 0) { SFX.play('error'); return; }
    if (useSpecial && !specialReady(a)) { SFX.play('error'); return; }
    busy = true;
    a.acted = true;
    hooks.update();
    try {
      if (useAbility) {
        a.cd = ABILITIES[ab].cooldown;
        hooks.log(`${NM(a.name)}: ${D(ABILITIES[ab].name)}!`, 'ability');
        R.floatText(R.shipPoint(a, true).x, R.shipPoint(a, true).y - 30, D(ABILITIES[ab].name).toUpperCase(), '#7dd3fc', true);
        await usePlayerAbility(a, t, ab, subKey);
      } else if (useSpecial) {
        a.wcd = weaponDef(a, 'special').cd;
        await fireShot(a, t, subKey, { weapon: 'special' });
      } else {
        await fireShot(a, t, subKey);
      }
      if (!alive(t)) await destroyShip(t);
      else if (t.side === 'enemy' && canAct(t) && !t.acted) {
        await wait(280);
        t.acted = true;
        await enemyAct(t, a);
      }
      if (S.phase !== 'battle') return;
      await afterPlayerAction();
    } finally {
      busy = false;
      hooks.update();
    }
  }

  async function usePlayerAbility(a, tgtShip, ab, subKey) {
    const tt = tgtShip;
    switch (ab) {
      case 'precision':
        return fireShot(a, tt, subKey, { forceHit: true, mult: 1.25 });
      case 'overload': {
        const r = await fireShot(a, tt, subKey, { mult: 1.8 });
        a.sys.reactor = Math.max(0, a.sys.reactor - Math.round(a.maxSys.reactor * 0.15));
        hooks.log(t('g.overload', { a: NM(a.name) }), 'warn');
        return r;
      }
      case 'evade': {
        a.evade = true;
        return fireShot(a, tt, subKey);
      }
      case 'barrage': {
        let total = 0, hits = 0;
        for (const sk of ['hull', ...SYS_KEYS]) {
          if (!alive(tt)) break;
          const r = await fireShot(a, tt, sk, { mult: 0.45, quiet: true });
          if (r.hit) { hits++; total += r.dmg; }
          await wait(70);
        }
        hooks.log(t('g.barrage', { h: hits, d: total, t: NM(tgtShip.name) }), 'good');
        return;
      }
    }
  }

  async function afterPlayerAction() {
    if (S.phase !== 'battle') return;
    if (!hostiles().length) return waveComplete();
    autoSelect();
    hooks.update();
    if (!S.player.some(s => canTakeAction(s) && !s.acted)) {
      await wait(350);
      await endRound();
    }
  }

  // ------------------------------------------------------------ javítás
  function repairAmount(s, k) {
    const st = repairStats(s), eff = repairEff(s);
    return k === 'hull' ? Math.max(1, Math.round(s.maxHull * st.hull * eff)) : Math.max(1, Math.round(s.maxSys[k] * st.sys * eff));
  }
  function applyRepair(s, k, amount) {
    if (k === 'hull') { const b = s.hull; s.hull = Math.min(s.maxHull, s.hull + amount); return Math.round(s.hull - b); }
    const b = s.sys[k]; s.sys[k] = Math.min(s.maxSys[k], s.sys[k] + amount); return Math.round(s.sys[k] - b);
  }
  function showRepair(s, k, n) {
    const p = R.shipPoint(s);
    R.floatText(p.x, p.y - 24, `+${n} ${k === 'hull' ? D('TEST') : D(SUB_BY_KEY[k].short)}`, '#86efac');
  }

  // Kézi javítás lövés helyett (játékos)
  async function playerRepair(subKey) {
    const a = byId(S.selPlayer);
    if (busy || !S || S.phase !== 'battle' || !a || a.side !== 'player' || a.acted || !canManualRepair(a) || !damaged(a, subKey)) { SFX.play('error'); return; }
    busy = true;
    try {
      a.acted = true;
      const n = applyRepair(a, subKey, repairAmount(a, subKey));
      a.rcd = repairStats(a).cd;
      SFX.play('repair');
      showRepair(a, subKey, n);
      hooks.log(t('g.repair', { a: NM(a.name), p: subKey === 'hull' ? D('Test').toLowerCase() : D(SUB_BY_KEY[subKey].label).toLowerCase(), n }), 'ability');
      hooks.update();
      await wait(450);
      await afterPlayerAction();
    } finally {
      busy = false;
      hooks.update();
    }
  }

  // Passzív önjavítás a kör elején: 0%-os alrendszer → 20% alatti → test
  function regenTick(s) {
    const rg = REGEN[s.type];
    if (!rg || !alive(s)) return;
    const order = ['weapons', 'reactor', 'engines', 'sensors'];
    const zero = order.find(k => s.sys[k] <= 0);
    const low = order.filter(k => s.sys[k] < s.maxSys[k] * 0.2).sort((x, y) => s.sys[x] / s.maxSys[x] - s.sys[y] / s.maxSys[y])[0];
    const k = zero || low;
    let n;
    const eff = repairEff(s);
    if (k) n = applyRepair(s, k, Math.max(3, Math.round(s.maxSys[k] * rg.sys * eff)));
    else if (s.hull < s.maxHull) n = applyRepair(s, 'hull', Math.max(2, Math.round(s.maxHull * rg.hull * eff)));
    if (n > 0) showRepair(s, k || 'hull', n);
  }

  // Ellenséges gépi döntés: javít vagy támad. Ha a fegyverzete 0, mindenképp javít
  // (ha a reaktora működik); sérült reaktor/test esetén nehézségtől függően javíthat.
  function aiRepairChoice(e) {
    if (!canManualRepair(e)) return null;
    const d = DF();
    const care = 0.6 + 0.8 * d.smart;
    if (e.sys.weapons <= 0) return 'weapons';
    if (e.sys.engines <= 0 && e.sys.weapons <= 0) return 'engines';
    if (e.sys.reactor < e.maxSys.reactor * 0.25 && Math.random() < 0.45 * care) return 'reactor';
    if (e.hull < e.maxHull * 0.3 && Math.random() < 0.3 * care) return 'hull';
    const weak = SYS_KEYS.filter(k => e.sys[k] < e.maxSys[k] * 0.2);
    if (weak.length && Math.random() < 0.25 * care) return pickRandom(weak);
    return null;
  }

  async function capture() {
    if (busy || !S || S.phase !== 'battle') return;
    const tgt = byId(S.selEnemy);
    if (!tgt || !capturable(tgt)) { SFX.play('error'); return; }
    if (S.player.length >= fleetCap()) { hooks.toast(t('t.fleetFull', { n: fleetCap() })); SFX.play('error'); return; }
    if (tgt.side === 'ally') {
      tgt.side = 'player'; tgt.acted = true;
      S.enemies = S.enemies.filter(x => x !== tgt);
      S.player.push(tgt);
      SFX.play('capture');
      hooks.log(t('g.joined', { n: NM(tgt.name) }), 'good');
      R.floatText(R.shipPoint(tgt).x, R.shipPoint(tgt).y - 30, t('f.joined'), '#86efac', true);
      autoSelect(); hooks.update();
      return;
    }
    if (captureBlocked(tgt)) { hooks.toast(t('t.capRetry')); SFX.play('error'); return; }
    const a = byId(S.selPlayer);
    if (!a || !canAct(a) || a.acted) { hooks.toast(t('t.needShip')); SFX.play('error'); return; }
    busy = true;
    try {
      a.acted = true;
      const p = R.shipPoint(tgt);
      R.floatText(p.x, p.y - 30, t('f.capturing'), '#fbbf24', true);
      await wait(600);
      if (Math.random() >= captureChance(tgt)) {
        SFX.play('error');
        tgt.capFailWave = S.wave; tgt.capFailRound = S.round;
        R.floatText(p.x, p.y - 30, t('f.capFail'), '#f87171', true);
        hooks.log(t('g.capFail', { a: NM(a.name), t: NM(tgt.name) }), 'bad');
        await afterPlayerAction();
        return;
      }
      // nincs „vészjavítás”: a hajó abban az állapotban kerül a flottába, ahogy elfoglaltuk
      tgt.firepower = +(SHIP_TYPES[tgt.type].firepower * Math.pow(1.12, tgt.level - 1)).toFixed(1);
      tgt.side = 'player'; tgt.acted = true; tgt.cd = 0; tgt.wcd = 0; tgt.evade = false;
      S.enemies = S.enemies.filter(x => x !== tgt);
      S.player.push(tgt);
      const pts = Math.round(SHIP_TYPES[tgt.type].points * SCORE.captureMult * DF().scoreMult);
      const capCr = Math.round(ECON.capture(SHIP_TYPES[tgt.type].threat, S.wave) * DF().credMult);
      S.score += pts; S.credits += capCr; S.waveCredits += capCr;
      S.stats.captured++;
      SFX.play('capture');
      R.floatText(p.x, p.y - 30, t('f.captured', { p: pts }), '#86efac', true);
      hooks.log(t('g.captured', { a: NM(a.name), t: NM(tgt.name), p: pts }) + ' ' + t('g.plusCredits', { c: capCr }), 'good');
      if (S.selEnemy === tgt.id) S.selEnemy = null;
      await afterPlayerAction();
    } finally {
      busy = false;
      hooks.update();
    }
  }

  async function passRound() {
    if (busy || !S || S.phase !== 'battle') return;
    busy = true;
    try {
      for (const s of S.player) s.acted = true;
      await endRound();
    } finally { busy = false; hooks.update(); }
  }

  // ------------------------------------------------------------ ellenséges MI
  async function enemyAct(e, provoker) {
    if (S.phase !== 'battle' || !alive(e)) return;
    const fix = aiRepairChoice(e);
    if (fix) {
      const n = applyRepair(e, fix, repairAmount(e, fix));
      e.rcd = repairStats(e).cd;
      SFX.play('repair');
      showRepair(e, fix, n);
      hooks.log(t('g.repair', { a: NM(e.name), p: fix === 'hull' ? D('Test').toLowerCase() : D(SUB_BY_KEY[fix].label).toLowerCase(), n }), 'warn');
      hooks.update();
      await wait(350);
      return;
    }
    if (!canAct(e)) return;
    const d = DF();
    const targets = S.player.filter(alive);
    let target = STATION;
    if (targets.length && Math.random() >= d.stationBias) {
      if (provoker && alive(provoker) && Math.random() < 0.7) target = provoker;
      else if (Math.random() < d.smart) target = targets.slice().sort((a, b) => a.hull / a.maxHull - b.hull / b.maxHull)[0];
      else target = pickRandom(targets);
    }
    let sub = 'hull';
    // az ellenség a játékos alrendszereit is lövi (okosabb nehézségen gyakrabban)
    if (target !== STATION && Math.random() < 0.25 + d.smart * 0.45) {
      const opts = ['weapons', 'reactor', 'engines'].filter(k => target.sys[k] > 0);
      if (opts.length) sub = pickRandom(opts);
    }
    const ab = SHIP_TYPES[e.type].ability;
    const useSpec = specialReady(e) && Math.random() < 0.22 + d.smart * 0.2;
    const useAb = !useSpec && e.cd === 0 && Math.random() < 0.2 + d.smart * 0.3;
    if (useSpec) {
      e.wcd = weaponDef(e, 'special').cd;
      await fireShot(e, target, sub, { weapon: 'special' });
    } else if (useAb) {
      e.cd = ABILITIES[ab].cooldown;
      const p = R.shipPoint(e, true);
      R.floatText(p.x, p.y - 30, D(ABILITIES[ab].name).toUpperCase(), '#fca5a5', true);
      hooks.log(`${NM(e.name)}: ${D(ABILITIES[ab].name)}!`, 'bad');
      if (ab === 'barrage' && target !== STATION) {
        for (const sk of ['hull', ...SYS_KEYS]) {
          if (!alive(target)) break;
          await fireShot(e, target, sk, { mult: 0.45, quiet: true });
          await wait(60);
        }
      } else if (ab === 'barrage') {
        for (let i = 0; i < 3; i++) { await fireShot(e, STATION, 'hull', { mult: 0.55, quiet: i > 0 }); await wait(60); }
      } else if (ab === 'precision') await fireShot(e, target, sub, { forceHit: true, mult: 1.25 });
      else if (ab === 'overload') await fireShot(e, target, sub, { mult: 1.8 });
      else { e.evade = true; await fireShot(e, target, sub); }
    } else {
      await fireShot(e, target, sub);
    }
    if (target !== STATION && !alive(target)) await destroyShip(target);
    if (S.station.hull <= 0) await gameOver();
    else await maybeLastStand();
  }

  async function endRound() {
    if (S.phase !== 'battle') return;
    hooks.hint(t('hint.enemy'));
    for (const e of hostiles().slice()) {
      if (S.phase !== 'battle') return;
      if (!alive(e) || e.acted || !canTakeAction(e)) continue;
      e.acted = true;
      await enemyAct(e, null);
      await wait(180);
    }
    if (S.phase !== 'battle') return;
    // Az át nem vett szövetségesek önállóan harcolnak
    for (const al of S.enemies.filter(s => s.side === 'ally' && canAct(s))) {
      const hs = hostiles().filter(alive);
      if (!hs.length) break;
      const tgt = pickRandom(hs.filter(h => !isDisabled(h)).length ? hs.filter(h => !isDisabled(h)) : hs);
      await fireShot(al, tgt, 'hull');
      if (!alive(tgt)) await destroyShip(tgt);
      await wait(120);
    }
    if (!hostiles().length) return waveComplete();
    // Védelmi rács
    const shots = 1 + (S.station.gridLvl >= 3 ? 1 : 0) + (S.station.gridLvl >= 6 ? 1 : 0);
    for (let i = 0; i < shots; i++) {
      let hs = hostiles().filter(h => h.sys.weapons > 0);
      // ha már csak fegyvertelen ellenség maradt és nincs akcióképes saját hajó, a rács lő (ne akadjon el a hullám)
      if (!hs.length && !S.player.some(canTakeAction)) hs = hostiles();
      if (!hs.length) break;
      const tgt = hs.slice().sort((a, b) => a.hull - b.hull)[Math.random() < 0.5 ? 0 : Math.floor(Math.random() * hs.length)];
      const r = await fireShot(STATION, tgt, 'hull', { quiet: false });
      if (!alive(tgt)) await destroyShip(tgt);
      await wait(120);
      if (r && !r.hit) continue;
    }
    if (!hostiles().length) return waveComplete();
    await wait(250);
    startRound();
    hooks.hint('');
    await maybeLastStand();
    if (!S.player.some(s => canTakeAction(s))) {
      hooks.toast(t('t.alone'));
      await wait(900);
      await endRound();
    }
  }

  // ------------------------------------------------------------ utolsó esély
  // Hat hullámonként legfeljebb egyszer: ha az állomás nagyon rossz állapotban
  // van és nincs harcképes védőhajó, erős szövetséges egység ugrik be.
  // Várakozási idő: minden mentés után 6, 8, 10… hullám (egyre ritkábban jön)
  const lastStandCooldown = () => 6 + 2 * Math.max(0, (S.lastStandUses || 0) - 1);
  const lastStandIn = () => (S && S.lastStandWave ? Math.max(0, S.lastStandWave + lastStandCooldown() - S.wave) : 0);

  async function maybeLastStand() {
    if (S.phase !== 'battle' || lastStandIn() > 0) return false;
    if (S.station.hull / S.station.maxHull >= 0.4) return false;   // flottától függetlenül, ha az állomás 40% alatt van
    if (!hostiles().length) return false;
    S.lastStandWave = S.wave;
    S.lastStandUses = (S.lastStandUses || 0) + 1;

    const agamTaken = [...S.player, ...S.enemies].some(s => s.name === 'Agamemnon');
    const options = ['whitestars', 'sharlin'];
    if (!agamTaken) options.push('agamemnon');
    const pick = pickRandom(options);
    const lvl = Math.min(MAX_SHIP_LEVEL, 2 + Math.floor(S.wave / 5));
    const ships = [];
    const make = (type, name) => {
      const s = makeShip(type, 'player', name ? { name } : {});
      while (s.level < lvl) levelUp(s);
      ships.push(s);
    };
    if (pick === 'whitestars') { const n = S.wave >= 12 ? 3 : 2; for (let i = 0; i < n; i++) make('whitestar'); }
    else if (pick === 'sharlin') make('minbari');
    else make('earth', 'Agamemnon');

    const title = pick === 'whitestars' ? t('ls.whitestars', { n: ships.length }) : pick === 'sharlin' ? t('ls.sharlin') : t('ls.agam');
    hooks.waveStart(null, false, { main: t('banner.last'), sub: t('banner.lastSub', { t: title.toUpperCase() }) });
    hooks.log(t('g.reinf', { t: title }), 'ally');
    SFX.play('alarm');
    await wait(1200);
    for (let i = 0; i < ships.length; i++) {
      const ap = R.allyPoint(null, i);
      await R.jumpPoint(ap.x, ap.y, 0.8, true);
      S.player.push(ships[i]);
      R.spawnFrom(ships[i], ap.x, ap.y, 1);
      hooks.update();
      await wait(250);
    }
    SFX.play('capture');
    autoSelect();
    hooks.update();
    return true;
  }

  function startRound() {
    S.round++;
    for (const s of [...S.player, ...S.enemies]) {
      s.acted = false; s.evade = false;
      if (s.cd > 0) s.cd--;
      if (s.wcd > 0) s.wcd--;
      if (s.rcd > 0) s.rcd--;
      regenTick(s);
    }
    const st = S.station;
    st.shield = Math.min(st.maxShield, st.shield + st.maxShield * 0.05 + st.shieldLvl * 3);
    autoSelect();
    hooks.log(t('g.round', { n: S.round }), 'round');
    hooks.update();
    autosave();
  }

  // ------------------------------------------------------------ hullámok
  // Árny hullám: csak Árny hajók, más fajjal nem keveredve. Három változat:
  // egy vagy több cirkáló / egy cirkáló felderítőkkel / csak felderítők.
  function shadowGroup(n, budget, hpMul, dmgMul) {
    const out = [];
    const B = Math.max(SHIP_TYPES.shadow.threat, budget * 1.05);
    const C = SHIP_TYPES.shadow.threat, Sc = SHIP_TYPES.shadowscout.threat;
    const bossMul = n % 5 === 0 ? 1 + (n / 5 - 1) * 0.25 : 1;     // a főellenséges hullámok cirkálói erősebbek
    const cruiser = () => makeShip('shadow', 'enemy', { hpMul: hpMul * bossMul, dmgMul });
    const scout = () => makeShip('shadowscout', 'enemy', { hpMul, dmgMul });
    const opts = ['cruisers'];
    // a főellenséges (5-tel osztható) hullámokban mindig van legalább egy cirkáló
    if (n >= 10) { if (B >= C + Sc) opts.push('mixed'); if (n % 5 !== 0) opts.push('scouts'); }
    const pick = pickRandom(opts);
    if (pick === 'cruisers') { const k = clamp(Math.round(B / C), 1, 3); for (let i = 0; i < k; i++) out.push(cruiser()); }
    else if (pick === 'mixed') { out.push(cruiser()); const k = clamp(Math.floor((B - C) / Sc), 1, 5); for (let i = 0; i < k; i++) out.push(scout()); }
    else { const k = clamp(Math.round(B / Sc), 2, 6); for (let i = 0; i < k; i++) out.push(scout()); }
    return out;
  }

  function buildWave(n) {
    const d = DF();
    const hpMul = d.enemyHp * (1 + 0.07 * (n - 1));
    const dmgMul = d.enemyDmg * (1 + 0.045 * (n - 1));
    const list = [];
    // a flotta erejéhez is igazodik, hogy a nagy flotta se unatkozzon
    const fleetThreat = S.player.reduce((a, s) => a + SHIP_TYPES[s.type].threat * (1 + (s.level - 1) * 0.15), 0);
    let budget = (1.8 + n * 1.45 + Math.max(0, fleetThreat - 3) * 0.45) * d.budget;

    // Árny hullám: minden 5. hullám, illetve a 10.-től ~30% eséllyel „Árnyékflotta”
    const shadowWave = n % 5 === 0 || (n >= 10 && Math.random() < 0.3);
    S.shadowFleet = shadowWave && n % 5 !== 0;
    if (shadowWave) {
      list.push(...shadowGroup(n, budget, hpMul, dmgMul));
      S.shadowSeen = true;
    } else {
      // az első 5 hullám egyikében biztosan jön egy ellenséges Minbari cirkáló
      if (n === S.minbariWave && !S.shadowSeen) {
        list.push(makeShip('minbari', 'enemy', { hpMul, dmgMul: dmgMul * 0.9 }));
        budget = Math.max(0, budget - SHIP_TYPES.minbari.threat);
      }
      // Frakciótéma: a földi hajók csak egymással jönnek; Narn és Centauri soha nem
      // kerül egy ellenséges flottába (melléjük Drazi és kalóz társulhat).
      const THEMES = {
        earth: ['Földi Szövetség'],
        narn: ['Narn Rezsim', 'Drazi Szabadság', 'Kalózok'],
        centauri: ['Centauri Köztársaság', 'Drazi Szabadság', 'Kalózok'],
        raiders: ['Kalózok', 'Drazi Szabadság'],
      };
      const usable = k => {
        const T = SHIP_TYPES[k];
        return !T.boss && !T.shadowOnly && !T.civilian && T.minWave && T.minWave <= n && k !== 'minbari';
      };
      const minbariHere = list.some(s => s.type === 'minbari');
      const themes = Object.keys(THEMES).filter(th =>
        !(th === 'earth' && minbariHere) &&
        Object.keys(SHIP_TYPES).some(k => usable(k) && THEMES[th].includes(SHIP_TYPES[k].faction)));
      S.waveTheme = pickRandom(themes.length ? themes : ['raiders']);
      const pool = Object.keys(SHIP_TYPES).filter(k => usable(k) && THEMES[S.waveTheme].includes(SHIP_TYPES[k].faction));
      let guard = 0;
      while (budget > 0.6 && list.length < 9 && guard++ < 50) {
        // nehéz hajóból (pl. csatahordozó) legfeljebb 2 egy hullámban – változatosabb flották
        const fits = pool.filter(k => SHIP_TYPES[k].threat <= budget + 0.4 && (SHIP_TYPES[k].threat < 3.5 || list.filter(s => s.type === k).length < 2));
        if (!fits.length) break;
        // nagyobb hajók esélyesebbek, ahogy nő a hullámszám
        // a téma fő faja kétszeres súllyal: a Drazi és kalóz hajók csak kísérők
        const weights = fits.map(k => (1 + SHIP_TYPES[k].threat * Math.min(1, n / 10)) * (SHIP_TYPES[k].faction === THEMES[S.waveTheme][0] ? 2 : 1));
        let r = Math.random() * weights.reduce((a, b) => a + b, 0);
        let k = fits[0];
        for (let i = 0; i < fits.length; i++) { r -= weights[i]; if (r <= 0) { k = fits[i]; break; } }
        list.push(makeShip(k, 'enemy', { hpMul, dmgMul }));
        budget -= SHIP_TYPES[k].threat;
      }
    }

    // a 8. hullámtól ritkán kettő; teli flottánál is jöhetnek – ilyenkor önállóan harcolnak
    // szövetségesek csak az 5. hullámtól, nincs garantált érkezés (arra ott az utolsó esély)
    const allyChance = n < 5 ? 0 : 0.3 + (S.player.length <= 2 ? 0.15 : 0);
    if (Math.random() < allyChance) {
      const count = n >= 8 && Math.random() < 0.15 ? 2 : 1;
      const types = ALLY_TYPES.filter(t => (n >= 6 || t !== 'whitestar'));
      if (S.shadowSeen) types.push('minbari');
      for (let i = 0; i < count; i++) {
        const type = pickRandom(types);
        const reserved = ALLY_ONLY_NAMES[type];
        const taken = reserved && [...S.player, ...S.enemies, ...list].some(s => s.name === reserved);
        const ally = makeShip(type, 'ally', reserved && !taken ? { name: reserved } : {});
        for (const k of SYS_KEYS) ally.sys[k] = Math.round(ally.maxSys[k] * rand(0.6, 1));
        ally.hull = Math.round(ally.maxHull * rand(0.55, 0.95));
        list.push(ally);
      }
      S.lastAllyWave = n;
    }
    return list;
  }


  // ------------------------------------------------------------ kereskedő konvoj
  // Véletlen esemény: harc helyett békés kereskedők érkeznek, kreditet hoznak,
  // javítanak a flottán és az állomáson, majd továbbállnak.
  function rollMerchant(n) {
    return n >= ECON.merchantMinWave && n % 5 !== 0 && S.lastMerchant !== n - 1 && Math.random() < ECON.merchantChance;
  }

  async function merchantWave() {
    S.phase = 'event';
    S.lastMerchant = S.wave;
    S.visitors = [];
    hooks.update();
    hooks.waveStart(S.wave, false, { main: t('banner.merchant'), sub: t('banner.merchantSub') });
    await wait(1300);
    const count = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const ap = R.allyPoint(null, i);
      await R.jumpPoint(ap.x, ap.y, 0.6, true);
      const m = makeShip('merchant', 'ally');
      S.visitors.push(m);
      R.spawnFrom(m, ap.x, ap.y, 1);
      hooks.update();
      await wait(250);
    }
    hooks.log(t('g.merchantArr', { n: count }), 'ally');
    await wait(1200);
    // kereskedés: kredit + javítás
    const cr = Math.round(ECON.merchantCredits(S.wave) * DF().credMult);
    S.credits += cr; S.waveCredits += cr;
    for (const s of S.player) {
      s.hull = Math.min(s.maxHull, Math.round(s.hull + (s.maxHull - s.hull) * 0.5));
      for (const k of SYS_KEYS) s.sys[k] = Math.min(s.maxSys[k], Math.round(s.sys[k] + (s.maxSys[k] - s.sys[k]) * 0.5));
    }
    const st = S.station;
    const fix = Math.round((st.maxHull - st.hull) * 0.3);
    st.hull = Math.min(st.maxHull, st.hull + fix);
    st.shield = st.maxShield;
    SFX.play('coin');
    for (const m of S.visitors) { const p = R.shipPoint(m); R.floatText(p.x, p.y - 30, `+${Math.round(cr / S.visitors.length)} ¢`, '#fde047', true); }
    const sp = R.stationPoint(true);
    if (fix > 0) R.floatText(sp.x, sp.y - 20, t('f.repair', { n: fix }), '#86efac', true);
    hooks.log(t('g.merchantTrade', { c: cr, h: fix }), 'good');
    hooks.update();
    await wait(1600);
    for (const m of S.visitors) R.ghostLeave(m);
    S.visitors = [];
    hooks.log(t('g.merchantLeft'), 'miss');
    await wait(900);
    S.phase = 'shop';
    for (const s of S.player) { s.acted = false; s.cd = 0; s.wcd = 0; s.rcd = 0; s.evade = false; }
    autosave();
    hooks.update();
    hooks.shop({ wave: S.wave, merchant: { credits: cr, hull: fix } });
  }

  async function startWave() {
    busy = true;
    try {
      S.wave++;
      if (rollMerchant(S.wave)) { S.round = 0; S.waveCredits = 0; S.enemies = []; R.clearFx(); await merchantWave(); return; }
      S.round = 0;
      S.waveCredits = 0;
      S.phase = 'battle';
      R.clearFx();
      const list = buildWave(S.wave);
      S.enemies = [];
      hooks.update();
      const shadowNow = list.some(s => s.type === 'shadow' || s.type === 'shadowscout');
      hooks.waveStart(S.wave, shadowNow, S.shadowFleet ? { main: t('banner.wave', { n: S.wave }), sub: t('banner.shadowFleet'), boss: true } : null);
      await wait(1300);
      const L = R.layout;
      const jx = R.W * 0.8, jy = L ? L.cy : R.H / 2;
      const foes = list.filter(s => s.side !== 'ally');
      await R.jumpPoint(jx, jy, 0.5 + foes.length * 0.18);
      for (const s of foes) {
        S.enemies.push(s);
        R.spawnFrom(s, jx, jy);
        hooks.update();
        await wait(170);
      }
      // szövetségesek: kék ugrópont közvetlenül az állomás mellett
      for (const s of list.filter(x => x.side === 'ally')) {
        await wait(400);
        const ap = R.allyPoint(null, S.enemies.filter(x => x.side === 'ally').length);
        await R.jumpPoint(ap.x, ap.y, 0.9, true);
        S.enemies.push(s);
        R.spawnFrom(s, ap.x, ap.y, 1);
        hooks.update();
      }
      const allies = list.filter(s => s.side === 'ally');
      const boss = list.find(s => s.type === 'shadow' || s.type === 'shadowscout');
      hooks.log(t('g.wave', { w: S.wave, n: list.filter(s => s.side === 'enemy').length }), 'warn');
      if (S.shadowFleet) { hooks.log(t('g.shadowFleet'), 'bad'); SFX.play('scream'); }
      else if (boss) { hooks.log(t('g.shadow'), 'bad'); SFX.play('scream'); }
      for (const a of allies) hooks.log(t('g.allyArr', { n: NM(a.name), t: D(SHIP_TYPES[a.type].name) }), 'ally');
      await wait(500);
      startRound();
    } finally {
      busy = false;
      hooks.update();
    }
  }

  async function waveComplete() {
    S.phase = 'shop';
    const bonus = Math.round(SCORE.wave * S.wave * DF().scoreMult);
    const credBonus = Math.round(ECON.waveBonus(S.wave) * DF().credMult);
    S.score += bonus; S.credits += credBonus; S.waveCredits += credBonus;
    SFX.play('victory');
    hooks.log(t('g.waveDone', { w: S.wave, p: bonus, c: credBonus }), 'good');
    // szövetségesek, akiket nem vettünk át, továbbállnak
    const leftovers = S.enemies.filter(s => s.side === 'ally');
    for (const a of leftovers) { hooks.log(t('g.left', { n: NM(a.name) }), 'miss'); R.ghostLeave(a); }
    S.enemies = [];
    // automatikus részleges javítás
    for (const s of S.player) {
      s.hull = Math.min(s.maxHull, Math.round(s.hull + (s.maxHull - s.hull) * 0.2));
      for (const k of SYS_KEYS) s.sys[k] = Math.min(s.maxSys[k], Math.round(s.sys[k] + (s.maxSys[k] - s.sys[k]) * 0.25));
      s.acted = false; s.cd = 0; s.wcd = 0; s.rcd = 0; s.evade = false;
    }
    // a pajzs a hullámok között csak részben töltődik vissza (a hiány fele)
    S.station.shield = Math.round(S.station.shield + (S.station.maxShield - S.station.shield) * 0.5);
    let gift = null;
    if (!S.player.length) {
      gift = makeShip('narn', 'player');
      gift.name = "G'Kar ajándéka";
      S.player.push(gift);
    }
    S.stats.wavesCleared = S.wave;
    autosave();
    hooks.update();
    await wait(900);
    hooks.shop({ wave: S.wave, bonus, credBonus, gift });
  }

  async function gameOver() {
    if (S.phase === 'over') return;
    S.phase = 'over';
    hooks.update();
    Storage.remove('auto');
    await wait(400);
    await R.playStationDestruction();
    const entry = { name: S.name, score: S.score, wave: S.wave, diff: S.diff, date: Date.now(), destroyed: S.stats.destroyed, captured: S.stats.captured };
    const rank = Storage.addScore(entry);
    hooks.gameOver({ ...entry, rank, stats: { ...S.stats } });
  }

  // ------------------------------------------------------------ bolt
  function repairCost(s, full) {
    let missing = (s.maxHull - s.hull) * ECON.repairHull;
    for (const k of SYS_KEYS) missing += (s.maxSys[k] - s.sys[k]) * ECON.repairSys;
    return Math.ceil(missing * (full ? 1 : 0.5) * 0.9);
  }
  function upgradeCost(s) {
    return Math.round(140 * s.level * (SHIP_TYPES[s.type].threat / 3 + 0.6));
  }
  function spend(cost) {
    if (S.credits < cost) { SFX.play('error'); hooks.toast(t('t.noCredits')); return false; }
    S.credits -= cost; SFX.play('coin'); return true;
  }

  const shop = {
    repair(id, full) {
      const s = byId(id); if (!s) return;
      const cost = repairCost(s, full);
      if (cost <= 0 || !spend(cost)) return;
      const f = full ? 1 : 0.5;
      s.hull = Math.min(s.maxHull, Math.round(s.hull + (s.maxHull - s.hull) * f));
      for (const k of SYS_KEYS) s.sys[k] = Math.min(s.maxSys[k], Math.round(s.sys[k] + (s.maxSys[k] - s.sys[k]) * f));
      hooks.update();
    },
    upgrade(id) {
      const s = byId(id); if (!s || s.level >= MAX_SHIP_LEVEL) return;
      if (!spend(upgradeCost(s))) return;
      levelUp(s);
      hooks.update();
    },
    scrap(id) {
      const s = byId(id); if (!s || S.player.length <= 1) return;
      const val = scrapValue(s);
      S.player = S.player.filter(x => x !== s);
      S.credits += val; SFX.play('coin');
      hooks.toast(t('t.scrapped', { n: NM(s.name), c: val }));
      hooks.update();
    },
    buy(type) {
      if (S.player.length >= fleetCap()) { hooks.toast(t('t.fleetFull2')); SFX.play('error'); return; }
      if (!spend(SHIP_TYPES[type].price)) return;
      const s = makeShip(type, 'player');
      S.player.push(s);
      hooks.update();
    },
    station(key) {
      const st = S.station;
      const def = STATION_UPGRADES.find(u => u.key === key);
      if (def.max && def.lvl(st) >= def.max) return;
      if (key === 'repair' && st.hull >= st.maxHull) return;
      if (!spend(def.cost(st))) return;
      if (key === 'repair') st.hull = Math.min(st.maxHull, st.hull + st.maxHull * 0.3);
      if (key === 'armor') { st.armorLvl++; st.maxHull += 250; st.hull += 250; }
      if (key === 'shield') { st.shieldLvl++; st.maxShield += 50; st.shield = Math.min(st.maxShield, st.shield + 50); }
      if (key === 'grid') { st.gridLvl++; st.grid += 5; }
      if (key === 'command') st.cmdLvl = (st.cmdLvl || 0) + 1;
      st.hull = Math.round(st.hull);
      hooks.update();
    },
  };

  // ------------------------------------------------------------ új játék / mentés
  function newGame(name, diff) {
    S = {
      version: 2, name: name || 'Sheridan kapitány', diff, wave: 0, round: 0, score: 0, credits: 150, waveCredits: 0,
      phase: 'battle', nextId: 1, nameCount: {},
      station: { hull: STATION_BASE.hull, maxHull: STATION_BASE.hull, shield: STATION_BASE.shield, maxShield: STATION_BASE.shield, grid: STATION_BASE.grid, armorLvl: 0, shieldLvl: 0, gridLvl: 0 },
      player: [], enemies: [], selPlayer: null, selEnemy: null,
      stats: { destroyed: 0, captured: 0, lost: 0, shots: 0, hits: 0, crits: 0, dmgDealt: 0, dmgTaken: 0, wavesCleared: 0 },
      created: Date.now(), minbariWave: 3 + Math.floor(Math.random() * 2),
    };
    const ws = makeShip('whitestar', 'player');
    S.player.push(ws);
    S.selPlayer = ws.id;
    R.sync(S);
    return startWave();
  }

  function serialize() { return JSON.parse(JSON.stringify(S)); }

  function load(data) {
    S = JSON.parse(JSON.stringify(data));
    busy = false;
    R.sync(null);
    R.clearFx();
    autoSelect();
    hooks.update();
  }

  function autosave() { if (S && S.phase !== 'over') Storage.save('auto', serialize()); }

  return {
    hooks,
    get state() { return S; }, get busy() { return busy; },
    newGame, load, serialize, autosave, startWave,
    playerAttack, capture, passRound, cycle, select, canPlayerAttack,
    isDisabled, canAct, canTakeAction, canManualRepair, repairStats, repairEff, hasRegen, damaged, repairAmount, playerRepair, capturable, captureChance, captureBlocked, fleetCap, scrapValue, lastStandIn, weaponDef, specialReady, ratio, hitChance, expectedDamage, critChance, byId, hostiles,
    repairCost, upgradeCost, shop,
    end() { S = null; busy = false; },
  };
})();

// ---------------------------------------------------------------------------
// Tárolás: mentések, ranglista, beállítások (localStorage)
// ---------------------------------------------------------------------------
const Storage = (() => {
  const P = 'b5dts_';
  const get = (k, def) => { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  const set = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  return {
    save(slot, data) { return set('save_' + slot, { data, savedAt: Date.now() }); },
    load(slot) { return get('save_' + slot, null); },
    remove(slot) { try { localStorage.removeItem(P + 'save_' + slot); } catch (e) { /* nincs tároló */ } },
    scores() { return get('leaderboard', []); },
    addScore(entry) {
      const list = get('leaderboard', []);
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      const top = list.slice(0, 15);
      set('leaderboard', top);
      const i = top.indexOf(entry);
      return i >= 0 ? i + 1 : null;
    },
    clearScores() { set('leaderboard', []); },
    settings() { return { volume: 0.6, music: true, fast: false, shake: true, ...get('settings', {}) }; },
    saveSettings(s) { set('settings', s); },
  };
})();
