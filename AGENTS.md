# AGENTS.md — Apu Tetris

> Ez a fájl az AI ágensek (és fejlesztők) számára tartalmaz minden lényeges információt a projektről.

---

## 1. Projekt célja

**Apu Tetris** egy reklám­mentes, mobilra telepíthető Tetris-játék, amelyet kifejezetten egy apunak készítettünk.  
Célja: egyszerű, szép, zavaró hirdetés nélküli szórakozás – böngészőből és telefonra telepítve egyaránt.

---

## 2. Technológiai stack

| Réteg | Technológia |
|-------|-------------|
| Struktúra | Vanilla HTML5 (`index.html`) |
| Stílus | Vanilla CSS (`style.css`) – neon dark theme |
| Logika | Vanilla JavaScript ES2022+ (`game.js`) |
| PWA | Web App Manifest (`manifest.json`) + Service Worker (`sw.js`) |
| Hosting | GitHub Pages (statikus, 0 Ft/hó) |
| Ikonok | `icon-192.png`, `icon-512.png` |

**Keretrendszer nincs** – szándékos döntés, hogy minimális a függőség, gyors a betöltés.

---

## 3. Fájlstruktúra

```
apu-tetris/
├── index.html        # Fő HTML oldal (PWA meta tagek, layout, overlays)
├── style.css         # Neon dark téma, responsive, animációk
├── game.js           # Teljes Tetris motor (engine, input, PWA install)
├── sw.js             # Service Worker (offline cache)
├── manifest.json     # PWA Web App Manifest (Android telepítés)
├── icon-192.png      # PWA ikon 192×192
├── icon-512.png      # PWA ikon 512×512
├── AGENTS.md         # Ez a fájl
└── README.md         # Felhasználói dokumentáció
```

---

## 4. Játékmechanika

### Tetromino-k (7 féle)
`I`, `O`, `T`, `S`, `Z`, `J`, `L` – a klasszikus Tetris-készlet.

### Véletlenszerűség
**7-bag randomizer**: minden 7 elem tartalmaz egyet minden darabból, véletlenszerű sorrendben. Sosem fordul elő, hogy sokat kelljen várni egy bizonyos darabra.

### Forgatás
**SRS (Super Rotation System)** wall-kick táblázatokkal – azonos a modern Tetrisek szabványával.

### Pontozás
| Törölt sorok | Alappont |
|---|---|
| 1 sor | 100 × szint |
| 2 sor | 300 × szint |
| 3 sor | 500 × szint |
| 4 sor (Tetris!) | 800 × szint |
| Puha esés | +1/cella |
| Kemény esés | +2/cella |

### Szintek
Minden **10 törölt sor** után eggyel nő a szint, és gyorsul az esés.  
Minimális esési sebesség: 80 ms/cella.

### Ghost piece
Halvány árnyék mutatja, hova esne a darab – segíti a döntést.

---

## 5. Vezérlők

### Billentyűzet
| Gomb | Funkció |
|------|---------|
| ← / → | Mozgatás balra / jobbra |
| ↓ | Puha esés |
| ↑ | Forgatás jobbra |
| Z | Forgatás balra |
| Szóköz | Kemény esés |
| P / Esc | Szünet |

### Érintővezérlők (mobilon)
- **Képernyő alatti 4 nagy gomb (idősbarát, extra nagy érintőfelület):**
  - `🔄 FORGATÁS` – széles, felső sáv (bármelyik hüvelykujjal könnyen elérhető)
  - `◀ BAL` – balra mozgatás (hosszan nyomva folyamatos)
  - `▼ LE` – puha esés / gyorsítás (hosszan nyomva folyamatos)
  - `▶ JOBB` – jobbra mozgatás (hosszan nyomva folyamatos)
- **Jobb oldali gombok (oldalpanelben, véletlen lenyomástól védve):**
  - `⏸ Szünet` – játék megállítása és szünet menü megnyitása
  - `🔁 Újra` – új játék indítása (aktív pontszám esetén megerősítést kér)
- **Gesztusok:**
  - **Csúsztatás** balra/jobbra: mozgatás
  - **Csúsztatás** le: puha esés
  - **Koppintás** a táblán: forgatás

---

## 6. PWA — Androidos telepítés

A játék **Progressive Web App (PWA)**, ami azt jelenti:

1. A böngésző (Chrome/Edge Android) automatikusan felajánlja a telepítést.
2. A `manifest.json` konfigurálja az alkalmazás nevét, ikonját, megjelenítési módját.
3. A `sw.js` service worker **offline is elérhetővé** teszi (cache-eli az összes fájlt).
4. Telepítés után a játék **app-szerűen** nyílik meg (fullscreen, státuszsor nélkül).

### Hogyan telepítsd Androidon:
1. Nyisd meg a GitHub Pages URL-t Chrome-ban.
2. A „Telepítés" sáv automatikusan megjelenik alul – koppints rá.
3. Vagy: Chrome menü → „Hozzáadás a kezdőképernyőhöz".

---

## 7. GitHub Pages üzembe helyezés

```bash
# 1. Klónozás / navigálás
git clone https://github.com/marosgergo/apu-tetris.git
cd apu-tetris

# 2. Commit és push
git add .
git commit -m "feat: Apu Tetris PWA – reklámtalan, androidos"
git push origin main

# 3. GitHub Settings → Pages → Source: main branch / root (/)
# 4. Elérhető: https://marosgergo.github.io/apu-tetris/
```

> [!IMPORTANT]
> A service worker csak **HTTPS**-en működik. A GitHub Pages automatikusan HTTPS-t ad,
> ezért telepíteni is csak onnan lehet (nem `http://`-ről).

---

## 8. Fejlesztési irányelvek ágenseknek

- **Nincs reklám** – semmilyen ad-network scriptet nem szabad behúzni.
- **Nincs külső tracking** – Google Analytics, Facebook Pixel és hasonlók tilosak.
- **Offline-first** – minden asset a `sw.js` cache listájában kell legyen.
- **Mobil-first** – a CSS és a layout elsősorban mobil méretekre optimalizált.
- **Nincs keretrendszer-függőség** – csak vanilla HTML/CSS/JS megengedett.
- Ha új fájl kerül a projektbe, add hozzá az `sw.js` `ASSETS` tömbjéhez is.
- A pontozás, szintek és fizika az eredeti Tetris-szabványokat kövesse (Tetris Guideline).

---

## 9. Ismert korlátok / jövőbeli fejlesztési ötletek

- [ ] Lokális highscore-lista (localStorage)
- [ ] Több következő darab megjelenítése (queue: 5 db)
- [ ] Hangeffektek (Web Audio API)
- [ ] Különböző témák / színsémák
- [ ] T-spin detekció és bónuszpont
- [ ] Multiplayer (WebSocket / WebRTC)
- [ ] iOS Safari „Add to Home Screen" prompt (manuális, Safari nem támogatja a `beforeinstallprompt`-ot)
