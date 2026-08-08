import type { PanelQualityEvaluation } from "../domain/panel-quality-score.ts";
import type { PanelSpecification } from "../domain/panel-specification.ts";

type RpcClient = {
  rpc: (name: string, parameters: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

type QueryClient = RpcClient & {
  from: (table: string) => any;
};

export async function savePanelSpecification(input: {
  client: RpcClient;
  generationJobId: string;
  specification: PanelSpecification;
}) {
  const { error } = await input.client.rpc("save_cloud_manga_panel_specification", {
    p_generation_job_id: input.generationJobId,
    p_specification: input.specification,
  });
  if (error) throw new Error(error.message ?? "panel_specification_save_failed");
}

export async function loadPanelSpecification(input: {
  client: QueryClient;
  generationJobId: string;
}) {
  const { data, error } = await input.client
    .from("cloud_manga_panel_specifications")
    .select("specification")
    .eq("generation_job_id", input.generationJobId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "panel_specification_load_failed");
  return data?.specification ?? null;
}

export async function savePanelQualityEvaluation(input: {
  client: RpcClient;
  generationJobId: string;
  evaluation: PanelQualityEvaluation;
  evaluationLatencyMs: number;
}) {
  const { error } = await input.client.rpc("save_cloud_manga_quality_evaluation", {
    p_generation_job_id: input.generationJobId,
    p_evaluation: input.evaluation,
    p_evaluation_latency_ms: input.evaluationLatencyMs,
  });
  if (error) throw new Error(error.message ?? "panel_quality_evaluation_save_failed");
}
