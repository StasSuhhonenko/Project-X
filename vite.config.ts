import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Select one module at build time. Never use the repository public/ directory:
 * it may contain historical recovered files that must not enter another game.
 * GAME_MODULE supports a local folder with rules.ts and public/game/module.json.
 */
export default defineConfig(() => {
  const moduleId = process.env.GAME_MODULE ?? 'demo';
  if (!/^[a-z][a-z0-9-]*$/.test(moduleId)) throw new Error('Invalid GAME_MODULE folder name.');
  const moduleRoot = path.resolve('modules', moduleId);
  const entryPresentation = path.join(moduleRoot, 'entry-presentation.tsx');
  const gameplayPresentation = path.join(moduleRoot, 'gameplay-presentation.tsx');
  // Reviewed snapshots are normal build inputs. Recovery/staging is an explicit
  // developer operation; a build must never rewrite content or need originals.
  if (!existsSync(path.join(moduleRoot, 'rules.ts')) || !existsSync(path.join(moduleRoot, 'public/game/module.json')))
    throw new Error(`Selected module ${moduleId} needs rules.ts and public/game/module.json.`);
  return {
  plugins: [react(), {
    name: 'selected-module-boundary',
    // Inspect the actual bundle graph, not just filenames/text in the minified
    // output. A module must never pull another game's rules into its build.
    generateBundle(_options, bundle) {
      Object.values(bundle).forEach(output => {
        if (output.type !== 'chunk') return;
        Object.keys(output.modules).forEach(id => {
          const normalized = id.replaceAll('\\', '/');
          const project = process.cwd().replaceAll('\\', '/');
          if (!normalized.startsWith(`${project}/`)) return;
          const relative = normalized.slice(project.length + 1);
          if (relative.startsWith('modules/') && !relative.startsWith(`modules/${moduleId}/`)) {
            this.error(`Unselected game code in bundle: ${relative}`);
          }
          const isRuntimeEntry = relative === 'index.html';
          if (!isRuntimeEntry && !['src/', 'modules/', 'node_modules/'].some(directory => relative.startsWith(directory))) {
            this.error(`Non-runtime project file in bundle: ${relative}`);
          }
        });
      });
    },
  }],
  publicDir: path.join(moduleRoot, 'public'),
  resolve: { alias: {
    'selected-game-rules': path.join(moduleRoot, 'rules.ts'),
    'selected-game-presentation': existsSync(entryPresentation)
      ? entryPresentation : path.resolve('src/ui/default-entry-presentation.tsx'),
    'selected-gameplay-presentation': existsSync(gameplayPresentation)
      ? gameplayPresentation : path.resolve('src/ui/default-gameplay-presentation.tsx'),
  } },
  build: {
    target: 'es2022',
    outDir: `dist/${moduleId}`,
  },
  };
});
