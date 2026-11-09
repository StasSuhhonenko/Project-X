/** Visible consumers of already committed effects. No payment, collision,
 * target acquisition, RNG draw or simulation clock belongs to this adapter. */
import {
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Group,
} from 'three';
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import { specialEffectAppearance, specialEffectBounds } from '../../simulation/geometry/effect-geometry';
import { equipmentArmaments } from '../../simulation/model/equipment-state';
import type { SpecialEffectState } from '../../simulation/model/special-effect-state';
import { selectPlayerEntity, type WorldState } from '../../simulation/model/world-state';
import type { TransformHistory } from '../shared/transform-history';
import type { ThreeSpatialConfiguration } from './configuration';
import { createThreeResources } from './resources';

const up = new Vector3(0, 1, 0);
/** The selected Three skin's existing player-beam lifetime, in committed ticks.
 * All origins share this geometric skin; recovered bitmap skins own their
 * individual authored lifetimes in the Pixi visual configuration. */
const beamDurationTicks = 6;
function segment(mesh: Mesh, start: Vector3, end: Vector3): void {
  const delta = end.clone().sub(start);
  const length = delta.length();
  mesh.visible = length > 0;
  if (!mesh.visible) return;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(up, delta.multiplyScalar(1 / length));
  mesh.scale.set(1, length, 1);
}

export function createThreeEffects(
  initial: WorldState,
  game: GameModuleDefinition,
  config: ThreeSpatialConfiguration,
  parent: Group
) {
  type Binding = { mesh: Mesh; material: MeshBasicMaterial; dispose(): void };
  const bindings = new Map<string, Binding>();
  let current = initial;
  let previous = initial;
  // Latch on every store publication, not on draw: per-tick events may already
  // be cleared when a display frame is due. Initial/restore events are ignored.
  const npcBeams = new Map<string, WorldState['npcBeamEvents'][number]>();
  const binding = (key: string, kind: 'segment' | 'ring' | 'bolt', color: string): Binding => {
    const retained = bindings.get(key);
    if (retained) return retained;
    const owner = createThreeResources();
    const geometry =
      kind === 'segment'
        ? new CylinderGeometry(0.7, 0.7, 1, 8)
        : kind === 'ring'
          ? new RingGeometry(0.9, 1, 64)
          : new SphereGeometry(1.8, 10, 8);
    const material = owner.material(
      new MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: DoubleSide })
    );
    const mesh = new Mesh(owner.geometry(geometry), material);
    if (kind === 'ring') mesh.rotation.x = -Math.PI / 2;
    parent.add(mesh);
    const result = {
      mesh,
      material,
      dispose: () => {
        parent.remove(mesh);
        owner.dispose();
      },
    };
    bindings.set(key, result);
    return result;
  };
  return {
    advance: (world: WorldState) => {
      if (world.tick === current.tick) return;
      previous = current;
      current = world;
      npcBeams.forEach((event, key) => {
        if (
          world.tick - event.tick >= beamDurationTicks ||
          !world.entities.some(actor => actor.id === event.emitterEntityId) ||
          !world.entities.some(
            actor => actor.id === event.targetEntityId && (actor.kind !== 'player-ship' || actor.condition.hull > 0)
          )
        )
          npcBeams.delete(key);
      });
      world.npcBeamEvents.forEach((event, index) => {
        if (
          !world.entities.some(actor => actor.id === event.emitterEntityId) ||
          !world.entities.some(
            actor => actor.id === event.targetEntityId && (actor.kind !== 'player-ship' || actor.condition.hull > 0)
          )
        )
          return;
        npcBeams.set(`npc-beam-${event.tick}-${index}`, event);
      });
    },
    reset: (world: WorldState) => {
      previous = world;
      current = world;
      npcBeams.clear();
      bindings.forEach(item => {
        item.mesh.visible = false;
      });
    },
    render: (alpha: number, history: TransformHistory) => {
      const live = new Set<string>();
      const player = selectPlayerEntity(current);
      // Player and NPC beams share the same selected Three segment art.
      const drawBeam = (key: string, weaponId: number, originId: string, targetId: string) => {
        const weapon = config.weapons.find(item => item.weaponDefinitionId === weaponId);
        if (weapon?.kind !== 'beam') return;
        const start = history.sample(originId, alpha),
          end = history.sample(targetId, alpha);
        if (!start || !end) return;
        live.add(key);
        const mesh = binding(key, 'segment', weapon.color).mesh;
        segment(mesh, new Vector3(start.x, 5, start.y), new Vector3(end.x, 5, end.y));
      };
      npcBeams.forEach((event, key) =>
        drawBeam(key, event.weaponDefinitionId, event.emitterEntityId, event.targetEntityId)
      );
      equipmentArmaments(player).forEach((channel, index) => {
        const shot = channel.lastAcceptedShot;
        const weapon = shot && config.weapons.find(item => item.weaponDefinitionId === shot.weaponDefinitionId);
        if (!shot || weapon?.kind !== 'beam' || current.tick - shot.tick >= beamDurationTicks || !shot.targetEntityId)
          return;
        drawBeam(`beam-${index}-${shot.tick}`, shot.weaponDefinitionId, player.id, shot.targetEntityId);
      });
      current.projectiles.forEach(projectile => {
        const old = previous.projectiles.find(item => item.id === projectile.id) ?? projectile;
        const weapon = config.weapons.find(item => item.weaponDefinitionId === projectile.weaponDefinitionId)!;
        const layers = projectile.impactAgeTicks === null ? (weapon.projectileLayers ?? [null]) : [null];
        const heading =
          ((old.rotationDegrees + (projectile.rotationDegrees - old.rotationDegrees) * alpha) * Math.PI) / 180;
        // Three retains its geometric proxy style. Every authored bitmap becomes
        // one proxy at its transformed image center, rotated with the shot.
        layers.forEach((layer, index) => {
          const key = `${projectile.id}-layer-${index}`;
          const item = binding(key, 'bolt', weapon.color);
          live.add(key);
          const m = layer?.bitmapTransform;
          const x = m && layer ? (m[0] * layer.nativeSize.width) / 2 + (m[2] * layer.nativeSize.height) / 2 + m[4] : 0;
          const y = m && layer ? (m[1] * layer.nativeSize.width) / 2 + (m[3] * layer.nativeSize.height) / 2 + m[5] : 0;
          item.mesh.position.set(
            old.position.x +
              (projectile.position.x - old.position.x) * alpha +
              x * Math.cos(heading) -
              y * Math.sin(heading),
            5,
            old.position.y +
              (projectile.position.y - old.position.y) * alpha +
              x * Math.sin(heading) +
              y * Math.cos(heading)
          );
          item.mesh.scale.setScalar(projectile.impactAgeTicks === null ? 1 : 2 + projectile.impactAgeTicks * 0.4);
          item.material.opacity = projectile.impactAgeTicks === null ? 1 : 0.75;
        });
      });
      current.specialEffects.forEach(effect => {
        const color = config.effects.find(item => item.effectDefinitionId === effect.effectDefinitionId)!.color;
        live.add(effect.id);
        if (effect.kind === 'tractor') {
          const item = binding(effect.id, 'segment', color);
          const start = history.sample(effect.emitterEntityId, alpha),
            end = history.sample(effect.targetEntityId, alpha);
          item.mesh.visible = Boolean(start && end);
          if (start && end) segment(item.mesh, new Vector3(start.x, 5, start.y), new Vector3(end.x, 5, end.y));
          item.material.opacity = 0.6;
          return;
        }
        const old = previous.specialEffects.find(item => item.id === effect.id);
        const sampled: SpecialEffectState =
          old?.kind === 'pulse'
            ? {
                ...effect,
                ageTicks: old.ageTicks + (effect.ageTicks - old.ageTicks) * alpha,
                scalePercent: old.scalePercent + (effect.scalePercent - old.scalePercent) * alpha,
                alphaPercent: old.alphaPercent + (effect.alphaPercent - old.alphaPercent) * alpha,
              }
            : effect;
        const geometry = game.combatGeometry.specialEffects.find(item => item.id === effect.effectDefinitionId)!;
        const bounds = specialEffectBounds(sampled, geometry);
        const item = binding(effect.id, 'ring', color);
        item.mesh.visible = bounds !== null;
        item.material.opacity = specialEffectAppearance(sampled, geometry).alpha;
        if (!bounds) return;
        item.mesh.position.set((bounds.left + bounds.right) / 2, 1, (bounds.top + bounds.bottom) / 2);
        item.mesh.scale.set((bounds.right - bounds.left) / 2, (bounds.bottom - bounds.top) / 2, 1);
      });
      bindings.forEach((item, id) => {
        if (live.has(id)) return;
        item.dispose();
        bindings.delete(id);
      });
    },
    dispose: () => {
      bindings.forEach(item => item.dispose());
      bindings.clear();
    },
  };
}
