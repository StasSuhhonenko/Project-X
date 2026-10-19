/** Shared flight/HUD focus boundary: interactive controls own their key events. */
const INTERACTIVE_SELECTOR = 'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"], [role="combobox"], [data-game-input="blocked"]';

/**
 * Check the composed event path, including controls inside SVG/shadow trees.
 * Duck typing keeps this boundary usable with host-neutral event test targets;
 * it does not require browser globals or alter focus/default event behavior.
 */
export function eventHasUiInputOwner(event: Event): boolean {
  return event.composedPath().some(target => {
    const element = target as { readonly closest?: (selector: string) => unknown };
    return typeof element.closest === 'function' && Boolean(element.closest(INTERACTIVE_SELECTOR));
  });
}
