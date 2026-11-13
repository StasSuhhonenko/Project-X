# Runtime navigation

The shared engine contains no concrete game rules or artwork. Selected modules
provide those through validated content and injected capabilities.

| Directory | Responsibility and starting point |
| --- | --- |
| `app/` | Composition, session publication and transient scene lifetimes. Start with `app.tsx`, `app-store.ts` and `travel-lifecycle.ts`. |
| `content/` | Zod content schemas, module activation and read-only catalogs. `game-module.ts` validates before exposing a module. |
| `simulation/commands/` | Validated input DTOs, independent of keyboard/React. |
| `simulation/contracts/` | Focused deterministic capabilities supplied by a module. |
| `simulation/model/` | Authoritative state, immutable construction, selectors and validated operations. |
| `simulation/features/` | Pure gameplay transitions. `advance-world.ts` orders one fixed tick. |
| `rendering/contracts/` | Library-free preparation, view, read-only source and semantic intent contracts. |
| `rendering/shared/` | Used library-free interpolation, timing and appearance helpers. |
| `rendering/pixi/` | Explicitly selected image adapter, configuration validation, asset leases and source projection. |
| `rendering/three/` | Explicitly selected angled-camera adapter, local GLB preparation, scene picking and GPU disposal. |
| `ui/` | Shared panels, immutable display projections and selected-presentation contracts. |
| `platform/` | Browser/keyboard/audio/storage adapters with explicit disposal. |
| `persistence/` | Save capture and strict content-consistent restore validation. |
| `random/` | Neutral deterministic arithmetic; callers own stream state. |

Simulation may consume content and neutral random primitives, but never app,
platform, rendering, UI, React, Pixi or Zustand. Modules may consume shared
contracts/helpers through the `@engine/*` alias (mapped to `src/*`), but never
another module or the application store. Engine files keep relative imports. Only
`main.tsx` imports the selected-module aliases. `tools/verify-runtime-boundaries.cjs`
checks these boundaries, for alias and relative imports alike, in a complete
development workspace.

## Follow execution

`main.tsx` loads the build-selected rules, validates `/game/module.json`, imports
the sole selected `client.tsx` entry factory, creates an isolated store and mounts
`App` with entry and deferred-gameplay capabilities. Once the entry reports
`onPrepared`, `App` warms the module's `gameplay-client` in the background (it
never mounts a scene). Starting, loading or restarting selects the world at once,
but the new `GameScene` mounts invisibly beneath the previous screen: the retained
entry, the terminal backdrop, or a `captureStill` copy of the previous view.
`app/scene-reveal.ts` reveals it once the presentation reports
`onPresentationReadyChange('ready')` and the spatial view has drawn a first frame.
While hidden the scene renders but never ticks, takes input or plays audio; a
failure keeps the previous screen with Retry/Cancel. The page-owned loader caches
success, retries preparation failure and disposes late results after page exit.
Concrete adapters are imported only by trusted module assembly, never by the
shared host.
`GameScene` connects read-only projections and guarded intents to the selected
presentation. `GameViewport` owns asynchronous spatial-view attachment; the Pixi
view owns its graphics, listeners, histories and disposal. `app/scene-preparation.ts`
shares exact preflight resources with attachment, authenticates generations and
keeps leases alive through late asynchronous completion. Simulation geometry
lives in `simulation/geometry/` and requires no presentation assets.

A purchase follows this path:

1. Module contact artwork invokes the injected `onPurchaseCargo(quantityTons)`.
2. `app/purchase-intent.ts` rejects callbacks from a stale merchant/session.
3. The store action delegates to `simulation/features/trade.ts`.
4. `model/purchase-quote.ts` delegates to `model/cargo-transactions.ts`, which
   rechecks and commits payment, occupied positions and finite stock atomically.
5. `ui/purchase-selector.ts` projects the published world back to presentation.

Station/ship sales and station purchases use `app/cargo-trade-intent.ts` -> store
`tradeCargo` -> the same cargo transaction owner. `features/commerce.ts` generates
visit-owned markets and validates captured seed/terms on restore. Module policies
own allocation/pricing. `ui/cargo-trade-view.ts` copies focused hold/market facts.
Resource exchange uses the separate `features/resource-sale.ts` operation.

A delivery contract follows this path:

1. `features/visit-missions.ts` captures the world seed after commerce at entry,
   calls the module's `rules.missions.createVisitMissions` once and saves the
   realized offers, entry standing/station identities and pending surface index.
2. `ui/mission-view.ts` projects frozen offers, acceptance quotes/refusals,
   occupied contract positions and the pending index. `app/mission-intent.ts`
   binds callbacks to the displayed session, system and allocated planet ID.
3. Store `acceptContract` / `negotiateContract` delegate to `features/missions.ts`.
   Acceptance uses the first empty cargo position. Negotiation settles C7 first,
   then consumes the active visit stream and retains replay evidence for its price.
4. `features/transport.ts` composes surface then optional boarding, as one store
   publication. `transportToSurface` asks module geometry policy, pays/clears the first matching
   contract regardless of population, otherwise consumes a populated surface
   mission. `model/lifecycle-state.ts` owns validated standing deltas; C7 owns
   progression. Store publication happens only after complete save validation.

`model/mission-state.ts` owns mission schemas. Contract metadata stays in the sole
`cargo-state.ts` position schema and cannot be traded or enlarged by purchases.
`features/visit-missions.ts` also validates restore by replaying captured entry
context without changing the current stream. Re-entry generates a new visit;
rollback retains the exact previous world. Modules without `rules.missions`
keep null mission state and consume no mission draws.

`features/boarding.ts` validates module assessment/outcomes and settles rewards
through resource, owned-equipment, standing, progression and fleet owners.
Boarding draws use the selected NPC's stream; progression and self-destruction
retain their own streams. Capture links the existing actor via the shared fleet
allocator and preserves condition and immutable generation provenance. Capture
and release may change allegiance without rewriting birth government; save
validation requires a fleet deployment iff current government is the fleet's
owned government. Self-destruction
uses `prepareActorHit`/`applyLifecycleHit`, without a fabricated weapon or new
blame, so removal, outcomes and explosions settle once. No boarding state or tick
work exists. Historical `transportToSurface` app/intent/presentation callback
names remain the single combined Transport path for existing module clients.

Keyboard adapters construct commands. The browser simulation lifecycle schedules
fixed updates; the store delegates a tick to `advance-world.ts` and publishes
once. Module policy calculates permitted effects; the model validates ownership
and invariants. Rendering samples completed snapshots independently of tick rate.

Equipment follows the injected view/intent -> store `equipmentCommand` ->
`features/equipment.ts` path. `model/equipment-state.ts` owns inventory/channel
invariants; `persistence/equipment-validation.ts` checks content-aware restore.
`features/equipped-combat.ts` orders three channels through the existing effects
inside one unpublished tick. Module rules own price/market policy and module UI
owns the controls. See [module contracts](../docs/GAME_MODULES.md) for the optional content contract.

## Change the right owner

Change a game's movement/damage/balance policy in its module. Change neutral
transition ordering in simulation features. `world-schema.ts` owns state shapes
and shared invariants; `world-selectors.ts` owns read-only projections;
`world-state.ts` owns validated operations and the established import facade.
`world-construction.ts` converts validated starts into runtime entities; its
`createStartingWorld` takes one named options object.

System entry has one composition owner, `simulation/features/system-visit.ts`, used
by both start and travel arrival: constructed stations/defenders ->
`features/visit-encounters.ts` -> equipment market -> commerce -> missions.
`contracts/encounter-rules.ts` owns the optional `createVisitEncounter(context)`
spec/result schemas. Modules receive frozen system/government definitions,
population in billions, the world seed and live station placement IDs/count;
they supply ship identities, positions in world units, targets and the next
world seed. The engine validates the whole batch, allocates IDs/actor streams
and constructs full-strength NPCs before the store publishes the complete visit.
Restore validates realized actors without calling the entry composition.

`world-schema.ts` requires every NPC's declared `governmentId` and uint32
`randomState`. Allegiance is owned by the NPC, not inferred from its system.
Generated defenders copy their spawn government's immutable generation witness;
the schema enforces equality, with no independent witness mutation operation.
Visit ships retain validated `encounter: {name, raceId}` identity separately from
lifecycle provenance. `deriveNpcRandomState(sequence)` domain-separates runtime
IDs by XOR 0x4e504321 and applies the neutral LCG permutation, consuming no world
draws. It rejects non-uint32 sequences instead of wrapping. Every NPC's decisions
and navigation continue its own stream, including authored and lifecycle ships;
decisions and movement consume only actor randomness; hit/death settlement
inside the phase consumes world randomness. Save15 captures combat history and all actor
streams; departure discards them and re-entry allocates fresh IDs.

Rules API24 adds optional `decideNpcCombat(context)` and `respondToPlayerShot(context)`.
`contracts/npc-decision-rules.ts` owns their validated result schemas and frozen
focused inputs. `model/npc-state.ts` owns the required combat history and the sole
fresh-state factory (alert, scan/rescue cursors, nullable signed tick timers, hail).
Navigation remains the sole target/offset owner. `features/npc-combat.ts` validates
each complete decision before applying its state, other-actor writes, notice and
beams. NPCs run in saved slot order (holes retained); unslotted ships follow in
entity order. Each actor sees earlier writes. New actors wait until next tick.

Rules API29 adds optional `rechargePlayerShields(context)`
(`contracts/shield-recharge-rules.ts`). `features/shield-recharge.ts` evaluates it
once per tick against tick-entry shields, rejects any lower, non-finite or
above-maximum answer, and hands the value to `commitWorldTick` (`playerShields`)
so it lands atomically with movement; later repair and incoming fire see the
recharged value. Omitted, shields change only through damage and repair.
`rendering/shared/shield-flash.ts` owns the optional view-only `visuals.shieldFlash`
policy and a tracker that derives hits from committed `hull + shields` loss;
`rendering/pixi/shield-flash-effects.ts` draws its colour-filtered overlays above
their owners. Saves carry no flash state.
`rendering/shared/damage-mask.ts` owns the optional view-only `visuals.damageMask`
policy: stepped clipping frames chosen from durability share (player hull; NPC
hull plus shields; station strength) and their size-fitted placement in artwork
pivot space. `rendering/pixi/damage-mask-effects.ts` attaches one stencil
`Graphics` per actor sprite, rebuilt only on frame change; overlays stay unmasked.
Saves carry no mask state.

Rules API29 also adds optional `createTravelArrival(context)`
(`contracts/travel-arrival-rules.ts`): `features/travel.ts` calls it after the
departure progression event and before the destination's entry draws, validates
position/heading/speed/flight mode/stream, and otherwise uses the destination's
authored static `arrival`. `createAppStore(gameModule, { sessionSeed })` seeds each
new session's world and progression streams (the browser supplies entropy via
`platform/browser/session-seed.ts`); without it every start is reproducible.

Both combat hosts follow player movement -> passive shield recharge -> ordered player fire/immediate hits
(and accepted fire progression) -> repair -> sequential NPC decisions/immediate
beams -> all NPC movement -> projectiles/special effects. Immediate player deaths
remove NPCs before they can act; effects settle their victims when consumed.
Incoming zero hull commits terminal status once and returns immediately: no more
actors, movement, effects or progression. NPC status countdown is deferred until
after movement, so decisions and movement see the same engine-disable gate.
When the response hook is absent, the emission helper preserves the delivered
generated-defender target-player response without changing alert. A present hook
returning null suppresses that fallback; lifecycle impacts no longer write target.
Player-target beams reuse the module's size-scaled hit policy and the existing
player durability commit. Non-player beams consume policy timers/draws and emit
presentation events without damage in this increment. `world.npcBeamEvents` holds
last-tick captured origins/targets for multi-emitter rendering; restore never
replays damage. Current player-only renderer beam components need an NPC adapter.

Progression follows accepted travel/paid repair/fire ->
`features/progression.ts` -> module `resolveProgression(event)` ->
`model/progression-state.ts` -> the same host publication. Fire evaluators
attach an event only to accepted commands; equipped channels settle events in
channel order inside the unpublished tick. Restore validates the same declared
key sets before replacing a session. Labels and thresholds remain module-owned.
`ui/progression-view.ts` forwards frozen captain and system-standing facts to
selected presentation status selectors; it derives no game-specific values.

Single owners for shared helpers:

- `model/progression-state.ts`: construction, exact declared-key validation,
  monotone deltas, explicit absolute experience assignments and read-only selectors; `model/progression-schema.ts` holds
  dependency-free Zod definitions re-exported by that public owner.
- `features/progression.ts`: the sole resolve/validate/apply policy boundary.
- `model/cargo-transactions.ts`: `resolveCargoTransferEnvironment` and the default
  slot capacity. The maximum (`MAX_CARGO_SLOT_CAPACITY`) lives in
  `contracts/cargo-trade.ts` beside the schema that enforces it.
- `features/lifecycle-hit.ts`: `createLifecycleDefinitions`, the entity/ship lookup
  adapter used by every hit path.
- `features/combat-effects.ts`: the projectile and special-effect tail of a tick,
  shared by both combat hosts after the shared NPC phase and terminal guard.
- `persistence/save-snapshot.ts`: `assertSaveable`, the pre-publication check
  that a candidate world would produce a valid save.
- `app/app-store.ts`: the private `activeWorld`/`requireActiveVessel` guards. Every
  gameplay command is ignored while a travel or vessel transition awaits
  acknowledgment, or once the world is no longer active.

Change screen ink/navigation in the selected module, shared display contracts in
`ui/`, and camera/interpolation in `rendering/`. Browser storage belongs in
`platform/browser/`; persisted shape and restore consistency belong in
`persistence/`. Keep raw Zustand mutation private to `app-store.ts`.

Formatting is Prettier (`npm run format`, `npm run format:check`) with import
sorting; linting is oxlint (`npm run lint`, `npm run lint:fix`). TypeScript 7 stays
the only compiler. Reviewed JSON, assets, Markdown and evidence-bearing BM1 staging
scripts are excluded from formatting; see `.prettierignore`.

Shared tests live in root `tests/` by responsibility, including `tests/app/`,
`tests/rendering/`, `tests/simulation/` and `tests/persistence/`. Module tests live
in their module's `tests/` and beside UI features. Normal builds require only
runtime source, reviewed public snapshots and root package/configuration files;
tests, tools, evidence and internal docs are optional development inputs.

Shared decision actors (Rules26/save16): model/decision-actor.ts adapts the same
combat history for ships and scalar-durability stations. features/npc-combat.ts
owns sequential validated writes, beams and projectile emission;
features/projectiles.ts owns allocation, flight and delayed impact for every
emitter. features/departure.ts removes a mobile actor without death settlement;
model/decision-actor.ts clears inbound navigation without changing shot history.
NPC cloak/fallback history lives only in model/npc-state.ts. Contact projection
and targeting reuse the selection guard; rendering/shared/actor-opacity.ts only
interpolates the saved NPC opacity. Save16 validates historical emitter allocation
and captured definitions even after emitter death or departure.

## Optional fleet ownership

`contracts/fleet-rules.ts` owns validated module pricing, creation/placement and
release policy DTOs; `model/fleet-state.ts` owns stable `owned-N` identities and
visit deployment joins. A module that omits `rules.fleet` gets no world/save key,
no fleet draws or entry work, and a null `ui/fleet-view.ts` projection.

`features/vessel-offer.ts` authenticates the shared planet/selected-station offer
for both captain and fleet purchases. `features/fleet.ts` validates policy output,
rechecks resources and publishes payment, roster and one full-condition actor
atomically. Named actors use `model/encounter-actor.ts`, shared with ordinary
visit encounters; its per-actor seed consumes no world draws. Policy owns name,
race and placement draws, never engine identity or mutable state.

`features/system-visit.ts` composes encounters, fleet placement, equipment,
commerce and missions in that order. Fleet ships have no generated merchant
market: acquisition adds no draws after creation; release preserves the live
non-merchant actor. Travel discards deployments while retaining roster locations.
Restore validates realized actors without replaying entry. `fleetAfterDeaths`
is called inside the universal hit owner before removal publication (and by the
outcome-free destruction helper). Release removes ownership, pays once and leaves
the named actor alive with the validated new government and planet target.

The app store authenticates session revisions; fleet operations authenticate the
roster allocator and live offer/deployment facts. `app/vessel-purchase-lifecycle.ts`
shares prepared-art preflight, source-world currency, renderer acknowledgment and
exact rollback between Self and Fleet. Its `acquireFleet` method drives the
optional fleet props; synchronous store release requires no artwork preparation.
`persistence/fleet-validation.ts` enforces capability presence, declared roster
hulls/systems/geometry and deployed allegiance before restore publication.

`features/fleet-orders.ts` owns optional live orders, persisted missions,
world-stream launch placement and outcome-free recall. The sole C11 placement
owner is reused for launch in roster order; new deployments always start without
an order. Travel follows only declared follow orders before discarding visit
links. Stowed roster ships have null system IDs and no actor/deployment; counts
and reports retain them, while map/sale/entry exclude them. `fleet-state.ts` owns
structural joins; `persistence/fleet-validation.ts` checks capability-dependent
field presence and declared order/mission IDs. Without `fleet.orders`, no new
saved keys or draws exist. Store commands validate complete candidates and
publish once; `FleetView` exposes copied nullable intent and live-slot order.
NPC decision self reads its live order and player selection without gaining a
write path to either. Rules API31/save18 reject previous envelopes.

## Optional text commands (Rules API32)

`contracts/text-command.ts` owns the strict Zod intent/result schemas and frozen
policy context. The selected presentation receives `onSubmitTextCommand` only
when `rules.resolveTextCommand` exists. The app rejects stale session/system
callbacks and transitions, then the store delegates to `features/text-command.ts`.
The policy interprets exact text (up to 1024 UTF-16 code units); shared code owns
no command vocabulary. It validates sparse absolute resource balances, experience
and standing writes, refusing the entire result on malformed values, foreign IDs
or duplicate/foreign scopes. Resources use safe nonnegative whole units;
experience remains nonnegative and finite; standing is signed finite and unclamped.
`model/progression-state.ts` owns explicit `applyProgressionAssignment`, which may
lower experience and reuses the delta operation's exact-scope/declared-ID checks.
`model/lifecycle-state.ts` owns absolute standing replacement. One final world
parse precedes publication; unchanged values retain world identity. Active repair
permits submission. No tick or random stream advances. Save18 requires no new
fields: existing inventory, progression and lifecycle state retain the assignments.
