# MapGame 🗺️

A family road-trip game: spot license plates, tap the state on the map, watch it
fill in with your color. Built for the cruise drive — works fully offline.

## What it does

- **Tappable maps** — all 50 US states + DC outline, all 13 Canadian
  provinces/territories. Single tap marks a plate spotted, **double tap undoes**.
- **Family play** — add each family member with their own color (kids pick their
  own). Tap 👥 to manage members and to tell the app which person is using
  *this* device.
- **Combined vs Individual** — Combined fills every spotted state one blue;
  Individual fills states with each spotter's color, blending into a gradient
  when two or more people spotted the same state.
- **Viewer dropdown** — "Whole group" shows everyone's spots together, or pick
  one person to see just theirs.
- **Trip dropdown** — create and switch between trips (e.g. "Cruise Drive 2026").
  Each trip keeps its own members and map.
- **Europe** — one bucket (no per-country map): a big counter card with +1 and
  Undo buttons.
- **Always-visible top bar** — title + live counter/progress, region toggle
  (US | Canada | Europe), trip dropdown, viewer dropdown, color-mode toggle.
- **Offline-first** — service worker caches the whole app; keeps working in
  dead zones. Everything saves to the phone's localStorage automatically.

## Run it locally

Any static server works (plain file-open won't load the maps, browsers block
that):

```bash
cd mapgame
python3 -m http.server 8123
# open http://localhost:8123/
```

## Put it on your phone today

1. Upload this folder's contents to the **jonlarson22/MapGame** repo
   (everything at the repo root, not in a subfolder).
2. In the repo: **Settings → Pages → Deploy from branch → main → /(root)**.
3. On your phone's Chrome, open
   `https://jonlarson22.github.io/MapGame/`, then **⋮ → Add to Home screen**.
   It installs like an app and works offline after the first open.

Each family member opens the same link on their own phone, adds themselves
under 👥, and taps their name under "This device is". (Shared live sync across
phones comes with the Firebase step below — for today, each phone keeps its own
game, which is fine for the back seat.)

## Files

| File | What it is |
|---|---|
| `index.html` | App shell: top bar, map area, Europe card, popups |
| `styles.css` | All styling, mobile-first |
| `app.js` | UI logic: taps, rendering, gradients, popups |
| `store.js` | Game data + saving. **This is the Firebase seam** (below) |
| `maps/us.svg`, `maps/ca.svg` | State/province shapes, one `<path>` per region |
| `manifest.json`, `sw.js` | PWA install + offline cache (bump `CACHE` in sw.js when files change) |
| `icons/` | App icon (SVG wrapping the plate graphic; PNGs can't ride the snapshot push, the SVG renders identically) |
| `README.md` | This file |

## Map credit

State/province shapes © [amCharts](https://www.amcharts.com/svg-maps/)
(Albers USA projection for the US map), used under **CC BY 4.0** — credit kept
in the app's Family panel and here. DC is drawn but not playable (the game
counts the 50 states).

## Firebase sync (later)

The app is built with a clean seam so live family sync drops in without
rewriting the UI:

- `store.js` exports `createStore(storage)`; `app.js` only ever calls the
  store's methods (`addSpot`, `removeSpot`, `onChange`, …) — it never touches
  localStorage or Firebase directly.
- To add sync: create the Firebase project, hand over the `firebaseConfig`,
  and I'll write a `FirestoreStore` with the **same method names**. Spots map
  1:1 to Firestore documents (`trips/{trip}/spots/{region}_{code}_{memberId}`),
  and remote changes flow through the existing `onChange` callback, so every
  phone re-renders live. No Firebase config or credentials are in this repo.

## V1 notes / known limitations

- Tiny states (Rhode Island, PEI…) are hard to tap at full-map size — pinch to
  zoom in, then tap.
- Double-tap is yours for undo; the browser's double-tap-zoom is disabled on
  the map (`touch-action: manipulation`).
- Removing a member keeps their old spots on the map (shown in gray).
- No sound effects yet — the kids will provide those themselves.
