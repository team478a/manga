import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "@/modules/cloud-creator/auth-context";
import type { MangaQualityEventRepository } from "../application/record-candidate-event";
import { isNonRecordableDisplayedEventError } from "../domain/quality-event-error";

export function createMangaQualityRepository(): MangaQualityEventRepository {
  return {
    async recordCandidateEvent(event) {
      const { supabase } = await cloudCreatorContext();
      const { error } = await supabase.rpc("record_cloud_manga_quality_event", {
        p_generation_job_id: event.generationJobId,
        p_event: event.event,
        p_rejected_reason: event.rejectedReason ?? null,
      });
      if (
        event.event === "displayed" &&
        isNonRecordableDisplayedEventError(error)
      )
        return;
      if (error)
        throw new DomainError(
          "INTERNAL_ERROR",
          "漫画品質ログを保存できませんでした。",
          { cause: error },
        );
    },
  };
}
