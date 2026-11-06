/** Read-only source receiver projection. Unimplemented actor identity, portrait,
 * generated offers and messages remain absent rather than using gallery inputs. */
import type { GameModuleDefinition } from '../../../../src/content/schemas/game-module';
import type { PlanetContactView, SelectedContactView } from '../../../../src/ui/contact-view';
import { z } from 'zod';
import { contactContent, ContactAssetSchema, ContactPlaneSchema } from './contact-content';
import { layoutHudText } from '../hud/hud-glyphs';
import type { PurchaseView } from '../../../../src/ui/purchase-view';
import { purchaseTexts } from '../purchase-read-model';
import type { PurchaseHint } from './contact-controller';
import { unownedWorldContent } from '../../unowned-world-content';
import type { CommodityMarketView } from '../../../../src/ui/cargo-trade-view';

/** A frozen, glyph-preflighted contact presentation without simulation handles. */
export const ContactReadModelSchema = z.object({
  kind: z.enum(['planet', 'station', 'npc-ship']), id: z.string().min(1), plane: ContactPlaneSchema,
  asset: ContactAssetSchema.nullable(), texts: z.record(z.string(), z.string()).readonly(),
}).strict().readonly();
export type ContactReadModel = z.infer<typeof ContactReadModelSchema>;

/** Resolves immutable content into source receivers. Missing content or glyphs
 * throw before publication; unavailable simulation values stay absent. Returned
 * planes, transforms and text are frozen and grant no gameplay mutation access. */
export function createContactReadModel(contact: PlanetContactView | SelectedContactView, definition: GameModuleDefinition,
  purchase: PurchaseView | null = null, purchaseHint: PurchaseHint = 'none', market:CommodityMarketView|null=null) {
  const system = definition.systems.find(s => s.id === contact.systemId);
  if (!system) throw new Error('Contact system is unavailable');
  const id = contact.kind === 'planet' ? 'UI-17' : contact.kind === 'station' ? 'UI-19' : 'UI-18';
  const plane = contactContent.planes.find(p => p.id === id)!;
  let texts: Readonly<Record<string, string>> = {};
  let asset: string | null = null;
  if (contact.kind === 'planet') {
    const art = contactContent.planets.find(p => p.systemId === system.id && p.surfaceTypeId === system.planet.surfaceTypeId);
    const governmentName = system.governmentId === null ? unownedWorldContent.governmentLabel
      : definition.governments.find(g => g.id === system.governmentId)?.name;
    if (!art || !governmentName) throw new Error('Contact planet artwork or government is unavailable');
    asset = art.asset;
    texts = { commname: system.name, commtext: system.planet.description, govttype: governmentName,
      ...(contact.strength !== null && contact.strength !== undefined ? { strength: `Strength: ${contact.strength}` } : {}) };
    // Strength comes from the frozen current-world projection, including signed
    // exhaustion. Population still lacks a mutable current-world contract.
  }
  if (contact.kind === 'station') {
    const placement = system.stations.find(s => s.id === contact.stationId && s.structureDefinitionId === contact.definitionId);
    const art = contactContent.stations.find(s => s.definitionId === contact.definitionId);
    if (!placement || !art) throw new Error('Contact station artwork or placement is unavailable');
    asset = art.asset;
    texts = { stationname: `${placement.name} - ${art.typeLabel}` };
  }
  if (contact.kind === 'npc-ship') {
    const ship = definition.content.entityDefinitions.find(e => e.id === contact.definitionId && e.category === 'ship');
    if (!ship) throw new Error('Contact ship definition is unavailable');
    texts = { shipclass: ship.name, ...(contact.displayName ? { shipname: contact.displayName } : {}) };
    if (purchase) {
      if (purchase.merchantEntityId !== contact.id || purchase.merchantDefinitionId !== contact.definitionId || purchase.systemId !== contact.systemId) throw new Error('Purchase contact identity is unavailable');
      texts = { ...texts, ...purchaseTexts(purchase, purchaseHint) };
    }
    if(market?.merchantEntityId===contact.id && market.systemId===contact.systemId && market.rows.some(row=>row.sell))texts={...texts,sell:'Sell Goods'};
    const demand = market?.merchantEntityId === contact.id ? market.rows.find(row => row.sell) : null;
    if (purchaseHint === 'demand' && demand) texts = { ...texts,
      shiptext: `I am in the market for up to ${demand.advertisedTons} tons of ${demand.label}. If you have some I'll gladly buy them for ${demand.pricePerTon} bars per ton.` };
  }
  plane.fields.forEach(({ field }) => layoutHudText(field, texts[field.variable] ?? ''));
  return ContactReadModelSchema.parse({ kind: contact.kind, id: contact.id, plane, asset, texts });
}
