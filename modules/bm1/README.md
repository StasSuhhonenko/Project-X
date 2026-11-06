# Broken Mirror for Project-X

This module is an in-progress browser port of Broken Mirror, using its original
artwork and interface. It currently supports flight, target selection, combat,
planet and station interactions, repair, a merchant transaction, interstellar
travel and browser/file saves. Full original gameplay remains unfinished.

From the Project-X root, install dependencies with Node.js 24 and start BM1:

```powershell
npm ci
npm run module -- bm1 dev
```

Choose **New Game**, select a starting character, then choose **Select** and
**Engage**. Use the arrow keys to control flight. Click a planet or station to
hail it, or a ship to select it. Use the interstellar map to travel. Equipment vendors show available devices
in their station panel. Use the numbered HUD controls to choose a firing slot,
then click an owned item to load it. Space, Z and X fire slots 1, 2 and 3.
The planet's Sell panel lists owned weapons and devices.
The browser controls provide **Saves and menu** and **Full screen**.

To build and preview:

```powershell
npm run module -- bm1 build
npm run module -- bm1 preview
```

Build output is `dist/bm1`. Serve its contents at the web server root.

The current build includes 48 ordinary systems. Some mechanics and interface
actions remain unavailable, and capabilities vary by starting vessel. Existing
saves must be compatible with the current build; older formats are rejected.

## Developer navigation

`rules.ts` is the rule entrypoint; focused root files own weapons, repair, travel
and station lifecycle. `entry-presentation.tsx` and `gameplay-presentation.tsx`
compose the selected interface. Maintained UI code is grouped by feature under
`ui/` (contact, commerce, communication, entry, equipment, HUD, map, repair, shipyard, tactical, travel, terminal
and viewport); controllers own transient navigation, read models own display
facts, and presentations own ink/interactions. Shared state and commands live
in the engine; see [runtime navigation](../../src/README.md).

`public/game/` and `runtime-asset-paths.json` are reviewed generated snapshots.
`client.tsx` explicitly binds the Pixi adapter and the original React presentation.
`public/game/spatial.json` holds image/camera data separately from gameplay and
collision geometry in `module.json`. Current saves require format10 and matching
module versions.
Content adapters validate prepared data before use. The complete development
workspace also includes recovery tools, source assets, provenance and tests.
Its detailed guide is `docs/CODE_NAVIGATION.md`; those private inputs are
optional for normal builds. Module tests use `tests/` and colocated UI tests.
