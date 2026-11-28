# Project-X development plan

The sole live checkpoint and next-task selector. The [BM1 backlog](../modules/bm1/docs/IMPLEMENTATION_SEGMENTS.md)
owns detailed status and acceptance; [documentation navigation](README.md) locates contracts and evidence.

## Product direction

Finish original BM1 mechanics, content, Flash UI and interaction flow before an
enhanced edition. Keep the reusable engine independent of game modules; the
independent demo tests shared contracts. A complete second game is outside the
active sequence. Technical separation does not establish copyright clearance.

## Current checkpoint

As of 2026-11-26: the playable slice and C1–C13c are implemented. The November
browser acceptance pass is complete, C13a/b is browser-accepted (except
construction type 85, which needs system 51) and C13c is browser-accepted.
The full original game remains open.

| Area | Delivered | Owning document |
| --- | --- | --- |
| Foundation and slice | Selected modules, flight, combat, repair, travel, saves | [Milestones](#milestones) |
| C1/C2 | Supported starts; all 48 ordinary systems with persistent revisits | [Backlog and limits](../modules/bm1/docs/IMPLEMENTATION_SEGMENTS.md#remaining-c2-coverage-and-sequence) |
| C3 | Atomic ship acquisition, refit, saved continuation | [Contract](../modules/bm1/docs/features/c3-ship-acquisition/C3_SHIP_ACQUISITION.md) |
| C4 | Weapon families and special effects | [Acceptance](../archive/docs-2026-11-26/modules/bm1/docs/features/c4-weapons/C4_REVIEW_2026-11-05.md) |
| C5 | Equipment purchase and three ordered firing channels | [Contract](../modules/bm1/docs/features/c5-equipment/C5_EQUIPMENT.md) |
| C6 | Cargo, 43 goods, generated markets, planet resource purchases | [Contract](../modules/bm1/docs/features/c6-cargo-trade/C6_CARGO_TRADE.md) |
| C7 | Skills, career tallies, nebula gate, UI-12 status | [Results](../modules/bm1/docs/features/c7-progression/C7_PROGRESSION_PLAN.md#results) |
| C8 | Cargo-run contracts and 31 away-team missions | [Results](../modules/bm1/docs/features/c8-missions/C8_MISSIONS_PLAN.md#results) |
| C9 | Boarding: pillage, salvage, capture, self-destruct | [Results](../modules/bm1/docs/features/c9-boarding/C9_BOARDING_PLAN.md#results) |
| C10a–d | NPC population, governments, hostility, NPC-vs-NPC combat, one death owner, projectiles, stations, cloak | [Plan and results](../modules/bm1/docs/features/c10-npc-combat/C10_NPC_COMBAT_PLAN.md) |
| C10e | Minimap markers, multi-bolt art, NPC beams, per-death explosions, station ship sales | [Findings](../modules/bm1/docs/maintenance/POST_C10_FIDELITY_FIX_PLAN.md#master-integration-2026-11-09) |
| C11 | Fleet purchase, owned IDs, revisits, sale, map blips | [Results](../modules/bm1/docs/features/c11-fleet/C11_FLEET_PLAN.md#results-implemented-2026-11-10-browser-acceptance-pending) |
| C12 | Fleet orders, auxiliary craft, roster missions | [Results](../modules/bm1/docs/features/c12-fleet-orders/C12_FLEET_ORDERS_PLAN.md#results) |
| C13a/b | Station plans, Build tab, UI-22 builder, construction sites, built stations | [Results](../modules/bm1/docs/features/c13-construction/C13_CONSTRUCTION_PLAN.md#results-2026-11-18) |
| C13c | Subspace Comm fleet management (type 25); browser-accepted 2026-11-26 | [Results](../modules/bm1/docs/features/c13-construction/C13_CONSTRUCTION_PLAN.md#c13c-results-2026-11-26-browser-accepted) |
| C17a | Original F8 cheat console | [Plan](../modules/bm1/docs/features/c17a-cheat-console/C17A_CHEAT_CONSOLE_PLAN.md) |
| Shields | Passive recharge and impact flash | [Results](../modules/bm1/docs/features/shields/SHIELDS.md) |
| Hull-damage mask | Recovered Symbol 280/281 masks (NPC masks deliberately hull-only) | [Contract](../modules/bm1/docs/features/damage-mask/DAMAGE_MASK.md) |
| Local warp | Maximum-25 guard for B'rel/Hideki overshoot | [S7](../modules/bm1/docs/foundation/LOCAL_WARP_ENERGY.md) |
| Presentation/platform | Viewport corrections, Pixi/Three renderers, staged and seamless loading | [Loading](architecture/CLIENT_LOADING_2026-11-06.md), [transitions](../modules/bm1/docs/maintenance/LOADING_TRANSITIONS_FIX_PLAN.md#results-2026-11-07) |

Fix records since the slice, all browser-accepted:
[post-C11](../modules/bm1/docs/maintenance/POST_C11_FIDELITY_FIXES.md),
[2026-11-12 findings](../modules/bm1/docs/maintenance/BROWSER_FINDINGS_FIX_2026-11-12.md),
[departure](../modules/bm1/docs/maintenance/DEPARTURE_FIXES_2026-11-14.md),
[slice provisions](../modules/bm1/docs/maintenance/SLICE_PROVISIONS_2026-11-14.md),
[2026-11-16/17 browser pass](../modules/bm1/docs/maintenance/BROWSER_ACCEPTANCE_2026-11-16.md) and the
[2026-11-25 bug audit](reviews/PROJECT_X_BUG_AUDIT_2026-11-25.md) (all nine items fixed).

### Active next task

**User browser check of the 2026-11-27 [display-rate presentation](architecture/RENDER_INTERPOLATION.md#display-rate-inventory-2026-11-27)**:
explosions should stay fixed to the world while the player flies; the cheat
console (F8), the interstellar map and the main HUD panel should open
smoothly. Construction bots, minimap markers, the tactical slide, the contact
panel and the HUD slide (opening, closing, mid-opening reversal) passed the
lead's headless check. Then the next segment
is **not yet selected**. The 2026-11-27 [selection fix](../modules/bm1/docs/foundation/TARGET_SELECTION.md#original-marker-and-select-then-hail-2026-11-27)
(recovered `selecttool` marker, select-then-hail for stations) passed its BM1
browser checks; only the demo placeholder-ring check is unconfirmed. C13c passed
browser acceptance on 2026-11-26. The user has not selected the next gameplay
segment; pick it from the open rows of the
[backlog](../modules/bm1/docs/IMPLEMENTATION_SEGMENTS.md#phase-3-complete-the-original-working-systems).

Carry-over constraints for the next work:

- Population/strength effects of built stations belong to C14.
- Offered ship 48 lacks combat geometry (recorded content gap; no bounds invented).
- Prestige and tally changes go through the existing C2 standing and C7 operations; see the
  [C7](../modules/bm1/docs/features/c7-progression/C7_PROGRESSION_PLAN.md#owned-by-later-features-recorded-not-implemented)
  and [C8](../modules/bm1/docs/features/c8-missions/C8_MISSIONS_PLAN.md#results) deferred lists.
- Cargo-dump/pod interaction and other original HUD commands belong to C17.
- Preserve C3's planet self-purchase boundary and C11 fleet ownership.

### Open gates and deferred work

- C2 visible timing is **user-deferred**. C2f's failed 16.7 ms result remains failed; different 60/120 Hz conditions do not prove a regression. [Timing evidence](../archive/docs-2026-11-26/modules/bm1/docs/features/c2-systems/C2F_REVIEW_2026-10-29.md).
- Four special systems remain C16-owned; further NPC encounters retain C10 ownership. [Backlog](../modules/bm1/docs/IMPLEMENTATION_SEGMENTS.md#phase-3-complete-the-original-working-systems).
- Construction type 85 cannot be browser-checked until system 51 is staged. Asteroid fields are backlog segment C20.
- Native/reference parity, complete original UI, ordinary play/victory and full-game release gates remain open. [BM1 scope](../modules/bm1/CONVERSION_PLAN.md), [UI criteria](../modules/bm1/docs/ui/UI_RECREATION_PLAN.md).

### Current contracts

| Contract | Version |
| --- | --- |
| Module schema | 25 |
| Rules API | 35 |
| Save format | 21 |
| BM1 package | 0.46.0 |
| Pixi spatial publication | 4 |
| Demo package | 0.35.0 |

Prior incompatible saves reject before replacing active state; no migration is supplied.
Counts and build/browser qualifications stay in owning evidence, not in this live selector.

Governing boundaries: [architecture](ARCHITECTURE.md) and [game modules](GAME_MODULES.md).
Retain explicit state ownership, renderer-independent simulation, validated
boundaries, atomic operations and recovery provenance. Add abstractions only for implemented behavior.
For C3 and later content/artwork or recovery/preparation changes, run affected
preparation, stage explicitly, review data/assets/provenance together and pass
`npm run module -- bm1 check-artifacts` plus feature checks before acceptance.
Normal builds consume reviewed snapshots; they do not prove artifact freshness.

Earlier checkpoint text, completed plans, reviews and handoffs are in the
[2026-11-26 archive](../archive/docs-2026-11-26/) (for example the delivery logs
[through October 30](../archive/docs-2026-11-26/docs/history/CONVERSION_HISTORY_THROUGH_2026-10-30.md)
and [November](../archive/docs-2026-11-26/docs/history/CONVERSION_HISTORY_2026-11.md)). Their next-task statements are historical.

### Second-module compatibility guardrails (user decision, 2026-11-09)

BM1 work continues in the active sequence, but must not close off a future
original module whose mechanics differ (a lone independent captain with
faction reputation, no fleets, construction or conquest). These guardrails are
acceptance conditions, not new segments:

- **Optional capabilities only (C11–C15).** Fleets, orders, construction,
  production and conquest land as optional capabilities. A module that omits a
  capability gets null state, no random draws, no tick work, no UI and no saved
  fields for it; the independent demo proves that absence. Add no new required
  `GameRules` members for these features.
- **Standing through its owner (C9, C14, C15).** Read standing and governments
  only through the existing selectors/owners. Do not copy the
  one-local/opposing-government-pair-per-system or per-system-standing shape
  into new contracts; a later per-faction reputation contract is expected to
  generalize that owner rather than add a parallel store.
- **Save compatibility across version bumps (planned, not implemented).**
  Today a save restores only when module ID/version, module schema, Rules API
  and save format all match exactly, so every BM1 bump invalidates every
  module's saves. During development this stays acceptable; no per-bump
  migration is written yet.
  - *Trigger.* Start this work at the first of: saves held by anyone outside
    development (playtest or public build); a second module needing saves that
    survive engine updates; rebuilding development fixtures becoming a real
    cost. Otherwise schedule it with V4.
  - *Step 1, per-capability versioning.* Version each saved section by the
    capability that owns it; a save checks only the capabilities its module
    declares, so an undeclared capability's bump cannot invalidate it.
  - *Step 2, step migrations.* Each bump ships a pure raw-JSON upgrade N→N+1,
    chained before Zod validation so the current schema stays the sole
    authority. The engine migrates engine-owned sections; modules migrate their
    own content references (e.g. renamed definition IDs) and declare which
    content changes keep a module version save-compatible. A save with no
    complete path still rejects before replacing the active session.
  - *Verification.* Each migration is tested from a frozen fixture save of the
    older version; these fixtures seed V4.

## Delivery and document ownership

Each feature includes consumed source facts, a short decision for new contracts,
implementation, original UI consumers, save behavior and focused validation.
U5 fidelity and C17 command integration inspect the same
delivery checklist; they are not separate implementation queues.

Group records, starts and systems that use the same mechanics. Keep individual
data/asset cases, but split tasks only for distinct behavior, meaningful contract
changes or unresolved recovery facts. Recovery blocks only consumers needing
the missing fact. Do not impose all earlier family gates on unrelated work.

Use one contrasting independent demo example per new shared capability. Reuse
that example for equivalent content; do not reproduce each BM1 start, station,
layout or source quirk in the demo. Broader generality waits for a real consumer.

Update the owning feature document and its backlog row when behavior or status
changes. Update this checkpoint only when the active checkpoint, next task,
blocker or cross-project policy changes; keep it to one row per feature, not a
delivery log. Update architecture/provenance/UI documents when their actual
contracts change, not as a mandatory five-document closure routine.

Record each feature's outcome in its owning plan's results section. Agent
handoffs, per-slice reviews and audits are working material: once a feature is
accepted, fold anything still relevant into the owning document and move the
rest to a dated `archive/` folder rather than keeping competing live summaries.
This policy supersedes older per-child document-update lists.

## Verification policy

Use focused behavior and failure-path tests, affected boundary checks,
typecheck/build for runtime changes and a short real browser check when
interaction changes. Exercise the actual command-to-visible-result path, save/
reload and disposal where affected; an imported end state alone can hide defects.

Full regression sweeps, long retention runs, multi-window performance benchmarks
and comprehensive distribution/provenance review belong at substantial
milestones. Earlier extended checks need a named risk: changed scheduling,
resource ownership, scene replacement, asset lifetime, a materially larger load,
or a demonstrated regression.

Reuse evidence when the relevant implementation, inputs and measured conditions
are unchanged. A changed feature needs its own focused proof, not repetition of
every previous audit. Do not add audits of audits, repeat full-file inventories
after prose edits, or rerun runtime tests for documentation-only revisions.
Correctness, save integrity and demonstrated lifecycle failures block dependent
implementation until resolved.

Leak checks should assess owned-resource disposal, attached registrations,
retained-memory growth and repeatable trends. Exact equality of browser-internal
counters needs a specific diagnostic reason; it is not a universal completion
condition. Existing failures remain failures; carrying one as a follow-up is not
retrospective acceptance.

### Performance acceptance

Separate requestAnimationFrame delivery intervals from measured simulation,
main-thread rendering and GPU work; callback intervals alone do not measure
rendering cost. Before a new acceptance run, specify the supported refresh rates,
representative load, viewport/DPR, browser/hardware, power/focus conditions,
sampling protocol and absolute or relative thresholds for each measured quantity.
Record the active display refresh rate and compare revisions under matching
conditions. Define cadence expectations relative to the display period and work
budgets separately; do not assume a 60Hz and a 120Hz run are interchangeable.

Any revised criterion must have a documented product rationale before collecting
new acceptance data. Do not tune a threshold after seeing a failure or use a new
criterion to relabel the old result. C2f's failed 16.7ms result is preserved; its
visible follow-up remains deferred. Planning this protocol authorizes no new run.

## Milestones

| Milestone | Outcome and remaining scope |
| --- | --- |
| M1: module foundation | Delivered selected modules and shared engine boundaries. |
| M2: two-system world | Bounded slice delivered; source/playback qualifications remain with its evidence. |
| M3: playable slice | S21 delivered start, flight, selection, combat, repair, transaction, travel and save/reload in its explicit fixture. [Ordinary-play limits](../modules/bm1/docs/foundation/SLICE_WALKTHROUGH.md) remain open. |
| M4: original compatibility implementation | Complete C1–C19 mechanics/content with their original U1–U7 interface. Each new stateful feature includes save support. |
| M5: full independent game | Outside the active original-port sequence; the compact demo continues to test contracts. |
| M6: verification and release preparation | Selected-product replay, fidelity, lifecycle, persistence, performance and packaging; BM1 requires U7 and V7–V8 ordinary play/victory and explicit reference/adaptation limits. Preparing artifacts does not authorize publication. |
| M7: enhanced edition | Deferred until original BM1 M4/M6 completion. Preserve the original baseline and define enhancements/save compatibility separately. |

## Starting a fresh development session

Read AGENTS.md, this checkpoint, [architecture](ARCHITECTURE.md),
[module boundaries](GAME_MODULES.md), then the
selected module's scope and backlog. For BM1, read the owning feature plan,
provenance and relevant recovery evidence. Inspect the affected implementation
and select checks from the change and its risks; do not routinely rerun old
acceptance simply because a session starts. Do not read `archive/` unless a
task needs a specific historical record.

## Documentation and source-control policy

Plans, tests, tools, compatibility modules, recovery evidence and `archive/`
remain private workspace inputs under the existing Git ignore policy. A minimal
public clone is not a development recovery procedure. Keep setup/build
information in the public README and current internal contracts in their owning
documents.

Preserve original files and evidence. Keep new ignored recovery work recoverable
at completed recovery-package and substantial milestone checkpoints, and before
handoff/release. Verify that a private backup covers the changed inputs and can
be restored; record its location and verification in [BACKUP_CHECKPOINT.md](BACKUP_CHECKPOINT.md).
Reuse prior verified coverage for unchanged files. A routine child or prose edit
does not require a fresh full-workspace archive, full restore or preservation
sweep. This changes neither tracking policy nor authorization to upload content.
