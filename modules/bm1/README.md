# Broken Mirror for Project-X

This module is an in-progress browser port of Broken Mirror, using its original
artwork and interface. It currently supports flight, target selection, combat,
planet and station interactions, delivery contracts, away-team missions, repair, cargo trading, equipment, ship refit, interstellar
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
Use a planet's **Trade** control or a station's cargo mission listing to accept
a delivery. Stations allow one negotiation per offer. At the destination, overlap
the planet and use **Transport** or **T** to deliver cargo or send an away team.
Select an overlapping ship below 5% combined hull and shields and use the same
command to board it. Your team may pillage latinum, salvage a weapon, capture
the ship into your fleet, or trigger its self-destruct. Capture requires a hull
at least as large and 100 Engineering plus 100 Away Team experience.
Hail an owned ship with **H** or a second click to add it to the Fleet panel.
Fleet pointer orders apply to the selected ships; numeric keys **1–4** apply
to owned ships in the original slot scan (which skips the first ship allocated
after the stations). **1** escorts and follows on the next
jump; **2** attacks your target; the original **3** also attacks, despite its
seek notice; **4** gathers at the planet. The panel's Seek button issues the
distinct seek order. **5** launches stored craft, **6** recalls nearby small
craft if your hull is size 5 or larger. **7/8** record explore/trade missions;
mission results are deferred. Stored Craft opens the shuttlebay report.
The browser controls provide **Saves and menu** and **Full screen**.

**F8** opens the original cheat console. Enter an exact lowercase code and click
Submit: `maxlat`, `inclat`, `maxdur`, `imgood`, `imbad`, `youhateme`, `youloveme`,
`everyonelovesme`, `allknowing`, or `ilovetocheat`. Enter inserts a line break;
only the button submits. Every submission closes the console, including unknown
text. `ilovetocheat` sets latinum/deuranium to 999,999, navigation/away-team/
engineering/tactical experience to 1000, and current-system prestige to 100.
These values persist in saves. Government-changing codes await ownership/conquest.

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
`ui/` (cheat, contact, commerce, communication, entry, equipment, fleet, HUD, map, repair, shipyard, tactical, travel, terminal
and viewport); controllers own transient navigation, read models own display
facts, and presentations own ink/interactions. Shared state and commands live
in the engine; see [runtime navigation](../../src/README.md).

`public/game/` and `runtime-asset-paths.json` are reviewed generated snapshots.
`client.tsx` explicitly binds the Pixi adapter and the original React presentation.
`public/game/spatial.json` holds image/camera data separately from gameplay and
collision geometry in `module.json`. Current saves require format 18 and matching
module versions.
`fleet-order-rules.ts` owns C12 order/mission declarations and recall geometry;
`ui/fleet/` owns command dispatch, the transient eleven-slot Zustand selection,
source portraits and read-outs. The [C12 plan](docs/features/c12-fleet-orders/C12_FLEET_ORDERS_PLAN.md)
links the exact source evidence and accepted adaptations. Explicit UI preparation
is `node modules/bm1/ui/fleet/prepare-fleet-content.cjs` (writes `ui/fleet-data.json`)
and `node modules/bm1/ui/prepare-hud-assets.cjs` (controls/hints); builds consume
reviewed snapshots and do not run recovery.
Content adapters validate prepared data before use. The complete development
workspace also includes recovery tools, source assets, provenance and tests.
Its [documentation index](docs/README.md) and [code navigation](docs/CODE_NAVIGATION.md)
cover those private inputs, which are
optional for normal builds. Module tests use `tests/` and colocated UI tests.
