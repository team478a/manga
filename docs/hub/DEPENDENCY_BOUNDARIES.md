# Package dependency boundaries

## Purpose

Phase 4 fixes the dependency direction of the framework-independent
`@mangai/*` packages. The repository checks these rules with
`npm run deps:check`, and the Required Quality workflow runs the same command
for every pull request.

## Public API

Each package exposes only its root entrypoint:

```text
@mangai/ai-core
@mangai/canvas-core
@mangai/export-core
@mangai/project-core
@mangai/shared
```

The package `exports["."]` map resolves runtime code and declarations through
`dist/index.js` and `dist/index.d.ts`. Consumers must not import paths such as
`@mangai/shared/src/...` or `@mangai/canvas-core/dist/...`. Public symbols are
selected by the package's `src/index.ts`.

## Enforced rules

`scripts/check-dependency-boundaries.mjs` fails when it detects:

- a package without the root-only public export map;
- Next.js, Electron, Supabase, Stripe, SQLite, Node built-ins or filesystem
  dependencies inside a framework-independent package;
- an `@mangai/*` dependency that is not declared by the importing package;
- a cycle in the package dependency graph;
- a relative-import cycle inside a package;
- a deep import into an `@mangai/*` package from Hub, Desktop or tests.

This keeps the intended direction:

```text
Hub UI / Desktop UI
  -> application and infrastructure code
    -> @mangai/* public API
```

The packages do not depend back on Next.js, Electron, Supabase, Stripe,
SQLite, filesystem or application UI.

## Adding a package dependency

1. Confirm that the dependency points toward a lower-level,
   framework-independent package.
2. Add it to the package's `dependencies`.
3. Import only the dependency's root public API.
4. Export only consumer-required symbols from the dependency's `src/index.ts`.
5. Run `npm run deps:check`, package builds, TypeScript and tests.

Do not add an exception to the checker to bypass a cycle or framework
dependency. Move the shared contract into a lower-level package instead.

## Compatibility and security

No application API, Desktop IPC, database schema, saved document, Storage
path or UI behavior changes. Existing root package imports remain compatible.
Restricting package exports prevents new consumers from coupling to internal
helpers that can change without notice.

The check is static and reads repository source only. It does not require
credentials or network access.

## Manual validation

1. Run `npm run deps:check`.
2. Add a temporary deep import and confirm `PACKAGE_DEEP_IMPORT`.
3. Add a temporary Node built-in import under a package and confirm
   `FRAMEWORK_DEPENDENCY`.
4. Revert the temporary changes and confirm the check succeeds.
5. Build Hub and Desktop to confirm root package imports still resolve.

## Rollback

Revert the PR commit. No database or stored-data rollback is required.

## Remaining work

- Introduce domain error codes to replace message substring matching.
- Extend dependency rules to application service and repository layers after
  their interfaces have stabilized.
