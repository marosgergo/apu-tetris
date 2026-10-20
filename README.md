# 🧱 Apu Tetris

> **Reklámtalan Tetris apunak – webes és androidos telepíthető app.**

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen?logo=github)](https://marosgergo.github.io/apu-tetris/)
[![PWA Ready](https://img.shields.io/badge/PWA-Telepíthető-blue?logo=pwa)](https://marosgergo.github.io/apu-tetris/)
[![Zero Ads](https://img.shields.io/badge/Reklám-0%20db-red)](https://marosgergo.github.io/apu-tetris/)

---

## 🎮 Miért ez a Tetris?

Mert **nincs benne egyetlen reklám sem.** Sem banner, sem videó, sem pop-up, sem semmi.  
Csak a játék. Ahogy lennie kell.

---

## 🚀 Elérhetőség

**👉 [marosgergo.github.io/apu-tetris](https://marosgergo.github.io/apu-tetris/)**

---

## 📱 Androidos telepítés

1. Nyisd meg a fenti linket **Chrome**-ban Android telefonon
2. Az oldal alján megjelenik: **„Telepítés"** gomb – koppints rá
3. A játék megjelenik a kezdőképernyőn, mint egy rendes app
4. **Offline is játszható** – nincs szükség netre!

> iOS Safari esetén: Chrome menü → „Hozzáadás a kezdőképernyőhöz"

---

## 🕹️ Vezérlők

### 🖥️ Számítógépen (billentyűzet)

| Gomb | Funkció |
|------|---------|
| `←` `→` | Mozgatás |
| `↓` | Puha esés |
| `↑` | Forgatás jobbra |
| `Z` | Forgatás balra |
| `Szóköz` | Kemény esés (hard drop) |
| `C` | Hold – darab tartása |
| `P` / `Esc` | Szünet |

### 📱 Mobilon (érintővezérlők)

- **Csúsztatás balra/jobbra** – mozgatás
- **Csúsztatás le** – puha esés
- **Koppintás** a játéktéren – forgatás
- Képernyő alján gombsor: minden funkció elérhető

---

## ✨ Funkciók

- 🧱 **Teljes Tetris-motor** – SRS forgatás, 7-bag randomizer, ghost piece
- 👻 **Ghost piece** – látod, hova esik a darab
- 🤲 **Hold** – tartsd félre a darabot
- 📈 **Pontozás** – szint szerint növekvő pontok
- ⚡ **Szintek** – minden 10 sor után gyorsul
- 🌙 **Neon dark téma** – éjjel is kíméletes
- 📶 **Offline játék** – service worker cache
- 📲 **Androidos telepítés** – PWA manifest
- 🚫 **Nulla reklám** – örökre

---

## 🛠️ Fejlesztőknek

```bash
git clone https://github.com/marosgergo/apu-tetris.git
cd apu-tetris
# Egyszerűen nyisd meg az index.html-t egy lokális szerveren
# pl: npx serve . vagy python -m http.server 8080
```

**Stack:** Vanilla HTML + CSS + JavaScript – keretrendszer nélkül.  
Részletes dokumentáció: [AGENTS.md](AGENTS.md)

---

## 📄 Licensz

MIT – játssz, módosítsd, oszd meg. Csak a reklámokat ne add hozzá. 😄
