/** Optional coherent mission capability. Policy owns generation, prices,
 * geometry and text; shared operations own allocation and reward ordering. */
import { z } from 'zod';
import type { SystemDefinition } from '../../content/schemas/game-module';
import { CargoQuantitySchema } from '../model/cargo-state';
import type { Position } from '../model/entity-components';
import { NoticeMessageSchema } from '../model/entity-components';
import type { SystemStanding } from '../model/lifecycle-state';
import type {
  ContractNegotiationContext,
  ContractNegotiationResult,
  ContractOffer,
  VisitMissionsResult,
} from '../model/mission-state';

export const ContractAcceptanceResultSchema = z.union([
  z
    .object({ tons: CargoQuantitySchema, payout: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
    .strict()
    .readonly(),
  z
    .object({ refusal: z.string().min(1).max(160) })
    .strict()
    .readonly(),
]);
export type ContractAcceptanceResult = z.infer<typeof ContractAcceptanceResultSchema>;
export const SurfaceMissionResultSchema = z
  .object({
    message: NoticeMessageSchema,
    standingDelta: z.number().finite(),
  })
  .strict()
  .readonly();
export type SurfaceMissionResult = z.infer<typeof SurfaceMissionResultSchema>;
export interface VisitMissionsContext {
  readonly seed: number;
  readonly system: SystemDefinition;
  readonly systems: readonly SystemDefinition[];
  readonly standing: readonly SystemStanding[];
  /** Authored placement keys, the same stable identities used by commerce. */
  readonly stationIds: readonly string[];
  /** Captured commerce seeds allow policy to reuse offer draws already consumed
   * by that actor's market, without drawing twice. Retained through destruction. */
  readonly stationMarketSeeds?: Readonly<Record<string, number>>;
}
export interface SurfaceContext {
  readonly system: SystemDefinition;
  readonly population: number;
}
export interface MissionRules {
  /** Existing declared resource, in the same units as ordinary cargo payment. */
  readonly paymentResourceId: string;
  createVisitMissions(context: VisitMissionsContext): VisitMissionsResult;
  resolveContractNegotiation(context: ContractNegotiationContext): ContractNegotiationResult;
  quoteContractAcceptance(
    context: Readonly<{ offer: ContractOffer; kind: 'planet' | 'station'; freeCapacity: number }>
  ): ContractAcceptanceResult;
  resolveSurfaceMission(context: SurfaceContext & Readonly<{ missionIndex: number }>): SurfaceMissionResult;
  canReachSurface(
    /** Definition identity lets policy resolve vessel overlap bounds without renderer state. */
    context: SurfaceContext &
      Readonly<{ playerPosition: Position; playerDefinitionId: number; planetPosition: Position; cameraZoom: number }> &
      Readonly<{ playerHeadingDegrees?: number }>
  ): boolean;
  describeContractDelivery(
    context: SurfaceContext & Readonly<{ payout: number; tons?: number; goodsLabel?: string | undefined }>
  ): string;
}
