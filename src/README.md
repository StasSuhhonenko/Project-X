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
4. `transportToSurface` asks module geometry policy, pays/clears the first matching
   contract regardless of population, otherwise consumes a populated surface
   mission. `model/lifecycle-state.ts` owns validated standing deltas; C7 owns
   progression. Store publication happens only after complete save validation.

`model/mission-state.ts` owns mission schemas. Contract metadata stays in the sole
`cargo-state.ts` position schema and cannot be traded or enlarged by purchases.
`features/visit-missions.ts` also validates restore by replaying captured entry
context without changing the current stream. Re-entry generates a new visit;
rollback retains the exact previous world. Modules without `rules.missions`
keep null mission state and consume no mission draws.

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
  monotone deltas and read-only selectors; `model/progression-schema.ts` holds
  dependency-free Zod definitions re-exported by that public owner.
- `features/progression.ts`: the sole resolve/validate/apply policy boundary.
- `model/cargo-transactions.ts`: `resolveCargoTransferEnvironment` and the default
  slot capacity. The maximum (`MAX_CARGO_SLOT_CAPACITY`) lives in
  `contracts/cargo-trade.ts` beside the schema that enforces it.
- `features/lifecycle-hit.ts`: `createLifecycleDefinitions`, the entity/ship lookup
  adapter used by every hit path.
- `features/combat-effects.ts`: the projectile and special-effect tail of a tick,
  shared by the equipped and single-primary paths. Hit, death, navigation and
  repair ordering still differ between those paths, so they stay separate.
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
