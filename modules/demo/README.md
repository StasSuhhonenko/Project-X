# Project-X independent demo

This small demonstration supplies independently authored ships, systems, artwork
and rules. It supports flight, combat, repair, trading, travel and browser/file
saves. It is an example module rather than a complete game.

From the Project-X root, use Node.js 24 to install and run:

```powershell
npm ci
npm run dev
```

Edit the flight identity if desired, then choose **Start survey flight** or
another starting scenario. Use the arrow keys to fly and the displayed panels
to interact, select destinations and travel. Save and load through the browser
save controls.

Build and preview with:

```powershell
npm run build
npm run preview
```

The explicit module commands also work:

```powershell
npm run module -- demo dev
npm run module -- demo build
npm run module -- demo preview
```

Build output is `dist/demo`. Serve its contents at the web server root.
Existing saves must be compatible with the current build.

## Developer navigation

`rules.ts` supplies independent navigation/combat/travel policy; `repair.ts` and
`station-membership.ts` own focused service/lifecycle behavior. The three
`*-presentation.tsx` entrypoints compose shared controls and selected screens.
`public/game/module.json` contains authored definitions and asset mappings;
`public/game/assets/` contains the published artwork. The paired-survey test
beside the rules exercises the contrasting lifecycle example. Development
tools/tests are optional normal-build inputs. See the shared
[runtime navigation](../../src/README.md) for state, commands and rendering.
