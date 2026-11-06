/** UI-18's supported output writers. The host owns quantity eligibility and the
 * atomic command; this module only binds its validated offer to source text. */
import type { PurchaseView } from '@engine/ui/purchase-view';
import { PurchaseViewSchema } from '@engine/ui/purchase-view';
import { contactContent } from './contact/contact-content';
import { PurchaseHintSchema, type PurchaseHint } from './contact/contact-controller';
import { layoutHudText } from './hud/hud-glyphs';

/** Source Symbol 3:34761 rollOver/rollOut. Empty entry deliberately avoids
 * fabricating the random NPC greeting copied by Page 1:25841 hail(). */
export function purchaseTexts(purchase: PurchaseView, hint: PurchaseHint) {
  const offer = PurchaseViewSchema.parse(purchase);
  PurchaseHintSchema.parse(hint);
  const shiptext =
    hint === 'offer'
      ? `I have ${offer.stockTons} tons of ${offer.label} if you're interested. Price is firm at ${offer.pricePerTon} per ton.`
      : hint === 'busy'
        ? 'Are we done here? I am on a busy schedule.'
        : '';
  const texts = Object.freeze({ shiptext, buy: 'Buy Goods' });
  const plane = contactContent.planes.find(p => p.id === 'UI-18')!;
  plane.fields.forEach(({ field }) => layoutHudText(field, texts[field.variable as keyof typeof texts] ?? ''));
  return texts;
}
