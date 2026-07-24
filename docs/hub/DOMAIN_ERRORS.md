# Domain Error and API error codes

## Purpose

Cloud Creator previously classified failures by searching database or Japanese
error messages. PR-16 introduces stable Domain Error codes and migrates Cloud
Canvas authentication, permission, validation, not-found and revision-conflict
flows first.

Human-readable messages remain presentation text. Application behavior must
branch on `errorCode`, an HTTP status or an Error class, not message wording.

## Domain Error contract

`src/lib/domain-errors.ts` defines the shared base class and these stable codes:

| Code | HTTP status | Intended use |
| --- | ---: | --- |
| `AUTHENTICATION_REQUIRED` | 401 | A signed-in user is required |
| `PERMISSION_DENIED` | 403 | The user cannot access the operation |
| `RESOURCE_NOT_FOUND` | 404 | The resource is absent or intentionally hidden |
| `REVISION_CONFLICT` | 409 | Optimistic-lock revision mismatch |
| `QUOTA_EXCEEDED` | 429 | A usage quota is exhausted |
| `RATE_LIMITED` | 429 | Request rate limit |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONTENT_REJECTED` | 422 | Content safety policy rejection |
| `STORAGE_TRANSACTION_ERROR` | 500 | Storage compensation or commit failure |
| `PROVIDER_UNAVAILABLE` | 503 | AI Provider unavailable |
| `PROVIDER_TIMEOUT` | 504 | AI Provider timeout |
| `LEASE_LOST` | 409 | Worker no longer owns the lease |
| `INTERNAL_ERROR` | 500 | Unclassified internal failure |

Specific Error classes are provided for the public codes used by current and
planned services. Unknown infrastructure errors are wrapped as
`INTERNAL_ERROR`; their original messages are not returned to clients.

## Compatible API envelope

During the migration, APIs return:

```json
{
  "error": "保存競合を検出しました。Pageを再読込してください。",
  "errorCode": "REVISION_CONFLICT"
}
```

The existing string-valued `error` field is retained for current clients.
New clients branch on `errorCode`. The client reader also accepts the future
nested shape `{ "error": { "code": "...", "message": "..." } }`, allowing a
later envelope migration without another UI rewrite.

## Cloud Canvas flow

```text
PostgreSQL RPC signal
  -> Canvas Repository maps infrastructure signal
  -> typed Domain Error
  -> API adapter maps code to HTTP status
  -> UI reads errorCode
```

Only the Repository adapter knows the legacy PostgreSQL exception message.
Cloud Canvas Service and Route no longer search `error.message`, and the UI
does not depend on Japanese conflict wording. HTTP 409 remains supported as a
fallback for an older server during rolling deployment.

## Security and compatibility

- Unknown exception messages are replaced by an operation-specific fallback,
  preventing database or internal details from reaching the browser.
- Existing `error: string`, Canvas request bodies, successful responses and
  revision behavior are unchanged.
- There is no database migration, Storage change, Desktop IPC change or saved
  data change.
- Authentication failures now return 401, permissions 403, missing pages 404,
  revision conflicts 409 and unexpected failures 500.

## Adding a typed error

1. Select an existing stable code or add a code and Error class.
2. Add its HTTP mapping in `api-errors.ts`.
3. Translate infrastructure-specific errors at the Repository or Provider
   boundary.
4. Throw the typed error from the application service.
5. Branch on code in Route/UI code.
6. Add tests for the code, HTTP status and redaction behavior.

Do not branch on localized messages or return raw database/Provider errors.

## Rollback

Revert the PR commit. No migration or data rollback is necessary.

## Cloud AI migration

Cloud AI generation maps quota, budget, rate-limit, entitlement, disabled
Provider, invalid input and Project permission database signals at the
Generation boundary. Creator and internal Worker APIs use the same compatible
error envelope.

`CloudGenerationLeaseLostError` keeps its existing exported class name for
Worker compatibility and now extends `LeaseLostError`. It therefore carries
the stable `LEASE_LOST` code without changing heartbeat or job-state behavior.

## Remaining work

- Move Structure deletion failures to the same typed contract.
- Assign dedicated PostgreSQL SQLSTATE values in a separate migration so the
  Canvas Repository can eventually stop parsing the legacy RPC signal.
- Migrate the API envelope fully to nested `error.code` after all supported
  clients consume `errorCode`.
