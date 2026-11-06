/** Module-local typed binding of the validated Pixi configuration to its UI.
 * The shared host receives only the neutral gameplay presentation contract. */
import type { GameplayPresentationProps as HostProps } from '../../src/ui/gameplay-presentation';
import type { PixiSceneDefinition } from '../../src/rendering/pixi/configuration';
export type GameplayPresentationProps = Omit<HostProps, 'definition'> & { readonly definition: PixiSceneDefinition };
