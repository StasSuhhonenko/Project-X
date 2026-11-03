/** Adapt authoritative repair and spatial facts into narrow frozen UI views. */
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import { entityVisualSize } from '../content/entity-visual-size';
import { playerGeometry } from '../rendering/player-geometry';
import { quotePlayerRepair } from '../simulation/features/repair';
import { selectPlayerEntity } from '../simulation/model/world-state';
import type { RepairView } from './repair-view';
import type { PlayerSpatialView } from './player-spatial-view';

/** Shallow comparison ignores unrelated publications and retained quote objects. */
export function selectRepairView(state: AppStoreState, gameModule: GameModule): RepairView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const player = selectPlayerEntity(world);
  const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
  const system = gameModule.definition.systems.find(candidate => candidate.id === player.location.systemId);
  if (!vessel || !system) throw new Error('Active repair definitions are unavailable.');
  const offer = player.condition.repairing ? null
    : quotePlayerRepair(world, { vessel, system, rules: gameModule.rules });
  return Object.freeze({ repairing: player.condition.repairing,
    hull: player.condition.hull, shields: player.condition.shields,
    resourceId: offer?.resourceId ?? null, cost: offer?.cost ?? null });
}

/** No world position or mutable renderer object crosses the module capability. */
export function selectPlayerSpatialView(state: AppStoreState, gameModule: GameModule): PlayerSpatialView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const player = selectPlayerEntity(world);
  const visual = gameModule.definition.visuals.entities.find(candidate => candidate.entityDefinitionId === player.definitionId);
  if (!visual) throw new Error('The active ship has no module visual.');
  return playerGeometry(gameModule.definition.viewport, entityVisualSize(visual, 'player'),
    player.location.rotationDegrees, world.cameraZoom);
}
