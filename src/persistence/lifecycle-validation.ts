/** Content-aware restore invariants for the consumed station lifecycle capability. */
import type { GameModule } from '../content/game-module';
import { validateActiveStationVisit } from '../simulation/features/active-station-visit';
import { hasExactStandingScope } from '../simulation/model/lifecycle-state';
import type { WorldState } from '../simulation/model/world-state';

/** Validate durable facts and exact active continuation before store publication. */
export function validateSavedLifecycle(world: WorldState, startId: string, game: GameModule): readonly string[] {
  const { definition, rules } = game;
  const config = definition.lifecycle;
  const state = world.lifecycle;
  const start = definition.starts.find(candidate => candidate.id === startId)!;
  const defaults = start.systemStandingDefaults ?? [];
  if (state.standingStartId !== (defaults.length ? startId : null))
    throw new Error('Saved standing defaults belong to a different starting choice.');
  if (
    !hasExactStandingScope(
      state.systemStanding,
      defaults.map(entry => entry.systemId)
    )
  )
    throw new Error('Saved standing does not match the selected start capability.');
  const strengthIds = config?.strengthSystemIds ?? [];
  if (
    state.systemStrength.length !== strengthIds.length ||
    state.systemStrength.some(entry => {
      const authored = definition.systems.find(system => system.id === entry.systemId);
      return !strengthIds.includes(entry.systemId) || !authored || entry.value > authored.initialStrength;
    })
  )
    throw new Error('Saved strength does not match the selected consumed scope or exceeds its initial value.');
  const activeSystemId = world.entities.find(entity => entity.kind === 'player-ship')!.location.systemId;
  const system = definition.systems.find(candidate => candidate.id === activeSystemId);
  if (!system) throw new Error('Saved active system is unavailable.');
  const expectedStationIds = validateActiveStationVisit(world, system, config, rules);
  const records = config?.stationRecords.filter(record => record.homeSystemId === activeSystemId) ?? [];
  const stations = world.entities.filter(entity => entity.kind === 'station');
  stations.forEach(station => {
    const record = records.find(candidate => candidate.stationPlacementId === station.stationId);
    if (!record) {
      if (station.combat) throw new Error('Saved station has an unauthored combat component.');
      return;
    }
    if (
      !station.combat ||
      station.combat.recordId !== record.id ||
      station.combat.maximumStrength !== record.maximumStrength ||
      station.combat.strength > record.initialStrength
    )
      throw new Error('Saved station combat disagrees with its authored capability.');
    // A declared scalar is also a read-only tactical fact. Without a mutable
    // capability no implemented operation can damage or attribute this actor.
    if (
      !config?.mutableStationRecordIds.includes(record.id) &&
      (station.combat.strength !== record.initialStrength || station.combat.state.blameDeath)
    )
      throw new Error('Saved read-only station condition differs from its authored initial state.');
  });
  const npcs = world.entities.filter(entity => entity.kind === 'npc-ship');
  npcs.forEach(actor => {
    const generation = actor.generation;
    if (!generation) return;
    if (
      !config ||
      generation.policyId !== config.policyId ||
      !config.spawnShipDefinitionIds.includes(actor.definitionId) ||
      // Generated ships can be death replacements in stationless systems;
      // station presence is not generation provenance. All identity checks
      // below still apply, including the selected module's roster validator.
      actor.tradeOffer !== null ||
      !definition.governments.some(government => government.id === actor.governmentId) ||
      (rules.validateGeneratedActor &&
        !rules.validateGeneratedActor(
          Object.freeze({
            definitionId: actor.definitionId,
            systemId: activeSystemId,
            generation,
          })
        ))
    )
      throw new Error('Saved generated actor is incompatible with the selected policy.');
  });
  return expectedStationIds;
}
