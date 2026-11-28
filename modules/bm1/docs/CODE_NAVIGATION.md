# BM1 code navigation

Start with the module README for runtime entrypoints. This guide describes the
complete private development workspace; ordinary builds need no recovery inputs.

## Feature ownership

The root `rules.ts` exports the injected rules object and navigation policy.
Focused files own primary fire/hits, repair, travel, energy, vessel purchase,
equipment pricing/market policy, cargo policy and station lifecycle.
`projectile-rules.ts` validates maintained flight profiles and owns source
lead/echo motion. Shared projectile state, collision, impact settlement and Pixi
effects remain in the engine. `stage-weapon-families.cjs` authenticates source
profile/art regeneration explicitly; it is never a runtime dependency.
`entry-presentation.tsx` and `gameplay-presentation.tsx` are stable selected-module
entrypoints. The latter composes feature presentations and overlay navigation.

Maintained UI code and tests are grouped under `ui/contact`, `commerce`, `communication`,
`entry`, `equipment`, `hud`, `map`, `repair`, `shipyard`, `tactical`, `travel`, `terminal` and `viewport`.
The filename roles are consistent:

- `*-content.ts`: Zod validation and access to reviewed prepared inputs.
- `*-controller.ts`: isolated transient navigation state and named actions.
- `*-read-model.ts`: frozen text/display facts from injected world projections.

`ui/contact/contact-presentation.tsx` receives its feature inputs as typed bundles
declared beside the component (commerce, equipment, shipyard and repair), each
holding one feature's views and intents. Add a new contact feature as a bundle
rather than as more flat props, and keep each bundle's optionality explicit.
- `*-layout.ts`: authored geometry and presentation constants.
- `*-artwork.tsx` / `*-presentation.tsx`: passive ink, interactions and attachment.

Cross-feature root helpers remain explicit: `source-control` serves authored Hit
regions, `use-presentation-clock` serves source-cadence panels,
`use-gameplay-artwork` owns shared decode readiness, and `runtime-assets` resolves
source-qualified keys to public URLs. Identity/standing projections remain at
the UI root because the composed frame consumes them directly.
`purchase-read-model` serves contact text, and `player-actor-scale` shares the
reviewed player-art scale contract across entry, travel and terminal adapters.
`player-hull-art` owns the single selected-hull registration (projected from the
flight manifest by `prepare-player-hull-art.cjs`) that travel departure and
terminal death paint under their recorded Symbol2 parent; `player-pose-selector.cjs`
is the preparation-only splitter that makes those pose fixtures hull-neutral.
`hud/hud-frame-clock` owns the HUD's 13 Hz clock and draws its slide between the
last two authored positions at display rate;
`hud/technology-slots` paints UI-12 owned technologies with the equipment icons;
the module-root `power-allocation` owns the four source OPS defaults shared by
energy recharge, shield recharge and the UI-13 covers until C17.
Compatibility tests spanning several screens remain at the UI root.
`viewport/use-fullscreen` owns the frame's native fullscreen listener/requests.

For cargo purchase, follow contact artwork -> injected host purchase intent ->
store action -> shared trade feature/quote/commit -> purchase selector -> contact
read model. The module owns labels and source controls; shared code owns current
eligibility, payment and atomic publication. See `src/README.md` for shared flow.

`cargo-rules.ts` owns commodity generation/allocation/payout policy; shared
`cargo-transactions.ts` owns one assessment/settlement. `ui/commerce/` holds the
lazy original eight-row merchant panel and source selectors. Contact opens
station105 and ship sale; equipment's planet-sale view also hosts resource
selectors101/103. `commodity-data.json`, commerce preparation/provenance and
`C6_CARGO_TRADE.md` own source facts and acceptance.

For ship trade-ins, follow contact's named listing slots -> shipyard preview ->
injected purchase capability -> host preflight -> store action -> shared vessel
feature + module `vessel-purchase.ts` policy. The store holds exact rollback
ownership until the replacement renderer is ready. `ui/prepare-shipyard-assets.cjs`
is an explicit developer projection; staging consumes reviewed files only.
The [C3 contract](features/c3-ship-acquisition/C3_SHIP_ACQUISITION.md) owns evidence, adaptations and limits.

For equipment, follow `ui/equipment/` station/HUD/sale -> injected guarded intent
-> shared equipment feature -> module `equipment-rules.ts` policy. The original
slot controls are routed by the HUD controller. `ui/prepare-equipment-assets.cjs`
authenticates selector/depth/hit evidence; `stage-equipment.cjs` joins original
six-slot offers to lifecycle station placements. The [C5 contract](features/c5-equipment/C5_EQUIPMENT.md)
owns price quirks, passive dispositions and acceptance evidence.

## Inputs, outputs and evidence

C17a: `cheat-rules.ts` owns the fourteen literal predicates and their absolute
assignments, installed by `rules.ts` (API32). `ui/cheat/` owns validated content,
the transient Zustand controller, React input and source submit control.
`ui/transport-input.ts` samples F8 after T and before fleet digits with a100-frame
delay. `gameplay-presentation.tsx` reuses contact's existing communication
replacement flag; hail/report, travel and scene disposal discard the console.
The field owns typing through the engine's UI-input contract. Supported text
uses embedded Arial336 glyphs; browser textarea caret, selection, wrapping and
unsupported glyph rendering are qualified adaptations. There is no Enter submit,
Q close or Close control. See the
[C17a plan/results](features/c17a-cheat-console/C17A_CHEAT_CONSOLE_PLAN.md#results).

Prepare with `node modules/bm1/ui/cheat/prepare-cheat-content.cjs` (`--check`
authenticates without writes), then `npm run module -- bm1 stage` and
`npm run module -- bm1 check-artifacts`. Reviewed `ui/cheat-data.json`,
`ui/cheat-provenance.json` and `ui/cheat-assets/cheat-submit.svg` retain the
field91878/control3432/library127/media117 joins. The role layout publishes
`assets/ui/cheat/submit.svg` and regenerates the runtime index. Originals and
recovery artifacts remain unchanged; normal builds need no recovery sources.

Maintained code consumes prepared `ui/*-data.json`, `hud-actions.json` and root
lifecycle data through schemas. Those prepared records retain their existing
paths. `ui/*-assets/` and `*-provenance.json` are preparation/evidence inputs;
they are not ordinary runtime imports. `public/game/` is the reviewed generated
distribution snapshot. `runtime-asset-paths.json` is a generated publication
index, validated by `ui/runtime-assets.ts`.

Do not hand-edit generated JSON, public artwork or the index. For a content/art
change, consult [asset layout](presentation/ASSET_LAYOUT.md), run the affected preparation
tool, review data/assets/provenance together, stage explicitly and run
`npm run module -- bm1 check-artifacts`. A normal build consumes the snapshot
and does not establish freshness. Original evidence under `analysis/bm1/` and
the preserved Flash source stays unchanged.

`provenance.json` links consumed facts to source evidence. The module conversion
plan defines scope; `IMPLEMENTATION_SEGMENTS.md` owns detailed status; the root
conversion plan owns the current cross-project checkpoint. Historical reviews
retain their recorded paths and results. Use the current feature plan/recovery
document before changing a source-dependent contract.

## Validation

Pure rules/content/save scenarios live in `tests/`; presentation/controller tests
also live beside their feature. Recovery/tool checks live under `tools/`, with
native-browser probes named `browser-*.cjs`. `npm run module -- bm1 test` includes
artifact freshness, module Vitest, tooling and recovery verification. Use focused
Vitest paths while developing, then the integration gates required by the change.
Browser probes must target the actual selected build; imported fixture state
alone does not verify command-to-visible-result behavior.

## Module-selected renderer assembly

`modules/bm1/client.tsx` selects the BM1 React panels and
`spatial-presentation.ts` selects the Pixi adapter. `presentation-contract.ts`
types the module-local enriched panel definition. Shared application lifecycle
and scene leases live in `src/app/scene-preparation.ts`; neutral contracts in
`src/rendering/contracts`, numeric helpers in `src/rendering/shared`, bitmap
implementation in `src/rendering/pixi`. Authoritative combat/effect geometry is
under `src/simulation/geometry`; the separate spatial manifest cannot change it.
See the [acceptance review](../../../archive/docs-2026-11-26/docs/reviews/MODULE_RENDERER_REFACTOR_REVIEW_2026-11-05.md).
