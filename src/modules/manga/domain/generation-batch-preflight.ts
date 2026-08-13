export type GenerationBatchPreflightContext = {
  available: boolean;
  providerEnabled: boolean;
  modelId: string | null;
  pricingVersion: string | null;
  currency: string;
  creditsPerJob: number | null;
  maxCostMicrosPerJob: number | null;
  planKey: "free" | "trial" | "creator" | null;
  entitlementStatus: string | null;
  planGenerationEnabled: boolean;
  planCreditsRemaining: number | null;
  planCostMicrosRemaining: number | null;
  projectGenerationEnabled: boolean;
  projectCreditsRemaining: number | null;
  projectCostMicrosRemaining: number | null;
  globalGenerationEnabled: boolean;
  globalCostMicrosRemaining: number | null;
  monitorActive: boolean;
  monitorRequestsRemaining: number | null;
  userRequestsPerMinute: number | null;
  projectRequestsPerMinute: number | null;
  pagePanelCounts: Record<string, number | null>;
  schedulerJobsPerRun: number;
  schedulerIntervalMinutes: number;
};

export type GenerationBatchPreflightEstimate = {
  selectedPageCount: number;
  targetPanelCount: number;
  candidateCount: 1;
  requiredCredits: number | null;
  maxReservedCostMicros: number | null;
  schedulerRuns: number;
  schedulerMinimumMinutes: number;
  registrationLimit: number | null;
  canStart: boolean;
  blockers: string[];
};

function remaining(limit: number | null, reserved: number, used: number) {
  return limit === null ? null : Math.max(0, limit - reserved - used);
}

export function remainingGenerationCapacity(input: {
  limit: number | null;
  reserved: number;
  used: number;
}) {
  return remaining(input.limit, input.reserved, input.used);
}

export function estimateGenerationBatch(
  context: GenerationBatchPreflightContext,
  pageIds: string[],
): GenerationBatchPreflightEstimate {
  const uniquePageIds = [...new Set(pageIds)];
  const missingSnapshot = uniquePageIds.some(
    (pageId) => context.pagePanelCounts[pageId] === null || context.pagePanelCounts[pageId] === undefined,
  );
  const emptyPage = uniquePageIds.some(
    (pageId) => context.pagePanelCounts[pageId] === 0,
  );
  const targetPanelCount = uniquePageIds.reduce(
    (total, pageId) => total + (context.pagePanelCounts[pageId] ?? 0),
    0,
  );
  const requiredCredits = context.creditsPerJob === null
    ? null
    : targetPanelCount * context.creditsPerJob;
  const maxReservedCostMicros = context.maxCostMicrosPerJob === null
    ? null
    : targetPanelCount * context.maxCostMicrosPerJob;
  const schedulerRuns = targetPanelCount
    ? Math.ceil(targetPanelCount / context.schedulerJobsPerRun)
    : 0;
  const rateLimits = [
    context.userRequestsPerMinute,
    context.projectRequestsPerMinute,
  ].filter((value): value is number => value !== null);
  const registrationLimit = rateLimits.length ? Math.min(...rateLimits) : null;
  const blockers: string[] = [];

  if (uniquePageIds.length < 4 || uniquePageIds.length > 8)
    blockers.push("一括生成するページを4〜8ページ選んでください。");
  if (missingSnapshot)
    blockers.push("現在のCanvasを確認できないページが含まれています。各ページを保存してから再度お試しください。");
  if (emptyPage)
    blockers.push("生成可能なコマがないページが含まれています。コマを配置して保存してから再度お試しください。");
  if (!targetPanelCount)
    blockers.push("選択したページに生成可能なコマがありません。");
  if (targetPanelCount > 64)
    blockers.push("一度に生成できるコマは64個までです。ページを分けてください。");
  if (!context.available || !context.providerEnabled || requiredCredits === null || maxReservedCostMicros === null)
    blockers.push("画像生成の料金と利用枠を確認できませんでした。");
  if (!context.monitorActive)
    blockers.push("一般向けモニターのAI利用枠を確認できませんでした。");
  if (context.monitorRequestsRemaining !== null && targetPanelCount > context.monitorRequestsRemaining)
    blockers.push(`モニターAI利用枠が${targetPanelCount - context.monitorRequestsRemaining}回不足しています。`);
  if (!["active", "trialing"].includes(context.entitlementStatus ?? ""))
    blockers.push("Cloud AI利用契約が有効ではありません。");
  if (!context.planGenerationEnabled || !context.projectGenerationEnabled || !context.globalGenerationEnabled)
    blockers.push("Cloud AI生成は現在停止中です。");
  if (requiredCredits !== null && context.planCreditsRemaining !== null && requiredCredits > context.planCreditsRemaining)
    blockers.push(`Cloud AI creditが${requiredCredits - context.planCreditsRemaining}不足しています。`);
  if (requiredCredits !== null && context.projectCreditsRemaining !== null && requiredCredits > context.projectCreditsRemaining)
    blockers.push(`作品の生成creditが${requiredCredits - context.projectCreditsRemaining}不足しています。`);
  if (maxReservedCostMicros !== null && context.planCostMicrosRemaining !== null && maxReservedCostMicros > context.planCostMicrosRemaining)
    blockers.push("Cloud AI費用上限を超えるため開始できません。");
  if (maxReservedCostMicros !== null && context.projectCostMicrosRemaining !== null && maxReservedCostMicros > context.projectCostMicrosRemaining)
    blockers.push("作品の費用上限を超えるため開始できません。");
  if (maxReservedCostMicros !== null && context.globalCostMicrosRemaining !== null && maxReservedCostMicros > context.globalCostMicrosRemaining)
    blockers.push("全体の日次費用上限を超えるため開始できません。");
  if (registrationLimit !== null && targetPanelCount > registrationLimit)
    blockers.push(`現在の1分登録上限は${registrationLimit}コマです。安全な分割登録の実装後に実行してください。`);

  return {
    selectedPageCount: uniquePageIds.length,
    targetPanelCount,
    candidateCount: 1,
    requiredCredits,
    maxReservedCostMicros,
    schedulerRuns,
    schedulerMinimumMinutes: schedulerRuns * context.schedulerIntervalMinutes,
    registrationLimit,
    canStart: blockers.length === 0,
    blockers: [...new Set(blockers)],
  };
}
