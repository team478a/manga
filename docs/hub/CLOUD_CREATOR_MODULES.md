# Cloud Creator server module boundaries

## Purpose

`src/lib/cloud-creator-server.ts` previously combined authentication, project
structure, canvas snapshots, assets, generation, import, and export in one
file. It is now a compatibility entrypoint; implementation lives under
`src/modules/cloud-creator`.

## Dependency direction

```text
API route / Server Component
  -> compatibility entrypoint or feature Service
  -> Repository
  -> authenticated Supabase client
```

- `auth-context.ts` is the only module that creates a Supabase client and loads
  the creator/admin profile.
- Services translate database and Storage failures into user-facing domain
  errors and coordinate multi-resource use cases.
- Repositories contain database table queries and do not import Services.
- `contracts/types.ts` contains UI-facing Cloud Creator types. Database-only
  columns such as `storage_path` stay inside repositories and services.
- `canvas-normalizer.ts` is pure and has no Next.js or Supabase dependency.

## Feature modules

- `projects`: project listing, workspace, creation, rename, cover and trash.
- `structure`: episode/page creation, rename, move and soft deletion.
- `canvas`: snapshot persistence, current snapshot loading and normalization.
- `assets`: image validation, private Storage lifecycle and signed URLs.
- `generation`: quota, moderation, provider selection, queue and cancellation.
- `import`: Desktop manifest validation and import.
- `export`: bounded concurrent Asset staging and integrity validation.

## Compatibility and security

Existing imports from `@/lib/cloud-creator-server` keep the same function and
type names. API request/response formats and database RPCs are unchanged.
Project, page and Asset queries retain resource identifiers and RLS filters.
Signed Asset URL creation now uses the same creator/admin authentication
context as the other Cloud Creator operations.

No Service Role key is introduced, and no database migration is required.

## Validation

Automated tests verify:

- Canvas normalization pins page identity and dimensions and rejects invalid
  object ownership.
- The compatibility entrypoint contains no database access.
- Supabase client creation exists only in the authentication context.
- Repository modules do not depend on Services.
- The module import graph has no cycles.

## Manual check

1. Open the Cloud Creator project list.
2. Open a project and add/move an episode and page.
3. Open the Canvas editor, save a change, reload and confirm persistence.
4. Upload an Asset and confirm its signed preview loads.
5. Start/cancel a mock Cloud generation job.
6. Export PDF, images and a sales package.

## Rollback

Revert the PR commit. There is no migration or stored-data conversion to undo.

## Remaining work

The compatibility entrypoint is intentionally retained. Later changes can move
individual routes to direct feature imports and add dependency injection for
repository integration tests without changing callers at once.
