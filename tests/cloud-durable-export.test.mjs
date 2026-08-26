import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { createPagesPdf, mergePagesPdfs } from "../packages/export-core/src/index.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("分割PDFをページ順どおりに結合できる", async () => {
  const make = async (count, shade) => createPagesPdf(await Promise.all(Array.from({ length: count }, async (_, index) => ({
    fileName: `${index + 1}.png`,
    bytes: new Uint8Array(await sharp({ create: { width: 100, height: 150, channels: 3, background: { r: shade, g: shade, b: shade } } }).png().toBuffer()),
    mimeType: "image/png",
    width: 100,
    height: 150,
  }))), { dpi: 300 });
  const merged = await mergePagesPdfs([await make(4, 240), await make(3, 220)]);
  assert.equal((await PDFDocument.load(merged)).getPageCount(), 7);
});

test("永続Export migrationは所有者境界・lease・4ページ分割・再開を備える", () => {
  const sql = read("supabase/migrations/202608010006_cloud_durable_export.sql");
  assert.match(sql, /segment_size integer not null default 4/);
  assert.match(sql, /cardinality\(page_ids\) between 1 and 100/);
  assert.match(sql, /created_by_profile_id=public\.current_profile_id\(\)/);
  assert.match(sql, /production_status<>'finalized'/);
  assert.match(sql, /reviewed_context_revision is distinct from v_context/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /completed_pages=v_completed/);
  assert.match(sql, /cloud_export_jobs_one_active_idx/);
  assert.match(sql, /create_cloud_export_job[\s\S]+security definer/);
});

test("Export preflightは秘密値を表示せず必須設定だけを判定する", async () => {
  const { checkCloudExportEnvironment } = await import("../scripts/check-cloud-export-preflight.mjs");
  const report = checkCloudExportEnvironment({
    MANGAI_CLOUD_EXPORT_WORKER_ENABLED: "true",
    MANGAI_CLOUD_EXPORT_WORKER_SECRET: "x".repeat(32),
    SUPABASE_SERVICE_ROLE_KEY: "y".repeat(24),
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  });
  assert.equal(report.passed, true);
  assert.doesNotMatch(JSON.stringify(report), /x{8}|y{8}/);
});

test("Workerはページ画像・分割PDF・完成PDFを非公開Storageへ保存する", () => {
  const worker = read("src/modules/cloud-creator/export/process-export-segment.ts");
  const plan = read("src/modules/cloud-creator/export/export-plan.ts");
  const repository = read("src/modules/cloud-creator/export/manga-export-repository.ts");
  const storage = read("src/modules/cloud-creator/export/manga-export-storage.ts");
  assert.match(plan, /slice\(/);
  assert.match(worker, /segments\//);
  assert.match(worker, /mergePagesPdfs/);
  assert.match(worker, /manuscript\.pdf/);
  assert.match(repository, /fail_cloud_export_job/);
  assert.match(storage, /cloud-exports/);
});

test("作品画面は進捗・停止・再開・失敗箇所からの再開を表示する", () => {
  const component = read("src/app/creator/[projectId]/DurableExportPanel.tsx");
  const autoRefresh = read("src/app/creator/[projectId]/DurableExportAutoRefresh.tsx");
  assert.match(component, /4ページずつ安全に処理/);
  assert.match(component, /一時停止/);
  assert.match(component, /失敗箇所から再開/);
  assert.match(component, /PDFをダウンロード/);
  assert.match(component, /DurableExportAutoRefresh/);
  assert.match(autoRefresh, /window\.setInterval/);
  assert.match(autoRefresh, /router\.refresh/);
  assert.match(autoRefresh, /5秒ごとに自動更新/);
});

test("P4-Dは既存PDFを維持しimagesとProject JSONを既定OFFで追加する", () => {
  const migration = read("supabase/migrations/202608260002_cloud_durable_export_formats.sql");
  const rollback = read("supabase/rollbacks/202608260002_cloud_durable_export_formats.sql");
  const flags = read("src/lib/feature-flags.ts");
  const service = read("src/modules/cloud-creator/export/durable-export-service.ts");
  const panel = read("src/app/creator/[projectId]/DurableExportPanel.tsx");
  assert.match(migration, /format in\('pdf','images','project_json'\)/);
  assert.match(migration, /application\/json/);
  assert.match(rollback, /rollback_requires_no_extended_export_jobs/);
  assert.match(flags, /MANGAI_CLOUD_DURABLE_EXPORT_FORMATS_ENABLED: "strict"/);
  assert.match(service, /format !== "pdf".*MANGAI_CLOUD_DURABLE_EXPORT_FORMATS_ENABLED/s);
  assert.match(panel, /extendedFormatsEnabled/);
});

test("P4-D Workerはsegment再開からPNG ZIPとversioned Project JSONを完成する", () => {
  const worker = read("src/modules/cloud-creator/export/process-export-segment.ts");
  const repository = read("src/modules/cloud-creator/export/manga-export-repository.ts");
  assert.match(worker, /createImagesZip/);
  assert.match(worker, /pages\.zip/);
  assert.match(worker, /schemaVersion: 1/);
  assert.match(worker, /modeProfile: project\.completion_mode_profile/);
  assert.match(worker, /exportJobId: job\.id/);
  assert.match(worker, /sort\(\(a, b\) => a\.pageNumber - b\.pageNumber\)/);
  assert.match(repository, /page_storage_paths/);
  assert.match(repository, /completion_mode_profile/);
});
