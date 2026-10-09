# Babylon 5 – Defend The Station (modern kiadás)

Körökre osztott űrcsatás védekezős játék. Az eredeti egyetemi projekt (C#, x86, Tóth Gábor András)
újragondolt, böngészőben futó változata. Telepítés és internet nélkül is működik.

## Indítás

- **Online / mobilon:** a GitHub Pages címen (lásd lent); telefonon a böngésző menüjéből „Hozzáadás a kezdőképernyőhöz”
  → teljes képernyős, offline is futó alkalmazás. Fekvő tájolásban a legkényelmesebb.
- **Asztali gépen:** dupla kattintás az `index.html`-re (vagy az `Inditas.bat`-ra). dupla kattintás az `index.html`-re (vagy az `Inditas.bat`-ra).
- **Szerverrel (opcionális):** `node serve.js`, majd http://localhost:5500

Mentések, ranglista és beállítások a böngésző helyi tárolójában (localStorage) maradnak meg.

**Nyelv:** magyar és angol – a Beállításokban váltható (alapból a böngésző nyelvét követi).

## Játékmenet röviden

- Kezdésként egy **Fehércsillagod** van. Ugrópontokból egyre erősebb ellenséges hullámok érkeznek.
- Kiválasztod a saját hajódat és a célpontot, majd a **testet** vagy egy **alrendszert** lövöd
  (fegyverzet, szenzorok, hajtómű, reaktor). A megtámadott hajó visszalő, rád vagy (inkább) az állomásra.
- Ha minden hajód lőtt, a maradék ellenség is tüzel, utána az állomás védelmi rácsa lő.
- **Elfoglalás:** a kilőtt reaktorú (vagy fegyverzet + hajtómű nélküli) hajó elfoglalható.
  A siker esélye a test sérültségétől függ; ha nem sikerül, azt a hajót csak a következő körben lehet újra megpróbálni.
  A szövetséges hajók azonnal átvehetők.
- Hullámok között **bolt**: javítás, hajófejlesztés (5 szint), új hajók, **leszerelés** (a hajó kreditért kikerül a flottából,
  nem semmisül meg), állomásfejlesztések – köztük az **Irányító központ**, ami szintenként +1 hajóhelyet ad (6 → max. 10).
- **Fegyverek:** minden hajónak van elsődleges fegyvere (minden körben lő) és legtöbbjüknek különleges fegyvere
  (erősebb, de pár körig töltődik, `G`). Pl. a Fehércsillag szárnyágyúi impulzusokat, az orr fő ágyúja folytonos zöld
  sugarat lő; a földi hajók nehézlézere vörös sugár, a Vorchané plazmagömb, a Starfuryé rakéta, a csatahordozóé vadászraj.
- **Szövetségesek** kék ugróponton, közvetlenül az állomás mellett érkeznek; az ellenség a narancsszínűn, messzebb.
- **Utolsó esély:** ha az állomás szerkezete 40% alá esik (akkor is, ha van még flottád),
  erős szövetséges erősítés ugrik be kék ugróponton: 2–3 Fehércsillag, egy Minbari Sharlin vagy az EAS Agamemnon.
  Utána egyre hosszabb ideig nem jöhet újra (6, majd 8, 10… hullám); a boltban látszik, mikor lesz újra elérhető.
- Minden 5. hullámban **Árny cirkáló** érkezik – az Árny hajókat soha nem lehet elfoglalni, csak elpusztítani.
  Az Árny hajók soha nem keverednek más fajjal: egy vagy több cirkáló, egy cirkáló felderítőkkel, vagy csak felderítők.
- Az első öt hullám egyikében (3. vagy 4.) biztosan jön egy **ellenséges Minbari cirkáló**; az első Árny hajó után
  a Minbarik már csak szövetségesként érkeznek.
- **Szövetségesek** az 5. hullámtól, ~30% eséllyel érkeznek kék ugróponton az állomás mellé (ritkán kettő is).
  Amíg nem veszed át őket, minden kör végén önállóan lőnek az ellenségre.
- **Kereskedő konvoj:** a 3. hullámtól ~15% eséllyel harc helyett kereskedők érkeznek (kék ugrópont): kreditet hoznak,
  50%-ot javítanak a hajókon, az állomás hiányzó szerkezetének 30%-át pótolják, majd harc nélkül továbbállnak.
- **Gazdaság:** a kreditbevétel a hullámszámmal nő (képletek: `js/data.js` → `ECON`).
- **Árnyékflotta:** a 10. hullámtól időnként csak Árny hajók támadnak – Árny cirkálók és a kisebb, gyengébb **Árny felderítők**.
- **Pontozás hajótípusonként:** 45 (Starfury) és 800 (Árny cirkáló) között – a pontos értékek a játék súgójában
  és a hajókatalógusban láthatók. Elfoglalásért ennek 1,5-szerese jár, plusz hullámbónusz – a nehézségi szorzóval.
- Ha az állomás elesik: pusztulási jelenet, pontszám, ranglista.

## Mi új az eredetihez képest

| Eredeti doksi | Modern kiadás |
|---|---|
| Statikus képek | A sorozatbeli hajók sziluettjeit követő, kódból rajzolt animált hajók (Fehércsillag, Sharlin, G'Quan, Primus, Vorchan, Altarian, csatahordozó, Omega, Nova, Hyperion, Starfury, Delta-V, Napsólyom, Árny cirkáló, Árny felderítő), lézerek, robbanások, ugrópontok |
| Videó az állomás pusztulásáról | Valós idejű, kihagyható pusztulási jelenet |
| 100 pont minden hajóért | Típusfüggő pontérték (45–800) |
| Hajótípusok (6) | A doksi 6 típusa az eredeti értékekkel + Centauri Vorchan, Altarian romboló és csatahordozó, Földi Hyperion, Nova és Starfury, Drazi napsólyom, Árny cirkáló (főellenség) és Árny felderítő – 15 típus (+ civil kereskedő) |
| Egyszerű MI (testre lő, inkább az állomásra) | Nehézségtől függő MI: célzott alrendszer-lövés, a leggyengébb hajó kiszemelése, képességek |
| Javítás/fejlesztés gombok | Teljes bolt: részleges/teljes javítás, szintlépés, hajógyár, leszerelés, 4 állomásfejlesztés |
| Mentés / betöltés | 3 mentési hely + automatikus mentés minden kör elején |
| Ranglista | Top 15, nehézségi szint és dátum szerint |
| — | 4 nehézségi szint, hajónkénti különleges képességek, kritikus találatok, kitérés |
| — | Szintetizált hangok és ambient zene, billentyűparancsok, reszponzív felület |

## Billentyűk

`1–5` támadás (test / fegyverzet / szenzorok / hajtómű / reaktor) · `Q`/`E` saját hajó ·
`A`/`D`/`Tab` célpont · `G` különleges fegyver · `F` képesség · `C` elfoglalás · `Space` kör vége · `L` napló lenyitása · `Esc` menü

## Felépítés

```
index.html      felület váza
style.css       megjelenés
js/i18n.js      magyar és angol szövegek, nyelvváltás
js/data.js      hajótípusok, nehézség, fejlesztések (a doksi alapértékei)
js/audio.js     WebAudio hangeffektek és zene
js/render.js    Canvas grafika és effektek
js/game.js      játéklogika, MI, hullámok, bolt, mentés
js/ui.js        HUD és képernyők
js/main.js      indítás, fő ciklus, bemenet
serve.js        opcionális mini szerver
```

Nem kereskedelmi rajongói projekt. A Babylon 5 a Warner Bros. védjegye.

## Közzététel GitHub Pages-en

1. GitHubon hozz létre egy üres, nyilvános tárolót (pl. `b5-defend-the-station`).
2. Ebben a mappában: `git remote add origin https://github.com/<felhasználónév>/b5-defend-the-station.git`,
   majd `git push -u origin main`.
3. A tárolóban: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`** → Save.
4. Pár perc múlva elérhető: `https://<felhasználónév>.github.io/b5-defend-the-station/`

Frissítéskor a `sw.js`-ben érdemes növelni a `VERSION` értékét, hogy a telepített változat is frissüljön.
Az alkalmazásikonok újragenerálása: `node tools/make-icons.js`.
