/** Presentation-only draft ownership. Resources are display ink and never enter
 * an identity intent, a save, or a simulation balance operation. */
import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { PlayerIdentitySchema } from '@engine/simulation/model/player-identity';
import raw from '../editable-start-data.json';
import { HudFieldSchema } from '../hud/hud-content';
import type { EntrySelection } from './entry-controller';

const content = z
  .object({
    fields: z.array(HudFieldSchema).length(4).readonly(),
    resources: z.record(z.string(), z.string()).readonly(),
    identityDefaults: PlayerIdentitySchema,
  })
  .strict()
  .readonly()
  .parse(raw);
export const editableStartFields = content.fields;
const DraftSchema = PlayerIdentitySchema.unwrap().extend({ resources: z.string() }).strict().readonly();
export type EditableStartDraft = z.infer<typeof DraftSchema>;
export type EditableName = Exclude<keyof EditableStartDraft, 'resources'>;

/** New mounted entries use the reviewed fresh-empty binding policy. Static
 * authored Noname/Unnamed metadata is not the runtime default: Page3 resets the
 * variables to undefined and the authenticated candidate displays blank fields.
 * Typed names survive local menu/preview reconstruction, corroborated by actual
 * candidate keyboard/pointer evidence. Native Flash remains qualified. */
export function createEditableStartController() {
  const store = createStore(() => DraftSchema.parse({ ...content.identityDefaults, resources: '' }));
  return Object.freeze({
    getSnapshot: store.getState,
    subscribe: (listener: () => void) => store.subscribe(listener),
    edit: (field: keyof EditableStartDraft, value: string) => {
      if (!Object.hasOwn(store.getState(), field) || typeof value !== 'string') return false;
      // The host schema owns single-line validation too; do not mirror its rule.
      const parsed = DraftSchema.safeParse({ ...store.getState(), [field]: value });
      if (!parsed.success) return false;
      store.setState(parsed.data, true);
      return true;
    },
    preview: (selection: EntrySelection) => {
      const resources = content.resources[selection];
      if (resources === undefined) throw new Error('Missing reviewed resource preview');
      store.setState(DraftSchema.parse({ ...store.getState(), resources }), true);
    },
    /** Copy only consumed identity. Resource edits cannot cross this boundary. */
    identity: () => {
      const { captainName, shipName, governmentName } = store.getState();
      return Object.freeze({ captainName, shipName, governmentName });
    },
  });
}
