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

test("完了済みProvider受入れと残る外部受入れを混同しない", () => {
  const visual = p0P4CloseoutMatrix.find((item) => item.id === "major_character_mismatch_below_20_percent");
  assert.equal(visual.status, "PROVIDER_ACCEPTANCE_PASSED");
  assert.match(visual.result, /10\/10/);
  const exportAcceptance = p0P4CloseoutMatrix.find((item) => item.id === "page_export_pdf_and_images");
  assert.equal(exportAcceptance.status, "REPOSITORY_PASSED_EXTERNAL_PENDING");
  assert.match(exportAcceptance.blocker, /staging受入れには承認が必要/);
});

test("5条件はrepository gate、1条件はProvider受入れで完了している", () => {
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
  assert.equal(p0P4CloseoutMatrix.filter((item) => item.status === "PROVIDER_ACCEPTANCE_PASSED").length, 1);
});
