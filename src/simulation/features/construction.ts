/** Atomic plan ownership, site creation and travel-only progress. Every public
 * operation builds detached state; callers publish only its final validated world. */
import { z } from 'zod';
import { isBuildableStructure } from '../../content/construction-eligibility';
import type { GameModule } from '../../content/game-module';
import {
  CompletionNoticeContextSchema,
  ConstructedStationPlacementContextSchema,
  ConstructedStationPlacementSchema,
  ConstructionStartContextSchema,
  ConstructionStartDecisionSchema,
  PlanPurchaseContextSchema,
  PlanPurchaseDecisionSchema,
  TravelProgressContextSchema,
} from '../contracts/construction-rules';
import type { GameRules } from '../contracts/game-rules';
import type { ConstructedStation, ConstructionState } from '../model/construction-state';
import { RuntimeEntityIdSchema, UnsequencedNoticeSchema, type UnsequencedNotice } from '../model/entity-components';
import { applyStandingDelta } from '../model/lifecycle-state';
import { debitResource } from '../model/resource-balances';
import { parseWorldState, selectPlayerEntity, type StationEntity, type WorldState } from '../model/world-state';
import { effectiveStations } from './effective-stations';

const Binding = { sessionRevision: z.number().int().nonnegative(), revision: z.number().int().nonnegative() };
const Plan = { planIndex: z.number().int().nonnegative(), structureDefinitionId: z.number().int().positive() };
export const PlanPurchaseIntentSchema = z
  .object({
    ...Binding,
    stationEntityId: RuntimeEntityIdSchema,
    offerIndex: z.number().int().min(0).max(5),
    structureDefinitionId: Plan.structureDefinitionId,
  })
  .strict()
  .readonly();
export const DeletePlanIntentSchema = z
  .object({ ...Binding, ...Plan })
  .strict()
  .readonly();
export const StartConstructionIntentSchema = z
  .object({
    ...Binding,
    ...Plan,
    name: z.string().trim().min(1).max(160),
    destinationSystemId: z.number().int().positive().nullable(),
  })
  .strict()
  .readonly();
export type PlanPurchaseIntent = z.infer<typeof PlanPurchaseIntentSchema>;
export type DeletePlanIntent = z.infer<typeof DeletePlanIntentSchema>;
export type StartConstructionIntent = z.infer<typeof StartConstructionIntentSchema>;

/** No optional-state key is introduced for modules without this capability. */
export function initializeConstruction(world: WorldState, rules: GameRules): WorldState {
  if (!rules.construction || world.construction) return world;
  const capacity = z.number().int().positive().max(128).parse(rules.construction.planCapacity);
  return parseWorldState({
    ...world,
    construction: {
      revision: 0,
      nextStationSequence: 1,
      plans: Array.from({ length: capacity }, () => null),
      stations: [],
      deployments: [],
    },
  });
}

function context(world: WorldState, game: GameModule, structureId: number) {
  const structure = game.catalog.getEntityDefinition(structureId);
  const system = game.definition.systems.find(system => system.id === selectPlayerEntity(world).location.systemId);
  if (!isBuildableStructure(structure) || !system) return null;
  return { structure, system };
}
function current(
  world: WorldState,
  sessionRevision: number,
  intent: z.infer<typeof DeletePlanIntentSchema> | PlanPurchaseIntent
) {
  return (
    world.status === 'active' &&
    world.construction &&
    intent.revision === world.construction.revision &&
    intent.sessionRevision === sessionRevision
  );
}
function publish(
  world: WorldState,
  construction: ConstructionState,
  resources = selectPlayerEntity(world).inventory.resources,
  notice?: UnsequencedNotice
): WorldState {
  const player = selectPlayerEntity(world);
  return parseWorldState({
    ...world,
    construction,
    entities: world.entities.map(entity =>
      entity.id !== player.id
        ? entity
        : {
            ...player,
            inventory: { ...player.inventory, resources },
            feedback: notice
              ? { ...player.feedback, notice: { ...notice, sequence: (player.feedback.notice?.sequence ?? 0) + 1 } }
              : player.feedback,
          }
    ),
  });
}

/** Station-only acquisition authenticates both selected actor and exact offer
 * position. Holes and duplicates are preserved; full/funds refusals are silent. */
export function purchasePlan(
  world: WorldState,
  game: GameModule,
  sessionRevision: number,
  input: PlanPurchaseIntent
): WorldState {
  const parsed = PlanPurchaseIntentSchema.safeParse(input);
  if (!parsed.success || !current(world, sessionRevision, parsed.data) || !game.rules.construction) return world;
  const intent = parsed.data,
    state = world.construction!;
  const slot = state.plans.indexOf(null),
    actor = world.entities.find(entity => entity.id === intent.stationEntityId);
  const facts = context(world, game, intent.structureDefinitionId);
  if (
    slot < 0 ||
    !facts ||
    actor?.kind !== 'station' ||
    actor.construction ||
    world.selectedTargetEntityId !== actor.id
  )
    return world;
  const offer = effectiveStations(facts.system, state, game.rules.construction).find(
    station => station.id === actor.stationId
  )?.planOffers?.[intent.offerIndex];
  if (offer !== intent.structureDefinitionId) return world;
  const player = selectPlayerEntity(world);
  const decision = PlanPurchaseDecisionSchema.parse(
    game.rules.construction.evaluatePlanPurchase(
      PlanPurchaseContextSchema.parse({
        ...facts,
        resources: player.inventory.resources,
        marketAdjustment: player.equipment?.marketAdjustment ?? null,
      })
    )
  );
  if (!decision.accepted) return world;
  const resources = debitResource(player.inventory.resources, decision.price.resourceId, decision.price.amount);
  if (!resources) return world;
  return publish(
    world,
    {
      ...state,
      revision: state.revision + 1,
      plans: state.plans.map((id, index) => (index === slot ? intent.structureDefinitionId : id)),
    },
    resources
  );
}

export function deletePlan(
  world: WorldState,
  game: GameModule,
  sessionRevision: number,
  input: DeletePlanIntent
): WorldState {
  const parsed = DeletePlanIntentSchema.safeParse(input);
  if (!parsed.success || !current(world, sessionRevision, parsed.data) || !game.rules.construction) return world;
  const intent = parsed.data,
    state = world.construction!;
  if (state.plans[intent.planIndex] !== intent.structureDefinitionId) return world;
  return publish(world, {
    ...state,
    revision: state.revision + 1,
    plans: state.plans.map((id, index) => (index === intent.planIndex ? null : id)),
  });
}

/** Placement draws only after all ordered policy gates and the debit succeed.
 * The plan remains owned. Pending markers have no combat, services or NPC slot. */
export function startConstruction(
  world: WorldState,
  game: GameModule,
  sessionRevision: number,
  input: StartConstructionIntent
): WorldState {
  const parsed = StartConstructionIntentSchema.safeParse(input);
  if (!parsed.success || !current(world, sessionRevision, parsed.data) || !game.rules.construction) return world;
  const intent = parsed.data,
    state = world.construction!,
    rules = game.rules.construction;
  const facts = context(world, game, intent.structureDefinitionId);
  if (
    !facts ||
    state.plans[intent.planIndex] !== intent.structureDefinitionId ||
    (intent.destinationSystemId !== null &&
      !game.definition.systems.some(system => system.id === intent.destinationSystemId))
  )
    return world;
  const player = selectPlayerEntity(world);
  const decision = ConstructionStartDecisionSchema.parse(
    rules.evaluateStart(
      ConstructionStartContextSchema.parse({
        ...facts,
        localGovernmentId: facts.system.governmentId,
        resources: player.inventory.resources,
      })
    )
  );
  // Only construction mutations invalidate bound intents. Feedback has its
  // own sequence so a retained draft can report each refusal and later retry.
  if (decision.kind === 'refused') return publish(world, state, undefined, decision.notice);
  const resources = debitResource(player.inventory.resources, decision.cost.resourceId, decision.cost.amount);
  if (!resources) return world;
  const placement = ConstructedStationPlacementSchema.parse(
    rules.placeStation(
      ConstructedStationPlacementContextSchema.parse({
        ...facts,
        playerPosition: player.location.position,
        planetPosition: facts.system.planet.placement.position,
        randomState: world.randomState,
      })
    )
  );
  const station: ConstructedStation = {
    id: 'constructed-' + state.nextStationSequence,
    structureDefinitionId: intent.structureDefinitionId,
    systemId: facts.system.id,
    name: intent.name,
    positionOffset: placement.positionOffset,
    rotationDegrees: placement.rotationDegrees,
    destinationSystemId: intent.destinationSystemId,
    phase: { kind: 'pending', progress: decision.initialProgress },
  };
  const actor = pendingActor(station, world.nextEntitySequence, facts.system.planet.placement.position);
  const next = publish(
    {
      ...world,
      randomState: placement.randomState,
      nextEntitySequence: world.nextEntitySequence + 1,
      lifecycle:
        decision.standingDelta === 0
          ? world.lifecycle
          : {
              ...world.lifecycle,
              systemStanding: applyStandingDelta(
                world.lifecycle.systemStanding,
                facts.system.id,
                decision.standingDelta
              ),
            },
      entities: [...world.entities, actor],
    },
    {
      ...state,
      revision: state.revision + 1,
      nextStationSequence: state.nextStationSequence + 1,
      stations: [...state.stations, station],
      deployments: [...state.deployments, { stationId: station.id, entityId: actor.id }],
    },
    resources,
    decision.notice
  );
  return next;
}

function pendingActor(
  station: ConstructedStation,
  sequence: number,
  planet: { readonly x: number; readonly y: number }
): StationEntity {
  return {
    id: 'entity-' + sequence,
    kind: 'station',
    construction: 'pending',
    stationId: station.id,
    definitionId: station.structureDefinitionId,
    combat: null,
    commodityMarket: null,
    location: {
      systemId: station.systemId,
      position: { x: planet.x + station.positionOffset.x, y: planet.y + station.positionOffset.y },
      rotationDegrees: station.rotationDegrees,
    },
  };
}

/** Entry reconstruction only; never called during restore. Complete stations
 * are allocated by ordinary spatial composition before these inert markers. */
export function initializeConstructionPresence(world: WorldState, game: GameModule): WorldState {
  if (!game.rules.construction || !world.construction) return world;
  return parseWorldState(composeConstructionPresence(world));
}

/** Compose visit-local links before the outer world boundary is parsed. */
export function composeConstructionPresence(world: WorldState): WorldState {
  if (!world.construction) return world;
  const player = selectPlayerEntity(world),
    planet = world.entities.find(entity => entity.kind === 'planet');
  if (!planet) throw Error('Construction presence requires a planet.');
  const pending = world.construction.stations.filter(
    station =>
      station.systemId === player.location.systemId &&
      station.phase.kind === 'pending' &&
      !world.entities.some(entity => entity.kind === 'station' && entity.stationId === station.id)
  );
  const actors = pending.map((station, index) =>
    pendingActor(station, world.nextEntitySequence + index, planet.location.position)
  );
  return {
    ...world,
    nextEntitySequence: world.nextEntitySequence + actors.length,
    construction: {
      ...world.construction,
      deployments: [...world.entities, ...actors].flatMap(entity =>
        entity.kind === 'station' && world.construction!.stations.some(station => station.id === entity.stationId)
          ? [{ stationId: entity.stationId, entityId: entity.id }]
          : []
      ),
    },
    entities: [...world.entities, ...actors],
  };
}

/** Travel's detached transaction calls this once before destination spawning.
 * Completion notices follow record creation order and overshoot is discarded. */
export function advanceConstruction(
  world: WorldState,
  game: { readonly rules: GameRules; readonly definition: Pick<GameModule['definition'], 'systems' | 'content'> },
  durationDays: number
): { readonly construction: ConstructionState | undefined; readonly notices: readonly UnsequencedNotice[] } {
  const state = world.construction,
    rules = game.rules.construction;
  if (!state || !rules) return { construction: state, notices: [] };
  const increment = z
    .number()
    .finite()
    .nonnegative()
    .parse(rules.travelProgress(TravelProgressContextSchema.parse({ durationDays })));
  const notices: UnsequencedNotice[] = [];
  const stations = state.stations.map(station => {
    if (station.phase.kind !== 'pending') return station;
    const progress = station.phase.progress + increment;
    if (progress < 0) return { ...station, phase: { kind: 'pending' as const, progress } };
    const structure = game.definition.content.entityDefinitions.find(
      definition => definition.id === station.structureDefinitionId
    );
    const system = game.definition.systems.find(system => system.id === station.systemId);
    notices.push(
      UnsequencedNoticeSchema.parse(
        rules.completionNotice(CompletionNoticeContextSchema.parse({ structure, system, name: station.name }))
      )
    );
    return { ...station, phase: { kind: 'complete' as const } };
  });
  return {
    construction: { ...state, revision: state.revision + 1, stations, deployments: [] },
    notices: Object.freeze(notices),
  };
}
