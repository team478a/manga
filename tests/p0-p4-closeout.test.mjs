import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { p0P4CloseoutMatrix } from "./fixtures/p0-p4-closeout-matrix.mjs";

const expectedIds = [
  "resume_20_pages",
  "retry_failed_panel_only",
  "major_character_mismatch_below_20_percent",
  "dialogue_edit_without_regeneration",
  "generation_provenance_traceable",
  "page_export_pdf_and_images",
  "project_cost_and_regeneration_metrics",
];

test("P0〜P4 closeoutは初期ユーザー向け7完了条件を重複なく追跡する", () => {
  assert.deepEqual(p0P4CloseoutMatrix.map((item) => item.id), expectedIds);
  assert.equal(new Set(p0P4CloseoutMatrix.map((item) => item.id)).size, expectedIds.length);
  for (const item of p0P4CloseoutMatrix) assert.equal(fs.existsSync(item.evidence), true, item.evidence);
});

test("repository成功と外部承認待ちを混同しない", () => {
  const visual = p0P4CloseoutMatrix.find((item) => item.id === "major_character_mismatch_below_20_percent");
  assert.equal(visual.status, "EXTERNAL_APPROVAL_REQUIRED");
  assert.match(visual.blocker, /Provider実行・credit承認/);
  const exportAcceptance = p0P4CloseoutMatrix.find((item) => item.id === "page_export_pdf_and_images");
  assert.equal(exportAcceptance.status, "REPOSITORY_PASSED_EXTERNAL_PENDING");
  assert.match(exportAcceptance.blocker, /staging受入れには承認が必要/);
});

test("承認不要の5条件はrepository gateで完了している", () => {
  assert.deepEqual(
    p0P4CloseoutMatrix.filter((item) => item.status === "REPOSITORY_PASSED").map((item) => item.id),
    [
      "resume_20_pages",
      "retry_failed_panel_only",
      "dialogue_edit_without_regeneration",
      "generation_provenance_traceable",
      "project_cost_and_regeneration_metrics",
    ],
  );
});
