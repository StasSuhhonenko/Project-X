# Project-X runtime architecture and engineering standards

This is the authoritative normative runtime architecture. The [2026-10-24
engine assessment](reviews/ENGINE_ARCHITECTURE_2026-10-24.md) is historical and
does not override these requirements.

These are the engineering requirements for Project-X, including its first playable
slice. Current recovery scripts are exploratory tooling; their structure does not
define the finished engine or games built with it.

The maintained runtime is a reusable engine with separately selected game modules.
Follow [the module contract](GAME_MODULES.md): game-specific rules, balance, starts,
names, descriptions and assets belong in `modules/<id>/`. Keep source-informed
compatibility behavior in its owning module; the shared engine must also work with
the independent demo. This boundary is required for every subsequent feature.

The [Project-X development plan](CONVERSION_PLAN.md) owns the current checkpoint
and cross-project execution order. Architecture remains normative when an older
plan entry conflicts with these engineering boundaries.

## Source organization

Use the following layout as runtime implementation begins. Create directories when their first working module is added.

```text
src/
  app/                  Application startup, composition, scene lifecycle
  simulation/
    model/              Entity IDs, component data, state ownership
    features/           Movement, combat, economy, fleets, travel, conquest
    commands/           Typed player/AI intents and validation
    contracts/          Interfaces for externally supplied time, randomness, content
  content/              Typed definitions, schema validation, catalogs
  rendering/            Neutral contracts/helpers and module-selected adapters
  ui/                   Reusable controls and feature panels
  platform/             Browser input, audio, storage and lifecycle adapters
  random/               Neutral deterministic stream primitives; callers own state
assets/                 Runtime assets and manifests
modules/                Separate game rules, content, assets, provenance and tests
tools/                  Game-neutral build and verification utilities
analysis/               Generated evidence and legacy source candidates
docs/                   Architecture, systems, content formats, decisions
tests/                  Integration scenarios and test fixtures
```

Keep feature-specific rules, helpers and tests together. Use explicit filenames such as `damage-system.ts` and `fleet-orders.ts`. Avoid catch-all modules such as `utils.ts`, oversized managers, and a single file containing the entire game. Files should have one coherent responsibility; do not split a cohesive module merely to satisfy an arbitrary line limit.

[Runtime navigation](../src/README.md) maps these owners and traces startup,
commands and read models. Module UI code may use feature directories containing
controllers, content adapters, read models, presentations and their tests.
Prepared inputs and original evidence retain their independently governed paths.
Update the publication allowlist when introducing nested maintained runtime code;
a working local import does not prove the file is included in a minimal build.

## Components and ownership

Apply DRY to domain knowledge: a business rule, schema, conversion or invariant has one authoritative implementation. Reuse it through a focused interface. Extract genuinely shared behavior as it emerges; similar-looking code with different responsibilities does not automatically belong in one abstraction.

Encapsulate data. Keep mutable collections and store mutation APIs private to their owner. Expose read-only views/selectors and named operations that enforce invariants. TypeScript `readonly` is a compile-time contract, so also avoid leaking mutable aliases across boundaries. Document any intentionally shared mutable data and its lifetime.

Compose entities from focused data components, for example transform, motion, hull, shields, inventory and faction affiliation. Systems implement behavior over the components they own or explicitly receive. Share capabilities across ships and stations through composition rather than a growing inheritance hierarchy. An ECS library is optional and requires a demonstrated benefit; component-based design does not require a generic engine framework.

The maintained player uses one authoritative component entity in `WorldState`.
Reusable Zod component schemas own its location, motion, condition, inventory and
feedback constraints. A module-authored start DTO is converted once at world
construction; it is not live state. The dedicated world-construction boundary
may read validated content schemas, while the runtime world model owns only
runtime schemas, selectors and validated updates. Movement rules receive a frozen
focused projection that omits identity, system, durability, inventory and
equipment. Commit operations validate that projection and update only the
components and fields named by its contract.

NPC starts carry a module encounter ID and seed, not an engine-embedded spawn
formula. A required module rule chooses initial placement and one target from
engine-provided same-system candidates; the engine assigns identity and validates
the result. NPC steering receives a focused navigation projection and may update
only transform, motion and the world-space target offset. Definition and system
remain engine-owned; validated decision/response intents can change the navigation
target without adding a second target owner. Primary-fire policy likewise receives
only its consumed player, vessel, weapon, target and zoom capabilities; current
equipment, atomic cost/shot state and end-of-tick cooldown progression remain
shared simulation responsibilities.

Optional visit encounters use the frozen `contracts/encounter-rules.ts` seam.
The module draws from the supplied world stream and returns validated ship
specifications plus its continuation. The engine owns runtime IDs, full initial
durability, finite transforms, declared definition/government joins, live target
resolution and independent NPC streams. The sole entry composition lives in
`simulation/features/system-visit.ts`: spatial stations/defenders first, encounter,
equipment, commerce, then missions. Both start and travel construct a detached
candidate and publish once; a rejected stage leaves the prior session intact.

NPC `governmentId` is required positive declared content. Generated actors retain
an immutable generation-government witness, created from the same spawn intent
without requiring equality to current allegiance: capture and release both change
current government while retaining birth identity. The content-aware save boundary
requires a fleet deployment iff current government is the fleet's owned government.
Visit actor `encounter` identity (single-line name and optional
positive race ID, persisted as null when absent) is distinct from lifecycle
provenance. Every NPC owns a required uint32 random state. Its initial seed is
the shared LCG permutation of (runtime sequence XOR 0x4e504321), with uint32
exhaustion rejected and no world draws consumed. All NPC decisions and navigation
consume their actor stream, including authored and lifecycle ships. Hit/death
settlement inside an NPC decision uses the independent world stream.
Save15 validates realized entities, required combat history and references, never replays
encounter generation. Re-entry generates new actors after spatial construction.

NPC ships own the same Zod durability fragment used inside player condition.
One accepted primary sequence is resolved at most once: the module receives only
attacker size, weapon damage and current target durability, while shared code owns
target identity, resolved-sequence bookkeeping, non-increasing validation and
atomic commit. This permits different module damage policies without allowing a
rule to replace identity, movement, equipment or unrelated condition state.

World lifecycle is explicit simulation state. Zero player hull and the
`player-destroyed` status are committed together; terminal worlds cannot advance.
React selects a separate module terminal scene from that status and does not own
a second death flag. Zero-hull NPC cleanup removes the entity, selection and inbound NPC
target references atomically. A target made absent by destruction is represented
as `null` until a later game rule reacquires one; shared code does not invent a
game-specific fallback target.

World selection eligibility has one type guard and focused selectors reused by
schema validation, commands and consumers. NPC tick commits validate and index a
complete update set once before applying it; identity cannot enter focused rule
outputs. The neutral seeded-random utility owns algorithm arithmetic and uint32
validation only. Simulation worlds and presentation histories must retain
independent stream state, seeds, draw order and lifecycle.

Use stable entity IDs instead of MovieClip paths. Define which system can mutate each state component and when. Shared state must not become a replacement for Flash's unrestricted `_root`. Changes crossing feature boundaries use documented commands or explicit typed interfaces. Use typed events for notifications where they help; avoid an unrestricted global event bus with hidden execution order.

Immutable system ownership distinguishes no government (`null`) from a positive
government identity. Unknown/zero/missing identities reject at the content
boundary; presentation wording for absence belongs to the module. A nullable
owner grants no mutable conquest state or lifecycle generation capability.
Station lifecycle content requires an owned home system. Ordinary ship hit
contexts permit a null government; no-policy removal also works without lifecycle content.

Shared simulation outcomes must be semantic and game-neutral; expressive
notification wording belongs to the selected module. Existing sequence-numbered
notices may carry module-supplied text, but shared features must not author
source-specific prose. When correcting an existing exception, preserve the
owning module's evidenced wording, trigger/order, repeated-notice sequencing,
retention and save/restore behavior. Declare compatibility if that correction
changes persisted notice data. This requirement does not prescribe a new event
bus, notification framework or schema.

UI and input produce commands. The simulation validates and applies them. Renderers and panels consume read-only projections of state; they do not implement prices, damage, equipment eligibility or other game rules. A renderer can own transient visual effects, but those effects cannot determine simulation outcomes.

Pixi world-entity bindings may retain a runtime entity ID, validated visual
mapping and view-owned sprite, but never an authoritative entity snapshot.
Shared station/NPC transform presentation has one implementation for camera
projection, interpolation samples, native-size zoom scaling, visibility and
rotation conversion. The scene composition root keeps meaningful differences
explicit: layer order, player anchoring, planet display scale, selection
highlighting and effect order must not be hidden behind behavior flags in a
generic sprite abstraction.

Pointer picking uses the last drawn camera and interpolated entity transforms,
not newly committed positions that have not reached the display. These samples
are view-owned geometry only: current world membership and selectable-kind
validation still authorize selection. Removed entities cannot be selected from
stale ink; newly created entities become pickable after their first drawn frame.

Pointer activation is separate from combat selection. The view can report an
identified planet/station/ship and whether it was selected before the click;
the host validates current membership and emits a bounded local sequence.
Module navigation consumes the event through frozen contact facts. Pending
activation clears during travel; pointer history never enters saves. Frozen
overview projections expose only current-scene relative positions and selected
identity for module-owned minimaps, without entity aliases or inactive caches.
They also carry live `targetsPlayer` intent and `fleet` membership: `created`
for a ship created into the player's fleet (purchase, launch or visit presence)
and `captured` for one captured during the visit, whose fleet link is marked
`captured` (save 19) until a later visit re-creates it. Presentations decide
what membership means for their markers.

An optional selected-presentation callback chooses a trusted background image
for a system. The shared spatial view owns preload, placement below stars and
actors, failure cleanup and inclusion in terminal captures. Source-specific
selection ranges and image transforms remain module-owned.

Scene attachment supplies an independent cosmetic uint32 seed to the optional
parallax-layer callback. It is drawn once per scene visit (session and system):
renders, resizes, purchase preflights and remounts in the same system reuse it;
new sessions, restores and system entries draw a new one. It never consumes
world/save RNG. The star field likewise continues across a view replacement in
the same scene: each Pixi presentation owns one `createStarFieldHandoff` relay,
and a new view adopts the retiring view's particles and scroll when the player
and system match and the world is not earlier (2026-11-17). A same-tick
publication (a command result) never restarts the field.
Particles may supply bounded local polygon ink and individual colors; omitted
values retain field-level circle/color defaults for independent content.

The spatial renderer retains logical stage coordinates while allocating its
backing buffer at DPR times displayed stage scale (at least logical resolution).
Antialiasing preserves fractional particle coverage. A view-owned ResizeObserver
only marks size dirty; the guarded display callback resizes the renderer without
rebasing histories, changing geometry or advancing simulation. Disposal releases
the observer alongside existing pointer/store/Pixi ownership.

Display callbacks are independent of fixed simulation updates. While the host
withholds updates (`worldFrozen`: a committed arrival and its report, a vessel
replacement or an unrevealed scene), retain the last drawn world fraction rather
than cycling through an old movement interval. The player's departure artwork is
not such a lock: the world keeps advancing beneath it (2026-11-14), so every layer
follows real ticks and no cosmetic backdrop continuation exists. Neither display
time nor window/fullscreen scaling may advance simulation ticks or change saved state.

`rendering/presentation-timing.ts` owns the view's last drawn fraction. It reports
when transform history needs rebasing after a freeze; Pixi owns the actual
history/effect resets and commits the fraction only after drawing.
Module fullscreen observation/request handling has its own listener lifetime,
without world or store access. Scene teardown order remains explicit in App.

Entity bitmap dimensions and their logical display size are distinct. Content's
pure `entityVisualSize` resolves optional uniform and per-axis visual scales once by
contract; sprite sizing, pointer bounds, highlights and player spatial projections
consume that same conversion. Fractional logical dimensions remain unrounded.
The content schema rejects nonpositive/nonfinite scales and overflowing products.
Presentation scale never changes movement, cargo, combat or persisted world state.

Entity visuals may additionally specify `playerScale`, a positive uniform
multiplier applied only when that ship is the player. World/NPC sprites, picking
and target highlights retain the base scale. The same `entityVisualSize` helper
owns both roles; active rendering, repair and terminal projections explicitly
request player sizing. Validate both composed dimensions, including overflow and
underflow to zero, before publication. Native bitmap bytes and fractional pivots
remain unchanged. Independent fixtures render the same definition as both roles.

## Schemas, state management and menus

Ordinary commerce owns one sorted occupied-position array, never a second
mutable commodity total. The Zod cargo schema enforces positive safe whole tons
and unique ordered positions; selected content/save boundaries additionally
check module goods, position limits and vessel capacity. `cargo-transactions.ts`
assesses and settles live intent once, validating module-selected allocation,
payment, finite stock and arithmetic before publishing cargo/resources/notice
together. Legacy ship purchase delegates to the same assessment. Module policies
own prices, allocation semantics and expressive feedback.

Active actors retain their realized market and captured generation seed until
departure; initialization advances world RNG once per eligible actor. Quotes
and restore only recompute pure terms, consuming no world RNG. Save validation
checks supported goods and seed-consistent terms with bounded depleted supply.
There is no inactive market cache. Resource exchange is a separate validated
operation; it cannot edit cargo. Focused immutable views and merchant/session
bound callbacks connect these owners to module-selected React presentations.

Use **Zod** as the source of truth for data shapes: content definitions, serializable state, commands, saves and imported records. Infer their TypeScript types from the schemas rather than maintaining duplicate interfaces. Compose reusable schema fragments to keep constraints consistent. Ordinary behavioral interfaces and service contracts can remain TypeScript interfaces. Validate at trust boundaries and meaningful state transitions; do not repeatedly parse an already validated world on every simulation tick without a reason.

Use **Zustand** for state management. Construct store instances in the application composition root, keep feature state ownership explicit, and expose selectors and named actions through narrow interfaces. Keep raw setters and writable store handles internal. Actions validate intent and delegate game rules to simulation features rather than duplicating those rules in the store. Use the framework-independent store layer behind simulation contracts so the simulation never depends on React hooks. Tests must be able to create isolated stores.

One fixed tick is owned by the pure `advanceWorld` simulation feature. It receives
the prior immutable world, command input, validated module configuration, narrow
definition lookups and rule capabilities, then returns one validated next world.
Rules API24 adds optional per-NPC decisions and player-emission responses through
`contracts/npc-decision-rules.ts`. Required NPC combat state owns alert, scan/rescue
cursors, persistent strafing, signed tick timers (or null/inert) and hail; one fresh factory serves all spawns.
Each complete decision is validated before application. Slot order (including
holes), then unslotted entity order, is authoritative. Earlier writes are visible
to later actors; newly spawned actors wait until next tick. Both firing hosts use
one post-repair NPC phase: player movement -> player fire/immediate hits (and fire
progression) -> repair -> sequential decisions/immediate beams -> all NPC movement
-> projectiles/special effects and their destruction settlement. Immediate player
hits remove NPC victims before decisions. Movement receives alert and continues
the decision's actor stream; NPC status countdown follows movement. Movement also
receives combat history and current durability percentage. The emission response
helper leaves intent unchanged when the module hook is absent or returns null,
including generated defenders. Lifecycle hits update
durability/attribution without an independent retaliation write. Zero player
hull commits terminal status and stops every later phase. Beam arithmetic remains
in the existing module hit rule; the shared player durability boundary validates
and commits it. NPC and station beams use the universal hit/death owner; planet beams remain presentation only. Saved last-tick
`npcBeamEvents` capture origins/targets for presentation, never damage replay.
They expire at the next tick commit before validated repair. System entry alone
captures the required saved `entryActorSlotCount` before encounters; encounter
targeting and NPC decisions consume this same historical cursor. Decisions also
receive the frozen planet position without introducing any new position owner.

The Zustand action reads, delegates and publishes once; it does not reproduce
zoom, movement, weapon, NPC, random-state or commit ordering. A failed tick must
publish nothing and leave the prior world reference active.

The world model separates schema/immutable construction (`world-schema.ts`),
read-only projections (`world-selectors.ts`) and validated operations
(`world-state.ts`). The operations facade retains established consumer imports.
Full world parsing and focused tick commits share the weapon-history invariant
from `world-schema.ts`: accepted/resolved sequences, the latest shot's weapon
and its completed tick must agree. Tick publication retains the parsed armament
copy so caller-owned input cannot rewrite or acquire ownership of live history.
Display purchase quotes and commit revalidation share `purchase-quote.ts`; an
earlier quote never grants authority to spend against a changed world.

Scene travel coordination belongs to `app/travel-lifecycle.ts`, an encapsulated
transient controller observed by React. It owns preflight cancellation, the exact
pending arrival, view readiness, cosmetic audio and summary lifetime; the store
alone owns payment/publication/rollback. Disposal invalidates asynchronous work
and releases outstanding arrival locks through the exact-arrival operation.

Optional station lifecycle policy extends that same transaction with scalar
damage, consumed standing, signed scoped strength, persistent presence and bounded generated actors.
Module policy returns validated effects; shared orchestration owns allocation,
shot resolution, reference cleanup and one publication. Active condition and
target slots are distinct from durable membership: re-entry resets actor state,
while active save continuation retains it. Independent communication and HUD
notice outcomes retain their own authoritative sequences; local panel dismissal
and observed-revision baselines never mutate them. Cosmetic audio is lazy and
scene-owned, guards live revisions and survives effect replay without duplicate
playback. No writable module cache or arbitrary
module-state bag is introduced. See [lifecycle contracts](architecture/STATION_LIFECYCLE.md)
for identity, RNG/order, strict restore and pending-arrival rollback ownership.

Declared standing scopes are system-associated numeric identities independent of
the selected spatial-system roster. An offscreen standing entry grants no travel
destination or actor. Mutable strength scopes still require a selected spatial
system. Content defaults, lifecycle policy entry and restore share one exact-scope
validator: require every declared standing key exactly once, reject
missing/foreign/duplicate keys, and never fill or silently filter. The authoritative
standing schema requires finite signed values.
Rules API13 supplies `systemStanding` as a copied frozen array with frozen entries;
policy returns validated updates without receiving a world or mutation handle.
Shared code rejects duplicate, foreign and missing-prior updates before one atomic
publication. No second current-value cache or arbitrary module-state bag is needed.

Lifecycle condition visibility and mutation permission are separate contracts.
Keep complete authored station records in lifecycle-enabled systems, including
readonly actors. Strict restore requires each nonmutable station's authored initial
scalar and false sticky blame, rejecting impossible damage before
changing live state or stored bytes. Legitimately changed standings retain their
signed values rather than being reset to defaults.

Module schema13, Rules API14 and save format5 introduced the bounded
[active-station visit contract](architecture/ACTIVE_STATION_VISITS.md). Durable membership
decides fresh reconstruction; entered actors retain their independent current
condition and lifetime. An immutable entry-membership snapshot plus ordered
distinct settlements lets restore prove exact live identities/slot holes and
replay only module-owned membership effects. The same pure membership policy
serves live settlement and restore. Its validity hook receives copied frozen
authored defaults/mutable scope at module activation, settlement and restore,
preventing a module policy and loaded content from silently disagreeing.
Exact pack/module/rules/save checks reject prior envelopes. There is no implicit
migration, default merge or inactive-world cache.

Current module schema20 retains that visit contract. The common capture/restore
parser separately validates ordinary starting encounters in every system,
including unowned/stationless worlds and modules without station lifecycle.
Zero actors remains legal after death or travel; one requires the authored
start's home system and ship definition. Authored offer identity is immutable,
with stock from zero through its initial ceiling. A depleted offer remains
present; an undeclared offer cannot be invented. Generated lifecycle actors
retain their separate identity/visit validation. These checks establish content
consistency, not authenticated play history.

Inter-system departure is a separate command from a fixed tick. Its simulation
feature re-quotes the selected route, checks module-specific eligibility and
publishes fuel, calendar date, player location, destination planet/stations and
cleared old-system references in one validated world. It retains the input world
reference on a rejected departure. S17 owns the browser scene lifecycle around
this simulation transition.

Rules API10 adds the validated destination system ID to the frozen departure
policy context. The shared simulation supplies identity from immutable content;
the module owns access requirements and refusal semantics. This does not add
progression state or let presentation bypass eligibility. A module may explicitly
retain unavailable access until its progression consumer is implemented, with
one authoritative policy/message and documented compatibility limits.

Avoid mirrored authoritative state in a store, a renderer and React components. A simulation feature may own transient working data, but ownership and publication into state must be explicit. Subscribe to the smallest useful state projections; keep render-rate transforms and effect updates out of broad React subscriptions. Publish related state changes coherently so observers do not see partially applied transactions. Persist versioned serializable data through the storage adapter, not store actions, PixiJS objects or React objects.

When a panel displays a subset of a frequently replaced entity, define a named
view-model selector containing only rendered values and semantic notification
keys. Use shallow equality for object projections only after measuring relevant
and unrelated publications. A repeated alert sequence can remain relevant even
when its visible text is unchanged. Do not hide authoritative state or business
rules in these projections; they are read-only render invalidation contracts.

Prefer **React** for client menus, settings, forms and text-heavy panels. Keep components focused on presentation and interaction, consuming Zustand selectors and dispatching commands/actions. PixiJS remains responsible for the spatial game view and effects. Keep temporary, component-local interaction state local when it is not shared game/application state.

## Dependency direction

Normal dev/build/preview and production type checking consume only maintained
`src/`, runtime module inputs and root package/config files. They never execute
recovery hooks or include tests. `vitest.config.ts`, development type checking,
staging, audits and evidence are optional development capabilities. Recovery
generates reviewed snapshots explicitly; normal builds must not rewrite them.

- `app` constructs and connects implementations; it is the composition root.
- `simulation` depends on domain types and explicit contracts. It cannot import `app`, `rendering`, `ui`, browser adapters, DOM APIs or PixiJS.
- `content` provides validated, immutable definitions. Keep decoding of raw `.fbm` fields and migration concerns outside gameplay systems.
- `rendering` and `ui` may consume simulation contracts and read models. They do not reach into feature internals.
- `platform` implements browser-facing services through explicit interfaces. Simulation modules never call storage, audio or networking directly.
- No runtime module imports recovery tools or generated ActionScript. Convert evidence into reviewed, typed content and maintained implementation first.
- Shared `src/` never imports a concrete game module. Only the composition root
  imports the build-selected rules, entry and gameplay presentation contracts. Modules receive immutable state and
  typed inputs, never raw store mutation access. Build only one module's public
  assets and executable rules into each distribution.

The React entry capability is defined in `src/ui/entry-presentation.ts` and
provided by the `selected-game-client` build alias. Only `src/main.tsx` imports
that alias. The entry factory completes after content validation inside the
bootstrap failure boundary; invalid entry data or a failed entry chunk cannot
publish a store/root. Renderer/spatial and gameplay preparation are deferred
until a new or restored session requests them. No scene/input/scheduler starts
before that preparation succeeds. Loading failures have retry, menu and save
recovery without advancing the selected world; a replaced session ignores old
completion callbacks. The module's page-owned loader caches successful results,
retries rejected preparation and disposes late results after page exit.
See [the client contract and acceptance](architecture/CLIENT_LOADING_2026-11-06.md).
The entry receives validated immutable module definitions, a named
`onStart(startId, identity?)` intent and host-owned
browser save controls; it receives no store handle. Each module owns its entry
routes, selection previews, coordinates, artwork and local interaction state.
App calls `useSavePanel` persistently so its operation lock and feedback survive
entry routes and scene transitions, while the entry decides where the controls
appear. Existing gameplay panels remain the shared slice presentation until
their concrete replacement.

Editable identity is a concrete optional extension of that start intent, defined
by `PlayerIdentitySchema`: three single-line strings for captain, vessel and
organization labels. Empty, whitespace, Unicode and long names are retained;
line separators and extra fields reject. These labels confer no faction,
ownership or progression rights. Module content may supply authored identity
defaults; omission normalizes to null. Preview drafts remain module-local, and
editable display text for resources never becomes a balance override. The host
validates the complete identity before constructing or publishing a world and
copies it into the player's frozen component. The entry callback binds the
current menu session; a retained callback cannot replace another live session.
Restart reconstructs the authored start defaults, while restore keeps the saved
committed identity. The nullable identity component introduced in save format2
remains required in current format4, which rejects earlier formats without
migration. See [save ownership](architecture/SAVE_SNAPSHOT.md).

The selected gameplay frame follows the same composition-only import boundary
through the deferred module client. Its concrete contract supplies a frozen
Zod-inferred HUD projection, a separate nullable frozen player-identity projection,
host-owned viewport/slice/save slots and named
return/readiness callbacks. Schema and projection have separate files so module
presentation types do not depend on app/store adapters. The host gates sampled
flight input during artwork failure/loading and clears held input on focus or
readiness transitions; world time continues. System changes reset module HUD
state without moving travel rollback into the presentation. A scene render
failure unmounts the complete scene subtree, uses each service's existing disposal
path and exposes return/save recovery; session revision resets that boundary.
See [gameplay authoring contracts](GAME_MODULES.md#gameplay-presentation).

The selected-target capability extends this frame with `SelectedTargetView`, a
flat, frozen Zod-inferred union, and `onClearTarget`. Its adapter selects only
identity/content keys, available NPC durability and target-minus-player world
coordinates. A shallow subscription observes relative movement and condition
changes while unrelated world publications stay irrelevant. Stations have no
runtime durability component; presentations must preserve that absence. Static
capacity, names and expressive indicator rules remain module-owned. Clearing
dispatches the existing validated selection action; it adds no simulation or
save state. The module places its target presentation, while other host slice
tools remain independently available. The independent example uses the same
projection and intent through a generic readout.

Bounded contact inspection adds separate frozen Zod-inferred planet and selected
contact projections. They carry runtime identity, content keys and relative world
geometry only; separate shallow subscriptions ignore condition, inventory and
clock publications that do not change these facts. Modules own temporary contact
opening/dismissal and invalidate it when its identity disappears or changes.
Existing scene/session remounts reset presentation state on travel/restoration.
Inspection does not imply simulation hail eligibility or supply missing NPC
names, race, dialogue, reputation or live station properties. The independent
example uses identity-keyed native disclosure controls with authored descriptions.
No new simulation command or persisted contact state is introduced.

Repair presentation receives the frozen flat Zod-inferred `RepairView` and named
`onBeginRepair` / `onCancelRepair` intents. The host quotes through the existing
simulation policy; presentations neither calculate eligibility/prices nor redeem
a stale displayed quote. Begin always validates the current world and pays once;
cancel retains the existing unrefunded policy. Separate shallow subscriptions
observe durability, active state and payable quote facts while ignoring unrelated
world publications. Repair controls leave `sliceTools`; modules place them once,
and the independent demo/default frame uses the focused generic `RepairReadout`.
Unmounting artwork never cancels or refunds authoritative repair state.

Selected-merchant presentation consumes the flat frozen Zod-inferred
`PurchaseView`: runtime merchant/content identity, finite offer, cargo occupancy,
capacity, currency balance and simulation-quoted availability for one ton and
the whole advertised stock. Its separate shallow subscription ignores clock,
position and condition changes. `onPurchaseCargo(quantityTons)` binds the displayed
merchant, system and session revision before delegating the existing validated
command. Retained callbacks cannot buy from replacement selections or sessions;
current stock, room and payment remain simulation authority. Purchase leaves
`sliceTools`; authored modules and the independent generic readout place it once.
No simulation, rules or save API changes are needed.

Route presentation receives a deeply frozen Zod-inferred `RouteView`: current
system, copied evidence-qualified map positions, per-destination simulation
quotes for local hover inspection, selected route/fuel facts and concrete
departure readiness. A cached selector observes only origin, vessel, destination,
repair state and quoted fuel balance; flight, targets, clock and unrelated
resources do not republish it. Read-only `assessSelectedDeparture` owns the same
guards and module approval used by atomic travel. Assessment never constructs an
arrival world, advances a calendar or allocates destination entities.

`onSelectDestination`, `onDepart` and direct-marker `onDepartTo` bind the displayed
session, origin and selected destination. Retained handles cannot act on a new
selection/system/session, and loading/arrival reject further route intents.
Direct marker departure selects the validated marker before entering the existing
host preflight. The host retains asynchronous preload cancellation, atomic commit,
audio, view readiness and exact-arrival rollback. `routePhase` and `routeError`
are transient host presentation facts, separate from typed simulation refusal.
Map controls leave `sliceTools`; modules place them once. Demo/default use the
pure generic `MapReadout`, exercising the independent demo route policy. No save
or rules API change accompanies this presentation seam.

The bounded journey presentation adds a frozen Zod-inferred `travel` snapshot,
owned above the system-keyed module frame. It contains origin/destination and
vessel keys, copied origin sprite geometry, a monotonic start time, quoted days,
actual calendar days, fuel debit and arrival date. Preflight facts are provisional
presentation input; only `routePhase === 'ready'` permits an arrival report.
Failed preload or exact-arrival rollback removes the snapshot. The snapshot
survives system remounts, but never session replacement or save/restore.

A component's optional validated `travelPresentation` static configuration sets
the minimum departure duration and optional normal-player hiding while its actor
overlay is shown. The host waits both this cancellable interval and destination
preload before revalidating/committing travel. During that wait the system keeps
running with idle player controls, as in the source, where `mapclick` commits at
once and every NPC clip keeps playing while the player clip warps; the preparing
operation therefore retains only its session, origin and destination, and the
commit revalidates the then-current world (a replaced session, a destroyed player
or a different origin cancels, unpaid). Canvas activation and flight input are
refused while the player warps. Rendering owns only player-sprite visibility,
preserving the live world and authoritative entity.
Viewport readiness still finishes or rolls back the exact committed arrival;
presentation clocks cannot acknowledge readiness or authorize travel.

From the paid commit through readiness, and while the arrival summary is
retained, the host pauses fixed updates (`pausesWorld`) until `onDismissTravel()` acknowledges that operation/session. Retained or early
Continue handles cannot dismiss another journey or complete loading. Saving at
this ready stage serializes only the committed world; restoring opens gameplay
without the transient summary. Commands and canvas picking cannot mutate a
pending arrival before readiness, protecting exact-world rollback. A scene
failure/disposal rolls back any still-outstanding exact arrival and releases its
save lock. The independent demo supplies its own brief departure interval and
generic arrival readout through the same contracts.

The frozen Zod-inferred `PlayerSpatialView` supplies player registration, heading,
zoom and displayed local/rotated AABB dimensions in logical viewport pixels.
`rendering/player-geometry.ts` owns the geometry calculation for both the Pixi
sprite and this projection; DOM scale and device pixel ratio are excluded.
Registration follows the player camera anchor even when the world's zoom pivot
differs. The projection uses the completed simulation heading; Pixi supplies its
interpolated heading to the same helper on each display frame. Active repairs
block turns, so any entry interpolation settles within one simulation interval;
this contract does not promise display-frame synchronization of React overlays.
No spatial UI value feeds back into simulation or saves.

Terminal presentation is an optional named `TerminalPresentation` export from
the existing selected gameplay capability. The host replaces the active scene
subtree on authoritative `player-destroyed` status, disposing its keyboard,
scheduler, pending travel interval/preload, audio and Pixi view through their
normal cleanup paths. Terminal artwork uses no live viewport or simulation clock.
The module receives frozen Zod-derived final vessel/system/start keys, copied
sprite geometry, a host monotonic mount epoch, host save tools and guarded menu
and explicit restart intents. No world/store handle crosses this seam. The exact
terminal world and session revision guard retained callbacks after restart,
restore or menu. Animation and expressive outcome navigation remain module-owned;
they cannot revive, tick or modify the terminal world. A separate session-keyed
error boundary exposes host recovery if terminal rendering fails. Presentation
state and epochs are transient and absent from saves; restoring a terminal world
mounts a new presentation without constructing active gameplay services.

Before the child viewport is disposed, active-scene cleanup may capture one
logical-viewport PNG with only the player sprite hidden. The renderer restores
its visibility in `finally`; extraction never changes the authoritative world.
The host passes the resulting immutable image as a React backdrop slot, keyed to
the exact terminal world/session. No live renderer is retained. Capture failure
is cosmetic and cannot block cleanup; terminal restores have no previous scene
image and receive a null slot. New sessions/menu release the transient snapshot.

Keep public module interfaces small. Enforce these boundaries with lint/import restrictions when the TypeScript project is created. Strict TypeScript checking, including unchecked-index handling, is required. Do not disable checks globally to accommodate legacy data.

## Robustness

Use a fixed-step simulation with documented update order. Supply time and randomness explicitly so behavior can be reproduced without a renderer. Define how pause, browser suspension and accumulated update time are handled.

Use the selected module's authoritative update rate and add presentation-only interpolation for display-rate rendering (60 fps or higher where supported). Module-specific timing decisions and evidence belong with that module. Interpolated transforms must never drive gameplay or persistence.

Validate content, imports and saves before they enter active game state. Preserve original IDs in an explicit mapping; use named typed fields during gameplay. Make invalid references, unsupported schema versions and migration failures diagnosable. Never silently substitute plausible data for a recovery uncertainty.

Ordinary cargo occupancy has one pure model implementation, `totalCargoTons`,
shared by purchase validation/commit, read models and save restoration. Resource
balances do not count toward hold tonnage. Restore rejects unsafe aggregate
quantities or cargo beyond the selected vessel's capacity before publishing a
world; individually valid commodity fields do not establish a valid inventory.

Version save schemas and content packs. Keep persisted game state independent of runtime objects, listeners and textures. Failed loads must leave the current game intact. Test round trips and migrations as those capabilities are added.

Each scene/component that subscribes to input, events, tickers or asynchronous work must have an explicit disposal path. Document resource ownership. Handle failures at the responsible boundary and provide useful context; do not swallow exceptions or leave partially initialized scenes active. Establish cleanup as resources are acquired, use the same idempotent disposal boundary for rollback and normal teardown, and attempt every owned cleanup even if one fails. Preserve the initiating setup error during rollback. Shared cached assets are not scene-owned and must not be destroyed with display objects. For Pixi specifically, do not call `Application.destroy()` before a renderer exists; release the constructor-owned stage in that phase, then use full application destruction after renderer assignment.

## Readability, comments and documentation

- Write readable, consistently formatted TypeScript with descriptive names and small, cohesive functions. Prefer explicit control flow over dense one-line expressions in maintained code.
- Use early returns and guard clauses for invalid inputs, unavailable resources and completed branches. Keep the main successful path shallow.
- Prefer multiple separate `if` statements. For mutually exclusive branches, return or otherwise terminate the handled branch so independent statements cannot accidentally perform conflicting actions. Preserve original behavior when rewriting legacy conditionals.
- Prefer `map`, `filter`, `find`, `some`, `every` and other appropriate array methods over `for` and `while` loops. Use each method for its intended operation; avoid `map` for side effects and complicated `reduce` expressions that obscure the logic. Sequential binary parsing and demonstrated performance needs can justify explicit loops.
- Give every maintained module an overview explaining its responsibility and important dependencies. Document exported types, components and functions with TSDoc: purpose, inputs/outputs, units, mutation/ownership, assumptions and failure behavior where applicable.
- Comment algorithms, ordering constraints, unusual constants, legacy compatibility behavior and non-obvious tradeoffs near the relevant code. Explain why a choice exists. Comments must add information rather than restate syntax.
- Record source provenance for recovered rules, including stream/script references and whether behavior has been verified in playback. Distinguish confirmed behavior, temporary assumptions and intentional fixes.
- Use named constants for meaningful units, thresholds and IDs. Explain formulas and coordinate conventions. Preserve unusual legacy rules through documented compatibility decisions.
- Give each substantial subsystem a short document covering responsibilities, data flow, lifecycle, extension points, examples and known limitations. Document content/save formats and provide practical instructions for adding a ship, weapon or mission once those extension paths exist.
- Record significant architectural decisions under `docs/decisions/`, with context, decision and consequences. Keep setup, commands and troubleshooting current in the README.
- Update code comments and documentation in the same change as behavior. Do not edit generated original ActionScript to make it match these standards; use adjacent provenance documents.

## Projectile ownership and impact

The C4 extension adds a nonselectable `world.projectiles` collection using the
same allocator as actors. Zod owns state and focused module flight/motion
contracts. Accepted projectile commands pay once and consume their primary
sequence by allocating a projectile; they do not enter immediate hit resolution.
Prior accepted beam ordering remains intact. After movement, beam/lifecycle
settlement and repair, existing projectiles advance in allocation order. New
emissions wait one tick. Each impact sees earlier same-tick settlements and
reuses the existing damage/lifecycle boundaries without replacing current
equipment or primary history. Failure publishes none of the candidate tick.

Collision latches a pending impact; its module-declared delay owns exactly one
damage application. Flight and impact ages are authoritative save6 state, while
Pixi sprites/interpolation remain disposable projections. The renderer preloads
both equipped and saved projectile artwork, including former launch weapons
after a refit. Arrival clears local shots atomically and exact rollback restores
them. Historical target references never retarget a replacement actor. Rules16
and module17 require explicit old-envelope rejection; remaining reciprocal NPC
combat and equipment effects retain their own implemented contracts.

Beam presentation remains view-owned and derives its transient lifetime from
accepted armament events. Module17 optionally supplies ordered bitmap keyposes
and a committed-tick cycle; omitting both retains the single-image path. Content
validation requires a zero-age pose and strictly increasing ages inside the
cycle. The renderer preloads every layer image, allocates the peak layer count
once and composes each authored affine with camera zoom and target distance.
Unused layers hide on pose changes; expiry/reset hide all, and the parent view
owns disposal. This changes no damage timing, gameplay RNG or save fields.

## Special fields and actor status

Rules17 supplies optional bounded special-device definitions and a focused
module scan-roster projection. Module18 carries special bitmap layers, exact
fractional crops, registered rotations, nested animation and optional cloak
presentation. Save7 persists fields, status and canonical sparse actor slots.
The current contracts reject older exact envelopes rather than migrating them.

`special-weapons.ts` owns command validation/payment and ordered settlement;
`special-effect-state.ts` owns Zod state. A field uses the same allocator as
actors/projectiles, captures its launch policy/vessel and remains nonselectable.
Existing fields advance after projectile settlement; new fields wait one tick.
Movement decrements engine counters before later field refresh. Cloak gates
ordinary firing, while tractor resets speed after movement. Module data owns
cost multipliers, durations, legacy scan offsets and effects; shared orchestration
owns identity, finite validation and atomic publication.

The saved sparse actor roster retains station-prefix holes and appends new
mobile identities in allocation order. Pulse scan-span changes are witnessed
only when the projected roster grows. `pulse-scan.ts` supplies the same reset/
increment rule for runtime and exact cursor replay; `pulse-progression.ts` owns
age/scale/quantized-alpha arithmetic for both simulation and restore. Malformed
continuations, reordered/omitted rosters, future historical target IDs and
unsupported captured capabilities reject before publication.

Rendering and collision share `special-effect-geometry.ts`, including source
registration, spinning children and retained transparent static bounds. A
separate view-owned cloak interpolator fades disposable sprites; no visual age,
opacity interpolation or cosmetic random draw affects simulation or saves.
Scene readiness preloads every supported special layer/pose, including saved
fields emitted before a refit. Arrival clears local effects atomically and
rollback restores the exact previous field/status world; terminal worlds freeze.

## Active vessel replacement

Rules API15 introduces optional module-owned trade-in/launch policy through
`simulation/contracts/vessel-purchase.ts`. Zod owns the focused context/result
types. `simulation/features/vessel-purchase.ts` authenticates a current planet
offer, validates policy results and capacity/balances, and returns a new frozen
world with price, refill, durability and default equipment settled once.
Player identity, position, cargo and unrelated world state remain intact.

The application store validates the resulting save before publication and holds
an exact replacement/source pair until the renderer acknowledges readiness.
Commands and simulation cannot replace that pending world; save capture refuses.
`app/vessel-purchase-lifecycle.ts` owns cancellable asynchronous image preflight,
stale-intent checks and rollback. Since 2026-11-14 the world keeps running during
the image preflight (the source purchase is instant): on completion the intent is
revalidated against the then-current world, not by world identity, and only the
committed replacement pauses fixed updates (`pausesWorld()`) until the remounted
renderer acknowledges the new hull. `isBusy()` still locks purchase UI, saves,
canvas input and steering for the whole operation. A generation key forces renderer recreation
even for a same-hull refit, while background/parallax selection stays stable.
The retiring renderer rejects a different hull before reading changed bounds.
Restoration, menu exit and disposal invalidate outstanding requests. No renderer
or browser API enters simulation, and saves retain the current definitionId
independently of their starting-choice ID without a new save schema.

## Equipment ownership and ordered firing

`model/equipment-state.ts` owns sparse inventory, technology ownership, a market
adjustment/revision and two additional armament histories. The existing primary
armament is channel1; `equipmentArmaments` gives the single ordered view. Zod
validates equipped-copy counts and channel histories. Content-aware persistence
also validates supported definitions, hull eligibility and market policy.

`features/equipment.ts` authenticates revision/session/system/hull-bound intents
and current selected offers before one payment/ownership/channel publication.
Module policies supply prices and market generation; shared code owns mutation
and invariant enforcement. The store rejects operations during pending travel or
vessel replacement and validates the resulting save before publication.

`features/equipped-combat.ts` reuses established hit/projectile/special consumers
in channel order. A private draft carries remaining energy, cloak, deaths and
allocation; histories/cooldowns stay per channel. A later failure discards the
entire tick. Survivors navigate once and generated actors wait until the next
tick. Captured emitted effects survive loadout/refit changes without repayment.
Rendering preloads the bounded supported effect set and observes independent
channel shot ticks; it owns no equipment rule or payment state. Presentation
receives immutable views and guarded intents through the selected module contract.

## Module-selected spatial presentation

The current module-client boundary supersedes earlier image-oriented ownership
descriptions in the historical feature introductions above. Gameplay content and
saves validate canonical `combatGeometry`; they never load spatial manifests.
`gameplayZoomLevels` retains the authored denominators consumed by rules, and
saved `cameraZoom` remains a compatibility field with gameplay meaning. Visual
camera angle, magnification and artwork have no authority over these values.

Only `main.tsx` imports `selected-game-client`. A trusted module `client.tsx`
validates its spatial document and closes over configuration needed by its React
components and adapter. The host receives neutral components and a
`SpatialPresentation`; no registry, concrete adapter fallback, graphics type or
unvalidated configuration bag enters the application, simulation or persistence.
Pixi and Three implementations are optional adapters under `rendering/`; a
module can provide a different implementation of the same bounded capabilities.

`app/scene-preparation.ts` owns monotonically changing generations, cancellation,
independent cosmetic seeds and prepared leases. Initial load, restore, travel,
refit, same-hull replacement and retry share that protocol. Preflight prepares
the candidate without world mutation; the host publishes its transaction only
when current, then unlocks the exact arrival/replacement after attachment. A
retired view's pointer callbacks lose authority immediately. Pending attachment
retains its preparation until late completion can be disposed safely. View-owned
nodes/listeners/GPU objects are released before preparation-owned assets.

Committed player projection is optional and synchronous, requiring no active GPU
for terminal restore. Modules requiring actor overlays validate and bind their
own projection; absent optional geometry never suppresses the generic gameplay
frame. Screen projection remains distinct from semantic world heading. Backdrop
capture is optional, synchronous and best-effort, with temporary visibility
restored in `finally`. Terminal restore starts no active flight services.

`simulation/geometry/` owns numeric rectangles, affine transforms and the single
age-dependent effect evaluator. Source-specific preparation compiles geometry
and image placement together from reviewed facts, then publishes separate
documents. Rendering consumes canonical effect geometry and maps layer IDs to
artwork; it cannot alter collision by resizing a texture or model. Inclusive
edges, registration, fractional crops, quantized alpha and collision timing are
preserved. Frozen pre-refactor traces verify the extraction.

Source audits reject direct/transitive graphics dependencies from neutral owners
and DOM globals from headless core. Build policy is module-owned. Vite rejects
forbidden package resolution before ordinary resolution, audits every emitted
chunk and writes `build-graph.json`; distribution verification checks that graph
against actual JavaScript files. Fresh minimal copies build each module with its
peer physically absent. Installed development dependencies can contain both
libraries; selected distributions contain only their chosen renderer code.

## Extension and completion criteria

New content using existing mechanics should be added through validated definitions. New mechanics should extend the relevant feature via a small documented contract. Avoid speculative abstractions for multiplayer, mod scripting or other deferred features.

A runtime feature is complete when it has a clear owner, typed interfaces, meaningful behavior/failure tests, appropriate cleanup, and current documentation/comments. Verify simulation behavior independently of rendering, plus integration at actual feature boundaries. Tests must cover outcomes and invariants rather than mirror implementation details.

TypeScript runtime suites belong to Vitest. CommonJS `*.test.cjs` tooling suites
belong to `node:test`; importing them into Vitest executes the Node tests but
registers no Vitest suite. The Vite test configuration therefore excludes those
files. Standard shared tests run `test:tools` explicitly, and the selected-module
test command separately discovers that module's tooling checks before its
verification hooks. `tools/run-tool-tests.cjs` owns this game-neutral discovery
and propagates failures; module recovery/evidence remains module-local.

Apply these requirements from the first slice onward. Refactoring exploratory work into this structure is part of implementation, not a cleanup task deferred until the end.

## Delivery contracts and surface missions

`model/cargo-state.ts` owns optional occupied-position `contract` metadata:
destination system ID and fixed safe-integer payment. All cargo reconstruction
preserves it; allocation and transaction validation exclude contracts from both
sales and purchase merging. Accepted contracts survive refit, travel and reload.

`model/mission-state.ts` owns visit offers, pending surface index and entry
evidence. `features/visit-missions.ts` captures `world.randomState` after commerce,
calls the pure optional mission capability and commits its returned stream.
Captured standing and stable station placement keys preserve creation context
through standing changes and station loss. Restore replays this context and any
successful negotiation inputs; absent offers and consumed index zero stay absent.
This proves content consistency, not authenticated player history, just like C6.

`features/missions.ts` owns validated atomic accept, negotiate and surface
transport candidates. Acceptance clamps whole tons and uses the first empty
position; negotiation is once per station offer, awards progression first on
its separate stream, then draws from `world.randomState`. Transport requires
module-owned planet-overlap policy, delivers the lowest matching occupied slot
(including the last slot) regardless of population, or consumes a populated
surface mission before resolution. The standing delta targets only the current
system through `applyStandingDelta`; lifecycle absolute updates share its
validated replacement owner. Index zero is fallback with zero standing change;
module progression policy must award no fallback experience. Long mission text
uses the shared notice message schema (up to 4096 characters).

`ui/mission-view.ts` exposes copied frozen facts and refusal text; guarded
`app/mission-intent.ts` callbacks reject stale sessions, systems and allocated
planet identities, even if a seed repeats. Encapsulated store actions retain
travel/refit locks and validate a save before one publication. Save12 includes
offers, captured seeds/context, negotiation evidence, pending index and cargo
contract metadata. Invalid policy or restore data never replaces the session.
Absent module capability means null mission state and no mission stream draws.

## Captain progression

World-level `progression` is null exactly when the module has no progression
content. Otherwise its frozen experience/tally records exactly match declared
IDs, with finite non-negative values and a dedicated uint32 random state.
`model/progression-state.ts` owns initialization, the shared exact-key assertion,
selectors and `applyProgressionDelta(world, delta, content)`. Dependency-free
schemas live in `progression-schema.ts` to avoid a world/operation import cycle.
Sparse deltas only add finite non-negative amounts; undeclared IDs and overflow
abort before publication. Empty deltas preserve the world reference.

`features/progression.ts` validates the frozen event and policy result for accepted
travel departures, paid repair starts, ordinary shots and special activations.
Both firing paths carry accepted events into the private tick; equipped channels
resolve them in order, with each seeing prior progression. No refused host calls
the policy or consumes progression randomness. A null policy result preserves
the input world reference. Free special-device deactivation earns no event.
The host transition and progression become visible in one store publication;
invalid policy output discards the entire candidate. Vessel replacement retains
this captain-owned state. The progression seed is the construction-time world
seed XOR 0x9e3779b9, converted to uint32, before subsequent market initialization.
No world/NPC random draw is taken or changed. Save capture/restore use the same
exact-key assertion. Current contracts are module23 / Rules23 / save13.

## Shared decision actors and projectile continuation (Rules26 / save16)

Ships and combat-enabled stations reuse NpcCombatStateSchema. Ship navigation
and actor streams retain their existing owners; stations compose that same
history under combat.state alongside combat.navigation and combat.randomState.
Station durability remains the scalar combat.strength/maximumStrength. Death
attribution is derived from current navigation for both kinds, never stored as
an independent player-attributed flag. Station actors never enter movement.

Decisions may emit projectileShots (weapon, own target, launch rotation in
clockwise degrees from up, nonnegative speed in world units/tick) or request a
module-worded departure. The complete result validates before application.
Emissions allocate in decision/array order through the player projectile owner;
new shots wait until the next tick. Captured emitter ID and definition survive
emitter removal. Player impacts call the module hit rule and guarded terminal
commit; NPC/station impacts call the universal lifecycle owner. Planet targets
are supplied to flight but never collide. Lost targets never retarget.

Departure applies the complete decision and its emissions first. The intent's
`durationTicks` (Rules API33) is the module's warp-out length. Zero removes the
mobile actor before movement. Otherwise `features/departure.ts` saves
`npc-ship.departure` (`elapsedTicks`, `durationTicks`, notice; save19): the
actor keeps its slot and position but is inert. It no longer decides or moves,
hits on it are consumed without damage, it is not a selectable contact
(`isSelectableWorldEntity`, so a selection on it clears at once), and damage
masks/shield flashes are not drawn over it. Each later NPC phase first advances
every departure; on the tick it would reach its duration the actor is removed and
the notice published. Removal clears selection and inbound actor navigation,
slots become holes, shots survive, and no death policy or persistent
census/strength/membership change runs. Generated actors have immutable birth
identity, not a durable live-defender roster, so departure needs no death witness.
The optional view-only `visuals.departure` (`rendering/shared/actor-departure.ts`)
maps `elapsedTicks` to stretched-actor or flash samples in the actor's unrotated
frame; omitted, the actor is drawn unchanged until removal. The Three renderer
does not consume it.

NPC cloak and opacity belong only to combat history; player device status keeps
its separate cloak. Opacity is an integer percentage in steps of five. Decisions
own fades; the sprite adapter interpolates the saved percentage without advancing
simulation. Selection and the hail contact projection share one refusal guard,
including the source clicked-target quirk. This does not alter damage targeting.
Earlier exact-version saves reject before replacing active state; no migration.

## Optional text command transaction (Rules API32 / save18 unchanged)

`simulation/contracts/text-command.ts` defines the strict Zod intent and result
schemas and read-only `TextCommandContext`. Modules optionally implement
`resolveTextCommand(context)` to interpret exact input, bounded to 1024 UTF-16
code units. The shared engine contains no vocabulary or matching rules.
`features/text-command.ts` accepts only active worlds (repair is allowed), refuses
malformed results or undeclared resource/skill IDs and duplicate/foreign standing
scopes, and applies all assignments in one unpublished candidate. Resources are
safe nonnegative integer balances; experience is absolute through the progression
owner and may decrease while remaining finite/nonnegative; standing uses the
existing absolute, signed finite owner without clamping. Ordinary progression
deltas retain their monotone semantics and share declared-key validation with the
assignment operation. One world parse commits the complete candidate, with no
random draws or tick work. The store publishes only actual differences. The host
provides `onSubmitTextCommand` only when the optional policy exists, guarding
session/system identity and pending transitions. No new state or saved fields are
introduced; existing persistence validation and save18 cover all assigned values.
