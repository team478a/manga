import assert from "node:assert/strict";
import test from "node:test";
import { buildGenerationRecoveryPresentation } from "../src/modules/cloud-ai/domain/generation-recovery-presentation.ts";

test("自動再開待ちは保存済み処理からの継続を案内する", () => {
  const view = buildGenerationRecoveryPresentation({ status: "queued", executionPhase: "generating", failureStage: "provider", retryDisposition: "automatic", lastCheckpointAt: "2026-08-24T09:00:00.000Z" });
  assert.equal(view.phaseLabel, "画像生成中");
  assert.equal(view.failureStageLabel, "画像生成サービス");
  assert.match(view.recoveryLabel, /自動再開/);
});

test("失敗工程を安全な日本語へ変換しコマ単位再試行を案内する", () => {
  const view = buildGenerationRecoveryPresentation({ status: "failed", executionPhase: "failed", failureStage: "storage", retryDisposition: "none", lastCheckpointAt: null });
  assert.equal(view.failureStageLabel, "画像保存");
  assert.equal(view.recoveryLabel, "このコマだけ再試行できます。");
});
