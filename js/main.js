'use strict';
// ---------------------------------------------------------------------------
// Indítás, fő ciklus, egér és billentyűzet.
// ---------------------------------------------------------------------------

(() => {
  const cv = document.getElementById('cv');
  R.init(cv);
  UI.bind();
  UI.applySettings();
  UI.showMenu();

  // Offline működés / telepíthetőség (csak http(s) alatt; fájlból megnyitva nincs rá szükség)
  // A telepített alkalmazás ritkán töltődik újra, ezért előtérbe kerüléskor és félóránként
  // rákérdezünk az új verzióra; ha új service worker veszi át az irányítást, frissítünk.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) UI.updateReady(); });
    window.addEventListener('load', async () => {
      let reg;
      try { reg = await navigator.serviceWorker.register('sw.js'); } catch (e) { return; }
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      setInterval(check, 30 * 60 * 1000);
    });
  }

  // Háttérbe kerüléskor (másik app, lezárt képernyő) a hang szünetel, visszatéréskor folytatódik
  document.addEventListener('visibilitychange', () => { document.hidden ? SFX.suspend() : SFX.resume(); });
  window.addEventListener('pagehide', () => SFX.suspend());
  window.addEventListener('pageshow', () => { if (!document.hidden) SFX.resume(); });

  // Böngészők csak felhasználói interakció után engedik a hangot
  const unlock = () => { SFX.unlock(); UI.applySettings(); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  // ------------------------------------------------------------ fő ciklus
  let last = performance.now();
  const skipBtn = document.getElementById('cine-skip');
  function loop(now) {
    const dt = (now - last) / 1000;
    last = now;
    // egy rajzolási hiba se állíthassa le a játékot
    requestAnimationFrame(loop);
    try { R.frame(dt, Game.state); } catch (e) { console.error(e); }
    UI.placeShipInfo();
    skipBtn.classList.toggle('hidden', !R.inCinematic);
    document.body.classList.toggle('cine', R.inCinematic);
  }
  requestAnimationFrame(loop);

  // ------------------------------------------------------------ egér a csatatéren
  cv.addEventListener('mousemove', e => {
    const s = R.pick(e.clientX, e.clientY, Game.state);
    R.setHover(s ? s.id : null);
    cv.style.cursor = s ? 'pointer' : 'default';
  });
  cv.addEventListener('click', e => {
    if (UI.stackSize) return;
    const s = R.pick(e.clientX, e.clientY, Game.state);
    if (s) { UI.disarm(); Game.select(s); UI.expandHud(); } else UI.hideShipInfo();
  });
  // hajóinfó: koppintásra megjelenik, nyomva tartva kint marad
  cv.addEventListener('pointerdown', e => {
    if (UI.stackSize) return;
    const s = R.pick(e.clientX, e.clientY, Game.state);
    if (s) UI.showShipInfo(s, true);
  });
  window.addEventListener('pointerup', () => UI.releaseShipInfo());
  window.addEventListener('pointercancel', () => UI.releaseShipInfo());
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('dblclick', e => {
    // dupla kattintás ellenséges hajóra: testre lövés
    if (UI.stackSize) return;
    const s = R.pick(e.clientX, e.clientY, Game.state);
    if (s && s.side === 'enemy' && Game.canPlayerAttack()) UI.attack('hull');
  });

  // ------------------------------------------------------------ billentyűzet
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') {
      if (R.inCinematic) { R.skipCinematic(); return; }
      if (UI.back()) return;
      if (Game.state && Game.state.phase === 'battle' && !UI.stackSize) UI.openPause();
      return;
    }
    if (R.inCinematic && (e.key === ' ' || e.key === 'Enter')) { R.skipCinematic(); return; }
    const S = Game.state;
    if (!S || S.phase !== 'battle' || UI.stackSize) return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') { const sub = SUBSYSTEMS[+k - 1]; const btn = document.querySelector(`.sub-btn[data-sub="${sub.key}"]`); if (btn && !btn.disabled) UI.attack(sub.key); else SFX.play('error'); }
    else if (k === 'q') { UI.disarm(); Game.cycle('player', -1); }
    else if (k === 'e') { UI.disarm(); Game.cycle('player', 1); }
    else if (k === 'a') { UI.disarm(); Game.cycle('enemy', -1); }
    else if (k === 'd' || k === 'tab') { e.preventDefault(); UI.disarm(); Game.cycle('enemy', e.shiftKey ? -1 : 1); }
    else if (k === 'f') UI.toggleArm();
    else if (k === 'l') UI.toggleLog();
    else if (k === 'h') UI.toggleHud();
    else if (k === 'g') UI.toggleWeapon();
    else if (k === 'r') UI.toggleRepair();
    else if (k === 'c') Game.capture();
    else if (k === ' ') { e.preventDefault(); UI.disarm(); Game.passRound(); }
  });
})();
