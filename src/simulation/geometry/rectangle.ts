/** Rotated world AABB, preserving authored registration and inclusive edge tests. */
import type { Position } from '../model/entity-components';

export function rectangleBounds(position:Position,rotationDegrees:number,size:Position,pivot:Position) {
  const angle=rotationDegrees*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  const corners=[[0,0],[size.x,0],[size.x,size.y],[0,size.y]].map(([x,y])=>{
    const dx=x!-pivot.x*size.x,dy=y!-pivot.y*size.y;
    return {x:position.x+dx*cos-dy*sin,y:position.y+dx*sin+dy*cos};
  });
  if (!corners.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))) throw Error('Projectile collision geometry overflow.');
  return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
    top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
}

