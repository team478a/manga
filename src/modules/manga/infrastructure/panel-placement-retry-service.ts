import { DomainError } from "../../../lib/domain-errors.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import { cloudCreatorContext } from "../../cloud-creator/auth-context";
import { retrySavedPanelPlacement, type PlacementRetryCandidate } from "../application/retry-panel-placement.ts";
import { createAutomaticPanelAdoptionRepository } from "./auto-panel-adoption-repository.ts";

export async function retryPanelPlacement(jobId: string, pageId: string) {
  const { supabase, profile } = await cloudCreatorContext();
  return retrySavedPanelPlacement({
    jobId, pageId, profileId: profile.id,
    createRepository: () => createAutomaticPanelAdoptionRepository(createAdminClient()),
    async loadCandidate(id): Promise<PlacementRetryCandidate | null> {
      const jobResult = await supabase.from("cloud_generation_jobs")
        .select("project_id,page_id,created_by_profile_id,kind,status,output_asset_id")
        .eq("id", id).eq("created_by_profile_id", profile.id).maybeSingle();
      if (jobResult.error) throw new DomainError("INTERNAL_ERROR", "配置対象を確認できませんでした。");
      const job = jobResult.data;
      if (!job || job.page_id !== pageId) return null;
      const [project, adoption, rejection] = await Promise.all([
        supabase.from("cloud_projects").select("owner_profile_id")
          .eq("id", job.project_id).eq("owner_profile_id", profile.id)
          .is("deleted_at", null).maybeSingle(),
        supabase.from("cloud_generation_panel_adoptions").select("status,retryable")
          .eq("generation_job_id", id).maybeSingle(),
        supabase.from("cloud_manga_quality_logs").select("id")
          .eq("generation_job_id", id).eq("event_type", "rejected").limit(1),
      ]);
      if (project.error || adoption.error || rejection.error)
        throw new DomainError("INTERNAL_ERROR", "配置状態を確認できませんでした。");
      if (!project.data) return null;
      return {
        creatorProfileId: job.created_by_profile_id,
        ownerProfileId: project.data.owner_profile_id,
        pageId: job.page_id, kind: job.kind, status: job.status,
        outputAssetId: job.output_asset_id,
        placementStatus: (adoption.data?.status ?? null) as PlacementRetryCandidate["placementStatus"],
        retryable: adoption.data?.retryable === true,
        rejected: Boolean(rejection.data?.length),
      };
    },
  });
}
