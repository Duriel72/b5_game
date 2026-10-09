'use strict';
// ---------------------------------------------------------------------------
// Felhasználói felület: HUD, képernyők, bolt, ranglista, súgó, nyelvváltás.
// Minden szöveg az i18n.js-ből jön: t() a felület, D() az adatok, NM() a hajónevek.
// ---------------------------------------------------------------------------

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString(I18N.locale);

const UI = (() => {
  let armed = false;
  let weapon = 'primary';   // a kijelölt fegyver: elsődleges vagy különleges
  let stack = [];
  let settings = Storage.settings();
  let toastTimer = null;
  let selDiff = 'normal';
  let lastRank = null;
  let lastShopInfo = null;
  let lastOver = null;
  let slotsMode = 'load';

  // ------------------------------------------------------------ képernyő-kezelés
  function open(id) {
    const el = $('#' + id);
    if (!el) return;
    stack = stack.filter(x => x !== id);
    stack.push(id);
    // a legutóbb megnyitott ablak mindig legfelül legyen (pl. Szünet → Beállítások)
    if (el.classList.contains('modal')) el.style.zIndex = String(12 + stack.length);
    el.classList.add('open');
    SFX.play('click');
  }
  function close(id) {
    const el = $('#' + id);
    if (el) el.classList.remove('open');
    stack = stack.filter(x => x !== id);
  }
  function back() {
    const id = stack[stack.length - 1];
    if (!id || id === 'scr-menu' || id === 'scr-shop' || id === 'scr-over') return false;
    close(id);
    SFX.play('click');
    return true;
  }
  const top = () => stack[stack.length - 1];
  const isOpen = id => stack.includes(id);

  function setHud(on) {
    for (const id of ['#hud-top', '#hud-bottom', '#log']) $(id).classList.toggle('hidden', !on);
    measure();
  }

  function measure() {
    const tp = $('#hud-top'), b = $('#hud-bottom');
    R.setInsets(tp.classList.contains('hidden') ? 0 : tp.offsetHeight, b.classList.contains('hidden') ? 0 : b.offsetHeight);
    $('#toast').style.bottom = (b.classList.contains('hidden') ? 40 : b.offsetHeight + 16) + 'px';
  }

  // ------------------------------------------------------------ főmenü
  function buildMenu() {
    const auto = Storage.load('auto');
    const items = [];
    if (auto) items.push([t('menu.continue'), () => loadSave(auto.data), esc(t('menu.contSub', { name: NM(auto.data.name), wave: auto.data.wave }))]);
    items.push([t('menu.new'), () => openNew()]);
    items.push([t('menu.load'), () => openSlots('load')]);
    items.push([t('menu.scores'), () => openScores()]);
    items.push([t('menu.catalog'), () => openCatalog()]);
    items.push([t('menu.help'), () => openHelp()]);
    items.push([t('menu.settings'), () => openSettings()]);
    if (document.fullscreenEnabled) items.push([t('menu.fullscreen'), () => toggleFullscreen()]);
    items.push([t('menu.quit'), () => quit()]);
    const nav = $('#menu-btns');
    nav.innerHTML = '';
    items.forEach(([label, fn, sub], i) => {
      const b = document.createElement('button');
      b.className = 'btn' + (i === 0 ? ' primary' : '');
      b.innerHTML = esc(label) + (sub ? `<br><small style="font-weight:500;opacity:.75">${sub}</small>` : '');
      b.onclick = fn;
      nav.appendChild(b);
    });
  }

  function showMenu() {
    stack.forEach(id => $('#' + id).classList.remove('open'));
    stack = [];
    Game.end();
    R.mode = 'menu';
    R.sync(null);
    R.clearFx();
    setHud(false);
    $('#hint').classList.add('hidden');
    $('#cine-skip').classList.add('hidden');
    buildMenu();
    $('#scr-menu').classList.add('open');
    stack.push('scr-menu');
  }

  // Teljes képernyő (asztalon a menüből, telefonon játékindításkor automatikusan)
  const isTouch = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
  function toggleFullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    goFullscreen();
  }
  function goFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenEnabled || document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); })
      .catch(() => {});
  }
  function mobileFullscreen() { if (isTouch()) goFullscreen(); }

  function quit() {
    confirm(t('quit.title'), t('quit.text'), () => {
      window.close();
      setTimeout(() => toast(t('quit.blocked')), 200);
    });
  }

  // ------------------------------------------------------------ új játék
  function buildDiffs() {
    const grid = $('#diff-grid');
    grid.innerHTML = '';
    for (const [k, d] of Object.entries(DIFFICULTIES)) {
      const b = document.createElement('button');
      b.className = 'diff' + (k === selDiff ? ' sel' : '');
      b.innerHTML = `<b>${esc(D(d.name))}</b><small>${esc(D(d.desc))}</small><span class="mult">${esc(t('new.mult', { m: d.scoreMult }))}</span>`;
      b.onclick = () => { selDiff = k; grid.querySelectorAll('.diff').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); SFX.play('select'); };
      grid.appendChild(b);
    }
  }

  function openNew() {
    buildDiffs();
    $('#in-name').value = settings.lastName || '';
    open('scr-new');
    setTimeout(() => $('#in-name').focus(), 50);
  }

  async function startNew() {
    mobileFullscreen();
    const name = $('#in-name').value.trim() || t('defaultName');
    settings.lastName = name; Storage.saveSettings(settings);
    stack.forEach(id => $('#' + id).classList.remove('open'));
    stack = [];
    $('#log-lines').innerHTML = '';
    R.mode = 'battle';
    R.clearFx();
    setHud(true);
    await Game.newGame(name, selDiff);
  }

  function loadSave(data) {
    mobileFullscreen();
    stack.forEach(id => $('#' + id).classList.remove('open'));
    stack = [];
    $('#log-lines').innerHTML = '';
    R.mode = 'battle';
    Game.load(data);
    setHud(true);
    log(t('loaded', { name: NM(data.name), wave: data.wave }), 'ally');
    if (data.phase === 'shop') showShop({ wave: data.wave, resumed: true });
  }

  // ------------------------------------------------------------ mentés/betöltés
  function openSlots(mode) {
    slotsMode = mode;
    $('#slots-title').textContent = mode === 'save' ? t('slots.save') : t('slots.load');
    const box = $('#slots');
    box.innerHTML = '';
    const slots = mode === 'save' ? [1, 2, 3] : ['auto', 1, 2, 3];
    for (const slot of slots) {
      const s = Storage.load(slot);
      const div = document.createElement('div');
      div.className = 'slot';
      const title = slot === 'auto' ? t('slot.auto') : t('slot.n', { n: slot });
      const info = s
        ? `${esc(t('slot.info', { name: NM(s.data.name), diff: D(DIFFICULTIES[s.data.diff].name), wave: s.data.wave, score: fmt(s.data.score) }))}<br>${new Date(s.savedAt).toLocaleString(I18N.locale)}`
        : esc(t('slot.empty'));
      div.innerHTML = `<div class="slot-info"><b>${esc(title)}</b><small>${info}</small></div>`;
      const act = document.createElement('button');
      act.className = 'btn small primary';
      if (mode === 'save') {
        act.textContent = t('slot.saveHere');
        act.onclick = () => {
          const doSave = () => { Storage.save(slot, Game.serialize()); toast(t('slot.saved')); SFX.play('coin'); openSlots('save'); };
          s ? confirm(t('slot.overTitle'), t('slot.overText'), doSave) : doSave();
        };
      } else {
        act.textContent = t('slot.loadBtn');
        act.disabled = !s;
        act.onclick = () => {
          const doLoad = () => loadSave(s.data);
          Game.state && Game.state.phase !== 'over' ? confirm(t('slot.loadTitle'), t('slot.loadText'), doLoad) : doLoad();
        };
      }
      div.appendChild(act);
      if (s && slot !== 'auto') {
        const del = document.createElement('button');
        del.className = 'btn small ghost danger';
        del.textContent = t('slot.del');
        del.onclick = () => confirm(t('slot.delTitle'), t('slot.delText', { slot: title }), () => { Storage.remove(slot); openSlots(mode); });
        div.appendChild(del);
      }
      box.appendChild(div);
    }
    if (!stack.includes('scr-slots')) open('scr-slots');
  }

  // ------------------------------------------------------------ ranglista
  function buildScores(highlight) {
    const list = Storage.scores();
    const box = $('#scores');
    if (!list.length) { box.innerHTML = `<div class="empty">${esc(t('scores.empty'))}</div>`; return; }
    box.innerHTML = `<table class="scores"><thead><tr><th>#</th><th>${t('scores.cmd')}</th><th>${t('scores.diff')}</th><th class="num">${t('scores.wave')}</th><th class="num">${t('scores.pts')}</th><th>${t('scores.date')}</th></tr></thead><tbody>${
      list.map((e, i) => `<tr class="${highlight === i + 1 ? 'me' : ''}"><td class="medal">${i + 1}.</td><td>${esc(NM(e.name))}</td><td>${esc(DIFFICULTIES[e.diff] ? D(DIFFICULTIES[e.diff].name) : e.diff)}</td><td class="num">${e.wave}</td><td class="num"><b>${fmt(e.score)}</b></td><td class="muted">${new Date(e.date).toLocaleDateString(I18N.locale)}</td></tr>`).join('')
    }</tbody></table>`;
  }
  function openScores(highlight) {
    buildScores(highlight);
    open('scr-scores');
  }

  // ------------------------------------------------------------ katalógus
  function buildCatalog() {
    const box = $('#catalog');
    box.innerHTML = '';
    for (const [k, T] of Object.entries(SHIP_TYPES)) {
      if (T.civilian) continue;
      const d = document.createElement('div');
      d.className = 'cat';
      const ab = ABILITIES[T.ability];
      const W = WEAPON_DEFS[k];
      d.innerHTML = `<canvas></canvas><h4>${esc(D(T.name))}</h4><div class="cls">${esc(D(T.cls))} · ${esc(D(T.faction))}</div><p>${esc(D(T.desc))}</p>
        <div class="statgrid">
          <span>${t('cat.sys')}</span><span>${T.sys}</span>
          <span>${t('cat.sysHp')}</span><span>${Math.round(T.sys * SYS_HP_MUL)}</span>
          <span>${t('cat.hull')}</span><span>${T.hull}</span>
          <span>${t('cat.fp')}</span><span>${T.firepower}</span>
          <span>${t('cat.acc')}</span><span>${T.sys * 10}</span>
          <span>${t('cat.primary')}</span><span>${esc(D(W.primary.name))}</span>
          <span>${t('cat.special')}</span><span>${W.special ? esc(t('cat.specialVal', { name: D(W.special.name), m: W.special.mult, cd: W.special.cd })) : '—'}</span>
          <span>${t('cat.ability')}</span><span>${esc(D(ab.name))}</span>
          <span>${t('cat.repair')}</span><span>${REGEN[k] ? t('cat.repairRegen') : T.cls === 'vadász' ? t('cat.repairNone') : (rs => esc(t('cat.repairManualStats', { s: Math.round(rs.sys * 100), h: Math.round(rs.hull * 100), cd: rs.cd })))(REPAIR_BY_FACTION[T.faction] || REPAIR_DEFAULT)}</span>
          <span>${t('cat.points')}</span><span>${T.points} / ${T.noCapture ? '—' : Math.round(T.points * SCORE.captureMult)}</span>
          ${T.price && PLAYER_BUYABLE.includes(k) ? `<span>${t('cat.price')}</span><span class="cost">${T.price} ¢</span>` : ''}
        </div>`;
      box.appendChild(d);
      requestAnimationFrame(() => R.renderPreview(d.querySelector('canvas'), k));
    }
  }
  function openCatalog() {
    buildCatalog();
    open('scr-catalog');
  }

  // ------------------------------------------------------------ súgó
  function buildHelp() {
    $('#help').innerHTML = helpHtml({ esc, MAX_FLEET, ABILITIES, SHIP_TYPES, SCORE });
  }
  function openHelp() {
    buildHelp();
    open('scr-help');
  }

  // ------------------------------------------------------------ beállítások, nyelv
  function applySettings() {
    SFX.setVolume(settings.volume);
    SFX.setMusic(settings.music);
    R.setSpeed(settings.fast ? 2 : 1);
    R.setShake(settings.shake);
  }
  function markLang() {
    document.querySelectorAll('#set-lang [data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === I18N.lang));
  }
  function openSettings() {
    $('#set-vol').value = settings.volume;
    $('#set-music').checked = settings.music;
    $('#set-fast').checked = settings.fast;
    $('#set-shake').checked = settings.shake;
    markLang();
    open('scr-settings');
  }
  function bindSettings() {
    const save = () => { Storage.saveSettings(settings); applySettings(); };
    $('#set-vol').oninput = e => { settings.volume = +e.target.value; save(); };
    $('#set-vol').onchange = () => SFX.play('laser');
    $('#set-music').onchange = e => { settings.music = e.target.checked; save(); };
    $('#set-fast').onchange = e => { settings.fast = e.target.checked; save(); };
    $('#set-shake').onchange = e => { settings.shake = e.target.checked; save(); };
    document.querySelectorAll('#set-lang [data-lang]').forEach(b => b.onclick = () => setLang(b.dataset.lang));
  }

  // Nyelvváltás: minden nyitott képernyő azonnal újrarajzolódik
  function setLang(l) {
    if (l === I18N.lang) return;
    I18N.lang = l;
    settings.lang = l;
    Storage.saveSettings(settings);
    SFX.play('select');
    applyStaticI18n();
    markLang();
    if (isOpen('scr-menu')) buildMenu();
    if (isOpen('scr-new')) buildDiffs();
    if (isOpen('scr-slots')) openSlots(slotsMode);
    if (isOpen('scr-scores')) buildScores(lastRank);
    if (isOpen('scr-catalog')) buildCatalog();
    if (isOpen('scr-help')) buildHelp();
    if (isOpen('scr-pause')) buildPause();
    if (isOpen('scr-shop')) showShop(lastShopInfo);
    if (isOpen('scr-over') && lastOver) showGameOver(lastOver);
    update();
  }

  // ------------------------------------------------------------ szünet
  function buildPause() {
    const nav = $('#pause-btns');
    nav.innerHTML = '';
    const items = [
      [t('pause.resume'), () => close('scr-pause'), 'primary'],
      [t('pause.save'), () => { if (Game.busy) { toast(t('pause.busy')); return; } openSlots('save'); }],
      [t('pause.load'), () => openSlots('load')],
      [t('menu.help'), () => openHelp()],
      [t('menu.settings'), () => openSettings()],
      [t('pause.toMenu'), () => confirm(t('pause.toMenu'), t('toMenu.text'), () => { Game.autosave(); showMenu(); }), 'danger'],
    ];
    for (const [label, fn, cls] of items) {
      const b = document.createElement('button');
      b.className = 'btn ' + (cls || '');
      b.textContent = label;
      b.onclick = fn;
      nav.appendChild(b);
    }
  }
  function openPause() {
    const S = Game.state;
    if (!S || S.phase === 'over' || stack.length) return;
    buildPause();
    open('scr-pause');
  }

  // ------------------------------------------------------------ megerősítés
  function confirm(title, text, yes) {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-yes').onclick = () => { close('scr-confirm'); yes(); };
    $('#confirm-no').onclick = () => close('scr-confirm');
    open('scr-confirm');
  }

  // ------------------------------------------------------------ napló, toast, banner
  function log(text, cls = '') {
    const box = $('#log-lines');
    const d = document.createElement('div');
    d.className = 'log-line ' + cls;
    d.textContent = text;
    box.appendChild(d);
    while (box.children.length > 40) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  function toggleLog() {
    const l = $('#log');
    l.classList.toggle('collapsed');
    const box = $('#log-lines');
    box.scrollTop = box.scrollHeight;
    SFX.play('click');
  }

  function toast(text) {
    const tt = $('#toast');
    tt.textContent = text;
    tt.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => tt.classList.remove('show'), 2600);
  }

  function banner(main, sub, boss) {
    const b = $('#banner');
    b.className = boss ? 'boss' : '';
    b.innerHTML = `<div class="b-main">${esc(main)}</div><div class="b-sub">${esc(sub)}</div>`;
    requestAnimationFrame(() => b.classList.add('show'));
    setTimeout(() => b.classList.remove('show'), 2200 / R.speed);
  }

  function hint(text) {
    const h = $('#hint');
    h.textContent = text;
    h.classList.toggle('hidden', !text);
  }

  // ------------------------------------------------------------ HUD frissítés
  function barClass(r) { return r <= 0 ? 'low zero' : r < 0.3 ? 'low' : r < 0.6 ? 'mid' : ''; }

  function shipBars(s) {
    const rows = [[D('Test'), s.hull, s.maxHull, 'hull']].concat(SYS_KEYS.map(k => [D(SUB_BY_KEY[k].label), s.sys[k], s.maxSys[k], 'sys']));
    return `<div class="bars">${rows.map(([l, v, m, tp]) => {
      const r = m ? v / m : 0;
      return `<span class="bl">${esc(l)}</span><div class="bar ${tp === 'hull' ? 'hull ' : ''}${barClass(r)}"><i style="width:${Math.max(0, r * 100)}%"></i></div><span class="bv">${Math.round(v)}/${m}</span>`;
    }).join('')}</div>`;
  }

  function chips(list, selId, side) {
    return `<div class="chips">${list.map(s => {
      const cls = ['chip'];
      if (s.id === selId) cls.push('sel');
      if (side === 'player' && (s.acted || !Game.canTakeAction(s))) cls.push('done');
      if (s.side === 'enemy' && Game.capturable(s)) cls.push('dis');
      if (s.side === 'ally') cls.push('allyc');
      const mark = side === 'player' ? (Game.canTakeAction(s) && !s.acted ? '✓ ' : '') : s.side === 'ally' ? '★ ' : Game.isDisabled(s) ? '⛓ ' : '';
      return `<button class="${cls.join(' ')}" data-sel="${s.id}" title="${esc(NM(s.name))}">${mark}${esc(NM(s.name))}</button>`;
    }).join('')}</div>`;
  }

  function update() {
    const S = Game.state;
    if (!S) return;
    const st = S.station;
    $('#ht-wave').textContent = S.wave;
    $('#ht-round').textContent = S.round;
    $('#ht-score').textContent = fmt(S.score);
    $('#ht-credits').textContent = fmt(S.credits) + ' ¢';
    $('#ht-shield').style.width = (st.shield / st.maxShield * 100) + '%';
    $('#ht-shield-t').textContent = t('hud.shield', { a: fmt(st.shield), b: fmt(st.maxShield) });
    const hr = st.hull / st.maxHull;
    $('#ht-hull').style.width = (hr * 100) + '%';
    $('#ht-hull').classList.toggle('low', hr < 0.25);
    $('#ht-hull-t').textContent = t('hud.hull', { a: fmt(st.hull), b: fmt(st.maxHull) });

    const a = Game.byId(S.selPlayer);
    const tg = Game.byId(S.selEnemy);
    const ready = S.player.filter(s => Game.canTakeAction(s) && !s.acted).length;

    // saját kártya
    const own = $('#card-own');
    if (!S.player.length) own.innerHTML = `<div class="card-kicker"><span>${t('own.title')}</span></div><div class="empty">${esc(t('own.none'))}</div>`;
    else if (a && a.side === 'player') {
      const T = SHIP_TYPES[a.type];
      const ok = Game.canTakeAction(a) && !a.acted;
      own.innerHTML = `<div class="card-kicker"><span>${t('own.title')} · ${S.player.length}/${Game.fleetCap()}</span><span>${esc(t('own.ready', { n: ready }))}</span></div>
        ${chips(S.player, a.id, 'player')}
        <div class="card-head"><button class="arrow" data-cycle="player:-1" title="${esc(t('prev', { k: 'Q' }))}">◀</button>
        <span class="tick ${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</span>
        <div class="card-title"><div class="card-name">${esc(NM(a.name))}</div><div class="card-sub">${esc(D(T.name))} · ${esc(D(T.cls))} · ${'★'.repeat(a.level)}</div></div>
        <button class="arrow" data-cycle="player:1" title="${esc(t('next', { k: 'E' }))}">▶</button></div>
        ${shipBars(a)}
        <div class="card-foot"><span>${t('card.fp')} <b>${Math.round(Game.expectedDamage(a))}</b></span><span>${esc(D(ABILITIES[T.ability].name))}: <b>${a.cd ? esc(t('card.turns', { n: a.cd })) : t('card.ready')}</b></span>
        ${Game.isDisabled(a) ? `<span class="badge red">${t('badge.disabled')}</span>` : a.acted ? `<span class="badge">${t('badge.acted')}</span>` : ''}${Game.hasRegen(a) ? `<span class="badge green">${t('badge.regen')}</span>` : ''}</div>`;
    }

    // ellenséges kártya
    const foe = $('#card-foe');
    foe.classList.toggle('ally', !!(tg && tg.side === 'ally'));
    const hcount = S.enemies.filter(s => s.side === 'enemy').length;
    if (!S.enemies.length) foe.innerHTML = `<div class="card-kicker"><span>${t('foe.title')}</span></div><div class="empty">${esc(S.phase === 'battle' ? t('foe.none') : t('foe.clear'))}</div>`;
    else if (tg) {
      const T = SHIP_TYPES[tg.type];
      const cap = Game.capturable(tg);
      const badge = tg.side === 'ally' ? `<span class="badge green">${t('badge.ally')}</span>` : cap ? `<span class="badge">${t('badge.capt')}</span>` : Game.isDisabled(tg) ? `<span class="badge red">${t('badge.disabled')}</span>` : tg.acted ? `<span class="badge red">${t('badge.acted')}</span>` : '';
      foe.innerHTML = `<div class="card-kicker"><span>${t('foe.title')} · ${esc(t('foe.count', { n: hcount }))}</span><span>${badge}</span></div>
        ${chips(S.enemies, tg.id, 'enemy')}
        <div class="card-head"><button class="arrow" data-cycle="enemy:-1" title="${esc(t('prev', { k: 'A' }))}">◀</button>
        <div class="card-title"><div class="card-name">${esc(NM(tg.name))}</div><div class="card-sub">${esc(D(T.name))} · ${esc(D(T.faction))}</div></div>
        <button class="arrow" data-cycle="enemy:1" title="${esc(t('next', { k: 'D' }))}">▶</button></div>
        ${shipBars(tg)}
        <div class="card-foot"><span>${t('card.fp')} <b>${Math.round(Game.expectedDamage(tg))}</b></span><span>${t('card.ability')}: <b>${esc(D(ABILITIES[T.ability].name))}</b>${tg.cd ? ` (${tg.cd})` : ''}</span></div>`;
    }

    // akciók
    const canAtk = Game.canPlayerAttack();
    const subBox = $('#sub-btns');
    const wdefs = a && a.side === 'player' ? WEAPON_DEFS[a.type] || {} : {};
    const canFix = !!(a && a.side === 'player' && !a.acted && !Game.busy && S.phase === 'battle' && Game.canManualRepair(a));
    if (weapon === 'special' && !(a && Game.specialReady(a) && canAtk)) weapon = 'primary';
    if (weapon === 'repair' && !canFix) weapon = 'primary';
    // ha a hajó nem tud lőni, de javítani igen, magától javító módba vált
    if (canFix && !Game.canAct(a)) weapon = 'repair';
    $('#actions').classList.toggle('repairing', weapon === 'repair');
    $('#actions').classList.toggle('armed', armed && canAtk);
    $('#actions').classList.toggle('special', weapon === 'special' && canAtk);
    const wbtn = (key, w, extra) => w
      ? `<button class="wbtn ${weapon === key ? 'on' : ''}" data-weapon="${key}" ${extra.dis ? 'disabled' : ''} title="${esc(D(w.desc || w.name))}">
          <i class="wsw" style="background:${w.color};box-shadow:0 0 8px ${w.color}"></i>
          <span class="wn">${esc(D(w.name))}</span><span class="wi">${extra.info}</span></button>`
      : `<button class="wbtn" disabled><span class="wn muted">${t('w.none')}</span></button>`;
    $('#weap-row').innerHTML = wbtn('primary', wdefs.primary, { info: t('w.every'), dis: !canAtk })
      + wbtn('special', wdefs.special, { info: wdefs.special ? (a.wcd > 0 ? esc(t('w.inTurns', { n: a.wcd })) : `<kbd>G</kbd> ${esc(t('w.ready', { m: wdefs.special.mult }))}`) : '', dis: !canAtk || !Game.specialReady(a) })
      + (a && a.side === 'player' && Game.hasRegen(a)
        ? `<button class="wbtn" disabled title="${esc(t('rep.regenTitle'))}"><i class="wsw" style="background:#86efac"></i><span class="wn">${t('rep.regen')}</span><span class="wi">${t('rep.passive')}</span></button>`
        : (() => {
          const rs = a && a.side === 'player' ? Game.repairStats(a) : null;
          const info = a && a.rcd > 0 ? esc(t('w.inTurns', { n: a.rcd })) : `<kbd>R</kbd> ${t('rep.instead')}`;
          const title = rs ? `${t('rep.title')} ${t('rep.stats', { s: Math.round(rs.sys * 100), h: Math.round(rs.hull * 100), cd: rs.cd, e: Math.round(Game.repairEff(a) * 100) })}` : t('rep.title');
          return `<button class="wbtn ${weapon === 'repair' ? 'on' : ''}" data-weapon="repair" ${canFix ? '' : 'disabled'} title="${esc(title)}"><i class="wsw" style="background:#86efac"></i><span class="wn">🔧 ${t('rep.btn')}</span><span class="wi">${info}</span></button>`;
        })());
    subBox.innerHTML = SUBSYSTEMS.map((sub, i) => {
      if (weapon === 'repair') {
        const cur = sub.key === 'hull' ? a.hull : a.sys[sub.key], max = sub.key === 'hull' ? a.maxHull : a.maxSys[sub.key];
        const need = Game.damaged(a, sub.key);
        const add = Math.min(max - cur, Game.repairAmount(a, sub.key));
        return `<button class="sub-btn fix" data-sub="${sub.key}" ${need ? '' : 'disabled'} title="${esc(t('rep.part', { p: D(sub.label) }))}">
          <div class="sb-top"><span>${sub.icon} ${esc(D(sub.label))}</span><span class="sb-k">${i + 1}</span></div>
          <div class="sb-stat">${Math.round(cur)}/${max}${need ? ` · +${Math.round(add)}` : ''}</div><div class="sb-chance"><i style="width:${cur / max * 100}%"></i></div></button>`;
      }
      let stat = '—', ch = 0, dis = !canAtk;
      if (a && tg && tg.side === 'enemy' && a.side === 'player') {
        ch = armed && SHIP_TYPES[a.type].ability === 'precision' ? 1 : Game.hitChance(a, tg, sub.key);
        const mult = (armed ? ({ precision: 1.25, overload: 1.8, barrage: 0.45, evade: 1 })[SHIP_TYPES[a.type].ability] : 1) * (weapon === 'special' && wdefs.special ? wdefs.special.mult : 1);
        stat = `${Math.round(ch * 100)}% · ~${Math.round(Game.expectedDamage(a, sub.key, mult))}`;
        if (sub.key !== 'hull' && tg.sys[sub.key] <= 0) { dis = true; stat = t('sub.destroyed'); }
      }
      return `<button class="sub-btn" data-sub="${sub.key}" ${dis ? 'disabled' : ''} title="${esc(t('sub.attack', { sub: D(sub.label), k: i + 1 }))}">
        <div class="sb-top"><span>${sub.icon} ${esc(D(sub.label))}</span><span class="sb-k">${i + 1}</span></div>
        <div class="sb-stat">${stat}</div><div class="sb-chance"><i style="width:${ch * 100}%"></i></div></button>`;
    }).join('');

    const abBtn = $('#btn-ability');
    if (a && a.side === 'player') {
      const ab = ABILITIES[SHIP_TYPES[a.type].ability];
      abBtn.innerHTML = `<kbd>F</kbd> ${esc(D(ab.name))} ${a.cd ? `<span class="muted">(${esc(t('card.turns', { n: a.cd }))})</span>` : ''}`;
      abBtn.title = D(ab.desc);
      abBtn.disabled = !canAtk || a.cd > 0;
    } else { abBtn.innerHTML = `<kbd>F</kbd> ${t('btn.ability')}`; abBtn.disabled = true; }
    if (abBtn.disabled) armed = false;
    abBtn.classList.toggle('on', armed);

    const capBtn = $('#btn-capture');
    const capBlocked = Game.captureBlocked(tg);
    capBtn.disabled = Game.busy || S.phase !== 'battle' || !tg || !Game.capturable(tg) || capBlocked || (tg.side === 'enemy' && !(a && Game.canAct(a) && !a.acted));
    capBtn.innerHTML = tg && tg.side === 'ally' ? `<kbd>C</kbd> ${t('btn.takeover')}` : `<kbd>C</kbd> ${t('btn.capture')}${capBlocked ? ` <span class="muted">${t('cap.nextTurn')}</span>` : tg && Game.capturable(tg) ? ` <span class="muted">${Math.round(Game.captureChance(tg) * 100)}%</span>` : ''}`;
    $('#btn-end').disabled = Game.busy || S.phase !== 'battle';

    let sub = '';
    if (Game.busy) sub = t('act.busy');
    else if (S.phase !== 'battle') sub = '';
    else if (weapon === 'repair') sub = t('rep.pick', { name: NM(a.name) }) + ' ' + t('rep.eff', { e: Math.round(Game.repairEff(a) * 100) });
    else if (weapon === 'special') sub = t('act.pick', { name: D(wdefs.special.name) });
    else if (armed) sub = t('act.pick', { name: D(ABILITIES[SHIP_TYPES[a.type].ability].name) });
    else if (tg && tg.side === 'ally') sub = t('act.ally');
    else if (a && tg) sub = `${NM(a.name)} → ${NM(tg.name)}`;
    $('#act-sub').textContent = sub;
    requestAnimationFrame(measure);
  }

  function toggleArm() {
    const S = Game.state;
    if (!S || !Game.canPlayerAttack()) { SFX.play('error'); return; }
    const a = Game.byId(S.selPlayer);
    if (a.cd > 0) { SFX.play('error'); toast(t('ab.charging')); return; }
    if (SHIP_TYPES[a.type].ability === 'barrage') { armed = false; Game.playerAttack('hull', true); return; }
    armed = !armed;
    if (armed) weapon = 'primary';
    SFX.play('select');
    update();
  }

  function attack(subKey) {
    if (weapon === 'repair') { weapon = 'primary'; armed = false; Game.playerRepair(subKey); return; }
    const useAb = armed, useSpec = weapon === 'special';
    armed = false; weapon = 'primary';
    Game.playerAttack(subKey, useAb, useSpec);
  }

  function setWeapon(w) {
    const S = Game.state;
    const a = S && Game.byId(S.selPlayer);
    if (w === 'repair') {
      if (!(a && a.side === 'player' && !a.acted && Game.canManualRepair(a))) { SFX.play('error'); return; }
      weapon = weapon === 'repair' ? 'primary' : 'repair';
      armed = false; SFX.play('select'); update(); return;
    }
    if (w === 'special' && !(a && Game.canPlayerAttack() && Game.specialReady(a))) {
      SFX.play('error');
      const sp = a && WEAPON_DEFS[a.type] && WEAPON_DEFS[a.type].special;
      if (sp && a.wcd > 0) toast(t('w.charging', { name: D(sp.name), n: a.wcd }));
      return;
    }
    weapon = w;
    if (w === 'special') armed = false;
    SFX.play('select');
    update();
  }
  const toggleWeapon = () => setWeapon(weapon === 'special' ? 'primary' : 'special');

  // ------------------------------------------------------------ bolt
  function showShop(info) {
    const S = Game.state;
    if (!S) return;
    lastShopInfo = info;
    hint('');
    const box = $('#shop');
    const pips = (lvl, max) => `<div class="lvl-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>`;
    const mini = s => `<div class="mini">${[[D('TEST'), s.hull, s.maxHull, true], ...SYS_KEYS.map(k => [D(SUB_BY_KEY[k].short), s.sys[k], s.maxSys[k], false])].map(([l, v, m, h]) => `<span>${l}</span><div class="bar ${h ? 'hull ' : ''}${barClass(v / m)}"><i style="width:${v / m * 100}%"></i></div>`).join('')}</div>`;
    const st = S.station;
    box.innerHTML = `
      <div class="shop-head">
        <div><h2>${esc(info && info.merchant ? t('shop.merchant') : info && !info.resumed ? t('shop.cleared', { n: info.wave }) : t('shop.title'))}</h2>
        <div class="summary">${info && info.merchant ? esc(t('shop.merchantSum', { c: fmt(info.merchant.credits), h: fmt(info.merchant.hull) })) : `${info && info.bonus ? esc(t('shop.bonus', { p: fmt(info.bonus), c: fmt(info.credBonus) })) : ''}${esc(t('shop.autorep'))}`}${info && info.gift ? ` <b style="color:var(--green)">${esc(t('shop.gift', { name: NM(info.gift.name) }))}</b>` : ''}</div></div>
        <div class="credits-big"><small>${t('shop.credits')}</small>${fmt(S.credits)} ¢</div>
      </div>
      <h3>${esc(t('shop.fleet', { a: S.player.length, b: Game.fleetCap() }))}</h3>
      <div class="shop-grid">${S.player.map(s => {
        const T = SHIP_TYPES[s.type];
        const rc = Game.repairCost(s, false), fc = Game.repairCost(s, true), uc = Game.upgradeCost(s);
        return `<div class="sship"><canvas data-prev="${s.type}"></canvas>
          <div><div class="nm">${esc(NM(s.name))}</div><div class="muted" style="font-size:12px">${esc(D(T.name))} · <span class="lv">${'★'.repeat(s.level)}${'☆'.repeat(MAX_SHIP_LEVEL - s.level)}</span></div></div>
          ${mini(s)}
          <div class="btns">
            <button class="btn small" data-shop="repair:${s.id}" ${rc <= 0 || rc > S.credits ? 'disabled' : ''}>${rc <= 0 ? t('shop.intact') : `${t('shop.rep50')} <span class="cost">${rc}¢</span>`}</button>
            <button class="btn small" data-shop="full:${s.id}" ${fc <= 0 || fc > S.credits ? 'disabled' : ''}>${fc <= 0 ? t('shop.fullIntact') : `${t('shop.full')} <span class="cost">${fc}¢</span>`}</button>
            <button class="btn small" data-shop="up:${s.id}" ${s.level >= MAX_SHIP_LEVEL || uc > S.credits ? 'disabled' : ''} title="${esc(t('shop.upTitle'))}">${s.level >= MAX_SHIP_LEVEL ? t('shop.max') : `${t('shop.up')} <span class="cost">${uc}¢</span>`}</button>
            <button class="btn small ghost danger" data-shop="scrap:${s.id}" ${S.player.length <= 1 ? 'disabled' : ''} title="${esc(t('shop.scrapTitle'))}">${t('shop.scrap')} <span class="cost">+${Game.scrapValue(s)}¢</span></button>
          </div></div>`;
      }).join('')}</div>
      <h3>${t('shop.station')} <span class="ls-info">${esc(Game.lastStandIn() > 0 ? t('shop.lsWait', { n: Game.lastStandIn() }) : t('shop.lsReady'))}</span></h3>
      <div class="st-grid">${STATION_UPGRADES.map(u => {
        const cost = u.cost(st);
        const maxed = u.max && u.lvl(st) >= u.max;
        const full = u.key === 'repair' && st.hull >= st.maxHull;
        const extra = u.key === 'repair' ? t('shop.structure', { a: fmt(st.hull), b: fmt(st.maxHull) })
          : u.key === 'shield' ? t('shop.shield', { a: fmt(st.maxShield) })
          : u.key === 'grid' ? t('shop.grid', { d: st.grid, n: 1 + (st.gridLvl >= 3) + (st.gridLvl >= 6) })
          : u.key === 'command' ? t('shop.cmd', { n: Game.fleetCap() })
          : t('shop.maxStruct', { a: fmt(st.maxHull) });
        return `<div class="st-item"><b>${esc(D(u.name))}</b><small>${esc(D(u.desc))}<br>${esc(extra)}</small>${u.max ? pips(u.lvl(st), u.max) : ''}
          <button class="btn small" data-shop="st:${u.key}" ${maxed || full || cost > S.credits ? 'disabled' : ''}>${maxed ? t('shop.maximum') : full ? t('shop.intact') : `${t('shop.buy')} <span class="cost">${cost}¢</span>`}</button></div>`;
      }).join('')}</div>
      <h3>${t('shop.yard')}</h3>
      <div class="st-grid">${PLAYER_BUYABLE.map(k => {
        const T = SHIP_TYPES[k];
        return `<div class="st-item"><canvas data-prev="${k}" style="width:100%;height:60px"></canvas><b>${esc(D(T.name))}</b><small>${esc(t('shop.yardInfo', { cls: D(T.cls), h: T.hull, f: T.firepower, ab: D(ABILITIES[T.ability].name) }))}</small>
          <button class="btn small" data-shop="buy:${k}" ${S.player.length >= Game.fleetCap() || T.price > S.credits ? 'disabled' : ''}>${t('shop.buy')} <span class="cost">${T.price}¢</span></button></div>`;
      }).join('')}</div>
      <div class="shop-foot">
        <div style="display:flex;gap:8px"><button class="btn ghost" id="shop-save">${t('shop.save')}</button><button class="btn ghost" id="shop-menu">${t('shop.menu')}</button></div>
        <button class="btn primary" id="shop-next">${esc(t('shop.next', { n: S.wave + 1 }))}</button>
      </div>`;
    box.querySelectorAll('canvas[data-prev]').forEach(c => requestAnimationFrame(() => R.renderPreview(c, c.dataset.prev)));
    box.querySelectorAll('[data-shop]').forEach(b => b.onclick = () => {
      const [act, arg] = b.dataset.shop.split(':');
      const id = +arg;
      if (act === 'repair') Game.shop.repair(id, false);
      if (act === 'full') Game.shop.repair(id, true);
      if (act === 'up') Game.shop.upgrade(id);
      if (act === 'scrap') { const s = Game.byId(id); confirm(t('scrap.title'), t('scrap.text', { name: NM(s.name), c: Game.scrapValue(s) }), () => { Game.shop.scrap(id); showShop(info); }); return; }
      if (act === 'buy') Game.shop.buy(arg);
      if (act === 'st') Game.shop.station(arg);
      const sc = box.scrollTop;
      showShop(info);
      box.scrollTop = sc;
    });
    $('#shop-save').onclick = () => openSlots('save');
    $('#shop-menu').onclick = () => confirm(t('pause.toMenu'), t('toMenu.text'), () => { Game.autosave(); showMenu(); });
    $('#shop-next').onclick = () => { close('scr-shop'); Game.startWave(); };
    if (!stack.includes('scr-shop')) open('scr-shop');
  }

  // ------------------------------------------------------------ játék vége
  function showGameOver(r) {
    lastOver = r;
    $('#cine-skip').classList.add('hidden');
    hint('');
    lastRank = r.rank;
    const acc = r.stats.shots ? Math.round(r.stats.hits / r.stats.shots * 100) : 0;
    $('#over').innerHTML = `
      <div class="over-title">${t('over.title')}</div>
      <p class="muted" style="text-align:center;margin:6px 0 0">${esc(t('over.text', { name: NM(r.name), wave: r.wave, diff: D(DIFFICULTIES[r.diff].name) }))}</p>
      <div class="over-score">${fmt(r.score)}</div>
      <div class="over-rank">${esc(r.rank ? t('over.rank', { n: r.rank }) + (r.rank === 1 ? t('over.record') : '') : t('over.norank'))}</div>
      <div class="over-stats">
        <div><b>${r.stats.destroyed}</b><small>${t('over.destroyed')}</small></div>
        <div><b>${r.stats.captured}</b><small>${t('over.captured')}</small></div>
        <div><b>${Math.max(0, r.wave - 1)}</b><small>${t('over.waves')}</small></div>
        <div><b>${acc}%</b><small>${t('over.acc')}</small></div>
        <div><b>${fmt(r.stats.dmgDealt)}</b><small>${t('over.dmg')}</small></div>
        <div><b>${r.stats.lost}</b><small>${t('over.lost')}</small></div>
      </div>
      <div class="panel-btns">
        <button class="btn ghost" id="ov-menu">${t('shop.menu')}</button>
        <button class="btn" id="ov-scores">${t('menu.scores')}</button>
        <button class="btn primary" id="ov-new">${t('menu.new')}</button>
      </div>`;
    $('#ov-menu').onclick = () => showMenu();
    $('#ov-scores').onclick = () => openScores(lastRank);
    $('#ov-new').onclick = () => { showMenu(); openNew(); };
    setHud(false);
    if (!stack.includes('scr-over')) open('scr-over');
  }

  // ------------------------------------------------------------ eseménykötések
  function bind() {
    I18N.lang = settings.lang || I18N.lang;
    applyStaticI18n();
    document.addEventListener('click', e => {
      const bk = e.target.closest('[data-back]');
      if (bk) { back(); return; }
      const c = e.target.closest('[data-cycle]');
      if (c) { const [l, d] = c.dataset.cycle.split(':'); armed = false; Game.cycle(l, +d); return; }
      const s = e.target.closest('[data-sel]');
      if (s) { armed = false; Game.select(Game.byId(+s.dataset.sel)); return; }
      const wb = e.target.closest('[data-weapon]');
      if (wb && !wb.disabled) { setWeapon(wb.dataset.weapon); return; }
      const sb = e.target.closest('.sub-btn');
      if (sb && !sb.disabled) { attack(sb.dataset.sub); }
    });
    $('#btn-ability').onclick = toggleArm;
    $('#btn-capture').onclick = () => Game.capture();
    $('#btn-end').onclick = () => { armed = false; Game.passRound(); };
    $('#btn-pause').onclick = openPause;
    $('#log-toggle').onclick = toggleLog;
    $('#btn-start').onclick = startNew;
    $('#in-name').addEventListener('keydown', e => { if (e.key === 'Enter') startNew(); });
    $('#btn-clear-scores').onclick = () => confirm(t('scores.clear'), t('scores.clearText'), () => { Storage.clearScores(); close('scr-scores'); openScores(); });
    $('#cine-skip').onclick = () => R.skipCinematic();
    $('#rotate-ok').onclick = () => { $('#rotate-hint').classList.add('dismissed'); try { sessionStorage.setItem('b5dts_rot', '1'); } catch (e) { /* nincs tároló */ } };
    try { if (sessionStorage.getItem('b5dts_rot')) $('#rotate-hint').classList.add('dismissed'); } catch (e) { /* nincs tároló */ }
    bindSettings();
    new ResizeObserver(measure).observe($('#hud-bottom'));
    new ResizeObserver(measure).observe($('#hud-top'));
  }

  // Játék → UI kapcsolódási pontok
  Game.hooks.update = update;
  Game.hooks.log = log;
  Game.hooks.toast = toast;
  Game.hooks.hint = hint;
  Game.hooks.shop = showShop;
  Game.hooks.gameOver = showGameOver;
  Game.hooks.waveStart = (n, boss, custom) => {
    if (custom) banner(custom.main, custom.sub, !!custom.boss);
    else banner(t('banner.wave', { n }), boss ? t('banner.shadow') : t('banner.jump'), boss);
  };

  return {
    bind, showMenu, update, toggleLog, open, close, back, top, openPause, toggleArm, attack, applySettings, toast, measure, setLang,
    get stackSize() { return stack.length; },
    get settings() { return settings; },
    disarm() { armed = false; weapon = 'primary'; },
    toggleWeapon,
    toggleRepair: () => setWeapon('repair'),
  };
})();
