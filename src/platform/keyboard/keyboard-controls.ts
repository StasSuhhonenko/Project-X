/** Encapsulates browser key state and removes listeners through dispose(). */
import type { PlayerControls } from '../../simulation/commands/player-controls';

export interface KeyboardControls {
  sample(): PlayerControls;
  dispose(): void;
}

const CONTROL_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createKeyboardControls(target: Window = window): KeyboardControls {
  const pressed = new Set<string>();
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!CONTROL_CODES.has(event.code)) return;
    event.preventDefault();
    pressed.add(event.code);
  };
  const handleKeyUp = (event: KeyboardEvent): void => {
    if (!CONTROL_CODES.has(event.code)) return;
    event.preventDefault();
    pressed.delete(event.code);
  };
  const handleBlur = (): void => pressed.clear();
  target.addEventListener('keydown', handleKeyDown);
  target.addEventListener('keyup', handleKeyUp);
  target.addEventListener('blur', handleBlur);

  return {
    sample: () => ({
      accelerate: pressed.has('ArrowUp'),
      decelerate: pressed.has('ArrowDown'),
      turnLeft: pressed.has('ArrowLeft'),
      turnRight: pressed.has('ArrowRight'),
    }),
    dispose: () => {
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
      target.removeEventListener('blur', handleBlur);
      pressed.clear();
    },
  };
}
