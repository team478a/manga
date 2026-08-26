export const p0P4CloseoutMatrix = [
  {
    id: "resume_20_pages",
    status: "REPOSITORY_PASSED",
    evidence: "tests/cloud-generation-run-checkpoint.test.mjs",
  },
  {
    id: "retry_failed_panel_only",
    status: "REPOSITORY_PASSED",
    evidence: "tests/cloud-quality-inspection-acceptance.test.mjs",
  },
  {
    id: "major_character_mismatch_below_20_percent",
    status: "EXTERNAL_APPROVAL_REQUIRED",
    evidence: "tests/cloud-story-bible-ten-scene-acceptance.test.mjs",
    blocker: "実画像10シーンの視覚採点にはProvider実行・credit承認が必要",
  },
  {
    id: "dialogue_edit_without_regeneration",
    status: "REPOSITORY_PASSED",
    evidence: "tests/cloud-panel-editing-ten-panel-acceptance.test.mjs",
  },
  {
    id: "generation_provenance_traceable",
    status: "REPOSITORY_PASSED",
    evidence: "tests/cloud-story-bible-ten-scene-acceptance.test.mjs",
  },
  {
    id: "page_export_pdf_and_images",
    status: "REPOSITORY_PASSED_EXTERNAL_PENDING",
    evidence: "tests/p4-completion-export-acceptance.test.mjs",
    blocker: "未適用migration・Feature Flag・実Storage／Workerのstaging受入れには承認が必要",
  },
  {
    id: "project_cost_and_regeneration_metrics",
    status: "REPOSITORY_PASSED",
    evidence: "tests/cloud-quality-inspection-acceptance.test.mjs",
  },
];
