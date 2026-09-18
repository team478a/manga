import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminGenerationQualityReviewStatus =
  "approved" | "needs_review" | "quality_issue";

export type AdminGenerationQualityItem = {
  jobId: string;
  projectId: string;
  projectTitle: string;
  projectVisibility: string;
  ownerProfileId: string;
  ownerName: string;
  ownerEmail: string | null;
  pageNumber: number | null;
  productionStatus: string | null;
  providerId: string;
  modelId: string;
  jobType: string;
  attemptCount: number;
  actualCostMicros: number | null;
  workflowVersion: string | null;
  seed: string | null;
  generatedAt: string;
  assetId: string;
  imageUrl: string;
  width: number;
  height: number;
  adoptionStatus: string | null;
  panelId: string | null;
  inspectionStatus: "PASS" | "WARNING" | "FAIL" | "NOT_EVALUATED" | null;
  inspectionCount: number;
  reviewStatus: AdminGenerationQualityReviewStatus | null;
  reviewNote: string;
  reviewerName: string | null;
  reviewedAt: string | null;
};

type Row = Record<string, unknown>;

const inspectionPriority = {
  PASS: 1,
  NOT_EVALUATED: 2,
  WARNING: 3,
  FAIL: 4,
} as const;

export async function loadAdminGenerationQualityGallery() {
  const admin = createAdminClient();
  const jobsResult = await admin
    .from("cloud_generation_jobs")
    .select(
      "id,project_id,page_id,created_by_profile_id,provider_id,model_id,job_type,attempt_count,actual_cost_micros,workflow_version,seed,finished_at,created_at,output_asset_id",
    )
    .eq("kind", "image")
    .eq("status", "completed")
    .not("output_asset_id", "is", null)
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(120);
  if (jobsResult.error) throw jobsResult.error;

  const jobs = (jobsResult.data ?? []) as Row[];
  const jobIds = jobs.map((row) => String(row.id));
  const projectIds = [...new Set(jobs.map((row) => String(row.project_id)))];
  const pageIds = [
    ...new Set(
      jobs.flatMap((row) => (row.page_id ? [String(row.page_id)] : [])),
    ),
  ];
  const ownerIds = [
    ...new Set(jobs.map((row) => String(row.created_by_profile_id))),
  ];
  const assetIds = jobs.map((row) => String(row.output_asset_id));

  if (!jobIds.length) {
    return { items: [] as AdminGenerationQualityItem[], failedLast24Hours: 0 };
  }

  const failedSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [
    projectsResult,
    pagesResult,
    ownersResult,
    assetsResult,
    adoptionsResult,
    reviewsResult,
    runsResult,
    failedResult,
    authUsersResult,
  ] = await Promise.all([
    admin
      .from("cloud_projects")
      .select("id,title,visibility")
      .in("id", projectIds),
    pageIds.length
      ? admin
          .from("cloud_pages")
          .select("id,page_number,production_status")
          .in("id", pageIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from("profiles").select("id,user_id,display_name").in("id", ownerIds),
    admin
      .from("cloud_assets")
      .select("id,storage_path,width,height,source_generation_job_id")
      .in("id", assetIds)
      .is("deleted_at", null),
    admin
      .from("cloud_generation_panel_adoptions")
      .select("generation_job_id,status,panel_id")
      .in("generation_job_id", jobIds),
    admin
      .from("cloud_admin_generation_quality_reviews")
      .select("generation_job_id,status,note,reviewed_at,reviewer_profile_id")
      .in("generation_job_id", jobIds),
    admin
      .from("cloud_manga_inspection_runs")
      .select("id,generation_job_id,created_at")
      .in("generation_job_id", jobIds)
      .order("created_at", { ascending: false }),
    admin
      .from("cloud_generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "image")
      .eq("status", "failed")
      .gte("updated_at", failedSince),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const failure = [
    projectsResult,
    pagesResult,
    ownersResult,
    assetsResult,
    adoptionsResult,
    reviewsResult,
    runsResult,
    failedResult,
    authUsersResult,
  ].find((result) => result.error);
  if (failure?.error) throw failure.error;

  const runs = (runsResult.data ?? []) as Row[];
  const runIds = runs.map((row) => String(row.id));
  const findingsResult = runIds.length
    ? await admin
        .from("cloud_manga_inspection_findings")
        .select("run_id,status")
        .in("run_id", runIds)
    : { data: [], error: null };
  if (findingsResult.error) throw findingsResult.error;

  const projectById = new Map(
    ((projectsResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );
  const pageById = new Map(
    ((pagesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );
  const ownerById = new Map(
    ((ownersResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );
  const ownerEmailByUserId = new Map(
    (authUsersResult.data?.users ?? []).map((user) => [
      user.id,
      user.email ?? null,
    ]),
  );
  const assetById = new Map(
    ((assetsResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );
  const adoptionByJob = new Map(
    ((adoptionsResult.data ?? []) as Row[]).map((row) => [
      String(row.generation_job_id),
      row,
    ]),
  );
  const reviewByJob = new Map(
    ((reviewsResult.data ?? []) as Row[]).map((row) => [
      String(row.generation_job_id),
      row,
    ]),
  );
  const reviewerIds = [
    ...new Set(
      ((reviewsResult.data ?? []) as Row[]).map((row) =>
        String(row.reviewer_profile_id),
      ),
    ),
  ];
  const reviewerResult = reviewerIds.length
    ? await admin
        .from("profiles")
        .select("id,display_name")
        .in("id", reviewerIds)
    : { data: [], error: null };
  if (reviewerResult.error) throw reviewerResult.error;
  const reviewerById = new Map(
    ((reviewerResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );

  const latestRunByJob = new Map<string, string>();
  for (const run of runs) {
    const jobId = String(run.generation_job_id);
    if (!latestRunByJob.has(jobId)) latestRunByJob.set(jobId, String(run.id));
  }
  const inspectionByRun = new Map<
    string,
    { status: keyof typeof inspectionPriority; count: number }
  >();
  for (const finding of (findingsResult.data ?? []) as Row[]) {
    const runId = String(finding.run_id);
    const status = String(finding.status) as keyof typeof inspectionPriority;
    const current = inspectionByRun.get(runId);
    inspectionByRun.set(runId, {
      status:
        !current ||
        inspectionPriority[status] > inspectionPriority[current.status]
          ? status
          : current.status,
      count: (current?.count ?? 0) + 1,
    });
  }

  const validJobs = jobs.filter((job) => {
    const asset = assetById.get(String(job.output_asset_id));
    return asset && String(asset.source_generation_job_id) === String(job.id);
  });
  const paths = validJobs.map((job) =>
    String(assetById.get(String(job.output_asset_id))?.storage_path),
  );
  const signedResult = await admin.storage
    .from("cloud-assets")
    .createSignedUrls(paths, 300);
  if (signedResult.error) throw signedResult.error;

  const items = validJobs.flatMap((job, index) => {
    const signedUrl = signedResult.data?.[index]?.signedUrl;
    if (!signedUrl) return [];
    const project = projectById.get(String(job.project_id));
    const page = job.page_id ? pageById.get(String(job.page_id)) : null;
    const owner = ownerById.get(String(job.created_by_profile_id));
    const asset = assetById.get(String(job.output_asset_id))!;
    const adoption = adoptionByJob.get(String(job.id));
    const review = reviewByJob.get(String(job.id));
    const reviewer = review
      ? reviewerById.get(String(review.reviewer_profile_id))
      : null;
    const latestRunId = latestRunByJob.get(String(job.id));
    const inspection = latestRunId ? inspectionByRun.get(latestRunId) : null;
    return [
      {
        jobId: String(job.id),
        projectId: String(job.project_id),
        projectTitle: String(project?.title ?? "名称未取得"),
        projectVisibility: String(project?.visibility ?? "private"),
        ownerProfileId: String(job.created_by_profile_id),
        ownerName: String(owner?.display_name ?? "名称未取得"),
        ownerEmail:
          owner?.user_id == null
            ? null
            : (ownerEmailByUserId.get(String(owner.user_id)) ?? null),
        pageNumber: page?.page_number == null ? null : Number(page.page_number),
        productionStatus:
          page?.production_status == null
            ? null
            : String(page.production_status),
        providerId: String(job.provider_id),
        modelId: String(job.model_id),
        jobType: String(job.job_type),
        attemptCount: Number(job.attempt_count),
        actualCostMicros:
          job.actual_cost_micros == null
            ? null
            : Number(job.actual_cost_micros),
        workflowVersion:
          job.workflow_version == null ? null : String(job.workflow_version),
        seed: job.seed == null ? null : String(job.seed),
        generatedAt: String(job.finished_at ?? job.created_at),
        assetId: String(job.output_asset_id),
        imageUrl: signedUrl,
        width: Number(asset.width),
        height: Number(asset.height),
        adoptionStatus:
          adoption?.status == null ? null : String(adoption.status),
        panelId: adoption?.panel_id == null ? null : String(adoption.panel_id),
        inspectionStatus: inspection?.status ?? null,
        inspectionCount: inspection?.count ?? 0,
        reviewStatus:
          (review?.status as AdminGenerationQualityReviewStatus | undefined) ??
          null,
        reviewNote: String(review?.note ?? ""),
        reviewerName:
          reviewer?.display_name == null ? null : String(reviewer.display_name),
        reviewedAt:
          review?.reviewed_at == null ? null : String(review.reviewed_at),
      } satisfies AdminGenerationQualityItem,
    ];
  });

  return { items, failedLast24Hours: failedResult.count ?? 0 };
}

export async function saveAdminGenerationQualityReview(input: {
  jobId: string;
  status: AdminGenerationQualityReviewStatus;
  note: string;
}) {
  const supabase = await createClient();
  return supabase.rpc("review_cloud_admin_generation_quality", {
    p_generation_job_id: input.jobId,
    p_status: input.status,
    p_note: input.note,
  });
}
