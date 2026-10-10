import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("external ingest storage is private, owner scoped, and write RPC only", async () => {
  const [migration, rollback, schema] = await Promise.all([
    read("supabase/migrations/202610100002_external_submission_ingest.sql"),
    read("supabase/rollbacks/202610100002_external_submission_ingest.sql"),
    read("supabase/schema.sql"),
  ]);
  for (const source of [migration, schema]) {
    assert.match(source, /'external-submission-quarantine'[^;]+false,52428800/s);
    assert.match(source, /'external-submission-pages'[^;]+false,20971520/s);
    assert.match(source, /external_submission_quarantine_insert/);
    assert.match(source, /external_submission_quarantine_owner_delete/);
    assert.match(source, /where upload\.storage_path=name/);
    assert.match(source, /owner_profile_id=public\.current_profile_id\(\)/);
    assert.match(source, /create table if not exists public\.external_submission_ingest_jobs/);
    assert.match(source, /sum\(byte_size\)[^;]+524288000/s);
    assert.match(source, /grant execute on function public\.claim_external_submission_ingest\(text,integer\) to service_role/);
    assert.doesNotMatch(
      source,
      /grant[^;]*(?:insert|update|delete)[^;]*external_work_submission_(?:files|pages)[^;]*to (?:authenticated|service_role)/i,
    );
  }
  assert.match(rollback, /external_submission_ingest_rollback_requires_empty_tables/);
  assert.match(rollback, /storage\.objects where bucket_id in/);
});

test("external ingest enforces lease, bounded retries, page continuity, and fail closed scanning", async () => {
  const [migration, worker, validator, uploadRoute, workerRoute, nextConfig] = await Promise.all([
    read("supabase/migrations/202610100002_external_submission_ingest.sql"),
    read("src/lib/external-submission-worker.ts"),
    read("src/lib/external-submission-ingest.ts"),
    read("src/app/api/creator/external-submissions/[submissionId]/uploads/route.ts"),
    read("src/app/api/internal/external-submissions/worker/route.ts"),
    read("next.config.ts"),
  ]);
  assert.match(migration, /for update skip locked limit 1/);
  assert.match(migration, /v_job\.lease_expires_at<=now\(\)/);
  assert.match(migration, /attempt_count>=v_job\.max_attempts/);
  assert.match(migration, /generate_series\(1,jsonb_array_length\(p_pages\)\)/);
  assert.match(worker, /MANGAI_EXTERNAL_CLAMAV_HOST/);
  assert.match(worker, /return async \(\) => "unavailable"/);
  assert.match(validator, /malware_scan_unavailable/);
  assert.match(validator, /EXTERNAL_SUBMISSION_MAX_ZIP_RATIO = 100/);
  assert.match(validator, /zip_path_unsafe/);
  assert.match(validator, /pdf_invalid_or_encrypted/);
  assert.match(validator, /duplicate_page/);
  assert.match(uploadRoute, /readCloudAssetUploadBody/);
  assert.match(uploadRoute, /EXTERNAL_SUBMISSION_UPLOAD_MAX_REQUEST_BYTES/);
  assert.match(workerRoute, /hasValidInternalWorkerAuthorization/);
  assert.match(workerRoute, /MANGAI_EXTERNAL_SUBMISSION_WORKER_ENABLED/);
  assert.match(nextConfig, /serverExternalPackages:\s*\["@napi-rs\/canvas"\]/);
});
