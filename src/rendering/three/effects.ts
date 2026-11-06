/** Visible consumers of already committed effects. No payment, collision,
 * target acquisition, RNG draw or simulation clock belongs to this adapter. */
import { CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, Vector3, type Group } from 'three';
import type { GameModuleDefinition } from '../../content/schemas/game-module';
import { equipmentArmaments } from '../../simulation/model/equipment-state';
import { selectPlayerEntity, type WorldState } from '../../simulation/model/world-state';
import { specialEffectAppearance, specialEffectBounds } from '../../simulation/geometry/effect-geometry';
import type { SpecialEffectState } from '../../simulation/model/special-effect-state';
import type { TransformHistory } from '../shared/transform-history';
import { createThreeResources } from './resources';
import type { ThreeSpatialConfiguration } from './configuration';

const up = new Vector3(0, 1, 0);
function segment(mesh: Mesh, start: Vector3, end: Vector3): void {
  const delta = end.clone().sub(start);
  const length = delta.length();
  mesh.visible = length > 0;
  if (!mesh.visible) return;
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(up, delta.multiplyScalar(1 / length));
  mesh.scale.set(1, length, 1);
}

export function createThreeEffects(initial: WorldState, game: GameModuleDefinition,
  config: ThreeSpatialConfiguration, parent: Group) {
  type Binding = { mesh: Mesh; material: MeshBasicMaterial; dispose(): void };
  const bindings = new Map<string, Binding>();
  let current = initial;
  let previous = initial;
  const binding = (key: string, kind: 'segment' | 'ring' | 'bolt', color: string): Binding => {
    const retained = bindings.get(key);
    if (retained) return retained;
    const owner = createThreeResources();
    const geometry = kind === 'segment' ? new CylinderGeometry(.7, .7, 1, 8)
      : kind === 'ring' ? new RingGeometry(.9, 1, 64) : new SphereGeometry(1.8, 10, 8);
    const material = owner.material(new MeshBasicMaterial({ color, transparent: true, depthWrite: false,
      side: DoubleSide }));
    const mesh = new Mesh(owner.geometry(geometry), material);
    if (kind === 'ring') mesh.rotation.x = -Math.PI / 2;
    parent.add(mesh);
    const result = { mesh, material, dispose: () => { parent.remove(mesh); owner.dispose(); } };
    bindings.set(key, result);
    return result;
  };
  return {
    advance: (world: WorldState) => {
      if (world.tick === current.tick) return;
      previous = current; current = world;
    },
    reset: (world: WorldState) => { previous = world; current = world; },
    render: (alpha: number, history: TransformHistory) => {
      const live = new Set<string>();
      const player = selectPlayerEntity(current);
      equipmentArmaments(player).forEach((channel, index) => {
        const shot = channel.lastAcceptedShot;
        const weapon = shot && config.weapons.find(item => item.weaponDefinitionId === shot.weaponDefinitionId);
        if (!shot || weapon?.kind !== 'beam' || current.tick - shot.tick >= 6 || !shot.targetEntityId) return;
        const start = history.sample(player.id, alpha), end = history.sample(shot.targetEntityId, alpha);
        if (!start || !end) return;
        const key = `beam-${index}-${shot.tick}`;
        live.add(key);
        segment(binding(key, 'segment', weapon.color).mesh, new Vector3(start.x, 5, start.y), new Vector3(end.x, 5, end.y));
      });
      current.projectiles.forEach(projectile => {
        const old = previous.projectiles.find(item => item.id === projectile.id) ?? projectile;
        const color = config.weapons.find(item => item.weaponDefinitionId === projectile.weaponDefinitionId)!.color;
        const item = binding(projectile.id, 'bolt', color);
        live.add(projectile.id);
        item.mesh.position.set(old.position.x + (projectile.position.x - old.position.x) * alpha, 5,
          old.position.y + (projectile.position.y - old.position.y) * alpha);
        item.mesh.scale.setScalar(projectile.impactAgeTicks === null ? 1 : 2 + projectile.impactAgeTicks * .4);
        item.material.opacity = projectile.impactAgeTicks === null ? 1 : .75;
      });
      current.specialEffects.forEach(effect => {
        const color = config.effects.find(item => item.effectDefinitionId === effect.effectDefinitionId)!.color;
        live.add(effect.id);
        if (effect.kind === 'tractor') {
          const item = binding(effect.id, 'segment', color);
          const start = history.sample(effect.emitterEntityId, alpha), end = history.sample(effect.targetEntityId, alpha);
          item.mesh.visible = Boolean(start && end);
          if (start && end) segment(item.mesh, new Vector3(start.x, 5, start.y), new Vector3(end.x, 5, end.y));
          item.material.opacity = .6;
          return;
        }
        const old = previous.specialEffects.find(item => item.id === effect.id);
        const sampled: SpecialEffectState = old?.kind === 'pulse' ? { ...effect,
          ageTicks: old.ageTicks + (effect.ageTicks - old.ageTicks) * alpha,
          scalePercent: old.scalePercent + (effect.scalePercent - old.scalePercent) * alpha,
          alphaPercent: old.alphaPercent + (effect.alphaPercent - old.alphaPercent) * alpha } : effect;
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
        item.dispose(); bindings.delete(id);
      });
    },
    dispose: () => { bindings.forEach(item => item.dispose()); bindings.clear(); },
  };
}
