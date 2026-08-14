import { pageCanvasSchema } from "@mangai/canvas-core";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import {
  AutomaticPanelAdoptionRevisionConflictError,
  type AutomaticPanelAdoptionRepository,
  type AutomaticPanelAdoptionStatus,
} from "../application/auto-adopt-completed-panel.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

function recordValue(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

export function createAutomaticPanelAdoptionRepository(
  client: AdminClient,
): AutomaticPanelAdoptionRepository & { findPendingJobId(): Promise<string | null> } {
  return {
    async findPendingJobId() {
      const result = await client.rpc("find_pending_cloud_generation_panel_adoption");
      if (result.error) throw result.error;
      return typeof result.data === "string" ? result.data : null;
    },

    async load(jobId) {
      const jobResult = await client
        .from("cloud_generation_jobs")
        .select(
          "id,project_id,page_id,created_by_profile_id,kind,job_type,status,output_asset_id,input",
        )
        .eq("id", jobId)
        .maybeSingle();
      if (jobResult.error) throw jobResult.error;
      const job = jobResult.data;
      if (
        !job ||
        job.kind !== "image" ||
        job.status !== "completed" ||
        !job.page_id ||
        !job.output_asset_id
      )
        return null;
      const metadata = recordValue(job.input);
      const targetResult = await client
        .from("cloud_generation_batch_targets")
        .select(
          "project_id,page_id,panel_id,created_by_profile_id,source_page_revision",
        )
        .eq("generation_job_id", job.id)
        .maybeSingle();
      if (targetResult.error) throw targetResult.error;
      const target = targetResult.data;
      const metadataEligible =
        metadata.autoAdopt === true &&
        metadata.candidateCount === 1 &&
        typeof metadata.targetPanelId === "string" &&
        Number.isInteger(metadata.sourcePageRevision);
      if (!target && !metadataEligible) return null;
      const pageId = target?.page_id ?? job.page_id;
      const panelId = target?.panel_id ?? stringValue(metadata.targetPanelId);
      const sourcePageRevision = Number(
        target?.source_page_revision ?? metadata.sourcePageRevision,
      );
      if (
        !panelId ||
        pageId !== job.page_id ||
        (target &&
          (target.project_id !== job.project_id ||
            target.created_by_profile_id !== job.created_by_profile_id)) ||
        !Number.isInteger(sourcePageRevision) ||
        sourcePageRevision < 0
      )
        return null;

      const [assetResult, pageResult, adoptionResult] =
        await Promise.all([
          client
            .from("cloud_assets")
            .select("id,file_name")
            .eq("id", job.output_asset_id)
            .eq("project_id", job.project_id)
            .eq("owner_profile_id", job.created_by_profile_id)
            .eq("source_generation_job_id", job.id)
            .is("deleted_at", null)
            .maybeSingle(),
          client
            .from("cloud_pages")
            .select("id,project_id,revision,production_status")
            .eq("id", pageId)
            .eq("project_id", job.project_id)
            .is("deleted_at", null)
            .maybeSingle(),
          client
            .from("cloud_generation_panel_adoptions")
            .select("status")
            .eq("generation_job_id", job.id)
            .maybeSingle(),
        ]);
      const firstError =
        assetResult.error ??
        pageResult.error ??
        adoptionResult.error;
      if (firstError) throw firstError;
      if (!assetResult.data || !pageResult.data) return null;
      const snapshotResult = await client
        .from("cloud_canvas_snapshots")
        .select("canvas")
        .eq("page_id", pageId)
        .eq("revision", pageResult.data.revision)
        .maybeSingle();
      if (snapshotResult.error) throw snapshotResult.error;
      if (!snapshotResult.data) return null;
      let automaticRevisionChain = sourcePageRevision === pageResult.data.revision;
      if (!automaticRevisionChain) {
        const chainResult = await client.rpc(
          "is_cloud_generation_panel_adoption_revision_chain",
          {
            p_page_id: pageId,
            p_source_revision: sourcePageRevision,
            p_current_revision: pageResult.data.revision,
          },
        );
        if (chainResult.error) throw chainResult.error;
        automaticRevisionChain = chainResult.data === true;
      }
      const canvas = pageCanvasSchema.parse(snapshotResult.data.canvas);
      return {
        jobId: job.id,
        pageId,
        panelId,
        assetId: job.output_asset_id,
        assetFileName: assetResult.data.file_name ?? undefined,
        sourcePageRevision,
        currentPageRevision: Number(pageResult.data.revision),
        automaticRevisionChain,
        productionStatus: pageResult.data.production_status,
        jobType: job.job_type,
        generationOperation: stringValue(metadata.operation),
        sourceAssetId: stringValue(metadata.sourceAssetId),
        canvas,
        existingStatus:
          (adoptionResult.data?.status as AutomaticPanelAdoptionStatus | undefined) ??
          null,
      };
    },

    async save(input) {
      const result = await client.rpc("save_cloud_generation_panel_adoption_v2", {
        p_job_id: input.jobId,
        p_expected_revision: input.expectedRevision,
        p_canvas: input.canvas,
      });
      if (result.error) {
        const signal = result.error.message?.split(":", 1)[0];
        if (
          signal === "revision_conflict" ||
          signal === "source_revision_changed" ||
          signal === "cloud_page_finalized"
        )
          throw new AutomaticPanelAdoptionRevisionConflictError(signal);
        throw result.error;
      }
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row || !Number.isInteger(Number(row.revision)))
        throw new Error("cloud_panel_adoption_save_invalid");
      return { revision: Number(row.revision) };
    },

    async record(input) {
      const result = await client.rpc("set_cloud_generation_panel_adoption_result", {
        p_job_id: input.jobId,
        p_status: input.status,
        p_reason_code: input.reasonCode,
        p_retryable: input.retryable,
        p_applied_revision: input.appliedRevision ?? null,
      });
      if (result.error) throw result.error;
    },
  };
}
