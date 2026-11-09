/** Validate a complete visit encounter before allocating/publishing any actors. */
import type { GameModule } from '../../content/game-module';
import { VisitEncounterResultSchema } from '../contracts/encounter-rules';
import { createNpcCombatState, deriveNpcRandomState } from '../model/npc-state';
import { parseWorldState, selectPlayerEntity, type NpcShipEntity, type WorldState } from '../model/world-state';

/** Entry-only operation, never called by restore or by a tick. The host commits
 * once after all subsequent entry initializers succeed. Invalid module output
 * cannot consume the allocator, world stream or any live session state. */
export function initializeVisitEncounters(world: WorldState, game: GameModule): WorldState {
  const create = game.rules.createVisitEncounter;
  if (!create) return world;
  const player = selectPlayerEntity(world);
  const systemId = player.location.systemId;
  const system = game.definition.systems.find(candidate => candidate.id === systemId);
  const planet = world.entities.find(entity => entity.kind === 'planet');
  if (!system || !planet) throw new Error('Visit encounter requires an active system and planet.');
  // Slots captured before any encounter ship is appended (source numstations).
  const entrySlots = world.specialActorSlots.slice(0, world.entryActorSlotCount);
  const result = VisitEncounterResultSchema.parse(
    create(
      Object.freeze({
        system,
        systems: game.definition.systems,
        governments: game.definition.governments,
        randomState: world.randomState,
        population: system.initialPopulationBillions,
        actorSlotCount: world.entryActorSlotCount,
        playerPosition: player.location.position,
        cameraZoom: world.cameraZoom,
      })
    )
  );
  const ships: NpcShipEntity[] = result.ships.map((spec, index) => {
    const vessel = game.catalog.getShipDefinition(spec.definitionId);
    if (!vessel) throw new Error('Encounter references an undeclared ship definition.');
    if (!game.definition.combatGeometry.entities.some(geometry => geometry.entityDefinitionId === vessel.id))
      throw new Error('Encounter ship requires authoritative entity geometry.');
    if (!game.definition.governments.some(government => government.id === spec.governmentId))
      throw new Error('Encounter references an undeclared government.');
    const initialTarget = spec.initialTarget;
    if (initialTarget.kind === 'actor-slot' && initialTarget.slot >= entrySlots.length)
      throw new Error('Encounter targets an actor slot outside the entry slots.');
    // An empty slot (slot 0 or a hole) leaves the ship without a target, as in the source.
    const targetEntityId = initialTarget.kind === 'planet' ? planet.id : (entrySlots[initialTarget.slot] ?? null);
    const sequence = world.nextEntitySequence + index;
    return {
      id: `entity-${sequence}`,
      kind: 'npc-ship',
      definitionId: spec.definitionId,
      governmentId: spec.governmentId,
      combat: createNpcCombatState(),
      randomState: deriveNpcRandomState(sequence),
      encounter: { name: spec.name, raceId: spec.raceId ?? null },
      generation: null,
      specialStatus: { engineDisabledFrames: 0, hitFlag: 0 },
      location: { systemId, position: spec.position, rotationDegrees: spec.rotationDegrees ?? 0 },
      motion: { speedPerFrame: 0, desiredSpeedPerFrame: 0 },
      condition: { hull: vessel.maximumHull, shields: vessel.maximumShields },
      navigation: { targetEntityId, targetOffset: { x: 0, y: 0 } },
      tradeOffer: null,
      tradeSeed: null,
      tradeDemand: null,
    };
  });
  return parseWorldState({
    ...world,
    randomState: result.randomState,
    nextEntitySequence: world.nextEntitySequence + ships.length,
    specialActorSlots: [...world.specialActorSlots, ...ships.map(ship => ship.id)],
    entities: [...world.entities, ...ships],
  });
}
