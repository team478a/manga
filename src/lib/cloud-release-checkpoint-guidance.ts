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
  nextPages: Array<{
    isStale: boolean;
    pageId: string;
    pageNumber: number;
    status: CloudManuscriptProductionStatus;
    statusLabel: string;
  }>;
  pageStatuses: Array<{
    count: number;
    label: string;
    status: CloudManuscriptProductionStatus;
  }>;
  remainingPageCount: number;
  ready: boolean;
  summary: string;
};

export type CloudReleaseCheckpointPage = {
  isStale: boolean;
  pageId: string;
  pageNumber: number;
  status: CloudManuscriptProductionStatus;
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

const nextPageStatusLabels: Record<CloudManuscriptProductionStatus, string> = {
  not_started: "制作を開始",
  generating: "生成状況を確認",
  review_required: "確認して確定",
  revision_required: "修正して再確認",
  finalized: "再確認",
};

const nextPagePriorities: Record<CloudManuscriptProductionStatus, number> = {
  revision_required: 0,
  review_required: 1,
  generating: 2,
  not_started: 3,
  finalized: 4,
};

export function listCloudReleaseCheckpointPendingPages(
  pages: CloudReleaseCheckpointPage[],
) {
  return pages
    .filter((page) => page.status !== "finalized" || page.isStale)
    .sort((left, right) => {
      if (left.isStale !== right.isStale) return left.isStale ? -1 : 1;
      const priority =
        nextPagePriorities[left.status] - nextPagePriorities[right.status];
      return priority || left.pageNumber - right.pageNumber;
    });
}

export function findNextCloudReleaseCheckpointPage(
  pages: CloudReleaseCheckpointPage[],
  currentPageId: string,
) {
  return (
    listCloudReleaseCheckpointPendingPages(pages).find(
      (page) => page.pageId !== currentPageId,
    ) ?? null
  );
}

export function buildCloudReleaseCheckpointGuidance(
  report: Pick<
    CloudManuscriptPreflightReport,
    "errorCount" | "issueCountByCode" | "pageCountByProductionStatus" | "ready"
  > | null,
  pages: CloudReleaseCheckpointPage[] = [],
): CloudReleaseCheckpointGuidance {
  if (!report) {
    return {
      available: false,
      blockers: [],
      errorCount: 0,
      nextPages: [],
      pageStatuses: [],
      remainingPageCount: 0,
      ready: false,
      summary: "完成条件を確認できないため、完成版を固定できません。",
    };
  }

  const blockers = Object.entries(blockerLabels).flatMap(([code, label]) => {
    const count =
      report.issueCountByCode[code as CloudManuscriptPreflightIssueCode] ?? 0;
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
  const pendingPages = listCloudReleaseCheckpointPendingPages(pages);
  const nextPages = pendingPages.slice(0, 5).map((page) => ({
    ...page,
    statusLabel: page.isStale
      ? "設定変更後の再確認"
      : nextPageStatusLabels[page.status],
  }));

  return {
    available: true,
    blockers,
    errorCount: report.errorCount,
    nextPages,
    pageStatuses,
    remainingPageCount: Math.max(0, pendingPages.length - nextPages.length),
    ready: report.ready,
    summary: report.ready
      ? "原稿チェックが完了しています。完成版を固定できます。"
      : productionPageCount > 0
        ? `確定済み${finalizedPageCount}/${productionPageCount}ページです。原稿チェックの要修正${report.errorCount}件を解消してから完成版を固定してください。`
        : `原稿チェックの要修正${report.errorCount}件を解消してから完成版を固定してください。`,
  };
}
