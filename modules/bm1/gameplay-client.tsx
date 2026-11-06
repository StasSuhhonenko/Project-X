/** Prepared only after a new or restored session requests gameplay. */
import type { GameModule } from '@engine/content/game-module';
import { loadPixiSceneDefinition } from '@engine/rendering/pixi/configuration';
import type { GameplayPresentation as HostGameplay } from '@engine/ui/gameplay-presentation';
import type { GameplayClient } from '@engine/ui/module-client';
import { GameplayPresentation, TerminalPresentation } from './gameplay-presentation';
import { createSpatialPresentation } from './spatial-presentation';

export async function createGameplayClient(game: GameModule): Promise<GameplayClient> {
  const definition = await loadPixiSceneDefinition(game.definition);
  const BoundGameplay: HostGameplay = Object.assign(
    (props: import('@engine/ui/gameplay-presentation').GameplayPresentationProps) => (
      <GameplayPresentation {...props} definition={definition} />
    ),
    { travelPresentation: GameplayPresentation.travelPresentation }
  );
  return Object.freeze({
    GameplayPresentation: BoundGameplay,
    TerminalPresentation,
    spatial: createSpatialPresentation(definition),
  });
}
