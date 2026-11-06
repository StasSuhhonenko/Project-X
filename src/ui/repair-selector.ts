/** Adapt authoritative repair and spatial facts into narrow frozen UI views. */
import type { AppStoreState } from '../app/app-store';
import type { GameModule } from '../content/game-module';
import type { SpatialPresentation } from '../rendering/contracts/spatial-presentation';
import { quotePlayerRepair } from '../simulation/features/repair';
import { selectPlayerEntity } from '../simulation/model/world-state';
import type { PlayerSpatialView } from './player-spatial-view';
import type { RepairView } from './repair-view';

/** Shallow comparison ignores unrelated publications and retained quote objects. */
export function selectRepairView(state: AppStoreState, gameModule: GameModule): RepairView | null {
  const world = state.world;
  if (!world || world.status !== 'active') return null;
  const player = selectPlayerEntity(world);
  const vessel = gameModule.catalog.getShipDefinition(player.definitionId);
  const system = gameModule.definition.systems.find(candidate => candidate.id === player.location.systemId);
  if (!vessel || !system) throw new Error('Active repair definitions are unavailable.');
  const offer = player.condition.repairing
    ? null
    : quotePlayerRepair(world, { vessel, system, rules: gameModule.rules });
  return Object.freeze({
    repairing: player.condition.repairing,
    hull: player.condition.hull,
    shields: player.condition.shields,
    resourceId: offer?.resourceId ?? null,
    cost: offer?.cost ?? null,
  });
}

/** Optional committed-snapshot geometry supplied by the selected presentation. */
export function selectPlayerSpatialView(
  state: AppStoreState,
  projectPlayer: SpatialPresentation['projectPlayer']
): PlayerSpatialView | null {
  if (!state.world || state.world.status !== 'active') return null;
  return projectPlayer?.(state.world) ?? null;
}
