/** Module-local typed binding of the validated Pixi configuration to its UI.
 * The shared host receives only the neutral gameplay presentation contract. */
import type { PixiSceneDefinition } from '@engine/rendering/pixi/configuration';
import type { GameplayPresentationProps as HostProps } from '@engine/ui/gameplay-presentation';

export type GameplayPresentationProps = Omit<HostProps, 'definition'> & { readonly definition: PixiSceneDefinition };
