import { z } from "zod";

export const cloudAdultWorkManagementFeatureEnabled = () =>
  process.env.CLOUD_ADULT_WORK_MANAGEMENT_ENABLED?.toLowerCase() === "true";

export const cloudAdultWorkStatusSchema = z.enum([
  "draft",
  "editing",
  "review",
  "completed",
  "archived",
]);

export type CloudAdultWorkStatus = z.infer<
  typeof cloudAdultWorkStatusSchema
>;

export const cloudAdultWorkStatusLabels: Record<
  CloudAdultWorkStatus,
  string
> = {
  draft: "下書き",
  editing: "編集中",
  review: "確認中",
  completed: "完成",
  archived: "保管",
};

export const cloudAdultWorkUpdateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  status: cloudAdultWorkStatusSchema,
  notes: z.string().max(2000),
});
