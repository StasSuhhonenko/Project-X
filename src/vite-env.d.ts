/// <reference types="vite/client" />

/** Vite resolves exactly one reviewed module; no runtime arbitrary code loading. */
declare module 'selected-game-rules' {
  export const rules: import('./simulation/contracts/game-rules').GameRules;
}

/** The composition root alone consumes the selected React entry capability. */
declare module 'selected-game-presentation' {
  export const EntryPresentation: import('./ui/entry-presentation').EntryPresentation;
}

/** One authored gameplay frame, selected only by the browser composition root. */
declare module 'selected-gameplay-presentation' {
  export const GameplayPresentation: import('./ui/gameplay-presentation').GameplayPresentation;
}
