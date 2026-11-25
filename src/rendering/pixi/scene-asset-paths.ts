/** One asset inventory for scene creation and precommit travel readiness. */
import { equipmentArmaments } from '../../simulation/model/equipment-state';
import { selectPlayerEntity, type WorldState } from '../../simulation/model/world-state';
import type { PixiSceneDefinition as GameModuleDefinition } from './configuration';

/**
 * Include living actors and every ship the module's lifecycle may generate.
 * Loading those bounded capabilities before play avoids asynchronous texture
 * acquisition during an already committed death. Paths are module-owned; shared
 * code knows no ship identities. Duplicates share Pixi's cached texture.
 */
export function sceneAssetPaths(world: WorldState, definition: GameModuleDefinition): readonly string[] {
  const entityImage = (definitionId: number): string => {
    const visual = definition.visuals.entities.find(candidate => candidate.entityDefinitionId === definitionId);
    if (!visual) throw new Error(`Scene entity definition ${definitionId} has no visual.`);
    return visual.image;
  };
  const paths = world.entities.map(entity => {
    if (entity.kind === 'station' && entity.construction === 'pending') {
      if (!definition.visuals.constructionSite) throw Error('Pending site visual is unavailable.');
      return definition.visuals.constructionSite.image;
    }
    if (entity.kind !== 'planet') return entityImage(entity.definitionId);
    const system = definition.systems.find(candidate => candidate.id === entity.location.systemId);
    const visual = definition.visuals.planets.find(candidate => candidate.visualTypeId === system?.planet.visualTypeId);
    if (!visual) throw new Error('Scene planet visual is missing.');
    return visual.image;
  });
  const player = selectPlayerEntity(world);
  const constructionSite = definition.visuals.constructionSite;
  if (constructionSite) {
    paths.push(constructionSite.image, ...(constructionSite.animation?.artwork.map(art => art.image) ?? []));
  }
  const availableWeapons = new Set(
    definition.equipment?.supportedWeaponIds ?? equipmentArmaments(player).map(armament => armament.weaponDefinitionId)
  );
  // NPCs and station fallback weapons can use any declared beam family.
  definition.visuals.weaponBeams.forEach(beam =>
    paths.push(beam.image, ...(beam.frames?.flatMap(frame => frame.layers.map(layer => layer.image)) ?? []))
  );
  const projectileWeapons = new Set([
    ...availableWeapons,
    ...world.projectiles.map(projectile => projectile.weaponDefinitionId),
  ]);
  definition.visuals.weaponProjectiles
    .filter(visual => projectileWeapons.has(visual.weaponDefinitionId))
    .forEach(visual => {
      paths.push(
        visual.image,
        ...(visual.layers?.map(layer => layer.image) ?? []),
        ...visual.impactFrames.map(frame => frame.image)
      );
    });
  // Special art is a bounded module capability. Preload every authored layer
  // so a saved field survives refit and pose changes need no asynchronous load.
  definition.visuals.specialEffects.forEach(visual => {
    paths.push(...visual.layers.map(layer => layer.image));
  });
  // Replacement flash art is a small bounded set; preload it with the scene so
  // a first hit never waits on an asynchronous texture load.
  definition.visuals.shieldFlash?.entities.forEach(entry => {
    if (entry.artwork) paths.push(entry.artwork.image);
  });
  // Any actor may begin warping out mid-visit; its flash must already be loaded.
  if (definition.visuals.departure?.flash) paths.push(definition.visuals.departure.flash.image);
  // Every lifecycle-generated ship, in every system. The engine does not
  // restrict where a death may spawn (a module's replacement rule can fire in
  // a system without authored stations), so gating this on station records
  // crashed the committed view when such a spawn appeared (2026-11-25: BM1
  // boarding self-destruct in a station-less system). The set is bounded and
  // Pixi caches it across scenes.
  paths.push(...(definition.lifecycle?.spawnShipDefinitionIds.map(entityImage) ?? []));
  // Ships a command can add to this committed scene without remounting it:
  // fleet acquisitions from this system's planet or station offers, and owned
  // roster ships (stowed-craft launch). The live view binds such actors on its
  // next world publication; a missing texture there throws inside the store's
  // publication. Offers without a visual cannot be acquired (their purchase
  // preflight has no art), so they are skipped rather than treated as errors.
  const system = definition.systems.find(candidate => candidate.id === player.location.systemId);
  const acquirable = [
    ...(system?.planet.offeredEntityDefinitionIds ?? []),
    ...(system?.stations.flatMap(station => station.shipOffers ?? []) ?? []),
    ...(world.fleet?.ships.map(ship => ship.definitionId) ?? []),
  ];
  acquirable.forEach(definitionId => {
    if (definitionId === null) return;
    const visual = definition.visuals.entities.find(candidate => candidate.entityDefinitionId === definitionId);
    if (visual) paths.push(visual.image);
  });
  return Object.freeze([...new Set(paths)]);
}
