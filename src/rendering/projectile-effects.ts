/** View-owned interpolation and source impact ink for authoritative projectiles.
 * Restoring a save draws its live shots without replaying emission or damage. */
import { Container, Sprite, type Texture } from 'pixi.js';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { WorldState } from '../simulation/model/world-state';
import type { ProjectileState } from '../simulation/model/projectile-state';
import type { PresentationTransform } from './transform-history';
import { worldToScreen } from './world-camera';

export function createProjectileEffects(initialWorld:WorldState,definition:GameModuleDefinition,textures:ReadonlyMap<string,Texture>) {
  const container=new Container();
  const sprites=new Map<string,Sprite>();
  let current=initialWorld.projectiles;
  let tick=initialWorld.tick;
  let previous=new Map(current.map(projectile=>[projectile.id,projectile]));
  const synchronize=(world:WorldState,reset=false)=>{
    if (!reset && world.tick===tick) return;
    tick=world.tick;
    previous=new Map((reset?world.projectiles:current).map(projectile=>[projectile.id,projectile]));
    current=world.projectiles;
    const ids=new Set(current.map(projectile=>projectile.id));
    sprites.forEach((sprite,id)=>{if(!ids.has(id)){sprite.destroy();sprites.delete(id);}});
  };
  return Object.freeze({
    container,
    advance:(world:WorldState)=>synchronize(world),
    reset:(world:WorldState)=>synchronize(world,true),
    render:(alpha:number,player:PresentationTransform,zoom:number)=>{
      current.forEach((projectile:ProjectileState)=>{
        const visual=definition.visuals.weaponProjectiles.find(visual=>visual.weaponDefinitionId===projectile.weaponDefinitionId);
        if(!visual)throw Error('Projectile visual is unavailable.');
        const image=projectile.impactAgeTicks===null?visual:
          visual.impactFrames.filter(frame=>frame.firstImpactAgeTicks<=projectile.impactAgeTicks!).at(-1);
        let sprite=sprites.get(projectile.id);
        if(!image){if(sprite)sprite.visible=false;return;}
        const texture=textures.get(image.image);
        if(!texture)throw Error('Projectile image was not preloaded.');
        if(!sprite){sprite=new Sprite(texture);sprites.set(projectile.id,sprite);container.addChild(sprite);}
        sprite.texture=texture;
        sprite.visible=true;
        const prior=previous.get(projectile.id)??projectile;
        const position={x:prior.position.x+(projectile.position.x-prior.position.x)*alpha,
          y:prior.position.y+(projectile.position.y-prior.position.y)*alpha};
        const screen=worldToScreen(position,player,definition.viewport,zoom);
        sprite.position.set(screen.x,screen.y);
        sprite.anchor.set(image.pivot.x,image.pivot.y);
        sprite.width=image.logicalSize.width/zoom;sprite.height=image.logicalSize.height/zoom;
        sprite.rotation=(prior.rotationDegrees+(projectile.rotationDegrees-prior.rotationDegrees)*alpha)*Math.PI/180;
      });
    },
  });
}
