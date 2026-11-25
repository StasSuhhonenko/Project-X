/** Frozen construction presentation facts and revision-bound command factories.
 * Plan holes retain their inventory indices; no policy or mutable world escapes. */
import { z } from 'zod';
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { StructureDefinitionSchema, type StructureDefinition } from '../content/schemas/game-content';
import { SystemDefinitionSchema } from '../content/schemas/game-module';
import { PlanPurchaseContextSchema, PlanPurchaseDecisionSchema } from '../simulation/contracts/construction-rules';
import {
  DeletePlanIntentSchema,
  PlanPurchaseIntentSchema,
  StartConstructionIntentSchema,
} from '../simulation/features/construction';
import { effectiveStations } from '../simulation/features/effective-stations';
import { selectPlayerEntity } from '../simulation/model/world-state';

const PlanSchema = z
  .object({
    structureDefinitionId: z.number().int().positive(),
    name: z.string(),
    basePrice: z.number().finite().nonnegative(),
    constructionScale: z.number().finite().nonnegative(),
  })
  .strict();
export const ConstructionViewSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    sessionRevision: z.number().int().nonnegative(),
    systemId: z.number().int().positive(),
    governmentId: SystemDefinitionSchema.unwrap().shape.governmentId,
    plans: z.array(PlanSchema.extend({ deleteIntent: DeletePlanIntentSchema }).readonly().nullable()).readonly(),
    sites: z
      .array(
        z
          .object({
            entityId: z.string(),
            stationId: z.string(),
            structureDefinitionId: z.number().int().positive(),
            name: z.string(),
            remainingDays: z.number().finite().positive(),
          })
          .strict()
          .readonly()
      )
      .readonly(),
    stationEntityId: z.string().nullable(),
    offers: z
      .array(
        PlanSchema.extend({
          offerIndex: z.number().int().min(0).max(5),
          description: StructureDefinitionSchema.unwrap().shape.description,
          price: PlanPurchaseDecisionSchema.unwrap().shape.price,
          purchaseIntent: PlanPurchaseIntentSchema,
        })
          .readonly()
          .nullable()
      )
      .readonly(),
  })
  .strict()
  .readonly();
export type ConstructionView = z.infer<typeof ConstructionViewSchema>;

/** Offer prices are policy quotes over the current resource/equipment snapshot,
 * not UI arithmetic or permission to purchase. The command independently checks
 * its captured binding and re-evaluates the policy before any resource debit. */
export function selectConstructionView(state: AppStoreState, game: GameModule): ConstructionView | null {
  const world = state.world,
    rules = game.rules.construction;
  if (!world || world.status !== 'active' || !world.construction || !rules) return null;
  const construction = world.construction,
    player = selectPlayerEntity(world);
  const system = game.definition.systems.find(system => system.id === player.location.systemId)!;
  const binding = { sessionRevision: state.sessionRevision, revision: construction.revision };
  const getStructure = (id: number) => {
    const definition = game.catalog.getStructureDefinition(id);
    if (!definition) throw Error('Construction plan definition is unavailable.');
    return definition;
  };
  const plan = (structure: StructureDefinition) => ({
    structureDefinitionId: structure.id,
    name: structure.name,
    basePrice: structure.basePrice,
    constructionScale: structure.constructionScale,
  });
  const actor = world.entities.find(entity => entity.id === world.selectedTargetEntityId);
  const station = actor?.kind === 'station' && !actor.construction ? actor : null;
  const offers = station
    ? (effectiveStations(system, construction, rules).find(placement => placement.id === station.stationId)
        ?.planOffers ?? [])
    : [];
  return ConstructionViewSchema.parse({
    ...binding,
    systemId: system.id,
    governmentId: system.governmentId,
    stationEntityId: station?.id ?? null,
    plans: construction.plans.map((id, planIndex) =>
      id === null ? null : { ...plan(getStructure(id)), deleteIntent: { ...binding, planIndex, structureDefinitionId: id } }
    ),
    offers: offers.map((id, offerIndex) => {
      if (id === null) return null;
      const structure = getStructure(id);
      return {
        ...plan(structure),
        offerIndex,
        description: structure.description,
        price: PlanPurchaseDecisionSchema.parse(
          rules.evaluatePlanPurchase(
            PlanPurchaseContextSchema.parse({
              structure,
              system,
              marketAdjustment: player.equipment?.marketAdjustment ?? null,
              resources: player.inventory.resources,
            })
          )
        ).price,
        purchaseIntent: { ...binding, stationEntityId: station!.id, offerIndex, structureDefinitionId: id },
      };
    }),
    sites: construction.deployments.flatMap(link => {
      const site = construction.stations.find(station => station.id === link.stationId);
      if (!site || site.phase.kind !== 'pending') return [];
      return [
        {
          entityId: link.entityId,
          stationId: site.id,
          structureDefinitionId: site.structureDefinitionId,
          name: site.name,
          remainingDays: -site.phase.progress,
        },
      ];
    }),
  });
}

/** Builder choices are presentation-owned, but the binding always comes from
 * its displayed inventory revision. Reusing it after any change is refused. */
export function createStartConstructionIntent(
  view: ConstructionView,
  planIndex: number,
  name: string,
  destinationSystemId: number | null
) {
  const plan = view.plans[planIndex];
  if (!plan) return null;
  return StartConstructionIntentSchema.parse({
    sessionRevision: view.sessionRevision,
    revision: view.revision,
    planIndex,
    structureDefinitionId: plan.structureDefinitionId,
    name,
    destinationSystemId,
  });
}
