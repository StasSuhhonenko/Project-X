/** Validate a module atomically before exposing its immutable content or rules. */
import { GAME_RULES_API_VERSION, type GameRules } from '../simulation/contracts/game-rules';
import { SpecialWeaponDefinitionSchema } from '../simulation/contracts/special-weapon-rules';
import { validateStationMembershipState } from '../simulation/features/station-membership';
import { createContentCatalog, type ContentCatalog } from './content-catalog';
import { GameModuleSchema, type GameModuleDefinition } from './schemas/game-module';

export interface GameModule {
  readonly definition: GameModuleDefinition;
  readonly catalog: ContentCatalog;
  readonly rules: GameRules;
}

/** Only reviewed local code may supply rules; JSON cannot name/import executable code. */
export function createGameModule(input: unknown, rules: GameRules): GameModule {
  const definition = GameModuleSchema.parse(input);
  if (
    rules.fleet &&
    (!definition.governments.some(row => row.id === rules.fleet!.ownedGovernmentId) ||
      ['evaluateAcquisition', 'createOwnedShip', 'placeOwnedShip', 'quoteRelease'].some(
        key => typeof rules.fleet![key as keyof typeof rules.fleet] !== 'function'
      ))
  )
    throw Error('Fleet requires a declared owned government and complete policy capability.');
  if (
    rules.missions &&
    (!definition.commerce ||
      !definition.resources.some(resource => resource.id === rules.missions!.paymentResourceId) ||
      [
        'createVisitMissions',
        'resolveContractNegotiation',
        'quoteContractAcceptance',
        'resolveSurfaceMission',
        'canReachSurface',
        'describeContractDelivery',
      ].some(key => typeof rules.missions![key as keyof typeof rules.missions] !== 'function'))
  )
    throw Error('Missions require commerce, a payment resource and the complete policy capability.');
  if (definition.commerce && (!rules.createCargoMarket || !rules.planCargoTransfer))
    throw Error('Commerce requires market and transfer policies.');
  if ((typeof rules.getProjectileFlight === 'function') !== (typeof rules.advanceProjectileMotion === 'function'))
    throw Error('Projectile modules require both flight and motion policies.');
  if (definition.equipment && typeof rules.evaluateEquipmentPrice !== 'function')
    throw Error('Equipment content requires a pricing policy.');
  if (
    rules.apiVersion !== GAME_RULES_API_VERSION ||
    rules.moduleId !== definition.id ||
    typeof rules.updatePlayerMovement !== 'function' ||
    typeof rules.createStartingNpc !== 'function' ||
    (rules.createVisitEncounter !== undefined && typeof rules.createVisitEncounter !== 'function') ||
    typeof rules.updateNpcMovement !== 'function' ||
    typeof rules.evaluatePrimaryFire !== 'function' ||
    typeof rules.resolvePrimaryHit !== 'function' ||
    typeof rules.evaluateRepairStart !== 'function' ||
    typeof rules.updateRepair !== 'function' ||
    (rules.rechargePlayerShields !== undefined && typeof rules.rechargePlayerShields !== 'function') ||
    (rules.createTravelArrival !== undefined && typeof rules.createTravelArrival !== 'function') ||
    typeof rules.estimateTravel !== 'function' ||
    typeof rules.canDepart !== 'function'
  ) {
    throw new Error('Selected module rules do not match the content or engine API.');
  }
  if (
    definition.lifecycle &&
    (typeof rules.resolveStationHit !== 'function' ||
      typeof rules.resolveLifecycleHit !== 'function' ||
      typeof rules.resolveStationMembership !== 'function' ||
      typeof rules.validateStationMembership !== 'function' ||
      (definition.lifecycle.spawnShipDefinitionIds.length > 0 && typeof rules.validateGeneratedActor !== 'function'))
  )
    throw new Error('Selected module lifecycle capabilities require matching validated rules.');
  definition.content.weaponDefinitions.forEach(weapon => {
    const input = rules.getSpecialWeapon?.(weapon.id);
    if (input == null) return;
    const special = SpecialWeaponDefinitionSchema.parse(input);
    if (special.kind === 'cloak' || special.kind === 'no-effect') return;
    if (
      !definition.combatGeometry.specialEffects.some(
        visual => visual.id === special.effectDefinitionId && visual.kind === special.kind
      )
    )
      throw Error('Special weapon visual capability is unavailable.');
    if (special.kind === 'pulse' && !rules.selectSpecialEffectSlots)
      throw Error('Pulse weapons require a source roster policy.');
  });
  // Every fresh session starts with no overrides. Reject an impossible baseline
  // before exposing either content or rules, rather than on the first save/hit.
  validateStationMembershipState([], definition.lifecycle, rules);
  return Object.freeze({
    definition,
    catalog: createContentCatalog(definition.content),
    rules: Object.freeze({
      ...rules,
      ...(rules.fleet ? { fleet: Object.freeze({ ...rules.fleet }) } : {}),
      ...(rules.missions ? { missions: Object.freeze({ ...rules.missions }) } : {}),
    }),
  });
}

/** Fetch only the selected build's document; rejected loads never create a store. */
export async function loadGameModule(rules: GameRules, fetcher: typeof fetch = fetch): Promise<GameModule> {
  const response = await fetcher('/game/module.json');
  if (!response.ok) throw new Error(`Could not load game module: HTTP ${response.status}.`);
  return createGameModule(await response.json(), rules);
}
