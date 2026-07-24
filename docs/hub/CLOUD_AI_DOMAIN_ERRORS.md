# Cloud AI typed errors

## Scope

PR-17 migrates Cloud AI quota, rate limit, generation availability,
moderation, permissions and Worker lease failures to the Domain Error contract
introduced by PR-16. Provider requests, billing reservation, retry policy,
heartbeat timing and job state transitions are unchanged.

## Database signal mapping

`generation-errors.ts` is the only Cloud Creator generation module that knows
the legacy PostgreSQL exception signals.

| Database signal | Domain code |
| --- | --- |
| `cloud_credit_quota_exceeded` | `QUOTA_EXCEEDED` |
| `cloud_cost_quota_exceeded` | `QUOTA_EXCEEDED` |
| `cloud_daily_budget_exceeded` | `QUOTA_EXCEEDED` |
| `cloud_generation_rate_limited` | `RATE_LIMITED` |
| `cloud_entitlement_inactive` | `PERMISSION_DENIED` |
| `cloud_plan_unavailable` | `PERMISSION_DENIED` |
| `cloud_generation_disabled` | `PROVIDER_UNAVAILABLE` |
| `cloud_generation_price_unavailable` | `PROVIDER_UNAVAILABLE` |
| `cloud_generation_input_rejected` | `VALIDATION_ERROR` |
| Project/Page permission signals | `PERMISSION_DENIED` |
| Unknown signal | `INTERNAL_ERROR` |

Moderation rejection uses `CONTENT_REJECTED` and HTTP 422. Unknown database
messages are never copied to an API response.

## API behavior

The following endpoints return the compatible `error` plus `errorCode`
envelope:

- `GET/POST /api/creator/generation-jobs`
- `DELETE /api/creator/generation-jobs/[jobId]`
- `GET /api/creator/ai-quota`
- `GET/POST /api/internal/cloud-ai/worker`

The request-level rate limiter also returns `RATE_LIMITED` and preserves its
`Retry-After` header.

## Worker lease

`CloudGenerationLeaseLostError` extends the shared `LeaseLostError`. Existing
imports and `instanceof CloudGenerationLeaseLostError` remain valid. Lease
loss still aborts Provider work, skips Asset finalization and returns the
existing `{ status: "lease_lost" }` Worker result.

Provider failures continue to use the framework-independent
`AIProviderError` contract in `@mangai/ai-core`. This PR does not rename stored
Provider error codes or change retry eligibility.

## Compatibility and security

- Successful API responses and request bodies are unchanged.
- The legacy string-valued `error` field remains present.
- Billing, credit reservation, cost settlement and idempotency are unchanged.
- Worker authorization remains a timing-safe secret comparison.
- Raw database and unexpected Worker exception messages are redacted.
- No database migration, Storage change or Desktop IPC change is required.

## Rollback

Revert the PR commit. There is no schema or stored-data rollback.

## Remaining work

- Add dedicated PostgreSQL SQLSTATE values in a separate migration.
- Migrate Structure deletion and remaining Cloud Creator actions.
- Adopt the nested `error.code` envelope after supported clients have moved to
  `errorCode`.
