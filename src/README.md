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
`App` with entry and deferred-gameplay capabilities. Starting or restoring a game
loads the module's `gameplay-client` and validates its spatial configuration
before mounting any scene/input/scheduler. The page-owned loader caches success,
retries preparation failure and disposes late results after page exit. `App`
keeps save/menu recovery available while loading. Concrete adapters are imported
only by trusted module assembly, never by the shared host.
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

Single owners for shared helpers:

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
