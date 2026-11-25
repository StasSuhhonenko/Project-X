# Project-X requirements

Before implementing or changing the runtime, read `docs/CONVERSION_PLAN.md` for
the current checkpoint, then `docs/ARCHITECTURE.md` and `docs/GAME_MODULES.md` for
the governing boundaries. For module work, also read that module's plan, detailed
backlog, provenance and relevant recovery evidence before acting.

The user's requirements apply throughout development:

- The finished source must be properly structured, component-based, robust, readable, maintainable, and suitable for future expansion.
- Document and comment the code thoroughly. Explain responsibilities, contracts, units, invariants, non-obvious decisions, and legacy behavior. Update documentation with implementation changes.
- Update `docs/CONVERSION_PLAN.md` whenever the active cross-project checkpoint or next task changes. Keep source-specific evidence and detailed acceptance criteria in the owning module documents and link them from the master plan.
- Exploratory recovery work may remain loosely organized. That is not the standard for production code; do not promote an exploratory script into the runtime without restructuring and review.
- Keep the simulation independent of PixiJS and browser APIs. Use explicit state ownership, typed interfaces, and composition rather than shared globals or deep inheritance.
- Keep the shared engine independent of concrete games. Follow `docs/GAME_MODULES.md`: game-specific mechanics, balance, starts, names, maps, quests, descriptions, assets, recovery tools and documentation belong in separate game modules. Keep game names and module-specific commands out of shared engine files; verify shared features with independent example content and build only the selected module into each distribution.
- Apply DRY: give each rule, schema and invariant one authoritative implementation. Encapsulate data behind read-only views and explicit validated operations; do not expose unrestricted state mutation.
- Use Zod schemas as the source of truth for data types and infer TypeScript types from them. Use Zustand for state management, with narrowly scoped stores/selectors and encapsulated actions. React is the preferred choice for client menus, forms and panels.
- Prefer early returns and guard clauses. Prefer separate `if` statements over `else if` chains or deeply nested conditionals; preserve mutually exclusive behavior with terminating guards where needed.
- Prefer array methods such as `map`, `filter`, `find`, `some`, and `every` over `for`/`while` loops. Use loops when sequential parsing or measured performance makes them clearer or necessary, and document non-obvious reasons.
- Preserve original files and extracted evidence. Keep generated legacy source separate from maintained code; annotate provenance in sidecar documentation instead of rewriting extracted originals.
- Validate external content and saves at boundaries. Test meaningful behavior, failure paths, and architectural boundaries as they are implemented.

Do not create empty framework layers for speculative features. Establish the required structure in the first playable slice and grow it with concrete features.
