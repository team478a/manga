import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("external publications preserve Cloud rows and require one exclusive source", async () => {
  const [migration, rollback, schema] = await Promise.all([
    read("supabase/migrations/202610100003_external_submission_publications.sql"),
    read("supabase/rollbacks/202610100003_external_submission_publications.sql"),
    read("supabase/schema.sql"),
  ]);
  for (const source of [migration, schema]) {
    assert.match(source, /source_kind text not null default 'cloud'/);
    assert.match(source, /cloud_work_publications_source_check/);
    assert.match(source, /source_kind='cloud'[\s\S]+project_id is not null[\s\S]+checkpoint_id is not null/);
    assert.match(source, /source_kind='external'[\s\S]+external_submission_id is not null/);
    assert.match(source, /create unique index if not exists cloud_work_publications_external_submission_idx/);
  }
  assert.match(rollback, /external_submission_publications_rollback_requires_empty_data/);
});

test("external publication RPC is admin gated, idempotent by linkage, and fixes samples", async () => {
  const [migration, sampleRoute, client] = await Promise.all([
    read("supabase/migrations/202610100003_external_submission_publications.sql"),
    read("src/app/api/creator/external-submissions/[submissionId]/pages/samples/route.ts"),
    read("src/app/dashboard/external-submissions/[submissionId]/ExternalSubmissionUploadClient.tsx"),
  ]);
  assert.match(migration, /create_external_work_publication/);
  assert.match(migration, /set_external_submission_sample_pages/);
  assert.match(migration, /not public\.is_admin\(\)/);
  assert.match(migration, /v_submission\.status<>'approved'/);
  assert.match(migration, /v_submission\.work_id is not null/);
  assert.match(migration, /v_sample_count>least\(10,v_page_count\)/);
  assert.match(migration, /v_page_count>1 and v_sample_count>=v_page_count/);
  assert.match(migration, /validation_status='validated' and is_sample/);
  assert.match(migration, /manifest_sha256,source_kind,[\s\S]+v_manifest_sha256,'external'/);
  assert.match(migration, /'external-submission-pages',page\.storage_path,page\.is_sample/);
  assert.match(migration, /'publication_created','approved','approved'/);
  assert.match(sampleRoute, /setExternalSubmissionSamplePages/);
  assert.match(sampleRoute, /\.min\(1\)\.max\(10\)/);
  assert.match(client, /試し読みに含める/);
  assert.match(client, /2ページ以上の作品では全ページを選べません/);
});

test("orders snapshot publication versions and Reader accepts only owned or purchased versions", async () => {
  const [migration, repository, checkout, reader, shelf, route] = await Promise.all([
    read("supabase/migrations/202610100003_external_submission_publications.sql"),
    read("src/modules/checkout/infrastructure/checkout-order-repository.ts"),
    read("src/lib/checkout-policy.ts"),
    read("src/modules/publication/application/work-publication-service.ts"),
    read("src/app/dashboard/purchases/page.tsx"),
    read("src/app/works/[id]/read/page.tsx"),
  ]);
  assert.match(migration, /add column if not exists publication_id uuid/);
  assert.match(migration, /new\.publication_id:=v_current_publication_id/);
  assert.match(migration, /order_publication_version_mismatch/);
  assert.match(repository, /publication_id: input\.publicationId/);
  assert.match(repository, /query\.eq\("publication_id", input\.publicationId\)/);
  assert.match(repository, /query\.is\("publication_id", null\)/);
  assert.match(checkout, /order\.publication_id !== order\.digital_products\.works\.current_publication_id/);
  assert.match(reader, /purchasedPublicationIds/);
  assert.match(reader, /includes\(requestedPublicationId\)/);
  assert.match(shelf, /purchase\.publication_id \?\? work\?\.current_publication_id/);
  assert.match(route, /query\.publication/);
  assert.match(route, /publication=\$\{publication\.publicationId\}/);
});
