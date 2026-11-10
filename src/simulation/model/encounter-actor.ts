/** Sole constructor for named visit NPCs and owned ships. The caller authenticates
 * policy/content references and allocates the sequence; this factory consumes no
 * world randomness and always starts at full definition durability. */
import type { ShipDefinition } from '../../content/schemas/game-content';
import type { Position } from './entity-components';
import { createNpcCombatState, deriveNpcRandomState } from './npc-state';
import type { NpcShipEntity } from './world-state';

export function createEncounterActor(
  sequence: number,
  systemId: number,
  vessel: ShipDefinition,
  governmentId: number,
  identity: { readonly name: string; readonly raceId: number | null },
  placement: { readonly position: Position; readonly rotationDegrees: number },
  targetEntityId: string | null
): NpcShipEntity {
  return {
    id: `entity-${sequence}`,
    kind: 'npc-ship',
    definitionId: vessel.id,
    governmentId,
    combat: createNpcCombatState(),
    randomState: deriveNpcRandomState(sequence),
    encounter: { name: identity.name, raceId: identity.raceId },
    generation: null,
    specialStatus: { engineDisabledFrames: 0, hitFlag: 0 },
    location: { systemId, position: placement.position, rotationDegrees: placement.rotationDegrees },
    motion: { speedPerFrame: 0, desiredSpeedPerFrame: 0 },
    condition: { hull: vessel.maximumHull, shields: vessel.maximumShields },
    navigation: { targetEntityId, targetOffset: { x: 0, y: 0 } },
    tradeOffer: null,
    tradeSeed: null,
    tradeDemand: null,
  };
}
