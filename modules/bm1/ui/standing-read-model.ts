/** Page-1-25841.as:193 writes the existing localprestige receiver. */
import type { SystemStandingView } from '@engine/ui/system-standing-view';

/** Signed values remain signed; floor deliberately rounds negative fractions down. */
export function localPrestigeText(standing: SystemStandingView | null): string {
  return standing ? `Local Prestige: ${Math.floor(standing.value)}%` : '';
}
