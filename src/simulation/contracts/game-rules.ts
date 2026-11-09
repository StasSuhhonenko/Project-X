/**
 * Trusted module behavior injected by the composition root. Modules receive
 * immutable state and definitions, never a store setter, renderer, or browser.
 * One call advances one module-defined tick and must return a frozen snapshot.
 * This is a code extension contract, not a sandbox for untrusted downloads.
 */
import type { PlayerControls } from '../commands/player-controls';
import type { DurabilityComponent, FlightMode, PlayerNotice, Position } from '../model/entity-components';
import type { NpcGeneration, StationMembership, WorldLifecycle } from '../model/lifecycle-state';
import type {
  NpcCombatState,
  NpcMovementState,
  NpcTargetState,
  NpcTickResult,
  StartingNpcPlacement,
} from '../model/npc-state';
import type { PlayerMovementState } from '../model/player-state';
import type { ProgressionState } from '../model/progression-state';
import type {
  CargoMarketContext,
  CargoMarketResult,
  CargoTransferContext,
  CargoTransferPlan,
  ResourceSaleContext,
  ResourceSaleQuote,
} from './cargo-trade';
import type { VisitEncounterContext, VisitEncounterResult } from './encounter-rules';
import type { EquipmentMarket, EquipmentMarketContext, EquipmentPrice, EquipmentPriceContext } from './equipment-rules';
import type {
  LifecycleHitContext,
  LifecycleHitResult,
  StationHitContext,
  StationMembershipContext,
  StationMembershipPolicyRecord,
} from './lifecycle-rules';
import type { MissionRules } from './mission-rules';
import type { NpcDecision, NpcDecisionContext, NpcPlayerShotContext, NpcTargetResponse } from './npc-decision-rules';
import type { ProgressionEvent, ProgressionResult } from './progression-rules';
import type { ProjectileFlightDefinition, ProjectileMotion, ProjectileMotionContext } from './projectile-rules';
import type { ResourcePurchaseContext, ResourcePurchaseResult } from './resource-purchase';
import type { SpecialEffectSlotsContext, SpecialWeaponDefinition } from './special-weapon-rules';
import type { VesselPurchaseApproval, VesselPurchaseContext } from './vessel-purchase';

/** The reviewed rule contract version accepted by the shared engine. */
export const GAME_RULES_API_VERSION = 27 as const;

export interface PlayerVesselCapabilities {
  /** Current owned inventory for module-derived passive capabilities. */
  readonly ownedWeaponIds?: readonly (number | null)[];
  readonly maximumSpeedPerFrame: number;
  readonly turnDegreesPerFrame: number;
  readonly cargoCapacity: number;
  readonly fuelEfficiency: number;
  readonly startingWeaponIds: readonly (number | null)[];
}

export interface StartingNpcContext {
  readonly encounterId: string;
  readonly seed: number;
  readonly playerPosition: Position;
  readonly targetCandidates: readonly NpcTargetState[];
}

export interface NpcNavigationCapabilities {
  readonly maximumSpeedPerFrame: number;
  readonly turnDegreesPerFrame: number;
  /** Current hull+shields as percent of maxima; omitted by isolated fixtures. */
  readonly strengthPercent?: number;
}

export interface PrimaryFireContext {
  readonly player: Readonly<{
    position: Position;
    energy: number;
    repairing: boolean;
    flightMode: FlightMode;
  }>;
  readonly vessel: Readonly<{ sizeClass: number }>;
  readonly weapon: Readonly<{
    id: number;
    energyCost: number;
    cooldownFrames: number;
  }>;
  readonly target: Readonly<{ position: Position; kind?: 'station' | 'npc-ship'; stationRecordId?: string }> | null;
  readonly cameraZoom: number;
}

export interface PrimaryFireApproval {
  /** Shared orchestration decrements this once at the end of the accepting tick. */
  readonly cooldownFramesBeforeEndOfTick: number;
}

/** Focused capabilities needed to turn one accepted beam into durability. */
export interface PrimaryHitContext {
  readonly attacker: Readonly<{ sizeClass: number }>;
  readonly weapon: Readonly<{ id: number; baseDamage: number }>;
  readonly target: Readonly<{ condition: DurabilityComponent }>;
}

/** Focused, immutable facts a module may use to quote one repair service. */
export interface RepairStartContext {
  readonly player: Readonly<{
    position: Position;
    hull: number;
    shields: number;
    repairing: boolean;
    resources: Readonly<Record<string, number>>;
  }>;
  readonly vessel: Readonly<{ maximumHull: number; maximumShields: number }>;
  readonly planet: Readonly<{ position: Position; populationBillions: number }>;
  readonly cameraZoom: number;
}

/** A module-approved, engine-validated debit. */
export interface RepairStartApproval {
  readonly resourceId: string;
  readonly cost: number;
}

/** Focused state used by one fixed repair-progress step. */
export interface RepairTickContext {
  readonly player: Readonly<{
    hull: number;
    shields: number;
    repairing: boolean;
    notice: PlayerNotice | null;
  }>;
  readonly vessel: Readonly<{ maximumHull: number; maximumShields: number }>;
}

export interface RepairTickResult extends DurabilityComponent {
  readonly repairing: boolean;
  readonly notice: PlayerNotice | null;
}

/** Focused authored route inputs; positions are map units, not world positions. */
export interface TravelEstimateContext {
  readonly origin: Position;
  readonly destination: Position;
  readonly vessel: Readonly<{ fuelEfficiency: number }>;
}

/** A displayed estimate; the travel feature revalidates before committing departure. */
export interface TravelEstimate {
  readonly durationDays: number;
  /** Whole days committed to the calendar on departure. */
  readonly advanceDays: number;
  readonly fuelResourceId: string;
  readonly fuelUnits: number;
}

/** A module may reject source-specific route conditions after shared checks. */
export interface TravelDepartureContext {
  readonly progression: ProgressionState | null;
  /** Validated immutable destination definition ID; module policy owns its meaning. */
  readonly destinationSystemId: number;
  readonly origin: Position;
  readonly destination: Position;
  readonly estimate: TravelEstimate;
  readonly fuelBalance: number;
  readonly fuelEfficiency: number;
}

export interface GameRules {
  /** One actor decision, applied before the next slot is observed. */
  /** Null explicitly declines policy for this actor; its state/stream stay unchanged. */
  readonly decideNpcCombat?: ((context: NpcDecisionContext) => NpcDecision | null) | undefined;
  /** Accepted directed player emission at a live ship, never replayed on impact.
   * Null or absence leaves intent unchanged, including generated defenders. */
  readonly respondToPlayerShot?: ((context: NpcPlayerShotContext) => NpcTargetResponse | null) | undefined;
  readonly missions?: MissionRules | undefined;
  /** Pure policy for accepted hosts, using a dedicated random stream. */
  resolveProgression?(event: ProgressionEvent): ProgressionResult | null;
  createCargoMarket?(context: CargoMarketContext): CargoMarketResult;
  planCargoTransfer?(context: CargoTransferContext): CargoTransferPlan | null;
  quoteResourceSale?(context: ResourceSaleContext): ResourceSaleQuote | null;
  /** Optional additive planet service; absent modules expose no purchase action. */
  quoteResourcePurchase?(context: ResourcePurchaseContext): ResourcePurchaseResult | null;
  validateEquipmentMarket?(
    system: import('../../content/schemas/game-module').SystemDefinition,
    adjustment: number
  ): boolean;
  evaluateEquipmentPrice?(context: EquipmentPriceContext): EquipmentPrice | null;
  createEquipmentMarket?(context: EquipmentMarketContext): EquipmentMarket;
  getSpecialWeapon?(weaponDefinitionId: number): SpecialWeaponDefinition | null;
  selectSpecialEffectSlots?(context: SpecialEffectSlotsContext): readonly (string | null)[];
  /** Present together for modules supporting moving primary shots. */
  getProjectileFlight?(weaponDefinitionId: number): ProjectileFlightDefinition | null;
  advanceProjectileMotion?(context: ProjectileMotionContext): ProjectileMotion;
  /** Optional planet self-purchase policy; shared code revalidates offer,
   * resources and capacity and commits the replacement atomically. */
  evaluateVesselPurchase?(context: VesselPurchaseContext): VesselPurchaseApproval | null;
  /**
   * Lifecycle modules validate semantic relationships in canonical overrides.
   * Receives a copied, deeply frozen collection at module activation (empty
   * fresh state), settlement and restore, including visits with no deaths.
   * Must return exactly true for valid state; false, other results or throws
   * reject the enclosing operation before publication. Authored defaults and
   * this policy must describe the same effective presence for every record.
   * The second frozen projection describes the actual loaded content baseline
   * and mutable scope, so a policy may reject disagreement with reviewed data.
   */
  validateStationMembership?(
    overrides: WorldLifecycle['stationMembershipOverrides'],
    records: readonly StationMembershipPolicyRecord[]
  ): boolean;
  /**
   * Pure deterministic membership intents, reused by hit validation and ordered
   * visit replay. Return each affected mutable record once, including updates
   * restoring authored defaults. Shared code compares the full intent set with
   * the lifecycle result, canonicalizes overrides and validates the next state.
   */
  resolveStationMembership?(context: StationMembershipContext): readonly StationMembership[];
  readonly apiVersion: typeof GAME_RULES_API_VERSION;
  readonly moduleId: string;
  /** Zoom is the validated world denominator selected before this tick's movement. */
  updatePlayerMovement(
    player: PlayerMovementState,
    vessel: PlayerVesselCapabilities,
    controls: Readonly<PlayerControls>,
    zoom: number
  ): PlayerMovementState;
  /** Choose one module-authored distribution and initial intent; identity stays engine-owned. */
  createStartingNpc(context: StartingNpcContext): StartingNpcPlacement;
  /** Once per fresh visit, before equipment, commerce and missions; never restore. */
  readonly createVisitEncounter?: ((context: VisitEncounterContext) => VisitEncounterResult) | undefined;
  /** Module-owned steering receives focused state and the simulation's seeded stream. */
  updateNpcMovement(
    npc: NpcMovementState,
    vessel: NpcNavigationCapabilities,
    target: NpcTargetState,
    cameraZoom: number,
    randomState: number,
    alert: NpcCombatState['alert'],
    combat?: NpcCombatState
  ): NpcTickResult;
  /** Approve a primary shot and its pre-countdown cooldown, or return null. */
  evaluatePrimaryFire(context: PrimaryFireContext): PrimaryFireApproval | null;
  /** Resolve one accepted primary hit; shared code validates and commits the result once. */
  resolvePrimaryHit(context: PrimaryHitContext): DurabilityComponent;
  /** Optional scalar station arithmetic; the shared engine validates monotonic damage. */
  resolveStationHit?(context: StationHitContext): number;
  /** Attribution and source-actor death effects, with no identity/allocation authority. */
  /** Null explicitly declines outcomes for this actor; shared damage/removal still runs. */
  resolveLifecycleHit?(context: LifecycleHitContext): LifecycleHitResult | null;
  /** Validate a generated actor's module-owned identity against maintained content. */
  validateGeneratedActor?(
    context: Readonly<{ definitionId: number; systemId: number; generation: NpcGeneration }>
  ): boolean;
  /** Quote an available repair interaction, or reject it without changing state. */
  evaluateRepairStart(context: RepairStartContext): RepairStartApproval | null;
  /** Advance an already-paid repair by one fixed simulation tick. */
  updateRepair(context: RepairTickContext): RepairTickResult;
  /** Quote route time and fuel from validated map positions without mutating state. */
  estimateTravel(context: TravelEstimateContext): TravelEstimate;
  /** Source-specific departure eligibility, with no state mutation. */
  canDepart(context: TravelDepartureContext): boolean;
}
