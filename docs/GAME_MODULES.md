# Project-X replaceable game modules

## Decision and scope

Project-X is a shared space-game engine with one selected local module.
The separation covers everything currently playable and staged for the first world:
content, starting states, resources, governments, system/planet definitions,
station placements, navigation rules, tick rate, title, viewport and visual assets.
It does not implement the remaining game features or establish original-game
parity. Existing source-derived movement regression tests remain with BM1.

The [Project-X development plan](CONVERSION_PLAN.md) coordinates shared and module
work. A module's own plan remains authoritative for its evidence, compatibility
uncertainties, detailed dependencies and acceptance criteria.

```text
src/                         Shared engine, schemas, state, UI and browser adapters
modules/
  demo/                      Newly authored example rules, data and SVG
  bm1/                       Compatibility rules, converter, provenance and tests
    public/game/             Generated module.json and assets/
analysis/                    Preserved recovery evidence, excluded from builds
dist/demo/                   Default browser distribution
dist/bm1/                    Separate compatibility distribution
```

Normal module commands live in root `module.cjs`; they need no `tools/` folder.
Vite selects maintained rules/client assembly and `public/game` snapshots without
running staging hooks. Production type checking excludes optional development
inputs. Tests use separate Vitest/development-TypeScript configuration.

Module TypeScript imports shared engine contracts and helpers through
`@engine/*`, mapped to `src/*` by TypeScript and Vite (and inherited by Vitest).
Shared engine files retain relative imports. The alias does not grant access to
the application store, another module or recovery tooling; source and emitted
graph audits enforce the same ownership rules for aliases and relative paths.

Public root/module READMEs describe installation, normal run/build commands,
controls and player-facing limitations. Internal recovery, staging, freshness
checks and acceptance procedures belong in project/module development documents.

In the complete development workspace, a module staging hook may accept
`--output-root DIRECTORY`, writing only `public/` and optional `provenance.json`
and `runtime-asset-paths.json`
under that directory while reading its normal source/evidence inputs. The generic
`check-artifacts` command uses an empty owned temporary directory and compares
filenames and SHA-256 hashes without repairing maintained artifacts. Module
tests invoke it before their suites when a staging hook exists. Recovery/preparation
changes require their relevant feature checks, explicit regeneration, diff review
and a passing freshness check before acceptance; normal builds intentionally do
not need evidence to prove freshness. Preserve original/frozen evidence separately.

Public artwork uses role folders and descriptive filenames. The selected module
owns naming and any source-to-public path map; shared rendering consumes validated
manifest paths without knowing entity names or recovery IDs. BM1's maintained
`runtime-asset-paths.json` resolves source-qualified UI keys to published URLs;
its staging and freshness checks own this generated index alongside public files.
The [BM1 asset layout](../modules/bm1/docs/presentation/ASSET_LAYOUT.md) records names, shared
planet art and the path-only compatibility boundary. Demo uses the same basic
ships/stations/planets organization with directly authored manifest paths.

## Ownership and contracts

The engine supplies scheduling, validated content catalogs, state ownership,
input commands, and rendering infrastructure. It contains no BM1 start IDs,
resource names, artwork paths, acceleration thresholds or game title.

Each module has `rules.ts` exporting a `GameRules` object and
`public/game/module.json` validated by `GameModuleSchema`. Module schema version23
contains gameplay definitions, authoritative `combatGeometry`, `gameplayZoomLevels`,
logical viewport dimensions, government/system records, starting encounters,
calendar and evidence-qualified map/arrival placements. It permits empty
positions in the six-slot planet offer tuple. Headless parsing and save validation
require no image manifest or spatial loader.

Each module also provides `client.tsx`, `spatial-presentation.ts` and a reviewed
`public/game/spatial.json`. The sole `selected-game-client` alias is imported by
main. Its entry factory returns `EntryPresentation`, `loadGameplay()` and
`dispose()`. Only content and entry code are needed to publish the menu/store.
`loadGameplay()` imports module-owned `gameplay-client` assembly, validates
matching module identity/version, adapter data and rendering coverage, and returns
`GameplayPresentation`, optional `TerminalPresentation` and `spatial` before any
scene, scheduler or gameplay input mounts. Both selected modules exercise this
same contract with their own renderers. Successful preparation is shared for the
page; failed preparation can retry, and page disposal releases late completions.
The host keeps save/recovery controls available during loading or failure and
ignores callbacks for replaced sessions. Configuration stays closed over by the
real renderer/UI consumers. A module may explicitly reuse generic presentations;
no implicit renderer fallback is supplied. [Loading acceptance](architecture/CLIENT_LOADING_2026-11-06.md)
records the contract, module cache isolation and measured scope.

Pixi's spatial schema owns entity/planet images, effect artwork, camera placement
and decorative star fields. Three's spatial schema owns a configured angled
camera, local model and the concrete forms/material choices used by its proof.
Neither schema enters shared gameplay. Pixi entity visuals may additionally
provide a finite positive uniform `scale` and per-axis `axisScale:{x,y}`;
omission keeps native sizing. Both multiply the source bitmap dimensions once.
Ship visuals may also specify an additional `playerScale`; omission means one.
Only the player role multiplies by that factor, preserving a different authored
NPC representation of the same definition without duplicating definitions.
`nativeSize` always describes integer bitmap dimensions. `entityVisualSize`
owns their conversion to logical dimensions for rendering, picking, selection
highlights and active/terminal spatial projections. Pivots are fractions of
those scaled bounds; no texture resampling or simulation-state change is needed.
Validation rejects overflowing scaled dimensions before content is published.
Rules API version24 includes optional NPC combat decisions/emission responses, visit encounters, equipment price/market policies, special-device/scan policies and projectile flight/motion policies alongside planet vessel purchase, focused player navigation, starting-encounter policy,
seeded NPC movement, primary-weapon eligibility, immediate hit policy, and
repair eligibility/progress, route estimates and destination-aware departure
eligibility. Rules API29 adds optional passive player shield recharge
(`rechargePlayerShields`) and an optional jump-arrival policy
(`createTravelArrival`, otherwise the authored static system `arrival`); an omitted
recharge member means shields never regenerate. A
module may also publish an optional view-only `visuals.shieldFlash` policy in its
spatial document; omitted, no actor flashes. Likewise an optional `visuals.departure`
policy draws a departing actor's warp-out; the matching simulation length is the
`durationTicks` its `decideNpcCombat` departure intent requests (Rules API33; zero
removes at once). The frozen departure context includes the validated
`destinationSystemId`; module policy owns its interpretation and access message.
Unimplemented progression must not be inferred from an absent save field.
`evaluateVesselPurchase` receives immutable current/offered definitions, current
system/standing, geometry, motion and balances. It returns a validated price,
separate minimum-balance guard and launch state, or refuses. Shared orchestration
verifies an actual six-slot planet offer, authoritative geometry support, cargo
capacity and all debits before publishing one replacement. Rendering coverage
and asset readiness belong to selected-client validation and scene preflight.
Fleet ownership requires its own
implemented contract. A module may omit this policy.
`getProjectileFlight` and `advanceProjectileMotion` are paired optional policies.
The former declares neutral cadence/lifetime/launch/impact parameters; the latter
returns position/rotation from frozen focused state. Shared code owns allocation,
collision, delayed once-only damage and save/restore. Pixi `visuals.weaponProjectiles`
declares flight/impact images, logical bitmap size and registration; pivots may
lie outside narrow streaks. These dimensions also define renderer-independent
art placement. Numeric `combatGeometry.projectiles` and entity rectangles own
collision independently of those images. Saved shots retain their launch vessel definition
across refits; arrival clears local shots and rollback restores them exactly.
`getSpecialWeapon` returns a Zod-validated cloak, pulse, target hold or deliberate
paid-no-effect policy. Pulse definitions require `selectSpecialEffectSlots`,
which receives frozen canonical actor/station slot facts and focused mobile
provenance. A module declares its own scan reset base/offset, growth/fade, status
refresh, hit flag and standing arithmetic. It cannot allocate actors or replace
unrelated world fields. The engine pays and validates a complete command once;
an approved hold outside its declared range may intentionally be a charged miss.

Canonical special-effect definitions own numeric layers, poses, nested cadence
and registration, keyed by semantic `effectDefinitionId`. Pixi
`visuals.specialEffects` maps layer IDs to images; Three maps those definitions to
its concrete visible consumers. Adapter cloak configuration supplies fade rate
and minimum opacity.
These capabilities are shared contracts. Optional `equipment` content declares
inventory capacity, supported definitions and technology-only definitions;
stations may declare six positional nullable equipment offers. Such content
requires `evaluateEquipmentPrice`. Shared operations authenticate ownership,
current offers, size, balances and revision-bound intents. Optional market
creation/validation policies sample on system entry and validate saved values.
Three channels share ordered remaining energy and use the same effect consumers;
each owns cooldown and accepted/resolved history. Module presentation owns its
loading/sale flow. Save9 captures equipment, active fields/statuses,
exact scan-span witnesses, canonical actor slots and the launch vessel/policy.
Content-aware validation rejects a continuation inconsistent with those facts.
An optional starting NPC merchant offer carries
validated goods, stock, unit price and declared currency. Capture and restore
allow zero or one ordinary starting encounter; a retained actor requires the
authored start's home system and ship definition. Offer goods, label, price and
currency stay exact, while remaining stock may range from zero to its authored
ceiling. Depleted offers remain present; an absent authored offer cannot become
a merchant. These guards apply without station lifecycle; generated actors
have separate identity/visit validation.
The JSON contract also carries validated module-owned system world data. World composition, destination
selection, simulation travel and the S17 scene transition are active. An
optional validated `audio.travel` path identifies a module-owned departure cue;
`audio.communication` optionally supplies the live communication-opening cue.
System ownership is an explicit nullable `governmentId`: null means no government,
while positive IDs must resolve to the module's government definitions. A numeric
zero or missing value is invalid. This creates no mutable ownership state or
automatic NPC/generation capability. The current station lifecycle context
requires an owned home system; unowned destinations can be stationless worlds.
Module rules are
trusted reviewed TypeScript, not untrusted user scripts. JSON cannot import code.
There is no runtime upload, hot swap, or sandbox in this increment. Selecting a
different rules module requires restarting development or rebuilding.

The composition root imports `selected-game-rules`; Vite resolves this to exactly
one module. It loads `/game/module.json`, validates it, checks that the rules ID
and API match, then constructs the catalog and store. Invalid loads cannot create
partial sessions. The engine never imports a concrete module directly.

Rules receive frozen focused state, narrow capabilities and sampled controls. Player
navigation returns a frozen `PlayerMovementState` with no identity, system,
durability, inventory or equipment fields. Encounter rules choose placement and
intent from engine-provided target candidates; NPC movement returns only focused
navigation fields and random state. Primary-fire eligibility receives no complete
definition or runtime entity and returns a pre-end-of-tick cooldown or rejection.
Primary-hit policy receives attacker size, weapon damage and current target
durability, then returns only the next hull/shield values. Shared simulation
consumes each accepted sequence once and rejects durability increases.
Lifecycle modules also provide pure `resolveStationMembership` and
`validateStationMembership` capabilities. The latter receives canonical
overrides and copied frozen authored record/default/mutable facts, including
the empty fresh state during module activation. Live settlement and save replay
reuse the same membership rule. The engine's bounded
[active-visit witness](architecture/ACTIVE_STATION_VISITS.md) validates current actors
independently from durable membership, without exposing writable worlds or
implementing game-specific alias/name rules. Save format5 and exact module/pack
checks reject earlier contracts without migration.
Repair entry receives only player durability/resources, vessel maxima, planet
access facts and zoom; it returns one resource debit or rejection. Repair ticks
return only durability, active state and notice. Shared orchestration owns
payment, cancellation and monotonic maximum-bounded healing.
One selected-NPC purchase transfers requested cargo tons at the module-authored
unit price. Shared simulation checks stock, hold capacity and currency, then
commits stock, cargo and payment in one validated world state.
One world-owned destination system ID is set by a validated intent. Shared
simulation resolves that ID against selected-module systems and either publishes
a focused module-rule time/fuel estimate or a typed missing-map-geometry result.
The quote never mutates the world. A separate travel command checks the current
balance, repair state and module approval, then commits date, fuel, destination
system and fresh destination entities together. Old-system NPCs, spatial targets
and selections leave atomically; the player identity, equipment, cargo and
durability persist. BM1's first route uses recovered map markers, while local
arrival placement remains provisional. S17 preloads destination images and
exposes departure; a failed new view restores the exact previous world.
The engine validates these narrow transitions rather than reparsing a complete
world each tick. Rule bundles using API12 or older and module JSON using schema11 or older are rejected before
session construction. Only the world-construction boundary translates module
content into runtime components; the authoritative world model does not import
module-content schemas. The rules implementer must preserve the remaining focused
invariants; module tests verify behavior.
Selectable entity kinds are defined once by the world model and reused by target
commands, hit testing, weapon resolution and UI. The shared seeded-random
algorithm does not imply shared state: module gameplay advances the world stream,
while presentation histories own separately seeded streams that cannot affect a
replay.
Rules may publish a bounded, sequence-numbered player notice with a module-owned
message. The world freezes it with the same movement/condition commit; the
shared HUD displays it without embedding module-specific wording. The latest
notice persists until a later rule replaces it or a new game starts. This is
the current concrete feedback path, not an unrestricted event bus.
There is a current exception: shared NPC destruction authors source-specific
prose in `src/simulation/features/destruction.ts`. Do not copy that pattern into
new shared outcomes. Follow the [neutral notification requirement](ARCHITECTURE.md#components-and-ownership);
a later correction must retain BM1's evidenced wording, sequencing, retention
and save behavior through module-owned text rather than silently changing it.

The Zustand store owns one nullable `WorldState` rather than a parallel player
record. A flat start DTO is converted once and is not retained as live state. The
active player has a stable runtime entity ID distinct from its module definition
ID and frozen location, motion, condition and inventory components composed from
the same authoritative Zod component schemas.
One sampled command produces one module-rule result and one atomic world commit;
the world tick advances once. A fresh start creates an isolated world and resets
the runtime allocator deterministically. The current schema includes player,
planet, station and NPC variants. The player owns a primary-weapon component
with cooldown, latest accepted shot and highest resolved sequence. An optional
equipment component owns sparse inventory, technology IDs, revision, market
adjustment and two more armament histories. Equipped-copy counts cannot exceed
ownership. Refit resets weapon ownership/channels to hull defaults while retaining
technology and market state; optional module approval controls cloak reset.
Saved emitted effects keep their captured launch identity after loadout changes.
NPC ships own
frozen hull/shield durability and a nullable navigation target. Destruction cleanup, terminal player
status and reference integrity are shared engine responsibilities. Optional
station scalar condition, generated-actor identity and scoped standing compose
with those components. Module lifecycle policy owns supported death rewards and
penalties; unrelated progression remains unimplemented.
Schema version 4 introduced explicit local
planet placement and its evidence status; version 5 added neutral encounter
selection. Version 6 introduced calendar/arrival data and evidence-qualified map
coordinates. Version 7 permits null in each of the six positional planet offer
slots. Null means empty: retain that slot's position and validate every non-null
definition reference. Game-specific legacy sentinel conversion belongs to the
owning module; shared code does not recognize legacy IDs. Older manifests must
be updated explicitly. See
[world rendering](architecture/WORLD_RENDERING.md) for ownership and validation.
Version8 introduced entity artwork scale. Version9 adds the player-only factor;
both base and player dimensions must remain finite and positive. Only ships can
declare that factor. `entityVisualSize(visual, 'player')` owns player dimensions;
the default world role retains base dimensions for NPCs, picking and highlights.
Current BM1pack0.34.0/demo0.27.0 uses module format23/Rules25 and save envelope15.
Optional `commerce` content declares goods and a position limit. Station
`commodityMarketSlots` identifies authored commodity-service positions. Module
`createCargoMarket` and `planCargoTransfer` policies return validated terms and
bounded allocations; shared owners enforce stock/payment/hold invariants.
Separate `quoteResourceSale` policy supplies resource exchange terms. Read-only
cargo/market/resource views and guarded intent callbacks enter the selected
presentation. BM1's ten-position/all-matching/triangular rules remain module
code; the demo uses three positions, linear exchange and independent goods.
Optional authored `start.player.identity` supplies captain, vessel and organization
labels; omission defaults to null without a module-format bump. The runtime
player and current saves require the nullable component. Exact pack/module/rules
compatibility rejects every earlier envelope. Prior save formats also reject
before publication; no migration or default merging is implemented.

Optional `lifecycle` content declares neutral station records, mutation/standing/
strength scope and permitted generated ships. Each start supplies consumed standing
defaults. Module12 permits declared positive safe-integer standing IDs without a
selected spatial system; they confer no destination, actor, station damage or
membership mutation permission.
Strength scopes still resolve to selected spatial systems. Start defaults must
contain exactly the declared standing keys, with unique IDs and finite signed
values. BM1 declares nine scopes `[1,2,3,4,5,7,8,9,12]`; the independent demo
declares `[3,41,82]`, including its own offscreen scopes.

Rules13 replaces the former single `standing` policy input with `systemStanding`,
a copied array with frozen entries and array. Shared orchestration validates the
complete exact declared scope before policy execution; it never filters foreign
keys or fills missing values. Policy reads that one authoritative projection and
returns validated `standingUpdates`; duplicate, foreign or missing-prior updates
reject the complete transaction. Signed values remain valid after mutation and
restore; they need not equal start defaults. `resolveStationHit` supplies scalar
damage; `resolveLifecycleHit` returns
validated attribution/death effects; generated actors require one module-owned
identity validator reused on restore. Shared code allocates IDs and commits once.
Lifecycle-enabled systems retain complete authored station records even when
only some records permit mutation. Restore requires nonmutable stations to retain
their authored initial scalar condition and false player-attributed/blame flags;
displaying a condition does not grant damage or membership mutation permission.
See [lifecycle authoring and ownership](architecture/STATION_LIFECYCLE.md). Raw source tables,
alias groups, faction arithmetic and expressive messages remain module-owned.

The shared navigation contract uses world coordinates with positive Y down,
clockwise heading in degrees, zero heading up, and negative forward speed in
world units per tick. Each module supplies its tick rate; changing it changes
per-tick balance. Renderer interpolation now samples completed world transforms
at display rate; S22's browser/live smoothness review is complete.
One nullable selected target ID is owned by the world and validated through a
named store action. The current selectable kinds are station and NPC ship; pointer picking
inverts the last drawn camera transform and tests the last drawn interpolated
actor transforms against module visual bounds. Current world membership still
authorizes selection: removed actors cannot be selected from stale ink, and actors
not yet drawn have no pickable bounds. View
highlight and React panel read the same ID, while empty-space deselection and
entity removal clear it. See [S8 evidence](../modules/bm1/docs/foundation/TARGET_SELECTION.md).
Space requests primary fire at a selected NPC or a station with an enabled
module-authored damage capability. Shared simulation owns the atomic
energy/cooldown/shot/durability commit; module rules decide motion/range
eligibility, cooldown length and focused hit arithmetic. S11 resolves one
immediate accepted hit exactly once. See [command evidence](../modules/bm1/docs/foundation/PRIMARY_PHASER_COMMAND.md)
and [hit evidence](../modules/bm1/docs/foundation/PRIMARY_HIT_RESOLUTION.md).
`viewport.cameraAnchor` can select the logical screen point followed by the
player; omitted anchors use the viewport center.
Optional `viewport.zoom.levels` begins at 1 and increases strictly; a supplied
`zoom.pivot` may differ from the player anchor. The selected denominator is
committed to `world.cameraZoom` with each fixed-tick player update and passed to
the module rule. Rendering divides world offsets and sprite size by it. BM1
uses recovered 1/2/4 levels and zoom pivot; demo uses its own 1/1.5/3 levels.
The optional additive v4 `starField` input defines each backdrop particle's
position, radius, parallax, initial scale and optional speed-dependent stretch,
plus a field color, opacity, seed and boundary policy (`random-edge` or `wrap`).
Omission means no particles. Zod validates and freezes this input. The view owns
particle history and randomness, advances from completed world ticks and snaps
edge respawns during interpolation; it never mutates gameplay. The independent
demo varies the boundary policy, motion and appearance. See the [S5 recovery
record](../modules/bm1/docs/presentation/STAR_ZOOM_RECOVERY.md).

## Authoring and selection

Copy `modules/demo` to `modules/my-game`. Set `id` in the JSON and `moduleId` in
`rules.ts` to `my-game`. Supply your own names, descriptions, balance, resources,
starts and assets; change rules for different mechanics. Use, in PowerShell:

```powershell
$env:GAME_MODULE = 'my-game'
npm run dev
npm run build
Remove-Item Env:GAME_MODULE
```

With no override, standard commands select `demo`. Use the generic module runner
for another local module: `npm run module -- <module-id> dev`, `build`, `preview`,
`test`, `stage`, or `verify`. A module folder name must contain only a leading
lowercase letter followed by lowercase letters, digits or hyphens.

Build outputs are separate. Deploy the **contents of one** `dist/<id>` folder at
the server root; absolute `/game/` paths currently require root hosting. Do not
publish the repository or aggregate `dist/` as an original-only distribution.
The old root `public/` may still contain historical staging output; it is ignored
by Vite. Preserved originals and evidence have not been deleted or relocated.

## Entry presentation

A module can export a named `EntryPresentation` React component from
`modules/<id>/entry-presentation.tsx`. Vite selects exactly that file through
`selected-game-presentation`; only the browser composition root imports the
alias. Modules without the file retain the shared generic entry fallback.
The independent demo explicitly supplies its presentation through this seam.

`EntryPresentationProps` in `src/ui/entry-presentation.ts` supplies the validated
read-only definition, `onStart(startId, identity?)`, `saveTools` and an optional
`onPrepared()`. Call `onPrepared` once the complete entry is displayed; the host
then warms gameplay code in the background. Dispatch the named start
intent only when committing a playable choice; preview and route changes stay
local to the presentation. The existing store validates the ID before publishing
a world. Its sole editable-start override is the optional complete triple
validated by `PlayerIdentitySchema`. Strings retain empty, whitespace, Unicode
and long values; line separators, missing/extra fields and nonstrings reject.
Preview drafts stay local; resource text cannot override authored balances.
The host validates before construction/publication, copies the labels and rejects
callbacks retained from a replaced menu session. Labels do not assign factions,
ownership or unlocks. Restart uses authored defaults; restore retains committed
names. This does not grant arbitrary edited-start fields or direct world/store
mutation. A module owns expressive layout, route names and assets, and places
`saveTools` deliberately as a browser adaptation. App retains the save-operation
state across placement changes, including load/import transitions into gameplay.
The original build-time UI capability did not change versions; the consumed
identity component remains required by [save format4](architecture/SAVE_SNAPSHOT.md).

Input gestures needed only to choose a preview belong to the module's validated
presentation controller. Sample release-time modifiers at the actual pointer or
armed keyboard release, and cancel armed input on focus loss. A successful local
choice may later commit its immutable start ID without retaining held modifiers.
This does not create an authorization credential or progression rule. The host
still validates every committed ID against selected-module content; new mutable
start fields beyond the identity triple require their own concrete contract.

## Gameplay presentation

A module may export `GameplayPresentation` from
`modules/<id>/gameplay-presentation.tsx`. The `selected-gameplay-presentation`
alias resolves one reviewed component or the generic fallback. The browser
composition root awaits this import inside the same startup error boundary as
the entry capability. The independently authored demo explicitly implements it.

`GameplayPresentationProps` supplies immutable definitions, a frozen Zod-inferred
`GameHudView`, a separate nullable frozen `identity: PlayerIdentity | null`, a
nullable frozen `SelectedTargetView`, named clear-target and
return-to-menu intents and three host-owned React slots:
`viewport`, `sliceTools` and `saveTools`. Static ship capacities are selected from
definitions by `hud.playerDefinitionId`; dynamic data never exposes a world or
store handle. Navigation, authored layout/art and local focus belong to the
module. Place the viewport in a stable subtree across local HUD route changes;
overlay artwork must leave unpainted space available for canvas pointer picking.
Keep supported slice tools accessible deliberately until their U4 replacement.

Presentations may consume frozen `spatialOverview` and sequenced
`worldActivation` facts. Activation identifies displayed planet/station/ship
ink and prior selection, without making planets combat targets or exposing a
store. The module owns contact navigation; the host clears pending activation
during travel. Overview entries contain current-system relative positions,
kinds, IDs and selected flags.

The optional `presentedFrameSource` supplies frozen geometry from the active
spatial view. A snapshot contains the drawn player camera in world units, its
zoom denominator, and entity positions relative to that camera in world units.
Subscribe inside overlays that need display-rate geometry and use committed
facts for entity membership and marker state. Adapters may omit publication.
The snapshot is null until a view publishes and after the view detaches.

Optional `spatialPresentation.backgroundImageForSystem` supplies a trusted module
asset path. Shared Pixi loading, scene ownership, draw order and terminal capture
include that backdrop. This changes no simulation policy or content schema.
BM1's viewport corrections remove old slice controls; browser saves/menu remain
collapsed outside the original stage. Independent presentations continue to own
their supported controls.

Selected spatial presentations can additionally supply validated
`parallaxLayersForSystem` objects with asset, logical center/size and a motion
factor. Shared scene loading, star-motion history, ordering/capture and disposal
own those objects; modules retain source-specific artwork and factors. Travel
reports may animate their own module-owned ink while the world is locked.
The callback receives `(systemId, presentationSeed)`: the host provides fresh
cosmetic entropy per scene attachment, stable through window/DPR changes.
Modules may derive source-required load-time placement from it without touching
world randomness or persistence. Optional per-star color and bounded polygon ink
override field defaults; circle-only independent content remains valid.
CSS window/fullscreen fitting scales the logical stage; it does not enlarge
world coordinates or bypass pointer conversion and validated commands.

`target` is a flat discriminated union defined in `src/ui/selected-target-view.ts`.
Both variants contain runtime identity, definition/system keys and `relativeX` /
`relativeY`: target position minus player position in world units, positive Y
down. NPC ships additionally expose current hull/shields; stations expose their
authored placement key and intentionally omit durability because it is not
implemented in the authoritative world. Resolve names, capacities and artwork
from the immutable definition. Module presentation owns bearing/strength display
and must handle missing or zero capacities explicitly. `onClearTarget()` delegates
the existing validated null-selection action; presentation-local hiding must not
leave the world highlight selected. Selection changes, destruction, restore and
travel therefore use the existing authoritative lifecycle. Target UI is no
longer part of `sliceTools`: each module places its own rendering once. Demo and
the generic fallback use `TargetReadout` with the same projection/clear intent.

`planetContact` and `selectedContact` extend the same frame with bounded contact
inspection facts from `src/ui/contact-view.ts`. The nullable frozen planet view
contains its runtime ID, system ID, player-relative world coordinates and nullable
finite signed `strength`. The host selects an actual consumed strength entry,
otherwise that system's immutable initial value; null means no corresponding
fact/content is available. Presentation must not replace a real zero/negative
value with an initial default. The
selected view adds the existing ship/structure definition ID and, for stations,
the authored placement ID. Its separate subscription intentionally omits tactical
durability and trade stock. The module resolves static descriptions, labels and
artwork from the immutable definition; no contact name, dialogue, race, hail
access or live station state is inferred from absent simulation fields.

Opening and closing these inspections is local presentation behavior, separate
from `onClearTarget()`. It must not clear or rewrite selection or claim an
unsupported hail command. Reset an open selected inspection when identity changes
or disappears; scene remounts already reset local state on system/session changes.
The demo and generic fallback use identity-keyed native disclosure controls to
exercise the same facts without compatibility media.

`communication` is a nullable frozen `{sequence,code,message}` projection copied
from authoritative feedback. It is separate from the latest HUD notice; module
policy authors all expressive text. Modules seed the mounted sequence as history,
observe newer sequences including repeated text, retain a new pending outcome
through artwork failure/retry and dismiss only the local panel. Opening may
replace an existing contact; no presentation acknowledgment changes simulation.
Restore, travel and restarted sessions never reopen historical reports.

`onPlayCommunicationCue(sequence)` is a cosmetic intent for the displayed new
revision. The host requires its current outcome, exact active session/system,
nontravel state and a revision newer than the mounted/played baseline. Optional
`audio.communication` is lazy and scene-owned; missing assets/playback APIs or
autoplay/device failure cannot settle or reverse gameplay. Real cleanup makes
old handles inert. React development effect replay creates a fresh cue owner
without resetting observed history or replaying an already attempted revision.
The host exposes no Audio object or store handle to module presentation.

`repair` is a frozen flat `RepairView` (`src/ui/repair-view.ts`) containing current
hull/shields, `repairing` and nullable `resourceId` / `cost`. Both quote fields are
null while repair is active or service is unavailable; a non-null quote is the
existing module policy's currently payable offer. Resolve currency labels and
vessel maxima from `definition` and `hud.playerDefinitionId`. `onBeginRepair()`
revalidates the current world and payment through the existing store command;
the displayed quote cannot bypass that validation. `onCancelRepair()` delegates
existing unrefunded cancellation. Local closing/unmounting must not call cancel
implicitly. Repair no longer appears in `sliceTools`; place authored controls
once. Demo/default use `RepairReadout` with the same props and intents.

`purchase` is a nullable frozen flat `PurchaseView` (`src/ui/purchase-view.ts`).
It identifies the actual selected merchant by `merchantEntityId`,
`merchantDefinitionId` and `systemId`, with commodity ID/label, finite `stockTons`,
`pricePerTon`, `currencyId`, total occupied `cargoTons`, `cargoCapacity` and
currency `balance`. `canPurchaseOne` and `canPurchaseStock` come from the existing
simulation quote for exactly one ton and the complete advertised stock; do not
recompute affordability or room in presentation. Static ship/currency labels
resolve from `definition`. A depleted offer remains visible with both actions
unavailable; selection loss, station selection and absent offers yield null.

`onPurchaseCargo(quantityTons)` is bound to the displayed merchant, system and
session revision. Old handles cannot buy a replacement selection or a restarted/
restored session with reused runtime IDs. The existing command always validates
the current quantity, stock, cargo and balance, preserving all-or-nothing payment
without advancing time. Presentation-local closing never changes stock or cargo.
Purchase controls leave `sliceTools`; modules place them once. Demo/default use
`PurchaseReadout`, including one-ton and whole-stock actions with the same props.
No world/store aliases, simulation/rules API or save fields cross this seam.

`route` is a nullable deeply frozen `RouteView` (`src/ui/route-view.ts`). It carries
`systemId` / `currentSystemName`, all supported `destinations` with copied
evidence-qualified `mapPosition` and a simulation `quote` for each noncurrent
system, plus selected `destinationSystemId` / `destinationName`, `quote`,
`fuelBalance`, `fuelLabel` and `departureStatus`. Per-marker quotes let a module
inspect hover state without writing authoritative selection. The simulation's
read-only assessment and actual travel command share fuel/repair/module approval;
presentation never computes route cost or departure eligibility. Status separates
missing selection/geometry, incapable vessel, repair, missing/insufficient fuel,
module refusal and ready. It does not infer which module-specific reserve formula
caused a general module refusal.

`onSelectDestination(systemId | null)` selects or clears a supported noncurrent
system. `onDepart()` requests travel to the displayed selection;
`onDepartTo(systemId)` selects a supported marker and requests departure in one
guarded host intent. All three reject retained callbacks from a different
session, system or selected destination, and reject changes during preload or
arrival. The host revalidates the current world, preloads destination assets,
commits atomically, plays the optional cue and finishes or rolls back the exact
arrival on viewport readiness/failure. `routePhase` (`ready`, `loading`, `arriving`)
and nullable `routeError` describe that transient lifecycle. `routeErrorKind`
distinguishes `departure`, `assets` and `view` errors. Every failure increments
transient `routeErrorRevision`, including identical repeated refusals, so local
hover text can observe each source message write. Asset/view errors must remain
distinct from simulation refusal text. Map controls no longer occur
in `sliceTools`: authored modules place their supported controls once; demo and
default place the pure `MapReadout` with their independent route policy. These
props add no persisted state or rules API version.

`travel` is a nullable deeply frozen `TravelPresentationView`
(`src/ui/travel-presentation-view.ts`) retained by the host across system-keyed
presentation remounts. It supplies an `operationId`, monotonic
`departureStartedAtMs` (`performance.now()` milliseconds), origin/destination
system IDs, player definition ID, copied `originSpatial`, quoted `durationDays`,
committed `advanceDays`, `fuelResourceId`, actual `fuelUnits` debit and
`arrivalDate`. During loading these are preview facts; render an arrival report
only when `routePhase` is `ready`. A failed preload/view clears this snapshot.
No report paragraphs, autosave result or other unimplemented world events are
inferred from it. Static names/currency labels resolve through `definition`.

A gameplay component may assign a static `travelPresentation` object containing
`departureDurationMs` (finite milliseconds, 0–60000) and optional
`hidePlayerDuringDeparture`. The host validates it, waits the minimum interval
alongside destination preload, and owns timer cancellation. Omitted options use
zero duration and keep the normal player visible. Hiding replaces only the
normal player sprite, retaining the actual world behind module actor artwork.
Use the captured monotonic epoch to preserve departure poses across a system
remount; animation may observe travel, but never completes or approves it.

After actual viewport readiness, `routePhase` becomes `ready` with `travel` still
present. The host pauses fixed updates until the operation/session-bound
`onDismissTravel()` intent acknowledges the summary. It rejects calls during
preload/arrival, repeated acknowledgments and retained handles from another
operation or restored/restarted session. It cannot finish viewport readiness or
change travel payment/date. Save at this ready stage captures the committed
world only; restore/new sessions omit the transient summary. Modules should
block their other gameplay controls beneath departure/arrival views. Demo and
fallback exercise the same lifecycle with the independent `TravelReadout`.

`playerSpatial` (`src/ui/player-spatial-view.ts`) provides the player sprite
registration `x`/`y`, clockwise `headingDegrees` (zero up), `zoom`, unrotated
`width`/`height` and rotated axis-aligned `boundsWidth`/`boundsHeight`. All lengths
are logical viewport pixels, already divided by zoom, independent of DOM scale
and device pixel ratio. Registration follows the camera anchor; it does not
follow the distinct world zoom pivot. `rendering/player-geometry.ts` is shared
with Pixi, so presentation must not recalculate sprite sizing from unrelated
ship statistics. The read model uses committed heading while Pixi interpolates
heading per display frame. Active repair blocks steering, but its first interval
may retain an entry interpolation difference; exact per-display-frame overlay
synchronization is not provided. Animation history stays presentation-local;
completion, cancellation, travel and restore reflect authoritative repair state.

A new scene is prepared hidden beneath the previous screen. `revealed` is false
until the host shows it: attach no listeners, start no clocks and play no audio
before then. Report `onPresentationReadyChange('ready')` once the complete first
view, including interactions it exposes immediately, is prepared; `'failed'`
keeps the previous screen with retry/cancel recovery. The host reveals after
that report and a first complete spatial frame, and ignores reports afterwards.

The concrete `onInputAvailabilityChange` callback reports presentation readiness.
Set it false while required artwork is loading/failed and on unmount; set it true
when controls are available. The host clears held flight input on these changes
and samples idle commands while either presentation or spatial view is
unavailable, while ordinary world time continues. View readiness changes also
clear held flight input, including initial loading/failure and scene replacement.
Native/semantic controls and editable fields own their key events; focus transfer
clears held flight input. This is transient host/presentation state, never a save
or simulation field. The selected component remounts on system changes, and the
scene remounts on session revision after new/restored sessions. Host travel
rollback, scheduling, audio and viewport disposal keep their existing owners.

Render failures replace the whole scene with visible return-to-menu/save recovery,
unmounting owned services. A new/restored session creates a fresh failure boundary.
Async artwork failures remain module-owned retry/return flows. Neither capability
changes the rules, content or save format API.

## Terminal presentation

A gameplay presentation file may additionally export `TerminalPresentation`.
The composition root selects this optional export through the existing
`selected-gameplay-presentation` import. Modules without it use the generic
terminal fallback; the independent demo supplies its own survey outcome.

`TerminalPresentationProps` in `src/ui/terminal-presentation.ts` supplies immutable
`definition`, frozen Zod-inferred `terminal`, `backdrop`, `onReturnToMenu`, `onRestart` and
`saveTools`. `terminal` contains only `status: 'player-destroyed'`, `startId`,
`playerDefinitionId`, `systemId`, final `playerSpatial` and `startedAtMs` (host
`performance.now()` milliseconds at terminal mount). Geometry retains the
logical viewport pixel/heading/zoom contract above. Names, actor art, outcome
layout and animation timing belong to the module. A mount after terminal save
restoration starts a fresh local animation; no animation phase is persisted.

`backdrop` is a host-owned React image slot captured once from the previous world
view without its player sprite. Place it behind a module replacement actor only
for the relevant animation interval. It contains no live renderer or writable
canvas handle. Terminal restores, unavailable views and cosmetic capture failures
receive null; modules must support that isolated-stage fallback explicitly. The
slot is bound to the exact final world/session and never enters saves.

The host replaces active gameplay completely: no keyboard listeners, scheduler,
active Pixi viewport, travel timers or scene audio belong to this terminal
capability. The authoritative world cannot tick. Module animation must never
call gameplay actions or infer restored gameplay from its visual completion.
`onReturnToMenu` clears the session through the existing host action;
`onRestart` explicitly reconstructs its selected start. Both reject retained
callbacks after world/session replacement, including terminal restore. A module
must label browser recovery separately when its source outcome control has
different semantics. Place host save tools deliberately once; the host disables
saving a destroyed world while retaining validated load/import recovery. Render
failures use the same visible host recovery boundary as gameplay, reset on a new
session. This capability adds no rules, content or save version.

## Validation and verification

Current [runtime-packaging acceptance](../archive/docs-2026-11-26/docs/reviews/RUNTIME_PACKAGING_2026-11-03.md) verifies
both modules from the publish-selected runtime inputs with fresh dependencies
and no optional development directories. Production type checking, default and
selected builds, dev servers and static previews are independent of recovery.
Full tests and recovery/packaging audits still need the development workspace.

The module schema rejects unsupported versions, unknown fields, duplicate IDs,
dangling weapon/entity/government/system references, stations backed by ships,
invalid starts, undeclared resources, invalid native dimensions or pivots, and
unsafe asset paths. Map positions may be
explicitly null when unavailable; travel must reject that missing input rather than
invent geometry. Each start requires mappings for its ship, planet and every
starting-system station. Entity and planet visual IDs occupy separate collections,
and each mapping records its native pixel dimensions plus a verified or provisional
pivot. Assets use module-relative `assets/` paths; missing physical images fail
spatial-view initialization with a visible error. Visuals for unrelated catalog
entities are not required until those entities can actually spawn. A ship change during an active scene is not supported
yet; its future feature must handle sprite replacement explicitly.

Independent fixture authorship, absence of staging and independence from private
files are separate claims. `tests/content/game-module.test.ts` imports BM1 JSON;
`tests/rendering/pixi-game-view.test.ts` imports BM1 JSON and rules at file scope.
Excluding `modules/**` or filtering test names does not remove those imports.

The following **historical, superseded build/typecheck findings** preserve the
pre-C1i documentation-hardening verification on 2026-10-24 in a temporary copy containing the
complete local shared source, tests, tools, root configuration and demo, with
installed dependencies reused but no BM1 module, analysis or preserved archive:

| Check | Private-workspace requirement / observed result |
| --- | --- |
| `npm test`, `npm run test:engine` | Both run the same shared Vitest selection followed by the architecture audit. That selection failed to load the two files above without private inputs; 39 other files/162 tests passed. These are not public-only suites. |
| `npm run typecheck` | The equivalent `tsc -b` failed on those private imports: tsconfig.app.json includes tests and all local modules. |
| `npm run build`, `npm run module -- demo build` | Both run that TypeScript check first, so they currently require the missing private test inputs too. Selected bundle isolation does not isolate type checking. |
| Explicit subset below | Passed 39 files/162 tests without private inputs; it omits both mixed-input files and is not the full engine acceptance suite. |
| `npm run test:architecture` | Its underlying runtime-import auditor passed on shared source plus demo (90 runtime files); absent private code is not audited. |
| `node node_modules/vite/bin/vite.js build` with demo selected | Bundling alone passed without private inputs. This does not run TypeScript checking or prove browser behavior. |
| `npm run test:build:demo` | Its underlying distribution auditor passed on that freshly bundled demo (five public files). Without private files/markers it cannot perform comparisons against their bytes/text. |
| BM1 module test/stage/verify/build commands | Require the private module; staging/verification hooks additionally consume private evidence/originals. Not rerun for this documentation review. |

The explicitly verified pre-C1i subset used unchanged tests:

```powershell
node node_modules/vitest/vitest.mjs run --exclude modules/** --exclude tests/content/game-module.test.ts --exclude tests/rendering/pixi-game-view.test.ts
```

This proves only the stated checks with the complete local shared/demo inputs,
not reproducibility from the current Git-tracked file set, which is incomplete.
Browser independence was not retested in that check. C1i subsequently passes the
full local suites, both builds and an independent demo production-browser identity
probe, recorded in the [acceptance review](../archive/docs-2026-11-26/modules/bm1/docs/features/c1-starts/C1I_REVIEW_2026-10-24.md).
Those runs used the complete local workspace; they do not update the historical
private-absent subset counts or establish public-only reproducibility. Future acceptance records must
state the files/environment actually used; passing in the private workspace
does not establish public-only independence.

`npm run module -- <module-id> test` runs that module's tests and optional
verification hook; it is not an alias for the shared independent subset.
Production builds enforce the module import boundary in the emitted bundle
graph. Public-file identity/exclusion audits are explicit development checks;
they are no longer implicit dependencies of a normal build. These checks detect
accidental mixing, not legal originality.

## Subsequent features

Recorded local verification includes shared and BM1 suites with independently
authored weapon/NPC fixtures. Some fixtures live in mixed-input test files;
the verification scope above governs claims of independence from private inputs.
Recovery integrity checks,
TypeScript checking, both production builds and both distribution-file audits
passed. Vite retains a non-blocking main-chunk size warning. The post-split demo
and BM1 production builds passed the recorded start, movement, browser-event focus
suspension and restart check in
[the browser smoke record](../archive/docs-2026-11-26/docs/reviews/BROWSER_SMOKE_2026-09-11.md). Its headless automation
limit is stated there.

As map/world simulation, weapons, economy and missions enter use, add focused
engine contracts and versioned schemas in the same change. Put authored maps,
quests, dialogue, prices, damage/cooldown values, faction relationships and all
associated media in the module. Keep original quirks and source-informed rules
in BM1. Add equivalent original fixtures to ensure the engine can use each new
feature without BM1. Do not introduce an unbounded event bus or arbitrary script
interpreter in anticipation of quests.

System definitions include planet, station, map and arrival data. They are
immutable validated module inputs. BM1 uses recovered map markers; its static
`arrival` entries are still marked provisional but are never used, because the
module's `createTravelArrival` rule (recovered jump arrival) always places the
player. The independent demo supplies authored positions. BM1 route duration and
fuel follow the source formula (`modules/bm1/travel.ts`). Every BM1 system shows
the same recovered planet placement, as the source has one named planet instance
(Vulcan's provisional slice origin was superseded 2026-11-14).

The [S18 snapshot](architecture/SAVE_SNAPSHOT.md) includes module ID/version, module and
rules API versions, save-schema version, start ID and the complete world.
Restore rejects incompatible or corrupt data before changing active state.
S19 provides one module-scoped IndexedDB slot using this snapshot. S20 provides
save/load controls and JSON file transfer. Migrations are not implemented today.
See [browser save storage](architecture/BROWSER_SAVE_STORAGE.md) and
[save UI and file transfer](architecture/SAVE_UI_FILE_TRANSFER.md).

Historically, the BM1 [fresh neutral-start increment](../archive/docs-2026-11-26/modules/bm1/docs/features/c1-starts/C1A_REVIEW_2026-10-21.md)
uses two ordinary immutable start definitions through the same `onStart(startId)`
contract to preserve different initial resources. Their start IDs survive save/
restore and restart. It needs no shared schema or arbitrary module-state field.
BM1 owns its third supported system and all consumed presentation assets;
demo content remains independent. Exact module-version compatibility remains
the same exact-version policy now used by save4.

The next BM1 priority is [original UI recreation](../modules/bm1/docs/ui/UI_RECREATION_PLAN.md),
following the accepted U1/U2 screen/state inventory. Recovered BM1 screen layouts,
composition, assets and text belong in the module. Shared UI controls and command
contracts remain game-neutral. U3 now introduces the bounded entry capability
above; subsequent screens must extend it only when concrete commands and read
models require that work. Verify separate demo/BM1 builds as it grows.
The original port, including U7 complete UI acceptance and V7-V8 verification,
precedes enhanced-edition work.

## Originality and distribution

This separation supports a game with independently authored content and rules.
It is not a clean-room history: earlier implementation studied recovered source.
Moving material to another folder does not remove its copyright or supply a
licence. A new game also needs its own expressive designs, writing, visuals,
audio and branding; changing labels alone is insufficient. The BM1 module and
source archive retain their separate rights questions. Third-party engine
dependencies retain their licences. No project-wide ownership, rights clearance,
or claim of being entirely original is granted by this architectural change.

Copyright distinguishes ideas/functionality from expression; the
[CJEU's SAS Institute explanation](https://curia.europa.eu/jcms/upload/docs/application/pdf/2012-05/cp120053en.pdf)
and [U.S. Copyright Office overview](https://www.copyright.gov/what-is-copyright/)
describe that distinction. Review the actual intended release and relevant
jurisdiction before making a legal independence claim.

## Optional boarding capability (Rules30 / save17 unchanged)

`GameRules.boarding?: BoardingRules` is defined by
`simulation/contracts/boarding-rules.ts`. Its Zod schemas own all context/result
types. `assessBoarding` receives world positions, clockwise headings, hull IDs,
combined current/maximum strength and camera zoom. Its independent
`inBeamRange`/`eligible` booleans consume no randomness. `beamOverMessage` is
module text. `resolveBoarding` receives hull definitions, current target and
local/opposing government IDs, nullable standing/progression, owned weapon slots,
the target actor's stream and `alreadyOwned`.

Resolution returns `{randomState, standingDelta, message, outcome, selfDestruct}`.
Outcomes are `pillage` (`resourceId`, `amount`), `salvage`
(`weaponDefinitionId`, nullable when nothing is granted), `capture`, or
`failed-capture`. Self-destruction is required except for capture. Capture results
require the fleet capability; declaring boarding alone remains valid. Each
eligible boarding raises `ship-boarded` through the progression owner and its
separate stream. Ordinary salvage uses the first empty owned-weapon position;
full inventory silently loses the copy. Capture links the existing actor through
the fleet allocator without resetting condition or birth provenance. Already
owned capture acknowledges success without allocating another record.

`features/transport.ts` composes surface Transport first, then boarding regardless
of surface reachability. The app publishes one fully save-validated candidate;
invalid outcomes roll back both branches. Self-destruction enters the single
hit/death owner without a weapon hit or new blame. Modules without boarding keep
the previous surface behavior and consume no boarding draws. No boarding state,
pending flag, content field or save field is introduced; module schema24 and
save17 remain unchanged. Existing Transport presentation callback names remain
compatible.

## Optional mission capability (Rules22 / save12)

`GameRules.missions?: MissionRules` is a coherent optional pure capability in
`simulation/contracts/mission-rules.ts`. It declares an existing
`paymentResourceId` (the same resource/units used for ordinary module payments)
and these functions:

- `createVisitMissions({seed, system, systems, standing, stationIds})` returns
  `{planetOffer, stationOffers, surfaceMissionIndex, randomState}`. Station offers
  are keyed by authored placement ID, exactly the captured active station set.
  Optional `stationMarketSeeds` supplies captured commerce seeds for policies
  that replay offer draws already consumed by a market. Visit state retains
  these inputs through station destruction and validates live commerce joins.
- `resolveContractNegotiation({offer, progression, randomState})` returns
  `{success, basePayPerTon, randomState}`. Progression has already settled;
  negotiation randomness belongs to the visit, not the captain stream.
- `quoteContractAcceptance({offer, kind, freeCapacity})` returns `{tons, payout}`
  or `{refusal}`. Tons must equal `min(offer.tons, freeCapacity)` and be positive;
  payout is a nonnegative safe integer. Prices are resource units per whole ton.
- `resolveSurfaceMission({missionIndex, system, population})` returns
  `{message, standingDelta}`. Index zero is consumed/fallback: delta zero and no
  progression experience. Population is the current consumed system population
  (currently the immutable initial value; population mutation is not implemented).
- `canReachSurface({system, population, playerPosition, playerDefinitionId, planetPosition,
  cameraZoom})` owns planet overlap without implying hail-standing permission.
- `describeContractDelivery({system, population, payout})` supplies notice text.
  Optional `tons`/`goodsLabel` describe the delivered cargo; overlap contexts
  additionally supply `playerHeadingDegrees` for rotation-aware geometry.

Offers contain `{goodsId, tons, destinationSystemId, basePayPerTon,
hazardPayPerTon, negotiated}`. Shared code validates goods/destinations, safe
payments, positive capacity, position allocation and delivery ordering. Policy
owns texts, formulas, draws and progression awards. `contract-accept`,
`contract-negotiate`, `contract-delivery` and `surface-mission` events reuse C7.
No mission content field or module schema bump is needed.

Save12 retains realized visit state, seed/entry context and replay evidence for
successful negotiated prices, plus optional occupied-cargo metadata
`contract: {destinationSystemId, payout} | null`. Consumed offers/indexes never
reroll on reload. Destinations must name declared systems; cargo payment uses
the declared mission resource. Earlier saves reject before session replacement.
Views/intents are `MissionView`, `selectMissionView`, `createMissionIntents` and
presentation props `missions`, `onAcceptContract`, `onNegotiateContract`,
`onTransportToSurface`. Modules without the capability keep null mission state.

## Optional progression capability (module22 / Rules22 / save12)

A module may declare `progression: { skills: [{id, label}], tallies: [{id, label}] }`.
Each namespace has unique IDs. Construction initializes every declared value to
zero, independent of start eligibility and vessel state; absence means
`world.progression === null`. Package versions are 0.31.0 for the compatibility
module and 0.24.0 for the independent demo; older saves reject without migration.

Optional `resolveProgression(event): { delta, randomState } | null` receives a
frozen discriminated union with `kind` of `travel-departure` (origin/destination
system IDs), `repair-start`, or `weapon-fire` (weapon definition ID and
`channel: 'primary' | 'special'`), `contract-accept` (`offerKind`),
`contract-negotiate`, `contract-delivery` (`destinationSystemId`), and
`surface-mission` (`standingDelta`). Every event carries the frozen progression
view and its dedicated uint32 `randomState`. Policies own gains, labels,
thresholds and random draws; the shared engine validates finite non-negative
increments, declared IDs and finite results, and commits with the accepted host.
Absent policy/content and null results leave progression untouched. No speculative
events are exposed. `TravelDepartureContext.progression` supplies the same
read-only view for route gating, before any award. Consumers can use
`selectProgression`, `selectExperience` and `selectProgressionTally` without
receiving writable state. Saves require exact declared skill/tally keys.

## Optional visit encounters (module23 / Rules23 / save13)

Content `starts[].npcSpawn` requires `governmentId`: a positive ID declared in
`governments`, alongside its ship definition, encounter ID and seed. Every live
NPC carries a declared government, including authored starters, lifecycle
defenders and optional visit ships. The NPC field owns current allegiance.
`generation.governmentId` remains immutable birth provenance for existing policy
validation; construction sets both from one intent. Capture and release may change
current government without changing birth provenance. Content-aware validation
requires a deployment iff current government is the fleet's owned government;
current government must still be declared module content.

`GameRules.createVisitEncounter?(context): VisitEncounterResult` is optional.
`simulation/contracts/encounter-rules.ts` owns the Zod result/spec schemas and
inferred types. Frozen context fields are:

- `system`, `systems`, `governments`: validated module definitions.
- `randomState`: uint32 world-stream input; return its continuation.
- `population`: module-declared `initialPopulationBillions`, in billions.
- `stationIds`: current live authored station placement keys,
  after spatial/lifecycle presence resolution, not runtime entity IDs (count = length).

Return `{ships, randomState}`. Every ship spec contains `definitionId`,
`governmentId`, single-line `name`, finite absolute world-unit `position`,
`rotationDegrees` (clockwise degrees from up, default zero), optional positive
`raceId`, and `initialTarget: {kind: 'planet'} | {kind: 'station', stationId}`.
The engine checks ship/government declarations, authoritative geometry and live
station targets before publishing any actor. Modules never assign runtime IDs,
durability or streams. Unknown fields/metadata bags reject. Persisted identity
is `encounter: {name, raceId}` with absent race normalized to null; lifecycle and
visit encounter provenance are mutually exclusive.

The sole `simulation/features/system-visit.ts` composition runs after spatial stations
and existing defenders: encounter -> C5 equipment market -> C6 commerce -> C8
missions. New ships therefore participate in module-provided ship markets.
Both start and travel call this composition, never restore. A module without
the capability creates no visit actors and consumes no encounter draws.

All NPCs require a saved uint32 `randomState`. Initial streams are the neutral
LCG permutation of runtime sequence XOR 0x4e504321; distinct uint32 sequences
produce distinct initial states, consume no world draws and reject exhaustion
rather than reuse seeds. Every actor's decisions and navigation continue its own
stream, including authored and lifecycle ships; world randomness stays isolated.
Save15 captures realized ships, government, identity, navigation, combat history and streams;
restore validates definitions/governments, unique runtime IDs, required streams
and lifecycle witness consistency without rerolling. Leaving discards visit
actors; re-entry generates them with new IDs/streams. Earlier saves are incompatible.

## Optional NPC decisions (Rules24 / save14)

`decideNpcCombat(context): NpcDecision` receives frozen self, ordered nullable
actor slots, player position/cloak/condition, planet ID and read-only world position, local/opposing governments,
current-system standing (null when undeclared), zoom, slot count and a frozen
weapon lookup. `entryActorSlotCount` is the saved allocation cursor captured once
by system entry before encounter generation (including zero and holes); encounter
targeting and later decisions consume that same value, never a count of survivors.
It cannot be reconstructed from station slots when authored NPCs were present and
later removed. Restore validates the saved integer and never captures it again.
Self includes size, hull/shield maxima, weapon IDs, engine gate,
combat history, navigation intent, trade-demand hail eligibility and actor stream.
Its Zod result supplies combat, target/offset, stream, other-ship target/alert
writes, beams (weapon/target) and nullable player notice. Writes must name
other live slotted actors (station writes are validated no-ops until their
combat response capability exists); every target must resolve in the active system. The whole
decision validates before application; beams must name a known weapon. Damage
is computed only by the module hit rule, from the weapon and original ship size. Slots run in order (holes kept),
then unslotted NPCs in entity order. Each later actor sees earlier writes.

`respondToPlayerShot(context): NpcTargetResponse | null` receives the live ship's
ID/government/combat/target plus player ID and accepted weapon ID, and returns
validated target/alert. The shared emission owner runs it once per accepted
channel sequence, including targeted projectiles/devices; impact does not replay it.
Stations have no response hook in this increment. An absent capability or a null
result leaves all victim intent unchanged, including generated defenders. Lifecycle
impact settlement never overwrites target or replays the response.

Both combat hosts run player movement, player fire/immediate hits and fire
progression, repair, sequential NPC decisions/beams, all NPC movement, then
projectiles/special effects and victim settlement. Removed victims cannot act;
new actors wait a tick. Movement receives saved alert and the decision stream.
NPC engine-disable countdown follows movement. Player-target beams reuse the
existing module hit rule and guarded durability commit; zero hull stops all
remaining tick work. NPC-target beams settle damage and death immediately through the lifecycle
hit owner; station/planet beams currently record presentation only. Required combat history has alert, nonnegative
integer scan/rescue cursors, a persistent boolean `strafing` latch, primary/secondary tick timers,
and none/pending/delivered hail. Navigation alone owns target and strafe offset.
One engine factory supplies fresh defaults (`strafing: false`); restore requires
explicit history. Movement receives combat history as an optional seventh argument
and current durability percentage in vessel capabilities, so modules can apply
their movement gates and persistent strafe behavior without owning entity state.
Both channels use one `NpcWeaponTimerSchema`: signed integer ticks, null (never
installed), or `'inert'` (installed from an absent weapon, never decremented or
ready again). This explicit saved state represents invalid legacy arithmetic
without allowing non-finite numbers through JSON/save boundaries. The shared
engine does not select module cooldowns or install timers itself.
Saved `npcBeamEvents` retain the completed tick's captured beam endpoints
and weapon, expired at the next tick commit before validated repair, then replaced
by that tick's NPC phase, and never replayed as damage. Travel clears this history. Current
player-specific Pixi/Three beam adapters still need multi-emitter consumers.

## Universal ship hits (Rules25 / save15)

`prepareLifecycleHit` adapts accepted player history to `prepareActorHit`, the
single damage/death preparation owner for every NPC ship (including ships with
no generation identity). NPC beams call `prepareActorHit` directly after their
shooter decision is applied. Player projectile impacts use the same owner;
non-damaging special fields do not manufacture hit settlements. Station victims
retain their scalar player-hit path; NPC beams at stations do no damage yet.

The frozen context identifies the player or NPC attacker (ID/original size),
victim definition/size/current government, navigation-derived `targetsPlayer`,
saved sticky blame, remaining strength, nullable system government/opponent,
initial/current strength, exact declared standing, membership, station slots,
planet/player geometry and world random state. `resolveLifecycleHit` may be
absent or return null to explicitly declare no outcome policy for that actor.
This preserves ordinary damage and fallback notice/removal, including unowned
systems and modules without lifecycle content. A declared policy requires actual
system/planet definitions; it never receives invented owner or standing defaults.

Ships save only `combat.blameDeath`; generation records contain birth identity
only. Decisions cannot change blame. Policies may latch it but cannot clear it.
Stations retain their separate existing attribution fields. Hit policy and death
draws use the world stream; decisions/movement use actor streams exclusively.
Optional `tallyDelta` is a sparse nonnegative map of declared progression tally
IDs. Settlement calls `applyProgressionDelta` with empty experience and preserves
the captain stream. Survivors cannot emit tally or other death effects. Duplicate
or out-of-scope effects, healing, invalid/too many spawns and stale prepared facts
abort the enclosing transaction before publication.

Immediate removal clears selection/navigation references, leaves slot holes and
appends fresh replacement IDs. A result may add `noticeDelayTicks` (0–240, Rules
API33) so its death notice reaches the player later: the engine saves it in the
world's `scheduledNotices` (save 19), posts it at the start of the first NPC
phase whose tick reaches its due tick and drops it on travel. Removal and every
outcome still settle on the death tick. BM1 uses 6 ticks (sprite 868 frame 7 to
frame 13). The view-only `visuals.destruction.hullTicks` keeps the destroyed
actor's last sprite drawn, unmoving and outside masks/flashes, for that many
ticks counting the death tick (BM1: 5, frames 7–11). Death events carry
`rotationDegrees` for it. Player direct-fire deaths settled on the equipped
draft are dated to the committed tick, so they publish their event too. Tick-entry actor IDs exclude replacements from
both decisions and movement. Removed/zero-hull beam targets no-op. Earlier saves
reject without migration before replacing the active session. Module format23
is unchanged because these are rules/runtime-save changes.

## Shared decision actors (Rules26 / save16)

This contract supersedes the earlier station write/no-damage limitations.
Current packages: compatibility0.35.0, independent demo0.28.0; module schema23
is unchanged. Stations with combat records participate in the same sequential
slot order as ships. self.kind identifies the actor; self.strengthPercent uses
station scalar durability or combined ship durability, respectively. Stations
receive their system government, definition field-three scalar, weapon IDs,
shared saved history, navigation and independent actor stream. Stations without
a combat record remain inert. The decision callback may return null to explicitly
decline that actor's policy without changing state or consuming its stream.

NpcDecision adds required projectileShots and nullable departure. Each shot has
weaponDefinitionId, targetEntityId, rotationDegrees and launchSpeedPerFrame.
The module chooses headings/speed; the engine validates flight and collision
capabilities and captures emitter identity/definition/position. One allocator
constructor serves player and NPC emissions; array and actor order are stable.
Original emitter size is resolved from the captured definition for every impact,
including dead emitters and structures. Player impact damage remains in
resolvePrimaryHit, then commitPlayerDurability; NPC/station impacts use
prepareActorHit/applyLifecycleHit. A terminal player hit stops remaining work.
The module flight policy receives planet positions, but planets have no collision
or damage consumer. Lost targets never retarget.

NpcCombatStateSchema adds cloaked, opacity (0..100 by5) and nullable
fallbackPrimaryWeaponId (a known weapon, write-once once nonnull). Stations compose
this exact schema under combat.state with navigation and randomState; scalar
strength remains distinct. combat.blameDeath/state.blameDeath is the single
sticky bit, controlled only by hit settlement. Current navigation derives
player attribution for both actor kinds. Player emission response now reaches
combat-enabled stations as well as ships. NPC beams also damage stations.

Departure contains a module-supplied notice. After complete state/writes/emissions,
the engine removes the mobile actor, clears references and leaves its slot hole
before movement, without death outcomes or persistent census/strength changes.
In-flight shots survive. Saves preserve this continuation and allow historical
allocated emitter IDs. Earlier versions reject without migration. Cloak refuses
selection/hail through one shared guard, including the labelled clicked-target
quirk. The renderer displays saved opacity; policy owns fade timing and floors.

## Optional text command capability (Rules32 / save18 unchanged)

`GameRules.resolveTextCommand?(context): TextCommandResult | null` is a pure
optional capability. `simulation/contracts/text-command.ts` owns Zod-derived
`TextCommandIntent` (`{text}`, at most 1024 UTF-16 code units) and
`TextCommandResult` (`{resources, experience, standing}`, each defaulting empty).
The frozen context supplies exact untrimmed text, live player resource balances,
the current system ID and declared standing scope IDs. Modules own interpretation
and matching. No random stream is exposed.

Results are sparse absolute assignments: resource values are safe nonnegative
integers in module units; experience values are finite module units and must
satisfy the nonnegative progression invariant; standing values are finite signed
module units without clamping. Foreign resource/skill IDs and duplicate/foreign
standing scopes refuse the whole result. Active repair permits execution; terminal
worlds refuse. `applyProgressionAssignment` permits lowering experience without
changing ordinary additive progression. The standing owner performs absolute
updates. The feature parses one complete world and the store publishes once only
if values differ. Null, malformed results and identical values preserve identity.

The selected gameplay presentation receives optional `onSubmitTextCommand` only
with this capability. Absence adds no UI, state, draws or behavior; the independent
demo verifies that host property is absent. Save18 and module schema24 remain
unchanged: existing balance, experience and standing fields persist the effects.
Rules API32 automatically updates the save envelope's existing rules version;
older Rules31 envelopes reject through the existing compatibility check.
