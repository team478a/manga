import { pageCanvasSchema } from "@mangai/canvas-core";
import { cloudStoryboardResultSchema } from "../../../lib/cloud-storyboard.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import {
  PageDialoguePlacementRevisionConflictError,
  type PageDialoguePlacementRepository,
  type PageDialoguePlacementStatus,
} from "../application/auto-place-page-dialogue.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export function createPageDialoguePlacementRepository(
  client: AdminClient,
): PageDialoguePlacementRepository & {
  findPendingJobId(): Promise<string | null>;
} {
  return {
    async findPendingJobId() {
      const result = await client.rpc("find_pending_cloud_page_dialogue_placement");
      if (result.error) throw result.error;
      return typeof result.data === "string" ? result.data : null;
    },

    async load(jobId) {
      const jobResult = await client
        .from("cloud_generation_jobs")
        .select("id,project_id,page_id,created_by_profile_id,kind,status")
        .eq("id", jobId)
        .maybeSingle();
      if (jobResult.error) throw jobResult.error;
      const job = jobResult.data;
      if (!job || job.kind !== "image" || job.status !== "completed" || !job.page_id)
        return null;

      const [pageResult, adoptionResult, targetResult, materializationResult, existingResult] =
        await Promise.all([
          client
            .from("cloud_pages")
            .select("id,project_id,page_number,revision,production_status")
            .eq("id", job.page_id)
            .eq("project_id", job.project_id)
            .is("deleted_at", null)
            .maybeSingle(),
          client
            .from("cloud_generation_panel_adoptions")
            .select("status")
            .eq("generation_job_id", job.id)
            .maybeSingle(),
          client
            .from("cloud_generation_batch_targets")
            .select("id,batch_id,page_id")
            .eq("generation_job_id", job.id)
            .maybeSingle(),
          client
            .from("cloud_story_storyboard_projects")
            .select("owner_profile_id,storyboard_version_id")
            .eq("project_id", job.project_id)
            .maybeSingle(),
          client
            .from("cloud_page_dialogue_placements")
            .select("status,retryable")
            .eq("page_id", job.page_id)
            .maybeSingle(),
        ]);
      const firstError =
        pageResult.error ??
        adoptionResult.error ??
        targetResult.error ??
        materializationResult.error ??
        existingResult.error;
      if (firstError) throw firstError;
      if (
        !pageResult.data ||
        adoptionResult.data?.status !== "auto_placed" ||
        !materializationResult.data ||
        materializationResult.data.owner_profile_id !== job.created_by_profile_id
      )
        return null;
      const page = pageResult.data;
      const materialization = materializationResult.data;

      let imagesReady = true;
      if (targetResult.data) {
        const targetsResult = await client
          .from("cloud_generation_batch_targets")
          .select("generation_job_id")
          .eq("batch_id", targetResult.data.batch_id)
          .eq("page_id", job.page_id);
        if (targetsResult.error) throw targetsResult.error;
        const targetJobIds = (targetsResult.data ?? [])
          .map((target) => target.generation_job_id)
          .filter((value): value is string => typeof value === "string");
        if (targetJobIds.length !== (targetsResult.data ?? []).length) imagesReady = false;
        else if (targetJobIds.length) {
          const adoptionsResult = await client
            .from("cloud_generation_panel_adoptions")
            .select("generation_job_id,status")
            .in("generation_job_id", targetJobIds);
          if (adoptionsResult.error) throw adoptionsResult.error;
          imagesReady =
            adoptionsResult.data?.length === targetJobIds.length &&
            adoptionsResult.data.every((adoption) => adoption.status === "auto_placed");
        }
      }

      const [snapshotResult, storyboardResult] = await Promise.all([
        client
          .from("cloud_canvas_snapshots")
          .select("canvas")
          .eq("page_id", job.page_id)
          .eq("revision", page.revision)
          .maybeSingle(),
        client
          .from("cloud_story_storyboard_versions")
          .select("result")
          .eq("id", materialization.storyboard_version_id)
          .eq("owner_profile_id", job.created_by_profile_id)
          .maybeSingle(),
      ]);
      if (snapshotResult.error) throw snapshotResult.error;
      if (storyboardResult.error) throw storyboardResult.error;
      if (!snapshotResult.data || !storyboardResult.data) return null;
      const storyboard = cloudStoryboardResultSchema.parse(storyboardResult.data.result);
      const sourcePage = storyboard.pages.find(
        (storyboardPage) => storyboardPage.pageNumber === page.page_number,
      );
      if (!sourcePage) return null;

      return {
        jobId: job.id,
        pageId: job.page_id,
        currentPageRevision: Number(page.revision),
        productionStatus: page.production_status,
        imagesReady,
        canvas: pageCanvasSchema.parse(snapshotResult.data.canvas),
        panels: sourcePage.panels.map((panel, panelIndex) => ({
          panelIndex,
          dialogues: panel.dialogue,
        })),
        existingStatus:
          existingResult.data?.status === "placement_failed" &&
          existingResult.data.retryable
            ? null
            : ((existingResult.data?.status as PageDialoguePlacementStatus | undefined) ??
              null),
      };
    },

    async save(input) {
      const result = await client.rpc("save_cloud_page_dialogue_placement", {
        p_job_id: input.jobId,
        p_expected_revision: input.expectedRevision,
        p_canvas: input.canvas,
        p_status: input.status,
        p_dialogue_count: input.dialogueCount,
        p_placed_dialogue_count: input.placedDialogueCount,
        p_blocker_codes: input.blockerCodes,
      });
      if (result.error) {
        const signal = result.error.message?.split(":", 1)[0];
        if (
          signal === "revision_conflict" ||
          signal === "cloud_page_finalized" ||
          signal === "page_images_not_ready"
        )
          throw new PageDialoguePlacementRevisionConflictError(signal);
        throw result.error;
      }
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row || !Number.isInteger(Number(row.revision)))
        throw new Error("cloud_dialogue_placement_save_invalid");
      return { revision: Number(row.revision) };
    },

    async record(input) {
      const result = await client.rpc("set_cloud_page_dialogue_placement_result", {
        p_job_id: input.jobId,
        p_status: input.status,
        p_dialogue_count: input.dialogueCount,
        p_placed_dialogue_count: input.placedDialogueCount,
        p_blocker_codes: input.blockerCodes,
        p_retryable: input.retryable,
      });
      if (result.error) throw result.error;
    },
  };
}
