import { z } from "zod";

export const cloudWorkStatusSchema = z.enum([
  "draft",
  "review_ready",
  "approved",
]);
export type CloudWorkStatus = z.infer<typeof cloudWorkStatusSchema>;

export const cloudWorkPageReviewInputSchema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid(),
  reviewed: z.boolean(),
  note: z.string().trim().max(500),
});

export const cloudWorkStatusInputSchema = z.object({
  projectId: z.string().uuid(),
  status: cloudWorkStatusSchema,
  releaseNotes: z.string().trim().max(5000),
  expectedRevision: z.coerce.number().int().min(0),
});

export type CloudWorkProject = {
  id: string;
  title: string;
  description: string;
  cover_page_id: string | null;
  revision: number;
  updated_at: string;
};

export type CloudWorkState = {
  project_id: string;
  status: CloudWorkStatus;
  expected_project_revision: number | null;
  release_notes: string;
  review_ready_at: string | null;
  approved_at: string | null;
  updated_at: string;
};

export type CloudWorkPage = {
  id: string;
  page_number: number;
  revision: number;
};

export type CloudWorkPageReview = {
  page_id: string;
  page_revision: number;
  note: string;
  reviewed_at: string;
};

export type CloudWorkReadiness = {
  ready: boolean;
  reviewedPages: number;
  totalPages: number;
  checks: Array<{
    key:
      | "title"
      | "description"
      | "cover"
      | "pages"
      | "snapshots"
      | "reviews"
      | "jobs";
    label: string;
    passed: boolean;
  }>;
};

export function cloudWorkManagementFeatureEnabled() {
  return process.env.CLOUD_WORK_MANAGEMENT_MVP_ENABLED?.toLowerCase() === "true";
}

export function evaluateCloudWorkReadiness(input: {
  project: CloudWorkProject;
  pages: CloudWorkPage[];
  reviews: CloudWorkPageReview[];
  snapshotPageIds: string[];
  activeJobCount: number;
}): CloudWorkReadiness {
  const pageIds = new Set(input.pages.map((page) => page.id));
  const snapshots = new Set(input.snapshotPageIds);
  const reviews = new Map(
    input.reviews.map((review) => [review.page_id, review]),
  );
  const reviewedPages = input.pages.filter(
    (page) => reviews.get(page.id)?.page_revision === page.revision,
  ).length;
  const checks: CloudWorkReadiness["checks"] = [
    {
      key: "title",
      label: "作品名を入力",
      passed: input.project.title.trim().length > 0,
    },
    {
      key: "description",
      label: "作品説明を入力",
      passed: input.project.description.trim().length > 0,
    },
    {
      key: "cover",
      label: "有効な表紙Pageを設定",
      passed: Boolean(
        input.project.cover_page_id &&
          pageIds.has(input.project.cover_page_id),
      ),
    },
    {
      key: "pages",
      label: "1〜200Pageで構成",
      passed: input.pages.length >= 1 && input.pages.length <= 200,
    },
    {
      key: "snapshots",
      label: "全PageをCanvasへ保存",
      passed:
        input.pages.length > 0 &&
        input.pages.every((page) => snapshots.has(page.id)),
    },
    {
      key: "reviews",
      label: "全Pageを現行revisionで確認",
      passed: input.pages.length > 0 && reviewedPages === input.pages.length,
    },
    {
      key: "jobs",
      label: "実行中のAI Jobなし",
      passed: input.activeJobCount === 0,
    },
  ];
  return {
    ready: checks.every((check) => check.passed),
    reviewedPages,
    totalPages: input.pages.length,
    checks,
  };
}

export function cloudWorkStatusLabel(status: CloudWorkStatus) {
  if (status === "approved") return "販売準備へ承認済み";
  if (status === "review_ready") return "公開前確認済み";
  return "制作・確認中";
}
