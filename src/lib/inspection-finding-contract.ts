import { z } from "zod";

export const INSPECTION_STATUSES = ["PASS", "WARNING", "FAIL", "NOT_EVALUATED"] as const;
export const INSPECTION_CATEGORIES = [
  "image_availability", "image_resolution", "character_count", "character_identity", "hair",
  "costume", "body_build", "anatomy", "background", "prop", "orientation", "gaze",
  "dialogue_speaker", "text_layout", "reading_order", "composition_duplicate", "continuity",
] as const;
export const INSPECTION_SUGGESTIONS = ["review", "edit_text", "regenerate_panel", "inpaint", "update_design", "update_reference"] as const;

const normalized = z.number().min(0).max(1);
export const inspectionRegionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rectangle"), x: normalized, y: normalized, width: normalized.positive(), height: normalized.positive() })
    .refine((value) => value.x + value.width <= 1 && value.y + value.height <= 1, "region must fit the image"),
  z.object({ kind: z.literal("polygon"), points: z.array(z.object({ x: normalized, y: normalized })).min(3).max(32) }),
]);

export const inspectionFindingSchema = z.object({
  status: z.enum(INSPECTION_STATUSES),
  category: z.enum(INSPECTION_CATEGORIES),
  reason: z.string().trim().min(1).max(500),
  region: inspectionRegionSchema.nullable(),
  confidence: normalized.nullable(),
  suggestion: z.enum(INSPECTION_SUGGESTIONS),
  evidence: z.record(z.string(), z.unknown()).default({}),
}).superRefine((value, context) => {
  if (value.status === "NOT_EVALUATED" && value.confidence !== null)
    context.addIssue({ code: "custom", path: ["confidence"], message: "not evaluated findings cannot have confidence" });
  if (value.status !== "NOT_EVALUATED" && value.confidence === null)
    context.addIssue({ code: "custom", path: ["confidence"], message: "evaluated findings require confidence" });
});

export const inspectionRunSchema = z.object({
  schemaVersion: z.literal(1),
  evaluator: z.object({ id: z.string().trim().min(1).max(100), version: z.string().trim().min(1).max(50), kind: z.enum(["rule", "vision", "hybrid"]), dataHandling: z.enum(["none", "local", "external"]) }),
  provenance: z.object({ projectId: z.string().uuid(), pageId: z.string().uuid().nullable(), panelId: z.string().uuid().nullable(), assetId: z.string().uuid().nullable(), generationJobId: z.string().uuid().nullable(), panelDesignRevision: z.number().int().positive().nullable() }),
  findings: z.array(inspectionFindingSchema).min(1).max(100),
});

export type InspectionFinding = z.infer<typeof inspectionFindingSchema>;
export type InspectionRun = z.infer<typeof inspectionRunSchema>;
