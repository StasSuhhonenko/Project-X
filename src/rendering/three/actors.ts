/** Small concrete proof forms; no general mesh/material framework. */
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry,
  type Object3D } from 'three';
import type { WorldState } from '../../simulation/model/world-state';
import { createThreeResources } from './resources';
import type { ThreeSpatialConfiguration } from './configuration';

export function createThreeActor(entity: WorldState['entities'][number], config: ThreeSpatialConfiguration, model: Object3D) {
  const resources = createThreeResources();
  const root = new Group();
  root.userData.entityId = entity.id;
  const materials: MeshStandardMaterial[] = [];
  const material = (color: string) => {
    const result = resources.material(new MeshStandardMaterial({ color, roughness: .55, metalness: .25, transparent: true }));
    materials.push(result); return result;
  };
  const mesh = (geometry: BoxGeometry | ConeGeometry | CylinderGeometry | SphereGeometry, color: string) => {
    const result = new Mesh(resources.geometry(geometry), material(color));
    root.add(result); return result;
  };
  if (entity.kind === 'planet') {
    mesh(new SphereGeometry(config.planet.radius, 24, 16), config.planet.color);
    return { root, materials, dispose: resources.dispose };
  }
  const mapping = config.entities.find(item => item.entityDefinitionId === entity.definitionId);
  if (!mapping) throw new Error('Actor presentation is unavailable.');
  if (mapping.shape === 'model') {
    const clone = model.clone(true);
    clone.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const copy = material(mapping.color);
      node.material = copy;
    });
    root.add(clone);
  }
  if (mapping.shape === 'ship') {
    const hull = mesh(new ConeGeometry(.5, 1, 4), mapping.color);
    hull.rotation.x = -Math.PI / 2;
    mesh(new BoxGeometry(.8, .15, .3), mapping.color).position.z = .2;
  }
  if (mapping.shape === 'station') {
    mesh(new CylinderGeometry(.4, .4, .4, 16), mapping.color);
    mesh(new BoxGeometry(1, .1, .12), mapping.color);
    mesh(new BoxGeometry(.12, .1, 1), mapping.color);
  }
  root.scale.set(mapping.size.x, mapping.size.y, mapping.size.z);
  return { root, materials, dispose: resources.dispose };
}
