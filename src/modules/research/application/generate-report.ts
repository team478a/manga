import type {
  CloudResearchInput,
  CloudResearchRequest,
} from "../contracts/research-input.ts";
import type { CloudResearchResult } from "../contracts/research-output.ts";
import {
  PermissionDeniedError,
  QuotaExceededError,
} from "../../../lib/domain-errors.ts";

type AnalysisOutput = {
  input: CloudResearchInput;
  result: CloudResearchResult;
};

export type GenerateResearchReportDependencies = {
  featureEnabled(): boolean;
  enforceRateLimit(profileId: string): Promise<void>;
  getMonitorAllowance(profileId: string): Promise<{
    used: number;
    limit: number;
  }>;
  analyze(input: {
    profileId: string;
    request: CloudResearchRequest;
  }): Promise<AnalysisOutput>;
  consumeAllowance(profileId: string): Promise<void>;
  save(input: {
    profileId: string;
    input: CloudResearchInput;
    result: CloudResearchResult;
  }): Promise<string>;
};

export async function generateResearchReport(
  input: { profileId: string; request: CloudResearchRequest },
  dependencies: GenerateResearchReportDependencies,
) {
  if (!dependencies.featureEnabled())
    throw new PermissionDeniedError("市場分析機能は現在停止中です。");
  if (input.request.contentClass !== "general")
    throw new PermissionDeniedError(
      "今回の限定モニターは一般向け作品のみ利用できます。",
    );

  await dependencies.enforceRateLimit(input.profileId);
  const allowance = await dependencies.getMonitorAllowance(input.profileId);
  if (allowance.used >= allowance.limit)
    throw new QuotaExceededError(
      "モニター期間中のAI利用上限に達しました。管理者へご連絡ください。",
    );

  const analysis = await dependencies.analyze(input);
  await dependencies.consumeAllowance(input.profileId);
  return dependencies.save({ profileId: input.profileId, ...analysis });
}
