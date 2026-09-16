import { NextResponse } from "next/server";
import { toApiError } from "@/lib/api-errors";
import { prepareStoryboardPanelImage } from "@/lib/cloud-panel-image-generation-server";
import { getCloudPanelGenerationPreflight } from "@/modules/cloud-creator/generation/batch-preflight-service";
import { cloudPanelImageGenerationRequestSchema } from "@/modules/manga/contracts/panel-generation";

export async function POST(request: Request) {
  try {
    const input = cloudPanelImageGenerationRequestSchema.parse(
      await request.json(),
    );
    const prepared = await prepareStoryboardPanelImage({
      ...input,
      candidateCount: 1,
    });
    const generation = prepared.generation.generation;
    const capability = prepared.generation.capability;
    return NextResponse.json(
      await getCloudPanelGenerationPreflight({
        projectId: input.projectId,
        pageId: input.pageId,
        candidateCount: input.candidateCount,
        providerId: capability.providerId,
        modelId: capability.modelId,
        kind: generation.kind,
        jobType: generation.jobType,
        pricingVersion: capability.pricingVersion,
      }),
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    const response = toApiError(
      error,
      "画像生成の実行前確認を完了できませんでした。",
    );
    return NextResponse.json(response.body, {
      status: response.status,
      headers: { "cache-control": "private, no-store" },
    });
  }
}
