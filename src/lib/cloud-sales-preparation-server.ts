import {
  cloudSalesPreparationInputSchema,
  cloudSalesPreparationStatus,
  type CloudSalesApproval,
  type CloudSalesDraft,
  type CloudSalesPreparation,
  type CloudSalesProject,
} from "@/lib/cloud-sales-preparation";
import {
  DomainError,
  ResourceNotFoundError,
  RevisionConflictError,
  ValidationError,
} from "@/lib/domain-errors";
import { createClient } from "@/lib/supabase/server";

const PROJECT_FIELDS = "id,title,description,revision,updated_at";
const APPROVAL_FIELDS =
  "project_id,status,expected_project_revision,release_notes,approved_at";
const PREPARATION_FIELDS =
  "project_id,project_revision,work_id,product_id,price,cover_url,product_path,synced_at";

function internal(message: string, cause: unknown) {
  return new DomainError("INTERNAL_ERROR", message, { cause });
}

export function mapCloudSalesPreparationError(
  error: { message?: string } | null,
) {
  const signal = error?.message ?? "";
  if (
    signal.includes("cloud_sales_revision_conflict") ||
    signal.includes("cloud_marketplace_revision_conflict")
  )
    return new RevisionConflictError();
  if (signal.includes("cloud_sales_approval_required"))
    return new ValidationError(
      "作品管理で現行revisionを承認してから販売準備を実行してください。",
    );
  if (
    signal.includes("cloud_marketplace_work_published") ||
    signal.includes("cloud_marketplace_product_active")
  )
    return new ValidationError(
      "公開中の作品または販売中の商品は自動更新できません。",
    );
  if (
    signal.includes("cloud_sales_project_not_found") ||
    signal.includes("cloud_marketplace_project_not_found")
  )
    return new ResourceNotFoundError("対象のCloud作品が見つかりません。");
  if (
    signal.includes("cloud_marketplace_input_invalid") ||
    signal.includes("cloud_sales_sync_failed")
  )
    return new ValidationError("販売準備の入力内容を確認してください。");
  return internal("販売準備を保存できませんでした。", error);
}

async function loadDraft(profileId: string, projectId: string) {
  const supabase = await createClient();
  const { data: works, error: workError } = await supabase
    .from("works")
    .select("id,status,is_public,image_url")
    .eq("creator_id", profileId)
    .eq("source_project_id", projectId)
    .order("id")
    .limit(2)
    .returns<NonNullable<CloudSalesDraft["work"]>[]>();
  if (workError)
    throw internal("販売用作品を取得できませんでした。", workError);
  if ((works ?? []).length > 1)
    throw new ValidationError(
      "同じProjectに紐づく作品が複数あります。作品管理で整理してください。",
    );
  const work = works?.[0] ?? null;
  if (!work) return { work: null, product: null } satisfies CloudSalesDraft;
  const { data: products, error: productError } = await supabase
    .from("digital_products")
    .select("id,status,price,file_url")
    .eq("creator_id", profileId)
    .eq("work_id", work.id)
    .order("id")
    .limit(2)
    .returns<NonNullable<CloudSalesDraft["product"]>[]>();
  if (productError)
    throw internal("販売用商品を取得できませんでした。", productError);
  if ((products ?? []).length > 1)
    throw new ValidationError(
      "作品に紐づく商品が複数あります。商品管理で整理してください。",
    );
  return { work, product: products?.[0] ?? null } satisfies CloudSalesDraft;
}

export async function listCloudSalesPreparations(profileId: string) {
  const supabase = await createClient();
  const [projectsResult, approvalsResult, preparationsResult] =
    await Promise.all([
      supabase
        .from("cloud_projects")
        .select(PROJECT_FIELDS)
        .eq("owner_profile_id", profileId)
        .eq("content_class", "general")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .returns<CloudSalesProject[]>(),
      supabase
        .from("cloud_work_management_states")
        .select(APPROVAL_FIELDS)
        .eq("owner_profile_id", profileId)
        .returns<CloudSalesApproval[]>(),
      supabase
        .from("cloud_sales_preparations")
        .select(PREPARATION_FIELDS)
        .eq("owner_profile_id", profileId)
        .returns<CloudSalesPreparation[]>(),
    ]);
  const error =
    projectsResult.error ??
    approvalsResult.error ??
    preparationsResult.error;
  if (error) throw internal("販売準備一覧を取得できませんでした。", error);
  const projects = new Map(
    (projectsResult.data ?? []).map((project) => [project.id, project]),
  );
  const preparations = new Map(
    (preparationsResult.data ?? []).map((item) => [item.project_id, item]),
  );
  const rows = [];
  for (const approval of approvalsResult.data ?? []) {
    const project = projects.get(approval.project_id);
    if (!project) continue;
    const preparation = preparations.get(project.id) ?? null;
    if (approval.status !== "approved" && !preparation) continue;
    rows.push({
      project,
      approval,
      preparation,
      current:
        approval.expected_project_revision === project.revision &&
        preparation?.project_revision === project.revision,
    });
  }
  return rows;
}

export async function getCloudSalesPreparationDetail(
  profileId: string,
  projectId: string,
) {
  const parsedId =
    cloudSalesPreparationInputSchema.shape.projectId.safeParse(projectId);
  if (!parsedId.success)
    throw new ResourceNotFoundError("対象のCloud作品が見つかりません。");
  const supabase = await createClient();
  const [projectResult, approvalResult, preparationResult] = await Promise.all([
    supabase
      .from("cloud_projects")
      .select(PROJECT_FIELDS)
      .eq("id", projectId)
      .eq("owner_profile_id", profileId)
      .eq("content_class", "general")
      .is("deleted_at", null)
      .maybeSingle<CloudSalesProject>(),
    supabase
      .from("cloud_work_management_states")
      .select(APPROVAL_FIELDS)
      .eq("project_id", projectId)
      .eq("owner_profile_id", profileId)
      .maybeSingle<CloudSalesApproval>(),
    supabase
      .from("cloud_sales_preparations")
      .select(PREPARATION_FIELDS)
      .eq("project_id", projectId)
      .eq("owner_profile_id", profileId)
      .maybeSingle<CloudSalesPreparation>(),
  ]);
  const error =
    projectResult.error ?? approvalResult.error ?? preparationResult.error;
  if (error) throw internal("販売準備を取得できませんでした。", error);
  if (!projectResult.data || !approvalResult.data)
    throw new ResourceNotFoundError("対象の承認済み作品が見つかりません。");
  const draft = await loadDraft(profileId, projectId);
  const preparation = preparationResult.data ?? null;
  if (approvalResult.data.status !== "approved" && !preparation)
    throw new ResourceNotFoundError("対象の承認済み作品が見つかりません。");
  return {
    project: projectResult.data,
    approval: approvalResult.data,
    preparation,
    draft,
    status: cloudSalesPreparationStatus({
      project: projectResult.data,
      approval: approvalResult.data,
      preparation,
      draft,
    }),
    eligible:
      approvalResult.data.status === "approved" &&
      approvalResult.data.expected_project_revision ===
        projectResult.data.revision &&
      !draft.work?.is_public &&
      draft.work?.status !== "published" &&
      draft.product?.status !== "active",
  };
}
