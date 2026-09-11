/// <reference types="vite/client" />

/** Vite resolves exactly one reviewed module; no runtime arbitrary code loading. */
declare module 'selected-game-rules' {
  export const rules: import('./simulation/contracts/game-rules').GameRules;
}
