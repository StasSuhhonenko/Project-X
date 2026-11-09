/** Authored starting-encounter restore invariants, independent of station scope. */
import type { GameModuleDefinition } from '../content/schemas/game-module';
import { selectPlayerEntity, type NpcShipEntity, type WorldState } from '../simulation/model/world-state';

/**
 * A start can create one authored encounter. Death and travel may remove it,
 * so zero is valid. Visit ships are distinguished by their validated encounter
 * identity and require the module capability; they are never regenerated here.
 * Generated lifecycle actors have their own identity and validation contract.
 *
 * Authored offer identity is immutable. Purchases reduce stock, including to
 * zero, but never replace/remove the offer or replenish its authored ceiling.
 * These guards validate content consistency, not authentication of play history.
 */
export function validateSavedEncounters(
  world: WorldState,
  start: GameModuleDefinition['starts'][number],
  hasVisitEncounters = false
): void {
  const visitShips = world.entities.filter(entity => entity.kind === 'npc-ship' && entity.encounter !== null);
  if (visitShips.length && !hasVisitEncounters)
    throw new Error('Saved visit encounters require the module capability.');
  const encounters = world.entities.filter(
    (entity): entity is NpcShipEntity =>
      entity.kind === 'npc-ship' && entity.generation === null && entity.encounter === null
  );
  if (encounters.length > 1) throw new Error('Save contains more than one authored starting encounter.');
  if (encounters.length === 0) return;

  const actor = encounters[0]!;
  const authored = start.npcSpawn;
  if (
    !authored ||
    actor.definitionId !== authored.shipDefinitionId ||
    actor.governmentId !== authored.governmentId ||
    selectPlayerEntity(world).location.systemId !== start.player.systemId
  )
    throw new Error('Saved encounter actor has no matching authored start or home system.');

  const expectedOffer = authored.tradeOffer ?? null;
  // C6 checks realized supply/demand against the captured creation seed.
  if (actor.tradeSeed !== null) return;
  const offer = actor.tradeOffer;
  if (expectedOffer === null && offer === null) return;
  if (
    !expectedOffer ||
    !offer ||
    offer.goodsId !== expectedOffer.goodsId ||
    offer.label !== expectedOffer.label ||
    offer.pricePerTon !== expectedOffer.pricePerTon ||
    offer.currencyId !== expectedOffer.currencyId ||
    offer.stockTons > expectedOffer.stockTons
  )
    throw new Error('Saved merchant offer differs from its authored identity or stock limit.');
}
