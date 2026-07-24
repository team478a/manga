# Server Action modules and Storage compensation

## Purpose

`src/app/actions.ts` previously combined authentication, profiles, works,
digital products, goods requests, checkout, validation, and Storage access.
Feature Actions now live under `src/app/actions/`; the original path remains a
thin async compatibility entrypoint for existing forms and components.

## Modules

- `auth-actions.ts`: sign-up, sign-in and sign-out.
- `profile-actions.ts`: creator profile editing.
- `work-actions.ts`: work creation and editing.
- `product-actions.ts`: digital product creation and editing.
- `goods-request-actions.ts`: creator request and admin status updates.
- `checkout-actions.ts`: pending order creation and Stripe Checkout.
- `shared/form-data.ts`: trimmed string extraction.
- `shared/file-validation.ts`: image and sales-file validation.
- `shared/storage-transaction.ts`: owned Storage path, upload and cleanup.
- `shared/compensating-transaction.ts`: framework-independent compensation.

## Storage transaction

Work images and digital product files use this sequence:

```text
validate file
  -> upload to the authenticated user's resource namespace
  -> insert/update database row
      -> success: keep uploaded object
      -> database error or exception: remove uploaded object once
```

This is a compensating transaction because Supabase Database and Storage do
not share one database transaction. A failed cleanup is surfaced explicitly;
the helper never retries cleanup implicitly or hides the failure.

Updates keep the previous database value until the new upload and database
update both succeed. The new upload is removed if the update fails.

## Compatibility and security

All existing exports from `@/app/actions` remain async Server Actions. Routes,
form actions, redirects, revalidation paths, ownership checks, accepted MIME
types, and size limits are unchanged.

Storage paths still use `ownedMarketplaceStoragePath(user.id, resourceId, ...)`.
Work and product mutations still verify creator ownership before updating.
Checkout is isolated from creator mutations and retains its existing admin
client boundary.

No database migration or Storage policy change is required.

## Automated validation

- Successful persistence does not invoke compensation.
- Database error results invoke compensation exactly once.
- Persistence exceptions invoke compensation and rethrow the original error.
- Cleanup failure is not executed twice.
- Work and product Actions use the shared Storage transaction.
- The compatibility entrypoint contains no direct database or Storage access.

## Manual check

1. Sign up, sign in and sign out.
2. Edit the creator profile.
3. Create and edit a work with a valid image.
4. Create and edit a digital product with a valid sales file.
5. Submit a goods request and update it from the admin screen.
6. Start a checkout for an active product.
7. Force a database failure in staging after upload and confirm the new object
   is removed from Storage.

## Rollback

Revert the PR commit. No stored-data or migration rollback is needed.

## Remaining work

Existing successful update behavior does not automatically delete the previous
work image or product file. A later cleanup task can add explicit old-object
retirement after confirming that no other row references it.
