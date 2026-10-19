/**
 * Trusted module behavior injected by the composition root. Modules receive
 * immutable state and definitions, never a store setter, renderer, or browser.
 * One call advances one module-defined tick and must return a frozen snapshot.
 * This is a code extension contract, not a sandbox for untrusted downloads.
 */
import type { PlayerControls } from '../commands/player-controls';
import type { DurabilityComponent, FlightMode, PlayerNotice, Position } from '../model/entity-components';
import type {
  NpcMovementState,
  NpcTickResult,
  NpcTargetState,
  StartingNpcPlacement,
} from '../model/npc-state';
import type { PlayerMovementState } from '../model/player-state';

/** The reviewed rule contract version accepted by the shared engine. */
export const GAME_RULES_API_VERSION = 9 as const;

export interface PlayerVesselCapabilities {
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
  readonly target: Readonly<{ position: Position }>;
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

/** A displayed estimate only. S16 will own the actual travel command. */
export interface TravelEstimate {
  readonly durationDays: number;
  /** Whole days committed to the calendar on departure. */
  readonly advanceDays: number;
  readonly fuelResourceId: string;
  readonly fuelUnits: number;
}

/** A module may reject source-specific route conditions after shared checks. */
export interface TravelDepartureContext {
  readonly origin: Position;
  readonly destination: Position;
  readonly estimate: TravelEstimate;
  readonly fuelBalance: number;
  readonly fuelEfficiency: number;
}

export interface GameRules {
  readonly apiVersion: typeof GAME_RULES_API_VERSION;
  readonly moduleId: string;
  /** Zoom is the validated world denominator selected before this tick's movement. */
  updatePlayerMovement(player: PlayerMovementState, vessel: PlayerVesselCapabilities,
    controls: Readonly<PlayerControls>, zoom: number): PlayerMovementState;
  /** Choose one module-authored distribution and initial intent; identity stays engine-owned. */
  createStartingNpc(context: StartingNpcContext): StartingNpcPlacement;
  /** Module-owned steering receives focused state and the simulation's seeded stream. */
  updateNpcMovement(npc: NpcMovementState, vessel: NpcNavigationCapabilities,
    target: NpcTargetState, cameraZoom: number, randomState: number): NpcTickResult;
  /** Approve a primary shot and its pre-countdown cooldown, or return null. */
  evaluatePrimaryFire(context: PrimaryFireContext): PrimaryFireApproval | null;
  /** Resolve one accepted primary hit; shared code validates and commits the result once. */
  resolvePrimaryHit(context: PrimaryHitContext): DurabilityComponent;
  /** Quote an available repair interaction, or reject it without changing state. */
  evaluateRepairStart(context: RepairStartContext): RepairStartApproval | null;
  /** Advance an already-paid repair by one fixed simulation tick. */
  updateRepair(context: RepairTickContext): RepairTickResult;
  /** Quote route time and fuel from validated map positions without mutating state. */
  estimateTravel(context: TravelEstimateContext): TravelEstimate;
  /** Source-specific departure eligibility, with no state mutation. */
  canDepart(context: TravelDepartureContext): boolean;
}
