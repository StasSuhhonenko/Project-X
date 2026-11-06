/** Source display arithmetic only. No target command or simulation state can
 * be mutated here; NPC strength is hull; station strength uses its supplied scalar. */
import { z } from 'zod';
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { SelectedTargetView } from '@engine/ui/selected-target-view';
import { TacticalAssetSchema, tacticalContent } from './tactical-content';

/** Frozen display-only projection, with finite source transform values. */
export const TacticalReadModelSchema = z
  .object({
    id: z.string(),
    asset: TacticalAssetSchema,
    label: z.string(),
    coverPercent: z.number().finite().nullable(),
    disabled: z.boolean(),
    arrowDegrees: z.number().finite(),
  })
  .strict()
  .readonly();
export type TacticalReadModel = z.infer<typeof TacticalReadModelSchema>;

/** Projects immutable host data to source display values. Throws for missing
 * definitions, unstaged previews or invalid capacities so readiness can fail
 * visibly. Angles use clockwise degrees; coverPercent intentionally may exceed
 * 0..100. Missing runtime station condition remains explicitly unknown. */
export function createTacticalReadModel(
  target: SelectedTargetView | null,
  definition: GameModuleDefinition
): TacticalReadModel | null {
  if (!target) return null;
  const entity = definition.content.entityDefinitions.find(e => e.id === target.definitionId);
  const preview = tacticalContent.previews.find(p => p.definitionId === target.definitionId);
  if (!entity || !preview) throw new Error('Selected target artwork or definition is unavailable');
  const maximumHull = entity.maximumHull;
  if (target.kind === 'npc-ship' && (!Number.isFinite(maximumHull) || maximumHull <= 0))
    throw new Error('Target strength requires positive capacity');
  const ratio =
    target.kind === 'npc-ship'
      ? target.hull / maximumHull
      : target.combat
        ? target.combat.strength / target.combat.maximumStrength
        : null;
  return TacticalReadModelSchema.parse({
    id: target.id,
    asset: preview.asset,
    label: target.kind === 'npc-ship' ? (target.displayName ?? entity.name) : entity.name,
    // Absent condition stays blank/covered as an explicit unknown,
    // not an invented full-strength value. DISABLED needs an evidenced ratio.
    coverPercent: ratio === null ? null : 100 - ratio * 100,
    disabled: ratio !== null && ratio * 100 < 5,
    arrowDegrees: Math.round((Math.atan2(target.relativeY, target.relativeX) * 180) / Math.PI) + 90,
  });
}
