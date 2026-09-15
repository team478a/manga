import type { CloudGenerationInput } from "@mangai/ai-core";

const CONSERVATIVE_GENERAL_AUDIENCE_RETRY_GUIDANCE =
  "一般向けの穏やかな日常場面として、人物が整った環境で自然に立ち、表情と視線だけで物語の余韻を伝える。";

export type FailedGenerationRetryRecovery =
  | "retryable"
  | "edit_required"
  | "unavailable";

export function classifyFailedGenerationRetryRecovery(input: {
  status: string;
  generation: CloudGenerationInput | null;
  errorCode: string | null;
  hasProviderJobId: boolean;
}): FailedGenerationRetryRecovery {
  if (input.status !== "failed" || !input.generation) return "unavailable";
  const providerRejected =
    input.hasProviderJobId &&
    (input.errorCode === "provider_rejected" ||
      input.errorCode === "provider_moderation_blocked");
  const conservativeRetry =
    input.generation.kind === "image" &&
    input.generation.prompt.includes(
      CONSERVATIVE_GENERAL_AUDIENCE_RETRY_GUIDANCE,
    );
  return providerRejected && conservativeRetry ? "edit_required" : "retryable";
}
