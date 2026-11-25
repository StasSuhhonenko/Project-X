# BM1 documentation index

**Active next task: C13 browser acceptance, then C13c** (C13a/b station plans and construction implemented 2026-11-18). The
[master checkpoint](../../../docs/CONVERSION_PLAN.md#active-next-task) selects work;
the [module plan](../CONVERSION_PLAN.md) owns scope and the
[implementation backlog](IMPLEMENTATION_SEGMENTS.md) owns segment status and
acceptance. C2 visible timing remains user-deferred; four special systems remain
C16-owned. Delivered slices do not establish full-game parity.

## How this folder is organised

Documents are grouped by topic. File names are unchanged, so a name found in code,
provenance or evidence still identifies its document; only the folder changed on
2026-11-07 ([move log](../../../docs/history/DOCUMENT_MOVES_2026-11-07_BM1.json)).
“Live” documents are maintained contracts and plans; everything else is a bounded
record whose dated results apply to the code, environment and qualifications it
recorded. Historical “next” statements are inactive.

| Folder | Contents | Start with |
| --- | --- | --- |
| *(this folder)* | Live navigation: backlog, code map, content provenance | [IMPLEMENTATION_SEGMENTS](IMPLEMENTATION_SEGMENTS.md), [CODE_NAVIGATION](CODE_NAVIGATION.md), [CONTENT_PROVENANCE](CONTENT_PROVENANCE.md) |
| [features/](features/) | One folder per C-series gameplay family: plans, recovery, implementation and acceptance | the family's plan or contract (table below) |
| [ui/](ui/) | Original UI recovery, U-series reviews and the live UI plan. Kept flat because tools generate links between these files | [UI_RECREATION_PLAN](ui/UI_RECREATION_PLAN.md), [UI_SCREEN_INVENTORY](ui/UI_SCREEN_INVENTORY.md), [UI_COMPLETION_PLAN](ui/UI_COMPLETION_PLAN.md) |
| [foundation/](foundation/) | Delivered playable-slice references: flight, combat, repair, travel, saves | [SLICE_WALKTHROUGH](foundation/SLICE_WALKTHROUGH.md) |
| [presentation/](presentation/) | Viewport, placement, star and asset-layout recovery and reviews | [ASSET_LAYOUT](presentation/ASSET_LAYOUT.md), [VIEWPORT_FIDELITY_REVIEW](presentation/VIEWPORT_FIDELITY_REVIEW_2026-11-03.md) |
| [maintenance/](maintenance/) | Dated fixes and maintenance records outside the C-series | newest first |
| [history/](history/) | Superseded plans and handoffs | — |

### Feature families

| Family | Status | Start with |
| --- | --- | --- |
| C1 starts | Delivered families; remaining C1 in backlog | [C1A neutral start plan](features/c1-starts/C1A_NEUTRAL_START_PLAN.md) |
| C2 persistent systems | Delivered; visible timing deferred | [C2 persistent system plan](features/c2-systems/C2_PERSISTENT_SYSTEM_PLAN.md) |
| C3 ship acquisition | Delivered | [C3_SHIP_ACQUISITION](features/c3-ship-acquisition/C3_SHIP_ACQUISITION.md) |
| C4 weapons | Delivered | [C4 review](features/c4-weapons/C4_REVIEW_2026-11-05.md) |
| C5 equipment | Delivered | [C5_EQUIPMENT](features/c5-equipment/C5_EQUIPMENT.md) |
| C6 cargo and trade | Delivered | [C6_CARGO_TRADE](features/c6-cargo-trade/C6_CARGO_TRADE.md) |
| C7 progression | Delivered | [C7_PROGRESSION_PLAN](features/c7-progression/C7_PROGRESSION_PLAN.md) |
| C8 missions | Delivered | [C8_MISSIONS_PLAN](features/c8-missions/C8_MISSIONS_PLAN.md) |
| C10 NPC combat | Delivered 2026-11-09 (C10a–C10d) | [C10_NPC_COMBAT_PLAN](features/c10-npc-combat/C10_NPC_COMBAT_PLAN.md) |
| C11 fleet roster | Implemented 2026-11-10; browser-accepted 2026-11-16 | [C11_FLEET_PLAN](features/c11-fleet/C11_FLEET_PLAN.md), [recovery](features/c11-fleet/C11_FLEET_RECOVERY.md) |
| Post-C11 fidelity fixes (jump arrival, session seed) | Implemented 2026-11-10; browser-accepted 2026-11-16 | [POST_C11_FIDELITY_FIXES](maintenance/POST_C11_FIDELITY_FIXES.md) |
| Shields (recharge, impact flash) | Implemented 2026-11-10; browser-accepted 2026-11-17 | [SHIELDS](features/shields/SHIELDS.md) |
| C17a cheat console (UI-26) | Implemented 2026-11-12; browser-accepted 2026-11-16 (Enter submit added) | [C17A_CHEAT_CONSOLE_PLAN](features/c17a-cheat-console/C17A_CHEAT_CONSOLE_PLAN.md), [recovery](features/c17a-cheat-console/C17A_CHEAT_CONSOLE_RECOVERY.md) |
| Browser findings: cheat box, merchant separators, purchased-hull death/departure, ship control panels | Fixed 2026-11-12; browser-accepted 2026-11-16 | [BROWSER_FINDINGS_FIX_2026-11-12](maintenance/BROWSER_FINDINGS_FIX_2026-11-12.md) |
| Departure fixes: world runs under the player's warp-out; NPC warp-out restored | Fixed 2026-11-14; browser-accepted 2026-11-16 | [DEPARTURE_FIXES_2026-11-14](maintenance/DEPARTURE_FIXES_2026-11-14.md), [NPC_WARP_OUT](features/c10-npc-combat/NPC_WARP_OUT.md) |
| Slice provisions superseded: test Runabout removed, Vulcan planet, death timing (phaser kills now explode), purchase without freeze, allied minimap marker | Fixed 2026-11-14; browser-accepted 2026-11-16 (marker refixed) | [SLICE_PROVISIONS_2026-11-14](maintenance/SLICE_PROVISIONS_2026-11-14.md) |
| Browser acceptance pass: results; fleet minimap marker refix; Enter submits the cheat console | Recorded and fixed 2026-11-16; all fixes (1–4) browser-accepted 2026-11-17 | [BROWSER_ACCEPTANCE_2026-11-16](maintenance/BROWSER_ACCEPTANCE_2026-11-16.md) |
| C13a/b station plans and construction | Implemented 2026-11-18; browser acceptance pending | [C13_CONSTRUCTION_PLAN](features/c13-construction/C13_CONSTRUCTION_PLAN.md) |

Within a family, file prefixes still identify the child segment (for example
`C2C_`, `C1H_`); suffixes show the record type: `_PLAN` (plan),
`_RECOVERY` (source evidence), `_IMPLEMENTATION` (delivered contract),
`_REVIEW`/`_AUDIT`/`_BROWSER` (dated acceptance evidence).

## Evidence availability

Two U4e records referenced a pointer diagnostic that is absent from this local
workspace. Their historical path is retained as text in the [browser record](ui/U4E_BROWSER_2026-10-19.md)
and [map review](ui/U4E_MAP_REVIEW_2026-10-19.md); no replacement result is inferred.
The [original document snapshots](../../../docs/history/DOCUMENT_SNAPSHOTS_BEFORE_2026-11-06.json)
preserve their original link text. Dated JSON evidence under `analysis/` and
`docs/` keeps the document paths it recorded; use the move log to map them.

## Full listing

### features/c1-starts/

- [C1A_INITIALIZATION_AUDIT](features/c1-starts/C1A_INITIALIZATION_AUDIT.md)
- [C1A_NEUTRAL_START_PLAN](features/c1-starts/C1A_NEUTRAL_START_PLAN.md)
- [C1A_NEUTRAL_WORLD_RECOVERY](features/c1-starts/C1A_NEUTRAL_WORLD_RECOVERY.md)
- [C1A_REVIEW_2026-10-21](features/c1-starts/C1A_REVIEW_2026-10-21.md)
- [C1B_BROWSER_2026-10-21](features/c1-starts/C1B_BROWSER_2026-10-21.md)
- [C1B_KLINGON_START_PLAN](features/c1-starts/C1B_KLINGON_START_PLAN.md)
- [C1B_PRESENTATION_AUDIT](features/c1-starts/C1B_PRESENTATION_AUDIT.md)
- [C1B_REVIEW_2026-10-21](features/c1-starts/C1B_REVIEW_2026-10-21.md)
- [C1B_SOURCE_ACCEPTANCE_AUDIT_2026-10-21](features/c1-starts/C1B_SOURCE_ACCEPTANCE_AUDIT_2026-10-21.md)
- [C1B_WORLD_RECOVERY](features/c1-starts/C1B_WORLD_RECOVERY.md)
- [C1C_BROWSER_2026-10-21](features/c1-starts/C1C_BROWSER_2026-10-21.md)
- [C1C_FERENGI_START_PLAN](features/c1-starts/C1C_FERENGI_START_PLAN.md)
- [C1C_PRESENTATION_AUDIT](features/c1-starts/C1C_PRESENTATION_AUDIT.md)
- [C1C_REVIEW_2026-10-21](features/c1-starts/C1C_REVIEW_2026-10-21.md)
- [C1C_SOURCE_ACCEPTANCE_AUDIT_2026-10-21](features/c1-starts/C1C_SOURCE_ACCEPTANCE_AUDIT_2026-10-21.md)
- [C1C_WORLD_RECOVERY](features/c1-starts/C1C_WORLD_RECOVERY.md)
- [C1D_BROWSER_2026-10-22](features/c1-starts/C1D_BROWSER_2026-10-22.md)
- [C1D_PRESENTATION_AUDIT](features/c1-starts/C1D_PRESENTATION_AUDIT.md)
- [C1D_REVIEW_2026-10-22](features/c1-starts/C1D_REVIEW_2026-10-22.md)
- [C1D_ROMULAN_START_PLAN](features/c1-starts/C1D_ROMULAN_START_PLAN.md)
- [C1D_SOURCE_ACCEPTANCE_AUDIT_2026-10-22](features/c1-starts/C1D_SOURCE_ACCEPTANCE_AUDIT_2026-10-22.md)
- [C1D_WORLD_RECOVERY](features/c1-starts/C1D_WORLD_RECOVERY.md)
- [C1E_BROWSER_2026-10-22](features/c1-starts/C1E_BROWSER_2026-10-22.md)
- [C1E_CARDASSIAN_START_PLAN](features/c1-starts/C1E_CARDASSIAN_START_PLAN.md)
- [C1E_PRESENTATION_AUDIT](features/c1-starts/C1E_PRESENTATION_AUDIT.md)
- [C1E_REVIEW_2026-10-22](features/c1-starts/C1E_REVIEW_2026-10-22.md)
- [C1E_SOURCE_ACCEPTANCE_AUDIT_2026-10-22](features/c1-starts/C1E_SOURCE_ACCEPTANCE_AUDIT_2026-10-22.md)
- [C1E_WORLD_RECOVERY](features/c1-starts/C1E_WORLD_RECOVERY.md)
- [C1F_BROWSER_2026-10-24](features/c1-starts/C1F_BROWSER_2026-10-24.md)
- [C1F_CARDASSIAN_GUL_START_PLAN](features/c1-starts/C1F_CARDASSIAN_GUL_START_PLAN.md)
- [C1F_PRESENTATION_AUDIT](features/c1-starts/C1F_PRESENTATION_AUDIT.md)
- [C1F_REVIEW_2026-10-24](features/c1-starts/C1F_REVIEW_2026-10-24.md)
- [C1F_SOURCE_ACCEPTANCE_AUDIT_2026-10-24](features/c1-starts/C1F_SOURCE_ACCEPTANCE_AUDIT_2026-10-24.md)
- [C1F_WORLD_RECOVERY](features/c1-starts/C1F_WORLD_RECOVERY.md)
- [C1G_BROWSER_2026-10-24](features/c1-starts/C1G_BROWSER_2026-10-24.md)
- [C1G_DOMINION_START_PLAN](features/c1-starts/C1G_DOMINION_START_PLAN.md)
- [C1G_PRESENTATION_AUDIT](features/c1-starts/C1G_PRESENTATION_AUDIT.md)
- [C1G_REVIEW_2026-10-24](features/c1-starts/C1G_REVIEW_2026-10-24.md)
- [C1G_SOURCE_ACCEPTANCE_AUDIT_2026-10-24](features/c1-starts/C1G_SOURCE_ACCEPTANCE_AUDIT_2026-10-24.md)
- [C1G_WORLD_RECOVERY](features/c1-starts/C1G_WORLD_RECOVERY.md)
- [C1H_BORG_START_PLAN](features/c1-starts/C1H_BORG_START_PLAN.md)
- [C1H_BROWSER_2026-10-24](features/c1-starts/C1H_BROWSER_2026-10-24.md)
- [C1H_PRESENTATION_AUDIT](features/c1-starts/C1H_PRESENTATION_AUDIT.md)
- [C1H_REVIEW_2026-10-24](features/c1-starts/C1H_REVIEW_2026-10-24.md)
- [C1H_SOURCE_ACCEPTANCE_AUDIT_2026-10-24](features/c1-starts/C1H_SOURCE_ACCEPTANCE_AUDIT_2026-10-24.md)
- [C1H_WORLD_RECOVERY](features/c1-starts/C1H_WORLD_RECOVERY.md)
- [C1I_BROWSER_2026-10-24](features/c1-starts/C1I_BROWSER_2026-10-24.md)
- [C1I_EDITABLE_START_PLAN](features/c1-starts/C1I_EDITABLE_START_PLAN.md)
- [C1I_EDITABLE_START_RECOVERY](features/c1-starts/C1I_EDITABLE_START_RECOVERY.md)
- [C1I_PRESENTATION_AUDIT](features/c1-starts/C1I_PRESENTATION_AUDIT.md)
- [C1I_REFERENCE_RETENTION_2026-10-24](features/c1-starts/C1I_REFERENCE_RETENTION_2026-10-24.md)
- [C1I_REVIEW_2026-10-24](features/c1-starts/C1I_REVIEW_2026-10-24.md)
- [C1I_SOURCE_ACCEPTANCE_AUDIT_2026-10-24](features/c1-starts/C1I_SOURCE_ACCEPTANCE_AUDIT_2026-10-24.md)
- [VULCAN_START](features/c1-starts/VULCAN_START.md)

### features/c2-systems/

- [C2A_PERSISTENT_SYSTEM_DESIGN_2026-10-25](features/c2-systems/C2A_PERSISTENT_SYSTEM_DESIGN_2026-10-25.md)
- [C2A_REVIEW_2026-10-25](features/c2-systems/C2A_REVIEW_2026-10-25.md)
- [C2A_RUNTIME_AUDIT_2026-10-25](features/c2-systems/C2A_RUNTIME_AUDIT_2026-10-25.md)
- [C2B_CONSUMER_REVIEW_2026-10-25](features/c2-systems/C2B_CONSUMER_REVIEW_2026-10-25.md)
- [C2B_REVIEW_2026-10-25](features/c2-systems/C2B_REVIEW_2026-10-25.md)
- [C2B_STATION_COMBAT_RECOVERY_2026-10-25](features/c2-systems/C2B_STATION_COMBAT_RECOVERY_2026-10-25.md)
- [C2B_STATION_LIFECYCLE_PLAN](features/c2-systems/C2B_STATION_LIFECYCLE_PLAN.md)
- [C2B_STATION_RECORDS_RECOVERY_2026-10-25](features/c2-systems/C2B_STATION_RECORDS_RECOVERY_2026-10-25.md)
- [C2C_ACCEPTANCE_FOLLOWUP_REVIEW_2026-10-25](features/c2-systems/C2C_ACCEPTANCE_FOLLOWUP_REVIEW_2026-10-25.md)
- [C2C_BROWSER_PERFORMANCE_2026-10-25](features/c2-systems/C2C_BROWSER_PERFORMANCE_2026-10-25.md)
- [C2C_DEFENDER_BROWSER_2026-10-25](features/c2-systems/C2C_DEFENDER_BROWSER_2026-10-25.md)
- [C2C_FIDELITY_LEDGER](features/c2-systems/C2C_FIDELITY_LEDGER.md)
- [C2C_FOREGROUND_ACCEPTANCE_2026-10-26](features/c2-systems/C2C_FOREGROUND_ACCEPTANCE_2026-10-26.md)
- [C2C_FOREGROUND_REVIEW_2026-10-26](features/c2-systems/C2C_FOREGROUND_REVIEW_2026-10-26.md)
- [C2C_IMPLEMENTATION](features/c2-systems/C2C_IMPLEMENTATION.md)
- [C2C_LISTENER_DIAGNOSTIC_2026-10-25](features/c2-systems/C2C_LISTENER_DIAGNOSTIC_2026-10-25.md)
- [C2C_LISTENER_GATE_REVIEW_2026-10-25](features/c2-systems/C2C_LISTENER_GATE_REVIEW_2026-10-25.md)
- [C2C_LISTENER_RUNTIME_AUDIT_2026-10-25](features/c2-systems/C2C_LISTENER_RUNTIME_AUDIT_2026-10-25.md)
- [C2C_LIVE_CYCLES_2026-10-25](features/c2-systems/C2C_LIVE_CYCLES_2026-10-25.md)
- [C2C_PRESENTATION_2026-10-25](features/c2-systems/C2C_PRESENTATION_2026-10-25.md)
- [C2C_REVIEW_2026-10-25](features/c2-systems/C2C_REVIEW_2026-10-25.md)
- [C2C_STATION_PERSISTENCE_PLAN](features/c2-systems/C2C_STATION_PERSISTENCE_PLAN.md)
- [C2D_BROWSER_ACCEPTANCE_2026-10-27](features/c2-systems/C2D_BROWSER_ACCEPTANCE_2026-10-27.md)
- [C2D_FIDELITY_LEDGER](features/c2-systems/C2D_FIDELITY_LEDGER.md)
- [C2D_IMPLEMENTATION](features/c2-systems/C2D_IMPLEMENTATION.md)
- [C2D_INDEPENDENT_ACCEPTANCE_2026-10-26](features/c2-systems/C2D_INDEPENDENT_ACCEPTANCE_2026-10-26.md)
- [C2D_LAST_STATION_RECOVERY_2026-10-26](features/c2-systems/C2D_LAST_STATION_RECOVERY_2026-10-26.md)
- [C2D_PRESENTATION_IMPLEMENTATION](features/c2-systems/C2D_PRESENTATION_IMPLEMENTATION.md)
- [C2D_PRESERVATION_2026-10-27](features/c2-systems/C2D_PRESERVATION_2026-10-27.md)
- [C2D_REVIEW_2026-10-27](features/c2-systems/C2D_REVIEW_2026-10-27.md)
- [C2D_VULCAN_LAST_STATION_PLAN](features/c2-systems/C2D_VULCAN_LAST_STATION_PLAN.md)
- [C2E_EARTH_COMPOSITION_AND_ART_2026-10-29](features/c2-systems/C2E_EARTH_COMPOSITION_AND_ART_2026-10-29.md)
- [C2E_EARTH_LIFECYCLE_RECOVERY_2026-10-29](features/c2-systems/C2E_EARTH_LIFECYCLE_RECOVERY_2026-10-29.md)
- [C2E_EARTH_STATION_PLAN](features/c2-systems/C2E_EARTH_STATION_PLAN.md)
- [C2E_INDEPENDENT_DESIGN_AUDIT_2026-10-29](features/c2-systems/C2E_INDEPENDENT_DESIGN_AUDIT_2026-10-29.md)
- [C2E_REVIEW_2026-10-29](features/c2-systems/C2E_REVIEW_2026-10-29.md)
- [C2E_SCOPE_AND_CONTINUATION_DESIGN_2026-10-29](features/c2-systems/C2E_SCOPE_AND_CONTINUATION_DESIGN_2026-10-29.md)
- [C2F_FOREGROUND_REVIEW_2026-10-29](features/c2-systems/C2F_FOREGROUND_REVIEW_2026-10-29.md)
- [C2F_LIFECYCLE_IMPLEMENTATION](features/c2-systems/C2F_LIFECYCLE_IMPLEMENTATION.md)
- [C2F_PRESENTATION_IMPLEMENTATION](features/c2-systems/C2F_PRESENTATION_IMPLEMENTATION.md)
- [C2F_RENDER_SCHEDULING_AUDIT_2026-10-29](features/c2-systems/C2F_RENDER_SCHEDULING_AUDIT_2026-10-29.md)
- [C2F_REVIEW_2026-10-29](features/c2-systems/C2F_REVIEW_2026-10-29.md)
- [C2F_SCOPE_AUDIT_2026-10-29](features/c2-systems/C2F_SCOPE_AUDIT_2026-10-29.md)
- [C2F_VISUAL_REVIEW_2026-10-29](features/c2-systems/C2F_VISUAL_REVIEW_2026-10-29.md)
- [C2G_ALIAS_SOURCE_RECOVERY_2026-11-01](features/c2-systems/C2G_ALIAS_SOURCE_RECOVERY_2026-11-01.md)
- [C2G_EARTH_ALIAS_DESIGN_PLAN](features/c2-systems/C2G_EARTH_ALIAS_DESIGN_PLAN.md)
- [C2G_MODULE_IMPLEMENTATION](features/c2-systems/C2G_MODULE_IMPLEMENTATION.md)
- [C2G_OWNERSHIP_DECISION_2026-11-01](features/c2-systems/C2G_OWNERSHIP_DECISION_2026-11-01.md)
- [C2G_REVIEW_2026-11-01](features/c2-systems/C2G_REVIEW_2026-11-01.md)
- [C2G_REVIEW_NOTES_2026-11-01](features/c2-systems/C2G_REVIEW_NOTES_2026-11-01.md)
- [C2_ALIAS_BATCH_PLAN_2026-11-02](features/c2-systems/C2_ALIAS_BATCH_PLAN_2026-11-02.md)
- [C2_ALIAS_BATCH_REVIEW_2026-11-02](features/c2-systems/C2_ALIAS_BATCH_REVIEW_2026-11-02.md)
- [C2_ALIAS_CONTENT_BATCH](features/c2-systems/C2_ALIAS_CONTENT_BATCH.md)
- [C2_BATCH_SOURCE_MATRIX_2026-11-02](features/c2-systems/C2_BATCH_SOURCE_MATRIX_2026-11-02.md)
- [C2_INTEGRATION_REVIEW_2026-11-02](features/c2-systems/C2_INTEGRATION_REVIEW_2026-11-02.md)
- [C2_ORDINARY_BATCH_2026-11-02](features/c2-systems/C2_ORDINARY_BATCH_2026-11-02.md)
- [C2_ORDINARY_CONTENT_BATCH](features/c2-systems/C2_ORDINARY_CONTENT_BATCH.md)
- [C2_ORDINARY_REVIEW_2026-11-02](features/c2-systems/C2_ORDINARY_REVIEW_2026-11-02.md)
- [C2_PERSISTENT_SYSTEM_PLAN](features/c2-systems/C2_PERSISTENT_SYSTEM_PLAN.md)
- [C2_SAVE_HARDENING_2026-11-02](features/c2-systems/C2_SAVE_HARDENING_2026-11-02.md)
- [C2_UNOWNED_REVIEW_2026-11-02](features/c2-systems/C2_UNOWNED_REVIEW_2026-11-02.md)
- [C2_UNOWNED_WORLDS_2026-11-02](features/c2-systems/C2_UNOWNED_WORLDS_2026-11-02.md)

### features/c3-ship-acquisition/

- [C3_SHIP_ACQUISITION](features/c3-ship-acquisition/C3_SHIP_ACQUISITION.md)

### features/c4-weapons/

- [C4_REVIEW_2026-11-05](features/c4-weapons/C4_REVIEW_2026-11-05.md)
- [C4_SOURCE_CADENCE_2026-11-04](features/c4-weapons/C4_SOURCE_CADENCE_2026-11-04.md)
- [C4_SPECIAL_EFFECTS](features/c4-weapons/C4_SPECIAL_EFFECTS.md)
- [C4_WEAPON_FAMILIES](features/c4-weapons/C4_WEAPON_FAMILIES.md)

### features/c5-equipment/

- [C5_EQUIPMENT](features/c5-equipment/C5_EQUIPMENT.md)

### features/c6-cargo-trade/

- [C6_CARGO_TRADE](features/c6-cargo-trade/C6_CARGO_TRADE.md)

### features/c7-progression/

- [C7_PROGRESSION_PLAN](features/c7-progression/C7_PROGRESSION_PLAN.md)
- [C7_PROGRESSION_RECOVERY](features/c7-progression/C7_PROGRESSION_RECOVERY.md)

### features/c8-missions/

- [C8_MISSIONS_PLAN](features/c8-missions/C8_MISSIONS_PLAN.md)
- [C8_MISSIONS_RECOVERY](features/c8-missions/C8_MISSIONS_RECOVERY.md)

### ui/

- [U3_ENTRY_BROWSER_2026-10-14](ui/U3_ENTRY_BROWSER_2026-10-14.md)
- [U3_ENTRY_PRESENTATION](ui/U3_ENTRY_PRESENTATION.md)
- [U3_ENTRY_REVIEW_2026-10-14](ui/U3_ENTRY_REVIEW_2026-10-14.md)
- [U3_HUD_BROWSER_2026-10-15](ui/U3_HUD_BROWSER_2026-10-15.md)
- [U3_HUD_PRESENTATION](ui/U3_HUD_PRESENTATION.md)
- [U3_HUD_REVIEW_2026-10-15](ui/U3_HUD_REVIEW_2026-10-15.md)
- [U4A_BROWSER_2026-10-19](ui/U4A_BROWSER_2026-10-19.md)
- [U4A_TACTICAL_PRESENTATION](ui/U4A_TACTICAL_PRESENTATION.md)
- [U4A_TACTICAL_REVIEW_2026-10-19](ui/U4A_TACTICAL_REVIEW_2026-10-19.md)
- [U4B_BROWSER_2026-10-19](ui/U4B_BROWSER_2026-10-19.md)
- [U4B_CONTACT_PRESENTATION](ui/U4B_CONTACT_PRESENTATION.md)
- [U4B_CONTACT_REVIEW_2026-10-19](ui/U4B_CONTACT_REVIEW_2026-10-19.md)
- [U4C_BROWSER_2026-10-19](ui/U4C_BROWSER_2026-10-19.md)
- [U4C_REPAIR_PRESENTATION](ui/U4C_REPAIR_PRESENTATION.md)
- [U4C_REPAIR_REVIEW_2026-10-19](ui/U4C_REPAIR_REVIEW_2026-10-19.md)
- [U4D_BROWSER_2026-10-19](ui/U4D_BROWSER_2026-10-19.md)
- [U4D_PURCHASE_PRESENTATION](ui/U4D_PURCHASE_PRESENTATION.md)
- [U4D_PURCHASE_REVIEW_2026-10-19](ui/U4D_PURCHASE_REVIEW_2026-10-19.md)
- [U4E_BROWSER_2026-10-19](ui/U4E_BROWSER_2026-10-19.md)
- [U4E_MAP_PRESENTATION](ui/U4E_MAP_PRESENTATION.md)
- [U4E_MAP_REVIEW_2026-10-19](ui/U4E_MAP_REVIEW_2026-10-19.md)
- [U4F_TRAVEL_PRESENTATION](ui/U4F_TRAVEL_PRESENTATION.md)
- [U4F_TRAVEL_REVIEW_2026-10-20](ui/U4F_TRAVEL_REVIEW_2026-10-20.md)
- [U4G_TERMINAL_PRESENTATION](ui/U4G_TERMINAL_PRESENTATION.md)
- [U4G_TERMINAL_REVIEW_2026-10-20](ui/U4G_TERMINAL_REVIEW_2026-10-20.md)
- [U4H_BM1_BROWSER_2026-10-21](ui/U4H_BM1_BROWSER_2026-10-21.md)
- [U4H_SLICE_REVIEW_2026-10-21](ui/U4H_SLICE_REVIEW_2026-10-21.md)
- [U4H_SOURCE_ACCEPTANCE_AUDIT_2026-10-21](ui/U4H_SOURCE_ACCEPTANCE_AUDIT_2026-10-21.md)
- [UI_BASELINE_COVERAGE_AUDIT](ui/UI_BASELINE_COVERAGE_AUDIT.md)
- [UI_BUG_TRIAGE_2026-11-03](ui/UI_BUG_TRIAGE_2026-11-03.md)
- [UI_COMMUNICATION_ARTWORK_RECOVERY](ui/UI_COMMUNICATION_ARTWORK_RECOVERY.md)
- [UI_COMPLETION_PLAN](ui/UI_COMPLETION_PLAN.md)
- [UI_CONSTRUCTION_INTERACTION_RECOVERY](ui/UI_CONSTRUCTION_INTERACTION_RECOVERY.md)
- [UI_EXCEPTIONAL_BASELINE_RECOVERY](ui/UI_EXCEPTIONAL_BASELINE_RECOVERY.md)
- [UI_FLASH_COMPONENT_RECOVERY](ui/UI_FLASH_COMPONENT_RECOVERY.md)
- [UI_FLEET_ARTWORK_RECOVERY](ui/UI_FLEET_ARTWORK_RECOVERY.md)
- [UI_FLEET_INTERACTION_RECOVERY](ui/UI_FLEET_INTERACTION_RECOVERY.md)
- [UI_GAMEPLAY_BASELINE_RECOVERY](ui/UI_GAMEPLAY_BASELINE_RECOVERY.md)
- [UI_GAMEPLAY_SHELL_RECOVERY](ui/UI_GAMEPLAY_SHELL_RECOVERY.md)
- [UI_HANDLER_COVERAGE](ui/UI_HANDLER_COVERAGE.md)
- [UI_HUD_REMAINING_ARTWORK](ui/UI_HUD_REMAINING_ARTWORK.md)
- [UI_IMPLEMENTATION_HANDOFF](ui/UI_IMPLEMENTATION_HANDOFF.md)
- [UI_INSTRUCTIONS_FRAME_RECOVERY](ui/UI_INSTRUCTIONS_FRAME_RECOVERY.md)
- [UI_INVENTORY_AUDIT](ui/UI_INVENTORY_AUDIT.md)
- [UI_KEYBOARD_ROUTE_RECOVERY](ui/UI_KEYBOARD_ROUTE_RECOVERY.md)
- [UI_KEYS_INTERACTION_RECOVERY](ui/UI_KEYS_INTERACTION_RECOVERY.md)
- [UI_LAYOUT_BASELINE](ui/UI_LAYOUT_BASELINE.md)
- [UI_MAIN_MENU_COMPOSITION](ui/UI_MAIN_MENU_COMPOSITION.md)
- [UI_MENU_FONT_MEASUREMENTS](ui/UI_MENU_FONT_MEASUREMENTS.md)
- [UI_MENU_FRAME_RECOVERY](ui/UI_MENU_FRAME_RECOVERY.md)
- [UI_MENU_GLYPH_BASELINE_RECOVERY](ui/UI_MENU_GLYPH_BASELINE_RECOVERY.md)
- [UI_MERCHANT_TRANSACTION_RECOVERY](ui/UI_MERCHANT_TRANSACTION_RECOVERY.md)
- [UI_NAVIGATION_RECOVERY](ui/UI_NAVIGATION_RECOVERY.md)
- [UI_OUTCOME_BRANCH_RECOVERY](ui/UI_OUTCOME_BRANCH_RECOVERY.md)
- [UI_PAGE2_LAYER_RECOVERY](ui/UI_PAGE2_LAYER_RECOVERY.md)
- [UI_PLANET_MISSION_RECOVERY](ui/UI_PLANET_MISSION_RECOVERY.md)
- [UI_RECOVERY_RESUME_2026-10-11](ui/UI_RECOVERY_RESUME_2026-10-11.md)
- [UI_RECOVERY_REVIEW_2026-10-05](ui/UI_RECOVERY_REVIEW_2026-10-05.md)
- [UI_RECOVERY_REVIEW_2026-10-08](ui/UI_RECOVERY_REVIEW_2026-10-08.md)
- [UI_RECOVERY_REVIEW_2026-10-10](ui/UI_RECOVERY_REVIEW_2026-10-10.md)
- [UI_RECOVERY_REVIEW_2026-10-10_CONSTRUCTION_MAP](ui/UI_RECOVERY_REVIEW_2026-10-10_CONSTRUCTION_MAP.md)
- [UI_RECOVERY_REVIEW_2026-10-12](ui/UI_RECOVERY_REVIEW_2026-10-12.md)
- [UI_RECOVERY_REVIEW_2026-10-14](ui/UI_RECOVERY_REVIEW_2026-10-14.md)
- [UI_RECOVERY_SAVEPOINT_2026-10-11](ui/UI_RECOVERY_SAVEPOINT_2026-10-11.md)
- [UI_RECREATION_PLAN](ui/UI_RECREATION_PLAN.md)
- [UI_REPAIR_ARTWORK_RECOVERY](ui/UI_REPAIR_ARTWORK_RECOVERY.md)
- [UI_SCENE_CONTAINER_RECOVERY](ui/UI_SCENE_CONTAINER_RECOVERY.md)
- [UI_SCREEN_INVENTORY](ui/UI_SCREEN_INVENTORY.md)
- [UI_START_EXECUTION_REVIEW](ui/UI_START_EXECUTION_REVIEW.md)
- [UI_START_VARIANTS_RECOVERY](ui/UI_START_VARIANTS_RECOVERY.md)
- [UI_TARGET_MAP_ARTWORK_RECOVERY](ui/UI_TARGET_MAP_ARTWORK_RECOVERY.md)
- [UI_TEXT_CONTROL_RECOVERY](ui/UI_TEXT_CONTROL_RECOVERY.md)

### foundation/

- [0001-fixed-step-navigation](foundation/0001-fixed-step-navigation.md)
- [BROWSER_SAVE_STORAGE](foundation/BROWSER_SAVE_STORAGE.md)
- [DESTRUCTION_DEATH_FLOW](foundation/DESTRUCTION_DEATH_FLOW.md)
- [FIRST_PLANET](foundation/FIRST_PLANET.md)
- [FIRST_STATION](foundation/FIRST_STATION.md)
- [LOCAL_WARP_ENERGY](foundation/LOCAL_WARP_ENERGY.md)
- [MAP_DESTINATION_SELECTION](foundation/MAP_DESTINATION_SELECTION.md)
- [MERCHANT_PURCHASE](foundation/MERCHANT_PURCHASE.md)
- [NAVIGATION](foundation/NAVIGATION.md)
- [PRIMARY_HIT_RESOLUTION](foundation/PRIMARY_HIT_RESOLUTION.md)
- [PRIMARY_PHASER_COMMAND](foundation/PRIMARY_PHASER_COMMAND.md)
- [REPAIR_INTERACTION](foundation/REPAIR_INTERACTION.md)
- [SAVE_SNAPSHOT](foundation/SAVE_SNAPSHOT.md)
- [SAVE_UI_FILE_TRANSFER](foundation/SAVE_UI_FILE_TRANSFER.md)
- [SEEDED_RUNABOUT](foundation/SEEDED_RUNABOUT.md)
- [SLICE_WALKTHROUGH](foundation/SLICE_WALKTHROUGH.md)
- [TARGET_SELECTION](foundation/TARGET_SELECTION.md)
- [TRAVEL_SCENE_AUDIO](foundation/TRAVEL_SCENE_AUDIO.md)
- [TRAVEL_SIMULATION](foundation/TRAVEL_SIMULATION.md)

### presentation/

- [ASSET_LAYOUT](presentation/ASSET_LAYOUT.md)
- [EARTH_PLACEMENT_RECOVERY](presentation/EARTH_PLACEMENT_RECOVERY.md)
- [EARTH_VISUAL_RECOVERY](presentation/EARTH_VISUAL_RECOVERY.md)
- [MAP_PLACEMENT_RECOVERY](presentation/MAP_PLACEMENT_RECOVERY.md)
- [PHASER_VISUAL_RECOVERY](presentation/PHASER_VISUAL_RECOVERY.md)
- [REFERENCE_UI_PLAYBACK](presentation/REFERENCE_UI_PLAYBACK.md)
- [SKY_LEGEND_REVIEW_2026-11-03](presentation/SKY_LEGEND_REVIEW_2026-11-03.md)
- [STAR_MOTION_REVIEW_2026-11-03](presentation/STAR_MOTION_REVIEW_2026-11-03.md)
- [STAR_ZOOM_RECOVERY](presentation/STAR_ZOOM_RECOVERY.md)
- [VIEWPORT_FIDELITY_REVIEW_2026-11-03](presentation/VIEWPORT_FIDELITY_REVIEW_2026-11-03.md)

### maintenance/

- [BROWSER_FINDINGS_FIX_2026-11-12](maintenance/BROWSER_FINDINGS_FIX_2026-11-12.md)
- [LOADING_PREPARATION_2026-11-06](maintenance/LOADING_PREPARATION_2026-11-06.md)
- [LOADING_TRANSITIONS_FIX_PLAN](maintenance/LOADING_TRANSITIONS_FIX_PLAN.md)
- [MAINTENANCE_2026-10-30](maintenance/MAINTENANCE_2026-10-30.md)
- [PLANET_RESOURCE_ARTWORK_FIX_2026-11-07](maintenance/PLANET_RESOURCE_ARTWORK_FIX_2026-11-07.md)
- [POST_C10_FIDELITY_FIX_PLAN](maintenance/POST_C10_FIDELITY_FIX_PLAN.md)
- C11 handoffs: [engine](maintenance/C11E_ENGINE_HANDOFF_2026-11-10.md), [BM1 rules](maintenance/C11R_RULES_HANDOFF_2026-11-10.md), [BM1 UI](maintenance/C11U_UI_HANDOFF_2026-11-10.md)
- [WARP_DEPARTURE_FIX_2026-11-06](maintenance/WARP_DEPARTURE_FIX_2026-11-06.md)

### history/

- [IMPLEMENTATION_HISTORY](history/IMPLEMENTATION_HISTORY.md)
- [UI_IMPLEMENTATION_HANDOFF_HISTORY_2026-10-30](history/UI_IMPLEMENTATION_HANDOFF_HISTORY_2026-10-30.md)
- [UI_RECREATION_PLAN_HISTORY_2026-10-30](history/UI_RECREATION_PLAN_HISTORY_2026-10-30.md)
