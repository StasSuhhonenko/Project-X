/** Prepared only after a new or restored session requests gameplay. */
import type { GameModule } from '../../src/content/game-module';
import type { GameplayClient } from '../../src/ui/module-client';
import { GameplayPresentation, TerminalPresentation } from './gameplay-presentation';
import { createSpatialPresentation } from './spatial-presentation';
import { loadPixiSceneDefinition } from '../../src/rendering/pixi/configuration';
import type { GameplayPresentation as HostGameplay } from '../../src/ui/gameplay-presentation';

export async function createGameplayClient(game: GameModule): Promise<GameplayClient> {
  const definition = await loadPixiSceneDefinition(game.definition);
  const BoundGameplay: HostGameplay = Object.assign(
    (props: import('../../src/ui/gameplay-presentation').GameplayPresentationProps) => <GameplayPresentation {...props} definition={definition} />,
    { travelPresentation: GameplayPresentation.travelPresentation });
  return Object.freeze({ GameplayPresentation: BoundGameplay, TerminalPresentation,
    spatial: createSpatialPresentation(definition) });
}
