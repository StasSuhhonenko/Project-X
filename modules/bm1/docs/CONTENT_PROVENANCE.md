# Runtime content and module format

## Boundary and ownership

C9 boarding (2026-11-11) consumes existing hull/weapon definitions and C8 numeric
geometry without a second balance table. [Recovery](features/c9-boarding/C9_BOARDING_RECOVERY.md)
records every source site, verbatim text and draw owner. The original `beam`
linkage (Media250 MP3) is copied additively by `ui/prepare-boarding-audio.cjs`,
authenticated in `ui/boarding-audio-provenance.json`, and published unchanged as
`assets/audio/transport-beam.mp3`; the asset path schemas now accept MP3. The
staging version owner advances BM1 to0.39.0 in both module and spatial manifests.
No original source/media is rewritten. Exact condition saves through C11 while
revisit rebuilds captured ships at full strength. Browser acceptance is pending.

C10c (2026-11-09) widens persistent strength data to the48 supported ordinary
systems, initialized from each authored system's existing `initialStrength`.
The preserved32-system C2 eligibility and its eleven government profiles remain
unchanged. Complete replacement rosters use C10a's authenticated `shipdefaults`;
fan-out uses the existing staged government census. No source evidence or schema
shape changed. The [BM1 handoff](features/c10-npc-combat/C10C_BM1_HANDOFF_2026-11-09.md)
owns the source citations, adaptations and verification.

C8 ordinary missions (2026-11-07) adds the staged `mission-data.json` table,
numeric overlap geometry and source-index destination joins. `stage-missions.cjs`
projects preserved C8 recovery without modifying originals. The type17 panel
and selector104 are prepared by `ui/prepare-mission-assets.cjs`, authenticated
by `ui/mission-provenance.json`, and published through the existing role layout.
Rules22/save12/BM1 0.31.0 are unchanged from the shared-engine handoff. The
[C8 results](features/c8-missions/C8_MISSIONS_PLAN.md#results) record draw ownership, unavailable
destinations, engine input corrections, UI behavior and verification limits.

The 2026-11-07 [planet resource purchase follow-up](features/c6-cargo-trade/C6_CARGO_TRADE.md#planet-resource-purchases-2026-11-07)
records the consumed Page1:25841 purchase functions and Symbol3:43275/43637
release/rollover bodies, original package/message discrepancy and unchanged
content/save shapes. Purchase implementation does not rewrite extracted evidence
or generated provenance/artwork; restoration of the missing artwork is separately owned.

Current [C6 ordinary commerce](features/c6-cargo-trade/C6_CARGO_TRADE.md): module21/Rules20/save10,
BM1 pack0.29.0/demo0.22.0. `commodity-data.json` preserves all43 original goods
in order, with ten cargo positions. `C6_COMMERCE_RECOVERY.json` authenticates
consumed catalogue, market-generation, transfer, resource-sale and display
scripts. Station offer105 positions come from the same source-record join as
equipment offers. Four passive SVGs (merchant plane and selectors101/103/105),
`ui/commerce-data.json` and `commerce-provenance.json` are prepared explicitly
and staged with their hashes. They publish under UI commerce/resources roles;
the current BM1 public snapshot contains565 files. Earlier snapshots/saves and
original source/evidence are preserved, with explicit prior-envelope rejection.
The checkpoints below retain their historical contract/count scope.

Current [C4 completion](features/c4-weapons/C4_REVIEW_2026-11-05.md): module18/Rules17/save7,
BM1 pack0.26.0/demo0.19.0. Six source-authenticated special SVGs are published
under effects/weapons (532 BM1 public files:531 assets plus manifest). Captured
policy/geometry, original bitmap fills/strokes and source projections remain
separate from preserved evidence. The exact earlier pack/save envelopes reject.
The prior checkpoints below retain their historical contract/count scope.

The active [C4 projectile and beam batches](features/c4-weapons/C4_WEAPON_FAMILIES.md) add eighteen original
PNG exports: fourteen weapon-specific flight paths and four shared impact frames.
`weapon-flight-data.json` owns fourteen validated source profiles. The recovery
sidecar authenticates both37-frame layers and retains previously unindexed damage
without changing the934-candidate index. Runtime imports maintained profiles only;
explicit staging authenticates their regeneration and all media hashes. The
beam recovery also pins Symbol112 and all five damaging families, including
the multiple bitmap instances in Polaron/Cutting keyposes. Four additional PNGs
publish as particle-beam, polaron-phaser, plasma-phaser and cutting-beam under
`assets/effects/weapons`. Type X's accepted loose image remains unchanged.
Beam-checkpoint contracts are module17/Rules16/save6, BM1 pack0.24.0 and demo0.18.0.
The public set is526 files (525 image/audio files and the manifest); prior exact
module/pack envelopes reject. `analysis/bm1/C4_BEAM_FAMILIES.json` and the
`beamFamilies` provenance entry preserve source matrices, media hashes and timers.

The [special recovery/cadence correction](features/c4-weapons/C4_SPECIAL_EFFECTS.md) advances BM1 to
pack0.25.0 with no new public art. Fourteen ordinary profiles now move every
tick, with source cutoff expiry, following exact candidate factory/action probes.
`analysis/bm1/C4_SPECIAL_EFFECTS.json` keeps the separately authenticated special
drawing graph and consumers; those graphics are not yet promoted to public/.
Module17/Rules16/save6/demo0.18.0 remain; earlier BM1 pack saves reject explicitly.

The [C3 delivery](features/c3-ship-acquisition/C3_SHIP_ACQUISITION.md) adds67 source-derived shipyard SVGs
(the type21 plane and66 ship selector frames) under `assets/ui/shipyard`.
`ui/shipyard-data.json` and `shipyard-provenance.json` retain original matrices,
named listing slots, text/control offsets and source/media hashes. In particular,
item3/item4 are joined by source name rather than body order. Existing public
artwork bytes are retained. The public set is now504 files,503 image/audio files
plus the manifest at that checkpoint. C3 contracts: module15/Rules15/save5, BM1 pack0.22.0,
demo0.16.0; prior exact-version saves reject without migration.

The [asset layout](presentation/ASSET_LAYOUT.md) supersedes earlier public filename references.
`stage-asset-layout.cjs` publishes descriptive names by role and records every
source/public path plus SHA-256 in maintained provenance. The validated runtime
path index preserves source-qualified UI keys; shared rendering still reads only
module paths. All436 published image/audio files retain their original bytes.
The superseded141px Human Starbase is now development evidence under
`analysis/bm1/asset-layout-2026-11-03/human-starbase-provisional.png`, while the
actual196x191 station is `assets/stations/human-starbase.png`. The current public
set at that migration was437 files, with no gameplay/save/version changes. Shared planet artwork
uses one canonical representative name and lists every system alias in provenance.

The [packaging cleanup](../../../docs/reviews/RUNTIME_PACKAGING_2026-11-03.md) treats
reviewed `public/game` bytes as normal-build inputs. Recovery/staging is explicit;
the non-mutating `check-artifacts` command compares isolated regeneration with
maintained files/provenance and runs before module tests. Missing, extra and
mismatched artifacts must be resolved/reviewed after source or preparation
changes, including C3. It does not replace feature-specific UI preparation checks.
Fresh staging now materializes earlier slice images before authenticating their
replacement mappings. Obsolete `c2c-entity-74.png`, unreferenced by the current
manifest and not regenerated, is preserved under
`analysis/bm1/runtime-packaging-2026-11-03/superseded-public/` rather than shipped.
That packaging checkpoint's public set was438 files, before the asset-layout
increment above. Module/rules/save/pack versions and consumed art bytes remain unchanged.

The [sky/legend correction](presentation/SKY_LEGEND_REVIEW_2026-11-03.md) authenticates the
scene-load sun randomization that overrides its authored matrix, compiled
white/gray navigation-star outlines and exact static map legend glyph matrices.
`ui/sky-data.json`, `sky-provenance.json` and updated `map-provenance.json` own
these maintained projections. Source/recovery originals remain preserved;
simulation/save contracts and source layer speeds/depth remain unchanged.

The [star-motion follow-up](presentation/STAR_MOTION_REVIEW_2026-11-03.md) extends maintained
viewport evidence to27 assets: the actual JPEG3/alpha system sun and a panel
derivative without baked arrival streaks. All21 motion handlers join their
compiled placements; source hashes, the legacy locx check and original source
assets remain explicit/preserved. These are presentation-only additions with
the same module/rules/save/pack compatibility.

The [2026-11-03 viewport delivery](presentation/VIEWPORT_FIDELITY_REVIEW_2026-11-03.md) restores
the confirmed SWF's four actual backgrounds, top HUD/minimap ink and all18
compiled warp transform/opacity samples. `ui/viewport-provenance.json` owns
source bindings and25 staged passive SVG assets. FLA backgrounds differ in tone
and remain preserved; the selected reference's JPEG bytes join their shared
tables without recoloring/recompression. Existing type70/Media354 circular
Spacedock art is authenticated and retained. No module, rules, save or pack
version changes; authoritative world/content is unchanged.

The preceding [unowned delivery](features/c2-systems/C2_UNOWNED_REVIEW_2026-11-02.md) used BM1 content0.21.0/
module15, Rules14/save5 and demo0.15.0. It represents48 ordinary systems with159
mutable station records;32 strength/51 standing scopes are unchanged. Source0
ownership converts to null without a government-zero faction. Module-owned
`unowned-world-data.json` preserves the actual None receiver and Konae/Konael
table distinction. `provenance.json.unownedComposition` owns the five-world
source joins and final four C16 exclusions. Earlier bytes/evidence are preserved.

The [parent C2 review](features/c2-systems/C2_INTEGRATION_REVIEW_2026-11-02.md) delivers functional
integration and closes both inherited encounter/merchant-save findings in every
system. Shared validation now enforces authored encounter count/home/definition
and immutable offer identity with bounded remaining stock. No source content,
format or pack version changes; legitimate current-pack saves remain valid.
Final timing acceptance remains failed/user-deferred.

Historical [ordinary delivery](features/c2-systems/C2_ORDINARY_REVIEW_2026-11-02.md) uses BM1 content0.20.0/
module14, Rules14/save5 and independent demo0.14.0. It owns43 systems,159 mutable
station records,32 strength scopes and51 finite source standing scopes. The
complete ordinary projection has one current owner in `ordinary-lifecycle-data.json`;
earlier partial metadata remains preserved. `provenance.json.ordinaryComposition`
and `.ordinaryLifecycle` record source joins, exclusion reasons and current scope.
Module14 adds explicit per-axis source artwork scale without altering bitmap
bytes. Prior envelopes reject without migration. Five government-zero ordinary
worlds and four special systems remain explicitly outside this batch.

Historical C2g runtime uses BM1 content0.18.0/module13, Rules14/save5 and independent
demo0.13.0. The [module implementation](features/c2-systems/C2G_MODULE_IMPLEMENTATION.md) owns the
bounded PS-102 active/durable continuation and focused acceptance. The selected
21 records now allow eight mutable IDs: Earth3/12/14 and Vulcan55-59. Staging
adds `provenance.json.c2gLifecycle`; earlier evidence and assets remain preserved.
The [ownership decision](features/c2-systems/C2G_OWNERSHIP_DECISION_2026-11-01.md) and
[source execution](features/c2-systems/C2G_ALIAS_SOURCE_RECOVERY_2026-11-01.md) own the witness contract
and full-census strength invariant. Earlier envelopes reject without migration.

Historical C2f runtime was **In progress** under the accepted
[Earth contract](features/c2-systems/C2E_SCOPE_AND_CONTINUATION_DESIGN_2026-10-29.md). Its staged
contracts are BM1 content0.17.0/module12, Rules13/save4 and independent demo0.12.0.
The [lifecycle implementation](features/c2-systems/C2F_LIFECYCLE_IMPLEMENTATION.md) and
[presentation implementation](features/c2-systems/C2F_PRESENTATION_IMPLEMENTATION.md) record provisional
implementation scope. The selected lifecycle definition now contains21 records
(sixteen Earth and five Vulcan), with six mutable IDs, nine consumed standing
scopes and durable strength12 only. Earlier envelopes reject without migration.
The [integration review](features/c2-systems/C2F_REVIEW_2026-10-29.md) records passing functional/
failure, source/visual, isolated distribution, both100-pair retention and fresh
19-actor CPU gates. Visible-frame p95 fails the unchanged budget; the user deferred
its repeat. These versions therefore do not imply completed C2f acceptance.
The [provisional scope audit](features/c2-systems/C2F_SCOPE_AUDIT_2026-10-29.md) records inspected
invariants and inherited save-boundary gaps for later work.

Historically, C2e's [completed source/design review](features/c2-systems/C2E_REVIEW_2026-10-29.md)
added authenticated Earth16 composition/art and actual compiled Earth
lifecycle/all-start standing evidence. That recovery-only deliverable preserved
original media and prior raw artifacts and changed no maintained runtime content,
generated pack/provenance JSON, public assets, schema or save version at its
checkpoint. C2f is the separate runtime activation of its accepted contract.

Historical C2d pack: BM1 content0.16.0/module11, Rules12/save4; demo0.11.0.
C2d runtime has [completed bounded acceptance](features/c2-systems/C2D_REVIEW_2026-10-27.md)2026-10-28. The
[implementation](features/c2-systems/C2D_IMPLEMENTATION.md) and [fidelity ledger](features/c2-systems/C2D_FIDELITY_LEDGER.md)
own consumed signed system12 strength, all five unique mutable Vulcan records,
exact source1/1/1/1/11 generation and the independent demo strength/report consumer.
`provenance.json.c2dLifecycle` adds the reviewed scope/limit/recovery links while
`c2cLifecycle` retains its historical narrower checkpoint. That selected lifecycle
definition had five records; BM1 policy separately owns the authenticated166-row
immutable source census. Neither collection is a mutable full-world cache.

The [original communication implementation](features/c2-systems/C2D_PRESENTATION_IMPLEMENTATION.md)
uses separately staged type13 report artwork and exact recovered comp3 WAV.
`ui/communication-provenance.json` records source joins, asset hashes and the
narrow reader/derivative qualifications. Active saves retain authoritative
strength and sequence-numbered communication separately from the explosion
notice; prior pack0.15.0/module10/Rules11/save3 contracts reject without migration.
Source departure evacuation/population/government effects remain C14/C7/C16-owned,
including nonpositive strength; no isolated clamp has been introduced.
The [independent acceptance](features/c2-systems/C2D_INDEPENDENT_ACCEPTANCE_2026-10-26.md) preserves the
rejected short CPU window. Fresh continuous CPU, both100-cycle retention runs and
the full seventeen-actor foreground comparison pass unchanged budgets and exact
final hashes; failed historical observations are not reused as passing evidence.

Historical C2c pack: BM1 content0.15.0/module10, Rules11/save3; demo0.10.0.
The additive [C2d source/design evidence](features/c2-systems/C2D_LAST_STATION_RECOVERY_2026-10-26.md)
authenticates the candidate's death/createship/setallied bodies, inherited
constant pool, all-five station census and original event receiver. Its runtime
contract was Next at that recovery-only checkpoint; no pack, maintained content,
original bitmap or version changed in that package. The implementation above
supersedes that execution status.
The [C2c implementation](features/c2-systems/C2C_IMPLEMENTATION.md) and
[fidelity ledger](features/c2-systems/C2C_FIDELITY_LEDGER.md) document authenticated166-row station
and52-row government metadata, start-scoped Vulcan standing, five staged Vulcan
stations and real allied25/26/59 replacements. `provenance.json.c2cLifecycle`
owns selector/frame/media references and hashes. Source pivots/scale now replace
the former provisional mappings for25/72; original bitmap bytes are preserved.
Earlier mapping qualifications below remain historical until superseded by
their owning sidecars. Additive selected-actor explosion derivatives and hashes
belong to `ui/actor-explosion-provenance.json`, with explicit NPC-explosionwave
and native timing limits in the presentation review. Standing initializes once
into the exact consumed collection plus a start binding; membership uses sparse
overrides. No mutable full source-vector or inactive NPC cache is introduced.
The [C2c review](features/c2-systems/C2C_REVIEW_2026-10-25.md) and
[foreground acceptance](features/c2-systems/C2C_FOREGROUND_ACCEPTANCE_2026-10-26.md) now record
completed bounded runtime/browser/performance acceptance. Prior contracts reject without migration.
Root verified4,631 existing original/recovery/UI/runtime-image files unchanged.

Historical C1i pack: BM1 content0.14.0/module9, Rules10/save2. C1i adds validated player
identity and11 additive editable preview planes; staging contains32 selected
scene/effect images,219 maintained UI assets and the travel WAV. Fresh name
defaults are blank according to authenticated source reset plus inspected candidate
evidence, distinct from authored field placeholders. The maintained data is shared
by preview and staging; resource text edits never become balances. The
[recovery](features/c1-starts/C1I_EDITABLE_START_RECOVERY.md), [presentation audit](features/c1-starts/C1I_PRESENTATION_AUDIT.md)
and [review](features/c1-starts/C1I_REVIEW_2026-10-24.md) own provenance, adaptations and acceptance.
All1,313 originals,208 prior UI assets,159 prior C1h evidence files and eight prior
world artifacts remain unchanged. Prior save1 and pack versions explicitly reject.

Historical C1h pack: BM1 content0.13.0/module9, Rules10/save1. The fresh Shift-gated
Borg consumes actual Cube44/Vex34, H5000/S100/E5000 and equipment5/17/empty.
Its [world audit](features/c1-starts/C1H_WORLD_RECOVERY.md) and `provenance.json` own authenticated
media, base registration plus player-only half scale, the complete station-table
audit (no Vex stations), reused planet12/Media78, map/offers and fresh/inherited
qualifications. Module policy preserves source nebula-entry restriction until C7.
Earlier packs/contracts reject before live or stored state changes. Staging now
contains32 selected scene/effect images plus208 maintained original UI assets and
the travel WAV. The [C1h review](features/c1-starts/C1H_REVIEW_2026-10-24.md) records independent final
tests, builds, production browsers and preservation; all196 prior UI assets,
1,313 original inputs and seven prior world artifacts are unchanged.
The older feature-specific records below retain their original scope and counts.

Game module schema version 6 retains version 5's typed systems, visual manifest
and game-neutral encounter reference. It adds a module calendar, explicit
arrival state and evidence-qualified map positions for S16 travel. It is distinct
from the earlier BM1-only content schema that also
happened to use version 2. `src/content/schemas/game-module.ts`
and `game-content.ts` are the authoritative Zod schemas. The complete independently
authored example is `modules/demo/public/game/module.json`.

`modules/bm1/stage.cjs` is the BM1 recovery-to-runtime conversion boundary. It reads
preserved recovery JSON and media plus the original loose bitmap folder, writes
`modules/bm1/public/game/module.json`, and stages eight selected-scene/effect assets
into that module's assets folder. Runtime code never imports generated ActionScript
or analysis modules. The old root `public/` is ignored by current builds.

At startup, `GameModuleSchema` validates the complete JSON document before
`ContentCatalog` copies it into immutable ID lookups. Unknown weapon references,
duplicate entity or weapon IDs, unknown categories, unsupported schema versions,
missing fields, and unexpected properties reject the entire content pack. A failed load occurs before the
Zustand store is created, so partially valid content cannot enter a game.

The document contains identity/version, title/subtitle/notice, tick rate, calendar, viewport,
`content` (entity and weapon arrays), resource and government definitions, typed
systems, starts, entity visuals and planet visuals. Each system owns initial strength/population,
planet presentation and environment data, an evidence-qualified map position and
arrival placement, offered entity
references, and station placements relative to its planet. Resource IDs are
module-local strings. Each start
contains full player state, so the engine has no start-specific resource or energy
formula. Start IDs, ship/system references and resource keys are validated. Every
start must resolve its ship, planet and all starting-system station visuals. System
government, opposing-government, offered-entity, station
structure and station-destination references are also validated. Asset paths must
be relative paths under the module's `assets/`. S16 validates destination visuals
and composes a new simulation world; S17 still owns safe scene presentation. See
[GAME_MODULES.md](../../../docs/GAME_MODULES.md) for code contracts, selection and packaging.

The bounded [two-system anomaly dispositions](../../../analysis/bm1/TWO_SYSTEM_ANOMALY_DISPOSITIONS.md)
select Earth (1) and Vulcan (12) for D3 and document the consumed planet fields,
government/station references and optional environment flags. The selected
16-field rows mean no nebula and no asteroid generation because the legacy code
tests absent tail fields explicitly against `1`. The selected map markers were
subsequently [recovered](presentation/MAP_PLACEMENT_RECOVERY.md); planet field 2 is
initial strength and must never be used as a distance substitute.

D3 staged all reviewed fields for Earth and Vulcan, plus Stardock Alpha and U of
Vulcan as representative station placements. The provenance sidecar records their
source record numbers and the 19 other Earth/Vulcan station records deferred until
their visuals or mechanics enter use. The module now stages verified Earth
`(-67.4,79.85)` and Vulcan `(-168.15,138.6)` map markers, plus provisional
arrival `(0,0)`. The
independent demo supplies two authored positioned systems and varied environment flags, so
shared validation does not depend on BM1 values.

## Selected-scene asset manifest

D4 established four mappings for Earth and the later S9 NPC increment; S6 adds
three for Vulcan. `modules/bm1/provenance.json` is the authoritative machine-readable
sidecar for their source files, hashes, dimensions, mapping evidence and
registration limits:

| Role | Runtime target | Recovered file | Native size | Mapping evidence |
| --- | --- | --- | --- | --- |
| Player | Entity 6, Saber Class | `Media-348.png` (`saber.gif`) | 43 × 49 | Entity and recovered catalog names agree. |
| Starting planet | Planet visual type 4, Earth | `Media-44.png` (`planet4`) | 245 × 245 | `setplanet()` selects type 4; Symbol 5 frame 4 references Media 44. See [visual recovery](presentation/EARTH_VISUAL_RECOVERY.md). |
| Starting station | Entity 70, Human Starbase at Stardock Alpha | preserved `humanstarbase.gif` → staged `human-starbase.png` | 141 × 141 | Structure and loose bitmap names agree. Its only full-size still GIF frame is converted losslessly for PixiJS; the original is unchanged. No FLA linkage ID has been decoded. |
| NPC encounter | Entity 7, Danube Runabout | `Media-1.png` (`runabout`) | 16 × 26 | Entity and recovered catalog names agree; `createship()` permits type 7 in its random ordinary-ship path. S9 stages one controlled seeded encounter, not a claim of an unconditional original spawn. [Evidence and limits](foundation/SEEDED_RUNABOUT.md). |

S6 adds `Media-38.png` (`vulcan.gif`, 41 x 57) for ship 25,
`Media-49.png` (`planet9`, 207 x 207) for the Vulcan planet, and
`Media-68.png` (`vulcanresearch`, 64 x 63) for station structure 72.
The planet frame-to-media selection is verified by Symbol 5 frame 9; the ship
and station assignments are plausible catalog-name/appearance matches but their
symbol linkages are not decoded. See [Vulcan start evidence](features/c1-starts/VULCAN_START.md).

R2 established that recovered bitmap bounds are media rectangles rather than
symbol registration points. Earth's selected frame 4 pivot `(124/245, 116/245)`
and Vulcan's selected frame 9 pivot `(103/207, 93/207)` are verified. The ship,
station and NPC pivots still use provisional centers. The stage command checks
the six extracted PNG stream identities, dimensions
and export hashes, and checks the preserved Human Starbase GIF hash before
converting its only full-size frame to PNG. The generated PNG hash is recorded
separately in provenance; the obsolete byte-identical staged GIF is removed.
`gifuct-js` is a pinned development dependency for this conversion.
Schema validation rejects a start whose ship, starting planet or starting-system
station lacks a mapping. Physical file loading remains an asynchronous renderer
boundary and reports its own initialization error.

The catalog freezes its returned entity and weapon collections, each copied
definition, and each three-slot loadout tuple. It exposes category-specific ship
and structure lookups alongside the general original-ID lookup; callers cannot
obtain Zustand setters or mutable catalog aliases.

## Entity records

The legacy `itemtext` table combines ships and structures around three template
rows. The BM1 converter produces a discriminated union: records 1-66
are `ship` definitions, template IDs 67-69 remain excluded, and records 70-90 are
`structure` definitions. The staging boundary verifies that ships have a numeric
turn value and structures retain the authored `x` immobility marker.

Ship definitions name the legacy fields according to their reviewed use:
`sizeClass`, `fuelEfficiency`, `cargoCapacity`, hull, shields, speed and turn
per authored frame, price, and three starting weapon IDs. Movement accepts only a
`ShipDefinition`; structure data cannot enter navigation through the typed content
contract.

BM1's former `antimatterEfficiency` maps to the neutral `fuelEfficiency` field.
Speed and turn are per module tick; BM1 supplies 13 ticks per second while the
demo supplies 30. The three-slot tuple is the current engine capability; expand
it only with a concrete equipment feature and corresponding schema changes.

Structure definitions separately expose `constructionScale`,
`populationChangeBillions`, `planetStrengthChange`, hull and shields. Recovered
daily-update code confirms that structure completion applies the signed population
and strength fields to its planet. The Bar therefore preserves its authored `-2`
population effect. The old SPD value has no reviewed structure behavior yet;
it and the literal turn marker are retained in `modules/bm1/provenance.json`,
outside runtime definitions. A `0` weapon slot becomes `null` in both categories.

Legacy entity IDs 67-69 contain field-name templates rather than content. They are
omitted from definitions and preserved under `excludedLegacyEntityIds` in the
BM1 provenance sidecar, alongside source hashes and field provenance.

## Weapon and device records

Weapon records retain ID, name, description, minimum size class, energy cost,
base damage, cooldown in authored frames, and base price. The original table also
contains non-weapon devices using zero combat values; they remain in the same
validated collection until their purchasing/equipment behavior is implemented.
S10 consumes the Type X Phaser's recovered cost and base cooldown through the
existing Saber primary slot. See [command evidence and limits](foundation/PRIMARY_PHASER_COMMAND.md).

Twelve `SLOT` template records are omitted and listed under
`excludedLegacyWeaponIds` in that sidecar. Entity cross-reference validation ensures no
starting loadout points at an omitted or unknown ID.

Original modules can supply an empty weapon list. Missions, dialogue, world map
geometry and save schemas will be introduced together with their runtime features.

## Regeneration and extension

Run `npm run module -- bm1 stage` after regenerating recovery evidence. Use
`npm run module -- bm1 test` for module tests and its verification hook, and
`npm run module -- bm1 build` for the selected build and distribution audit.
BM1 dev/build stage through the Vite module selection; default `npm test`, demo
dev/build and `test:engine` do not read recovery. Correct recovery/conversion in the maintained
tooling without rewriting extracted originals; never edit staged BM1 JSON as the
sole source of a change because staging replaces it. For an original module,
author its own document/assets and rules using the demo's structure as a guide.
