/** Game-neutral orchestration for quoting, paying, cancelling and progressing repairs. */
import { z } from 'zod';
import type { ShipDefinition } from '../../content/schemas/game-content';
import type { SystemDefinition } from '../../content/schemas/game-module';
import type { GameRules, RepairStartContext } from '../contracts/game-rules';
import { PlayerNoticeSchema } from '../model/entity-components';
import {
  commitPlayerRepairState,
  selectPlayerEntity,
  type WorldState,
} from '../model/world-state';

const RepairApprovalSchema = z.object({
  resourceId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  cost: z.number().finite().int().nonnegative(),
}).strict().readonly();

const RepairTickResultSchema = z.object({
  hull: z.number().finite().nonnegative(),
  shields: z.number().finite().nonnegative(),
  repairing: z.boolean(),
  notice: PlayerNoticeSchema.nullable(),
}).strict().readonly();

export interface RepairEnvironment {
  readonly vessel: ShipDefinition;
  readonly system: SystemDefinition;
  readonly rules: GameRules;
}

function createStartContext(world: WorldState, environment: RepairEnvironment): RepairStartContext {
  const player = selectPlayerEntity(world);
  const planet = world.entities.find(entity => entity.kind === 'planet');
  if (!planet) throw new Error('The active repair system has no planet entity.');
  return Object.freeze({
    player: Object.freeze({
      position: player.location.position,
      hull: player.condition.hull,
      shields: player.condition.shields,
      repairing: player.condition.repairing,
      resources: player.inventory.resources,
    }),
    vessel: Object.freeze({
      maximumHull: environment.vessel.maximumHull,
      maximumShields: environment.vessel.maximumShields,
    }),
    planet: Object.freeze({
      position: planet.location.position,
      populationBillions: environment.system.initialPopulationBillions,
    }),
    cameraZoom: world.cameraZoom,
  });
}

/** Return the currently payable offer. A rejected or unaffordable quote is null. */
export function quotePlayerRepair(world: WorldState, environment: RepairEnvironment) {
  if (world.status !== 'active') return null;
  const approval = environment.rules.evaluateRepairStart(createStartContext(world, environment));
  if (approval === null) return null;
  const offer = RepairApprovalSchema.parse(approval);
  const balance = selectPlayerEntity(world).inventory.resources[offer.resourceId];
  if (balance === undefined || balance < offer.cost) return null;
  return Object.freeze({ ...offer });
}

/** Debit an approved quote exactly once and enter repair atomically. */
export function beginPlayerRepair(world: WorldState, environment: RepairEnvironment): WorldState {
  const offer = quotePlayerRepair(world, environment);
  if (!offer) return world;
  const player = selectPlayerEntity(world);
  return commitPlayerRepairState(world, {
    hull: player.condition.hull,
    shields: player.condition.shields,
    repairing: true,
    resources: { ...player.inventory.resources,
      [offer.resourceId]: player.inventory.resources[offer.resourceId]! - offer.cost },
    notice: player.feedback.notice,
  });
}

/** Manual cancellation mirrors removal of the legacy repair module; payment is not refunded. */
export function cancelPlayerRepair(world: WorldState): WorldState {
  const player = selectPlayerEntity(world);
  if (!player.condition.repairing) return world;
  return commitPlayerRepairState(world, {
    hull: player.condition.hull,
    shields: player.condition.shields,
    repairing: false,
    resources: player.inventory.resources,
    notice: player.feedback.notice,
  });
}

/** Apply one module result while enforcing engine-owned durability bounds. */
export function advancePlayerRepair(world: WorldState, vessel: ShipDefinition, rules: GameRules): WorldState {
  const player = selectPlayerEntity(world);
  if (!player.condition.repairing) return world;
  const result = RepairTickResultSchema.parse(rules.updateRepair(Object.freeze({
    player: Object.freeze({
      hull: player.condition.hull,
      shields: player.condition.shields,
      repairing: true,
      notice: player.feedback.notice,
    }),
    vessel: Object.freeze({ maximumHull: vessel.maximumHull, maximumShields: vessel.maximumShields }),
  })));
  if (result.hull < player.condition.hull || result.shields < player.condition.shields) {
    throw new Error('Repair progress cannot reduce durability.');
  }
  if (result.hull > vessel.maximumHull || result.shields > vessel.maximumShields) {
    throw new Error('Repair progress cannot exceed vessel durability limits.');
  }
  if (!result.repairing && (result.hull !== vessel.maximumHull || result.shields !== vessel.maximumShields)) {
    throw new Error('Automatic repair completion requires full durability.');
  }
  return commitPlayerRepairState(world, {
    ...result,
    resources: player.inventory.resources,
  });
}
