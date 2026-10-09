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
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

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
    if (s) { UI.disarm(); Game.select(s); }
  });
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
    else if (k === 'g') UI.toggleWeapon();
    else if (k === 'c') Game.capture();
    else if (k === ' ') { e.preventDefault(); UI.disarm(); Game.passRound(); }
  });
})();
