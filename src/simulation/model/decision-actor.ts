/** One adapter for shared ship/station decision components. Station scalar
 * durability stays distinct; decision history uses the exact ship schema. */
import type { z } from 'zod';
import type { EntityDefinition } from '../../content/schemas/game-content';
import type { NpcNavigationIntentSchema } from './entity-components';
import type { NpcCombatState } from './npc-state';
import type { NpcShipEntity, StationEntity, WorldEntity } from './world-schema';

export type DecisionActor = NpcShipEntity | (StationEntity & { combat: NonNullable<StationEntity['combat']> });

export function isDecisionActor(actor: WorldEntity): actor is DecisionActor {
  return actor.kind === 'npc-ship' || (actor.kind === 'station' && actor.combat !== null);
}

export function actorCombat(actor: DecisionActor): NpcCombatState {
  return actor.kind === 'npc-ship' ? actor.combat : actor.combat.state;
}

export function actorNavigation(actor: DecisionActor): z.infer<typeof NpcNavigationIntentSchema> {
  return actor.kind === 'npc-ship' ? actor.navigation : actor.combat.navigation;
}

export function actorRandomState(actor: DecisionActor): number {
  return actor.kind === 'npc-ship' ? actor.randomState : actor.combat.randomState;
}

/** Field-three capability: definitions preserve the original size scalar under
 * their category's domain name. Never derive power from sprite dimensions. */
export function actorSize(definition: EntityDefinition): number {
  return definition.category === 'ship' ? definition.sizeClass : definition.constructionScale;
}

export function withActorDecisionState(
  actor: DecisionActor,
  combat: NpcCombatState,
  navigation = actorNavigation(actor),
  randomState = actorRandomState(actor)
): DecisionActor {
  if (actor.kind === 'npc-ship') return { ...actor, combat, navigation, randomState };
  return { ...actor, combat: { ...actor.combat, state: combat, navigation, randomState } };
}

/** Removal clears intent without touching historical projectile targets. */
export function clearActorTarget(actor: WorldEntity, removedId: string): WorldEntity {
  if (!isDecisionActor(actor)) return actor;
  const navigation = actorNavigation(actor);
  if (navigation.targetEntityId !== removedId) return actor;
  return withActorDecisionState(actor, actorCombat(actor), { ...navigation, targetEntityId: null });
}
