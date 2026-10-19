/** Project trusted authoritative state without broad entity/world subscriptions. */
import type { AppStoreState } from '../app/app-store';
import { selectPlayerEntity } from '../simulation/model/world-state';
import type { GameHudView } from './game-hud-view';

/** Freeze the focused view; all referenced resources are already schema-frozen. */
export function selectGameHudView(state: AppStoreState): GameHudView | null {
  if (!state.world) return null;
  const player = selectPlayerEntity(state.world);
  return Object.freeze({
    playerDefinitionId: player.definitionId,
    systemId: player.location.systemId,
    hull: player.condition.hull,
    shields: player.condition.shields,
    energy: player.condition.energy,
    weaponDefinitionId: player.armament.weaponDefinitionId,
    cooldownRemainingFrames: player.armament.cooldownRemainingFrames,
    shotSequence: player.armament.shotSequence,
    resources: player.inventory.resources,
    cargoUsed: Object.values(player.inventory.cargo).reduce((total, tons) => total + tons, 0),
    speedPerFrame: player.motion.speedPerFrame,
    flightMode: player.motion.flightMode,
    positionX: player.location.position.x,
    positionY: player.location.position.y,
    zoom: state.world.cameraZoom,
    noticeMessage: player.feedback.notice?.message ?? null,
    noticeSequence: player.feedback.notice?.sequence ?? null,
    repairing: player.condition.repairing,
  });
}
