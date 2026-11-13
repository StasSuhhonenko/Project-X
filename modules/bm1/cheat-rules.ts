/** Exact Symbol-3-3520.as release predicates, in source order (lines 2–85).
 * Outputs are absolute assignments; the host validates and publishes them once.
 * D11: the live HUD observes that publication immediately, without a refresh timer. */
import type { TextCommandContext, TextCommandResult } from '@engine/simulation/contracts/text-command';

const experience = Object.freeze({ navigation: 1000, 'away-team': 1000, engineering: 1000, tactical: 1000 });
const result = (values: Partial<TextCommandResult>): TextCommandResult => ({
  resources: {},
  experience: {},
  standing: [],
  ...values,
});
/** Source myplanet is the live system ID; never manufacture undeclared scopes. */
const standing = (context: TextCommandContext, value: number, maximum?: number) =>
  context.standingSystemIds
    .filter(id => (maximum === undefined ? id === context.systemId : id >= 1 && id <= maximum))
    .map(systemId => ({ systemId, value }));

interface CheatRule {
  readonly text: string;
  readonly lines: string;
  readonly owner?: 'C14/C15';
  readonly resolve: (context: TextCommandContext) => TextCommandResult | null;
}
/** D1/D2: one frozen authority for all fourteen literals and deferred ownership.
 * Government commands stay wholly inert until both government arrays are owned. */
export const cheatRules: readonly Readonly<CheatRule>[] = Object.freeze(
  [
    { text: 'maxlat', lines: '2–4', resolve: () => result({ resources: { latinum: 999999 } }) },
    {
      text: 'inclat',
      lines: '5–7',
      resolve: (context: TextCommandContext) => {
        const latinum = (context.resources.latinum ?? 0) + 1000;
        if (!Number.isSafeInteger(latinum) || latinum < 0) return null;
        return result({ resources: { latinum } });
      },
    },
    { text: 'maxdur', lines: '8–10', resolve: () => result({ resources: { deuranium: 999999 } }) },
    { text: 'imgood', lines: '11–13', resolve: (c: TextCommandContext) => result({ standing: standing(c, 100) }) },
    { text: 'imbad', lines: '14–16', resolve: (c: TextCommandContext) => result({ standing: standing(c, -100) }) },
    {
      text: 'youhateme',
      lines: '17–23',
      resolve: (c: TextCommandContext) => result({ standing: standing(c, -100, 51) }),
    },
    {
      text: 'ilovetocheat',
      lines: '24–32',
      resolve: (c: TextCommandContext) =>
        result({ resources: { latinum: 999999, deuranium: 999999 }, experience, standing: standing(c, 100) }),
    },
    { text: 'getinthebooth', lines: '33–40', owner: 'C14/C15' as const, resolve: () => null },
    {
      text: 'youloveme',
      lines: '41–47',
      resolve: (c: TextCommandContext) => result({ standing: standing(c, 100, 51) }),
    },
    { text: 'urmine', lines: '48–50', owner: 'C14/C15' as const, resolve: () => null },
    { text: 'allknowing', lines: '51–56', resolve: () => result({ experience }) },
    { text: 'byebyeklingons', lines: '57–67', owner: 'C14/C15' as const, resolve: () => null },
    {
      text: 'everyonelovesme',
      lines: '68–74',
      resolve: (c: TextCommandContext) => result({ standing: standing(c, 110, 50) }),
    },
    { text: 'earthownsall', lines: '75–85', owner: 'C14/C15' as const, resolve: () => null },
  ].map(rule => Object.freeze(rule))
);

/** Whole-field comparison deliberately preserves case, spaces and line breaks. */
export function resolveTextCommand(context: TextCommandContext): TextCommandResult | null {
  return cheatRules.find(rule => rule.text === context.text)?.resolve(context) ?? null;
}
