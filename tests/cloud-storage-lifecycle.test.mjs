import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import sharp from "sharp";

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("サムネイル形式は一覧表示に十分な寸法へ縮小される", async () => {
  const input = await sharp({
    create: {
      width: 1200,
      height: 1800,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();
  const output = await sharp(input)
    .resize({ width: 320, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 480);
});

test("Storage lifecycle migrationはprivate cache・lease・revision整合性を備える", () => {
  const sql = read(
    "supabase/migrations/202608010007_cloud_storage_lifecycle.sql",
  );
  assert.match(sql, /'cloud-cache','cloud-cache',false/);
  assert.match(sql, /cloud_canvas_snapshot_thumbnail_queue/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /v_current_revision is distinct from p_source_revision/);
  assert.match(sql, /created_by_profile_id=public\.current_profile_id|owner_profile_id=public\.current_profile_id/);
  assert.match(sql, /job\.status='completed'.*interval '24 hours'/s);
  assert.doesNotMatch(sql, /output_storage_path,'export_intermediate'/);
});

test("Storage Workerはcurrent revisionを描画してcacheだけへ保存する", () => {
  const worker = read("src/lib/cloud-storage-lifecycle-worker.ts");
  assert.match(worker, /eq\("revision", job\.source_revision\)/);
  assert.match(worker, /from\("cloud-cache"\)\.upload/);
  assert.match(worker, /quality: 78/);
  assert.match(worker, /queue_expired_cloud_storage_artifacts/);
  assert.doesNotMatch(worker, /from\("cloud-assets"\)\.remove/);
});

test("Storage preflightは秘密値を表示しない", async () => {
  const { checkCloudStorageEnvironment } = await import(
    "../scripts/check-cloud-storage-preflight.mjs"
  );
  const report = checkCloudStorageEnvironment({
    MANGAI_CLOUD_STORAGE_WORKER_ENABLED: "true",
    MANGAI_CLOUD_STORAGE_WORKER_SECRET: "s".repeat(32),
    SUPABASE_SERVICE_ROLE_KEY: "k".repeat(24),
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  });
  assert.equal(report.passed, true);
  assert.doesNotMatch(JSON.stringify(report), /s{8}|k{8}/);
});

test("作品・ページ一覧は期限付きサムネイルを表示する", () => {
  const service = read(
    "src/modules/cloud-creator/assets/thumbnail-service.ts",
  );
  const creator = read("src/app/creator/page.tsx");
  const manager = read(
    "src/app/creator/[projectId]/LongformPageManager.tsx",
  );
  assert.match(service, /createSignedUrls\(paths, 600\)/);
  assert.match(creator, /project\.thumbnail_url/);
  assert.match(manager, /page\.thumbnail_url/);
});
