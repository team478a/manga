import { z } from "zod";
import { DomainError, ProviderUnavailableError } from "./domain-errors.ts";
import { createAdminClient } from "./supabase/admin.ts";

export const cloudAdultGrokModelSchema = z.enum([
  "grok-4.5",
  "grok-4.20",
]);
export type CloudAdultGrokModel = z.infer<typeof cloudAdultGrokModelSchema>;

export type CloudAdultGrokSettings = {
  enabled: boolean;
  model: CloudAdultGrokModel;
  configured: boolean;
  updatedAt: string;
};

export async function getCloudAdultGrokSettings(): Promise<CloudAdultGrokSettings | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cloud_adult_grok_settings")
    .select("enabled,model,secret_id,updated_at")
    .eq("singleton", true)
    .maybeSingle<{
      enabled: boolean;
      model: string;
      secret_id: string | null;
      updated_at: string;
    }>();
  if (error || !data) return null;
  const model = cloudAdultGrokModelSchema.safeParse(data.model);
  if (!model.success) return null;
  return {
    enabled: data.enabled,
    model: model.data,
    configured: Boolean(data.secret_id),
    updatedAt: data.updated_at,
  };
}

export async function setCloudAdultGrokSettings(input: {
  actorProfileId: string;
  apiKey: string;
  model: CloudAdultGrokModel;
  enabled: boolean;
}) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_cloud_adult_grok_provider", {
    p_actor_profile_id: input.actorProfileId,
    p_api_key: input.apiKey,
    p_model: input.model,
    p_enabled: input.enabled,
  });
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "成人向けAI設定を保存できませんでした。",
      { cause: error },
    );
}

export async function getCloudAdultGrokRuntimeConfig() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "get_cloud_adult_grok_runtime_config",
  );
  const row = Array.isArray(data) ? data[0] : data;
  const parsed = z
    .object({
      enabled: z.boolean(),
      model: cloudAdultGrokModelSchema,
      api_key: z.string().min(20).max(500),
    })
    .safeParse(row);
  if (error || !parsed.success || !parsed.data.enabled)
    throw new ProviderUnavailableError(
      "成人向けAIは現在準備中です。管理者へお問い合わせください。",
    );
  return {
    provider: "xai" as const,
    endpoint: "https://api.x.ai/v1/responses",
    apiKey: parsed.data.api_key,
    model: parsed.data.model,
  };
}
