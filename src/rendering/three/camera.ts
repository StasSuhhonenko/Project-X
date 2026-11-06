/** Planar simulation maps (x,y) to Three (x,0,z=y). Zero heading points -Z;
 * clockwise simulation heading maps to negative right-handed rotation about Y.
 * Camera construction is synchronous and requires no DOM or WebGL context. */
import { OrthographicCamera, Vector3 } from 'three';
import type { Position } from '../../simulation/model/entity-components';
import type { ThreeSpatialConfiguration } from './configuration';

export const modelYaw = (headingDegrees: number) => (-headingDegrees * Math.PI) / 180;

export function createThreeCamera(
  config: ThreeSpatialConfiguration['camera'],
  viewport: Readonly<{ width: number; height: number }>
) {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
  const target = new Vector3();
  const elevation = (config.elevationDegrees * Math.PI) / 180;
  const azimuth = (config.azimuthDegrees * Math.PI) / 180;
  const offset = new Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation)
  ).multiplyScalar(2000);
  const update = (player: Position, gameplayZoom: number) => {
    const units = config.worldUnitsPerPixel * gameplayZoom;
    camera.left = (-viewport.width * units) / 2;
    camera.right = -camera.left;
    camera.top = (viewport.height * units) / 2;
    camera.bottom = -camera.top;
    target.set(player.x, 0, player.y);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  };
  update({ x: 0, y: 0 }, 1);
  return {
    camera,
    update,
    project: (point: Position, height = 0) => {
      const projected = new Vector3(point.x, height, point.y).project(camera);
      return { x: ((projected.x + 1) * viewport.width) / 2, y: ((1 - projected.y) * viewport.height) / 2 };
    },
  };
}
