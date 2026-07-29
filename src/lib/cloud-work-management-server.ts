import {
  cloudWorkPageReviewInputSchema,
  cloudWorkStatusInputSchema,
  evaluateCloudWorkReadiness,
  type CloudWorkPage,
  type CloudWorkPageReview,
  type CloudWorkProject,
  type CloudWorkState,
  type CloudWorkStatus,
} from "@/lib/cloud-work-management";
import {
  DomainError,
  ResourceNotFoundError,
  RevisionConflictError,
  ValidationError,
} from "@/lib/domain-errors";
import { createClient } from "@/lib/supabase/server";

const PROJECT_FIELDS =
  "id,title,description,cover_page_id,revision,updated_at";
const STATE_FIELDS =
  "project_id,status,expected_project_revision,release_notes,review_ready_at,approved_at,updated_at";

function internal(message: string, cause: unknown) {
  return new DomainError("INTERNAL_ERROR", message, { cause });
}

function emptyState(project: CloudWorkProject): CloudWorkState {
  return {
    project_id: project.id,
    status: "draft",
    expected_project_revision: null,
    release_notes: "",
    review_ready_at: null,
    approved_at: null,
    updated_at: project.updated_at,
  };
}

function mapMutationError(error: { message?: string } | null) {
  const signal = error?.message ?? "";
  if (signal.includes("cloud_work_revision_conflict"))
    return new RevisionConflictError();
  if (
    signal.includes("cloud_work_not_ready") ||
    signal.includes("cloud_work_status_transition_invalid") ||
    signal.includes("cloud_work_input_invalid")
  )
    return new ValidationError(
      "公開前チェックを完了してから状態を更新してください。",
    );
  if (
    signal.includes("cloud_work_project_not_found") ||
    signal.includes("cloud_work_page_not_found")
  )
    return new ResourceNotFoundError("対象のCloud作品が見つかりません。");
  return internal("作品管理状態を更新できませんでした。", error);
}

export async function listCloudManagedWorks(profileId: string) {
  const supabase = await createClient();
  const [projectsResult, statesResult] = await Promise.all([
    supabase
      .from("cloud_projects")
      .select(PROJECT_FIELDS)
      .eq("owner_profile_id", profileId)
      .eq("content_class", "general")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<CloudWorkProject[]>(),
    supabase
      .from("cloud_work_management_states")
      .select(STATE_FIELDS)
      .eq("owner_profile_id", profileId)
      .returns<CloudWorkState[]>(),
  ]);
  if (projectsResult.error || statesResult.error)
    throw internal(
      "作品管理一覧を取得できませんでした。",
      projectsResult.error ?? statesResult.error,
    );
  const states = new Map(
    (statesResult.data ?? []).map((state) => [state.project_id, state]),
  );
  return (projectsResult.data ?? []).map((project) => ({
    project,
    state: states.get(project.id) ?? emptyState(project),
  }));
}

export async function getCloudWorkManagementDetail(
  profileId: string,
  projectId: string,
) {
  const parsedId = cloudWorkPageReviewInputSchema.shape.projectId.safeParse(
    projectId,
  );
  if (!parsedId.success)
    throw new ResourceNotFoundError("対象のCloud作品が見つかりません。");
  const supabase = await createClient();
  const projectResult = await supabase
    .from("cloud_projects")
    .select(PROJECT_FIELDS)
    .eq("id", projectId)
    .eq("owner_profile_id", profileId)
    .eq("content_class", "general")
    .is("deleted_at", null)
    .maybeSingle<CloudWorkProject>();
  if (projectResult.error)
    throw internal("Cloud作品を取得できませんでした。", projectResult.error);
  if (!projectResult.data)
    throw new ResourceNotFoundError("対象のCloud作品が見つかりません。");

  const [pagesResult, stateResult, reviewsResult, snapshotsResult, jobsResult] =
    await Promise.all([
      supabase
        .from("cloud_pages")
        .select("id,page_number,revision")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("page_number")
        .returns<CloudWorkPage[]>(),
      supabase
        .from("cloud_work_management_states")
        .select(STATE_FIELDS)
        .eq("owner_profile_id", profileId)
        .eq("project_id", projectId)
        .maybeSingle<CloudWorkState>(),
      supabase
        .from("cloud_work_page_reviews")
        .select("page_id,page_revision,note,reviewed_at")
        .eq("owner_profile_id", profileId)
        .eq("project_id", projectId)
        .returns<CloudWorkPageReview[]>(),
      supabase
        .from("cloud_canvas_snapshots")
        .select("page_id")
        .eq("project_id", projectId)
        .returns<Array<{ page_id: string }>>(),
      supabase
        .from("cloud_generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .in("status", ["queued", "running"]),
    ]);
  const error =
    pagesResult.error ??
    stateResult.error ??
    reviewsResult.error ??
    snapshotsResult.error ??
    jobsResult.error;
  if (error) throw internal("作品の公開前状態を取得できませんでした。", error);
  const pages = pagesResult.data ?? [];
  const reviews = reviewsResult.data ?? [];
  const activeJobCount = jobsResult.count ?? 0;
  return {
    project: projectResult.data,
    state: stateResult.data ?? emptyState(projectResult.data),
    pages,
    reviews,
    activeJobCount,
    readiness: evaluateCloudWorkReadiness({
      project: projectResult.data,
      pages,
      reviews,
      snapshotPageIds: (snapshotsResult.data ?? []).map(
        (snapshot) => snapshot.page_id,
      ),
      activeJobCount,
    }),
  };
}

export async function setCloudWorkPageReview(input: {
  projectId: string;
  pageId: string;
  reviewed: boolean;
  note: string;
}) {
  const parsed = cloudWorkPageReviewInputSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_cloud_work_page_review", {
    p_project_id: parsed.projectId,
    p_page_id: parsed.pageId,
    p_reviewed: parsed.reviewed,
    p_note: parsed.note,
  });
  if (error) throw mapMutationError(error);
}

export async function setCloudWorkManagementStatus(input: {
  projectId: string;
  status: CloudWorkStatus;
  releaseNotes: string;
  expectedRevision: number;
}) {
  const parsed = cloudWorkStatusInputSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "set_cloud_work_management_status",
    {
      p_project_id: parsed.projectId,
      p_status: parsed.status,
      p_release_notes: parsed.releaseNotes,
      p_expected_project_revision: parsed.expectedRevision,
    },
  );
  if (error) throw mapMutationError(error);
  return data as string;
}
