import { NextResponse } from "next/server";
import { z } from "zod";
import { toApiError } from "@/lib/api-errors";
import { recordMangaQualityCandidateEvent } from "../application/record-candidate-event";
import { createMangaQualityRepository } from "../infrastructure/manga-quality-repository";

const eventSchema = z.object({
  event: z.enum(["displayed", "selected", "rejected"]),
  generationJobId: z.string().uuid(),
  rejectedReason: z.string().trim().min(1).max(500).optional(),
});

export async function recordQualityEvent(request: Request) {
  try {
    await recordMangaQualityCandidateEvent({
      event: eventSchema.parse(await request.json()),
      repository: createMangaQualityRepository(),
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const response = toApiError(error, "品質ログを保存できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
