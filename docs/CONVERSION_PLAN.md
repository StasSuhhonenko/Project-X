# Project-X development plan

The sole live checkpoint and next-task selector. The [BM1 backlog](../modules/bm1/docs/IMPLEMENTATION_SEGMENTS.md)
owns detailed status and acceptance; [documentation navigation](README.md) locates contracts and evidence.

## Product direction

Finish original BM1 mechanics, content, Flash UI and interaction flow before an
enhanced edition. Keep the reusable engine independent of game modules; the
independent demo tests shared contracts. A complete second game is outside the
active sequence. Technical separation does not establish copyright clearance.

## Current checkpoint

As of 2026-11-25, the bounded playable slice is delivered, the November browser acceptance pass is complete and C13a/b is implemented and browser-accepted (except type 85); the full original game remains open.

- Foundation and playable slice: selected modules, flight, combat, repair, travel and saves; [milestones](#milestones).
- C1/C2: supported starts and all 48 ordinary systems with persistent revisits; [backlog and limits](../modules/bm1/docs/IMPLEMENTATION_SEGMENTS.md#remaining-c2-coverage-and-sequence).
- C3: representative atomic ship acquisition, refit and saved continuation; [contract](../modules/bm1/docs/features/c3-ship-acquisition/C3_SHIP_ACQUISITION.md).
- C4: consumed weapon families and special effects; [acceptance](../modules/bm1/docs/features/c4-weapons/C4_REVIEW_2026-11-05.md).
- C5: equipment purchase, ownership and three ordered firing channels; [contract](../modules/bm1/docs/features/c5-equipment/C5_EQUIPMENT.md).
- C6: ten cargo positions, all 43 goods, generated markets and atomic commerce; [contract and acceptance](../modules/bm1/docs/features/c6-cargo-trade/C6_CARGO_TRADE.md).
- Planet resource purchases (2026-11-07): original antimatter refill and deuranium packages restored through validated atomic actions and contact hit regions, with exact source rollovers/refusals; [rules, evidence and limits](../modules/bm1/docs/features/c6-cargo-trade/C6_CARGO_TRADE.md#planet-resource-purchases-2026-11-07). Parallel artwork restoration is separately owned.
- C7 (2026-11-07): seven experience skills and six career tallies through one validated, saved, atomic operation; travel/repair/weapon awards, nebula gate, hail access and UI-12 status; source has no faction reputation, local prestige stays the C2 standing state. [Plan and acceptance](../modules/bm1/docs/features/c7-progression/C7_PROGRESSION_PLAN.md#results).
- C8 (2026-11-07): planet and station cargo-run contracts (offer, negotiation, acceptance into contract cargo, delivery once through Transport/`T`) and the 31 away-team surface missions, saved per visit; contract cargo cannot be market-sold. [Plan and acceptance](../modules/bm1/docs/features/c8-missions/C8_MISSIONS_PLAN.md#results).
- C10a (2026-11-07): source system-entry NPC population (traders, allied, enemy fleets, pirates) in source draw order, a declared government on every NPC, and one saved random stream per NPC; C2 defenders and encounters share one createship owner. [Results](../modules/bm1/docs/features/c10-npc-combat/C10_NPC_COMBAT_PLAN.md#c10a-encounters-and-governments-delivered-2026-11-07).
- C10b (2026-11-08): saved per-NPC combat state and one sequential decision loop; source hostility (negative standing, pirates, return fire, rescue), cloak release, hail notice, NPC beams at the player through the module hit rule, and one-time player death. [Results](../modules/bm1/docs/features/c10-npc-combat/C10_NPC_COMBAT_PLAN.md#c10b-hostility-and-incoming-fire-delivered-2026-11-08).
- C10c (2026-11-09): local/opposing and pirate enmity in both leads; one hit/death owner for every NPC ship (player and NPC attackers); NPC beams damage NPCs with immediate removal; saved sticky blame; source death gate, friendly/enemy draws, government fan-out, Mercinary tally, census strength and replacement; persistent strength on all 48 supported systems. [Results](../modules/bm1/docs/features/c10-npc-combat/C10_NPC_COMBAT_PLAN.md#c10c-npc-vs-npc-and-ship-death-outcomes-delivered-2026-11-09).
- C13a/b (2026-11-18; Rules API 34, save 20, module schema 25, BM1 0.45.0): optional construction capability; station shops sell plans into a reusable nine-position inventory, the HUD Build tab and recovered UI-22 builder start a paid pending site (unclaimed/insufficient refusals, standing for a foreign government), sites progress by raw travel days and complete once on arrival, completed stations appear on revisits with their source services and die through the shared lifecycle policy (built stations count in the last-station census). Population/strength effects stay C14 (P1); Subspace Comm management is C13c. [Plan, decisions and results](../modules/bm1/docs/features/c13-construction/C13_CONSTRUCTION_PLAN.md#results-2026-11-18).
- C12 (2026-11-11): optional fleet orders; Escort/Attack/Seek/Gather from keys 1–4 and the UI-14 Fleet panel with the source AI order branch, Escort ships following on jumps (arriving without orders, literal), auxiliary craft launch/recall and the shuttlebay report, keys 7/8 roster missions (C14 consumes), eleven-slot selection and hail-to-select; exact source slot scans (D13). [Plan, decisions and results](../modules/bm1/docs/features/c12-fleet-orders/C12_FLEET_ORDERS_PLAN.md#results).
- C9 (2026-11-11): optional boarding capability; Transport runs surface then boarding in one atomic publication; source-order draws on the boarded NPC's stream, pillage, C5 salvage, C11 capture of the live actor, self-destruct through the death owner, Pirate tally; generation government is birth provenance only (D12). [Plan and results](../modules/bm1/docs/features/c9-boarding/C9_BOARDING_PLAN.md#results).
- Hull-damage mask (2026-11-11, user request): the recovered Symbol 280/281 masks cut parts of player, NPC and station artwork away in five 20 % durability steps (player hull; others hull plus shields or station strength), fitted to the artwork as in the source; view-only, no save change. [Evidence and contract](../modules/bm1/docs/features/damage-mask/DAMAGE_MASK.md).
- Departure fixes (2026-11-14, user reports; Rules API 33, save 19, BM1 0.43.0): the player's warp-out no longer pauses the system (the host pauses only after the paid commit, as the source `mapclick` committed at once), and NPCs that leave now play the recovered sixteen-frame warp-out (hull stretch, then flash) as inert slotted actors before the "ship has left" notice, instead of vanishing. [Fix record](../modules/bm1/docs/maintenance/DEPARTURE_FIXES_2026-11-14.md), [NPC warp-out](../modules/bm1/docs/features/c10-npc-combat/NPC_WARP_OUT.md).
- Slice provisions superseded (2026-11-14, same release; BM1 0.44.0): the Earth Officer start no longer spawns the S9 test Runabout; Vulcan uses the recovered planet placement; ship/station deaths keep the hull under the explosion for 5 ticks and post the notice 6 ticks later (engine `scheduledNotices`, `visuals.destruction`), and player phaser kills now publish their death event (they previously vanished without an explosion); vessel/fleet purchases no longer freeze the system during art preflight; fleet ships use the allied minimap marker. [Fix record](../modules/bm1/docs/maintenance/SLICE_PROVISIONS_2026-11-14.md).
- Maximum-25 local warp (2026-11-11, user report, BM1 0.40.1): the S7 impulse-only guard now admits exactly ships whose source acceleration crosses native warp at zoom 1, so the Klingon B'rel and Cardassian Hideki overshoot into warp as in the original; the Saber correction is unchanged. [S7](../modules/bm1/docs/foundation/LOCAL_WARP_ENERGY.md).
- Post-C11 fidelity fixes (2026-11-10): jumps re-enter at full forward speed, distant from and aimed at the planet (Page-1-93293.as), through optional `createTravelArrival`; each new browser game seeds the world stream from fresh entropy, so Earth no longer rolls the same 10-ship Klingon fleet every time; [details](../modules/bm1/docs/maintenance/POST_C11_FIDELITY_FIXES.md)
- Shields (2026-11-10): optional passive player shield recharge (source +0.05/frame at the default Shields allocation, inert at 0 and full) and the recovered Symbol 151 shield-impact flash (cyan colour transform, 40/30/20/10% fade, player and >50% NPC triggers); [results](../modules/bm1/docs/features/shields/SHIELDS.md)
- C11 (2026-11-10): optional fleet capability; Fleet purchase at planet and station shipyards with permanent owned-ship IDs, revisit spawning, death removal, Ships sale, star-map blips and statistics count; bought ships stay where bought until C12 orders. [Plan and results](../modules/bm1/docs/features/c11-fleet/C11_FLEET_PLAN.md#results-implemented-2026-11-10-browser-acceptance-pending).
- C10e post-C10 fidelity fixes (2026-11-09): recovered multi-bolt projectile art and Symbol 90 minimap markers, rendered NPC/station beams, one explosion per ship/station death from the single death owner, and station ship sales through the C3 purchase (Fleet stays C11); browser visual acceptance pending. [Findings, integration and limits](../modules/bm1/docs/maintenance/POST_C10_FIDELITY_FIX_PLAN.md#master-integration-2026-11-09).
- Presentation/platform: original viewport corrections, selected Pixi/Three renderers and staged loading; [viewport](../modules/bm1/docs/presentation/VIEWPORT_FIDELITY_REVIEW_2026-11-03.md), [renderer acceptance](reviews/MODULE_RENDERER_REFACTOR_REVIEW_2026-11-05.md), [loading](architecture/CLIENT_LOADING_2026-11-06.md).
- Seamless loading transitions (2026-11-07): whole entry prepared before reveal, gameplay warmed behind the menu, scenes revealed from beneath the previous screen, local contacts prepared before interaction; no content or save change. [Results](../modules/bm1/docs/maintenance/LOADING_TRANSITIONS_FIX_PLAN.md#results-2026-11-07).
- Code hygiene (2026-11-06): Prettier/oxlint tooling, `@engine/*` module imports, DRY helper owners and reorganised docs; no gameplay, content or save-contract change. [Owners](../src/README.md#change-the-right-owner), [docs index](README.md).

### Active next task

**Sequence (user decisions, 2026-11-07 and 2026-11-09): C10 → C10e → C11 → C9.** C9 boarding reads NPC
ship governments (boarding prestige, death-code prestige, Mercenary tally),
which C10 owns, and successful capture writes the player fleet, which C11 owns.
Doing both first lets C9 land in one pass with no interim capture gap.

**Latest gameplay: C10 NPC diplomacy and combat (delivered 2026-11-09)** ([plan](../modules/bm1/docs/features/c10-npc-combat/C10_NPC_COMBAT_PLAN.md)),
split by user decision into C10a to C10d. The combat extension decisions
are settled in the plan. **C10a encounters and governments: delivered
2026-11-07** (source system-entry population, a government on every NPC, one
per-NPC random stream). **C10b hostility and incoming fire: delivered
2026-11-08** (per-NPC decision loop, hostility, return fire, rescue, cloak
release, hail, NPC beams at the player, player death). **C10c NPC-vs-NPC and ship death outcomes: delivered
2026-11-09** (enmity in both leads, NPC beams damage NPCs, one hit/death owner
for every ship, sticky blame, source death outcomes with the Mercinary tally,
persistent strength on all 48 supported systems; [results](../modules/bm1/docs/features/c10-npc-combat/C10_NPC_COMBAT_PLAN.md#c10c-npc-vs-npc-and-ship-death-outcomes-delivered-2026-11-09)).
**C10d projectiles, stations, departure and cloak: delivered 2026-11-09** (stations as
combat actors with a saved fallback weapon, NPC torpedoes and secondaries through one
projectile owner, outcome-free departure, NPC cloak;
[results](../modules/bm1/docs/features/c10-npc-combat/C10_NPC_COMBAT_PLAN.md#c10d-projectiles-stations-departure-and-cloak-delivered-2026-11-09)).
**C10 is complete. C10e post-C10 fidelity fixes: implemented 2026-11-09**
([plan and integration](../modules/bm1/docs/maintenance/POST_C10_FIDELITY_FIX_PLAN.md#master-integration-2026-11-09)): F1 minimap
markers, F2 multi-bolt projectile art, F3 NPC/station beam rendering, F4
per-death explosions, F5 station ship sales. Its browser visual acceptance
(captures listed in the plan) is the remaining C10e step. **C11 fleet roster: implemented 2026-11-10** ([plan and results](../modules/bm1/docs/features/c11-fleet/C11_FLEET_PLAN.md#results-implemented-2026-11-10-browser-acceptance-pending);
user decisions: bought ships stay where bought until C12 orders; C11 delivers buy, sell, map blips and statistics count); browser acceptance pending.
**Shields: implemented 2026-11-10** at the user's request ([results](../modules/bm1/docs/features/shields/SHIELDS.md)):
passive recharge and the impact flash; browser acceptance pending. The UI-13 Power panel that changes the
Shields allocation stays C17. **Post-C11 fidelity fixes: implemented 2026-11-10**
([details](../modules/bm1/docs/maintenance/POST_C11_FIDELITY_FIXES.md)): moving jump arrival and per-session
random seeding; browser acceptance pending. **C9 boarding: implemented 2026-11-11**
([plan, decisions and results](../modules/bm1/docs/features/c9-boarding/C9_BOARDING_PLAN.md#results)):
Transport boards a disabled NPC ship (pillage, weapon salvage, capture into the C11 fleet, or self-destruct
through the single death owner); browser acceptance pending. **C12 fleet orders: implemented 2026-11-11** ([plan, decisions and results](../modules/bm1/docs/features/c12-fleet-orders/C12_FLEET_ORDERS_PLAN.md#results)); browser acceptance pending. **C17a original F8 cheat console: implemented 2026-11-12** (user decision; browser acceptance pending; Rules API 32, BM1 pack 0.42.0, save format 18 unchanged) ([plan](../modules/bm1/docs/features/c17a-cheat-console/C17A_CHEAT_CONSOLE_PLAN.md), [recovery](../modules/bm1/docs/features/c17a-cheat-console/C17A_CHEAT_CONSOLE_RECOVERY.md)), so a person can reach late-game states. **2026-11-12 browser findings fixed** (cheat backing box, merchant row separators, purchased-hull death/departure crash, ship control panel backings/order, power covers and technology slots, post-arrival star-field flip, fleet-purchase world freeze; BM1 pack 0.42.0 and save format 18 unchanged; [fix record](../modules/bm1/docs/maintenance/BROWSER_FINDINGS_FIX_2026-11-12.md)); browser acceptance pending. **2026-11-14 departure fixes** (simulation keeps running under the player's warp-out; recovered NPC warp-out; Rules API 33, save format 19; [fix record](../modules/bm1/docs/maintenance/DEPARTURE_FIXES_2026-11-14.md)) and **slice-provision fixes** (BM1 pack 0.44.0; [fix record](../modules/bm1/docs/maintenance/SLICE_PROVISIONS_2026-11-14.md)). **2026-11-16 combined browser pass: partly run** ([results and fixes](../modules/bm1/docs/maintenance/BROWSER_ACCEPTANCE_2026-11-16.md)). Accepted: C17a, shields, post-C11 fixes, the departure fixes, purchased-hull death/jump, hull-damage mask, Fleet purchase, four-bolt pulse, station ship preview, no Earth Runabout, Vulcan placement, purchase without freeze. Failed and refixed: fleet ships drew the red hostile minimap marker (government 16 never writes frame 7). Added at the user's request: Enter submits the cheat console. Round 2 ([results](../modules/bm1/docs/maintenance/BROWSER_ACCEPTANCE_2026-11-16.md#round-2-same-day)) accepted both refixes as used, death timing, C10e, C11 and the 2026-11-12 findings. A later report (the system star and a star layer jumped after a planet purchase) is fixed in the shared star-field history ([fix 3](../modules/bm1/docs/maintenance/BROWSER_ACCEPTANCE_2026-11-16.md#fix-3-the-system-star-and-a-star-layer-jumped-after-a-purchase)). Round 3 ([results](../modules/bm1/docs/maintenance/BROWSER_ACCEPTANCE_2026-11-16.md#round-3-2026-11-17)) accepted C12, shields, Shift+Enter and the star-field fix. A later report (the sun and star field still jumped on fleet and ship purchases) is fixed in scene preparation and a star-field handoff ([fix 4](../modules/bm1/docs/maintenance/BROWSER_ACCEPTANCE_2026-11-16.md#fix-4-the-sun-and-star-field-still-jumped-after-a-fleet-or-ship-purchase-2026-11-17)). Round 4 ([results](../modules/bm1/docs/maintenance/BROWSER_ACCEPTANCE_2026-11-16.md#round-4-2026-11-17-pass-complete)) accepted fix 4 and C9; **the combined browser acceptance pass is complete** (every listed feature and fix is browser-accepted). A later report (a focus rectangle around the ship after Repair) is fixed in the BM1 source controls ([fix 5](../modules/bm1/docs/maintenance/BROWSER_ACCEPTANCE_2026-11-16.md#fix-5-focus-rectangle-around-the-ship-during-repair-2026-11-17)). Fix 5 browser-accepted 2026-11-18. **C13a/b implemented 2026-11-18** ([results](../modules/bm1/docs/features/c13-construction/C13_CONSTRUCTION_PLAN.md#results-2026-11-18)). C13a/b browser-accepted 2026-11-25 (type 85 blocked on system 51). **Next: C13c Subspace Comm fleet management.**
Station plans (for example the Habitat Station plan) stay C13. Offered ship 48 lacks
combat geometry (recorded content gap; no bounds invented). Prestige and tally changes use the existing C2 standing and C7
operations. See the
[C7](../modules/bm1/docs/features/c7-progression/C7_PROGRESSION_PLAN.md#owned-by-later-features-recorded-not-implemented)
and [C8](../modules/bm1/docs/features/c8-missions/C8_MISSIONS_PLAN.md#results) deferred lists. The [C6 acceptance](../modules/bm1/docs/features/c6-cargo-trade/C6_CARGO_TRADE.md)
owns commerce contracts and adaptations; [C5](../modules/bm1/docs/features/c5-equipment/C5_EQUIPMENT.md)
owns equipment and ordered channels. Remaining cargo-dump/pod interaction and
other original HUD commands retain C17 integration ownership. Preserve C3's
planet self-purchase boundary and C11 fleet ownership. C2 visible timing stays
user-deferred and the four special systems remain C16-owned.


### Open gates and deferred work

- C2 visible timing is **user-deferred**. C2f's failed 16.7 ms result remains failed; different 60/120 Hz conditions do not prove a regression. [Timing evidence](../modules/bm1/docs/features/c2-systems/C2F_REVIEW_2026-10-29.md).
- Four special systems remain C16-owned; further NPC encounters and remaining cargo-dump/pod commands retain C10/C17 ownership. [Backlog](../modules/bm1/docs/IMPLEMENTATION_SEGMENTS.md#phase-3-complete-the-original-working-systems).
- C13 browser acceptance, rounds 1–2 (2026-11-22/23): plans, Build tab, builder, refusals, pending site and completion are accepted. Round 2 found three defects: built stations could not be fired on or hailed, plan descriptions were missing, and the construction work pods were missing. All three were fixed on 2026-11-24 (Pixi spatial schema 2). Round 3 (2026-11-25) accepted all three fixes and built-station death; [round 3 results](../modules/bm1/docs/features/c13-construction/C13_CONSTRUCTION_PLAN.md#round-3-results-2026-11-25). C13a/b is browser-accepted except type 85, which cannot be checked until system 51 is staged; [round 2 fix plan](../modules/bm1/docs/features/c13-construction/C13_CONSTRUCTION_PLAN.md#round-2-fix-plan-2026-11-23). Asteroid fields had no owner and are now backlog segment C20. Two later findings (builder button black bars; target strength cover drawn off the bar for every target) were fixed and browser-accepted the same day. Then two more fixes, browser-accepted 2026-11-25: a boarded ship's self-destruct now explodes, because same-tick deaths reach the death observer; and BM1 NPC damage masks measure hull only, a deliberate deviation from the source's hull plus shields ([damage mask](../modules/bm1/docs/features/damage-mask/DAMAGE_MASK.md); Pixi spatial schema 3). **2026-11-25 bug audit: all nine items fixed** ([audit](reviews/PROJECT_X_BUG_AUDIT_2026-11-25.md); handoffs [A](reviews/AUDIT_A_HANDOFF.md), [B](reviews/AUDIT_B_HANDOFF.md)): identity-guarded store publish/rollback for travel and refit, buildable-plan eligibility, builder retry after an ore refusal, origin scene seed and lease kept through a failed departure, scene-lifetime click sequence, fixed-step restart guard, physical fleet-key codes, and modifier chords left to the browser. No save, module or Rules API change. Audit browser items 3, 4, 8 and 9 accepted on 2026-11-25. That recheck found a crash, now fixed: a boarded ship's self-destruct in a system without authored stations (16 BM1 systems, such as Epsilon) spawned a lifecycle replacement whose art the scene had not preloaded, which crashed the committed view. `sceneAssetPaths` now preloads every lifecycle spawn ship in every system. The crash fix, the boarding explosion and the hull-only mask were browser-accepted on 2026-11-25.
- Native/reference parity, complete original UI, ordinary play/victory and full-game release gates remain open. [BM1 scope](../modules/bm1/CONVERSION_PLAN.md), [UI criteria](../modules/bm1/docs/ui/UI_RECREATION_PLAN.md).

### Current contracts

| Contract | Version |
| --- | --- |
| Module schema | 25 |
| Rules API | 34 |
| Save format | 20 |
| BM1 package | 0.45.0 |
| Pixi spatial publication | 3 |
| Demo package | 0.34.0 |

Prior incompatible saves reject before replacing active state; no migration is supplied.
Latest browser acceptance: [2026-11-16/17 pass](../modules/bm1/docs/maintenance/BROWSER_ACCEPTANCE_2026-11-16.md) (complete). Counts and
build/browser qualifications stay in owning evidence, not in this live selector.

Governing boundaries: [architecture](ARCHITECTURE.md) and [game modules](GAME_MODULES.md).
Retain explicit state ownership, renderer-independent simulation, validated
boundaries, atomic operations and recovery provenance. Add abstractions only for implemented behavior.
For C3 and later content/artwork or recovery/preparation changes, run affected
preparation, stage explicitly, review data/assets/provenance together and pass
`npm run module -- bm1 check-artifacts` plus feature checks before acceptance.
Normal builds consume reviewed snapshots; they do not prove artifact freshness.

Historical delivery logs: [through October 30](history/CONVERSION_HISTORY_THROUGH_2026-10-30.md)
and [November](history/CONVERSION_HISTORY_2026-11.md). Their old next-task statements are historical.

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
blocker or cross-project policy changes. Update architecture/provenance/UI
documents when their actual contracts change, not as a mandatory five-document
closure routine. Completed evidence retains its recorded scope and outcomes.
Keep old handoffs in clearly labeled history rather than maintaining competing
live summaries. This policy supersedes older per-child document-update lists.

## Verification policy

Use focused behavior and failure-path tests, affected boundary checks,
typecheck/build for runtime changes and a short real browser check when
interaction changes. Exercise the actual command-to-visible-result path, save/
reload and disposal where affected; an imported end state alone can hide defects.

Full regression sweeps, long retention runs, multi-window performance benchmarks
and comprehensive distribution/provenance review belong at substantial
milestones, including final C2 integration. Earlier extended checks need a named
risk: changed scheduling, resource ownership, scene replacement, asset lifetime,
a materially larger load, or a demonstrated regression. A completed persistence
or alias capability can warrant targeted integration checks before all C2 closes;
it does not automatically require the entire acceptance package.

Reuse evidence when the relevant implementation, inputs and measured conditions
are unchanged. A changed feature needs its own focused proof, not repetition of
every previous audit. Do not add audits of audits, repeat full-file inventories
after prose edits, or rerun runtime tests for documentation-only revisions.
Correctness, save integrity and demonstrated lifecycle failures block dependent
implementation until resolved.

Leak checks should assess owned-resource disposal, attached registrations,
retained-memory growth and repeatable trends. Exact equality of browser-internal
counters needs a specific diagnostic reason; it is not a universal completion
condition. Preserve older results and criteria as historical evidence.

This policy supersedes historical per-child exhaustive acceptance requirements
as a template for future work. Existing failures remain failures; carrying one
as a follow-up is not retrospective acceptance.

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
acceptance simply because a session starts.

## Documentation and source-control policy

Plans, tests, tools, compatibility modules and recovery evidence remain private
workspace inputs under the existing Git ignore policy. A minimal public clone
is not a development recovery procedure. Keep setup/build information in the
public README and current internal contracts in their owning documents.

Preserve original files and evidence. Keep new ignored recovery work recoverable
at completed recovery-package and substantial milestone checkpoints, and before
handoff/release. Verify that a private backup covers the changed inputs and can
be restored; record its location and verification in [BACKUP_CHECKPOINT.md](BACKUP_CHECKPOINT.md).
Reuse prior verified coverage for unchanged files. A routine child or prose edit
does not require a fresh full-workspace archive, full restore or preservation
sweep. This changes neither tracking policy nor authorization to upload content.

Earlier checkpoint prose is preserved in the linked history. Historical evidence
and reviews retain their recorded outcomes.
