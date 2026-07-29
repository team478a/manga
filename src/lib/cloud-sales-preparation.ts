import { z } from "zod";

export const cloudSalesPreparationInputSchema = z.object({
  projectId: z.string().uuid(),
  expectedRevision: z.coerce.number().int().min(0),
  price: z.coerce.number().int().min(0).max(1_000_000),
});

export type CloudSalesProject = {
  id: string;
  title: string;
  description: string;
  revision: number;
  updated_at: string;
};

export type CloudSalesApproval = {
  project_id: string;
  status: "draft" | "review_ready" | "approved";
  expected_project_revision: number | null;
  release_notes: string;
  approved_at: string | null;
};

export type CloudSalesPreparation = {
  project_id: string;
  project_revision: number;
  work_id: string;
  product_id: string;
  price: number;
  cover_url: string;
  product_path: string;
  synced_at: string;
};

export type CloudSalesDraft = {
  work: {
    id: string;
    status: string;
    is_public: boolean;
    image_url: string | null;
  } | null;
  product: {
    id: string;
    status: string;
    price: number;
    file_url: string | null;
  } | null;
};

export function cloudSalesPreparationFeatureEnabled() {
  return process.env.CLOUD_SALES_PREPARATION_MVP_ENABLED === "true";
}

export function cloudSalesPreparationStatus(input: {
  project: CloudSalesProject;
  approval: CloudSalesApproval;
  preparation: CloudSalesPreparation | null;
  draft: CloudSalesDraft;
}) {
  if (
    input.draft.work?.is_public ||
    input.draft.work?.status === "published" ||
    input.draft.product?.status === "active"
  )
    return "販売中" as const;
  if (!input.preparation) return "未同期" as const;
  if (
    input.approval.status !== "approved" ||
    input.approval.expected_project_revision !== input.project.revision ||
    input.preparation.project_revision !== input.project.revision
  )
    return "要再同期" as const;
  return "同期済み" as const;
}
