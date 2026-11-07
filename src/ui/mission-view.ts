/** Copied, frozen presentation facts. No actor/store aliases or mutable offer
 * references escape; acceptance refusals retain module-authored wording. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { UInt32Schema } from '../random/seeded-random';
import { ContractAcceptanceResultSchema } from '../simulation/contracts/mission-rules';
import { quoteContractAcceptance } from '../simulation/features/missions';
import { CargoPodSchema } from '../simulation/model/cargo-state';
import { RuntimeEntityIdSchema, SystemIdSchema } from '../simulation/model/entity-components';
import { ContractOfferRefSchema, ContractOfferSchema } from '../simulation/model/mission-state';
import { selectPlayerEntity } from '../simulation/model/world-state';

export const MissionViewSchema = z
  .object({
    visitEntityId: RuntimeEntityIdSchema,
    systemId: SystemIdSchema,
    seed: UInt32Schema,
    surfaceMissionIndex: z.number().int().nonnegative(),
    offers: z
      .array(
        z
          .object({
            ref: ContractOfferRefSchema,
            offer: ContractOfferSchema,
            acceptance: ContractAcceptanceResultSchema.nullable(),
          })
          .strict()
          .readonly()
      )
      .readonly(),
    contracts: z.array(CargoPodSchema).readonly(),
  })
  .strict()
  .readonly();
export type MissionView = z.infer<typeof MissionViewSchema>;
/** Narrow inputs avoid reprojecting offers on unrelated simulation ticks. */
export function selectMissionInputs(state: AppStoreState) {
  const world = state.world;
  if (!world?.missions) return null;
  const player = selectPlayerEntity(world);
  return {
    missions: world.missions,
    cargo: player.inventory.cargo,
    vesselId: player.definitionId,
    repairing: player.condition.repairing,
    status: world.status,
    stations: world.entities
      .filter(entity => entity.kind === 'station')
      .map(entity => entity.stationId)
      .join(','),
  };
}
export function selectMissionView(state: AppStoreState, game: GameModule): MissionView | null {
  const world = state.world,
    missions = world?.missions;
  if (!world || !missions || !game.rules.missions) return null;
  const offers = [
    ...(missions.planetOffer ? [{ kind: 'planet' as const, stationId: null, offer: missions.planetOffer }] : []),
    ...Object.entries(missions.stationOffers).flatMap(([stationId, offer]) =>
      offer && world.entities.some(entity => entity.kind === 'station' && entity.stationId === stationId)
        ? [{ kind: 'station' as const, stationId, offer }]
        : []
    ),
  ].map(({ kind, stationId, offer }) => {
    const ref = ContractOfferRefSchema.parse({
      kind,
      stationId,
      systemId: missions.systemId,
      seed: missions.seed,
      visitEntityId: missions.visitEntityId,
    });
    return { ref, offer, acceptance: quoteContractAcceptance(world, game, ref) };
  });
  return MissionViewSchema.parse({
    visitEntityId: missions.visitEntityId,
    systemId: missions.systemId,
    seed: missions.seed,
    surfaceMissionIndex: missions.surfaceMissionIndex,
    offers,
    contracts: selectPlayerEntity(world).inventory.cargo.filter(pod => pod.contract),
  });
}
