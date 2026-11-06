import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { z } from 'zod';

const RendererPolicySchema = z
  .object({
    requiredPackages: z
      .array(z.string().regex(/^[@a-zA-Z0-9_./-]+$/))
      .min(1)
      .readonly(),
    forbiddenPackages: z.array(z.string().regex(/^[@a-zA-Z0-9_./-]+$/)).readonly(),
  })
  .strict()
  .readonly();
type RendererPolicy = z.infer<typeof RendererPolicySchema>;

/** Enforce resolution and audit actual emitted chunks, including dynamic code.
 * Module-owned policy supplies package identities; the host has no renderer list. */
export function createRendererBoundaryPlugin(
  policy: RendererPolicy,
  moduleId: string,
  projectRoot = process.cwd()
): Plugin {
  const project = projectRoot.replaceAll('\\', '/');
  const belongs = (source: string, name: string) => source === name || source.startsWith(`${name}/`);
  return {
    name: 'selected-module-boundary',
    apply: 'build',
    enforce: 'pre',
    resolveId(source) {
      if (policy.forbiddenPackages.some(name => belongs(source, name)))
        this.error(`Forbidden renderer package resolution: ${source}`);
    },
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).flatMap(output => {
        if (output.type !== 'chunk') return [];
        const modules = Object.keys(output.modules).map(id => {
          const normalized = id.replaceAll('\\', '/');
          if (policy.forbiddenPackages.some(name => normalized.includes(`/node_modules/${name}/`)))
            this.error(`Forbidden renderer in emitted graph: ${normalized}`);
          if (!normalized.startsWith(`${project}/`)) {
            const dependency = normalized.lastIndexOf('/node_modules/');
            return dependency >= 0 ? normalized.slice(dependency + 1) : `virtual:${normalized.split('/').at(-1)}`;
          }
          const relative = normalized.slice(project.length + 1);
          if (relative.startsWith('modules/') && !relative.startsWith(`modules/${moduleId}/`))
            this.error(`Unselected game code in bundle: ${relative}`);
          if (
            relative !== 'index.html' &&
            !['src/', 'modules/', 'node_modules/'].some(directory => relative.startsWith(directory))
          )
            this.error(`Non-runtime project file in bundle: ${relative}`);
          return relative;
        });
        return [{ file: output.fileName, modules: modules.sort() }];
      });
      const modules = chunks.flatMap(chunk => chunk.modules);
      if (policy.requiredPackages.some(name => !modules.some(id => id.includes(`node_modules/${name}/`))))
        this.error('Selected renderer is absent from the emitted module graph.');
      this.emitFile({
        type: 'asset',
        fileName: 'build-graph.json',
        source: JSON.stringify({ schemaVersion: 1, moduleId, chunks }, null, 2) + '\n',
      });
    },
  };
}

/**
 * Select one module at build time. Never use the repository public/ directory:
 * it may contain historical recovered files that must not enter another game.
 * GAME_MODULE supports a local folder with rules.ts and public/game/module.json.
 */
export default defineConfig(() => {
  const moduleId = process.env.GAME_MODULE ?? 'demo';
  if (!/^[a-z][a-z0-9-]*$/.test(moduleId)) throw new Error('Invalid GAME_MODULE folder name.');
  const moduleRoot = path.resolve('modules', moduleId);
  const client = path.join(moduleRoot, 'client.tsx');
  // Reviewed snapshots are normal build inputs. Recovery/staging is an explicit
  // developer operation; a build must never rewrite content or need originals.
  if (
    !existsSync(path.join(moduleRoot, 'rules.ts')) ||
    !existsSync(path.join(moduleRoot, 'public/game/module.json')) ||
    !existsSync(client)
  )
    throw new Error(`Selected module ${moduleId} needs rules.ts, client.tsx and public/game/module.json.`);
  const policyFile = path.join(moduleRoot, 'renderer-policy.json');
  if (!existsSync(policyFile)) throw new Error(`Selected module ${moduleId} needs renderer-policy.json.`);
  const policy = RendererPolicySchema.parse(JSON.parse(readFileSync(policyFile, 'utf8')));
  return {
    // Module aliases select different renderer graphs. Preserve both warm caches.
    cacheDir: path.resolve('node_modules', '.vite', moduleId),
    // Vite otherwise crawls every HTML file, including private recovery reports
    // and temporary source/build copies. Only the actual app is a dev entry.
    optimizeDeps: { entries: ['index.html'] },
    // Recovery evidence and temporary copies are never runtime inputs. Watching
    // them grows startup work and can reload a game when another build is written.
    server: {
      watch: { ignored: ['**/analysis/**', '**/tmp/**', '**/dist/**', '**/flashtrek_sourcecode original/**'] },
    },
    plugins: [react(), createRendererBoundaryPlugin(policy, moduleId)],
    publicDir: path.join(moduleRoot, 'public'),
    resolve: {
      alias: {
        '@engine': path.resolve('src'),
        'selected-game-rules': path.join(moduleRoot, 'rules.ts'),
        'selected-game-client': client,
      },
    },
    build: {
      target: 'es2022',
      outDir: `dist/${moduleId}`,
    },
  };
});
