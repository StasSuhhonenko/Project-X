# Project-X independent demo

This small demonstration supplies independently authored ships, systems, artwork
and rules. It supports flight, combat, repair, trading, travel and browser/file
saves. It is an example module rather than a complete game.

From the Project-X root, use Node.js 24 to install and run:

```powershell
npm ci
npm run dev
```

Edit the flight identity if desired, then choose **Start survey flight** or
another starting scenario. Use the arrow keys to fly and the displayed panels
to interact, select destinations and travel. Save and load through the browser
save controls.

**Start signal weaving** launches a nonlethal interference ring with Space. It
reveals patrols and repeatedly refreshes a short engine hold; motion resumes
after the hold expires. The ring uses independently authored geometry, continuous
opacity and survey timing. **Start veiled survey** toggles the player's veil with
Space; disabling it is free. **Start tether survey** resets the selected patrol's
speed on four alternating ticks. Each vessel carries its device in the primary
slot. Active fields, target identity, scan progress and statuses survive saves;
committed travel clears local fields, while a failed arrival restores them.

Build and preview with:

```powershell
npm run build
npm run preview
```

The explicit module commands also work:

```powershell
npm run module -- demo dev
npm run module -- demo build
npm run module -- demo preview
```

Build output is `dist/demo`. Serve its contents at the web server root.
Existing saves must be compatible with the current build.

## Developer navigation

`rules.ts` supplies independent navigation/combat/travel policy; `repair.ts` and
`station-membership.ts` own focused service/lifecycle behavior. `special-devices.ts`
owns the authored nonlethal device policies. The three
`*-presentation.tsx` entrypoints compose shared controls and selected screens.
`client.tsx` explicitly assembles the React UI and Three.js spatial adapter.
`public/game/module.json` contains gameplay definitions and authoritative local
geometry. `public/game/spatial.json` contains the independently validated camera,
colors and model mapping; `assets/models/survey-wedge.glb` is an original local
model. The angled presentation maps planar x/y onto the model's ground plane;
decorative height and camera settings never change collision or saved gameplay.
The paired-survey test
beside the rules exercises the contrasting lifecycle example. Development
tools/tests are optional normal-build inputs. See the shared
[runtime navigation](../../src/README.md) for state, commands and rendering.

The Survey outfitting panel supports station equipment purchases, assigning
owned copies to three firing slots, clearing slots and recycling equipment.
Space, Z and X fire slots 1, 2 and 3. Purchases cost 3 credits and recycling
returns 2 credits. Equipment and individual reloads survive save/load.

The browser uses one host frame loop for the Three.js view. The model is prepared
before travel or refit commits; loading failures permit retry without partial
payment. Current saves require format 10 and the matching module version.
Development-only generators and preserved 2D renderer fixtures are optional
inputs; normal builds use reviewed JSON and GLB files.

The cargo hold has three positions. Select an observatory to buy or sell goods
at its generated market prices; commodity sales are linear. The independent
resource exchange converts fuel to credits. Cargo, markets and balances survive
save/load, and cargo remains aboard through travel and refit.
