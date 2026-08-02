import { z } from "zod";

export const cloudChapterPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const cloudChapterProductionPlanSchema = z.object({
  projectId: z.string().uuid(),
  chapterId: z.string().uuid(),
  priority: cloudChapterPrioritySchema,
  assigneeName: z.string().trim().max(100),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: z.string().trim().max(1000),
});

export type CloudChapterPriority = z.infer<typeof cloudChapterPrioritySchema>;
export type CloudChapterProductionPlan = {
  id: string;
  project_id: string;
  chapter_id: string;
  priority: CloudChapterPriority;
  assignee_name: string;
  due_date: string | null;
  notes: string;
  updated_at: string;
};

export function isCloudChapterPlanOverdue(dueDate: string | null, complete: boolean, today: string) {
  return Boolean(dueDate && !complete && dueDate < today);
}
