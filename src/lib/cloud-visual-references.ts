import { z } from "zod";

export const cloudVisualSubjectKindSchema = z.enum([
  "character",
  "style",
  "location",
  "prop",
]);

export const cloudVisualReferenceInputSchema = z.object({
  projectId: z.string().uuid(),
  subjectKind: cloudVisualSubjectKindSchema,
  subjectId: z.string().uuid(),
  assetId: z.string().uuid(),
  label: z.string().trim().max(120),
});

export const cloudPanelSubjectAssignmentInputSchema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid(),
  panelId: z.string().uuid(),
  subjectKind: cloudVisualSubjectKindSchema.exclude(["style"]),
  subjectId: z.string().uuid(),
});

export type CloudVisualSubjectKind = z.infer<
  typeof cloudVisualSubjectKindSchema
>;
export type CloudVisualReferenceInput = z.infer<
  typeof cloudVisualReferenceInputSchema
>;
export type CloudPanelSubjectAssignmentInput = z.infer<
  typeof cloudPanelSubjectAssignmentInputSchema
>;

export type CloudVisualReference = {
  id: string;
  project_id: string;
  subject_kind: CloudVisualSubjectKind;
  subject_id: string;
  asset_id: string;
  label: string;
  created_at: string;
  url: string;
};

export type CloudPanelSubjectAssignment = {
  id: string;
  project_id: string;
  page_id: string;
  panel_id: string;
  subject_kind: Exclude<CloudVisualSubjectKind, "style">;
  subject_id: string;
  created_at: string;
};
