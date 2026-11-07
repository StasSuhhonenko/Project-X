/** Source receiver strings: Symbol3:40563 rollover/accept; Page1:25841:1031;
 * Symbol3:10214 negotiation. Quotes/outcomes always come from MissionView. */
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { MissionView } from '@engine/ui/mission-view';

export type DisplayedContract = MissionView['offers'][number];
export const negotiationLoss =
  'You demand more latinum for the cargo run, but they just shake their heads and show you to the door. Your greed has lost you this opportunity.';
export const negotiationSuccess = 'You skillfully negotiate a better price for this cargo run.';
export const podRefusal = 'You have no more cargo pods to place this cargo into. Dump some cargo.';
export function contractTexts(
  contract: DisplayedContract | null,
  definition: GameModuleDefinition,
  population: number,
  planet: boolean
) {
  if (!contract) return { name: '', description: planet ? 'No trade offers here.' : 'There are no trade offers here.' };
  if (planet && population <= 0) return { name: '', description: 'There is no one to trade with here.' };
  const offer = contract.offer;
  const name = `${offer.tons} tons of ${definition.commerce?.goods.find(g => g.id === offer.goodsId)?.label}`;
  const destination = definition.systems.find(s => s.id === offer.destinationSystemId)!.name;
  const hazard = planet && offer.hazardPayPerTon > 0 ? ` + ${offer.hazardPayPerTon} bars per ton in hazard pay` : '';
  return {
    name,
    description: `Transport this cargo to ${destination}. You will be paid ${offer.basePayPerTon} bars of latinum per ton of cargo you can deliver${hazard}.`,
  };
}
export function acceptanceText(contract: DisplayedContract): string {
  if (!contract.acceptance) return podRefusal;
  if ('refusal' in contract.acceptance) return contract.acceptance.refusal;
  return `${contract.acceptance.tons} tons of this cargo has been loaded onto your ship. Payment upon arrival will be ${contract.acceptance.payout}.`;
}
