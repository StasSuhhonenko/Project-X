# Documentation navigation

Start with the [live checkpoint](CONVERSION_PLAN.md): it alone selects the active
next task. [Architecture](ARCHITECTURE.md) is normative;
[game-module contracts](GAME_MODULES.md) govern engine/game separation.

| Location | Purpose |
| --- | --- |
| [architecture/](architecture/) | Live feature contracts: [world rendering](architecture/WORLD_RENDERING.md), [interpolation](architecture/RENDER_INTERPOLATION.md), [station lifecycle](architecture/STATION_LIFECYCLE.md), [active visits](architecture/ACTIVE_STATION_VISITS.md), [staged loading](architecture/CLIENT_LOADING_2026-11-06.md), [snapshots](architecture/SAVE_SNAPSHOT.md), [browser storage](architecture/BROWSER_SAVE_STORAGE.md), [file transfer](architecture/SAVE_UI_FILE_TRANSFER.md). |
| [reviews/](reviews/) | Recent cross-project reviews, currently the [2026-11-25 bug audit](reviews/PROJECT_X_BUG_AUDIT_2026-11-25.md). |
| [Archive](../archive/docs-2026-11-26/) | Completed plans, superseded history, agent handoffs and per-slice reviews/audits, moved out of the live docs on 2026-11-26 with links rewritten. Not needed for normal work. |
| [evidence/](evidence/) | Preserved screenshots and JSON reports associated with the reviews/plans. |
| [BM1 documentation](../modules/bm1/docs/README.md) | Module-owned backlog, contracts, provenance, recovery and original UI evidence. |
| [Runtime navigation](../src/README.md) | Maintained shared source responsibilities and execution paths. |
| [guides/](guides/) | Non-normative study material: [beginner's guide](guides/PROJECT_X_FOR_BEGINNERS.md) (every folder explained from zero), then the [engine and module learning guide](guides/ENGINE_LEARNING_GUIDE.md) (concepts, traces, reading strategy, exercises). |

[Backup checkpoint](BACKUP_CHECKPOINT.md) stays at its script-owned path.
The existing local backup directory is user-managed and outside documentation
reorganisation. Docs, tests and tools retain their local/ignored source-control policy.

Contributor checks: `npm run format:check` uses Prettier and import sorting;
`npm run lint` uses oxlint without changing the TypeScript compiler. Their write
commands are `npm run format` and `npm run lint:fix`. The formatter excludes
documentation, reviewed JSON, assets and preserved evidence; lint fixes also
respect those exclusions and leave warning-level findings for later review.
BM1's 13 root staging/recovery scripts retain their reviewed source bytes and
paths because they generate evidence-bearing provenance.
