/** Encapsulates browser key state and removes listeners through dispose(). */
import type { PlayerControls } from '../../simulation/commands/player-controls';
import { eventHasUiInputOwner } from './ui-input-ownership';

export interface KeyboardControls {
  sample(): PlayerControls;
  /** Clear held state whenever the presentation transfers flight ownership. */
  reset(): void;
  dispose(): void;
}

const CONTROL_CODES = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Comma',
  'Period',
  'Space',
  'KeyZ',
  'KeyX',
]);

/** Leave application and browser chords available to their default handlers. */
function hasShortcutModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

export function createKeyboardControls(target: Window = window): KeyboardControls {
  const pressed = new Set<string>();
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!CONTROL_CODES.has(event.code) || hasShortcutModifier(event)) return;
    if (event.defaultPrevented || eventHasUiInputOwner(event)) {
      pressed.clear();
      return;
    }
    event.preventDefault();
    pressed.add(event.code);
  };
  const handleKeyUp = (event: KeyboardEvent): void => {
    if (!CONTROL_CODES.has(event.code)) return;
    // Release ownership even if a modifier or focus changed during the hold.
    pressed.delete(event.code);
    if (hasShortcutModifier(event) || event.defaultPrevented || eventHasUiInputOwner(event)) return;
    event.preventDefault();
  };
  const handleBlur = (): void => pressed.clear();
  // Focus may move while a movement key is held. Release ownership immediately;
  // a later release delivered to a form/button must not leave flight input stuck.
  const handleFocus = (event: FocusEvent): void => {
    if (eventHasUiInputOwner(event)) pressed.clear();
  };
  target.addEventListener('keydown', handleKeyDown);
  target.addEventListener('keyup', handleKeyUp);
  target.addEventListener('blur', handleBlur);
  target.addEventListener('focusin', handleFocus);

  return {
    reset: handleBlur,
    sample: () => ({
      accelerate: pressed.has('ArrowUp'),
      decelerate: pressed.has('ArrowDown'),
      turnLeft: pressed.has('ArrowLeft'),
      turnRight: pressed.has('ArrowRight'),
      zoomOut: pressed.has('Comma'),
      zoomIn: pressed.has('Period'),
      firePrimary: pressed.has('Space'),
      fireSecondary: pressed.has('KeyZ'),
      fireTertiary: pressed.has('KeyX'),
    }),
    dispose: () => {
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
      target.removeEventListener('blur', handleBlur);
      target.removeEventListener('focusin', handleFocus);
      pressed.clear();
    },
  };
}
