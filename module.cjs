/** Portable selected-module commands. This root entry, src/ and modules/ are
 * sufficient with the normal package/config files and installed dependencies.
 * Recovery/test commands delegate only when explicitly requested. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/** Run sequential child processes and stop on the first failure. Module IDs
 * cannot contain path separators; child arguments never pass through a shell. */
function runModule(moduleId, command, extra = [], { root = __dirname, spawn = spawnSync } = {}) {
  if (!moduleId || !/^[a-z][a-z0-9-]*$/.test(moduleId)) throw Error('Supply a valid module folder ID.');
  if (!['dev', 'build', 'preview', 'test', 'stage', 'verify', 'check-artifacts'].includes(command))
    throw Error('Expected dev, build, preview, test, stage, verify, or check-artifacts.');
  const moduleRoot = path.join(root, 'modules', moduleId);
  const normalCommand = ['dev', 'build', 'preview'].includes(command);
  if (
    !fs.existsSync(path.join(moduleRoot, 'rules.ts')) ||
    (normalCommand &&
      (!fs.existsSync(path.join(moduleRoot, 'public/game/module.json')) ||
        !fs.existsSync(path.join(moduleRoot, 'client.tsx'))))
  )
    throw Error(`Selected module ${moduleId} needs rules.ts, client.tsx and public/game/module.json.`);
  const environment = { ...process.env, GAME_MODULE: moduleId };
  const run = (script, args = []) => {
    const result = spawn(process.execPath, [path.join(root, script), ...args], {
      cwd: root,
      env: environment,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    return result.status ?? 1;
  };
  if (command === 'build') {
    const status = run('node_modules/typescript/bin/tsc', ['-b']);
    if (status !== 0) return status;
    return run('node_modules/vite/bin/vite.js', ['build', ...extra]);
  }
  if (command === 'dev') return run('node_modules/vite/bin/vite.js', extra);
  if (command === 'preview') return run('node_modules/vite/bin/vite.js', ['preview', ...extra]);
  const developmentRunner = 'tools/run-module.cjs';
  if (!fs.existsSync(path.join(root, developmentRunner)))
    throw Error(
      `${command} is a development command and needs the complete development workspace. Dev/build/preview do not.`
    );
  return run(developmentRunner, [moduleId, command, ...extra]);
}
module.exports = { runModule };
if (require.main === module) {
  const [moduleId, command, ...extra] = process.argv.slice(2);
  try {
    process.exitCode = runModule(moduleId, command, extra);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
