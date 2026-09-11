# Project-X

Project-X separates a shared engine from replaceable game modules. The default
`modules/demo` contains the independently authored content, SVG artwork and rules
required to run a clean build. Other local modules can retain compatibility and
recovery work without entering the default build.

The engine uses React menus, a validated content catalog, isolated Zustand state,
a fixed-step scheduler, PixiJS rendering and a small HUD.
This is an early navigation slice rather than the complete playable-slice milestone;
combat, travel, transactions, and saves have not been implemented yet.

The maintained engine follows component boundaries, strict runtime validation and
explicit state ownership. Internal architecture, recovery and planning documents
remain local to the development workspace and are not included in the minimal
GitHub source.

Use Node.js 24 (validated with v24.18.0) for the maintained client.

Install the pinned dependencies and start the browser client:

```powershell
npm install
npm run dev
```

`npm run dev` starts the demo; choose **Start survey flight** and use the arrow
keys. The default development and build commands do not read recovery files.

`npm run build` produces `dist/demo`. Serve the contents of that directory at the
web server root. `npm run preview` previews the default build.

Development-only tests, module selection, recovery commands, and detailed plans
remain available in the local workspace but are excluded from the minimal GitHub
source.

The module boundary is technical separation, not a licence or legal clearance.
Preserved source material, recovery evidence, non-default modules, plans, tests,
tools and build output are ignored by the minimal source-control configuration.
