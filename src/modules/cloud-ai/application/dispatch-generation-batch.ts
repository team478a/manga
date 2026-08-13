import { createAdminClient } from "../../../lib/supabase/admin.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export type CloudGenerationBatchDispatchResult = {
  status: "idle" | "dispatched" | "deferred" | "failed";
  targetId?: string;
  jobId?: string;
  errorCode?: string;
};

export async function dispatchNextCloudGenerationBatchTarget(input: {
  client?: AdminClient;
} = {}): Promise<CloudGenerationBatchDispatchResult> {
  const client = input.client ?? createAdminClient();
  const { data, error } = await client.rpc(
    "dispatch_next_cloud_generation_batch_target",
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.dispatch_status !== "string") return { status: "idle" };
  if (!["idle", "dispatched", "deferred", "failed"].includes(row.dispatch_status))
    throw new Error("cloud_generation_batch_dispatch_status_invalid");
  return {
    status: row.dispatch_status as CloudGenerationBatchDispatchResult["status"],
    targetId: typeof row.target_id === "string" ? row.target_id : undefined,
    jobId: typeof row.job_id === "string" ? row.job_id : undefined,
    errorCode: typeof row.error_code === "string" ? row.error_code : undefined,
  };
}
