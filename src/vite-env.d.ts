/// <reference types="vite/client" />

/** Vite resolves exactly one reviewed module; no runtime arbitrary code loading. */
declare module 'selected-game-rules' {
  export const rules: import('./simulation/contracts/game-rules').GameRules;
}

/** The composition root alone consumes the selected React entry capability. */
declare module 'selected-game-client' {
  export function createModuleClient(game: import('./content/game-module').GameModule): Promise<import('./ui/module-client').ModuleClient>;
}
