/** Source Symbol146 parent/child registrations, in logical stage pixels.
 * Page1:25841 creates the parent at(90,500); scripts1313/2347 move20px toward
 * open410 or closed500. Child registrations are independent of visible bounds. */
export const TACTICAL_LAYOUT = Object.freeze({
  stageWidth: 600,
  stageHeight: 450,
  parentX: 90,
  openParentY: 410,
  closedParentY: 500,
  pixelsPerFrame: 20,
  /** `strengthbar` instance origin in Symbol146 (body offset 408). AVM1
   * `_xscale` scales about this point, so the cover keeps its right end fixed
   * at stage x 53.95 and grows leftward with depletion. */
  strengthInstanceX: -36.05,
  strengthInstanceY: -12.2,
  /** Symbol148 child shape registration inside the scaled instance. */
  strengthChildX: 35.7,
  strengthChildY: 12.2,
  arrowX: 115.1,
  arrowY: 388.75,
});
