'use strict';
// ---------------------------------------------------------------------------
// Nyelvek: magyar (hu) és angol (en).
//   t(kulcs, paraméterek) – a felület szövegei
//   D(magyar szöveg)      – adatszövegek (hajók, fegyverek, képességek…) fordítása
//   NM(hajónév)           – hajók saját nevének fordítása (sorszámmal együtt)
// ---------------------------------------------------------------------------

const STRINGS = {
  hu: {
    'menu.continue': 'Folytatás', 'menu.contSub': '{name} · {wave}. hullám', 'menu.new': 'Új játék', 'menu.load': 'Betöltés',
    'menu.scores': 'Ranglista', 'menu.catalog': 'Hajókatalógus', 'menu.help': 'Súgó', 'menu.settings': 'Beállítások', 'menu.quit': 'Kilépés', 'menu.fullscreen': 'Teljes képernyő', 'rotate.hint': 'Fordítsd fekvő helyzetbe a telefont a kényelmesebb játékhoz.',
    'logo.sub': '„Az utolsó, legjobb reményünk a békére.”',
    'foot.1': 'Eredeti egyetemi projekt: Tóth Gábor András (C#, x86) · Modern kiadás: HTML5 Canvas, offline is fut',
    'foot.2': 'Nem kereskedelmi rajongói projekt. A Babylon 5 a Warner Bros. védjegye.',
    'quit.title': 'Kilépés', 'quit.text': 'Biztosan kilépsz a játékból? (Az automatikus mentés megmarad.)',
    'quit.blocked': 'A böngésző nem engedte bezárni az ablakot – nyugodtan bezárhatod a lapot.',
    'new.title': 'Új játék', 'new.name': 'Parancsnok neve', 'new.diff': 'Nehézségi szint', 'new.mult': 'Pontszorzó ×{m}', 'new.start': 'Indulás ▶',
    'defaultName': 'Sheridan kapitány', 'btn.back': 'Vissza', 'btn.ok': 'Értem',
    'loaded': 'Mentés betöltve: {name}, {wave}. hullám.',
    'slots.save': 'Mentés', 'slots.load': 'Betöltés', 'slot.auto': 'Automatikus mentés', 'slot.n': '{n}. mentési hely',
    'slot.info': '{name} · {diff} · {wave}. hullám · {score} pont', 'slot.empty': 'Üres', 'slot.saveHere': 'Mentés ide', 'slot.saved': 'Játék elmentve.',
    'slot.overTitle': 'Felülírás', 'slot.overText': 'Ezen a helyen már van mentés. Felülírod?', 'slot.loadBtn': 'Betöltés',
    'slot.loadTitle': 'Betöltés', 'slot.loadText': 'A jelenlegi, nem mentett állás elveszik. Folytatod?',
    'slot.del': 'Törlés', 'slot.delTitle': 'Mentés törlése', 'slot.delText': 'Törlöd a(z) {slot} tartalmát?',
    'scores.title': 'Ranglista', 'scores.empty': 'Még nincs bejegyzés. Védd meg az állomást, és kerülj fel elsőként!',
    'scores.cmd': 'Parancsnok', 'scores.diff': 'Szint', 'scores.wave': 'Hullám', 'scores.pts': 'Pont', 'scores.date': 'Dátum',
    'scores.clear': 'Ranglista törlése', 'scores.clearText': 'Minden bejegyzés törlődik. Biztos?',
    'cat.title': 'Hajókatalógus', 'cat.sys': 'Fegyverek / szenzorok / hajtómű / reaktor', 'cat.sysHp': 'Alrendszer-integritás', 'cat.hull': 'Test',
    'cat.fp': 'Tűzerő', 'cat.acc': 'Találati pontosság', 'cat.primary': 'Elsődleges fegyver', 'cat.special': 'Különleges fegyver',
    'cat.specialVal': '{name} (×{m}, {cd} kör)', 'cat.ability': 'Képesség', 'cat.points': 'Pontérték (elpusztítva / elfoglalva)', 'cat.price': 'Ár a hajógyárban',
    'set.title': 'Beállítások', 'set.lang': 'Nyelv', 'set.vol': 'Hangerő', 'set.music': 'Háttérzene (ambient)', 'set.fast': 'Gyors animációk (2×)',
    'set.shake': 'Képernyőrázkódás', 'set.done': 'Kész',
    'pause.title': 'Szünet', 'pause.resume': 'Folytatás', 'pause.save': 'Mentés', 'pause.load': 'Betöltés', 'pause.toMenu': 'Kilépés a főmenübe',
    'pause.busy': 'Várd meg, amíg a lövésváltás véget ér.', 'toMenu.text': 'Az automatikus mentésből később folytathatod. Kilépsz?',
    'confirm.title': 'Biztos?', 'confirm.no': 'Mégse', 'confirm.yes': 'Igen',
    'hud.wave': 'Hullám', 'hud.round': 'Kör', 'hud.station': 'Babylon 5 állomás', 'hud.score': 'Pontszám', 'hud.credits': 'Kredit',
    'hud.shield': 'Pajzs {a} / {b}', 'hud.hull': 'Szerkezet {a} / {b}', 'hud.menu': 'Menü (Esc)',
    'log.toggle': 'Napló', 'log.title': 'Napló lenyitása / becsukása (L)',
    'act.title': 'Támadás célpontja', 'btn.capture': 'Elfoglalás', 'btn.takeover': 'Átvétel', 'btn.end': 'Kör vége', 'btn.ability': 'Képesség',
    'cine.skip': 'Átugrás ▶▶',
    'own.title': 'Saját flotta', 'own.none': 'Nincs hajód. Az állomás egyedül védekezik.', 'own.ready': '{n} hajó lőhet',
    'prev': 'Előző ({k})', 'next': 'Következő ({k})', 'card.fp': 'Tűzerő', 'card.turns': '{n} kör', 'card.ready': 'kész',
    'badge.disabled': 'BÉNULT', 'badge.acted': 'LŐTT', 'badge.ally': 'SZÖVETSÉGES', 'badge.capt': 'ELFOGLALHATÓ',
    'foe.title': 'Idegen flotta', 'foe.count': '{n} ellenség', 'foe.none': 'Nincs ellenség a szektorban.', 'foe.clear': 'A szektor tiszta.', 'card.ability': 'Képesség',
    'w.none': 'Nincs különleges fegyver', 'w.every': 'minden körben', 'w.inTurns': '{n} kör múlva', 'w.ready': 'kész · ×{m}',
    'w.charging': 'A(z) {name} még {n} körig töltődik.', 'ab.charging': 'A képesség még töltődik.',
    'sub.destroyed': 'kilőve', 'sub.attack': '{sub} támadása ({k})',
    'act.busy': 'Lövésváltás…', 'act.pick': '{name}: válaszd ki a célt!', 'act.ally': 'Szövetséges – vedd át az irányítását!',
    'shop.cleared': '{n}. hullám visszaverve!', 'shop.title': 'Javítás és fejlesztés', 'shop.bonus': 'Hullámbónusz: +{p} pont, +{c} kredit · ',
    'shop.autorep': 'A hajók automatikusan kijavították a sérülések egy részét.', 'shop.gift': 'A Narn Rezsim küldött egy cirkálót: {name}!',
    'shop.credits': 'Kredit', 'shop.fleet': 'Flotta ({a}/{b})', 'shop.intact': 'Ép', 'shop.rep50': 'Javítás 50%', 'shop.fullIntact': 'Teljesen ép',
    'shop.full': 'Teljes', 'shop.upTitle': '+12% tűzerő, +10% test és alrendszerek', 'shop.max': 'Max. szint', 'shop.up': 'Fejlesztés',
    'shop.scrapTitle': 'A hajó kivétele a flottából kreditért (nem semmisül meg)', 'shop.scrap': 'Leszerelés', 'shop.cmd': 'Flotta: max. {n} hajó', 'shop.station': 'Babylon 5 állomás', 'shop.lsReady': '· Utolsó esély: elérhető', 'shop.lsWait': '· Utolsó esély: {n} hullám múlva', 'shop.structure': 'Szerkezet: {a} / {b}', 'shop.shield': 'Pajzs: {a}',
    'shop.grid': 'Sebzés: {d} · {n} lövés/kör', 'shop.maxStruct': 'Max. szerkezet: {a}', 'shop.maximum': 'Maximum', 'shop.buy': 'Vásárlás',
    'shop.yard': 'Hajógyár', 'shop.yardInfo': '{cls} · test {h} · tűzerő {f} · {ab}', 'shop.save': 'Mentés', 'shop.menu': 'Főmenü',
    'shop.next': '{n}. hullám indítása ▶', 'scrap.title': 'Leszerelés', 'scrap.text': 'Leszereled és kiveszed a flottából: {name}? Kapsz érte {c} kreditet.',
    'over.title': 'AZ ÁLLOMÁS ELESETT', 'over.text': '{name} parancsnok {wave}. hullámig tartotta a frontot ({diff}).',
    'over.rank': '{n}. hely a ranglistán', 'over.record': ' – új rekord!', 'over.norank': 'Nem fért fel a ranglistára.',
    'over.destroyed': 'elpusztított hajó', 'over.captured': 'elfoglalt hajó', 'over.waves': 'visszavert hullám', 'over.acc': 'találati arány',
    'over.dmg': 'okozott sebzés', 'over.lost': 'elvesztett hajó',
    'banner.wave': '{n}. HULLÁM', 'banner.shadow': 'ÁRNY CIRKÁLÓ ÉRKEZIK', 'banner.jump': 'UGRÓPONT NYÍLIK',
    'banner.shadowFleet': 'ÁRNYÉKFLOTTA ÉRKEZIK', 'g.shadowFleet': 'FIGYELEM: Árnyékflotta! Ebben a hullámban csak Árny hajók (cirkálók és felderítők) támadnak.', 'banner.merchant': 'KERESKEDŐ KONVOJ', 'banner.merchantSub': 'BÉKÉS LÁTOGATÓK – NINCS HARC', 'g.merchantArr': '{n} kereskedő hajó érkezett a kék ugróponton. Kereskednek és javítanak, harc nélkül.', 'g.merchantTrade': 'Kereskedés: +{c} kredit. A hajók 50%-ot, az állomás {h} szerkezeti pontot javult, a pajzs feltöltve.', 'g.merchantLeft': 'A kereskedők továbbálltak.', 'f.repair': '+{n} JAVÍTÁS', 'shop.merchant': 'Kereskedő konvoj', 'shop.merchantSum': 'A kereskedők +{c} kreditet hoztak, a hajóidat 50%-ban, az állomást +{h} ponttal javították. ', 'g.plusCredits': '+{c} kredit.', 'banner.last': 'UTOLSÓ ESÉLY', 'banner.lastSub': 'ERŐSÍTÉS: {t}',
    // játékesemények
    'g.station': 'Babylon 5', 'f.miss': 'MELLÉ', 'f.crit': 'KRIT! ', 'g.miss': '{a} lövése célt tévesztett.',
    'g.hitStation': '{a} eltalálta az állomást: {d} sebzés{s}.', 'g.shieldPart': ' (pajzs: {n})',
    'g.hit': '{a} → {t}{w}: {d} sebzés{c}{x}.', 'g.crit': ' – KRITIKUS!', 'g.extra': ', {s} is sérült',
    'g.disabled': '{t} működésképtelenné vált!', 'g.capturable': ' Elfoglalható.', 'f.capturable': 'ELFOGLALHATÓ!', 'f.disabled': 'BÉNULT',
    'g.lost': '{n} megsemmisült!', 'f.points': '+{p} pont', 'g.killed': '{n} megsemmisítve! +{p} pont, +{c} kredit.',
    'g.overload': '{a} reaktora megsínylette a túlterhelést.', 'g.barrage': 'Sortűz: {h}/5 találat, összesen {d} sebzés a(z) {t} hajón.',
    't.fleetFull': 'A flotta megtelt (max. {n} hajó). Az Irányító központ fejlesztésével bővítheted.', 'g.joined': '{n} csatlakozott a flottához!', 'f.joined': 'CSATLAKOZOTT',
    't.needShip': 'Az elfoglaláshoz egy még cselekvőképes saját hajó kell.', 'f.capturing': 'ELFOGLALÁS…', 'f.capFail': 'AZ ELFOGLALÁS KUDARCOT VALLOTT',
    'g.capFail': '{a} nem tudta elfoglalni: {t} – a legénység visszaverte a rohamot.', 'f.captured': 'ELFOGLALVA! +{p}',
    'g.captured': '{a} elfoglalta: {t}! +{p} pont.', 't.capRetry': 'Ezt a hajót ebben a körben már megpróbáltad elfoglalni – a következő körben újra próbálkozhatsz.', 'cap.nextTurn': '(következő körben)', 'hint.enemy': 'Az ellenség lép…', 't.alone': 'Nincs harcképes hajód – az állomás egyedül védekezik!',
    'ls.whitestars': '{n} Fehércsillag', 'ls.sharlin': 'Minbari Sharlin hadicirkáló', 'ls.agam': 'EAS Agamemnon',
    'g.reinf': 'Vészjelzés fogadva! Erősítés érkezik: {t}.', 'g.round': '— {n}. kör —',
    'g.wave': '{w}. hullám: {n} ellenséges hajó érkezett az ugrópontból.', 'g.shadow': 'FIGYELEM: Árny cirkáló a szektorban!',
    'g.allyArr': 'Szövetséges hajó érkezett: {n} ({t}). Átveheted az irányítását – addig önállóan harcol.', 'g.waveDone': '{w}. hullám visszaverve! +{p} pont, +{c} kredit.',
    'g.left': '{n} továbbállt.', 't.noCredits': 'Nincs elég kredit.', 't.scrapped': '{n} leszerelve: +{c} kredit.', 't.fleetFull2': 'A flotta megtelt.',
    'r.allyTake': 'SZÖVETSÉGES – ÁTVEHETŐ', 'r.capt': '⛓ ELFOGLALHATÓ', 'r.evade': 'KITÉRÉS',
  },
  en: {
    'menu.continue': 'Continue', 'menu.contSub': '{name} · wave {wave}', 'menu.new': 'New game', 'menu.load': 'Load game',
    'menu.scores': 'Leaderboard', 'menu.catalog': 'Ship catalogue', 'menu.help': 'Help', 'menu.settings': 'Settings', 'menu.quit': 'Quit', 'menu.fullscreen': 'Fullscreen', 'rotate.hint': 'Turn your phone to landscape for a better experience.',
    'logo.sub': '"Our last, best hope for peace."',
    'foot.1': 'Original university project: Gábor András Tóth (C#, x86) · Modern edition: HTML5 Canvas, runs offline',
    'foot.2': 'Non-commercial fan project. Babylon 5 is a trademark of Warner Bros.',
    'quit.title': 'Quit', 'quit.text': 'Do you really want to quit? (Your autosave is kept.)',
    'quit.blocked': "The browser didn't allow closing the window – you can simply close the tab.",
    'new.title': 'New game', 'new.name': 'Commander name', 'new.diff': 'Difficulty', 'new.mult': 'Score multiplier ×{m}', 'new.start': 'Launch ▶',
    'defaultName': 'Captain Sheridan', 'btn.back': 'Back', 'btn.ok': 'Got it',
    'loaded': 'Save loaded: {name}, wave {wave}.',
    'slots.save': 'Save game', 'slots.load': 'Load game', 'slot.auto': 'Autosave', 'slot.n': 'Slot {n}',
    'slot.info': '{name} · {diff} · wave {wave} · {score} pts', 'slot.empty': 'Empty', 'slot.saveHere': 'Save here', 'slot.saved': 'Game saved.',
    'slot.overTitle': 'Overwrite', 'slot.overText': 'This slot already has a save. Overwrite it?', 'slot.loadBtn': 'Load',
    'slot.loadTitle': 'Load game', 'slot.loadText': 'Your current unsaved progress will be lost. Continue?',
    'slot.del': 'Delete', 'slot.delTitle': 'Delete save', 'slot.delText': 'Delete {slot}?',
    'scores.title': 'Leaderboard', 'scores.empty': 'No entries yet. Defend the station and be the first!',
    'scores.cmd': 'Commander', 'scores.diff': 'Difficulty', 'scores.wave': 'Wave', 'scores.pts': 'Score', 'scores.date': 'Date',
    'scores.clear': 'Clear leaderboard', 'scores.clearText': 'All entries will be deleted. Are you sure?',
    'cat.title': 'Ship catalogue', 'cat.sys': 'Weapons / sensors / engines / reactor', 'cat.sysHp': 'Subsystem integrity', 'cat.hull': 'Hull',
    'cat.fp': 'Firepower', 'cat.acc': 'Accuracy', 'cat.primary': 'Primary weapon', 'cat.special': 'Special weapon',
    'cat.specialVal': '{name} (×{m}, {cd} turns)', 'cat.ability': 'Ability', 'cat.points': 'Points (destroyed / captured)', 'cat.price': 'Shipyard price',
    'set.title': 'Settings', 'set.lang': 'Language', 'set.vol': 'Volume', 'set.music': 'Background music (ambient)', 'set.fast': 'Fast animations (2×)',
    'set.shake': 'Screen shake', 'set.done': 'Done',
    'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.save': 'Save game', 'pause.load': 'Load game', 'pause.toMenu': 'Quit to main menu',
    'pause.busy': 'Wait until the exchange of fire is over.', 'toMenu.text': 'You can continue later from the autosave. Quit?',
    'confirm.title': 'Are you sure?', 'confirm.no': 'Cancel', 'confirm.yes': 'Yes',
    'hud.wave': 'Wave', 'hud.round': 'Turn', 'hud.station': 'Babylon 5 station', 'hud.score': 'Score', 'hud.credits': 'Credits',
    'hud.shield': 'Shields {a} / {b}', 'hud.hull': 'Structure {a} / {b}', 'hud.menu': 'Menu (Esc)',
    'log.toggle': 'Log', 'log.title': 'Expand / collapse the log (L)',
    'act.title': 'Target', 'btn.capture': 'Capture', 'btn.takeover': 'Take command', 'btn.end': 'End turn', 'btn.ability': 'Ability',
    'cine.skip': 'Skip ▶▶',
    'own.title': 'Your fleet', 'own.none': 'No ships left. The station defends itself alone.', 'own.ready': '{n} ready to fire',
    'prev': 'Previous ({k})', 'next': 'Next ({k})', 'card.fp': 'Firepower', 'card.turns': '{n} turns', 'card.ready': 'ready',
    'badge.disabled': 'DISABLED', 'badge.acted': 'FIRED', 'badge.ally': 'ALLY', 'badge.capt': 'CAPTURABLE',
    'foe.title': 'Alien fleet', 'foe.count': '{n} hostile', 'foe.none': 'No enemies in the sector.', 'foe.clear': 'Sector clear.', 'card.ability': 'Ability',
    'w.none': 'No special weapon', 'w.every': 'every turn', 'w.inTurns': 'ready in {n}', 'w.ready': 'ready · ×{m}',
    'w.charging': '{name} recharges for {n} more turn(s).', 'ab.charging': 'The ability is still recharging.',
    'sub.destroyed': 'destroyed', 'sub.attack': 'Attack {sub} ({k})',
    'act.busy': 'Exchange of fire…', 'act.pick': '{name}: choose the target!', 'act.ally': 'Ally – take command of it!',
    'shop.cleared': 'Wave {n} repelled!', 'shop.title': 'Repairs & upgrades', 'shop.bonus': 'Wave bonus: +{p} points, +{c} credits · ',
    'shop.autorep': 'Your ships automatically repaired part of their damage.', 'shop.gift': 'The Narn Regime sent you a cruiser: {name}!',
    'shop.credits': 'Credits', 'shop.fleet': 'Fleet ({a}/{b})', 'shop.intact': 'Intact', 'shop.rep50': 'Repair 50%', 'shop.fullIntact': 'Fully intact',
    'shop.full': 'Full', 'shop.upTitle': '+12% firepower, +10% hull and subsystems', 'shop.max': 'Max level', 'shop.up': 'Upgrade',
    'shop.scrapTitle': 'Remove the ship from your fleet for credits (it is not destroyed)', 'shop.scrap': 'Decommission', 'shop.cmd': 'Fleet: max. {n} ships', 'shop.station': 'Babylon 5 station', 'shop.lsReady': '· Last chance: available', 'shop.lsWait': '· Last chance: in {n} waves', 'shop.structure': 'Structure: {a} / {b}', 'shop.shield': 'Shields: {a}',
    'shop.grid': 'Damage: {d} · {n} shots/turn', 'shop.maxStruct': 'Max structure: {a}', 'shop.maximum': 'Maxed', 'shop.buy': 'Buy',
    'shop.yard': 'Shipyard', 'shop.yardInfo': '{cls} · hull {h} · firepower {f} · {ab}', 'shop.save': 'Save', 'shop.menu': 'Main menu',
    'shop.next': 'Launch wave {n} ▶', 'scrap.title': 'Decommission', 'scrap.text': 'Decommission {name} and remove it from your fleet? You get {c} credits.',
    'over.title': 'THE STATION HAS FALLEN', 'over.text': 'Commander {name} held the line until wave {wave} ({diff}).',
    'over.rank': 'Rank {n} on the leaderboard', 'over.record': ' – new record!', 'over.norank': "Didn't make the leaderboard.",
    'over.destroyed': 'ships destroyed', 'over.captured': 'ships captured', 'over.waves': 'waves repelled', 'over.acc': 'hit rate',
    'over.dmg': 'damage dealt', 'over.lost': 'ships lost',
    'banner.wave': 'WAVE {n}', 'banner.shadow': 'SHADOW CRUISER INBOUND', 'banner.jump': 'JUMP POINT OPENING',
    'banner.shadowFleet': 'SHADOW FLEET INBOUND', 'g.shadowFleet': 'WARNING: Shadow fleet! Only Shadow ships (cruisers and scouts) attack in this wave.', 'banner.merchant': 'MERCHANT CONVOY', 'banner.merchantSub': 'PEACEFUL VISITORS – NO COMBAT', 'g.merchantArr': '{n} merchant ships arrived through the blue jump point. They trade and repair – no combat.', 'g.merchantTrade': 'Trade: +{c} credits. Ships repaired by 50%, station by {h} structure points, shields recharged.', 'g.merchantLeft': 'The merchants have moved on.', 'f.repair': '+{n} REPAIRED', 'shop.merchant': 'Merchant convoy', 'shop.merchantSum': 'The merchants brought +{c} credits, repaired your ships by 50% and the station by +{h} points. ', 'g.plusCredits': '+{c} credits.', 'banner.last': 'LAST CHANCE', 'banner.lastSub': 'REINFORCEMENTS: {t}',
    'g.station': 'Babylon 5', 'f.miss': 'MISS', 'f.crit': 'CRIT! ', 'g.miss': "{a}'s shot missed.",
    'g.hitStation': '{a} hit the station: {d} damage{s}.', 'g.shieldPart': ' (shields: {n})',
    'g.hit': '{a} → {t}{w}: {d} damage{c}{x}.', 'g.crit': ' – CRITICAL!', 'g.extra': ', {s} also damaged',
    'g.disabled': '{t} has been disabled!', 'g.capturable': ' It can be captured.', 'f.capturable': 'CAPTURABLE!', 'f.disabled': 'DISABLED',
    'g.lost': '{n} was destroyed!', 'f.points': '+{p} pts', 'g.killed': '{n} destroyed! +{p} points, +{c} credits.',
    'g.overload': "{a}'s reactor suffered from the overload.", 'g.barrage': 'Barrage: {h}/5 hits, {d} total damage on {t}.',
    't.fleetFull': 'Your fleet is full (max. {n} ships). Upgrade the Command centre to expand it.', 'g.joined': '{n} joined your fleet!', 'f.joined': 'JOINED',
    't.needShip': 'You need an operational ship of your own to capture.', 'f.capturing': 'CAPTURING…', 'f.capFail': 'CAPTURE FAILED',
    'g.capFail': '{a} failed to capture {t} – its crew repelled the assault.', 'f.captured': 'CAPTURED! +{p}',
    'g.captured': '{a} captured {t}! +{p} points.', 't.capRetry': 'You already tried to capture this ship this turn – try again next turn.', 'cap.nextTurn': '(next turn)', 'hint.enemy': 'Enemy turn…', 't.alone': 'No combat-ready ships – the station fights alone!',
    'ls.whitestars': '{n} White Stars', 'ls.sharlin': 'Minbari Sharlin warcruiser', 'ls.agam': 'EAS Agamemnon',
    'g.reinf': 'Distress call answered! Reinforcements inbound: {t}.', 'g.round': '— Turn {n} —',
    'g.wave': 'Wave {w}: {n} enemy ships emerged from the jump point.', 'g.shadow': 'WARNING: Shadow cruiser in the sector!',
    'g.allyArr': 'Allied ship arrived: {n} ({t}). Take command of it – until then it fights on its own.', 'g.waveDone': 'Wave {w} repelled! +{p} points, +{c} credits.',
    'g.left': '{n} has moved on.', 't.noCredits': 'Not enough credits.', 't.scrapped': '{n} scrapped: +{c} credits.', 't.fleetFull2': 'Your fleet is full.',
    'r.allyTake': 'ALLY – TAKE COMMAND', 'r.capt': '⛓ CAPTURABLE', 'r.evade': 'EVADING',
  },
};

// Adatszövegek angolul (kulcs = a data.js magyar szövege)
const DATA_EN = {
  // osztályok, alrendszerek
  'vadász': 'fighter', 'cirkáló': 'cruiser', 'csatahajó': 'battleship', 'ősi': 'ancient',
  'Test': 'Hull', 'Fegyverzet': 'Weapons', 'Szenzorok': 'Sensors', 'Hajtómű': 'Engines', 'Reaktor': 'Reactor',
  'TEST': 'HULL', 'FEGY': 'WPN', 'SZEN': 'SNS', 'HAJT': 'ENG', 'REAK': 'RCT',
  // hajótípusok
  'Fehércsillag': 'White Star', 'Minbari csatahajó': 'Minbari warcruiser', 'Narn cirkáló': 'Narn cruiser',
  'Centauri Primus cirkáló': 'Centauri Primus cruiser', 'Centauri Vorchan': 'Centauri Vorchan', 'Centauri Altarian romboló': 'Centauri Altarian destroyer',
  'Centauri csatahordozó': 'Centauri battle carrier', 'Hyperion nehézcirkáló': 'Hyperion heavy cruiser', 'Nova csatahajó': 'Nova dreadnought',
  'Starfury vadász': 'Starfury fighter', 'Földi Omega romboló': 'Earth Omega destroyer', 'Kalóz vadász': 'Raider fighter',
  'Drazi napsólyom': 'Drazi Sunhawk', 'Árny cirkáló': 'Shadow cruiser', 'Árny felderítő': 'Shadow scout',
  'Kisebb, fürgébb Árny hajó tüskés, sejtmintás testtel. Csak az Árnyékflotta tagjaként tűnik fel. Nem foglalható el.': 'Smaller, nimbler Shadow ship with a spiked, cell-patterned body. Only appears as part of a Shadow fleet. Cannot be captured.',
  'Kereskedő teherhajó': 'Merchant freighter', 'Szabad kereskedők': 'Free traders',
  'Békés teherhajó. Kereskedő konvojként érkezik: kreditet hoz, javít, majd harc nélkül továbbáll.': 'Peaceful freighter. Arrives as a merchant convoy: brings credits, repairs, then leaves without a fight.',
  'Sárga Csillag': 'Yellow Star', 'Ceti Kereskedő': 'Ceti Trader', 'Babylon Expressz': 'Babylon Express', 'Vén Teknős': 'Old Tortoise', 'Arany Rakomány': 'Golden Cargo',
  'Kalóz ágyúnaszád': 'Raider gunship', 'Kalóz elfogó': 'Raider interceptor', 'Kalóz csatahordozó': 'Raider battlewagon',
  'Felfegyverzett, toldozott-foltozott teherhajó ráhegesztett lövegekkel és rakétákkal.': 'An armed, patched-up freighter with welded-on guns and missiles.',
  'Gyors, ikertörzsű, V alakú vadász. Lecsap és elsuhan.': 'Fast twin-boom, V-shaped fighter. Strikes and slips away.',
  'A kalózok anyahajója („Battlewagon”): rozsdás, nehéz hordozó, amely vadászrajokat indít.': 'The raiders\' mothership (the "Battlewagon"): a rusty, heavy carrier that launches fighter swarms.',
  'Toldott lézerágyúk': 'Patched laser cannons', 'Rakétasortűz': 'Missile volley', 'három ívelő rakéta egyszerre': 'three arcing missiles at once',
  'Ikerlézerek': 'Twin lasers', 'Lövegtornyok': 'Gun turrets', 'Kalóz vadászraj': 'Raider fighter swarm', 'a hangárból kirajzó Delta-V vadászok': 'Delta-V fighters swarming out of the hangar',
  'Rozsdás Szög': 'Rusty Nail', 'Zsákmány': 'Plunder', 'Csempész': 'Smuggler', 'Vasmacska': 'Grapnel', 'Sötét Rakomány': 'Dark Cargo', 'Kalózhajó': 'Corsair',
  'Villám': 'Lightning', 'Darázs': 'Wasp', 'Késpenge': 'Knife Edge', 'Sólyomszem': 'Hawkeye', 'Vörös Árny': 'Red Shade', 'Fenevad': 'Beast',
  'Vén Bárka': 'Old Barge', 'Kalózkirály': 'Pirate King', 'Vasököl': 'Iron Fist', 'Fekete Lobogó': 'Black Flag', 'Tolvajfészek': "Thieves' Nest",
  'Irányító központ': 'Command centre', '+1 hajóhely a flottában': '+1 fleet slot',
  'Tüskesorozat': 'Spike volley', 'gyors, lila energiatüskék zápora': 'rapid volley of purple energy spikes',
  'Árnyékfog': 'Shadowfang', 'Éjtüske': 'Nightspine', 'Sötét Karom': 'Dark Claw', 'Csend': 'Silence', 'Üresség': 'Void', 'Hamvas Tövis': 'Ashen Thorn',
  // frakciók
  'Csillagvédelmi Szövetség': 'Interstellar Alliance', 'Minbari Föderáció': 'Minbari Federation', 'Narn Rezsim': 'Narn Regime',
  'Centauri Köztársaság': 'Centauri Republic', 'Földi Szövetség': 'Earth Alliance', 'Kalózok': 'Raiders', 'Drazi Szabadság': 'Drazi Freehold', 'Árnyékok': 'Shadows',
  // leírások
  'Fürge, modern cirkáló. Az állomás első védelmi vonala – a kezdőhajód.': "Agile, modern cruiser. The station's first line of defence – your starting ship.",
  'Hatalmas, kristályos páncélú csatahajó. Ritka és rendkívül veszélyes.': 'Huge, crystal-armoured warship. Rare and extremely dangerous.',
  'Nehézkes, de kemény ütésű cirkáló. Nem válogat az eszközökben.': "Lumbering but hard-hitting cruiser. Not picky about its methods.",
  'Primus-osztályú csatacirkáló: hosszú, szegmentált test, pontos lövegek a Köztársaság dicsőségére.': 'Primus-class battlecruiser: long segmented hull and precise guns for the glory of the Republic.',
  'Gyors, lándzsa testű hadihajó hatalmas félhold-szárnnyal és plazmagyorsítóval.': 'Fast warship with a spear-like hull, a huge crescent wing and a plasma accelerator.',
  'Keskeny elülső törzs, hátul széles kereszt alakú blokk. Megbízható vonalhajó.': 'Narrow forward hull with a wide cross-shaped rear section. A reliable ship of the line.',
  'Óriási hordozó két félhold-szárnnyal és három nehézlöveggel. A késői hullámok réme.': 'Enormous carrier with two crescent wings and three heavy guns. The terror of the late waves.',
  'A Földi Erők régi igáslova: bézs törzs kék sávokkal, rácsos gerinc, erős lövegek.': 'The old workhorse of EarthForce: beige hull with blue stripes, a truss spine and strong guns.',
  'Lövegtornyokkal teletűzdelt nehéz csatahajó – forgó gyűrű nélkül, csak tűzerő.': 'Heavy warship bristling with gun turrets – no rotating section, just firepower.',
  'Az ikonikus négyszárnyú vadász. Olcsó, fürge, rajban veszélyes.': 'The iconic four-winged fighter. Cheap, agile and dangerous in swarms.',
  'Omega-osztályú romboló forgó gravitációs gyűrűvel. Stabil, megbízható.': 'Omega-class destroyer with a rotating gravity section. Steady and dependable.',
  'Olcsó, gyors delta-szárnyú vadász. Rajokban támad.': 'Cheap, fast delta-wing fighter. Attacks in swarms.',
  'Agresszív, harcias vadász. Zöld vagy lila? A Drazik ezen is összevesznek.': 'Aggressive, belligerent fighter. Green or purple? The Drazi fight over that too.',
  'Ősi, élő hajó a peremvidékről. Minden ötödik hullámban érkezik. Elfoglalni lehetetlen.': 'Ancient living ship from the Rim. Arrives every fifth wave. It can never be captured.',
  // képességek
  'Célzott lövés': 'Precision shot', 'Biztos találat a kijelölt részre, +25% sebzés.': 'Guaranteed hit on the chosen part, +25% damage.',
  'Sortűz': 'Barrage', 'A testet és mind a négy alrendszert lövi (egyenként 45% sebzéssel).': 'Fires at the hull and all four subsystems (45% damage each).',
  'Túlterhelés': 'Overload', '+80% sebzés, de a saját reaktor 15%-ot sérül.': '+80% damage, but your own reactor takes 15% damage.',
  'Kitérő manőver': 'Evasive manoeuvre', 'Normál lövés, majd +30% kitérés a kör végéig.': 'Normal shot, then +30% evasion until the end of the turn.',
  // nehézség
  'Kadét': 'Cadet', 'Gyengébb ellenség, több kredit. Ismerkedéshez.': 'Weaker enemies, more credits. For getting started.',
  'Kapitány': 'Captain', 'Az eredeti élmény. Kiegyensúlyozott kihívás.': 'The original experience. A balanced challenge.',
  'Admirális': 'Admiral', 'Az ellenség okosan céloz és alrendszereket lő.': 'The enemy aims smartly and targets subsystems.',
  'Rémálom': 'Nightmare', 'Az utolsó, legjobb reményünk… nem elég. Csak bátraknak.': 'Our last, best hope… is not enough. For the brave only.',
  // állomásfejlesztések
  'Állomás javítása': 'Station repair', '+30% szerkezeti integritás': '+30% structural integrity',
  'Páncélzat': 'Armour plating', '+250 max. szerkezet (és javítás)': '+250 max structure (and repair)',
  'Pajzsgenerátor': 'Shield generator', '+80 max. pajzs, gyorsabb töltődés': '+80 max shields, faster recharge',
  'Védelmi rács': 'Defence grid', '+5 sebzés; 3. és 6. szinten +1 lövés': '+5 damage; +1 shot at levels 3 and 6',
  // fegyverek
  'Szárnyágyúk': 'Wing cannons', 'Fő fúziós ágyú': 'Main fusion cannon', 'az orr fő ágyújának folytonos zöld sugara': 'continuous green beam from the main bow gun',
  'Neutronágyúk': 'Neutron cannons', 'Fúziós sugárágyú': 'Fusion beam cannon', 'vastag, kékeszöld fúziós sugár': 'thick blue-green fusion beam',
  'Lézer-impulzuságyúk': 'Laser pulse cannons', 'Nehéz lézerágyú': 'Heavy laser cannon', 'a lövegcsatorna sárga lézersugara': 'yellow laser beam from the gun channel',
  'Ionágyúk': 'Ion cannons', 'Nehéz ionágyú': 'Heavy ion cannon', 'egyetlen, hatalmas ionlövedék': 'a single huge ion bolt',
  'Plazmagyorsító': 'Plasma accelerator', 'lassú, izzó plazmagömb': 'slow, glowing plasma ball',
  'Ion-sortűz': 'Ion barrage', 'gyors ionlövedék-zápor': 'rapid hail of ion bolts',
  'Sentri vadászraj': 'Sentri fighter swarm', 'a hangárból kirajzó vadászok': 'fighters swarming out of the hangar',
  'Impulzuságyúk': 'Pulse cannons', 'vörös, folytonos nehézlézer-sugár': 'continuous red heavy laser beam',
  'Plazmaágyúk': 'Plasma cannons', 'Teljes sortűz': 'Full broadside', 'minden lövegtorony egyszerre tüzel': 'every gun turret fires at once',
  'Impulzusfegyverek': 'Pulse weapons', 'Rakéták': 'Missiles', 'ívelő pályájú rakétapár': 'a pair of arcing missiles',
  'Impulzuslézerek': 'Pulse lasers', 'Részecskeágyú': 'Particle cannon', 'Részecskesugár': 'Particle beam', 'zöld részecskesugár': 'green particle beam',
  'Szeletelő sugár': 'Slicing beam', 'Teljes erejű szeletelő sugár': 'Full-power slicing beam', 'mindent átvágó, vastag lila sugár': 'thick purple beam that cuts through anything',
  'Lövegek': 'Guns',
  // hajók saját nevei
  'Valen fénye': "Valen's Light", 'Néma Ének': 'Silent Song', 'Csillagtűz': 'Starfire', 'Hajnalpír': 'Dawnglow', 'Szürke Tanács': 'Grey Council',
  "G'Kar dühe": "G'Kar's Wrath", 'Vörös Homok': 'Red Sand', "G'Quan pengéje": "Blade of G'Quan", 'Narn Hamva': 'Ashes of Narn', "G'Kar ajándéka": "G'Kar's Gift",
  'Arany Sas': 'Golden Eagle', 'Mollari büszkesége': "Mollari's Pride",
  'Vörös Vipera': 'Red Viper', 'Hiéna': 'Hyena', 'Rozsdafog': 'Rustfang', 'Sakál': 'Jackal', 'Fekete Vitorla': 'Black Sail', 'Csontváz': 'Skeleton',
  'Kobra': 'Cobra', 'Varjú': 'Crow',
  'Zöld Karom': 'Green Claw', 'Napsólyom': 'Sunhawk', 'Viharszárny': 'Stormwing', 'Dühös Drazi': 'Angry Drazi', 'Sas-szem': 'Eagle Eye',
  'Árnyék': 'Shadow', 'A Sötétség': 'The Darkness', 'Éjszaka Pókja': 'Night Spider', 'Ősi Ellenség': 'Ancient Enemy',
  'Alfa 1': 'Alpha 1', 'Alfa 2': 'Alpha 2', 'Béta 4': 'Beta 4', 'Zéta 3': 'Zeta 3',
  'Sheridan kapitány': 'Captain Sheridan',
};

const I18N = (() => {
  let lang = 'hu';
  try {
    const saved = JSON.parse(localStorage.getItem('b5dts_settings') || '{}').lang;
    lang = saved || ((navigator.language || 'hu').toLowerCase().startsWith('hu') ? 'hu' : 'en');
  } catch (e) { /* alapértelmezett marad */ }
  return {
    get lang() { return lang; },
    set lang(l) { lang = l === 'en' ? 'en' : 'hu'; document.documentElement.lang = lang; },
    get locale() { return lang === 'en' ? 'en-GB' : 'hu-HU'; },
  };
})();
document.documentElement.lang = I18N.lang;

function t(key, p) {
  let s = (STRINGS[I18N.lang] && STRINGS[I18N.lang][key]) ?? STRINGS.hu[key] ?? key;
  if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m));
  return s;
}

function D(s) {
  if (I18N.lang === 'hu' || s == null) return s;
  return DATA_EN[s] ?? s;
}

// Hajók saját neve: „Fehércsillag-7” → „White Star 7”, „Hiéna 2.” → „Hyena 2”
function NM(name) {
  if (I18N.lang === 'hu' || !name) return name;
  let m = /^Fehércsillag-(\d+)$/.exec(name);
  if (m) return `White Star ${m[1]}`;
  m = /^(.*) (\d+)\.$/.exec(name);
  if (m) return `${NM(m[1])} ${m[2]}`;
  return DATA_EN[name] ?? name;
}

// A súgó szövege nyelvenként
function helpHtml(ctx) {
  const { esc, MAX_FLEET, ABILITIES, SHIP_TYPES, SCORE } = ctx;
  const abil = Object.values(ABILITIES).map(a => `<li><b>${esc(D(a.name))}</b> – ${esc(D(a.desc))} (${a.cooldown} ${I18N.lang === 'en' ? 'turn recharge' : 'kör töltődés'})</li>`).join('');
  const pts = Object.values(SHIP_TYPES).filter(T => !T.civilian).slice().sort((a, b) => a.points - b.points).map(T => `${esc(D(T.name))} <b>${T.points}</b>`).join(', ');
  if (I18N.lang === 'en') return `
      <h2>How to play</h2>
      <p class="muted">Your goal: defend Babylon 5 against ever stronger attack waves arriving through jump points. The longer you hold out, the more points you earn – the game is endless and the station will fall sooner or later. The only question is when.</p>
      <div class="cols">
        <div>
          <h3>Combat</h3>
          <ul>
            <li>Select <b>your ship</b> (left card, with the arrows or by clicking on the battlefield). The <span style="color:var(--green)">✓</span> shows it can still fire this turn.</li>
            <li>Select the <b>target</b> (right card), then click the part you want to attack: the whole <b>hull</b> or a <b>subsystem</b>.</li>
            <li>The attacked enemy – if it still can – <b>fires back immediately</b>: either at you or (more likely) at the station.</li>
            <li>Once all your ships have fired (or you end the turn with <kbd>Space</kbd>), the remaining enemies fire, then the station's <b>defence grid</b> shoots.</li>
          </ul>
          <h3>Subsystems</h3>
          <ul>
            <li><b>Weapons</b> – less damage; at zero the ship can't fire.</li>
            <li><b>Sensors</b> – worse aim and fewer critical hits.</li>
            <li><b>Engines</b> – lower chance to evade.</li>
            <li><b>Reactor</b> – shoot it out and the ship is disabled.</li>
            <li>Subsystems are harder to hit than the hull – the buttons show the hit chance.</li>
          </ul>
        </div>
        <div>
          <h3>Capturing</h3>
          <ul>
            <li>Destroy the <b>reactor</b>, or both the <b>weapons and the engines</b>, and the ship becomes capturable. Capture it with one of your ships that can still act (<kbd>C</kbd>). The more battered its hull, the easier the capture. If it fails, you can only try that ship again next turn.</li>
            <li><span style="color:var(--green)">Allied</span> ships (from wave 5, arriving through a blue jump point next to the station) can be taken over immediately, without using an action. Until you do, they fire at the enemy on their own at the end of each turn; at the end of the wave they move on.</li>
            <li><b>Shadow ships</b> (cruisers and scouts) can never be captured – only destroyed.</li>
            <li>Your fleet can hold ${MAX_FLEET} ships by default; each level of the station's <b>Command centre</b> adds one more slot. In the shop you can <b>decommission</b> any ship for credits – it is not destroyed, it just leaves your fleet.</li>
            <li>From wave 10, a <b>Shadow fleet</b> sometimes arrives: only Shadow ships attack: Shadow cruisers and the smaller Shadow scouts.</li>
          </ul>
          <h3>Weapons</h3>
          <ul>
            <li>Every ship has a <b>primary weapon</b> (fires every turn), and most also have a <b>special weapon</b>: stronger, but it recharges for a few turns after firing (<kbd>G</kbd>).</li>
            <li>For example the White Star's wing cannons fire in pulses, while its main bow gun fires a continuous green beam; Earth ships' heavy lasers are red beams.</li>
          </ul>
          <h3>Abilities</h3>
          <ul>${abil}</ul>
          <h3>Scoring & shop</h3>
          <ul>
            <li>Points depend on the ship type: ${pts}.</li>
            <li>Capturing is worth one and a half times the points, and each wave gives a bonus of ${SCORE.wave}× the wave number – all multiplied by the difficulty.</li>
            <li>Between waves you can repair, upgrade, buy new ships and strengthen the station. Credit income (kills, captures, wave bonus) grows with the wave number.</li>
            <li><b>Merchant convoy:</b> from wave 3, merchants sometimes arrive through a blue jump point instead of a battle: they bring credits, repair your ships and the station, then move on.</li>
            <li><b>Last chance:</b> if the station drops below 40% structure – even if you still have a fleet – strong allied reinforcements jump in: White Stars, a Minbari Sharlin or the EAS Agamemnon. Afterwards it needs longer and longer to return (6, then 8, 10… waves) – the shop shows when it is available again.</li>
          </ul>
        </div>
      </div>
      <h3>Keys</h3>
      <table>
        <tr><td><kbd>1</kbd>–<kbd>5</kbd></td><td>Attack: hull / weapons / sensors / engines / reactor</td></tr>
        <tr><td><kbd>Q</kbd> <kbd>E</kbd></td><td>Switch your ship</td></tr>
        <tr><td><kbd>A</kbd> <kbd>D</kbd> · <kbd>Tab</kbd></td><td>Switch target</td></tr>
        <tr><td><kbd>G</kbd></td><td>Select special weapon</td></tr>
        <tr><td><kbd>F</kbd></td><td>Arm special ability</td></tr>
        <tr><td><kbd>C</kbd></td><td>Capture / take command</td></tr>
        <tr><td><kbd>Space</kbd></td><td>End turn</td></tr>
        <tr><td><kbd>L</kbd></td><td>Expand / collapse the combat log</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Menu / back</td></tr>
      </table>
      <div class="panel-btns"><button class="btn primary" data-back>${t('btn.ok')}</button></div>`;
  return `
      <h2>Hogyan játssz?</h2>
      <p class="muted">A cél: megvédeni a Babylon 5 állomást az ugrópontokon érkező, egyre erősebb támadó hullámokkal szemben. Minél tovább kitartasz, annál több pontot szerzel – a játék végtelen, az állomás előbb-utóbb elesik. A kérdés csak az, mikor.</p>
      <div class="cols">
        <div>
          <h3>Harc menete</h3>
          <ul>
            <li>Válaszd ki a <b>saját hajódat</b> (bal oldali kártya, a nyilakkal vagy a csatatéren kattintva). A <span style="color:var(--green)">✓</span> jelzi, hogy ebben a körben még lőhet.</li>
            <li>Válaszd ki a <b>célpontot</b> (jobb oldali kártya), majd kattints a támadni kívánt részre: a teljes <b>testre</b> vagy egy <b>alrendszerre</b>.</li>
            <li>A megtámadott ellenség – ha még tud – <b>azonnal visszalő</b>: vagy rád, vagy (nagyobb eséllyel) az állomásra.</li>
            <li>Ha minden hajód lőtt (vagy a <kbd>Space</kbd>-szel lezárod a kört), a maradék ellenség is tüzel, majd az állomás <b>védelmi rácsa</b> lő.</li>
          </ul>
          <h3>Alrendszerek</h3>
          <ul>
            <li><b>Fegyverzet</b> – kevesebb sebzés; nullán nem tud lőni.</li>
            <li><b>Szenzorok</b> – rosszabb célzás és kevesebb kritikus találat.</li>
            <li><b>Hajtómű</b> – kisebb kitérési esély.</li>
            <li><b>Reaktor</b> – ha kilövöd, a hajó megbénul.</li>
            <li>Az alrendszert nehezebb eltalálni, mint a testet – a gombokon látod a találati esélyt.</li>
          </ul>
        </div>
        <div>
          <h3>Elfoglalás</h3>
          <ul>
            <li>Ha kilövöd a <b>reaktort</b>, vagy a <b>fegyverzetet és a hajtóművet</b> is, a hajó elfoglalhatóvá válik. Egy még cselekvőképes hajóddal foglalhatod el (<kbd>C</kbd>). Minél roncsabb a teste, annál könnyebb az elfoglalás. Ha nem sikerül, azt a hajót csak a következő körben próbálhatod újra.</li>
            <li>A <span style="color:var(--green)">szövetséges</span> hajók (az 5. hullámtól, az állomás mellett, kék ugróponton érkeznek) azonnal átvehetők, ehhez nem kell akció. Amíg nem veszed át őket, minden kör végén önállóan lőnek az ellenségre; a hullám végén továbbállnak.</li>
            <li>Az <b>Árny hajókat</b> (cirkálót és felderítőt) soha nem lehet elfoglalni, csak elpusztítani.</li>
            <li>A flotta alapból legfeljebb ${MAX_FLEET} hajóból állhat; az állomás <b>Irányító központjának</b> fejlesztése szintenként +1 hajóhelyet ad. A boltban bármelyik hajót <b>leszerelheted</b> kreditért – ilyenkor nem semmisül meg, csak kikerül a flottából.</li>
            <li>A 10. hullámtól időnként <b>Árnyékflotta</b> érkezik: ilyenkor csak Árny hajók támadnak: Árny cirkálók és a kisebb Árny felderítők.</li>
          </ul>
          <h3>Fegyverek</h3>
          <ul>
            <li>Minden hajónak van <b>elsődleges fegyvere</b> (minden körben lőhet), és a legtöbbnek egy <b>különleges fegyvere</b> is: erősebb, de lövés után néhány körig töltődik (<kbd>G</kbd>).</li>
            <li>Például a Fehércsillag szárnyágyúi impulzusokban lőnek, az orr fő ágyúja folytonos zöld sugárral; a földi hajók nehézlézere vörös sugár.</li>
          </ul>
          <h3>Képességek</h3>
          <ul>${abil}</ul>
          <h3>Pontozás és bolt</h3>
          <ul>
            <li>A pontérték a hajótípustól függ: ${pts}.</li>
            <li>Elfoglalásért a pontérték másfélszerese jár, hullámonként pedig ${SCORE.wave}× hullámszám bónusz – mindez a nehézségi szorzóval.</li>
            <li>Hullámok között javíthatsz, fejleszthetsz, új hajót vehetsz, és erősítheted az állomást. A kreditbevétel (elpusztítás, elfoglalás, hullámbónusz) a hullámszámmal együtt nő.</li>
            <li><b>Kereskedő konvoj:</b> a 3. hullámtól néha harc helyett kereskedők érkeznek kék ugróponton: kreditet hoznak, javítanak a hajókon és az állomáson, majd továbbállnak.</li>
            <li><b>Utolsó esély:</b> ha az állomás szerkezete 40% alá esik – akkor is, ha van még flottád –, erős szövetséges erősítés ugrik be: Fehércsillagok, egy Minbari Sharlin vagy az EAS Agamemnon. Utána egyre hosszabb ideig nem jöhet újra (6, majd 8, 10… hullám) – a boltban látod, mikor lesz újra elérhető.</li>
          </ul>
        </div>
      </div>
      <h3>Billentyűk</h3>
      <table>
        <tr><td><kbd>1</kbd>–<kbd>5</kbd></td><td>Támadás: test / fegyverzet / szenzorok / hajtómű / reaktor</td></tr>
        <tr><td><kbd>Q</kbd> <kbd>E</kbd></td><td>Saját hajó váltása</td></tr>
        <tr><td><kbd>A</kbd> <kbd>D</kbd> · <kbd>Tab</kbd></td><td>Célpont váltása</td></tr>
        <tr><td><kbd>G</kbd></td><td>Különleges fegyver kiválasztása</td></tr>
        <tr><td><kbd>F</kbd></td><td>Különleges képesség élesítése</td></tr>
        <tr><td><kbd>C</kbd></td><td>Elfoglalás / átvétel</td></tr>
        <tr><td><kbd>Space</kbd></td><td>Kör vége</td></tr>
        <tr><td><kbd>L</kbd></td><td>Harci napló lenyitása / becsukása</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Menü / vissza</td></tr>
      </table>
      <div class="panel-btns"><button class="btn primary" data-back>${t('btn.ok')}</button></div>`;
}

// A statikus HTML-elemek feliratai (data-i18n / data-i18n-title / data-i18n-ph)
function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.title = I18N.lang === 'en' ? 'Babylon 5 – Defend The Station' : 'Babylon 5 – Defend The Station';
}
