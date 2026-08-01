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
  const worker = read("src/lib/cloud-export-worker.ts");
  assert.match(worker, /slice\(start, start \+ job\.segment_size\)/);
  assert.match(worker, /segments\//);
  assert.match(worker, /mergePagesPdfs/);
  assert.match(worker, /manuscript\.pdf/);
  assert.match(worker, /fail_cloud_export_job/);
});

test("作品画面は進捗・停止・再開・失敗箇所からの再開を表示する", () => {
  const component = read("src/app/creator/[projectId]/DurableExportPanel.tsx");
  assert.match(component, /4ページずつ安全に処理/);
  assert.match(component, /一時停止/);
  assert.match(component, /失敗箇所から再開/);
  assert.match(component, /PDFをダウンロード/);
});
