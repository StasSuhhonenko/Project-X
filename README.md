# Project-X

Project-X is an in-progress port of **Flash Trek: Broken Mirror**, aiming to
faithfully preserve its gameplay, artwork and interface on a modern browser
stack. It also provides a shared, reusable **planar space RPG engine** with
module-selected spatial renderers.

Built with **TypeScript and React**, the engine separates shared systems
from game-specific rules, content and assets. `modules/bm1` contains the Broken
Mirror port, while `modules/demo` provides an independent example. Each module
builds into a separate browser distribution. BM1 selects **PixiJS** for its
original 2D presentation; the demo selects **Three.js** for an angled 3D view of
the same planar simulation. Each distribution includes its selected renderer.

The playable slices include flight, combat, transactions, travel and versioned
saves. BM1's full original mechanics and interface remain under development.

Use Node.js 24 (validated with v24.18.0) for the maintained client.

Install the pinned dependencies and start the browser client:

```powershell
npm ci
npm run dev
```

`npm run dev` starts the demo; choose **Start survey flight** and use the arrow
keys.

`npm run build` produces `dist/demo`. Serve the contents of that directory at the
web server root. `npm run preview` previews the default build.

Select either module with the same commands on Windows, Linux or macOS:

```powershell
npm run module -- bm1 dev
npm run module -- bm1 build
npm run module -- bm1 preview
```

Replace `bm1` with `demo` to select the independent example. Build output is
`dist/<module-id>`. Serve that directory at the web server root.

Before contributing, run `npm run format:check` and `npm run lint` (`npm run format`
and `npm run lint:fix` apply fixes).

See the [BM1](modules/bm1/README.md) and [demo](modules/demo/README.md) guides for
controls and current limitations, and [runtime navigation](src/README.md) for
shared source responsibilities. The complete local development workspace also
provides the [documentation index](docs/README.md) and [live checkpoint](docs/CONVERSION_PLAN.md);
internal docs remain optional normal-build inputs.
