import type { z } from "zod";
import { cloudPanelImageGenerationRequestSchema } from "@/lib/cloud-panel-image-generation";

export { cloudPanelImageGenerationRequestSchema };
export type { CloudPanelImageGenerationRequest } from "@/lib/cloud-panel-image-generation";
export type CloudPanelImageGenerationRequestInput = z.input<
  typeof cloudPanelImageGenerationRequestSchema
>;
