import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("R4-2D migrationはrelease checkpointへ固定した版とページを保持する", async () => {
  const sql = await read("supabase/migrations/202608140004_cloud_work_publications.sql");
  assert.match(sql, /create table if not exists public\.cloud_work_publications/);
  assert.match(sql, /checkpoint_id uuid not null references public\.cloud_project_checkpoints/);
  assert.match(sql, /unique\(work_id,version\)/);
  assert.match(sql, /create table if not exists public\.cloud_work_publication_pages/);
  assert.match(sql, /kind='release'/);
  assert.match(sql, /manifest_sha256<>p_manifest_sha256/);
  assert.match(sql, /cloud_marketplace_page_count_mismatch/);
});

test("公開・販売とversion切替はServer／DBの両方でfail closedになる", async () => {
  const [sql, workActions, productActions] = await Promise.all([
    read("supabase/migrations/202608140004_cloud_work_publications.sql"),
    read("src/app/actions/work-actions.ts"),
    read("src/app/actions/product-actions.ts"),
  ]);
  assert.match(sql, /cloud_work_publication_required/);
  assert.match(sql, /cloud_product_publication_required/);
  assert.match(sql, /cloud_work_publication_in_use/);
  assert.match(workActions, /完成版を固定してから公開してください/);
  assert.match(productActions, /完成版を固定して作品を公開してから販売を開始してください/);
});

test("旧1枚画像作品はCloud publication gateの対象外として後方互換を保つ", async () => {
  const [sql, release] = await Promise.all([
    read("supabase/migrations/202608140004_cloud_work_publications.sql"),
    read("docs/RELEASE_CANDIDATE_R4_2D_WORK_PUBLICATION_LINK.md"),
  ]);
  assert.match(sql, /if new\.source_project_id is not null and \(new\.is_public or new\.status='published'\)/);
  assert.match(sql, /new\.status='active' and exists\(select 1 from public\.works w where w\.id=new\.work_id and w\.source_project_id is not null/);
  assert.match(release, /旧1枚画像作品は`source_project_id is null`/);
});

test("読者画面はサンプルと購入後本文を分離し縦長画像を切らない", async () => {
  const [service, page, detail] = await Promise.all([
    read("src/modules/publication/application/work-publication-service.ts"),
    read("src/app/works/[id]/read/page.tsx"),
    read("src/app/works/[id]/page.tsx"),
  ]);
  assert.match(service, /status", "paid"/);
  assert.match(service, /filter\(\(page\) => page\.is_sample\)/);
  assert.match(service, /createSignedUrl\(selected\.storage_path, 300\)/);
  assert.match(page, /max-h-\[85vh\].*object-contain/);
  assert.match(page, /前のページ/);
  assert.match(page, /次のページ/);
  assert.match(detail, /本文を読む/);
});

test("販売同期はlive Canvasではなく明示したrelease checkpointを使用する", async () => {
  const [marketplace, exporter, action] = await Promise.all([
    read("src/lib/cloud-marketplace.ts"),
    read("src/modules/cloud-creator/export/prepare-project-export.ts"),
    read("src/app/creator/actions.ts"),
  ]);
  assert.match(marketplace, /createCloudMarketplaceArtifacts\(input\.projectId, input\.checkpointId\)/);
  assert.match(marketplace, /sync_cloud_marketplace_release_draft/);
  assert.match(exporter, /stageCloudProjectCheckpointExportBundle/);
  assert.match(action, /checkpointId: z\.string\(\)\.uuid\(\)/);
});
