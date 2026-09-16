import type { CloudGenerationInput } from "@mangai/ai-core";

const CONSERVATIVE_GENERAL_AUDIENCE_RETRY_GUIDANCE =
  "一般向けの穏やかな日常場面として、人物が整った環境で自然に立ち、表情と視線だけで物語の余韻を伝える。";

export type FailedGenerationRetryRecovery =
  | "retryable"
  | "edit_required"
  | "unavailable";

export function isProviderRejectedGenerationFailure(input: {
  errorCode: string | null;
  hasProviderJobId: boolean;
}) {
  // Gateway moderation can reject a parsed provider response before its
  // provider job id is checkpointed. The server-written moderation code is
  // therefore authoritative on its own, including for older BFL jobs whose
  // checkpoint was not persisted.
  return (
    input.errorCode === "provider_moderation_blocked" ||
    (input.hasProviderJobId && input.errorCode === "provider_rejected")
  );
}

export function classifyFailedGenerationRetryRecovery(input: {
  status: string;
  generation: CloudGenerationInput | null;
  errorCode: string | null;
  hasProviderJobId: boolean;
}): FailedGenerationRetryRecovery {
  if (input.status !== "failed" || !input.generation) return "unavailable";
  const providerRejected = isProviderRejectedGenerationFailure(input);
  const conservativeRetry =
    input.generation.kind === "image" &&
    input.generation.prompt.includes(
      CONSERVATIVE_GENERAL_AUDIENCE_RETRY_GUIDANCE,
    );
  return providerRejected && conservativeRetry ? "edit_required" : "retryable";
}
