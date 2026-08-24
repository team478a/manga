import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Flag OFFでは新DB列を問い合わせず既存生成一覧契約を維持する", async () => {
  const source = await readFile("src/modules/cloud-creator/generation/generation-service.ts", "utf8");
  assert.match(source, /let query = recoveryUiEnabled\s*\? supabase/);
  assert.match(source, /input,execution_phase,failure_stage,retry_disposition,last_checkpoint_at/);
  assert.match(source, /execution_phase: recoveryUiEnabled.*\? row\.execution_phase : null/);
});

test("回復UIはFlagで閉じ、生エラー本文を表示しない", async () => {
  const source = await readFile("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx", "utf8");
  const component = source.slice(source.indexOf("function GenerationRecoveryStatus"), source.indexOf("function cloneCanvas"));
  assert.match(component, /if \(!job\.recovery_ui_enabled\) return null/);
  assert.doesNotMatch(component, /error_message|http_status|error_code/);
});
