import type {
  CloudManuscriptPreflightIssueCode,
  CloudManuscriptPreflightReport,
  CloudManuscriptProductionStatus,
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
  pageStatuses: Array<{
    count: number;
    label: string;
    status: CloudManuscriptProductionStatus;
  }>;
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

const pageStatusLabels: Record<CloudManuscriptProductionStatus, string> = {
  not_started: "未着手",
  generating: "生成中",
  review_required: "確認待ち",
  revision_required: "要修正",
  finalized: "確定済み",
};

export function buildCloudReleaseCheckpointGuidance(
  report:
    | Pick<
        CloudManuscriptPreflightReport,
        | "errorCount"
        | "issueCountByCode"
        | "pageCountByProductionStatus"
        | "ready"
      >
    | null,
): CloudReleaseCheckpointGuidance {
  if (!report) {
    return {
      available: false,
      blockers: [],
      errorCount: 0,
      pageStatuses: [],
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
  const pageStatuses = Object.entries(pageStatusLabels).flatMap(
    ([status, label]) => {
      const count =
        report.pageCountByProductionStatus[
          status as CloudManuscriptProductionStatus
        ] ?? 0;
      return count > 0
        ? [
            {
              count,
              label,
              status: status as CloudManuscriptProductionStatus,
            },
          ]
        : [];
    },
  );
  const productionPageCount = pageStatuses.reduce(
    (total, item) => total + item.count,
    0,
  );
  const finalizedPageCount = report.pageCountByProductionStatus.finalized ?? 0;

  return {
    available: true,
    blockers,
    errorCount: report.errorCount,
    pageStatuses,
    ready: report.ready,
    summary: report.ready
      ? "原稿チェックが完了しています。完成版を固定できます。"
      : productionPageCount > 0
        ? `確定済み${finalizedPageCount}/${productionPageCount}ページです。原稿チェックの要修正${report.errorCount}件を解消してから完成版を固定してください。`
        : `原稿チェックの要修正${report.errorCount}件を解消してから完成版を固定してください。`,
  };
}
