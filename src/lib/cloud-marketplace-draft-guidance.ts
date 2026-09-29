export type CloudMarketplaceDraftGuidanceStage =
  | "manuscript_unavailable"
  | "manuscript_incomplete"
  | "release_checkpoint_missing"
  | "ready";

export type CloudMarketplaceDraftGuidance = {
  action: { href: string; label: string } | null;
  ready: boolean;
  stage: CloudMarketplaceDraftGuidanceStage;
  summary: string;
};

export function buildCloudMarketplaceDraftGuidance(input: {
  manuscriptAvailable: boolean;
  manuscriptErrorCount: number;
  manuscriptReady: boolean;
  releaseCheckpointCount: number;
}): CloudMarketplaceDraftGuidance {
  if (!input.manuscriptAvailable) {
    return {
      action: null,
      ready: false,
      stage: "manuscript_unavailable",
      summary: "原稿の完成状況を確認できないため、販売下書きは作成できません。",
    };
  }

  if (!input.manuscriptReady) {
    return {
      action: { href: "#manuscript-status", label: "原稿チェックを確認" },
      ready: false,
      stage: "manuscript_incomplete",
      summary:
        input.manuscriptErrorCount > 0
          ? `原稿チェックの要修正${input.manuscriptErrorCount}件を解消し、すべてのページを確定してください。`
          : "原稿チェックを完了し、すべてのページを確定してください。",
    };
  }

  if (input.releaseCheckpointCount < 1) {
    return {
      action: { href: "#checkpoint-heading", label: "完成版を固定する場所へ移動" },
      ready: false,
      stage: "release_checkpoint_missing",
      summary: "原稿チェックは完了しています。次に完成版を固定してください。",
    };
  }

  return {
    action: null,
    ready: true,
    stage: "ready",
    summary: "完成版を選んで販売下書きを作成できます。",
  };
}
