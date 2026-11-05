/** Renderer-independent displayed-bounds collision. Authored bitmap geometry
 * comes from validated module data; rotation is clockwise in a Y-down world. */
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import { entityVisualSize } from '../../content/entity-visual-size';
import type { Position } from '../model/entity-components';
import type { ProjectileState } from '../model/projectile-state';
import type { NpcShipEntity, StationEntity } from '../model/world-state';

function bounds(position:Position,rotationDegrees:number,size:Position,pivot:Position) {
  const angle=rotationDegrees*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  const corners=[[0,0],[size.x,0],[size.x,size.y],[0,size.y]].map(([x,y])=>{
    const dx=x!-pivot.x*size.x,dy=y!-pivot.y*size.y;
    return {x:position.x+dx*cos-dy*sin,y:position.y+dx*sin+dy*cos};
  });
  if (!corners.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))) throw Error('Projectile collision geometry overflow.');
  return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
    top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
}

export function projectileOverlapsTarget(projectile:ProjectileState,target:NpcShipEntity|StationEntity,
  visuals:GameModuleDefinition['visuals']):boolean {
  const shot=visuals.weaponProjectiles.find(visual=>visual.weaponDefinitionId===projectile.weaponDefinitionId);
  const actor=visuals.entities.find(visual=>visual.entityDefinitionId===target.definitionId);
  if (!shot || !actor) throw Error('Projectile or target collision visual is unavailable.');
  const size=entityVisualSize(actor);
  const a=bounds(projectile.position,projectile.rotationDegrees,{x:shot.logicalSize.width,y:shot.logicalSize.height},shot.pivot);
  const b=bounds(target.location.position,target.location.rotationDegrees,{x:size.width,y:size.height},actor.pivot);
  return a.left<=b.right && a.right>=b.left && a.top<=b.bottom && a.bottom>=b.top;
}
