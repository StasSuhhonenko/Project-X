/**
 * Source defaults of the four UI-13 Power Distribution (OPS) allocations.
 *
 * Provenance: `loadplayer()` in `analysis/bm1/scripts/Page-1-25841.as:38-41`
 * sets `opsreserves`, `opsengines`, `opsweapons` and `opsshields` to 50 for
 * a fresh ship. Saves persist the four values (`:1324`, `:1360-1363`).
 *
 * The OPS controls are not ported yet (functional owner C17), so every consumer
 * reads these fixed defaults: the energy recharge (Reserves), shield recharge
 * (Shields) and the UI-13 bar covers (all four). This module is the single
 * definition; when C17 adds live allocation state it replaces these reads.
 * Units: percent of the slider range, 0..100.
 */
export const INITIAL_POWER_ALLOCATION_PERCENT = Object.freeze({
  reserves: 50,
  engines: 50,
  weapons: 50,
  shields: 50,
});
