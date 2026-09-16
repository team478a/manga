import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Flag OFFでは新DB列を問い合わせず既存生成一覧契約を維持する", async () => {
  const source = await readFile("src/modules/cloud-creator/generation/generation-service.ts", "utf8");
  assert.match(source, /let query = recoveryUiEnabled\s*\? supabase/);
  assert.match(source, /input,provider_job_id,execution_phase,failure_stage,retry_disposition,last_checkpoint_at/);
  assert.match(source, /input,provider_job_id"\s*,\s*\)\.eq\("project_id", projectId\);/);
  assert.match(source, /execution_phase: recoveryUiEnabled.*\? row\.execution_phase : null/);
});

test("回復UIはFlagで閉じ、生エラー本文を表示しない", async () => {
  const source = await readFile("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx", "utf8");
  const component = source.slice(source.indexOf("function GenerationRecoveryStatus"), source.indexOf("function cloneCanvas"));
  assert.match(component, /if \(!job\.recovery_ui_enabled\) return null/);
  assert.doesNotMatch(component, /error_message|http_status|error_code/);
});

test("終端moderation失敗はPromptを返さず内容見直しへ案内する", async () => {
  const [service, editor, contracts] = await Promise.all([
    readFile("src/modules/cloud-creator/generation/generation-service.ts", "utf8"),
    readFile("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx", "utf8"),
    readFile("src/modules/cloud-creator/contracts/types.ts", "utf8"),
  ]);
  assert.match(service, /classifyFailedGenerationRetryRecovery/);
  assert.match(service, /provider_job_id: _privateProviderJobId/);
  assert.match(contracts, /failed_retry_recovery: "retryable" \| "edit_required" \| "unavailable"/);
  assert.match(editor, /一般向けの安全再構成でも生成できなかったため、自動再実行を停止しました/);
  assert.match(editor, /このコマの構図・場面を見直す/);
  assert.match(editor, /panel-ai-generation/);
  assert.match(editor, /panel-generation-adjustments/);
  assert.match(editor, /adjustments instanceof HTMLDetailsElement/);
  assert.match(editor, /adjustments\.open = true/);
  assert.match(editor, /compositionInput\?\.focus\(\)/);
  assert.match(editor, /PANEL_MODERATION_RECOVERY_GUIDANCE/);
  assert.match(editor, /内容は自動入力されず、生成もまだ始まりません/);
  assert.match(editor, /panel-moderation-recovery-guidance/);
  assert.match(editor, /recoveryGuidancePanelId === selection\.id/);
  assert.match(editor, /1案（回復・最小費用）/);
  assert.match(editor, /prepareRecoveryPanelGenerationConfirmation/);
  assert.match(editor, /画像生成の実行前確認/);
  assert.match(editor, /生成Job、credit予約、Provider実行は発生していません/);
  assert.match(editor, /confirmRecoveryPanelGeneration/);
  assert.match(editor, /estimate\.canStart/);
});

test("moderation拒否はProvider Job ID保存前でも表示と実行を同じ判定器で閉じる", async () => {
  const [classifier, interactiveRetry, batchRetry] = await Promise.all([
    readFile("src/lib/cloud-generation-retry-recovery.ts", "utf8"),
    readFile("src/modules/cloud-creator/generation/interactive-retry-service.ts", "utf8"),
    readFile("src/modules/cloud-creator/generation/batch-production-service.ts", "utf8"),
  ]);
  assert.match(classifier, /errorCode === "provider_moderation_blocked" \|\|/);
  assert.match(classifier, /hasProviderJobId && input\.errorCode === "provider_rejected"/);
  assert.match(interactiveRetry, /isProviderRejectedGenerationFailure/);
  assert.match(batchRetry, /isProviderRejectedGenerationFailure/);
});
