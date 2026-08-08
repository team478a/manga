"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { updateAdminMonitorIssueTask } from "@/modules/monitor-operations/infrastructure/admin-monitor-issue-repository";

const taskSchema = z.object({
  taskId: z.string().uuid(),
  operation: z.enum(["queue", "review", "resolve", "reject", "retry"]),
});

const operationStatus = {
  queue: "queued",
  review: "review_required",
  resolve: "resolved",
  reject: "rejected",
  retry: "queued",
} as const;

export async function updateMonitorIssueTaskAction(formData: FormData) {
  await requireAdmin();
  const parsed = taskSchema.safeParse({
    taskId: formData.get("taskId"),
    operation: formData.get("operation"),
  });
  if (!parsed.success) redirect(encodeURI("/admin/monitor-issues?error=対象タスクを確認してください"));
  const status = operationStatus[parsed.data.operation];
  const operation = await safelyLoadAdminData("monitor-issues/action", async () =>
    updateAdminMonitorIssueTask({
      taskId: parsed.data.taskId,
      status,
      resetClaim: parsed.data.operation === "retry",
    }),
  );
  if (!operation.ok || operation.value.error) redirect(encodeURI("/admin/monitor-issues?error=自動修正タスクを更新できませんでした"));
  revalidatePath("/admin/monitor-issues");
  redirect(`/admin/monitor-issues?message=${encodeURIComponent(status === "queued" ? "自動修正キューへ追加しました" : "対応状態を更新しました")}`);
}
