import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCloudLongformReadiness } from "../src/lib/cloud-longform-readiness.ts";

const base = {
  manuscriptAvailable: true,
  manuscriptReady: false,
  manuscriptErrorCount: 3,
  checkpointAvailable: true,
  restoreAvailable: true,
  checkpointCount: 0,
  releaseCount: 0,
  exportAvailable: true,
  completedExportCount: 0,
  activeExport: false,
};

test("長編完成ガイドは未完了工程を制作順に案内する", () => {
  const first = buildCloudLongformReadiness(base);
  assert.equal(first.ready, false);
  assert.deepEqual(first.nextAction, { label: "原稿の修正項目を確認", href: "#manuscript-status" });
  assert.match(first.items[0].detail, /3件/);

  const protectedWork = buildCloudLongformReadiness({ ...base, manuscriptReady: true, manuscriptErrorCount: 0 });
  assert.deepEqual(protectedWork.nextAction, { label: "バックアップを作成", href: "#checkpoint-heading" });

  const fixed = buildCloudLongformReadiness({ ...base, manuscriptReady: true, checkpointCount: 1 });
  assert.deepEqual(fixed.nextAction, { label: "完成版を固定", href: "#checkpoint-heading" });
});

test("完成版とPDFが揃った作品を完成準備完了にする", () => {
  const result = buildCloudLongformReadiness({
    ...base,
    manuscriptReady: true,
    checkpointCount: 2,
    releaseCount: 1,
    completedExportCount: 1,
  });
  assert.equal(result.ready, true);
  assert.equal(result.completedCount, 4);
  assert.deepEqual(result.nextAction, { label: "完成PDFを確認", href: "#durable-export" });
});

test("機能未適用時は完了扱いにせず準備確認へ案内する", () => {
  const result = buildCloudLongformReadiness({ ...base, manuscriptReady: true, restoreAvailable: false });
  assert.equal(result.items[1].status, "unavailable");
  assert.deepEqual(result.nextAction, { label: "復元機能の準備を確認", href: "#checkpoint-heading" });
});

test("作品画面は長編完成ガイドと既存工程のanchorを持つ", () => {
  const page = readFileSync(new URL("../src/app/creator/[projectId]/page.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../src/app/creator/[projectId]/LongformReadinessPanel.tsx", import.meta.url), "utf8");
  const exportPanel = readFileSync(new URL("../src/app/creator/[projectId]/DurableExportPanel.tsx", import.meta.url), "utf8");
  const checkpointPanel = readFileSync(new URL("../src/app/creator/[projectId]/ProjectCheckpointPanel.tsx", import.meta.url), "utf8");
  assert.match(page, /LongformReadinessPanel/);
  assert.match(page, /const manuscript = exportReadiness/);
  assert.match(panel, /長編完成ガイド/);
  assert.match(page, /id="manuscript-status"/);
  assert.match(exportPanel, /id="durable-export"/);
  assert.match(checkpointPanel, /id="checkpoint-heading"/);
});
