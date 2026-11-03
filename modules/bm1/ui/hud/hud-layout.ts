/** Source Symbol6 registration and navigation distances, in logical pixels.
 * Artwork, fields and controls share the same parent; translating only a bitmap
 * would separate visible ink from its source interaction/receiver geometry. */
export const HUD_LAYOUT = Object.freeze({
  stageWidth: 600,
  stageHeight: 450,
  parentX: 300,
  artworkParentY: 282,
  initialParentY: 416.6,
  closedParentY: 415,
  menuParentY: 321,
  expandedParentY: 282,
  pixelsPerFrame: 20,
  rolloutHalfWidth: 160,
  rolloutMinimumY: 5,
});
