import type {
  CloudManuscriptPreflightIssueCode,
  CloudManuscriptPreflightReport,
} from "@/lib/cloud-manuscript-preflight";

export type CloudReleaseCheckpointBlocker = {
  code: CloudManuscriptPreflightIssueCode;
  count: number;
  label: string;
};

export type CloudReleaseCheckpointGuidance = {
  available: boolean;
  blockers: CloudReleaseCheckpointBlocker[];
  errorCount: number;
  ready: boolean;
  summary: string;
};

const blockerLabels: Partial<
  Record<CloudManuscriptPreflightIssueCode, string>
> = {
  empty_panel: "画像未生成のコマ",
  generation_active: "画像生成が完了していないページ",
  page_not_finalized: "未確定のページ",
  page_stale: "設定変更後の再確認が必要なページ",
};

export function buildCloudReleaseCheckpointGuidance(
  report:
    | Pick<
        CloudManuscriptPreflightReport,
        "errorCount" | "issueCountByCode" | "ready"
      >
    | null,
): CloudReleaseCheckpointGuidance {
  if (!report) {
    return {
      available: false,
      blockers: [],
      errorCount: 0,
      ready: false,
      summary: "完成条件を確認できないため、完成版を固定できません。",
    };
  }

  const blockers = Object.entries(blockerLabels).flatMap(([code, label]) => {
    const count = report.issueCountByCode[
      code as CloudManuscriptPreflightIssueCode
    ] ?? 0;
    return count > 0 && label
      ? [{ code: code as CloudManuscriptPreflightIssueCode, count, label }]
      : [];
  });

  return {
    available: true,
    blockers,
    errorCount: report.errorCount,
    ready: report.ready,
    summary: report.ready
      ? "原稿チェックが完了しています。完成版を固定できます。"
      : `原稿チェックの要修正${report.errorCount}件を解消してから完成版を固定してください。`,
  };
}
