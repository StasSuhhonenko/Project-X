# Broken Mirror 1 conversion plan

This is the active compatibility-module plan beneath the
[Project-X master plan](../../docs/CONVERSION_PLAN.md). It owns BM1 scope, recovery
evidence and fidelity requirements; the master plan owns the cross-project
checkpoint and decides which module segment is active next. The
[implementation backlog](docs/IMPLEMENTATION_SEGMENTS.md) owns per-feature status.
The [planning history](../../archive/docs-2026-11-26/modules/bm1/CONVERSION_PLAN_HISTORY_2026-10-30.md) preserves superseded
checkpoint narratives and delivery recaps.

Architecture pivot (2026-09-11): the current navigation slice now runs on a shared
engine with separate `modules/bm1` and `modules/demo` rules/content/assets. The
default build selects the independent demo; BM1 uses `npm run module -- bm1 dev` and
`npm run module -- bm1 build`. Existing BM1 behavior tests are retained. All remaining BM1
segments must follow [the game-module boundary](../../docs/GAME_MODULES.md); maps, quests,
balance and recovered presentation will extend the BM1 module as implemented.
This establishes technical separation, not original-game parity or rights clearance.

## Active next task

The 2026-11-07 [planet resource purchase follow-up](docs/features/c6-cargo-trade/C6_CARGO_TRADE.md#planet-resource-purchases-2026-11-07)
restores the original antimatter refill and deuranium package hit-region actions,
rollovers and feedback. Artwork restoration has separate ownership. C7 remains next.

The [loading transition fix](docs/maintenance/LOADING_TRANSITIONS_FIX_PLAN.md#results-2026-11-07)
was delivered on 2026-11-07 without changing gameplay scope or the deferred C2
timing status.

[C7 reputation and progression](docs/features/c7-progression/C7_PROGRESSION_PLAN.md) was delivered on
2026-11-07: seven experience skills and six career tallies, saved and changed
through one validated operation, with the nebula, hail-access and UI-12 status
consumers. [C8 ordinary missions](docs/features/c8-missions/C8_MISSIONS_PLAN.md) followed the same day: planet and station cargo-run contracts with negotiation, delivery through Transport/`T`, and the 31 away-team missions. **C10 NPC diplomacy and combat** was delivered 2026-11-09 ([plan](docs/features/c10-npc-combat/C10_NPC_COMBAT_PLAN.md)): C10a encounters and governments 2026-11-07, C10b hostility and incoming fire 2026-11-08, C10c NPC-vs-NPC and death outcomes and C10d projectiles, stations, departure and cloak 2026-11-09. Next: C11 fleet roster, then C9 boarding (user-chosen order). Follow the [master scope](../../docs/CONVERSION_PLAN.md#active-next-task).

## Delivered foundation and current limits

C3's representative [ship acquisition](docs/features/c3-ship-acquisition/C3_SHIP_ACQUISITION.md) and
C4's [weapon behavior](../../archive/docs-2026-11-26/modules/bm1/docs/features/c4-weapons/C4_REVIEW_2026-11-05.md) are delivered. All consumed
families use validated shared state/settlement, original presentation and saved
continuation, with source/ordinary-access qualifications in their owning reviews.
C5 [equipment and three firing channels](docs/features/c5-equipment/C5_EQUIPMENT.md) is also delivered:
ordinary station purchase, source HUD loading and planet sale reuse those
consumers, with strict ownership, ordered energy and saved continuation. Its
passive-technology and Empire pricing dispositions remain explicit.
[C6 ordinary commerce](docs/features/c6-cargo-trade/C6_CARGO_TRADE.md) is delivered: ordered cargo,
generated terms, atomic buy/sell/resource exchange, original controls and strict
save continuation, with independent and native-browser proof. Remaining
cargo-dump/pod commands retain C17 ownership.
Fleet purchases and unsupported special-system offers retain
their separate backlog owners. C2's visible timing follow-up remains deferred.

Current [asset layout](docs/presentation/ASSET_LAYOUT.md) groups published artwork by role and
uses entity names. Source keys/evidence remain unchanged; explicit staging owns
the public path index. Normal builds remain independent of recovery.

Recent presentation work: [sun/legend/starfield](../../archive/docs-2026-11-26/modules/bm1/docs/presentation/SKY_LEGEND_REVIEW_2026-11-03.md),
[warp departure correction](docs/maintenance/WARP_DEPARTURE_FIX_2026-11-06.md) and
[panel preparation](docs/maintenance/LOADING_PREPARATION_2026-11-06.md). Their owning records
retain evidence and limits; none changes C2’s deferred timing status.

The [runtime packaging cleanup](../../archive/docs-2026-11-26/docs/reviews/RUNTIME_PACKAGING_2026-11-03.md) makes
normal dev/build/preview independent of recovery and tests. For C3 and later
content/art changes, run affected preparation, stage explicitly, review changes
and pass `npm run module -- bm1 check-artifacts` before feature acceptance.

Port Broken Mirror 1 to TypeScript with PixiJS v8 for rendering. Start with a faithful desktop-browser version using the original artwork, controls, game rules, and content. Establish behavior against the original before making balance or UI changes. Broken Mirror 2 and the other bundled games are outside this first port.

The source is recoverable: original ActionScript text is present inside the FLA. This is a source migration with substantial Flash-runtime replacement work. A full decompilation is not the first prerequisite.

## What was actually inspected

Historical inspection date: 2026-09-10.

All paths below are relative to `flashtrek_sourcecode original/Broken Mirror/`.

| Evidence | Finding | Consequence |
| --- | --- | --- |
| `BROKENMIRROR.fla` | 16,000,512 bytes; legacy Compound File Binary (CFB) container; 635 allocated streams | Requires legacy FLA parsing or a compatible authoring tool; it is not a modern zipped XML FLA |
| FLA `Page 1` | 47 named function declarations, including `loadplayer`, `loadsystem`, weapon firing, fleets, boarding, travel, saves, and victory checks | Most core rules are available as readable original source |
| FLA `Symbol 2` | Keyboard movement, frame-based acceleration/turning, firing and damage code | Movement needs explicit timing and ordering preservation |
| FLA `Symbol 3` | Buying, selling, system information, travel selection, station construction | Menus contain gameplay rules as well as presentation |
| FLA `Symbol 6` | Equipment loading, statistics, ship selection | Inventory/equipment must be separated from UI widgets |
| FLA `Page 2` | Save-slot handling and nine `loadVariablesNum` calls for plugin files | Both persistence and external-data loading need replacements |
| FLA `Page 3` | Game-data initialization, delimited arrays, sound linkage references | Recover built-in base data and embedded media before assuming loose files are complete |
| `bm_bitmaps/` and `scraps/` | 293 GIFs and 23 PNGs across the BM1 directory | Much artwork is already accessible; these counts include scraps/variants, not 316 confirmed runtime assets |
| `plugin-templates/` and `plug-ins/` | 119 readable `.fbm` files, nine template types, 13 plugin directories | Preserve IDs and investigate data overrides; templates are not yet verified as identical to built-in defaults |
| `scraps/shipcodes.txt` | IDs 1–66 with ship names | Useful cross-reference; source remains authoritative |
| `bmguidetthomaso.txt` | Approximately 60 KB of ship, weapon, gameplay and secret information | Useful independent behavior reference; the guide itself notes incompleteness |
| `scraps/` | Seven `.doc` documents and one `.mdb` database | Potential supplementary design material; their contents were not decoded in this inspection |
| Three bundled SWFs | `logo.swf`, `mirrorpreviewmovie.swf`, `MIRROR.swf`, all under scraps | No SWF named `BROKENMIRROR.swf` was found; a matching playable baseline is still unverified |

`scraps/MIRROR.swf` has a Flash version 6 header, a 550 × 400 stage, 15 fps, and 18 top-level frames. These are properties of that SWF, **not confirmed settings for `BROKENMIRROR.fla`**. Frame count alone does not establish whether it is a full game or a prototype.

The source uses legacy AVM1-style constructs (`onClipEvent`, `add`, `or`, dynamic `set`/`eval`, `_root`). Exact authoring version and publish settings remain to be determined. No original gameplay was executed during this inspection.

Inspection is reproducible with `node modules/bm1/tools/inspect-bm1.cjs --save`. Its output is stored in `analysis/bm1/inventory.json`, including the source SHA-256, allocated stream inventory, source-token observations, and SWF headers. It reads CFB sector chains rather than treating arbitrary raw-file strings as authoritative: raw scanning also encountered repeated code outside the resolved streams. Token counts are indicators, not a complete syntax or reachability analysis. The inspector is scoped to this bundle, not a general FLA converter.

## Main conversion risks

1. **Timeline behavior and initialization order.** `atwarp()` calls `gotoAndPlay(2)`. Other code resides on frames, clip events and buttons. Recover scene/frame labels, placements, instance names, linkage IDs, and execution order before replacing these with explicit state transitions. Do not discard a script because its timeline context is not yet understood.
2. **Simulation timing.** Movement changes speed and rotation on every `enterFrame`; weapon logic uses counters. Begin with a fixed simulation step based on the verified original frame rate, with rendering independent of simulation. Do not assume 60 game updates per second or multiply every expression by delta time mechanically.
3. **ActionScript semantics.** Sparse arrays, one-based IDs, `undefined`, coercion, dynamic paths and shared globals matter. For example, `checkforwin()` increments initially unset array entries. Treat this as a behavior question to investigate, not a bug to silently fix. Maintain a discrepancy log for intentional fixes.
4. **Content identity.** Source loops reference up to 55 planet entries, while template map names appear to cover a smaller set. Item lookups use 13-field offsets and weapon lookups use seven-field offsets. Verify record boundaries, sentinels, special systems and embedded defaults before creating schemas.
5. **Media completeness.** Sound linkage calls are present, but there are no loose WAV/MP3 files in the BM1 directory. Locate and export library media, fonts, animations, pivots and registration points. Loose GIF/PNG files alone are insufficient evidence of complete visual coverage.
6. **Reference version.** The scraps SWF may differ from the main source. Obtain a matching published build or establish a compatible way to publish a working copy of the FLA. Without this, code-derived behavior can be tested, but full gameplay parity cannot be claimed.

## Proposed architecture

The finished source must be component-based, robust, readable, maintainable, thoroughly documented and commented, and suitable for future expansion. These requirements apply from the first playable slice. Exploratory recovery scripts may remain loosely organized; production code must follow [the architecture and engineering standards](../../docs/ARCHITECTURE.md).

| Layer | Responsibility |
| --- | --- |
| `content/` | Validated definitions for ships, items, weapons, stations, systems, governments, missions and text; stable original IDs and source provenance |
| `simulation/` | Explicit game state, fixed-step updates, movement, damage, AI, economy, fleets, travel, reputation and conquest; no PixiJS dependencies |
| `rendering/` | PixiJS containers, sprites, camera, effects, layering and selection display; entities linked by stable IDs |
| `ui/` | HUD and game panels; issue commands and display state; HTML/CSS for text-heavy forms where useful, PixiJS for spatial overlays |
| `platform/` | Keyboard/pointer input, browser audio, persistence, asset loading and lifecycle handling |
| `migration/` | Reproducible source/content extraction, legacy ID mappings and optional `.fbm` import |

Use TypeScript and Vite for the browser project, Zod schemas with inferred data types, and Zustand for state management. Prefer React for client menus and panels, with PixiJS for the game view. Apply DRY, encapsulated state, early returns, guard clauses, separate `if` statements, and array-method preferences as detailed in `docs/ARCHITECTURE.md`. Pin concrete package versions when implementation starts. Avoid a backend for the initial single-player port unless dependency inspection reveals an actual requirement.

Replace `attachMovie`/`duplicateMovieClip` with entity creation plus render factories, `_root` with explicit state/services, and dynamic clip paths with entity/component references. Reconstruct each `hitTest` use with the appropriate geometry and coordinate space. Replace `SharedObject` with a versioned JSON save schema stored through IndexedDB, with user-controlled file export/import. Legacy `.sol` save import is a later feature, contingent on representative saves.

PixiJS provides the rendering loop and ticker, but game simulation remains our responsibility: [official ticker documentation](https://pixijs.com/8.x/guides/components/ticker), [render-loop documentation](https://pixijs.com/8.x/guides/concepts/render-loop).

## Work sequence and completion criteria

**Rendering timing decision:** keep gameplay at 13 fixed updates per second and use previous/current-state interpolation for smooth rendering at 60 fps or higher where supported. See [the interpolation contract](docs/foundation/0001-fixed-step-navigation.md#planned-render-interpolation) for timing, ownership, reset rules and the approximately one-step presentation delay.

The phases below define scope and completion gates. Use [the implementation segments](docs/IMPLEMENTATION_SEGMENTS.md) for the smaller work units, stable IDs, dependencies, status and acceptance checks. That backlog is the authoritative task tracker; do not duplicate segment status in this overview.

### 0. Recover and establish the baseline

Detailed segments: **R1-R6** (handler evidence, timeline context, reference identity/playback, content anomalies and remaining media).

- Keep originals intact; put all extraction output in separate directories and record hashes.
- Extract source blocks with scene/symbol/frame/event provenance. Recover linkage names, document settings, timeline relationships and media metadata.
- Decode built-in data; compare against templates and plugin overrides. Inventory all external loads and distinguish optional plugin URLs from core startup requirements.
- Inspect the bundled `MIRROR.swf` and compare its content with the main FLA. Establish a matching playable baseline if possible.
- Evaluate Ruffle for reference playback. Emulator differences must be distinguished from original game behavior; its general compatibility does not prove BM1 works correctly: [Ruffle compatibility](https://ruffle.rs/compatibility).
- Use JPEXS for SWF script/media inspection where applicable. Its documented SWF-to-FLA export is not a solution for directly parsing this original binary FLA: [JPEXS project](https://github.com/jindrapetrik/jpexs-decompiler).

**Done when:** there is a traceable source/content catalog, original timing and dimensions are known, and baseline availability or its exact limitation is documented. Reassess effort at this gate; a trustworthy full-port estimate is premature now.

### 1. Build the data and asset pipeline

Detailed segments: **D1-D8** (entity categories, validation, two systems, asset mapping/review, sound, fonts and packaging).

- Convert verified base content to typed, validated records; preserve IDs, unusual values, separators and encoding semantics.
- Map embedded library symbols to loose originals or exported assets; retain registration points, frame sequences and transparency.
- Extract audio and establish font handling. Generate atlases after visual mappings are confirmed.
- Validate references and report omissions without automatically rewriting original data.

**Done when:** the selected base game content can load without unresolved references, and a browser asset viewer displays representative ships, planets, stations, effects and UI elements correctly.

### 2. Complete one playable slice

Detailed segments: **S1-S22**. Each interaction has its own completion check: scene lifecycle, world components, planet, station, stars/zoom, second start, local warp/energy, selection, NPC, firing, hits, death, repair, transaction, map, travel simulation, travel presentation, save schema, storage, save UI, render interpolation and end-to-end walkthrough. S22 retains a new ID to preserve existing references; it is scheduled after S3 rather than after the walkthrough.

- Start a new game with one verified starting setup in one system.
- Render a ship, planet, station, NPC, HUD and camera using original assets.
- Implement steering, targeting, one beam/projectile weapon, damage, destruction and repair.
- Implement one transaction, travel to a second system, and save/reload of this slice.

**Done when:** the player can start, fly, fight, transact, travel, save and resume. Compare movement and combat timing with the baseline where available. This is the first demonstration of port viability.

### 2a. Recreate the original interface

Detailed segments: **U1-U7** in the [UI recreation plan](docs/ui/UI_RECREATION_PLAN.md).
U3/U4 implement the recovered interface, fonts and layouts, original shell and
supported slice screens.
Use the original logical dimensions and record source/reference evidence for
each screen, control state and transition. Deliver U5/U6 alongside the remaining
mechanics so each original panel has functioning commands when its feature lands.

**Done when:** U7 closes the complete original screen/state inventory, including
navigation, layout, assets, text, input and feedback. Missing mechanics or visual
placeholders cannot count as completed UI. Unknown fidelity remains unresolved;
record the limits of unavailable matching playback explicitly.

### 3. Complete the original core game

Detailed segments: **C1-C19**. Add content and mechanics by family after the slice works; each new stateful feature must also extend save/restore support. A new mechanic within a family receives its own smaller segment before implementation.

- All starting choices, systems, ships, weapons, equipment and resource handling.
- Trading, missions/away teams, boarding, reputation and progression.
- NPC behavior, fleet purchases/orders, station construction and ownership.
- Government changes, conquest, victory rewards, death/restart, and special locations.
- Complete menus, sound, tutorials and save slots.

**Done when:** documented normal play and a representative path to victory work through the recreated original UI, with traceable coverage for the recovered systems and no known save corruption. S21's augmented fixture does not replace this normal-play requirement.

### 4. Verify fidelity and prepare the release

Detailed segments: **V1-V8**, with optional/deferred work under **X1-X2**. Start the minimal replay harness with the first seeded NPC in S9, extend it as slice commands and saves land, and maintain the fidelity ledger alongside implementation. Perform full browser, save, performance and release checks as their dependencies become available.

- Replay agreed scenarios with recorded inputs; make randomness controllable for repeatable comparisons.
- Test movement/cooldowns independently of rendering rate, damage boundaries, buying/selling, travel costs, fleet persistence and save round trips.
- Compare visuals at the original logical resolution and verify desktop browser input, audio startup and pause/resume behavior.
- Run representative crowded-system performance checks and document intentional differences.
- Validate optional plugin import against the base schema if it is included in the first release.

**Done when:** U7 original UI coverage, V7 original play/victory and V8 release review pass. The fidelity report identifies source-derived results, matching-playback results, unresolved limitations and necessary browser adaptations; documented missing original features do not count as complete.

### 5. Enhanced edition (deferred)

**E1** begins only after U7 and V7-V8. Preserve a reproducible original port and
define optional redesigns, additional shortcuts, balance changes, new content
and presentation improvements as a separate scope with explicit save compatibility.
Review existing intentional deviations in V2 against that original baseline.

Every runtime milestone also requires clear component ownership, enforced dependency boundaries, maintained public-contract documentation, explanatory comments, and meaningful behavior tests as specified in `docs/ARCHITECTURE.md`.

## Initial scope assumptions

- Desktop keyboard/mouse browser play first; complete original art, layout and interaction flow as specified by U1-U7.
- Preserve gameplay initially. Resolve actual defects individually with documented behavior evidence.
- One verified BM1 base version before the 13 bundled plugin variants.
- Defer mobile controls, multiplayer, new artwork, expanded content and legacy-save import.
- Keep extraction tools and evidence in this repository; leave the original bundle and the starter file unchanged.

## Planning authority and delivery

The [master plan](../../docs/CONVERSION_PLAN.md) is the sole current checkpoint
and next-task authority, including validation policy and deferred work. The
[implementation backlog](docs/IMPLEMENTATION_SEGMENTS.md) owns per-feature status,
dependencies and acceptance. This plan owns stable BM1 scope and phase gates;
update it when those contracts change, rather than for each completed child.
The [UI plan](docs/ui/UI_RECREATION_PLAN.md) owns U-series criteria; the
[historical UI handoff](../../archive/docs-2026-11-26/modules/bm1/docs/ui/UI_IMPLEMENTATION_HANDOFF.md) retains bounded
implementation contracts. The [planning history](../../archive/docs-2026-11-26/modules/bm1/CONVERSION_PLAN_HISTORY_2026-10-30.md)
preserves removed checkpoint narratives and historical links without resolving
them into new acceptance claims.

Deliver each feature through one checklist covering its mechanic, consumed
original UI, save/restore or explicit compatibility rejection, failure paths,
source/fidelity limits and focused validation. U5/C17 and save owners review
the same delivered feature; they are not separate implementation passes. Prove
each new shared capability with one contrasting independently authored demo
scenario. Batch equivalent content using an established contract instead of
creating another design/review cycle per record. Distinct source behavior or a
new invariant still requires its own evidence and acceptance.

Validation follows the master's focused-increment/milestone policy. Historical
exhaustive browser, retention, benchmark and distribution gates record their
own contracts; they are not a template to repeat for every child or doc edit.
Preserve failed observations and explicit deferrals without weakening budgets.

Browser save/file tools do not establish original manual saving, autosave or
six-slot behavior. Fixture walkthroughs do not establish ordinary-play or native
parity. Native Reincarnate dispatch and other source/reference qualifications
retain their owning evidence and acceptance gates. Matching-build availability
and a reproducible playback procedure or blocker must be recorded before any
playback-based parity claim. Continue targeted recovery where evidence is
incomplete; preserve originals, extracted evidence and provenance.
