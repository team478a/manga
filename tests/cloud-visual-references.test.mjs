import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cloudPanelSubjectAssignmentInputSchema,
  cloudVisualReferenceInputSchema,
} from "../src/lib/cloud-visual-references.ts";

const projectId = "50000000-0000-4000-8000-000000000001";
const subjectId = "60000000-0000-4000-8000-000000000001";
const assetId = "70000000-0000-4000-8000-000000000001";

test("参照画像とコマ割当入力はUUIDと対象種別を検証する", () => {
  assert.equal(cloudVisualReferenceInputSchema.parse({
    projectId,
    subjectKind: "character",
    subjectId,
    assetId,
    label: "正面の顔",
  }).label, "正面の顔");
  assert.throws(() => cloudPanelSubjectAssignmentInputSchema.parse({
    projectId,
    pageId: subjectId,
    panelId: assetId,
    subjectKind: "style",
    subjectId,
  }));
});

test("M2-3 migrationは所有者RLS・対象検証・rollbackを持つ", async () => {
  const migration = await readFile("supabase/migrations/202608010001_cloud_visual_references.sql", "utf8");
  const rollback = await readFile("supabase/rollbacks/202608010001_cloud_visual_references.sql", "utf8");
  assert.match(migration, /cloud_visual_reference_assets/);
  assert.match(migration, /cloud_panel_subject_assignments/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /cloud_visual_subject_exists/);
  assert.doesNotMatch(migration, /grant select, insert[^;]*authenticated/i);
  assert.match(rollback, /drop table if exists public\.cloud_visual_reference_assets/);
});

test("参照画像画面はアップロード・明示割当・処理中表示を持つ", async () => {
  const page = await readFile("src/app/creator/[projectId]/references/page.tsx", "utf8");
  assert.match(page, /参照画像とコマ割当/);
  assert.match(page, /参照画像を保存/);
  assert.match(page, /コマへ割り当て/);
  assert.match(page, /保存中…/);
  assert.match(page, /割当中…/);
});
