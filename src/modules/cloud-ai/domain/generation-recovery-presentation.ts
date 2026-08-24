import type { CloudGenerationFailureStage } from "./generation-lifecycle-event.ts";
import type { CloudGenerationExecutionPhase, CloudGenerationRetryDisposition, LegacyCloudGenerationStatus } from "./resumable-generation-state.ts";

const phaseLabels: Record<CloudGenerationExecutionPhase, string> = { queued: "待機中", preparing: "生成準備中", generating: "画像生成中", validating: "生成結果を検査中", succeeded: "完了", failed: "失敗", canceled: "中止済み", unknown: "処理状況を確認中" };
const failureStageLabels: Record<CloudGenerationFailureStage, string> = { request: "生成受付", visual_readiness: "人物・画風の準備確認", moderation: "安全確認", quota: "利用枠確認", claim: "処理開始", lease: "処理権の維持", reference_resolution: "参照画像の確認", provider: "画像生成サービス", validation: "生成結果の検査", storage: "画像保存", completion: "完了記録", quality: "品質確認", adoption: "コマへの配置", dialogue: "セリフ配置" };

export function buildGenerationRecoveryPresentation(input: { status: LegacyCloudGenerationStatus; executionPhase: CloudGenerationExecutionPhase | null; failureStage: CloudGenerationFailureStage | null; retryDisposition: CloudGenerationRetryDisposition | null; lastCheckpointAt: string | null }) {
  const phase = input.executionPhase ?? (input.status === "running" ? "unknown" : input.status === "completed" ? "succeeded" : input.status);
  return {
    phaseLabel: phaseLabels[phase],
    failureStageLabel: input.failureStage ? failureStageLabels[input.failureStage] : null,
    recoveryLabel: input.status === "queued" && input.retryDisposition === "automatic" ? "保存済みの処理から自動再開を待っています。" : input.status === "failed" ? "このコマだけ再試行できます。" : null,
    lastCheckpointAt: input.lastCheckpointAt,
  } as const;
}
