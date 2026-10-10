'use strict';
// ---------------------------------------------------------------------------
// Játékadatok: hajótípusok, alrendszerek, nehézségi szintek, fejlesztések.
// Az alapértékek az eredeti egyetemi dokumentációból származnak.
// ---------------------------------------------------------------------------

const SUBSYSTEMS = [
  { key: 'hull',    label: 'Test',       short: 'TEST', mod: 0.00, icon: '◆' },
  { key: 'weapons', label: 'Fegyverzet', short: 'FEGY', mod: 0.04, icon: '✶' },
  { key: 'sensors', label: 'Szenzorok',  short: 'SZEN', mod: 0.06, icon: '◎' },
  { key: 'engines', label: 'Hajtómű',    short: 'HAJT', mod: 0.07, icon: '➤' },
  { key: 'reactor', label: 'Reaktor',    short: 'REAK', mod: 0.08, icon: '⚛' },
];
const SYS_KEYS = ['weapons', 'sensors', 'engines', 'reactor'];
const SUB_BY_KEY = Object.fromEntries(SUBSYSTEMS.map(s => [s.key, s]));

const CLASSES = {
  'vadász':    { evasion: 0.15, size: 0.62 },
  'cirkáló':   { evasion: 0.07, size: 0.9 },
  'csatahajó': { evasion: 0.02, size: 1.12 },
  'ősi':       { evasion: 0.10, size: 1.05 },
};

// Az EAS Agamemnon (Sheridan kapitány régi hajója) mindig szövetségesként érkezik, ellenségként soha.
const ALLY_ONLY_NAMES = { earth: 'Agamemnon' };

const SHIP_TYPES = {
  whitestar: {
    name: 'Fehércsillag', cls: 'cirkáló', sys: 30, hull: 120, firepower: 25,
    points: 220,
    beam: '#cbb2ff', ability: 'precision', price: 650,
    evasionPierce: 0.6,   // fejlett célzás: a célpont kitérésének 60%-át figyelmen kívül hagyja (+ a faj célzási bónusza)
    faction: 'Csillagvédelmi Szövetség',
    desc: 'Fürge, modern cirkáló. Az állomás első védelmi vonala – a kezdőhajód.',
    names: ['Fehércsillag', 'Fehércsillag-2', 'Fehércsillag-7', 'Fehércsillag-9', 'Fehércsillag-14', 'Fehércsillag-16'],
  },
  minbari: {
    name: 'Minbari csatahajó', cls: 'csatahajó', sys: 42, hull: 180, firepower: 37,
    points: 360,
    beam: '#a8f0ff', ability: 'barrage', threat: 6, fixedThreat: true, price: 900, minWave: 7,
    faction: 'Minbari Föderáció',
    desc: 'Hatalmas, kristályos páncélú csatahajó. Ritka és rendkívül veszélyes.',
    names: ['Valen fénye', 'Néma Ének', 'Csillagtűz', 'Hajnalpír', 'Szürke Tanács'],
  },
  narn: {
    name: 'Narn cirkáló', cls: 'cirkáló', sys: 20, hull: 96, firepower: 21,
    points: 125,
    beam: '#ffb347', ability: 'overload', price: 350, minWave: 1,
    faction: 'Narn Rezsim',
    desc: 'Nehézkes, de kemény ütésű cirkáló. Nem válogat az eszközökben.',
    names: ["G'Kar dühe", "Na'Toth", 'Vörös Homok', "Th'Rok", "G'Quan pengéje", 'Narn Hamva'],
  },
  centauri: {
    name: 'Centauri Primus cirkáló', cls: 'cirkáló', sys: 24, hull: 92, firepower: 23,
    points: 140,
    beam: '#ffcf7a', ability: 'precision', price: 420, minWave: 2,
    faction: 'Centauri Köztársaság',
    desc: 'Primus-osztályú csatacirkáló: hosszú, szegmentált test, pontos lövegek a Köztársaság dicsőségére.',
    names: ['Valerius', 'Primus Rex', 'Arany Sas', 'Cartagia', 'Mollari büszkesége', 'Vindicator'],
  },
  earth: {
    name: 'Földi Omega romboló', cls: 'csatahajó', sys: 27, hull: 120, firepower: 21,
    points: 165,
    beam: '#ff9a4d', ability: 'barrage', price: 480, minWave: 3,
    faction: 'Földi Szövetség',
    desc: 'Omega-osztályú romboló forgó gravitációs gyűrűvel. Stabil, megbízható.',
    names: ['Churchill', 'Nimrod', 'Pollux', 'Titans', 'Excalibur', 'Furies'],
  },
  vorchan: {
    name: 'Centauri Vorchan', cls: 'cirkáló', scale: 0.85, sys: 18, hull: 64, firepower: 22,
    points: 95,
    beam: '#ffcf7a', ability: 'overload', price: 380, minWave: 2,
    faction: 'Centauri Köztársaság',
    desc: 'Gyors, lándzsa testű hadihajó hatalmas félhold-szárnnyal és plazmagyorsítóval.',
    names: ['Ragesh', 'Morado', 'Coriana', 'Imperio', 'Lustrum', 'Talia'],
  },
  altarian: {
    name: 'Centauri Altarian romboló', cls: 'cirkáló', sys: 25, hull: 100, firepower: 22,
    points: 145,
    beam: '#ffcf7a', ability: 'barrage', price: 500, minWave: 4,
    faction: 'Centauri Köztársaság',
    desc: 'Keskeny elülső törzs, hátul széles kereszt alakú blokk. Megbízható vonalhajó.',
    names: ['Dominus', 'Severus', 'Aurelia', 'Pax Centauri', 'Altarian'],
  },
  centcarrier: {
    name: 'Centauri csatahordozó', cls: 'csatahajó', scale: 1.2, sys: 38, hull: 210, firepower: 32,
    points: 400,
    beam: '#ffcf7a', ability: 'barrage', minWave: 9,
    faction: 'Centauri Köztársaság',
    desc: 'Óriási hordozó két félhold-szárnnyal és három nehézlöveggel. A késői hullámok réme.',
    names: ['Imperatrix', 'Gloria Centauri', 'Regina', 'Vindex'],
  },
  hyperion: {
    name: 'Hyperion nehézcirkáló', cls: 'cirkáló', sys: 27, hull: 108, firepower: 24,
    points: 170,
    beam: '#ffa860', ability: 'precision', price: 540, minWave: 5,
    faction: 'Földi Szövetség',
    desc: 'A Földi Erők régi igáslova: bézs törzs kék sávokkal, rácsos gerinc, erős lövegek.',
    names: ['Cortez', 'Lexington', 'Pournelle', 'Nemesis', 'Juno', 'Hydra'],
  },
  nova: {
    name: 'Nova csatahajó', cls: 'csatahajó', sys: 35, hull: 175, firepower: 29,
    points: 290,
    beam: '#ff9a4d', ability: 'barrage', price: 780, minWave: 8,
    faction: 'Földi Szövetség',
    desc: 'Lövegtornyokkal teletűzdelt nehéz csatahajó – forgó gyűrű nélkül, csak tűzerő.',
    names: ['Schwarzkopf', 'Gorgon', 'Alexander', 'Medusa', 'Pallas'],
  },
  starfury: {
    name: 'Starfury vadász', cls: 'vadász', scale: 0.85, sys: 14, hull: 52, firepower: 14,
    points: 50,
    beam: '#ffb070', ability: 'evade', price: 180, minWave: 2,
    faction: 'Földi Szövetség',
    desc: 'Az ikonikus négyszárnyú vadász. Olcsó, fürge, rajban veszélyes.',
    names: ['Alfa 1', 'Alfa 2', 'Béta 4', 'Zéta 3', 'Delta 7', 'Omega 9'],
  },
  merchant: {
    name: 'Kereskedő teherhajó', cls: 'cirkáló', scale: 0.9, sys: 10, hull: 60, firepower: 0,
    points: 0, civilian: true,
    beam: '#ffffff', ability: 'evade',
    faction: 'Szabad kereskedők',
    desc: 'Békés teherhajó. Kereskedő konvojként érkezik: kreditet hoz, javít, majd harc nélkül továbbáll.',
    names: ['Ikarus', 'Sárga Csillag', 'Ceti Kereskedő', 'Babylon Expressz', 'Vén Teknős', 'Arany Rakomány'],
  },
  raidergunship: {
    name: 'Kalóz ágyúnaszád', cls: 'cirkáló', scale: 0.85, sys: 14, hull: 66, firepower: 13,
    points: 70,
    beam: '#ff6b4a', ability: 'overload', minWave: 2,
    faction: 'Kalózok',
    desc: 'Felfegyverzett, toldozott-foltozott teherhajó ráhegesztett lövegekkel és rakétákkal.',
    names: ['Rozsdás Szög', 'Zsákmány', 'Csempész', 'Vasmacska', 'Sötét Rakomány', 'Kalózhajó'],
  },
  raiderinterceptor: {
    name: 'Kalóz elfogó', cls: 'vadász', scale: 0.95, sys: 12, hull: 42, firepower: 11,
    points: 45,
    beam: '#ff4d5e', ability: 'evade', minWave: 3,
    faction: 'Kalózok',
    desc: 'Gyors, ikertörzsű, V alakú vadász. Lecsap és elsuhan.',
    names: ['Villám', 'Darázs', 'Késpenge', 'Sólyomszem', 'Vörös Árny', 'Fenevad'],
  },
  raiderwagon: {
    name: 'Kalóz csatahordozó', cls: 'csatahajó', scale: 1.1, sys: 22, hull: 115, firepower: 15,
    points: 135,
    beam: '#ffa060', ability: 'barrage', minWave: 4,
    faction: 'Kalózok',
    desc: 'A kalózok anyahajója („Battlewagon”): rozsdás, nehéz hordozó, amely vadászrajokat indít.',
    names: ['Vén Bárka', 'Kalózkirály', 'Vasököl', 'Fekete Lobogó', 'Tolvajfészek'],
  },
  raider: {
    name: 'Kalóz vadász', cls: 'vadász', sys: 11, hull: 36, firepower: 9,
    points: 30,
    beam: '#ff4d5e', ability: 'evade', price: 200, minWave: 1,
    faction: 'Kalózok',
    desc: 'Olcsó, gyors delta-szárnyú vadász. Rajokban támad.',
    names: ['Vörös Vipera', 'Hiéna', 'Rozsdafog', 'Sakál', 'Fekete Vitorla', 'Csontváz', 'Kobra', 'Varjú'],
  },
  drazi: {
    name: 'Drazi napsólyom', cls: 'vadász', sys: 16, hull: 60, firepower: 15,
    points: 70,
    beam: '#c4ff4d', ability: 'evade', price: 260, minWave: 4,
    faction: 'Drazi Szabadság',
    desc: 'Agresszív, harcias vadász. Zöld vagy lila? A Drazik ezen is összevesznek.',
    names: ['Zöld Karom', 'Napsólyom', 'Viharszárny', 'Dühös Drazi', 'Sas-szem'],
  },
  shadowscout: {
    name: 'Árny felderítő', cls: 'ősi', scale: 0.62, sys: 34, hull: 170, firepower: 22,
    points: 320,
    beam: '#c060ff', ability: 'evade', threat: 4.5, fixedThreat: true, noCapture: true, shadowOnly: true, minWave: 10,
    faction: 'Árnyékok',
    desc: 'Kisebb, fürgébb Árny hajó tüskés, sejtmintás testtel. Csak az Árnyékflotta tagjaként tűnik fel. Nem foglalható el.',
    names: ['Árnyékfog', 'Éjtüske', 'Sötét Karom', 'Csend', 'Üresség', 'Hamvas Tövis'],
  },
  shadow: {
    name: 'Árny cirkáló', cls: 'ősi', sys: 60, hull: 420, firepower: 40,
    points: 800,
    beam: '#d65cff', ability: 'barrage', threat: 12, fixedThreat: true, boss: true, noCapture: true, minWave: 5,
    faction: 'Árnyékok',
    desc: 'Ősi, élő hajó a peremvidékről. Minden ötödik hullámban érkezik. Elfoglalni lehetetlen.',
    names: ['Árnyék', 'A Sötétség', 'Éjszaka Pókja', 'Ősi Ellenség'],
  },
};

// Fajonkénti célzás: a találati esélyhez adódik (az állomás elleni lövésnél is).
// A fejlettebb fajok pontosabbak, a kalózok pontatlanok – cserébe sokan jönnek, olcsó hajókkal.
const FACTION_ACC = {
  'Árnyékok': 0.15,
  'Minbari Föderáció': 0.12,
  'Csillagvédelmi Szövetség': 0.10,
  'Centauri Köztársaság': 0.06,
  'Földi Szövetség': 0.04,
  'Narn Rezsim': 0,
  'Drazi Szabadság': -0.05,
  'Kalózok': -0.12,
};

// Fenyegetettség (threat): a hullám-költségvetés egysége, és ebből számol a jutalom is.
// Erőindex = √(test / (1 − osztálykitérés) × tűzerő × (0,88 + fajcélzás) / 0,88), osztva 19-cel.
// Így a sok gyenge kalóz és a kevés erős Földi hajó egy hullámon belül nagyjából azonos erőt ad.
// Kivétel (fixedThreat): a Minbari és az Árny hajók – önjavítók, és külön hullámlogikájuk van.
for (const T of Object.values(SHIP_TYPES)) {
  if (T.civilian) { T.threat = 0; continue; }
  if (T.fixedThreat) continue;
  const ev = CLASSES[T.cls].evasion, acc = FACTION_ACC[T.faction] || 0;
  T.threat = +(Math.sqrt(T.hull / (1 - ev) * T.firepower * (0.88 + acc) / 0.88) / 19).toFixed(2);
}

const ABILITIES = {
  precision: { name: 'Célzott lövés', desc: 'Biztos találat a kijelölt részre, +25% sebzés.', cooldown: 3 },
  barrage:   { name: 'Sortűz', desc: 'A testet és mind a négy alrendszert lövi (egyenként 45% sebzéssel).', cooldown: 3 },
  overload:  { name: 'Túlterhelés', desc: '+80% sebzés, de a saját reaktor 15%-ot sérül.', cooldown: 3 },
  evade:     { name: 'Kitérő manőver', desc: 'Normál lövés, majd +30% kitérés a kör végéig.', cooldown: 3 },
};

const DIFFICULTIES = {
  easy:      { name: 'Kadét',      desc: 'Gyengébb ellenség, több kredit. Ismerkedéshez.', enemyDmg: 0.7,  enemyHp: 0.85, stationBias: 0.65, smart: 0.0, scoreMult: 0.75, credMult: 1.25, budget: 0.85 },
  normal:    { name: 'Kapitány',   desc: 'Az eredeti élmény. Kiegyensúlyozott kihívás.',   enemyDmg: 1.0,  enemyHp: 1.0,  stationBias: 0.6,  smart: 0.25, scoreMult: 1.0,  credMult: 1.0,  budget: 1.0 },
  hard:      { name: 'Admirális',  desc: 'Az ellenség okosan céloz és alrendszereket lő.', enemyDmg: 1.2,  enemyHp: 1.15, stationBias: 0.5,  smart: 0.55, scoreMult: 1.5,  credMult: 0.9,  budget: 1.15 },
  nightmare: { name: 'Rémálom',    desc: 'Az utolsó, legjobb reményünk… nem elég. Csak bátraknak.', enemyDmg: 1.45, enemyHp: 1.3, stationBias: 0.45, smart: 0.8, scoreMult: 2.2, credMult: 0.8, budget: 1.3 },
};

const STATION_BASE = { hull: 1200, shield: 160, grid: 14 };
const SYS_HP_MUL = 1.5;   // alrendszer-integritás = doksi szerinti érték × 1,5
const SUB_DMG = 0.6;      // alrendszerre mért lövés sebzésszorzója

// Bolt – állomás fejlesztések
const STATION_UPGRADES = [
  { key: 'repair', name: 'Állomás javítása', desc: '+30% szerkezeti integritás', cost: () => 140 },
  { key: 'armor',  name: 'Páncélzat',        desc: '+250 max. szerkezet (és javítás)', cost: s => 220 + s.armorLvl * 140, max: 8, lvl: s => s.armorLvl },
  { key: 'shield', name: 'Pajzsgenerátor',   desc: '+50 max. pajzs, gyorsabb töltődés', cost: s => 200 + s.shieldLvl * 130, max: 8, lvl: s => s.shieldLvl },
  { key: 'command', name: 'Irányító központ', desc: '+1 hajóhely a flottában', cost: s => 400 + (s.cmdLvl || 0) * 260, max: 4, lvl: s => s.cmdLvl || 0 },
  { key: 'minelayer', name: 'Aknatelepítő', desc: 'Aknamező az ugrókapu körül; szintenként +1 akna', cost: s => 240 + (s.mineLvl || 0) * 150, max: 5, lvl: s => s.mineLvl || 0 },
  { key: 'minepower', name: 'Aknatöltet', desc: 'Erősebb aknák: +15 sebzés szintenként', cost: s => 160 + (s.minePow || 0) * 110, max: 5, lvl: s => s.minePow || 0, req: s => (s.mineLvl || 0) > 0 },
  { key: 'mines', name: 'Aknák telepítése', desc: 'Feltölti az aknamezőt; a felrobbant aknákat újra meg kell venni', cost: s => MINES.deployCost(s), req: s => (s.mineLvl || 0) > 0 },
  { key: 'grid',   name: 'Védelmi rács',     desc: '+5 sebzés; 3. és 6. szinten +1 lövés', cost: s => 180 + s.gridLvl * 120, max: 8, lvl: s => s.gridLvl },
];

// Aknamező: a telepített aknák a hullám elején beugró ellenséges hajókat sebzik (érkezési
// sorrendben hajónként egy akna), amíg el nem fogynak. A felrobbant aknákat a boltban kell pótolni.
const MINES = {
  capOf: st => ((st.mineLvl || 0) > 0 ? 1 + st.mineLvl : 0),          // Aknatelepítő 1–5. szint: 2–6 akna
  dmgOf: st => 30 + 15 * (st.minePow || 0),                            // Aknatöltet 0–5. szint: 30–105 sebzés a testre
  sysShare: 0.5,                                                        // ennek fele egy véletlen alrendszert is ér
  unitCost: st => 25 + 7 * (st.minePow || 0),                          // egy akna telepítése
  deployCost: st => Math.max(0, MINES.capOf(st) - (st.mines || 0)) * MINES.unitCost(st),
};

const PLAYER_BUYABLE = ['starfury', 'narn', 'vorchan', 'centauri', 'earth', 'hyperion', 'nova', 'whitestar'];
const ALLY_TYPES = ['narn', 'centauri', 'vorchan', 'earth', 'hyperion', 'starfury', 'whitestar', 'drazi'];
const MAX_FLEET = 6;            // alap flottaméret; az Irányító központ szintenként +1
const MAX_SHIP_LEVEL = 5;

// Pontok: elpusztításért a típus 'points' értéke, elfoglalásért annak 1,5-szerese
const SCORE = { captureMult: 1.5, wave: 50 };

// Javítás. A REGEN típusok (Minbari, Fehércsillag, Árny) passzívan, minden kör elején
// önjavítanak: először a 0%-os alrendszert (fegyverzet → reaktor → hajtómű → szenzor),
// ha nincs ilyen, a 20% alattit, ha minden alrendszer 20% felett van, a testet.
// Az értékeket szimulációval állítottuk be: 1 támadó nem tudja tartósan lefogni,
// 2–3 összpontosító hajó igen. A többi hajó kézzel javíthat, lövés helyett.
const REGEN = {
  whitestar: { sys: 0.2, hull: 0.05 },
  minbari: { sys: 0.2, hull: 0.05 },
  shadow: { sys: 0.18, hull: 0.04 },
  shadowscout: { sys: 0.18, hull: 0.04 },
};
// Kézi javítás fajonként: alrendszer / test (a maximum aránya), és töltési idő körökben.
// Sorrend: Centauri (legjobb) → Földi → Narn → Drazi → Kalóz (leggyengébb).
const REPAIR_BY_FACTION = {
  'Centauri Köztársaság': { sys: 0.45, hull: 0.22, cd: 2 },
  'Földi Szövetség':      { sys: 0.40, hull: 0.20, cd: 2 },
  'Narn Rezsim':          { sys: 0.35, hull: 0.17, cd: 3 },
  'Drazi Szabadság':      { sys: 0.30, hull: 0.15, cd: 3 },
  'Kalózok':              { sys: 0.25, hull: 0.12, cd: 4 },
};
const REPAIR_DEFAULT = { sys: 0.3, hull: 0.15, cd: 3 };
// minél sérültebb a hajó, annál kevésbé hatékony a javítás: hatékonyság = MIN + (1 − MIN) × állapot
const REPAIR_MIN_EFF = 0.45;

// Gazdaság – a hullámszámmal arányosan nő (n = hullám száma)
const ECON = {
  kill: (threat, n) => (50 + threat * 50) * (1 + 0.04 * (n - 1)),        // elpusztított hajóért
  capture: (threat, n) => (40 + threat * 30) * (1 + 0.04 * (n - 1)),     // elfoglalt hajóért
  waveBonus: n => 130 + 35 * n + 1.0 * n * n,                            // visszavert hullámért
  repairHull: 0.75, repairSys: 1.2,                                        // javítás kredit/életpont
  merchantChance: 0.15, merchantMinWave: 3,                                // kereskedő konvoj esélye
  merchantCredits: n => 180 + 50 * n + 1.6 * n * n,
};

// ---------------------------------------------------------------------------
// Fegyverek. Minden hajónak van egy elsődleges fegyvere (minden körben lőhet)
// és – típustól függően – egy különleges fegyvere, ami csak pár körönként tud
// tüzelni (cd = újratöltés körökben). A kind a lövés látványát adja meg:
//   pulse – rövid impulzussorozat, beam – folytonos sugár, bolt – lövedék,
//   plasma – lassú plazmagömb, missile – ívelő rakéták, swarm – vadászraj.
// origins: a lövés kiindulópontjai a hajó saját koordinátáiban (orr = +x).
// ---------------------------------------------------------------------------
const WEAPON_DEFS = {
  whitestar: {
    primary: { name: 'Szárnyágyúk', kind: 'pulse', color: '#e6d2ff', shots: 4, origins: [[16, -20.4], [16, 21.8]] },
    special: { name: 'Fő fúziós ágyú', kind: 'beam', color: '#5dff7a', mult: 2.0, cd: 3, origins: [[50, 0]], desc: 'az orr fő ágyújának folytonos zöld sugara' },
  },
  minbari: {
    primary: { name: 'Neutronágyúk', kind: 'pulse', color: '#b4ecff', shots: 4, origins: [[50, -9], [50, 6]] },
    special: { name: 'Fúziós sugárágyú', kind: 'beam', color: '#6ff6ff', mult: 2.2, cd: 3, wide: true, origins: [[38, 0]], desc: 'vastag, kékeszöld fúziós sugár' },
  },
  narn: {
    primary: { name: 'Lézer-impulzuságyúk', kind: 'pulse', color: '#ffb347', shots: 3, origins: [[50, -4.6], [50, 4.6]] },
    special: { name: 'Nehéz lézerágyú', kind: 'beam', color: '#ffd23f', mult: 2.1, cd: 3, origins: [[42, 0]], desc: 'a lövegcsatorna sárga lézersugara' },
  },
  centauri: {
    primary: { name: 'Ionágyúk', kind: 'bolt', color: '#ffcf7a', shots: 2, origins: [[54, -1.8], [54, 1.8]] },
    special: { name: 'Nehéz ionágyú', kind: 'bolt', big: true, color: '#fff07a', mult: 1.9, cd: 3, origins: [[54, 0]], desc: 'egyetlen, hatalmas ionlövedék' },
  },
  vorchan: {
    primary: { name: 'Ionágyúk', kind: 'bolt', color: '#ffcf7a', shots: 2, origins: [[36, 0]] },
    special: { name: 'Plazmagyorsító', kind: 'plasma', color: '#ff6a3d', mult: 2.2, cd: 3, origins: [[36, 0]], desc: 'lassú, izzó plazmagömb' },
  },
  altarian: {
    primary: { name: 'Ionágyúk', kind: 'bolt', color: '#ffcf7a', shots: 2, origins: [[50, -3.5], [50, 3.5]] },
    special: { name: 'Ion-sortűz', kind: 'pulse', color: '#ffe08a', shots: 8, mult: 1.8, cd: 3, origins: [[50, -3.5], [50, 0], [50, 3.5]], desc: 'gyors ionlövedék-zápor' },
  },
  centcarrier: {
    primary: { name: 'Ionágyúk', kind: 'bolt', color: '#ffcf7a', shots: 3, origins: [[50, -6], [50, 0], [50, 6]] },
    special: { name: 'Sentri vadászraj', kind: 'swarm', color: '#ffd27a', mult: 2.0, cd: 4, origins: [[43, 0]], desc: 'a hangárból kirajzó vadászok' },
  },
  earth: {
    primary: { name: 'Impulzuságyúk', kind: 'pulse', color: '#ffa860', shots: 3, origins: [[54, -2.5], [53, 3.5]] },
    special: { name: 'Nehéz lézerágyú', kind: 'beam', color: '#ff3b3b', mult: 2.2, cd: 3, origins: [[49, 0]], desc: 'vörös, folytonos nehézlézer-sugár' },
  },
  hyperion: {
    primary: { name: 'Impulzuságyúk', kind: 'pulse', color: '#ffa860', shots: 3, origins: [[55, -2], [55, 2]] },
    special: { name: 'Nehéz lézerágyú', kind: 'beam', color: '#ff3b3b', mult: 2.0, cd: 3, origins: [[49, 0]], desc: 'vörös, folytonos nehézlézer-sugár' },
  },
  nova: {
    primary: { name: 'Plazmaágyúk', kind: 'plasma', color: '#ff9a4d', shots: 2, origins: [[10, -7.5], [-2, 8]] },
    special: { name: 'Teljes sortűz', kind: 'pulse', color: '#ffb070', shots: 10, mult: 2.0, cd: 3, origins: [[10, -7.5], [-2, 8], [-14, -7.5], [-26, 8], [-38, -7.5]], desc: 'minden lövegtorony egyszerre tüzel' },
  },
  starfury: {
    primary: { name: 'Impulzusfegyverek', kind: 'pulse', color: '#ffb070', shots: 3, origins: [[8, -16], [8, 16]] },
    special: { name: 'Rakéták', kind: 'missile', color: '#ffffff', shots: 2, mult: 1.8, cd: 3, origins: [[0, -10], [0, 10]], desc: 'ívelő pályájú rakétapár' },
  },
  raidergunship: {
    primary: { name: 'Toldott lézerágyúk', kind: 'pulse', color: '#ff7b4a', shots: 3, origins: [[30, -4], [30, 4]] },
    special: { name: 'Rakétasortűz', kind: 'missile', color: '#ffffff', shots: 3, mult: 1.8, cd: 3, origins: [[10, -8], [10, 8]], desc: 'három ívelő rakéta egyszerre' },
  },
  raiderinterceptor: {
    primary: { name: 'Ikerlézerek', kind: 'pulse', color: '#ff4d5e', shots: 2, origins: [[30, -9], [30, 9]] },
  },
  raiderwagon: {
    primary: { name: 'Lövegtornyok', kind: 'bolt', color: '#ffa060', shots: 2, origins: [[40, -10], [40, 10]] },
    special: { name: 'Kalóz vadászraj', kind: 'swarm', color: '#ff6b5a', mult: 2.0, cd: 4, origins: [[46, 0]], desc: 'a hangárból kirajzó Delta-V vadászok' },
  },
  raider: {
    primary: { name: 'Impulzuslézerek', kind: 'pulse', color: '#ff4d5e', shots: 2, origins: [[30, 0]] },
  },
  drazi: {
    primary: { name: 'Részecskeágyú', kind: 'pulse', color: '#c4ff4d', shots: 3, origins: [[50, -6]] },
    special: { name: 'Részecskesugár', kind: 'beam', color: '#9dff3d', mult: 1.9, cd: 3, origins: [[50, -6]], desc: 'zöld részecskesugár' },
  },
  shadowscout: {
    primary: { name: 'Szeletelő sugár', kind: 'beam', color: '#c060ff', origins: [[24, 0]] },
    special: { name: 'Tüskesorozat', kind: 'pulse', color: '#e070ff', shots: 6, mult: 1.8, cd: 3, origins: [[24, -6], [24, 6], [20, 0]], desc: 'gyors, lila energiatüskék zápora' },
  },
  shadow: {
    primary: { name: 'Szeletelő sugár', kind: 'beam', color: '#b040ff', origins: [[11, 0]] },
    special: { name: 'Teljes erejű szeletelő sugár', kind: 'beam', wide: true, color: '#ff40d0', mult: 2.4, cd: 3, origins: [[11, 0]], desc: 'mindent átvágó, vastag lila sugár' },
  },
};
const STATION_WEAPON = { name: 'Védelmi rács', kind: 'pulse', color: '#ffd166', shots: 3 };
