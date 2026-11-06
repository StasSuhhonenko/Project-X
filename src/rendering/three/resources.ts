/** Concrete GPU ownership helpers. A resource is disposed once per owner;
 * clone materials are view-owned, while model geometry stays preparation-owned. */
import { BufferGeometry, Material, Mesh, type Object3D } from 'three';

export function createThreeResources() {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  let disposed = false;
  return {
    geometry: <T extends BufferGeometry>(geometry: T): T => {
      geometries.add(geometry);
      return geometry;
    },
    material: <T extends Material>(material: T): T => {
      materials.add(material);
      return material;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      let failure: unknown;
      [...geometries, ...materials].forEach(resource => {
        try {
          resource.dispose();
        } catch (error) {
          failure ??= error;
        }
      });
      geometries.clear();
      materials.clear();
      if (failure) throw failure;
    },
  };
}
export type ThreeResources = ReturnType<typeof createThreeResources>;

export function disposeLoadedModel(root: Object3D): void {
  const resources = createThreeResources();
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    resources.geometry(node.geometry);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => resources.material(material));
  });
  resources.dispose();
}
