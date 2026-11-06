/** Source HUD refusal writers. No economic eligibility is inferred here. */
import type { CargoTradeRefusal } from '@engine/simulation/model/cargo-transactions';

export function cargoTradeRefusalMessage(refusal: CargoTradeRefusal | null): string {
  if (refusal === 'funds') return 'You do not have enough latinum.';
  if (refusal === 'capacity') return 'You do not have enough cargo space.';
  if (refusal === 'positions') return 'You have no more cargo pods to place this cargo into.';
  if (refusal === 'stock') return 'There is not enough cargo left to buy.';
  return refusal ? 'Cargo transfer is unavailable.' : '';
}
