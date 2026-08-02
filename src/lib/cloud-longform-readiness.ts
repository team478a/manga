export type LongformReadinessStatus = "complete" | "action" | "unavailable";

export type LongformReadinessItem = {
  id: "manuscript" | "recovery" | "release" | "export";
  label: string;
  detail: string;
  status: LongformReadinessStatus;
  href: string;
};

export type LongformReadiness = {
  ready: boolean;
  completedCount: number;
  totalCount: number;
  items: LongformReadinessItem[];
  nextAction: { label: string; href: string };
};

export function buildCloudLongformReadiness(input: {
  manuscriptAvailable: boolean;
  manuscriptReady: boolean;
  manuscriptErrorCount: number;
  checkpointAvailable: boolean;
  restoreAvailable: boolean;
  checkpointCount: number;
  releaseCount: number;
  exportAvailable: boolean;
  completedExportCount: number;
  activeExport: boolean;
}): LongformReadiness {
  const manuscriptStatus: LongformReadinessStatus = !input.manuscriptAvailable
    ? "unavailable"
    : input.manuscriptReady ? "complete" : "action";
  const recoveryStatus: LongformReadinessStatus = !input.checkpointAvailable || !input.restoreAvailable
    ? "unavailable"
    : input.checkpointCount > 0 ? "complete" : "action";
  const releaseStatus: LongformReadinessStatus = !input.checkpointAvailable
    ? "unavailable"
    : input.releaseCount > 0 ? "complete" : "action";
  const exportStatus: LongformReadinessStatus = !input.exportAvailable
    ? "unavailable"
    : input.completedExportCount > 0 ? "complete" : "action";

  const items: LongformReadinessItem[] = [
    {
      id: "manuscript",
      label: "原稿を確定",
      detail: manuscriptStatus === "complete"
        ? "全ページの確認と原稿チェックが完了しています。"
        : manuscriptStatus === "unavailable"
          ? "原稿の完成状況を取得できませんでした。"
          : `${input.manuscriptErrorCount}件の要修正を解消し、全ページを確定してください。`,
      status: manuscriptStatus,
      href: "#manuscript-status",
    },
    {
      id: "recovery",
      label: "復旧できる状態を保存",
      detail: recoveryStatus === "complete"
        ? "復元可能な固定版があります。"
        : recoveryStatus === "unavailable"
          ? "復元機能の準備状況を確認してください。"
          : "大きな処理の前に作業バックアップを作成してください。",
      status: recoveryStatus,
      href: "#checkpoint-heading",
    },
    {
      id: "release",
      label: "完成版を固定",
      detail: releaseStatus === "complete"
        ? "完成版が固定されています。"
        : releaseStatus === "unavailable"
          ? "完成版固定機能の準備状況を確認してください。"
          : "原稿確定後に完成版を固定してください。",
      status: releaseStatus,
      href: "#checkpoint-heading",
    },
    {
      id: "export",
      label: "完成原稿PDF",
      detail: exportStatus === "complete"
        ? "ダウンロードできる完成PDFがあります。"
        : exportStatus === "unavailable"
          ? "PDF書き出し機能の準備状況を確認してください。"
          : input.activeExport
            ? "PDFを書き出しています。進捗を確認してください。"
            : "完成版を固定したらPDFを書き出してください。",
      status: exportStatus,
      href: "#durable-export",
    },
  ];
  const completedCount = items.filter((item) => item.status === "complete").length;
  const firstIncomplete = items.find((item) => item.status !== "complete");
  const nextAction = firstIncomplete
    ? {
        label: firstIncomplete.status === "unavailable"
          ? firstIncomplete.id === "manuscript"
            ? "原稿チェックの準備を確認"
            : firstIncomplete.id === "recovery"
              ? "復元機能の準備を確認"
              : firstIncomplete.id === "release"
                ? "完成版固定の準備を確認"
                : "PDF書き出しの準備を確認"
          : firstIncomplete.id === "manuscript"
            ? "原稿の修正項目を確認"
            : firstIncomplete.id === "recovery"
              ? "バックアップを作成"
              : firstIncomplete.id === "release"
                ? "完成版を固定"
                : input.activeExport ? "書き出し状況を確認" : "PDFを書き出す",
        href: firstIncomplete.href,
      }
    : { label: "完成PDFを確認", href: "#durable-export" };
  return { ready: completedCount === items.length, completedCount, totalCount: items.length, items, nextAction };
}
