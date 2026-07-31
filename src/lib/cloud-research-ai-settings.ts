import { z } from "zod";
import { DomainError, ProviderUnavailableError } from "./domain-errors.ts";
import { createAdminClient } from "./supabase/admin.ts";

export const cloudResearchAiModelSchema = z.enum([
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
]);
export type CloudResearchAiModel = z.infer<
  typeof cloudResearchAiModelSchema
>;

export type CloudResearchAiSettings = {
  enabled: boolean;
  model: CloudResearchAiModel;
  configured: boolean;
  updatedAt: string;
};

export async function getCloudResearchAiSettings(): Promise<
  CloudResearchAiSettings | null
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cloud_research_ai_settings")
    .select("enabled,model,secret_id,updated_at")
    .eq("singleton", true)
    .maybeSingle<{
      enabled: boolean;
      model: string;
      secret_id: string | null;
      updated_at: string;
    }>();
  if (error || !data) return null;
  const model = cloudResearchAiModelSchema.safeParse(data.model);
  if (!model.success) return null;
  return {
    enabled: data.enabled,
    model: model.data,
    configured: Boolean(data.secret_id),
    updatedAt: data.updated_at,
  };
}

export async function setCloudResearchAiSettings(input: {
  actorProfileId: string;
  apiKey: string;
  model: CloudResearchAiModel;
  enabled: boolean;
}) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_cloud_research_ai_provider", {
    p_actor_profile_id: input.actorProfileId,
    p_api_key: input.apiKey,
    p_model: input.model,
    p_enabled: input.enabled,
  });
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "市場分析AI設定を保存できませんでした。",
      { cause: error },
    );
}

export async function getCloudResearchAiRuntimeConfig() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "get_cloud_research_ai_runtime_config",
  );
  const row = Array.isArray(data) ? data[0] : data;
  const parsed = z
    .object({
      enabled: z.boolean(),
      model: cloudResearchAiModelSchema,
      api_key: z.string().min(20).max(500),
    })
    .safeParse(row);
  if (error || !parsed.success || !parsed.data.enabled)
    throw new ProviderUnavailableError(
      "市場分析AIは現在準備中です。管理者へお問い合わせください。",
    );
  return {
    apiKey: parsed.data.api_key,
    model: parsed.data.model,
  };
}
