/** Renderer-independent displayed-bounds collision. Authored bitmap geometry
 * comes from validated module data; rotation is clockwise in a Y-down world. */
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import { entityCombatGeometry } from '../geometry/combat-geometry';
import { rectangleBounds } from '../geometry/rectangle';
import type { ProjectileState } from '../model/projectile-state';
import type { NpcShipEntity, PlayerShipEntity, StationEntity } from '../model/world-state';

export function projectileOverlapsTarget(
  projectile: ProjectileState,
  target: NpcShipEntity | StationEntity | PlayerShipEntity,
  visuals: GameModuleDefinition['combatGeometry']
): boolean {
  const shot = visuals.projectiles.find(visual => visual.weaponDefinitionId === projectile.weaponDefinitionId);
  const actor = visuals.entities.find(visual => visual.entityDefinitionId === target.definitionId);
  if (!shot || !actor) throw Error('Projectile or target collision visual is unavailable.');
  const size = entityCombatGeometry(visuals, target.definitionId, target.kind === 'player-ship').size;
  const a = rectangleBounds(
    projectile.position,
    projectile.rotationDegrees,
    { x: shot.size.width, y: shot.size.height },
    shot.pivot
  );
  const b = rectangleBounds(
    target.location.position,
    target.location.rotationDegrees,
    { x: size.width, y: size.height },
    actor.pivot
  );
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}
