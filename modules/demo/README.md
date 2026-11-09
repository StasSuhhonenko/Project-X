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
payment. Current saves require format 13 and the matching module version.
Development-only generators and preserved 2D renderer fixtures are optional
inputs; normal builds use reviewed JSON and GLB files.

The cargo hold has three positions. Select an observatory to buy or sell goods
at its generated market prices; commodity sales are linear. The independent
resource exchange converts fuel to credits. Cargo, markets and balances survive
save/load, and cargo remains aboard through travel and refit.

Pathfinding and Fieldcraft start at zero, alongside the Journeys tally. Each
accepted journey adds 2 Pathfinding, a seeded fractional Fieldcraft gain and
1 Journey. Weft Basin requires 2 Pathfinding, so visit another system first.
Only travel grants progression in this example. Progression and its dedicated
random stream survive travel, vessel replacement and saves.

`mission-rules.ts` adds independent survey deliveries: six tons of Survey
Crystals, three credits per accepted ton, carried to Lumen or Weft Basin. The
Survey deliveries panel accepts the planet offer, lists fixed payments and
transports a shipment or team when within 500 world units of the planet.
Start **Paired survey**, accept its shipment and travel to Lumen to deliver it.
Transport again to repair a weather sensor and gain one Lumen standing point;
later transports show a quiet-walk fallback with no further reward. Only Lumen
has this surface task; other systems use the fallback. No stations offer survey
contracts. Mission events award no captain experience in this example.
Offers, accepted contracts, fixed payments and the pending surface task survive
save/load without rerolling; a new visit creates a fresh offer/task. Contract
cargo cannot be market-sold or enlarged by ordinary purchases. Package 0.28.0
uses Rules25/save15. `spatial-source.json` and `three-spatial-source.json` are
the authoring inputs for `node modules/demo/tools/prepare-spatial.cjs`; builds
consume their reviewed gameplay/spatial snapshots. The separate Pixi test
fixture carries the same package version.

`encounter-rules.ts` adds independent visit traffic at every start and arrival:
one or two survey ships, with Survey Cooperative and Outer Settlements allegiance.
A count draw precedes two coordinate draws per ship; positions lie within 200
world units of the planet on each axis. The first visitor targets the first live
station when present, otherwise the planet; the second targets the planet.
The engine allocates IDs and independent navigation streams before equipment,
markets and missions, so visitors receive the normal survey-crystal ship market.
Save/load preserves the realized visitors without rerolling; returning to a
system replaces them with a fresh visit. This is original example policy, not a
reconstruction of another module's encounter distribution.

The optional warning-patrol decision rule challenges nearby uncloaked players when
local district standing is negative; targeted player emissions also provoke a
response. Its independent nonlethal beam drains shields on an eight-tick cadence,
consumes only its actor stream, and persists its combat timer across saves.
Rules API24/save14 add required NPC combat history and captured beam events.

Rules25/save15 extend ship settlement to NPC crossfire and save one sticky blame
bit in combat history. The independent arbitration example lets larger survey
craft challenge foreign traffic within a circular radius. Their archive beam
can retire hull (ordinary size-one survey pulses remain shield-only). A retired
ship archives one final journey in the existing `journeys` tally, without
standing/strength changes, replacements, experience or captain-stream draws.
The focused example supplies larger craft through authored test content and
verifies beam damage, retirement and exactly one tally increment.

Rules26/save16 adds an independent marker example: a combat courier using
weapon102 emits a survey marker on a twenty-tick cadence; when below25 percent
strength it emits its final marker and departs. A combat platform marks its
selected NPC traffic target with the same projectile. Platform-to-player combat
remains unconfigured in this example. The example test explicitly supplies the
traffic target and damaged courier; it checks stable shot order, saved orphaned
shots and departure without lifecycle or progression outcomes.
