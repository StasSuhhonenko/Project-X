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
| `rendering/` | Pixi scene ownership, camera, interpolation, picking and cosmetic time. Start with `pixi-game-view.ts`. |
| `ui/` | Shared panels, immutable display projections and selected-presentation contracts. |
| `platform/` | Browser/keyboard/audio/storage adapters with explicit disposal. |
| `persistence/` | Save capture and strict content-consistent restore validation. |
| `random/` | Neutral deterministic arithmetic; callers own stream state. |

Simulation may consume content and neutral random primitives, but never app,
platform, rendering, UI, React, Pixi or Zustand. Modules may consume shared
contracts/helpers, but never another module or the application store. Only
`main.tsx` imports the selected-module aliases. `tools/verify-runtime-boundaries.cjs`
checks these boundaries in a complete development workspace.

## Follow execution

`main.tsx` loads the build-selected rules, validates `/game/module.json`, imports
the selected presentation, creates an isolated store and mounts `App`.
`GameScene` connects read-only projections and guarded intents to the selected
presentation. `GameViewport` owns asynchronous spatial-view attachment; the Pixi
view owns its sprites, listeners, histories and disposal.

A purchase follows this path:

1. Module contact artwork invokes the injected `onPurchaseCargo(quantityTons)`.
2. `app/purchase-intent.ts` rejects callbacks from a stale merchant/session.
3. The store action delegates to `simulation/features/trade.ts`.
4. `model/purchase-quote.ts` owns eligibility/payment/capacity rules;
   `world-state.ts` rechecks and commits payment, cargo and stock atomically.
5. `ui/purchase-selector.ts` projects the published world back to presentation.

Keyboard adapters construct commands. The browser simulation lifecycle schedules
fixed updates; the store delegates a tick to `advance-world.ts` and publishes
once. Module policy calculates permitted effects; the model validates ownership
and invariants. Rendering samples completed snapshots independently of tick rate.

Equipment follows the injected view/intent -> store `equipmentCommand` ->
`features/equipment.ts` path. `model/equipment-state.ts` owns inventory/channel
invariants; `persistence/equipment-validation.ts` checks content-aware restore.
`features/equipped-combat.ts` orders three channels through the existing effects
inside one unpublished tick. Module rules own price/market policy and module UI
owns the controls. See `docs/GAME_MODULES.md` for the optional content contract.

## Change the right owner

Change a game's movement/damage/balance policy in its module. Change neutral
transition ordering in simulation features. `world-schema.ts` owns state shapes
and shared invariants; `world-selectors.ts` owns read-only projections;
`world-state.ts` owns validated operations and the established import facade.
`world-construction.ts` converts validated starts into runtime entities.

Change screen ink/navigation in the selected module, shared display contracts in
`ui/`, and camera/interpolation in `rendering/`. Browser storage belongs in
`platform/browser/`; persisted shape and restore consistency belong in
`persistence/`. Keep raw Zustand mutation private to `app-store.ts`.

Shared tests live in root `tests/` by responsibility, including `tests/app/`,
`tests/rendering/`, `tests/simulation/` and `tests/persistence/`. Module tests live
in their module's `tests/` and beside UI features. Normal builds require only
runtime source, reviewed public snapshots and root package/configuration files;
tests, tools, evidence and internal docs are optional development inputs.
