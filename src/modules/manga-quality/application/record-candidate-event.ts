import { ValidationError } from "@/lib/domain-errors";
import type { MangaQualityCandidateEvent } from "../domain/quality-evaluation-log";

export type MangaQualityEventRepository = {
  recordCandidateEvent(event: MangaQualityCandidateEvent): Promise<void>;
};

export async function recordMangaQualityCandidateEvent(input: {
  event: MangaQualityCandidateEvent;
  repository: MangaQualityEventRepository;
}) {
  if (
    input.event.event === "rejected" &&
    !input.event.rejectedReason?.trim()
  )
    throw new ValidationError("却下理由を入力してください。");
  await input.repository.recordCandidateEvent({
    ...input.event,
    rejectedReason: input.event.rejectedReason?.trim(),
  });
}
